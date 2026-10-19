<!-- evidence-type: analysis -->

# Six consumer-facing claims with the wrong evidence, put to the council

**Date:** 2026-10-19 · **Members:** `anthropic`, `openai`
**Mode:** prompt, 2 rounds, blind chairman · **Cost:** $0.00 (subscription transport)
**Quorum:** 2/2 present, concluded

Three earlier passes over `road-to-gates-that-run-where-the-consumer-stands`
step 4.1 left six consumer-facing ledger rows whose evidence ran in this
repository rather than where the consumer stands, and called the residue
owner-gated: two of the available fixes were a downgrade of a published claim,
the third a test seam in shipped code. That classification had never been put
to the council with the owner-reserved table attached. This round did, and
required each option to open with `DECIDE` or `ESCALATE`.

## What was asked

Six options over three groups of rows, routed separately:

| Option | Rows | Anthropic | OpenAI |
|---|---|---|---|
| A — a new `measured-in-repo` status for finished in-repo readings | the four bench and fixture rows | DECIDE, take | DECIDE, take |
| B — mark those four `unbacked` | the four bench and fixture rows | DECIDE, reject | DECIDE, reject |
| C — audit a packed install instead of the repository lockfile | `install-audit-clean` | DECIDE, take as release plus scheduled check, not a PR gate | DECIDE, take as pre-release candidate plus post-publish check |
| D — narrow the claim, or mark it `unbacked` | `install-audit-clean` | DECIDE, reject | DECIDE, reject as primary; `unbacked` as the interim until C exists |
| E — a transport seam in shipped code | `council-fallback-loses-zero-seats` | DECIDE, reject; drive the installed copy instead | DECIDE, take, but first try substituting the transport at a process boundary |
| F — leave the unit-suite `exec:` | `council-fallback-loses-zero-seats` | DECIDE, reject | DECIDE, reject |

No option was escalated. The reasons both seats gave for that: none of the six
rows carries a public `<!-- claim:id -->` marker, so no option moves public
copy; a status change is reversible; and the new status changes evidence
classification, not authority, quorum or the reserved set.

## Conditions both seats attached

- `measured-in-repo` is acceptable only with enforced fields — what the reading
  was measured on, a resolving report pointer, and the consumer-side evidence
  that would promote the row — excluded from the `backed` count and barred from
  public markers. Without them it is the dumping ground the ledger warns about.
- The packed-install audit must not gate every PR: registry availability and a
  newly published advisory would turn unrelated PRs red. OpenAI added that a
  candidate-tarball install and the published artefact answer different
  questions, and that an advisory finding must be told apart from a registry or
  network failure.

## What landed

- The four bench and fixture rows are `measured-in-repo`, each with
  `measured_on` and `promotion_evidence`, enforced by `check_claims`.
- `council-fallback-loses-zero-seats` is backed by
  `tests/install/council_fallback_installed_copy_real_install.test.ts`, which
  substitutes `claude`, `codex` and `curl` on `PATH` around a packed, installed
  copy. The process boundary was crossable, so the seam OpenAI conditioned E on
  was not needed and anthropic's middle path is what shipped.
- `install-audit-clean` is `unbacked`, per OpenAI's interim, with option C named
  on the row as what binds it. C is not built here: it is a workflow change and
  a network-dependent check, and both seats wanted it off the per-PR path.
