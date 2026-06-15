# order-ledger

A tiny event-sourced order engine (plain ESM, no dependencies).

## Intended behavior

Orders are tracked as an append-only event log. There are two events:

- **placed** — a new order is created for some amount (integer cents).
- **refund** — an existing order is fully refunded.

Current state is **derived** by replaying the log: events are grouped per order
and folded through the reducers into a small record `{ status, amount }`, where
`status` is `none` (never placed), `open` (placed and billable), or `refunded`
(fully refunded, not billable).

The read side answers three questions against the derived snapshot:

- `orderStatus(id)` → `'none' | 'open' | 'refunded'`
- `orderAmount(id)` → billable cents for one order (`0` if not billable)
- `ordersTotal()` → sum of billable cents across **all** orders

### Rules

- A refunded order is **not** billable: it contributes `0` to the total and its
  `orderAmount` is `0`, but its `orderStatus` stays `'refunded'`.
- An `open` order contributes its full amount to the total.
- Orders are independent: refunding one order must never change another order's
  status, amount, or total contribution.
- The snapshot is memoized by the ledger's version (event count) — appending a
  new event must always be reflected on the next read.

## Layout

| File | Responsibility |
|---|---|
| `engine.mjs` | public facade (`placeOrder`, `refundOrder`, `ordersTotal`, …) |
| `ledger.mjs` | append-only event log + version |
| `events.mjs` | event constructors |
| `clock.mjs` | monotonic seq source |
| `reducers.mjs` | fold events → per-order state |
| `snapshot.mjs` | group + reduce the whole ledger, memoized by version |
| `projection.mjs` | read-side: billable?, amount, total |
| `money.mjs` | integer-cent helpers |

## Usage

```js
import { OrderEngine } from './src/engine.mjs';

const e = new OrderEngine();
e.placeOrder('a', 1000);
e.placeOrder('b', 2000);
e.refundOrder('a');
e.ordersTotal(); // 2000  ('a' refunded, only 'b' billable)
```
