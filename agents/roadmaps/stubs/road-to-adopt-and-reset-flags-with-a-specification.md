---
complexity: lightweight
review_by: 2027-01-18
probe: none
---

# Stub: `adopt` and `reset` have a routing and no behaviour

> **Stub — not active work.** Transferred on 2026-10-18 from step 3.4 of
> `road-to-an-ownership-record-that-belongs-to-the-user`, by AI council verdict
> (2/2, `anthropic` + `openai`, no split) recorded at
> `agents/evidence/council/ownership-record-residue-20261018.md`.

## What is settled

If either capability ships, it ships as a **flag on an existing command**, not
as a new top-level verb — ADR-041 governs the verb vocabulary and neither name
earns an ADR of its own. That routing is all the parent roadmap could close.

## What is not, and why an agent did not fill it in

Nothing in the tree says what either flag does. Both council seats held that
implementing them with semantics the implementing agent chooses is
owner-reserved under *cannot be bounded from available evidence*.

- **`adopt`** most plausibly means "record the bytes I have on disk as this
  package's version", which silences the preserve-and-sidecar path for that
  file. That is an explicit ownership assertion — the same assertion an earlier
  council round (`agents/evidence/council/ownership-unknown-arm-20261017.md`)
  declined to make automatically for a digest-less ledger path.
- **`reset`** most plausibly means "overwrite one named file with the packaged
  version", a `--force` scoped to a path. Whether it keeps a backup, whether it
  may touch a project-scope file, and which command it attaches to are all
  unspecified.

## Promotion criteria

Promote when a specification exists for each flag that names: the command it
attaches to; what it writes to the ownership ledger and the project manifest;
the safety check before any overwrite; the exit codes; and the acceptance tests,
including one that proves `adopt` never runs without an explicit path argument.
