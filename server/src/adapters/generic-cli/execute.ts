import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import {
  asString,
  asNumber,
  asStringArray,
  asBoolean,
  parseObject,
  buildPaperclipEnv,
  buildInvocationEnvForLogs,
  ensurePathInEnv,
  resolveCommandForLogs,
  runChildProcess,
} from "../utils.js";
import type { OutputParserConfig } from "./types.js";

/**
 * Interpolate template variables into a string.
 *
 * Supported variables (from Paperclip agent/run context):
 *   {{task_id}}, {{task_title}}, {{task_description}},
 *   {{agent_id}}, {{agent_name}}, {{company_id}}, {{run_id}}
 *
 * Unresolved variables are left as-is to avoid breaking commands.
 */
function interpolate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] ?? `{{${key}}}`;
  });
}

function buildTemplateVars(ctx: AdapterExecutionContext): Record<string, string> {
  const { runId, agent, context } = ctx;
  const vars: Record<string, string> = {
    run_id: runId,
    agent_id: agent.id,
    agent_name: agent.name ?? "",
    company_id: agent.companyId,
  };
  // Pull task context if available (injected by heartbeat service)
  const taskContext = parseObject(context);
  if (typeof taskContext.taskId === "string") vars.task_id = taskContext.taskId;
  if (typeof taskContext.taskTitle === "string") vars.task_title = taskContext.taskTitle;
  if (typeof taskContext.taskDescription === "string") vars.task_description = taskContext.taskDescription;
  if (typeof taskContext.taskIdentifier === "string") vars.task_identifier = taskContext.taskIdentifier;
  return vars;
}

/**
 * Parse structured output from command stdout.
 */
function parseOutput(
  stdout: string,
  parserConfig: OutputParserConfig | null,
): Record<string, unknown> | null {
  if (!parserConfig) return null;

  const mode = parserConfig.mode;

  if (mode === "json") {
    // Extract JSON from stdout — try the whole output first, then look for
    // a JSON object/array boundary.
    const trimmed = stdout.trim();
    try {
      return { parsed: JSON.parse(trimmed) };
    } catch {
      // Try to find the last JSON object in the output
      const lastBrace = trimmed.lastIndexOf("}");
      const firstBrace = trimmed.indexOf("{");
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        try {
          return { parsed: JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) };
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  if (mode === "regex" && parserConfig.pattern) {
    const regex = new RegExp(parserConfig.pattern, parserConfig.flags ?? "m");
    const match = regex.exec(stdout);
    if (match) {
      return {
        fullMatch: match[0],
        groups: match.groups ?? null,
        captures: match.slice(1),
      };
    }
    return null;
  }

  if (mode === "last_line") {
    const lines = stdout.trim().split("\n").filter(Boolean);
    return lines.length > 0 ? { lastLine: lines[lines.length - 1] } : null;
  }

  return null;
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, config, onLog, onMeta } = ctx;

  const commandTemplate = asString(config.command, "");
  if (!commandTemplate) throw new Error("generic_cli adapter: missing 'command' in config");

  const templateVars = buildTemplateVars(ctx);

  // Interpolate command and args templates
  const command = interpolate(commandTemplate, templateVars);
  const rawArgs = asStringArray(config.args);
  const args = rawArgs.map((arg) => interpolate(arg, templateVars));

  const cwd = asString(config.cwd, process.cwd());
  const envConfig = parseObject(config.env);
  const env: Record<string, string> = { ...buildPaperclipEnv(agent) };
  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === "string") env[k] = interpolate(v, templateVars);
  }

  // Inject template vars as GENERIC_CLI_* env vars for the child process
  const injectVarsAsEnv = asBoolean(config.injectTemplateVarsAsEnv, true);
  if (injectVarsAsEnv) {
    for (const [k, v] of Object.entries(templateVars)) {
      env[`GENERIC_CLI_${k.toUpperCase()}`] = v;
    }
  }

  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  const resolvedCommand = await resolveCommandForLogs(command, cwd, runtimeEnv);
  const loggedEnv = buildInvocationEnvForLogs(env, {
    runtimeEnv,
    includeRuntimeKeys: ["HOME"],
    resolvedCommand,
  });

  const timeoutSec = asNumber(config.timeoutSec, 0);
  const graceSec = asNumber(config.graceSec, 15);

  // Output parser config
  const outputParserRaw = parseObject(config.outputParser);
  const outputParser: OutputParserConfig | null = outputParserRaw.mode
    ? {
        mode: asString(outputParserRaw.mode, "json") as OutputParserConfig["mode"],
        pattern: asString(outputParserRaw.pattern, ""),
        flags: asString(outputParserRaw.flags, "m"),
      }
    : null;

  if (onMeta) {
    await onMeta({
      adapterType: "generic_cli",
      command: resolvedCommand,
      cwd,
      commandArgs: args,
      env: loggedEnv,
    });
  }

  const proc = await runChildProcess(runId, command, args, {
    cwd,
    env,
    timeoutSec,
    graceSec,
    onLog,
  });

  if (proc.timedOut) {
    return {
      exitCode: proc.exitCode,
      signal: proc.signal,
      timedOut: true,
      errorMessage: `Timed out after ${timeoutSec}s`,
    };
  }

  // Parse structured output
  const parsedOutput = parseOutput(proc.stdout, outputParser);

  const resultJson: Record<string, unknown> = {
    stdout: proc.stdout,
    stderr: proc.stderr,
  };
  if (parsedOutput) {
    resultJson.parsed = parsedOutput;
  }

  if ((proc.exitCode ?? 0) !== 0) {
    return {
      exitCode: proc.exitCode,
      signal: proc.signal,
      timedOut: false,
      errorMessage: `Process exited with code ${proc.exitCode ?? -1}`,
      resultJson,
    };
  }

  return {
    exitCode: proc.exitCode,
    signal: proc.signal,
    timedOut: false,
    resultJson,
  };
}
