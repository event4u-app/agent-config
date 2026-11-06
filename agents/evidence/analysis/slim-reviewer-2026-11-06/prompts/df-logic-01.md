<!-- evidence-type: analysis -->
Scope: src/access/canView.ts
Change (also in `change.diff` in the working directory):
```diff
--- a/src/access/canView.ts
+++ b/src/access/canView.ts
@@ -3,6 +3,6 @@ export function canView(user: User, doc: Doc): boolean {
-  if (user.isAdmin) return true;
-  return doc.ownerId === user.id && doc.tenantId === user.tenantId;
+  if (user.isAdmin) return true;
+  return doc.ownerId === user.id || doc.tenantId === user.tenantId;
```
Requirement: the code under review behaves correctly for every input its signature admits.
Question: is this change ready to ship?

Answer in exactly this format, with nothing after it:
FINDING: <file>:<line> — <severity> — <one-line reason>   (one line per finding; no line if there are none)
VERDICT: READY | NOT READY
