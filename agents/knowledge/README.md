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

## Global cross-project store (v2 — ADR-100)

An *expensive* (remote) card can be promoted to a per-user, **file-first**
global store at `~/.event4u/agent-config/knowledge/` and reused in other
projects **as leads only** (positive structure re-confirmed against the live
source each session). It is gated by the user-global
`knowledge.global_sharing` setting (default on for `public`/`vendor`;
`proprietary` is manual-only; `enabled: false` no-ops the layer — this project
tree is unaffected).

The store is **unversioned** (not in git) — a cache, never a source of truth;
each global card carries a provenance footer as its audit trail. Manage it via:

```
task knowledge-global -- list            # or: show <card> · trace <card> · forget <card>
python3 src/scripts/knowledge_global_cli.py promote agents/knowledge/<card>.md --source <url>
task knowledge-global-validate           # offline lint of the untracked store
```

This is **not** the `/knowledge` slash cluster (that is local-file ingestion).
