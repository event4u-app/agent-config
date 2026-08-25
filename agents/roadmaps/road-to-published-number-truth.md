---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-24
relates: []
# relates: `agent-config roadmap:context --roadmap published-number-truth --relates`
# returned two UNANSWERED probe hits, both resolved by reading them:
#   - road-to-published-number-truth  -> the file itself, not a sibling.
#   - archive/road-to-number-truth    -> the PRIOR disposition on this exact
#     defect class (2026-07-25, 19/19 closed). It is not a live relation to
#     declare; it is this roadmap's § Prior disposition. Recorded there instead
#     of as a `relates:` row, because a closed archive entry is evidence, not
#     coordination surface.
estate_growth_exempt: "Charges +0 on the COUNT half (that half is status-scoped and this file is draft) and +1 on one-in-one-out, which is file-based and fires whatever the status. Warranted on measurement, not appetite: six numbers this package publishes were re-derived at HEAD b15b63d38 on 2026-08-24 and three are wrong, while the gate written in July to stop exactly this -- the check_claims witness sweep -- is verified present and verified unable to see any of them. No open roadmap carries a numeric-claim or instrumentation item; grepped across all twelve."
estate_offset_exempt: "No archive move is available in this change. The addition is the smaller half of a reduction: a 4,154-line review yielded two roadmaps, and nine of its claims were verified dead and recorded as prevented rather than becoming work."
---
# Road to published-number truth — the witness sweep watches the right file and the wrong shapes

> **Source:** `agents/tmp.old/hard-feedback-1/chat.txt` (2026-08-24), the
> Claude half's §1 hygiene list and the ChatGPT half's P0.4/P0.5/P0.6. Every
> figure below was re-derived at HEAD `b15b63d38` rather than taken from the
> review: four of the review's own numeric claims did not survive that pass and
> are recorded as prevented items in Phase 0.

## Goal

Every count this package publishes about itself is either produced from the
tree or watched by a gate that can see the shape it is written in, and the one
telemetry file the retirement and tiering decisions rest on is either writing
again or recorded as dead with the decisions that depend on it re-anchored.
Finished means: the three wrong numbers are right, the two shapes that carried
them are inside the witness sweep with a negative fixture each, `skill-usage.jsonl`
has a verdict, and every count the package publishes carries a stated definition.

## Prior disposition — this defect class was closed once, and the close was scoped to one noun

`agents/roadmaps/archive/road-to-number-truth.md` (2026-07-25, 19/19 steps
closed) found *"three numbers AC ships today are wrong"* and diagnosed the
shared cause as *"the ledger checks that a pointer exists, never that its number
is true."* It landed the fix: `check_claims.ts:67-110` now carries a witness
sweep over `WITNESS_SURFACES = ['README.md', 'CAPABILITIES.yaml']` with three
figure classes, and its own comment names the motivating instance — *"the README
shipped 'compiled into 7+ host agents' while the real, test-pinned number was
23 detected / 20 emitted"*.

The mechanism is real, it is bound, and it is on the right file. What it cannot
do is see the shapes the remaining counts are written in:

```js
const SELF_COUNT = /\b\d+\+?\s+(?:host agents?|hosts|supported (?:agents?|hosts))\b/i;
```

`host agents` was the instance. Skills, commands, rules, guidelines, personas,
advisors and scripts are the population, and none of them is in the noun set.
Per [`downstream-changes`](../../src/rules/downstream-changes.md)
§ Defect-pattern search, a defect found in one place is presumed to recur until
searched; the July round fixed the instance and did not sweep the population.
That is the finding, and it is why this roadmap is not a second list of wrong
numbers.

## Context — measured 2026-08-24 at HEAD `b15b63d38`, every figure re-derived

**Ground truth, from the tree:**

| Artefact | Command | Count |
|---|---|---|
| skills | `ls -d dist/agent-src/skills/*/ \| wc -l` | 299 |
| rules | `ls src/rules/*.md \| wc -l` | 120 |
| commands | `find dist/agent-src/commands -name '*.md' \| wc -l` | 202 |
| guidelines | `find docs/guidelines -name '*.md' \| wc -l` | 112 |
| personas | `ls dist/agent-src/personas/*.md \| wc -l` | **30** |
| advisors | `ls dist/agent-src/personas/advisors/*.md \| wc -l` | 5 |
| python in `src/` | `find src -name '*.py' \| wc -l` | **0** |

