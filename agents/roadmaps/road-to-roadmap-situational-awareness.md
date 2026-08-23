---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
depends: []
# One row per relation this roadmap's own "Related, not duplicated" section
# names. The probe found ZERO keyword hits (scanned: 716 roadmap file(s) across
# active/later/stubs/archive, 0 sibling hits) — both rows below are
# author-identified, which is exactly why the field is not `[]`: an empty list
# would have been true about the probe and false about the roadmap.
relates:
  - slug: road-to-merge-hotspot-drawdown
    relation: disjoint
    note: "archived; it addressed WHICH files conflict, this addresses WHEN the agent learns they are in flight"
  - slug: road-to-team-context
    relation: disjoint
    note: "a stub for a team-shared context SERVER (identity, multi-user); this touches no server and no identity model"
drafted_against: 33d7f74af
drafted_at: 2026-08-22
estate_offset_exempt: "An /analyze:inbox run consumes inbox notes and closes no roadmap, so this change carries no completed roadmap to retire against the addition."
---

# Road to roadmap situational awareness

> **Source:** `agents/tmp.old/senior-roadmaps/` — a chat transcript (2026-08-22,
> German) asking that roadmap authoring and roadmap execution both account for
> what is not obvious in the moment, "like a senior dev who coordinates with
> their team", plus a superseded 876-line draft
> `road-to-repository-aware-planning-and-execution.md`, dropped as over-built,
> with exactly two items harvested into Phase 5 (steps 5.5 and 5.6). Drafted
> against `33d7f74af`; every claim below re-read and corrected against
> `f6703b78a` via `/analyze:inbox`. Corrections carry the tag
> `corrected-from-reproduction` inline.

## Goal

A roadmap run — authoring or execution — starts from, and periodically
refreshes, one machine-produced picture of what else is in motion: open PRs and
the files they touch, peer sessions and the paths they own, sibling roadmaps in
`later/` and `stubs/`, and inbox notes on the same topic; and it reacts to that
picture with enumerated responses instead of either ignoring it or stopping for
a reason the loop forbids.

## Context — the ingredients exist, the wiring does not

This is the whole finding, and it sets the scope of every phase below: the tree
already carries almost every **ingredient** of situational awareness and almost
none of the **wiring**.

| Ingredient | Where it already lives | Why it does not reach a run |
|---|---|---|
| The four-command live screen (fetch, active, archived, open PRs, sessions) | `src/domains/product-basic/roadmap/next/command.md:39-45` | Hand-written in one command file, for **selection** only |
| File-overlap derivation between two work units | `src/agent-src/contexts/execution/roadmap-process-loop.md:314-326` | Lives inside a multi-roadmap set contract; a single-roadmap run never enters it |
| Freshness against the remote base | `src/scripts/check_branch_freshness.ts:6-24` | Deterministic, and bound to **push** — the one point after the decisions it would have changed |
| The obligation itself | `src/rules/direct-answers.md` § "Live-state facts — never from memory" | Already forbids asserting PR / branch / merge state from memory and mandates the live check; a kernel rule with no mechanism behind it at execution time |
| Peer coordination substrate | `sessions:claim` / `sessions:list`, `docs/guides/parallel-sessions.md` | Keyed on slug and branch, never on paths |

The three `process-*` command files contain none of it. So the residue is
narrow and sharp: **one deterministic probe, a path axis instead of a slug
axis, a mid-run refresh cadence, and a named `superseded` disposition.**

### Confirmed defects, with provenance

