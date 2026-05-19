---
complexity: structural
status: proposed
---

# Roadmap: TypeScript CLI & Local Web-UI Foundation

> Move the **public-facing entry point** of `@event4u/agent-config` from
> the Bash wrapper `scripts/agent-config` to a TypeScript binary that
> ships through `npx`, and add a small embedded HTTP server + static
> UI bundle that future roadmaps (unified-setup-and-settings-gui,
> explainability-v2) build on top of. **The Python engine, Python lint
> scripts, hooks and the work-engine stay where they are** — the TS
> layer is a thin distribution + UX shell that subprocess-invokes
> Python for everything heavy. This roadmap delivers infrastructure
> only; no user-visible feature changes.

## Prerequisites

- [ ] Read [`AGENTS.md`](../../AGENTS.md), [`docs/decisions/ADR-007-agent-discovery-scopes.md`](../../docs/decisions/ADR-007-agent-discovery-scopes.md), [`docs/decisions/ADR-010-profile-pack-preset-boundary.md`](../../docs/decisions/ADR-010-profile-pack-preset-boundary.md), [`docs/decisions/ADR-011-domain-pack-readiness.md`](../../docs/decisions/ADR-011-domain-pack-readiness.md)
- [ ] Confirm the current entry point: `scripts/agent-config` (Bash, 955 LOC) dispatches to `scripts/_cli/cmd_*.py` modules and is wired into `package.json` via `"bin": { "agent-config": "scripts/agent-config" }`
- [ ] Confirm `package.json` is already `"private": false` with a `bin` field — the external feedback file in `agents/tmp/typescript.txt` is wrong about that; this roadmap MUST NOT recreate `private: true` or `postinstall` semantics that no longer exist
- [ ] Confirm Node version policy: the package targets the LTS line that npm itself ships (Node 20 LTS at draft time); pin via `engines.node` in `package.json`
- [ ] Confirm the user has `npm` available locally (`node --version`, `npm --version`)

## Context

`agent-config` is distributed as an npm package and consumers invoke it
via `npx @event4u/agent-config <cmd>`. The current entry point is a
~950-line Bash wrapper that delegates almost every subcommand to a
Python `cmd_*.py` module under `scripts/_cli/`. Two structural
problems follow from that shape:

1. **Bash is hostile to a GUI.** A wizard / settings editor / "explain
   last" trace viewer all need a structured runtime — argv parsing,
   subprocess orchestration, an embedded HTTP server, schema-driven
   form rendering. Bash + Python over stdio is the wrong substrate
   for that; Node is the right one because it is **already on the
   consumer's machine** (otherwise `npx` itself would not work).

2. **Python as a hard dependency is a UX tax.** Today the installer
   degrades to "payload-only" when Python ≥ 3.9 is missing. With a
   TS entry point, Python becomes optional for the most-used Tier-0
   commands (`init`, `sync`, `validate` skeleton, `versions`,
   `doctor` skeleton); it stays mandatory for the Python-heavy ones
   (`work`, `migrate-state`, the lint scripts, `compile_router.py`).
   This narrows the "Python required" surface to advanced use,
   matching the recommendation in `agents/tmp/typescript.txt`.

The two follow-up roadmaps (`unified-setup-and-settings-gui` and
`explainability-v2-explain-last`) **both** require an embedded local
HTTP server and a static UI bundle. Building that infrastructure once,
in this roadmap, is the cheaper sequence.

### What this roadmap is NOT

- Not a Python rewrite. `scripts/_cli/cmd_*.py`, `scripts/install.py`,
  `scripts/work_engine/`, every `scripts/lint_*.py` and every
  `scripts/check_*.py` stay in Python and stay invoked as
  subprocesses.
- Not a removal of `scripts/agent-config`. The Bash wrapper survives
  for one full minor cycle as a deprecation shim that forwards to the
  TS binary. Removal is its own follow-up roadmap.
- Not an Electron / Tauri app. The local GUI is **vanilla HTML + a
  Vite-built JS bundle**, served from the TS binary on
  `127.0.0.1:<random-free-port>`, and opened via the `open` npm
  package. No desktop-app packaging.

## Acceptance criteria (whole roadmap)

