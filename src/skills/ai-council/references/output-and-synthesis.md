# ai-council — output path and synthesis

> Mode body of the [`ai-council`](../SKILL.md) skill (router-head retrofit,
> 2026-08-20). Content moved VERBATIM from SKILL.md — load this file when the
> mode table in SKILL.md routes here.

## Output path convention

Council artefacts (questions, responses, sessions) are **dev-time
scratch** — gitignored in both the package repo and consumer repos
and auto-pruned after `ai_council.session_retention_days` (default
7). They inform a decision; they are not the durable contract. The
durable contract lives in the roadmap / ADR / skill body that cites
the council's convergence inline.

**Linking to a specific council file is forbidden by
[`no-roadmap-references`](../../../rules/no-roadmap-references.md)
(council clause)** — gitignored, not in the cloned repo, gone after
the retention window. Inline the convergence with date + members
instead.

Three directories, three modes:

| Mode | Path | Format |
|---|---|---|
| **Topic-anchored question** (paired with a roadmap or ADR) | `agents/runtime/council/questions/<topic-slug>.md` | Markdown |
| **Topic-anchored response** (paired with the question above) | `agents/runtime/council/responses/<topic-slug>.json` | JSON from `council:run --output` |
| **Ad-hoc session** (no durable artefact yet) | `agents/runtime/council/sessions/<UTC-timestamp>.json` | JSON from `council:run --output` |

`<topic-slug>` is kebab-case and **must match** the corresponding
roadmap / ADR slug if one exists (e.g. `path-fixes` mirrors the
matching `road-to-<topic-slug>` roadmap under `agents/roadmaps/`).

### Forbidden

- Files at `agents/` root (e.g. `agents/runtime/council/question-foo.md`).
- Dot-prefix scratch (e.g. `agents/.council-question-foo.md`).
- Any other directory below `agents/` (e.g. `agents/scratch/`,
  `agents/evidence/notes/`). Operator scratch belongs under
  `agents/runtime/tmp/` (gitignored).
- Cross-references from any artefact to specific council files —
  see [`no-roadmap-references`](../../../rules/no-roadmap-references.md)
  (council clause). Inline the convergence summary instead, with
  date and member list for traceability (`Council (claude-sonnet-4-5
  + gpt-4o, YYYY-MM-DD) reviewed N candidate strategies; converged
  on …`).

### Exempt

