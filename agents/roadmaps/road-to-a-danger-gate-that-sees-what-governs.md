---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-self-modification-that-a-council-must-pass
    relation: extends
    note: "That roadmap builds the ratification review and binds a record to its subject. This one repairs the merge gate ADR-282 added after it, so a run that merges on the owner's word cannot land a change to the gated surface on two clearing seats. Its subject binding, review mode and wider watch list stay there; step 5.2 adds one dated note and edits none of its steps."
  - slug: road-to-authority-routing-mechanism
    relation: extends
    note: "Its Phase 3 builds the authenticated owner authorisation the amended ADR-281 depends on. Until that exists, Phase 1 here hands every gated-surface pull request to the owner instead of letting a council clearance stand in for it. Its approver registry, verifier and open blocker stay there; step 5.2 adds one dated note."
  - slug: road-to-typed-grants-that-persist
    relation: disjoint
    note: "Keeps the retirement of the tool-call deny and the object-bound prod_merge grant. Nothing here touches the deny, the grant or the ruleset."
estate_offset_exempt: "No active roadmap could be archived, parked or merged to offset this one. Archiving was rejected because none of the seven active roadmaps at d41121927 is complete. Parking one in later/ was rejected because that would label a roadmap that is not blocked as blocked. Merging into road-to-self-modification-that-a-council-must-pass was rejected because that roadmap owns the ratification gate and this one owns the merge gate ADR-282 added without a roadmap; merging into road-to-authority-routing-mechanism was rejected because its Phases 2 and 3 are held by an owner blocker none of these steps needs."
---
# Road to a danger gate that sees what governs

> **Source:** `agents/tmp.old/inbox-2026-10-h/` — a transcript reviewing pull
> requests #2251 and #2256, plus three supplied plans written in that
> conversation. One of them was withdrawn by its own author in favour of
> another inside the transcript; the third came from an external reference.
> Every claim below was re-verified at `main` @ `d41121927` on 2026-10-11, and
> the classifier figures were reproduced by replaying the trunk's own
> classifier over first-parent history.

## Goal

A run that merges on the owner's word cannot land a change to what governs the
package as `routine`, cannot be classed by code the change itself rewrote,
cannot merge a change to the gated surface on a council clearance the amended
ADR-281 says is only advisory, and cannot merge on a clearance given for a
different head. The owner sees a pull request only when it changes the
reviewer or the gated surface, or when a seat found it dangerous — and then as
one decision-ready block, never as a stream of questions.

## Prerequisites

- [x] Read `docs/decisions/ADR-282-auto-merge-authority-with-a-council-danger-gate.md`
      and `agents/evidence/owner-directives/2026-10-07-round-7a2e1c.md`. They
      are the owner's ruling this roadmap builds on and does not reopen.
      verify: `test -f agents/evidence/owner-directives/2026-10-07-round-7a2e1c.md` -> 0
- [x] Read `docs/decisions/ADR-281-council-confirmed-self-modification.md`
      § Amendment (`:216-231`). It is the later owner act Phase 1 applies.
      verify: `grep -c 'advisory until authenticated owner' docs/decisions/ADR-281-council-confirmed-self-modification.md` -> /^[1-9]/
- [x] Re-read `src/scripts/classify_merge_risk.ts` and § 9a of
      `src/domains/git/pr/merge/command.md` at execution time. The line numbers
      below are the pin's, not the day's.
      verify: `grep -c 'SELF_SURFACE_RE' src/scripts/classify_merge_risk.ts` -> /^[1-9]/

## Context

The owner's ruling (directive `:20-29`, ADR-282 `:55-76`): with an explicit
auto-merge instruction a routine pull request merges with no review; one that
counts as destructive or dangerous goes to the AI council first; both seats
"not dangerous, owner review unnecessary" merges it; dangerous, split,
degraded or no council hands it to the owner. The same afternoon the owner
amended ADR-281: for a gated or learning-originated package
self-modification, a favourable council verdict is **advisory until
authenticated owner authorisation is bound to the same digest**, and changes
to the reviewer or its trust chain are owner-reserved — "neither an agent nor
a council may waive that reservation" (ADR-281 `:226-231`, commit
`f76e83e47`). ADR-282 defers to ADR-281 for anything ADR-281 gates (`:153`).
Five places where the tree does not yet do what those two records say:

**D-1. The gate classes governance texts and the reviewer as `routine`.**
Reproduced at the pin, range mode, read-only:
`classify_merge_risk --range 82a131feb^..82a131feb` (the merge that landed
ADR-281 and rewrote the ratification contract and the consumer template)
prints `verdict: routine`. So do `f76e83e47` (the amendment of an ADR with
`reopen_policy: owner`) and `bbe5b73be` (the council's modification-review
modules, `_lib/ratification_subject.ts` and 50 lines of the ratification
contract — all on ADR-281's owner-reserved reviewer list, ADR-281 `:101-106`).
The triggers are the gated surface, CI, security, deploy and infra tokens and
the gate's own four files (`src/scripts/classify_merge_risk.ts:188-203`); the
one decision record they know is named by number (`:99-100`). ADR-282 calls
such a miss a reportable defect, not a tuning question (`:26-29`).

**D-2. The change supplies the code that classes it.** § 2 of the merge
command checks the pull request out (`src/domains/git/pr/merge/command.md:146-150`)
and § 9a runs that tree's copy of the classifier (`:478-481`). The workflow
step of the ratification gate records why self-watching buys nothing when the
head's code judges, and runs the base revision's copy instead
(`.github/workflows/consistency.yml:907-916`, `:920-949`).

**D-3. ADR-282's council clearance cannot pass a gated-surface change, and the
gate does not know it.** A pull request touching the gated surface is
`needs-council` (`classify_merge_risk.ts:194-202`), and § 9a merges it on two
clearing seats (`command.md:494-497`). Under the amended ADR-281 that clearance
is advisory until an authenticated owner authorisation is bound to the digest;
an auto-merge sentence is neither authenticated nor bound to a digest, and the
channel that would be does not exist yet (ADR-281 `:260-266`;
`road-to-authority-routing-mechanism` Phase 3).

**D-4. A clearance names no head and has no reader.** § 9a says to record the
prompt and both verdicts under `agents/evidence/` (`command.md:494-495`). There
is no shape, no head and no reader; § 9 binds the merge to the manifest head
(`:505-508`), which this run's own pushes move (`:120-134`). No clearance
record has been committed since ADR-282 landed, although the replay below
classes seven of the 39 first-parent commits since then `needs-council`.

**D-5. The bypass route has no closing and lacks the evidence the owner
already chose.** The contract makes one red check an emergency and names the
owner's own forge bypass as the route (`docs/contracts/ratification-artifact.md:216-221`,
`:522-536`). Restoring and verifying are steps with no date and no reader
(`:225-228`). The owner decided on 2026-10-07 that a bypass records reason,
subject digest, time and commit, and is reviewed by a council after the fact
(`road-to-authority-routing-mechanism` decision D3); the contract's record
step still lists incident, control, reason, revision and timestamp only
(`:222-224`). A bypass actor stood from 2026-09-11 to 2026-09-12 and the
acting account is an administrator (`src/config/platform-anchor.json`,
`threat_model_note`).

**Not a defect.** #2256 landed with its own gate classing it `needs-council`
and no clearance in its diff: it introduced the gate, and the owner ordered its
merge in the same message (directive `:31`). That is sound exactly once.

**What the gate costs, reproduced.** Replaying the pin's classifier over
first-parent history since 2026-09-07 00:00 +02:00 at `edd18fea6`: 365
commits on 23 days with a merge, 116 `needs-council` (median 5 per day with a
merge, at most 12, none on 3 days); triggers 49 governance surface, 40 CI
workflow, 38 deploy or release, 25 security surface, 8 merge authority, 1
removed directory, with overlap. The same replay at `d41121927` reads 404
commits, 123 `needs-council`, 51 governance surface. The 49 governance-surface
commits are the population Phase 1 moves from `needs-council` to
`needs-owner`; how many more the new triggers add is what step 5.1 measures.
The replay script is not committed; step 5.1 commits the reader.

## Constraints — read before any phase

