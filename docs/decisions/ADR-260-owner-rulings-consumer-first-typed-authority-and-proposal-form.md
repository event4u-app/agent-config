---
adr: 260
status: accepted
date: 2026-09-07
decision: owner-rulings-consumer-first-typed-authority-and-proposal-form
supersedes: ADR-255
superseded_by: —
type: structural
reopen_policy: owner
protected_dimensions: governance
provenance:
  kind: owner
  decision_makers: [owner]
  human_directed: true
  agentic_mode: none
evidence:
  strength: E1
  basis:
    - agents/roadmaps/stubs/road-to-owner-authority-decisions.md
    - agents/roadmaps/stubs/road-to-consumer-capability-share.md
    - agents/roadmaps/stubs/road-to-a-proposal-that-can-be-adopted.md
    - docs/decisions/ADR-254-git-authorization-enforcement-removed.md
    - docs/decisions/ADR-255-authorization-floors-preserved-this-round.md
    - docs/archive/CHANGELOG-pre-14.19.0.md
    - agents/evidence/analysis/inbox-2026-09-r-verification.md
    - src/scripts/lint_consolidation_lineage.ts
review_trigger: >-
  Owner ruling only. § 1 carries its own end date. § 2 is reopened by an observed
  unauthorized irreversible operation — the trigger ADR-254 already names — never by a wish
  to restore the old parser. § 3 and § 4 are reopened by the owner.
---

# ADR-260 — Owner rulings: consumer-first cycles, typed authority, and what a proposal is

## Status

Accepted, owner-directed, 2026-09-07. Closes the open questions that the estate itself
routed to the owner in three stubs, and that eleven proposal rounds restated without an
answer.

## Context

Three records asked the owner the same thing in three shapes, all three verified present
at `0918def55`:

- `agents/roadmaps/stubs/road-to-consumer-capability-share.md` records that the
  governance-vs-consumer share is measured and has never been acted on, and poses the
  owner question rather than parking it.
- `agents/roadmaps/stubs/road-to-owner-authority-decisions.md` § "Unresolved decisions
  9–12" records four authorization floors a council refused for one round because
  acceptance is owner-reserved.
- `agents/roadmaps/stubs/road-to-a-proposal-that-can-be-adopted.md` records that eleven
  prepared masters arrived and none was adoptable, and offers three forms a proposal must
  take.

The measurement behind the first: release 14.18.0 shipped **55 governance-only against 16
consumer-only** commits (`docs/archive/CHANGELOG-pre-14.19.0.md:26`, under the 14.18.0
heading — the era split moved that line out of the live `CHANGELOG.md`, whose current
release row carries a different mix and must not be read as the same claim).

The measurement behind the third: `agents/evidence/analysis/inbox-2026-09-r-verification.md`
verified eleven consolidated master proposals claim by claim and found **none adoptable
unchanged**; across them **48 distinct `road-to-*` slugs are referenced and 35 exist
nowhere** under `agents/roadmaps/`.

## Decision

### § 1 — Consumer-first cycles (closes `road-to-consumer-capability-share`)

For releases **14.19.0 through 14.21.0**, each release cut must count **at least as many
consumer-only as governance-only commits** under `src/scripts/release_mix_taxonomy.json`. A
governance-only change is admitted in that window only if it (a) retires a mechanism,
(b) closes a defect reproduced on a consumer surface that a scheduled consumer wave needs,
or (c) is this record's own follow-through. The estate ratchet, the finding lifecycle and
the release gates are unchanged; the ratio is a *release* guard, not a per-PR gate
(ADR-253 stands). Owner-set end date: 14.21.0, or earlier by owner ruling.

### § 2 — Typed authority replaces the removed gate (decisions 9, 11)

- **Decision 9.** Object-bound grants are the replacement ADR-254 called for: its reopen
  text states that "a replacement must classify intent into typed transitions rather than
  test a prompt against a regex". They are **scheduled**, not "unscheduled for lack of a
  non-gating purpose": their purpose is the mechanical floor for irreversible operations.
  The closed op vocabulary is `force_push`, `prod_merge`, `tag_push`, `release`, `publish`,
  `branch_protection_change`, `repo_delete`, `prod_data_delete`, `secret_write`, `payment`,
  `external_send`. Targets are typed (`branch: shared|private`, `env: prod|nonprod`).
