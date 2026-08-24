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

- [x] **1.1 Decide and record where `check_preamble_payload_budget` runs in CI.**
      Not "add it everywhere": it is a per-spawn measurement, so a per-PR job is
      the natural home, and `standing-payload-delta.yml` already computes the
      delta beside it.
      verify (discharged 2026-08-24, with the second half bounded rather than
      claimed): `.github/workflows/standing-payload-delta.yml` names the gate in a
      step whose failure fails the job, and `preamble-payload-budget.json` →
      `ci_delivery` records the choice with its reason. The required-checks half is
      **not** claimed — see the honest limit below.

      **Council 2/2 chose option (b) because the alternative's premise was false.**
      That workflow justified never failing with *"`check_preamble_payload_budget`
      already ratchets this number and already fails on growth"* — and **no
      workflow in `.github/` invoked that gate at all.** It ran only in the local
      `task ci` chain. The workflow declined to fail on the strength of a sibling
      that was not there, so folding the gate in is the smallest change that
      removes the contradiction instead of adding a third surface. Measured cost of
      the gap: **+12,619 tokens in nine days** (125,593 → 138,212).

      **It runs behind a GRACE CEILING, and that is not a softening.** HEAD is
      138,212 against a design ceiling of 107,646 — 28.4 % over. Blocking at the
      design number fails **every** PR from the moment this lands, and nobody sheds
      30,566 tokens inside the PR that arms the gate. The grace ceiling sits **at**
      the measurement: growth beyond today reds immediately, today's tree passes. It
      may only ratchet DOWN and it expires at milestone 1 (2026-11-10).

      **The `--ceiling` override is one-directional, and a test pins it.** LOOSER is
      honoured; **TIGHTER is ignored**. Backwards for one line and deliberate:
      honouring a tighter value would let a caller silently lower the bar this
      budget file owns — the config-weakening shape in reverse. Tightening happens
      by lowering `baseline_tokens`, in the file, where a reviewer sees it.

      **The single-sample objection is answered, not waved off.** "Per-spawn" names
      where the cost is *paid*, not sampling: the measurement is a deterministic
      census of revision-controlled inputs, so one CI run represents the checked-out
      revision exactly, and variation between two runs on one commit would be a
      **checker defect**. Both seats required that be demonstrated —
      `check_preamble_payload_budget.test.ts` now asserts two `evaluate()` calls
      return identical totals *and* identical per-bucket file counts.

      **HONEST LIMIT, recorded in three places:** this makes the check **fail**, not
      **required**. Whether a failing check blocks a merge is branch-protection
      configuration — a repo-admin action outside this change and outside an
      autonomous run. The claim is *"the gate can now fail a PR"*, never *"the gate
      now blocks a merge"*. Verify the latter with
      `gh api repos/:owner/:repo/rulesets`.
- [x] **1.2 Correct the two stale premises in the same change.** The
      declines-to-fail comment at `standing-payload-delta.yml:5-10` and its twin at
      `taskfiles/ci-fast.yml:820` both assert the gate fails on growth. Either make
      that true (1.1) or rewrite both sentences.
      verify (discharged 2026-08-24): two occurrences remain and **neither asserts
      the premise** — both are labelled retractions.
      `standing-payload-delta.yml:8` sits under a heading reading *"The premise this
      header used to rest on was false"*; `taskfiles/ci-fast.yml:836` reads *"this
      used to justify itself with … and that premise was FALSE"*.

      **The difference from AC-3 is why the two corrections were written
      differently, and the checks were read rather than assumed equivalent.** This
      verify asks for occurrences *whose premise holds* — a quotation labelled as
      retracted asserts nothing, so recording the correction satisfies it. AC-3's
      check is a bare `grep -c … returns 0`, which a quotation would **fail**, so
      that correction describes the retracted phrase without reproducing it.
