---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to gate autonomy — human gates only where a human is the point

> **Source:** `agents/tmp.old/mixed-trigger-cleanup/road-to-gate-autonomy.md`
> — external analysis session, 2026-08-17, drafted against `de76c38b932d1612d36cfc85d6b9fbaff4832350`.
> Adopted 2026-08-17 via `/analyze:inbox` after per-claim verification against
> `origin/main` @ `097ab6549`.

> **Ownership boundary, stated first.** `road-to-user-out-of-the-loop` owns
> ask-reduction *inside a roadmap run* — its item series, the contract screen and
> the decision sheet. This roadmap owns what that one does not: the **blocker and
> gate estate itself** — making gates executable by agents, pre-authorising spend,
> and reserving humans for the few decisions where the human is the *content* of
> the gate rather than the courier of a command.

---

## 0. The defect, stated first

**The estate carries 38 open blockers — 13 owned by `user`, 25 by
maintainer-or-external — and a large share of them are not decisions. They are
commands and agent runs waiting for a human to type them.**

The lived experience follows directly: to unblock anything you read roadmap files
until you find the buried gate, and one overlooked comment stalls a whole family.
Meanwhile the capabilities to self-unblock already ship — a council for
consultation with configurable decision classes, a CLI the agent can drive, and
CLI-dispatched agent runs. The last of those is **structurally off for everyone**:
the delegate permission defaults to false and is double-gated in code.

Three concrete shapes, from the live gate output:

1. **Runnable-but-waiting.** The live-trigger-eval gate is a *command* whose only
   human ingredients are a terminal confirmation and billable spend. It has sat as
   a gate while three roadmaps wait on its output, and its twin lists the largest
   unblock count in the estate.
2. **Decided-but-unread.** The autonomy-defaults gate already carries a full
   maintainer recommendation *rendered by the tooling itself*. The decision is
   drafted; only the reading and the yes are missing.
3. **Fired-but-unresumed.** `later/road-to-request-scoped-rule-load`'s resume
   condition closed and nothing resumed it — a gate that opened with nobody
   standing in front of it.

The earlier gates work built the *reading* half — a decidability probe and
recommendation-first rendering. This roadmap builds the *acting* half.

## 1. Verified provenance

Verified 2026-08-17 against `origin/main` @ `097ab6549`.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | 38 open blockers, 13 user-owned, 25 maintainer-or-external | **still-true, exact** | `./agent-config gates --all` prints "13 decisions need you · 25 more with maintainer/external" |
| 2 | The top blockers unblock large step counts | **still-true** | the `unblocks:` field in the same output |
| 3 | The delegate permission defaults false and is double-gated in code | **still-true** | `src/server/schemas/settings.ts` — `allow_delegate: z.boolean().default(false)`, and the object default repeats `allow_delegate: false`. Its own describe text states the two-gate contract: availability is necessary but not sufficient |
| 4 | Council decision classes exist and are configurable | **still-true** | `docs/contracts/ai-council-config.md`, the decision-resolution class configuration |
| 5 | The gate tooling renders owner, recommendation, "Do this", and "Done when" | **still-true** | `src/agent-src/scripts/roadmap_gates.ts`; confirmed in live output, including the needs-you split |
| 6 | The live-trigger-eval gate hard-aborts under automation | **still-true** | the park note and roadmap that own it |
| 7 | The autonomy Hard Floor and its scope | **still-true** | `src/rules/autonomous-execution.md` Hard Floor section, deferring to `non-destructive-by-default` |
| 8 | A fired-but-unresumed trigger exists | **still-true** | `later/road-to-request-scoped-rule-load.md`'s park note names "Resume when P2.1 of road-to-rule-delivery-integrity closes"; that P2.1 carries a done-note, and the file is still in `later/` |
| 9 | Gate-type census by string counts | **still-true as a smell map** | a grep census over active and later roadmaps. Explicitly not deduplicated and never to be treated as arithmetic — it indicates where the classes cluster, nothing more |

## 2. The gate taxonomy — four classes, each with a mechanism

The operating principle: **default autonomous; ask once, briefly, only where cost
or irreversibility makes the human the point.**

