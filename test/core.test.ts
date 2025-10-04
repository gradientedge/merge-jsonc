import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mergeJsonc } from "../src/core.js";

const TEST_DIR = join(process.cwd(), "test-tmp");

describe("mergeJsonc core functionality", () => {
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

  test("should merge simple objects", () => {
    writeTestFile("a.jsonc", '{"name": "test", "version": 1}');
    writeTestFile("b.jsonc", '{"version": 2, "author": "user"}');

    const result = mergeJsonc({
      inputs: [join(TEST_DIR, "a.jsonc"), join(TEST_DIR, "b.jsonc")],
      out: join(TEST_DIR, "merged.jsonc"),
    });

    expect(result.wrote).toBe(true);
    expect(result.reason).toBe("wrote");

    const merged = readJsonObject("merged.jsonc");
    expect(merged).toEqual({
      name: "test",
      version: 2,
      author: "user",
    });
  });

  test("should deep merge nested objects", () => {
    writeTestFile(
      "base.jsonc",
      JSON.stringify({
        config: {
          database: { host: "localhost", port: 5432 },
          features: { auth: true, analytics: false },
        },
      })
    );

    writeTestFile(
      "override.jsonc",
      JSON.stringify({
        config: {
          database: { host: "prod-db", ssl: true },
          features: { analytics: true, experimental: true },
        },
      })
    );

    const result = mergeJsonc({
      inputs: [join(TEST_DIR, "base.jsonc"), join(TEST_DIR, "override.jsonc")],
      out: join(TEST_DIR, "result.jsonc"),
    });

    expect(result.wrote).toBe(true);

    const merged = readJsonObject("result.jsonc");
    expect(merged).toMatchObject({
      config: {
        database: { host: "prod-db", port: 5432, ssl: true },
        features: { auth: true, analytics: true, experimental: true },
      },
    });
  });

  test("should handle JSONC comments", () => {
    writeTestFile(
      "with-comments.jsonc",
      `{
      // Base configuration
      "name": "app",
      "config": {
        "debug": false // Production setting
      }
    }`
    );

    const result = mergeJsonc({
      inputs: [join(TEST_DIR, "with-comments.jsonc")],
      out: join(TEST_DIR, "no-comments.json"),
    });

    expect(result.wrote).toBe(true);

    const merged = readJsonObject("no-comments.json");
    expect(merged).toEqual({
      name: "app",
      config: { debug: false },
    });
  });

  test("should skip missing files when skipMissing is true", () => {
    writeTestFile("exists.jsonc", '{"value": 42}');

    const result = mergeJsonc({
      inputs: [join(TEST_DIR, "exists.jsonc"), join(TEST_DIR, "missing.jsonc")],
      out: join(TEST_DIR, "output.jsonc"),
      skipMissing: true,
    });

    expect(result.wrote).toBe(true);

    const merged = readJsonObject("output.jsonc");
    expect(merged).toEqual({ value: 42 });
  });

  test("should throw error for missing files when skipMissing is false", () => {
    writeTestFile("exists.jsonc", '{"value": 42}');

    expect(() => {
      mergeJsonc({
        inputs: [join(TEST_DIR, "exists.jsonc"), join(TEST_DIR, "missing.jsonc")],
        out: join(TEST_DIR, "output.jsonc"),
        skipMissing: false,
      });
    }).toThrow("Required file not found");
  });

  test("should return no_inputs when all files are missing with skipMissing", () => {
    const result = mergeJsonc({
      inputs: [join(TEST_DIR, "missing1.jsonc"), join(TEST_DIR, "missing2.jsonc")],
      out: join(TEST_DIR, "output.jsonc"),
      skipMissing: true,
    });

    expect(result.wrote).toBe(false);
    expect(result.reason).toBe("no_inputs");
  });

  test("should return up_to_date when output is newer than inputs", () => {
    writeTestFile("input.jsonc", '{"test": true}');
    writeTestFile("output.jsonc", '{"existing": true}');

    // Wait a bit to ensure different timestamps
    const now = Date.now();
    while (Date.now() - now < 10) {
      // Small delay
    }

    const result = mergeJsonc({
      inputs: [join(TEST_DIR, "input.jsonc")],
      out: join(TEST_DIR, "output.jsonc"),
    });

    expect(result.wrote).toBe(false);
    expect(result.reason).toBe("up_to_date");
  });

  test("should return no_content_change when merged content is identical", () => {
    const content = '{"value": 123}';
    writeTestFile("input.jsonc", content);
    writeTestFile("output.jsonc", JSON.stringify({ value: 123 }, null, 2));

    // Modify input timestamp to be newer
    const inputPath = join(TEST_DIR, "input.jsonc");
    const outputPath = join(TEST_DIR, "output.jsonc");

    // Touch the input file to make it newer
    writeFileSync(inputPath, content);

    const result = mergeJsonc({
      inputs: [inputPath],
      out: outputPath,
    });

    expect(result.wrote).toBe(false);
    expect(result.reason).toBe("no_content_change");
  });

  test("should format output as minified when pretty is false", () => {
    writeTestFile("input.jsonc", '{"name": "test", "nested": {"key": "value"}}');

    const result = mergeJsonc({
      inputs: [join(TEST_DIR, "input.jsonc")],
      out: join(TEST_DIR, "minified.json"),
      pretty: false,
    });

    expect(result.wrote).toBe(true);

    const content = readTestFile("minified.json");
    expect(content).toBe('{"name":"test","nested":{"key":"value"}}');
  });

  test("should format output as pretty when pretty is true", () => {
    writeTestFile("input.jsonc", '{"name":"test","nested":{"key":"value"}}');

    const result = mergeJsonc({
      inputs: [join(TEST_DIR, "input.jsonc")],
      out: join(TEST_DIR, "pretty.json"),
      pretty: true,
    });

    expect(result.wrote).toBe(true);

    const content = readTestFile("pretty.json");
    expect(content).toContain("  ");
    expect(content).toContain("\n");
  });

  test("should replace arrays by default", () => {
    writeTestFile("a.jsonc", '{"items": [1, 2]}');
    writeTestFile("b.jsonc", '{"items": [3, 4]}');

    const result = mergeJsonc({
      inputs: [join(TEST_DIR, "a.jsonc"), join(TEST_DIR, "b.jsonc")],
      out: join(TEST_DIR, "merged.jsonc"),
    });

    expect(result.wrote).toBe(true);

    const merged = readJsonObject("merged.jsonc");
    expect(merged).toMatchObject({ items: [3, 4] });
  });

  test("should concatenate arrays when arrayMerge is 'concat'", () => {
    writeTestFile("a.jsonc", '{"items": [1, 2]}');
    writeTestFile("b.jsonc", '{"items": [3, 4]}');

    const result = mergeJsonc({
      inputs: [join(TEST_DIR, "a.jsonc"), join(TEST_DIR, "b.jsonc")],
      out: join(TEST_DIR, "merged.jsonc"),
      arrayMerge: "concat",
    });

    expect(result.wrote).toBe(true);

    const merged = readJsonObject("merged.jsonc");
    expect(merged).toMatchObject({ items: [1, 2, 3, 4] });
  });

  describe("JSON5 support", () => {
    test("should parse JSON5 files with comments and unquoted keys", () => {
      writeTestFile(
        "base.json5",
        `{
        // This is a comment
        name: "test-app",
        version: "1.0.0",
        features: {
          auth: true, // trailing comma
        },
      }`
      );

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "base.json5")],
        out: join(TEST_DIR, "output.json"),
      });

      expect(result.wrote).toBe(true);

      const merged = readJsonObject("output.json");
      expect(merged).toMatchObject({
        name: "test-app",
        version: "1.0.0",
        features: { auth: true },
      });
    });

    test("should merge JSON5 with other formats", () => {
      writeTestFile(
        "base.json5",
        `{
        name: "app",
        config: {
          debug: true,
        }
      }`
      );

      writeTestFile(
        "override.jsonc",
        `{
        // JSONC comment
        "config": {
          "production": false
        }
      }`
      );

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "base.json5"), join(TEST_DIR, "override.jsonc")],
        out: join(TEST_DIR, "mixed.json"),
      });

      expect(result.wrote).toBe(true);

      const merged = readJsonObject("mixed.json");
      expect(merged).toMatchObject({
        name: "app",
        config: { debug: true, production: false },
      });
    });

    test("should output to JSON5 format when specified", () => {
      writeTestFile("input.json", '{"test": true, "value": 42}');

      const result = mergeJsonc({
        inputs: [join(TEST_DIR, "input.json")],
        out: join(TEST_DIR, "output.json5"),
      });

      expect(result.wrote).toBe(true);

      // Should be valid JSON5 (which is also valid JSON in this case)
      const parsed = readJsonObject("output.json5");
      expect(parsed).toMatchObject({ test: true, value: 42 });
    });
  });
});
