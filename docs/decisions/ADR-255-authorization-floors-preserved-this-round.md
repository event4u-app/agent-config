---
adr: 255
status: accepted
date: 2026-09-06
decision: authorization-floors-preserved-this-round
supersedes: —
superseded_by: —
phase: road-to-authorization-that-reaches-further · Blockers
type: structural
reopen_policy: owner
protected_dimensions: security_floor
provenance:
  kind: agentic
  decision_makers: [anthropic/claude-sonnet-4-5, openai/codex-default]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E1
  basis:
    - agents/roadmaps/archive/road-to-authorization-that-reaches-further.md
    - docs/decisions/ADR-254-git-authorization-enforcement-removed.md
    - src/rules/non-destructive-by-default.md
    - src/rules/decision-revisit-gate.md
    - src/rules/tool-safety.md
    - src/rules/scope-control.md
    - src/config/agent-settings.template.yml
    - src/scripts/hooks/block_kernel_rule_writes.ts
    - src/scripts/lint_skill_frontmatter_safety.ts
    - agents/roadmaps/stubs/road-to-owner-authority-decisions.md
review_trigger: >-
  This record refuses five proposals for one round and prejudges no future
  ruling, so the reopening condition is the owner's, not an observation. It is
  reopened by an explicit owner ruling on any of the five, independently of the
  others; each is severable and none implies another. Explicitly NOT a reopen
  trigger: a re-proposal of the same five with no new argument, which is what
  this record answers. Also NOT a trigger: reading the refusals as settled
  policy — the substantive questions stay open in
  agents/roadmaps/stubs/road-to-owner-authority-decisions.md and this record
  closes only the roadmap dependency on them.
---

# ADR-255 — five authorization floors are preserved for this round

## Status

**Accepted** · 2026-09-06. Supersedes nothing and amends nothing.

Decided by an **AI council** (2 seats, 2026-09-06) under the maintainer's
standing delegation, on the framework that a **refusal** which preserves a
recorded floor is council-decidable *as preservation of the status quo*, while
**acceptance** of any of the same five is categorically unreachable by a council
— including experimentally.

**Read the asymmetry before reading anything else.** Nothing below is an owner
ruling, and nothing below establishes that the refused proposals are wrong. Each
records that the change was **not authorized in this round**, that current
behaviour is **unchanged**, and that **no future ruling is prejudged**.

**On the evidence grade.** `E1` is what `evidence_census` computes for this
record — one dated local observation — and it is declared rather than the `E2`
its neighbours carry, because the observation behind it is a council session on
one day and not a repeated or comparative measurement. The grade changes
nothing: `decision-revisit-gate` states that a grade is a measurement and grants
no authority, and this record's authority comes from the preservation framework
above, not from its strength field.

## Context

`road-to-authorization-that-reaches-further` carried five blockers. Each records
a proposal the round surfaced that would lower a recorded floor, delete a
governance control, or change a consumer-facing default — and each names the
same discharge: a dated ruling or a recorded refusal to rule, filed here, with
`agents/roadmaps/stubs/road-to-owner-authority-decisions.md` updated to point at
it.

None of the five blocks any phase of that roadmap. Its three phases are
floor-preserving by construction: they emit a permission field for calls nothing
gated, widen an advisory record, and measure. The blockers exist so the round's
proposals are dispositioned rather than dropped silently.

ADR-254 raises the stakes on three of the five rather than lowering them. Since
the git-authorization gate was removed, `src/rules/non-destructive-by-default.md`
is the only carrier left for git operations, and it is model-held.

## Decision

Five refusals, each scoped to this round.

### 1. `git-enforcement-reinstatement` — ADR-254 stands

The gate is **not** reinstated this round. Two ledger items wait on that ruling
and on nothing else — making object binding a **matching** condition rather than
a recorded field, and letting object-bound grants cover operations beyond
pull-request merge — and both stay unscheduled, because neither has a
non-gating purpose and scheduling them would be re-adding mechanical enforcement
under another name.

ADR-254 is owner-directed, carries `reopen_policy: owner` and
`protected_dimensions: security_floor`, and its own `review_trigger` excludes a
wish to re-add the gate in its old shape. A council may not overturn it, and
this record does not attempt to.

**Phase 2 of the roadmap is not a step toward reinstatement.** It widened what
the advisory ledger **records**; `commandOp` and `BLOCK_OPS` have exactly one
consumer that acts on them, the after-the-fact tally in `conformance_scan`, and
that count is still one.

### 2. `autonomy-default-semantics` — the shipped default is unchanged

`personal.autonomy` keeps shipping `auto`, and `auto` keeps resolving to the
same behaviour as `off` until the user opts in. The proposed inversion is **not
authorized in this round**.

This is a consumer-facing default projected to every host: changing it changes
behaviour for every consumer on their next update, which is not a change a
council makes on a consumer's behalf.

### 3. `hard-floor-scope-reduction` — both relaxations refused

The Hard Floor's push and commit rows stay exactly as recorded, and the
this-turn confirmation requirement stays. Neither narrowing the rows nor
accepting a run-scoped grant in place of the this-turn requirement is authorized.

Acceptance here is the clearest case of categorical unreachability: both
proposals lower a recorded safety floor in a kernel rule, which
`src/rules/decision-revisit-gate.md` reserves to the owner and
`src/scripts/hooks/block_kernel_rule_writes.ts` denies at tool-call time. The
council could not have accepted them experimentally either — a floor lowered as
an experiment is a floor lowered.

