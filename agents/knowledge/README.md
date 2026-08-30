# Committed knowledge cards

> **This directory holds a TAGGED UNION, not one card shape.** Every card
> declares `kind: external | experience`, and the two variants are validated by
> disjoint rules. Decided by AI council 2026-08-30 (anthropic + openai, 2/2
> convergent) under `road-to-experience-loop-broadening` Phase 7.
>
> The council was explicit about the shape, and the reason is worth carrying:
> making the external variant's checks *optional* would hide two contracts
> inside one nominal schema — the union-of-what-producers-send failure this
> repository refuses elsewhere. They are **variant invariants** instead: they
> apply in full to `kind: external`, and are not part of the `experience`
> variant at all.
>
> **`kind: external`** — everything below this banner. Caches of expensive
> remote structural evidence, carrying an authoritative pointer, a trust tier,
> and a pinned `source_version`. Checks C1–C6 in
> `src/scripts/check_knowledge_cards.ts` are this variant's invariants.
>
> **`kind: experience`** — mined from THIS repository's own audit stream, never
> from a remote source. Required fields: scope · trigger context · strategy ·
> falsifier · confidence · contradictions · supersedes · expiry ·
> epistemic type. Admissible only from the `extract_audit_patterns` mining gate
> (count ≥ 2 across independent `work_id`s) or an explicit human seed — never
> invented. Contract and checks: `src/scripts/_lib/experience_card.ts`.
>
> **Why one directory rather than two**, recorded so the next proposal is
> measured against it rather than re-argued — the council's own discriminator:
> *a new store is justified only when its records cannot share the existing
> carrier's identity, discovery path and consumer lifecycle, not merely because
> they have different provenance or validation rules.* Experience cards share
> all three.

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