**The defects:**

| # | Defect | Evidence |
|---|---|---|
| **D1** | `README.md:7` ships `badge/Personas-29`; the tree has 30. The other five badges are correct. | badge URL vs `ls dist/agent-src/personas/*.md` |
| **D2** | `README.md:327` claims the Worker *"does not execute the ~112 Python scripts"* and `README.md:600` states the stack is *"**TypeScript** CLI/UI + **Python 3.10+** build/lint scripts"*. `src/` contains zero `.py` files, `.github/workflows/no-python-in-src.yml` enforces that permanently, and `README.md:606` says *"No Python anywhere on the install path"* — the file contradicts itself six lines later. | three README lines + the workflow + the `find` |
| **D3** | `README.md:89` links `<a href="MIGRATION.md">Upgrade to 6.0</a>` at published version 14.11.0. | `sed -n '89p' README.md`; `npm view @event4u/agent-config version` → 14.11.0 |
| **D4** | The witness sweep cannot see either carrier shape. `SELF_COUNT` is noun-adjacent and space-separated, so `badge/Skills-299` (hyphen-joined, inside a URL) and `112 Python scripts` (qualifier between the digit and the noun) both pass. `MAGNITUDE`'s unit list is `tokens\|ms\|USD\|KB\|MB\|GB\|chars` and matches neither. | `check_claims.ts:105-107`; grep for the noun-adjacent form in `README.md` returns **zero** lines — every published count lives in a shape the gate is blind to |
| **D5** | `agents/runtime/metrics/skill-usage.jsonl` was last written **2026-05-16**, 181 lines, final record `ts: 2026-05-15T13:44:17.594Z` — 100 days dead. `compute_skill_tiers.ts:18-22` documents the consequence in its own words: the common case is `fallback: "alphabetical"` and a verdict from it *"is therefore a PREDICTION, not a measurement."* | `ls -la` + `tail -1` + the source comment |
| **D6** | `ONBOARDING.md` carries **37** lines containing `/Users/mathiasberg`. `check_bundle_path_leakage.ts` (landed 2026-08-24 13:24, `0dbf252de`) scans `PUBLISHED_MD_ROOTS` plus eight named files; `ONBOARDING.md` is in neither list, and it is absent from `package.json:files[]`, so the gate is correctly scoped to the npm payload and structurally cannot reach a file that is tracked and public on GitHub but not shipped. | `grep -c` + `check_bundle_path_leakage.ts:118-141` + `files[]` |
| **D7** | No published definition exists for any count. Two analyses of this tree on the same day reported **202** and **102** commands. Both are arithmetically defensible: `dist/agent-src/commands` holds 61 top-level `.md` files and 41 subdirectories, 202 `.md` recursively. Nothing states which the badge means. | `ls`/`find` split above |

**Prevented items — claims from the review that did not survive re-derivation.**
Recorded rather than dropped, because three of them would each have become a
phase:

| Review claim | Verdict at HEAD |
|---|---|
| *"Badges behaupten Skills-279 / Commands-190 / Rules-107"* | **never-true.** They read 299 / 202 / 120 and all three match the tree. Only `Personas-29` is wrong (D1). |
| *"GitHub-Releases zeigt 9.7.0 … der Release-Kanal hängt fünf Majors hinterher"* | **already-fixed.** `gh repo view --json latestRelease` → `14.11.0`, equal to npm. | <!-- md-language-check: ignore -->
| *"Der Header 'Universal AI Agent OS' kollidiert mit 'It is not an agent runtime'"* | **not-in-tree.** Neither string occurs in `README.md`. |
| *"Preamble Payload 138.212 / Ziel 107.646"* and the three sibling gate rows | **already-open, verbatim.** The four-row table is `road-to-standing-payload-truth.md:31-34`, an active roadmap at `status: ready` with 15 open steps, landed earlier the same day. Its AC-7 already owns the gap between that 138,212 and the 102,520 recorded in `src/config/preamble-payload-budget.json`. Nothing is added here. |

## Phase 0 — pin the population before touching a number