| Class | Definition | Mechanism | Examples from the live estate |
|---|---|---|---|
| **0 — auto-run** | Deterministic, free, reversible: a command or check the agent can execute, whose output *is* the unblock | `gates --execute` runs it, attaches the output to the blocker, flips it | time-window checks, telemetry sample-size counts, liveness probes on resume conditions |
| **1 — budget-preauthorized** | Billable or long-running but reversible; the human ingredient is *spend consent*, not judgment | A standing budget in settings; the agent runs under it and logs a receipt — cost, artifact, blocker id — to an append-only ledger. Over budget escalates to class 2 | the live trigger eval, bench runs, rater tasks where a council rater is admissible |
| **2 — consent-once** | A real preference or risk call, but reversible and recommendation-ready | One line with the already-rendered recommendation and a default; a yes — or "accept defaults" — makes the agent autonomous for everything downstream of that gate. Delivered through the single decision-sheet surface, **never as N separate reading assignments** | the autonomy-defaults gate, sink choice, default-flip release gate |
| **3 — human-only** | The human *is* the gate's content: irreversible, legal, or Hard Floor | Unchanged, and explicitly re-affirmed | pushes, merges, deploys, kernel edits and their soak, the DPO signoff, judge independence, bulk deletions |

**Anti-goals that never fall**, inherited verbatim so no re-litigation is needed:
the Hard Floor stands; kernel edits keep their own PR and soak; merge stays human;
judge independence is untouched. **Autonomy eliminates couriering, never
safeguards.**

## Phases

### Phase 1 — Blocker schema: class and command become fields

- [x] **1.1** Extend the blocker contract the existing blockers lint already probes
      with three optional fields: a class, a `run:` command for classes 0 and 1, and
      a budget estimate for class 1. The decidability ratchet gains a second
      dimension: **a class-0 or class-1 blocker without a `run:` field is the new
      lint violation** — a gate that claims to be runnable must say how. Class 3 is
      the absent-field default, so a misclassification requires a reviewed edit
      rather than a runtime judgment.
      `verify:` the lint is red on a fixture blocker claiming class 0 with no `run:`,
      and green on the committed tree.
      **Done 2026-08-17.** `Class:` / `Run:` / `Budget:` parse in
      `update_roadmap_progress.parse_blockers` (+ `blocker_class`, which applies the
      absent-field default at every consumer rather than at each call site);
      `lint_roadmap_blockers` gains two HARD checks — an unknown class, and a class
      0/1 entry with no `Run:`. Contract text in `templates/roadmaps.md` rule 20,
      with the four-class table. Nine new `it(` blocks in
      `tests/scripts/lint_roadmap_blockers.test.ts` cover both directions including
      the class-2/3 and absent-class negatives. (Recorded as eight in the first
      pass; corrected by R2 finding 17 — a checkable count in a done-note is
      exactly the kind of claim that has to be right.)
      **The check is HARD, not ratcheted, and the reason is worth recording:** the
      field is opt-in, so on the day it ships no entry declares a class and the rule
      fires on nothing. There is no backlog to grandfather, so the "strict gate reds
      ~283 files" failure the decidability half had to design around does not arise.
      **Pre-existing red, NOT caused here and not fixed here:** the sibling
      decidability ratchet reads 28 against a baseline of 26 on a pristine tree.
      None of the 28 is in this roadmap, every one is in another roadmap's blocker
      section, and this worktree's scope lock does not own those files.
- [x] **1.2** One classification sweep over the 38 live blockers, each verdict a
      table row: blocker, class, run-or-decision text, reason. **Pre-registered
      expectation, to be falsified rather than assumed:** a substantial share land
      in class 0 or 1. If the sweep finds far fewer, the "gates are mostly couriered
      commands" premise is published as weaker than it felt and Phase 2 shrinks
      accordingly.
      `verify:` the sweep table is committed, every open blocker appears in it, and
      the share is stated as a number before Phase 2 starts.
      **Done 2026-08-17 — and the premise is FALSIFIED.**
      `agents/evidence/analysis/gate-class-sweep-2026-08-17.md`. The bar was fixed
      at **≥ 40 % in classes 0+1** and committed before a single blocker was
      classified (commit `b5a51510a`, sections 3 and 4 deliberately empty). The
      sweep returned **12 of 49 — 24.5 %**. The estate is decision-heavy, not
      courier-heavy: class 2 alone is 42.9 %, and 37 of 49 gates need a judgement
      or a person.
      **The population is 49, not the 38 this step was written against**, and not
      the 50 the tooling reported when the sweep ran — see the defect below.
      **Two defects surfaced by the sweep, one fixed here.** `RoadmapStats` split
      open from resolved with an EQUALITY test on `Status:`, a field authors write
      prose into, so `**Status:** RESOLVED 2026-08-17 — option (b)` matched neither
      branch and was rendered as a live decision two days after it was taken.
      `blocker_is_resolved` is now a prefix test and is the single source both
      getters read, which also ends a disagreement with `lint_roadmap_blockers`,
      whose own status check was already a prefix. Sibling search: 2 sites, both
      here, both fixed; the one lexical near-match (`rule_backlinks.ts:194`) is a
      union tag, not this defect. The second — the decidability ratchet at 28
      against a baseline of 26 on a pristine tree — is recorded and NOT fixed: all
      28 sit in other roadmaps this worktree does not own.
      **What is deliberately NOT done: materialising `Class:` into all 49 entries.**
      AC-1 asks for it and it is a 25-file diff across every active roadmap,
      including two a live parallel session is holding. The classification is
      committed as the evidence table instead, which is what step 1.2 asks for; the
      write-back is named as the follow-up rather than done half-way.
