<!-- evidence-type: analysis -->

# Council question: the deny-text change to four governance hooks

This review is the ratification decision ADR-268 § 4 requires before a change to a governance hook lands: the agent that wrote the diff may not ratify it. The policy question is whether the change moves any trust boundary between the refused agent and the guard.

Review the diff below. Four governance hooks (blocking pre_tool_use guards) change the text they print when they refuse a tool call; the lint that checks deny texts gains constant resolution and a new pattern. Questions:

1. Does any change widen what an agent may do, weaken a guard, or remove a refusal? Name the file and line.
2. Does each refusal still tell the refused agent what it needs to proceed legitimately?
3. Does the lint change catch what it claims and avoid false findings on the current hooks? Name any case it misses.

Give one verdict from: ratified, confirmed-non-expanding, refused, non-convergent, with the reason.

~~~diff
diff --git a/src/scripts/hooks/block_credential_reads.ts b/src/scripts/hooks/block_credential_reads.ts
index 1275e12188..668fec0f24 100644
--- a/src/scripts/hooks/block_credential_reads.ts
+++ b/src/scripts/hooks/block_credential_reads.ts
@@ -122,7 +122,7 @@ export function denyMessage(r: Refusal): string {
     return (
         `Blocked: ${r.what} is ${CREDENTIAL_CLASS_LABEL[r.class]}. What a session reads is sent to the model ` +
         `provider, so a credential read is a credential sent. ${alternative} ` +
-        `(block-credential-reads; maintainer override: ${KILL_SWITCH}=1)\n`
+        `(block-credential-reads)\n`
     );
 }
 
