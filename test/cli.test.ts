import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import JSON5 from "json5";

const TEST_DIR = join(process.cwd(), "test-tmp-cli");
const CLI_PATH = join(process.cwd(), "dist/cli.js");

// Helper to run CLI commands
const runCli = (args: string[]): Promise<{ stdout: string; stderr: string; code: number }> => {
  return new Promise((resolve, reject) => {
    const child: ChildProcessWithoutNullStreams = spawn("node", [CLI_PATH, ...args], {
      cwd: TEST_DIR,
      stdio: "pipe",
    });

    const { stdout: stdoutStream, stderr: stderrStream } = child;

    stdoutStream.setEncoding("utf8");
    stderrStream.setEncoding("utf8");

    let stdout = "";
    let stderr = "";

    const appendStdout = (chunk: string) => {
      stdout += chunk;
    };

    const appendStderr = (chunk: string) => {
      stderr += chunk;
    };

    child.on("error", (error) => {
      reject(error);
    });

    stdoutStream.on("data", appendStdout);
    stderrStream.on("data", appendStderr);

    child.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });
  });
};

describe("CLI integration tests", () => {
  beforeEach(() => {
    // Ensure the project is built
    if (!existsSync(CLI_PATH)) {
      throw new Error("CLI not built. Run 'npm run build' first.");
    }

    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  const writeTestFile = (name: string, content: string) => {
    writeFileSync(join(TEST_DIR, name), content);
  };

  const readTestFile = (name: string) => {
    return readFileSync(join(TEST_DIR, name), "utf8");
  };

  const readJsonFile = (name: string): Record<string, unknown> => {
    const text = readTestFile(name);
    // Strip leading comment header lines (// or #) that may be prepended for JSONC/JSON5 outputs
    const lines = text.split(/\r?\n/);
    let first = 0;
    while (first < lines.length) {
      const ln = lines[first];
      if (typeof ln !== "string" || !/^\s*(\/\/|#)/.test(ln)) break;
      first++;
    }
    const payload = lines.slice(first).join("\n");
    const parsed: unknown = JSON5.parse(payload);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`Expected '${name}' to contain a JSON object.`);
    }
    return parsed as Record<string, unknown>;
  };

  test("should show help with --help", async () => {
    const result = await runCli(["--help"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("merge-jsonc");
    expect(result.stdout).toContain("Options:");
    expect(result.stdout).toContain("--out");
    expect(result.stdout).toContain("--skip-missing");
    expect(result.stdout).toContain("Examples:");
  });

  test("should show version with --version", async () => {
    const result = await runCli(["--version"]);

    expect(result.code).toBe(0);
    // Accept versions like '1.2.3', '1.2.3-alpha.1', or '1.2.3+build.123'
    expect(result.stdout.trim()).toMatch(/^[A-Za-z0-9+-]+(?:\.[A-Za-z0-9+-]+)+$/);
  });

  test("should merge files successfully", async () => {
    writeTestFile("a.jsonc", '{"name": "test", "version": 1}');
    writeTestFile("b.jsonc", '{"version": 2, "author": "user"}');

    const result = await runCli(["--out", "merged.jsonc", "a.jsonc", "b.jsonc"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Wrote merged.jsonc");

    const merged = readJsonFile("merged.jsonc");
    expect(merged).toEqual({
      name: "test",
      version: 2,
      author: "user",
    });
  });

  test("should create minified output with --min", async () => {
    writeTestFile("input.jsonc", '{"name": "test", "nested": {"key": "value"}}');

    const result = await runCli(["--out", "output.json", "--min", "input.jsonc"]);

    expect(result.code).toBe(0);

    const content = readTestFile("output.json");
    expect(content).toBe('{"name":"test","nested":{"key":"value"}}');
  });

  test("should skip missing files with --skip-missing", async () => {
    writeTestFile("exists.jsonc", '{"value": 42}');

    const result = await runCli([
      "--out",
      "output.jsonc",
      "--skip-missing",
      "exists.jsonc",
      "missing.jsonc",
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Wrote output.jsonc");

    const merged = readJsonFile("output.jsonc");
    expect(merged).toEqual({ value: 42 });
  });

  test("should report up-to-date when no changes", async () => {
    writeTestFile("input.jsonc", '{"test": true}');

    // First run
    await runCli(["--out", "output.jsonc", "input.jsonc"]);

    // Second run should report up-to-date
    const result = await runCli(["--out", "output.jsonc", "input.jsonc"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Up-to-date");
  });

  test("should use default output filename when --out not specified", async () => {
    writeTestFile("input.jsonc", '{"test": true}');

    const result = await runCli(["input.jsonc"]);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain("combined.jsonc");
    expect(existsSync(join(TEST_DIR, "combined.jsonc"))).toBe(true);
  });

  test("should exit with error for unknown flags", async () => {
    const result = await runCli(["--unknown-flag"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("merge-jsonc");
    expect(result.stderr).toContain("You must provide at least one input file");
  });

  test("should exit with error when --out value is missing", async () => {
    const result = await runCli(["--out"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("merge-jsonc");
    expect(result.stderr).toContain("You must provide at least one input file");
  });

  test("should exit with error for missing required files", async () => {
    const result = await runCli(["--out", "output.jsonc", "nonexistent.jsonc"]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Required file not found");
  });

  test("should show help when no input files provided", async () => {
    const result = await runCli([]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("You must provide at least one input file");
  });
});