- [x] **1.3** Write the swept classes back into the blocker entries themselves, so
      `Class:` is a field in the tree and not only a row in the evidence table.
      **Added 2026-08-17 by R2 finding 7**, which is the reason it exists as a step:
      1.2 deferred this in prose, and prose in a done-note is not tracked — it
      disappears when the roadmap archives, which is the lost-information shape
      Iron Law 3 exists to prevent. Deferred rather than done because it is a
      25-file diff across every active roadmap, two of them held by a live
      parallel session at the time; only this roadmap's own two entries carry the
      field today.
      `verify:` every open blocker in `agent-config gates --json --all` carries a
      class, and `lint_roadmap_blockers` reports **no new** violation — see the
      clause correction below; "green" was never reachable.
      **Done 2026-08-17, and the step's own result falsifies the sweep a second
      time.** This step wrote **34** entries; the tree now carries **36**
      authored `Class:` fields, because this roadmap's own two already had one.
      Of the sweep's 49-blocker population, 36 declare a class and **13** resolve
      through the absent-field default — the 12 below plus the parser's
      synthesised `legacy` note. (First written as 34 and 15, which conflated
      what the step wrote with what the tree holds; corrected by R2 finding 3.
      The live count is now 50, not 49: `b-estate-prose-pass-from-1-3` is added
      by this step and is not part of the swept population.) Every value is
      joined mechanically from the committed § 3 table — ids from
      `gates --json --all`, classes from the row — and the two id sets matched
      exactly, so nothing was inferred. `renderJson` gained `class`
      (`roadmap_gates.ts`), resolving it through the same absent-field default
      every other consumer applies; five tests pin the surface, including one
      that drives the parser's legacy branch rather than asserting it in a
      comment (R2 finding 6). `run` was emitted for one commit and then
      withdrawn: R2 findings 2 and 7 showed it has no consumer, no live data,
      and no way to settle which representation is correct without one.
      **The 12 class-0/1 entries were deliberately NOT written, and that is the
      finding.** `Class: 0` without `Run:` is a HARD lint failure by design, so
      all twelve were read in full to find the command — and none can carry an
      honest one: 8 name no command at all, 2 name a `wc -l` progress read that
      cannot clear the gate, 1 names a probe that exits non-zero in its expected
      state, and 1 names a runner whose documented `--budget` cap is silently
      dropped. **The auto-runnable share of the estate is therefore 0 of 49, not
      12**: § 3 classified by what would clear a gate in principle, the field
      requires what the entry can actually run. The sweep's own conclusion —
      "`gates --execute` is worth having for the six class-0 entries" — does not
      survive it; the class-0 path Phase 2 shipped has zero live targets. Full
      table and the reasoning: the sweep artefact § 4c.
      **Two things this step refused to do.** It did not fabricate a `Run:` to
      satisfy the lint, and it did not reclassify the twelve in the tree —
      twelve verdicts across eight roadmaps this branch does not own is a
      judgement on other plans, not a field write-back. Both are surfaced as
      decisions instead.
      **Clause correction, recorded rather than quietly met.** The `verify:`
      above asked for `lint_roadmap_blockers` to be *green*. It cannot be, and
      step 1.1's own done-note already said so two steps earlier: the
      decidability ratchet reads 28 against a baseline of 26 on a **pristine**
      tree, and all 28 sit in other roadmaps. The checkable claim is the one now
      written: **28 before this branch, 28 after** — measured both times — plus
      zero findings from the class/`Run:` HARD checks. A clause that can only be
      satisfied by fixing two unrelated entries in other people's files was
      mis-authored, not failed.
