---
complexity: lightweight
status: later
parent_roadmap: road-to-governed-skill-scouting
---

# Road to the capability queue — everything capability-shaped, waiting on a capacity slot

> **Carried in 2026-09-03 from `road-to-governed-skill-scouting` (step 4.1):
> upstream drift-watch for a borrowed skill.** `lint_provenance.ts` has no
> network logic, so a borrow recorded today cannot notice its upstream changing
> afterwards. Noticing requires a fetch, and that roadmap's
> `scout-egress-authority` blocker resolved **(a) — no network fetch of any
> kind**, on the grounds that this package already holds the other two legs of
> the lethal trifecta. So drift-watch is not postponed for capacity: it is a
> capability an egress decision excluded, and reopening it means reopening that
> decision first, on the evidence the blocker records.

> **Parked on capacity only.** The 2026-08-05 council split the freeze into a
> verification arm and a capability arm and gated the latter partly on external
> adoption. [`ADR-216`](../../../docs/decisions/ADR-216-restraint-reanchored-to-capacity.md)
> struck that gate the same day — external adoption is not a project goal — and
> with it **the verification-versus-capability split dissolved.** Nothing in this
> file is categorically frozen any more.
>
> **What remains is one capacity mechanism:** at most two concurrently-open
> `road-to-skill-ecosystem-*` roadmaps outside `archive/` and `later/`
> (ADR-215 § D2, mechanically enforced). Both slots are currently held.
>
> **Resume when** a slot frees and the maintainer picks an entry for it. Verify
> with `./agent-config roadmap:progress`. Promotion is still per entry rather than
> as a batch — that discipline was about maintainer load, not about the gate, so
> it survives.

> Hold the sweep's capability findings in one reviewable queue with their evidence
> attached, so that when a capacity slot frees the queue is a decision list
> rather than a re-analysis.

## Context

Source + verdicts:
[`skill-ecosystem-sweep-2026-08`](../../settings/contexts/skill-ecosystem-sweep-2026-08.md).

**Why one file rather than five.** Authoring five executable capability roadmaps
would pay the authoring cost for work that cannot start under the slot cap, and
would present as an open workload. One queue file with the evidence attached
preserves the sweep's value at a fraction of the cost, and it is honest about the
state: these are queued decisions, not planned work.

The council framed its risk-of-lifting as mistaking activity for progress on the
binding constraint, which it took to be adoption. ADR-216 corrects the premise —
the binding constraint is maintainer capacity — but the shape of the caution
survives translation: five open workstreams for one maintainer is the fragmentation
the cap exists to prevent, whatever the outside world is doing.

**A construction defect recorded so it is not rediscovered.** The freeze's
latent-risk door requires a failing test written and committed before the borrow.
That works for a defect in existing machinery — the test exercises real code that
misbehaves. It cannot work for a capability that does not exist yet: a test
referencing absent code is not a failing test, it is a declaration of intent,
which the amendment explicitly excludes. Both council members identified this.

The council's proposed repair was a separate capability arm. ADR-216 went further
and removed the need for one: with the freeze lifted in full, the latent-risk door
is no longer the path capability has to squeeze through, so its inability to admit
capability stops mattering. The door stays exactly as written for the defect-closure
case it handles well.

## The queue

Each entry carries what the sweep established and what would have to be true for
it to proceed. Ordering within the queue is by evidence strength, not by appeal.

### Q1 — Presentation output in the format the gate named

A source builds a real deck with a blank layout and one full-bleed generated image
per slide, speaker notes as the only text object, plus a two-stage compression
ladder so the file actually opens. It needs only the document library, no office
suite. **This package's document-authoring skill states four times that the
presentation surface is gated because it would require an office-suite
dependency** — so this finding removes the stated gate reason rather than arguing
around it. The existing HTML deck skill stays as the editable and reviewable path;
this becomes the must-be-a-real-file path.

*Proceeds when:* a capacity slot frees. This is the strongest entry in the
queue because the blocking reason is now known to be false, which is a documented
contradiction rather than a preference.

### Q2 — Design rules that are exact, testable, and absent

Verified absent from the typography and design skills by direct inspection:

- **Heading level is not heading size.** A role-to-tag-to-size table, with a card
  or tile title sitting well below a page hero because it competes inside its card
  rather than with the page. This is the failure that collapses generated page
  hierarchy.
