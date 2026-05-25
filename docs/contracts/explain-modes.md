# Explain Modes Contract

> **Status** · v0 / design · 2026-05-24. Phase 6 of the
> employee-product workstream.
> Governed by [`ADR-026`](../decisions/ADR-026-explain-mode-translation.md).
> Translates the existing engineer-shaped `explain-v1` envelope into a
> role-aware plain surface, without changing the underlying data.

## Two modes over one envelope

The agent-memory MCP already returns an `explain-v1` envelope per
`memory_explain`. It speaks engineer: `trust_score`, `score_breakdown`,
`promotion_history`, `contradictions`, `decay`. Phase 6 keeps that
envelope as the single source of truth and renders **two views**:

| Mode | Default for | Vocabulary |
|---|---|---|
| `technical` | engineering-lead, platform-engineer, default for `--debug` flag | trust_score, decay rate, promotion path, contradictions count |
| `plain` | every other role (galabau, content-creator, consultant, …) | "where this came from", "how confident", "when last reviewed", "what's contested" |

No new MCP call. No new data fetch. The plain renderer is a **pure
function** over the existing envelope.

## Field mapping

| envelope field | technical label | plain label (default) |
|---|---|---|
| `trust_score` (0.0–1.0) | "Trust score" | "Confidence" with 4-band label (Very High ≥ 0.85 · High ≥ 0.65 · Medium ≥ 0.40 · Low < 0.40) |
| `score_breakdown.validation` | "Validation contribution" | "How well it's been checked" |
| `score_breakdown.usage` | "Usage contribution" | "How often it's been used" |
| `score_breakdown.recency` | "Recency contribution" | "How recently it was confirmed" |
| `score_breakdown.contradictions` | "Contradiction penalty" | "Disagreements found" |
| `promotion_history[]` | "Promotion timeline" | "When this was confirmed" (most recent first, ≤ 3 entries) |
| `contradictions[]` | "Unresolved contradictions" | "What disagrees with this" |
| `decay.applied_factor` | "Decay factor" | "Freshness" with 3-band label (Fresh ≥ 0.80 · Aging ≥ 0.50 · Stale < 0.50) |
| `evidence.sources[]` | "Sources" | "Where this came from" |
| `last_reviewed_at` | "Last reviewed" | "When last reviewed" + human-relative ("3 days ago") |

The technical view renders one section per envelope field, terse,
tabular. The plain view renders four labelled paragraphs:

```
Where this came from
  3 sources — handbuch.pdf · offer-template.md · 1 council vote.

How confident
  High (0.74). Last confirmed 3 days ago.

When last reviewed
  2026-05-21 — by the maintenance pass.

What's contested
  No open disagreements.
```

## Per-role glossary override

Each role may ship an `agents/roles/<role>/explain-glossary.yml`
that overrides default plain-mode labels and the 4-band threshold
points. The file is optional; missing → defaults are used.

```yaml
# agents/roles/galabau/explain-glossary.yml
schema: explain-glossary/v0
labels:
  confidence: "Sicherheit"
  sources: "Woher das stammt"
  last_reviewed: "Zuletzt geprüft"
  contradictions: "Was widerspricht"
bands:
  confidence:
    very_high: 0.85
    high: 0.65
    medium: 0.40
  freshness:
    fresh: 0.80
    aging: 0.50
```

Labels stay in `.md` source English (per `language-and-tone`);
**glossary YAMLs are the exception** — they hold the localized
runtime strings for the rendered surface and may be in the role's
native language. Loader validates `schema:` matches `explain-glossary/v0`.

## `/why` quick command

Any role may invoke `/why` on the last agent reply. Resolution:

1. Look up the last `host.turn` in the active session JSONL.
2. Extract memory entry IDs referenced in the reply (regex on
   `mem://<id>` markers the host envelope already emits).
3. Call `memory_explain` for each id; merge envelopes.
4. Render in the active mode (plain by default, technical if the
   role's `explain_default` is `technical`).
5. Append the rendered output to the session JSONL as
   `{ kind: "explain.rendered", data: { mode, ids: [...] } }`.

`/why` never makes a network call beyond the existing MCP transport.

## Renderer surface (pure function)

```ts
function renderExplain(
  envelope: ExplainV1,
  options: {
    mode: "technical" | "plain",
    glossary?: ExplainGlossaryV0,
    locale?: string,            // affects relative-date rendering only
  }
): { markdown: string, mode: string, ids: string[] }
```

Implementation lives in `packages/core/src/workspace/explain/`. No I/O,
no clock dependency beyond the `now` injected for relative-date
formatting; testable with fixtures.

## Coverage (Phase 6 Step 5)

Fixture-driven golden tests against `tests/golden/explain/` for ≥ 5
envelope shapes:

1. High-trust validated entry — fresh, no contradictions.
2. Low-trust quarantined entry — never promoted.
3. Contradicted entry — 2 open contradictions, one resolved.
4. Recently promoted entry — last `promotion_history[0]` < 24h old.
5. Deprecated entry — superseded-by chain, decay factor 0.20.

Each fixture exercised in both `technical` and `plain` modes plus
one with a glossary override. ≥ 90 % branch on the renderer module.

## Failure modes

- Missing envelope field → render placeholder "(unavailable)" in
  plain mode; renderer never throws. Technical mode shows the raw
  null with a warning marker.
- Unknown `schema:` in glossary → loader logs a warning and falls
  back to defaults; never blocks rendering.
- `/why` finds no `mem://` markers → renders "This reply did not
  cite any stored memory entries." No error.

## Cross-references

- ADR: [`ADR-026`](../decisions/ADR-026-explain-mode-translation.md).
- Envelope contract: [`agent-memory-contract`](agent-memory-contract.md) (`explain-v1`).
- Workspace integration: [`daily-workspace`](daily-workspace.md) (right rail).
- Roles: [`role-experience`](role-experience.md) (`explain_default` field).
