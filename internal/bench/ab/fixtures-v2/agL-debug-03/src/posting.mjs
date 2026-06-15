// A posting = a set of legs that MUST net to zero (double-entry).
//
// Each leg is { acct, amount } in integer minor units. Positive = debit,
// negative = credit. A balanced posting is the atomic unit of the journal:
// the ledger never records a posting whose legs do not sum to zero.

export function makePosting(id, legs, memo = '') {
  const sum = legs.reduce((acc, leg) => acc + leg.amount, 0);
  if (sum !== 0) {
    throw new Error(`unbalanced posting ${id}: legs net to ${sum}, expected 0`);
  }
  if (legs.length < 2) {
    throw new Error(`posting ${id} needs at least two legs`);
  }
  return { id, legs, memo, reversed: false };
}

// Build the mirror-image posting that cancels `original` (used by reversals).
export function invert(id, original, memo) {
  const legs = original.legs.map((leg) => ({ acct: leg.acct, amount: -leg.amount }));
  return makePosting(id, legs, memo ?? `reversal of ${original.id}`);
}
