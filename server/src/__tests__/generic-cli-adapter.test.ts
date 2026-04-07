import { describe, it, expect } from "vitest";
import { testEnvironment } from "../adapters/generic-cli/test.js";

describe("generic_cli adapter — testEnvironment", () => {
  const baseCtx = {
    companyId: "test-company",
    adapterType: "generic_cli" as const,
  };

  it("fails when command is missing", async () => {
    const result = await testEnvironment({ ...baseCtx, config: {} });
    expect(result.status).toBe("fail");
    expect(result.checks.some((c) => c.code === "generic_cli_command_missing")).toBe(true);
  });

  it("passes with a valid command", async () => {
    const result = await testEnvironment({
      ...baseCtx,
      config: { command: "echo", cwd: process.cwd() },
    });
    expect(result.status).toBe("pass");
    expect(result.checks.some((c) => c.code === "generic_cli_command_present")).toBe(true);
    expect(result.checks.some((c) => c.code === "generic_cli_cwd_valid")).toBe(true);
  });

  it("accepts template commands without resolution check", async () => {
    const result = await testEnvironment({
      ...baseCtx,
      config: { command: "{{custom_binary}}", cwd: process.cwd() },
    });
    // Template commands should be info, not error
    expect(result.checks.some((c) => c.code === "generic_cli_command_template")).toBe(true);
    expect(result.checks.every((c) => c.level !== "error")).toBe(true);
  });

  it("recognises built-in profiles", async () => {
    const result = await testEnvironment({
      ...baseCtx,
      config: { profile: "python_script", cwd: process.cwd() },
    });
    expect(result.checks.some((c) => c.code === "generic_cli_profile_found")).toBe(true);
  });

  it("warns on unknown profiles", async () => {
    const result = await testEnvironment({
      ...baseCtx,
      config: { profile: "nonexistent", command: "echo", cwd: process.cwd() },
    });
    expect(result.checks.some((c) => c.code === "generic_cli_profile_unknown")).toBe(true);
  });

  it("validates output parser mode", async () => {
    const result = await testEnvironment({
      ...baseCtx,
      config: {
        command: "echo",
        cwd: process.cwd(),
        outputParser: { mode: "json" },
      },
    });
    expect(result.checks.some((c) => c.code === "generic_cli_parser_valid")).toBe(true);
  });

  it("warns on invalid regex pattern", async () => {
    const result = await testEnvironment({
      ...baseCtx,
      config: {
        command: "echo",
        cwd: process.cwd(),
        outputParser: { mode: "regex", pattern: "[invalid" },
      },
    });
    expect(result.checks.some((c) => c.code === "generic_cli_parser_regex_invalid")).toBe(true);
  });

  it("warns on regex mode without pattern", async () => {
    const result = await testEnvironment({
      ...baseCtx,
      config: {
        command: "echo",
        cwd: process.cwd(),
        outputParser: { mode: "regex" },
      },
    });
    expect(result.checks.some((c) => c.code === "generic_cli_parser_regex_missing")).toBe(true);
  });

  it("validates regex pattern correctly", async () => {
    const result = await testEnvironment({
      ...baseCtx,
      config: {
        command: "echo",
        cwd: process.cwd(),
        outputParser: { mode: "regex", pattern: "status:\\s*(\\w+)" },
      },
    });
    expect(result.checks.some((c) => c.code === "generic_cli_parser_regex_valid")).toBe(true);
  });

  it("fails on invalid cwd", async () => {
    const result = await testEnvironment({
      ...baseCtx,
      config: { command: "echo", cwd: "/nonexistent/path/that/does/not/exist" },
    });
    expect(result.status).toBe("fail");
    expect(result.checks.some((c) => c.code === "generic_cli_cwd_invalid")).toBe(true);
  });
});
