# Loaded rule tokens — what is measurable today, measured (2026-08-10)

Roadmap: `road-to-feedback-9-29` Phase 3.2. Input for blocker `b-budget-rebase`
(re-anchoring `check_always_budget` from source-chars to delivered tokens).

## The honest scope statement first

A per-session p50/p95/max of *received* rule tokens is **not measurable from
transcripts**: the host records no `system` or `tools` field, so a session's own
payload is not recoverable after the fact — `conformance_scan`'s own output
states this ("A session's own payload is NOT recoverable"). What IS measurable
today is the **carrier-level delivered payload as the filesystem projects it
now**, per layer, plus the divergence between layers. The p50/p95 distribution
becomes measurable only once InstructionsLoaded records accumulate (the same
instrument the scoped-rule absence pre-registration uses).

## Measured — this host, 2026-08-10

Instrument A — `./scripts-run src/scripts/conformance_scan` (chars/4 proxy):

| Carrier | Rules | Tokens |
|---|---|---|
| project `.claude/rules/` | 110 | 84,558 |
| global `~/.claude/rules/` | 114 | 106,316 |
| union (what a session on this host receives) | — | 190,873 |

Instrument B — `./scripts-run src/scripts/check_standing_rule_delivery`
(tokens_gpt exact via tiktoken cl100k_base; tokens_claude chars/3.6 proxy):

| Carrier | Files | Tokens |
|---|---|---|
| global | 114 | 104,973 |
| project | 110 | 81,563 |
| **total vs cap** | — | **186,536 / 110,000 (169.6%) — gate red** |

> **The project figure moves with the working tree, so pin it when you cite it.**
> An earlier run in the same session read 81,463 / 186,436 — 100 tokens lower —
> because the project carrier is generated from `src/` and this branch then added
> an Iron-Law block to `preservation-guard`. Both readings are correct for their
> tree state; neither is a series point without a SHA. Cite this table only with
> the commit it was measured at, on a clean tree.

- Overlap: **109 rules present in both layers — 0 byte-identical duplicates,
  109 divergent** (the global copies have drifted against the project layer).
  This is the double-delivery defect class the 9.28 rule-delivery-integrity
  work measures; the fix on a maintainer machine is
  `agent-config install --layer=<global|project>` (suppression, not deletion) —
  tracked as blocker `b-machine-dedup` in the roadmap.
  > **CORRECTION 2026-08-10 — "divergent" here means metadata, not drifted text.**
  > All 109 pairs were re-measured at commit `a5b2f4cb7` and carry **byte-identical
  > prose**; the whole difference is the frontmatter block, which the host does not
  > deliver. So the double-delivery is real (both copies reach the model) and the
  > *drift* is not: no governed text differs and nothing is binding-ambiguous.
  > Read this line as a duplication figure only, never as a correctness finding.
  > Classification, the cited precedence answer, and why a stale symlinked
  > projection classifies the same commit as 91/90-stamp-only instead:
  > [`carrier-layer-divergence-classification.md`](carrier-layer-divergence-classification.md).
- Reference point: the external auditor measured 176,354 union tokens on
  2026-08-09 on the same machine class; today's readings are 190,873 (proxy A)
  / 186,536 (proxy B). The carriers moved between measurements (9.29.0 merge);
  the numbers are one-reading series points, not a trend claim.
- The two instruments disagree by ~2.3% on the same tree — expected, they use
  different token proxies; both are recorded so the series stays interpretable.

## What the budget-rebase decision needs before it can be made

1. InstructionsLoaded records from ≥ 2 real sessions per host class (the
   absence pre-registration's instrument; zero records = instrument failure,
   never evidence).
2. The per-host p50/p95 computed from those records, not from the filesystem.
3. The token-baseline re-anchor discipline applies (growth cliff at 5%;
   verify your share by moving the files out — recorded maintainer memory).

Command series to accumulate the data:

```bash
./scripts-run src/scripts/conformance_scan          # appends one series line
./scripts-run src/scripts/check_standing_rule_delivery
```

No gate change happens on this artefact alone — `b-budget-rebase` is the
decision surface; a new gate basis needs a measured false-positive rate first
(locked policy).
