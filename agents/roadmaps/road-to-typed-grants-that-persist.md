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

> **STATE AS OF 2026-10-05 — read this FIRST; it supersedes the 2026-10-01 block below on the
> counts and adds three things that block found no reason to look for.** Re-counted at
> `origin/main` `6aa3c36f9` rather than inherited: **4 done · 14 deferred `[~]` · 7
> open-and-blocked `[ ]`** — step glyphs identical to 2026-10-01, so no lane moved this file in
> four days. **Acceptance criteria moved: AC-3 is now `[x]`, 5 of 6 remain open.**
> **Three findings a later run should not re-derive.**
> (1) **AC-3 was closable and is closed**, against the stricter of the two readings its sentence
> admits — the weaker limb was discharged by a one-line supersession pointer on the archived
> `merge-authority` blocker, not by amending the criterion to the reading that was already green.
> (2) **The 2026-10-01 claim that this guard denies a read-only `grep` against a kernel rule is
> FALSE and is withdrawn in place.** Both polarities were exercised on this tree: an in-place
> `sed` at a kernel path is BLOCKED, the `grep -c` runs and returns 1, and the guard's own header
> says reads stay allowed because a kernel rule is immutable rather than secret. A later session
> must not read its own successful verify command as a missing control.
> (3) **4.3 needs more than 3.1, and the delta is cheap if known in advance.** The step says
> *"3.1's persisted ledger and nothing else"*; measured, `check_gate_completeness` is already 23
> violations OVER its baseline on this branch's base, so a new gate has negative headroom and
> must import `./_lib/gate_ledger.js` from its first commit to land `ledgered` rather than as
> violation 238. Proven on the shipped `classifyGateSource` over all four polarities.
> **What has NOT changed, and was re-executed rather than read:** the kernel deny is live (fifth
> consecutive reproduction, against the real `Edit` tool), `LedgerState` is still a type with two
> references and no writer, `check_typed_op_grant.ts` is still unwritten, `personal.autonomy`
> still reads `auto`, `delivery.*` is still outside `MERGEABLE_KEYS`, and both open blockers
> stand on human forge actions. The platform anchor's green now carries a **control** — the same
> gate over an out-of-scope file reports `out_of_scope 1` and does not consult the forge — so for
> the first time its pass is falsifiable rather than merely repeated.

> **STATE AS OF 2026-10-01 — superseded on the counts by the block above; kept for its reasoning.** 4 done · 14
> deferred `[~]` · 7 open-and-blocked `[ ]`. `scanOpenSteps` reads `{open: 0, blocked: 7}`.
> **This file is not agent-executable, and that is a property of its subject rather than a
> stall.** Every remaining step either edits a kernel rule behind a deny reproduced three times
> at tool-call time, or widens the agent's own authority, or waits on a mechanism whose
> construction would do one of those two. Three facts a later run should not re-measure from
> scratch: the deny is live and was exercised this run rather than inspected; `LedgerState` is
> a type with no writer, no reader and no file, which is what holds 3.1 → 4.3 → 1.7 → 4.1 in
> that order; and `check_platform_anchor` went green again on 2026-09-28 after the 2026-09-14
> regression, which restores a precondition and performs no retirement.
> **The one step a future session should build FIRST is 4.3.** A gate that reds a typed op
> lacking a grant only ever refuses, so it cannot produce a state weaker than today's and it is
> in bounds for an agent to author — and Risk 1 wants it to exist *before* the floor narrows.
> It needs 3.1's store and nothing else, and 3.1 needs one owner decision — *who may append to
> the ledger, and what makes an append owner-attributable* — before it needs any code.
> **The 14 `[~]` glyphs are deliberate and they block archival.** They were `[ ]` until
> 2026-10-01, which meant the continuation ladder offered step 1.4 — the autonomy self-grant —
> as the next action on every autonomous fire. Restoring any of them to `[ ]` without closing
> the step re-opens that path.

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
- [ ] <!-- blocked-by: ratification-platform-anchor | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question; both residual limbs are maintainer forge actions --> **0.2 Cross the kernel guard once, legitimately.** **Attempted via option (b) on
      2026-09-09 and NOT closed.** Option (b) reads "land Phase 5.2 first, so
      `check_kernel_edit_ratified` replaces the tool-call deny before Phase 1 runs". The gate
      was built and the replacement was **refused** by a two-round independent ratification
      review — see 5.2 — so the deny still stands and the crossing is still ahead.
      The blocker's own "Resolved when" clause reads *either* a maintainer-authored kernel
      commit *or* the gate existing in `ci-fast`. The second is now literally true, and
      closing on it would be reading the letter against the purpose: the clause was written on
      the premise that the gate exists **instead of** the deny. It does not. Left open, and
      that reading is recorded here so a later run does not close it on the technicality.
      verify: unchanged — either a maintainer-authored kernel commit on the branch, or
      `block_kernel_rule_writes.ts` gone with `check_kernel_edit_ratified` in its place.
      **UPDATE 2026-09-10 — this step's own account was right and the blocker beside it was
      wrong, which is worth recording because the disagreement sat in the tree unread.**
      `kernel-guard-first-crossing` read `Status: resolved` on the claim that the deny was
      deleted; the file exists at 13,075 bytes and is bound three times in
      `src/scripts/hook_manifest.yaml`. The blocker is reopened with the false claim corrected
      in place. An AI council confirmed the reopen 2/2 and tied the crossing to the platform
      anchor: the deny may retire only once `check_platform_anchor` reads compliant, because
      retiring it moves the whole weight of kernel immutability onto a CI gate whose
      independence rests on platform controls that are measurably absent. That gate is built in
      this change and currently reds, so the crossing is not available to this run.
      **Evidence (2026-10-01) — still open, and the one input that moved does not open it.**
      The anchor no longer reds: `check_platform_anchor --as-of 2026-10-01` exits 0 with
      `PASS_WITH_ACCEPTED_RISK`, because the 2026-09-14 `required_review_thread_resolution`
      regression was repaired on the forge on 2026-09-28 (ruleset version `51122772`). So the
      sentence above — *"That gate is built in this change and currently reds"* — is no longer
      current state, which is why this note exists.
      **The crossing is still not available, for the reason that has held all along.** This
      step's `Resolved when` is unchanged and both limbs were executed this run: no
      maintainer-authored kernel commit exists on this branch, and
      `block_kernel_rule_writes.ts` is still present (11,345 bytes) with its three
      `pre_tool_use` bindings and its `concern_registry` entry intact. The deny was reproduced
      against the real tool call, not inspected. A green anchor restores a precondition the
      2026-09-10 council attached to the retirement; it does not perform the retirement, and
      this file already records that the anchor in its post-ruling shape proves nothing about
      independent review. Reading limb-1-green as *"the crossing is now available"* would be
      the same letter-against-purpose move this step was written to forestall.
      **The step stays `[ ]` rather than `[~]`** — unlike the Phase 2-6 deferrals, it carries a
      `blocked-by:` marker, so `scanOpenSteps` already excludes it and the glyph is doing no
      harm. Changing it would lose the blocker linkage for nothing.

**Exit:** ADR-268 accepted — done — and the kernel crossing decided, which is the one open
item. Phases 1-6 may run once 0.2 is chosen.

## Phase 1 — Land ADR-260 §§ 2-3 in the rule layer

> **The five kernel steps now carry the inline `blocked-by:` marker, and that is a fix rather
> than a formality — 2026-09-14.** `scanOpenSteps` in `run_continuation_hook.ts` reads
> blockedness from that marker and from **nothing else**; it never parses `## Blockers`. Before
> this change the file measured `{open: 21, blocked: 0}`, so every autonomous stop fire was
> handed step **0.2** as its next action — a Class-3 human-only decision an agent cannot take,
> and with 21 open steps behind a reproduced tool-call deny this file was the worst instance of
> that defect in the estate. After: `{open: 14, blocked: 7}`.
>
> **Which seven, and why not more.** 0.2 and 5.2 point at `ratification-platform-anchor`, the
> root blocker — `kernel-guard-first-crossing`'s own Recommendation routes the crossing there.
> 1.1, 1.2, 1.3, 1.5 and 1.6 point at `kernel-guard-first-crossing`; all five edit kernel
> members and the deny was reproduced on this tree, not assumed (see 1.1).
> **1.4, 1.7 and 4.2 are deliberately NOT marked.** A `blocked-by:` id must resolve to a
> declared blocker in the same file, and none of the three is held by one: 1.4 waits on a
> ratification artifact, 1.7 is a halt condition plus an ordering dependency on 4.3, and 4.2 is
> ordering plus reviewer independence. Inventing blocker entries for them would both grow
> `open_blockers` past what this file's `estate_growth_exempt` describes and park judgement
> calls in `## Blockers`, which `road-to-decision-closure` 2.3 retires. Their holds are recorded
> in their own step bodies instead.

- [ ] <!-- blocked-by: kernel-guard-first-crossing | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question; the deny was reproduced on this tree and only a maintainer can retire it --> **1.1 `non-destructive-by-default.md`: the trigger table becomes the eleven ops.**
      Delete the bare `git push` row and the "this turn" clause on the prod-merge row. Keep
      *never act while asking* and the exact-object clause verbatim — a narrowed floor is
      still a floor. `enforced_by:` names the Phase 4.3 gate.
      verify: `grep -c 'this turn' src/rules/non-destructive-by-default.md` returns 0, and
      `grep -ic 'never act while asking' src/rules/non-destructive-by-default.md` still
      returns at least 1.
      **The verify clause was DEFECTIVE and is corrected here — 2026-10-01.** It used to read
      `grep -c` without `-i`. The rule's own text is `**Never act while asking.**` at
      `src/rules/non-destructive-by-default.md:41` — capitalised, because it opens a sentence —
      so the lowercase pattern returns **0 at HEAD and would return 0 after a perfectly correct
      edit too**. The clause was unsatisfiable as written and would have read as "the edit
      deleted the clause it was told to keep". Measured both ways this run: `grep -c` returns
      **0**, `grep -ic` returns **1**. Only the `-i` is added; the clause's meaning is
      untouched. This is the one part of 1.1 an agent could fix, because it is a roadmap edit
      and not a kernel-rule edit.
      **DENY REPRODUCED 2026-09-14, not assumed — this is the evidence the box stays `[ ]` on.**
      The edit was attempted for real: the `this turn` clause at `:26` was to be replaced by
      *"Triggers below require an object-bound grant covering the op"*. The `pre_tool_use`
      dispatcher refused the tool call outright — *"block-kernel-rule-writes: BLOCKED — kernel
      rule non-destructive-by-default is immutable — tighten-only via the override exception
      registry"*, with the remediation naming a human action outside the agent session. No write
      reached the file: `grep -c 'this turn'` still returns 1 and `git status` is clean of it.
      So the guard is live on this tree at tool-call time, and the five kernel steps are
      unreachable for an agent by construction rather than by policy.
      **Evidence (2026-10-01). DENY REPRODUCED A THIRD TIME, on a tree where the guard's own
      file has changed since the last reading — so this is not the same measurement twice.**
      Against `origin/main` `9f2b9fb4a`, the same edit was put to the `Edit` tool: replace the
      `this turn` clause at `:26` with *"Triggers below require an object-bound grant covering
      the op"*. The `pre_tool_use` dispatcher refused it — `block-kernel-rule-writes: BLOCKED —
      kernel rule non-destructive-by-default is immutable — tighten-only via the override
      exception registry`, remediation naming a human action outside the agent session.
      Nothing was written: `grep -c 'this turn'` returns **1** and `git status --short` is empty.
      **What changed since 2026-09-14, and why it does not help.** The guard file is now
      **11,345 bytes**, down from the 13,577 that reading measured — three commits touched it
      (`b8a7037e3`, `70bc596b1`, `c271f27a8`), the last two of which ratify and correct its
      docstring. Its REACH is unchanged: the header still names all nine kernel rules and still
      denies the source tree plus every projection. `grep -c block-kernel-rule-writes
      src/scripts/hook_manifest.yaml` returns **5** where the blocker's clause requires 0 —
      the concern definition at `:198`, a comment at `:502`, and three `pre_tool_use` binding
      lists at **`:1427`, `:1459`, `:1506`** (drifted again from the `:1390/:1422/:1469` of
      2026-09-14). `concern_registry.ts` still registers it, now at **`:121`**. The manifest
      keeps moving and the binding does not — the fourth consecutive reading to reach that
      conclusion by executing the clause rather than reading the field.


- [ ] <!-- blocked-by: kernel-guard-first-crossing | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question; the deny was reproduced on this tree and only a maintainer can retire it --> **1.2 `commit-policy.md`: the Iron Law becomes grant-shaped.** *Commit when a mission
      grant covers it, in logical chunks. Never ask about committing.* § One-shot
      authorization is retired for mission-covered operations and retained for chat without a
      mission; exception 4 becomes `granted_by: roadmap:<slug>`.
      verify: a fixture run under a mission grant produces commits with zero authorisation
      questions, and the same fixture without a mission still hits the one-shot fence.
- [ ] <!-- blocked-by: kernel-guard-first-crossing | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question; the deny was reproduced on this tree and only a maintainer can retire it --> **1.3 `scope-control.md`: separate mission capabilities from WARN ops.** Branch create,
      switch and update, task-branch push, base sync and conflict resolution become mission
      capabilities. PR **close**, rebase of a pushed branch and branch **delete** become WARN
      ops carrying Phase 3.3's evidence triple. Force-push to a shared trunk stays a typed op.
      § Authoring-vs-implementation stays untouched — a roadmap landing must still not start
      its own execution, and that is a fence rather than a permission gate.
      verify: `grep -c 'Authoring vs. implementation' src/rules/scope-control.md` returns 1.
- [~] **1.4 `autonomous-execution.md`: the default flips and the opt-in detection goes.**
      `personal.autonomy` ships `on`, `auto` resolves to `on` with a migration note. The
      task-scope fresh-confirmation section and the opt-in detection contexts are deleted.
      The N=3 block becomes a pointer to `execution.fix_loop_max`, owned by stem 3.
      verify: `grep -m1 'autonomy:' src/config/agent-settings.template.yml` reads `on`;
      `./scripts-run src/scripts/lint_no_dead_context` is green after the context deletions.
      **NOT attempted 2026-09-13, and the reason is not the kernel guard.** The
      `kernel-guard-first-crossing` blocker lists this step as reachable, and as a statement
      about the FILE that is correct — `autonomous-execution.md` is not a kernel member, the
      deny does not fire on it, and the contexts this step deletes
      (`contexts/execution/autonomy-detection.md`, `autonomy-mechanics.md`,
      `autonomy-examples.md`) are referenced by no kernel rule; measured, the five kernel rules
      that mention autonomy all say only that it never lifts a floor, which stays true after the
      flip. Two other things stop it.
      (a) **The box cannot close.** The N=3 half points at `execution.fix_loop_max`, a key this
      step says is owned by stem 3. It does not exist in the template today, so the pointer has
      no target and the step is partly waiting on a different roadmap.
      **(a) HAS EXPIRED — re-measured 2026-09-14 and it is no longer true.** `execution.fix_loop_max`
      now exists and is consumed: `src/config/agent-settings.template.yml:760` (`fix_loop_max: 10`),
      the zod register at `src/server/schemas/settings.ts:255`, the context
      `src/agent-src/contexts/execution/fix-loop-ladder.md:19` describing it as *"`execution.fix_loop_max`
      — default 10"*, and a reader at `src/shared/missionExecution.ts:93`. Stem 3 landed it while
      this roadmap was parked. So the pointer now has a target and the N=3 half is writable.
      **(b) is unchanged and is what still holds the step**, which is why the box stays `[ ]`.
      (b) **The flip is authority-expanding and this run carries no ratification artifact.**
      Moving `personal.autonomy` from `auto` — which resolves to off-until-opted-in — to `on`
      widens the agent's own default authority, and ADR-268 section 4 makes an
      authority-expanding edit inert until a ratification artifact exists. A run cannot both
      gain the authority and certify the edit that grants it; that is the Iron Law 5.1 encodes
      by rejecting `reviewed_by == implemented_by`.
      **A gap worth recording while it is visible:** `check_kernel_edit_ratified` scopes to
      kernel rules, `src/scripts/hooks/block_*.ts` and its own three files. This edit is
      authority-expanding and lands in NONE of them, so nothing would have stopped it. The
      restraint here is model-carried, not enforced — which is the honest description and an
      argument for widening that gate's scope rather than for trusting the next run.
      **DEFERRED `[~]` 2026-10-01, and the glyph change is the point of this run's visit to this
      step.** Measured first, then the reason. `grep -n 'autonomy:' src/config/agent-settings.template.yml`
      returns `357:  autonomy: auto` — unflipped. Half (a)'s target is confirmed present a
      second time (`fix_loop_max: 10` at `:789`), so the 2026-09-14 expiry note stands and (a)
      remains writable. **(b) still holds the step, and this run refuses it rather than
      deferring it for effort.** Flipping `personal.autonomy` from `auto` to `on` widens the
      agent's own default authority; ADR-268 § 4 makes an authority-expanding edit inert until
      a ratification artifact exists; and this is a non-interactive `process-full` run that can
      put no question and carries no artifact. A run cannot both gain the authority and certify
      the edit that grants it — the Iron Law 5.1 encodes by rejecting
      `reviewed_by == implemented_by`.
      **Why the box moved from `[ ]` to `[~]` — a live defect, measured, not argued.**
      `scanOpenSteps` (`src/scripts/hooks/run_continuation_hook.ts:418`) reported
      `{open: 14, blocked: 7}` on this file at `9f2b9fb4a`, and the step it returned as `next`
      was **this one**. So every autonomous continuation fire on the estate's largest roadmap
      was being handed, as its next action, the one edit in the file that widens the agent's
      own authority — behind a restraint the step itself records as *model-carried, not
      enforced*, with `check_kernel_edit_ratified` scoping to kernel rules and `block_*.ts` and
      therefore not reaching it. `[ ]` plus a prose refusal is not a control; `[~]` is excluded
      from `OPEN_BOX` by construction, so the ladder can no longer offer it. After this change
      the file scans `{open: 0, blocked: 7}`.
      **A `blocked-by:` marker was considered and rejected**, on this file's own stated rule: the
      id must resolve to a declared blocker, no declared blocker holds this step, and inventing
      one would grow `open_blockers` past what `estate_growth_exempt` describes while parking a
      judgement call in `## Blockers`.
      **What a future session needs to close it:** a ratification artifact under
      `agents/evidence/ratifications/` whose `reviewed_by` is neither the proposer nor the
      implementer, per `docs/contracts/ratification-artifact.md` — or an owner sentence
      directing the flip. Half (a) may land in the same change; it must not land alone, because
      deleting the opt-in detection contexts while the default is still `auto` leaves autonomy
      with no path to ever turn on.
