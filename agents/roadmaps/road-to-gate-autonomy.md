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
      with the four-class table. Eight new tests in
      `tests/scripts/lint_roadmap_blockers.test.ts` cover both directions including
      the class-2/3 and absent-class negatives; 25/25 green.
      **The check is HARD, not ratcheted, and the reason is worth recording:** the
      field is opt-in, so on the day it ships no entry declares a class and the rule
      fires on nothing. There is no backlog to grandfather, so the "strict gate reds
      ~283 files" failure the decidability half had to design around does not arise.
      **Pre-existing red, NOT caused here and not fixed here:** the sibling
      decidability ratchet reads 28 against a baseline of 26 on a pristine tree.
      None of the 28 is in this roadmap, every one is in another roadmap's blocker
      section, and this worktree's scope lock does not own those files.
- [ ] **1.2** One classification sweep over the 38 live blockers, each verdict a
      table row: blocker, class, run-or-decision text, reason. **Pre-registered
      expectation, to be falsified rather than assumed:** a substantial share land
      in class 0 or 1. If the sweep finds far fewer, the "gates are mostly couriered
      commands" premise is published as weaker than it felt and Phase 2 shrinks
      accordingly.
      `verify:` the sweep table is committed, every open blocker appears in it, and
      the share is stated as a number before Phase 2 starts.
- **AC-1:** every open blocker carries a class; the lint enforces `run:` on classes
  0 and 1; the sweep table is committed with its share.

### Phase 2 — `gates --execute` (the acting half)

- [ ] **2.1** New mode on the existing command. Class 0: run the `run:` command,
      capture output, append the unblock evidence into the roadmap file at the
      blocker — the same in-file done-note discipline every phase already uses — and
      mark it resolved. Class 1: check the budget ledger, run under it, write the
      receipt, same evidence append. Over budget, or ledger absent, renders the
      class-2 consent line **instead of running**.
      `verify:` an end-to-end fixture per class, including the over-budget path
      rendering rather than executing.
- [ ] **2.2** Class 2 emits its one-line consent question with recommendation and
      default into the decision-sheet surface — `road-to-user-out-of-the-loop`
      Phase 1 owns that surface, and this roadmap only feeds it. Class 3 is
      render-only, exactly today's behaviour.
      `verify:` a class-3 blocker's output is byte-identical to today's.
- [~] **2.3** The live-trigger-eval hard-abort gains a preauthorised-budget flag
      that refuses without a valid unspent ledger entry and spends it on run. The
      abort's threat model — unconsented billable automation — is **preserved**:
      consent moves from a keystroke to a signed budget line, it is not removed.
      Blocked on `b-gate-budget-preauth`.
- **AC-2:** `gates --execute` resolves at least one real class-0 and one real
  class-1 blocker end to end, with evidence appended and, for class 1, a receipt in
  the ledger.

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

- [ ] **4.1** A resume-condition probe as a standing class-0 check: for every park
      note in `later/`, parse the named condition — an artifact, step or roadmap
      reference — test its status, and list the FIRED ones in the gate output under
      a dedicated section. The `request-scoped-rule-load` case is the regression
      fixture, because it is a known-fired condition with a known-unresumed file.
      `verify:` the probe detects that fixture case, and a park note whose condition
      is genuinely unmet is not listed.
- **AC-4:** the probe runs in the recurring pass owned by
  `road-to-estate-drawdown` Phase 4, and the fixture case is detected.

## Blockers

### blocker: b-gate-budget-preauth
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 2 step 2.3, and therefore every class-1 execution. Steps 2.1
  and 2.2 ship the class-0 path and the render path without it.
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
- **Resolved when:** one option is recorded at this blocker and — for (a) or (b) —
  the settings keys and the ledger path exist.

### blocker: b-delegate-gate-maintainer-profile
- **Status:** open
- **Owner:** user
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
- **Resolved when:** one option is recorded at this blocker, and for (a) or (b) the
  profile carries the setting with the cap named.

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
