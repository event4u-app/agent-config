---
adr: 262
status: accepted
date: 2026-09-08
decision: carrier-status-deleted-no-repo-authored-human-gate
supersedes: —
superseded_by: —
type: structural
reopen_policy: owner
protected_dimensions: governance
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E1
  basis:
    - src/scripts/lint_carrier_integrity.ts
    - src/scripts/_lib/carrier_status.ts
    - src/scripts/check_roadmap_trackable.ts
    - src/scripts/lint_plan_risk_register.ts
    - src/agent-src/scripts/update_roadmap_progress.ts
    - src/scripts/check_estate_count.ts
    - src/domains/product-basic/roadmap/process-full/command.md
    - src/domains/product-basic/roadmap/next/command.md
    - agents/evidence/analysis/self-imposed-stop-gate-audit-2026-09-08.md
    - agents/evidence/analysis/carrier-assertion-migration-audit-2026-09-08.md
    - agents/evidence/analysis/council-2026-09-08-carrier-status-redefinition.md
review_trigger: >-
  Owner ruling on authority; council ruling on shape. Not reopened by a further
  argument that a roadmap deserves a status that stops an autonomous run — that
  argument was the basis of the deleted status and is answered here. A
  roadmap-level ordering marker returns only on two independent, non-deferral
  workflows whose entry conditions are machine-observable and deterministically
  evaluable outside the model.
---

# ADR-262 — `status: carrier` is deleted; the repository does not author human gates over the maintainer

## Status

Accepted 2026-09-08. Owner-directed.

## Context

`status: carrier` was introduced as a **deferral receiver** marker: when a
roadmap is archived with `[~]` steps, those steps need a live destination that
`deferralProblems` (`src/agent-src/scripts/archive_completed_roadmaps.ts`) can
verify from both ends, and a destination resolves only under
`agents/roadmaps/` or `agents/roadmaps/later/`. That structural job is real.

A second meaning was written on top of it, in prose, inside the receiver files:
*"`status: carrier` keeps it off the roadmap dashboard … until a human flips it
to `ready`"*, *"Nothing here is scheduled work"*. On 2026-09-08 an autonomous
drain run instructed to carry **every** roadmap to completion reached the two
live receivers, read that prose, convened a council, and stopped — recording the
verdict *"a `status: carrier` roadmap is human-gated and an autonomous run may
not execute, promote, close, or advance it"* (PR #1922, merge `0ee772b9d`).

Three facts, established at commit `0ee772b9d`, decide this:

1. **Nothing enforced that stop.** No rule file, no command, no hook, no lint.
   Both drain commands define their corpus without naming `carrier`
   (`src/domains/product-basic/roadmap/process-full/command.md:96-98`;
   `src/domains/product-basic/roadmap/next/command.md:60-62`).
2. **The executing command already forbade it.** `process-full/command.md:262-291`
   lists `"this step looks human-gated"` and `"a maintainer should do this" when
   the agent can perform the same action` among its FORBIDDEN NON-HALT REASONS,
   and closes with *"INVENTING A HALT REASON IS A VIOLATION OF THE COMMAND AND
   THE USER'S WILL."* The stop was not a defensible reading of an ambiguity; it
   contradicted the contract of the command that was running.
3. **The maintainer overruled it.** *"A roadmap I put into the repo is work I
   want done. A run I instruct to drain every roadmap has my authority for every
   roadmap. There is no second human who needs to flip anything. 'Carrier' was a
   rule this package wrote for itself; it does not outrank the person the
   package works for."*

## Decision

**Delete `status: carrier` from the frontmatter vocabulary.** Not redefine it —
delete it. Migrate every existing carrier. A `status:` value never again decides
whether an autonomous run may act.

Two seats (`anthropic/claude-sonnet-4-5`, `openai/codex-default`), deep tier,
three rounds, convergent on A. Record:
`agents/evidence/analysis/council-2026-09-08-carrier-status-redefinition.md`.

**The decisive reason is a type error, not a policy preference.** "This roadmap
receives deferred work" is a property of a *graph edge* between two roadmaps.
`status` is a property of a *node* — what phase this file is in. Conflating them
made execution authority depend on provenance, dashboard visibility depend on
ancestry, and validation exemptions depend on history rather than on present
risk. Every fact `carrier` encoded is derivable from the bidirectional deferral
edges, which already exist and are already linted.

**Option B — keep the token, redefine it as a `depends_on:` ordering marker —
was rejected on a contradiction it cannot escape.** The proposed field would
have to mean both "must be satisfied before execution" and "is overridden when a
drain instruction arrives". If dependencies bind, the drain instruction is
blocked, which is the thing being abolished. If they do not bind, they block
nothing and the field is decoration. A checkable version needs stable dependency
ids, a closed predicate vocabulary, deterministic evaluation outside the model,
and cycle detection — infrastructure with no second use case to justify it.

