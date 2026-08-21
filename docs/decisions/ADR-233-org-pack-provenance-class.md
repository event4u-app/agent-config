---
adr: 233
status: accepted
date: 2026-08-19
decision: org-pack-provenance-class
supersedes: —
superseded_by: —
phase: road-to-org-telemetry
type: structural
review_trigger: >-
  Reopen if a second namespace asks for `org-pack` provenance — the grant is
  scoped to `telemetry.remote.*` precisely so that widening it is a visible
  decision rather than a diff nobody reads; if a CLI or agent path is ever
  proposed that writes `org-pack` provenance, since the write asymmetry is the
  only thing standing between this class and self-granted permission; or if the
  first-session disclosure of Phase 3 is dropped, weakened, or made
  suppressible, since it is the compensating control this record accepts in
  exchange for a consent given by someone other than the affected user
---

# ADR-233 — The `org-pack` provenance class

## Status

Accepted. **Extends the provenance vocabulary defined by the settings-class
contract; supersedes nothing.** In particular the exclusion of `auto-detected`
from the consent-granting set is restated here verbatim and unchanged — this
record adds a fourth human source, not a machine one.

## Context

`src/shared/settingsConsent.ts` answers one question: is a permissive
class-B value a *recorded consent*, or just a value? It grants on
`jit-answer`, `gui` and `manual`, and it excludes `auto-detected` with a
stated reason:

> Letting it grant a consent would mean the agent could arrive at its own
> permission by observing the world, which is the confused-deputy shape in
> miniature.

The same four-value vocabulary is written down in four places: the reader
above, the CLI writer (`src/scripts/_cli/cmd_settings_set.ts`), the dispatcher
help text (`src/scripts/_dispatch.bash`), and the record shape in
`docs/contracts/settings-classes.md`.

`road-to-org-telemetry` needs a consent this vocabulary cannot express. Its
Phase 1 shipped a `post_tool_use` concern that appends a Class-A usage record
— usage class, skill id, host, package version, discipline profile, org id,
salted user hash, salted session hash, hour bucket, and by construction no
field able to hold project content — to a local JSONL file. Phase 2 will
transport those records off the machine. The decision to switch that on is
made once, centrally, by a human org administrator, and it applies to every
install the org pack reaches.

Two facts about the tree made this a decision rather than a mechanical
addition:

1. **`telemetry.remote.*` is not classified at all.** It appears nowhere in
   the class table of `docs/contracts/settings-classes.md`, so `consentVerdict`
   returns `not-a-consent-key` for it. The one namespace whose records are
   intended to leave the machine is the one namespace no consent gate covers.
2. **An org-pack consent is given by a human who is not the person the data
   describes.** `jit-answer`, `gui` and `manual` all mean *this* user decided.
   `org-pack` means *someone else* decided on their behalf. That is either a
   legitimate fourth human source or a category change wearing the same word,
   and the roadmap's own Risk 6 names the failure — *"the org-pack class
   becomes a precedent for machine-granted permissions."*

## Decision

**D1 — `org-pack` joins the provenance vocabulary as a consent-granting
source.** A human decided; the machine did not. That is the line the existing
doctrine draws, and an org administrator is on the human side of it.

**D2 — the grant is scoped to `telemetry.remote.*`.** A source that grants
everywhere would let an org pack decide any consent question on a user's
behalf. Scoping it to the namespace that motivated it means widening it later
is a visible decision with its own record, rather than a diff nobody reads.

**D3 — no agent-reachable write path may produce `org-pack` provenance, and
the mechanism is a type asymmetry rather than a runtime check.** The reader's
`ConsentSource` gains the value; the CLI writer's `ProvenanceSource` does not.
`agent-config settings:set --source org-pack` is therefore rejected by the
same allowlist that rejects a typo, and there is no code path by which the
agent can stamp its own permission. The org-pack install route writes the
sidecar entry directly.

This is the load-bearing clause. Without it, D1 hands the agent a string it
can write about itself, which is precisely the confused-deputy shape
`auto-detected` was excluded to prevent — the exclusion would survive in the
letter and die in effect.

**D4 — `auto-detected` remains never-consent, verbatim.** Its exclusion, its
comment, and its `withheld-machine-inferred` verdict are untouched by this
record.

