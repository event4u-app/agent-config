---
slug: deep-root-restructure
title: Deep Root Restructure — sink maintainer + projection dirs out of the root
owner: matze4u
opened: 2026-05-25
status: ready
complexity: structural
related_adrs:
  - ADR-012-typescript-stack
  - ADR-016-typescript-stack-decision
  - ADR-019-router-json-dist-location
  - ADR-028-root-layout
  - ADR-029-multi-workspace-deferred
related_audits:
  - agents/evidence/audits/2026-05-root-layout-phase2/01-consumer-contract.md
  - agents/evidence/audits/2026-05-root-layout-phase2/02-symlink-mobility.md
  - agents/evidence/audits/2026-05-root-layout-phase2/03-hash-sequencing.md
  - agents/evidence/audits/2026-05-root-layout-phase2/04-ci-path-inventory.md
---

# Deep Root Restructure

> Continue what ADR-028 / PR #237 started: `internal/` umbrella absorbed `bench/`, `evals/`, `workers/`. This roadmap extends the cleanup to every remaining maintainer-only or projection-only directory at the repo root, **without** breaking the npm publish contract or the public `setup.sh` URL.

## Goal

A root that contains **only** what a human consumer or the npm package needs to see at a glance:
public docs (`README.md`, `CONTRIBUTING.md`, `LICENSE`, `CHANGELOG.md`, `AGENTS.md`), the npm
manifest pair (`package.json`, `package-lock.json`), build configs that npm/git tooling expects
at root (`tsconfig*.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `Taskfile.yml`,
`pyproject.toml`, `playwright.config.ts`), and the published surface (`dist/`, `docs/`,
`scripts/`, `templates/`, `config/`, `user-types/`, `.agent-src/`, `setup.sh`, `agent-config`
symlink). Everything else sinks into a named umbrella.

## Decision required upfront (Phase 0)

The user proposal was **„move everything into `./src`"**. ADR-028 Alternatives table already
rejected this exact option: *„`./src/` is the TS app per ADR-012/016. Collision."* `src/`
currently holds `cli/`, `server/`, `shared/`, `ui/` with `tsconfig.json rootDir: "src"`,
`baseUrl: "./src"`, `eslint 'src/**/*.ts'`, `vite root: 'src/ui'`, bin `dist/cli/agent-config.js`
compiled from `src/cli/`. Folding infra under the same umbrella requires either renaming the
TS tree or accepting two semantics under one directory.

Three viable umbrella shapes — Phase 0 picks one:

| Option | Shape | Cost | Reversibility |
|---|---|---|---|
| **A — Extend `internal/`** | Maintainer-only items go under `internal/<sub>/`; npm `files[]`-protected stays at root | Lowest. Continues ADR-028 pattern. | High — git-tracked symlinks allowed. |
| **B — New `support/` umbrella** | Fresh name, no overload with `internal/` (which today reads as „evals + bench + workers") | Medium. New convention. AGENTS.md update. | High. |
| **C — Rename TS to `app/`, free `src/` for infra** | TS source moves to `app/`, `src/` becomes the infra umbrella the user originally asked for | High. Touches every tsconfig, vite, vitest, eslint, package.json bin chain, every CI step that runs `eslint 'src/**'`. | Medium — large mechanical diff, hard to roll back mid-stream. |

**Recommendation:** **A.** Continues the existing ADR-028 / PR #237 trajectory, leaves the TS
source untouched, costs the least, and is the only option that does not require a new ADR
just to re-open a question ADR-028 already answered.

## Phase taxonomy

Each item below is classified by its **mobility class** (from
[audit 01-consumer-contract.md](../evidence/audits/2026-05-root-layout-phase2/01-consumer-contract.md)):

- 🟢 **Movable** — no consumer-contract reference, only internal scripts/docs touch it.
- 🟡 **Movable-with-rewrite** — hardcoded path in 1–4 maintainer scripts; mechanical fix.
- 🔒 **Frozen at root** — in `package.json#files`, or hardcoded in `install.py` as a public
  contract surface, or advertised in a public URL. Moving = breaking change requiring an
  installer-version-bump and deprecation window.
- ✅ **Already moved** — covered by ADR-028 / ADR-019; no action.

## Phases

### Phase 0 — Decide umbrella name (blocks everything else)

- [x] **Pick umbrella per the table above.** Picked **Option A — extend `internal/`**.
  Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds, 2026-05-26) surfaced
  five gating concerns; host applied critical-evaluation lens with codebase verification
  and cleared each: (1) `internal/` semantic-drift — rejected, ADR-028 § Consequences
  defines `internal/` as maintainer-only umbrella (not testing-tooling); (2) root `schemas/`
  user-facing check — verified clean, zero filesystem-path consumers, only docstring
  mentions; (3) `.agent-tools.yml` runtime-vs-maintainer — verified maintainer-only
  (`scripts/condense.py:88`, `scripts/measure_projection_bytes.py:98`); (4) build-config
  sweep (Taskfile/pyproject/vite/eslint/CI) — verified clean for all four moves;
  (5) `.condensation-hashes.json` flat-vs-nested — picked flat (`internal/.condensation-hashes.json`)
  since single file, no sibling condensation artefacts.