- **Three spacing laws.** Padding around a group exceeds spacing within it,
  horizontally too; at least three distinct spacing tiers or hierarchy collapses;
  and start generous and remove rather than starting at the minimum and
  incrementing.
- **Nested radius relation.** The inner radius is the outer radius less the
  padding, stated both ways, with the named failure of reusing the parent radius.
- **Control geometry.** An input and a button sharing a row match height exactly,
  derived from the button token; an in-field icon inset is symmetric; a native
  select needs the colour-scheme declaration or the operating system's option list
  renders as a light popup on a dark surface.
- **A foreground chosen by its worst case across every state a control reaches**,
  rather than validated as a single pair. This is where real contrast failures
  live: passing at rest and failing on hover.
- **Theme precedence both ways** — the attribute selector must beat the media
  query in both directions. Our published-artifact surface requires this and no
  authored artifact teaches the mechanism.

*Proceeds when:* a capacity slot frees. Every value is re-derived rather than
copied; one source's radius and spacing columns were verified constant across all
its entries including two where the correct value is zero, so its numbers are
unreliable even where its rules are not.

### Q3 — A diagram skill

A question-to-grammar table, an explicit medium-selection rule (do not reach for a
vector format merely because the output is a diagram), and concrete pan-and-zoom
mechanics. Verified genuinely absent: this package carries a dense chart corpus and
no diagram artifact at all.

*Proceeds when:* a capacity slot frees.

### Q4 — Publish-target degradation matrix

One source ships twelve adapters that degrade one HTML document per destination —
style inlining with pseudo-element preservation, a per-destination tagging
requirement, math replaced by images where the destination renders it that way, and
an honest note that a runtime-injected stylesheet is invisible to the inliner so a
computed-style walk is the fallback. This package's published-artifact surface has
exactly one hostile target and no artifact covering the class.

*Proceeds when:* a capacity slot frees.

### Q5 — Media corpus depth

- A calibrated shot-recipe corpus whose parameter tables carry a third column
  stating the threshold at which a change **flips the viewer's read** — a
  perceptual bound rather than a default. No other source in the sweep encodes
  that, and it is the cinematography depth this package's video director lacks.
- A numbered aesthetic-precedent ledger where every entry is a rule plus the
  precedent that produced it plus a self-check question, append-only, with
  confidence labels for single-case entries and dated revisions when a rule is
  later narrowed. This is this package's own evidence discipline invented
  independently inside a creative domain.
- A beat-synchronisation closed loop that extracts the audio back out of the
  rendered file and re-measures alignment against the designed cut frames, with a
  numeric perceptual threshold. We align cuts to downbeats and never measure the
  result.
- A rendered-pixel legibility floor using *effective* text height after scale and
  perspective, measured post-render, with a binary classification: text is either
  decorative texture that must read as unreadable, or it is meant to be read and
  meets the floor. The middle state is the named counter-example.
- Determinism in generated render code — no wall-clock or unseeded randomness — as
  the precondition for every other verification in that domain.
- A dual master from one timeline, with and without the music bed, which removes
  the most common reason a finished render is rebuilt.

*Proceeds when:* a capacity slot frees. Note that one adjacent source in the
same group was refused outright on policy grounds and nothing from it enters this
queue.

### Q6 — Finance precision

- A parameter-band corpus for cost-of-capital inputs, used only when a live fetch
  fails and disclosed as a flagged stale fallback. Our valuation skill names the
  drivers and ships no calibrated fallback and no band.
- Numeric gates on the model's own output: a terminal growth rate at or above the
  discount rate stops; a terminal value outside a stated share of enterprise value
  is flagged. Our guidance carries this as prose.
- A method-applicability matrix by company type, replacing a prose do-not-use-for
  list. This is the error class a finance reviewer notices first.
- Respect a provider's own refusal boundary: never re-route a refused request to a
  lower-tier surface of the same provider, and never strip a provider-injected
  disclaimer. Our floor governs our refusals and says nothing about honouring
  someone else's.
- Base and adjusted forecast as two persisted fields with a delta rationale, so
  the question of whether the narrative overlay added or destroyed accuracy becomes
  answerable. This makes an existing skill pair measurable rather than adding one.
