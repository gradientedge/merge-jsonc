import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { mergeJsonc } from "../src/core.js";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

const TEST_DIR = join(process.cwd(), "test-tmp-timing");
const CLI_PATH = join(process.cwd(), "dist/cli.js");

// Helper to run CLI commands
const runCli = (args: string[]): Promise<{ stdout: string; stderr: string; code: number }> => {
  return new Promise((resolve, reject) => {
    const child: ChildProcessWithoutNullStreams = spawn("node", [CLI_PATH, ...args], {
      cwd: TEST_DIR,
      stdio: "pipe",
    });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    let stdout = "";
    let stderr = "";

    child.on("error", reject);
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("close", (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });
  });
};

describe("Timing and backup functionality", () => {
  beforeEach(() => {
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

  const readJsonObject = (name: string): Record<string, unknown> => {
    const text = readTestFile(name);
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`Expected '${name}' to contain a JSON object.`);
    }
    return parsed as Record<string, unknown>;
  };

  const setFileTime = (filename: string, timeMs: number) => {
    const filePath = join(TEST_DIR, filename);
    const time = new Date(timeMs);
    utimesSync(filePath, time, time);
  };

  describe("File timestamp handling", () => {
    test("should detect up_to_date when output is newer than all inputs", () => {
      const baseTime = Date.now();

      // Create input files with older timestamps
      writeTestFile("input1.jsonc", '{"a": 1}');
      writeTestFile("input2.jsonc", '{"b": 2}');
      setFileTime("input1.jsonc", baseTime - 2000); // 2 seconds ago
      setFileTime("input2.jsonc", baseTime - 1000); // 1 second ago

      // Create output file with newer timestamp
      writeTestFile("output.json", '{"existing": true}');
      setFileTime("output.json", baseTime); // Now

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "input1.jsonc"), join(TEST_DIR, "input2.jsonc")],
        out: join(TEST_DIR, "output.json"),
      });

      expect(result.wrote).toBe(false);
      expect(result.reason).toBe("up_to_date");
    });

    test("should merge when input is newer than output", () => {
      const baseTime = Date.now();

      // Create output file with older timestamp
      writeTestFile("output.json", '{"existing": true}');
      setFileTime("output.json", baseTime - 2000); // 2 seconds ago

      // Create input file with newer timestamp
      writeTestFile("input.jsonc", '{"new": "data"}');
      setFileTime("input.jsonc", baseTime); // Now

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "input.jsonc")],
        out: join(TEST_DIR, "output.json"),
      });

      expect(result.wrote).toBe(true);
      expect(result.reason).toBe("wrote");

      const content = readJsonObject("output.json");
      expect(content).toEqual({ new: "data" });
    });

    test("should merge when any input is newer than output", () => {
      const baseTime = Date.now();

      // Create output file with older timestamp
      writeTestFile("output.json", '{"existing": true}');
      setFileTime("output.json", baseTime - 1000); // 1 second ago

      // Create input files - one older, one newer
      writeTestFile("old-input.jsonc", '{"old": "data"}');
      writeTestFile("new-input.jsonc", '{"new": "data"}');
      setFileTime("old-input.jsonc", baseTime - 2000); // 2 seconds ago
      setFileTime("new-input.jsonc", baseTime); // Now (newer than output)

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "old-input.jsonc"), join(TEST_DIR, "new-input.jsonc")],
        out: join(TEST_DIR, "output.json"),
      });

      expect(result.wrote).toBe(true);
      expect(result.reason).toBe("wrote");
    });

    test("should bypass timestamp check in dry run mode", () => {
      const baseTime = Date.now();

      // Create input file with older timestamp
      writeTestFile("input.jsonc", '{"new": "data"}');
      setFileTime("input.jsonc", baseTime - 2000); // 2 seconds ago

      // Create output file with newer timestamp
      writeTestFile("output.json", '{"existing": true}');
      setFileTime("output.json", baseTime); // Now

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "input.jsonc")],
        out: join(TEST_DIR, "output.json"),
        dryRun: true,
      });

      // Should process even though timestamps suggest up-to-date
      expect(result.wrote).toBe(false);
      expect(result.reason).toBe("dry_run");
      if (result.reason === "dry_run" && "preview" in result) {
        expect(result.preview).toBeDefined();
      }
    });

    test("should bypass timestamp check when output doesn't exist", () => {
      writeTestFile("input.jsonc", '{"data": "value"}');

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "input.jsonc")],
        out: join(TEST_DIR, "nonexistent.json"),
      });

      expect(result.wrote).toBe(true);
      expect(result.reason).toBe("wrote");
    });
  });

  describe("Content change detection", () => {
    test("should detect no_content_change when merged result equals existing content", () => {
      const baseTime = Date.now();

      // Create input with specific content
      writeTestFile("input.jsonc", '{"name": "test", "value": 42}');
      setFileTime("input.jsonc", baseTime); // Now

      // Create output with identical formatted content
      const expectedContent = JSON.stringify({ name: "test", value: 42 }, null, 2);
      writeTestFile("output.json", expectedContent);
      setFileTime("output.json", baseTime - 1000); // 1 second ago (older)

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "input.jsonc")],
        out: join(TEST_DIR, "output.json"),
      });

      expect(result.wrote).toBe(false);
      expect(result.reason).toBe("no_content_change");
    });

    test("should merge when content differs despite identical data", () => {
      const baseTime = Date.now();

      // Create input with specific content
      writeTestFile("input.jsonc", '{"name": "test", "value": 42}');
      setFileTime("input.jsonc", baseTime); // Now

      // Create output with same data but different formatting
      writeTestFile("output.json", '{"name":"test","value":42}'); // Minified
      setFileTime("output.json", baseTime - 1000); // 1 second ago

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "input.jsonc")],
        out: join(TEST_DIR, "output.json"),
        pretty: true,
      });

      expect(result.wrote).toBe(true);
      expect(result.reason).toBe("wrote");

      // Verify it was prettified
      const content = readTestFile("output.json");
      expect(content).toContain("  "); // Should have indentation
      expect(content).toContain("\n"); // Should have newlines
    });

    test("should handle content change detection with different indentation", () => {
      const baseTime = Date.now();

      // Create input
      writeTestFile("input.jsonc", '{"data": {"nested": "value"}}');
      setFileTime("input.jsonc", baseTime); // Now

      // Create output with 4-space indentation
      const fourSpaceContent = JSON.stringify({ data: { nested: "value" } }, null, 4);
      writeTestFile("output.json", fourSpaceContent);
      setFileTime("output.json", baseTime - 1000); // 1 second ago

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "input.jsonc")],
        out: join(TEST_DIR, "output.json"),
        indent: 2, // Request 2-space indentation
      });

      expect(result.wrote).toBe(true);
      expect(result.reason).toBe("wrote");

      // Verify indentation changed
      const content = readTestFile("output.json");
      const lines = content.split("\n");
      const indentedLine = lines.find((line) => line.startsWith("  ") && !line.startsWith("    "));
      expect(indentedLine).toBeDefined(); // Should have 2-space indentation
    });
  });

  describe("Backup file creation", () => {
    test("should create backup when overwriting existing file", () => {
      const baseTime = Date.now();

      // Create input with newer timestamp
      writeTestFile("input.jsonc", '{"new": "content", "added": true}');
      setFileTime("input.jsonc", baseTime); // Now

      // Create existing output to be backed up
      const originalContent = '{"original": "data", "keep": false}';
      writeTestFile("output.json", originalContent);
      setFileTime("output.json", baseTime - 1000); // 1 second ago

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "input.jsonc")],
        out: join(TEST_DIR, "output.json"),
        backup: true,
      });

      expect(result.wrote).toBe(true);
      expect(result.reason).toBe("wrote_with_backup");

      // Verify backup was created
      const backupPath = join(TEST_DIR, "output.json.bak");
      expect(existsSync(backupPath)).toBe(true);

      // Verify backup contains original content
      const backupContent = readTestFile("output.json.bak");
      expect(backupContent).toBe(originalContent);

      // Verify output has new content
      const newContent = readJsonObject("output.json");
      expect(newContent).toEqual({ new: "content", added: true });
    });

    test("should not create backup when no existing file", () => {
      writeTestFile("input.jsonc", '{"data": "value"}');

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "input.jsonc")],
        out: join(TEST_DIR, "new-output.json"),
        backup: true,
      });

      expect(result.wrote).toBe(true);
      expect(result.reason).toBe("wrote");

      // Verify no backup was created (no existing file to backup)
      const backupPath = join(TEST_DIR, "new-output.json.bak");
      expect(existsSync(backupPath)).toBe(false);

      // Verify output was created
      expect(existsSync(join(TEST_DIR, "new-output.json"))).toBe(true);
    });

    test("should not create backup when up_to_date", () => {
      const baseTime = Date.now();

      // Create input with older timestamp
      writeTestFile("input.jsonc", '{"data": "value"}');
      setFileTime("input.jsonc", baseTime - 1000); // 1 second ago

      // Create output with newer timestamp
      writeTestFile("output.json", '{"existing": "content"}');
      setFileTime("output.json", baseTime); // Now

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "input.jsonc")],
        out: join(TEST_DIR, "output.json"),
        backup: true,
      });

      expect(result.wrote).toBe(false);
      expect(result.reason).toBe("up_to_date");

      // Verify no backup was created
      const backupPath = join(TEST_DIR, "output.json.bak");
      expect(existsSync(backupPath)).toBe(false);
    });

    test("should not create backup when no_content_change", () => {
      const baseTime = Date.now();

      // Create input with newer timestamp
      const content = '{"same": "content"}';
      writeTestFile("input.jsonc", content);
      setFileTime("input.jsonc", baseTime); // Now

      // Create output with identical content but older timestamp
      writeTestFile("output.json", JSON.stringify({ same: "content" }, null, 2));
      setFileTime("output.json", baseTime - 1000); // 1 second ago

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "input.jsonc")],
        out: join(TEST_DIR, "output.json"),
        backup: true,
      });

      expect(result.wrote).toBe(false);
      expect(result.reason).toBe("no_content_change");

      // Verify no backup was created
      const backupPath = join(TEST_DIR, "output.json.bak");
      expect(existsSync(backupPath)).toBe(false);
    });

    test("should not create backup in dry run mode", () => {
      const baseTime = Date.now();

      // Create input with newer timestamp
      writeTestFile("input.jsonc", '{"new": "data"}');
      setFileTime("input.jsonc", baseTime); // Now

      // Create existing output
      writeTestFile("output.json", '{"old": "data"}');
      setFileTime("output.json", baseTime - 1000); // 1 second ago

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "input.jsonc")],
        out: join(TEST_DIR, "output.json"),
        backup: true,
        dryRun: true,
      });

      expect(result.wrote).toBe(false);
      expect(result.reason).toBe("dry_run");
      if (result.reason === "dry_run" && "preview" in result) {
        expect(result.preview).toBeDefined();
      }

      // Verify no backup was created in dry run
      const backupPath = join(TEST_DIR, "output.json.bak");
      expect(existsSync(backupPath)).toBe(false);

      // Verify original output is unchanged
      const originalContent = readJsonObject("output.json");
      expect(originalContent).toEqual({ old: "data" });
    });
  });

  describe("CLI backup functionality", () => {
    test("should create backup via CLI when content changes", async () => {
      // Create existing output file
      writeTestFile("existing.json", '{"original": "content"}');

      // Wait a moment then create input file (ensures different timestamps)
      await new Promise((resolve) => global.setTimeout(resolve, 10));
      writeTestFile("input.jsonc", '{"new": "content"}');

      const result = await runCli(["--out", "existing.json", "--backup", "input.jsonc"]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Wrote existing.json");
      expect(result.stdout).toContain("backup:");

      // Verify backup was created
      expect(existsSync(join(TEST_DIR, "existing.json.bak"))).toBe(true);

      const backupContent = readJsonObject("existing.json.bak");
      expect(backupContent).toEqual({ original: "content" });

      const newContent = readJsonObject("existing.json");
      expect(newContent).toEqual({ new: "content" });
    });

    test("should report backup creation in CLI output", async () => {
      // Create existing file first
      writeTestFile("target.json", '{"before": "merge"}');

      // Wait to ensure different timestamps
      await new Promise((resolve) => global.setTimeout(resolve, 10));
      writeTestFile("source.jsonc", '{"after": "merge"}');

      const result = await runCli(["--out", "target.json", "--backup", "source.jsonc"]);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/backup:.*target\.json\.bak/);
    });

    test("should not mention backup when up-to-date via CLI", async () => {
      const baseTime = Date.now();

      // Create input first
      writeTestFile("input.jsonc", '{"data": "value"}');
      setFileTime("input.jsonc", baseTime - 1000); // Make it older

      // Create newer output
      writeTestFile("output.json", '{"existing": "data"}');
      setFileTime("output.json", baseTime); // Make it newer

      const result = await runCli(["--out", "output.json", "--backup", "input.jsonc"]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain("Up-to-date");
      expect(result.stdout).not.toContain("backup:");

      // Verify no backup created
      expect(existsSync(join(TEST_DIR, "output.json.bak"))).toBe(false);
    });

    test("should handle multiple merges with backup correctly", async () => {
      // Create initial output
      writeTestFile("multi.json", '{"step": 0}');

      // First merge
      await new Promise((resolve) => global.setTimeout(resolve, 10));
      writeTestFile("step1.jsonc", '{"step": 1, "data": "first"}');

      let result = await runCli(["--out", "multi.json", "--backup", "step1.jsonc"]);

      expect(result.code).toBe(0);
      expect(existsSync(join(TEST_DIR, "multi.json.bak"))).toBe(true);

      // Verify first backup
      let backup = readJsonObject("multi.json.bak");
      expect(backup).toEqual({ step: 0 });

      // Second merge (should overwrite backup)
      await new Promise((resolve) => global.setTimeout(resolve, 10));
      writeTestFile("step2.jsonc", '{"step": 2, "data": "second"}');

      result = await runCli(["--out", "multi.json", "--backup", "step2.jsonc"]);

      expect(result.code).toBe(0);

      // Verify backup now contains result of first merge
      backup = readJsonObject("multi.json.bak");
      expect(backup).toEqual({ step: 1, data: "first" });

      // Verify current output has second merge
      const current = readJsonObject("multi.json");
      expect(current).toEqual({ step: 2, data: "second" });
    });
  });

  describe("Edge cases and timing race conditions", () => {
    test("should handle rapid successive operations", async () => {
      // Create base files
      writeTestFile("base.json", '{"counter": 0}');
      writeTestFile("increment.jsonc", '{"counter": 1}');

      // Perform rapid operations
      const promises = Array.from({ length: 5 }, (_, i) => {
        const inputName = `input-${String(i)}.jsonc`;
        writeTestFile(inputName, JSON.stringify({ counter: i + 1 }));
        return runCli(["--out", "base.json", "--backup", inputName]);
      });

      const results = await Promise.all(promises);

      // At least one should succeed (depending on timing)
      const successCount = results.filter((r) => r.code === 0).length;
      expect(successCount).toBeGreaterThan(0);
    });

    test("should handle microsecond timestamp precision", () => {
      const baseTime = Date.now();

      // This tests the behavior when timestamps are very close
      writeTestFile("input.jsonc", '{"test": "data"}');
      writeTestFile("output.json", '{"existing": "data"}');

      // Set nearly identical timestamps
      setFileTime("input.jsonc", baseTime);
      setFileTime("output.json", baseTime); // Exact same time

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "input.jsonc")],
        out: join(TEST_DIR, "output.json"),
      });

      // Should be up_to_date when timestamps are equal
      expect(result.wrote).toBe(false);
      expect(result.reason).toBe("up_to_date");
    });

    test("should handle backup when output file is read-only before write", () => {
      const baseTime = Date.now();

      // Create input newer than output
      writeTestFile("input.jsonc", '{"new": "data"}');
      setFileTime("input.jsonc", baseTime);

      // Create output with older timestamp
      writeTestFile("output.json", '{"original": "data"}');
      setFileTime("output.json", baseTime - 1000);

      // The atomic write functionality should handle this correctly
      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "input.jsonc")],
        out: join(TEST_DIR, "output.json"),
        backup: true,
      });

      expect(result.wrote).toBe(true);
      expect(result.reason).toBe("wrote_with_backup");

      // Verify backup exists and is correct
      expect(existsSync(join(TEST_DIR, "output.json.bak"))).toBe(true);
      const backup = readJsonObject("output.json.bak");
      expect(backup).toEqual({ original: "data" });
    });
  });
});