### 4. `kernel-rule-and-governance-self-amendment` — all four deletions refused

The task-scope reset and git section in `src/rules/scope-control.md`, the write
blocker `block_kernel_rule_writes.ts`, the soak guarantee in
`kernel-rule-edits.md`, and the owner-reserved set in `decision-revisit-gate.md`
are **all retained**.

Governance self-amendment is the one class with no council-decidable
counterpart: the machinery being amended is the machinery that decides who may
amend it. A council accepting any of the four would be using the rules to
authorise rewriting the rules that grant it authority.

### 5. `tool-safety-floor-lowering` — the current floor is retained

`src/rules/tool-safety.md` stays deny-by-default with "deny under doubt", and
`src/scripts/lint_skill_frontmatter_safety.ts` keeps treating a wildcard tool
grant and a permission bypass as high severity. Neither the consequence-aware
rebuild nor the severity demotion is authorized this round.

**The argument behind the proposal is not dismissed.** "Capability is not risk"
is a real distinction, and this record does not rule on it — it records that an
agent may not settle it unilaterally, and that the floor stands until an owner
does.

## Consequences

- The five blockers on `road-to-authorization-that-reaches-further` close as
  `resolved`, which closes **the roadmap's dependency** on them. Every
  substantive question stays open.
- `agents/roadmaps/stubs/road-to-owner-authority-decisions.md` points here, so
  the owner queue names this record rather than the closed roadmap.
- Every rule, hook and lint threshold named in the five is byte-identical to its
  pre-round state. That is checkable and is checked: the roadmap's AC-6 asserts
  it against `5c539505d`.
- **A cost this record accepts rather than argues away**, carried from ADR-254's
  own consequences: the failure the removed gate was built after is unguarded,
  and if it recurs nothing in this package stops it. Refusing to reinstate the
  gate this round does not make that cost smaller; it records that the shape of
  a replacement is the owner's to choose.

## Alternatives

**Accept one or more of the five.** Unreachable by a council, on the framework
above — not declined on the merits, and the distinction matters: a merits
decline would be a position on the proposal, and this is a statement about who
may take one.

**Leave the blockers open with no record.** Rejected. The stub that holds these
questions has carried some of them since 2026-08-22 with nothing recorded, and
an open blocker with no disposition is indistinguishable from one nobody read.

**Write the refusals as permanent.** Rejected, and explicitly. "The project will
never lower this floor" is itself a public commitment, and creating one is the
class of act these refusals decline to perform. A refusal says *not this round*,
never *not ever*.

## Evidence

| Claim | Basis |
|---|---|
| All five blockers were open and each named the same discharge | `agents/roadmaps/archive/road-to-authorization-that-reaches-further.md` § Blockers — five entries, each `Resolved when:` a dated ruling or a recorded refusal filed in `docs/decisions/` |
| Both seats refused all five, scoped to one round | AI council 2026-09-06, anthropic/claude-sonnet-4-5 + openai/codex-default, quorum 2/2, `$0.0000`, CLI subscription transport, under the maintainer's standing delegation of 2026-09-06 |
| Acceptance of any of the five is unreachable by a council | the framework the same session adopted: a refusal preserving a recorded floor is preservation of the status quo; acceptance lowers a floor or amends the amendment machinery, which `src/rules/decision-revisit-gate.md` § owner-reserved set routes to the owner |
| Nothing named in the five moved | every rule, hook and lint threshold named is byte-identical to `5c539505d` — `git diff --quiet 5c539505d HEAD -- <path>` returns clean for all nine paths, which is the roadmap's own AC-6 |
| ADR-254 reserves its own reopening to the owner | `docs/decisions/ADR-254-git-authorization-enforcement-removed.md` frontmatter — `reopen_policy: owner`, `protected_dimensions: security_floor`, and a `review_trigger` that excludes re-adding the gate in its old shape |
| The kernel write is denied at tool-call time, so § 3 and § 4 could not have been applied even if accepted | `src/scripts/hooks/block_kernel_rule_writes.ts` |
| Phase 2 added no refusal path | `BLOCK_OPS` and `commandOp` have exactly one consumer that acts on them — `src/scripts/conformance_scan.ts:807` — and `grep -c 'block-unauthorized-git\|block_unauthorized_git' src/scripts/hook_manifest.yaml` is 0, the roadmap's AC-4 |
| The questions are carried, not dropped | `agents/roadmaps/stubs/road-to-owner-authority-decisions.md` § Unresolved decisions 9-12, added in the same change |

**Evidence this record does NOT have, and the shape of the gap matters.** There
is **no owner statement** on any of the five — that is the point of the record
rather than a defect in it, and reading a scoped council refusal as an owner
ruling is the fabrication the owner-authority stub's own § Disposition refuses.
There is also **no measurement** that any of the five floors is correctly
calibrated: this record preserves them because preservation is what a council
may decide, not because their current settings were shown to be right.

## References

- [ADR-254](ADR-254-git-authorization-enforcement-removed.md) — the record
  refusal 1 preserves, and the source of the model-held posture refusals 3 and 4
  operate under.
- `agents/roadmaps/stubs/road-to-owner-authority-decisions.md` — where the
  substantive questions stay open.
- `src/rules/decision-revisit-gate.md` — the owner-reserved set the framework
  above reads from.
