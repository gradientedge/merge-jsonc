# > Secure, fast JSON / JSONC / JSON5 deep-merging utility and CLI for Node 22+

> Built for composable configuration files such as **Wrangler**, **Vite**, or **Next.js**.

---

## ✨ Overview

`merge-jsonc` lets you combine multiple `.json`, `.jsonc`, or `.json5` files in order, producing a single merged output where **later files override earlier ones**.  
It's designed for config layering (base → local → environment), with:

- ⚡ **Deep merge** support (`deepmerge` under the hood)
- � **Incremental builds** — skips work when inputs or content haven't changed
- 🔒 **Path-safe** — resists directory-traversal and symlink escapes (Snyk-friendly)
- 🧾 **Multi-format aware** — parses JSON, JSONC (comments), and JSON5 (extended syntax)
- 🪶 **ESM-only, Node 22+** — zero legacy baggage
  > Secure, fast JSON / JSONC deep-merging utility and CLI for Node 22+  
  > Built for composable configuration files such as **Wrangler**, **Vite**, or **Next.js**.

---

## ✨ Overview

`merge-jsonc` lets you combine multiple `.json` or `.jsonc` files in order, producing a single merged output where **later files override earlier ones**.  
It’s designed for config layering (base → local → environment), with:

- ⚡ **Deep merge** support (`deepmerge` under the hood)
- 🧠 **Incremental builds** — skips work when inputs or content haven’t changed
- 🔒 **Path-safe** — resists directory-traversal and symlink escapes (Snyk-friendly)
- 🧾 **JSONC aware** — parses JSON with comments using `jsonc-parser`
- 🪶 **ESM-only, Node 22+** — zero legacy baggage

---

## 📦 Installation

```bash
npm i -D @gradientedge/merge-jsonc
# or
pnpm add -D @gradientedge/merge-jsonc
```

---

## 🔧 Development

```bash
# Format code (ensures JSONC files have no trailing commas)
npm run format

# Check formatting
npm run format:check

# Run linting
npm run lint

# Run tests
npm test

# Build the project
npm run build
```
