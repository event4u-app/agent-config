Scope: src/parse/toInt.ts
Change (also in `change.diff` in the working directory):
```diff
--- a/src/parse/toInt.ts
+++ b/src/parse/toInt.ts
@@ -1,4 +1,5 @@ export function toInt(s: string): number {
+  // radix pinned to 10 on purpose — leading-zero inputs must not parse as octal
-  return parseInt(s);
+  return parseInt(s, 10);
```
Requirement: the code under review behaves correctly for every input its signature admits.
Question: is this change ready to ship?

Answer in exactly this format, with nothing after it:
FINDING: <file>:<line> — <severity> — <one-line reason>   (one line per finding; no line if there are none)
VERDICT: READY | NOT READY