**D5 — the affected user is told.** Phase 3's first-session disclosure line is
not a courtesy; it is the compensating control that makes D1 acceptable. A
consent given by another human is only legitimate if the person it binds can
see that it was given. If that disclosure is ever dropped, weakened, or made
suppressible, this record's premise is gone and it should be reopened — which
is why that condition is in the review trigger rather than in prose only.

**D6 — the `telemetry.remote` keys are NOT added to the class table, and the
reason is a constraint rather than an omission.** `lint_settings_classes`
check 2 requires every contract row to name a key the shipped template
actually has, and check 5 requires the contract's own counts to match. Phase 1
deliberately kept `telemetry.remote` out of `src/config/agent-settings.template.yml`
— a public repository ships the key names and no values, so a clone cannot
reach the write path by copying the tree. Classifying the keys therefore means
shipping them, which is a different decision from this one and belongs to
whoever takes it.

What that leaves is stated rather than hidden: `consentVerdict` returns
`not-a-consent-key` for an unclassified key, so the org-pack branch above is
**reachable by design and unreached in the tree today**. It becomes live the
moment these keys are classified, and D2's namespace scope is written against
that future rather than against a present caller. A branch with no caller is
a cost; this one is accepted because the alternative — adding the grant later,
under time pressure, without the scope clause — is how the erosion in Risk 6
actually happens.

When the keys are shipped and classified, the intended split is: `enabled`,
`endpoint`, `org_id`, `salt` and `flush` as class **B** (each has a
conservative default — `false` or empty — which is what makes absent and
declined the same answer under check 4), and `retention.max_age_days`,
`retention.max_bytes` and `output.path` as class **A**, since they decide how
much is kept rather than whether anything is collected.

## Consequences

- The consent reader gains one value and one branch; the CLI writer gains
  nothing, and the asymmetry between the two is now a documented invariant
  with a test rather than an accident of two lists drifting.
- An org pack can enable telemetry centrally, which is the whole premise of
  `road-to-org-telemetry`. Nothing else in the suite gains that ability.
- A reader of `settings/.agent-settings.provenance.json` can now distinguish
  "this user said yes" from "this user's organisation said yes", which the
  previous vocabulary could not express at all — it would have had to record
  the org decision as `manual` and lose the distinction entirely.
- The four places that spell out the vocabulary become five surfaces to keep
  in step. The pairing is asserted by a test rather than by a comment, because
  a comment is what let the previous four drift into being copied by hand.

## Alternatives

**Record `org-pack` but do not let it grant.** Every install would still need
a local `jit-answer` from the affected user before a single record is written.
This is the maximum-doctrine option and it is coherent. It was rejected
because it removes the ability to enable anything centrally, which is not a
side effect of the roadmap — it is the roadmap. An org pack that cannot decide
anything for the org is a distribution mechanism, not a consent mechanism.

**Add no source; classify `telemetry.remote.enabled` as class C and let the
org pack ship a hand-written settings file.** `consentVerdict` already grants
on `handEdited`, so the mechanism exists and needs no new vocabulary — the
cheapest option on the page, and it was the strongest challenger. Rejected
because `handEdited` means "a human wrote this file", which is true of a file
an org pack generated and equally true of a file the user wrote themselves.
Collapsing the two loses exactly the distinction D1 exists to record, and it
does so silently: a later reader auditing who consented would find a grant
with no way to tell which human it came from. Cheapness that costs the audit
trail is not cheap.

**Widen the grant to every namespace.** Rejected as the erosion Risk 6 names.
Nothing needs it today, and an unused permission costs nothing until someone
uses it.

## Note on how this was decided

Single-model, and stated as such. The AI council is configured (two seats)
but was unreachable at decision time: both seats were skipped before the run
with `qualification: unknown — no exchange with this provider has ever been
recorded`, quorum 0/2, zero spend. No subagent fan-out was substituted and
called a council. The substance of D1 and D4 was already fixed by the
roadmap step this record discharges; D2, D3, D5 and D6 are this record's own
and are the parts a future reader should challenge first.

## References

- `src/shared/settingsConsent.ts` — the reader, and the `auto-detected`
  exclusion this record preserves.
- `src/scripts/_cli/cmd_settings_set.ts` — the CLI writer whose vocabulary
  deliberately does **not** gain the new value (D3).
- `docs/contracts/settings-classes.md` — the class table and the sidecar
  record shape.
- `src/rules/settings-ask-protocol.md` — the ask discipline the B
  classification in D6 places these keys under.
- `agents/roadmaps/archive/road-to-org-telemetry.md` — Phase 3, and Risk 6.
