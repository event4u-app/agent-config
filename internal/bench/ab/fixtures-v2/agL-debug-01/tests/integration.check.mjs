// HELD-OUT end-to-end integration check (the oracle — not named in the prompt).
// Exercises the public OrderEngine across the ledger -> snapshot -> reducers ->
// projection chain. Asserts that orders are independent: refunding one order
// must never change another order's status, amount, or total contribution, and
// orders placed after a refund must bill normally.
import { OrderEngine } from '../src/engine.mjs';

let failed = false;
function ok(cond, label) {
  if (!cond) {
    console.error(`FAIL ${label}`);
    failed = true;
  }
}

// --- Case 1: the reported symptom ---
// Two open orders, then refund one. The other must stay billable; total = its amount.
{
  const e = new OrderEngine();
  e.placeOrder('a', 1000);
  e.placeOrder('b', 2000);
  e.refundOrder('a');
  ok(e.orderStatus('a') === 'refunded', "case1: 'a' refunded");
  ok(e.orderStatus('b') === 'open', "case1: 'b' stays open (not touched by a's refund)");
  ok(e.orderAmount('b') === 2000, "case1: 'b' still bills 2000");
  ok(e.orderAmount('a') === 0, "case1: refunded 'a' bills 0");
  ok(e.ordersTotal() === 2000, "case1: total is 2000, not 0");
}

// --- Case 2: order placed AFTER a refund must bill normally ---
{
  const e = new OrderEngine();
  e.placeOrder('a', 1000);
  e.refundOrder('a');
  e.placeOrder('b', 2000); // placed after the refund
  ok(e.orderStatus('b') === 'open', "case2: 'b' placed after a refund is open");
  ok(e.orderAmount('b') === 2000, "case2: 'b' bills its full amount");
  ok(e.ordersTotal() === 2000, "case2: total counts the later order");
}

// --- Case 3: many orders, one refund in the middle, independence holds ---
{
  const e = new OrderEngine();
  e.placeOrder('o1', 500);
  e.placeOrder('o2', 700);
  e.refundOrder('o1');
  e.placeOrder('o3', 300);
  e.placeOrder('o4', 100);
  ok(e.ordersTotal() === 700 + 300 + 100, 'case3: total sums every non-refunded order');
  ok(e.orderStatus('o2') === 'open', "case3: 'o2' unaffected");
  ok(e.orderStatus('o3') === 'open', "case3: 'o3' (placed after refund) open");
  ok(e.orderStatus('o4') === 'open', "case3: 'o4' open");
  ok(e.orderStatus('o1') === 'refunded', "case3: only 'o1' refunded");
}

// --- Case 4: no refunds at all — plain sum (must not regress) ---
{
  const e = new OrderEngine();
  e.placeOrder('x', 1500);
  e.placeOrder('y', 2500);
  ok(e.ordersTotal() === 4000, 'case4: plain total with no refunds');
  ok(e.orderStatus('x') === 'open' && e.orderStatus('y') === 'open', 'case4: both open');
}

// --- Case 5: refunding every order yields total 0 (genuine, not a leak) ---
{
  const e = new OrderEngine();
  e.placeOrder('p', 1000);
  e.placeOrder('q', 2000);
  e.refundOrder('p');
  e.refundOrder('q');
  ok(e.ordersTotal() === 0, 'case5: all refunded -> total 0');
  ok(e.orderAmount('p') === 0 && e.orderAmount('q') === 0, 'case5: both bill 0');
}

if (failed) {
  process.exit(1);
}
console.log('ok');
