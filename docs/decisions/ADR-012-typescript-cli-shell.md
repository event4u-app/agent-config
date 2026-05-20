---
adr: 012
status: accepted
date: 2026-05-19
decision: typescript-cli-shell
supersedes: —
superseded_by: —
phase: v2.x · typescript-cli-and-local-gui-foundation
type: prospective
---

# ADR-012 — TypeScript CLI Shell & Local Fastify Server

## Status

**Accepted** · 2026-05-19 · in-session council (8 items) +
external `claude-sonnet-4-5` + `gpt-4o` pass (5 items, cost $0.16) on
`agents/roadmaps/typescript-cli-and-local-gui-foundation.md`. All 13
items folded into Phase 0–5a or carved with rationale below.

## Context

`@event4u/agent-config` is distributed as an npm package and consumed
via `npx`. The current public entry point is `scripts/agent-config` —
a 955-LOC Bash dispatcher that delegates to `scripts/_cli/cmd_*.py`.
Two downstream roadmaps (`unified-setup-and-settings-gui`,
`explainability-v2-explain-last`) need an embedded local HTTP server
and a static UI bundle. Bash is the wrong substrate for that surface;
Node is on every consumer's machine already because `npx` itself
runs on Node.

This ADR locks the dependency surface, the source layout, and the
npm-package shape **before** any TypeScript is written. The Python
engine, lint scripts, hooks, and `scripts/work_engine/` stay where
they are — the TS layer is a thin distribution + UX shell that
subprocess-invokes Python for heavy work.

Related ADRs:

- [ADR-007 — Agent Discovery Scopes](ADR-007-agent-discovery-scopes.md)
- [ADR-010 — Profile/Pack/Preset Boundary](ADR-010-profile-pack-preset-boundary.md)
- [ADR-011 — Domain-Pack Readiness](ADR-011-domain-pack-readiness.md)

## Decision

### Runtime dependencies (frozen)

| Package | Why chosen |
|---|---|
| `commander@^12` | Argv parsing; small footprint, zero transitive deps. |
| `fastify@^5` | HTTP server; fast cold start, schema-first request validation. Bumped from v4 during Phase 1 install: v4 transitive `fast-uri` carries 5 high-sev advisories that block the `npm audit --audit-level=high` security gate. |
| `@fastify/static@^9` | Static-file plugin for the built UI bundle. v9 fixes the `@fastify/static` path-traversal + route-guard-bypass advisories present in v7/v8. |
| `open@^10` | Cross-platform "open URL in browser"; single function, near-zero deps. |
| `zod@^3` | Runtime schema for IPC; reused by R2 GUI for settings validation. |
| `execa@^9` | Subprocess wrapper around Python; stream pass-through, Windows-safe escaping, predictable exit-code propagation. |
| `js-yaml@^4` | Read `.agent-settings.yml` from TS before delegating to Python. |

### Dev dependencies (frozen)

`typescript@^5.5`, `tsx@^4`, `vite@^5`, `vitest@^2`, `eslint@^9`,
`@typescript-eslint/eslint-plugin@^8`, `@typescript-eslint/parser@^8`,
`@types/node@^20`, `@types/js-yaml@^4`. No `ts-node`, no `nodemon`,
no `webpack`, no direct `rollup`.

### Forbidden in this roadmap

`inquirer`, `prompts`, `chalk`, `ora`, `boxen`, anything that emits
colour codes outside a TTY, anything pulling > 5 transitive deps.
Rationale: keep the binary light enough for `npx` first-run feel.

### Decision matrix

| Concern | Candidates | Chosen | Why rejected (others) |
|---|---|---|---|
| Argv parser | commander · yargs · meow · native | **commander** | yargs: 13 transitive deps; meow: ESM-only quirks; native: too verbose. |
| HTTP server | fastify · express · koa · native | **fastify** | express: legacy middleware shape, slower cold start; koa: smaller community for plugins we need; native: schema validation would be hand-rolled. |
| Open in browser | open · opn (deprecated) | **open** | opn unmaintained. |
| Subprocess | execa · node:child_process | **execa** | child_process: Windows escape tax + manual stream wiring; execa cost (~70 KB) is acceptable per roadmap Open Question 3, revisit on measurement. |
| Schema | zod · joi · ajv-direct | **zod** | joi: heavier; ajv: lower-level; zod is shared with R2 GUI. |
| Settings parse | js-yaml · yaml | **js-yaml** | yaml: stricter spec but slower for our shape; js-yaml is the de-facto standard. |
| UI build | vite · esbuild · rollup | **vite** | esbuild lacks HTML entry; rollup needs hand-wired HTML plugin; vite handles `index.html` + `<script type="module">` natively. |

