---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: road to the first true reference-analysis run

> **Stub — not active work.** Transferred out of
> [`road-to-distillation-followups.md`](../road-to-distillation-followups.md)
> Phase 2 on 2026-08-20 by the drain-run disposition framework
> [`drain-blocker-dispositions-b.md`](../../evidence/council/drain-blocker-dispositions-b.md)
> (disposition **B** — outcome `transferred`; council 2026-08-20, quorum 2/2,
> both seats convergent on B for this blocker).
>
> Phase 2 was never started, and not on effort. Two trust boundaries stack on
> it: the run performs **outbound fetches to a third party**, which is an
> externally visible act, and its output is **raw named evidence**, which
> `source-confidentiality` keeps local-only unless anonymised. Nothing here is
> half-shipped and nothing was rejected on merit.

## Transferred work — quoted as it stood

Phase 2 Step 1, verbatim from `road-to-distillation-followups.md` at the
transfer commit:

> - [ ] **Step 1: Run `/analyze:reference-repo` end to end under its own §5b
>       convergence contract** against a small reference, and land the evidence
>       artefact. Blocked — see `blocker: first-contract-true-analysis-run`.

Phase 2 falsifier, verbatim:

> **Falsifier.** The run shows the §5b contract cannot converge on a real
> reference (the verdict table never stops flipping within its four-pass cap) →
> the contract is wrong rather than untested, and this becomes a fix to the
> command instead of an evidence gap.

Phase 2 rollback, verbatim: "**Rollback.** One evidence artefact."

The falsifier is carried because it can **delete** this stub rather than only
complete it: a contested table at four passes is a finding about the contract,
not a missing artefact, and it turns the work into a command fix that needs no
external fetch at all.

## Resolved-when criterion, verbatim

From `blocker: first-contract-true-analysis-run`, unchanged:

> **Resolved when:** one evidence artefact exists that was produced by the
> command rather than by an ad-hoc pass.

And the blocker's `What to do`, verbatim, because it names both trust boundaries:

> **What to do:** run the command against a small reference and land the
> evidence artefact. Two things make this a maintainer call rather than an
> autonomous step: it spends on external fetches, and its output is raw named
> evidence, which `source-confidentiality` keeps local-only unless anonymised.

## Complete list of dependent steps moved

Everything the parent roadmap held for this blocker moves here. Nothing is left
behind in the parent, and nothing else is dragged in:

1. **Phase 2 Step 1** — the end-to-end command run under its own §5b
   convergence contract. The blocker's own `Blocks:` field reads "Phase 2 Step 1
   only", so the move is exactly one step wide.
2. **The authorized fetch run itself** — scope confirmation (§1), the anchor
   table (§1b), the reference-surface fetch (§2) within its 40-fetch ceiling,
   structured-fact extraction (§3), the interop probe (§3b), comparison (§4),
   classification (§5) and the §5b convergence passes.
3. **Local-only handling of the raw named evidence** it produces, per
   § Confidential-evidence handling below.
4. **Any anonymised publication** derived from that raw evidence — the tracked
   artefact, if one is published at all.
5. **Phase 2's falsifier and rollback**, quoted above, so the condition that
   would cancel rather than complete the work travels with it.

Deliberately **not** moved: the `/analyze:reference-repo` command itself, which
is shipped and unchanged, and the §5b contract text, which is the thing under
test rather than part of the test.

## Probe and re-entry producer

Promotion is not "when someone runs it". One named producer, three probes a
reader can run today, each returning a decidable answer. All three were measured
**failing** at `d6cc42e63`.

**Named re-entry producer:** the repository maintainer (`matze4u`, the sole
distinct reviewer over the trailing 90 days per the bus-factor transfer stub),
operating an approved outbound-fetch environment. No command in this repository
can produce the artefact, because no command in this repository is permitted to
spend on third-party fetches unattended.

| # | Precondition | Detection probe | Measured 2026-08-20 |
|---|---|---|---|
| P1 | A command-produced analysis artefact exists | `ls agents/evidence/analysis/compare-*.md` returns at least one path (the §6 target path; the slug rule is `<owner>-<repo>` lowercased) | **FAIL** — 0 files match |
| P2 | It was produced by the command, not by an ad-hoc pass | The same file carries **both** `## Anchor table` and `## Iteration record` — the two §6 sections an ad-hoc prose pass does not produce, the second being the §5b convergence trail with a recorded flip reason per pass | **FAIL** — 0 files under `agents/evidence/analysis/` carry `## Iteration record` |
| P3 | Its confidentiality is classified, not assumed | The artefact states, in its own text, either that it is anonymised (Source A / B / C plus `ENC1:` link tokens) or that the raw evidence is held local-only with the tracked file being the derived summary; and `./scripts-run src/scripts/check_no_external_sources` stays green with the artefact in the tree | **FAIL** — no artefact, so nothing to classify |

P2 is the probe that carries the blocker's actual wording. "One evidence
artefact exists" is satisfiable by any file; "produced by the command rather
than by an ad-hoc pass" is not, and the two §6-only sections are the cheapest
observable difference between the two. A reader who finds P1 passing and P2
failing has found an ad-hoc pass wearing the artefact's filename, which is the
exact substitution the original criterion was written to refuse.

None of the three is agent-buildable. P1 and P2 both require the outbound fetch;
P3 is a judgement about material that does not exist yet.

## Confidential-evidence handling when the run does happen

The run produces raw named evidence, and `source-confidentiality` governs where
that may live. The contract, so the maintainer does not have to re-derive it:

- **Raw named evidence stays local-only.** A clone dump, a full competitor
  audit, or a scraped comparison table that cannot be understood without the
  source names is gitignored — `agents/tmp/` or `agents/.harvest-local/` — and
  never tracked.
- **The tracked artefact is anonymised, not hidden.** Refer to the reference as
  "an external reference" or Source A / B / C. Never the repository, org, or
  author name. The findings are this package's own features and do not need the
  source name to be actionable.
- **A real link is retained encrypted, never in plaintext.** `ENC1:` tokens via
  `src/scripts/_lib/link_crypto.ts`, in a Provenance block — maintainer-
  recoverable, opaque in the tree.
- **`check_no_external_sources` is the backstop, not the control.** It fails the
  build on a denied source token in a tracked non-carve-out file. It is a
  deterministic net under the discipline above, not a substitute for it: a
  source name it does not happen to know passes.
- **The command's own safety floor still binds** — read-only on the reference,
  never execute it, no credentials in fetches, the 40-fetch ceiling, and no
  auto-commit. The artefact is a draft until the maintainer accepts it.

## Why this is not an effort question

The run is a single command invocation. What it is blocked on is an act this
repository cannot delegate to an agent: money leaving for a third-party fetch,
and a confidentiality classification on material nobody has seen yet. An agent
that ran it anyway would either spend unauthorised or commit raw named evidence,
and both are worse failures than an unmet acceptance criterion sitting in a stub
with a probe on it.
