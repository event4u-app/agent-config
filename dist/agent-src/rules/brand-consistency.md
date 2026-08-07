---
type: "manual"
tier: "2a"
description: "Merged into brand-source-of-truth (2026-08-04) — every emitted colour/type/spacing/voice choice traces to a brand token or voice rule"
alwaysApply: false
applies_to_user_types:
  - "creator"
  - "developer"
  - "maintainer"
self_contained: true
workspaces: [engineering]
packs: [brand]
# obligation: "Body merged into `brand-source-of-truth` § Iron Law 2" — src/rules/brand-consistency.md:20
obligation_frequency: "none"
---

# Brand Consistency

**Iron Law.** Every emitted colour, type, spacing, and voice choice traces to a
brand token or a voice rule — a value that traces to neither is off-brand.

Body merged into [`brand-source-of-truth`](brand-source-of-truth.md) § Iron
Law 2 (rule hygiene, 2026-08-04): the two rules shared triggers (`brand
tokens`, `brand voice`) and one subject — the consumer brand as the run's
authority. This file stays as a pointer so inbound references keep resolving;
it is `type: manual` (reference-only, no router emission).