### Source layout

```
src/
  cli/
    agent-config.ts            # bin entry (#!/usr/bin/env node)
    paths.ts                   # package-root walk-up, src/dist resolver
    commands/                  # one .ts per Tier-0/1/2 subcommand
    python/
      runPython.ts             # execa wrapper, stdio inherit
      resolvePython.ts         # python3 / py / python detection
    settings/readSettings.ts   # .agent-settings.yml (read-only)
    log/logger.ts              # leveled logger, NO chalk
  server/
    app.ts                     # Fastify instance + route registration
    port.ts                    # free-port picker (41000–41999)
    auth/token.ts              # per-process token in ~/.event4u/agent-config/
    routes/
      ping.ts                  # GET /api/v1/ping
  ui/
    index.html                 # mount point only
    main.ts                    # bundle entry (Vite)
dist/
  cli/                         # tsc output of src/cli + src/server
  ui/                          # vite build output of src/ui
```

No `src/index.ts` god-file. No `src/utils.ts`. Path aliases via
`baseUrl: "./src"` and `paths: { "@cli/*": ["cli/*"], "@server/*": ["server/*"] }`.

### npm-package shape

- `"bin"` points at `dist/cli/agent-config.js` — but **only** after
  Phase 5b ships. This ADR lands with `"bin"` still pointing at the
  Bash file; the TS binary is shipped alongside for shadow mode.
- `"files"` adds `dist/`; keeps `scripts/agent-config`.
- `"engines": { "node": ">=20.11.0" }` — Node 20 LTS minimum.
- npm scripts: `build:cli`, `build:ui`, `build`, `typecheck`,
  `lint:ts`, `test:ts`, `prepack` (runs `build` + asserts
  `dist/cli/agent-config.js` exists and is executable). No
  `postinstall`.

### Local server security floor

Per council `security-engineer` lens, `127.0.0.1` bind is necessary
but not sufficient. Mandated controls:

1. Bind only to `127.0.0.1` — any non-loopback attempt fails contract test.
2. Reject `Host` headers other than `127.0.0.1:<port>` or `localhost:<port>` (status `421`).
3. `Origin` allow-list: same-origin only (`null`, `127.0.0.1:<port>`, `localhost:<port>`).
4. Per-process token written to `~/.event4u/agent-config/local-server.token` (mode `0600`), required as `Authorization: Bearer <token>` on every `/api/*` route. `/ping` is exempt for liveness probes.
5. `npm audit --omit=dev --audit-level=high` runs in `task lint-ts` and blocks on regressions.

## Consequences

**Positive**

- TS entry surface gives R2 (GUI) and R4 (explain) a real substrate.
- Python becomes optional for Tier-0 commands (`versions`, `doctor`-fast-checks). Narrows the "Python required" surface to advanced subcommands.
- Frozen dep list resists casual scope creep.
- Token + Origin guard means the local server is safe even on a multi-user host.

**Negative**

- Node 20 LTS becomes a hard requirement for the published binary (Bash shim survives one minor cycle for users on Node < 20).
- +400 KB tarball budget (compiled JS + Vite output).
- Shadow-mode rollout (Phase 5a → 5b) costs one release cycle of dual-shipping.

**Accepted as risk**

- Embedding Fastify inside the CLI binary vs. splitting to a separate `@event4u/agent-config-ui` package (external reviewer's pushback). Rationale: ADR-012 + roadmap goal lock the embedded design as infrastructure reuse for R2/R4; revisit if R2 surfaces real integration friction.
- `execa` install weight (~70 KB) over `node:child_process`. Decide via measurement in Phase 1, not now.

## Council debate trace

In-session (2026-05-18): `backend-architect`, `security-engineer`,
`frontend-engineer`, `critical-challenger` — 8 items, all folded.
External pass: `agents/runtime/council/responses/2026-05-18T*-r1-ts-cli-foundation/`
— 5 items, all folded. Roadmap §"Council TODOs" lists every item
with its target phase.
