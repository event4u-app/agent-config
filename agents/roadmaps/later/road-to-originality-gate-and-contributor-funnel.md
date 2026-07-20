---
complexity: lightweight
status: later
execution:
  mode: autonomous
---

# Road to originality-gate enforcement and a contributor funnel

> Put the adversarial anti-reskin gate on the actual PR enforcement path, give
> external contributors a self-service surface (precheck + visible credit), and
> run one demand-gated experiment that points the gate at skill-repo
> maintainers as an adoption vector.

> **Blocked until:** the extraction demand-gate window closes — floor met
> (≥ 3 distinct external signals) or 90 days after `docs/anti-reskin-gate.md`
> lands on `main`. Phases 0-2 and the Phase-3 probe are fully landed; only the
> floor-gated extraction + outcome recording remain. Trigger: evaluate the
> floor per `docs/contracts/adoption-signal-floor.md § Extraction demand gate`.

## Goal

Every PR that adds or edits skills runs `lint_originality --changed` as a
blocking CI gate, contributors can pre-check locally and see their work
credited, and the standalone-extraction bet is settled by a measured demand
signal instead of opinion.

## Prerequisites

- [x] `lint_originality --changed` exists, batch-masking hole closed,
  regression-tested (`src/scripts/lint_originality.ts:331-391`,
  `tests/scripts/lint_originality.test.ts:94-127` — landed in PR #969).
- [x] Wiring template exists: `.github/workflows/skill-lint.yml:131-132`
  (`skill_linter --changed`) with the "0 changed files is not a pass" guard
  (`:223`).

## Context

An external comparison (Source A, see Provenance) surfaced one hard local
finding and four adoption patterns. All claims were re-verified live on
2026-07-20 before this roadmap was cut:

- **The gate is unwired.** No workflow in `.github/workflows/` invokes
  `lint_originality` at all; `task ci` / `ci-strict` run only the full sweep
  (`taskfiles/content.yml:335`), which by its own doc comment
  (`lint_originality.ts:48-49`) does NOT carry the adversarial guard — "the
  `--changed` PR gate, not the sweep, is the adversarial defense". A 7-copy
  reskin batch passes today's CI.
- **Source A is a cautionary tale, not just a model.** ~13k stars, 17 skills,
  MIT — but frozen for 3 months at the previously cloned commit, 38 unmerged
  PRs, and **no CI at all** (validation is a 214-line stdlib script contributors
  run themselves via a PR-review helper skill). Its community funnel worked
  (Source/CREDITS attribution, self-service precheck) while its governance did
  not scale — supporting authoring-time prevention as this package's
  differentiator.
- **Overlap checked:** `road-to-adoption-without-narrative-debt.md` owns the
  outbound funnel (wedge, discoverability) and stays untouched — this roadmap
  is inbound governance + contributor surface; `road-to-maintainer-bus-factor.md`
  owns maintainer process; `domain-pack-extraction-when-triggered.md` gates
  domain-pack extraction (ADR-011) — the Phase 3 single-tool probe is a
  different mechanism (re-targeting one tool at non-users, not packaging the
  suite for users) and is demand-gated on its own floor.

> **Council 2026-07-20 (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2
> rounds):** unanimous — wire the `--changed` gate first (current
> vulnerability, hours of work); credits/source column is table-stakes for
> accepting external contributions. Split on standalone extraction (speculative
> pre-demand vs. mechanism-different adoption vector); converged shape adopted
> here: keep it, but demand-gated with an adoption-signal floor and an explicit
> kill criterion — the floor IS the demand gate, applied post-probe. Samples-as-
> ground-truth and intra-family routing tables: park until engagement telemetry
> can name the most-loaded skills (building for hypothetical workflows is
> premature).

## Gap-table (KEEP / FOLD / CUT)

| Source A pattern | Existing surface | Verdict |
|---|---|---|
| PR gate on changed files | `lint_originality --changed` built, unwired | **KEEP** — Phase 0 wires it |
| Contributor self-service precheck (their PR-review helper, two-stage) | `task ci` needs full toolchain; gates are maintainer-facing | **KEEP** — Phase 2 contributor-facing precheck |
| CREDITS + `Source: Official / Community` column | None (verified: no CREDITS file, no provenance column) | **KEEP** — Phase 1 |
| Standalone zero-config validator for repo maintainers | `lint_originality` coupled to repo toolchain | **KEEP, demand-gated** — Phase 3 probe before any extraction |
| Intent-routing tables inside skill families | Partial: judge-* sibling routing, `subagent-orchestration` static tables, `blast-radius-analyzer` negative routing | **CUT (revisit-if:** engagement telemetry identifies families with real mis-routing) |
| Samples-as-ground-truth + env-check gate (compilable references) | ~10 of 277 skills carry auxiliary files | **CUT (revisit-if:** telemetry names the 3-5 most-loaded engineering skills — then pilot, measurement-gated) |
| 1.4 MB per-skill reference trees | Condensation discipline forbids | **CUT** — token bomb |
| Multilingual `triggers:` inflation, unvalidated frontmatter keys | Trigger discipline + schema validation | **CUT** — buys activation with false-positive rate |

## Phase 0 — Wire `lint_originality --changed` into PR CI

- [x] Add a PR-triggered job (new workflow or a job in
  `skill-lint.yml`) that computes the changed-file set and runs
  `./scripts-run src/scripts/lint_originality --changed <files>`, mirroring the
  `skill_linter --changed` pattern incl. path filters.
  <!-- verify: ./scripts-run src/scripts/lint_originality --changed src/skills/ai-council/SKILL.md --quiet; echo "exit=$?" -->
- [x] Port the "0 changed files is not a pass" guard
  (`skill-lint.yml:223` pattern) so an empty changed-set reports INCONCLUSIVE,
  never green. <!-- carve-out: new-gate-verification -->
- [x] Add a workflow-level regression probe: a documented dry-run invocation in
  the workflow (or a test referenced from it) that exercises the batch-masking
  case, so future edits can't silently unwire the guard.
  <!-- verify: npx vitest run tests/scripts/lint_originality.test.ts -->
- [x] Update the doc comment in `lint_originality.ts` (and
  `docs/` where the gate is described) so "the `--changed` PR gate is the
  adversarial defense" points at the now-real workflow.

Exit criteria: a PR touching ≥1 skill file runs the `--changed` gate and a
synthetic reskin batch fails it (regression test green); zero-changed-set
reports INCONCLUSIVE. Rollback: remove the job — the sweep keeps running in
`task ci` unchanged.

## Phase 1 — Visible contributor credit

- [x] Add `CREDITS.md` (derivation attribution incl. license-required
  Apache/MIT entries per the existing vendored-cluster carve-out; closing
  "open an issue if unattributed" clause).
- [x] Add a `Source: Official | Community` column to the skill catalog surface
  (README table or generated catalog page — fix the generator source, not the
  generated page). <!-- verify: grep -n "| kind | name | source | description |" docs/catalog.md && grep -n "Community contributions" CREDITS.md -->
- [x] Document in `CONTRIBUTING`/docs that community skills get the Community
  tag + CREDITS entry on merge.

Exit criteria: catalog shows a provenance column; CREDITS.md exists and passes
the reference checker. Rollback: revert the docs/generator diff — no behavior
coupled.

## Phase 2 — Contribution precheck (contributor self-service)

- [x] Ship a `contribution-precheck` surface (command or skill) that runs the
  relevant subset locally — `skill_linter --changed` + `lint_originality
  --changed` + frontmatter validation — and emits a verdict with fix hints,
  without requiring the full `task ci` toolchain.
  <!-- verify: ./scripts-run src/scripts/lint_originality --changed src/skills/ai-council/SKILL.md --quiet -->
- [x] Lightweight first-contact mode: degrade gracefully when only Node is
  present (no task runner, no full env) — mirror the stdlib-only spirit of
  Source A's validator without porting it.
- [x] Cross-link it from CONTRIBUTING and from
  `road-to-maintainer-bus-factor.md`'s contributor-process items (link, don't
  duplicate).

