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

type ConfigKey = keyof ConfigOptions;

type ConfigValidator<K extends ConfigKey> = (value: unknown, source: string) => ConfigOptions[K];

const validators: { [K in ConfigKey]-?: ConfigValidator<K> } = {
  out: (value, source) => {
    if (typeof value !== "string") {
      throw new Error(`Invalid 'out' value in '${source}'. Expected string.`);
    }
    return value;
  },
  skipMissing: (value, source) => {
    if (typeof value !== "boolean") {
      throw new Error(`Invalid 'skipMissing' value in '${source}'. Expected boolean.`);
    }
    return value;
  },
  pretty: (value, source) => {
    if (typeof value !== "boolean") {
      throw new Error(`Invalid 'pretty' value in '${source}'. Expected boolean.`);
    }
    return value;
  },
  dryRun: (value, source) => {
    if (typeof value !== "boolean") {
      throw new Error(`Invalid 'dryRun' value in '${source}'. Expected boolean.`);
    }
    return value;
  },
  backup: (value, source) => {
    if (typeof value !== "boolean") {
      throw new Error(`Invalid 'backup' value in '${source}'. Expected boolean.`);
    }
    return value;
  },
  indent: (value, source) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`Invalid 'indent' value in '${source}'. Expected finite number.`);
    }
    return value;
  },
};

function setConfigValue<K extends ConfigKey>(
  target: ConfigOptions,
  key: K,
  value: ConfigOptions[K]
) {
  target[key] = value;
}

function normalizeConfigOptions(raw: unknown, source: string): ConfigOptions {
  if (raw === null || typeof raw !== "object") {
    throw new Error(`Expected configuration from '${source}' to export an object.`);
  }

  const candidate = raw as Record<string, unknown>;
  const normalized: ConfigOptions = {};

  for (const key of Object.keys(validators) as ConfigKey[]) {
    if (!Object.hasOwn(candidate, key)) {
      continue;
    }

    const value = candidate[key];
    if (value === undefined) {
      continue;
    }

    const validator = validators[key];
    setConfigValue(normalized, key, validator(value, source));
  }

  return normalized;
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
        const importedModule: unknown = await import(configUrl);
        const rawConfig =
          importedModule && typeof importedModule === "object" && "default" in importedModule
            ? (importedModule as { default: unknown }).default
            : importedModule;
        return normalizeConfigOptions(rawConfig, configPath);
      } catch (error) {
        throw new Error(
          `Failed to load config from '${configPath}': ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  return {};
}
