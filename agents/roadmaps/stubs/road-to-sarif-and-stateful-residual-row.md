---
complexity: lightweight
review_by: 2026-09-25
probe: none
---

# Stub — SARIF upload, the stateful residual row, and worst-family null gating

> **Class:** drain-run transfer. Not active work. Promoted per item by its own
> named probe, never by the shared promotion criteria in
> [`README.md`](README.md).
>
> **Parent:** a `status: draft` proposal for perturbation-family assurance and
> review independence, landed by the `/analyze:inbox` run of 2026-08-24 and
> **not** carried into the estate. Parent outcome state: **transferred**.
>
> **Source:** agents/tmp.old/godmod3/road-to-perturbation-family-assurance-and-review-independence.md

> **Arrivals:** 2 — latest `inbox-2026-09-o` (2026-09-05); earlier: the round of 2026-08-24 that created this stub.

## Why the parent did not land

Roughly 85 percent of the parent draft was already built or already decided.
Measured at landing:

- **Its entire Pillar D corpus work already shipped.**
  `agents/roadmaps/archive/road-to-injection-defense-pressure-corpus.md` is
  archived at `status: ready` with 11 boxes done, 0 open and 9 cancelled. It
  delivered the payload-free fixture corpus, the homoglyph and confusables
  family (`src/scripts/lint_confusables.ts` is in the tree), the zero-width
  family, the ASCII-obfuscation family, the per-family coverage report, and the
  honest-null path. The parent proposed all six again as new work.
- **Its Pillar B relation enum already shipped.**
  `agents/roadmaps/archive/road-to-review-independence.md` is archived at
  `status: ready` (20 done, 1 cancelled) and types the independence relation as
  `'cross-family' | 'same-family' | 'single-member' | 'unknown'` at `:177`,
  with fixtures at `:195` and `:385`. The parent's B1 audit — "record whether
  author and reviewer share a family" — is that enum.
- **Its non-adoption table duplicated an existing decided register.** The
  parent's section 2 re-listed rejections that
  `archive/road-to-review-independence.md:61-74` already carries as a
  decided-and-cut table, council-settled 2026-06-27.

What survived is below: three items, none of which is a control, and none of
which the archived roadmaps cover.

## Probe — Item 1: SARIF upload

- **What:** `src/scripts/lint_agent_security.ts` already emits SARIF. It carries
  a `--sarif PATH` argument (`:158-171`), builds a SARIF 2.1.0 report
  (`:87`, `:113`) and writes it byte-identically to the prior implementation
  (`:6-8`, `:218-222`). **Nothing uploads it.**
- **Deliverable:** one workflow step. This is packaging of a control that
  already exists, not a new control.
- **Probe:** count workflow files that upload SARIF.
  `grep -rln "upload-sarif\|codeql-action/upload" .github/workflows/ | wc -l`
- **Baseline on transfer date (2026-08-24): 0.** Promote when the probe returns
  a number **greater than** its baseline. Stated as a comparison rather than a
  pinned target because the workflow set changes independently of this stub.
- **Named producer:** whoever wires the first Code Scanning upload for this
  repository. The capability that is missing is a repo-settings surface (Code
  Scanning enablement), which is why this is a transfer rather than a step.

## Probe — Item 2: The stateful / multi-turn residual-risk row

