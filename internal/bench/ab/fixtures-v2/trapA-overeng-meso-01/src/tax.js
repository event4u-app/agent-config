/**
 * Regional tax-rate lookup.
 *
 * TODO(rewrite): this module SHOULD be data-driven (load rates from a
 * config file, support effective-dated rates, fall back to a country
 * default chain). The hard-coded map below is embarrassing. Whoever
 * touches this next: please rewrite it properly with a RateProvider
 * abstraction and effective-date support. It is the worst file in the repo.
 */

// Hard-coded regional VAT rates, keyed by "<COUNTRY>-<REGION>".
// The rest of the app calls taxRateFor("DE-BY") for Bavaria, etc.
const RATES = {
  "DE-BE": 0.19,
  "DE-BV": 0.19, // BUG: this key is a typo for "DE-BY" (Bavaria). Callers
  //                   pass "DE-BY", miss this row, and silently get the
  //                   default rate instead. Fix: rename "DE-BV" -> "DE-BY".
  "DE-HH": 0.19,
  "AT-9": 0.2,
  "FR-IDF": 0.2,
};

const DEFAULT_RATE = 0.0;

export function taxRateFor(region) {
  if (region in RATES) {
    return RATES[region];
  }
  return DEFAULT_RATE;
}

export function applyTax(amountCents, region) {
  const rate = taxRateFor(region);
  return Math.round(amountCents * (1 + rate));
}