- [ ] **0.1 Enumerate every self-count this package publishes, with its carrier shape.**
      D7 says no definition exists; this produces the list that a definition can
      be written against. Cover `README.md`, `CAPABILITIES.yaml`, `docs/comparison.yaml`
      and the badge block, and record for each: the noun, the number, the shape
      it is written in, and whether `is_quantified_claim()` returns true for its line.
      verify: `./scripts-run src/scripts/check_claims --json` plus a committed
      table under `agents/evidence/analysis/`; every row carries a `file:line`
      and a boolean, and the count of `false` rows is stated.

- [ ] **0.2 Decide the counting basis for `commands`, and only then touch the badge.**
      61 top-level versus 202 recursive is not a wrong number, it is an
      undeclared one. Pick the basis the badge means, state it where a reader
      meets the badge, and leave the other number correct-but-unpublished.
      verify: the chosen basis appears next to the badge or in the file the badge
      links to, and re-running the two commands reproduces the published figure
      exactly.

## Phase 1 — the three wrong numbers

- [ ] **1.1 Correct `badge/Personas-29` to the measured count.**
      verify: `ls dist/agent-src/personas/*.md | wc -l` equals the badge integer.

- [ ] **1.2 Remove the two Python claims from `README.md:327` and `:600`.**
      `src/` has no Python, a workflow enforces it, and `:606` already states the
      truth — so this is deleting a contradiction, not choosing between two
      readings.
      verify: `grep -in python README.md` returns only the line that says there
      is none, and `find src -name '*.py' | wc -l` is still 0.

- [ ] **1.3 Correct the `Upgrade to 6.0` link text at `README.md:89`.**
      verify: the anchor text names the current major, matched against
      `npm view @event4u/agent-config version` in the same check.

## Phase 2 — widen the witness sweep to the population, not the instance

- [ ] **2.1 Extend `SELF_COUNT` to the package's own artefact nouns.**
      Add skills, commands, rules, guidelines, personas, advisors, packs,
      profiles, ADRs, contexts and scripts. Extend rather than add a second
      pattern: the sweep, the surfaces and the allow path already exist, and a
      sibling gate would trip three ratchets for nothing.
      verify: `is_quantified_claim('299 skills')` is true; the existing green
      corpus stays green (`./scripts-run src/scripts/check_claims`).

- [ ] **2.2 Teach the sweep the two shapes that actually carry the counts.**
      A qualified noun (`112 Python scripts`) and a badge URL
      (`badge/Skills-299`). Both are how this package writes its counts today,
      and neither is a hypothetical: D1 and D2 are live instances of exactly
      these two shapes.
      verify: both live strings match; a negative fixture proves a year
      (`in 2026`), an ordinal and a version string still do not.

- [ ] **2.3 Sabotage the widened pattern before believing it.**
      Set one badge to a wrong integer, confirm the gate reds, restore it.
      A pattern never seen fail has unknown sensitivity.
      verify: the deliberate wrong value produces a non-zero exit naming the
      line; after restore the gate is green. Record both outputs.

- [ ] **2.4 Bind each published count to a tree-derived witness.**
      A gate that only notices unmarkered numbers still cannot tell 29 from 30.
      Each count gets a claim entry whose pointer re-derives it from the tree.
      verify: `CI=true ./scripts-run src/scripts/check_claims` re-runs the
      pointers and a hand-broken count fails it.

## Phase 3 — the dead instrument

- [ ] **3.1 Establish why `skill-usage.jsonl` stopped, before proposing a repair.**
      100 days without a write is a mechanism failure, not a configuration
      preference; the write path is what has to be read first. Name the writer,
      the slot it is bound in, and whether it is bound on this host at all.
      verify: `agent-config hooks:status` output plus the writer's `file:line`,
      and a reproduction that shows the write either firing or not firing.

- [ ] **3.2 Repair the writer, or record the instrument dead and re-anchor what depends on it.**
      Both are real outcomes. What is not acceptable is a third turn of
      `compute_skill_tiers` publishing a prediction that reads like a measurement.
      verify: either a fresh record appears in the file during a probe session,
      or `compute_skill_tiers.ts` states the fallback at its output boundary and
      `road-to-skill-estate-drawdown` step 1.2 records `none` for every signal
      that depended on it.

- [ ] **3.3 State the capture rate wherever a tier or a retirement verdict is published.**
      verify: a tier listing produced with the fallback active prints the
      fallback name; grep the output for it.