- **AC-1:** every open blocker carries a class; the lint enforces `run:` on classes
  0 and 1; the sweep table is committed with its share. **Met in the field sense,
  refuted in the meaning sense — and the split is the point.** Every record in
  `gates --json --all` now carries a class: of the 49 open records, **48 carry an
  authored field and exactly 1 resolves through the absent-field default** — the
  parser's synthesised `legacy` note, which can never carry one. Measured, not
  derived.
  **Amended 2026-08-17 by the follow-up decision, and the amendment is the good
  news.** Step 1.3 left this at 36 authored / 13 default, with the twelve
  class-0/1 defaults contradicting their own swept verdict — a field the tree
  could not support. Those twelve are now reclassified to what their text
  actually supports (sweep § 4d): five are consent calls, seven are human-only,
  so the contradiction is gone rather than documented. What has **not** changed is
  the headline: class 0 is still empty, because nothing invented a command.
  Ticking this criterion without that last sentence would report the taxonomy as
  live on an estate where nothing is auto-runnable.

### Phase 2 — `gates --execute` (the acting half)

- [x] **2.1** New mode on the existing command. Class 0: run the `run:` command,
      capture output, append the unblock evidence into the roadmap file at the
      blocker — the same in-file done-note discipline every phase already uses — and
      mark it resolved. Class 1: check the budget ledger, run under it, write the
      receipt, same evidence append. Over budget, or ledger absent, renders the
      class-2 consent line **instead of running**.
      `verify:` an end-to-end fixture per class, including the over-budget path
      rendering rather than executing.
      **Done 2026-08-17, and deliberately thin — on this roadmap's own number.**
      `src/agent-src/scripts/gate_execute.ts`, reached as
      `agent-config gates --execute <id>`. Step 1.2 measured 24.5 % against a
      pre-registered 40 %, and the honest-null clause fixes the size: this ships
      for the six class-0 entries and the render path, and is not the lever that
      drains the estate. 12 fixtures in `tests/scripts/gate_execute.test.ts`, one
      end-to-end per class.
      Four refusals are built in, each one a thing the step could plausibly have
      done and should not: **no sweep** — one id per invocation, because a blanket
      execute runs N authored commands on one keypress and makes a
      misclassification cost the tree instead of one entry; **no resolve on
      failure** — a non-zero exit reports and the file is left byte-identical;
      **no invented ledger** — the budget shape is `b-gate-budget-preauth` and
      still the maintainer's, so class 1 takes the render path the blocker itself
      prescribes for a missing ledger rather than a stub of the decision; **no
      guessed command** — a class-0 entry with no `Run:` executes nothing, which
      is reachable only through an unlinted tree but is the one case where
      guessing must not happen.
      **Two more refusals added by the R2 review, both on the security surface it
      found (finding 1).** `Run:` is arbitrary shell read out of a markdown field,
      and the first cut ran it on one keypress: **`--confirm` is now required** —
      without it the command is echoed and nothing runs, which is the this-turn,
      names-the-exact-object confirmation `non-destructive-by-default` asks for.
      And a command carrying a Hard-Floor action (`git push`, `terraform apply`,
      `rm -rf`, `DROP TABLE`, …) is **refused even with `--confirm`**: class 0 is
      defined as reversible, so such an entry is misclassified, and waving it
      through would move a Hard Floor onto a keypress. The denylist is a
      classification check, not a security boundary — the boundary is `--confirm`.
      **The over-budget half of this step's `verify:` is NOT satisfied**, recorded
      rather than papered over (R2 finding 8). It asks for an over-budget path that
      renders rather than executes; today class 1 always renders, because the
      budget model it would compare against is `b-gate-budget-preauth` and still
      the maintainer's. Building one here to make a checkbox green would be exactly
      the invented ledger this step refuses two paragraphs up.
- [x] **2.2** Class 2 emits its one-line consent question with recommendation and
      default into the decision-sheet surface — `road-to-user-out-of-the-loop`
      Phase 1 owns that surface, and this roadmap only feeds it. Class 3 is
      render-only, exactly today's behaviour.
      `verify:` a class-3 blocker's output is byte-identical to today's.
      **Done 2026-08-17.** `consentLine` emits question · recommendation ·
      default, and nothing else. It is a **feed**, not a surface — the decision
      sheet is `road-to-user-out-of-the-loop` Phase 1 and wraps its own lines, so
      this side does not.
      Class 3 is byte-identical **by construction, not by test alone**: the class-3
      branch executes nothing and writes nothing, so the rendered output is the
      pre-existing renderer's. Two fixtures pin it — the declared class 3, and an
      unclassified entry, which takes the same branch through the absent-field
      default.
      **Risk 5 is implemented, not just recorded.** A class-2 recommendation over
      two terminal lines emits a note naming the taxonomy's own remedy —
      reclassify to 3, never verbosify. The first real entry it fires on is this
      roadmap's own `b-gate-budget-preauth`, whose recommendation is a paragraph.
      **The threshold (156 chars) is a stated default, not a measured optimum** —
      two lines at the 78 columns this command already wraps to. *Revisit-if* a
      real decision sheet lands with a different width.
