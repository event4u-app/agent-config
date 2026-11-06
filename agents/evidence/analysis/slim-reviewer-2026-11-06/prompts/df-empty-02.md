<!-- evidence-type: analysis -->
Scope: src/report/summary.ts
Change (also in `change.diff` in the working directory):
```diff
--- a/src/report/summary.ts
+++ b/src/report/summary.ts
@@ -4,6 +4,5 @@ export function summarize(rows: Row[]): Summary {
-  if (!rows.length) return { first: null, last: null, count: 0 };
   const sorted = [...rows].sort((a, b) => a.ts - b.ts);
-  return { first: sorted[0], last: sorted[sorted.length - 1], count: rows.length };
+  return { first: sorted[0]!, last: sorted[sorted.length - 1]!, count: rows.length };
```
Requirement: the code under review behaves correctly for every input its signature admits.
Question: is this change ready to ship?

Answer in exactly this format, with nothing after it:
FINDING: <file>:<line> — <severity> — <one-line reason>   (one line per finding; no line if there are none)
VERDICT: READY | NOT READY
