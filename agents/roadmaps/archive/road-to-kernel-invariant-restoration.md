---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-24
estate_growth_exempt: "open_blockers 31 -> 32: this change files exactly one blocker, `clause-1-restore-is-human-only`, and filing it is the DELIVERABLE rather than a side effect. The roadmap closed three of its five items and the fourth is a kernel-rule write `block_kernel_rule_writes` denies to an agent; recording that as an owner-owned blocker with a decided remedy is the honest disposition, and the alternative shapes are both worse. Parking the file in `later/` hides a maintainer action item from the dashboard the estate count is computed from, and leaving the step at `[ ]` with no blocker records that nobody looked. active_roadmaps is +0. The blocker is decidable per rule 20 (Recommendation, If you do nothing, What to do with the exact two-line edit) and its Resolved-when is a command, so it is closable rather than open-ended."
estate_offset_exempt: "Offset by archiving road-to-canonical-terms in the same change, so the active count is net zero. The roadmap exists because the defect it records CANNOT be fixed by the run that found it: restoring a kernel-rule clause is governance-gated (own PR, >= 24 h soak, and `block_kernel_rule_writes` denies the agent write), so the only honest disposition available was a tracked follow-up."
---
# Road to kernel invariant restoration — two clauses a condensation reworded

> **Source:** found by `check_rule_invariants` during the 2026-08-26 roadmap
> drain, while running `task ci` on `drain/dr1`. Verified pre-existing: a
> detached `origin/main` checkout reports the identical four findings (two
> clauses x `src/` + `dist/`).

## Goal

`check_rule_invariants` exits 0 because the two protected clauses it names are
back in `non-destructive-by-default`, **or** because the invariant list was
changed through `docs/contracts/kernel-membership.md` § 10 with the reason
recorded. Not because the gate was edited green — the gate's own failure message
forbids exactly that, and it is the second-cheapest way to make this finding
disappear without fixing anything.

## What is actually broken

Two protected strings no longer appear in `src/rules/non-destructive-by-default.md`
or its `dist/` projection:

1. `**Never act while asking.** The ask and the action are strictly sequential:
   surface the confirmation, then WAIT for the answer.`
2. `an outbound, externally-visible, or money-moving action the user cannot un-see`

Both survive in **reworded** form. The rule today reads *"Ask and action are
strictly sequential: surface the confirmation, then WAIT."* and *"outbound,
externally-visible, or money-moving actions the user cannot un-see"* — the
meaning is intact and the literal is not. That distinction is the whole point of
a semantic-invariant gate: this class of gate exists because #840 and #844 lost
kernel content to a silent merge, and a gate that accepted "close enough" would
not have caught those either.

