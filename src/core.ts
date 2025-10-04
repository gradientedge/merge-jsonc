import { parse as parseJsonc } from "jsonc-parser";
import JSON5 from "json5";
import deepmerge from "deepmerge";
import { existsSync } from "node:fs";
import { safeInputPath, safeOutputPath, getMtimeMs, atomicWrite, readText } from "./fs-safety.js";

export interface MergeOptions {
  out: string;
  inputs: string[]; // left→right; later overrides earlier
  skipMissing?: boolean; // ignore missing inputs if true
  pretty?: boolean; // pretty-print JSON (default true)
  dryRun?: boolean; // preview changes without writing
  backup?: boolean; // create .bak file before overwriting
  indent?: number; // custom indentation (overrides pretty)
}

export type MergeResult =
  | {
      wrote: false;
      reason: "no_inputs" | "up_to_date" | "no_content_change" | "dry_run";
      preview?: string;
    }
  | {
      wrote: true;
      reason: "wrote" | "wrote_with_backup";
      out: string;
      backup?: string;
    };

function resolveInputPaths(inputs: string[], skipMissing: boolean): string[] {
  return inputs
    .map((p) => safeInputPath(p, { optional: skipMissing }))
    .filter((p): p is string => Boolean(p));
}

function checkIfUpToDate(outAbs: string, inputAbs: string[], dryRun: boolean): boolean {
  if (!existsSync(outAbs) || dryRun) {
    return false;
  }

  const outM = getMtimeMs(outAbs);
  const newestSrc = Math.max(...inputAbs.map(getMtimeMs));
  return newestSrc <= outM;
}

function parseJsonFile(filePath: string, content: string): Record<string, unknown> {
  const ext = filePath.toLowerCase().split(".").pop();

  try {
    if (ext === "json5") {
      return JSON5.parse(content);
    } else {
      // Default to JSONC parser for .json, .jsonc, and other extensions
      return parseJsonc(content);
    }
  } catch (error) {
    const fileType = ext === "json5" ? "JSON5" : "JSON/JSONC";
    throw new Error(
      `Failed to parse ${fileType} file '${filePath}': ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function mergeFiles(inputAbs: string[]): Record<string, unknown> {
  let combined: Record<string, unknown> = {};

  for (const abs of inputAbs) {
    const content = readText(abs);
    const parsed = parseJsonFile(abs, content);
    combined = deepmerge(combined, parsed);
  }

  return combined;
}

function calculateIndentation(indent?: number, pretty = true): number {
  if (indent !== undefined) {
    return indent;
  }
  return pretty ? 2 : 0;
}

function checkContentChanged(outAbs: string, newText: string): boolean {
  if (!existsSync(outAbs)) {
    return true;
  }

  const current = readText(outAbs);
  return current !== newText;
}

export function mergeJsonc(opts: MergeOptions): MergeResult {
  const {
    inputs,
    out,
    skipMissing = false,
    pretty = true,
    dryRun = false,
    backup = false,
    indent,
  } = opts;

  const inputAbs = resolveInputPaths(inputs, skipMissing);

  if (inputAbs.length === 0) {
    return { wrote: false, reason: "no_inputs" };
  }

  const outAbs = safeOutputPath(out);

  const combined = mergeFiles(inputAbs);
  const spaces = calculateIndentation(indent, pretty);
  const text = JSON.stringify(combined, null, spaces);

  if (!checkContentChanged(outAbs, text)) {
    return { wrote: false, reason: "no_content_change" };
  }

  if (checkIfUpToDate(outAbs, inputAbs, dryRun)) {
    return { wrote: false, reason: "up_to_date" };
  }

  if (dryRun) {
    return { wrote: false, reason: "dry_run", preview: text };
  }

  const backupPath = atomicWrite(outAbs, text, backup);

  return {
    wrote: true,
    reason: backupPath ? "wrote_with_backup" : "wrote",
    out: outAbs,
    backup: backupPath,
  };
}
