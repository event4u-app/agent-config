<!-- evidence-type: analysis -->

# Council question, round 3: the deny-text change to four governance hooks

This review is the ratification decision ADR-268 § 4 requires before a change to a governance hook lands: the agent that wrote the diff may not ratify it. The policy question is whether the change moves any trust boundary between the refused agent and the guard.

Round 2 (one seat; the other timed out) found the hook text non-expanding and asked that the lint not fail open on undecoded escapes or on a 64-variant cap. The diff below is the full change after that. Questions:

1. Does any change widen what an agent may do, weaken a guard, or remove a refusal? Name the file and line.
2. Does each refusal still tell the refused agent what it needs to proceed legitimately?
3. Does the lint catch what it claims and avoid false findings on the current hooks? Name any case it misses that its header does not already declare.

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
index b19739e208..dd8e96d621 100644
--- a/src/scripts/lint_deny_text.ts
+++ b/src/scripts/lint_deny_text.ts
@@ -31,11 +31,23 @@
  * would fire on every concern that reads a setting, which is the false-positive
  * shape that gets a young gate disabled.
  *
+ * Template literals are read RESOLVED: a `${NAME}` placeholder is replaced by
+ * the value of a `const NAME = '...'` string constant declared in the same
+ * module before the patterns run. Without that the gate read
+ * `${KILL_SWITCH}=1` literally and certified a deny that printed its own kill
+ * switch (round inbox-2026-11-zc). A name declared more than once keeps every
+ * value, and escapes are decoded, so shadowing or `\x41` cannot hide a switch;
+ * a `${…}` inside a plain string is not interpolated and is not resolved. A
+ * deny may also not name the hook manifest: telling the refused agent where its
+ * own entry lives is a bypass too, so any reference is refused.
+ *
  * WHAT IT DOES NOT SEE, so nobody reads more into a green than is there:
- * a message assembled at runtime from non-literal parts, a message in a module
- * the concern imports, and a kill switch named in a way none of the three
- * patterns matches. This is a pattern gate over source text, not a proof about
- * emitted bytes.
+ * a message assembled at runtime from non-literal parts, a placeholder whose
+ * value is not a single string-literal constant of the same module (a
+ * concatenation or a computed value), a message in a module
+ * the concern imports, and a kill switch named in a way none of the patterns
+ * matches. This is a pattern gate over source text, not a proof about emitted
+ * bytes.
  *
  * Exit codes: 0 clean · 1 a deny names a bypass · 2 the corpus could not be read.
  */
