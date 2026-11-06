<!-- evidence-type: analysis -->
Scope: src/pager/pageRange.ts
Change (also in `change.diff` in the working directory):
```diff
--- a/src/pager/pageRange.ts
+++ b/src/pager/pageRange.ts
@@ -4,5 +4,5 @@ export function pageRange(total: number, size: number): number {
-  return Math.ceil(total / size);
+  return Math.floor(total / size);
```
Requirement: the code under review behaves correctly for every input its signature admits.
Question: is this change ready to ship?

Answer in exactly this format, with nothing after it:
FINDING: <file>:<line> — <severity> — <one-line reason>   (one line per finding; no line if there are none)
VERDICT: READY | NOT READY
