# Spec: Cross-project learning feed (Stage 3)

> **Spec for `agent-memory`, authored from `agent-config`.**
> See [`README.md`](README.md) for the ownership split.

## Status

**Deferred beyond the first integration milestone.** This spec
documents the direction so V1 decisions do not preclude it. Actual
implementation is a later milestone on the `agent-memory` roadmap;
pulling it forward risks shipping cross-project learning before
single-project promotion is proven.

Introduced in GPT's review as "Stufe 3" after intra-project capture
(Stufe 1) and intra-project promotion (Stufe 2).

## Prerequisites

- [`road-to-promotion-flow.md`](road-to-promotion-flow.md) operational
  in at least two production consumers
- [`road-to-decay-calibration.md`](road-to-decay-calibration.md)
  applied — decayed noise must not pollute the cross-project signal
- [`../road-to-curated-self-improvement.md`](../road-to-curated-self-improvement.md)
  pipeline running — it is the *consumer* of this feed, the final
  mile that turns signals into rule / skill / guideline PRs

## Vision

> When the same kind of failure or insight appears across multiple
> unrelated projects, that is evidence the underlying lesson is not
> project-local — it is a candidate for the shared agent package.

The feed is **not** a telemetry channel. It is a **proposal stream**:
each signal is an explicit, anonymised statement "pattern X observed
in N projects, here is a summary," delivered to a reviewer. Humans
decide whether it becomes a rule, a skill, a guideline, or nothing.

## Non-goals

- **No** autonomous PRs against `agent-config` from agent-memory
- **No** transfer of project-specific identifiers (paths, owner names,
  ticket ids) — only type, tag set, and anonymised summaries
- **No** implicit opt-in — consumers must set
  `.agent-project-settings.memory.cross_project_feed.enabled: true`
- **No** replacement of the existing five-stage self-improvement
  pipeline — this is a **new input** to stage 1 (capture)

## Signal shape

Each signal emitted from a consumer carries:

```yaml
signal_id: <uuid>
pattern_type: historical-pattern | domain-invariant | incident-learning | product-rule
tags: [tenant-scoping, authz, ...]
summary: <short text describing the pattern without project specifics>
evidence_count: <number of distinct episodic entries fused into this>
earliest_seen: <iso date>
latest_seen: <iso date>
confidence: low | medium | high
consumer_hash: <opaque, stable per consumer, no mapping back>
```

The `consumer_hash` is an opaque id so the aggregator can count
distinct consumers **without** learning identities.

## Threshold for upstream proposal

A signal becomes a proposal when:

- **≥ 3 distinct `consumer_hash` values** reported the same
  `pattern_type` + overlapping `tags`, and
- cumulative `confidence` reaches `medium` (one `high` counts twice,
  two `medium` count normally, `low` do not count), and
- the pattern is not already encoded in an active rule, skill, or
  guideline in `agent-config`

The last check is a string-and-tag lookup against the current
`agent-config` inventory (done by the aggregator, not by any consumer).

## Aggregator — architectural options (to be decided in `agent-memory`)

Three realistic shapes. The choice is agent-memory's; this spec
captures agent-config's constraints on each.

| Option | Shape | Constraint from agent-config |
|---|---|---|
| **A — Opt-in SaaS aggregator** | Consumer posts signals to a hosted service run by the agent-config maintainers | Must be strictly opt-in; clear retention and deletion policy; published privacy doc |
| **B — Federated pull** | Aggregator repo (in `event4u-app` org) polls consumer repos for `.agent-local/memory/exports/` files committed by consumers on demand | Consumer controls what is exported; no automatic push |
| **C — Manual meta-review** | Maintainers periodically review incoming proposals from consumers who submit issues tagged `cross-project-signal` | Zero infrastructure; slowest; lowest privacy risk |

Recommendation from agent-config perspective: **start with Option C**,
graduate to B, treat A as a later product decision.

## Back-feed into `agent-config`

When a threshold signal becomes a proposal, the aggregator (whatever
option is chosen) opens a PR against `agent-config`:

- Branch naming: `improve/agent-memory-signal-<short-id>`
- Target: a new or extended rule, skill, or guideline under
  `.agent-src.uncompressed/`
- PR body includes: the signal summary, evidence counts, list of
  `consumer_hash` values (not names), suggested artefact type, and a
  "reject if..." checklist for the reviewer

This reuses the conventions already defined by
[`../road-to-curated-self-improvement.md`](../road-to-curated-self-improvement.md) —
this spec is the upstream *source*; the improvement roadmap is the
*sink*.

## Privacy and consent

Hard rules — agent-memory must enforce these on the signal emit path:

- Summary text is produced by a local LLM or a template; must pass a
  **regex-based scrubber** that rejects obvious identifiers (emails,
  tokens, paths starting with consumer repo root)
- `consumer_hash` is derived from a salt chosen by the consumer at
  install time and **never transmitted**; consumers can rotate it to
  break continuity
- Consumers can inspect every signal before it leaves the local
  system (`dry-run` mode is the default until explicit opt-in)

## Open questions (decided in `agent-memory` repo)

- **Aggregator ownership.** Who operates it? See options A / B / C above
- **Signal retention.** How long does the aggregator keep raw signals
  after they have been fused into a proposal?
- **Negative signals.** A consumer deprecates a semantic entry —
  should that emit a "counter-signal" weakening an earlier proposal?
  Proposal: **yes**, explicit `deprecation_signal` event type.

## See also

- [`road-to-promotion-flow.md`](road-to-promotion-flow.md) —
  intra-project loop that this one extends
- [`../road-to-curated-self-improvement.md`](../road-to-curated-self-improvement.md) —
  downstream consumer of proposals
- [`../archive/road-to-agent-outcomes.md`](../archive/road-to-agent-outcomes.md) —
  the outcome this loop serves: the system gets sharper with each
  consumer onboarded
