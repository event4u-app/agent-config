---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: >-
  Receiver roadmap for ADR-260 § Consequences, which records that its §§ 2-3 name mechanical
  work with no receiver in the estate. Three stems land the set; this is one of them, and the
  owner recorded their precedence in ADR-268 § 11 on 2026-09-08. Also grows open_blockers by
  two, both ordering constraints that close inside Phase 0.
estate_offset_exempt: >-
  First of three receiver roadmaps that land as one set. No active roadmap can be offset
  against them: none of the eight covers the authority model, and the set exists because
  ADR-260 Consequences records its own sections 2-3 as having no receiver in the estate.
  Archiving an unrelated roadmap to buy the slot would be the gate-gaming this key exists to
  make visible instead. Owner-recorded precedence, ADR-268 section 11, 2026-09-08.
design_validated: >-
  Owner rulings of 2026-09-08 transcribed in ADR-268 §§ 1-6; ADR-260 §§ 2-3 (2026-09-07);
  ADR-262 (2026-09-08).
capability_gap: none
---
# Road to typed grants that persist

> **Source:** `agents/tmp.old/inbox-2026-09-w/` — an inbox round carrying two challenge-me
> interviews with the owner (eight questions and fifteen) plus three generations of
> consolidated proposals over them. Verified against `main@399beecab` on 2026-09-08; the
> proposals' own pin was `e9d5202` and no authority surface moved between the two.

> **Proposal, not adopted — but its authority is decided.** This file is the receiver roadmap
> for **ADR-260 §§ 2-3**, which the ADR itself records as unauthored, and it carries the
> 2026-09-08 owner rulings that ADR-260 did not yet know — persistence, the standing-setting
> grant source, auto-resume, ratified self-amendment and the PR-close evidence class. Those
> rulings are **accepted** as ADR-268, owner-directed on 2026-09-08, so no phase here waits
> on a decision any more; what remains is the ordering constraint in Phase 0.2 and the work
> itself.
>
> **ADR-268 § 0 is the outcome this roadmap serves, and it is `protected_dimensions: purpose`.**
> A council may narrow any mechanism below — raise an evidence bar, shorten a grant, add a
> ladder rung, add an op to the typed vocabulary. It may not put a person back into the
> per-step loop for a reversible operation, and it may not reverse the outcome. § 0 carries
> the table that decides which of the two a proposed change is.

## Goal

One grant object — ADR-260's `{op, target, scope, granted_by, span, expires}` — governs every
irreversible operation, is honoured for the whole mission it names, survives fixes, syncs and
interruptions, and is revoked only by the owner. Everything outside ADR-260's eleven-op
vocabulary carries no question and no grant. Merge authority, recorded by ADR-239 § 3 as
*undecided, not rejected*, is decided. The five kernel rules that encode the per-step-owner
premise are rewritten — and the run that rewrites them is not denied by the guard it is
rewriting.

## Reproduced, on this tree at `399beecab`

Every row was re-read at HEAD on 2026-09-08. Where the proposals cited a path that has since
moved, the corrected path is the one below.

