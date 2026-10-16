<!-- evidence-type: analysis -->

# A per-user ownership ledger makes ADR-020 coherent, it does not weaken it

**Date:** 2026-10-16 · **Members:** `anthropic`, `openai`
**Mode:** prompt, 2 rounds, peer review, blind chairman · **Cost:** $0.00 (subscription transport)
**Quorum:** 2/2 concluded · **Verdict: `(a)` — convergent, no split**

Executes step 0.2 of `road-to-an-ownership-record-that-belongs-to-the-user`
and closes its `adr-020-ownership-ledger-reading` blocker. The question put to
the seats: does a per-user ownership ledger **weaken** ADR-020's global-only
invariant, or is it the mechanism that makes it hold?

Step 0.1 ran first. `adr_cite_check ADR-020` on this tree reports the lock
`accepted` (2026-05-23), **amended three times** (2026-05-30 user-content
exception · 2026-06-03 settings-scope correction via ADR-049 · 2026-07-13
bridge marker retired), with no `review_trigger`, no declared protected
dimension and `reopen_policy` absent → `unclassified`. The tool's own closing
line — *"AMENDED — read the amendment before citing the original decision"* —
is why the 2026-05-30 user-content exception appears in both seats' reasoning.

| Seat | Pick | Formulation | Confidence |
|---|---|---|---|
| `anthropic` | `(a)` | the ledger makes the invariant **coherent**, not merely safe | high |
| `openai` | `(a)` | ownership metadata must share the scope of the artefacts it governs | high |

## What both seats held

**The project-conditioned ownership record is the actual scope violation.**
`install.ts:3531-3537` gates the manifest write on the presence of project
settings, so the fate of a **globally** deployed artefact is decided by a
project-shaped condition. openai: *"ADR-020 controls where the suite is
consumed. An ownership digest is control-plane metadata about that one
user-global deployment, not another deployment."*

**A ledger is bookkeeping, not a second consumption scope.** Both seats reached
for the package-manager analogy unprompted: a package database separates
artefact location from the record of what was installed there.

## The refinement anthropic added, and it is the sharper reading

ADR-020 *plus* its user-content amendment already describe an architecture —
global artefacts with preserved user modifications — and that architecture
**requires** global-scoped knowledge of what is user content. *"The ledger
doesn't add safety to a complete system; it completes an incomplete one."*

## The point neither prior round raised

The two-digest requirement is **core preservation logic, not an implementation
detail**. `RecordedOwnership` carries one digest where two are needed: without
both the shipped digest and the on-disk digest, "the human changed it" cannot
be separated from "we shipped a new version of it", which is the distinction
every later decision rests on.

## Where the seats disagreed

openai pushed back on two points of the anthropic reading, and the pushback is
recorded because it narrows what this verdict licenses:

1. **The user-content amendment is supporting evidence, not the foundation.**
   Nothing in the record establishes that a human's edit to a *package-deployed*
   artefact legally counts as "user content" under the 2026-05-30 amendment.
   The scope-alignment argument stands without that assumption, and whether the
   amendment reaches deployed artefacts is a **separate** question left open
   here.
2. **Option (b)'s real cost was overstated.** (b) would not necessarily preserve
   today's directory-dependent accident; it could instead define an explicit,
   consistent overwrite policy. Its honest cost is that it abandons edit
   preservation.

## Boundaries this verdict carries

Phase 2 proceeds, bounded by all four:

- The ledger is **user-global ownership metadata** — not a consumption scope,
  not a configuration scope.
- Ownership treatment is **independent of the invoking project and the working
  directory**.
- **No project keys** in the ledger, and no project-dependent artefact
  selection.
- The preservation contract is stated explicitly: a verified human modification
  to a globally installed artefact is treated the same across later installs,
  whatever directory each was launched from.

## Revisit-if

Any one of these reopens the reading:

- The ledger becomes project-keyed, or encodes project-specific preferences
  rather than "what did we write".
- The ledger drives artefact **selection** rather than preservation — load
  skill X for project A, skill Y for project B. This is the subtler drift from
  metadata into a second scope, and it is anthropic's addition.
- Two projects demonstrably need different versions of the same global artefact
  at the same time.
- The two-digest distinction proves insufficient for the preservation decision.
- ADR-020 or an amendment is shown to require package-controlled content
  uniformity rather than one deployment scope per user.

## What the answer under (b) would have been

Recorded because the roadmap asked for it and because it is the thing the
consumer is promised today: *"your edit to a globally installed artefact
survives only if the next install runs from a directory carrying project
settings; otherwise it is overwritten in silence."* That is undefined behaviour
in the shape of a promise, and naming it is the clearest statement of what
Phase 2 removes.