1. **The owner's two bounds, from the transcript, are the acceptance bar:**
   do not put more on the owner than the trust boundary needs, and do not let
   anything become unsafe or destructive. Every step either makes the gate see
   more, makes its verdict harder to forge, or states a limit; none adds a
   review to a `routine` pull request.
2. **ADR-282 is not reopened.** Routine pull requests keep merging on the
   owner's word with no review.
3. **No enforcing git hook and no workflow change.** ADR-254 removed the hook
   by owner decision, and ADR-282 placed the gate in the command.
4. **No record is rewritten.** ADR-281, ADR-282 and the council records stay
   as they landed.
5. **Neighbours are told, not edited.** Step 5.2 adds dated notes and changes
   no step, blocker field or decision in another roadmap.
6. **Phases 1 to 4 do not depend on each other.** Phase 1 closes what a run can
   reach today and runs first.

## Phase 1 — The gate sees what governs, and hands it to the owner

- [x] **1.1 Six triggers join, two of them read from lists that already
      exist.** In `classifyChanges`:
      a file under `docs/decisions/` whose frontmatter at base or at head
      declares `reopen_policy: owner` (28 records at the pin), which replaces
      the one record named by number at `:99-100`;
      a rule file, source or projection, whose id is a member of
      `src/config/rule-consequence-class.json`, read through
      `readConsequenceClass` (`src/scripts/_lib/rule_consequence_class.ts:48`);
      the contract `docs/contracts/ratification-artifact.md`;
      the council — `src/scripts/ai_council/`, `src/scripts/council_*.ts`,
      `src/scripts/_lib/council_*.ts`, the `ai-council` skill and the rules
      `council-availability` and `evaluator-independence`;
      the carriers of the merge rule — the two files under
      `src/agent-src/contexts/execution/` that ADR-282 changed,
      `src/scripts/refusal_envelope.ts` and the council record § 9a's prompt
      cites; and the consumer template `src/agent-src/templates/AGENTS.md`.
      Each trigger prints the rule it comes from, as the existing ones do. A
      frontmatter that cannot be read fires the trigger.
      verify: `./scripts-run src/scripts/classify_merge_risk --range f76e83e47^..f76e83e47` -> /needs-(council|owner)/
      Positive control: the same command at `d41121927` prints `verdict: routine`.
      `corrected-from-reproduction` (2026-10-15, at `085ec41ff`): 26 records
      declare `reopen_policy: owner`, not 28. Seven trigger ids, not six: the
      reviewer's trust chain of 1.2 is its own `reviewer-trust-chain`, and it
      also carries `src/config/rule-consequence-class.json`, the list the
      classifier now reads — editing it changes a classification as surely as
      editing the code. Only `docs/decisions/ADR-*.md` is read for a policy;
      `INDEX.md` and the sweep notes carry no frontmatter and would otherwise
      fire on every regeneration. The consequence class is the union of both
      sides, so a head can add a member but never drop one.