- [~] **2.3** The live-trigger-eval hard-abort gains a preauthorised-budget flag
      that refuses without a valid unspent ledger entry and spends it on run. The
      abort's threat model — unconsented billable automation — is **preserved**:
      consent moves from a keystroke to a signed budget line, it is not removed.
      Blocked on `b-gate-budget-preauth`.
- **AC-2:** `gates --execute` resolves at least one real class-0 and one real
  class-1 blocker end to end, with evidence appended and, for class 1, a receipt in
  the ledger. **Not met, and not meetable yet** (recorded by R2 finding 7): no live
  blocker carries `Class: 0` until step 1.3 lands, and the class-1 half needs the
  ledger `b-gate-budget-preauth` still owns. The fixtures discharge each step's own
  `verify:` clause; this criterion is a phase-level claim about the live estate and
  stays open.

### Phase 3 — Agent runs via CLI: open the delegate gate for the maintainer profile

- [~] **3.1** Maintainer decision, one line with its recommendation attached: enable
      the team surface and the delegate permission in the **maintainer profile
      only**, keeping the per-day call cap as the blast-radius bound and the existing
      code gate as the enforcement point. Consumer defaults stay off — **this is not
      a default flip, it is one profile's setting.** Blocked on
      `b-delegate-gate-maintainer-profile`.
- [ ] **3.2** Wire class-1 entries whose `run:` is an agent run through the delegate
      path, so "a particular agent run" stops being a human task.
      `verify:` the orchestration line for such a run carries the blocker id.
- **AC-3:** one estate blocker is resolved by a delegated agent run whose
  orchestration record carries the blocker id.

### Phase 4 — Liveness: gates that open must be seen

- [x] **4.1** A resume-condition probe as a standing class-0 check: for every park
      note in `later/`, parse the named condition — an artifact, step or roadmap
      reference — test its status, and list the FIRED ones in the gate output under
      a dedicated section. The `request-scoped-rule-load` case is the regression
      fixture, because it is a known-fired condition with a known-unresumed file.
      `verify:` the probe detects that fixture case, and a park note whose condition
      is genuinely unmet is not listed.
      **Done 2026-08-17.** `src/agent-src/scripts/resume_probe.ts`, rendered by
      `agent-config gates` as a `FIRED` section and carried in `--json` as
      `resumeFired` / `resumeUndecidable` / `resumed`. `--reply` deliberately does
      not carry it: ADR-222 fixes that form at exactly one decision, and a fired
      resume condition is a file that can move, not a decision anyone owes.
      Live result: **1 fired** — the `request-scoped-rule-load` fixture — 1 unmet,
      42 undecidable of 44 park notes.
      **The first live run reported 8 fired, and 7 of those were wrong.** That is
      recorded rather than quietly fixed, because the false-positive shapes are the
      finding. Two causes, each now a regression fixture: (a) `**Trigger:**` is a
      *provenance* idiom in this tree — "spun out of `road-to-x`" — so accepting it
      as a dependency marker resumed notes on evidence that said nothing; the probe
      narrows to `blocked until` / `resume when`, deliberately narrower than
      `lint_roadmap_later_disposition`, which answers the different question of
      whether a condition is *recorded*. (b) the condition ran on past the next
      bolded field into `**Origin:**`, turning every roadmap a note *credits* into
      a claimed dependency — fixed with the same terminate-at-the-next-field rule
      `_blockerField` already uses.
      A compound condition (`BOTH`, `AND`, an enumerated list, or two tracks joined
      by `+`) now reads **undecidable**, never fired: the probe can read the
      roadmap-reference conjunct and not the rest, and claiming the whole condition
      on one third of the evidence is the over-report this step exists to avoid.
      **42 of 44 undecidable is published, not hidden.** The coverage line prints
      on every run, so "no condition has fired" can never be confused with "the
      probe could read 2 of 44 conditions" — the gate-that-scans-nothing shape.
      **The R2 review then found a third and fourth over-read and a false
      negative the fix for one of them created** (findings 5, 6, 14). The step id
      matched anywhere on a checkbox line, so `- [x] **1.4** raise the cap from
      2.0 to 2.1` decided the verdict for step 2.1; it is now anchored to the
      label position. The marker was searched over the whole file, so body prose
      could become the condition; it is now restricted to the blockquote, with
      fenced examples blanked. And `COMPOUND_RE` shipped without the `i` every
      sibling regex carries — **fixing that alone immediately broke the probe in
      the other direction**, because an ordinary "and" in the prose *after* the
      condition read as a second conjunct and the one genuinely fired note
      dropped out. The discriminator that makes the case-insensitive test safe is
      `conditionClause`: park notes bold the condition and explain it afterwards,
      so the analysis reads the bolded span and treats the paragraph after it as
      commentary. Both directions are now fixtures.