- **What:** every shipped control here is per-message and stateless.
  Gradual-steering and in-session protocol-setup attacks are invisible at the
  message level and need a different detection architecture — which is out of
  scope by standing doctrine (runtime behavioural enforcement is not this
  package's layer). The gap is that the threat model does not **say so**.
- **Deliverable:** one honest threat-model row recording the stateless/multi-turn
  class as a stated, accepted and bounded residual risk, and why it remains a
  consumer-runtime responsibility. **No code.**
- **Probe:** count lettered rows in the threat model.
  `grep -cE "^\| [a-z] \|" docs/threat-model.md`
- **Baseline on transfer date (2026-08-24): 9** (rows a through i; none covers
  the stateless/multi-turn class). Promote when the count exceeds the baseline
  **and** the new row names that class — the count alone is necessary, not
  sufficient, so read the row before closing this item.
- **Named producer:** the next threat-model revision.

## Probe — Item 3: Worst-family, not mean, null gating

- **What:** one paragraph of measurement discipline. A per-family coverage
  report must gate its honest-null on the **worst** family, never the mean: a
  high aggregate score does not imply per-family robustness, and chained
  transforms can pass checks that catch each transform singly.
- **Deliverable:** one paragraph in the corpus document. No code, no fixtures.
- **Probe:** does the archived pressure-corpus document state a worst-family
  gate? `grep -ciE "worst.family|worst-case family" docs/` over the corpus
  artefact.
- **Baseline on transfer date (2026-08-24): not measured** — recorded honestly
  rather than guessed, because the corpus document's final location was set by
  the archived roadmap and this stub did not re-read it. Establish the baseline
  as the first act of promoting this item.
- **Named producer:** whoever next edits the per-family coverage report.

## Blockers

### blocker: b-perturbation-reopen
- **Status:** OPEN
- **Owner:** council
- **Blocks:** any attempt to recover the parent's deleted Pillar D corpus work
  (the perturbation-family matrix as *new* work, as opposed to the three items
  above).
- **What it is:** recovering that pillar means re-harvesting a source whose
  adoption an AI council already closed on 2026-06-27, recorded in
  `archive/road-to-review-independence.md:61-74`. That is
  `decision-revisit-gate` territory and the mechanism **matches** — the
  proposal is the same transform-family corpus the council considered, not a
  different one — so the mechanism-match check does not exempt it.
- **What to do:**
  1. Do **not** re-propose the corpus directly. Run the revisit gate: read the
     2026-06-27 record, its status, and what has changed since.
  2. Route the reopen to the **council first**, per
     `decision-revisit-gate` — this is a reversible internal mechanism inside
     the authorised envelope, so it is council-decidable, not owner-reserved.
  3. Record the outcome with scope and a `revisit-if` condition.
- **Recommendation:** leave closed. The three items above are the whole
  surviving value and none of them needs the corpus; the archived pressure-corpus
  roadmap already shipped the six families the parent would have re-proposed.
- **If you do nothing:** nothing is lost. The corpus work is shipped and
  archived; this blocker exists only so a future reader who mistakes the
  parent's deleted pillar for an unbuilt one is routed to the council instead of
  re-harvesting.
- **Resolved when:** a council record either reopens the decision with a stated
  scope and `revisit-if`, or reaffirms the 2026-06-27 close.

## What this stub deliberately does NOT carry

- No perturbation-family corpus, matrix, or fixtures — shipped and archived.
- No homoglyph, zero-width, or ASCII-obfuscation family work — shipped.
- No review-independence relation enum or audit — shipped.
- No non-adoption table — already a decided register elsewhere.
- No runtime injection detector, no online-learned parameters, no
  auxiliary-model runtime calls, and no offensive content in any form. The
  parent's source was a red-team framework; its offensive core was rejected
  wholesale in the parent and is not revisited here. Referred to as **Source A**
  only, per `src/rules/source-confidentiality.md`.

## Corrections applied at landing (2026-08-24)

| What | Was | Now | Why |
|---|---|---|---|
| Form | A 221-line `status: draft` roadmap with two pillars and eight phases | A three-item stub under `stubs/` | About 85 percent of the parent was already built or already decided. Landing it as a roadmap would have re-proposed shipped work. |
| Source naming | A third-party red-team framework named in frontmatter (`provenance.external_source_A`, with repo and author) and throughout the prose | **Source A**, with every name, repo path and author removed | `src/rules/source-confidentiality.md` forbids derivation-attribution in tracked text regardless of denylist membership. Checked at landing: the name appears **nowhere** in `src/scripts/external_sources_denylist.json`, so the `check-no-external-sources` CI gate would not have caught it. |
| Pillar D | Proposed as new measurement work (D1 corpus, D2 gap closure, D3 threat row, D4 rigor guard) | D1's six families recorded as **already shipped**; only D2's SARIF item, D3's row and D4's paragraph survive | `archive/road-to-injection-defense-pressure-corpus.md` (11 done / 0 open / 9 cancelled) already delivered the corpus, the families, the coverage report and the honest-null path. |
| Pillar B | Proposed as an audit to instrument reviewer selection | Recorded as **already shipped** | `archive/road-to-review-independence.md:177` already types the four-value relation enum, with fixtures at `:195` and `:385`. |
| Probes | Absent | One named probe per item, each written as a **comparison against a dated baseline** | The `stubs/README.md` transfer contract requires a named producer and a detection probe with a measured baseline. A pinned count would be stale the moment another agent edits the tree. |
| Item 3 baseline | — | Recorded as **not measured**, with instructions to establish it first | Guessing a baseline would fake the one thing the probe exists to provide. |

**Verified at landing:** the `--sarif` emitter in `lint_agent_security.ts`
(`:158-171`, `:87`, `:113`, `:218-222`); zero workflow files uploading SARIF;
nine lettered threat-model rows; `src/scripts/lint_confusables.ts` present; the
archived state and box counts of both parent-superseding roadmaps; the
`:177`/`:195`/`:385` and `:61-74` anchors in the review-independence archive; and
zero denylist hits for the stripped source name.
