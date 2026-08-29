# Code-graph vs grep — in-repo corpus **v2**, 2026-08-29

> **NOT COMPARABLE to the 2026-07-28 run, and NOT COMPARABLE to the v1 run of
> 2026-08-28.** v2 is a new registration, not a repaired continuation: a
> different corpus, a different arm-B verb set, and a corrected scorer. No
> delta may be computed against either. Both earlier reports are untouched.

Pre-registered in `internal/bench/code-graph/PREREGISTRATION-inrepo-v2-2026-08-29.md` before this run.
Corpus `inrepo-corpus-v2-2026-08-29.yaml` bound by SHA-256 `719885107aae85f1…`; the runner refuses on mismatch.

**Measured commit:** `bef1948db877f33993eb1923f234a3a7138faf29` (2026-08-29) — postdates the 2026-08-22 extractor repair, asserted by the runner rather than read by eye.

**Measured content, pinned by tree hash.** A commit id is not a durable
pointer here: this repository squash-merges, so the branch commit above will
not be an ancestor of `main`. v1 cited `c454648af` and that commit resolves to
nothing in a fresh clone. Tree hashes survive the squash, so they are what a
reader should verify (`git rev-parse <ref>:<path>`):

| Measured path | tree |
|---|---|
| `src/scripts/code_graph` | `e55fc87c7081359e1c0e2bf8263f17358de2e315` |
| `src/shared` | `dcdc68073e0f2340b3734678cc4e82f34c241dba` |
| `src/scripts/ai_council` | `778a493ba915795159adcb0bb789e93b89d6a86a` |

## What v1 got wrong, and why v2 exists

v1 published `path-between` as `VOID — INSTRUMENT FAILURE` with the note
*"Both arms returned the empty set on every question in this class"*. **That
was false for the graph arm.** The engine answered all three questions; v1's
relevance filter compared each returned symbol against the whole probe string
`"cmdBuild -> getParser"`, which no symbol contains, and discarded every
relation. The class was not symmetric silence — grep genuinely had no text to
find, and the graph found the answer and had it thrown away by the scorer.

Two further scorer defects are corrected here: v1 never invoked the shipped
`path <a> <b>` verb (its graph arm ran only `affected` and `query`), and it
counted unresolved `symbol:` pseudo-nodes as files, deflating graph precision
in every class carrying one. `callers` was ruled NULL on the precision floor
alone, with recall tied — so that verdict was harness-caused too.

**v1's numbers are not retro-edited.** They were faithful to v1's own
registration, which defines arm B as `affected` + `query`. The correction is
this new registration, plus the correction of v1's false *explanation*.

## Post-registration correction to this runner — display only

After the first v2 run, the in-domain negative-control rows were emitting the
shared scorer's `recall = 1.0` for an empty truth set, which contradicts this
benchmark's own registration ("recall is undefined over an empty truth set and
is not computed"). Those three rows now carry `n/a`. The change is recorded
rather than quietly made, because editing a runner after seeing a result is
exactly what a pre-registration exists to constrain. It moved no verdict and no
aggregate: `per_class`, the macro average, the capability-boundary figures and
the clean rates are byte-identical between the two runs, and the only rows that
differ are the three whose values the registration says do not exist.

## Per-class verdicts — bars identical to v1

Bar per class: recall delta ≥ +10 pp **and** precision within 5 pp.

| Class | n | grep R | graph R | Δ recall (pp) | grep P | graph P | precision ok | verdict | validity |
|---|---|---|---|---|---|---|---|---|---|
| `callers` | 3 | 1 | 1 | +0 | 0.611 | 0.667 | yes | **TIE** | VALID |
| `transitive-impact` | 3 | 0.611 | 0.5 | -11.1 | 1 | 0.667 | no | **NULL** | VALID |
| `path-between` | 3 | 0.917 | 1 | +8.3 | 0.778 | 1 | yes | **TIE** | VALID |
| `references` | 3 | 1 | 0.333 | -66.7 | 0.833 | 0.333 | no | **NULL** | VALID |

**Classes won:** none.

## How to read `path-between` — the graph is perfect and it is still a TIE

The graph arm answers all three questions exactly: recall **1.000**, precision
**1.000**, no missed file and no wrong one. It is the only class where the graph
out-precises grep. It still does not clear the bar, because the grep arm is now
fixed too: given the union of two word-boundary searches — the "fair two-probe
equivalent" the v2 stub required — grep reaches recall 0.917. Δ is +8.3 pp
against a +10 pp bar. **TIE, not WIN.**

