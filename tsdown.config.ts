import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/core.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
  target: 'node22',
  banner: { js: '#!/usr/bin/env node' },
  outDir: 'dist',
})
