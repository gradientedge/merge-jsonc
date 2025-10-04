# Vite Configuration Example

This example demonstrates layering Vite configurations for different environments.

## Files

- `vite.base.jsonc` - Shared base configuration
- `vite.dev.jsonc` - Development environment overrides
- `vite.local.jsonc` - Local developer customizations

## Usage

```bash
# Generate development config
npx @gradientedge/merge-jsonc \
  --out vite.config.json \
  vite.base.jsonc \
  vite.dev.jsonc \
  vite.local.jsonc

# Generate production config (no local overrides)
npx @gradientedge/merge-jsonc \
  --out vite.prod.json \
  vite.base.jsonc \
  vite.prod.jsonc
```

## Expected Output

The merged configuration will have:

- Base settings from `vite.base.jsonc`
- Development overrides (sourcemap: true, port: 3001)
- Local customizations (port: 4000, open: true)
- Combined plugins array: ["react", "eslint"]
- Merged define objects with all environment variables

This pattern allows developers to:

1. Share common configuration
2. Override settings per environment
3. Customize locally without affecting others
4. Version control environment configs while ignoring local ones
