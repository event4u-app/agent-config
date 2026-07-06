---
complexity: structural
status: ready
---

# Road to agents/-dir and gitignore hygiene

> **Goal.** One authoritative contract for what lives in `./agents/` (in this
> package, in the global install, and in consumer projects), one machine-readable
> source of truth for ignore/track classification, CI guards that make drift
> structurally impossible, and a consumer-facing fix command that repairs broken
> `.gitignore` / stray agent artefacts in one pass.

## Problem statement (evidence, 2026-07-06)

The recurring "why is there always junk / why is X not gitignored" pain has five
verified structural causes:

1. **No directory-level contract for `agents/`.**
   `scripts/lint_agents_layout.ts` only whitelists **flat files** at the
   `agents/` root; any directory is silently allowed. Result on disk today:
   `tmp.old/` (1.2 MB, dead since June), `memory/`, `notes/`, `state/`,
   `knowledge/`, `tickets/`, `templates/`, `roadmap-assets/`,
   `recruit-sessions/` — each added ad hoc, several overlapping in purpose
   (evidence vs reports vs notes; memory vs knowledge), none with a written
   owner or lifecycle.

2. **Generator output is not classification-gated.**
   `condense.ts` started writing `.claude/agents/*.md` (subagent-v1, ADR-109).
   The consumer template (`src/config/gitignore-block.txt`) got the
   `.claude/agents/` entry, the **package's own `.gitignore` did not** — so
   `.claude/agents/production-validator.md` sits untracked in the working tree
   today. There is no lint asserting "every path a generator writes is either a
   tracked carve-out or ignored".

3. **Two hand-maintained gitignore sources that drift.**
   The package `.gitignore` (~250 hand-grown lines, historical comments,
   duplicate entries — `.agent-settings.yml` appears twice) and
   `src/config/gitignore-block.txt` (consumer managed block) share most
   semantics but no data source. They even use **different managed-block
   markers** (`# >>> event4u/agent-config (managed) >>>` in the package file vs
   `# event4u/agent-config` / `— END` written by `sync_gitignore.ts`).

4. **Analysis/regen outputs leave permanent dirty-tree residue.**
   Tracked evidence/report files (`agents/evidence/analysis/meta-layer-inventory.*`,
   `agents/reports/auto-rules-audit.md`) get regenerated mid-session by audit
   tooling and left modified. Today's dirty copies are **stale or wrong**: the
   regen dropped the `<!-- analyzed: … -->` freshness marker that
   `analysis_freshness.ts` depends on, and the added trigger-overlap table cites
   a rule (`augment-source-of-truth`) that no longer exists in `src/rules/`.
   `agents/settings/contexts/knowledge-system-verdict.md` was edited to claim
   the knowledge-system roadmap no longer lives in `archive/` (it does:
   `agents/roadmaps/archive/road-to-knowledge-system.md`) and to revert
   `team-knowledge:*` naming (tracked source uses
   `team-knowledge:*`) — an abandoned session edit contradicting reality.

5. **No janitor.** Per-user / install-time strays (`agents/installed-tools.lock`,
   `agents/.event4u-bridge.yml` — both "never in the maintainer source repo" per
   ADR-020 — plus 74 MB `agents/.harvest-local/`) accumulate with no retention
   policy or doctor check.

6. **Tracked-but-ignored files sit in the repo.** `git ls-files -ci
   --exclude-standard` lists 11 files: 10 bench per-run outputs under
   `internal/bench/reports/ab/` (ignore patterns were added AFTER the files were
   committed; never untracked) and `src/templates/minimal/.agent-settings.yml`,
   whose carve-out negation is **stale** — `.gitignore` still says
   `!templates/minimal/.agent-settings.yml` but the file moved under `src/`
   during the root restructure, so the negation no longer matches and the
   tracked file is silently ignore-shadowed.