- [ ] <!-- blocked-by: kernel-guard-first-crossing | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question; the deny was reproduced on this tree and only a maintainer can retire it --> **1.5 `ask-when-uncertain.md`: the philosophy line yields to ownership.** *One question
      too many beats one wrong assumption* is replaced by a pointer to the ownership routing
      table, and the nine vague-request triggers are scoped to chat without a mission.
      verify: a mission fixture with twelve seeded technical ambiguities produces zero owner
      questions; the same twelve outside a mission still trigger the vague-request path.
- [ ] <!-- blocked-by: kernel-guard-first-crossing | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question; the deny was reproduced on this tree and only a maintainer can retire it --> **1.6 `no-cheap-questions.md`: collapse the exception list.** Iron Laws 4-6 and
      self-check items 8-14 become one clause — *under a mission, a question the contract
      already answers is forbidden*. Body stays under 40 lines.
      verify: `wc -l src/rules/no-cheap-questions.md` is at most 40, and
      `./scripts-run src/scripts/check_always_budget` is green.
- [~] **1.7 `tool-safety.md` becomes consequence-aware.** Per ADR-260 § 3 decision 12, a
      wildcard tool grant is a finding only where the wildcard can reach a typed op.
      verify: the three wildcard-grant findings in `src/scripts/lint_skill_frontmatter_safety.ts`
      demote to advisory for grants that reach no typed op, and stay blocking for grants that do.
      **NOT attempted 2026-09-13 — halted on the security-sensitive surface, deliberately.**
      The file is reachable (`tool-safety` is not a kernel member) and the change is well
      specified, but its whole content is *demoting existing security findings*, which is a
      security-sensitive edit under `security-sensitive-stop` and therefore one of the six halt
      conditions this run executes under. The prerequisite is also missing: "reaches no typed
      op" is only decidable once the eleven-op vocabulary exists as code, and it does not —
      Phase 4.3's `check_typed_op_grant.ts` is unwritten and there is no grant ledger in the
      tree for it to read. Demoting the findings first and deriving reachability from prose
      would be the narrowed-floor-without-a-replacement shape this roadmap's own Risk 1 names.
      Order: 4.3 first, then this step.
      **Evidence (2026-10-01) — DEFERRED `[~]`, refused on the floor and held on the order.**
      Both halves re-measured rather than inherited. The prerequisite is still absent: `ls
      src/scripts/check_typed_op_grant.ts` fails at `9f2b9fb4a`, so "reaches no typed op" is
      still underivable from code and would have to be read off prose. And the edit itself is a
      **deliberate widening of a safety floor** — its entire content is demoting three existing
      wildcard-grant findings in `src/scripts/lint_skill_frontmatter_safety.ts` from blocking to
      advisory. A non-interactive agent run demoting its own tool-grant findings, with no
      replacement gate in the tree and no owner in the loop, is refused here on
      `security-sensitive-stop` and on `lethal-trifecta-guard`: an over-broad tool grant is the
      standing egress leg, and this step makes that leg cheaper to hold.
      **Glyph moved `[ ]` → `[~]` for the same reason as 1.4** — the step was reachable by
      `scanOpenSteps` as a `next` action, and a prose halt recorded three times in three
      sessions is evidence the prose is not stopping anything.
      **What a future session needs:** 4.3's gate and a persisted ledger behind it (3.1), so
      reachability is computed rather than asserted — then the demotion is a mechanical
      consequence rather than a judgement call, and it is in bounds for an agent to make.

## Phase 2 — Settings and the roadmap carry the grant

- [~] **2.1 A `delivery:` settings block, avoiding the three names D7 forbids.** `merge`
      (`off` | `on-green`, default `off`), `wait_for_ci` (default `true`), `pr_topology`
      (`single` | `stacked`, default `single`). Resolvable user-global and per project;
      project overrides user; roadmap frontmatter overrides both. `stacked` is never chosen by
      the agent and never asked about at roadmap creation — the owner plans it or it does not
      happen.
      verify: `agent-config settings:get delivery.merge` reports `off` and the file it came
      from; `./scripts-run src/scripts/check_no_automerge_key` stays green against the new key.
      **PARTIALLY LANDED 2026-09-13 — the block exists and is fenced; two of the three
      resolution layers do not, and the box stays open for exactly that reason.**
      *Landed:* the `delivery:` block in `src/config/agent-settings.template.yml` with all
      three keys and the specified defaults; the zod register in
      `src/server/schemas/settings.ts` (without which `tests/server/schemas/parity.test.ts`
      reds — it is the hard template-vs-schema completeness gate and this step did not name
      it); the JSON schema block; three rows in `docs/contracts/settings-classes.md` with both
      Counts tables moved 145 → 148; `docs/settings-reference.md` regenerated rather than
      hand-edited. All three keys are **Class C**, so `settings:set` refuses them — verified by
      running it: *"settings:set refused — `delivery.merge` is class C (guarded)"*. Both verify
      clauses pass: `settings:get delivery.merge` reports `default "off"` and `class C`, and
      `check_no_automerge_key` is green over 346 keys, because `merge` is outside its closed
      `autoMerge`/`auto_merge`/`mergePolicy` set.
      **One defect caught by the schema and worth recording, because it would have shipped
      silently.** `merge: off` unquoted is parsed by YAML as the boolean `false`, not the
      string `"off"` — `validate_agent_settings` reds with *"delivery.merge: False is not of
      type 'string'"*. The template convention already quotes these (`rich_skills: "on"`,
      `cross_source: "on"`); the key ships as `merge: "off"`. Any later enum key in this block
      whose value is `off`/`on`/`no`/`yes` needs the same quoting.
      *NOT landed, and neither is a detail of the same work:*
      (a) **user-global resolution.** `MERGEABLE_KEYS` in `src/scripts/_lib/agent_settings.ts`
      is an exact-dotted-path whitelist and its own docstring reads *"Adding a key requires an
      ADR."* Every precedent entry cites one (ADR-100, ADR-219, ADR-271). Until such a record
      exists a `delivery.*` value in the user-global file is **silently dropped**, so the
      step's *"resolvable user-global"* clause is unmet. A second copy of the list lives at
      `src/agent-src/templates/scripts/work_engine/_lib/agent_settings.ts` with no parity gate
      between them, so the ADR's change is two edits.
      (b) **roadmap-frontmatter override.** There is no mechanism today by which roadmap
      frontmatter overrides the settings cascade — `load_agent_settings` has four layers
      (`docs/guidelines/agent-infra/layered-settings.md`) and none of them is a roadmap. This
      clause is new construction, not configuration, and it is what Phase 2.2 has to build
      before this box can close.
      **Evidence (2026-10-01) — both residuals re-measured and confirmed; DEFERRED `[~]`.**
      Residual (a): `grep -n delivery src/scripts/_lib/agent_settings.ts` returns **nothing**,
      so `delivery.*` is still outside `MERGEABLE_KEYS` and a user-global value is still
      silently dropped; the docstring's *"Adding a key requires an ADR."* is live at `:264`.
      Residual (b) is unchanged — no roadmap layer exists in the cascade.
      **(a) is refused rather than merely unspent, and that is a change from how it read.** The
      key it would unlock is `delivery.merge`, the merge-authority switch. Authoring the ADR
      that unlocks it, inside a non-interactive `process-full` run that executes under this very
      roadmap, is the shape `evaluator-independence` refuses and the shape 4.2 below already
      refuses for a much smaller edit. That the key is Class C — `settings:set` genuinely
      refuses it, re-verified this run — bounds the blast radius; it does not make the agent a
      neutral party to the record that widens where merge authority may be configured.
      **(b) is held on order, not refused.** It is honest construction, but its only consumer
      is `delivery.*`, so building it before (a) produces a fifth cascade layer whose sole
      purpose is to let a roadmap file turn on merging.
      **What a future session needs:** an owner-directed or independently ratified ADR for the
      `MERGEABLE_KEYS` addition — remembering it is **two** edits, `src/scripts/_lib/agent_settings.ts`
      and `src/agent-src/templates/scripts/work_engine/_lib/agent_settings.ts`, with no parity
      gate between them.
- [~] **2.2 Roadmap template accepts the block.** An optional `delivery:` frontmatter block;
      a `## PR plan` section required if and only if `pr_topology: stacked`.
      verify: a fixture roadmap declaring `stacked` without `## PR plan` is rejected by the
      roadmap frontmatter lint, and one declaring `single` is accepted without it.
      **HALF LANDED 2026-09-13, and the other half turned out to rest on a mechanism that does
      not exist.** *Landed:* `src/agent-src/templates/roadmaps.md` rule 18 now documents the
      optional `delivery:` frontmatter block beside `execution:` and `relates:`, stating the
      `stacked` ⇒ `## PR plan` obligation and why `pr_topology` is the owner's to write;
      `docs/contracts/roadmap-complexity-standard.md` adds `execution:` and `delivery:` to its
      permitted-keys sentence. The projection regenerated through `task sync`.
      *Not landed, deliberately, and the reason is a finding rather than a deferral:* **this
      step's verify names "the roadmap frontmatter lint", and there is no such thing.** No
      script rejects an unknown roadmap frontmatter key — `lint_provenance_vocabulary.ts:465`
      says so in as many words: *"It was usable — nothing rejects an unknown frontmatter key —
      and that is exactly what made it wrong."* What exists is six single-key readers
      (`lint_roadmap_complexity`, `lint_roadmap_blockers`, `lint_roadmap_ci_steps`,
      `lint_roadmap_family_cap`, `lint_roadmap_later_disposition`, `check_roadmap_trackable`),
      none of which is an allowlist and none of which is a natural host —
      `lint_roadmap_complexity`'s own docstring pins it to a ported Python CLI contract with
      *"No behaviour changes"*. So satisfying the verify means authoring a NEW gate.
      That was not done, for a reason worth stating rather than hiding in a deferral: **the
      key it would police is read by no code.** The fifth cascade layer is 2.1's residual (b),
      and a gate that demands a `## PR plan` section for a frontmatter value nothing consumes
      enforces ceremony, not a contract. The right order is consumer first, gate second, and a
      later run should build both together rather than inheriting a validator with no subject.
      **Evidence (2026-10-01) — DEFERRED `[~]` on order, 2026-09-13's reasoning re-confirmed
      rather than inherited.** The consumer is still absent: 2.1's residual (b) has not moved,
      so `pr_topology` is read by no code and a gate over it would enforce ceremony. The glyph
      moves only so `scanOpenSteps` stops offering a step whose own body says it should not be
      taken yet. **What a future session needs:** 2.1(b)'s cascade layer first, then this gate
      in the same change, authored as a NEW gate for the reason stated above.
