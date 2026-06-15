# Committed knowledge cards

Tracked, thin, trust-tiered caches of **expensive** (remote) structural
evidence — one file per source: `agents/knowledge/<source>.md`.

A card is **never a source of truth and never a build input.** It is an
optional cache that earns its keep on two things only:

- **Negative facts** — "searched X, the field/endpoint is *not* there" (after
  an exhausted, logged search). These are `trust: durable`.
- **Pointers** — the authoritative URL/path the real answer lives at, kept
  green by pointer-CI.

A card's **positive structure** (fields, endpoints, columns it claims *exist*)
is a per-line, last-verified **hypothesis** — it lands under "Assumed (from
card)" in the Evidence Report and must be re-confirmed against the live source
before use. It is never "Verified" on the strength of the card alone.

See [`context: evidence-discipline`](../../dist/agent-src/contexts/execution/evidence-discipline.md)
for the full model, [`skill: source-discovery`](../../dist/agent-src/skills/source-discovery/SKILL.md)
for the procedure, and the `knowledge-card` template for the card shape.

> Ephemeral, per-task scratch (Evidence Reports, raw probe/introspection dumps,
> absence-search logs) lives in the **gitignored** `agents/memory/knowledge/session/`,
> never here.