- [ ] `npx @event4u/agent-config@<this-version> --version` runs **without** Python on the consumer's PATH and prints the package version
- [ ] `npx @event4u/agent-config init` is dispatched by the TS binary, forwards every existing flag to `scripts/install.py` unchanged, and exits with the same code as today
- [ ] `package.json` `"bin"` points at the **compiled** TS entry point under `dist/cli/agent-config.js`; the Bash file stays on disk and is invoked as a fallback only when `dist/` is missing (development sources)
- [ ] `agent-config ui:serve` starts a local Fastify server on a free port between 41000 and 41999, serves the static UI bundle from `dist/ui/`, and exposes a JSON-RPC-shaped `/api/v1/ping` endpoint that returns `{ ok: true, version, project_root }`
- [ ] `agent-config ui:serve --no-open` runs without launching a browser (CI / headless usage)
- [ ] Server binds **only** to `127.0.0.1`; any non-loopback bind attempt fails the contract test
- [ ] Every TS source file passes `npm run typecheck` (strict mode) and `npm run lint` (eslint, project config); both targets are wired into `task ci-fast` via new sub-tasks (see Phase 5)
- [ ] One end-to-end vitest spec covers: spawn binary → request `/api/v1/ping` → assert shape; runs in < 5 s
- [ ] The Bash wrapper's full subcommand table is preserved — `agent-config --help` from the TS binary lists the **identical** Tier-0/1/2 commands in the **identical** order as the Bash wrapper does today
- [ ] No new runtime dependency outside the locked-down list in Phase 1.2 (fastify, @fastify/static, commander, open, zod, execa; dev deps: typescript, tsx, vite, vitest, eslint, @types/*)
- [ ] `npm pack --dry-run` shows a tarball ≤ +400 KB compared to the current 2.25.x release (compiled JS only; no `node_modules`, no `src/`)
- [ ] All five phases below carry a CI-step or test command that lints, type-checks or asserts the phase's deliverable; none use `task ci`, `task ci-fast`, `make test` or any other full-suite literal in checkbox steps

## Non-goals (explicitly out of scope)

- Re-implementing any `scripts/_cli/cmd_*.py` in TypeScript. The TS
  binary **parses argv and delegates**; the Python module decides.
- Re-implementing `scripts/install.py`, `scripts/work_engine/`, any
  `scripts/lint_*.py`, `scripts/check_*.py`, `compile_router.py`,
  `audit_mcp_tools.py`, hook scripts, or memory bridges.
- Building the actual wizard UI, settings form, or explain-last view —
  those live in `unified-setup-and-settings-gui` and
  `explainability-v2-explain-last`.
- Bundling Node itself (no `pkg`, no `nexe`). `npx` brings Node.
- Replacing the Python work-engine with a Node-based orchestrator.
- Adding a websocket / SSE layer. The follow-up roadmaps may add one;
  this one ships HTTP request/response only.
- Anything Electron, Tauri, or browser-extension-shaped.
- Renaming the npm package, changing the scope, or republishing under
  a different name.


## Phase 0: Decide the shell — argv parser, package shape, lockfile

> Lock the dependency surface and the npm-package shape **before** any
> TS file is written. Every later phase reads from the choices made
> here. Skipping this phase is the failure mode that turned the
> existing Bash wrapper into a 955-line maintenance liability.

### Step 0.1: Lock the dependency list

- [ ] **Create file** `docs/decisions/ADR-012-typescript-cli-shell.md` (NEW). Status `Accepted`. Decision body lists the **runtime** deps and the **dev** deps with one line of justification each. Runtime deps frozen at:
  - `commander` — argv parsing; chosen over `yargs` for smaller install footprint and zero transitive deps
  - `fastify` — HTTP server; chosen over `express` per `agents/tmp/typescript.txt`: faster startup, schema-first request validation, stable v4 line
  - `@fastify/static` — static-file plugin
  - `open` — cross-platform "open URL in browser"; single function, 0 deps
  - `zod` — runtime schema for request/response bodies; **reused** in `unified-setup-and-settings-gui` for settings validation, so installing it here is amortised
  - `execa` — subprocess wrapper around Python; chosen over raw `child_process` because we need stream-capture + exit-code propagation + Windows-safe escaping
  - `js-yaml` — read `.agent-settings.yml`; Python also reads it, but the TS layer needs the version pin + a few personal-prefs keys before spawning Python
- [ ] Dev deps frozen at: `typescript`, `tsx`, `vite`, `vitest`, `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@types/node`. No `ts-node`, no `nodemon`, no `webpack`, no `rollup` directly.
- [ ] **Forbidden** in this roadmap: `inquirer`, `prompts`, `chalk`, `ora`, `boxen`, anything that puts colour codes into stdout when not a TTY, anything that pulls > 5 transitive deps. Rationale: the binary must stay light enough for `npx` first-run feel.
- [ ] **Decision matrix** in the ADR has columns: option · install size · transitive deps · stars · last release · why-chosen / why-rejected. One row per candidate (express vs fastify, yargs vs commander, inquirer vs prompts vs none).

### Step 0.2: Decide the source layout

- [ ] ADR-012 records the source tree:
  ```text
  src/
    cli/
      agent-config.ts            # bin entry (#!/usr/bin/env node)
      commands/
        init.ts                  # forwards to scripts/install.py
        sync.ts                  # forwards to scripts/_cli/cmd_sync.py
        validate.ts              # forwards to scripts/_cli/cmd_validate.py
        versions.ts              # native TS (talks to npm registry)
        ui-serve.ts              # boots Fastify, opens browser
        # … one .ts per Tier-0/1/2 subcommand, all thin forwarders
      python/
        runPython.ts             # execa wrapper, stream pass-through
        resolvePython.ts         # python3 / py / python detection
      settings/
        readSettings.ts          # parse .agent-settings.yml (read-only)
      log/
        logger.ts                # leveled logger, NO chalk
    server/
      app.ts                     # Fastify instance + route registration
      routes/
        ping.ts                  # GET /api/v1/ping
        # future roadmaps add routes here
      port.ts                    # free-port picker (41000–41999)
    ui/
      index.html                 # mount point only
      main.ts                    # bundle entry (Vite)
      # future roadmaps add components here
  dist/
    cli/                         # tsc output of src/cli + src/server
    ui/                          # vite build output of src/ui
  ```
- [ ] No `src/index.ts` god-file. No `src/utils.ts` dump-bin. Every helper lives in a domain folder (`python/`, `settings/`, `log/`).
- [ ] Path aliases: `tsconfig.json` declares `"baseUrl": "./src"` and `"paths": { "@cli/*": ["cli/*"], "@server/*": ["server/*"] }`. No deeper aliasing.

### Step 0.3: Decide the npm-package shape

- [ ] ADR-012 records: `package.json` `"bin"` MUST point at `dist/cli/agent-config.js` (compiled output), not `src/cli/agent-config.ts`. Rationale: a runtime TS compile via `tsx` would force a multi-hundred-millisecond hit on every `npx` cold start; we ship pre-compiled JS to keep cold-start under 800 ms.
- [ ] `"files"` in `package.json` MUST add `dist/` and MUST keep `scripts/agent-config` (the Bash deprecation shim). It MUST NOT include `src/`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`.
- [ ] `"engines": { "node": ">=20.11.0" }` — Node 20 LTS minimum. The release workflow's `node-version` matrix is updated in the same PR.
- [ ] `"scripts"` additions (npm-script names, not Taskfile entries — those go in Phase 5): `"build:cli"`, `"build:ui"`, `"build"` (runs both), `"typecheck"`, `"lint:ts"`, `"test:ts"`, `"prepack"` (runs `build`). No `postinstall` script.

### Step 0.4: Phase 0 acceptance

- [ ] `docs/decisions/ADR-012-typescript-cli-shell.md` exists, links to ADR-007 / ADR-010 / ADR-011, and every decision matrix is populated
- [ ] `python3 scripts/lint_adr_index.py` (existing) passes; the new ADR appears in the index
- [ ] No source files written yet — Phase 0 is contract only

## Phase 1: Scaffold the TS toolchain (no behaviour change)

> Add the build infrastructure to the repo without changing the
> installed product. After this phase, `scripts/agent-config` is still
> the live entry point; `dist/cli/agent-config.js` exists but is not
> yet wired into `"bin"`.

### Step 1.1: Initialise the TypeScript project

- [ ] `npm install --save-dev typescript@^5.5 tsx@^4 @types/node@^20 eslint@^9 @typescript-eslint/eslint-plugin@^8 @typescript-eslint/parser@^8` — pinned majors, no `^`-creep beyond what is listed
- [ ] `npm install --save commander@^12 fastify@^5 @fastify/static@^9 open@^10 zod@^3 execa@^9 js-yaml@^4` — runtime deps (bumped from `fastify@^4` + `@fastify/static@^7` after Phase 1 install: `npm audit --audit-level=high` flagged 5 high-sev advisories in fastify-v4 transitive deps; ADR-012 §Runtime dependencies records the bump)
- [ ] `npm install --save-dev @types/js-yaml@^4` — only TS types
- [ ] **Create `tsconfig.json`** at repo root with strict mode:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "Bundler",
      "outDir": "dist/cli",
      "rootDir": "src",
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "noImplicitOverride": true,
      "exactOptionalPropertyTypes": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "declaration": false,
      "sourceMap": true,
      "baseUrl": "./src",
      "paths": { "@cli/*": ["cli/*"], "@server/*": ["server/*"] }
    },
    "include": ["src/cli/**/*", "src/server/**/*"],
    "exclude": ["src/ui/**/*", "node_modules", "dist"]
  }
  ```
- [ ] **Create `tsconfig.ui.json`** (separate config — UI uses DOM lib, CLI does not):
  ```json
  {
    "extends": "./tsconfig.json",
    "compilerOptions": {
      "lib": ["ES2022", "DOM", "DOM.Iterable"],
      "outDir": "dist/ui",
      "rootDir": "src/ui"
    },
    "include": ["src/ui/**/*"]
  }
  ```
- [ ] **Create `.eslintrc.cjs`** with `@typescript-eslint/recommended-type-checked` plus a project-local rule: ban `console.log` outside `src/cli/log/logger.ts` (use the logger). No prettier — eslint owns the format.

### Step 1.2: Add the npm scripts and verify zero behaviour change

- [ ] **Edit `package.json`** `"scripts"` block — add `"build:cli": "tsc -p tsconfig.json"`, `"typecheck": "tsc -p tsconfig.json --noEmit"`, `"lint:ts": "eslint 'src/**/*.ts'"`, `"test:ts": "vitest run"`. Leave existing scripts untouched.
- [ ] **Edit `package.json`** `"files"` — add `"dist/"` AFTER the existing entries; keep order otherwise stable to minimise diff
- [ ] **Edit `package.json`** — add `"engines": { "node": ">=20.11.0" }` if not present
- [ ] **Verify**: `npx @event4u/agent-config --version` (from `npm pack` artifact) **still prints the same string as today** because `"bin"` is unchanged. Anti-regression check.
- [ ] **Verify**: `npm run typecheck` exits 0 (with no `src/` files yet, this is trivially true; the harness is what we want)

### Step 1.3: Phase 1 acceptance

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint:ts` exits 0 (no source files yet → trivially green; we want the harness)
- [ ] `git diff package.json` shows ONLY the documented `"scripts"`, `"files"`, `"engines"`, `"devDependencies"`, `"dependencies"` additions — no other key edited
- [ ] `python3 scripts/lint_portability.py` (existing) still passes — TypeScript files are excluded by the linter scope but the harness must not regress

