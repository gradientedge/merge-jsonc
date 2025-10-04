import {
  existsSync,
  statSync,
  realpathSync,
  readFileSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import { resolve, relative, extname, dirname, sep, posix } from "node:path";

export const ROOT = realpathSync(process.cwd());
const SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

export function validateSegments(p: string) {
  const posixPath = p.split(sep).join(posix.sep);
  for (const segment of posixPath.split(posix.sep)) {
    if (!segment || segment === "." || segment === "..") continue;
    if (!SEGMENT_RE.test(segment)) {
      throw new Error(`Illegal path segment '${segment}' in '${p}'.`);
    }
  }
}

export function ensureInsideRoot(p: string) {
  validateSegments(p);
  const abs = resolve(ROOT, p);
  const finalPath = existsSync(abs) ? realpathSync(abs) : abs;
  const rel = relative(ROOT, finalPath);
  if (rel.startsWith("..") || (rel === "" && !finalPath.startsWith(ROOT))) {
    throw new Error(`Path '${p}' is outside the project root.`);
  }
  return finalPath;
}

export function ensureJsonLike(pathStr: string) {
  const ext = extname(pathStr).toLowerCase();
  if (ext !== ".json" && ext !== ".jsonc") {
    throw new Error(`Only .json or .jsonc files are allowed: '${pathStr}'`);
  }
}

export function safeInputPath(p: string, opts?: { optional?: boolean }) {
  ensureJsonLike(p);
  const abs = ensureInsideRoot(p);
  if (!existsSync(abs)) {
    if (opts?.optional) return null;
    throw new Error(`Required file not found: ${p}`);
  }
  const st = statSync(abs);
  if (!st.isFile()) throw new Error(`Not a regular file: ${p}`);
  return abs;
}

export function safeOutputPath(p: string) {
  ensureJsonLike(p);
  ensureInsideRoot(dirname(p));
  return ensureInsideRoot(p);
}

export function getMtimeMs(absPath: string | null) {
  return absPath && existsSync(absPath) ? statSync(absPath).mtimeMs : -Infinity;
}

export function atomicWrite(
  outAbs: string,
  text: string,
  createBackup?: boolean
): string | undefined {
  let backupPath: string | undefined;

  if (createBackup && existsSync(outAbs)) {
    backupPath = `${outAbs}.bak`;
    const backupContent = readText(outAbs);
    writeFileSync(backupPath, backupContent);
  }

  const tmp = `${outAbs}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, outAbs);

  return backupPath;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit

export function readText(absPath: string) {
  const stats = statSync(absPath);
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(
      `File '${absPath}' is too large (${Math.round(stats.size / 1024 / 1024)}MB). Maximum allowed size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
    );
  }
  return readFileSync(absPath, "utf8");
}