- **AC-4:** the probe runs in the recurring pass owned by
  `road-to-estate-drawdown` Phase 4, and the fixture case is detected.

## Blockers

### blocker: b-gate-budget-preauth
- **Status:** open
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** Phase 2 step 2.3, and therefore every class-1 execution. Steps 2.1
  and 2.2 ship the class-0 path and the render path without it. Also blocks the
  over-budget half of 2.1's `verify:` clause and AC-2's class-1 half: both need a
  budget to compare against, and this entry is where that budget is decided.
- **What to do:** decide the standing budget shape for class-1 gates. Options:
  (a) register a per-run and a per-week cap as settings keys, with the append-only
  receipt ledger as the audit surface — the recommended shape, because a per-run cap
  alone is not a spend bound; (b) require a fresh named budget per gate, which keeps
  today's friction but makes the receipt trail explicit; (c) decline
  pre-authorisation entirely, in which case class 1 collapses into class 2 and every
  billable gate keeps needing a keystroke. Note what must not change either way: the
  terminal abort's threat model is unconsented billable automation, so any bypass
  must be ledger-bound, single-use and blocker-scoped.
- **Recommendation:** **option (a) — per-run and per-week caps with the receipt
  ledger.** It is the only option that actually removes the couriering while keeping
  a real spend bound: a per-run cap alone bounds one mistake, not a week of them.
  Option (b) preserves today's friction for every billable gate, which leaves the
  defect in place while adding a ledger. Option (c) collapses class 1 into class 2
  and makes the four-class taxonomy a three-class one — defensible, but it gives up
  the class where the mechanism has the most to offer.
- **If you do nothing:** every billable gate keeps needing a keystroke, the live
  trigger eval keeps blocking three roadmaps, and class 1 exists on paper with no
  mechanism behind it. Phase 2 still ships the class-0 path, so the estate gets the
  free half of the acting layer and none of the paid half.
- **Answer:** ACCEPTED 2026-08-20 — **option (a), per-run and per-week caps with the
  receipt ledger**, via option (a) of `road-to-estate-drawdown` blocker
  `b-consolidated-decision-sheet`
  ([drain-blocker-dispositions-b](../evidence/council/drain-blocker-dispositions-b.md)),
  which sets the caps at USD 5 per run and USD 25 per rolling seven days. Audited and
  accepted with the reason stated, because this is the most consequential accepted
  default on the sheet: it removes a per-action human keystroke on billable gates. What
  makes it acceptable rather than a Hard-Floor waiver is that it is BOUNDED and audited
  — a named per-run cap, a named rolling-week cap and a receipt ledger — and reversible
  by lowering either number to zero. A per-run cap alone would bound one mistake and not
  a week of them, which is why (a) beats (b). No spend is authorised until the settings
  keys and the ledger path exist.
- **Resolved when:** one option is recorded at this blocker and — for (a) or (b) —
  the settings keys and the ledger path exist.

### blocker: b-delegate-gate-maintainer-profile
- **Status:** open
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** Phase 3 step 3.1 and therefore 3.2.
- **What to do:** decide whether to enable the team surface and `allow_delegate` in
  the maintainer profile only. Options: (a) enable both in the maintainer profile,
  keeping `max_calls_per_day` as the blast-radius cap and the code gate as
  enforcement; (b) enable the team surface but leave `allow_delegate` false, which
  permits consultation but no delegated writes; (c) leave both off, in which case
  Phase 3 closes and class-1 agent runs stay human-typed. Consumer defaults are not
  in scope for any option — the settings schema's own describe text states the
  two-gate contract, and this decision moves one profile, not a default.
- **Recommendation:** **option (a) — enable both in the maintainer profile.** The
  blast-radius controls already exist and are unchanged by this: the per-day call
  cap, the code gate as the enforcement point, and the orchestration ledger as the
  audit trail. Option (b) permits consultation but not delegated writes, which
  leaves "a particular agent run" a human task — the exact class Phase 3 exists to
  remove. Note what makes (a) low-risk here specifically: it moves one profile's
  setting, not a shipped default, so no consumer install changes.
