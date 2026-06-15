---
type: anti-hallucination
trust: durable
origin: "<brief description — e.g. npm package / remote API / legacy DB>"
url: "<canonical upstream URL>"
ref: "<pinned version tag or commit SHA — never blind main>"
version: "<installed version, e.g. 3.2.1>"
links:
  authoritative: "<canonical docs URL>"
  local: "<relative path to node_modules/vendor file, e.g. node_modules/<pkg>/index.d.ts>"
observed_at: "YYYY-MM-DD"
revalidate_if: "<condition — e.g. version bumped, API contract changed, new fields added>"
---

<!--
  Template shipped by event4u/agent-config.
  Copy to `agents/knowledge/<source>.md` in the consumer project and fill in.
  Frontmatter MUST stay at line 1 (the card linter anchors on it).
  Delete this HTML comment after filling in.
-->

# Knowledge Card — <source>

## Negative facts (trust: durable)

<!--
  Write a negative fact ONLY after exhausting the search across all relevant
  sources for that claim. Log both what was searched and what was not searched.
  Attach a revalidate_if trigger. Negative facts are current-state observations
  ("searched X, did not find Y") — not design decisions.
-->

| claim | searched | not_searched | observed_at | revalidate_if | next_step |
|---|---|---|---|---|---|
| `<method/field/pattern> does not exist` | `<files / docs / SDL inspected>` | `<surfaces not yet checked>` | YYYY-MM-DD | `<condition that would invalidate>` | `<e.g. check if version X adds it>` |

## Positive structure — last-verified HYPOTHESIS (Assumed-from-card, confirm before use)

<!--
  Positive structural claims are HYPOTHESES, never Verified — even when the
  pointer below resolves green (R4 P1). Always confirm per-line before coding.
  Each line MUST carry observed_at and source_version.
-->

**These are NOT Verified.** Load this card into the Evidence Report as
"Assumed (from card)" and re-confirm against the real source this session. One
entry per line; **each line MUST carry `observed_at:` and `source_version:`** in
the keyed form below — the card linter (C5 multi-evidence consistency + the
freshness signal) reads those keys, and `source_version`s on one card must sit in
a single git-ancestry chain / within a 7-day window.

- `<field/method>` (`<type/signature>`) — observed_at: YYYY-MM-DD · source_version: "<version-or-sha>" · `<note>`
- `<field/method>` (`<type/signature>`) — observed_at: YYYY-MM-DD · source_version: "<version-or-sha>" · `<note>`

## Pointers

- **Authoritative:** <canonical docs URL>
- **Local:** `<node_modules/<pkg>/index.d.ts>` or vendor equivalent

## See also

- [`evidence-discipline`](dist/agent-src/contexts/execution/evidence-discipline.md) — report format, provenance rules, honest enforcement reality
- [`source-discovery`](dist/agent-src/skills/source-discovery/SKILL.md) — procedure for discovering each surface type
