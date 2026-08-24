---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-24
estate_offset_exempt: "Landed by the /analyze:inbox run of 2026-08-24 from feedback-14.11.0 §10, §68, §69, §81 and §88. The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this change archives nothing to offset against. The addition is warranted on a measurement rather than on appetite: two payload gates are red at HEAD, one by +30,566 tokens, and neither can fail a pull request."
estate_growth_exempt: "Charges +1 active_roadmaps and +4 open_blockers. All four blockers are pre-existing defects this roadmap names for the first time rather than obligations it creates: a gate reachable only from a local meta-task no workflow invokes, a workflow that declines to fail on a premise about that gate, a budget file asserting a guard that classifies it as advisory, and a budget file asserting a gate key that does not exist. Filing them as countable blockers is the honest direction -- they were uncounted while being true."
---
# Road to standing-payload truth — two red gates that cannot fail a PR

> **Source:** `agents/tmp.old/feedback-14.11.0/chat.txt` §10 (*"Der Standing Payload
> ist aber noch immer deutlich zu groß"*), §68/§69 (packed size), §81 and §88. <!-- md-language-check: ignore -->

## Goal

The payload numbers this package publishes are the numbers a pull request is
actually measured against. Finished means: every payload gate that has a ceiling
runs somewhere that can fail a PR, every budget file's claim about what gates it
is true, and the two currently-red gates are either green or carry a dated,
measured plan that a missed milestone publishes rather than re-dates.

## Context — measured 2026-08-24 at HEAD, every figure re-derived

**Four gates, three red.** Run directly, source-audited first to confirm none
writes into the tracked tree:

| Gate | Metric | Live | Ceiling | State |
|---|---|---|---|---|
| `check_preamble_payload_budget` | per-spawn preamble: rules + skill catalog + CLAUDE.md | **138,212** | 107,646 | ❌ **+30,566** |
| `check_standing_rule_delivery` | delivered rule prose, both host layers, exact BPE | **123,176** | 110,000 | ❌ 112.0 % |
| `check_rule_activation_census` | unconditional rule tokens, exact BPE | 113,699 | re-anchor-with-reason | ratchet-by-reason |
| `check_always_budget` | always-rules extended, chars | 60,252 | 60,254 | ✅ by **2 characters** |

**The drift, against the schedule's own starting point.**
`preamble-payload-budget.json` records `measured_at_registration: 125,593` on
2026-08-15. Nine days later it measures **138,212** — **+12,619**. Its first
milestone is a *recovery* to 102,520 by 2026-11-10, which was 23,073 away at
registration and is **35,692** away now.

**The reviewer's ladder would be a weakening, and that is worth stating plainly.**
He proposes `136k → 120k → 110k`. The file already carries
`target_tokens: median 40,000 / p95 50,000` and a dated `target_schedule`
(102,520 by 2026-11-10 · 85,000 by 2027-02-10 · 60,000 by 2027-05-10). Every rung
of his ladder sits **above** every milestone that already exists. His *direction*
is right and his *numbers* are behind the tree — so this roadmap adopts the
existing schedule and treats his ask as satisfied by it.

## Why it drifted — a four-link chain, and the middle two are false claims

This is the part no gate reports, and it is the reason a red gate has been red
since at least registration without anyone being stopped.

**Link 1 — the gate runs only from a local meta-task.**
`check-preamble-payload` is wired at `Taskfile.yml:140`, inside the `ci:` task
(`Taskfile.yml:81`). That is a real wiring, and an earlier reading of this
finding said the gate was "referenced by nothing" — **that was wrong** and is
corrected here. What is true is narrower and worse: `skill-lint.yml:95` and
`:110` state in the repo's own words that these are *"the local `task ci` /
`ci-strict` meta-tasks, which no workflow invokes"*. So the gate is reachable,
locally, by a human who runs the whole chain.

**Link 2 — locally, the chain stops before reaching it.**
`check-condensed-paths` sits at `Taskfile.yml:105`, thirty-five entries ahead of
the preamble gate at `:140`. A red gate there ends the run.

**Link 3 — the one workflow that references the gate declines to fail, citing it.**
`.github/workflows/standing-payload-delta.yml:5-10` is deliberately a report and
not a gate, and its stated reason is
*"`check_preamble_payload_budget` already ratchets this number and already fails
on growth"*. That premise is exactly what links 1 and 2 refute. The same sentence
appears at `taskfiles/ci-fast.yml:820`.

**Link 4 — the budget file asserts a protection it does not have.**
`preamble-payload-budget.json` explains why it does not raise its baseline to meet
the measurement: *"raising a ratchet baseline to clear a failing check is the
config-weakening move this repo blocks by construction."* **False.**
`src/scripts/hooks/block_config_weakening.ts:93-97` classifies
`*-budget(s).{json,yml}` and `budgets.yml` as **`advisory`**, and `:28-32` says it
outright — *"No blocking on baselines or budgets."* The restraint is real and
commendable; the claim that a mechanism enforces it is not.

**Net: no CI check fails on preamble-payload growth**, and two of the four links
are claims in the tree that a reader would reasonably trust.

## A separate hole, same class — the built tarball is ungated

`src/config/pack-size-budget.json` justifies measuring with `--ignore-scripts`
(so `dist/cli`, `dist/ui`, `dist/mcp`, `dist/hooks` are absent) with this
sentence, verbatim:

> *"The built artifact is ~5.4 MB larger and is gated separately, at release time,
> by `evaluator-budgets.unpacked_size_mb`."*

`src/config/evaluator-budgets.json`'s `budgets` block holds six keys —
`node_modules_mb`, `runtime_dep_count`, `cli_version_cold_ms`,
`mcp_boot_to_initialize_ms`, `cli_help_command_count`, `mcp_public_tool_count`.
**`unpacked_size_mb` is not among them.**

So the surface a consumer actually installs is ungated, and the file that explains
the exclusion asserts the exclusion is covered. The consequence for §68/§69 is
concrete: the cap raises 6.4 → 6.9 → 7.8 → 8.4 → 9.2 were all measured against the
**unbuilt** tree, so the raise history understates the installed payload by
roughly 5.4 MB throughout.

## Phase 1 — make the two red gates reachable from CI

- [ ] **1.1 Decide and record where `check_preamble_payload_budget` runs in CI.**
      Not "add it everywhere": it is a per-spawn measurement, so a per-PR job is
      the natural home, and `standing-payload-delta.yml` already computes the
      delta beside it.
      verify: a workflow file names the gate, and `gh workflow view` (or the
      required-checks list) shows it on a PR.
- [ ] **1.2 Correct the two stale premises in the same change.** The
      declines-to-fail comment at `standing-payload-delta.yml:5-10` and its twin at
      `taskfiles/ci-fast.yml:820` both assert the gate fails on growth. Either make
      that true (1.1) or rewrite both sentences.
      verify: `grep -rn 'already fails on growth' .github/ taskfiles/` returns only
      occurrences whose premise now holds.
- [ ] **1.3 Correct the "blocks by construction" claim in
      `preamble-payload-budget.json`.** Replace it with what is true: the guard
      classifies budget files as advisory, so the restraint is a policy the
      maintainer keeps, not a mechanism that enforces it.
      verify: `grep -c 'blocks by construction' src/config/preamble-payload-budget.json`
      returns 0, and `block_config_weakening.ts:93-97` still classifies the file
      advisory (i.e. the fix is to the prose, not to the guard).
- [ ] **1.4 Answer `b-standing-delivery-red` in the file that raised it.** It is
      already answerable: the two-layer run prints no `overlap` line, and that line
      is emitted only when `overlap_rules > 0`
      (`check_standing_rule_delivery.ts:307`), so the two layers are disjoint and
      the 123,176 is real rather than a local-install artifact.
      verify: the blocker in `road-to-ten-across-the-board.md` reads
      `Status: resolved` with that reasoning recorded.

## Phase 2 — close the built-tarball hole

- [ ] **2.1 Either register `unpacked_size_mb` in `evaluator-budgets.json` or
      correct the sentence in `pack-size-budget.json`.** One of the two must
      change; today the pair is a contradiction.
      verify: a `python3 -c` assertion that the key named by
      `pack-size-budget.json`'s prose exists in `evaluator-budgets.json`, or that
      the prose no longer names it.
- [ ] **2.2 Measure the built delta once, and record it.** `evaluator_umbrella.sh`
      already measures the size (`consistency.yml:451` says plainly *"this is not a
      second gate on that number"*), so the measurement exists and only the
      recording is missing.
      verify: a committed figure for the built unpacked size, with the command that
      produced it.
- [ ] **2.3 Restate the cap history against the built surface.** The five raises
      were measured on the unbuilt tree; say so where the history is recorded, so
      the next reviewer is not comparing two different surfaces.
      verify: `pack-size-budget.json`'s baseline notes state which surface each
      figure covers.

## Phase 3 — close the ownership gap that let a cap raise cost one sentence

- [ ] **3.1 Bring `budgets.yml` into `lint_budget_ownership`'s corpus.** That gate
      scans `src/config/*budget*.json` — a `.json` filter
      (`lint_budget_ownership.ts:126-131`) — so `budgets.yml` escapes it entirely
      and its `standing_rule_delivery` entry carries no `owner` and no `review_by`.
      verify: `./scripts-run src/scripts/lint_budget_ownership` reports
      `budgets.yml` among the files it scanned, and fails if `owner` or `review_by`
      is absent.

## Blockers

### blocker: b-preamble-ci-placement

- **What:** Where a per-spawn preamble measurement belongs in CI is a real design
  question, not a wiring detail. It is measured per spawn, so a per-PR job
  measures one sample of a distribution.
- **Blocks:** 1.1, and therefore 1.2's first option.
- **What to do:** choose between (a) a required per-PR job running
  `./scripts-run src/scripts/check_preamble_payload_budget`, (b) folding it into
  the existing `standing-payload-delta.yml` and letting that workflow fail, or (c)
  a scheduled job on `main` with growth alerting only. Record the choice and its
  reason in `preamble-payload-budget.json`.
- **Owner:** maintainer.
- **Recommendation:** (b) — the workflow already computes the neighbouring number
  and already declines to fail on a premise this roadmap invalidates, so making it
  fail is the smallest change that removes the contradiction.
- **If you do nothing:** the gate stays reachable only from a local chain that
  stops thirty-five entries earlier, which is the state that produced +12,619 in
  nine days.
- **Resolved when:** one of the three options is recorded in
  `preamble-payload-budget.json` with its reason.
- **Status:** open.

### blocker: b-milestone-one-unreachable

- **What:** Milestone 1 is a recovery to 102,520 by 2026-11-10. It was 23,073 away
  at registration and is **35,692** away now. No mechanism in the tree is
  committed to closing that.
- **Blocks:** nothing technical. It blocks honest reporting: a schedule whose
  first rung recedes is a published number that misleads.
- **What to do:** apply the file's own `on_miss` clause — *"a missed milestone is
  PUBLISHED … and never silently re-dated"* — early rather than at the deadline,
  by recording the 138,212 measurement and the 12,619 drift against it now.
- **Owner:** maintainer.
- **Recommendation:** publish the drift now and leave the date; two consecutive
  misses is the file's own trigger for deciding the schedule was wrong, and
  pre-empting that trigger discards the signal.
- **If you do nothing:** the miss surfaces on 2026-11-10 with three months of
  unexplained drift behind it.
- **Resolved when:** `preamble-payload-budget.json` records the 2026-08-24
  measurement against milestone 1.
- **Status:** open.

### blocker: b-built-vs-tracked-surface

- **What:** `pack-size-budget.json` names `evaluator-budgets.unpacked_size_mb` as
  the gate for the built artifact; that key does not exist in
  `evaluator-budgets.json`.
- **Blocks:** 2.1 and 2.3.
- **What to do:** decide whether the built surface should be gated at all. If yes,
  add `unpacked_size_mb` to `evaluator-budgets.json` with a measured baseline from
  `evaluator_umbrella.sh`. If no, delete the sentence from
  `pack-size-budget.json` and say the built surface is deliberately ungated.
- **Owner:** maintainer.
- **Recommendation:** the second. A release-time gate on a number nothing has
  measured since 2026-08-04 is a gate that will be raised on first contact; an
  honest "deliberately ungated, here is the measurement" is worth more.
- **If you do nothing:** the pair stays contradictory and the cap history keeps
  understating the installed payload by ~5.4 MB.
- **Resolved when:** the key exists, or the sentence naming it does not.
- **Status:** open.

### blocker: b-budgets-yml-outside-ownership

- **What:** `lint_budget_ownership` filters on `.json`, so `budgets.yml` is outside
  its corpus and its `standing_rule_delivery` entry has no `owner` and no
  `review_by`.
- **Blocks:** 3.1.
- **What to do:** widen the filter to `.yml` / `.yaml` and add the two fields, or
  record why a YAML budget is deliberately exempt.
- **Owner:** maintainer.
- **Recommendation:** widen it. A budget without an owner is a budget nobody has to
  defend, and this is the one that gates the larger of the two red numbers.
- **If you do nothing:** a cap raise in `budgets.yml` costs one non-placeholder
  sentence and no evidence.
- **Resolved when:** `lint_budget_ownership` scans `budgets.yml`, or an exemption
  is recorded in that file.
- **Status:** open.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: analyze-inbox -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Wiring the gate into CI reds every PR immediately | implementation | The gate is +30,566 over its ceiling today, so making it blocking without a decision on the baseline stops all work. This is the same guaranteed-red shape that keeps `check_release_highlights` advisory. | `b-preamble-ci-placement` forces the choice explicitly, and option (c) exists precisely so growth-alerting is available without a hard block. | Phase 1 |
| 2 | The baseline is raised to clear the red instead of the payload shrinking | product | The cheapest way to make 1.1 green is a baseline raise, the guard is advisory, and the file's own prohibition turns out to be prose rather than a mechanism. | 1.3 replaces the false claim with the true one, so the next reader knows the restraint is a policy they can break and must choose not to. | Phase 1 |
| 3 | Correcting the prose is mistaken for fixing the gap | product | 1.2 and 1.3 both edit sentences. A run that lands only those has made the tree honest and changed no measurement. | AC-1 is the measured gate on a PR, not the corrected comments; the prose steps carry no AC of their own. | Phase 1 |
| 4 | The built-tarball measurement is taken once and rots | implementation | 2.2 records a figure with no ratchet behind it, which is how `unpacked_size_mb` disappeared in the first place. | `b-built-vs-tracked-surface` recommends the honest-ungated option precisely to avoid a third unmaintained number. | Phase 2 |
| 5 | The reviewer's ladder is adopted as the target | product | `136k → 120k → 110k` is above every existing milestone, so adopting it as written would be recorded as progress while relaxing the destination. | Context states the comparison explicitly and adopts the existing schedule. | Context |

## Acceptance Criteria

- [ ] **AC-1** — `check_preamble_payload_budget` runs in a CI job on a pull request, and the job's failure is visible in the checks list. A corrected comment does not satisfy this.
- [ ] **AC-2** — `grep -rn 'already fails on growth' .github/ taskfiles/` returns no occurrence whose premise is false.
- [ ] **AC-3** — `grep -c 'blocks by construction' src/config/preamble-payload-budget.json` returns 0.
- [ ] **AC-4** — the key `pack-size-budget.json`'s prose names either exists in `evaluator-budgets.json`, or is no longer named.
- [ ] **AC-5** — `lint_budget_ownership` reports `budgets.yml` in its scanned set, or that file records its exemption.
- [ ] **AC-6** — `b-standing-delivery-red` in `road-to-ten-across-the-board.md` reads `Status: resolved`, with the no-`overlap`-line reasoning recorded.
- [ ] **AC-7** — `preamble-payload-budget.json` records the 2026-08-24 measurement of 138,212 against milestone 1, per its own `on_miss` clause.

## Explicitly NOT in this roadmap

**Shrinking the payload.** Not one step here removes a token. That is deliberate:
the estate has a dated schedule, a census naming where the weight sits
(92.1 % in the auto tier, top 20 files carrying 35.5 %), and a `revisit_if` tied
to a human paths-scoping decision. What it does not have is a gate that objects
when the number moves the wrong way. This roadmap builds the objection; the
reduction is the schedule's job and the schedule already exists.

**Reopening `check_always_budget`'s 2-character margin.** 60,252 of 60,254 is
alarming and is not a defect. The cap is a ratchet that may only move down, and
nothing here proposes moving it.
