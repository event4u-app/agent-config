<!-- evidence-type: analysis -->
Scope: src/cache/getOrLoad.ts
Change (also in `change.diff` in the working directory):
```diff
--- a/src/cache/getOrLoad.ts
+++ b/src/cache/getOrLoad.ts
@@ -3,7 +3,9 @@ export async function getOrLoad(key: string): Promise<Val> {
-  return this.inflight[key] ??= this.load(key);
+  if (this.cache[key]) return this.cache[key];
+  const v = await this.load(key);
+  this.cache[key] = v;
+  return v;
```
Requirement: the code under review behaves correctly for every input its signature admits.
Question: is this change ready to ship?

Answer in exactly this format, with nothing after it:
FINDING: <file>:<line> — <severity> — <one-line reason>   (one line per finding; no line if there are none)
VERDICT: READY | NOT READY