7. **`agents/tmp` / `agents/tmp.old` have intended semantics nobody wrote
   down.** Intent (owner statement, 2026-07-06): `agents/tmp/` is the **user's
   inbox** — a place to drop own tmp/todo notes for the agent to pick up;
   `agents/tmp.old/` is where **processed** inbox files land once agent-config
   is done with them (e.g. after a roadmap was created from a tmp note), giving
   a self-cleaning todo flow. The agent's own scratch must live elsewhere
   (session scratchpad / `agents/runtime/tmp/`), never in the user inbox.
   Nothing implements the move-to-`tmp.old` step today, both dirs are missing
   from the **consumer** gitignore block (only the package `.gitignore` covers
   them), and no skill/command documents the inbox contract.

## Phase 1 — Immediate triage of the current dirty tree

Small, standalone; unblocks a clean `git status` before the structural work.

- [x] **1.1 — Add `/.claude/agents/` to the package `.gitignore`** next to the
  existing `/.claude/rules/` block, with a one-line comment pointing at
  `condense.ts` (subagent projection, ADR-109). Verify:
  `git check-ignore .claude/agents/production-validator.md` exits 0 and
  `git status --porcelain` no longer lists `.claude/`.
- [x] **1.2 — Discard the four stale working-tree modifications** after a last
  human look: `git checkout -- agents/evidence/analysis/meta-layer-inventory.csv
  agents/evidence/analysis/meta-layer-inventory.md agents/reports/auto-rules-audit.md
  agents/settings/contexts/knowledge-system-verdict.md`. Rationale recorded in
  the problem statement above (stale/wrong regen output; contradicts tracked
  source). If the Phase-5.2 trigger-overlap data is still wanted, re-run
  `npx tsx src/scripts/audit_auto_rules.ts` against current `src/rules/` in the
  PR that needs it — do not commit a run that names deleted rules.
- [x] **1.3 — Fix the stale minimal-template negation**: change
  `!templates/minimal/.agent-settings.yml` to
  `!/src/templates/minimal/.agent-settings.yml` in the package `.gitignore` so
  the tracked stub stops being ignore-shadowed. Verify:
  `git check-ignore src/templates/minimal/.agent-settings.yml` exits 1.
- [x] **1.4 — Untrack the ignored bench run outputs**: `git rm --cached` the 10
  files under `internal/bench/reports/ab/*-ab-trackb-*.{json,md}` (they match
  existing ignore patterns; `docs/benchmark.md` is the committed visible
  result). Afterwards `git ls-files -ci --exclude-standard` must list nothing.
- [x] **1.5 — Ship 1.1 + 1.3 + 1.4 as one hygiene PR.** The discards in 1.2
  are local-only. `agents/tmp.old/` is NOT deleted — it is part of the inbox
  contract (Phase 6).

## Phase 2 — agents/ directory contract (the taxonomy)

One written contract; everything later enforces it.

- [x] **2.1 — Author `docs/contracts/agents-layout.md`**: for every allowed
  top-level entry under `agents/` (package-repo scope AND consumer scope AND
  global-install scope) declare: purpose, owner surface (which scripts/skills
  write it), git policy (`tracked-durable` / `tracked-generated` /
  `local-only`), retention (permanent / TTL / session), and the consumer-shape
  subset (today: `overrides/` + `.event4u-bridge.yml` only). Start from the
  live inventory in this roadmap's problem statement; classify **every**
  existing dir — nothing stays unclassified. Two design invariants go in the
  contract preamble: (a) **the `agents/` root stays flat-minimal** — content
  lives in typed subdirectories, new flat files/dirs need a contract edit, and
  the whitelisted flat files stay the current six; (b) **`agents/tmp/` is the
  user's inbox, `agents/tmp.old/` the processed archive** (see Phase 6) — the
  agent's own scratch goes to the session scratchpad or `agents/runtime/tmp/`,
  never into the user inbox.
- [x] **2.2 — Resolve the overlap pairs explicitly** in that contract (decision
  per pair, then a migration step if merged): `evidence/` vs `reports/` vs
  `notes/` (candidate: fold `reports/` and `notes/` into typed `evidence/`
  subdirs); `memory/` vs `knowledge/` (keep both only if the boundary sentence
  is crisp — knowledge = curated committed pages, memory = promotion pipeline);
  `templates/` vs `roadmap-assets/` (candidate: single `assets/`);
  `recruit-sessions/`, `features/`, `tickets/` (keep, but state owner +
  lifecycle). Each merge gets its own checkbox when decided:
  - [x] 2.2a — Decision recorded per pair in `docs/contracts/agents-layout.md`.
  - [-] 2.2b — `git mv` migrations: decision is NO migration today — legacy top-level `reports/` and `notes/` stay as-is; new files land in `evidence/` subdirs. Non-blocking.
