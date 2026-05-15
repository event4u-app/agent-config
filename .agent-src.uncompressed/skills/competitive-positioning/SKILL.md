---
name: competitive-positioning
description: "Use when comparing this package to a peer / competitor — ours-vs-theirs verdict table, axis selection, adoption queue. Triggers on 'how do we compare to X', 'should we adopt their pattern'."
status: active
tier: senior
source: package
domain: product
context_spine: [product]
recommended_for_user_types: [consultant, gtm, founder]

---

# competitive-positioning

## When to use

- A peer / reference / competitor repository was named and the team needs a structured comparison, not a vibes summary.
- A pattern from another package is being considered for adoption and the trade-off needs to land in writing.
- Positioning prose for a README / launch / pricing page needs an ours-vs-theirs decisions table to anchor on.

Do NOT use for general repo audits (route to `analyze-reference-repo`),
upstream-contribution decisions (route to `upstream-contribute`), or
DCF-style valuation work (route to `dcf-modeling`).

## Cognition cluster

- **Mental model 1 — First principles.** Strip the comparison to the
  outcome each package promises its user, not the feature lists. Two
  packages with overlapping features can promise different outcomes
  and therefore are not direct competitors. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 1.
- **Mental model 24 — Optionality.** A pattern that costs little to
  adopt and preserves exit value beats a "better" pattern that locks
  the package in. Score adoption cost AND exit cost on every row. See
  `mental-models.md` § 24.
- **Mental model 12 — Inversion.** For each axis, ask *"what would
  we do if we wanted to lose on this axis?"* The answer surfaces the
  invariants the comparison must preserve. See `mental-models.md` § 12.
- **Product context-spine slot.** Read the **product** slot for
  segment / focal job / non-goals before picking axes; the comparison
  is only legitimate inside our own scope. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### 1. Frame the comparison

Name the peer in one sentence: *"Package P promises outcome O for
segment S."* If you cannot, the peer is not a peer; abort.

### 2. Pick the axes

3–7 axes, derived from the **product** spine slot, never from the
peer's marketing site. Each axis must:

- Be observable from the artefacts (repo, docs, package output).
- Map to a real user outcome, not a feature checklist.
- Be able to **separate** the two packages on at least the threshold
  of "matters to a switch decision".

### 3. Inspect both packages on each axis

For every axis × package cell, capture:

- **Evidence** — file path, doc URL, behaviour quote.
- **Verdict** — clearly stronger / clearly weaker / parity / not
  applicable.
- **Cost-to-close** — if weaker, what would adopting their approach
  cost in our scope? Mental-model-24 optionality: include exit cost.

Cells without evidence are **not** parity; they are *unknown*.
Surface them; do not silently call them ties.

### 4. Run the inversion check and validate evidence

For each axis where we win, ask: *"what change would make us lose
this axis?"* If the answer is *"none, ever"*, the axis is invariant —
flag it as a strategic moat, not a feature.

Validate every cell against the evidence rule before continuing:
verify each `clearly stronger` / `clearly weaker` row cites a file
path, doc URL, or behaviour quote; check that no cell sits at
parity without evidence; confirm at least one row separates the
packages on a switch-decision-relevant outcome. Cells that fail
this validation become *unknowns*, not parity.

### 5. Produce the verdict table

One row per axis. Columns: **axis · ours · theirs · verdict ·
adopt? · rationale**. The `adopt?` column is the only opinion in
the table.

### 6. Hand back

Hand the table to the requester; route adoption decisions to
[`decision-record`](../decision-record/SKILL.md), upstream proposals
to [`upstream-contribute`](../upstream-contribute/SKILL.md).

## Related Skills

**WHEN to use this**

- Two packages are named and a verdict table is the unit of work.
- A pattern from another package is on the table for adoption.
- Positioning copy needs an anchor table.

**WHEN NOT to use this**

- The peer repo needs a generic walk-through first — route to
  [`analyze-reference-repo`](../analyze-reference-repo/SKILL.md);
  this skill consumes its output, never duplicates it.
- The decision is to contribute back upstream — route to
  [`upstream-contribute`](../upstream-contribute/SKILL.md).
- The output is monetary value (DCF, valuation) — route to
  [`dcf-modeling`](../dcf-modeling/SKILL.md).
- The trade-off is across stakeholders inside our own team — route
  to [`stakeholder-tradeoff`](../stakeholder-tradeoff/SKILL.md).

## When the agent should load this

- "Wie schlagen wir uns gegen X?"
- "Sollten wir das Pattern aus Y übernehmen?"
- "Bau mir die ours-vs-theirs Tabelle für die README."
- "Wo verlieren wir gegen Package P?"
- "Welche Achsen sind invariant für uns?"

## Output

A single Markdown block with:

1. **Frame** — one-sentence promise of each package, segment named.
2. **Axes** — bullet list of 3–7 axes with one-sentence rationale per axis.
3. **Verdict table** — `axis · ours · theirs · verdict · adopt? · rationale`.
4. **Invariants** — axes flagged as strategic moats with the inversion answer.
5. **Adoption queue** — rows where `adopt? = yes`, ordered by cost-to-close.
6. **Unknowns** — cells that lacked evidence; explicit, not collapsed to parity.

## Gotcha

- A verdict table without **unknowns** is suspect; nobody has
  symmetric evidence on a peer at first pass.
- `adopt? = yes` without cost-to-close + exit cost is wishful; the
  optionality rule is non-negotiable.
- Axes derived from the peer's site are reflective, not strategic;
  re-derive from our own product spine slot.

## Do NOT

- Do NOT score before evidence — evidence first, verdict after.
- Do NOT treat unknowns as parity to "complete" the table.
- Do NOT lock adoption decisions in this skill — hand off to
  `decision-record`.
- Do NOT include monetary or roadmap framing — this is positioning,
  not planning.
