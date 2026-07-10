# Currentness, Research-Routing & Source-Quality Contract

Phase 3 of `road-to-frontier-quality-operating-system` (pilot slice per
`quality-metrics.md` § 5). Planning contract for `FQ-01` (currentness),
`FQ-02` (tool priority), `FQ-03` (research-mode) in
[`mechanism-matrix.md`](mechanism-matrix.md). Governs the follow-up
**implementation** roadmap; ships no src rule itself.

## Currentness-risk classification (FQ-01 → follow-up auto-rule)

A question is **currentness-risk** when the answer could have changed since
training and staleness matters:

- fast-changing facts; current office holders ("is X still CEO");
- product / version / release questions ("latest model", "current price");
- a specific URL the user names;
- an unfamiliar named entity (tool, package, product, person);
- laws / policies / regulations ("does this still apply");
- prices / sports / weather / finance;
- high-stakes recommendations where spend/time risk is meaningful.

**Existing coverage:** `direct-answers` Iron-Law-2 already carries the
volatile-fact freshness split (fresh-lookup vs stable) in
`asking-and-brevity-examples`. The follow-up rule TIGHTENS it into a named
trigger set with negative examples (stable math/CS fact, pinned-lockfile
version → no lookup), not a new floor.

## Tool priority (FQ-02 → follow-up contract)

```
INTERNAL/PROJECT CONNECTORS FIRST FOR "MY/OUR" DATA.
OFFICIAL / PRIMARY SOURCES FIRST FOR EXTERNAL CLAIMS.
A USER-PROVIDED URL IS FETCHED DIRECTLY.
ORDINARY WEB SEARCH ONLY AFTER THE MORE SPECIFIC PATH IS EXHAUSTED.
```

Aligns with the `surface-agent-contracts` tool-composition + connector-first
rows (FQ-08 covered) and `spreadsheet-source-quality` for financial data.

### Tool-composition table (pilot)

| Need | First choice | Then | Degrade (tool absent / restricted net) |
|---|---|---|---|
| "my/our" data | project/repo files, connected app | — | say the data source is unreachable; do not web-guess |
| external factual claim | official/primary source | web search | state it is unverified; cite what was reachable |
| a named URL | fetch that URL | — | report the fetch failure plainly (no fabricated content) |
| broad/open research | deep research (`research:deep`) | web search | scope to what was retrieved |
| stable knowledge | no lookup | — | — |

## Research-mode routing (FQ-03 — COVERED)

Covered by `research:deep` / `research:report` + the execution-discipline
harvest (disconfirmation search + per-part grounding). The one addition the
follow-up encodes: launch deep research **immediately** for a clear research
ask; ask at most **three** clarifying questions, and only when the answer would
materially change the research direction.

## Pilot evals (Phase 2 arms)

Run the `eval-harness.md` FQ-01/FQ-02 arms on the ambiguous cases: "is X still
CEO", "latest model", "does this law still apply", "what did we decide in the
project" (→ internal/chat store, FQ-06), "summarize this URL". Pass = the lookup
happens; **no "knowledge-cutoff apology" substitutes for doing the lookup**.

## Disposition

FQ-01 + FQ-02 → follow-up implementation roadmap (tighten `direct-answers`
freshness into a currentness trigger-rule + a tool-priority contract). FQ-03 →
already covered. No src change here (Phase-0 execution contract).
