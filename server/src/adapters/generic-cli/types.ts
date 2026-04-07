/**
 * generic_cli adapter — type definitions
 */

export interface OutputParserConfig {
  /** Parsing strategy: json, regex, or last_line */
  mode: "json" | "regex" | "last_line";
  /** Regex pattern (only used when mode is "regex") */
  pattern?: string;
  /** Regex flags (only used when mode is "regex"), defaults to "m" */
  flags?: string;
}

/**
 * Execution profile — a named preset for common CLI agent configurations.
 * Stored in adapterConfig.profile, the adapter looks up the profile to
 * populate defaults for command, args, env, and outputParser.
 */
export interface ExecutionProfile {
  name: string;
  description: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  outputParser?: OutputParserConfig;
  timeoutSec?: number;
  graceSec?: number;
}

/**
 * Built-in execution profiles for common agent runtimes.
 */
export const BUILTIN_PROFILES: Record<string, ExecutionProfile> = {
  python_script: {
    name: "python_script",
    description: "Run a Python script as an agent",
    command: "python3",
    args: ["{{script_path}}"],
    outputParser: { mode: "json" },
  },
  node_script: {
    name: "node_script",
    description: "Run a Node.js script as an agent",
    command: "node",
    args: ["{{script_path}}"],
    outputParser: { mode: "json" },
  },
  shell_script: {
    name: "shell_script",
    description: "Run a shell script as an agent",
    command: "bash",
    args: ["{{script_path}}"],
    outputParser: { mode: "last_line" },
  },
  docker_run: {
    name: "docker_run",
    description: "Run a Docker container as an agent",
    command: "docker",
    args: ["run", "--rm", "-e", "PAPERCLIP_AGENT_ID={{agent_id}}", "-e", "PAPERCLIP_COMPANY_ID={{company_id}}", "{{docker_image}}"],
    outputParser: { mode: "json" },
  },
};