### Where a genuine human gate goes instead

Not into `status:`. The repository already has the right vocabulary, and it was
sitting unused next to the thing that was misused:

- **A `## Blockers` entry** — for work whose resolution is a human ACTION
  (install a secret, click a repository setting, approve spend, let a date pass).
  This is what `lint_roadmap_complexity`'s `RULE22_HINT` already tells authors:
  *"if only a human can decide/authorize, a structured `## Blockers` entry"*.
- **`agents/roadmaps/later/` with an `entry_condition`** — for work ordered
  behind an event, enforced by `lint_roadmap_later_disposition`.

Both are read by mechanisms. `status: carrier` was read by no mechanism that
could stop a run, which is why it could only ever work by persuading a model.

### The five mechanical behaviours

| Behaviour | Disposition |
|---|---|
| Dashboard exclusion (`update_roadmap_progress.ts:99`) | **Delete.** Migrated receivers appear like any ready roadmap. |
| Risk-register exemption (`lint_plan_risk_register.ts:332-357`) | **Delete.** Receivers carry a real risk register, added in the migration commit. |
| Trackability exclusion (`check_roadmap_trackable.ts:60,104,185`) | **Delete.** Receivers pass normal trackability. |
| Estate counting (`check_estate_count.ts:460,527`) | **Outcome kept, mechanism deleted.** Carriers were already counted in `active_roadmaps`; the add-back existed only to make a flip count-neutral. With no status to flip, it goes, and a test asserts the count does not fall across the migration. |
| `lint_carrier_integrity` | **Audit → migrate → rename.** Its archived-side enumeration is status-independent and survives as `lint_deferral_integrity`. Its live-carrier enumeration existed *only* to stop a file taking the three exemptions for free; with no exemptions, it protects nothing and is deleted. Line-by-line audit: `agents/evidence/analysis/carrier-assertion-migration-audit-2026-09-08.md`. |

### A legacy `status: carrier` is rejected, not ignored

Deleting a vocabulary term silently would let an old file keep a value nothing
reads. `check_roadmap_trackable` fails on a frontmatter `status: carrier` with a
migration diagnostic naming this ADR. Removal is a one-way door and says so.

## Consequences

- The two named receivers migrate to `status: ready` **in the same commit** that
  gives them a risk register and trackable phases. A migration that changed the
  status first would have left the tree red between two commits.
- `road-to-the-skill-surface-framing-choice` also migrates to `ready`, and the
  owner-reservation it carries moves into a `## Blockers` entry. That
  reservation is **kept**: the decision changes what the package claims to be
  for its consumers, which is a public commitment — a named Class-1 dimension
  (`src/rules/decision-revisit-gate.md:146`). What changes is where it lives:
  a blocker is read by a gate, a status prose paragraph is read by a model.
- The 243-entry `lint_carrier_integrity` ratchet carries over to
  `lint_deferral_integrity` unchanged. Renaming a gate is not an occasion to
  move its baseline.
- A companion rule, `maintainer-intent-over-repo-rules`, states the general
  principle this ADR is one instance of, with the safety carve-outs that bound
  it. It is `type: auto`: the always-rule extended budget stands at
  60,252 / 60,254 characters and cannot take a tenth kernel rule.

## Alternatives considered

- **Keep `carrier`, delete only the prose.** Rejected: the token would still
  carry three exemptions granted on provenance, and the next author would
  re-derive the human-gate reading from the exemptions themselves — which is how
  the prose got written the first time.
- **Option B, the ordering marker.** Rejected on the binding contradiction
  above.
- **Add `is_deferral_receiver:` as a separate flag.** Rejected by both seats: it
  duplicates a fact already derivable from incoming deferral edges, and a second
  container flag is the same type error one layer down.
- **`reopen_policy`-style opt-in gating on roadmaps.** Rejected: it would
  reproduce the veto with an extra step, and `decision-revisit-gate.md:155-159`
  already records why an owner-by-default is the wrong default.

## References

- PR #1922, merge `0ee772b9d` — the stop this ADR reverses.
- `agents/evidence/analysis/self-imposed-stop-gate-audit-2026-09-08.md` — the
  wider audit commissioned with this decision.
- `agents/evidence/analysis/carrier-assertion-migration-audit-2026-09-08.md` —
  the line-by-line proof that no assertion is lost.
- `agents/evidence/analysis/council-2026-09-08-carrier-status-redefinition.md` —
  the council record, transcribed into the tree because
  `agents/runtime/council/responses/` is gitignored.
- `src/rules/maintainer-intent-over-repo-rules.md` — the general rule.