- [x] **2.3 — Extend `lint_agents_layout.ts` to enforce directories too**: in
  source-repo mode, unknown top-level `agents/` **directories** become errors
  (whitelist read from the contract — keep the list in the script, with a
  comment linking the contract; or parse a fenced table from the contract if
  cheap). Keep consumer mode as warnings. Add the new dir list to the existing
  tests. Run once locally: `npx tsx src/scripts/lint_agents_layout.ts --strict`.
  <!-- carve-out: new-gate-verification -->
- [x] **2.4 — Consumer-scope allowlist**: same script, consumer mode — extend
  `CONSUMER_EXPECTED_ENTRIES` from the contract (e.g. `knowledge/`, `memory/`,
  `roadmaps/`, `overrides/` are legitimate in consumers; `evidence/`,
  `recruit-sessions/` are not) so `agent-config doctor` can report real drift
  instead of only two entries.

## Phase 3 — Single ignore-classification manifest

Kill the two-hand-maintained-gitignores problem at the data layer.

- [x] **3.1 — Create `src/config/agents-paths.yml`** (or `.json`): one entry per
  managed path with `path`, `scope: package|consumer|both`, `policy: tracked |
  tracked-generated | ignored | carve-out`, `writer` (script/skill that
  produces it), `rationale` (one line). Seed it from the union of the current
  package `.gitignore` agent-related entries and `gitignore-block.txt`. First
  gap to encode: `/agents/tmp/` and `/agents/tmp.old/` with `scope: both` +
  `policy: ignored` — today only the package `.gitignore` covers them, consumer
  projects would commit their inbox.
- [x] **3.2 — Generate `src/config/gitignore-block.txt` from the manifest**
  (`scope: consumer|both` + `policy: ignored`), preserving the current section
  comments as `comment:` fields so the emitted file stays reviewable. Golden
  test: emitted block byte-comparable to a committed fixture.
- [x] **3.3 — Generate the package-repo managed section from the manifest**
  (`scope: package|both`): adopt the SAME marker convention `sync_gitignore.ts`
  already writes (`# event4u/agent-config` … `# — END`), replacing the ad-hoc
  `# >>> … (managed) >>>` block. Hand-written package-specific entries (vendor,
  Python, Playwright, bench, site…) stay outside the managed block untouched.
  De-duplicate the file in the same pass (`.agent-settings.yml` twice today).
- [x] **3.4 — CI freshness gate**: a check script asserting (a) the committed
  `gitignore-block.txt` and the package `.gitignore` managed section match the
  manifest byte-for-byte, (b) no manifest entry is missing from either target.
  Wire into the lint task cluster. Run once locally on introduction.
  <!-- carve-out: new-gate-verification -->

## Phase 4 — Generator-output coverage lint

The guard that would have caught `.claude/agents/`.

- [x] **4.1 — Inventory every generator write-target**: extend the existing
  capability-matrix mechanism (`condense.ts` `_FN_SPEC` → `capability-matrix.md`)
  or add a sibling export so each `generate_*` / projection function declares
  its output root(s) (`.claude/agents/`, `.claude/skills/`, `dist/agent-src/`,
  `.augment/`, …).
- [x] **4.2 — Lint: every declared output root is classified** — either a
  tracked carve-out (negation in the managed section / explicit `!` entry) or
  ignored, per the Phase-3 manifest. A generator writing to an unclassified
  path fails CI with a message naming the manifest file to edit. Run once
  locally on introduction. <!-- carve-out: new-gate-verification -->
- [x] **4.3 — PR-template/docs note**: adding a `generate_*` output requires a
  manifest entry in the same commit (mirrors the existing capability-matrix
  rule; one sentence in `docs/contracts/agents-layout.md` + CONTRIBUTING
  pointer).

## Phase 5 — Consumer fix command: `gitignore` repair in one pass

