<!-- evidence-type: analysis -->
# `test_authorship` — the distribution, and the window is empty

**Measured:** 2026-08-22 · **Source:** `agents/runtime/state/subagent-ledger/*.jsonl` (gitignored, machine-local)

## The distribution

| value | count |
|---|---|
| `from-spec` | 0 |
| `from-diff` | 0 |
| `unknown` | 0 |
| **rows in window** | **0** |

**Zero rows, not zero `from-spec`.** The field shipped in the same change as
this report, and the ledger on this machine is empty — it is gitignored, so a
fresh checkout starts at zero by construction. Nothing has been observed.

## Why the empty window is reported rather than skipped

Phase 3.2's own wording anticipates the outcome that *everything is `unknown`*
and calls it "the finding that the field is not reaching its producers". An
empty window is one step earlier and is a **different** statement: nothing has
been produced at all.

Three answers, and a counter that printed one number would collapse them:

* **no rows** — nothing observed yet; come back after dispatches have run.
* **all `unknown`** — dispatches ran and no producer sets the field. *That* is a
  wiring finding.
* **a mix** — the metric is live and the question the roadmap asked is finally
  answerable.

Reporting "0 `from-spec`" without the denominator would read as the third
outcome's worst case, when it is the first.

## What the field can and cannot tell a later reader

**Can:** how often tests in a change were authored from the spec, once producers
set it. That is the standing metric the roadmap's Phase 3 exists to leave behind
— the artefact that lets the independence question be re-opened with data rather
than a fresh archaeology pass.

**Cannot:** whether the tests were any *good*. `from-spec` records provenance,
not quality. `judge-test-coverage` remains the only grader, unforked — a grader
introduced alongside the mechanism it grades cannot measure it.

**Also cannot:** answer the independence claim by itself. It records what
happened; it does not run the controlled comparison the pre-registration
specifies. That comparison is `unmeasurable-here` for a separate reason
(`agents/evidence/analysis/test-independence-unmeasurable.md`).

## Rerun condition

After any period in which subagent dispatches ran. The distribution is a
`Counter` over the `test_authorship` key of every ledger row, with an absent key
counted as `unknown` per `resolveTestAuthorship`.