- `agents/evidence/audits/` — historical audit bundles. The canonical
  council dirs are gitignored; audit bundles are tracked,
  cohesive narratives that may include council artefacts as
  part of their evidence trail (e.g. `audits/2026-05-14-north-star/`
  bundling its triggering question, raw responses, and synthesis
  alongside the audit's findings). The layout linter
  (`scripts/check_council_layout.ts`) skips this directory.

`scripts/check_council_layout.ts` is the mechanical check for the
output path convention — wire it into the package's CI pipeline so
violations break the build.

## Certainty vocabulary — one scale for evidence, and what the survivors measure

```
ONE SCALE DESCRIBES EVIDENCE QUALITY: confirmed | inferred | speculative.
EVERY OTHER SURVIVING TERM MEASURES A DIFFERENT PROPERTY AND SAYS WHICH.
NEVER INVENT A LENS-LOCAL SYNONYM FOR EVIDENCE QUALITY.
```

Six vocabularies described overlapping properties across `prompts.ts` and this
skill, and the fix is deliberately **not** to collapse them into one: evidence
quality and a member's certainty in a pick are different properties, and merging
them would destroy information the stance line exists to carry. So one scale wins
for evidence quality, and each survivor is named with the property it measures.

| Term | Property it measures | Where |
|---|---|---|
| `confirmed` / `inferred` / `speculative` | **evidence quality** — how well a finding is supported (`confirmed` cites file:line or a metric; `inferred` is plausible from stated context; `speculative` has no citation) | every lens's finding metadata |
| `CONFIDENCE: high\|med\|low` | **a member's certainty in its own pick** — not how good the evidence is, but how strongly that member backs the option it chose | the stance line |
| `DEALBREAKER: yes\|no` | **whether the member would block on the alternative** — a veto, not a certainty | the stance line |
| `roadmap-ready` / `needs-discovery` | **actionability** — is the finding concrete enough to land as a phase step | Top-10 / Supporting |
| `needs-verification` | **provenance of the host agent's OWN inference** — the item was reasoned from context rather than read from a member response | Blind spots |
| `unverified:` | **probe coverage of a mechanism claim** — argued, not measured. An authoring convention with no reader; see `procedure.md` | artefact prose |

**Collapsed, and why.** `unverified-by-council` is gone: it described
*corroboration* (how many reviewers engaged), which the `### Outliers` heading
already states by construction — everything under it was raised by one reviewer
and engaged with by none. A separate word for that invited it to be read as a
fourth point on the evidence scale. `hypothesis` (the optimize lens's local
synonym for `speculative`) is gone for the same reason: a lens-local synonym for
a scale term is the mechanism by which one scale becomes four.

## Synthesis templates (lens-aware)

The **Convergence / Divergence** slot in `council:render` output is
populated with a lens-specific synthesis prompt. The host agent reads
this prompt and writes the summary in the shape it dictates. The five
templates live in `scripts/ai_council/prompts.ts::_SYNTHESIS_TABLE`
and are exposed via `synthesis_template(mode)`.

**R4 Q4 split** — decision lenses get a structured Karpathy-style
template; creative lenses keep an open-ended prose body. **Every lens
now closes with two required verdict-discipline sections** — **Kill
criteria** (observable falsifiers with a threshold or event, checkable
without re-convening the council) and **Concrete next step** (exactly
one artefact-producing action) — added so no synthesis ships an
unfalsifiable verdict (road-to-opt-council-deliberation Phase 0):

| Lens | Class | Synthesis sections |
|---|---|---|
| `default` | decision | Agreement · Clashes · Blind spots · Recommendation · **Kill criteria · Concrete next step** |
| `pr` | decision | Consensus · Conflicts · Must-fix before merge · Recommendation · **Kill criteria · Concrete next step** |
| `analysis` | decision | Top-10 by consensus · Supporting · Outliers · **Kill criteria · Concrete next step** |
| `design` | creative | open prose body + **Kill criteria · Concrete next step** |
| `optimize` | creative | open prose body + **Kill criteria · Concrete next step** |

Input modes (`prompt` / `roadmap` / `diff` / `files`) inherit the
`default` decision template — they are bundling shapes, not lenses.

**Source citations:**
* Template shape — Round 2 council verdict
  (`agents/runtime/council/sessions/2026-05-14-ai-council-redesign/round-1.md`,
  Opus's lens-adaptive synthesis proposal).
* Decision/creative split — Round 4 Q4 verdict
  (`agents/runtime/council/sessions/2026-05-14-ai-council-redesign/round-3-responses.json`).
  R4 reframed `optimize` as creative because perf trade-offs resist
  pre-templated shape — Performance-wins / Trade-offs /
  Implementation-order is too rigid for the variety of optimize-lens
  artefacts. R4 reframed `design` for the same reason — design
  critiques are inherently narrative.

### `--prose-synthesis` escape hatch (R4 Q4)

Both `council:run` and `council:render` accept symmetric escape-hatch
flags on top of the lens table:

* `--prose-synthesis` — force creative-lens passthrough (bare slot)
  regardless of lens. Use when the user on `default`/`pr`/`analysis`
  prefers a narrative recommendation over the structured template.
* `--no-prose-synthesis` — force the `default` structured template
  even on a creative lens. Use when a `design` or `optimize` artefact
  has a one-shot need for Karpathy-style structure.

The flag is mutually exclusive — picking one disables the other on
the same invocation. When `council:run` records either flag in the
output JSON, `council:render` honours it unless the renderer is
called with an explicit flag of its own.

### Renderer lens resolution

`council:render <responses.json>` resolves the active lens in this
order: explicit `--prompt-mode` flag > `prompt_mode` field in the
payload > `mode` field in the payload > `None` (default decision
template). The `--prose-synthesis` / `--no-prose-synthesis` flag
overrides the table regardless of how the lens resolved.