| # | Defect | Evidence (`f6703b78a` unless noted) |
|---|---|---|
| D1 | **No unconditional live screen at execution time** — `corrected-from-reproduction`; the drafted reading was "the screen exists only for selection", which understates it. The loop's screen is **claim-triggered**: `roadmap-process-loop.md:31-49` fires only when a message would *describe* a roadmap as in-flight / merged / handled. `process-full --all` carries the screen only **by reference** (`process-full/command.md:94-97`) with a per-roadmap re-fetch (`:107-110`). Single-roadmap `process-step` / `process-phase` / `process-full` has neither. | Live: **2 of 22** active roadmaps are closed in open PRs — #1546 `roadmap: complete road-to-catalog-and-projection-economy`, #1547 `roadmap: complete road-to-ci-supply-chain-integrity` |
| D1b | **The sample decays inside a week** — `corrected-from-reproduction`; the drafted figure was "4 of 24 (#1545, #1546, #1547, #1551)". #1545 and #1551 merged inside `577bdbf88..HEAD` and their roadmaps were archived by `c386261b3` and `f18c9c0b3`. The sample **halved itself in six days.** That is the defect's own strongest evidence: a screen taken once is wrong within a week, so the fix is a refresh cadence, not a better one-shot screen. | 4/24 at `33d7f74af` → 2/22 at `f6703b78a` |
| D2 | **No mid-run refresh** — `corrected-from-reproduction`; "no fetch anywhere" holds for `roadmap-process-loop.md` and `roadmap-execution-contract.md` only. `process-full` **does** re-fetch **between** roadmaps under `--all` (`:107-110`) and never **within** a run. Freshness is therefore established once at branch time and again at push, with the whole run in between. | `check_branch_freshness.ts:6-24` documents the measured 90-minute stale window that produced a `CONFLICTING` PR |
| D3 | **Overlap is compared on slug and branch, never on paths.** Session record fields are `session_id, platform, worktree, branch, roadmap_slug, started_at, last_seen` (`src/scripts/session_register_hook.ts:533-541` — `corrected-from-reproduction`: the file is at `src/scripts/`, not `src/scripts/hooks/`). No path axis. | Live: #1546 edits `src/config/preamble-payload-budget.json` (cited by `road-to-org-pack-fitness`, `road-to-standing-payload-diet`) and `src/scripts/schemas/skill.schema.json` (cited by `road-to-council-seat-selection`, `road-to-skill-delivery-over-mcp`). None would be flagged today |
| D4 | **`depends:` is defined and unused.** Field defined at `src/agent-src/templates/roadmaps.md:133-137`; the loop treats it as authoritative (`roadmap-process-loop.md:318`). Adoption **0/22** — `corrected-from-reproduction` (drafted as 0/24) | A frontmatter grep for `depends:` across the active set returns nothing |
| D5 | **Authoring is blind semantically, not lexically** — `corrected-from-reproduction`; the drafted claim "collision check is filename-only" mis-stated it. The check at `create/command.md:140-149` is a **recursive** `find agents/roadmaps -type f -iname`, so it already covers `later/`, `stubs/` and `archive/`. What is missing is the **semantic** axis: same topic, different name. Inbox notes are read only when the user names a file (`:169-179`), and "Do NOT auto-generate content" (`:314`) leaves no step for proactively naming an overlap | Candidate set: 22 active + 60 `later/` + 51 `stubs/` + 568 `archive/`; the dashboard excludes the last three (`src/agent-src/scripts/update_roadmap_progress.ts:93`) |
| D6 | **No legitimate `superseded` outcome.** "let the open PRs merge first" is rightly forbidden (`roadmap-process-loop.md:738`) and the halt list is declared exhaustive (`:730`), but `## Terminal outcomes` (`:665`) carries no class for *a merged PR that already closed this step*. A run that meets one faces a forced choice between a rule violation and duplicate work | `corrected-from-reproduction`: the disposition belongs under Terminal outcomes, **not** in the halt list |
| D7 | **Two hygiene items.** (a) The loop declares `Size budget: ≤ 4,000 chars` at `roadmap-process-loop.md:11`; the file is **47,115 bytes** — 11.8×, a dead budget rather than a typo. (b) `--all` orders by percent-done (`process-full/command.md:99-100`) while `next` forbids exactly that (`next/command.md:135-140`) | `corrected-from-reproduction`: `--all` **states its reason** ("because they convert soonest") and cites `next`'s live-screen rule in the same block, so this is a stated divergence to record or retract, not an unnoticed bug |

### Related, not duplicated

- `road-to-merge-hotspot-drawdown` (archived) addressed *which* files conflict;
  this roadmap addresses *when the agent learns* that they are in flight.
- `agents/roadmaps/stubs/road-to-team-context.md` is **not** this roadmap —
  `corrected-from-reproduction`. It tracks a team-shared context **server**
  (identity, multi-user authoring, Hard-Floor-gated). This roadmap touches no
  server and no identity model; it reads git, the GitHub CLI, and the local
  session register only.
- `sessions:claim` / `parallel-sessions` remain the coordination substrate.
  Phase 3 extends the record additively; it does not replace it.

## Phase 1 — One deterministic context probe

**Exit criteria:** `roadmap_context.ts` exists, its tests pass, and an offline
invocation exits 0. **Rollback:** delete the script and its test; nothing else
references it until Phase 2.

- [x] **1.1 Add `src/scripts/roadmap_context.ts` (CLI `roadmap:context`).**
      This is an **extraction, not greenfield**: the hand-written four-command
      block at `next/command.md:39-45` becomes one probe callable from all five
      entry points. `agent-config work:context` / `roadmap:context` genuinely
      does not exist today — a scan of `src/scripts` for `work_context` or
      `roadmap_context` is empty. Emits one report, all reads live: a pruning
      fetch; open PRs with number, title, head branch and the changed-file set
      against the merge base; remote branches carrying a roadmap tail;
      `sessions:list` in the human form (both axes); `agents/tmp/` file **names**
      only, never contents; and title/slug keyword hits across all four roadmap
      directories. `--roadmap <slug>` narrows the hits. `scanned:` line on
      every path per ADR-054.
      verify (discharged): `./scripts-run src/scripts/roadmap_context --json` emitted `"open_prs": [...]` (an array) and exited 0 at `c7e82087e`; `agent-config roadmap:context` reaches the same script through the new `cmd_roadmap_context` dispatch entry. The offline half is asserted in the test suite rather than by unplugging the machine — `probe()` takes an injected executor, and `offline path — degrade, never refuse` pins both `network: 'unavailable'` with an empty PR set and the literal `scanned: 0 PRs (network unavailable)` line in `renderText`. **Drift from the step's own premise:** the step asks for `jq -e`, which is not a dependency this repo declares; the assertion was made on the emitted JSON directly. Registration cost three surfaces the step did not name — `src/cli/registry.ts`, `_dispatch.bash` (help text, `cmd_roadmap_context`, case entry) — and `tests/cli/registry.test.ts` + `tests/cli/help.test.ts` are green over them.