- A confidence scale anchored to the existing four-tier source ladder. The floor
  demands a confidence band with a reason and supplies no scale, so bands are
  incomparable across two deliverables; binding it to a ladder we already ship is
  free.

*Proceeds when:* a capacity slot frees. One item is refused outright and
recorded here so it is not re-proposed: averaging two terminal-value methods at
their midpoint, which our valuation skill forbids because naming both inflates
spurious precision.

### Q7 — Knowledge-layer field additions

- A status ladder with a supersession pointer — preserved, provisional, canonical —
  where promotion refuses to write when no decision landed. Our card doctrine
  flattens this to one class.
- A source-commit anchor with a diff-mapped refresh, falling back to a full
  regeneration on a structural diff. Our cards invalidate on a within-session
  change and have no cross-session staleness mechanism.
- A four-condition persistence gate that offers and never auto-creates, with the
  anti-loophole that two documents stating the same fact is not synthesis, and the
  stated asymmetry that a missing page costs one re-query while a junk page
  pollutes permanently.
- An append-only evidence region beside a rewritable synthesis, which resolves a
  real tension: because our cards are caches, every update destroys the evidence
  that produced the claim.
- A five-level provenance strength ladder carried through every reuse. Our
  evidence gate has a binary verified-or-assumed split, and the two weakest levels
  are exactly what that binary flattens.
- A machine-checkable source field for our already-superior ladder. The doctrine
  has no equal in the sweep; the field is free text in a cell comment.
- Citation verification that compares resolved metadata against the stored entry,
  not merely that the identifier resolves. This catches the canonical
  hallucination — a real identifier attached to a fabricated title — which
  existence checking passes.
- A closed citation-key vocabulary handed to the writing step, so any key outside
  the supplied map is mechanically detectable. Cheapest defence observed, and we
  have nothing at that layer.

*Proceeds when:* a capacity slot frees. The citation-verification item is a
network call and belongs inside a research command's step rather than the gate
estate.

### Q8 — Domain content, gated separately

- **Channel-execution marketing.** Verified genuinely uncovered: a keyword sweep
  over the whole authored tree returned zero files for eleven of twelve probe
  terms. Unlike the four verticals refused outright in the sweep record, the
  continuous-integration gate here is satisfiable, so the blocking gates are demand
  signal and a named maintenance owner. One narrow item has an independent case: a
  channel-selection procedure matching capability and access against stated
  staffing, with a hard stop when no audience evidence exists.
- **Search-engine surface.** Absent and adjacent to an existing pack, so it folds
  into that pack rather than opening anything. Web is already an open domain here.
- **Infrastructure depth** for an existing skill: identity churn on rename, keys
  that must be known at plan time, the fact that marking a value sensitive does not
  keep it out of state, and the safe-destroy protocol. Fold as sections plus a
  known-model-mistakes anchor, never as new skills. Every version-gated claim must
  be re-verified against current releases before it lands.
- **Two book-framework skills** with no plausible existing coverage: counterparty
  negotiation, and a time-boxed facilitation protocol. Both would still have to
  clear the overlap ceiling.

*Proceeds when:* a capacity slot frees **and**, for the marketing vertical, the
three domain-adoption gates pass independently. A freed slot does not substitute
for the domain gates. Note the naming collision: the `domain-adoption-policy`
gates are about adopting a technical DOMAIN into the suite and are unaffected by
ADR-216, which struck external-USER adoption as a gate. Different sense of the
word; the domain gates stay.

## Explicit non-adoptions

Recorded so they are not re-proposed, with the reason:

- **Frontmatter conformance to the ecosystem specification.** Our suite-specific
  keys are hard validation errors under the reference validator, and the sanctioned
  escape is a string-to-string map that cannot carry a list. But the sweep also
  established that **no vendor converges past two universal keys** — a licence
  field appears in four of five large suites, a metadata bag in three of five, and
  everything else is vendor-private, with case conventions splitting even inside a
  single vendor. So our schema is not a portability liability. The one key worth
  aligning is the tool-restriction key, where two independent vendors use the same
  spelling at the top level while ours is nested; that alignment is carried by the
  security-and-conformance roadmap, not here.
