---
complexity: lightweight
review_by: 2027-01-24
---

# Stub: confirm the lineage backfill drafts

> **Stub — not active work.** Created 2026-10-24 by `road-to-a-graph-that-follows-you`
> (step 9.4). It is a stub because confirming a provenance row is the owner's
> judgement, not agent work: a draft row the agent confirmed itself would be the
> fabricated provenance that roadmap's Risk Register ranks fourth.

## Scope

Run `code-graph lineage backfill --draft` on the maintainer's machine, read the
drafts in `agents/.harvest-local/lineage-backfill/`, and confirm or drop them batch
by batch. Each confirmed draft becomes one source-free decision row in
`provenance/mechanisms.jsonl` plus one local edge, with its sealed pin, in the
user-global `runtime/lineage/edges.jsonl` (council O5 keeps the source side off the
tree); an unclear draft stays out.

## Trigger

Step 9.4 of `road-to-a-graph-that-follows-you` merged.

## Kill criteria

- The draft yield is so low that confirming is slower than writing rows by hand
  when a source is next harvested — then delete this stub and let new harvests
  carry their rows.
