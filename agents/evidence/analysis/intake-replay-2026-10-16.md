<!-- evidence-type: analysis -->

# Intake replay — three rounds against the owner-search rule

For `road-to-an-intake-the-queue-can-carry` step 6.1. A report, not a gate.
Read at the branch that lands Phase 2 (base `origin/main@fe7a22c6d`),
2026-10-16.

## What was replayed, and what was not

The three most recent consumed rounds in `agents/tmp.old/` other than this
roadmap's own (`inbox-2026-10-q`): `inbox-2026-10-r`, `-s`, `-t`. The replay
is **structural**, not a re-run of `/analyze:inbox`: for every roadmap under
`agents/roadmaps/{*,later,stubs,archive}` that names a round, it records
whether the round created the file (the round in its `Source:` header) or
landed on it (an `Arrivals:` line or a note), and applies the Phase 2
predicate `quotesOwnerSearch` to the exemption of each created file. It does
not re-derive the rounds' findings from their source files, and it does not
re-run any search an exemption quotes. Producing script: a scratch reader over
`exemptionReason` + `quotesOwnerSearch`; not committed, because it is a
one-time reading.

Below, owner-less findings means: a created file whose exemption quotes an
empty owner search in the one-clause form. A file whose exemption quotes no
such search is counted separately as **unverified** — the rule cannot say
whether it had an owner.

## Per round

| Round | New top-level files | Owner-less findings (quoted empty search) | Unverified | Landed on an existing owner |
|---|---:|---:|---:|---:|
| `inbox-2026-10-r` | 1 | 1 | 0 | 2 (`later/road-to-worker-generation-recycling`, `stubs/road-to-a-lineage-gate-that-sees-the-folder`) |
| `inbox-2026-10-s` | 3 | 2 | 1 (`road-to-agent-throughput-recovery`) | 3 (`later/road-to-voice-negative-lexicon`, `stubs/road-to-instructions-loaded-observer`, `stubs/road-to-language-pin-short-lead`) |
| `inbox-2026-10-t` | 8 | 7 | 1 (`road-to-an-ownership-record-that-belongs-to-the-user`) | 6 stubs |

## Reading

- **`-r` meets AC-6**: one new file, one owner-less finding, two arrivals.
- **`-s` does not, on its own evidence**: the unverified file declares
  `depends` on two active roadmaps (`road-to-a-setup-that-decides-itself`,
  `road-to-an-installed-layer-that-is-thinned`), so candidate owners existed
  and the exemption names no search that set them aside.
- **`-t` is the case the rule cannot see.** Seven of its eight files quote an
  empty search, and each search was true when run: the siblings did not exist
  yet. Five of the eight then declare `extends` on another file the same round
  created (`ownership-record` → `uninstall`, `gates-that-run`;
  `uninstall` → `gates-that-run`; `gates-that-run` → `uninstall`,
  `ownership-record`; `distribution-ledger` → `truthful-surfaces`;
  `release` → `update`). A search before writing finds no owner for any of
  them; whether some of the eight are one subject is a question the round's
  own `extends` graph raises and this predicate does not answer. Recorded as a
  gap, not a verdict.
- **Arrivals already happen** — 11 across the three rounds on files the round
  did not create, every one on a `later/` or `stubs/` file: the case the
  Phase 5 stub row of `/analyze:inbox` already covered. None landed on an
  active top-level file, which is the case Phase 2 adds.

## For step 6.2

The baseline these three rounds give: new top-level files per round 1 / 3 / 8,
share of findings landed as arrivals 2/3, 3/6, 6/14 (arrivals over
arrivals plus new files). The report-only warning of step 2.1 starts counting on the first round after it
merges; 6.2 reads four weeks of rounds against this table.
