<!-- evidence-type: analysis -->

# Council question, round 4: the deny-text change to four governance hooks

This review is the ratification decision ADR-268 § 4 requires before a change to a governance hook lands: the agent that wrote the diff may not ratify it. The policy question is whether the change moves any trust boundary between the refused agent and the guard.

Round 3 found the hook text non-expanding and named three lint misses: holes that only combine into a switch, line continuations, and escaped placeholders. The diff below is the full change after those. The lint scans the nine blocking concerns in the manifest; on the current tree it reports none, and on the four hooks as they were before this diff it reports one finding each. Questions:

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
index b19739e208..f60832e0e0 100644
--- a/src/scripts/lint_deny_text.ts
+++ b/src/scripts/lint_deny_text.ts
@@ -31,11 +31,25 @@
  * would fire on every concern that reads a setting, which is the false-positive
  * shape that gets a young gate disabled.
  *
+ * Template literals are read RESOLVED: a `${NAME}` placeholder is replaced by
+ * the value of a `const NAME = '...'` string constant declared in the same
+ * module before the patterns run. Without that the gate read
+ * `${KILL_SWITCH}=1` literally and certified a deny that printed its own kill
+ * switch (round inbox-2026-11-zc). A name declared more than once keeps every
+ * value and every combination of holes is enumerated, so shadowing cannot hide
+ * a switch; escapes and line continuations are decoded as JS does; an escaped
+ * `\${` and a `${…}` in a plain string are text, not holes. A template with
+ * more printable variants than the gate enumerates fails rather than passes. A
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
@@ -109,7 +123,7 @@ export const SETTINGS_ROOTS: readonly string[] = [
 export interface DenyFinding {
     readonly concern: string;
     readonly file: string;
-    readonly kind: 'env-assignment' | 'export-line' | 'settings-key';
+    readonly kind: 'env-assignment' | 'export-line' | 'settings-key' | 'manifest-reference' | 'unresolvable';
     readonly text: string;
 }
 
@@ -198,18 +212,24 @@ export function stripComments(src: string): string {
 
 /** Message-shaped string literals — comments already stripped. */
 export function messageLiterals(src: string): string[] {
-    const out: string[] = [];
-    const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
+    return messageLiteralsWithKind(src).map((l) => l.body);
+}
+
+/** As {@link messageLiterals}, keeping whether each was a template literal. */
+export function messageLiteralsWithKind(src: string): Array<{ body: string; template: boolean }> {
+    const out: Array<{ body: string; template: boolean }> = [];
+    const re = /'((?:[^'\\]|\\[\s\S])*)'|"((?:[^"\\]|\\[\s\S])*)"|`((?:[^`\\]|\\[\s\S])*)`/g;
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
 const EXPORT_RE = /(^|[\s`'"(])export\s/;
 
 function settingsKeyIn(text: string): boolean {
@@ -222,10 +242,106 @@ function settingsKeyIn(text: string): boolean {
     return false;
 }
 
+
+/**
+ * Decode a string literal's escapes as JS does, so `\x41` reads as `A` and a
+ * backslash before a line break (a line continuation) disappears.
+ */
+export function decodeEscapes(raw: string): string {
+    return raw.replace(/\\(\r\n|[\s\S])(?:(?<=u)\{([0-9a-fA-F]+)\}|(?<=u)([0-9a-fA-F]{4})|(?<=x)([0-9a-fA-F]{2}))?/g,
+        (whole, c: string, cp?: string, u4?: string, x2?: string) => {
+            const hex = cp ?? u4 ?? x2;
+            if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
+            if (c === '\n' || c === '\r\n' || c === '\r' || c === '\u2028' || c === '\u2029') return '';
+            const simple: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', v: '\v', f: '\f', b: '\b' };
+            void whole;
+            // Every other `\c` is `c`, as in JS.
+            return simple[c] ?? c;
+        });
+}
+
+/**
+ * Every `const NAME = '...'` string constant, comments already stripped, as
+ * ALL the values a name is given anywhere in the module, decoded once. Scope
+ * is not tracked, so a name declared twice keeps both values and a
+ * placeholder is checked against each: shadowing can over-report, never hide.
+ */
+export function stringConstants(src: string): Map<string, string[]> {
+    const out = new Map<string, string[]>();
+    const re = /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::\s*string\s*)?=\s*(?:'((?:[^'\\]|\\[\s\S])*)'|"((?:[^"\\]|\\[\s\S])*)"|`((?:[^`\\$]|\\[\s\S])*)`)/g;
+    for (const m of src.matchAll(re)) {
+        const name = m[1] as string;
+        const value = decodeEscapes(m[2] ?? m[3] ?? m[4] ?? '');
+        out.set(name, [...(out.get(name) ?? []), value]);
+    }
+    return out;
+}
+
+/** Above this many printable variants a template is not certified. */
+export const MAX_VARIANTS = 4096;
+
+/**
+ * Split a template body into decoded literal chunks and `${NAME}` holes. An
+ * escaped `\${` is literal text, as in JS; a hole that is not a bare name
+ * (an expression) is kept as its source text.
+ */
+export function templateParts(body: string): Array<{ text: string } | { name: string }> {
+    const parts: Array<{ text: string } | { name: string }> = [];
+    let raw = '';
+    let i = 0;
+    while (i < body.length) {
+        const c = body[i] as string;
+        if (c === '\\') {
+            raw += body.slice(i, i + 2);
+            i += 2;
+            continue;
+        }
+        if (c === '$' && body[i + 1] === '{') {
+            const end = body.indexOf('}', i + 2);
+            const inner = end === -1 ? '' : body.slice(i + 2, end).trim();
+            if (end !== -1 && /^[A-Za-z_$][\w$]*$/.test(inner)) {
+                parts.push({ text: decodeEscapes(raw) });
+                raw = '';
+                parts.push({ name: inner });
+                i = end + 1;
+                continue;
+            }
+        }
+        raw += c;
+        i += 1;
+    }
+    parts.push({ text: decodeEscapes(raw) });
+    return parts;
+}
+
+/**
+ * Every text a template literal can print, given the constants each hole may
+ * take: the full cross product, with unknown holes kept as `${NAME}`. `null`
+ * when the product exceeds {@link MAX_VARIANTS}, which the caller reports as a
+ * finding: a gate that cannot enumerate does not certify.
+ */
+export function resolvePlaceholders(body: string, constants: ReadonlyMap<string, readonly string[]>): string[] | null {
+    let variants = [''];
+    for (const part of templateParts(body)) {
+        const options = 'text' in part ? [part.text] : (constants.get(part.name) ?? [`\${${part.name}}`]);
+        if (variants.length * options.length > MAX_VARIANTS) return null;
+        variants = variants.flatMap((v) => options.map((o) => v + o));
+    }
+    return variants;
+}
+
 /** Findings for one concern's source text. */
 export function scanSource(concern: string, file: string, src: string): DenyFinding[] {
     const out: DenyFinding[] = [];
-    for (const text of messageLiterals(stripComments(src))) {
+    const stripped = stripComments(src);
+    const constants = stringConstants(stripped);
+    for (const lit of messageLiteralsWithKind(stripped)) {
+        const variants = lit.template ? resolvePlaceholders(lit.body, constants) : [decodeEscapes(lit.body)];
+        if (variants === null) {
+            out.push({ concern, file, kind: 'unresolvable', text: lit.body });
+            continue;
+        }
+        const text = variants.find((v) => ENV_ASSIGNMENT_RE.test(v) || EXPORT_RE.test(v) || settingsKeyIn(v) || MANIFEST_RE.test(v)) ?? variants[0] ?? lit.body;
         if (ENV_ASSIGNMENT_RE.test(text)) {
             out.push({ concern, file, kind: 'env-assignment', text });
             continue;
@@ -236,6 +352,10 @@ export function scanSource(concern: string, file: string, src: string): DenyFind
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
@@ -274,6 +394,8 @@ const REASON: Readonly<Record<DenyFinding['kind'], string>> = {
     'env-assignment': 'names an environment kill switch, with its value',
     'export-line': 'carries an `export` line the reader can paste',
     'settings-key': 'names a settings key path',
+    'manifest-reference': 'names the hook manifest, the file that switches the guard off',
+    unresolvable: `prints more variants than the gate enumerates (${String(MAX_VARIANTS)}), so it cannot be certified`,
 };
 
 export function main(argv: readonly string[]): number {
@@ -361,8 +483,8 @@ function selfTest(): number {
 
     return runSelfTest({
         gate: GATE,
-        minCases: 7,
-        minRejectCases: 3,
+        minCases: 16,
+        minRejectCases: 9,
         cases: [
             {
                 name: 'an empty corpus is refused, not certified green',
@@ -384,6 +506,100 @@ function selfTest(): number {
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
+                name: 'two holes that only together spell a switch fail',
+                expect: 'reject',
+                run: () =>
+                    run(
+                        plant(
+                            'two-holes',
+                            "const A = 'safe';\nfunction f() { const A = 'AGENT_CONFIG_'; const B = 'X'; return A + B; }\nconst B = 'safe';\nvoid f;\n" +
+                                'process.stderr.write(`BLOCKED: ${A}${B}=1`);\n',
+                        ),
+                    ),
+            },
+            {
+                name: 'a line continuation inside the switch name is decoded',
+                expect: 'reject',
+                run: () => run(plant('continuation', 'process.stderr.write(`BLOCKED (AGENT_CONFIG_\\\nX=1)`);\n')),
+            },
+            {
+                name: 'an escaped placeholder prints literal text and is not resolved',
+                expect: 'accept',
+                run: () =>
+                    run(
+                        plant(
+                            'escaped-hole',
+                            "const KILL = 'AGENT_CONFIG_X';\nvoid KILL;\n" +
+                                'process.stderr.write(`BLOCKED: the form \\${KILL} is shown as text`);\n',
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