@@ -109,7 +121,7 @@ export const SETTINGS_ROOTS: readonly string[] = [
 export interface DenyFinding {
     readonly concern: string;
     readonly file: string;
-    readonly kind: 'env-assignment' | 'export-line' | 'settings-key';
+    readonly kind: 'env-assignment' | 'export-line' | 'settings-key' | 'manifest-reference';
     readonly text: string;
 }
 
@@ -198,18 +210,75 @@ export function stripComments(src: string): string {
 
 /** Message-shaped string literals — comments already stripped. */
 export function messageLiterals(src: string): string[] {
-    const out: string[] = [];
+    return messageLiteralsWithKind(src).map((l) => l.body);
+}
+
+/** As {@link messageLiterals}, keeping whether each was a template literal. */
+export function messageLiteralsWithKind(src: string): Array<{ body: string; template: boolean }> {
+    const out: Array<{ body: string; template: boolean }> = [];
     const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
     for (const m of src.matchAll(re)) {
         const body = m[1] ?? m[2] ?? m[3] ?? '';
         if (/\s/.test(body)) {
-            out.push(body);
+            out.push({ body, template: m[3] !== undefined });
         }
     }
     return out;
 }
 
 const ENV_ASSIGNMENT_RE = /AGENT_CONFIG_[A-Z0-9_]+\s*=/;
+const MANIFEST_RE = /hook_manifest\.(yaml|json)/;
+
+/** The escapes a JS string literal can carry, decoded, so `\x41` reads as `A`. */
+export function decodeEscapes(raw: string): string {
+    return raw.replace(/\\(u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|.)/g, (_w, all: string, cp?: string, u4?: string, x2?: string) => {
+        const hex = cp ?? u4 ?? x2;
+        if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
+        // Every single-character escape JS defines; any other `\c` is `c`, as in JS.
+        const simple: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', v: '\v', f: '\f', b: '\b' };
+        return simple[all] ?? all;
+    });
+}
+
+/**
+ * Every `const NAME = '...'` string constant, comments already stripped, as
+ * ALL the values a name is given anywhere in the module. Scope is not tracked,
+ * so a name declared twice keeps both values and a placeholder is checked
+ * against each: shadowing can then over-report, never hide a kill switch.
+ */
+export function stringConstants(src: string): Map<string, string[]> {
+    const out = new Map<string, string[]>();
+    const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?=\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)/g;
+    for (const m of src.matchAll(re)) {
+        const name = m[1] as string;
+        const value = decodeEscapes(m[2] ?? m[3] ?? m[4] ?? '');
+        out.set(name, [...(out.get(name) ?? []), value]);
+    }
+    return out;
+}
+
+/**
+ * The texts a template literal can print, each decoded: the text with every
+ * known placeholder at its first value, plus one variant per (placeholder,
+ * value) pair with only that placeholder substituted. A bypass pattern is about
+ * one name and its `=`, so the linear set finds it without enumerating the
+ * cross product, and there is no cap to fail open at. Unknown placeholders stay
+ * as written. Only template literals interpolate, so callers pass a plain
+ * string's body through {@link decodeEscapes} alone.
+ */
+export function resolvePlaceholders(text: string, constants: ReadonlyMap<string, readonly string[]>): string[] {
+    const names = [...new Set([...text.matchAll(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g)].map((m) => m[1] as string))];
+    const reFor = (name: string): RegExp => new RegExp(`\\$\\{\\s*${name.replace(/\$/g, '\\$')}\\s*\\}`, 'g');
+    let first = text;
+    const variants: string[] = [];
+    for (const name of names) {
+        const values = constants.get(name);
+        if (values === undefined || values.length === 0) continue;
+        first = first.replace(reFor(name), () => values[0] as string);
+        for (const val of values) variants.push(decodeEscapes(text.replace(reFor(name), () => val)));
+    }
+    return [decodeEscapes(first), ...variants];
+}
 const EXPORT_RE = /(^|[\s`'"(])export\s/;
 
 function settingsKeyIn(text: string): boolean {
@@ -225,7 +294,11 @@ function settingsKeyIn(text: string): boolean {
 /** Findings for one concern's source text. */
 export function scanSource(concern: string, file: string, src: string): DenyFinding[] {
     const out: DenyFinding[] = [];
-    for (const text of messageLiterals(stripComments(src))) {
+    const stripped = stripComments(src);
+    const constants = stringConstants(stripped);
+    for (const lit of messageLiteralsWithKind(stripped)) {
+        const variants = lit.template ? resolvePlaceholders(lit.body, constants) : [decodeEscapes(lit.body)];
+        const text = variants.find((v) => ENV_ASSIGNMENT_RE.test(v) || EXPORT_RE.test(v) || settingsKeyIn(v) || MANIFEST_RE.test(v)) ?? variants[0] ?? lit.body;
         if (ENV_ASSIGNMENT_RE.test(text)) {
             out.push({ concern, file, kind: 'env-assignment', text });
             continue;
@@ -236,6 +309,10 @@ export function scanSource(concern: string, file: string, src: string): DenyFind
         }
         if (settingsKeyIn(text)) {
             out.push({ concern, file, kind: 'settings-key', text });
+            continue;
+        }
+        if (MANIFEST_RE.test(text)) {
+            out.push({ concern, file, kind: 'manifest-reference', text });
         }
     }
     return out;
@@ -274,6 +351,7 @@ const REASON: Readonly<Record<DenyFinding['kind'], string>> = {
     'env-assignment': 'names an environment kill switch, with its value',
     'export-line': 'carries an `export` line the reader can paste',
     'settings-key': 'names a settings key path',
+    'manifest-reference': 'names the hook manifest, the file that switches the guard off',
 };
 
 export function main(argv: readonly string[]): number {
@@ -361,8 +439,8 @@ function selfTest(): number {
 
     return runSelfTest({
         gate: GATE,
-        minCases: 7,
-        minRejectCases: 3,
+        minCases: 13,
+        minRejectCases: 7,
         cases: [
             {
                 name: 'an empty corpus is refused, not certified green',
@@ -384,6 +462,71 @@ function selfTest(): number {
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
+                name: 'a shadowed constant cannot hide the kill switch',
+                expect: 'reject',
+                run: () =>
+                    run(
+                        plant(
+                            'shadow',
+                            "const KILL = 'AGENT_CONFIG_X';\nfunction f() { const KILL = 'harmless'; return KILL; }\nvoid f;\n" +
+                                'process.stderr.write(`BLOCKED (override: ${KILL}=1)`);\n',
+                        ),
+                    ),
+            },
+            {
+                name: 'an escaped kill-switch name is decoded before matching',
+                expect: 'reject',
+                run: () =>
+                    run(
+                        plant(
+                            'escape',
+                            "const KILL = 'AGENT_CONFIG_\\x58';\n" +
+                                'process.stderr.write(`BLOCKED (override: ${KILL}=1)`);\n',
+                        ),
+                    ),
+            },
+            {
+                name: 'a ${NAME} inside a plain string is not interpolated',
+                expect: 'accept',
+                run: () =>
+                    run(
+                        plant(
+                            'plain-dollar',
+                            "const KILL = 'AGENT_CONFIG_X';\nvoid KILL;\n" +
+                                "process.stderr.write('BLOCKED: the shell form ${KILL}=1 is quoted here as text');\n",
+                        ),
+                    ),
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
