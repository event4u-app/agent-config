// Money helpers. All amounts in the system are integer cents to avoid float
// drift. These are pure utilities used by the reducers and the projection.

export function cents(dollars) {
  return Math.round(dollars * 100);
}

export function add(a, b) {
  return a + b;
}

export function isPositive(amount) {
  return amount > 0;
}

export function format(amount) {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}