## Phase 2: Build the TS entry binary as a thin forwarder

> Write the minimum TS that **dispatches `argv` to the existing Python
> commands**. No new behaviour, no new flags. The Bash wrapper's
> `--help` output is the contract; the TS binary's `--help` MUST match
> it line-for-line.

### Step 2.1: Implement the Python bridge

- [ ] **Create `src/cli/python/resolvePython.ts`** — exports `async function resolvePython(): Promise<string>` that probes (in order): `process.env.AGENT_CONFIG_PYTHON`, `python3`, `py -3`, `python`. Returns the absolute path of the first interpreter that reports `>= 3.9` from `--version`. Throws a typed `PythonNotFoundError` with a remediation message pointing at `docs/installation.md` when nothing works.
- [ ] **Create `src/cli/python/runPython.ts`** — exports `async function runPython(scriptRelPath: string, args: string[], opts?: { cwd?: string }): Promise<number>`. Uses `execa(pythonPath, [scriptAbsPath, ...args], { stdio: 'inherit', cwd: opts?.cwd ?? process.cwd(), reject: false })` and returns the exit code. **Never** captures stdout/stderr — Python output passes through untouched so existing UX (colour codes, progress bars) is preserved.
- [ ] Path resolution: `scriptAbsPath` is computed from `import.meta.url` walking up to the package root (the directory containing `package.json`), then joining `scriptRelPath`. The walk-up logic lives in `src/cli/paths.ts` and is unit-tested.