Today `sync-gitignore` syncs the block and `--cleanup-legacy` scrubs old
patterns. Consumers still end up with committed runtime files and unmanaged
strays. Extend rather than replace.

- [x] **5.1 — Extend `sync_gitignore.ts --cleanup-legacy`** with the current
  known-stray generation (pre-`agents/runtime/` paths already covered; add any
  new legacy patterns the Phase-3 manifest marks `deprecated`). Manifest gets
  an optional `legacy: true` flag feeding `LEGACY_PATTERNS` at build time so
  the list stops being hand-edited in two places.
- [x] **5.2 — New detection pass: "ignored-but-tracked" repair.** In the fix
  flow (`/sync-gitignore:fix` command + CLI), after syncing the block, run
  `git ls-files -ci --exclude-standard` scoped to `agents/` + tool dirs; report
  every file that is now ignored but still committed, and offer the exact
  `git rm --cached <path>` commands. **Never execute the untrack automatically**
  — print the commands and stop (commit/push stay user-owned per the git-ops
  permission gates).
- [x] **5.3 — New detection pass: "agent artefacts not covered".** Scan for
  known agent-artefact shapes outside the managed classification (e.g.
  `agents/runtime/**` tracked, `.agent-*` files tracked, tool-projection dirs
  tracked in a global-only consumer) and report with the matching manifest
  policy line. Data source: the Phase-3 manifest — no second hardcoded list.
- [x] **5.4 — Wire both passes into `agent-config doctor`** as read-only checks
  (report + hint to run the fix command), and into the
  `/sync-gitignore:fix` command doc so the chat flow and CLI stay one surface.
- [x] **5.5 — Tests**: fixture repos (consumer with committed runtime file;
  consumer with pre-Phase-5 legacy entries; clean consumer) asserting report
  output and idempotency (second run = no changes). Run the new suite once
  locally. <!-- carve-out: new-gate-verification -->

## Phase 6 — User inbox workflow: `agents/tmp/` → `agents/tmp.old/`

The self-cleaning todo flow. `agents/tmp/` = the USER drops notes/todos/drafts;
agent-config consumes them (e.g. `/roadmap:create` from a tmp note) and moves
the consumed file to `agents/tmp.old/`; `tmp.old/` decays via TTL. The agent
never uses the inbox for its own scratch.

- [x] **6.1 — Write the inbox contract section** in
  `docs/contracts/agents-layout.md`: ownership (user writes `tmp/`, agent only
  reads + moves; agent writes `tmp.old/` moves only), naming (free-form; no
  format requirement — it is the user's space), git policy (both ignored, both
  scopes), retention (`tmp/` untouched by any janitor — user-owned; `tmp.old/`
  TTL, e.g. 30 days).
- [x] **6.2 — Implement the move-after-processing behaviour**: when a command
  or skill consumes an inbox file as its INPUT (roadmap created from it, ticket
  bundle generated, note promoted to memory/knowledge), it moves the source
  file to `agents/tmp.old/<original-name>` in the same reply — after asking is
  not needed (local-only, gitignored, reversible move). Touchpoints to update:
  `/roadmap:create` + `roadmap-writing`/`roadmap-management` skills,
  `/memory:*` promotion flows, and a one-line clause in the agent-docs-writing
  skill so future consumers of inbox files inherit the behaviour. Guard: only
  files under `agents/tmp/` are ever moved; never anything else.
- [x] **6.3 — Redirect agent scratch away from the inbox**: sweep
  `src/` skills/commands/scripts for writes into `agents/tmp/`
  (`grep -rn "agents/tmp" src/ --include="*.md" --include="*.ts"`) and repoint
  agent-generated scratch to `agents/runtime/tmp/` (already ignored via the
  runtime catch-all). The inbox stays human-only.
- [x] **6.4 — Doctor/janitor visibility**: doctor reports inbox state (N files
  in `tmp/`, oldest date; N files in `tmp.old/` beyond TTL) so pending todos
  and cleanable archive are one glance away.

## Phase 7 — Janitor and retention

