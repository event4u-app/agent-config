# "What you get" — prevented-failure-mode table (adoption input)

> Filed by the road-to-enforcement-peer-disposition roadmap as INPUT to the
> adoption roadmap's exhibit set (differentiator page
> `docs/us-vs-the-category.md` + `docs/comparison.yaml`, both bound to
> `docs/CLAIMS.md`). Format rule from the intake: **every row names a
> PREVENTED FAILURE MODE, not a feature; every cell is backed by a
> resolving ledger entry** (claim id in `docs/CLAIMS.md`). Rows without a
> ledger entry are listed as candidates below the table, never inside it.

## The table

| Prevented failure mode | How it is prevented | Ledger entry (resolves in `docs/CLAIMS.md`) |
|---|---|---|
| A poisoned artifact ships to consumers (hidden-Unicode / confusable / instruction-smuggling payload in a rules file) | Machine scan over source AND the condensed projection; a finding blocks the release before `npm publish` | `claim: shipped-artifacts-hidden-instruction-scanned` (`exec:lint_agent_security -> 0`) |
| Enforcement theater — a rule claims a gate that never actually runs | Resolution-over-declaration coverage: a `validator:` counts only when a CI workflow reaches it; `fail_closed: false` resolves to `observer`; ratcheted so coverage cannot silently fall | `claim: enforcement-coverage-resolved` (`exec:check_enforcement_coverage --check -> 0`) — the post-hardening line "14 of 107 rules have a mechanical backstop, and the claim itself re-runs in CI" is claimable from this entry |
| Uninstall wrecks a neighbour tool's shared host config | Surgical removal — own keys only, matched by JSON-pointer + SHA-256 | `claim: surgical-uninstall` |
| A background daemon the adopter never asked for | File-first boundary: the whole layer compiles into host agents, zero runtime daemon | `claim: no-runtime-daemon` |
| A weak-host agent freelances past scope/downstream obligations | Placebo-controlled, measured discipline lift on weak hosts (and the honest strong-host null published alongside) | `claim: discipline-lift-weak-host` |
| A stale artifact keeps a public claim "backed" forever | `exec:` evidence re-derives the claim in CI; the denominator itself is drift-checked after it was caught drifting twice | `claim: ledger-exec-verifiability` |

## Candidate rows — real mechanisms, no ledger entry yet (kept OUT of the table by the format rule)

- **Silent rewrite of append-only memory intake** — `check_memory
  --append-only` is now CI-wired (this roadmap closed the fail-open).
  Becomes a row when a ledger entry exists; the natural form is
  `exec:check_memory --append-only -> 0`, which requires an argv-prefix
  allowlist addition in `src/scripts/_lib/exec_evidence.ts` — a claims-
  surface change owned by the claims flow, not this filing.
- **Direct writes bypassing the governed-write layer on ledger surfaces** —
  the governed-writes lint (this roadmap). Same path to a row: allowlist +
  ledger entry once the lint has CI history.

## How the adoption work consumes this

Rows are ready to merge into `docs/comparison.yaml` / the differentiator
page under that surface's own rules (single-sourced on the proof page,
category column only publicly-observable facts, no named competitor). No
cell here introduces a number the ledger does not already carry.
