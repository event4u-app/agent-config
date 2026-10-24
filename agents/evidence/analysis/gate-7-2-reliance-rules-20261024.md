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
- row 16's exit-1 divergence reconciled;
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
