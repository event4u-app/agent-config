<!-- evidence-type: analysis -->
# Council decision — consolidation-lineage enforcement surface (E1/E2)

**Date:** 2026-08-27 · **Members:** anthropic/claude-sonnet-4-5, openai/codex-default · **Rounds:** 2 · **Peer review:** blind · **Quorum:** 2/2, needed 1 — concluded · **Actual cost:** $0.0560

**Verdict: 2/2 convergent — E1 = (b), E2 = report.**

Both surfaces ship: a local inbox check invoked by `/analyze:inbox`, and a
CI-visible check over `agents/roadmaps/`. The tracked half reports rather than
blocks. Blocking is earned by tracked-scope precision evidence, not assumed.

## Why this record exists rather than a link

Council artefacts under `agents/runtime/council/` are gitignored and auto-pruned
after the retention window, so a path to one is a reference that rots
(`no-roadmap-references`, council clause). The verdicts are transcribed here.

## The question put

Whether the consolidation-lineage check runs (a) local-only over the gitignored
inbox, (b) local for inbox **plus** a CI-visible check over tracked roadmaps, or
(c) not at all; and if it lands, whether it reports or blocks. The framing named
the tension both seats had to engage: **zero** roadmaps carried the field, so a
tracked check starts by scanning nothing — the repository's own recorded
"gates that scan nothing exit green" failure class.

## Verdicts, verbatim

### anthropic/claude-sonnet-4-5

Matze, I'll address the prior critiques and then state my decision.

## 1. Agreement with prior reviewers

I **agree with Reviewer B's E1: b** and **E2: report** - both the scope and the severity.

I **agree with Reviewer A's `reportScanned` argument** - this correctly resolves the "scanning nothing" constraint. A gate that reports "scanned 0 consolidations" makes its empty state observable rather than silently green, which directly addresses the recorded failure class.

## 2. Disagreement with prior reviewers

I **disagree with Reviewer A's E2: block**. The 4/4 failure rate comes from the *inbox* (gitignored, high-noise drafting context). The tracked tree is a different population - roadmaps that have been vetted before landing. We have **zero** production samples from that population, so we don't know if the failure rate transfers. Blocking without evidence chooses confidence over the risk register's #1 concern ("check becomes a nag"). That's backwards - the evidence-gathering mode is report, not block.

## 3. New points

The asymmetry between contexts matters more than either reviewer states: the inbox check can *never* block (gitignored data, no CI), so option (b)'s real question is tracked severity only. The tracked check will start scanning nothing, then measure precision as consolidations land. Report-mode is how you discover whether the precision justifies a gate.

## My decision

**E1: b** and **E2: report**

**Rationale:** Both scopes are correct - inbox local/report, tracked CI-visible. The "scanning nothing" tension resolves via `reportScanned`: a zero-file scan that documents itself is honest, not deceptive. But blocking in tracked without production samples bets against the risk register. The 4/4 rate measures submission quality in a high-noise context; we don't know if it predicts precision in the tracked (higher-quality) context. Report-first lets the check prove it distinguishes signal from noise before granting it merge-gate authority. The census shows recurrence; it doesn't show a tracked-context check will catch real defects more often than it generates toil.

**Revisit when:** Promote to block after ≥5 tracked consolidations have landed and the check has ≥1 true positive with acceptable precision (<20% false positives), OR one incomplete consolidation reaches PR review and would have merged without the check.

### openai/codex-default

Matze,

1. **E1: b · E2: report**

2. **Rationale:** I agree with Reviewer B and with Reviewer A’s core E1 argument: `reportScanned: 0` makes the initially empty tracked-tree scan observable, but it does not make the classifier proven. The four inbox cases establish that omissions recur; they do not establish the precision of applying folder-based sibling inference to tracked roadmaps, where there are currently zero real examples. Therefore, ship both surfaces now: advisory inbox triage and a CI-visible tracked-tree report. The strongest counter-argument, correctly raised by Reviewer A, is that report-only enforcement can be ignored and thus fails to gate “done.” I nevertheless disagree with A’s immediate blocking recommendation: a structural claim may be deliberate, but identifying the complete candidate-parent universe is the uncertain part, and blocking on an unvalidated universe risks turning legitimate neighboring files into mandatory parents. Require the tracked check to report scanned and finding counts, exercise all declaration spellings and finding types through `--self-test`, classify every finding’s disposition, and add a canary proving the gate detects a known omission despite today’s zero-file baseline.

3. **Revisit condition:** Promote tracked-tree findings to blocking after real tracked examples or representative committed fixtures demonstrate high precision and prove that every blocking finding has an unambiguous discharge path.

Summary: adopt **b/report** now; earn blocking with tracked-scope precision evidence.

## What the decision obliges, and where each obligation landed

| Obligation | Where |
|---|---|
| Both surfaces exist | `--surface inbox` (local, from `/analyze:inbox`) and `--surface estate` (default root `agents/roadmaps/`) |
| Report, never block | default exit 0 on findings; `--strict` exists and is not wired into CI |
| `reportScanned` so an empty scan is visible | `reportScanned()` on every run, published as `scanned: <N>` |
| `--self-test` exercising all spellings and finding types | six spellings parse identically, four finding types fire, a complete folder stays silent |
| A detection proof despite a zero-file baseline | `--self-test` plus the committed `tests/fixtures/consolidation-lineage/` corpus; **no `canary` row**, because a report-mode gate cannot be turned red by a planted file |

## Revisit-if

Both seats named the same condition in different words: promote the tracked
half to blocking once real tracked consolidations have landed and the check has
demonstrated precision on them — one seat put it at **≥ 5 tracked
consolidations with ≥ 1 true positive and < 20 % false positives, or one
incomplete consolidation reaching PR review that would have merged without the
check**; the other at *representative committed fixtures demonstrating high
precision plus an unambiguous discharge path for every blocking finding*.

## Delegation basis

The blocker `lineage-check-enforcement-surface` carried `Owner: maintainer`. The
maintainer delegated owner-reserved decisions for this autonomous drain run to
the council; the council's recorded decision substitutes for owner sign-off and
is documented as such. Nothing here weakens a safety floor, creates an external
or irreversible commitment, or amends governance — the transition is reversible
inside the authorised envelope (`decision-revisit-gate` § owner-reserved set).
