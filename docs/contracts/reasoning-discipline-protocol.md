---
stability: beta
keep-beta-until: 2026-09-14
---

# Reasoning Discipline Protocol (RDP) — User Contract

> **Status:** beta · **Owner:** package maintainer · **Last reviewed:** 2026-06-16
>
> The one-screen, user-facing contract for the `reasoning.*` settings. It says
> what RDP does, when it engages, and how to switch it off. The sourced design
> rationale lives in the dossier
> [`docs/guidelines/agent-infra/frontier-reasoning-operating-profile.md`](../guidelines/agent-infra/frontier-reasoning-operating-profile.md);
> the runtime cost-gate mechanic lives in
> [`contexts/execution/rdp-gate.md`](../../src/agent-src/contexts/execution/rdp-gate.md). <!-- ref-ignore -->
> This file is the entry point; depth stays there.

## What RDP does

RDP transplants the **operating discipline** of a frontier reasoning model onto
whatever host model you run — the steps a strong model takes on its own that a
weaker one skips unless prompted. When engaged, it nudges the agent toward:

- **notes-first** — keeping multi-hypothesis reasoning, predictions, and
  decisions in the session notes rather than the response;
- **complexity-first** — resolving the load-bearing unknown before writing code;
- **verifier** — a fresh-context check on structurally risky work
  (branching · multiple constraints · stateful · irreversible);
- **orchestrator** — a single coordination point that sequences the chain.

These are disciplines the agent *applies*, not guarantees it *enforces*: how much
of each applies is decided by the gate below, and a strong-reasoning host may
apply them lightly or skip them where they would not pay.

```
CAPABILITY DOES NOT TRANSFER. DISCIPLINE DOES.
```

RDP makes the agent **work** more like a frontier model on under-specified and
long-horizon tasks. It does **not** make a weaker model as *capable* as one — no
prompt closes the weights gap.

## When it engages

RDP never runs on every turn. It engages only where it pays, decided by three
**table-free** signals (there is no runtime model→band lookup — ADR-035):

1. **Settings** — your `reasoning:` block (below). `enabled: false` stops here.
2. **Task signal** — skips trivial / short / fully-specified tasks (rename, typo,
   one-line edit, list files); engages on complex / ambiguous / multi-component /
   long-horizon / stateful / irreversible work.
3. **Host self-assessment** — a strong-reasoning host applies the discipline
   **lightly / as a suggestion**; a standard host applies it **fully**. The agent
   introspects; no maintained model list exists.

The verifier carries its own stricter gate — it fires only on genuinely risky,
non-trivial work, so the most expensive component stays rare. The exact
condition lives in the gate context (it may evolve; this contract does not pin
it).

## How to turn it off

All switches live in the `reasoning:` block of `.agent-settings.yml` (repo root;
full schema in [`docs/customization.md`](../customization.md) § Available
settings):

| Goal | Setting |
|---|---|
| Disable the whole layer (zero overhead) | `reasoning.enabled: false` |
| Keep the layer, drop the host self-assessment | `reasoning.auto_gate: false` (gate on task-signal + toggles only) |
| Disable one behaviour | `reasoning.components.<name>: false` (e.g. `verifier_default`) |

A component fires only when `reasoning.enabled` is `true` **and** the `auto_gate`
test passes.

## Why it is not a Fable / Mythos copy

A frontier model's edge lives in its weights, which no prompt copies — so RDP
copies the *discipline*, never the model. It ships **one** constraint-light
scaffold with no "heavy" variant (two variants would be a hidden model→band
table, forbidden by ADR-035); a host that wants more asks at turn time. The
sourced evidence — including why over-prescription degrades a strong host — is in
the dossier.
