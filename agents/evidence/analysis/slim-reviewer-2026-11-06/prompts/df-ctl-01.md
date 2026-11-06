<!-- evidence-type: analysis -->
Scope: src/util/clamp.ts
Change (also in `change.diff` in the working directory):
```diff
--- a/src/util/clamp.ts
+++ b/src/util/clamp.ts
@@ -1,3 +1,3 @@ export function clamp(x: number, lo: number, hi: number): number {
-  if (x < lo) return lo;
-  if (x > hi) return hi;
-  return x;
+  return Math.min(hi, Math.max(lo, x));
```
Requirement: the code under review behaves correctly for every input its signature admits.
Question: is this change ready to ship?

Answer in exactly this format, with nothing after it:
FINDING: <file>:<line> — <severity> — <one-line reason>   (one line per finding; no line if there are none)
VERDICT: READY | NOT READY
