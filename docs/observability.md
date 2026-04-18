# Observability, Feedback & Lifecycle (experimental, opt-in)

> **Status:** Scaffold. Data models, persistence paths, and collectors exist
> and are test-covered, but none of these layers execute automatically, and
> none of them inject data into agent context on their own.
>
> Consumers of this package do **not** need to read this document. The default
> `cost_profile: minimal` keeps every layer described here inert.

This document describes three experimental layers that extend the core
governance + runtime system. They are kept out of the main
[`architecture.md`](architecture.md) on purpose so that the normal install
and usage story stays short.

## When to enable any of this

Only enable if **all** of the following hold:

- You want to measure agent behavior across a team, not just eyeball it.
- You have a plan for who reads the collected data and when.
- You accept that most tooling here is scaffold-level and may change.

Otherwise leave `cost_profile: minimal` and ignore this page.

## Core principle: data collection ≠ automatic usage

Everything below persists data to local JSON files. Nothing is fed back into
the agent's prompt automatically. There is no "the agent learned from feedback"
magic. A human (or an explicit command) has to consume the data.

## Layer 1: Observability

The system can emit structured data — events, metrics, execution logs —
persisted locally:

| File | Content | Producer |
|---|---|---|
| `metrics.json` | Execution metrics per skill / command | `scripts/runtime_metrics.py` |
| `feedback.json` | Outcome records | `scripts/feedback_collector.py` |
| `tool-audit.json` | Results of tool-adapter calls | `scripts/tool_registry.py` |
| CI summaries, lifecycle reports | Periodic snapshots | `scripts/ci_summary.py`, `scripts/skill_lifecycle.py` |

Gated behind `cost_profile`. Writing is disabled under `minimal`.

## Layer 2: Feedback system

> **Status:** data model + collector exist; nothing consumes feedback automatically.

Feedback records capture the outcome of a skill or command run
(`success`, `failure`, `partial`, `blocked`, `timeout`) plus optional notes.
They are appended to `feedback.json` via `scripts/feedback_collector.py`.

What the scaffold is **not** doing today:

- It does not inject feedback into future prompts.
- It does not generate improvement suggestions on its own.
- It does not detect failure patterns automatically.

A human-driven workflow for reading the file lives in
[`agents/docs/feedback-consumption.md`](../agents/docs/feedback-consumption.md).

## Layer 3: Lifecycle management

> **Status:** tracking + scoring exist; no enforcement.

Each skill can declare a lifecycle state in its frontmatter:

```yaml
lifecycle: active | deprecated | superseded
```

`scripts/skill_lifecycle.py` aggregates these states and produces health
reports, but nothing in the normal install or runtime path gates on them.
Deprecated skills still load.

Planned later: migration hints when an agent selects a deprecated skill; for
now, the deprecation is purely informational.

## Disabling

All three layers are off by default (`cost_profile: minimal`). To verify:

```bash
grep '^cost_profile' .agent-settings
```

Any value other than `minimal` enables parts of the above. The
`.agent-settings` template in `templates/consumer-settings/` documents the
trade-offs per profile.

## Status summary

| Layer | What exists | What's missing |
|---|---|---|
| Observability | Data model, persistence | End-user dashboards / readers |
| Feedback | Collector, JSON file | Auto-consumption, pattern detection |
| Lifecycle | Frontmatter field, aggregator | Runtime gating, migration hints |

---

← [Back to architecture](architecture.md)