- **Reasoning-based phrasing over imperative directives.** Contradicted by a second
  source and by our house style; the sweep record § R2 keeps it as an open
  empirical question. The one adoptable half — a consistently-unfollowed rule needs
  structural enforcement or deletion — is already carried by the
  authoring-discipline roadmap.
- **Per-artifact signature granularity, three duplicated size tiers, an N-squared
  conflict matrix, self-contained artifacts with shared blocks copied per
  artifact, and per-artifact semantic versioning.** All refused on architecture
  grounds in the sweep record.
- **A self-assessed score with no coverage gate**, and **a deprecated redirect stub
  occupying a live activation slot.** Both observed in the wild and both rejected;
  they are cited in the sweep record as negative evidence for gates we already run.

## Acceptance Criteria

- [ ] Every queue entry states what the sweep established and what must be true for
      it to proceed.
- [ ] Every explicit non-adoption states its reason.
- [ ] No queue entry has been converted into an executable roadmap while both
      capacity slots remain held.
- [ ] The presentation-format entry records that the previously stated gate reason
      is now known to be false, so the next reader does not re-derive it.

## Blockers

### blocker: capacity-slot
- **Status:** open
- **Owner:** maintainer
- **Blocks:** the whole queue
- **What to do:**
  1. At most two `road-to-skill-ecosystem-*` roadmaps may sit outside `archive/` and `later/` (ADR-215 § D2). Both slots are currently held.
  2. When a slot frees, pick ONE entry from this queue, promote it to its own roadmap, and leave the rest here. The queue is deliberately not a batch — that is a maintainer-load constraint, not a leftover of the struck adoption gate.
  3. Ordering is a maintainer choice informed by the evidence attached to each entry; no category (verification versus capability) ranks entries any more.
- **Resolved when:** fewer than two `road-to-skill-ecosystem-*` roadmaps sit outside `archive/` and `later/`, checked by `./agent-config roadmap:progress`.

### blocker: marketing-domain-gates
- **Status:** open
- **Owner:** user
- **Blocks:** Q8 — Domain content, gated separately
- **What to do:**
  1. The marketing vertical additionally needs the three domain-adoption gates: a documented demand signal, a named maintenance owner with a stated cadence, and a continuous-integration tooling decision.
  2. Unlike the four verticals refused in the sweep record, the tooling gate here is satisfiable, so the decision is genuinely open rather than foreclosed.
- **Resolved when:** the three gates are citeable, or a watch-only note is written under `agents/settings/contexts/domain-watch/`.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The queue is promoted as a batch when a slot frees | product | A freed slot could be read as authorizing several entries at once, which reproduces the nine-parallel-workstreams risk the cap exists to prevent. | The blocker states promotion is one entry per slot; the cap is mechanically enforced, so a third concurrent roadmap fails the build rather than relying on restraint. | blocker: capacity-slot |
| 2 | The queue rots into a stale wish list | product | A parked file with eight entries and no review cadence becomes a document nobody trusts, which is the failure the sweep observed in several sources' own backlogs. | Every entry carries its evidence and its proceed condition inline, so a stale entry is visibly stale; the freeze's own review cadence re-reads this file as part of the periodic disposition. | Q1 — Presentation output in the format the gate named |
| 3 | A capability entry is smuggled in as verification infrastructure | implementation | Some entries have a verification-shaped component — the beat-measurement loop and the citation verifier both end in a check — so the boundary is arguable in exactly the cases where arguing is tempting. | The classification test is whether the change adds a user-facing surface; a measurement that exists only to validate a new surface travels with that surface. Both borderline entries are named here rather than left implicit. | Q5 — Media corpus depth |
| 4 | The domain gates are treated as satisfied by a freed slot | product | A freed capacity slot could be misread as clearing the separate three-gate domain policy for the marketing vertical, helped by the word "adoption" appearing in both senses. | Q8 states the gates are independent and the second blocker restates it; the sweep record's refusal table carries the same distinction. | blocker: marketing-domain-gates |

## Provenance

- Source: fourteen of the forty swept sources contribute entries here. Anonymized
  per `source-confidentiality`; per-source links in the sweep record's
  § Provenance.
- Sweep record + full verdict set:
  [`skill-ecosystem-sweep-2026-08`](../../settings/contexts/skill-ecosystem-sweep-2026-08.md).
- Council: see the sweep record § Council for the verification-versus-capability
  split this queue implements.
