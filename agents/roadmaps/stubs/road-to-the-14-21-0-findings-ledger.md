---
complexity: lightweight
review_by: 2026-12-07
---

# Stub: road to ingesting the 14.21.0 self-review findings

> **Arrivals:** 3 (at least) - latest `inbox-2026-09-w` (2026-09-11). Counted as
> distinct prior round directories under the consumed-inbox tree, which is gitignored -
> so the count is machine-local and the ordering is the finding, not the exact figure.
> Read `(at least)` strictly: a broad keyword sweep returns a larger set that includes
> incidental mentions, so this is the subject-matched floor.

> **Stub — not active work.** Found 2026-09-07 while settling CI on an unrelated
> delivery-layer branch. `Consistency` reds with
> `14.21.0 has shipped and carries no findings ledger at
> agents/evidence/release-findings/14.21.0.json` <!-- ref-ignore -->
> (`check_finding_dispositions.ts:425`). The same job is already `failure` on
> `main` at `2c75232f`, so this is inherited rather than introduced — recorded
> here rather than repaired drive-by, for the reason in § Why not fixed in place.

## What is different about this one

The four preceding nulls (14.17.0 – 14.20.0) all recorded the same cause: the
self-review gate went NEUTRAL on an over-budget prompt and produced nothing to
ingest. The 14.20.0 ledger predicted `14.21.0 reproduces this too unless the gate
chunks or scopes the diff`.

**That prediction is refuted, and the refutation is the finding.** Measured:

- `Self-review gate` on `release/14.21.0` — run `34130214783` — concluded
  **success**, not neutral.
- PR **#1913** (merged 2026-09-07T14:07:43Z) carries a `release-findings-json`
  machine block.
- The block holds **39 findings**: 3 `critical`, 14 `high`, 15 `medium`,
  7 `low`. Three name security surfaces by file — an unbounded HTTP timeout in
  `ai_council/api_transport.ts`, decrypted reference URLs reaching the transcript
  before redaction, and archive-URL ingestion bypassing repository identity
  validation.

So the gate worked for the first time in five releases, produced a real finding
set, and the set was never ingested. The ledger is missing because the ingest
step did not run — a different defect from the four nulls, and one the existing
prose would otherwise absorb as "the fifth consecutive null".

## It recurred at 14.22.0 — recorded 2026-09-08 by the R2 remediation lane

`14.22.0` is tagged, `agents/evidence/release-findings/14.22.0.json` <!-- ref-ignore -->
does not exist on `origin/main`, and `check_finding_dispositions` therefore reds with the same
sentence one version later:

```
14.22.0 has shipped and carries no findings ledger at
agents/evidence/release-findings/14.22.0.json
```

**The prediction in § What is different about this one holds a second time, and
sharpens.** The gate did not go neutral: PR **#1943** (`release: 14.22.0`, merged
2026-09-08T10:31:34Z) carries a `release-findings-json` machine block with **56
findings** — 3 `critical`, 12 `high`, 27 `medium`, 14 `low`; by kind 8 `security`,
12 `claim`, 27 `correctness`, 9 `style`. **11 of them are blocking** under
`check_finding_dispositions.isBlocking` (security/claim × critical/high), and the
three criticals are:

| Severity | Kind | Title | File |
|---|---|---|---|
| critical | security | Self-review gate has reviewed nothing for four consecutive releases | `agents/evidence/release-findings/14.21.0.json` <!-- ref-ignore --> |
| critical | security | ADR-262 deletes `status: carrier` without migrating enforcement | `docs/decisions/ADR-262-carrier-status-deleted-no-repo-authored-human-gate.md` |
| critical | security | Vendored grammars added without supply-chain verification surface | `src/vendor/grammars/` |

So the review ran, produced a real finding set naming its own prior silence as a
critical, and the set was again never ingested. **Two consecutive releases now, same
mechanism: the gate succeeds and the ingest step does not run.** That makes it a
process defect in the release flow rather than a per-release omission, and it is why
this section extends this stub instead of creating a second one.

Reproduce the block:

```bash
gh pr view 1943 --json comments --jq '.comments[].body' \
  | grep -o '<!-- release-findings-json: .* -->'
```

**Not ingested here, deliberately.** `--ingest` merges findings with an EMPTY
disposition, so the gate stays red until a human writes 11 blocking dispositions —
and writing another release's dispositions is not something an unrelated
remediation lane may do. The lane that found this was dispositioning the R2 review
of PR #1923; it reports the red as inherited and leaves it tracked here.

## Why not fixed in place

Writing the ledger means **dispositioning 39 findings**, three of them critical
security items, against a release this session did not produce and has not
reviewed. A fast disposition would be a fabricated one, which is the failure
`evaluator-independence` exists to stop, and a null reason would assert the
opposite of what run `34130214783` measured.

## What closes this

1. Ingest the machine block from PR #1913 into
   `agents/evidence/release-findings/14.21.0.json` <!-- ref-ignore --> (schema:
   the 14.20.0 file).
2. Disposition each finding — accept / defer / refute — with the three
   `critical` security items reaching a human before any of them is deferred.
3. Re-run `check_finding_dispositions`; `Consistency` goes green on `main` and on
   every branch inheriting it.
4. Correct the 14.20.0 ledger's carried prediction: it named the right outcome
   for the wrong reason, and its mechanism claim ("unless the gate chunks or
   scopes the diff") is the half that did not survive — the gate did chunk, and
   the ingest is what failed.

## Evidence

- Run `34130214783` (`Self-review gate`, `release/14.21.0`, success).
- PR #1913, `release-findings-json` comment block, 39 entries.
- `gh run list --branch main` at `2c75232f`: `Consistency` = `failure`.
- `agents/evidence/release-findings/14.20.0.json` — the prediction this refutes.