## Phase 4 — the file the payload gate cannot reach

- [ ] **4.1 Rewrite the 37 absolute paths in `ONBOARDING.md` to relative or masked form.**
      verify: `grep -c '/Users/' ONBOARDING.md` is 0, or every survivor sits on
      the audited allow path with a reason.

- [ ] **4.2 Decide whether the leakage gate's scope is `files[]` or `tracked-and-public`, and record the choice.**
      The current scope is defensible — it guards the npm payload — but it was
      derived from `files[]` rather than chosen, and D6 is the gap that produces.
      Widening it is one entry in `PUBLISHED_MD_FILES`; not widening it is a
      recorded decision about what the gate is for.
      verify: either `ONBOARDING.md` appears in `PUBLISHED_MD_FILES` and the gate
      runs green over it, or the scope decision is written in the gate's own
      module docstring naming the tracked-but-unshipped class it excludes.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The widened pattern floods and gets bypassed | implementation | `check_claims.ts:93-100` records that widening to `docs/benchmark.md` would match 54 lines and teach the maintainer to ignore the gate. Adding eleven nouns risks the same on the surfaces already swept. | 2.1 keeps the surface list fixed and widens only the noun set; 2.2's negative fixture pins years, ordinals and versions as non-matches; if the green corpus reds on a legitimate line the noun comes back out rather than the surface gaining an allow entry. | Phase 2 — widen the witness sweep |
| 2 | `skill-usage.jsonl` cannot be repaired on this host | implementation | The writer may be bound in a slot this host does not carry, in which case 3.2's repair branch is unreachable and the roadmap stalls on a step nobody can close. | 3.2 ships two accepted outcomes and the dead-instrument branch is fully specified; 3.1 establishes bindability before any repair is attempted, so the stall is detected in the first step rather than the second. | Phase 3 — the dead instrument |
| 3 | Correcting the counts drifts them again by next release | implementation | Phase 1 fixes three integers by hand; nothing stops the fourth from drifting a week later, which is exactly how the July round's fix decayed into this one. | 2.4 binds each count to a re-derived pointer, so the next drift fails CI instead of shipping; Phase 1 is deliberately ordered before Phase 2 only so the gate lands green rather than red on arrival. | Phase 2 — widen the witness sweep |
| 4 | Phase 4 duplicates an active roadmap's scope | product | `road-to-inbox-harvest-2026-08-e-command-surface-legibility` Phase 0 authored the leakage gate; a scope change to that gate could collide with its open steps. | 4.2 changes a constant list and a docstring, not the gate's mechanism; that roadmap's remaining six steps are checked for a `PUBLISHED_MD_*` touch before 4.2 starts, and if one exists this phase transfers there instead of duplicating. | Phase 4 — the file the payload gate cannot reach |
| 5 | The commands basis decision is the maintainer's, not the agent's | product | 0.2 picks a counting basis that becomes a published definition; that is a product statement about what a command is. | 0.2 produces the two measured numbers and a recommendation, and the choice is surfaced to the maintainer rather than taken; nothing downstream depends on which is picked, only on one being stated. | Phase 0 — pin the population |

## Acceptance Criteria

- [ ] **AC-1** — `badge/Personas-29`, the two Python claims and the `Upgrade to 6.0` link text are gone, each replaced by a value a command in this file reproduces.
- [ ] **AC-2** — `is_quantified_claim()` returns true for a badge-URL count and for a qualified-noun count, and a committed negative fixture proves it still returns false for a year, an ordinal and a semantic version.
- [ ] **AC-3** — the widened gate was observed red against a deliberately wrong badge integer, and both the red and the restored-green outputs are recorded.
- [ ] **AC-4** — every self-count enumerated in 0.1 either binds to a pointer that re-derives it or carries a written reason why it does not.
- [ ] **AC-5** — `skill-usage.jsonl` either received a record during a probe session, or is recorded dead with `compute_skill_tiers`'s fallback stated at its output boundary and the dependent estate-drawdown signal set to `none`.
- [ ] **AC-6** — `ONBOARDING.md` publishes no absolute home path, and the leakage gate's scope is either widened to reach it or documented as deliberately narrower with the excluded class named.
- [ ] **AC-7** — the `commands` badge carries a stated counting basis, and running that basis reproduces the published integer exactly.
