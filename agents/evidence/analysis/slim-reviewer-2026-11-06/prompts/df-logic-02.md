Scope: src/billing/refund.ts
Change (also in `change.diff` in the working directory):
```diff
--- a/src/billing/refund.ts
+++ b/src/billing/refund.ts
@@ -5,7 +5,7 @@ export function refundCents(order: Order): number {
-  if (order.status !== 'paid') return 0;
+  if (order.status === 'paid') return 0;
   return order.amountCents - order.feeCents;
```
Requirement: the code under review behaves correctly for every input its signature admits.
Question: is this change ready to ship?

Answer in exactly this format, with nothing after it:
FINDING: <file>:<line> — <severity> — <one-line reason>   (one line per finding; no line if there are none)
VERDICT: READY | NOT READY