- [x] **1.2 Unit tests for the probe** — PR file-set extraction,
      roadmap-tail branch match, keyword hit across all four roadmap
      directories, `agents/tmp/` names-only, offline path.
      verify (discharged): `npx vitest run tests/scripts/roadmap_context.test.ts` → **18 tests passed**, well past the five-assertion floor. Sensitivity was proven rather than assumed: four sabotages (`online = true`; inbox names concatenated with file contents; the pre-scan branch disabled; the subject no longer excluded from its own hits) turned **5 tests red** with the verbatim failures `expected 'live' to be 'unavailable'`, `expected [ 'idea-one.md:PRIVATE-SCRATCH-BODY' ] to deeply equal [ 'idea-one.md' ]`, `expected [] to deeply equal [ { roadmap: 'road-to-thing', …(3) } ]` and `expected [ { …(4) } ] to deeply equal []`; the file was then restored from a `cp` backup and re-run green at 18/18.
- [x] **1.3 State the honesty boundary in the script header.** The probe is
      deterministic once invoked; the invocation is model-carried. Same shape
      as the boundary already stated in `next/command.md`.
      verify (discharged): `grep -c "model-carried" src/scripts/roadmap_context.ts` → `1`, in the header block `THE PROBE IS DETERMINISTIC ONCE INVOKED. THE INVOCATION IS MODEL-CARRIED.` The same sentence is repeated at the end of the rendered human report, so a reader of the *output* meets the boundary too, not only a reader of the source.

## Phase 2 — Wire the probe into every entry point

**Exit criteria:** all five entry points name `roadmap:context`, and the loop's
call site is unconditional rather than claim-triggered. **Rollback:** revert the
four prose edits; the probe stays and is simply uncalled.

- [x] **2.1 `roadmap-process-loop § 1` calls `roadmap:context --roadmap <slug>`
      before resolving the roadmap — unconditionally.** This is the D1
      residue: today's screen at `:31-49` fires only when a message would claim
      in-flight state. Print the report in the pre-run summary. Roadmap closed
      in an open PR → name the PR and stop; this is a **selection error**, not
      a halt, and does not touch the halt list. Roadmap partially covered by an
      open PR → name the PR and continue on a branch from `origin/main`.
      verify (discharged): `grep -c "roadmap:context"` → `1`; `grep -c "before resolving the roadmap"` → `2` (the subsection heading and the imperative under it). The new `### Context probe` subsection sits **above** `Search both locations:` and above the existing claim-triggered live merge-state clause, so the unconditional call precedes the conditional one rather than replacing it; the closed-in-an-open-PR reading is written as a **selection error** and the halt list is untouched.
- [x] **2.2 `/roadmap:next § 1` replaces the four-command block with the
      probe**, leaving the three-way exclusion table (`taken by an open PR` /
      `claimed by a live session` / `held by a foreign worktree`) unchanged.
      verify (discharged): `grep -c 'gh pr list --state open --json number,title,headRefName' src/domains/product-basic/roadmap/next/command.md` → `0`; `grep -c 'held by a foreign worktree'` → `1`. The three-way exclusion table is byte-unchanged; only the command block above it moved to `agent-config roadmap:context`, and the both-axes rationale was rewritten to explain the report rather than the `--json` flag it no longer passes.
- [x] **2.3 `/roadmap:create` gains step 0b — run the probe before step 1.**
      Surface hits (inbox note on the same topic, sibling in `later/` or
      `stubs/`, open PR on the cited paths) as one list. Amend the rule at
      `create/command.md:314`: naming an overlap is coordination, not content
      generation, and is required.
      verify (discharged): `grep -c "roadmap:context"` → `1` (new `### 0b. Context probe — before step 1`, placed above `### 1. Determine location`). The amendment is the bullet immediately after the unchanged `- **Do NOT auto-generate content**` line in § Rules: *"Naming an overlap is coordination, not content generation, and it is required."* **Drift from the step's stated anchors:** the collision check is at `:143-150`, not `:140-149`, and the auto-generate rule at `:339`, not `:314` — the file grew between drafting and execution. The characterisation was correct: the check is a recursive `find -iname` and therefore lexical only.
