Scope: src/ui/Avg.tsx
Change (also in `change.diff` in the working directory):
```diff
--- a/src/ui/Avg.tsx
+++ b/src/ui/Avg.tsx
@@ -2,4 +2,4 @@ export function Avg({ scores }: { scores: number[] }) {
-  if (scores.length === 0) return <span>—</span>;
-  return <span>{scores.reduce((a, b) => a + b, 0) / scores.length}</span>;
+  return <span>{scores.reduce((a, b) => a + b, 0) / scores.length}</span>;
```
Requirement: the code under review behaves correctly for every input its signature admits.
Question: is this change ready to ship?

Answer in exactly this format, with nothing after it:
FINDING: <file>:<line> — <severity> — <one-line reason>   (one line per finding; no line if there are none)
VERDICT: READY | NOT READY
