---
stability: beta
keep-beta-until: 2026-10-06
keep-beta-reason: >-
  Beta review 2026-09-05 — AI council SPLIT, so the conservative disposition
  stands and the question is escalated rather than settled. On the four
  STABILITY.md criteria the contract passes: 37 days in beta, body unchanged for
  54 days, a normative consumer in `launch-readiness/SKILL.md`, and a carrier
  roadmap archived with every acceptance criterion ticked, which is the
  "explicitly frozen as part of a roadmap step" branch. One seat read that as
  PROMOTE. The other read the § 4 diff gate and § 5 suppression as never having
  executed against a committed baseline — untested behaviour rather than merely
  zero external adoption — and voted EXTEND. Honest disclosure about this date:
  it is a maintainer-decision window, NOT a fact about the contract, and the
  dissenting seat said so of the same date. The contract carries no dated clause
  and no dependency, so no contract-internal anchor exists. Before the window
  ends the maintainer answers one question: does a normative in-repository
  consumer reference satisfy the promote criterion when the contract's core
  features have never run — or does STABILITY.md's "consumer count = 0" keep-beta
  reason govern? Either answer resolves this contract; the second seat also
  proposed clarifying STABILITY.md prospectively, which is a governance edit and
  is deliberately not made here.
---

# Pre-Launch Diagnostics — finding IDs, epistemics, regression gate

> Contract for the consumer-facing launch diagnostic
> (road-to-ecosystem-harvest-prelaunch-diagnostics, Source L — a
> production-readiness diagnostic skill; provenance in the harvest index).
> The consumer-side sibling of the suite's own claims-ledger: a "ready"
> verdict cannot be reached by assertion.
>
> Schema: [`prelaunch-report.schema.json`](../../src/scripts/schemas/prelaunch-report.schema.json) ·
> Area vocabulary: [`prelaunch-areas.yml`](../../src/config/prelaunch-areas.yml) ·
> Tooling: [`prelaunch_diagnostics.ts`](../../src/scripts/prelaunch_diagnostics.ts) ·
> Skill surface: [`launch-readiness`](../../src/skills/launch-readiness/SKILL.md).

## 1 — Finding-ID grammar (immutable, diff-stable)

```
AC-<AREA>-NNN        e.g. AC-AUTH-003, AC-RBK-001
```

- `<AREA>` — the uppercase code of a coverage area from
  [`prelaunch-areas.yml`](../../src/config/prelaunch-areas.yml). The vocabulary
  is **append-only**: codes are never renamed or re-used.
- `NNN` — zero-padded, monotonically assigned per area, **never re-assigned**.
  A finding that is retitled, re-scoped, or resolved keeps its ID forever; a
  genuinely new problem gets the next number. Resolved findings stay in the
  report with a flipped `status` — the entry never disappears, so baselines
  diff cleanly across months.
- The **ID is the diff key**. Titles, evidence, and severity are mutable
  metadata; two runs are compared by ID set + per-ID state, never by prose.

## 2 — Epistemics (Pass needs evidence; Unknown ≠ Pass)

Every coverage area carries exactly one state:

| State | Meaning | Requirement |
|---|---|---|
| `pass` | Diagnosed clean | **Cited evidence required** — file:line, command output, run URL. A pass without evidence fails validation: that is assertion, not diagnosis. |
| `finding` | At least one open finding | The finding IDs live in `findings[]`. |
| `unknown` | Not diagnosed | The honest default. **Absence of findings is `unknown`, never an automatic `pass`.** An area missing from the report entirely is `unknown` by definition. |
| `not-applicable` | Does not exist on this surface | **Reason required** ("no DB → no migrations"). |

Verdict rule (the launch gate):

```
ANY OPEN P0 FINDING → NOT READY, REGARDLESS OF EVERY OTHER AREA.
ANY OPEN P1, OR A launch_gate AREA NOT AT pass/not-applicable → NOT READY.
READY IS THE RESIDUAL STATE, NEVER THE DEFAULT.
```

`launch_gate: true` areas (auth, migrations, secrets, rollback) block the
verdict while `unknown`; non-gate areas (observability, agent-governance)
surface as unknowns + questions but do not block alone.

## 3 — Coverage backbone

The area vocabulary is deliberately pruned to the stacks this suite targets:
**auth · migrations · secrets · observability · rollback · agent-governance**.
It is not a generic compliance matrix — new areas enter by appending to
`prelaunch-areas.yml` with a maintainer-reviewed `launch_gate` decision.

