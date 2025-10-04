import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export interface ConfigOptions {
  out?: string;
  skipMissing?: boolean;
  pretty?: boolean;
  dryRun?: boolean;
  backup?: boolean;
  indent?: number;
}

export async function loadConfig(): Promise<ConfigOptions> {
  const configPaths = [
    ".merge-jsonc.config.js",
    ".merge-jsonc.config.mjs",
    "merge-jsonc.config.js",
    "merge-jsonc.config.mjs",
  ];

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const configUrl = pathToFileURL(join(process.cwd(), configPath)).href;
        const config = await import(configUrl);
        return config.default || config;
      } catch (error) {
        throw new Error(
          `Failed to load config from '${configPath}': ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  return {};
}