### Step 2.2: Implement the argv parser

- [ ] **Create `src/cli/agent-config.ts`** — shebang `#!/usr/bin/env node`, single `program` instance from `commander`, one `.command(...)` per existing Tier-0/1/2 subcommand. Every action handler is a one-liner: `(opts, cmd) => runPython('scripts/_cli/cmd_<name>.py', cmd.args)` — no business logic in the TS layer.
- [ ] The subcommand table is derived from `scripts/agent-config` (the Bash file) and `scripts/_cli/cmd_*.py`. **Acceptance gate**: a unit test in `tests/cli/subcommand-table.test.ts` reads the Bash file, extracts every `case "$1" in` branch, and asserts that `program.commands.map(c => c.name())` is the **same set** (order-preserving).
- [ ] `--version` is wired to read `package.json` `"version"` via a tsc-friendly JSON import.
- [ ] `--help` output: a separate unit test compares `await execa('node', ['dist/cli/agent-config.js', '--help'])` stdout against a golden file `tests/cli/__fixtures__/help.golden.txt`. The fixture is generated from the Bash binary's `--help` and checked in.

### Step 2.3: Implement two native commands (no Python)

- [ ] **Create `src/cli/commands/versions.ts`** — talks to the npm registry directly (`https://registry.npmjs.org/@event4u/agent-config`), shows the **installed** version (from `package.json`) vs the **latest** published version. Replaces the existing Bash implementation that shells out to `npm view`. Test: mock `fetch` and assert formatted output.
- [ ] **Create `src/cli/commands/doctor-shell.ts`** — quick environment probe (Node version, Python version if present, git presence, repo-root detection). Reports JSON when `--json` flag is set, human-readable otherwise. **Does NOT** replace the Python `doctor` — it is a fast pre-check that runs before delegating to Python's deeper checks.

