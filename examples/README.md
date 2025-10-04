# Examples

This directory contains practical examples of using `@gradientedge/merge-jsonc` for common configuration scenarios.

## 📁 Directory Structure

- **vite-config/**: Layered Vite configuration (base → environment → local)
- **next-config/**: Next.js configuration management
- **wrangler-config/**: Cloudflare Wrangler config composition
- **docker-compose/**: Docker Compose environment layering
- **package-scripts/**: NPM script management across environments

## 🚀 Quick Start

Each example includes:

- Sample input files
- Build scripts
- Expected output
- Documentation

Navigate to any example directory and run:

```bash
npm install
npm run merge
```

## 💡 Common Patterns

### Environment Layering

```
base.jsonc → dev.jsonc → local.jsonc = final-config.json
```

### Feature Flags

```
features-base.jsonc → features-experiment.jsonc = features.json
```

### Multi-tenant Config

```
shared.jsonc → tenant-a.jsonc = tenant-a-config.json
```