| ID | Fact | Where |
|---|---|---|
| D1 | Hard Floor row *"Push to remote — any `git push`"*, with confirmation required *"on this turn — not a previous turn, not a roadmap, not a standing autonomy directive"* | `src/rules/non-destructive-by-default.md:26,33` |
| D2 | ADR-260 § 2 decision 11 narrows the Hard Floor's push/commit rows to the vocabulary — decided, not landed; D1 is unchanged | `docs/decisions/ADR-260-…md:88-97` |
| D3 | One-shot authorisation: *"Create the PR" is spent on the initial branch + commit + push + PR; the next change waits for a new instruction* | `src/rules/commit-policy.md` § One-shot authorization |
| D4 | Git ops permission-gated; `NEW TASK → FRESH CONFIRMATION` | `src/rules/scope-control.md` § Git operations; `src/rules/autonomous-execution.md` § Task-scope |
| D5 | `personal.autonomy` template default is `auto`; ADR-260 § 3 decided it ships `on` — not landed | `src/config/agent-settings.template.yml:342` |
| D6 | `process-full` *"THIS COMMAND NEVER MERGES. THERE IS NO FLAG THAT MAKES IT MERGE."*; the `--merge` flag was removed and the policy question recorded as undecided | `src/domains/product-basic/roadmap/process-full/command.md:155-176` |
| D7 | `check_no_automerge_key.ts` is a namespace ratchet on `autoMerge`/`auto_merge`/`mergePolicy`, whose own text says the owner deletes it deliberately once the decision is made | `src/scripts/check_no_automerge_key.ts` |
| D8 | ADR-254 removed the git-authorization enforcement; the classifier now measures only | `src/scripts/hooks/git_command_classifier.ts:5`; `src/scripts/git_authorization_hook.ts:8` |
| D9 | Interrupt rule: *STOP → run new task → ASK before resume*, *NEVER SILENTLY RESUME* | `src/rules/user-interrupt-priority.md` § The Iron Law |
| D10 | Six halt conditions, declared exhaustive; Hard-Floor and security-sensitive end the whole run under `--all` | `src/domains/product-basic/roadmap/process-full/command.md:218-247` |
| D11 | ADR-255 § 4 refuses all four governance-self-amendment deletions; `block_kernel_rule_writes.ts` denies kernel-rule edits at tool-call time; a ≥ 24 h soak is required between consecutive kernel PRs | `docs/decisions/ADR-255-…md` § 4; `src/scripts/hooks/block_kernel_rule_writes.ts`; `src/agent-src/contexts/authority/kernel-rule-edits.md` § The guarantee |
| D12 | Five of the nine kernel rules are the ones this roadmap rewrites: `ask-when-uncertain`, `commit-policy`, `no-cheap-questions`, `non-destructive-by-default`, `scope-control` | `docs/contracts/kernel-membership.md` |
| D13 | `staged_confirmation` is a declaration only and binds on no host | `src/scripts/schemas/command.schema.json:257` |
| D14 | Nine `OWNER_ROUTING` phrases are counted, never enforced | `src/agent-src/scripts/stub_queue.ts:33` |
| D15 | The ADR frontier moved four times while this set was being written. The proposals said `ADR-264`; 264 and 265 landed, then 266 (`explicit-pr-merge-invocation`, PR #1949) and 267 (`delivery-default-for-claude-code`, PR #1923). This record is **ADR-268**, verified free on `origin/main` and in the only open PR at renumber time | `ls docs/decisions` on `origin/main` |
| D16 | Estate: 8 active roadmaps at the drafting pin, floor 8 at `origin/main`, `open_blockers` floor 43 — the proposals asserted 8 and 10 in different generations. Re-measure before promotion; `origin/main` moved 85 commits since | `./scripts-run src/scripts/check_estate_count` |

## What this roadmap is NOT

- **Not a second authority vocabulary.** ADR-260 § 2's eleven ops are the floor; this file adds
  fields to the grant object and lands the rule edits ADR-260 scheduled.
- **Not merge-by-default.** `delivery.merge` ships `off` at every level.
- **Not a rewrite of history.** Superseded records get lineage pointers, never edits.
- **Not host enforcement.** The daemon, the forge protection and the per-host destructive
  column belong to `road-to-adversarial-verification-and-long-runs`.
- **Not the ownership routing table.** That is `road-to-decision-closure` Phase 0.

## Phase 0 — ADR-268, and the guard that would deny it

- [x] **0.1 Carry ADR-268 to accepted.** Done 2026-09-08, owner-directed in the drain session
      itself. The record at
      `docs/decisions/ADR-268-mission-scoped-authority-persistence-and-ratified-self-amendment.md`
      reads `status: accepted`, `protected_dimensions: [purpose, governance]`, and its
      § Status records how it was ratified — the drafting run wrote `proposed` and refused to
      accept it, per § 4's ban on the gaining party recording its own ratification, and the
      owner then directed acceptance. ADR-255 and ADR-239 carry the reciprocal
      `superseded_by` pointers, each scoped to the superseded section.
      verify: `grep -m1 '^status:' docs/decisions/ADR-268-*.md` reads `accepted`;
      `./scripts-run src/scripts/check_adr_frontmatter` reports no errors;
      `./scripts-run src/scripts/adr/regenerate_index --dir docs/decisions` writes the index
      with no unresolved supersession. All three ran green on 2026-09-08.
- [ ] **0.2 Cross the kernel guard once, legitimately.** The first PR under this roadmap that
      edits a kernel rule is authored in the maintainer's own session, or lands after Phase 5.2
      has replaced the tool-call deny with the CI gate — whichever comes first. Reason: D11 and
      D12 together mean the guard refuses this roadmap's own execution on the one host that
      honours a deny.
      verify: the kernel-touching PR either carries a maintainer-authored commit, or
      `check_kernel_edit_ratified` exists in `ci-fast` and passes on it.

**Exit:** ADR-268 accepted — done — and the kernel crossing decided, which is the one open
item. Phases 1-6 may run once 0.2 is chosen.

## Phase 1 — Land ADR-260 §§ 2-3 in the rule layer

- [ ] **1.1 `non-destructive-by-default.md`: the trigger table becomes the eleven ops.**
      Delete the bare `git push` row and the "this turn" clause on the prod-merge row. Keep
      *never act while asking* and the exact-object clause verbatim — a narrowed floor is
      still a floor. `enforced_by:` names the Phase 4.3 gate.
      verify: `grep -c 'this turn' src/rules/non-destructive-by-default.md` returns 0, and
      `grep -c 'never act while asking' src/rules/non-destructive-by-default.md` still
      returns at least 1.
- [ ] **1.2 `commit-policy.md`: the Iron Law becomes grant-shaped.** *Commit when a mission
      grant covers it, in logical chunks. Never ask about committing.* § One-shot
      authorization is retired for mission-covered operations and retained for chat without a
      mission; exception 4 becomes `granted_by: roadmap:<slug>`.
      verify: a fixture run under a mission grant produces commits with zero authorisation
      questions, and the same fixture without a mission still hits the one-shot fence.
- [ ] **1.3 `scope-control.md`: separate mission capabilities from WARN ops.** Branch create,
      switch and update, task-branch push, base sync and conflict resolution become mission
      capabilities. PR **close**, rebase of a pushed branch and branch **delete** become WARN
      ops carrying Phase 3.3's evidence triple. Force-push to a shared trunk stays a typed op.
      § Authoring-vs-implementation stays untouched — a roadmap landing must still not start
      its own execution, and that is a fence rather than a permission gate.
      verify: `grep -c 'Authoring vs. implementation' src/rules/scope-control.md` returns 1.
- [ ] **1.4 `autonomous-execution.md`: the default flips and the opt-in detection goes.**
      `personal.autonomy` ships `on`, `auto` resolves to `on` with a migration note. The
      task-scope fresh-confirmation section and the opt-in detection contexts are deleted.
      The N=3 block becomes a pointer to `execution.fix_loop_max`, owned by stem 3.
      verify: `grep -m1 'autonomy:' src/config/agent-settings.template.yml` reads `on`;
      `./scripts-run src/scripts/lint_no_dead_context` is green after the context deletions.
- [ ] **1.5 `ask-when-uncertain.md`: the philosophy line yields to ownership.** *One question
      too many beats one wrong assumption* is replaced by a pointer to the ownership routing
      table, and the nine vague-request triggers are scoped to chat without a mission.
      verify: a mission fixture with twelve seeded technical ambiguities produces zero owner
      questions; the same twelve outside a mission still trigger the vague-request path.
- [ ] **1.6 `no-cheap-questions.md`: collapse the exception list.** Iron Laws 4-6 and
      self-check items 8-14 become one clause — *under a mission, a question the contract
      already answers is forbidden*. Body stays under 40 lines.
      verify: `wc -l src/rules/no-cheap-questions.md` is at most 40, and
      `./scripts-run src/scripts/check_always_budget` is green.
- [ ] **1.7 `tool-safety.md` becomes consequence-aware.** Per ADR-260 § 3 decision 12, a
      wildcard tool grant is a finding only where the wildcard can reach a typed op.
      verify: the three wildcard-grant findings in `src/scripts/lint_skill_frontmatter_safety.ts`
      demote to advisory for grants that reach no typed op, and stay blocking for grants that do.

## Phase 2 — Settings and the roadmap carry the grant

- [ ] **2.1 A `delivery:` settings block, avoiding the three names D7 forbids.** `merge`
      (`off` | `on-green`, default `off`), `wait_for_ci` (default `true`), `pr_topology`
      (`single` | `stacked`, default `single`). Resolvable user-global and per project;
      project overrides user; roadmap frontmatter overrides both. `stacked` is never chosen by
      the agent and never asked about at roadmap creation — the owner plans it or it does not
      happen.
      verify: `agent-config settings:get delivery.merge` reports `off` and the file it came
      from; `./scripts-run src/scripts/check_no_automerge_key` stays green against the new key.
- [ ] **2.2 Roadmap template accepts the block.** An optional `delivery:` frontmatter block;
      a `## PR plan` section required if and only if `pr_topology: stacked`.
      verify: a fixture roadmap declaring `stacked` without `## PR plan` is rejected by the
      roadmap frontmatter lint, and one declaring `single` is accepted without it.
- [ ] **2.3 Correct the template's absolute sentence.** *No mode lifts a safety floor* is true
      for the eleven typed ops and false for pushes and non-prod merges; the sentence is
      rewritten to say which.
      verify: the sentence names the vocabulary rather than "a safety floor" in the abstract.

## Phase 3 — Persistence, interrupts, and WARN-op evidence

- [ ] **3.1 The grant ledger gains `expires` and `revoked_by`.** A follow-up push, a CI fix, a
      base sync, a conflict resolution or an unrelated owner question does not write to it.
      Revocation is an owner sentence naming the op or target, or a replacement mission.
      verify: fixture G1 — a mission grant survives three CI fixes and one base sync and is
      spent exactly once, on the final head; fixture G12 — *do not merge* mid-run sets
      `revoked_by` and the run ends open-green.
- [ ] **3.2 `user-interrupt-priority.md` gains three interrupt classes.** A clarification is
      incorporated and the run continues; a side task pauses the mission and the mission
      auto-resumes; only stop, replace or revoke changes mission state. An interrupt never
      revokes a grant, a delivery target or a closed decision.
      verify: fixture G11 — a side task mid-run is executed and the mission resumes with the
      grant intact and no *continue?* question emitted.
- [ ] **3.3 WARN ops execute on evidence, never on a gate.** `branch-delete`, `pr-close` (a new
      GitOp — the classifier has no such op today) and a history rewrite on unpushed work each
      require the triple recorded in the PR body or run log: superseded, no unique work lost,
      recoverable. Signals consulted are commit age, open PRs on the path, active branches,
      CODEOWNERS and worktree state. Recency raises the bar; it never blocks. Missing evidence
      routes to the ladder.
      verify: fixture G13 — a fully superseded foreign PR closes with the triple recorded;
      fixture G14 — a foreign PR carrying unique work does not close and routes to the ladder.
- [ ] **3.4 Rewrite the halt table.** The six halts of D10 become: a typed op without a grant
      → one native ask naming the object, then continue; council-off → the second-model rung →
      owner confirmation of the agent's proposal; a security-sensitive surface → evidence plus
      a council record, continue unless a typed op is reached; scope discovery → the ownership
      table; the fix-loop bound → the recovery ladder; an unenumerated conflict → the semantic
      resolution ladder. Terminal `BLOCKED` only per ADR-268 § 7. The FORBIDDEN-NON-HALT list
      stays and gains *retry count reached*.
      verify: `grep -c 'retry count reached' src/domains/product-basic/roadmap/process-full/command.md`
      returns 1, and the six-halt claim in that file is replaced rather than left contradicted.

## Phase 4 — Merge delivery, decided

- [ ] **4.1 Activate `/pr:merge` behind the ledger.** Forge auto-merge once required checks are
      green and the merge state is clean, keeping ADR-239 § 4's `observed_head` re-read and the
      superseded-PR check. A direct merge only where the forge exposes no auto-merge and
      `doctor` recorded that. Without a grant: stop at green, clean and open, and say which.
      verify: fixture G5 grant plus green → merged; G6 grant plus red → the loop continues and
      nothing merges; G7 no grant → open-green.
- [ ] **4.2 Retire the never-merges banner.** Delete it from `process-full` and from
      `roadmap/next`, citing ADR-268 § 3 as the ruling the original text said was missing.
      Superseded evidence files gain a one-line supersession note rather than an edit.
      verify: `grep -c 'NEVER MERGES' src/domains/product-basic/roadmap/process-full/command.md`
      returns 0, and the archived drain-run evidence carries the note.
- [ ] **4.3 A gate that reads the ledger, not a prompt.** `check_typed_op_grant.ts` reads the
      ledger and the diff; a typed op — a tag push, a release-workflow edit, a protection
      change, a secret-file write — without a matching object-bound grant is red. This is the
      `enforced_by` line Phase 1.1 promised.
      verify: a fixture diff pushing a tag without a grant reds the gate; the same diff with a
      matching grant object passes.
- [ ] **4.4 Dispose of `check_no_automerge_key.ts`.** Delete it deliberately, per its own
      text, or leave it and record why. It matches `delivery.merge` either way, so this is a
      hygiene decision and not a blocker.
      verify: whichever is chosen is stated in the PR body with the gate's own sentence quoted.

## Phase 5 — Kernel amendment under ratification

- [ ] **5.1 The ratification artifact.** `agents/evidence/ratifications/<pr>.md` carrying
      `proposed_by`, `implemented_by`, `reviewed_by`, `providers`, `verdict` and
      `effective_after`. The ladder is an independent session or agent → the council, CLI-first
      → a different provider → the owner, on non-convergence or an owner-reserved dimension.
      Provider diversity is required where two providers are configured.
      verify: `agent-config council:status` reports the configured member count the artifact
      claims, and a fixture artifact whose `proposed_by` equals its `reviewed_by` is rejected.
- [ ] **5.2 Replace the deny with a gate.** `block_kernel_rule_writes.ts` retires as a
      tool-call deny; `check_kernel_edit_ratified.ts` in `ci-fast` reds a diff touching a
      kernel rule or a governance hook unless the PR carries the artifact with
      `verdict: ratified`. An authority-expanding change is additionally inert until merged
      with the artifact. The 24-hour soak retires with it.
      verify: fixture G15 — an authority-expanding kernel edit is inert before ratification and
      live after; the gate reds a kernel diff carrying no artifact.
- [ ] **5.3 Reclassify three owner-reserved rows.** In `decision-revisit-gate.md`, the rows
      *changes the project's purpose*, *governance self-amendment* and *cannot be bounded from
      available evidence* become `ratification` rather than `owner`. The four Class-1 rows stay
      owner-reserved.
      verify: the rule's own table shows exactly three `ratification` rows and the Class-1 rows
      unchanged.

## Phase 6 — A generated disposition inventory

- [ ] **6.1 Generate, never hand-maintain, the disposition.**
      `src/scripts/report_autonomy_disposition.ts` emits one row per rule, command, skill, ADR,
      gate and hook with `authority_effect`, `control_class`, whether it contains an ask, stop,
      permission or retry, its `disposition` and its `replacement`. Sources are
      `ask_block_census.ts`, `probe_unblocked_ask.ts`, `OWNER_ROUTING`,
      `lint_roadmap_complexity`'s human-gate checks and the `enforced_by` frontmatter. The
      count of `legacy_human_gate` rows is registered as a ratchet, measured at this pin, and
      may only fall.
      verify: the report regenerates byte-identically on two consecutive runs over the same
      SHA, and the ratchet entry exists in `gate-violation-baselines.json`.
- [ ] **6.2 A convergence lint.** A command or skill that locally asks for permission on an
      operation the inventory classifies as normal execution is red.
      verify: a fixture command asking permission for a branch create reds the lint; the same
      command asking for a `tag_push` does not.

## Kill register

| K | Killed | Why |
|---|---|---|
| K1 | A new authority vocabulary in either proposal's shape | ADR-260 § 2 exists and § 1 of ADR-268 reproduces it |
| K2 | A `--merge` flag on `process-full` | the grant lives in the object or the setting; a per-command flag recreates the inert-switch defect the flag's own removal note describes |
| K3 | A risk score or formula over natural language | ADR-260 § 2's no-parser clause |
| K4 | A hand-authored disposition inventory | Phase 6.1 generates it |
| K5 | New CLI verbs | ADR-041 |
| K6 | Autonomy opt-in phrase detection | the default is `on` |
| K7 | Keeping the kernel deny **and** the CI gate | a deny the executing run must bypass is the shape ADR-262 retired — one mechanism |
| K8 | Per-op grant re-confirmation after fixes | ADR-268 § 2 |
| K9 | The 24-hour soak as the governance control | replaced by the ratification artifact; a window measures elapsed time, not control quality |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The floor is narrowed and nothing replaces it | implementation | Phase 1.1 deletes the `git push` Hard-Floor row and Phase 4.3's gate lands three phases later. Between them, a typed op has no mechanical check on any host — the exact gap ADR-254 created when it removed the previous guard and left the classifier measuring. | Phase 1.1's `enforced_by:` line is not writable until 4.3 exists: land 4.3 before 1.1, or land 1.1 with the row narrowed and the gate stubbed red-by-default. The PR that narrows the floor states which of the two it did. | Phase 1 — Land ADR-260 §§ 2-3 in the rule layer |
| 2 | The kernel guard denies this roadmap's own execution | implementation | Five of nine kernel rules are rewritten here and `block_kernel_rule_writes.ts` denies exactly that at tool-call time on Claude Code. A run that discovers this at Phase 1.1 has already spent a session. | Phase 0.2 decides the crossing before any Phase 1 edit, and blocker `kernel-guard-first-crossing` holds the phase until it is decided. | Phase 0 — ADR-268, and the guard that would deny it |
| 3 | A persistent grant outlives the intent that created it | product | `expires: mission-end` makes a grant survive fixes, syncs, interruptions and a context reset. An owner who said *merge it* about a two-hour task has authorised a merge twelve hours later on a head they have not seen. | The grant is spent once and only on a required-check-green, target-current, tamper-checked head; `revoked_by` accepts a bare owner sentence; the end-of-run PR body names the grant, its span and the head it was spent on, so the review the owner does at the end sees the authority it exercised. | Phase 3 — Persistence, interrupts, and WARN-op evidence |
| 4 | Ratification becomes a formality the same party performs | product | The artifact records `proposed_by` and `reviewed_by`. Where one provider is configured, the reviewer is another session of the same model — which is the party gaining the authority wearing a second name. | Provider diversity is required where two providers are configured, and 5.1's fixture rejects an artifact whose proposer equals its reviewer. Where diversity is unavailable for a critical expansion, the ladder reaches the owner rather than accepting L1. | Phase 5 — Kernel amendment under ratification |
| 5 | The generated inventory ratchets on a number nobody can move | implementation | 6.1 registers `legacy_human_gate` as a shrink-only ratchet measured at this pin. If the classifier over-counts, every later change is red for a reason the change did not cause. | The ratchet is registered in the same PR as the report, so the first measurement and the first green run are the same commit; a miscount is visible immediately rather than at the next unrelated PR. | Phase 6 — A generated disposition inventory |

## Blockers

### blocker: adr-266-acceptance
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** nothing further. It blocked every phase while the record was `proposed`, because
  the record narrows a Hard Floor and permits governance self-amendment, and § 4 forbids the
  agent from ratifying that.
- **What to do:** nothing. Resolved 2026-09-08 by the owner directing acceptance in the drain
  session; `docs/decisions/ADR-268-mission-scoped-authority-persistence-and-ratified-self-amendment.md`
  reads `status: accepted` and its § Status records the ratification path.
- **Recommendation:** none outstanding.
- **If you do nothing:** nothing — the decision is taken. The sixth arrival this blocker
  warned about is what the acceptance prevented; the arrivals counter on
  `agents/roadmaps/stubs/road-to-owner-authority-decisions.md` records five and closes there.
- **Resolved when:** `grep -m1 '^status:' docs/decisions/ADR-268-*.md` reads `accepted` — it
  does, verified 2026-09-08.

### blocker: kernel-guard-first-crossing
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 1 in full — 1.1 through 1.7 all edit kernel rules.
- **What to do:** choose one — (a) author the first kernel-touching PR in your own session;
  (b) land Phase 5.2 first, so `src/scripts/check_kernel_edit_ratified.ts` replaces the
  tool-call deny in `src/scripts/hooks/block_kernel_rule_writes.ts` before Phase 1 runs. State
  the choice in that PR's body.
- **Recommendation:** (b). It is the ordering ADR-268 § 4 argues for on its own terms — one
  mechanism rather than two — and it removes the crossing permanently instead of once. (a) is
  the right answer only if you want Phase 1 to land this week.
- **If you do nothing:** a run reaches Phase 1.1, is denied by
  `block_kernel_rule_writes.ts` at tool-call time on Claude Code, and has spent a session
  discovering a constraint recorded here.
- **Resolved when:** either a maintainer-authored kernel commit exists on the branch, or
  `src/scripts/check_kernel_edit_ratified.ts` exists and runs in `ci-fast`.

## Fixtures

`G1` mission with a grant · `G2` mission without one · `G3` a mid-run judgement question ·
`G4` a mid-run typed op · `G5`-`G7` the three merge outcomes · `G11` interrupt and auto-resume ·
`G12` revocation mid-run · `G13` a superseded foreign PR closed on evidence · `G14` a foreign
PR carrying unique work · `G15` an authority-expanding kernel edit, inert until ratified.

## Acceptance Criteria

- [ ] AC-1 — `G1`-`G15` exist under `tests/e2e/autonomy/` and are green.
- [ ] AC-2 — `ask_block_census` over the 30-session corpus reports that every remaining owner
      ask is either a typed op or owner-owned residue; no ask remains for a push, a commit, a
      CI fix or a conflict.
- [ ] AC-3 — ADR-239's `merge-authority` blocker reads `resolved` and points at ADR-268 § 3;
      ADR-255 § 4 carries a scoped `superseded_by`.
- [ ] AC-4 — the `legacy_human_gate` ratchet is registered and its count at HEAD is below the
      count measured at this pin.
- [ ] AC-5 — `personal.autonomy` ships `on` and no autonomy-detection context remains in the
      tree.
- [ ] AC-6 — a typed op with no matching grant object is red in CI on a fixture diff, so the
      narrowed floor has a mechanical replacement rather than prose.
