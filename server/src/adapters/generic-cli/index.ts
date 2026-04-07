import type { ServerAdapterModule } from "../types.js";
import { execute } from "./execute.js";
import { testEnvironment } from "./test.js";

export const genericCliAdapter: ServerAdapterModule = {
  type: "generic_cli",
  execute,
  testEnvironment,
  models: [],
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: `# generic_cli agent configuration

Adapter: generic_cli

Run any CLI-based agent with structured command templates, environment injection,
and output parsing. Extends the process adapter with Paperclip-aware features.

## Core fields
- command (string, required): Command to execute. Supports template variables:
  {{agent_id}}, {{agent_name}}, {{company_id}}, {{run_id}},
  {{task_id}}, {{task_title}}, {{task_description}}, {{task_identifier}}
- args (string[] | string, optional): Command arguments. Also supports templates.
- cwd (string, optional): Absolute working directory.
- env (object, optional): KEY=VALUE environment variables. Values support templates.

## Execution profiles
- profile (string, optional): Use a built-in execution profile as defaults.
  Available profiles: python_script, node_script, shell_script, docker_run.
  Profile values are overridden by explicit config fields.

## Output parsing
- outputParser (object, optional): Configure structured output extraction.
  - mode: "json" | "regex" | "last_line"
  - pattern (string): Regex pattern (when mode is "regex")
  - flags (string): Regex flags (default "m")

## Environment injection
- injectTemplateVarsAsEnv (boolean, default true): Inject template variables
  as GENERIC_CLI_* environment variables into the child process.

## Operational fields
- timeoutSec (number, optional): Run timeout in seconds.
- graceSec (number, optional): SIGTERM grace period in seconds (default 15).

## Examples

### Python agent
\`\`\`json
{
  "command": "python3",
  "args": ["/path/to/agent.py", "--task", "{{task_identifier}}"],
  "cwd": "/path/to/project",
  "outputParser": { "mode": "json" }
}
\`\`\`

### Docker agent
\`\`\`json
{
  "profile": "docker_run",
  "env": { "docker_image": "my-agent:latest" }
}
\`\`\`
`,
  getConfigSchema: async () => ({
    fields: [
      {
        key: "command",
        label: "Command",
        type: "text" as const,
        required: true,
        hint: "Command to execute. Supports {{variable}} templates.",
      },
      {
        key: "args",
        label: "Arguments",
        type: "text" as const,
        required: false,
        hint: "Space-separated arguments. Supports {{variable}} templates.",
      },
      {
        key: "cwd",
        label: "Working Directory",
        type: "text" as const,
        required: false,
        hint: "Absolute path to working directory.",
      },
      {
        key: "profile",
        label: "Execution Profile",
        type: "select" as const,
        required: false,
        options: [
          { value: "python_script", label: "Python Script" },
          { value: "node_script", label: "Node.js Script" },
          { value: "shell_script", label: "Shell Script" },
          { value: "docker_run", label: "Docker Container" },
        ],
        hint: "Built-in profile preset for common agent runtimes.",
      },
      {
        key: "timeoutSec",
        label: "Timeout (seconds)",
        type: "number" as const,
        required: false,
        hint: "Maximum execution time in seconds. 0 = no timeout.",
      },
    ],
  }),
};