- **If you do nothing:** class-1 entries whose `run:` is an agent run stay
  human-typed, so the acting half of the gate layer is missing precisely where the
  work is largest. `road-to-estate-drawdown`'s recurring pass (its Phase 4) has no
  delegate path to run on and cannot exist.
- **Answer:** PULLED OUT of option (a) — 2026-08-20, disposition **transferred**. This
  is the one rendered default on the consolidated sheet that fails the
  conservative-and-reversible audit on its own content, not merely on Rule 3. Default
  (a) enables `allow_delegate`, a STANDING grant of delegated write authority to an
  agent path; a standing authority expansion is not self-reversing and is not what a
  blanket accept-all was authorising, so option (a) does not reach it. The council's own
  batch-B row in
  [drain-blocker-dispositions-b](../evidence/council/drain-blocker-dispositions-b.md)
  independently narrows this entry to **option (b)** — enable the team surface for
  consultation, keep `allow_delegate: false` — and that is the preferred choice recorded
  inside this transfer. Three-point check: original criterion verbatim, `one option is
  recorded at this blocker, and for (a) or (b) the profile carries the setting with the
  cap named`; dependent steps moved, Phase 3 step 3.1 and through it 3.2, and with them
  `road-to-estate-drawdown` step 4.1, which has no delegate path to run on; re-entry
  producer, the gate-autonomy maintainer writing the profile, probe: the maintainer
  profile carries the team surface enabled with `allow_delegate: false` and the per-day
  call cap named. The stub belongs to this roadmap's own closure.
- **Resolved when:** one option is recorded at this blocker, and for (a) or (b) the
  profile carries the setting with the cap named.

### blocker: b-estate-prose-pass-from-1-3
- **Status:** RESOLVED 2026-08-17 — all three carry a recorded decision, which is
  the bar this entry set. **(a)** the dropped spend cap is decided, fixed, and
  **merged — PR #1406, in this tree since `ad23aab7e`**; verified at HEAD, both
  taskfiles forward `{{.CLI_ARGS}}` and the guard test is present. This line has
  been wrong in both directions in one day, which is why it now names the commit
  instead of a relative event: the first version said "fixed in its own change"
  while the fix was on a sibling branch outside this ancestry, which asserted tree
  state and was wrong (R2 finding 1, critical). The sibling search widened the fix
  from the one target that lied to all **3** sites of the construct, since the
  passthrough is inert without trailing args and fixing one of three would be the
  fixed-one-instance failure. **(b)** the twelve are reclassified to what their
  text supports — **not** a blanket downgrade: five are genuine consent calls and
  seven are human-only, so five gates that rendered "nothing to execute" now
  render an answerable consent block. Measured: `{2: 22, 3: 28}` before, `{2: 27,
  3: 23}` immediately after, and `{2: 26, 3: 23}` at HEAD once this entry itself
  resolves out of the population — 49 open records, 48 with an authored field and
  only the synthesised `legacy` note left on the default. **(c)** the class-2
  recommendation prose is accepted as advisory, and re-measuring it corrected the
  reading rather than the number: over the 26 live class-2 entries, **16 exceed
  the 156-char bar, 10 carry no `Recommendation:` at all, and 0 carry a usable
  one** — so § 4's "one line and one yes away from resolved" describes zero
  entries, not 21 (R2 findings 3–5). Per-entry table, the taxonomy gap
  `utilization-sweep-window` exposes, and the measured effects:
  `agents/evidence/analysis/gate-class-sweep-2026-08-17.md` § 4d.
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** nothing in this roadmap — every step here is closed or spend-gated.
  It exists because step 1.3 surfaced three estate-level findings that this branch
  deliberately did not act on, and R2 finding 4 is right that a paragraph in an
  evidence file is a note rather than a discharge: without an entry here, nothing
  renders them in `agent-config gates` and nothing counts them.
