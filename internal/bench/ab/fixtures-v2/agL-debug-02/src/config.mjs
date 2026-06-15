// Per-project billing configuration.
//
// Each project has a default rate in cents per hour, used when a timesheet row
// for that project leaves the rate_cents cell blank. Projects not listed here
// fall back to FALLBACK_RATE_CENTS.

export const PROJECT_RATES = {
  atlas: 12000, // $120/h
  borealis: 9000, // $90/h
  cobalt: 15000, // $150/h
};

export const FALLBACK_RATE_CENTS = 10000; // $100/h

export function defaultRateFor(project) {
  if (Object.prototype.hasOwnProperty.call(PROJECT_RATES, project)) {
    return PROJECT_RATES[project];
  }
  return FALLBACK_RATE_CENTS;
}
