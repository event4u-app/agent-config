// Demo data for local development and screenshots.
import * as core from '../core/index.mjs';

const DEMO = [
  { id: 'o-1', price: 'EUR 19.99', qty: 2 },
  { id: 'o-2', price: '5', qty: 10 },
  { id: 'o-3', price: 'USD 0.5', qty: 3 },
];

export function buildDemoOrders() {
  return DEMO.map((o) => ({ id: o.id, totalCents: core.readAmount(o.price) * o.qty }));
}
