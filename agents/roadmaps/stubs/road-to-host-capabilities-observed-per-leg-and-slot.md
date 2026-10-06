---
complexity: lightweight
review_by: 2026-12-31
---

# Stub: host capabilities observed per leg and per slot

> **Arrivals:** 1 — latest `inbox-2026-10-e` (2026-10-06), where two release
> reviews of 16.3.0 ask for outside-in conformance per host and a third asks
> that a capability row say which execution leg it was observed on.

> **Stub — not active work.** Capability-gated: every step needs a real
> session on a host other than Claude Code, which no drain run has. Promoted
> when one such host is available to the maintainer for a recorded session.

## What moved here

Two findings from that round, verified at `main` @ `a75bb3210`, that no live
roadmap holds.

### 1. Refusal is claimed per slot, observed on one host

`docs/enforcement-by-host.md:130-132` and `:222-230` state that three of the
thirty-two host and slot pairs refuse, all on Claude Code, and that a green
lowering matrix means the slot is bound, not that a refusal reaches the host.
Nothing installs a package on another host, fires a blocking concern there and
records whether the action was refused. The levels worth keeping apart are
`configured`, `installed`, `observed` and `blocking`.

Nearest objects, both about delivery rather than refusal:
`stubs/road-to-instructions-loaded-observer.md`,
`later/road-to-delivery-on-hook-hosts.md`.

### 2. A capability row does not say which leg observed it

`src/scripts/_lib/host_capability.ts:238-254` records the structured-ask
reading for Claude Code — 48 calls, 47 with exactly one question — and notes in
prose that the earlier `false` came from a subagent leg. The row has no leg
field. `src/scripts/_lib/structured_ask.ts:60-66` documents that `free_text`
is derived by negation, while the row at `:84` is a bare `true`. Release
finding `4f8cc59e53f3` (16.3.0) carries no disposition.

## What would promote it

A recorded session on one non-Claude host, which settles item 1 for that host,
and a schema change that adds `leg: main | subagent` to the capability row with
an evidence grade in place of the bare boolean, which settles item 2 without
any host.

## What this stub does not do

It sets no target for how many hosts must refuse, and it does not touch
`host_lowering.yaml`.
