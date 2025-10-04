import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  validateSegments,
  ensureInsideRoot,
  ensureJsonLike,
  safeInputPath,
  getMtimeMs,
  atomicWrite,
  readText,
} from "../src/fs-safety.js";

const TEST_DIR = join(process.cwd(), "test-tmp-fs");

describe("fs-safety utilities", () => {
  beforeEach(() => {
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

  describe("validateSegments", () => {
    test("should allow valid path segments", () => {
      expect(() => { validateSegments("valid-file.json"); }).not.toThrow();
      expect(() => { validateSegments("folder/file.jsonc"); }).not.toThrow();
      expect(() => { validateSegments("a_b.c-d.json"); }).not.toThrow();
    });

    test("should reject invalid path segments", () => {
      expect(() => { validateSegments("file with spaces.json"); }).toThrow();
      expect(() => { validateSegments("file@with#special$.json"); }).toThrow();
      expect(() => { validateSegments("folder/file*.json"); }).toThrow();
    });
  });

  describe("ensureJsonLike", () => {
    test("should allow .json files", () => {
      expect(() => { ensureJsonLike("file.json"); }).not.toThrow();
    });

    test("should allow .jsonc files", () => {
      expect(() => { ensureJsonLike("file.jsonc"); }).not.toThrow();
    });

    test("should allow .json5 files", () => {
      expect(() => { ensureJsonLike("file.json5"); }).not.toThrow();
    });

    test("should reject other extensions", () => {
      expect(() => { ensureJsonLike("file.txt"); }).toThrow();
      expect(() => { ensureJsonLike("file.js"); }).toThrow();
      expect(() => { ensureJsonLike("file"); }).toThrow();
    });
  });

  describe("safeInputPath", () => {
    test("should return absolute path for existing JSON files", () => {
      const testFile = join(TEST_DIR, "test.json");
      writeFileSync(testFile, "{}");

      // Use relative path from project root
      const relativePath = testFile.replace(process.cwd() + "/", "");
      const result = safeInputPath(relativePath);

      expect(result).toBe(testFile);
    });

    test("should throw for non-existent files when optional is false", () => {
      expect(() => {
        safeInputPath("nonexistent.json");
      }).toThrow("Required file not found");
    });

    test("should return null for non-existent files when optional is true", () => {
      const result = safeInputPath("nonexistent.json", { optional: true });
      expect(result).toBe(null);
    });

    test("should reject non-JSON files", () => {
      expect(() => {
        safeInputPath("test.txt", { optional: true });
      }).toThrow("Only .json, .jsonc, or .json5 files are allowed");
    });
  });

  describe("getMtimeMs", () => {
    test("should return mtime for existing files", () => {
      const testFile = join(TEST_DIR, "test.json");
      writeFileSync(testFile, "{}");

      const mtime = getMtimeMs(testFile);
      expect(typeof mtime).toBe("number");
      expect(mtime).toBeGreaterThan(0);
    });

    test("should return -Infinity for non-existent files", () => {
      const mtime = getMtimeMs("/nonexistent/file.json");
      expect(mtime).toBe(-Infinity);
    });

    test("should return -Infinity for null input", () => {
      const mtime = getMtimeMs(null);
      expect(mtime).toBe(-Infinity);
    });
  });

  describe("atomicWrite and readText", () => {
    test("should write and read files atomically", () => {
      const testFile = join(TEST_DIR, "atomic.json");
      const content = '{"test": "content"}';

      atomicWrite(testFile, content);

      expect(existsSync(testFile)).toBe(true);

      const readContent = readText(testFile);
      expect(readContent).toBe(content);
    });

    test("should overwrite existing files", () => {
      const testFile = join(TEST_DIR, "overwrite.json");

      atomicWrite(testFile, "original");
      expect(readText(testFile)).toBe("original");

      atomicWrite(testFile, "updated");
      expect(readText(testFile)).toBe("updated");
    });
  });

  describe("path traversal security", () => {
    test("should reject directory traversal attempts", () => {
      expect(() => {
        ensureInsideRoot("../../../etc/passwd");
      }).toThrow("Path");
    });

    test("should reject absolute paths outside root", () => {
      expect(() => {
        ensureInsideRoot("/etc/passwd");
      }).toThrow("Path");
    });
  });
});
