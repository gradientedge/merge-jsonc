# JSON5 Support Examples

## Overview

The merge-jsonc tool now supports JSON5 files, which allow more readable syntax including comments, trailing commas, and unquoted keys.

## JSON5 Features Supported

- **Comments**: Both `//` and `/* */` style comments
- **Trailing commas**: No more syntax errors for trailing commas
- **Unquoted keys**: Object keys don't need quotes if they're valid identifiers
- **Single quotes**: Strings can use single quotes
- **Multi-line strings**: Using backticks or escaped newlines

## Example JSON5 Files

### Base Configuration (base.json5)

```json5
{
  // Application base configuration
  name: "my-app",
  version: "1.0.0",
  config: {
    database: {
      host: "localhost",
      port: 5432,
      // Connection pooling settings
      pool: {
        min: 2,
        max: 10,
      }, // <- trailing comma allowed
    },
    features: {
      auth: true,
      analytics: false, // disabled by default
    },
  },
}
```

### Development Overrides (dev.json5)

```json5
{
  config: {
    database: {
      // Override for development
      host: "dev-db.company.com",
      debug: true,
    },
    features: {
      analytics: true, // enable in dev for testing
      debugMode: true,
    },
  },
  // Development-specific settings
  devServer: {
    port: 3000,
    hot: true,
  },
}
```

## Usage Examples

### Basic JSON5 Merge

```bash
merge-jsonc --out config.json5 base.json5 dev.json5
```

### Mixed File Types

```bash
# Mix JSON, JSONC, and JSON5 files
merge-jsonc --out final.json base.json config.jsonc overrides.json5
```

### Preview JSON5 Merge

```bash
merge-jsonc --dry-run --out result.json5 *.json5
```

## Output Format

The output is always standard JSON (no comments or JSON5 syntax), regardless of input format:

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "config": {
    "database": {
      "host": "dev-db.company.com",
      "port": 5432,
      "debug": true,
      "pool": {
        "min": 2,
        "max": 10
      }
    },
    "features": {
      "auth": true,
      "analytics": true,
      "debugMode": true
    }
  },
  "devServer": {
    "port": 3000,
    "hot": true
  }
}
```