- [x] **2.4 `roadmap-writing § 0` replaces the prose overlap obligation with
      the probe plus the relation table** (Phase 4).
      verify (discharged): `grep -c "roadmap:context" src/skills/roadmap-writing/SKILL.md` → `1`. The prose obligation *"Inspect existing roadmaps under `agents/roadmaps/` for overlap or supersession"* is replaced by the probe call plus the `relates:` row mapping; the pre-save self-check gains item **5b**, which requires either one row per probe hit or an explicit `relates: []` carrying the `scanned:` line — the reflex-empty-list risk (risk register rank 3) named in the question itself.

## Phase 3 — Overlap on paths, not on slugs

**Exit criteria:** a session record can carry `owned_paths`, `sessions:list`
labels path collisions separately, and the probe reports roadmap-to-PR file
overlap. **Rollback:** the field is additive — dropping the writer restores
byte-identical records.

- [x] **3.1 Extend the session record with `owned_paths`, additively.** Use
      the shape `turn_end_refusals` already established at
      `session_register_hook.ts:542-548`, which states exactly the guarantee
      needed: a session with no paths leaves the record **byte-identical** to
      what it was before the field existed. Current fields are at `:533-541`.
      Source of the set: the § 3b pre-scan's owned paths, written by
      `sessions:claim --paths`.
      verify (discharged): **the step's named test file does not exist** — there is no `tests/scripts/session_register_hook.test.ts`; the suite for both `session_register.ts` and `session_register_hook.ts` is `tests/scripts/session_register.test.ts`. Extended that file rather than creating the named one (extend before create). `npx vitest run tests/scripts/session_register.test.ts` → **101 passed**, including `leaves a record byte-identical to the pre-change fixture when no paths are declared` (asserts the key list is the frozen seven AND `JSON.stringify` equality against a hand-written fixture, so the guarantee does not depend on the code under test) and `round-trips a declared path set through the claim file into the record`. Sensitivity proven: writing `owned_paths` unconditionally and dropping the `filter(...).sort()` turned **4 tests red** — `expected [ 'session_id', 'platform', …(6) ] to deeply equal [ …(5) ]`, `expected true to be false`, `expected [ …(2) ] to have a length of 1 but got 2`, `expected [ Array(1) ] to deeply equal []`; restored from a `cp` backup, green at 101/101. Surfaces touched beyond the step's own list: `RoadmapClaim.paths`, `ResolvedClaim.paths`, `_read_claim_file`, `resolve_claim` (all three return sites), `sessions:claim --paths`, plus the doc surfaces `/roadmap:next § 3b` and `docs/guides/parallel-sessions.md`.
