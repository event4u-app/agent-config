Scope: src/search/find.ts
Change (also in `change.diff` in the working directory):
```diff
--- a/src/search/find.ts
+++ b/src/search/find.ts
@@ -3,4 +3,4 @@ export async function find(term: string) {
-  return db.query('SELECT * FROM items WHERE name = ?', [term]);
+  return db.query(`SELECT * FROM items WHERE name = '${term}'`);
```
Requirement: the code under review behaves correctly for every input its signature admits.
Question: is this change ready to ship?

Answer in exactly this format, with nothing after it:
FINDING: <file>:<line> — <severity> — <one-line reason>   (one line per finding; no line if there are none)
VERDICT: READY | NOT READY
