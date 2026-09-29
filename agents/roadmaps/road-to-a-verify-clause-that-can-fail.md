---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Nothing here can be archived — the verify: clauses are live contract surface and all but 6 of the 230 measured state no machine-decidable expectation; parking costs the one cheap reading (a listing) that would tell the estate how bad it is; merging into road-to-release-holds-that-refuse would put a grammar change inside a release-gating roadmap that shares only the template file and none of the subject."
relates:
  - slug: road-to-release-holds-that-refuse
    relation: disjoint
---
# Road to a verify clause that can fail

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t11/` — an external completion-contract analysis set (two competing model syntheses over the same two parents, plus their chat).

## Goal

A `verify:` clause names a command and never names what the command must produce, so a
step can be flipped on a command that cannot fail. It asserted, when written: 155 `verify:`
lines across the 8 active roadmaps, 51 opening with a backticked command, and **zero**
carrying a machine-decidable expectation. **None of those three reproduced.** Measured
2026-09-29 with `./scripts-run src/scripts/roadmap_verify_share`, against this branch's
base `7efe4c2e8` and re-derived unchanged after a later merge of `main`: 22 active
roadmaps, 230 step blocks carrying a clause, 93 naming a command, and **6** naming an
expectation — three of them written before the grammar was legal. The zero was false, not
merely stale, and it had already been copied into two docstrings before the measurement
ran; both were corrected against the reading. The reading, the unit it counts, and the
unreproducible denominators are in
`agents/evidence/reports/verify-clause-share-2026-09-29.md`. `extractVerify`
returned a bare string and had no concept of an expectation; `closure_scan` checked that a
`verify:` was present, never that its oracle could have said no. Done: the arrow form `verify: \`<cmd>\` -> 0` and
`-> /regex/` is legal in rule 23 and parsed by one shared parser, a `closure_scan` family
reports the unfalsifiable share as a **listing that always exits 0**, and the runnable
share per roadmap is a published number rather than an impression.

## Phase 1 — The grammar, and one parser for it

- [x] **1.1 Rule 23 accepts an expectation half.** `verify: \`<cmd>\` -> 0` and
      `-> /regex/`, in `src/agent-src/templates/roadmaps.md`. The arrow is the one `exec:`
      evidence already carries — not a new symbol. Prose after `verify:` stays legal and
      reads as MANUAL, because forbidding it would silently invalidate the 137 measured
      clauses that carry no command at all — measured, against a drafted 104 that came from
      the refuted baseline.
      verify: `grep -c 'verify:.*->' src/agent-src/templates/roadmaps.md` -> /[1-9]/

      **Evidence 2026-09-29.** `grep -c 'verify:.*->' src/agent-src/templates/roadmaps.md`
      → `3`. Matches `/[1-9]/`. The three are the two grammar lines in rule 23 and the
      inline counter-example. Prose after `verify:` is untouched, so no existing clause
      was invalidated — confirmed by the share reader, whose command count did not fall.
- [x] **1.2 One parser, two importers, one parity test.** `extractVerify` returns
      `{command, expect}` where the arrow is present and `{command, expect: null}` where it
      is not. Nothing may parse the arrow a second time.
      verify: fixture G4 — one step each of `-> 0`, `-> /regex/`, prose — yields three distinct shapes

      **Evidence 2026-09-29.** `npx vitest run tests/scripts/_lib/verify_clause.test.ts`
      → `23 passed`, including *the three shapes are mutually distinct*, which asserts
      `new Set(shapes).size === 3`. `extractVerify` now returns the shared clause and
      parses nothing itself. A sweep of `src/scripts` asserts one arrow parser exists.

      **Shown red.** Neutering the expectation parser (`fromValue` → `null`) reds 9 of 23,
      precisely the shape-distinguishing ones. Planting a second arrow matcher in
      `closure_scan.ts` reds the sweep with the offender named:
      `a second verify-arrow parser exists: src/scripts/closure_scan.ts`. Dropping the
      expectation from `renderVerifyLine` reds 2 — the oracle must reach the continuation
      message, not only the command, or a re-engagement flips the box on exit 0 regardless.
      All three restored from a pre-probe copy and re-run green.

      **Two defects this step surfaced, both fixed here.** `check_agent_artifact_location`
      classified fixture F5 as a roadmap misfiled outside `agents/roadmaps/` — frontmatter
      tier plus a `## Phase` heading plus a checkbox is its three-signal test, and the
      sibling fixtures avoid it by carrying no `complexity:` tier; F5 now follows that
      convention with the reason written in the file. And the hook edit pushed an
      already-over-cap file 16 lines further over, moving the `check_source_size_budget`
      live total off its recorded baseline. The baseline was NOT raised: the rendering
      moved into `_lib/verify_clause.ts`, where the grammar lives and the file is under
      cap, leaving the hook at exactly its prior 1526 lines and the total at 17748.
