Scope: src/util/lastN.ts
Change (also in `change.diff` in the working directory):
```diff
--- a/src/util/lastN.ts
+++ b/src/util/lastN.ts
@@ -2,4 +2,4 @@ export function lastN<T>(xs: T[], n: number): T[] {
-  return xs.slice(Math.max(0, xs.length - n));
+  return xs.slice(Math.max(0, xs.length - n - 1));
```
Requirement: the code under review behaves correctly for every input its signature admits.
Question: is this change ready to ship?

Answer in exactly this format, with nothing after it:
FINDING: <file>:<line> — <severity> — <one-line reason>   (one line per finding; no line if there are none)
VERDICT: READY | NOT READY
