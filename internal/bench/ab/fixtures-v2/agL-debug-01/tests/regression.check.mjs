// HELD-OUT regression check (not named in the prompt). Locks pre-existing
// invariants a careless fix might break while chasing the reported symptom:
//
//  1. Snapshot memoization stays correct: appending an event is always
//     reflected on the very next read (the version-keyed cache invalidates).
//  2. Reading does not corrupt state: repeated reads return stable results.
//  3. A refunded order RETAINS its original amount in the raw snapshot state
//     (it bills 0, but the recorded amount is preserved for reporting), and an
//     'open' order's amount is exactly what was placed.
import { OrderEngine } from '../src/engine.mjs';
import { Ledger } from '../src/ledger.mjs';
import { SnapshotBuilder } from '../src/snapshot.mjs';
import { placed, refund } from '../src/events.mjs';

let failed = false;
function ok(cond, label) {
  if (!cond) {
    console.error(`FAIL ${label}`);
    failed = true;
  }
}

// --- Invariant 1: cache invalidates on every append ---
{
  const e = new OrderEngine();
  e.placeOrder('a', 1000);
  ok(e.ordersTotal() === 1000, 'cache: first read sees 1000');
  e.placeOrder('b', 2000); // appended after a read was cached
  ok(e.ordersTotal() === 3000, 'cache: read after append reflects new event');
  e.refundOrder('a');
  ok(e.ordersTotal() === 2000, 'cache: read after refund reflects it');
}

// --- Invariant 2: reads are idempotent / non-mutating ---
{
  const e = new OrderEngine();
  e.placeOrder('a', 1000);
  e.placeOrder('b', 2000);
  const first = e.ordersTotal();
  const second = e.ordersTotal();
  const third = e.ordersTotal();
  ok(first === 2000 + 1000 - 0 && first === second && second === third, 'reads stable across calls');
  ok(e.orderStatus('a') === 'open' && e.orderStatus('b') === 'open', 'reads did not mutate status');
}

// --- Invariant 3: raw snapshot retains amount on refund ---
{
  const ledger = new Ledger();
  ledger.append(placed('a', 1000));
  ledger.append(placed('b', 2000));
  ledger.append(refund('a'));
  const snap = new SnapshotBuilder(ledger).build();
  ok(snap.get('a').status === 'refunded', 'raw: a refunded');
  ok(snap.get('a').amount === 1000, 'raw: refunded order keeps its original amount (1000)');
  ok(snap.get('b').status === 'open', 'raw: b open');
  ok(snap.get('b').amount === 2000, 'raw: open order amount is exactly what was placed');
}

if (failed) {
  process.exit(1);
}
console.log('ok');