- [x] **1.3 Serialise the template edit.** `road-to-release-holds-that-refuse` writes six
      rules into the same file. Rebase onto whichever lands first; never merge both in one
      pass.
      verify: `git log --oneline -- src/agent-src/templates/roadmaps.md | head -3` shows the two touches ordered

      **Evidence 2026-09-29.** The release-holds edit landed FIRST, so this one rebased
      onto it rather than merging both:

      ```
      8f60a269d feat(roadmap-template): a verify clause may say what the command must produce
      47bb07719 feat(roadmap-template): split rule 13, add release-holds rule 28 (#2055)
      793e8a978 Merge remote-tracking branch 'origin/main' into drain/decision-closure
      ```

      Ordered, and both rule sets survive: rule 28 (release holds) is present at line 716
      and this edit sits inside rule 23. Neither disappeared into a clean auto-merge.

## Phase 2 — Report the share; never gate on it

- [x] **2.1 A listing family, exit 0 always.** `closure_scan` gains `unfalsifiable-verify`:
      a fixed-output command head, an expectation the failure output also prints, an
      unmeasured number in a manual step. It exits 0 unconditionally, for the reason
      `check_requirements_trace.ts`'s own header records about turning a young reader into
      a gate.
      verify: `./scripts-run src/scripts/closure_scan <fixture> --json` -> /unfalsifiable-verify/

      **Evidence 2026-09-29.** Against fixture F5:
      `./scripts-run src/scripts/closure_scan tests/fixtures/decision-closure/F5-unfalsifiable-verify.md --json`
      prints `unfalsifiable-verify` 4 times — the four shapes that cannot say no — and
      fires on none of the three controls in the fixture Phase 2. Exit 0 under `--strict`
      on that entirely-unfalsifiable corpus; exit 1 under `--strict` on F1, so the
      exemption is the family and not a softening of the flag.

      **Shown red.** Emptying `NON_BLOCKING_KINDS` reds exactly one test — *exits 0 on an
      entirely unfalsifiable corpus even under --strict*. Disabling the detection reds two
      — the four-shape count and the `--json` name. Restored from a pre-probe copy.
- [x] **2.2 Publish the runnable share per roadmap.** The baseline this step was
      written against — 51 of 155 with a command, 0 with an expectation — did not
      reproduce. The measured baseline is 93 of 230 with a command and **6** with an
      expectation. Both go in the evidence tree with their date and producing command, so
      the next reading is a delta and not a re-derivation.
      verify: the evidence page carries both figures with the command that produced them

      **Evidence 2026-09-29.** `agents/evidence/reports/verify-clause-share-2026-09-29.md`
      carries the headline table (22 roadmaps · 230 clauses · 93 command, 40.4% · 6
      expectation, 2.6%), the per-roadmap breakdown, the unit definition, and the producing
      command `./scripts-run src/scripts/roadmap_verify_share` at the top of the page.

      **A figure that did not reproduce, recorded rather than reconciled.** An earlier
      reading the same day, at `dbf1c9179`, gave 27 / 264 / 100 / 6. Five roadmaps archived
      in between: every total fell and the count of EXPECTATIONS did not move, because both
      of its holders are still open. The denominator moves with archival, so the page says
      to compare the falsifiable SHARE across readings and to treat a moved total with an
      unmoved numerator as archival until proven otherwise.

      **Reporting against the acceptance criteria rather than editing them.** Two of the
      four carry figures that did not reproduce — *"proven by running it against today's 8
      roadmaps"* (there are 22) and *"the 51-of-155 baseline"* (the measured baseline is
      93-of-230). They are left exactly as written: they are the contract this work was
      judged against, and rewriting them after the fact moves the bar. How each was
      actually met: the exit-0-under-`--strict` proof runs against fixture F5, which IS
      entirely unfalsifiable — the live corpus is not (6 of 230 carry an expectation), so
      it cannot prove that criterion and the narrower proof is the honest one. The
      committed baseline is 93-of-230 with its producing command on the page that carries
      it, which is the criterion's substance with its figure corrected.
- [x] **2.3 An absence check names its positive control.** A `verify:` asserting that
      something is absent must name the input on which it fires, or it is a check that has
      never been seen working.
      verify: `grep -c 'positive control' src/agent-src/templates/roadmaps.md` -> /[1-9]/

      **Evidence 2026-09-29.** `grep -c 'positive control' src/agent-src/templates/roadmaps.md`
      → `2`. Matches `/[1-9]/`. The clause is practised in the same change, not only
      stated: `roadmap_verify_share` refuses an empty corpus via `assertScanned`, and its
      test names the input on which the refusal fires (*does not throw once the same root
      holds one roadmap — the positive control*). Removing `assertScanned` reds the
      refusal test and the CLI exit-2 test while the positive control stays green.