- **What to do:** decide each of the three independently. (a) **The dropped spend
  cap** — `taskfiles/bench-ab.yml` runs `bench_ab_task_runner` for `bench:ab:live`
  with no `{{.CLI_ARGS}}`, unlike its sibling one target up, so the
  `task bench:ab:live -- --budget <N>` that `road-to-surface-consolidation`'s
  `benchmark-spend` entry authorises silently falls back to the parser default of
  `2.0` (`src/scripts/bench_ab_task_runner.ts:911`). Fix is one interpolation;
  the decision is whether it lands here, on `road-to-surface-consolidation`, or as
  its own change. (b) **The twelve class-0/1 entries** — their swept verdict is not
  materialisable (sweep § 4c), so they sit at the absent-field default of 3 while
  the table says 0 or 1. Either reclassify them in the tree to match what their
  entries can actually run, or leave the default standing and let § 4c carry the
  discrepancy. (c) **The eleven over-length class-2 recommendations** — each
  exceeds the renderer's own 156-char consent bar, whose remedy is reclassification
  to 3 rather than a longer line. Either rewrite the eleven to one line, reclassify
  them, or accept the overflow as advisory.
- **Recommendation:** **(a) as its own change, (b) reclassify, (c) accept for now.**
  (a) is a one-line spend-safety fix on a cost-bearing path and should not ride in a
  documentation PR where a reviewer would skim it. (b) because a field that
  contradicts its own evidence table is the exact half-truth this roadmap exists to
  remove — and reclassifying *down* to 3 is the safe direction, never up. (c) last,
  because it is prose in eleven other roadmaps, the notice is advisory, and the
  overflow predates this work; it is a real reading-load defect but the cheapest of
  the three to defer.
- **If you do nothing:** the spend cap stays silently wrong, so an operator who
  names a budget gets a different one on a paid path. Twelve entries keep declaring
  a class their text cannot support, which is the shape `gates --execute` was built
  to stop. And the class-2 half keeps rendering paragraphs where the taxonomy
  promises one line, so the reading-load defect § 0 set out to remove survives
  inside the class meant to absorb it.
- **Resolved when:** each of (a), (b) and (c) carries a recorded decision at this
  blocker — a fix, a deferral with a reason, or an explicit accept.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-17 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Budget pre-authorisation becomes a blank cheque | product | A standing budget removes the per-run keystroke that currently bounds spend; without a second bound, one runaway loop spends the week's allowance | Per-run **and** per-week caps, append-only receipts, and over-budget always escalating to consent rather than proceeding; the ledger is reviewable in one file | Phase 2 |
| 2 | An agent misclassifies a class-3 gate as runnable | product | The whole safety story rests on classification, and a class-3 gate executed as class 0 is precisely the Hard-Floor breach the anti-goals forbid | Class is **authored** in the blocker and linted, and class 3 is the absent-field default — misclassification requires a reviewed edit, never a runtime judgment | Phase 1 |
| 3 | The preauthorised-budget bypass leaks into unrelated automation | implementation | A flag that turns off an abort is a flag someone will reach for elsewhere; a general bypass would void the abort's purpose | Ledger entries are single-use, blocker-bound and expiring; the flag without a valid entry behaves exactly like today's abort | Phase 2 |
| 4 | Opening the delegate gate increases uncontrolled spawn cost | implementation | Delegated runs spawn work outside the session's own accounting, and the estate has already measured that dispatch telemetry was near-empty for a long period | The per-day call cap stays, the orchestration ledger records each dispatch, and the dispatch-economy metrics are the standing watchdogs | Phase 3 |
| 5 | Class-2 questions regrow into today's reading load | product | The defect being fixed is reading load; a mechanism that emits many class-2 lines recreates it under a new name | They land only on the single decision-sheet surface, with defaults and an accept-all path; a class-2 gate that cannot state a one-line question and a default gets **reclassified to 3, not verbosified** | Phase 2 |
| 6 | The classification sweep's pre-registered share is chosen to be met | product | A sweep that sets its own expectation after looking at the blockers proves nothing about the premise it claims to test | Step 1.2 requires the share to be stated as a number before Phase 2 starts, and names the falsification outcome — a low share shrinks Phase 2 rather than being explained away | Phase 1 |

## CUT list — do not re-litigate

- **Automating merges, pushes, deploys, kernel edits, or the DPO signoff.** Hard
  Floor and inherited anti-goals; class 3 by construction. Cut.
- **A resident autonomy daemon.** Same verdict that killed the dispatcher daemon.
  Everything here is one-shot CLI. Cut.
- **Council as an override for class 3.** Judge and decision independence stay; the
  council decides only inside the configured reversible classes. Cut.
- **Removing the terminal abort.** It is replaced by an equivalent consent artifact,
  never deleted. Cut.

## Honest-null consequence

If the Phase-1 sweep shows the estate is genuinely decision-heavy — a small share
in classes 0 and 1 — the "couriered commands" framing is retired in public, Phase 2
ships as a thin convenience only, and the drawdown campaign leans on the
consolidated decision sheet instead. The numbers decide which lever carries the
weight.