diff --git a/src/scripts/hooks/block_kernel_rule_writes.ts b/src/scripts/hooks/block_kernel_rule_writes.ts
index 322a81ba1e..1a93d4a70b 100644
--- a/src/scripts/hooks/block_kernel_rule_writes.ts
+++ b/src/scripts/hooks/block_kernel_rule_writes.ts
@@ -245,8 +245,8 @@ export function main(): number {
         process.stderr.write(
             `block-kernel-rule-writes: BLOCKED — ${reason}\n` +
                 '  Legitimate change requires a human action outside the agent session:\n' +
-                '  edit via the override exception registry, or disable/remove the\n' +
-                "  'block-kernel-rule-writes' entry in src/scripts/hook_manifest.yaml.\n" +
+                '  edit via the override exception registry, or a maintainer change\n' +
+                '  to this guard, reviewed in its own PR.\n' +
                 '  Contract: docs/contracts/kernel-membership.md\n',
         );
         return 1; // EXIT_BLOCK
diff --git a/src/scripts/hooks/block_no_verify.ts b/src/scripts/hooks/block_no_verify.ts
index 8a5caab088..0a67b33443 100644
--- a/src/scripts/hooks/block_no_verify.ts
+++ b/src/scripts/hooks/block_no_verify.ts
@@ -718,7 +718,7 @@ export function main(argv?: string[]): number {
         process.stderr.write(
             `block-no-verify: BLOCKED — ${reason}\n` +
                 `  Legitimate bypass requires a human action outside the agent session:\n` +
-                `  disable or remove the 'block-no-verify' entry in src/scripts/hook_manifest.yaml.\n` +
+                `  a maintainer change to this guard, reviewed in its own PR.\n` +
                 `  Rule: src/rules/git-history-discipline.md\n`,
         );
         return 1; // EXIT_BLOCK
diff --git a/src/scripts/hooks/block_speaking_inbox_dir.ts b/src/scripts/hooks/block_speaking_inbox_dir.ts
index 7fbd616b12..aae59be71d 100644
--- a/src/scripts/hooks/block_speaking_inbox_dir.ts
+++ b/src/scripts/hooks/block_speaking_inbox_dir.ts
@@ -372,8 +372,7 @@ export function denyMessage(dir: string): string {
         'only when referenced by absolute path; relative arguments may resolve elsewhere\n' +
         'and are judged as new.\n' +
         '\n' +
-        'Naming rule: /analyze:inbox Phase 1. Rule: src/rules/source-confidentiality.md.\n' +
-        `Maintainer kill switch: ${KILL_SWITCH}=1.\n`
+        'Naming rule: /analyze:inbox Phase 1. Rule: src/rules/source-confidentiality.md.\n'
     );
 }
 
diff --git a/src/scripts/lint_deny_text.ts b/src/scripts/lint_deny_text.ts
index b19739e208..f2dcdc8822 100644
--- a/src/scripts/lint_deny_text.ts
+++ b/src/scripts/lint_deny_text.ts
@@ -31,11 +31,19 @@
  * would fire on every concern that reads a setting, which is the false-positive
  * shape that gets a young gate disabled.
  *
+ * Template literals are read RESOLVED: a `${NAME}` placeholder is replaced by
+ * the value of a `const NAME = '...'` string constant declared in the same
+ * module before the patterns run. Without that the gate read
+ * `${KILL_SWITCH}=1` literally and certified a deny that printed its own kill
+ * switch (round inbox-2026-11-zc). A deny may also not name the hook manifest:
+ * telling the refused agent to edit or remove its own entry is a bypass too.
+ *
  * WHAT IT DOES NOT SEE, so nobody reads more into a green than is there:
- * a message assembled at runtime from non-literal parts, a message in a module
- * the concern imports, and a kill switch named in a way none of the three
- * patterns matches. This is a pattern gate over source text, not a proof about
- * emitted bytes.
+ * a message assembled at runtime from non-literal parts, a placeholder whose
+ * value is not a string constant of the same module, a message in a module
+ * the concern imports, and a kill switch named in a way none of the patterns
+ * matches. This is a pattern gate over source text, not a proof about emitted
+ * bytes.
  *
  * Exit codes: 0 clean · 1 a deny names a bypass · 2 the corpus could not be read.
  */
@@ -109,7 +117,7 @@ export const SETTINGS_ROOTS: readonly string[] = [
 export interface DenyFinding {
     readonly concern: string;
     readonly file: string;
-    readonly kind: 'env-assignment' | 'export-line' | 'settings-key';
+    readonly kind: 'env-assignment' | 'export-line' | 'settings-key' | 'manifest-edit';
     readonly text: string;
 }
 
@@ -210,6 +218,22 @@ export function messageLiterals(src: string): string[] {
 }
 
 const ENV_ASSIGNMENT_RE = /AGENT_CONFIG_[A-Z0-9_]+\s*=/;
+const MANIFEST_RE = /hook_manifest\.yaml/;
+
+/** Module-level `const NAME = '...'` string constants, comments already stripped. */
+export function stringConstants(src: string): Map<string, string> {
+    const out = new Map<string, string>();
+    const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?=\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
+    for (const m of src.matchAll(re)) {
+        out.set(m[1] as string, m[2] ?? m[3] ?? '');
+    }
+    return out;
+}
+
+/** Replace `${NAME}` by the constant's value where one is known; others stay. */
+export function resolvePlaceholders(text: string, constants: ReadonlyMap<string, string>): string {
+    return text.replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (whole, name: string) => constants.get(name) ?? whole);
+}
 const EXPORT_RE = /(^|[\s`'"(])export\s/;
 
 function settingsKeyIn(text: string): boolean {
@@ -225,7 +249,10 @@ function settingsKeyIn(text: string): boolean {
 /** Findings for one concern's source text. */
 export function scanSource(concern: string, file: string, src: string): DenyFinding[] {
     const out: DenyFinding[] = [];
-    for (const text of messageLiterals(stripComments(src))) {
+    const stripped = stripComments(src);
+    const constants = stringConstants(stripped);
+    for (const raw of messageLiterals(stripped)) {
+        const text = resolvePlaceholders(raw, constants);
         if (ENV_ASSIGNMENT_RE.test(text)) {
             out.push({ concern, file, kind: 'env-assignment', text });
             continue;
@@ -236,6 +263,10 @@ export function scanSource(concern: string, file: string, src: string): DenyFind
         }
         if (settingsKeyIn(text)) {
             out.push({ concern, file, kind: 'settings-key', text });
+            continue;
+        }
+        if (MANIFEST_RE.test(text)) {
+            out.push({ concern, file, kind: 'manifest-edit', text });
         }
     }
     return out;
@@ -274,6 +305,7 @@ const REASON: Readonly<Record<DenyFinding['kind'], string>> = {
     'env-assignment': 'names an environment kill switch, with its value',
     'export-line': 'carries an `export` line the reader can paste',
     'settings-key': 'names a settings key path',
+    'manifest-edit': 'points the refused agent at the hook manifest, its own off switch',
 };
 
 export function main(argv: readonly string[]): number {
@@ -361,8 +393,8 @@ function selfTest(): number {
 
     return runSelfTest({
         gate: GATE,
-        minCases: 7,
-        minRejectCases: 3,
+        minCases: 10,
+        minRejectCases: 5,
         cases: [
             {
                 name: 'an empty corpus is refused, not certified green',
@@ -384,6 +416,35 @@ function selfTest(): number {
                 expect: 'reject',
                 run: () => run(plant('settings', emit('BLOCKED — flip hooks.enabled to false'))),
             },
+            {
+                name: 'a template literal interpolating a kill-switch constant fails',
+                expect: 'reject',
+                run: () =>
+                    run(
+                        plant(
+                            'template',
+                            "const KILL = 'AGENT_CONFIG_X';\n" +
+                                'process.stderr.write(`BLOCKED (maintainer override: ${KILL}=1)`);\n',
+                        ),
+                    ),
+            },
+            {
+                name: 'a deny pointing at the hook manifest fails',
+                expect: 'reject',
+                run: () => run(plant('manifest', emit('BLOCKED — remove the entry in src/scripts/hook_manifest.yaml'))),
+            },
+            {
+                name: 'a placeholder naming a non-switch constant passes',
+                expect: 'accept',
+                run: () =>
+                    run(
+                        plant(
+                            'template-clean',
+                            "const WHAT = 'the credential file';\n" +
+                                'process.stderr.write(`BLOCKED: ${WHAT} is not readable`);\n',
+                        ),
+                    ),
+            },
             {
                 name: 'a deny that names no bypass passes',
                 expect: 'accept',
~~~