- [x] **3.2 `sessions:list` prints path collisions** between this session's
      owned paths and each live peer's, labelled `PATH OVERLAP`, kept distinct
      from the slug and branch labels.
      verify (discharged): `path_overlap_lines` is exported pure and pinned by four cases in `tests/scripts/session_register.test.ts` — exactly one line for two peers where one shares exactly one path (asserting the shared path IS named and the peer's non-shared path is NOT), zero for disjoint sets, zero when this session declared nothing, and `kinds === ['roadmap','branch','path']` so the three labels stay distinct and ordered stop → coordinate → reorder. `CollisionKind` gained `'path'` last on purpose: `foreign_sessions_block` filters on `'roadmap'`/`'branch'` and is byte-unchanged in behaviour.
- [x] **3.3 The probe computes roadmap-to-open-PR file overlap by REUSING the
      owned-path sets `roadmap-process-loop.md:314-326` already derives.** No
      second derivation — extend before create. Where no pre-scan set exists,
      fall back to the cited-path heuristic and **label which source was
      used**. Conservative direction is the one the set contract already
      states: overlap resolves toward serial.
      verify (discharged): `computeOverlaps` is pure over two in-test maps and asserted three ways (a pair with its `cited-path` label, a `pre-scan` label, and an empty result on disjoint sets); `probe wiring` and `registerOwnedPaths` assert the full path through `probe()` over a temp roadmap tree and an injected `gh` response. **No assertion anywhere names a live PR number** — the whole suite runs offline, which is the D1b property. On the "no second derivation" clause: the loop's § 3d set is model-derived and exists nowhere on disk, so the reuse is real only once it is published — `registerOwnedPaths` reads `owned_paths` off the live session records (§ 3.1), an explicit `--owned-paths <file.json>` outranks it, and only when neither answers does the labelled `cited-path` fallback run. Sensitivity proven: removing the `?? fromRegister.get(r.slug)` fallthrough reds the pre-scan-outranks-heuristic case.

## Phase 4 — Authoring declares its relations

**Exit criteria:** `relates:` is a documented field, newly authored non-draft
roadmaps carry it, and `/roadmap:create` fills it from probe hits.
**Rollback:** remove the gate check; the field degrades to optional metadata.

- [x] **4.1 Add `relates:` to the template beside `depends:`** (rule 18): a
      list of `{slug, relation: extends|supersedes|depends|disjoint, note}`.
      `depends` entries mirror into `depends:` so the set-contract edge source
      stays the one already defined at `roadmap-process-loop.md:318`.
      verify (discharged): the field is present on THIS roadmap's own frontmatter (two `disjoint` rows for `road-to-merge-hotspot-drawdown` and `road-to-team-context`), and `./scripts-run src/scripts/lint_roadmap_complexity --quiet` → exit 0, `2 lightweight · 13 structural · 0 untagged · 15 total`. The `relation: maybe` fixture reds with the exact message `unknown relates[].relation 'maybe' — allowed: extends | supersedes | depends | disjoint (templates/roadmaps.md rule 18)`; six cases in `tests/scripts/lint_roadmap_complexity.test.ts` (22 passed). Two checks the step did not ask for but rule 18's own text requires: a `relates:` block with rows but no `relation:` key reds, and a `relation: depends` row that does **not** mirror into `depends:` reds — otherwise `relates:` becomes a second dependency source and the set contract has two. Sensitivity proven: removing the `_check_relates(fm, problems)` call turned **3 tests red** (`expected [] to deeply equal [ Array(1) ]`); restored from a `cp` backup, green at 22/22. **Drift:** the step's own `relates: []` example is honest only with the probe's `scanned:` line attached, so the template requires it and the linter accepts the inline-empty form.
- [x] **4.2 New non-draft roadmaps require the block, ratcheted not
      retroactive.** A `relates:` block — an explicit `relates: []` carrying
      the probe's `scanned:` line as justification counts — is required for
      files added or edited after the check lands. The 22 existing roadmaps
      are held at their measured state, the ratchet pattern the blocker linter
      already uses.
      verify (discharged): `./scripts-run src/scripts/check_roadmap_trackable` → exit 0, `✅ 9 active roadmap(s)` + `✅ check_roadmap_trackable:relates: 9 violation(s) at baseline, age 0d`. The RED state was observed first, before the baseline existed: `❌ check_roadmap_trackable:relates: 9 violation(s) and no recorded baseline`, naming all nine files. Ratchet recorded in `src/config/gate-violation-baselines.json` (`count: 9`, `landed: 2026-08-23`) using the existing `checkRatchet` helper — **not** a new baseline file, so no new suppression gate is introduced. Four end-to-end cases in `tests/scripts/check_roadmap_trackable.test.ts` run the real CLI over fixture trees: 9-without → green at baseline, **10-without → exit 1 with `10 violation(s) against a baseline of 9`**, 9-without + 3-with → green, and `declares_relates` is presence-only. Sensitivity proven: hardcoding `no_relates` to `[]` turned 2 tests red (`expected +0 to be 1`); restored, 12/12. **Drift from the step's premise:** the population is **9 active non-draft**, not 22 — the tree carries 15 active roadmaps of which 6 are `status: draft`, and the drafted figure was measured before that. The baseline is therefore 9.
- [~] **4.3 Retro-tag the 22 existing roadmaps with `relates: []`.** <!-- deferred: an estate-wide write across 22 tracked files; owner-reserved, and no analysis exists to invent edges -->
      Held deferred deliberately: this is a write over the whole active estate
      and produces no evidence, so it waits for an explicit go rather than
      riding an autonomous run.
      verify: when taken up — a frontmatter grep for `relates:` across the active set reports zero files missing it.
- [x] **4.4 `/roadmap:create` fills the table from the probe's hits**, one
      numbered-options question per hit (extends / supersedes / depends /
      disjoint). Zero hits → `relates: []` written silently with the probe's
      `scanned:` line as the justification.
      verify (discharged): **the step names a harness that does not exist** — there is no create eval, and `tests/eval/` carries only `corpus-dev.yaml`, `corpus-non-dev.yaml`, `trigger-coverage.yaml`, `nudge-interference/`, `orchestration-matrix/`, `routing-matrix/`. Substituted a deterministic mechanism for a model-in-the-loop one, which is a stronger discharge and not a weaker one: `relatesRowsFromHits` / `emptyRelatesBlock` in `roadmap_context.ts` render the block, `--relates` prints it ready to paste, and four cases assert exactly the step's two fixtures — one sibling hit produces `- slug: road-to-sibling` with its relation, and zero hits produces `relates: []   # scanned: 716 roadmap file(s), 0 sibling hits`. A fourth case round-trips the emitted block through `_check_relates` so the emitter cannot drift from the validator. One deliberate design call the step left open: the **relation is never inferred** — `extends` and `supersedes` rest on identical lexical evidence and are opposite decisions, so an unanswered hit is emitted with an `UNANSWERED` note rather than guessed or silently dropped. `/roadmap:create` § 0b carries the numbered-options obligation and the silent zero-hit path.

## Phase 5 — Mid-run refresh and enumerated reactions

**Exit criteria:** a cadence setting exists, the loop carries a closed reaction
table, `superseded` is a named terminal outcome, and the resume checkpoint
carries a repository fingerprint. **Rollback:** set the cadence default to
`off`; the reaction table degrades to documentation.

- [x] **5.1 `roadmap.context_refresh_cadence` setting** — `phase_boundary` |
      `every_5_steps` | `per_step`, default `phase_boundary`, read once per run
      exactly like `dashboard_regen_cadence` (`roadmap-process-loop.md:405-418`).
      At each due point: a pruning fetch plus `roadmap:context --roadmap <slug>`.
      verify (discharged) — **RE-SCOPED, and this is the substantive finding of the phase.** The key was implemented exactly as specified (template + Zod `regenCadence` + an enum test asserting the three values and rejecting a fourth) and all three went green. `lint_settings_classes` then **refused it**: `docs/contracts/settings-classes.md` classifies every settings leaf on a second axis answering *should this key exist at all*, the honest classification is `derivable` ("the mechanism itself can decide, from the situation, better than a flag can"), and that label carries an anti-regrowth ratchet — `❌ lint_settings_classes:derivable-surface: 84 violation(s) against a baseline of 83 — 1 new. Raising the baseline is a defect, not a fix.` The gate's own source (`lint_settings_classes.ts:510-514`) states it outright: *"a NEW key classified `derivable` is a key that should not have been added."* Mechanism-match was run first and the lock **applies** — the ratchet tested new derivable keys and this is one. **The AI council was convened** (`--confirm --invocation agent`) and returned an **honest null**: `0/2 present, needed 1 — INCONCLUSIVE`, both members `cli_quota_exhausted` (anthropic 53/50, openai 50/50), $0.0000. Resolved on the tree's deterministic evidence and recorded in `agents/evidence/analysis/situational-awareness-cadence-key-decision.md` with the four options and why three were rejected — including classifying the key `consent`/`policy` to dodge the ratchet, rejected as dishonest on the contract's own warning. **What shipped instead:** the key was reverted in full (template, Zod, contract rows and totals, enum test — `lint_settings_classes` back to `✅ 136 settings key(s) classified — A=26 B=3 C=107`) and replaced by a derived trigger. `contextFingerprint()` digests the `origin/main` SHA **plus every open PR's head SHA**, exposed as `agent-config roadmap:context --fingerprint` (live output `ac612ab43f8f0892`); loop § 4 documents the comparison under `### Context refresh — a comparison, not a third cadence key`. `origin/main` alone was rejected as the trigger because it **under-fires**: a peer pushing to their own PR branch mid-run can add an overlapping file without `main` moving — pinned by the test `moves when a peer pushes to its OWN PR branch and origin/main did NOT move`, and proven sensitive by dropping the head SHAs from the digest (`expected 'c7294a816e3f0e6d' not to be 'c7294a816e3f0e6d'`). Seven cases total, 36 passing in `tests/scripts/roadmap_context.test.ts`. The honest-null path changes shape with it: "default drops to `off`" becomes "revert the § 4 subsection", the same reversibility.
- [x] **5.2 Reaction table in the loop — enumerated and closed.** Keep the
      enumerated form the source already had; do **not** introduce a
      drift-level taxonomy.
      (a) A PR touching my owned paths **merged** since the last refresh → run
      `sync_pr_branch` now (already the documented resolution, only push-bound
      today), re-read the current step's files, continue.
      (b) An **open** PR touches my owned paths → continue; name the collision
      in the PR description and the final report; never rebase onto a foreign
      branch.
      (c) A peer session shows `PATH OVERLAP` → take disjoint steps first if
      ordering allows; otherwise name it and continue — the register is
      advisory.
      (d) The roadmap itself was archived on `origin/main` → stop; the same
      selection error as 2.1, detected late.
      verify (discharged): `### 5e. Context refresh — four reactions, enumerated and closed` at `roadmap-process-loop.md:699`, carrying exactly the four rows (a) merged-PR → `sync_pr_branch` + re-read + continue, (b) open PR → continue and name it, never rebase onto a foreign branch, (c) `PATH OVERLAP` → disjoint steps first, register is advisory, (d) archived on `origin/main` → stop as the same **selection error** as § 1. No drift-level taxonomy, as the step insists. The forbidden-non-halt-reasons block is **byte-identical to `origin/main`**, verified by section-scoped diff rather than by a line number: `git show origin/main:… | awk '/^### Forbidden non-halt/{f=1} /^### Non-halt — gating/{f=0} f'` against the same slice of the working tree → `FORBIDDEN_REASONS_BYTE_IDENTICAL`. **Drift:** the step cites `:738`, which was the line at drafting time; the anchors moved as the file grew, which is exactly why a byte-comparison of the whole section is the stronger check.
- [~] **5.3 Reaction (e): mark a step the tree already closed.** <!-- deferred: an autonomous run writing a completion marker into the source of truth touches roadmap-progress-sync Iron Law 3; owner-reserved -->
      When a merged PR or an `origin/main` commit has already satisfied the
      current step — the step's own `verify:` passes against `origin/main`, or
      the PR body names the step — mark it done with
      `<!-- superseded-by: #N -->` and record a decision memo. Held deferred
      deliberately: the memo and the one-strike kill criterion below are
      already specified, but an autonomous run writing a completion marker
      into the source of truth is not a mechanism to switch on unasked.
      verify: when taken up — a fixture where `origin/main` satisfies the step produces exactly one `superseded-by` marker and one memo file, and a fixture where it does not produces neither.
- [x] **5.4 Name `superseded` as a terminal outcome, not a halt.** It belongs
      under `## Terminal outcomes` (`roadmap-process-loop.md:665`), which today
      has no class for it, and **not** in the halt list — `:730` calls that
      list exhaustive and `:738` forbids "let the open PRs merge first", so a
      run meeting this case currently has no legal move.
      verify (discharged): `grep -n "superseded"` → three hits, at `:770`, `:773`, `:784`, and a section-scoped awk pass reports `TERMINAL_HIT` for all three with **zero** `HALT_SECTION_HIT` and zero `FORBIDDEN_SECTION_HIT`. The halt list is byte-identical to `origin/main` (`HALT_LIST_BYTE_IDENTICAL`, section-scoped diff as above). The outcomes table went from three rows to four; the new row reports which steps the tree already satisfies with the PR number and per-step evidence. It is deliberately a **report and not a licence to flip anything** — the marker-writing mechanism is step 5.3, held deferred, and the prose says so in place, so the two cannot be conflated by a later reader.
- [x] **5.5 Never mark stale work complete just because it disappeared.**
      Harvested from the dropped draft. A step whose artefact has vanished from
      the tree resolves to `unverified` — surfaced in the report, never marked
      done. Absence of the file is absence of evidence, not evidence of
      completion.
      verify (discharged): `staleArtefactVerdict(root, ['src/scripts/present.ts', 'src/scripts/gone.ts'])` → `{ verdict: 'unverified', absent: ['src/scripts/gone.ts'] }` — the literal string, plus the missing path named. Five cases in `tests/scripts/roadmap_context.test.ts`: one missing path is enough (**not** a ratio and not a majority), all-present is `present`, and a step citing **no** paths is `present` because nothing to check is not a doubt — otherwise this would fire on every prose step. The zero-flips half is the loop rule, new § 5 step **4b**, which runs *before* the atomic flip and states which glyph is wrong and why: not `[x]` (evidence uncheckable), not `[-]` (nobody decided to skip), not `[~]` (nobody deferred) — the box stays open and the report carries the reason. Sensitivity proven: hardcoding the verdict to `'present'` turned 2 tests red (`expected 'present' to be 'unverified'`).
- [x] **5.6 Bind the context baseline to the resume checkpoint.** Harvested
      from the dropped draft. `verifyCheckpoint`
      (`roadmap-process-loop.md:608-637`) reports **roadmap** drift and is
      silent on **repository** drift, so a run resumed after a long gap trusts
      a context reading it never re-took. Write the probe's fingerprint into
      `agents/runtime/state/checkpoints/<run>.json` and force a re-probe when
      it differs.
      verify (discharged): `buildCheckpoint(..., { contextFingerprint: 'abc123' })` writes `"context_fingerprint": "abc123"` into the checkpoint JSON, asserted by re-reading the file off disk rather than the in-memory object. `verifyCheckpoint(r, cp, 'fp-now-different')` reports the field with `claimed`, `actual` and `agrees: false`, and `res.agrees` is `false` — which is what forces the re-probe the loop's § 5d prose now mandates before the first step. Five cases, 49 passing in `tests/scripts/run_checkpoint.test.ts`. Two design calls the step left open, both made the conservative way and both pinned: the field is **absent, not null**, when no probe was taken (a pre-field checkpoint and a probe-less run are the same state and both must read as *not known*), and an unknown on **either** side is never a disagreement — the same rule `head` already follows, because a false alarm on the field whose job is to say whether anything moved trains the reader to skip the line. Sensitivity proven twice: forcing `agrees: true` reds the mutated case, and writing `?? null` instead of omitting reds the absent-vs-null case. **One mechanism serves 5.1 and 5.6** — the checkpoint's fingerprint is the same `contextFingerprint()` value the phase-boundary comparison uses.

## Phase 6 — Hygiene caught on the way

**Exit criteria:** the loop's declared size budget is consistent with the file,
and the `--all` ordering divergence is either recorded as intentional or
retracted. **Rollback:** both are single-line prose reverts.

- [ ] **6.1 Reconcile the loop's size-budget line with reality.**
      `roadmap-process-loop.md:11` declares `Size budget: ≤ 4,000 chars`; the
      file is 47,115 bytes. 11.8× is not a typo, it is a dead budget. Either
      split the long sections into a referenced context doc, or restate the
      budget with the measured number and say why it moved.
      verify: a one-line check — the declared budget on `:11`, if any, is greater than or equal to the file's byte count.
- [ ] **6.2 Record the `--all` ordering divergence as intentional, or pull
      the ranking.** `corrected-from-reproduction`: `--all` already states its
      reason ("because they convert soonest") and cites `next`'s live-screen
      rule in the same block, so the step is a recorded exception clause
      naming `next`'s severity-first doctrine — not a bug fix.
      verify: `process-full/command.md` § 2 either names `next`'s ranking doctrine as an explicit exception with its reason, or no longer orders by progress at all.

## Pre-registered measurement (ADR-054)

Recorded on `origin/main` at a pinned commit before Phase 2 merges:

- **M1** — active roadmaps whose slug appears in an open PR titled
  `roadmap: complete`. Baseline **2/22** at `f6703b78a`; the same figure was
  **4/24** at `33d7f74af`, six days earlier. Record both — the decay rate is
  the measurement that matters.
- **M2** — `(active roadmap, open PR)` pairs with file overlap under the
  cited-path heuristic. Baseline: 4 pairs at `f6703b78a` (#1546 against
  `road-to-org-pack-fitness`, `road-to-standing-payload-diet`,
  `road-to-council-seat-selection`, `road-to-skill-delivery-over-mcp`).
- **M3** — over the next 10 `process-*` runs after Phase 5 lands: count of
  `superseded-by` markers and count of PRs opening `CONFLICTING` at first push.

**Honest-null path:** if M3 shows no reduction in `CONFLICTING`-at-first-push
over 10 runs, the Phase 5 cadence default drops to `off` and the reaction table
stays as documentation. The probe (Phase 1) and the relation table (Phase 4) are
kept regardless — they produce evidence rather than claim a net win.

**Kill criterion:** one wrong `superseded-by` marker — a step marked done whose
work was not on `origin/main` — removes reaction (e) permanently and returns
that case to the ambiguity halt.

## Blockers

None at authoring time. The two `[~]` items (4.3, 5.3) carry owner-reserved
decisions in their deferral annotations rather than as blocker entries, because
neither blocks another step in this roadmap: 4.3 is an estate-wide write with
no dependants, and 5.3 is one reaction row inside a table whose other four rows
land without it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: analyze-inbox -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Probe invocation is skipped | implementation | The probe is deterministic but its invocation is model-carried; a run that never calls it is today's run | The call site is the first instruction of loop § 1 and of create step 0b, not an aside; 1.3 states the boundary in the script header; M1 and M2 are re-measured per release | Phase 2 — Wire the probe into every entry point |
| 2 | A wrong `superseded` marker | implementation | Reaction (e) could mark a step done off a PR body that overstated its scope | Deferred as 5.3 rather than shipped; when taken up, the marker needs the step's own `verify:` green against `origin/main`, a memo, and the one-strike kill criterion | Phase 5 — Mid-run refresh and enumerated reactions |
| 3 | `relates: []` written by reflex | product | Authors satisfy 4.2 with an empty list and a boilerplate note, so the field carries no information | The empty list requires the probe's `scanned:` line as justification, and 4.4 fills the table from hits automatically so the empty case is genuinely empty | Phase 4 — Authoring declares its relations |
| 4 | Refresh cost on long runs | implementation | A fetch plus a probe at every phase boundary adds latency and tokens to every autonomous run | Default cadence is `phase_boundary`, the report is one compact table, and the honest-null path demotes it to `off` | Phase 5 — Mid-run refresh and enumerated reactions |
| 5 | The cited-path heuristic over-reports | implementation | Backtick paths in roadmap prose include examples and files the roadmap does not own | The heuristic runs only where no pre-scan set exists and is labelled as the fallback; the conservative direction is serial execution, never a skip | Phase 3 — Overlap on paths, not on slugs |
| 6 | Fixture-pinned overlap assertions rot | implementation | A frozen PR fixture stops resembling the real remote, and 3.3 passes over a shape that no longer occurs | The fixture pins the *shape*, and M1 and M2 re-measure the live population per release, so a divergence between the two is itself the signal | Phase 3 — Overlap on paths, not on slugs |

## Acceptance Criteria

- [ ] AC-1 — `roadmap:context` exists as one script, is reachable from all five
      `/roadmap:*` entry points, and no entry point still carries a
      hand-written screen block.
- [ ] AC-2 — A roadmap already closed in an open PR on `origin/main` cannot be
      started by any `process-*` wrapper; the run reports the PR number and
      exits as a selection error.
- [ ] AC-3 — `sessions:list` distinguishes slug, branch, and path collisions as
      three separately labelled lines.
- [ ] AC-4 — A newly added non-draft roadmap without a `relates:` block reds
      `check_roadmap_trackable`; the 22 pre-existing files stay green.
- [ ] AC-5 — The loop's halt list is byte-unchanged, and `superseded` appears
      only as a terminal outcome with a memo, counted in the run report.
- [ ] AC-6 — The probe's file-overlap output is asserted against a committed
      fixture, so no acceptance check depends on a live PR number.
- [ ] AC-7 — M1, M2, and M3 are recorded under `agents/evidence/analysis/` with
      the pinned commit, including the null outcome if that is what occurs.
