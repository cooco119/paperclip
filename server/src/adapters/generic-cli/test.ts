import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import {
  asString,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
} from "../utils.js";
import { BUILTIN_PROFILES } from "./types.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);

  // Resolve profile if specified
  const profileName = asString(config.profile, "");
  if (profileName) {
    if (BUILTIN_PROFILES[profileName]) {
      checks.push({
        code: "generic_cli_profile_found",
        level: "info",
        message: `Using execution profile: ${profileName}`,
      });
    } else {
      checks.push({
        code: "generic_cli_profile_unknown",
        level: "warn",
        message: `Unknown execution profile: ${profileName}. Available: ${Object.keys(BUILTIN_PROFILES).join(", ")}`,
      });
    }
  }

  // Command validation (may come from profile or direct config)
  const profile = profileName ? BUILTIN_PROFILES[profileName] : null;
  const command = asString(config.command, profile?.command ?? "");
  const cwd = asString(config.cwd, process.cwd());

  if (!command) {
    checks.push({
      code: "generic_cli_command_missing",
      level: "error",
      message: "generic_cli adapter requires a command (directly or via profile).",
      hint: "Set adapterConfig.command or adapterConfig.profile.",
    });
  } else {
    // Check if it's a template — skip resolution check for templates
    const isTemplate = /\{\{.+\}\}/.test(command);
    if (isTemplate) {
      checks.push({
        code: "generic_cli_command_template",
        level: "info",
        message: `Command uses template variables: ${command}`,
        hint: "Template variables will be resolved at execution time.",
      });
    } else {
      checks.push({
        code: "generic_cli_command_present",
        level: "info",
        message: `Configured command: ${command}`,
      });
    }
  }

  // Validate cwd
  try {
    await ensureAbsoluteDirectory(cwd);
    checks.push({
      code: "generic_cli_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "generic_cli_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd,
    });
  }

  // Command resolvability (skip for templates)
  const isTemplate = /\{\{.+\}\}/.test(command);
  if (command && !isTemplate) {
    const envConfig = parseObject(config.env);
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(envConfig)) {
      if (typeof value === "string") env[key] = value;
    }
    const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
    try {
      await ensureCommandResolvable(command, cwd, runtimeEnv);
      checks.push({
        code: "generic_cli_command_resolvable",
        level: "info",
        message: `Command is executable: ${command}`,
      });
    } catch (err) {
      checks.push({
        code: "generic_cli_command_unresolvable",
        level: "error",
        message: err instanceof Error ? err.message : "Command is not executable",
        detail: command,
      });
    }
  }

  // Output parser validation
  const outputParserRaw = parseObject(config.outputParser);
  const parserMode = asString(outputParserRaw.mode, "");
  if (parserMode) {
    if (["json", "regex", "last_line"].includes(parserMode)) {
      checks.push({
        code: "generic_cli_parser_valid",
        level: "info",
        message: `Output parser mode: ${parserMode}`,
      });
      if (parserMode === "regex") {
        const pattern = asString(outputParserRaw.pattern, "");
        if (!pattern) {
          checks.push({
            code: "generic_cli_parser_regex_missing",
            level: "warn",
            message: "Regex output parser requires a pattern.",
            hint: "Set adapterConfig.outputParser.pattern.",
          });
        } else {
          try {
            new RegExp(pattern);
            checks.push({
              code: "generic_cli_parser_regex_valid",
              level: "info",
              message: `Regex pattern is valid: ${pattern}`,
            });
          } catch {
            checks.push({
              code: "generic_cli_parser_regex_invalid",
              level: "error",
              message: `Invalid regex pattern: ${pattern}`,
            });
          }
        }
      }
    } else {
      checks.push({
        code: "generic_cli_parser_mode_unknown",
        level: "warn",
        message: `Unknown output parser mode: ${parserMode}. Valid: json, regex, last_line`,
      });
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