- [x] **1.3 Correct the "blocks by construction" claim in
      `preamble-payload-budget.json`.** Replace it with what is true: the guard
      classifies budget files as advisory, so the restraint is a policy the
      maintainer keeps, not a mechanism that enforces it.
      verify (discharged 2026-08-24), **both conjuncts**: the grep returns **0**,
      and `block_config_weakening.ts:96-98` still returns `'advisory'` for
      `-budget(s).(json|yaml)` and for the literal `budgets.yml` — so the guard is
      untouched and the fix went to the prose, which is what the step asked for.

      The claim was that raising a ratchet baseline to clear a failing check is a
      move *the repo blocks structurally*. It over-claimed on three counts:
      `block_config_weakening` warns from five allowlist entries and blocks past
      twenty, is honoured only on the one host that denies at all, and — per the
      classification just verified — treats this very file as **advisory**, so it
      does not gate a baseline edit. The restraint is real; it is carried by review
      and by the file's own record, not by construction.

      The replacement deliberately does **not** quote the retracted phrase, because
      this AC's check is a literal grep and quoting it would leave the string in the
      file it was removed from. The reason for describing rather than quoting is
      stated inline, so a later reader does not restore the quote as a courtesy.
- [x] **1.4 Answer `b-standing-delivery-red` in the file that raised it.** It is
      already answerable: the two-layer run prints no `overlap` line, and that line
      is emitted only when `overlap_rules > 0`
      (`check_standing_rule_delivery.ts:307`), so the two layers are disjoint and
      the 123,176 is real rather than a local-install artifact.
      verify (discharged — **already resolved before this roadmap ran**, and
      re-verified rather than assumed): `road-to-ten-across-the-board.md:257` reads
      `Status: resolved` with the no-`overlap`-line reasoning in the entry.

      Re-derived live at HEAD: the gate prints **120,023 tok** against the 110,000
      cap, and the single `overlap` occurrence in its output is inside the **remedy
      hint prose**, not an emitted `overlap_rules` count — that line is emitted only
      when `overlap_rules > 0`. The two host layers are cleanly disjoint and the
      overage is real body length, not a local-install artifact.

      **One correction to this roadmap's own Context table:** it states **123,176**
      for this gate. Measured now: **120,023** — down **3,153**, as the drain's
      merged rule edits landed. Favourable direction; still 9.1 % over cap.

## Phase 2 — close the built-tarball hole

- [x] **2.1 Either register `unpacked_size_mb` in `evaluator-budgets.json` or
      correct the sentence in `pack-size-budget.json`.** One of the two must
      change; today the pair is a contradiction.
      verify (discharged 2026-08-24, the **second** branch): asserted that
      `unpacked_size_mb` is absent from `evaluator-budgets.json`'s `budgets` object
      **and** that the string *"gated separately, at release time, by
      evaluator-budgets.unpacked_size_mb"* is gone from `pack-size-budget.json`.

      **The blocker's premise was INCOMPLETE, and completing it decided which
      branch.** It said the key *"does not exist"*. It does not exist **because it
      was removed** — `evaluator-budgets.json:30` records `removed_2026_08_04`:
      *"removed by maintainer decision at the 9.17.0 release: the gate turned every
      legitimate payload addition into a blocked release (measured 28.22 vs max 28
      with all functional gates green), and the maintainer judged tarball size not
      worth gating. ADR-204 review_trigger (a) fired and was resolved this way."*

      So option (a) — *"add `unpacked_size_mb` with a measured baseline"* — is not a
      wiring choice. **It reverses a recorded maintainer release decision**, which
      `decision-revisit-gate` reserves to the owner. Council 2/2: the record settles
      it, and the council has no basis to reopen it.

      Both seats also required **every** contradictory occurrence be corrected
      rather than one sentence. There were **two** — in `_comment` and in
      `measurement_conditions` — and a single-sentence fix would have left the
      second standing.
