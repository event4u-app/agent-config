// Ground-truth balance derivation: sum every leg of every committed posting.
//
// This is the slow, authoritative path. The cached balance index in
// `accounts.mjs` must always agree with this. When they disagree, the cache
// has drifted — which is the symptom this whole system is designed to surface.

export function recomputeBalances(journal) {
  const balances = new Map();
  for (const posting of journal.all()) {
    for (const leg of posting.legs) {
      balances.set(leg.acct, (balances.get(leg.acct) ?? 0) + leg.amount);
    }
  }
  return balances;
}

// Sum of all balances. For a healthy double-entry book this is always 0.
export function netOf(balances) {
  let total = 0;
  for (const v of balances.values()) {
    total += v;
  }
  return total;
}
