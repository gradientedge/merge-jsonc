import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import type { ConfigOptions } from "../src/config.js";
import type { MergeOptions } from "../src/core.js";

const loadConfigMock = vi.fn<() => Promise<ConfigOptions>>();
const mergeJsoncMock = vi.fn<(options: MergeOptions) => unknown>();

vi.mock("../src/config.js", () => ({
  loadConfig: loadConfigMock,
}));

vi.mock("../src/core.js", () => ({
  mergeJsonc: mergeJsoncMock,
}));

const ORIGINAL_ARGV = [...process.argv];

describe("CLI module", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    loadConfigMock.mockResolvedValue({});
    mergeJsoncMock.mockReturnValue({ wrote: true, reason: "wrote" });
    process.argv = ["node", "merge-jsonc", "input.jsonc"];
  });

  afterEach(() => {
    process.argv = [...ORIGINAL_ARGV];
    vi.restoreAllMocks();
  });

  test("logs dry run preview and merges CLI+config options", async () => {
    loadConfigMock.mockResolvedValueOnce({
      backup: true,
      indent: 4,
      pretty: false,
    });

    mergeJsoncMock.mockReturnValueOnce({
      wrote: false,
      reason: "dry_run",
      preview: '{\n  "value": 42\n}',
    });

    process.argv = [
      "node",
      "merge-jsonc",
      "--out",
      "result.json",
      "--skip-missing",
      "--backup",
      "input.jsonc",
    ];

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await import("../src/cli.js");
    await vi.waitFor(() => {
      expect(mergeJsoncMock).toHaveBeenCalledTimes(1);
    });

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(mergeJsoncMock).toHaveBeenCalledWith({
      out: "result.json",
      inputs: ["input.jsonc"],
      skipMissing: true,
      pretty: true,
      dryRun: false,
      backup: true,
      indent: 4,
      arrayMerge: "replace",
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("DRY RUN - would write to result.json")
    );
  });

  test("announces backup creation when merge reports backup", async () => {
    mergeJsoncMock.mockReturnValueOnce({
      wrote: true,
      reason: "wrote_with_backup",
      backup: "target.json.bak",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await import("../src/cli.js");
    await vi.waitFor(() => {
      expect(logSpy).toHaveBeenCalled();
    });

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      "[merge-jsonc] Wrote combined.jsonc (backup: target.json.bak)"
    );
  });

  test("logs fallback backup message when backup path missing", async () => {
    mergeJsoncMock.mockReturnValueOnce({
      wrote: true,
      reason: "wrote_with_backup",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await import("../src/cli.js");
    await vi.waitFor(() => {
      expect(logSpy).toHaveBeenCalled();
    });

    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("[merge-jsonc] Wrote combined.jsonc");
  });

  test("logs no-input message when merge skips all inputs", async () => {
    mergeJsoncMock.mockReturnValueOnce({ wrote: false, reason: "no_inputs" });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await import("../src/cli.js");
    await vi.waitFor(() => {
      expect(logSpy).toHaveBeenCalledWith("[merge-jsonc] No existing inputs (skipping).");
    });
  });

  test("logs no-content-change message when merge skips write", async () => {
    mergeJsoncMock.mockReturnValueOnce({ wrote: false, reason: "no_content_change" });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await import("../src/cli.js");
    await vi.waitFor(() => {
      expect(logSpy).toHaveBeenCalledWith("[merge-jsonc] Up-to-date (no content changes).");
    });
  });

  test("handles unknown reasons without crashing", async () => {
    mergeJsoncMock.mockReturnValueOnce({ wrote: false, reason: "mystery" });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await import("../src/cli.js");
    await vi.waitFor(() => {
      expect(logSpy).toHaveBeenCalledWith("[merge-jsonc] Unknown result: mystery");
    });
  });

  test("exits with error when merge throws", async () => {
    mergeJsoncMock.mockImplementationOnce(() => {
      throw new Error("boom");
    });

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await import("../src/cli.js");
    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalled();
    });

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith("[merge-jsonc] Error:", "boom");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test("exits with usage error when no input files provided", async () => {
    process.argv = ["node", "merge-jsonc"];

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await import("../src/cli.js");
    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    expect(errorSpy).toHaveBeenCalled();
  });
});