- [x] **2.3 Correct the template's absolute sentence.** *No mode lifts a safety floor* is true
      for the eleven typed ops and false for pushes and non-prod merges; the sentence is
      rewritten to say which.
      verify: the sentence names the vocabulary rather than "a safety floor" in the abstract.
      **Done 2026-09-13** in `src/config/agent-settings.template.yml`, in the `roadmap:` block's
      per-roadmap override note. The replacement names all eleven ops of ADR-260 section 2
      verbatim — `force_push`, `prod_merge`, `tag_push`, `release`, `publish`,
      `branch_protection_change`, `repo_delete`, `prod_data_delete`, `secret_write`, `payment`,
      `external_send` — and states the claim the old sentence was making without saying so:
      what an `execution.mode` value cannot lift is that vocabulary, and no interaction pattern
      substitutes for an object-bound grant.
      **What it deliberately does NOT assert.** The step's premise is that the sentence is
      *false* for pushes and non-prod merges. That becomes true when Phase 1.1 narrows the Hard
      Floor's trigger table, and 1.1 is held by `kernel-guard-first-crossing`. So the comment
      says the floor is today WIDER than the vocabulary, names the two rows that make it wider,
      and points at the rule's own trigger table as the authority on reach — rather than
      announcing a narrowing that has not landed. Writing it the other way would have put the
      template in contradiction with a kernel rule this run cannot edit, which is Risk 1 of this
      roadmap's own register arriving through a side door.

## Phase 3 — Persistence, interrupts, and WARN-op evidence