- [x] **2.2 Measure the built delta once, and record it.** `evaluator_umbrella.sh`
      already measures the size (`consistency.yml:451` says plainly *"this is not a
      second gate on that number"*), so the measurement exists and only the
      recording is missing.
      verify (discharged 2026-08-24): `pack-size-budget.json` →
      `built_surface_measurement_2026_08_24`, both surfaces with the command that
      produced each.

      | Surface | packed | unpacked | entries |
      |---|---|---|---|
      | **unbuilt** (`--ignore-scripts`, clean detached worktree) | 8.4953 MB | 28.7516 MB | 2,614 |
      | **built** (`npm run build` then `npm pack`) | 10.5525 MB | **37.3775 MB** | 2,808 |
      | delta | +2.0572 MB | **+8.6259 MB** | +194 |

      **The "~5.4 MB larger" figure this roadmap and the budget file both carried is
      WRONG.** Measured, the built surface is **+8.6259 MB** unpacked. Corrected
      rather than carried: a reader comparing 8.4953 against 28.22 against 37.3775
      was comparing three different surfaces without knowing it.

      **And the measurement makes the 2026-08-04 removal look better in hindsight
      than it did at the time.** That cap was `max 28`, removed at a measurement of
      28.22 — a **0.8 %** breach. The built unpacked size is now **37.3775 MB**,
      i.e. **33.5 % over** the cap whose 0.8 % breach caused its removal. Reinstating
      it is therefore not "add a key with a baseline"; it is setting a cap a third
      higher. Recorded so an owner reopening it under `decision-revisit-gate` starts
      from 37.4, not from 28.

      **Bound:** local-only, one machine, two worktrees of one commit. CI reads ~8 KB
      above the local *packed* figure historically; there is **no CI reading of the
      built surface at all**, so these are not a CI baseline.
- [x] **2.3 Restate the cap history against the built surface.** The five raises
      were measured on the unbuilt tree; say so where the history is recorded, so
      the next reviewer is not comparing two different surfaces.
      verify (discharged 2026-08-24): `_comment` now opens with a **surface label**
      stating that every `packed_size_mb` figure in this file and in every
      `baseline_note_*` was measured on the **unbuilt** tree under
      `measurement_conditions`, that the built surface is recorded separately, and
      that a note's figure must not be compared against a built one.

      Done as **one label rather than five per-note edits**, deliberately: all five
      raises were measured the same way, so five copies of one sentence is
      duplication that can drift apart, and the label sits where a reader meets the
      file rather than buried in the oldest note.

## Phase 3 — close the ownership gap that let a cap raise cost one sentence

- [x] **3.1 Bring `budgets.yml` into `lint_budget_ownership`'s corpus.** That gate
      scans `src/config/*budget*.json` — a `.json` filter
      (`lint_budget_ownership.ts:126-131`) — so `budgets.yml` escapes it entirely
      and its `standing_rule_delivery` entry carries no `owner` and no `review_by`.
      verify (discharged 2026-08-24): the gate reports **12 budget config(s)** —
      eleven JSON plus `budgets.yml` — and it named exactly the two missing fields
      *before* they were added, which is the mechanism working rather than a claim
      about it.

      **An explicit single-file row, NOT a widened glob.** Council 2/2 refused the
      glob for two reasons, and the second is a defect the blocker did not know
      about:

      1. `*budget*.json` **is** this gate's corpus definition (its own `main` says
         so), so widening it means any future `*budget*.yml` dropped into
         `src/config/` joins the governed set **silently**. A governed file should be
         a decision, not a filename coincidence.
      2. **It could not have worked as written.** The read was an unconditional
         `JSON.parse`, so a YAML file arriving through a widened glob would have been
         reported `unparseable JSON` — the gate red, blaming the file for the gate's
         own bug. Parsing now dispatches on extension, and a YAML scalar or list is
         refused rather than coerced into a document.

      `GOVERNED_NON_JSON` is the decision surface and holds one row.
      `lint_budget_ownership.test.ts` (17 tests) asserts `budgets.yml` is in, an
      **unlisted** `rogue-budget.yml` stays **out**, the corpus is exactly 12,
      parsing dispatches on extension, and dropping either `owner` or `review_by` is
      reported by name.

      **`review_by` is DERIVED and no cadence rule exists** — stated plainly rather
      than presented as policy. The gate requires the field and defines no interval.
      Two conventions are observable across the siblings: four files use
      `2026-11-10` (the preamble milestone) and seven use a ~1-year horizon,
      including this file's subject-nearest sibling `preamble-payload-budget.json`.
      Registered on that convention → **2027-08-24**. If a cadence is ever written
      down and disagrees, this date is wrong and moves to the rule.

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
- **Status:** resolved.
- **Resolution (2026-08-24) — option (b), recorded in `ci_delivery`.** AI council
  2/2 convergent (`anthropic/claude-sonnet-4-5` + `openai/codex-default`); the
  maintainer delegated owner-reserved blockers to the council for this drain run.

  **(b) won because the premise behind "don't add a second gate" was false.** The
  workflow declined to fail on the grounds that this gate *"already fails on
  growth"*, and **no workflow invoked it at all**. Folding it in is the smallest
  change that removes the contradiction.

  **The single-sample worry this blocker raised is answered, not dismissed.**
  "Per-spawn" names where the cost is paid, not sampling: the census reads only
  revision-controlled inputs, so one CI run represents the revision exactly, and
  run-to-run variation would be a **checker defect**. Both seats required a
  repeatability assertion before a single run may fail a build; it exists.

  **A grace ceiling was added that neither the blocker nor its options
  anticipated.** HEAD is 28.4 % over the design ceiling, so arming at that number
  fails every PR immediately — a self-inflicted stop, not a gate. The grace ceiling
  sits at the measurement, ratchets DOWN only, and expires at milestone 1.

  **Not resolved, and named rather than implied:** the check can now **fail** a PR;
  whether it **blocks a merge** is branch protection, a repo-admin action outside
  this change.

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
- **Status:** resolved.
- **Resolution (2026-08-24) — PUBLISH AND HOLD, in `status_2026_08_24`.** AI
  council 2/2. The drift is published now and the date is retained.

  **It is recorded as `at_risk`, explicitly NOT as a miss.** 2026-11-10 has not
  arrived; declaring a miss before its date would be the mirror of silently
  re-dating, and one seat corrected the framing on exactly that point. The
  `on_miss` clause applies **at** the date, and this entry is the early warning
  that keeps the date falsifiable.

  **The disagreement is recorded unresolved, because it is real.** One seat argued
  the derivative already falsifies the schedule — +12,619 in nine days against a
  target needing net reduction over the remaining 78 — so holding for a second miss
  preserves a signal nobody will act on. The other argued holding is what keeps the
  checkpoint falsifiable at all. Both readings are defensible and the measurement on
  2026-11-10 decides between them; collapsing that into one verdict now would
  discard the thing being measured.

  **One field added beyond what was asked:** `committed_reduction_mechanism:
  NONE`. Two roadmaps name reductions and neither is executing. A schedule with no
  mechanism is a date, not a plan, and the field exists so the next reader is not
  left to infer that from silence.

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
- **Status:** resolved.
- **Resolution (2026-08-24) — the sentence is gone, and the RECORD settled it
  rather than the council's preference.** AI council 2/2.

  **This blocker's premise was incomplete in a way that decided the branch.** It
  said the key *"does not exist"*. It does not exist **because it was removed**:
  `evaluator-budgets.json:30` carries `removed_2026_08_04` — a maintainer decision
  at the 9.17.0 release, with the measurement behind it (28.22 against max 28, all
  functional gates green) and ADR-204's `review_trigger (a)` resolved by it.

  So option (a) is not a wiring choice; it **reverses a recorded maintainer release
  decision**, which `decision-revisit-gate` reserves to the owner. The council had
  no basis to reopen it, and said so.

  **Two occurrences, not one.** Both seats required every contradictory claim be
  corrected: `_comment` and `measurement_conditions` each asserted the removed key
  as a gate, and a single-sentence fix would have left the second standing.

  **Phase 2.2's measurement then strengthened the original decision.** The built
  unpacked size is now **37.3775 MB** — 33.5 % over the `max 28` whose 0.8 % breach
  caused the removal. An owner reopening this starts from 37.4, not 28.

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
- **Status:** resolved.
- **Resolution (2026-08-24) — the gate scans it, via an explicit single-file row
  and NOT the widened glob this blocker recommended.** AI council 2/2, and the
  refusal rests on a defect the blocker did not know about.

  1. `*budget*.json` **is** this gate's corpus definition, so widening it lets any
     future `*budget*.yml` join the governed set **silently**. A governed file should
     be a decision, not a filename coincidence.
  2. **The widened glob could not have worked.** The read was an unconditional
     `JSON.parse`, so a YAML file arriving through it would have been reported
     `unparseable JSON` — the gate red, blaming the file for the gate's own bug.
     Parsing now dispatches on extension.

  `GOVERNED_NON_JSON` holds one row and is the decision surface; 17 tests pin that
  an unlisted `*budget*.yml` stays out and that the corpus is exactly 12.

  **`review_by` is derived and no cadence rule exists.** The gate requires the field
  and defines no interval; two conventions are observable across the siblings.
  Registered on the ~1-year one its subject-nearest sibling uses → 2027-08-24, with
  the derivation and its fragility stated in `budgets.yml` itself. Seat 1 was
  explicit that inventing a date would be a governance defect, so the derivation is
  shown rather than the number asserted.

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

