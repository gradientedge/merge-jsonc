# Cloudflare Wrangler Configuration Example

This example shows how to manage Wrangler configurations across environments.

## Files

- `wrangler.base.jsonc` - Shared worker configuration
- `wrangler.prod.jsonc` - Production environment settings

## Usage

```bash
# Generate production wrangler.toml equivalent as JSON
npx @gradientedge/merge-jsonc \
  --out wrangler.prod.json \
  wrangler.base.jsonc \
  wrangler.prod.jsonc

# Generate development config (just base)
npx @gradientedge/merge-jsonc \
  --out wrangler.dev.json \
  wrangler.base.jsonc
```

## Key Features

This pattern handles:

- **Environment Variables**: Merged `vars` objects
- **Resource Bindings**: Override KV and R2 configurations per environment
- **Routes**: Production-specific routing rules
- **Worker Names**: Environment-specific naming

## Benefits

- Keep sensitive production configs separate
- Share common worker settings
- Easy deployment pipeline integration
- Version control friendly
