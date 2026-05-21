# ADR — Splitting an Always-rule into rule + `load_context:` is not viable under Model (b)

> **Status:** Decided · Phase 2A revert shipped · 2026-05-03
> **Context:** [`docs/contracts/load-context-budget-model.md`](../../docs/contracts/load-context-budget-model.md) ·
> [`road-to-context-layer-maturity.md`](../roadmaps/road-to-context-layer-maturity.md) ·
> [`road-to-rule-hardening.md`](../roadmaps/road-to-rule-hardening.md)
> **Source:** Phase 2A of the now-archived
> `road-to-structural-optimization.md` (council Round 3, 2026-05-03).
> **Closes:** the institutional-knowledge gap surfaced by Phase 0a.3
> of `road-to-rule-hardening.md` — prevents the next contributor from
> re-attempting the same split.

## Decision

Do **not** slim an Always-rule by extracting decision-logic prose
into a `load_context:` companion file. Under Model (b) literal
accounting, that split produces a **net character increase** because
the context's frontmatter + the rule's citation overhead exceed the
prose moved out.

The ceiling is structural, not parameter-tunable. Three alternative
strategies remain on the table for budget relief
(`road-to-context-layer-maturity.md` Phase 4): demote `always` →
`auto`, merge two narrow always-rules whose Iron Laws share a domain,
or hard-compress an Iron-Law section. Splitting is not one of them.

## Why this was a real question

- The structural-optimization roadmap entered Phase 2A on the thesis
  that decision-logic prose belonged in a context, leaving the rule
  with only its Iron Law surface.
- The first split candidate — `language-and-tone` — was implemented
  end-to-end (rule + new context + linter pass) and produced a
  measured **+186 chars net** under Model (b).
- The two further candidates were aborted before commit; an
  end-to-end revert restored the three rules and their previously
  inlined decision logic.

## Empirical evidence

| Rule | Pre-split rule chars | Post-split rule chars | Context chars added | Net Δ |
|---|---:|---:|---:|---:|
| `language-and-tone` | 5,873 | 4,124 | +1,935 | **+186** |

`Net Δ` is `(post-split rule + new context) − (pre-split rule)` and
is the value the always-budget gate measures. The +186 chars number
is what tipped the council; the two unmeasured candidates were never
implemented.

## Why Model (b) makes this structural

Under Model (b) literal (see the contract file):

```
EffectiveSize(rule) = RawSize(rule) + Σ RawSize(c) for every c in load_context*
```

A split adds:

- Frontmatter on the new context (`---\n…\n---\n`, plus
  `load_context_eager:` or `load_context:` declarations on the
  rule's side).
- A new H1 + intro paragraph inside the context (linter-required —
  see `load-context-schema.md`).
- A short "see also" bridge in the rule that points at the context.

Those three overheads sum to ~ 200 chars regardless of how much
decision-logic prose moves out. For a split to *save* chars, the
moved-out prose must exceed the overhead. The Phase-2A candidates
all sat under that threshold because each Always-rule is already
slim — the obligation surface is the bulk, and the obligation
surface cannot move.

## Scope of the not-viable verdict

| Surface | Verdict |
|---|---|
| `type: "always"` rules | Splitting **not** viable under Model (b). |
| `type: "auto"` rules | Outside Model (b); always-budget does not apply. Splitting still bound by skill-quality + size-enforcement, but not by this ADR. |
| Iron-Law-only rules | Never a split candidate to begin with — the obligation surface is the rule. |
| Safety-floor rules | Out of scope by `check_safety_floor_untouched.py` regardless. |

## Consequences

- The always-budget linter
  ([`scripts/check_always_budget.py`](../../scripts/check_always_budget.py))
  remains correct as written — splitting was never going to give it
  more headroom.
- `road-to-context-layer-maturity.md` Phase 4 inherits the three
  surviving budget-relief paths (demote / merge / hard compress)
  and the optional shared-context discount under Phase 1 Q3=3b.
- New contributors who think "this rule is too big, split it" are
  redirected here. The next attempt requires a contract revision
  (per `load-context-budget-model.md` § Status) and a roadmap
  revision, not a re-experiment.

## Lift / supersede

This decision is rule-of-thumb-grade, not iron law. It is lifted
when **either** of the following holds, validated against the
empirical Net-Δ test on at least three rules:

1. Model (b) is replaced with a per-rule shared-context discount
   (Phase 1 Q3=3b) and the linter is rewritten to attribute shared
   contexts proportionally.
2. The frontmatter / citation / H1 overheads drop (e.g. via a
   contract change to `load-context-schema.md`) far enough that a
   typical Always-rule split clears the +200-char threshold.

A future ADR records the lift; this one stays as the historical
reason the next attempt was prevented.
