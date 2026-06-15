// Reporting reads the CACHED balance index (fast path) and produces a trial
// balance. The symptom shows up HERE: `trialBalance().net` should always be 0
// for a healthy double-entry book, and `verifyAgainst(recompute)` should never
// find a drifted account. When it does, the cache and the journal disagree —
// but the cause is not in this file.

export class Reporting {
  constructor(accounts) {
    this.accounts = accounts;
  }

  // Trial balance built from the cached index.
  trialBalance() {
    const rows = [];
    let net = 0;
    for (const [acct, bal] of this.accounts.snapshot()) {
      rows.push({ acct, balance: bal });
      net += bal;
    }
    rows.sort((a, b) => (a.acct < b.acct ? -1 : a.acct > b.acct ? 1 : 0));
    return { rows, net };
  }

  // Compare the cached index against an authoritative recompute. Returns the
  // list of accounts whose cached balance disagrees with the recompute.
  verifyAgainst(recomputed) {
    const drift = [];
    const accts = new Set([
      ...this.accounts.snapshot().keys(),
      ...recomputed.keys(),
    ]);
    for (const acct of accts) {
      const cached = this.accounts.balance(acct);
      const truth = recomputed.get(acct) ?? 0;
      if (cached !== truth) {
        drift.push({ acct, cached, truth });
      }
    }
    return drift;
  }
}