Every report may carry a `questions` list — **questions that would change the
diagnosis** ("is the admin panel exposed on the same origin?"). Questions are
the actionable rendering of unknowns; the next run should convert them into
evidence or findings.

## 4 — Regression gate (findings diff)

`prelaunch_diagnostics.ts diff <baseline.json> <current.json>` compares two
reports **by ID**:

- **new** — ID in current, not in baseline.
- **resolved** — open in baseline, `fixed` in current.
- **regressed** — a `launch_gate` area that was `pass` in the baseline and is
  `finding`/`unknown` in current (Pass→Finding flip).
- **retitled findings do not appear in the diff** — the ID survives the
  rename (acceptance-tested).

`--ci` mode exits non-zero when the diff contains a **new open P0/P1** or a
**Pass→Finding flip in a launch-gate area** — the consumer-side sibling of the
suite's claims-ledger CI. Everything else (new P2/P3, resolved findings,
question churn) reports informationally and exits 0.

## 5 — Suppression (evidence-backed, never silent)

A consumer may suppress a finding via the project-local suppression file
`agents/settings/prelaunch-suppressions.yml`:

```yaml
schema_version: prelaunch-suppressions-v1
suppressions:
  - id: AC-OBS-002
    reason: "Dashboards land with the Q3 observability epic; alerting for the launch path exists."
    evidence: "agents/evidence/prelaunch/obs-alerting.png"
```

- A finding with `status: suppressed-with-evidence` MUST have a matching
  suppression entry carrying **both** `reason` and `evidence` — validation
  fails otherwise.
- Suppressed findings are excluded from the `--ci` triggers but **render in a
  collapsible "suppressed" section** of the report output — the same
  transparency contract as the review cluster's dropped-false-positives list.
  Suppression hides nothing; it moves the item behind a fold with its receipt.
- Suppressing a P0 does not restore a ready verdict — P0 caps the verdict
  regardless (§ 2).

## 6 — Consumer recipe (opt-in CI gating)

1. Run the diagnostic (via `launch-readiness` § epistemics) and save the
   report to `agents/evidence/prelaunch/baseline.json`. Commit it.
2. Before a launch, produce a fresh `current.json` and run
   `prelaunch_diagnostics.ts diff baseline.json current.json --ci` in the
   pipeline — red on a new P0/P1 or a launch-gate Pass→Finding flip.
3. After the launch settles, promote `current.json` to the new committed
   baseline (a reviewed diff, like any lockfile bump).

## 7 — Fix-loop discipline (Phase 3)

- Rank open findings by severity, then by launch-gate membership.
- Propose the **safest first approval batch** — explicitly the first *safe*
  batch (reversible, small blast radius), not the full backlog. Approval is
  the user's; the diagnostic never self-authorizes fixes
  ([`autonomous-execution`](../../src/rules/autonomous-execution.md) and the
  reversibility floor govern, unrestated).
- Per-finding status vocabulary (schema-enforced): `open · fixed ·
  accepted-risk · deferred-with-reason · suppressed-with-evidence ·
  not-applicable` — everything except open/fixed carries a `reason`.
- **Rescore whenever evidence changes** — a fix, a new probe, or an answered
  question re-runs the affected area, never the memory of it.

## 8 — Read-only guarantee

The diagnostic **never mutates a consumer project**: the tooling reads
reports and writes nothing outside its own output. Fixes flow through the
normal approval-gated engines, not through this contract.

## 9 — Score: council-locked (do not add)

The pass-1 council **dropped the 0–100 readiness score** (gameable false
precision). A severity-capped, never-published internal-ordering variant is
**surfaced for council re-evaluation in the roadmap's revisit note — not
adopted**. Until that revisit resolves: no numeric score field in the schema,
no score in any rendered output, no score in CI messages. The ID scheme,
epistemics, diff gate, and suppression above stand on their own.

## See also

- [`launch-readiness`](../../src/skills/launch-readiness/SKILL.md) — the skill
  surface that produces the report.
- [`docs/proof.md`](../proof.md) — the suite-side claims-ledger this mirrors.
- `road-to-ecosystem-harvest-reliability-measurement` (archived) — measures the
  *suite itself*; this contract measures the *consumer's launch surface*.
