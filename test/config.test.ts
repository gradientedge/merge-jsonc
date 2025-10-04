import { describe, test, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../src/config.js";

const ORIGINAL_CWD = process.cwd();

const createTempDir = () => mkdtempSync(join(tmpdir(), "merge-jsonc-config-"));

const cleanupTempDir = (dir: string) => {
  process.chdir(ORIGINAL_CWD);
  rmSync(dir, { recursive: true, force: true });
};

describe("loadConfig", () => {
  test("returns empty config when no files exist", async () => {
    const tempDir = createTempDir();
    try {
      process.chdir(tempDir);
      const result = await loadConfig();
      expect(result).toEqual({});
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  test("loads and normalizes configuration values", async () => {
    const tempDir = createTempDir();
    try {
      process.chdir(tempDir);
      const configPath = join(tempDir, ".merge-jsonc.config.mjs");
      writeFileSync(
        configPath,
        `export default {
          out: "custom.json",
          skipMissing: true,
          pretty: false,
          dryRun: true,
          backup: true,
          indent: 4
        };`
      );

      const result = await loadConfig();
      expect(result).toEqual({
        out: "custom.json",
        skipMissing: true,
        pretty: false,
        dryRun: true,
        backup: true,
        indent: 4,
      });
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  test("throws helpful error when config has invalid values", async () => {
    const tempDir = createTempDir();
    try {
      process.chdir(tempDir);
      const configPath = join(tempDir, "merge-jsonc.config.mjs");
      writeFileSync(
        configPath,
        `export default {
          indent: "two"
        };`
      );

      await expect(loadConfig()).rejects.toThrow(
        "Invalid 'indent' value in 'merge-jsonc.config.mjs'"
      );
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  test("ignores undefined values when normalizing", async () => {
    const tempDir = createTempDir();
    try {
      process.chdir(tempDir);
      const configPath = join(tempDir, ".merge-jsonc.config.mjs");
      writeFileSync(
        configPath,
        `export default {
          out: "keep.json",
          backup: undefined
        };`
      );

      const result = await loadConfig();
      expect(result).toEqual({ out: "keep.json" });
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  test("throws when module does not export an object", async () => {
    const tempDir = createTempDir();
    try {
      process.chdir(tempDir);
      const configPath = join(tempDir, "merge-jsonc.config.mjs");
      writeFileSync(configPath, "export default 'nope';");

      await expect(loadConfig()).rejects.toThrow(
        "Expected configuration from 'merge-jsonc.config.mjs' to export an object."
      );
    } finally {
      cleanupTempDir(tempDir);
    }
  });

  test("wraps import failures with config path", async () => {
    const tempDir = createTempDir();
    try {
      process.chdir(tempDir);
      const configPath = join(tempDir, "merge-jsonc.config.mjs");
      writeFileSync(configPath, "export default { broken: ; }");

      await expect(loadConfig()).rejects.toThrow(
        /Failed to load config from 'merge-jsonc\.config\.mjs':/
      );
    } finally {
      cleanupTempDir(tempDir);
    }
  });
});