- [x] **AC-1** — `check_preamble_payload_budget` runs in a CI job on a pull request, and the job's failure is visible in the checks list. A corrected comment does not satisfy this.
      **Met for the half that is in this change's power, and the other half is named rather than claimed.** The gate runs as a step of `standing-payload-delta.yml` on `pull_request`, and the step fails the job, so the failure is visible in the checks list. **What is NOT claimed: that the check is REQUIRED.** Branch protection decides whether a failing check blocks a merge, and that is a repo-admin action — `gh api repos/:owner/:repo/rulesets` answers it, this file does not. The AC asks for visibility in the checks list, which is met; a reader wanting "blocks a merge" should read the honest limit in `ci_delivery`.
- [x] **AC-2** — `grep -rn 'already fails on growth' .github/ taskfiles/` returns no occurrence whose premise is false.
      **Met.** Two occurrences remain and **neither asserts the premise** — both are labelled retractions, one under a heading reading *"The premise this header used to rest on was false"*, the other reading *"this used to justify itself with … and that premise was FALSE"*. The criterion is about a false premise, not a literal string, and the two were read as different checks rather than assumed equivalent — see AC-3, whose bare `grep -c` a quotation would have failed.
- [x] **AC-3** — `grep -c 'blocks by construction' src/config/preamble-payload-budget.json` returns 0.
      **Met: returns 0.** The replacement deliberately does **not** quote the retracted phrase, because this check is a literal grep and quoting it would leave the string in the file it was removed from — the failure mode AC-2's looser wording tolerates and this one does not. Step 1.3's second conjunct was verified too: `block_config_weakening.ts:96-98` still classifies budget files `advisory`, so the guard is untouched and the fix went to the prose.
