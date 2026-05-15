---
type: "auto"
tier: "1"
description: "Low-impact council fast-path dispatch — host agent MUST surface the transparency marker verbatim in the reply opening; never swallow, paraphrase, or replace it with a same-sounding summary."
source: package
triggers:
  - keyword: "low-impact council"
  - keyword: "fast-path"
  - keyword: "Resolved via low-impact council"
  - keyword: "low_impact"
  - intent: "low-impact council dispatch"
---

# Fast-Path Marker Visibility

When a decision resolves through the low-impact council fast-path (corpus
match, fuzzy match, or any other `decision_resolution.classes.low_impact`
opt-in route), the dispatcher emits a transparency marker. The host agent
**must** surface that marker verbatim — never swallow it, never paraphrase
it, never fold it into a same-sounding summary.

## The Iron Law

```
EVERY LOW-IMPACT COUNCIL FAST-PATH REPLY OPENS WITH THE EXACT MARKER.
NEVER PARAPHRASE. NEVER SWALLOW. NEVER SUBSTITUTE THE AGENT'S OWN VERDICT.
```

Applies to **every** fast-path outcome:

- **Resolved** — `> Resolved via low-impact council fast-path: <verdict>.`
- **Unavailable** — `> Low-impact council unavailable (no opted-in members) — escalating to user.`
- **Split** — `> Low-impact council split — escalating to user (<m1>: X / <m2>: Y):`
- **Aborted** — `> Low-impact council aborted (token cap) — escalating to user:`

Markers from `scripts/ai_council/low_impact.py`. Wording is normative —
case, punctuation, and the leading `> ` blockquote prefix all matter so
that downstream agents and tooling can pattern-match.

## What "verbatim" means

- First non-whitespace line of the reply is the marker.
- No prose, greeting, or restating-the-question above it.
- No translation: the marker is English even when the user wrote in
  another language. `language-and-tone` Iron-Law mirror applies to the
  prose **after** the marker, not the marker itself.
- No emoji decoration, no trailing rationale on the same line.
- The marker appears **once**. Subsequent prose explains the verdict.

## Why

The marker is the only audit signal that distinguishes a fast-path
resolution from the agent's own reasoning. Swallowing it converts an
opt-in observability surface into a silent substitution — the user can no
longer tell whether the council bypassed their judgement or the agent
deliberated locally. This is the same failure mode that `direct-answers
§ Iron Law 2` forbids for invented facts, applied to dispatch provenance.

## Failure modes

- Opening with `Found it` / `Looks like` / `Here's the verdict` — drops
  the marker. **Violation.**
- Translating the marker to German / Spanish / any non-English. **Violation.**
- Adding emoji prefix (`✅ Resolved via …`) — alters the literal. **Violation.**
- Indenting the marker beyond the leading `> ` — breaks pattern match. **Violation.**
- Merging marker into a numbered-options block. **Violation.**

## Scope

Only fires for `low_impact` dispatch outcomes. `high_impact` and
`user_required` classes never reach the fast-path and have no marker —
this rule does not constrain their output.

## See also

- [`ai-council-config § Low-impact council opt-in`](../../docs/contracts/ai-council-config.md#low-impact-council-opt-in)
- [`direct-answers`](direct-answers.md) — invented-facts Iron Law (provenance kin).
- `scripts/ai_council/low_impact.py` — marker source.
