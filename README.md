# 🧩 merge-jsonc

> Secure, fast JSON / JSONC / JSON5 deep-merging utility and CLI for Node 22+  
> Built for composable configuration files such as **Wrangler**, **Vite**, or **Next.js**.

---

## ✨ Overview

`merge-jsonc` lets you combine multiple `.json`, `.jsonc`, or `.json5` files in order, producing a single merged output where **later files override earlier ones**.  
It's designed for config layering (base → local → environment), with:

- ⚡ **Deep merge** support (`deepmerge` under the hood)
- 🧠 **Incremental builds** — skips work when inputs or content haven't changed
- 🔒 **Path-safe** — resists directory-traversal and symlink escapes (Snyk-friendly)
- 🧾 **Multi-format aware** — parses JSON, JSONC (comments), and JSON5 (extended syntax)
- 🪶 **ESM-only, Node 22+** — zero legacy baggage

---

## 📦 Installation

```bash
npm install @gradientedge/merge-jsonc
```

---

## 🚀 Quick Start

```bash
# Merge multiple config files
merge-jsonc --out final.json base.json dev.jsonc local.json5

# With backup and preview
merge-jsonc --backup --dry-run --out config.json *.jsonc
```

---

## 📖 Usage

### CLI

```bash
merge-jsonc [options] <input-files...>

Options:
  -o, --out           Output file path                    [default: "combined.jsonc"]
      --skip-missing  Ignore missing input files         [boolean] [default: false]
      --min           Minified output                     [boolean] [default: false]
      --dry-run       Preview without writing files      [boolean] [default: false]
      --backup        Create .bak before overwriting     [boolean] [default: false]
      --indent        Custom indentation spaces          [number]
  -h, --help          Show help
  -v, --version       Show version
```

### Programmatic API

```typescript
import { mergeJsonc } from "@gradientedge/merge-jsonc";

const result = mergeJsonc({
  inputs: ["base.json", "dev.jsonc", "local.json5"],
  out: "config.json",
  skipMissing: true,
});

console.log(result.wrote ? "Merged!" : result.reason);
```

---

## 🧪 Examples

See the [`examples/`](./examples/) directory for real-world usage patterns:

- **Vite Config**: Layer base, dev, and local Vite configurations
- **Wrangler Config**: Merge Cloudflare Workers configurations
- **JSON5 Features**: Demonstrate JSON5 syntax with comments and trailing commas

---

## 🛡️ Security Features

- **Path Traversal Protection**: Prevents `../` attacks and symlink escapes
- **File Type Validation**: Only processes `.json`, `.jsonc`, and `.json5` files
- **Atomic Writes**: Uses temporary files to prevent corruption
- **Snyk Compliant**: Passes security audits for enterprise use

---

## 🔧 Development

```bash
# Install dependencies
npm install

# Format code (ensures JSONC files have no trailing commas)
npm run format

# Check formatting
npm run format:check

# Run linting
npm run lint

# Run tests (66 comprehensive tests)
npm test

# Build the project
npm run build

# Test locally
npm run prepublishOnly
```

---

## 📝 License

MIT © [Gradient Edge](https://github.com/gradientedge)