- [~] **3.1 The grant ledger gains `expires` and `revoked_by`.** A follow-up push, a CI fix, a
      base sync, a conflict resolution or an unrelated owner question does not write to it.
      Revocation is an owner sentence naming the op or target, or a replacement mission.
      verify: fixture G1 — a mission grant survives three CI fixes and one base sync and is
      spent exactly once, on the final head; fixture G12 — *do not merge* mid-run sets
      `revoked_by` and the run ends open-green.
      **A SIBLING ROADMAP LANDED PART OF THIS SUBJECT — measured 2026-09-14, and it changes what
      is left rather than closing the box.** `road-to-adversarial-verification-and-long-runs`
      shipped two pure modules (PR #2051, `road-to-authority-object-exactness` on top of them):
      `src/scripts/_lib/mission_record.ts` already declares `AuthoritySnapshot` with **both**
      `expires` and `revoked_by`, plus `revalidate`, which resolves a record-versus-ledger
      disagreement in favour of the ledger — that is this step's *"revocation"* half, typed.
      `src/scripts/_lib/typed_op_grant.ts` carries the exact-object ask (`op`, `object`,
      `confirmed`, `confirmed_turn`) with the two-tier exactness check and the council-may-veto-
      never-grant asymmetry.
      **What is still missing is the thing this step actually needs: PERSISTENCE.** Both modules
      are explicitly pure — `mission_record`'s own header reads *"Reading the ledger and the forge
      belongs to the caller"* — and `LedgerState` is a TYPE with no writer, no reader and no file.
      `ls src/scripts/_lib/` shows `asset_delivery_ledger.ts`, `billing_grant.ts` and
      `gate_ledger.ts`, none of which is an authority-grant ledger. So the fields exist and the
      store does not, and G1/G12 remain unwritable. **Do not re-derive the pre-#2051 reading that
      no grant vocabulary exists in code — it does now.**
      **Evidence (2026-10-01) — the gap is re-measured and the step is REFUSED, not merely
      deferred for effort.** Measured at `9f2b9fb4a`: `grep -rn LedgerState src --include "*.ts"`
      returns exactly two hits — the `export interface LedgerState` at
      `src/scripts/_lib/mission_record.ts:87` and a parameter at `:128`. No writer, no reader,
      no file; unchanged from 2026-09-14. `ls src/scripts/_lib/` still shows
      `asset_delivery_ledger.ts`, `billing_grant.ts` and `gate_ledger.ts`, none of them an
      authority-grant ledger.
      **Why this run refuses to build the store rather than treating it as ordinary
      construction.** A persisted authority-grant ledger an agent session can write IS a
      self-grant: whatever 4.3's gate later reads out of it, the same session can first write
      into it — a gate whose grant side the candidate controls is exactly the head-controlled
      enforcement path that refused 5.2's retirement 2/2 in round 2. The hazard is not the file
      format; it is that persistence without an owner-bound write path converts *"the owner
      said merge it"* into *"a row exists saying so"*. Building it unasked, in the run that
      would be its first beneficiary, is out of bounds here.
      **What a future session needs, and it is a design decision before it is code:** a written
      answer to *who may append to the ledger, and what makes an append owner-attributable* —
      ideally council-reviewed, since `ratification_artifact.ts` is this tree's existing
      precedent for a record an agent may produce and may not self-certify. With that settled
      the store is mechanical, and 4.3 then 1.7 unblock behind it in that order.
- [~] **3.2 `user-interrupt-priority.md` gains three interrupt classes.** A clarification is
      incorporated and the run continues; a side task pauses the mission and the mission
      auto-resumes; only stop, replace or revoke changes mission state. An interrupt never
      revokes a grant, a delivery target or a closed decision.
      verify: fixture G11 — a side task mid-run is executed and the mission resumes with the
      grant intact and no *continue?* question emitted.
      **Evidence (2026-10-01) — DEFERRED `[~]`, refused on the control it removes.** The target
      is not a kernel member — the nine are `agent-authority`, `ask-when-uncertain`,
      `commit-policy`, `direct-answers`, `language-and-tone`, `no-cheap-questions`,
      `non-destructive-by-default`, `scope-control`, `verify-before-complete`, read this run
      from the deny's own header — so `block_kernel_rule_writes` does not hold it and the file
      is writable. It is refused for what the edit does: `user-interrupt-priority`'s Iron Law
      is *STOP → run new task → ASK before resume*, and auto-resume deletes the ASK. That is a
      human control over the agent's own continuation, removed by the agent, with no
      ratification artifact and no owner in the loop.
      It is also unverifiable today: G11 requires a mission whose grant survives the
      interruption, and 3.1 establishes there is no store for a grant to survive in, so the
      fixture cannot distinguish *resumed with the grant intact* from *resumed with no grant at
      all*. **What a future session needs:** 3.1's persisted ledger, plus an independent
      ratification of the ASK removal.
- [~] **3.3 WARN ops execute on evidence, never on a gate.** `branch-delete`, `pr-close` (a new
      GitOp — the classifier has no such op today) and a history rewrite on unpushed work each
      require the triple recorded in the PR body or run log: superseded, no unique work lost,
      recoverable. Signals consulted are commit age, open PRs on the path, active branches,
      CODEOWNERS and worktree state. Recency raises the bar; it never blocks. Missing evidence
      routes to the ladder.
      verify: fixture G13 — a fully superseded foreign PR closes with the triple recorded;
      fixture G14 — a foreign PR carrying unique work does not close and routes to the ladder.
      **Evidence (2026-10-01) — DEFERRED `[~]`, refused on what it converts.** The step moves
      `branch-delete`, `pr-close` and a history rewrite from *gated* to *executes on evidence
      the agent itself assembles*. The evidence triple — superseded, no unique work lost,
      recoverable — is a judgement the acting run makes about its own next action, so the
      control it replaces is a gate and the control it installs is self-assessment.
      `scope-control` holds branch delete and PR close behind permission today, and
      `non-destructive-by-default` holds the history rewrite; neither is lifted by prose.
      Two of the three are also unreachable mechanically: `pr-close` is a **new** GitOp the
      classifier has no case for, and the classifier has only measured since ADR-254, so adding
      the op buys a label and no enforcement. **What a future session needs:** 3.1's ledger, so
      "recoverable" is read from a store rather than asserted by the run that benefits — and an
      owner or independent ratification for the gate→evidence conversion itself, which is the
      part no amount of tooling makes agent-decidable.
- [~] **3.4 Rewrite the halt table.** The six halts of D10 become: a typed op without a grant
      → one native ask naming the object, then continue; council-off → the second-model rung →
      owner confirmation of the agent's proposal; a security-sensitive surface → evidence plus
      a council record, continue unless a typed op is reached; scope discovery → the ownership
      table; the fix-loop bound → the recovery ladder; an unenumerated conflict → the semantic
      resolution ladder. Terminal `BLOCKED` only per ADR-268 § 7. The FORBIDDEN-NON-HALT list
      stays and gains *retry count reached*.
      verify: `grep -c 'retry count reached' src/domains/product-basic/roadmap/process-full/command.md`
      returns 1, and the six-halt claim in that file is replaced rather than left contradicted.
      **Evidence (2026-10-01) — DEFERRED `[~]`, refused on self-amendment of the halts this run
      executes under.** The step rewrites `process-full`'s halt table so that five of six halts
      become continues. This IS a `process-full` run; rewriting the conditions under which it
      is required to stop, during the run those conditions bind, is the `evaluator-independence`
      shape — and it is the same objection 4.2 below records for the much smaller act of
      deleting one banner sentence.
      It is also not yet writable on its own terms: three of the six replacements route to
      machinery that does not exist. *"a typed op without a grant → one native ask"* needs
      3.1's ledger to know whether a grant exists; *"the recovery ladder"* and *"the semantic
      resolution ladder"* are named as destinations, and a halt rewritten to point at an absent
      ladder is a halt deleted. **What a future session needs:** 3.1, then the two ladders as
      real targets, then an owner-directed or independently ratified edit — authored by a run
      that is not itself governed by the table it rewrites.

## Phase 4 — Merge delivery, decided

- [~] **4.1 Activate `/pr:merge` behind the ledger.** Forge auto-merge once required checks are
      green and the merge state is clean, keeping ADR-239 § 4's `observed_head` re-read and the
      superseded-PR check. A direct merge only where the forge exposes no auto-merge and
      `doctor` recorded that. Without a grant: stop at green, clean and open, and say which.
      verify: fixture G5 grant plus green → merged; G6 grant plus red → the loop continues and
      nothing merges; G7 no grant → open-green.
      **Evidence (2026-10-01) — DEFERRED `[~]`, refused and also unbuildable.** This is the
      largest authority in the file: it turns merge from a thing the agent never does into a
      thing it does when a ledger row says so. The ledger does not exist (3.1, re-measured this
      run), so every fixture is undecidable — G5 and G7 differ only in whether a grant is
      present, and with no store there is nothing to be present or absent. Building the merge
      path first and the grant store afterwards would produce exactly the inversion this
      roadmap's Risk 1 names, on the single op where it matters most.
      Independent of the order, activating merge delivery is refused for this run on the same
      ground as 1.4 and 3.1: an authorization an agent can write is not an authorization, and
      this run would be the first beneficiary of the mechanism it was authoring.
      **What a future session needs:** 3.1's ledger with an owner-bound write path, then this —
      and note `delivery.merge` ships `off` at every level and is Class C, so even a built 4.1
      stays inert until a human hand-edits it on.
- [~] **4.2 Retire the never-merges banner.** Delete it from `process-full` and from
      `roadmap/next`, citing ADR-268 § 3 as the ruling the original text said was missing.
      Superseded evidence files gain a one-line supersession note rather than an edit.
      verify: `grep -c 'NEVER MERGES' src/domains/product-basic/roadmap/process-full/command.md`
      returns 0, and the archived drain-run evidence carries the note.
      **NOT attempted 2026-09-13, on ordering and on independence.** The edit is a doc change
      and ADR-268 section 3 is the ruling it needs, so it is authorised — but 4.1 is not built,
      so deleting the banner would leave `process-full` silent about merging while no mechanism
      gates a merge. That is strictly worse than either end state: today the command says it
      never merges and never does; after 4.1 it says when it may and is gated. Between them it
      would say nothing and be gated by nothing.
      There is a second reason and it is the one that would hold even if the ordering were
      fine: the run that would delete the banner is a `process-full` run, executing under the
      banner, whose own instruction reads *"You NEVER merge."* An agent removing the sentence
      that constrains it, in the same session it is constrained by it, is the shape
      `evaluator-independence` exists to refuse. This belongs in the PR that lands 4.1.
      **Evidence (2026-10-01) — DEFERRED `[~]`. The 2026-09-13 refusal is re-confirmed by a
      second run that is in exactly the same position, which is itself the finding.**
      `grep -c 'NEVER MERGES' src/domains/product-basic/roadmap/process-full/command.md`
      returns **1** at `9f2b9fb4a`, so the banner stands. Both of the original reasons hold
      and neither has weakened: 4.1 is still unbuilt (re-measured above), so deleting the
      banner would leave `process-full` silent about merging while nothing gates a merge —
      strictly worse than either end state; and the run that would delete it is, again, a
      `process-full` run executing under the sentence *"You NEVER merge."*
      That two independent runs two and a half weeks apart reached the same refusal by the same
      reasoning is worth recording rather than re-deriving a third time: this step is not
      waiting on effort or on evidence. It is waiting on a **different actor** — the PR that
      lands 4.1, authored by a session not governed by the banner it removes.
- [~] **4.3 A gate that reads the ledger, not a prompt.** `check_typed_op_grant.ts` reads the
      ledger and the diff; a typed op — a tag push, a release-workflow edit, a protection
      change, a secret-file write — without a matching object-bound grant is red. This is the
      `enforced_by` line Phase 1.1 promised.
      verify: a fixture diff pushing a tag without a grant reds the gate; the same diff with a
      matching grant object passes.
      **NOT attempted 2026-09-14, and the reason is now narrower than it was.** `ls
      src/scripts/check_typed_op_grant.ts` fails — the gate is still unwritten. The half that
      moved is upstream of it: the op vocabulary and the grant fields now exist as code (see 3.1),
      so this step no longer waits on a vocabulary. It waits on the **ledger store**, because this
      gate is specified to read *"the ledger and the diff"* and there is no persisted ledger for it
      to read — `LedgerState` is a type with no writer. Building the gate against a store that does
      not exist would produce a gate whose grant side is always absent, i.e. one that either reds
      every typed op or passes everything. Order is unchanged and now has a named first item:
      3.1's persistence, then this gate, then 1.7.
      **Evidence (2026-10-01) — DEFERRED `[~]` on order only. This is the one step in the file
      an agent should WANT to build, and it still cannot.** `ls src/scripts/check_typed_op_grant.ts`
      fails at `9f2b9fb4a` — unwritten. Unlike every other deferral here this step is not
      refused: a gate that reds a typed op lacking a grant only ever REFUSES things, so it
      cannot produce a state weaker than today's and it is squarely in bounds for an agent to
      author. What stops it is its own specification — it reads *"the ledger and the diff"*, and
      3.1 establishes this run that `LedgerState` is a type with no writer, no reader and no
      file. A gate built against an absent store either reds every typed op or passes
      everything, and a ratchet in either state teaches the tree to ignore it.
      **What a future session needs:** 3.1's persisted ledger and nothing else. This gate is
      the mechanical replacement Phase 1.1's `enforced_by:` line promises and Risk 1 demands
      exists before the floor narrows — so it should be built FIRST among the unblocked work,
      not last.
      **Evidence (2026-10-05) — THE SECOND OBSTACLE UNDER THE FIRST, measured by probe rather
      than reasoned about, and it is a construction requirement rather than a block.** The
      order above says 3.1's ledger *"and nothing else"*. That is now known to be incomplete:
      the moment the ledger lands and this gate is written, a second gate has an opinion about
      it, and a session that discovers it after authoring the gate will be looking at a red CI
      it did not cause.
      **What was measured.** `check_gate_completeness` is RED on the base of this branch —
      `./scripts-run src/scripts/check_gate_completeness` exits **1** with *"237 violation(s)
      against a baseline of 214 — 23 new"*, reading `89 ledgered · 12 exempt · 237 un-adopted ·
      338 registered`. That red is pre-existing and nothing in this roadmap caused it; the point
      is that a new gate arrives onto a ratchet with **negative** headroom, so a 238th un-adopted
      gate is not absorbed.
      **The probe, and the thing it taught by NOT moving.** A throwaway
      `src/scripts/check_zz_probe.ts` was created and `check_gate_completeness` re-run: the
      counts were **identical** — still `237 un-adopted · 338 registered`. No movement where
      movement was expected, so the oracle was not installed and the cause was found instead.
      `grep -n 'registered' src/scripts/check_gate_completeness.ts` points at
      `registeredGateIds()` at `:105`, which is `local_closure(TASK_ROOTS, load_tasks(...))` over
      `TASK_ROOTS = ['ci', 'consistency']` at `:57` — **the registry is the Taskfile closure, not
      a filesystem glob.** A file in `src/scripts/` registers nothing. The probe was removed by
      exact deletion.
      **The avoidance path, proven on the shipped classifier rather than assumed.** The exported
      pure function `classifyGateSource` was called directly over four sources, all four
      polarities in one run: a bare gate → `unledgered` (i.e. violation 238); one importing
      `./_lib/gate_ledger.js` → `ledgered`; one carrying `// ledger-exempt:` with a 60-character
      reason → `exempt`; and one carrying `// ledger-exempt: n/a` → `malformed_exemption`, which
      is a violation of a different class. The 20-character floor is `MIN_REASON_CHARS` at
      `grep -n 'MIN_REASON_CHARS' src/scripts/check_gate_completeness.ts` → `:68`.
      **So the hand-over is one sentence: `check_typed_op_grant.ts` must import
      `./_lib/gate_ledger.js` and emit its `scanned:` line from the first commit**, and be
      registered in `src/config/gate-coverage.yml` with CI-identical `argv` and a `min_scanned`
      floor. Retrofitting the ledger import after the gate is wired means one PR that is red for
      a reason the diff did create. This costs nothing to know now and a cycle to discover later.
- [x] **4.4 Dispose of `check_no_automerge_key.ts`.** Delete it deliberately, per its own
      text, or leave it and record why. It matches `delivery.merge` either way, so this is a
      hygiene decision and not a blocker.
      verify: whichever is chosen is stated in the PR body with the gate's own sentence quoted.
      **Decided 2026-09-13: KEEP IT, and the reason is that its deletion is not this run's to
      take.** The gate's own sentence, quoted: *"It is a REVERSIBLE architectural boundary, not
      a permanent prohibition. If the owner later wants one of these exact names, the owner
      deletes this gate."* Three things follow, and the third is the one that decides it.
      (1) **The premise the gate was built on is unchanged by ADR-268.** The ratchet is not
      about whether merge authority exists — it is about whether it arrives *by key name*
      rather than by decision. ADR-268 section 3 grants the authority by decision and adopts
      none of `autoMerge` / `auto_merge` / `mergePolicy`, so the boundary it protects is
      exactly as intact after the ruling as before it.
      (2) **Keeping it costs nothing, measured rather than assumed.** With the new block in the
      tree the gate is green over 346 keys across its two corpus files, because `delivery.merge`
      sits outside the closed three-name set. The step's own *"it matches either way"* is
      therefore confirmed on this tree and not inherited from the step's author.
      (3) **The sentence names the owner as the party who deletes it, and that is a routing
      instruction, not a figure of speech.** Deleting a recorded architectural boundary is
      owner-reserved under `decision-revisit-gate`'s own table — it removes a floor and it is
      governance self-amendment — so an agent run that deleted the gate on the strength of an
      ADR that never asked for its deletion would be doing the thing this roadmap's Phase 5
      exists to make impossible without ratification. The hygiene argument for deleting it
      (one fewer gate) does not reach that bar.
      **What would change the decision:** an owner sentence naming the gate, or a later record
      that actually adopts one of the three names. Neither exists.

## Phase 5 — Kernel amendment under ratification

- [x] **5.1 The ratification artifact.** `docs/contracts/ratification-artifact.md` is the
      contract; `src/scripts/_lib/ratification_artifact.ts` is the single pure reader the gate
      and its tests both import, so a fixture proves the shipped code rather than a second
      implementation. Fields as specified. `ratification` is added to the evidence-type
      vocabulary (`docs/contracts/evidence-artifact-types.md`, `lint_evidence_artifacts.ts`) —
      it binds forward via `effective_after`, which no existing type does.
      **Wider than the step asked:** `reviewed_by` is rejected when it equals `implemented_by`
      as well as `proposed_by`. The Iron Law names the party gaining the authority, and the
      implementer is that party too.
      verify: `tests/scripts/ratification_artifact.test.ts`, 13 tests green 2026-09-09 —
      including the named fixture (proposer == reviewer rejected), diversity required at
      2 configured providers, not required at 1, and NOT required when the count could not be
      read. `agent-config council:status` reports 2 enabled members (anthropic, openai).
      **Honest limit:** a source-level sabotage probe on the self-ratification branch was
      blocked by the host's auto-mode classifier, so the red was not observed. Both polarities
      are asserted (a case that must produce `self-ratified` and one that must not), which is
      structural, not observed.
      **Exercised end to end, not only unit-tested:** this branch's own ratification record is
      `agents/evidence/ratifications/drain-typed-grants-5-1-5-2.md`, and the gate accepts it
      for the real branch diff (exit 0) and refuses the same diff with the record withheld
      (exit 1). The ladder ran for real — an independent AI council over two providers, three
      rounds, two refusals; the mechanism refused its own author twice before it passed
      anything, which is the only evidence that it is a control and not a form.
- [ ] <!-- blocked-by: ratification-platform-anchor | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question; both residual limbs are maintainer forge actions --> **5.2 Replace the deny with a gate.** **Gate built and landed; the REPLACEMENT was
      refused and is not done.** The step has two halves and only one of them shipped.

      **Shipped — the gate, as an ADDITIONAL control.** `check_kernel_edit_ratified.ts` runs
      in `ci-fast` and in `.github/workflows/consistency.yml`, and reds a diff touching a
      kernel rule (source or any projection, matching the deny's own reach), a governance
      hook, or any of the three files of the ratification mechanism itself, unless the diff
      carries a passing artifact. The CI step runs the **base revision's** copy of the script
      against the head's file list, with the quorum policy read from the script's own tree.
      Scope is deliberately stricter than ADR-268 section 4: the ADR requires the artifact for
      authority-EXPANDING edits, expansion is not decidable from a diff, so every kernel,
      governance-hook and self edit carries one.
      verify: fixture G15 in `tests/scripts/check_kernel_edit_ratified.test.ts` — same diff,
      `verdict: non-convergent` → exit 1, `verdict: ratified` → exit 0. 22 tests there and 15
      in `ratification_artifact.test.ts`, green 2026-09-09, both polarities per rule.

      **NOT shipped — the replacement.** `block_kernel_rule_writes.ts`, its three
      `pre_tool_use` bindings and the 24-hour soak all still stand. The retirement was
      implemented, reviewed, and **reverted**.
      **Why: a two-round independent ratification review refused it.** Round 1 —
      `non-convergent` (claude-sonnet-4-5) and `refused` (codex-default), on three flaws: the
      gate judged from the PR head so a candidate could weaken its own judge; provider
      diversity read a user-global config absent in CI and so failed OPEN there; the trust
      boundary was unstated. All three were fixed — base-revision execution, an in-repo quorum
      policy that fails closed, the boundary written into the contract — plus
      `confirmed-non-expanding` adopted from the review. Round 2 — **`refused` 2/2**, on a
      defect the fixes did not reach: the workflow file that decides whether the gate runs
      lives in the candidate branch, so the enforcement PATH is head-controlled even when the
      gate's CODE is not. Closing that needs a platform-anchored required check, which is a
      repository setting rather than a diff.
      Both reviewers also held that the artifact is not a replacement for the soak's
      elapsed-time property, only a different control — now recorded in the contract.
      Blocker `ratification-platform-anchor` carries the owner action.
      **UPDATE 2026-09-10 — the platform-anchored check the round-2 refusal named is now
      BUILT, and it reds.** `src/scripts/check_platform_anchor.ts` reads the live rulesets and
      compares them against `src/config/platform-anchor.json`; on this repository it exits 1
      and names three real gaps (`required_approving_review_count: 0`,
      `require_last_push_approval: false`, an unconditional `RepositoryRole` bypass). So the
      round-2 refusal is now *measured* rather than argued, and the retirement is further from
      landing than it looked: the missing anchor is not merely unverified, it is missing. Built
      to the specification of an AI council (2/2 convergent, 2 rounds, blind peer review) under
      a written owner delegation — its decision is transcribed in the blocker.
      **UPDATE 2026-09-13 — it no longer reds, and that is a smaller change than it sounds.**
      The gate now exits 0 with `PASS_WITH_ACCEPTED_RISK`: two of the three gaps named above
      were removed from the trust model by owner ruling rather than fixed, and the third is
      covered by a dated owner waiver. So the anchor is present and green — but what it
      anchors is weaker than the round-2 refusal assumed, and the refusal itself stands
      undisturbed. See the `ratification-platform-anchor` blocker's `Blocks:` field for why a
      green anchor is not the retirement precondition the seats had in mind.
      **NOT wired as a blocking CI step in this change, deliberately, and this is the one place
      the two seats differed.** anthropic proposed adding it to CI in the same change behind a
      `# BOOTSTRAP EXCEPTION` marker that lets this PR pass; openai warned in the same round
      against an escape the candidate branch controls, and a marker an agent can write is
      exactly that. The direction that satisfies both is the one taken: the gate lands
      runnable and unwired, so nothing that was enforcing becomes non-enforcing and no
      agent-writable bypass is introduced, and the wiring is the second half of
      `ratification-platform-anchor` — after the settings change, when the gate can go green
      on merit. A reader can audit that choice from the tree: the gate exists and is
      invoked from the pre-push chain but from no workflow —
      `grep -rc check_platform_anchor .github/workflows/*.yml | grep -v ':0'` returns only
      `rule-backstops.yml:1`, and that one hit is a comment saying it is NOT wired there.
      **Corrected 2026-09-11 by a release-review adjudication:** this line used to read
      `grep -c check_platform_anchor taskfiles/ci-fast.yml` returns 0. It returns **2**
      (`:157`, `:2096`), because the pre-push chain is exactly where the gate IS wired — so
      a reader following the old instruction would have concluded the opposite of what the
      step says. The substantive claim (unwired in CI) was right; the command tested the
      wrong file.
      **This is K7 unhonoured on purpose.** The kill register forbids keeping the deny AND the
      gate. Two mechanisms is the interim the review forced, and it is the safe direction: the
      gate only ever refuses, so it cannot produce a state weaker than today's.
      **Evidence (2026-10-01) — the shipped half still ships, the refused half is still
      refused, and the round-2 defect is untouched.** Re-measured: the deny and all three
      bindings are present (see `kernel-guard-first-crossing`'s 2026-10-01 entry), so K7 is
      still unhonoured on purpose and two mechanisms still stand.
      The round-2 refusal turned on the **enforcement path** being head-controlled — the
      workflow file deciding whether the gate runs lives in the candidate branch — and closing
      it needs a platform-anchored required check. That is still not available:
      `grep -rc check_platform_anchor .github/workflows/*.yml | grep -v ':0'` returns only
      `rule-backstops.yml:1`, and that hit is the comment recording the `administration: read`
      scope refusal. The anchor going green again on 2026-09-28 changes the anchor's verdict,
      not the path the refusal was about — a gate wired only pre-push is a control an
      administrator may skip, which is the 2026-09-13 council's own sharpening of the point.
      So the retirement is exactly where round 2 left it, and this run neither attempts nor
      proposes it.
- [~] **5.3 Reclassify three owner-reserved rows.** In `decision-revisit-gate.md`, the rows
      *changes the project's purpose*, *governance self-amendment* and *cannot be bounded from
      available evidence* become `ratification` rather than `owner`. The four Class-1 rows stay
      owner-reserved.
      verify: the rule's own table shows exactly three `ratification` rows and the Class-1 rows
      unchanged.
      **Evidence (2026-10-01) — DEFERRED `[~]`, REFUSED outright. This is the most direct
      self-grant in the file and it carries no blocker, so it was reachable.** The edit moves
      three rows of `decision-revisit-gate`'s owner-reserved table — *changes the project's
      purpose*, *governance self-amendment*, *cannot be bounded from available evidence* — from
      `owner` to `ratification`. `ratification` is a mechanism agent sessions run; `owner` is a
      human. So the step transfers authority over governance self-amendment FROM the owner TO
      the agent layer, and the row it transfers includes governance self-amendment itself.
      `decision-revisit-gate`'s own Iron Law forecloses an agent taking it: *"Governance
      self-amendment — reopening authority, quorum, escalation, this set"* sits in the
      owner-reserved column, and the rule states that no grade and no council agreement moves a
      transition out of that column. The target is not a kernel member, so
      `block_kernel_rule_writes` does not fire and nothing in the tree would have stopped this
      edit — which is precisely why the refusal is recorded here rather than left to the next
      run's judgement.
      **What a future session needs:** an owner sentence. Not a council, not a ratification
      artifact — ADR-268 § 4's mechanism cannot authorise its own expansion into the rows that
      define who may authorise, and an artifact produced under the current table cannot
      ratify changing that table.

## Phase 6 — A generated disposition inventory

- [~] **6.1 Generate, never hand-maintain, the disposition.**
      `src/scripts/report_autonomy_disposition.ts` emits one row per rule, command, skill, ADR,
      gate and hook with `authority_effect`, `control_class`, whether it contains an ask, stop,
      permission or retry, its `disposition` and its `replacement`. Sources are
      `ask_block_census.ts`, `probe_unblocked_ask.ts`, `OWNER_ROUTING`,
      `lint_roadmap_complexity`'s human-gate checks and the `enforced_by` frontmatter. The
      count of `legacy_human_gate` rows is registered as a ratchet, measured at this pin, and
      may only fall.
      verify: the report regenerates byte-identically on two consecutive runs over the same
      SHA, and the ratchet entry exists in `gate-violation-baselines.json`.
      **Evidence (2026-10-01) — DEFERRED `[~]`, and the step SPLITS. One half is in bounds and
      one is not, which is why the box could not close either way.** Sources confirmed present
      this run: `src/scripts/ask_block_census.ts` (769 lines) and
      `src/scripts/probe_unblocked_ask.ts` (412) both exist, and `OWNER_ROUTING` is at
      `src/agent-src/scripts/stub_queue.ts:33`. `ls src/scripts/report_autonomy_disposition.ts`
      fails — unwritten.
      **The report half is in bounds.** It is a read-only measurement, it exits 0 whatever it
      counts, and `ask_block_census` is the tree's own precedent for a frozen pinned artefact.
      An agent may build it.
      **The ratchet half is not, and it is the half the verify clause requires.** Registering
      `legacy_human_gate` as a shrink-only entry in `gate-violation-baselines.json` installs a
      one-way governance ratchet: once a human gate over the agent is removed it may not come
      back, enforced in CI. That is a standing downward pressure on human control over the
      agent, registered by the agent. Risk 5 of this file's own register names the adjacent
      failure — a miscount reds every later change — but not this one, which is that the
      direction is set by the beneficiary.
      **The report's own `disposition` and `replacement` columns are the same problem one layer
      down**, and that is why this run did not build even the in-bounds half unasked: those two
      columns are not measurements, they are recommendations naming which human gates to retire
      and what should replace them. Emitting that list, in a run executing under this roadmap,
      is the shape 4.2 refuses for one sentence.
      **What a future session needs:** an owner decision splitting the step — build the
      inventory with `authority_effect` and `control_class` (measured) and leave `disposition`
      and `replacement` to a human pass; and either an owner-registered ratchet or no ratchet,
      with the verify clause amended to match whichever is chosen.
- [~] **6.2 A convergence lint.** A command or skill that locally asks for permission on an
      operation the inventory classifies as normal execution is red.
      verify: a fixture command asking permission for a branch create reds the lint; the same
      command asking for a `tag_push` does not.
      **Evidence (2026-10-01) — DEFERRED `[~]` on order and on direction.** The lint's subject
      is *"an operation the inventory classifies as normal execution"*, and 6.1 establishes
      this run that the inventory does not exist — so the lint has no classifier to consult and
      its fixture cannot be written. That alone holds it.
      The direction is the second reason and it outlives the ordering one: this gate reds a
      command for **asking the user permission**. A lint that makes asking a human a CI failure
      is the strongest form of the pressure 6.1's ratchet applies, and it would be authored by
      the party that gains from fewer asks. **What a future session needs:** 6.1's inventory
      with a human-reviewed `disposition` column — at which point the lint enforces a human's
      classification rather than the agent's, which is a different mechanism wearing the same
      name.

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
<!-- risk-review: v1 | reviewed: 2026-10-05 | reviewer: claude/host -->

> **Re-reviewed 2026-10-05 because this run moved an acceptance criterion, and an AC edit
> stales the register's stamp.** `lint_plan_risk_register` did not refuse the push — it
> reports this file as `draft-exempt` and scans 17 `ready` roadmaps, verified by running it —
> so the re-review is owed by the contract rather than extracted by the gate, which is the
> weaker position to be honest from and therefore worth saying. All five rows re-read against
> figures executed this run, and **all five stand unchanged**: Risk 1 — 4.3's gate is still
> unwritten (`ls src/scripts/check_typed_op_grant.ts` fails) and 1.1 is still denied, so the
> gap it names is still open in the same direction. Risk 2 — confirmed live for the fifth
> consecutive reading, the deny exercised against the real `Edit` tool rather than inspected.
> Risk 3 — no grant can outlive an intent yet, because `LedgerState` has no writer. Risk 4 —
> untouched; no ratification artifact was produced or consumed here. Risk 5 — the
> `legacy_human_gate` ratchet is confirmed ABSENT from `src/config/gate-violation-baselines.json`,
> so the miscount it warns about cannot have happened.
> **One row gains a sharper mitigation from this run rather than a new risk.** Risk 1's
> mitigation says 4.3 must land before 1.1. The step's own 2026-10-05 evidence now adds the
> construction detail that makes that landing cheap: the gate must import
> `./_lib/gate_ledger.js` from its first commit, because `check_gate_completeness` carries
> negative headroom and would otherwise red the PR that lands the replacement Risk 1 demands.
> No rank changed and no row was added, so the marker stays at `v1`.

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

### blocker: ratification-platform-anchor

> **Note 2026-10-10, `road-to-self-modification-that-a-council-must-pass` step 1.3.**
> `docs/decisions/ADR-281-council-confirmed-self-modification.md` is accepted. For a
> change to the gated surface, and for a change originating in this package's own
> learning lanes, the lowest rung that can pass is now the **council** — an
> independent session alone no longer ratifies — and a change to the reviewer itself
> joins the owner's list. Nothing in this blocker is edited by that note; it is
> recorded here because this blocker's resolution will be read against the new ladder.
- **Status:** open — **the criterion itself changed on 2026-09-10 by owner ruling, and what
  is left is the CI wiring plus an unrehearsed recovery path.** The owner ruled that a mandatory
  approving review is not wanted on this repository: *"I am the only maintainer, or the main
  one. There are others, but they are rarely active. That is why this would be a blocker."*
  Five accounts carry write access; four are rarely available. So the two approval dimensions
  left the anchor's enforced set and its non-negotiable floor — removed, **not** exempted,
  because a dimension outside the trust model is not a waived rule. An AI council decided the
  implementation shape (2/2 convergent on narrowing the enforced set rather than keeping an
  unsatisfiable floor); the owner decided the policy. openai: *"Keeping those requirements
  hard-coded would make red mean the repository intentionally chose a different trust model,
  rather than the configured platform violated its policy. That is not a useful compliance
  signal."*
  **`strict_required_status_checks` is WAIVED, not failing — corrected the same day.** This
  field first said the gate reds on exactly that one dimension, which was true for about three
  hours. The owner then ruled on it too, and the reasoning is a cost trade-off rather than an
  impossibility: three green branches should merge without sequential rebases, because each
  rebase costs a full 20-30 minute re-run and the breakage it prevents is rare and repairable.
  That falls on the other side of the boundary the approval ruling was recorded under, so the
  council replaced the boundary rather than stretching it and gave the mechanism a third state.
  The gate now reports `PASS_WITH_ACCEPTED_RISK`, with the waiver
  `arr-2026-09-10-strict-status-checks` naming the failure mode, the measured cost, the
  owner-attested frequency as an ASSUMPTION, the repair path and an expiry of 2026-12-09.
  Nothing was restored on the forge: one seat's constraint, honoured — approval of a
  trust-model change is not authorization to mutate the live ruleset.
  **What the anchor may no longer be cited as:** independent approval, separation of duties,
  protection against unilateral administrator action, or proof of council participation. The
  honest three-part claim, and the limitation that the verifier cannot authenticate an owner
  ruling at all, are written into `docs/contracts/ratification-artifact.md`.
  Superseded reading, kept because it records what the criterion looked like before the ruling:
  **limb 1 met 2026-09-10, limb 2 blocked on a platform capability.** The timing that reading
  was written against, measured from the ruleset history rather than from memory: limb 1 was
  met at 12:51 (version `49256548`) and owner-reversed in two single-field edits, `49271774`
  at 15:14 and `49272069` at 15:16. Read the limb-1 paragraph below with those dates, not as
  current state.
  This entry read `resolved` for one commit on the premise that both limbs were met. Limb 2 was
  then falsified by CI and the claim is corrected here rather than left standing. **What limb 2
  ran into:** the gate reads `repos/{owner}/{repo}/rulesets`, which needs the repository
  `administration` permission — and that scope **does not exist for a workflow
  `GITHUB_TOKEN`**. actionlint refused `administration: read` as an *"unknown permission
  scope"* and listed the sixteen that do exist; none grants it. So the CI token structurally
  cannot read the rulesets, the gate would report `UNVERIFIABLE`, and because it fails closed
  by design that would red every kernel and governance pull request for a reason unrelated to
  the platform's actual state. Three alternatives were rejected on the council's own reasoning:
  `continue-on-error` makes the gate advisory, skipping when unauthenticated makes it fail
  open, and wiring it into `Sync + Generate Tools Consistency` would freeze merges repo-wide on
  any red. **What closes limb 2:** a PAT in a repository secret carrying
  `administration: read`, then the workflow step. That is a human action. Until then the gate
  runs in `taskfiles/ci-fast.yml` — a real pre-push control, and not a CI one, which is the
  honest description. **Limb 1 — SUPERSEDED READING of 2026-09-10 12:51, kept because it is
  what was true for two and a half hours and a blind review caught it still standing as
  present-tense fact.** Every part of it is now false: the two approval settings were reverted
  by the owner at 15:18 and then ruled out of the trust model, and the gate does not report
  `COMPLIANT` — it reports `PASS_WITH_ACCEPTED_RISK`, with `strict_required_status_checks`
  covered by a dated waiver. The current verdict is in `What to do` below; this paragraph is
  history, not status. Original text: the owner changed the three
  ruleset settings and
  `./scripts-run src/scripts/check_platform_anchor --files src/rules/commit-policy.md`
  exits **0**, reporting `platform anchor COMPLIANT for event4u-app/agent-config` with
  `approving reviews required: 1 (policy floor 1)`. Read back from the forge after the write:
  ruleset `17749383` now carries `required_approving_review_count: 1`,
  `require_last_push_approval: true`, `bypass_actors: []`, and `current_user_can_bypass` has
  gone from `always` to **`never`** — all four rules (`deletion`, pull-request,
  `required_status_checks`, `non_fast_forward`) preserved, enforcement still `active`, the
  required context unchanged. **Limb 2, partially done:** `taskfiles/ci-fast.yml` carries the
  gate in the `preflight` list and as its own `check-platform-anchor` target, and
  `check_ci_local_parity` and `check_gate_reachability` both exit 0 over that wiring. The
  workflow half is what the `administration` scope blocks, above. `rule-backstops.yml` carries
  a comment recording the scope refusal in place of the step, so the next reader does not spend
  the cycle re-discovering the scope list. **What this does NOT resolve:** the deny retirement. The retirement itself was refused
  2/2 in round 2 and needs its own council decision and its own ratification artifact —
  `kernel-guard-first-crossing` stays open and may not cite this entry as approval.

  **LIMB 1 WAS UNDONE THE SAME AFTERNOON, BY THE OWNER, DELIBERATELY. The paragraph above
  is the 12:51 reading and is no longer current state.** It is kept because it is the
  verification that was actually performed, and because a record that quietly rewrites its
  own measurements cannot be checked later. What happened after it: the 12:51 settings made
  the repository unmergeable — this repository has zero eligible approvers, GitHub does not
  permit approving your own pull request, and `bypass_actors` was emptied in the same edit.
  PR #1988 measured `mergeable: MERGEABLE`, `mergeStateStatus: BLOCKED`,
  `reviewDecision: REVIEW_REQUIRED` with every required check green.

  **Six versions exist on 2026-09-10 and each edit changed one field.** `49271774` at 15:14
  set `required_approving_review_count` back to `0`; `49272069` at 15:16 set
  `require_last_push_approval` back to `false`; `49272180` at 15:18 changed **only**
  `strict_required_status_checks_policy`, a separate owner decision on measured cost;
  `49276909` at 16:04 restored that field on the mistaken assumption it had been a side
  effect and `49277135` at 16:06 returned it. PR #1988 merged at `13:17:09Z` — 15:17:09
  local, after 15:16 and before 15:18 exists, so the 15:18 edit is not part of what
  unblocked it. `bypass_actors: []` and `current_user_can_bypass: never` still hold.

  **UPDATE 2026-09-13 — limb 1 IS met, the three findings are gone, and the route named
  below was not the one taken.** Measured today: `check_platform_anchor` reports
  `PASS_WITH_ACCEPTED_RISK` and exits 0. No exemption over the approval dimensions was ever
  built; the owner ruled instead that a mandatory approving review is not wanted on this
  repository at all, so `minimum_approving_reviews` and `require_last_push_approval` left
  `src/config/platform-anchor.json` AND `NON_NEGOTIABLE_FLOOR` entirely — a dimension outside
  the trust model is not a waived rule. The third finding,
  `strict_required_status_checks`, is covered by the dated owner waiver
  `arr-2026-09-10-strict-status-checks` (expires 2026-12-09), which is the
  `accepted_risk_reductions` mechanism `road-to-bounded-approval-floor-waiver.md` designed
  and which a council reviewed and ratified 2/2 on 2026-09-13. **That roadmap is superseded
  for the approval half and closed**; do not read the sentence below as an open dependency
  on it.

  Two further corrections from the same re-measurement. `bypass_actors: []` and
  `current_user_can_bypass: never` hold **today** and held on every day but one — an
  `OrganizationAdmin` actor with `bypass_mode: always` was re-added 2026-09-11 (version
  `49393554`) and removed again 2026-09-12 (`49500777`), so "still hold" above is true of
  now and not of the whole interval. And **eight** ruleset versions exist as of 2026-09-13,
  not six; the paragraph above counts only through 16:06 on 2026-09-10 and is correct for
  that date.

  *Original text, true between the 15:16 edit and the waiver landing:*
  So limb 1 is **not met** and the gate reports three findings again — all three intended.
  What it now waits on is the in-repository half: a structured, evidence-carrying exemption
  rather than a lowered floor, per
  `agents/roadmaps/archive/road-to-bounded-approval-floor-waiver.md`. Verify with
  `gh api repos/event4u-app/agent-config/rulesets/17749383/history` rather than from any
  paragraph here.

  **What is NOT discharged, corrected after a neutral review.** An earlier version of this
  correction said the `bypass_actors` item "stands and is done" and that this entry's "what
  may not stand" clause was "discharged on the platform side". That closed what both
  2026-09-10 council seats flagged as open: with `bypass_actors: []` and no bypass, a future
  ruleset mistake re-locks the sole maintainer out of the PR path exactly as 12:51 did, and
  openai required that recoverability be *established* rather than inferred from
  `current_user_can_bypass: never`, which describes bypass capability and not
  ruleset-administration authority. `admin: true` is measured on the acting account, which is
  a capability and not a rehearsed procedure. The removal satisfies
  `allow_unconditional_bypass: false`; the recovery path is Phase 0.2 of the waiver roadmap
  and is open.

  **UPDATE 2026-09-13 — the written half landed, the rehearsal did not, and this blocker now
  carries the remainder.** `docs/contracts/branch-protection-policy.md` § Administrator
  recovery from a lockout gives the five-step procedure with exact commands: confirm it is a
  ruleset lockout and not a red check, capture the broken state, read the last good version
  (via `.state`, which the history payload nests and a naive `.bypass_actors` jq misses),
  restore by preferring `enforcement=evaluate` over a full object PUT, then re-enable and
  verify in the same session. What is still missing is the one thing 0.2 required to call it
  tested: **an execution against a non-default-branch ruleset.** That is an admin API write
  on repository protection settings — Hard-Floor under `non-destructive-by-default`, reserved
  for the maintainer with explicit this-turn confirmation — so no agent can discharge it, and
  the waiver roadmap closed with that box deliberately open. Until a maintainer rehearses it,
  the procedure is a documented hypothesis: the commands are the right ones and nobody has
  watched them work.
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** the deny retirement (5.2's second half) and therefore Phase 1's five kernel
  steps. **CORRECTED 2026-09-10 — this field used to read "nothing today", which was true when
  5.2 was expected to ship the retirement on its own.** It is not true now: the round-2 review
  refused the retirement over the head-controlled enforcement path, and both 2026-09-10 council
  seats tied the retirement to this anchor reading compliant. So the dependency edge runs
  through here, and recording it as harmless would understate what is waiting on it.
  **One qualification added 2026-09-10 afternoon, and RESTATED 2026-09-13 because the
  exemption it anticipated was never built.** "Reading compliant" was written when compliance
  meant the approval floor satisfied. It does not mean that now, and the actual weakening is
  larger than the qualification predicted: not compliant-with-approvals-suspended, but
  compliant **with the two approval dimensions removed from the trust model altogether**,
  plus `strict_required_status_checks` deviating under a dated owner waiver. So the anchor
  today reads `PASS_WITH_ACCEPTED_RISK` while proving nothing whatever about independent
  human review — which is a materially weaker precondition than the seats had in mind when
  they attached the retirement to it. Whether it still satisfies the condition they set is
  part of the retirement's own council decision, and this entry settles it even less than
  before. The reviewing council of 2026-09-13 sharpened the same point from the other side:
  `check_platform_anchor` is a locally invoked control an administrator may skip and both
  sides of whose comparison an administrator may edit, so it must not be cited as evidence of
  enforced repository-wide compliance in any retirement argument.
- **What to do:** **THE DECISION IS MADE AND THE GATE IS BUILT, 2026-09-10. What is left is a
  repository-settings change only a human with admin rights can perform, which is why this
  entry stays open.** An AI council (anthropic/claude-sonnet-4-5 + openai/codex-default,
  2 rounds, blind peer review, 2/2 convergent) chose option (a) — build the verification —
  under a written owner delegation, and both seats required explicitly that this blocker
  *remain* unresolved until the settings and the verifier agree. openai: *"Build the full
  verifier and keep `ratification-platform-anchor` unresolved until both the repository
  settings and verifier pass."*

  Landed in this change: `src/scripts/check_platform_anchor.ts` (the gate),
  `src/scripts/_lib/platform_anchor.ts` (its pure evaluator, with the non-negotiable floor a
  policy edit cannot cross), `src/config/platform-anchor.json` (the committed expectation) and
  `tests/scripts/platform_anchor.test.ts` (25 tests, both polarities on every rule).

  **A premise in the original entry was wrong and is corrected rather than carried.** It named
  `gh api repos/{owner}/{repo}/branches/{branch}/protection` as the readable surface. Measured
  2026-09-10, that endpoint returns `404 {"message":"Branch not protected"}` — this repository
  uses repository **rulesets**, not classic branch protection. A gate written against the
  classic endpoint would have measured nothing and passed. The evaluator reads
  `repos/{owner}/{repo}/rulesets` and unions every applicable active branch ruleset rather
  than reading one by id, which openai made a condition: assuming ruleset `17749383` or its
  name would break the first time an administrator splits it.

  **SUPERSEDED, 2026-09-10 — the three settings this field used to demand are no longer the
  action, and a blind completion review caught that they were still standing here.** The field
  said: set `required_approving_review_count` to at least 1, set `require_last_push_approval`
  true, and remove the unconditional bypass. Item 3 was done and held. Items 1 and 2 were done,
  reverted by the owner, and then **ruled out of the trust model entirely** — the owner is the
  one active maintainer and a mandatory approval is a stop rather than a control, so those two
  dimensions left the enforced set and the floor rather than becoming exemptions. Instructing a
  later reader to restore them would mutate the live ruleset against a recorded ruling, which
  the ratification artifact for that change explicitly says its authority does not cover.

  **TWO THINGS ARE LEFT, and an earlier version of this paragraph named only the first.**
  It said "THE ONE ACTION LEFT ... Everything else is done", which dropped the second — a
  claim the merge with the reversal record refuted rather than a summary of it.

  **(1) A PAT in a repository secret carrying `administration: read`**, so the gate can run
  in a workflow. Neither a setting nor a diff. The rulesets endpoint needs that scope and a
  workflow `GITHUB_TOKEN` cannot be granted it — actionlint refused `administration: read` as an *"unknown permission scope"* and listed
  the sixteen that exist, none of which grants it. Until the secret exists the gate runs in
  `taskfiles/ci-fast.yml` (a real pre-push control, not a CI one), is declared under
  `local_only:` with the class `token-scope-unavailable`, and carries a reachability exemption
  naming this exact promotion condition.

  **(2) Item 3 — the removed administrator bypass — is NOT discharged, and the CI-wiring
  half above is not what it waits on.** Removing `bypass_actors` satisfies
  `allow_unconditional_bypass: false` and simultaneously removes the recovery path from the
  next lockout, which both 2026-09-10 council seats raised and neither closed. openai
  required that recoverability be **established** rather than inferred from
  `current_user_can_bypass: never`, which describes bypass capability and not
  ruleset-administration authority; anthropic wrote that the design needs a tested
  administrator-level recovery procedure *"which neither reviewer proposes"*. `admin: true`
  on the acting account is a capability, not a rehearsed procedure. The owner question in
  `threat_model_note` is likewise unchanged and still open. Measured state, so this is not
  read from memory: `bypass_actors` is `[]` and `current_user_can_bypass` is `never`.

  **The ruleset history behind all of it**, from
  `gh api repos/event4u-app/agent-config/rulesets/17749383/history` rather than from
  memory: six versions exist on 2026-09-10. `49256548` at 12:51 applied all three items,
  which made the repository unmergeable — zero eligible approvers, no self-approval on
  GitHub, and the administrator escape removed in the same edit; PR #1988 measured
  `mergeStateStatus: BLOCKED` with every required check green. `49271774` at 15:14 and
  `49272069` at 15:16 reversed items 1 and 2, one field each, and #1988 merged at 15:17:09
  local — one minute *before* `49272180` at 15:18, which touched only
  `strict_required_status_checks_policy`. `49276909` at 16:04 restored `strict` on the
  assumption that 15:18 had been a side effect and `49277135` at 16:06 returned it to
  `false` once the owner stated the intent.

  **`agents/roadmaps/archive/road-to-bounded-approval-floor-waiver.md` is superseded for the
  approval half.** It plans a bounded waiver over `minimum_approving_reviews` and
  `require_last_push_approval`; a later ruling removed both dimensions instead, and a
  dimension outside the trust model is not a waived rule. Its mechanism did land — as
  `accepted_risk_reductions`, over `strict_required_status_checks`, which is the one
  dimension the repository still wants.

  Current verdict, reproducible:
  `./scripts-run src/scripts/check_platform_anchor --files src/rules/commit-policy.md` exits
  **0** with `PASS_WITH_ACCEPTED_RISK` — every hard dimension present, and
  `strict_required_status_checks` covered by waiver `arr-2026-09-10-strict-status-checks`,
  which expires 2026-12-09.
- **Recommendation:** create the PAT secret, wire the workflow step, and establish the
  administrator recovery procedure item 3 removed the escape from. In particular do **not**
  re-add the approval dimensions — that is the
  instruction this entry used to carry and it is now contrary to a recorded owner ruling. The
  recommendation before that one — *"build it, scoped to the kernel/governance surface only"* —
  was discharged when the gate landed.
- **If you do nothing:** the gate keeps running pre-push and never in CI, so a governance diff
  pushed without `task preflight` reaches `main` with the anchor unchecked — and the next
  ruleset lockout has no rehearsed way out, because the escape was removed and no procedure
  replaced it. The residual is smaller than this field used to describe, but it is two items
  rather than one: the anchor itself now passes,
  the accepted risk is recorded with an expiry, and
  `docs/contracts/ratification-artifact.md` states what a green anchor is and is not evidence
  of — no claim of independent approval, separation of duties, or protection against
  unilateral administrator action survives in it.
- **Resolved when:** BOTH of these hold. The second was added 2026-09-10 after a blind review
  pointed out that the first alone lets this blocker close with the gate inert, and it is
  **re-scoped in the same breath rather than left unmeetable**, because its original wording
  required a workflow step the platform cannot authenticate:
  1. `./scripts-run src/scripts/check_platform_anchor --files src/rules/commit-policy.md`
     exits 0 against the live repository. **Met 2026-09-10** —
     `PASS_WITH_ACCEPTED_RISK`, with the one waived dimension named and dated.
  2. `grep -c check_platform_anchor taskfiles/ci-fast.yml` returns at least 1 — **met** — AND
     the gate appears in a `.github/workflows/` step, which needs the PAT secret above.
     Until then the honest substitute is in place and gate-verified rather than asserted: the
     `local_only:` declaration and the reachability exemption both name the promotion
     condition, and `check_ci_local_parity` and `check_gate_reachability --gate` exit 0 over
     them. A reader can tell "not wired" from "wired and quietly skipping", which is what the
     reviewer's objection was actually about.

  The second limb of the original clause, *"or a recorded owner decision states that the platform's own enforcement
  is the anchor and the gate need not re-assert it"*, is **withdrawn**: the council rejected it
  on measurement, because the platform's own enforcement demonstrably does not include an
  independent approval, so a decision to rely on it would rely on nothing. openai:
  *"Option (b) would therefore turn a known failed invariant into a green result."*

- **Re-measured 2026-09-13 against the live forge, reading the changed criterion rather than
  the superseded one.** Every figure below was executed in this run; none is copied forward.
  - **Limb 1 — still met.** `./scripts-run src/scripts/check_platform_anchor --files
    src/rules/commit-policy.md` exits **0**, reporting `PASS_WITH_ACCEPTED_RISK for
    event4u-app/agent-config` over applicable active ruleset `17749383`. The two approval
    dimensions print as *"observed, not required here (see NON_NEGOTIABLE_FLOOR)"* — which is
    the shape the 2026-09-10 owner ruling asked for and NOT a finding, so a reader must not
    re-derive the three-gap reading the superseded paragraphs above record. The one waived
    dimension is `strict_required_status_checks` under `arr-2026-09-10-strict-status-checks`,
    whose expiry is **2026-12-09** — 87 days out at this reading, so the waiver is live and the
    verdict is not a lapsed pass.
  - **Limb 2 — still half-met, and the missing half is still the PAT.**
    `grep -c check_platform_anchor taskfiles/ci-fast.yml` returns **2**, so the pre-push half
    holds. `grep -rc check_platform_anchor .github/workflows/*.yml | grep -v ':0'` returns
    exactly one line, `rule-backstops.yml:1`, and that hit is the comment recording the
    `administration: read` scope refusal — not a step. So the gate still runs pre-push and
    never in CI, which is what limb 2 requires and what only a human-created repository secret
    can change.
  - **Item 2 — the unrehearsed recovery path — is unchanged and still open.** Measured, not
    inferred: `gh api repos/event4u-app/agent-config/rulesets/17749383` reports
    `bypass_actors: []`, `current_user_can_bypass: "never"`, `enforcement: "active"`. That is
    the same state both 2026-09-10 council seats declined to close, and nothing in this run
    establishes a rehearsed administrator recovery procedure — measuring the absence of a
    bypass is not the same as testing the way back from a lockout.
  **Net for this blocker: no limb moved between 2026-09-10 and 2026-09-13.** Both remaining
  items are human actions on the forge, so an agent run can re-measure them and cannot advance
  them, which is what this re-measurement did.

- **RE-MEASURED 2026-09-14 — LIMB 1 HAS REGRESSED. It was met on 2026-09-13 and is not met now,
  and the cause is a forge edit made this morning.** Do not carry forward the
  `PASS_WITH_ACCEPTED_RISK` reading above as current state.
  `./scripts-run src/scripts/check_platform_anchor --files src/rules/commit-policy.md` exits
  **1** and reports `platform anchor NONCOMPLIANT for event4u-app/agent-config` on one finding:
  *"[thread-resolution-missing] `required_review_thread_resolution` is off, so an open objection
  cannot block a merge."* (Read the exit code directly — piping the gate into `tail` reports
  `tail`'s status and shows a misleading `0`.)
  **The expectation did not change; the forge did.** `required_review_thread_resolution: true`
  has been in `src/config/platform-anchor.json` since the schema-2 write of 2026-09-10 and that
  file is untouched — `git log -- src/config/platform-anchor.json` still ends at `b4beff026`.
  Measured against the ruleset history rather than inferred: version `49500777` (2026-09-12
  15:05) carries `required_review_thread_resolution: true`; the current version `49599840`
  (2026-09-14 09:19:21) carries `false`. Every other field of the ruleset rule of type
  `pull_request` is byte-identical across the two, and `bypass_actors: []` holds in both.
  **Three ruleset edits were made this morning within 56 seconds**, and the middle one explains
  the loss: `49599808` (09:18:25) still carries the ruleset rule of type `pull_request` with the
  field `true`; `49599828` (09:18:58) carries **no rule of type `pull_request` at all** (only `deletion`,
  `non_fast_forward`, `required_status_checks`); `49599840` (09:19:21) re-adds the rule with the
  field `false`. That is the shape of a rule toggled off and back on, with a non-default
  sub-setting not restored — but this run measured the sequence, not the intent, and does not
  assert which it was.
  **Why this is not simply repaired here.** Restoring it is a write to live repository
  protection settings — Hard Floor under `non-destructive-by-default`, maintainer-only with
  explicit this-turn confirmation — and this file already records the governing constraint from
  the 2026-09-10 council: *approval of a trust-model change is not authorization to mutate the
  live ruleset.* So an agent may report it and may not fix it.
  **The owner decision this needs is a fork, not a chore.** Either (1) set
  `required_review_thread_resolution` back to `true` on ruleset `17749383`, which restores limb 1
  with no other change; or (2) rule the dimension out of the trust model the way the two approval
  dimensions were ruled out on 2026-09-10, which means deleting it from
  `src/config/platform-anchor.json` and is a governance diff; or (3) record a dated
  `accepted_risk_reductions` waiver for it, the mechanism `arr-2026-09-10-strict-status-checks`
  already uses. (1) is one setting and needs no reviewer. Until one of the three, **limb 1 is
  unmet and this blocker is further from resolution than it was on 2026-09-13** — which is worth
  stating plainly, because the previous three readings all moved sideways and this one moved
  backwards.
  **Limb 2 is unchanged:** `grep -c check_platform_anchor taskfiles/ci-fast.yml` returns 2, and
  the only `.github/workflows/` hit is still `rule-backstops.yml`'s comment recording the
  `administration: read` scope refusal. The PAT secret is still the missing half.
  **Item 2 (the unrehearsed recovery path) is unchanged and still open** — measured above,
  `bypass_actors: []` in both ruleset versions read today.
  **One thing this regression demonstrates, and it is the mechanism working.** The anchor caught
  a single sub-field silently dropped from a ruleset rule within three minutes of the edit, on a
  dimension no human would have re-read. That is the argument for the gate; it is also the
  argument against retiring the kernel deny in favour of CI, since the control that noticed this
  is the one that runs pre-push and not the one that runs in a workflow.

- **RE-MEASURED 2026-10-01 against `origin/main` `9f2b9fb4a` and the live forge — LIMB 1 HAS BEEN
  REPAIRED. The 2026-09-14 regression is gone, and this is the first reading in four to move
  FORWARD.** Do not carry the *"further from resolution than it was"* verdict above as current
  state; it described 2026-09-14 and a forge edit two weeks later corrected it.
  **Measured, pinned so the verdict is reproducible rather than wall-clock dependent:**
  `./scripts-run src/scripts/check_platform_anchor --as-of 2026-10-01 --files src/rules/commit-policy.md`
  exits **0** with `platform anchor PASS_WITH_ACCEPTED_RISK for event4u-app/agent-config` over
  applicable active ruleset `17749383`. The `thread-resolution-missing` finding that made
  2026-09-14 red is **absent**. (Read the exit code off the unpiped command, per the 2026-09-14
  note — piping the gate into `tail` reports `tail`'s status.)
  **The expectation still did not change; the forge changed back.**
  `src/config/platform-anchor.json` is untouched at `b4beff026` and still carries
  `required_review_thread_resolution: true` at `:9`. The repair is a single ruleset edit:
  version **`51122772`, 2026-09-28T10:20:12+02:00**, the only version written since the
  three-edit sequence of 2026-09-14. Read from the history payloads rather than inferred —
  `…/rulesets/17749383/history/49599840` carries `required_review_thread_resolution: false`,
  `…/history/51122772` carries `true`. So option **(1)** of the three-way fork this entry named
  on 2026-09-14 is what happened: the setting was put back, no governance diff, no new waiver.
  **What has NOT moved, and neither item is agent-dischargeable:**
  - **Limb 2 — still half-met, still the PAT.** `grep -c check_platform_anchor
    taskfiles/ci-fast.yml` returns **2**, so the pre-push half holds.
    `grep -rc check_platform_anchor .github/workflows/*.yml | grep -v ':0'` returns exactly one
    line, `rule-backstops.yml:1`, and that hit is the comment at `:697` recording the
    `administration: read` scope refusal — not a step.
  - **Item 2 — the unrehearsed recovery path — unchanged.** Measured, not inferred:
    `bypass_actors: []`, `current_user_can_bypass: "never"`, `enforcement: "active"`. Still the
    state both 2026-09-10 council seats declined to close, and nothing in this run rehearses a
    recovery.
  **The waiver is live and not lapsed:** `arr-2026-09-10-strict-status-checks` expires
  **2026-12-09**, 69 days from this reading. A run finding this entry after that date must
  re-measure rather than quote the pass — an expired waiver turns `PASS_WITH_ACCEPTED_RISK`
  back into a finding.
  **Net: limb 1 met, limb 2 half-met, item 2 open, so the blocker stays OPEN.** Both remaining
  items are forge actions — a human-created repository secret and a human-rehearsed recovery
  procedure — which an agent run can re-measure and cannot advance. That is all this
  re-measurement did.

- **RE-MEASURED 2026-10-05 against `origin/main` `6aa3c36f9` and the live forge. NO LIMB MOVED
  since 2026-10-01, and this reading adds a control the previous five did not run.** Every
  figure executed; none copied.
  - **Limb 1 — still met.**
    `./scripts-run src/scripts/check_platform_anchor --as-of 2026-10-05 --files src/rules/commit-policy.md`
    exits **0**: `platform anchor PASS_WITH_ACCEPTED_RISK for event4u-app/agent-config`, over
    applicable active ruleset `17749383`, with the two approval dimensions printing as
    *"observed, not required here (see NON_NEGOTIABLE_FLOOR)"* and no finding. The
    `thread-resolution-missing` regression of 2026-09-14 is still absent.
  - **CONTROL, and it is the thing four earlier readings asserted without testing: the green is
    an evaluation, not a vacuous skip.** The same gate against an out-of-scope file —
    `--files README.md` — prints *"no kernel rule, governance hook, ratification mechanism or
    platform expectation in the diff — the platform anchor is not consulted"* and
    `ledger: planned 1 · completed 0 · failed 0 · out_of_scope 1`. The in-scope run reports
    `completed 1 · out_of_scope 0`. So the gate discriminates, and limb 1's pass is a forge
    read rather than a scope filter quietly swallowing the question.
  - **The waiver is live, not lapsed.** `arr-2026-09-10-strict-status-checks` expires
    **2026-12-09** — 65 days from this reading. A run arriving after that date must re-measure:
    an expired waiver turns `PASS_WITH_ACCEPTED_RISK` back into a finding.
  - **Limb 2 — still half-met, still the PAT, and the hit is still a comment.**
    `grep -c check_platform_anchor taskfiles/ci-fast.yml` returns **2**.
    `grep -rc check_platform_anchor .github/workflows/*.yml | grep -v ':0'` returns exactly one
    line, `rule-backstops.yml:1`; reading that hit rather than counting it,
    `grep -n check_platform_anchor .github/workflows/rule-backstops.yml` returns `:697`, whose
    text begins *"`check_platform_anchor` is NOT wired here"*. A comment, not a step.
  - **Item 2 — the unrehearsed recovery path — unchanged and still open.** Nothing in this run
    rehearses a recovery, and re-measuring the absence of a bypass is not the same as testing
    the way back from a lockout.
  **Net: unchanged from 2026-10-01. Both residual items are forge actions a human performs.**
  The one thing this reading contributes beyond a sixth identical net is the control above —
  which is worth more than the net, because it is the first time this entry can say the green
  was falsifiable rather than merely repeated.

### blocker: kernel-guard-first-crossing

> **Note 2026-10-10, `road-to-self-modification-that-a-council-must-pass` step 1.3.**
> `docs/decisions/ADR-281-council-confirmed-self-modification.md` is accepted. For a
> change to the gated surface, and for a change originating in this package's own
> learning lanes, the lowest rung that can pass is now the **council** — an
> independent session alone no longer ratifies — and a change to the reviewer itself
> joins the owner's list. Nothing in this blocker is edited by that note; it is
> recorded here because this blocker's resolution will be read against the new ladder.
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phase 1 in full — 1.1, 1.2, 1.3, 1.5 and 1.6 edit kernel rules, and the
  tool-call deny still stands. 1.4 (`autonomous-execution`) and 1.7 (`tool-safety`) are not
  kernel members and are reachable.
- **What to do:** **REOPENED 2026-09-10. This entry read `resolved` on a claim the tree
  contradicts, and the correction is recorded here rather than by quietly flipping the field.**
  The resolution text asserted that *"`src/scripts/hooks/block_kernel_rule_writes.ts` is
  deleted along with its three `pre_tool_use` bindings"*. Measured at `origin/main`
  `7bf325f3b`: the file EXISTS (13,075 bytes), it is bound in three `pre_tool_use` slots
  (`src/scripts/hook_manifest.yaml:1265`, `:1296`, `:1342`), and it is registered at
  `src/scripts/hooks/concern_registry.ts:117`. Step 0.2 of this same file, still unchecked,
  records the opposite and is the correct account: the replacement was refused 2/2 by the
  round-2 ratification review, so the deny stands. Half the original claim IS true and stays
  — `check_kernel_edit_ratified.ts` exists and runs in `ci-fast` and in the `consistency`
  workflow — but the deny was never retired, so the `either/or` in the old `Resolved when`
  was read against its own purpose. An AI council (anthropic/claude-sonnet-4-5 +
  openai/codex-default, 2/2 convergent, blind peer review, 2026-09-10) confirmed the reopen
  under a written owner delegation: *"The blocker claiming it was deleted is objectively false
  and must be reopened to `Status: open` with the false resolution corrected."*
- **Recommendation:** do not attempt the crossing until the platform anchor reads compliant.
  Both council seats tied the two together: the deny may retire only once
  `check_platform_anchor` passes, because retiring it moves the whole weight of kernel
  immutability onto a CI gate whose independence rests on platform controls that are
  measurably absent. See `ratification-platform-anchor`, which is the real root blocker.
- **If you do nothing:** Phase 1's five kernel steps stay unreachable for an agent — the deny
  has no agent-accessible override by design — and the roadmap cannot pass 100 % without
  either a maintainer-authored kernel commit or the retirement. Nothing degrades; the work
  simply does not proceed.
- **Resolved when:** either a maintainer-authored kernel commit lands on the branch, or
  `block_kernel_rule_writes.ts` is gone AND its three `hook_manifest.yaml` bindings AND its
  `concern_registry.ts` registration are gone, with `check_kernel_edit_ratified` in its place.
  Verify with `ls src/scripts/hooks/block_kernel_rule_writes.ts` (must fail) and
  `grep -c block-kernel-rule-writes src/scripts/hook_manifest.yaml` (must return 0) — the
  file-existence half is what the 2026-09-09 reading skipped.
- **Re-verified 2026-09-13 against `origin/main` `7182f5d07`, the base of the drain run that
  wrote this line. The reopen stands and nothing has moved toward either resolution.** Both
  limbs of the `Resolved when` clause were executed rather than read: `ls
  src/scripts/hooks/block_kernel_rule_writes.ts` **succeeds** (the clause requires it to fail)
  and the file is **13,577 bytes** — larger than the 13,075 the 2026-09-10 entry measured, so
  this is a fresh read and not a figure copied forward; `grep -c block-kernel-rule-writes
  src/scripts/hook_manifest.yaml` returns **5** where the clause requires 0. Four of the five
  are load-bearing: the concern definition at `:183` and three `pre_tool_use` binding lists at
  `:1360`, `:1391` and `:1437`; the fifth (`:466`) is a comment naming the blocking trio. The
  line numbers have drifted from the `:1265`, `:1296`, `:1342` recorded on 2026-09-10, which is
  further evidence the manifest moved while the binding did not.
  `src/scripts/hooks/concern_registry.ts:119` still registers the concern. The alternative limb
  is unmet too: no maintainer-authored kernel commit exists on this run's branch, and an agent
  cannot author one — that is the deny's design, not a gap in it.
- **Re-verified AGAIN 2026-09-14 against `origin/main` `7b5f75edc`. Both limbs still unmet, and
  this time the deny was reproduced rather than only inspected.** Executed, not copied forward:
  `ls src/scripts/hooks/block_kernel_rule_writes.ts` **succeeds** where the clause requires it to
  fail, at **13,577 bytes** — unchanged from the 2026-09-13 reading, so the file itself did not
  move this week even though `main` did. `grep -c block-kernel-rule-writes
  src/scripts/hook_manifest.yaml` returns **5** where the clause requires 0; the line numbers have
  drifted again, from `:1360/:1391/:1437` to **`:1390`, `:1422`, `:1469`** for the three
  `pre_tool_use` binding lists, with the concern definition at `:183` and the comment at `:466`.
  `concern_registry.ts` still registers it, now at **`:120`** rather than `:119`. The manifest
  keeps moving and the binding does not, which is the same conclusion the previous two readings
  reached by the same method.
  **New this reading, and the reason the numbers above are no longer the strongest evidence:** the
  edit was ATTEMPTED. Step 1.1's own change was put to the `Edit` tool against
  `src/rules/non-destructive-by-default.md` and the `pre_tool_use` dispatcher returned
  `block-kernel-rule-writes: BLOCKED`, naming the rule, the tighten-only remediation and the
  contract. Nothing was written. So this blocker is no longer resting on a grep over a manifest —
  the control was exercised and refused, which is what *"Resolved when"* is really asking about.
  The alternative limb is still unmet: no maintainer-authored kernel commit on this branch.
- **Re-verified 2026-10-01 against `origin/main` `9f2b9fb4a`. Both limbs unmet. The deny was
  reproduced again, and this reading is not a copy of the last one — the guard's own file has
  changed since.** Executed, not carried forward:
  `ls -l src/scripts/hooks/block_kernel_rule_writes.ts` **succeeds** where the clause requires
  it to fail, at **11,345 bytes** — down from the 13,577 measured on 2026-09-13 and 2026-09-14.
  Three commits touched it in between (`b8a7037e3`, `70bc596b1`, `c271f27a8`), the latter two
  ratifying and correcting its docstring, so the shrink is documentation and not reach: the
  header still enumerates all nine kernel rules and still claims the source tree plus every
  projection.
  `grep -c block-kernel-rule-writes src/scripts/hook_manifest.yaml` returns **5** where the
  clause requires 0 — the concern definition at `:198`, a comment at `:502`, and three
  `pre_tool_use` binding lists at **`:1427`, `:1459`, `:1506`**, drifted again from the
  `:1390/:1422/:1469` of 2026-09-14. `concern_registry.ts` still registers it, now at **`:121`**
  (was `:120`, was `:119`). Fourth consecutive reading in which the manifest moves and the
  binding does not.
  **The deny was exercised, not inspected.** Step 1.1's own edit was put to the `Edit` tool
  against the kernel rule and the `pre_tool_use` dispatcher returned `block-kernel-rule-writes:
  BLOCKED`, naming the rule, the tighten-only remediation and the contract. Nothing was
  written — `grep -c 'this turn'` returns 1 and `git status --short` is empty.
  **One thing this run learned that the previous three did not, and it widens the blocker
  slightly.** The guard also fires on **Bash** calls whose command text carries a kernel-rule
  path in a write-ish argument shape.
  **WITHDRAWN 2026-10-05 — the half of that sentence naming a READ was false, and it is
  corrected here rather than quietly dropped.** It went on: *"a read-only `grep -c …
  src/rules/non-destructive-by-default.md` was refused by the same concern … a future session
  verifying 1.1 must expect its own verify command to be denied."* Executed verbatim at
  `6aa3c36f9`, `grep -c 'this turn' src/rules/non-destructive-by-default.md` **runs and returns
  1**. It is not refused, and a future session must NOT expect its verify command to be denied —
  reading the old note would have made a successful verify look like a missing control.
  **Both polarities were exercised in the same session on the same tree, so the negative is a
  real negative and not a dead guard.** Write shape: `sed -i '' -e 's/ZZZ_NO_SUCH_STRING_ZZZ/x/'`
  on the same path → `block-kernel-rule-writes: BLOCKED — kernel rule non-destructive-by-default
  is immutable`. Read shape: the `grep -c` above → exit 0, output `1`. The guard's own header
  settles which is intended — `grep -n 'Reads stay allowed' src/scripts/hooks/block_kernel_rule_writes.ts`
  returns `:164`, *"Reads stay allowed — a kernel rule is immutable, not secret"* — and its Bash
  branch is enumerated from `grep -n 'deliberately narrow' …` at `:162` as redirection, an
  in-place `sed`, a `tee`/`truncate`/`rm`, or a `mv`/`cp` DESTINATION.
  A `grep` is none of those. So the 2026-10-01 denial was real but misattributed: something
  refused that call and it was not this concern.
  **Searched for other copies, because one instance is a sample.**
  `grep -rniI 'read-only .grep\|verify command to be denied' --include="*.md" .` over the tree
  (excluding `node_modules`) returns **2 lines, both inside this one paragraph**, and the same
  pattern over the session memory store returns **0**. Control, run in the same breath so the
  zero is a reading rather than a broken grep: `grep -rlI 'DENY REPRODUCED' --include="*.md" .`
  returns this file, and the memory-store control returns three files. Population searched,
  count 1 site, 1 file — this one.
  The alternative limb is unmet as before: no maintainer-authored kernel commit on this branch,
  and an agent cannot author one — the deny's design, not a gap in it.
  **Relationship to the sibling blocker, restated because it moved this week.**
  `ratification-platform-anchor`'s limb 1 was repaired on the forge on 2026-09-28 and now reads
  `PASS_WITH_ACCEPTED_RISK` again. That does **not** advance this blocker, and the Recommendation
  below still stands: the 2026-09-10 council tied the retirement to an anchor that proves
  independent review, and the anchor in its post-ruling shape proves no such thing — a point the
  2026-09-13 reviewing council sharpened from the other side. A green anchor is a precondition
  that is once more satisfied; it is not the one the seats had in mind.
- **Re-verified 2026-10-05 against `origin/main` `6aa3c36f9`. Both limbs unmet, the deny
  reproduced for the FIFTH consecutive reading, and this one carries a polarity control the
  previous four did not.** Executed, not carried forward:
  `ls -l src/scripts/hooks/block_kernel_rule_writes.ts` **succeeds** where the clause requires
  it to fail, at **11,345 bytes** — unchanged from 2026-10-01, so the guard file itself did not
  move in the four days `main` did.
  `grep -c block-kernel-rule-writes src/scripts/hook_manifest.yaml` returns **5** where the
  clause requires 0 — the concern definition at **`:231`**, a comment at **`:557`**, and three
  `pre_tool_use` binding lists at **`:1546`**, **`:1588`** and **`:1635`**. Every one of those
  has drifted from the `:198`/`:502`/`:1427`/`:1459`/`:1506` of 2026-10-01.
  `grep -n 'block_kernel_rule_writes' src/scripts/hooks/concern_registry.ts` returns `:54` (the
  import) and **`:121`** (the registration) — the first reading in five where the registry line
  did NOT drift. Fifth consecutive reading in which the manifest moves and the binding does not.
  **The deny was exercised, not inspected.** Step 1.1's own edit — replacing the `this turn`
  clause with *"Triggers below require an object-bound grant covering the op"* — was put to the
  `Edit` tool against `src/rules/non-destructive-by-default.md`. The `pre_tool_use` dispatcher
  refused it: `block-kernel-rule-writes: BLOCKED — kernel rule non-destructive-by-default is
  immutable — tighten-only via the override exception registry`, remediation naming a human
  action outside the agent session. Nothing was written: `git status --short` is empty and
  `grep -c 'this turn' src/rules/non-destructive-by-default.md` still returns **1**.
  **NEW THIS READING — the guard's reach is narrower than this entry claimed, and the claim is
  withdrawn above rather than repeated.** A second probe fixed the polarity: an in-place
  `sed -i '' -e 's/ZZZ_NO_SUCH_STRING_ZZZ/x/'` against the same kernel path is **BLOCKED** by
  the same concern, while the read-only `grep -c` above **runs**. So the guard is live and
  write-shaped-only, exactly as its own header says. Both halves matter: the BLOCKED sed is why
  this blocker's negative is not a dead guard, and the running grep is why a later session must
  not read its own verify command's success as a missing control.
  **The 1.1 verify clause reproduces as corrected on 2026-10-01**, measured both ways this run:
  `grep -c 'never act while asking' …` returns **0** and `grep -ic …` returns **1**. The `-i` is
  load-bearing and the clause is satisfiable.
  The alternative limb is unmet as before: no maintainer-authored kernel commit on this branch.

## Fixtures

`G1` mission with a grant · `G2` mission without one · `G3` a mid-run judgement question ·
`G4` a mid-run typed op · `G5`-`G7` the three merge outcomes · `G11` interrupt and auto-resume ·
`G12` revocation mid-run · `G13` a superseded foreign PR closed on evidence · `G14` a foreign
PR carrying unique work · `G15` an authority-expanding kernel edit, inert until ratified.

## Acceptance Criteria

> **All six executed 2026-10-05 at `6aa3c36f9`, each with a control beside any negative, so a
> later run inherits readings rather than re-derives them.** 1 met, 5 open.
> **AC-1 open** — `ls tests/e2e/autonomy/` fails; control, `ls tests/e2e/` lists five specs, so
> the directory is genuinely absent rather than the listing broken.
> **AC-2 open — and the first draft of this line was WRONG, corrected before it shipped.** It
> read *"no corpus report exists"*; `find agents/evidence -iname '*ask*census*'` returns **two**,
> `ask-block-census-baseline.md` and `ask-block-census-after-phase-4.md`. The reports exist and
> the criterion is still open for a different reason, which is the one a later run needs:
> `head -25` on the later report shows its **Roots** are `src/domains`, `src/skills`,
> `src/agent-src/contexts` — the artefact tree, pinned at `b7222ea86` (2026-09-07) — and **not**
> the 30-session corpus AC-2 names. Its totals are 183 `single` and 74 `batch` ask regions over
> 623 files, so the criterion's *"no ask remains for a push, a commit, a CI fix or a conflict"*
> is not in evidence either. What AC-2 wants is a census over SESSIONS; what exists is a census
> over SOURCES, and they are different instruments wearing one script's name.
> **AC-3 MET** — see below.
> **AC-4 open** — `grep -n 'legacy_human_gate' src/config/gate-violation-baselines.json` returns
> nothing; control, the file's first entries read back fine, so the ratchet is unregistered
> rather than the grep misdirected.
> **AC-5 open** — `grep -n 'autonomy:' src/config/agent-settings.template.yml` reads
> `autonomy: auto`, not `on`.
> **AC-6 open** — `ls src/scripts/check_typed_op_grant.ts` fails; control, the same `ls` against
> `check_platform_anchor.ts` returns a 15,577-byte file.

- [ ] <!-- blocked-by: kernel-guard-first-crossing | asked: no — the blocker is registered in this file and already owner-owned; the marker records that the criterion shares its gate and asks nothing new --> AC-1 — `G1`-`G15` exist under `tests/e2e/autonomy/` and are green.
      **Measured 2026-10-10 at `55360bb87`: 0 of 15.** `tests/e2e/autonomy/` does not
      exist; `tests/e2e/` holds five unrelated specs. The fixtures are Phase 1's
      output, so this reads as Phase 1's state rather than as its own gap.
- [ ] AC-2 — `ask_block_census` over the 30-session corpus reports that every remaining owner
      ask is either a typed op or owner-owned residue; no ask remains for a push, a commit, a
      CI fix or a conflict.
      **Measured 2026-10-10 at `55360bb87`, and deliberately NOT marked blocked.** The
      census was run this date (637 files; see `road-to-decision-closure` AC-5 for the
      same reading) and reports *zero commit/push/CI/conflict asks* **MET** on the static
      corpus — which is the second half of this criterion. The first half asks for a
      reading **over the 30-session corpus**, and the census's third target, *zero repeats
      of an answered question*, reads **NOT MEASURED (transcript axis)**: the tree has a
      transcript intake (`--native-asks` / `--unblocked-asks`, fed by `probe_unblocked_ask`)
      but no producer for this measurement. No marker is written because no registered
      blocker in this file gates it — a marker naming `kernel-guard-first-crossing` would
      misstate what this criterion waits on, which is a transcript producer.
- [x] AC-3 — ADR-239's `merge-authority` blocker reads `resolved` and points at ADR-268 § 3;
      ADR-255 § 4 carries a scoped `superseded_by`.
      **MET 2026-10-05 at `6aa3c36f9`, and discharged against the STRICTER of the two readings
      this sentence admits.** Two limbs were already true and were executed rather than read:
      `grep -n -A3 '^### blocker: merge-authority' agents/roadmaps/archive/road-to-drain-commands.md`
      reads `- **Status:** resolved` at `:410`, and `grep -n superseded_by docs/decisions/ADR-255*.md`
      reads `superseded_by: 260 (§§ 1 · 2 · 3 · 5 only), 268 (§ 4 only)` at `:7` — scoped, which
      is what the second limb asks for.
      **The third limb was ambiguous and the ambiguity is recorded rather than resolved in the
      convenient direction.** *"…reads `resolved` and points at ADR-268 § 3"* parses two ways:
      the pointer is ADR-239's (met — `grep -n '268' docs/decisions/ADR-239-*.md` returns exactly
      one line, the frontmatter `superseded_by: 268 (§ 3 only)` at `:7`), or the pointer is the
      BLOCKER's (not met — its resolution text is dated 2026-08-22 and predates ADR-268 by
      seventeen days). Amending the AC to the reading that was already green would be selecting
      the verdict, so the weaker limb was DISCHARGED instead: the archived blocker now carries a
      one-line supersession pointer at `agents/roadmaps/archive/road-to-drain-commands.md:463`,
      written as a note beside the 2026-08-22 disposition rather than as an edit to it. Both
      readings now hold.
      **What the pointer deliberately does NOT claim, because the second obstacle is real.** The
      blocker's reopening condition is *owner approval PLUS an accepted design whose authorization
      is target-bound, head-SHA-bound, tamper-resistant, agent-unwritable*. ADR-268 § 3 discharges
      the approval half only. The design half is Phase 3.1 and was re-measured this run:
      `grep -rn LedgerState src --include "*.ts"` returns **2** hits, both in
      `src/scripts/_lib/mission_record.ts` (`:87`, `:128`) — a type with no writer, no reader and
      no file. So AC-3 is met and AC-6 is not, which is the correct split: this criterion is about
      the RECORDS pointing at each other, not about the mechanism existing.
- [ ] <!-- blocked-by: kernel-guard-first-crossing | asked: no — the blocker is registered in this file and already owner-owned; the marker records that the criterion shares its gate and asks nothing new --> AC-4 — the `legacy_human_gate` ratchet is registered and its count at HEAD is below the
      count measured at this pin.
      **Measured 2026-10-10 at `55360bb87`: not registered.** `legacy_human_gate`
      appears nowhere under `src/` in `*.ts` or `*.json`, and
      `src/config/gate-violation-baselines.json` carries three keys, none of them
      this one. The first limb fails, so the second is not yet askable.
- [ ] <!-- blocked-by: kernel-guard-first-crossing | asked: no — the blocker is registered in this file and already owner-owned; the marker records that the criterion shares its gate and asks nothing new --> AC-5 — `personal.autonomy` ships `on` and no autonomy-detection context remains in the
      tree.
      **Measured 2026-10-10 at `55360bb87`: both limbs fail.**
      `src/config/agent-settings.template.yml:304` reads `autonomy: auto`, not `on`,
      and `src/agent-src/contexts/execution/autonomy-detection.md` still ships. Both
      are Phase 1 outputs.
- [ ] AC-6 — a typed op with no matching grant object is red in CI on a fixture diff, so the
      narrowed floor has a mechanical replacement rather than prose.
      **Re-measured 2026-10-10 at `55360bb87`, and unchanged from AC-3's reading.**
      `grep -rn LedgerState src --include "*.ts"` returns **2** hits, both in
      `src/scripts/_lib/mission_record.ts` (`:87` the interface, `:128` a parameter type) —
      still a type with no writer, no reader and no file. **Deliberately NOT marked
      blocked**: this criterion waits on Phase 3.1, which reads `[~]` deferred rather than
      blocked, and writing a blocker marker for a deferred step would convert a deferral
      into a gate this file never decided.