- [-] If option C is chosen, write a successor ADR that supersedes ADR-012 / ADR-016 on the
  `src/` rootDir choice, with a migration plan for tsconfig + vite + vitest + eslint + bin.
  <!-- cancelled: Option A picked → Option C path is not taken. -->
- [x] Update AGENTS.md with the chosen umbrella name (one-line pointer per ADR-028
  consequences §1). `AGENTS.md § Pointers § Root layout` now lists every umbrella
  occupant (`bench`, `evals`, `workers`, `docker`, `schemas`, `.condensation-hashes.json`)
  and points to `agents/.agent-tools.yml` for the per-tool projection toggle.
  `internal/README.md § Contents` table extended with the three new rows.

### Phase 1 — Movable items (🟢, low risk, no version bump)

- [x] **Move `docker/` → `internal/docker/`.** Done via `git mv`; updated 4 real
  refs across 2 stable docs (`docs/contracts/mcp-phase-1-scope.md:157`,
  `docs/setup/mcp-server-docker.md:3,11,15`). The other roadmap-listed files
  (`docs/contracts/file-ownership-matrix.json`, `docs/getting-started-laravel.md`,
  `docs/catalog.md`, `docs/skills-catalog.md`) carry `docker/` substring only for
  the `docker` skill (`.agent-src.uncondensed/skills/docker/`) — a different
  thing, untouched.
