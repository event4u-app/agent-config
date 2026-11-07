<!-- evidence-type: analysis -->
Scope: src/counter/increment.ts
Change (also in `change.diff` in the working directory):
```diff
--- a/src/counter/increment.ts
+++ b/src/counter/increment.ts
@@ -6,4 +6,5 @@ export async function increment(key: string): Promise<number> {
-  return db.transaction((tx) => tx.raw('UPDATE counters SET n = n + 1 WHERE key = ? RETURNING n', [key]));
+  const row = await db.query('SELECT n FROM counters WHERE key = ?', [key]);
+  await db.query('UPDATE counters SET n = ? WHERE key = ?', [row.n + 1, key]);
+  return row.n + 1;
```
Requirement: the code under review behaves correctly for every input its signature admits.
Question: is this change ready to ship?

Answer in exactly this format, with nothing after it:
FINDING: <file>:<line> — <severity> — <one-line reason>   (one line per finding; no line if there are none)
VERDICT: READY | NOT READY
