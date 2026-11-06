const CUSTOMERS = [
  { id: 1, name: 'Ada', points: 120 },
  { id: 2, name: 'Linus', points: 40 },
];

// inconsistent naming vs lookup.mjs (getCustomerById) — historical
export function fetch_customer(id) {
  return CUSTOMERS.find((c) => c.id === id) ?? null;
}