- [x] **Move root `schemas/` → `internal/schemas/`.** Done via `git mv`. Updated
  all real consumers: 2 stable doc links (`docs/contracts/gui-wizard.md:138`,
  `docs/decisions/ADR-020-global-only-consumer-scope.md:28`), 2 mirror comments
  (`src/server/routes/wizard.ts:129`, `tests/e2e/setup-wizard-9-steps.spec.ts:6`),
  3 docstrings (`scripts/memory_lookup.py:519`, `scripts/memory_status.py:44,203`,
  `tests/conformance/retrieval/validator.py:3`), 1 help text
  (`scripts/install.py:3797`), plus the templated equivalents under
  `packages/core/.agent-src.uncondensed/templates/scripts/` (refreshed via
  `python3 scripts/condense.py --sync`). The schemas' `$id` URLs are unaffected
  (they're identifiers, not filesystem paths).
- [x] Run `task ci` after each move. Each move = own commit on the chosen umbrella branch.
  Replaced with focused verification (`scripts/condense.py --check-hashes` ✅ + 
  `scripts/check_references.py` ✅); full `task ci` will run on the PR per
  `roadmap-ci-steps-policy`.

### Phase 2 — Movable-with-rewrite (🟡, internal hardcodes only)

- [x] **Move `.condensation-hashes.json` → `internal/.condensation-hashes.json`**
  (flat — single file, no sibling condensation artefacts to namespace against).
  Done via `git mv`. Rewrote `HASH_FILE` constant in `scripts/condense.py:48`
  and `scripts/annotate_discovery.py:29`. Verified via
  `python3 scripts/condense.py --check-hashes` ✅.
- [x] **Move `.agent-tools.yml` → `agents/.agent-tools.yml`** (per user proposal).
  Done via `git mv`. Rewrote 5 consumers / comments:
  `scripts/condense.py:72,84,88,405,418,1066`,
  `scripts/measure_projection_bytes.py:14,15,98,121`,
  `scripts/install-hooks.sh:138`,
  `docs/architecture/multi-tool-projection.md:71`. Verified via
  `python3 scripts/condense.py --generate-tools` ✅ (228 rules, 219 skills,
  131 commands, 48 personas projected across all 8 tool IDs).

### Phase 3 — Frozen-at-root items: stay (🔒, no action this roadmap)

Documented for clarity — these are **explicitly out of scope**. Moving any one requires its
own ADR with installer-version-bump and a 2-month deprecation window. Council pre-rejected
this trade in ADR-028 alternatives (option 2). Items: `scripts/`, `templates/`, `config/`,
`user-types/`, `.agent-src/`, `dist/`, `docs/`, `setup.sh`, `agent-config` symlink, `AGENTS.md`,
`LICENSE`, `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `llms.txt`, `package.json`,
`package-lock.json`, all root build configs.

### Phase 4 — User-listed items that are no-ops (✅, document the why)

- [x] **`bench/`, `workers/`** — already in `internal/` since PR #237 (commit `04707d34`).
  Verified: `internal/bench/`, `internal/workers/`, `internal/evals/` all present.
- [x] **`router.json`** — already in `dist/router.json` per
  [ADR-019](../../docs/decisions/ADR-019-router-json-dist-location.md). Verified: file present.
- [x] **`.agent-src.uncondensed/`** — already lives under
  `packages/core/.agent-src.uncondensed/`. Verified: no root entry, package path populated.

### Phase 5 — `setup.sh` redirect strategy (🔒, write only if Phase 0 = C)

Public URL contract: `https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh`.
If Phase 0 picked option A or B, `setup.sh` stays at root and this phase is skipped. If
Phase 0 picked option C, draft a separate ADR proposing one of:
- (i) Keep `setup.sh` at root as a thin shim that delegates to the moved location, or
- (ii) Major version bump + 6-month dual-publication + deprecation notice in README.

## Gate to mark this roadmap done

- [x] All Phase 1 + Phase 2 boxes checked.
- [-] `task ci` green on the final state. <!-- skipped: deferred to PR-side CI per
  `road-to-optimized-ci-and-release-gates.md` discipline; pre-existing
  `check-template-pin-drift` failure on main (3.3.0 vs 4.0.0) is unrelated to
  this roadmap. Local focused gates run green:
  `task check-refs` ✅, `task check-condensation` ✅, `task check-portability` ✅,
  `task check-condensed-paths` ✅, `task check-token-optimizer-freshness` ✅,
  `task lint-roadmap-ci-steps` ✅, `task lint-roadmap-complexity` ✅,
  `task lint-skills` ✅ (452 pass / 5 pre-existing warn). -->
- [x] AGENTS.md reflects the chosen umbrella in one line.
- [x] Phase 3 items audited unchanged. Verified via
  `git diff -M --name-status HEAD`: zero of `scripts/`, `templates/`, `config/`,
  `user-types/`, `.agent-src/`, `dist/`, `docs/`, `setup.sh`, `agent-config`,
  `AGENTS.md`, `LICENSE`, `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`,
  `llms.txt`, `package.json`, `package-lock.json` moved.
- [x] `agents/roadmaps-progress.md` regenerated.
- [x] Roadmap moves to `archive/`.

## Out of scope

- Multi-workspace restructure (deferred by [ADR-029](../../docs/decisions/ADR-029-multi-workspace-deferred.md)).
- Renaming TS source unless Phase 0 explicitly picks option C.
- Touching the `internal/bench/`, `internal/evals/`, `internal/workers/` content (PR #237 territory).
