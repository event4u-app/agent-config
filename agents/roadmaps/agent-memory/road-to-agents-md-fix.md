# Spec: Fix the stale AGENTS.md in `agent-memory`

> **Spec for `agent-memory`, authored from `agent-config`.**
> Small, targeted fix. Kept as a separate spec so it does not get
> lost inside the larger integration work.
> See [`README.md`](README.md) for the ownership split.

## Status

**Bug spec.** Spotted in Claude's review: the `AGENTS.md` at the root
of the `agent-memory` repository still shows a Galawork/Laravel stack
and treats the repo as if it were a Laravel application. The actual
repository is a TypeScript/Node ≥ 20 package with PostgreSQL + pgvector.

Priority: **Medium.** Not a blocker for integration, but every agent
that opens the repo ingests the wrong stack picture on first read.
The longer it stays, the more low-quality suggestions it causes.

## Prerequisites

None. This is a documentation fix inside the `agent-memory` repo.

## Vision

`AGENTS.md` in `agent-memory` accurately describes:

- What the repository is (TypeScript/Node library + CLI + MCP server)
- What the developer stack is (Node ≥ 20, TypeScript, pnpm/npm,
  PostgreSQL + pgvector)
- How to run the test suite and linters
- Which parts are public API vs. internal
- The relationship to `agent-config` (companion package, optional
  dependency)

## Non-goals

- **No** rewrite of the README — the README is already accurate per
  the reviews
- **No** duplication of content that belongs in the README —
  `AGENTS.md` stays focused on *what an AI agent working on this
  repo needs to know*, which is narrower
- **No** copy-paste from other `event4u-app` repos without adapting —
  that is how the wrong content arrived in the first place

## Fix checklist (for the `agent-memory` repo)

- [ ] Remove all Laravel / Galawork references from `AGENTS.md`
- [ ] Replace stack section with TypeScript / Node / pgvector
- [ ] Describe the package layout: `src/`, `tests/unit/`,
      `migrations/`, `cli/`, `mcp-server/` (adjust to actual layout)
- [ ] List the `npm` / `pnpm` scripts the agent should run (test,
      lint, build, migrate)
- [ ] Describe how to run PostgreSQL + pgvector locally (or link to
      the reference `docker-compose.yml`)
- [ ] Describe the public API surface the `agent-config` integration
      depends on (`retrieve`, `propose`, `promote`, `health`, `prune`,
      `deprecate`)
- [ ] Link back to `agent-config` as companion, including the
      `feat/hybrid-agent-memory` work-in-progress branch (or `main`
      once merged)
- [ ] Add a short "what this repo is NOT" section so agents do not
      treat it as an application, a UI, or a dataset

## Safety: re-use `agent-config`'s own template

`agent-config` already ships a neutral `AGENTS.md` template under
`.agent-src.uncompressed/templates/AGENTS.md` (used by consumer
projects on install). The fix should derive from that template, not
from another project's `AGENTS.md`. That prevents the same cross-
contamination happening again.

## Verification

Before closing this spec:

- Load `AGENTS.md` in a fresh agent session targeting the
  `agent-memory` repo
- Confirm the stack picture matches reality (TypeScript/Node, not
  Laravel)
- Confirm the agent does not propose Laravel-style fixes (e.g.
  Eloquent models, artisan commands) when asked about feature work
- Run `task check-portability` equivalent if `agent-memory` adopts it;
  otherwise a manual re-read suffices for this first pass

## Open questions

- **Scope of `AGENTS.md` vs. `copilot-instructions.md` in
  `agent-memory`.** `agent-config` splits them; does `agent-memory`
  want the same split or a single file? Decision belongs in
  `agent-memory`. Recommendation from here: same split, for parity.
- **Timing.** Fix before, during, or after the `feat/hybrid-agent-memory`
  work lands on `main`? Recommendation: **before**, because any
  agent helping with that work should read a correct `AGENTS.md`.

## See also

- [`road-to-consumer-integration-guide.md`](road-to-consumer-integration-guide.md) —
  references the agent-memory docs as the canonical source
- `agent-config`'s own `AGENTS.md` and
  `.agent-src.uncompressed/templates/AGENTS.md` — the template to
  derive from
