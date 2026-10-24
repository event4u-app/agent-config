<!-- evidence-type: analysis -->

# Step 7.2 — entry, suspend, re-attestation and owner rules

The conditions under which step 7.2 of `road-to-authority-routing-mechanism`
may rely on step 7.1's classification ledger. They were set by rounds D37 to
D39, and the step points here.

**Entry condition, fail-closed (D37):** 7.2 may rely on 7.1's ledger only
when `node agents/evidence/analysis/gate-ledger-reconcile.mjs` exits 0
at the revision 7.2 changes. A stale, failed or absent reconciliation
blocks reliance, and the reconciler marks itself stale on any change to
a check, its wiring, its helper closure or a proof artifact. 7.2's own
test runs it first. Also owed before any enforcement change, per
D33–D37:
- the canonical scope for checks 9 and 12;
- row 16's exit-1 divergence reconciled — done by D46 (owner, 2026-10-24):
  an absent store now exits 0;
- a rollback owner, triggers and a window;
- the silent passes and promised-but-missing exit codes the branch
  inventory found.
The invocation inventory, 7.2's first item, is done:
`agents/evidence/analysis/gate-invocation-inventory-20261024.md`.
**Suspend, rollback and re-attestation (D38).**
- *Suspend.* Reliance on the ledger stops at once in any of three cases:
  the reconciler reports stale or failed; a mapping is disproved; or a
  7.2 change reveals a divergence between a row's class and a check's
  behaviour that the ledger does not record.
- *Re-attest.* Renewing a pin is never a refresh by itself. The diff
  that made the pin stale is re-reviewed against the affected rows, and
  that re-opens 7.1 for those rows. The author of the change does not
  renew the pin alone; a council round on the diff does.
- *Sequencing.* A 7.2 change to a pinned check, helper or proof artefact
  therefore makes the reconciler fail by design. 7.1's re-attestation of
  the affected rows is a prerequisite of that 7.2 change landing, and
  not a step after it.
- *Rollback.* Any enforcement change 7.2 makes is reverted when
  reliance is suspended, until re-attestation passes.
- *Owner (D39).* The accountable role for pin renewal, and for keeping
  7.2 blocked while a pin is stale, is the agent lane holding this
  roadmap's claim at that moment. The role does three things:
  1. initiates the council round on the stale diff;
  2. records the round under `agents/evidence/council/`;
  3. leaves the pin stale until the round answers 2/2 present.

  A degraded round renews nothing, and the role never renews on its own
  reading. Independent approval beyond the council is the second
  principal, and it stays owner-reserved under
  `external-bootstrap-boundary-for-phases-2-3`.
- *Candidate state (D39).* Re-attestation runs the reconciler against the
  proposed merge result of the 7.2 change, before it lands, and not
  against the current branch. That is how the sequencing rule avoids
  deadlock.
- *Trust root (round 21).* The reconciler pins itself, the scanner, the
  harness and the ledger table. A candidate that changes the validator and
  its pin together would therefore pass a reconciler taken from the
  candidate. So 7.2's consumption runs the reconciler **from the base
  revision**, with `git show <base>:agents/evidence/analysis/…`, against the
  candidate's tree. A candidate that changes any of these files is never
  consumable on its own reading. It goes through the re-attestation above.
  The files are the reconciler, the site scanner, the harness, the
  vocabulary, the dispositions, or a pin line.
- *D46's operational state and rollback (round 26).* An absent composite
  store exits 0 and prints `⏳ NOT MEASURED YET`, which is distinct from
  `✅ ARMABLE` and from `⏳ NOT YET`. In CI the absent case cannot hide a
  failed write. `bench_hook_latency --gate --record-composite`, the step
  before it in `tests.yml`, fails the job when the bench fails. The arming
  step is `continue-on-error` either way. D46 is reverted, back to exit 1 on an
  absent store, when either of these holds:
  1. a CI run's bench step passes and its composite store is still absent.
     That is a silent write failure the absent-store exit 0 would mask;
  2. the store stays absent across the 10 CI runs the arming floor needs,
     which means "not measured yet" has become permanent rather than a
     bootstrap state.

  The accountable role is the one named under *Owner (D39)* above.
- *Wiring pins (round 26).* `taskfiles/ci-fast.yml` and
  `.github/workflows/rule-backstops.yml` are pinned because they wire Phase 7
  checks. Their trunk change since revision 16 only switches
  `check_step_production_reach` to `--enforce`. That script is outside the 16
  checks, and no Phase 7 check's invocation changed. Renewing these pins attests
  only that no Phase 7 invocation moved. It does not attest the
  `check_step_production_reach` enforcement, which its own roadmap owns.
