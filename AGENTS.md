# make-oss-test

Testing repository for the Make.com GitHub open-source apps workflow. Validates the end-to-end lifecycle: clone from Make → edit locally → validate schemas → deploy back to Make.

## Tech Stack

- npm (package manager)
- `@integromat/make-cli` — CLI tool for clone/pull/push/deploy operations against Make.com API
- `@integromat/oss-schema` — JSON schemas for validating IML files
- `ajv` v8 + `ajv-formats` — schema validation engine
- `jsonc-parser` — used by `scripts/validate-app.js` to parse JSONC (JSON with comments)

## Domain Concepts

**IML (Integromat Markup Language)** — JSON-based format defining Make app components. All component files use the `.iml.json` extension and are JSONC (allow comments).

**App manifest** — `makecomapp.json` in each app's `src/` dir. Defines all components (`connection`, `module`, `function`, `rpc`, `webhook`), maps component names to their code files, and declares `origins` (remote Make API endpoints with `baseUrl`, `appId`, `appVersion`, and `idMapping`). Also references `apikeyFile: "../.secrets/apikey"` for local auth (outside repo).

**Module file types** — Each module has up to 6 files:
- `*.communication.iml.json` — HTTP request/response definition (validated against `api.json` schema)
- `*.mappable-params.iml.json` / `*.params.iml.json` / `*.interface.iml.json` — parameter definitions (`parameters.json` schema)
- `*.samples.iml.json` — sample output data (`samples.json` schema)
- `*.scope.iml.json` — OAuth scopes (no schema match in current mapping)
- `*.static-params.iml.json` — static parameters (`parameters.json` schema)

**Base config** — `general/base.iml.json` defines app-wide HTTP defaults: `baseUrl`, default `Authorization` header (`{{connection.apiKey}}`), error format, and log sanitization. Validated against `base.json` schema.

**Module groups** — `modules/groups.json` defines UI grouping of modules. Validated against `groups.json` schema.

## App Structure

Apps live under `apps/<app-name>/src/`. Currently one app: `apps/oss-app-test`. The manifest at `apps/oss-app-test/src/makecomapp.json` is the authoritative source for all component definitions and remote origin mappings.

Connections live in `connections/<name>/` with `.communication.iml.json` and `.params.iml.json`. Modules live in `modules/<name>/` with their 6 file types.

## Authentication

**Local development**: `make-cli` reads API key from `apps/<app-name>/.secrets/apikey` (outside repo, referenced in `makecomapp.json` as `apikeyFile: "../.secrets/apikey"`).

**CI**: `MAKE_API_TOKEN` and `MAKE_HOST` injected from GitHub Secrets into all workflows that call `make-cli` or `scripts/test-make.sh`.

Export `MAKE_API_TOKEN=<token>` before running any CLI commands locally.

## Key Scripts

**`scripts/validate-app.js`** — takes `<app-dir>` as CLI arg, recursively validates all `.iml.json` files against their schemas from `@integromat/oss-schema`. Schema mapping defined at top of file (14 rules, filename glob → schema name). Resolves schemas: local path first, then `@integromat/oss-schema/dist/json/<name>.json`. Flags: `--allow-warnings` suppresses non-zero exit on warnings. Exit 0 = valid, 1 = errors/warnings.

**`scripts/detect-changed-apps.sh`** — diffs `HEAD` against PR/push base SHA, extracts `apps/<name>` directories with changes, filters against `WHITELISTED_APPS`. Default whitelist: `apps/oss-app-test` only. Exit 1 if non-whitelisted apps changed. To add new apps to CI, uncomment entries in this script.

**`scripts/test-make.sh`** — validates API connectivity. Requires `MAKE_HOST` and `MAKE_API_TOKEN`. Makes a single authenticated GET, exits 0 on HTTP 200-399. Run via `npm run test:setup`. Optional `SHOW_BODY=1` prints response body.

## CI Workflows

**`validate-schema.yml`** — triggers on PRs touching `apps/**`, `scripts/validate-app.js`, `package.json`, or `package-lock.json`. Runs `detect-changed-apps.sh` then `node scripts/validate-app.js <app>` for each changed app. Posts PR comment with results.

**`deploy-app.yml`** — triggers on push to `master` touching `apps/**`. Runs `detect-changed-apps.sh`, deploys each changed whitelisted app via `make-cli deploy --no-prompt`. If `makecomapp.json` changes post-deploy, opens and auto-merges a PR on `chore/make-app-deploy-sync`.

**`app-sync.yml`** — hourly cron + manual dispatch. Pulls all `apps/*` from Make, opens/auto-merges PR on `chore/make-app-auto-sync` if changes detected.

**`validate-pr.yml`** — all PRs. Runs `@integromat/actions-toolkit validate-pr` for PR title/label conventions.

All CI workflows use `NPM_TOKEN` for private npm registry access when installing `@integromat/make-cli`.

## Local Development Workflow

```
# One-time clone
mkdir -p apps/<name>
npx make-cli clone <app-name> --local-dir ./apps/<name> --make-host <instance>

# Sync from Make
npm run pull   # prompts for app name

# Deploy to Make
npm run push   # prompts for app name

# Validate schemas
npm ci
node scripts/validate-app.js apps/oss-app-test
```

## Schema Validation Notes

- `makecomapp.json` uses a local schema path (`./syntaxes/local-development/schemas/makecomapp.schema.json`) that does not exist in the repo — it falls back to the package or skips.
- `*.scope.iml.json` files (the actual extension used) have no matching pattern in `validate-app.js`'s mapping — they are not validated. The mapping only covers `*.scope-list.iml.json`, `*.default-scope.iml.json`, `*.required-scope.iml.json`.
- AJV configured with `allErrors: true, strict: false, allowUnionTypes: true`.

## Cursor Commands

Three Cursor IDE commands exist in `.cursor/commands/` — inspect that directory for available AI-assisted workflows.

## Keeping AGENTS.md current

When your changes alter anything described in this file — project map, env vars, architectural patterns, API client behavior, error handling, test patterns, or packaging — notify the user that AGENTS.md should be updated and suggest the specific edit.