Exit criteria: a fresh clone with Node only can run the precheck on a changed
skill and gets the same verdict class as PR CI. Rollback: remove the
command; CI gates unaffected.

## Phase 3 — Standalone extraction: demand probe with adoption-signal floor

Mechanism note: single-tool re-targeting at skill-repo maintainers, not a
domain-pack extraction — ADR-011's trigger gate governs packs; this phase
carries its own demand gate instead.

- [x] Cheap probe first, no publish: a docs page / README section
  ("anti-reskin gate for your skills repo — run it via the repo") with a
  copy-paste invocation that works from a clone, plus a tracked signal
  (stars on issue, reactions, inbound issues, clone-path analytics where
  available). Define the floor in the page itself.
- [x] Define the adoption-signal floor + kill criterion in
  `docs/contracts/adoption-signal-floor.md` (extend the existing contract):
  e.g. ≥N external-repo signals within the probe window, else the extraction
  is cancelled — recorded, not relitigated.
- [ ] If (and only if) the floor is met: extract `lint_originality` as a
  zero-config npx package (`--changed` mode, no repo coupling), with the
  regression suite riding along. <!-- gated on the 90-day adoption-signal window (contract § Extraction demand gate) -->
- [ ] Record the outcome either way (decision-record / memory) so the bet is
  settled by data. <!-- gated: window closes 90 days after the probe page lands on main -->

Exit criteria: probe live + floor documented; extraction either shipped (floor
met) or cancelled with recorded evidence (floor missed). Rollback: pull the
docs page; nothing else exists until the floor clears.

## Blockers

### blocker: npm-publish-go

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3 step 3 (actual npx package publication)
- **What to do:** publishing under an npm name is an irreversible external
  action (name squat, supply-chain surface) — maintainer decides name, scope
  and publish moment.
- **Resolved when:** maintainer confirms package name + publish, after the
  adoption-signal floor is met.

## Acceptance criteria

- [x] `--changed` originality gate blocks a synthetic reskin PR in CI and the
  0-changed-set guard reports INCONCLUSIVE.
- [x] Catalog carries the provenance column; CREDITS.md exists.
- [x] Precheck runs on a Node-only clone with the same verdict class as CI.
- [ ] Phase 3 has a recorded outcome (shipped or cancelled) backed by the
  documented floor — no open-ended "maybe later". <!-- gated: same 90-day window -->
- [x] Integration, not dump: no adopted item duplicates an existing surface
  (gap-table verdicts hold; routing-tables and samples remain CUT with their
  revisit conditions and were NOT partially implemented).

## Provenance

Source A — an external community skills catalog (~13k stars, MIT, 17 skills,
frozen since 2026-04 with no CI). Retained link:
`ENC1:54MCGP13zTAm+exTmZoKdOjyQRzwbTCSODs6XECfX/3x0vlA3pL0W5Kkuz21CWDBcXzDhKIDf2Ml6wEYJS3cZA==`
