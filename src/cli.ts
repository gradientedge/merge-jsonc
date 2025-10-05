import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { createRequire } from "node:module";
import { mergeJsonc, type MergeOptions } from "./core.js";
import { loadConfig, type ConfigOptions } from "./config.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

interface ParsedArgs {
  out?: string;
  skipMissing?: boolean;
  pretty?: boolean;
  dryRun?: boolean;
  backup?: boolean;
  indent?: number;
  arrayMerge?: "replace" | "concat";
  header?: boolean;
  inputs: string[];
}

function formatOutputMessage(
  result: { wrote: boolean; reason: string; preview?: string; backup?: string },
  out: string
): string {
  if (result.reason === "dry_run" && result.preview) {
    return `[merge-jsonc] DRY RUN - would write to ${out}:\n${result.preview}`;
  }

  const msgs: Record<string, string> = {
    no_inputs: "[merge-jsonc] No existing inputs (skipping).",
    up_to_date: "[merge-jsonc] Up-to-date (no source changes).",
    no_content_change: "[merge-jsonc] Up-to-date (no content changes).",
    wrote: `[merge-jsonc] Wrote ${out}`,
    wrote_with_backup:
      result.wrote && result.backup
        ? `[merge-jsonc] Wrote ${out} (backup: ${result.backup})`
        : `[merge-jsonc] Wrote ${out}`,
  };

  return msgs[result.reason] || `[merge-jsonc] Unknown result: ${result.reason}`;
}

function mergeArgsWithConfig(args: ParsedArgs, config: ConfigOptions): MergeOptions {
  return {
    out: args.out ?? config.out ?? "combined.jsonc",
    inputs: args.inputs,
    skipMissing: args.skipMissing ?? config.skipMissing ?? false,
    pretty: args.pretty ?? config.pretty ?? true,
    dryRun: args.dryRun ?? config.dryRun ?? false,
    backup: args.backup ?? config.backup ?? false,
    indent: args.indent ?? config.indent,
    arrayMerge: args.arrayMerge ?? config.arrayMerge ?? "replace",
    // header default true
    // allow CLI to explicitly set header: false via --no-header
    header: args.header ?? config.header ?? true,
  };
}

async function run() {
  try {
    const argv = await yargs(hideBin(process.argv))
      .usage(
        "merge-jsonc (Node 22+, ESM)\n\nMerges JSON/JSONC/JSON5 files left→right (later files override earlier),\nwrites to --out, and skips writing when nothing changed."
      )
      .option("out", {
        alias: "o",
        describe: "Output .json/.jsonc/.json5 file path",
        type: "string",
        default: "combined.jsonc",
      })
      .option("skip-missing", {
        describe: "Ignore missing input files",
        type: "boolean",
        default: false,
      })
      .option("min", {
        describe: "Minified output (no whitespace)",
        type: "boolean",
        default: false,
      })
      .option("dry-run", {
        describe: "Preview output without writing files",
        type: "boolean",
        default: false,
      })
      .option("backup", {
        describe: "Create .bak file before overwriting",
        type: "boolean",
        default: false,
      })
      .option("indent", {
        describe: "Custom indentation spaces (overrides --min)",
        type: "number",
      })
      .option("array-merge", {
        describe: "Array merge strategy: 'replace' (default) or 'concat'",
        type: "string",
        choices: ["replace", "concat"],
        default: "replace",
      })
      .option("header", {
        describe: "Prepend a comment header to JSONC/JSON5 outputs (default: true)",
        type: "boolean",
        default: true,
      })
      .option("no-header", {
        describe: "Alias: do not prepend a comment header to JSONC/JSON5 outputs",
        type: "boolean",
        default: false,
      })
      .help("help")
      .alias("help", "h")
      .version(version)
      .alias("version", "v")
      .demandCommand(1, "You must provide at least one input file")
      .example(
        "merge-jsonc --out config.json base.jsonc dev.jsonc",
        "Merge base.jsonc and dev.jsonc into config.json"
      )
      .example("merge-jsonc --dry-run *.jsonc", "Preview merge of all .jsonc files")
      .example(
        "merge-jsonc --out config.json5 base.json5 local.json5",
        "Merge JSON5 files with comments"
      )
      .example(
        "merge-jsonc --backup --out prod.json stage.json prod-overrides.json",
        "Merge with backup"
      )
      .strict()
      .fail((msg, err, yargsInstance) => {
        if (err instanceof Error) {
          console.error("[merge-jsonc] Error:", err.message);
        } else if (typeof msg === "string" && msg.length > 0) {
          console.error("[merge-jsonc] Error:", msg);
        }
        console.error(yargsInstance.help());
        process.exit(1);
      })
      .parseAsync();

    // normalize header arg: prefer explicit --header, else respect --no-header negation
    let headerArg: boolean | undefined;
    if (typeof argv.header === "boolean") {
      headerArg = argv.header;
    } else if (argv["no-header"]) {
      headerArg = false;
    } else {
      headerArg = undefined;
    }

    const args: ParsedArgs = {
      out: argv.out,
      skipMissing: argv["skip-missing"],
      pretty: !argv.min,
      dryRun: argv["dry-run"],
      backup: argv.backup,
      indent: argv.indent,
      arrayMerge: argv["array-merge"] as "replace" | "concat" | undefined,
      // yargs presents boolean negations as the positive name being false
      // yargs supports both --header and --no-header; prefer explicit argv.header when present
      header: headerArg,
      inputs: Array.from(argv._, (value) => String(value)),
    };

    const config = await loadConfig();
    const mergeOptions = mergeArgsWithConfig(args, config);

    const result = mergeJsonc(mergeOptions);
    console.log(formatOutputMessage(result, mergeOptions.out));
  } catch (error) {
    if (error instanceof Error) {
      console.error("[merge-jsonc] Error:", error.message);
    } else {
      console.error("[merge-jsonc] Error:", error);
    }
    process.exit(1);
  }
}

void run();
