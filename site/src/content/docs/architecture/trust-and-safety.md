---
title: Trust & Safety
description: The trust enum, the human-review banner, and per-pack safety floors.
---

Every artifact is stamped with trust metadata and gated accordingly.

## The trust enum

| Field | Values | Meaning |
|---|---|---|
| `trust.level` | `core` · `professional` · `advisory` · `restricted` · `experimental` | How much scrutiny the artifact needs |
| `trust.confidence` | `high` · `medium` · `low` | Informational self-assessment |
| `trust.human_review_required` | `true` / `false` | Gates the artifact behind a human-review banner |

Four consumers enforce these: the installer surfaces trust counts and confirms
before installing any `advisory`/`restricted` pack; the condenser injects
banners; the runtime gates human-review-required artifacts; and a coherence lint
catches drift.

## The human-review banner

Any artifact declaring `trust.human_review_required: true` gets a parser-stable
banner prepended at condense time:

```text
> HUMAN REVIEW REQUIRED · trust: <level> · owner: <domain>
```

## Domain safety floors

Every pack that ships advisory/restricted content also ships at least one
`*-safety-floor` rule — e.g. `engineering-safety-floor` (universal),
`finance-safety-floor`, `strategy-safety-floor`, `legal-safety-floor`. Each names
what the agent must **not** issue (a final investment call, binding legal advice,
a single-path verdict) and what it must surface instead.

Trust gates **artifacts, not users** — there is no runtime per-action
authorization. See
[`trust-and-safety.md`](https://github.com/event4u-app/agent-config/blob/main/docs/contracts/trust-and-safety.md).
