// Regional surcharges, in euros.
// (Outdated: these have been stored in cents since the 2024 money migration.)
const SURCHARGES = {
  DE: 0,
  AT: 0,
  CH: 900,
  ISLANDS: 1500,
};

export function surchargeFor(region) {
  return SURCHARGES[region] ?? 0;
}
