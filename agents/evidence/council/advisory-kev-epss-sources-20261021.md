<!-- evidence-type: analysis -->

# Council — may the advisory refresh read CISA KEV and FIRST EPSS? (2026-10-21, round 3)

AI council, `anthropic` + `openai`, CLI seats, one round, 2/2 present after the
run, $0.00. Question: `advisory-kev-epss-sources-20261021.question.md` beside
this file. Opened by finding 3 of the R2 completion review, round 2: the KEV
tier branch was unreachable and EPSS absent.

## Verdict: `revise` (2/2) — KEV yes, EPSS no

| Q | Verdict |
|---|---|
| Q1 | (b) both seats — adopt KEV only. The catalog is downloaded whole and matched locally, so nothing about the project leaves the machine, and it makes the promised known-exploited T0 real. |
| Q2 | own opt-in, both seats — the CVE IDs are public one by one, but the SET a project sends is its vulnerability profile; `advisories.egress: query` does not communicate that disclosure. |
| Q3 | none, both seats — no automatic EPSS promotion: it would make T0 mean both "known exploited" and "predicted", and 0.1 has no backtest behind it. EPSS, if ever, starts as display-only metadata. |

## Conditions on KEV, and where each landed

| Condition | Landed |
|---|---|
| Typed enrichment, not a finding source — failure never creates or drops a finding | `kevEnrich` in `advisory_sources.ts`; its report never becomes an `unknown` finding |
| Explicit cache and failure semantics: a fetch failure uses the last catalog while it is at most 7 days old, and says so; older is no KEV data at all, also said | `kevEnrich` + the `kev-stale` / `kev-unavailable` report reasons |
| Its own switch, independent of the other sources | `advisories.kev` (class C, `policy`, default `on`) |
| Provenance in the output: a T0 from KEV says so | `describe()` appends `known exploited (KEV)` |
| Same egress gate | runs only where `advisories.egress` is `query` |

## Recorded, not built

- **EPSS** — not adopted. The roadmap's "EPSS raises a tier" clause is
  withdrawn by this round, not deferred: a later adoption needs its own opt-in
  key, display-only first, and a backtest that defines the acceptable
  false-escalation rate (both seats' "evidence that would change my mind").