- [x] **1.2 The gated surface and the reviewer go to the owner, not to the
      council.** A third verdict, `needs-owner`, exit 2, above
      `needs-council`. It fires on the existing `governance-surface` trigger —
      the amended ADR-281 makes a council clearance of that surface advisory
      (decision D2) — and on the reviewer's trust chain, stated as one explicit
      list: the classifier, the two commands that call it and ADR-282 (the
      pin's `merge-authority-surface`), the modules the classifier imports
      (`check_kernel_edit_ratified.ts` and `_lib/rule_consequence_class.ts`),
      the council trigger of 1.1, `src/scripts/_lib/ratification_subject.ts`,
      the contract, and the record § 9a's prompt cites. § 9a gains the row:
      `needs-owner` is never sent for clearance; the pull request is recorded
      `unauthorized` and handed over through step 3.4.
      `corrected-from-reproduction`: the supplied plan sent only the reviewer
      to the owner and left the gated surface on the council path; the
      amendment it predates closes that path.
      `corrected-from-reproduction` (2026-10-15): `owner-reserved-decision` is
      also `needs-owner`, not `needs-council`. AC-1 requires the amendment
      `f76e83e47` to print `needs-owner`, which the step list as written could
      not produce, and `reopen_policy: owner` reserves the reopening to the
      owner — a council clearing an edit to such a record would be the council
      reopening it. An unreadable frontmatter therefore also reaches the owner.
      verify: `npx vitest run tests/scripts/classify_merge_risk_needs_owner.test.ts` -> 0
- [x] **1.3 Every new trigger has a test that was red first, and the trunk's
      own misses are fixtures.** One case per trigger of 1.1, one per member
      class of 1.2, the precedence of the three verdicts, and a replay of four
      recorded commits: `82a131feb` and `bbe5b73be` print `needs-owner`,
      `edd18fea6` (#2256) prints `needs-owner`, and a documentation-only commit
      prints `routine`.
      Done 2026-10-15: the documentation-only fixture is `7b236a00f`. The four
      replays read the repository's own history and skip, by name, on a
      shallow clone; every path they exercise is also a hand-written case.
      Seen red: 34 of 74 cases failed with the new triggers and the third
      verdict neutralised in place.
      verify: `npx vitest run tests/scripts/classify_merge_risk.test.ts` -> 0

*Exit: 1.1 to 1.3 are green. This change edits the gate, so the pin's gate
classes it `needs-council` and the gate of 1.2 classes it `needs-owner`; it
lands by the owner's act. Rollback: revert; the gate returns to the pin's
triggers, which is D-1 and D-3.*

## Phase 2 — The code that classes a change is not the change's own

- [x] **2.1 § 9a runs the base revision's classifier.** The command
      materialises the manifest's `base_sha` in a detached worktree and runs
      that copy with `--root` on the head, as the ratification gate's workflow
      step does (`.github/workflows/consistency.yml:920-949`). The
      consequence-class list and the `reopen_policy` frontmatter at base are
      read from the same base tree. A base without the classifier, or a
      worktree that cannot be made, is `needs-owner` and says why; it is never
      a skipped gate and never a fall back to the head's copy.
      `corrected-from-reproduction` (2026-10-15): the base copy runs in range
      mode on the manifest's `base_sha...head-sha`, not on the PR number, so it
      judges exactly the heads § 1 recorded; and it runs through the head's
      `node_modules/.bin/tsx` directly, not `./scripts-run`, because that
      dispatcher (`src/scripts/run.ts`) is the head's code too and could swap
      the script it runs. A last line that is not a verdict is also
      `needs-owner`. The base list and frontmatter need no separate read: the
      base copy reads both revisions itself (1.1). Bootstrap: the trunk's copy
      has no `needs-owner`, so it classes the change that introduces it
      `needs-council` — sound exactly once, as the ratification gate's own
      bootstrap branch records. After the council review
      (`agents/evidence/council/danger-gate-review.md`): the block validates
      that exit status and last line agree on one verdict, removes its worktree
      on every path, resolves its temp directory to a real path, and hands a
      head that tracks `node_modules` over as `runtime-unverified`. The tests
      run the block as shipped. Owner decision 2026-10-15 (D11): a changed
      dependency manifest is `needs-council`, not `needs-owner`; the base copy
      now runs first on `node --experimental-strip-types` with no
      `node_modules`, falling back to the checkout's `tsx` only where that
      cannot run, and a manifest change in that fallback trusts no answer
      below `needs-owner`. That needed `_lib/ratification_subject.ts` free of
      parameter properties, which type stripping cannot carry. The bootstrap
      is unchanged: the trunk's copy still classes this change `needs-council`
      (its own closure cannot be stripped, so it runs on `tsx`), the copy it
      introduces classes it `needs-owner`.
      verify: `grep -c 'base_sha' src/domains/git/pr/merge/command.md` -> /^[3-9]/
- [x] **2.2 The property has a test, including the downgrade attack.** A
      fixture repository whose head deletes the `governance-surface` trigger
      from the classifier: the head's copy prints `routine`, the base's copy
      run with `--root` on the head prints `needs-owner`. A second fixture
      whose head narrows `classifyPaths` so a kernel rule falls out of the
      gated set prints `needs-owner` from the base.
      Done 2026-10-15: the fixture is a `--shared` clone of this repository
      whose base commit carries the working tree's classifier, so the real
      import closure judges. Both halves are asserted — the head copy prints
      `routine`, which proves each fixture is a real attack. Seen red with the
      base run pointed at the head copy.
      verify: `npx vitest run tests/scripts/classify_merge_risk_base_revision.test.ts` -> 0
- [x] **2.3 The command's evals cover it.**
      `src/agent-src/commands/evals/git-pr-merge.json` gains three cases: a
      pull request that edits the classifier is classed from the base and
      handed over; a `needs-owner` pull request is never sent to the council;
      a `routine` one merges with no review, as before.
      `corrected-from-reproduction` (2026-10-15): `git-pr-merge.json` is a
      routing eval — each case is a prompt and the command it should reach —
      and cannot express any of the three behaviours. They are pinned instead
      as text over the command's danger gate and the process-full Iron Law,
      seen red against the trunk's command text (4 of 5; the `routine` row is
      unchanged by design).
      verify: `npx vitest run tests/scripts/pr_merge_danger_gate_command.test.ts` -> 0

*Exit: 2.1 to 2.3 are green. Rollback: revert the command change; § 9a runs
the tree's copy again, which is D-2.*

## Phase 3 — A clearance names the head it cleared, and a hand-off is one block

> **Status, 2026-10-15** — Phases 1 and 2 and step 5.2 shipped in one pull
> request; Phases 3, 4 and step 5.1 remain open. Phase 4 edits
> `check_platform_anchor`, which the ratification gate watches, so it needs its
> own ratification record; 5.1 tallies the clearance records Phase 3 creates.

- [ ] **3.1 One writer and one reader for a clearance, read from the council's
      own session record.** `src/scripts/merge_clearance.ts` writes
      `agents/evidence/merge-clearances/pr-<N>-<head>.md` from the session
      record the council run saved (`src/scripts/ai_council/response_record.ts`
      shapes it: provider, model, text), never from text the run types: the
      pull request, the full head and base revisions, the classifier's verdict
      and triggers, the digest of the prompt, and per seat the provider, the
      model, the digest of the reply and one of `clear`, `dangerous` or
      `no-final-verdict` read from that reply — a digest, never the reply's
      text, so no transcript enters the tree. The outcome is derived and never
      typed, by the discipline `deriveRatificationHeader` keeps
      (`src/scripts/_lib/ratification_artifact.ts`): any `dangerous` seat gives
      `dangerous`; fewer `clear` providers than `required_providers` in
      `src/config/ratification-policy.json` gives `not-cleared`; otherwise
      `cleared`. The record carries `assurance: recorded` and says in one line
      what that does not prove (decision D6). `--check <N>` exits 0 only when
      a record exists whose head is the pull request's live head and whose
      derived outcome is `cleared`.
      verify: `npx vitest run tests/scripts/merge_clearance.test.ts` -> 0
- [ ] **3.2 The command merges on the check, not on the run's reading.** § 9a
      writes the record through 3.1, and § 9 merges a `needs-council` pull
      request only after `--check` exits 0 for the manifest head. A push after
      the clearance moves the head and voids it; § 9a runs again. The record is
      committed with the drain's summary, so writing it does not move the head
      it names. The test set carries three attack fixtures: a typed `CLEAR`
      string with no session record, a record for an earlier head, and a record
      whose recorded outcome disagrees with its seats — each exits non-zero.
      verify: `grep -c 'merge_clearance' src/domains/git/pr/merge/command.md` -> /^[2-9]/
- [ ] **3.3 The evidence contract knows the type.**
      `docs/contracts/evidence-artifact-types.md` and `lint_evidence_artifacts`
      gain `merge-clearance`, so an added record that does not parse is a
      finding.
      verify: `npx vitest run tests/scripts/lint_evidence_artifacts.test.ts` -> 0
- [ ] **3.4 A hand-off is one decision-ready block, at the end of the run.**
      § 9 of the merge command ends a drain that handed anything over with one
      block "Held for you": per pull request its number, title, verdict and
      triggers, the seats and their reasons where a council ran, the head it
      was judged at, and how the change is undone. The run asks nothing about
      a held pull request while it works, and a pull request with a
      `dangerous` seat is listed under its own heading. The block is the shape
      `docs/contracts/ratification-artifact.md` § When the user decides
      already gives (`:515-520`), reused rather than restated.
      verify: `grep -c 'Held for you' src/domains/git/pr/merge/command.md` -> /^[1-9]/

*Exit: 3.1 to 3.4 are green. Rollback: revert; a clearance is free prose
again, which is D-4.*

## Phase 4 — A bypass carries the evidence the owner chose, and a closing

- [ ] **4.1 The bypass record has a place and the owner's fields.** The record
      § Emergency use already requires (`docs/contracts/ratification-artifact.md:222-230`)
      lives under `agents/evidence/bypass-records/` and carries what decision
      D3 of `road-to-authority-routing-mechanism` fixed — reason, subject
      digest, time, commit, and the after-the-fact council review — plus
      `restore_by`, `restored_at` and the ruleset version identifiers before
      and after the bypass, which the forge reports and the platform anchor's
      notes already cite for the 2026-09-11 episode. The contract adds that a
      run never changes the ruleset for this route on any instruction.
      `corrected-from-reproduction`: the supplied plan asked for the forge's
      audit event to be read in CI; the endpoint needs the repository
      `administration` permission no workflow token carries
      (`src/config/platform-anchor.json`, `enforcement_boundary_note`), so the
      record cites the ruleset versions instead.
      verify: `grep -c 'restore_by' docs/contracts/ratification-artifact.md` -> /^[1-9]/
- [ ] **4.2 A reader notices a bypass that did not close.**
      `check_platform_anchor` fails while a committed bypass record is past
      `restore_by` with no `restored_at`, and while one has no council review
      recorded seven days after `restored_at`. The contract keeps saying what
      that check is: local and voluntarily invoked.
      verify: `npx vitest run tests/scripts/check_platform_anchor_open_bypass.test.ts` -> 0

*Exit: 4.1 and 4.2 are green. Both edit files the ratification gate watches,
so each lands with a ratification record and by the owner's act. Rollback:
revert; the record loses its fields and the reader its check.*

## Phase 5 — The owner's load is a number

- [ ] **5.1 A reader reproduces § Context's table and adds the column it
      lacks.** `src/scripts/report_merge_gate_load.ts` replays the classifier
      over first-parent history from a pin back to a timestamp and tallies the
      clearance records by outcome. It emits
      `agents/evidence/analysis/merge-gate-load-2026-10.md`: commits per
      verdict, the split by trigger, the per-day median and maximum, the
      hand-offs to the owner by cause — `needs-owner`, a `dangerous` seat, a
      split, no council — and the caveat that the pin's path sets are applied
      to the whole window. #2251 (`82a131feb`) and #2256 (`edd18fea6`) are
      named rows. It counts and names commits and pull requests only, never a
      prompt or a reply. A re-run at the same pin and timestamp is
      byte-identical. It is a reader and exits 0.
      verify: `npx vitest run tests/scripts/report_merge_gate_load.test.ts` -> 0
- [x] **5.2 The neighbours are told.** One dated note in
      `road-to-self-modification-that-a-council-must-pass` beside its Phase 4,
      and one in `road-to-authority-routing-mechanism` beside its Phase 3, each
      naming this roadmap and what it changed for that file's reader.
      verify: `grep -l 'road-to-a-danger-gate-that-sees-what-governs' agents/roadmaps/road-to-self-modification-that-a-council-must-pass.md agents/roadmaps/road-to-authority-routing-mechanism.md | wc -l` -> /^2$/

*Exit: 5.1 and 5.2 are green. Rollback: delete the evidence file and the
notes; nothing reads them.*

## What this roadmap deliberately does not do

- It does not change who may merge a routine pull request, and it adds no
  review to one.
- It builds no credential, no approver registry and no verifier, and it does
  not decide how the owner authorises a `needs-owner` pull request. That is
  Phase 3 of `road-to-authority-routing-mechanism`; until it lands, the owner
  merges or names a held pull request himself.
- It does not bind a ratification record to its content, add the
  modification-review dispatch or widen the ratification gate's watch list.
  Those are Phases 2 to 4 of `road-to-self-modification-that-a-council-must-pass`.
- It does not merge the ratification review and the danger-gate clearance into
  one council pass. That needs the subject binding first.
- It does not attest a council seat beyond `recorded` (decision D6) and does not
  add a mechanical authority-delta classifier (decision D7).
- It does not touch ADR-282's Part B on host-classifier refusals.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | A run merges on the owner's word; a flagged change goes to the council first and to the owner on a dangerous seat, a split, a degraded quorum or no council | directive `agents/evidence/owner-directives/2026-10-07-round-7a2e1c.md:20-29`; ADR-282 `:55-76` | the owner reopens ADR-282 |
| D2 | critical-technical | evidence | A pull request touching the gated surface is `needs-owner`, not `needs-council` | ADR-281 § Amendment `:228-231` makes a favourable council verdict advisory until authenticated owner authorisation is bound to the digest; ADR-282 `:153` defers to ADR-281; an auto-merge sentence is neither; it tightens a floor and reopens no lock; measured 49 of 365 commits at `edd18fea6` | `road-to-authority-routing-mechanism` Phase 3 ships an authenticated owner authorisation bound to the digest — a gated change carrying it may then route `needs-council` |
| D3 | critical-technical | evidence | A change to the reviewer's trust chain is `needs-owner` | ADR-281 `:103-106` and `:229-231`; `agents/evidence/council/authority-routing-20261007.md` on provider diversity not establishing independence | step 5.1 shows this class is most of the hand-offs, or the owner narrows it to the reviewer's code |
| D4 | reversible-technical | evidence | Governance is read from `reopen_policy: owner` and the consequence-class list; four further surfaces are named with their rule | the pin names one record by number (`classify_merge_risk.ts:99-100`) and classed `82a131feb`, `f76e83e47` and `bbe5b73be` routine | a governance text lands as `routine` that neither list nor the four cover |
| D5 | deterministic | evidence | The classifier runs from the base revision | `.github/workflows/consistency.yml:907-916` records the same defect and fix for the ratification gate | — |
| D6 | reversible-technical | agent | A clearance is read from the council's session record and labelled `assurance: recorded`; runner- or provider-attested seats are not built here | while a run holds a credential that merges with no clearance at all (ADR-282 `:130-131`; `platform-anchor.json` `enforcement_boundary_note`), an attested seat closes nothing a forged one opens; the external anchor the owner chose is the forge reviewer of `road-to-authority-routing-mechanism` D7 | the run's credential stops being able to merge without the forge reviewer |
| D7 | reversible-technical | agent | No mechanical authority-delta classifier | once D2 holds, `ratified` and `confirmed-non-expanding` both end at the owner for the gated surface, so a misread label no longer changes the route; the contract already chose the decidable stronger rule (`ratification-artifact.md:588-594`) | a route appears on which the label decides who authorises |
| D8 | reversible-technical | agent | The bypass route is kept and given a closing and the owner's evidence fields, not withdrawn | the owner chose it (ADR-281 § 5; decision D11 of `road-to-self-modification-that-a-council-must-pass`; D3 of `road-to-authority-routing-mechanism`) | the owner withdraws the route |
| D9 | reversible-technical | agent | No forge label and no workflow step; the gate stays in § 9a | ADR-282 placed it there (`:62-64`); ADR-254 removed the enforcing hook | another host needs the classification without the command |
| D10 | deterministic | evidence | Closure scan at authoring: its 28 owner-question hits are the word "merge" in a plan about the merge gate; no step performs a merge, a push or a ruleset change. The one act that is the owner's is how each phase lands — every Exit line names it, because each phase edits the gate, the merge command or a ratification-watched file | `./scripts-run src/scripts/closure_scan` on this file, 2026-10-11; the Exit lines of Phases 1 to 4 | a step is added that merges, pushes or changes the ruleset itself |
| D11 | product-owned | owner | A change to a dependency manifest or lockfile is `needs-council` (trigger `dependency-manifest`), never `needs-owner` on that ground alone; the base copy runs on a package-free runtime where Node strips types, and only where it cannot does a manifest change fall back to the checkout's `tsx`, trusted for nothing below `needs-owner`. Residual: on a Node without type stripping, a head that installed its own `tsx` can turn a gated change paired with a dependency bump from `needs-owner` into `needs-council (runtime-uncertain)` — never into `routine` | owner chat answer "2" on PR #2375, 2026-10-15, relayed by the run's coordinator; the merge command's danger gate § Residual risk | the owner reopens it, or a CI or host Node without type stripping becomes where merges run |

## Kill register

| ID | Killed | Why |
|---|---|---|
| K1 | The owner names every reserved pull request before it merges | The owner ruled the other way the same morning: no review for routine, council first for the rest (directive `:20-27`); D2 hands over only the gated surface |
| K2 | The council reviews every auto-merge | Rejected by the owner in ADR-282 (`:135-136`) |
| K3 | A waiting period after which a held change lands unless the owner objects | A timeout is never consent (`src/agent-src/templates/roadmaps.md` rule 20) |
| K4 | A required check that writes an `owner-reserved` label on the forge | Needs a workflow change and a write scope the gate does not need (D9); the classification in § 9a reaches the same pull requests |
| K5 | Withdrawing the bypass route | It reverses an answer the owner gave (D8); what it lacked was a closing |
| K6 | An object-bound merge grant built from the owner's sentence | Already the manifest: the target set is snapshotted per invocation and bound to heads (`command.md:113-134`), an owner-directive record grants nothing (ADR-282 `:86-90`), and `process-full` merges per pull request through `/pr:merge <N> --merge` |
| K7 | A kill switch that returns the gate to shadow mode | No such toggle is introduced, so there is nothing for it to fail open |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The owner is handed too much | product | Forty-nine governance-surface commits in 23 merge days is about two a day; an owner handed that much approves without reading, which is the failure the authority-routing record names. | D2 and D3 state their narrower readings and what reopens them; 3.4 makes every hand-off one block at the end of a run; 5.1 reports hand-offs by cause so the widest cause is visible. | Phase 1 — The gate sees what governs, and hands it to the owner |
| 2 | The base worktree cannot run | implementation | A base revision without dependencies, or a worktree that cannot be made, leaves the gate with no verdict; falling back to the head's copy is D-2 again. | 2.1 makes that case `needs-owner` with its reason, and 2.2 tests the fallback is not taken. | Phase 2 — The code that classes a change is not the change's own |
| 3 | The frontmatter read is wrong in one direction | implementation | A reader that fails open classes an owner-reserved record as routine; one that fails closed flags every decision record. | 1.1 fires the trigger on an unreadable frontmatter, and 1.3 carries a case for it. | Phase 1 — The gate sees what governs, and hands it to the owner |
| 4 | A recorded clearance is still forgeable | product | The session record lives under `agents/runtime/` and a run can write it; `assurance: recorded` is not proof a seat said it. | Stated in the record itself (3.1) and in D6 with the condition that reopens it; the merge path that matters most — the gated surface — no longer rests on a clearance (D2). | Phase 3 — A clearance names the head it cleared, and a hand-off is one block |
| 5 | Two clearing seats are wrong | product | The gate is a heuristic over paths and the council is a model; a dangerous change can be cleared. | Out of this roadmap's reach and stated as such; 3.1 makes each clearance readable afterwards, and ADR-282's review trigger covers the miss. | Phase 3 — A clearance names the head it cleared, and a hand-off is one block |

## Acceptance Criteria

- [x] AC-1 — The trunk's classifier classes the changes that landed ADR-281,
      its amendment and the modification-review modules as `needs-owner`, and
      a documentation-only change as `routine`.
- [x] AC-2 — A pull request that edits the classifier is classed by the base
      revision's copy.
- [ ] AC-3 — No `needs-council` pull request merges without a clearance record
      for the head that merges, and no gated-surface pull request merges on a
      clearance at all.
- [ ] AC-4 — Every hand-off of a drain reaches the owner as one block at the
      end of the run, and no `routine` pull request gained a review step.
- [ ] AC-5 — A committed bypass record carries the owner's evidence fields and
      a closing date, and an overdue one reds `check_platform_anchor`.
- [ ] AC-6 — The owner's hand-offs are a committed number with its command,
      its pin and its timestamp.
- [ ] AC-7 — No hook and no workflow was added or changed, and no step,
      blocker field or decision in another roadmap was edited.
