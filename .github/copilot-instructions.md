# Copilot Project Instructions

## What this project is

- `merge-jsonc`: CLI + library to deep-merge JSON/JSONC/JSON5 files (later inputs override earlier), safe file I/O, array merge strategies (`replace` default, `concat` optional), adds header comments on JSONC/JSON5 outputs.
- ESM-only, Node 22+ target. Build artifacts are `.mjs` in `dist/`.

## Tech stack

- TypeScript (strict), built with **tsdown** (rolldown) -> outputs `dist/index.mjs`, `dist/cli.mjs` plus `.d.mts`.
- Tests: **Vitest** (v4) with V8 coverage.
- Lint/format: **ESLint 9**, **@typescript-eslint 8**, **Prettier 3**.
- Release: **semantic-release**; `prepublishOnly` runs only `npm run build`.

## Important paths

- Source: `src/core.ts`, `src/cli.ts`, `src/fs-safety.ts`.
- Build outputs: `dist/cli.mjs` (bin), `dist/index.mjs` (library), dts in `dist/*.d.mts`.
- Tests expect CLI at `dist/cli.mjs`.
- Workflow: `.github/workflows/release.yml` (CI + semantic-release).

## Commands

- Install: `npm install`
- Lint: `npm run lint`
- Format check: `npm run format:check`
- Test (auto-build first via pretest): `npm test`
- Build: `npm run build`
- Validate all: `npm run validate`

## Conventions & cautions

- Keep ESM: use `import` syntax; exports are ESM only.
- Preserve bin/exports in `package.json` pointing to `.mjs`.
- Avoid adding `prepublishOnly` steps beyond build (keeps semantic-release happy).
- Tests and CLI rely on `dist/cli.mjs`; ensure builds before running integration tests.
- Header comments added for JSONC/JSON5 outputs—tests strip them; don’t remove unless intentional.
- Default array merge is `replace`; `--array-merge concat` supported; keep behavior documented.
- Maintain ASCII in files unless existing content requires otherwise.

## When changing deps

- Update `package-lock.json` with `npm install`/`npm audit fix` and rerun `npm run validate`.
- Semantic-release expects conventional commits; squash PRs to a single conventional message when possible (e.g., `chore: ...`).