### Step 2.4: Phase 2 acceptance

- [ ] `npm run build:cli` produces `dist/cli/agent-config.js` and the binary is executable (`chmod +x` set by `prepack`)
- [ ] `node dist/cli/agent-config.js --version` prints the `package.json` version string
- [ ] `node dist/cli/agent-config.js --help` matches the golden fixture
- [ ] `node dist/cli/agent-config.js init --dry-run` forwards to `scripts/install.py` and exits with the Python script's exit code
- [ ] `node dist/cli/agent-config.js versions` runs **without Python on PATH** (verified by temporarily emptying `PATH` to just Node's `bin/`)
- [ ] `npm run test:ts` runs `tests/cli/subcommand-table.test.ts`, `tests/cli/help.test.ts`, `tests/cli/versions.test.ts` — all green in < 5 s total
- [ ] `"bin"` in `package.json` is **still** `"scripts/agent-config"` — flip happens in Phase 5


## Phase 3: Embed the Fastify server + free-port picker

> Add the HTTP layer that future roadmaps mount routes on. This phase
> ships **one** route (`/api/v1/ping`) so the wiring is end-to-end
> testable. No UI rendering yet.

### Step 3.1: Implement the free-port picker

- [ ] **Create `src/server/port.ts`** — exports `async function pickFreePort(range?: { min: number; max: number }): Promise<number>`. Default range is `{ min: 41000, max: 41999 }`. Algorithm: shuffle the range, try `net.createServer().listen(port, '127.0.0.1')`, return the first that binds successfully and is then closed. Throws `NoFreePortError` after exhausting the range.
- [ ] Test: bind a server to a known port in the range, run `pickFreePort`, assert it returns a different port and that port is bindable.
- [ ] Anti-regression: the picker MUST refuse any range that overlaps `[0, 1024]` (privileged ports) or any port already declared in `docs/contracts/local-server-ports.md` (NEW file in this phase — currently lists only `41000-41999` for `agent-config ui:serve`).

### Step 3.2: Implement the Fastify app

- [ ] **Create `src/server/app.ts`** — exports `async function createApp(opts: { projectRoot: string; uiDistDir: string }): Promise<FastifyInstance>`. Steps inside:
  1. `const app = Fastify({ logger: { level: process.env.AGENT_CONFIG_LOG ?? 'warn' } })`
  2. `await app.register(import('@fastify/static'), { root: opts.uiDistDir, prefix: '/' })`
  3. Register routes from `src/server/routes/*` (one `await app.register(routePlugin)` per file)
  4. Add a global `onRequest` hook that **rejects** any request whose `Host` header is not `127.0.0.1:<port>` or `localhost:<port>` — CSRF defence-in-depth, since the GUI is a no-auth local tool
  5. Return the configured app
- [ ] **Create `src/server/routes/ping.ts`** — `GET /api/v1/ping` returning `{ ok: true, version: '<from package.json>', projectRoot: '<absolute path>' }`. Response body validated by a zod schema declared inline; the schema is also exported for the matching test.

### Step 3.3: Wire `agent-config ui:serve`

- [ ] **Create `src/cli/commands/ui-serve.ts`** — flags: `--port <n>` (overrides picker), `--no-open` (skip launching browser), `--ui-dist <path>` (override `dist/ui/`, useful for dev). Action:
  1. Resolve project root (walk up to nearest `package.json`)
  2. Pick a port (or use `--port`)
  3. Build the app via `createApp(...)`
  4. `await app.listen({ port, host: '127.0.0.1' })` — **never** `0.0.0.0`
  5. Unless `--no-open`, call `open(`http://127.0.0.1:${port}/`)`
  6. Print one line: `agent-config UI on http://127.0.0.1:<port>/  (Ctrl-C to stop)`
  7. Install SIGINT/SIGTERM handlers that call `app.close()` and exit 0
- [ ] Register the command in `src/cli/agent-config.ts`.

### Step 3.4: Phase 3 acceptance

- [ ] `tests/server/ping.test.ts` boots `createApp`, makes a `fetch` call to `/api/v1/ping`, asserts the zod-validated shape
- [ ] `tests/server/host-guard.test.ts` boots the app, fakes a `Host: evil.com` header, asserts a 421 response
- [ ] `tests/server/port.test.ts` covers the free-port picker (collision case, exhaustion case)
- [ ] `tests/cli/ui-serve.e2e.test.ts` spawns the compiled binary with `--no-open --ui-dist tests/server/__fixtures__/empty-ui/`, asserts the listening line is printed within 2 s, sends SIGINT, asserts exit code 0 and elapsed < 5 s
- [ ] `dist/ui/` exists at this phase (empty `index.html` is fine — actual UI content comes in `unified-setup-and-settings-gui`)

## Phase 4: Add the Vite UI scaffold + static-file pipeline

> The follow-up roadmaps need a place to render HTML. This phase
> creates that place with **one** placeholder page so the bundler is
> proven end-to-end. No routing, no framework choice, no design
> system — those are the next roadmap's job.

### Step 4.1: Bootstrap Vite

- [ ] **Create `vite.config.ts`** at repo root: `root: 'src/ui'`, `build: { outDir: '../../dist/ui', emptyOutDir: true, target: 'es2022' }`, `server: false` (we never run the Vite dev server in production), no plugins beyond the defaults.
- [ ] **Create `src/ui/index.html`** — minimal: `<!doctype html><html><head><meta charset="utf-8"/><title>agent-config</title></head><body><div id="app"></div><script type="module" src="/main.ts"></script></body></html>`
- [ ] **Create `src/ui/main.ts`** — `document.getElementById('app')!.textContent = 'agent-config UI · placeholder · roadmaps unified-setup-and-settings-gui + explainability-v2 will populate this.'`
- [ ] Add `"build:ui": "vite build"` and `"build": "npm run build:cli && npm run build:ui"` to `package.json` `"scripts"`.

### Step 4.2: Make the served bundle reachable

- [ ] When `agent-config ui:serve` runs, `dist/ui/index.html` is served at `/` and `dist/ui/assets/*` is served at `/assets/*`. Verified by `tests/server/static.test.ts`.
- [ ] No framework (no React, no Vue, no Svelte) is added in this phase. The unified-setup roadmap chooses the framework and pulls it in.

### Step 4.3: Phase 4 acceptance

- [ ] `npm run build` produces `dist/cli/agent-config.js` AND `dist/ui/index.html` AND a non-empty `dist/ui/assets/` directory
- [ ] `node dist/cli/agent-config.js ui:serve --no-open` opens a port, serves the placeholder HTML, and `curl http://127.0.0.1:<port>/` returns the placeholder string
- [ ] `npm pack --dry-run` reports a tarball ≤ +400 KB compared to the previous published version (measured via `npm view @event4u/agent-config@latest dist.unpackedSize` vs `npm pack --dry-run --json | jq .[0].unpackedSize`)


## Phase 5: Flip the `bin`, deprecate Bash, wire CI

> Switch the public entry point from Bash to TS, leave the Bash file as
> a one-line shim that warns + forwards (covers users who hand-call
> `scripts/agent-config` directly), and add the new CI gates.

### Step 5.1: Flip the entry point

- [ ] **Edit `package.json`** — change `"bin"` to:
  ```json
  "bin": { "agent-config": "dist/cli/agent-config.js" }
  ```
- [ ] **Edit `scripts/agent-config`** (the Bash file) — replace the entire body with a 6-line shim:
  ```bash
  #!/usr/bin/env bash
  # Deprecated direct invocation. Public entry point is dist/cli/agent-config.js
  # via npx @event4u/agent-config. This shim survives one minor cycle then is removed.
  here="$(cd -- "$(dirname -- "$0")" && pwd)"
  echo "warning: scripts/agent-config is deprecated; use 'npx @event4u/agent-config' instead" >&2
  exec node "$here/../dist/cli/agent-config.js" "$@"
  ```
- [ ] If `dist/cli/agent-config.js` is missing (developer source checkout without `npm run build`), the shim MUST detect that and fall through to the legacy Python dispatch path **only** when `AGENT_CONFIG_LEGACY_DISPATCH=1` is set in the env. Otherwise it errors out with a single line pointing at `npm run build`. The legacy dispatch path lives behind that env flag for one release; removal is in a follow-up roadmap.

### Step 5.2: Add CI gates

- [ ] **Edit `Taskfile.yml`** — add `task lint-ts` (runs `npm run lint:ts`), `task typecheck-ts` (runs `npm run typecheck`), `task test-ts` (runs `npm run test:ts`), `task build-ts` (runs `npm run build`). Each task lives in the `vars`-scoped block and uses `cmd:` not `cmds:` since they are single-command tasks.
- [ ] **Edit `.github/workflows/ci.yml`** (or the equivalent) — add a `typescript` job that runs (in this order): `npm ci`, `task lint-ts`, `task typecheck-ts`, `task build-ts`, `task test-ts`. The job matrix pins Node 20 LTS; the existing Python jobs remain untouched.
- [ ] **CI-step policy reminder:** every checkbox under "CI step" in this roadmap names the **narrow** harness it just produced — never a full-suite umbrella task. `task lint-roadmap-ci-steps` and the rule under `.augment/rules/roadmap-ci-steps-policy.md` enforce the list of forbidden literals; consult that policy before editing any phase. <!-- carve-out: policy-reminder -->`

### Step 5.3: Document the flip

- [ ] **Edit `docs/architecture.md`** — section "npx-only distribution + version-pin governance" — add a paragraph that the runtime entry point is now `dist/cli/agent-config.js` and the Bash file is a deprecation shim. Cross-link to ADR-012.
- [ ] **Edit `docs/installation.md`** — add a paragraph that Node 20 LTS is required; Python 3.9+ is only required for advanced subcommands (`work`, `migrate-state`, etc.); list which subcommands work without Python by reading the new `src/cli/agent-config.ts` source.
- [ ] **Edit `CHANGELOG.md`** under the next unreleased minor — entry: "TypeScript CLI: the npm bin now points at the compiled TS binary. Bash wrapper kept as a deprecation shim. Node 20 LTS required."

### Step 5.4: Phase 5 acceptance

- [ ] `npm pack` produces a tarball; install it into a fresh directory via `npm install /path/to/tarball`; run `npx --no @event4u/agent-config --version` — prints the version
- [ ] In the same fresh directory, run `npx --no @event4u/agent-config init --help` — the help text matches the golden fixture from Phase 2
- [ ] `python3 scripts/lint_roadmap_ci_steps.py` exits 0 against this roadmap (no forbidden CI literals)
- [ ] `python3 scripts/lint_roadmap_complexity.py` exits 0; this roadmap is correctly marked `complexity: structural`
- [ ] All five phases' acceptance gates checked off above

## Phase 6: AI-Council review

> Before status flips from `draft` → `proposed`, send the roadmap
> through the council (`scripts/council/run.py` or equivalent) with
> these four lenses, one per persona:
>
> - **Architecture lens** — does the TS / Python split create new
>   contract surfaces that need ADRs beyond ADR-012? (Answer expected:
>   only ADR-012; the local-server-ports contract in Phase 3.1 is the
>   only new surface and it is ADR-012-adjacent.)
> - **Security lens** — is `127.0.0.1`-only + `Host`-header guard
>   sufficient for the no-auth GUI, or do we need a token? Council
>   must answer in writing.
> - **Distribution lens** — does the +400 KB tarball budget hold once
>   Vite ships an empty bundle? If not, the Phase 4 acceptance must be
>   relaxed before the roadmap is approved, not afterwards.
> - **Developer-experience lens** — is the `tsx` dev story (no
>   `nodemon`, no watch mode) acceptable for a one-week iteration on
>   the GUI? If not, add a `task dev:cli` and `task dev:ui` set in this
>   roadmap, not the next one.
>
> Open issues from the council are tracked as TODO checkboxes appended
> below this section. Status flip happens only when every TODO is
> resolved or explicitly accepted-as-risk.

### Council TODOs (filled by the council pass)

> Pass executed in-session 2026-05-18 against the repo personas listed
> in `.agent-src.uncompressed/personas/`. External `/council` (paid
> API) can re-run on top before the `draft → proposed` flip; status
> stays `draft` until the items below are either resolved in this
> roadmap or carved out to a sibling roadmap with a citation.

**`backend-architect` — boundary & rollout shape**

- [ ] Phase 5 ("flip the shebang") changes the single runtime contract for every consumer in one PR. Split into **5a** (ship `dist/cli/agent-config.js` alongside the existing Bash entry; shadow-mode for one release cycle; log discrepancies to `~/.event4u/agent-config/shadow.log`) → **5b** (flip default only after a release in shadow-mode is observed green by the maintainer). Otherwise a single TS-side regression breaks every downstream pipeline at once.
- [ ] No boundary spec exists for the IPC contract between TS-CLI and the local Fastify server. Add `docs/contracts/local-server-api.md` to Phase 2 deliverables (JSON-Schema'd request / response per route) so Roadmap 2 (Unified GUI) implements against a frozen contract, not a moving one.

**`security-engineer` — localhost is not a trust boundary**

- [ ] 127.0.0.1 bind is necessary but **not sufficient**: a co-resident local user, a malicious browser extension, or any tab that can issue `fetch('http://127.0.0.1:<port>')` reaches a no-auth server. Mandate three controls in Phase 2: (a) `Origin` allow-list anchored to the Vite dev port + the bundled static origin, (b) `Sec-Fetch-Site: same-origin`/`none` reject otherwise, (c) per-process random token written to `~/.event4u/agent-config/local-server.token` mode 0600 and required as `Authorization: Bearer <token>` header. The roadmap's current "no token needed because localhost" stance is rewritten in Phase 2.
- [ ] Supply chain: every npm dep added in Phase 1 widens the install surface. Add `npm audit --omit=dev --audit-level=high` to the `task lint-ts` chain so a high-severity regression in Fastify or Vite blocks the gate, not the release.

**`frontend-engineer` — GUI state contract + a11y budget**

- [ ] No contract for wizard / GUI state across restarts. Decide before Phase 4: ephemeral (clear on server exit, every run starts fresh) or persistent (write to `~/.event4u/agent-config/wizard-state.json`, mode 0600, schema-validated). Roadmap 2 inherits this decision; mark it as a blocker for the dependent roadmap.
- [ ] Add to Phase 4 exit gate: `npx @axe-core/cli http://127.0.0.1:<port>/` returns 0 violations at WCAG AA. Otherwise the GUI ships inaccessible by default and remediation lands as a follow-up roadmap.

**`critical-challenger` — claim audit**

- [ ] "Python 3.9+ only required for advanced subcommands" — which subcommands? Append a concrete table to Step 5.3 mapping every CLI subcommand → `requires_python: true|false` → reason. Otherwise `agent-config status` accidentally requires Python the first time anyone runs the TS build.
- [ ] The non-goal "GUI for headless servers" is correct but undefended. Add to Phase 3 exit gate: `agent-config setup` detects `$SSH_CONNECTION` set OR `$DISPLAY` empty, refuses to start the browser, and prints the fallback CLI command. Otherwise the GUI breaks the existing headless contract.

**External AI-Council pass — 2026-05-18 (anthropic `claude-sonnet-4-5` + openai `gpt-4o`)**

> Evidence: `agents/council-responses/2026-05-18T*-r1-ts-cli-foundation/`. Cost: $0.16. Necessity verdict: borderline (architecture vs trade-off, expected for roadmap critique). Overlap with the in-session pass above: shadow-mode rollout, IPC contract, localhost token, headless detection are all confirmed by the external reviewers; no contradictions. The items below are NEW and additive.

- [ ] `package.json prepack` script MUST assert `dist/cli/agent-config.js` exists, is executable, and starts with `#!/usr/bin/env node`. Add as a Phase 1.3 acceptance gate: `npm pack --dry-run` fails loudly when `dist/cli/` is empty, otherwise a broken build ships silently and `npx @event4u/agent-config` greets every consumer with a cryptic `Cannot find module` panic.
- [ ] Replace suite-level `npm run test:ts` in per-phase exit gates with **scoped** test commands (e.g. Phase 2.4: `npm run test:ts -- tests/cli/subcommand-table.test.ts`). The current draft has every phase rerun the full suite, which (a) blows up the per-phase 5s budget once the suite grows and (b) lets a Phase 2 regression slip past Phase 4's gate disguised as a Phase 1 flake.
- [ ] `agent-config ui:serve` in dev mode must detect missing `dist/ui/index.html` and either (a) exit 1 with `"UI not built; run 'npm run build:ui' first"` or (b) proxy `/` to a Vite dev subprocess. Current draft assumes the dist directory exists, which breaks every fresh checkout. Decide in Phase 3, implement in Phase 4.
- [ ] Add a "shell-alias migration" note to Phase 5.3: users with `alias ac='~/projects/agent-config/scripts/agent-config'` in their `.bashrc` get a broken alias after the shebang flip because the Bash file now requires `dist/` to exist. CHANGELOG entry + warning in `docs/installation.md` MUST land in the same release as the flip.
- [ ] Accept-as-risk: external reviewer pushed back hardest on **embedding the Fastify server inside the CLI binary** (suggests splitting to a separate `@event4u/agent-config-ui` package). Rationale for keeping embedded: this roadmap's stated goal (lines 95–105) is infrastructure reuse for R2 (Unified Setup) and R4 (Explainability), and ADR-012 already locks the embedded design. If R2 surfaces real friction during integration, revisit then; do NOT pre-split now.

**Resolution gate before `draft → proposed`**

- [x] In-session council items (eight above) and external council items (five above) are logged here with file:line citations and accept-as-risk rationale where applicable.
- [ ] Each unchecked blocking item is folded into its matching phase as an explicit step during Phase 0 of implementation, OR carved out to a named sibling roadmap with a one-line rationale appended to this section.

## Open questions (for the implementing agent)

- [ ] Should `agent-config ui:serve` auto-pick a free port or always default to `41472` (a specific port for muscle memory)? Current draft: auto-pick. Alternative: pin to `41472` and pick a free one only on collision.
- [ ] Should the Bash deprecation shim print the warning to `stderr` (current draft) or stay silent until the next major? Current draft errs on the side of visibility; revisit before merging the implementing PR.
- [ ] Does `execa` add too much weight (~70 KB)? If yes, fall back to `node:child_process` directly and pay the Windows-escape tax in `runPython.ts`. Decide via measurement in Phase 1, not now.
