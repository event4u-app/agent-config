---
complexity: lightweight
status: draft
estate_offset_exempt: "Draft, so the count half reports +0 active; the file-based one-in-one-out half fires on the added file regardless of status, and this exemption answers that half. The subject is a published BREAKING entry contradicted by the shipped tree — a consumer-facing release-truth defect with no existing owner: no stub, no later/ entry and no active roadmap names the 15.0.0 kernel-deny line or the missing MIGRATION sections."
execution:
  mode: phase-checkpoints
---
# Road to a breaking line the tree does not contain

> **Source:** `agents/tmp.old/inbox-2026-09-aa/` — a round of fourteen
> independent external reviews plus a supplied comparison plan and a status
> update. The plan carries it as finding `D-C`; the status update reaches the
> same conclusion from a four-pin existence check; three of the fourteen
> reviewers found it independently at source. One notes it is the seventeenth
> time the missing migration map has been raised. Verified against the tree at
> `58f1f2ae2`.

## Goal

A consumer who reads a BREAKING CHANGES entry and migrates for it finds the tree
agrees. Today 15.0.0 announces a removal the 15.0.0 tree does not contain, and
neither 15.0.0 nor 16.0.0 has a migration section at all — so the one published
statement about the change is the one that is wrong. When this is finished, the
15.0.0 head says which of its two contradicting lines won and why, and both
majors carry the migration entry their BREAKING sections earn.

## Context — what was verified, and where

**The contradiction, at source.** The published 15.0.0 head announces the
retirement:

- `docs/archive/CHANGELOG-pre-16.0.0.md:31` —
  `* **governance:** retire the kernel-rule tool-call deny and the 24h soak (288190b)`.
- The same head's behaviour-changes line (`:20`) carries *"the deny stays"*
  beside it, with no reconciliation between the two.

The tree at HEAD says the opposite, in four places:

- `src/scripts/hooks/block_kernel_rule_writes.ts` exists.
- `src/scripts/hook_manifest.yaml:183-188` binds it `fail_closed: true`,
  `severity: blocking`.
- `src/scripts/hook_manifest.yaml:1318` lists it in `pre_tool_use`.
- `src/agent-src/contexts/authority/kernel-rule-edits.md:11` carries the 24 h
  window unchanged, and `:24` states the ratification gate is *"an ADDITION to
  this soak, never a"* replacement.

The reason the revert won is recorded and is not in dispute: a two-round
independent ratification review refused the replacement 2/2 on the
candidate-judges-itself defect, and `03e4eb7d` reverted with *"the deny stays —
the replacement was refused 2/2"*. The governance worked. The **head** did not
follow it.

**The missing migration map.** `docs/MIGRATION.md` carries sections for
14.22.x, 14.21.x, 9.0.0 and 1.15.0 — and none for 15.0.0 or 16.0.0, both of
which shipped BREAKING CHANGES: two retired commands, the announced kernel
retirement, and the deleted standing-payload ceiling.

**One source claim corrected rather than carried.** One reviewer states the
index *"ends at 9.0.0"*, seven majors back. That is not what the file says —
14.21.x and 14.22.x sections exist. The defect is the two missing entries, not
a table frozen at 9, and the roadmap carries the verified version.

## Phase 1 — Say which line won

- [ ] **1.1 Reconcile the 15.0.0 head.** One in-place correction naming that
      the retirement was implemented and reverted before the cut, that the deny
      and the soak both stand, and why — the reasoning already exists verbatim
      in the `03e4eb7d` merge body and needs quoting, not re-deriving.
      verify: `grep -n 'retire the kernel-rule tool-call deny' docs/archive/CHANGELOG-pre-16.0.0.md`
      returns a line that no longer reads as an unqualified removal, and the
      corrected text names `03e4eb7d`.

- [ ] **1.2 Check the threat-model entry the retirement wrote.** The retirement
      commit recorded an `HONEST LOSS` in `docs/threat-model.md` for a state
      that was then reverted; a reviewer flagged it as a probable stale claim
      and their own grep came back empty.
      verify: `grep -n 'HONEST LOSS' docs/threat-model.md` — empty is the
      expected answer and is recorded as such, not left unstated. Read 2026-09-12:
      empty, and `:36` names the guard as registered. If a later read differs,
      the entry goes.

## Phase 2 — Give the two majors a migration map

- [ ] **2.1 Add the 15.0.0 section.** What a consumer must do about the two
      retired commands (`/chat-history`, `/chat-history import`), and — stated
      plainly — that the announced kernel-deny retirement did **not** ship, so
      there is nothing to migrate for it.
      verify: `grep -n '^## ' docs/MIGRATION.md` lists a 15.0.0 section, and it
      names both retired commands by path.

- [ ] **2.2 Add the 16.0.0 section.** What the deleted stored
      standing-payload ceiling means for a consumer holding one, and what
      replaces it.
      verify: `grep -n '^## ' docs/MIGRATION.md` lists a 16.0.0 section that
      names the base-ref-derived ceiling as the replacement.

## Phase 3 — Stop the next major arriving without one

- [ ] **3.1 Refuse a cut whose BREAKING section has no migration entry.** The
      release pre-flight already sends the releaser to `docs/MIGRATION.md` for
      the scheduled-deprecations table; the missing half is the backward one —
      a major carrying BREAKING CHANGES and no matching section.
      verify: a fixture major with a BREAKING section and no MIGRATION heading
      exits non-zero and names the version; the same fixture with the heading
      added exits 0. Sensitivity proven by removing the heading again.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-12 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The head correction reads as rewriting release history | product | Editing a published head is exactly the move this repo is careful about, and a correction that looks like a quiet rewrite costs more than the wrong line did | Step 1.1 adds the reconciliation and deletes no commit line — both the retirement entry and the revert stay visible, which is what makes the head readable rather than tidy | Phase 1 — Say which line won |
| 2 | The new gate blocks a legitimate major that genuinely needs no migration note | implementation | Not every BREAKING change asks anything of a consumer, and a gate that cannot express that turns into a ritual heading with no content | Step 3.1's fixture pair is the test, and the refusal is satisfiable by a section that says the change asks nothing — the requirement is a stated answer, never a non-empty procedure | Phase 3 — Stop the next major arriving without one |
| 3 | The 15.0.0 correction is mistaken for reopening the kernel-deny decision | product | The deny's fate was settled by a 2/2 ratification refusal and a revert; a head correction touching the same subject can read as a second bite | Step 1.1 changes the release record only and states in its own text that the decision stands as the review made it; nothing in this roadmap touches the guard, the manifest or the soak | Phase 1 — Say which line won |

## Acceptance Criteria

- [ ] AC-1 — The 15.0.0 head no longer announces an unqualified retirement of
      the kernel-rule tool-call deny, and names the revert that decided it.
- [ ] AC-2 — `docs/MIGRATION.md` carries a section for 15.0.0 and one for
      16.0.0, each naming what its BREAKING entries ask of a consumer.
- [ ] AC-3 — A major whose BREAKING section has no corresponding MIGRATION
      heading is refused at the cut, and the refusal names the version.
- [ ] AC-4 — The `HONEST LOSS` threat-model question is answered in the tree
      rather than left open — either the entry is gone and that is recorded, or
      it exists and is removed.
