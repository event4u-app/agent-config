# legal-evals — regression / consistency harness (NOT a correctness oracle)

> **Read this first.** These fixtures are a **regression harness**, not a
> correctness benchmark. They achieve *measurement* objectivity (they reliably
> detect when a skill's output **changes** between versions); they do **not**
> establish *ground-truth* objectivity (that the labels are legal truth).
> Correctness stays where it belongs: **licensed-attorney review on material
> use**. No artefact here claims an "objective" legal acceptance gate.

## Why this framing (council round 3)

An earlier design gated skill ship on "≥X% match to attorney ground-truth" and
called it the objective replacement for reviewer sign-off. The council ruled that
false objectivity: the labels were self-generated, the maintainer qualification is
unconfirmed (Gate 2), and model clause-extraction caps at ~F1 0.62 — so any
passable threshold measures "not worse than a mediocre baseline," not correctness.
See `docs/guidelines/agent-infra/domain-eval-anti-pattern.md`.

## Scope — the maintainer's genuine-competence domain only

Fixtures start in **EU DPA / GDPR Art. 28** (the one area an EU-native maintainer
can label defensibly), not all contract types. Each fixture is **self-labeled,
provisional, pending attorney validation** and says so in its header.

## What each fixture is

`input` (a contract snippet) + `expected` (the GREEN/YELLOW/RED flags a review
should surface) + a per-fixture **falsification probe** (the concrete failure it
must catch + one attorney-ambiguous case). If the maintainer cannot confidently
resolve the ambiguous case, that fixture type is **out of scope** until attorney
validation — competence is not a substitute for validation.

## How to run (regression check)

Run the relevant skill (e.g. `dpa-review`) against each fixture's `input` and diff
the produced flags against the fixture's `expected`. The first run sets the
baseline; later changes must not regress against it. This is a **consistency**
check — the threshold sits *below* the ~F1 0.62 cap by construction and never
implies correctness. An automated runner is intentionally NOT shipped here: a
real cross-model, attorney-validated scorer is the **gated objective track**
(road-to-legal-pack Phase 5.1), blocked on a funded gold set (inter-annotator
≥0.7) — not on the cross-model-parity keystone (legal matching is classification,
not finding-count distributions).

## Fixtures

- `dpa-art28-processor-subprocessor.md` — processor-side, sub-processor authorisation + flow-down.
- `dpa-art28-controller-audit-deletion.md` — controller-side, audit rights + deletion/return.

## Worked demonstration — the harness catches a regression (roadmap 3.3)

A manual demonstration that the regression check is real (the automated cross-model
runner remains the demand+funding-gated track; this is the consistency check by hand):

- Fixture `dpa-art28-processor-subprocessor.md` declares **expected: sub-processor clause = RED** ("at its discretion" defeats the controller's Art. 28(2) authorisation right).
- **Baseline run** of `dpa-review` flags that clause RED → matches expected → ✅ no regression.
- **Deliberately regressed run** (a skill change that returns **GREEN / standard-approve** on the same clause) → produced `GREEN` ≠ expected `RED` → **regression flagged** ✗, ship blocked.

This is exactly what the harness is for: it detects when a change makes a skill worse
than its own labeled baseline. It makes **no correctness claim** — the label is
self-labeled-provisional, and a human attorney owns correctness. The "no skill claims
correctness" half of 3.3 is enforced statically (`lint_legal_pack` + the floor's
attorney-review line); this worked example demonstrates the regression-detection half.