- [~] **2.4 A ratchet on the runnable share.** Deferred, and still deferred after this
      pass: a ratchet needs a measured false-positive rate and two readings a quarter
      apart. 2.2 produced two readings on the SAME DAY, which is a delta in the corpus and
      not in the behaviour — the falsifiable count did not move, five roadmaps archived.
      May bind only files created after this roadmap lands, and only after two quarters of
      data. Not agent-closable: the blocker is an elapsed measurement window.

## Acceptance criteria

- The arrow form is legal in rule 23 and parsed in exactly one place.
- `closure_scan` reports the unfalsifiable family and exits 0 on a corpus that is entirely
  unfalsifiable, proven by running it against today's 8 roadmaps.
- The 51-of-155 baseline is committed with the command that produced it, before any fix
  moves the number.
- No existing `verify:` line is invalidated by this change; prose stays legal.
- No ratchet, no gate, no CI-blocking step lands in this roadmap.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The arrow grammar is ceremony nobody writes, and the runnable share never moves | product | Step 1.1 makes the expectation half optional, because forbidding prose would invalidate 104 existing lines. Optional syntax in an authoring template is routinely skipped: the arrow costs the author a decision about what the command must print, and writing nothing stays legal and green. (The "104 existing lines" figure below came from the refuted baseline; the measured count of clauses carrying no command is 137.) The baseline asserted here was 0 of 155 lines carrying an expectation; the measurement refuted it — 6 of 230, and **all six were written before the grammar was legal, three of them in this roadmap's own steps**. The document asserting that zero clauses carried an expectation was carrying three. That is direct evidence against this very risk. The null hypothesis is weakened accordingly, not confirmed. | Step 2.2 publishes the runnable share per roadmap with the command that produced it and its date, which makes the next reading a delta rather than an impression. The retirement condition is stated in advance: if the share has not moved over two quarters of new roadmaps, 1.1 is retired and only the listing from 2.1 is kept. | Phase 1 — The grammar, and one parser for it |
| 2 | The listing becomes a gate by accretion and reds CI on a corpus it was never calibrated against | implementation | A `closure_scan` family that reliably finds unfalsifiable verify lines looks one flag away from useful enforcement, and the corpus is almost entirely unfalsifiable — 6 of 230 clauses carry an expectation, measured, where this row asserted 0 of 155. Promoting the listing before a false-positive rate is measured turns every existing roadmap red at once, and the cheapest repair for a gate that reds on everything is to weaken it until it finds nothing. | Step 2.1 fixes exit 0 unconditionally as a property of the family rather than as a flag, following the reason `check_requirements_trace.ts`'s own header records about promoting a young reader. Step 2.4 stays deferred behind two readings and a measured false-positive rate, and the acceptance criteria state that no ratchet, gate or CI-blocking step lands in this roadmap. | Phase 2 — Report the share; never gate on it |
| 3 | Two roadmaps edit `templates/roadmaps.md` in the same window and one silently drops the other's rules | implementation | `road-to-release-holds-that-refuse` writes six rules into the same numbered rule list this roadmap's 1.1 extends. Git auto-merges additions to adjacent list items without a conflict marker, so one set of rules can disappear into a clean merge that nobody reviews — and a rule that vanished from a template fails no test, because the template is prose. | Step 1.3 serialises the two edits explicitly rather than trusting the merge: rebase onto whichever lands first and never merge both in one pass. Its verify reads `git log --oneline` on that one file and requires the two touches to appear ordered, so an unordered merge is visible in the step's own evidence. | Phase 1 — The grammar, and one parser for it |
| 4 | The grammar lands optional and changes nothing on its own | product | Because prose after `verify:` stays legal and reads as MANUAL, Phase 1 is a pure addition — no existing line is invalidated, no author is obliged to do anything differently, and the tree looks improved while 224 of the 230 measured clauses can still be flipped on a command that cannot fail. Shipping the syntax and stopping there would leave the actual defect untouched behind a green diff. | Step 1.1 keeps prose legal deliberately and labels it MANUAL so the unfalsifiable lines are named rather than hidden, and the value is carried by Step 2.2's published reading rather than by the syntax. The acceptance criteria require the baseline to be committed with its producing command before any fix moves the number — which is exactly what caught the refuted 51-of-155 and replaced it with the measured 93-of-230. | Phase 1 — The grammar, and one parser for it |
