---
complexity: lightweight
review_by: 2027-02-05
blocker_class: product
---

# Stub: road to suggesting `permissions.deny` for never-used foreign tools

> **Stub — not active work.** Holds one blocker carried out of
> [`road-to-neighbours-that-pull-their-weight-carried`](../archive/road-to-neighbours-that-pull-their-weight-carried.md)
> step 3.4 by the AI council (2026-10-08, claude-sonnet-4-5 + codex, 2/2
> concluded) so the item is not lost when that roadmap archives. This is an
> **org-mode stub**: the work is buildable today and the open question is
> whether it should be built — the opposite of a capability gap.

## The transfer

**Outcome state:** transferred. The decision is unmade; nothing here is
implemented.

**Original item, verbatim from the carried roadmap's step 3.4:**

> **3.4 Suggest `permissions.deny` for never-used foreign tools.** Deferred:
> writing a consumer's permission block is Class C and a product decision
> (K15).

**Dependent steps moved:** none — step 3.4 carried no sub-steps of its own.

## The open question — K15

Whether this package should ever author or suggest entries for a consumer's
`permissions.deny` block, targeting foreign (non-this-package) tools the
consumer's own usage telemetry shows as never invoked. Writing a consumer's
permission configuration is a Class C surface: it changes what the
consumer's own tools are allowed to do, which is the consumer's call, not
this package's to make on their behalf.

**Decision authority:** owner (product-owned, Class C). Not agent-decidable,
not council-decidable — the council's 2026-10-08 verdict only routed this
item here; it did not and could not answer K15 itself.

## Named producer and detection probe

**Producer:** whichever future change implements a suggestion mechanism for
unused-foreign-tool permission entries, once K15 is answered `yes`.

**Probe:** has the owner answered K15 — yes or no?

```bash
grep -rn 'K15' agents/decisions/ agents/roadmaps/ 2>/dev/null
```

**Baseline on the transfer date (2026-10-08):** no match outside this stub
and the now-archived carried roadmap — K15 is unanswered.

## What promotion looks like

Promotion is the owner answering K15. On `yes`: a new roadmap (or an
extension of an existing one that already walks foreign-tool usage
telemetry) implements the suggestion mechanism, and this stub is deleted.
On `no`: this stub is deleted with the `no` recorded in
`agents/decisions/` or in the closing roadmap's `## Decisions` table —
a `no` is a disposition, not an abandonment.

## What this stub does NOT cover

- **Which never-used-tool signal to key the suggestion on.** That is an
  implementation detail of the eventual producer, not decided here.
- **Any other `permissions.deny` authoring surface.** This stub is scoped to
  the never-used-foreign-tool case named in the carried step; a broader
  permissions-suggestion feature is a separate question.