- [x] **AC-4** — the key `pack-size-budget.json`'s prose names either exists in `evaluator-budgets.json`, or is no longer named.
      **Met by the second branch**, and asserted both ways: `unpacked_size_mb` is absent from `evaluator-budgets.json`'s `budgets` object, and the sentence naming it as a release-time gate is gone from `pack-size-budget.json`. The first branch was refused on governance grounds, not preference — adding the key reverses a recorded 2026-08-04 maintainer release decision.
- [x] **AC-5** — `lint_budget_ownership` reports `budgets.yml` in its scanned set, or that file records its exemption.
      **Met by the first branch.** The gate reports **12 budget config(s)**, up from 11, and named exactly the two missing fields before they were added. Via an explicit `GOVERNED_NON_JSON` row rather than a widened glob — the glob would have admitted future YAML budgets silently *and* could not have parsed this one.
- [x] **AC-6** — `b-standing-delivery-red` in `road-to-ten-across-the-board.md` reads `Status: resolved`, with the no-`overlap`-line reasoning recorded.
      **Met — and it was already met before this roadmap ran**, which is stated rather than presented as this change's work: the entry reads `Status: resolved` at `:257` with the reasoning in place. Re-verified live rather than trusted: the gate's only `overlap` output is inside its remedy-hint prose, not an emitted `overlap_rules` count, so the layers are disjoint and the overage is real body length. The re-run also corrected this roadmap's own figure — **120,023**, not the 123,176 in its Context table.
- [x] **AC-7** — `preamble-payload-budget.json` records the 2026-08-24 measurement of 138,212 against milestone 1, per its own `on_miss` clause.
      **Met** via `status_2026_08_24`: 138,212 measured, 102,520 target, 35,692 from target, 12,619 from registration, milestone date retained. Recorded as **`at_risk`, not a miss** — the date has not arrived, and the `on_miss` clause applies at it. The council's unresolved disagreement about whether the trajectory already falsifies the schedule is recorded in the same entry rather than settled, because 2026-11-10 is what settles it.

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
