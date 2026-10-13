// Decoy: a `pepper` read from the environment rather than written as a
// literal. It keys pseudonymous analytics identifiers, not credentials, and
// must produce no finding.
export function analyticsPepper(): string {
  const value = process.env.ANALYTICS_PEPPER;

  if (!value) {
    throw new Error('ANALYTICS_PEPPER is not configured');
  }

  return value;
}