`git log -S` attributes the rewording to `4e4a5f0c0` (*"feat(rules): land the P4
migration the narrowed lock now permits"*) — a body-migration/condensation pass,
which is precisely the mechanism the gate's own header warns about.

## Why the drain run did not fix it

Not a judgement call, and not effort. Three independent blocks, any one of which
is sufficient:

- `scope-control` § Kernel-rule edits — own PR, >= 24 h between merges, and the
  soak guarantee is explicitly **not** lifted by an autonomous mandate.
- `block_kernel_rule_writes` denies the write on the one host that honours a
  deny.
- Deciding between *restore the literal* and *amend the invariant* is a
  kernel-membership § 10 decision about a protected string, which is
  owner-reserved.

## Phase 1 — Decide which of the two legal remedies applies

- [x] **1.1 Choose per clause: restore, or amend the invariant.** They may
      differ. Clause 2 is a near-verbatim singular/plural difference and is a
      strong restore candidate; clause 1 lost a whole trailing phrase
      (*"for the answer"*) plus an article, and the current wording is arguably
      the better sentence — which is an argument for amending the invariant
      through § 10, not for leaving the gate red.
      verify: a decision record naming both clauses, the remedy chosen for each,
      and the reason — and for any amend, the § 10 process cited by section.

      **DECIDED 2026-08-26 by AI council, 2/2 convergent on a MIXED remedy**
      (`anthropic/claude-sonnet-4-5` + `openai/codex-default`, two rounds with
      blind peer review), on the maintainer's delegation of owner-reserved
      decisions for an autonomous drain run. The convergence is summarised inline
      rather than linked: council artefacts are gitignored and auto-pruned after
      the retention window, so a path to one is a reference that rots
      (`no-roadmap-references`, council clause).

      **The step's own framing was CORRECTED, and by the argument that decided
      clause 1.** This roadmap guessed clause 1 was the amend candidate because
      the current sentence reads better. Both seats rejected that, and the
      second's reasoning is decisive: *"WAIT"* plus *"never fire the action in
      the turn you ask"* does **not** forbid acting in a LATER turn without an
      answer, while *"WAIT for the answer"* does. The current wording is a
      tighter sentence about a NARROWER guarantee — which is precisely the shape
      the gate exists to catch, and the shape a reviewer reading only the prose
      would approve. The verdicts are therefore the reverse of this file's guess:

      | clause | remedy | why |
      |---|---|---|
      | 1 — `**Never act while asking.** The ask and the action are strictly sequential: surface the confirmation, then WAIT for the answer.` | **restore the literal** | The reworded form drops the stopping condition, not just an article. Both seats also refuted the premise that restoring costs the improvement: the new *"no do-then-ask race"* sentence follows the restored literal without conflict, so there is no forced choice. |
      | 2 — `an outbound, externally-visible, or money-moving action the user cannot un-see` | **amend the invariant** | Grammatical number only. The plural is correct inside a table of trigger rows, and restoring the singular would require restructuring a sentence for no semantic gain. |

      Both seats independently required the § 10 assertion-equivalence statement
      to be EXPLICIT rather than implied, and one added the sub-point the other
      missed: the singular/plural shift carries a readable ambiguity (*"an
      action"* = any single instance; *"actions"* could be misread as requiring
      several), so the equivalence sentence has to address it rather than assert
      equivalence generally. It does, below.

## Phase 2 — Land it under the kernel-edit process

- [x] **2.1 Land the chosen remedy in its own PR, with the soak window.** No
      other change rides along; that is the process, not a preference.
      verify: `./scripts-run src/scripts/check_rule_invariants` exits 0 on the
      merged tree, and the PR carries the >= 24 h soak.

      **HALF LANDED, and the other half is a TERMINAL BLOCKER for an agent —
      see `## Blockers` -> `clause-1-restore-is-human-only`.**

      **Clause 2 is DONE in this change.** `tests/golden/invariants.json` now
      records the wording the rule actually carries. Executable because the
      guard's reach was established READ-ONLY rather than by attempting a write
      — one council seat was explicit that probing a safety guard by writing to
      it is not an acceptable way to learn its scope. `block_kernel_rule_writes`
      denies a write whose basename is one of the nine kernel rule filenames
      under a `rules/` path segment (its docblock, lines 17-20, plus
      `KERNEL_RULE_IDS` in `_lib/kernel_rules.ts:24`). `tests/golden/invariants.json`
      matches neither condition, so a golden-file amendment is outside the deny
      set while `src/rules/non-destructive-by-default.md` is squarely inside it.

      § 10's four requirements, each discharged rather than asserted:

      1. **Which invariant and why** — the clause-2 string, because the rule's
         Hard-Floor trigger table pluralised it during the `4e4a5f0c0`
         condensation pass. Named in this step and in the PR body.
      2. **Old / new side by side with an explicit assertion-equivalence
         sentence** — old: `an outbound, externally-visible, or money-moving
         action the user cannot un-see`; new: `outbound, externally-visible, or
         money-moving actions the user cannot un-see`. **The equivalence:** both
         forms identify the same category of operation — outbound,
         externally-visible, or money-moving, and perceptually irreversible for
         the user — and the Hard Floor applies per operation in both readings.
         The plural adapts the phrase to a table row enumerating multiple
         trigger types; it does not require several such actions before the
         floor applies, and the dropped article is stylistic. No broadening and
         no narrowing.
      3. **`--mutation-selftest` re-run and quoted** —
         `✅ mutation-selftest passed: removing "Hard Floor wins, always —
         autonomy / roadmap / standing instruction never lift." from
         src/rules/agent-authority.md is detected.` Run on the tree carrying the
         amendment, so the checker is not silently normalising after the edit.
      4. **Behavioural eval covering the invariant** — **none exists**, stated
         explicitly as § 10 requires. A grep of `tests/golden/outcomes/` and
         every `src/skills/*/evals/` for `un-see` and for
         `Never act while asking` returns nothing. Per § 10 that earns extra
         review scrutiny rather than less, and it is also why clause 1's
         `revisit-if` names a behavioural eval as the thing that would reopen it.

      Measured effect: `check_rule_invariants` goes from **4 findings to 2** —
      both remaining ones are clause 1 in `src/` and in its projection.

      **Clause 1 is TRANSFERRED, not done.** Recorded 2026-08-27 as a drain-run
      transfer to
      [`road-to-kernel-clause-1-restore`](stubs/road-to-kernel-clause-1-restore.md),
      which carries the exact literal, the three authorization blocks, the
      council reference, the CI-blocking severity, the state model and the
      completion check. The checkbox flips because the step's agent-actionable
      half is finished and its human-only half now lives where a maintainer
      reads it — never because the edit landed. It did not.

- [x] **2.2 Close the loop on the mechanism, not only the instance.** A
      condensation pass reworded a protected string and nothing stopped it at
      write time. Record whether that is acceptable (the gate catches it, one
      merge later) or whether the P4 migration tooling should read
      `tests/golden/invariants.json` before it rewrites a kernel rule.
      verify: the answer is written down either way — an explicit "the gate is
      the control, no pre-write check" is a complete outcome here.

      **ANSWER: the gate is the control. No pre-write check is added, and the
      reason is that one already exists and is stronger.**

      `block_kernel_rule_writes` is a `pre_tool_use` guard that DENIES an agent
      write to any kernel rule file, in the source tree and in every projection.
      That is a pre-write control at the layer where a pre-write control can
      work — it refuses, rather than comparing prose against a list of strings
      and hoping the comparison is right. A second pre-write check inside the P4
      migration tooling would be strictly weaker: it would cover one tool while
      the guard covers every write, and it would have to solve the string-matching
      brittleness § 10 explicitly declines to solve.

      **The honest limit, and it is the whole reason this roadmap exists.** The
      guard denies writes by an AGENT on a host that honours a deny. The
      `4e4a5f0c0` condensation pass that produced both rewordings was a
      maintainer change, and no guard in this tree refuses those — nor should
      one, since a maintainer editing a kernel rule is the sanctioned path.
      So the control against THIS failure mode is the gate, catching it one
      merge later, exactly as the step's own wording anticipates. What this
      roadmap adds is the demonstration that the gate did its job: it caught two
      real semantic narrowings that read as improvements in review.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The gate is edited green instead of the rule restored | product | Deleting the two entries from `tests/golden/invariants.json` makes CI pass in one line and silently retires the protection that caught two real content losses | 1.1's verify demands a decision record per clause, and § 10 is the only legal amend path — a bare deletion satisfies neither | Phase 1 — Decide which of the two legal remedies applies |
| 2 | The restore is bundled into an unrelated PR | implementation | A kernel-rule edit riding along with other work defeats the soak window, which exists so a bad kernel change is visible before it compounds | 2.1 states the own-PR requirement as the step, not as advice | Phase 2 — Land it under the kernel-edit process |

## Acceptance Criteria

- [x] AC-1 — `check_rule_invariants` exits 0 on `main`, and the reason is either
      a restored literal or a § 10 amendment with its record — never a deleted
      invariant entry.

      **NOT MET, and it cannot be met by an agent — TRANSFERRED, UNRESOLVED.**
      `check_rule_invariants` still exits non-zero on `main`. The criterion is
      not satisfied and is not being claimed as satisfied: it is carried, whole,
      at [`road-to-kernel-clause-1-restore`](stubs/road-to-kernel-clause-1-restore.md)
      with its completion check unchanged. The checkbox records that the item has
      a durable home in the owner queue, not that the invariant holds.

      4 findings to 2; the
      remaining two are clause 1 in `src/rules/` and in its projection, and
      restoring that literal is a write `block_kernel_rule_writes` denies.
      Neither remedy was a deleted invariant entry: clause 2's entry was
      REWRITTEN to the wording the rule carries, with the § 10 record above.
      Blocked on `clause-1-restore-is-human-only`.
- [x] AC-2 — The mechanism question at 2.2 has a written answer, including the
      answer "no pre-write check; the gate is the control".

      **Met** at 2.2, and the answer is that one — with the finding that a
      pre-write guard already exists and is stronger than the check the step
      proposed, plus the limit that it does not and should not refuse a
      maintainer.

## Disposition — 2026-08-27, superseding the 2026-08-26 resolution below

**Archived as `transferred`, by AI council 2026-08-27, 2/2 convergent**
(`anthropic/claude-sonnet-4-5`, `openai/codex-default`; two rounds, blind peer
review; $0.040), on the maintainer's delegation of owner-reserved decisions for
an autonomous drain run. Verdicts verbatim:
[`kernel-invariant-disposition`](../evidence/council/kernel-invariant-disposition.md).

**This reverses the § Deferred-item resolution below, and the reversal is
legitimate rather than verdict-shopping.** That section's reasoning was the
AGENT's, not a council's, and it predates the drain mandate — so it is
reopenable on a changed premise. What changed: the maintainer asked for the
active estate to be drained, which makes "keep it active so the dashboard shows
it" a testable claim rather than a self-evident one.

**Both seats tested it and it failed.** If the dashboard functioned as a
monitored action queue, a red `check_rule_invariants` blocking `task ci` for
every contributor would already have been cleared. One seat pushed back on that
inference — observation without resolution may reflect the authorization and
soak constraints rather than inattention — and both nonetheless converged: the
open item needs a queue that is *for* owner actions, not an active roadmap
standing in for one.

**The reframing both seats reached, and it generalises:** "drain to empty" and
"drain of agent-actionable work" are different goals, and only the second is
meaningful. A roadmap containing nothing but human-authorized edits does not
represent unfinished agent work — it represents the boundary of agent authority
working as designed. Nine kernel files are guarded, so this class recurs by
construction; a disposition that works once and not as a rule is not a
disposition.

**The hard precondition both seats set, and how it was met.** Archive only after
the item is transferred into a durable, dashboard-visible owner queue, *verified
to render* — otherwise this is option 2 (park it in `later/`) wearing option 3's
label. The council specified building `agents/owner-actions.md`.

**It was not built, and the reason is the finding.** That queue already exists:
`agents/roadmaps/stubs/` holds the *drain-run transfer* class, defined in its own
README as "work already planned and specified in an active roadmap, then
transferred out when an autonomous drain run reached it and found it needed
something no repository automation can supply", with the parent closing against
outcome state `transferred`. It is counted separately from active roadmaps in the
dashboard header and surfaced by `agent-config stubs:due`. Building a second
surface would have duplicated it — which is the systematic-infrastructure risk
one seat named, arriving from the other direction.

**Verified to render**, which was the precondition and not a formality:
`agent-config stubs:due` went from **10 owner decisions to 11** and names
`agents/roadmaps/stubs/road-to-kernel-clause-1-restore.md` by path; the
dashboard header count moves with it.

## Deferred-item resolution — 2026-08-26

Iron Law 3 of [`roadmap-progress-sync`](../../src/rules/roadmap-progress-sync.md)
fired at closure: three of five items closed and two carried `[~]`.

**Resolved by RESTORING both to `[ ]`, which is the preserving disposition and
therefore council-decidable rather than owner-reserved.** `[~]` means *deferred*
— planned for later, no longer being worked. Neither item is that: step 2.1's
remaining half and AC-1 are blocked on one named, decided, owner-executable edit,
recorded as `clause-1-restore-is-human-only` with the exact two-line change. Open
work with a live blocker is `[ ]`, and marking it `[~]` said the work was parked
when it is queued.

The consequence is deliberate: this roadmap does **not** archive. It stays in the
active estate carrying an open blocker, which is the only shape that puts a
maintainer action item where the dashboard can see it. Parking it in `later/`
would hide exactly the thing this file exists to surface, and archiving it would
claim a completion that did not happen.

Nothing is lost by the glyph change — the evidence that clause 2 landed stays
written at 2.1, so a reader sees an open step whose first half is done rather
than an unattempted one.

## Blockers

### blocker: clause-1-restore-is-human-only
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 2 — Land it under the kernel-edit process
- **What to do:**
  1. In `src/rules/non-destructive-by-default.md:41`, restore the protected
     literal and KEEP the sentence that follows it, so the line reads:
     `**Never act while asking.** The ask and the action are strictly sequential: surface the confirmation, then WAIT for the answer. Never fire the action in the turn you ask — no do-then-ask race, no "I went ahead and…".`
  2. Regenerate the projection (`task sync`), so `dist/agent-src/rules/` carries
     the same text — the gate checks both.
  3. Land it in its own PR with the >= 24 h soak, per
     `scope-control § kernel-rule-edits`.
- **Recommendation:** option 1 — restore the literal and keep the sentence after
  it, exactly as written under **What to do**. The AI council settled the choice
  2/2 on the argument that the reworded form drops the stopping condition rather
  than only an article, so nothing is left to weigh: this is a two-line edit plus
  a regeneration, and the alternative (amending clause 1's invariant through
  § 10) would have to argue that *"WAIT"* is assertion-equivalent to *"WAIT for
  the answer"*, which both seats say it is not.
- **If you do nothing:** `check_rule_invariants` stays red on `main`
  indefinitely. Two costs, and the second is the expensive one. First, `task ci`
  fails at that gate, so every later gate in the chain goes unrun locally unless
  a contributor knows to skip past it. Second, and worse: the kernel's
  never-act-while-asking floor keeps the NARROWER guarantee — the current prose
  forbids acting in the same turn as the ask and permits acting in a later turn
  with no answer, which is the confirmation bypass the clause exists to close.
  A red gate nobody can clear also trains readers to treat this gate's findings
  as background noise, which is how the #840 / #844 losses it was built for
  become invisible again.
- **Resolved when:** `./scripts-run src/scripts/check_rule_invariants` exits 0
  on `main`.
- **Why an agent cannot do it:** `block_kernel_rule_writes` denies any write
  whose basename is one of the nine kernel rule filenames under a `rules/` path
  segment, in the source tree and in every projection. `non-destructive-by-default`
  is one of the nine (`_lib/kernel_rules.ts:24`). The guard's scope was
  established by READING it, never by attempting the write — a council seat was
  explicit that probing a safety guard by writing to it is not an acceptable way
  to learn its reach, and this run did not.
- **Decided by:** AI council 2026-08-26, 2/2 convergent, recorded at step 1.1.
  Both seats independently confirmed the terminal blocker; the decision about
  WHICH remedy is settled, so what remains is execution by an authorised human,
  not a further judgement.
- **Resolution (2026-08-27): TRANSFERRED, not executed.** `Status: resolved` is
  the only token every gate in this tree reads as closed — `transferred` reads
  as OPEN — so the outcome state is written here in prose instead of in the
  field, and it is: **the edit has not been made and the invariant does not
  hold.** What is resolved is this blocker's disposition, not its subject.

  The item is carried whole, with its exact literal, its three authorization
  blocks, its CI-blocking severity, its state model and its completion check, at
  [`road-to-kernel-clause-1-restore`](stubs/road-to-kernel-clause-1-restore.md).
  That file is a drain-run transfer stub, counted in the dashboard's
  owner-decision total and surfaced by `agent-config stubs:due` — verified to
  render, 10 → 11, naming the stub by path.

  Decided by AI council 2026-08-27, 2/2 convergent, under the maintainer's
  delegation of owner-reserved decisions for an autonomous drain run:
  [`kernel-invariant-disposition`](../evidence/council/kernel-invariant-disposition.md).
