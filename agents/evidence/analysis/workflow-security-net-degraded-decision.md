<!-- evidence-type: analysis -->
# The workflow-security regression net — a decision taken with no council seat available

**Decided:** 2026-08-22 · **Decider:** the executing agent, alone
**Council:** **UNAVAILABLE — quota exhausted, 50/50 on both seats, 0 of 2 present, $0.00 spent**

This file exists because the decision below was owner-reserved and neither the
owner nor the council was reachable. Recording who decided, and on what, is the
whole point; a decision of this class with no attribution is indistinguishable
from a decision nobody made.

## The blocker, and why it needed a decision at all

`workflow-lint-tool-adoption` — Class 3, **Owner: user** — asked how
`persist-credentials` gets a regression net: (a) adopt an external workflow
linter and retire the overlapping in-tree rules, (b) extend the in-tree linter,
or (c) decline both and record that the cleanup ships with no net.

Under the drain run's standing mandate an Owner-user blocker routes to the AI
council rather than to the owner. The council was invoked and returned
`0/2 present · INCONCLUSIVE`: both seats sit at 50/50 requests. The mandate's
degradation clause says to fall back to the best available seat and record it.
**There was no available seat**, so this is the further-degraded case: one
decider, no independent check, written down as such.

## The finding that reshaped the question

The roadmap's step 1.4 asserted that reverting a pin would make the linter
**exit non-zero**. It does not. `mutable-action-tag` is **MEDIUM**, and the
linter's exit contract is `0` on advisory findings, `1` only on `--strict` **+
HIGH** (`src/scripts/lint_workflow_security.ts:10-12`). Verified: reverting one
pin prints `[MEDIUM] mutable-action-tag` and exits **0**.

So option (b) as written would have delivered a **detector, not a net** — the
exact property the blocker exists to supply would have been absent on arrival.
The obvious repair, promoting the rule to HIGH, touches a **severity model
locked by council on 2026-06-13** (`:15-22`).

## The decision, in three parts

**1. Take (b), and ship the rule at MEDIUM.** An external tool means re-deciding
the locked severity model *and* adding a CI-path dependency for one rule;
declining leaves the hole that produced the 0-of-50 state. The rule is added and
verified sensitive: removing one `persist-credentials` key produces
`[MEDIUM] persist-credentials`, restoring it clears.

The rule asks for the key to be **present**, not for a particular value. `true`
is a legitimate answer — two jobs here push — so an explicit `true` is a
reviewable decision and a missing key is an ambient one. Only the second is a
finding.

**2. Refuse to re-tier the locked model.** A council-locked severity model is
not something a single agent re-opens on the strength of a cleanup, and this is
the one place where the absence of a seat had to change the outcome rather than
just be noted. The question is **carried, not closed**: whether
`mutable-action-tag` and `persist-credentials` should be HIGH, or whether CI
should invoke `--strict` differently, needs the council that was unavailable.

**3. Put the net in the test suite instead** — `tests/contracts/ci_supply_chain.test.ts`.
Tests block CI. This delivers the blocking property without touching the locked
model, which is why it is the answer rather than a workaround: the net was never
required to live in the linter, only to exist.

Sabotage-probed in three directions before being claimed a net — unpin one
action → 2 failures; drop one `persist-credentials` → 1 failure; make the
dependabot rationale claim tag pinning again → 1 failure; all restored → 10 pass.

## The one thing corrected in the locked model regardless

The MEDIUM tier's own wording read *"third-party actions pinned by mutable tag
… (first-party `actions/*` are skipped)"*. The first-party exemption is **gone**
as of this change, so that parenthetical documented an exemption that no longer
exists — a false claim in a tracked artefact, which is the defect class Phase 0
of this roadmap was written to repair. Correcting a description to match the code
is not re-tiering: the tiers are untouched.

## What a reader should distrust here

One decider, no independent review, on a question whose own roadmap step carried
a false premise. The parts that do not depend on judgement are the measurements —
112 of 112 pinned, 48 of 50 explicit `false` and 2 explicit `true` with named
push steps, three sabotage probes red then green. The part that does is
part 2, the refusal to re-tier, and it is deliberately the conservative
direction: it leaves a detector where a blocker might belong, rather than moving
a locked line with nobody watching.

## Revisited 2026-10-07 — the CI invocation, decided with two seats

The question this page carried — "whether CI should invoke `--strict`" — went to
the AI council on 2026-10-07 as a decision-revisit of the 2026-06-13 lock.
**Members:** anthropic (claude-sonnet-4-5) and openai (codex-default), one round
with peer review, quorum 2/2, $0.00 metered (subscription transport).
**Verdict: option (a), 2 of 2** — run the step in
`.github/workflows/consistency.yml` under `--strict`, set `argv: ["--strict"]`
on the gate's row in `src/config/gate-coverage.yml`. The tier assignment is
untouched: MEDIUM stays advisory, and only a HIGH changes the exit code.

The reasons both seats gave: a HIGH is a trust-boundary failure rather than
hygiene; the tree reads 0 HIGH over 35 workflow files, so enforcement costs
nothing to turn on; the 2026-06-13 lock settled what is HIGH, not whether a HIGH
blocks, and the 2026-08-22 entry above recorded that second question as open
rather than answered.

What the seats asked to be carried, and where it stands:

- **The gate runs the PR's own copy of itself** (openai). A contributor could
  weaken the detector or its allowlist in the same pull request. True of every
  in-tree gate here; `--strict` is a net for honest mistakes, not a boundary
  against a hostile author. Named, not closed.
- **The pull request that turns `--strict` on is judged by its own head's
  workflow**, so its CI run is the first `--strict` run; the canary recipe on the
  row and the monthly `.github/workflows/gate-canary.yml` keep proving it fails.
- **Revisit if** HIGH false positives block legitimate workflows, if exceptions
  become routine, or if the allowlist grows toward its cap of 20 with entries
  that cannot be removed. The response is to refine the rule or add a bounded,
  reasoned allowlist entry — not to return the whole audit to warn-only.
- A correction to the question as posed: the gate scans `*.yml` **and**
  `*.yaml`, not `*.yml` alone.