This is worth stating plainly because the obvious way to quantify the v1 defect
produces a much larger number and a different verdict. Running the `path` verb
for the graph arm while leaving the grep arm on v1's single unmatched probe
gives grep 0.000 and the graph 0.889-1.000 — a delta near +89 pp and an
apparent WIN. That figure is itself an artifact: it repairs one arm and not the
other. v2 repairs both, and the honest answer is that the graph wins this class
on precision and ties it on the registered recall bar.

## In-domain negative controls — false positives, not recall

An arm passes an item iff it returned the EMPTY set for a symbol-shaped probe that names nothing in the root. Scored as a clean-rate; recall is undefined over an empty truth set and is not computed. These rows are excluded from every recall figure and from the macro average.

| Arm | clean rate (n=3) |
|---|---|
| grep | 1 |
| graph | 1 |

## Capability boundary — where grep stays necessary

LITERAL-string probes. A symbol index cannot answer them by construction. v1 folded these four into a negative-control recall FLOOR and then reported the floor FAILED; v2 reports the class and derives NO verdict from it. It is a statement about where grep stays necessary, not a measurement of the engine.

| Arm | recall (n=4) |
|---|---|
| grep | 1 |
| graph | 0 |

## Macro average — reported only, NOT a pass criterion

REPORTED ONLY — not a pass criterion. Covers the four graph-shaped classes; the in-domain controls (undefined recall) and the capability-boundary class (unanswerable by construction) are excluded.

| Arm | precision | recall |
|---|---|---|
| grep | 0.806 | 0.882 |
| graph | 0.667 | 0.708 |

## Per-question rows

| id | class | root | grep P/R | graph P/R | graph missed |
|---|---|---|---|---|---|
| `cg-callers-01` | callers | code_graph | 0.667/1 | 0.667/1 | — |
| `sh-callers-01` | callers | shared | 0.667/1 | 0.667/1 | — |
| `ac-callers-01` | callers | ai_council | 0.5/1 | 0.667/1 | — |
| `cg-impact-01` | transitive-impact | code_graph | 1/0.5 | 1/0.5 | `build.ts`, `cli.ts` |
| `sh-impact-01` | transitive-impact | shared | 1/0.333 | 0/0 | `settingsClasses.ts`, `settingsAsks.ts`, `settingsConsent.ts` |
| `ac-impact-01` | transitive-impact | ai_council | 1/1 | 1/1 | — |
| `cg-path-01` | path-between | code_graph | 1/0.75 | 1/1 | — |
| `ac-path-01` | path-between | ai_council | 0.667/1 | 1/1 | — |
| `ac-path-02` | path-between | ai_council | 0.667/1 | 1/1 | — |
| `cg-references-01` | references | code_graph | 1/1 | 0/0 | `types.ts`, `build.ts` |
| `sh-references-01` | references | shared | 1/1 | 0/0 | `settingsClasses.ts`, `settingsAsks.ts`, `settingsConsent.ts` |
| `ac-references-01` | references | ai_council | 0.5/1 | 1/1 | — |
| `cg-negctl-01` | negative-control-in-domain | code_graph | n/a/n/a | n/a/n/a | — |
| `sh-negctl-01` | negative-control-in-domain | shared | n/a/n/a | n/a/n/a | — |
| `ac-negctl-01` | negative-control-in-domain | ai_council | n/a/n/a | n/a/n/a | — |
| `cg-negative-01` | capability-boundary | code_graph | 1/1 | 0/0 | `cli.ts` |
| `sh-negative-01` | capability-boundary | shared | 1/1 | 0/0 | `settingsSurface.ts` |
| `ac-negative-01` | capability-boundary | ai_council | 1/1 | 0/0 | `budget_guard.ts` |
| `ac-negative-02` | capability-boundary | ai_council | 1/1 | 0/0 | `config.ts` |

## Build times

- `code_graph` — 389 ms
- `shared` — 394 ms
- `ai_council` — 736 ms

## What this result may and may not change

It may change **routing** — which classes the code-intelligence skill and the
`external-code-graph-interop` rule name as graph-first. It may **not** change
permission: no setting default moves and no dependency moves between
`devDependencies` and `dependencies`. That is ADR-246's question, and any
reopen is a separate change under `decision-revisit-gate`.