- **Decision 11.** The Hard Floor's push/commit rows narrow to the vocabulary above. For
  those operations the this-turn confirmation is satisfied by **either** (a) a typed grant
  object `{op, target, scope, granted_by: owner-turn|native-ask, span, expires}` whose
  `span` is a whole sentence of the owner's *current task text* naming that operation on
  that target — the model produces the object, a second seat confirms `op` and `target`,
  disagreement or an absent seat yields exactly one host-native question; **or** (b) the
  native question itself. A run-scoped grant is accepted when it is object-bound; a
  sentence-scoped grant is never accepted. No natural-language authorization parser
  participates in enforcement (ADR-254's reopen text stands verbatim).
- Everything outside the vocabulary — every reversible, branch-local, test,
  install-inside-policy, refactor and inspection action — carries **no question and no
  grant**. Zero prompts on the reversible fixture set is an acceptance criterion, not an
  aspiration.

### § 3 — Autonomy default and tool safety (decisions 10, 12)

- **Decision 10.** `personal.autonomy` ships **`on`** for new installs; `auto` resolves to
  `on`. Existing installs keep their explicit value; the migration note states the change.
  The reversal ADR-255 § 2 refused on the council's behalf is made here on the owner's.
- **Decision 12.** `src/rules/tool-safety.md` is rebuilt consequence-aware: capability is
  not risk. The wildcard-grant findings in `src/scripts/lint_skill_frontmatter_safety.ts`
  (`:228`, `:266`, `:328`) are demoted to advisory unless the wildcard reaches an op in
  § 2's vocabulary.

### § 4 — What a proposal is (closes `road-to-a-proposal-that-can-be-adopted`)

Option **3 with 2 as its check**: prepared proposals are **analyses**, filed as evidence
under `agents/tmp/<round>/` and `agents/evidence/analysis/`; roadmaps are authored only in
this repository, and a roadmap may name as fold target, parent or receiver **only a path
that exists in the estate at its tree pin**.

`lint_consolidation_lineage.ts` today carries a `missing-parent` finding (`:45-46`, emitted
`:344-348`) that validates a *declared parent* resolves to a file. That is adjacent to the
check this section requires and is not the same check: it does not validate an arbitrary
named **receiver** or fold target, and its own honest-limit note (`:566-585`) states it does
not catch a glob narrowed to nothing or roadmaps moved into nested directories. Extending
it to the receiver case is new work under this ruling, not a property the tree already has.

The two roadmaps landing with this record — `road-to-a-graph-that-is-shipped` and
`later/road-to-a-graph-that-wins` — are among the first authored under this rule; their
analysis round is `agents/tmp.old/inbox-2026-09-u/`.

### § 5 — The benchmark subjects for `road-to-a-graph-that-wins`

Two public open-source repositories in the owner's stack, meeting the fitness list in that
roadmap, are named in its corpus header with the role **benchmark subject**. A benchmark
subject is not an idea source; `source-confidentiality` governs harvest provenance and does
not apply to a named test subject whose questions, truth and traces are tracked in-tree.
*(The owner fills the two names in the corpus header; the roadmap wakes on that edit.)*

## Consequences

- ADR-255 §§ 1, 2, 3, 5 are superseded by owner ruling. **§ 4 (kernel and governance
  self-amendment refusals) stands untouched**, and its refusals are additionally denied at
  tool-call time by `src/scripts/hooks/block_kernel_rule_writes.ts` — this record does not
  ask that guard to yield.
- ADR-249 is not reopened in either direction.
- `road-to-owner-authority-decisions` § 9–12 close with a pointer here.
- The conformance scan's unauthorized-typed-op count becomes the ratchet ADR-254 asked for.
- Governance density is now a measured budget with an end date, not a sentiment.
- **§§ 2 and 3 name mechanical work that has no receiver roadmap in the estate at this
  pin.** Recording a decision needs no receiver; executing one does. This record states the
  decision and leaves the receiver unauthored deliberately rather than naming a path that
  does not exist — which is the defect § 4 above closes. Authoring it is the owner's next
  scheduling call, and the PR that lands this record carries it as an open owner question
  rather than as a silent gap.

## Alternatives

- Let a further council round decide — rejected: every record involved says the question is
  the owner's, and the owner has now answered it.
- Restore the natural-language gate — rejected by ADR-254 and by this record.
- Adopt prepared masters after correction (option 1) — rejected: one verification pass per
  proposal at eleven proposals per round is the cost that produced 55:16.
- Land §§ 2–3 together with a receiver roadmap in this change — rejected for scope: the
  ruling is what was asked for, and a roadmap authored to satisfy a template is the shape
  § 4 rejects.
