<!-- evidence-type: analysis -->
Scope: src/auth/login.ts
Change (also in `change.diff` in the working directory):
```diff
--- a/src/auth/login.ts
+++ b/src/auth/login.ts
@@ -7,3 +7,4 @@ export async function login(email: string, pw: string) {
   const user = await users.byEmail(email);
+  logger.info('login attempt', { email, pw });
   return verify(user, pw);
```
Requirement: the code under review behaves correctly for every input its signature admits.
Question: is this change ready to ship?

Answer in exactly this format, with nothing after it:
FINDING: <file>:<line> — <severity> — <one-line reason>   (one line per finding; no line if there are none)
VERDICT: READY | NOT READY