- [x] **7.1 — TTL sweep for `agents/tmp.old/` and runtime caches**: retention
  rules in the Phase-2 contract (e.g. `tmp.old/` 30 days); a small `janitor`
  script (dry-run by default, `--apply` to delete) reporting per-dir age + size
  for `agents/tmp.old/`, `agents/runtime/` caches, and any dir the contract
  marks `TTL`. **`agents/tmp/` (user inbox) is report-only — never auto-swept.**
  Surface in `agent-config doctor`; never delete without `--apply`.
- [x] **7.2 — Source-repo stray-file check**: doctor (source-repo mode) warns on
  `agents/installed-tools.lock` and `agents/.event4u-bridge.yml` present in the
  maintainer repo (ADR-020 says they belong to consumers only). Read the
  expected-absent list from the Phase-3 manifest (`scope: consumer` + present
  in package = warn).
- [x] **7.3 — `agents/.harvest-local/` size note**: keep (source-confidentiality
  layer), but doctor reports its size so the operator sees the 74 MB and can
  prune manually. No auto-deletion — it is retained evidence.
- [x] **7.4 — Tracked-but-ignored guard**: tiny CI check running
  `git ls-files -ci --exclude-standard` and failing on any hit — makes the
  Phase-1.4 class of drift (ignore pattern added, file never untracked; stale
  negations) impossible to reintroduce. Run once locally on introduction.
  <!-- carve-out: new-gate-verification -->

## Phase 8 — Session-leftover discipline (evidence/report regen)

- [x] **8.1 — Freshness-marker contract**: every regenerable tracked analysis
  artefact (`agents/evidence/analysis/*`, `agents/reports/*` that a script
  generates) MUST carry the `<!-- analyzed: date | commit | files -->` header.
  Fix the regen tools (`inventory_meta_layers.ts`, `audit_auto_rules.ts`, …) to
  WRITE the marker on every run (today at least one drops it).
- [x] **8.2 — Lint: generated-artefact header present.** Cheap check over the
  known generated files (list from the Phase-3 manifest `writer` field or a
  small static list): missing/stale marker = warning; missing on a file a
  script claims to own = error. Run once locally on introduction.
  <!-- carve-out: new-gate-verification -->
- [x] **8.3 — Regen-policy sentence in the contract**: analysis regen outputs
  are committed only together with the work that consumed them; a session that
  regenerates as a side effect discards (`git checkout --`) before ending.
  Add one line to the relevant skill (`project-analysis-core` freshness loop /
  `agent-docs-writing`) pointing at the contract — no new rule file.

## Phase 9 — Docs and rollout

- [x] **9.1 — AGENTS.md / CLAUDE.md pointer**: one line linking
  `docs/contracts/agents-layout.md` from the package CLAUDE.md pointer list.
- [x] **9.2 — Consumer docs**: short section in `docs/customization.md` (or
  getting-started) — "what lives in `./agents/` in YOUR project", the
  consumer-scope table from the contract, the inbox workflow
  (`agents/tmp/` → `agents/tmp.old/`), and the fix command
  (`agent-config sync-gitignore --cleanup-legacy` / `/sync-gitignore:fix`).
- [x] **9.3 — Changelog + migration note** for the marker-convention change in
  the package `.gitignore` (Phase 3.3), the new consumer ignore entries
  (`/agents/tmp/`, `/agents/tmp.old/`), and any dir merges (Phase 2.2b).

## Acceptance criteria

- `git status --porcelain` is empty on a fresh clone after `task sync` +
  `task generate-tools` (no generator output lands untracked/unignored).
- `agents/` top-level: every entry (file AND dir) whitelisted by the contract;
  `lint_agents_layout` errors on anything else in source-repo mode.
- Package `.gitignore` managed section and `gitignore-block.txt` are both
  generated from `src/config/agents-paths.yml`; CI fails on drift.
- A consumer with a broken/legacy `.gitignore` gets to a clean state with one
  command run + the printed `git rm --cached` list.
- `git ls-files -ci --exclude-standard` is empty in the package repo and stays
  empty (CI guard).
- Inbox flow works end-to-end: a note dropped in `agents/tmp/` that a command
  consumes lands in `agents/tmp.old/` in the same reply; both dirs ignored in
  package AND consumer scope; `tmp.old/` decays via janitor TTL, `tmp/` is
  never auto-swept.
- All quality gates pass on the PR (remote CI is the gate).
