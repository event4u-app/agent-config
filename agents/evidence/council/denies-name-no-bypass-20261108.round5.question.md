<!-- evidence-type: analysis -->

# Council question, round 5: the deny-text change to five governance hooks

This review is the ratification decision ADR-268 § 4 requires before a change to a governance hook lands: the agent that wrote the diff may not ratify it. The policy question is whether the change moves any trust boundary between the refused agent and the guard.

Rounds 1-4 found the hook text non-expanding each time and named misses in the lint. After round 4 the lint stopped using regexes over source text and evaluates string expressions from the TypeScript AST. That found a fifth deny naming its manifest entry, also fixed below. The lint scans the nine blocking concerns in the manifest; on the current tree it reports none, and on the hooks as they were before this diff it reports one finding each. Questions:

1. Does any change widen what an agent may do, weaken a guard, or remove a refusal? Name the file and line.
2. Does each refusal still tell the refused agent what it needs to proceed legitimately?
3. Does the lint catch what it claims and avoid false findings on the current hooks? Name any case it misses that its header does not already declare.

Give one verdict from: ratified, confirmed-non-expanding, refused, non-convergent, with the reason.

~~~diff
diff --git a/src/scripts/hooks/block_config_weakening.ts b/src/scripts/hooks/block_config_weakening.ts
index 68ac006807..28e1199fd5 100644
--- a/src/scripts/hooks/block_config_weakening.ts
+++ b/src/scripts/hooks/block_config_weakening.ts
@@ -623,8 +623,7 @@ export function decide(kind: ConfigKind, rel_path: string, session_total: number
                 'LINTER is wrong, not the content. Fix the code or redesign the check; ' +
                 'do not expand the allowlist further.\n' +
                 '  Legitimate override is a human action outside this session: land the ' +
-                'linter redesign, or remove the `block-config-weakening` entry in ' +
-                'src/scripts/hook_manifest.yaml.',
+                'linter redesign, or a maintainer change to this guard, reviewed in its own PR.',
         };
     }
     if (session_total >= SESSION_WARN_AT) {
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
index b19739e208..fced5bea24 100644
--- a/src/scripts/lint_deny_text.ts
+++ b/src/scripts/lint_deny_text.ts
@@ -22,7 +22,8 @@
  * The corpus is the `severity: blocking` concerns in `hook_manifest.yaml`, read
  * from the manifest rather than listed here, so a guard added there joins the
  * corpus without an edit. Within each, the unit is a MESSAGE-SHAPED string
- * literal — comments stripped first, then any literal containing whitespace.
+ * expression, read with the TypeScript parser: each outermost literal,
+ * template or `+` chain, evaluated, and kept when it contains whitespace.
  *
  * The prose test is the discriminator, and it is what makes the settings-key
  * rule usable at all: `'hooks.enabled'` as a lookup key is how a concern reads
@@ -31,11 +32,23 @@
  * would fire on every concern that reads a setting, which is the false-positive
  * shape that gets a young gate disabled.
  *
+ * Messages are read RESOLVED: a template hole or a `+` operand naming a `const`
+ * string in the same module takes that constant's value before the patterns
+ * run. Without that the gate read `${KILL_SWITCH}=1` literally and certified a
+ * deny that printed its own kill switch (round inbox-2026-11-zc). Every value a
+ * name is given anywhere is kept and every combination is checked, so
+ * shadowing cannot hide a switch; escapes, line continuations and an escaped
+ * `\${` are the parser's own cooked text. A message with more variants than
+ * the gate enumerates fails rather than passes. A deny may also not name the
+ * hook manifest: telling the refused agent where its own entry lives is a
+ * bypass too, so any reference is refused.
+ *
  * WHAT IT DOES NOT SEE, so nobody reads more into a green than is there:
- * a message assembled at runtime from non-literal parts, a message in a module
- * the concern imports, and a kill switch named in a way none of the three
- * patterns matches. This is a pattern gate over source text, not a proof about
- * emitted bytes.
+ * a message assembled at runtime from non-literal parts (a call, a property,
+ * an imported value or a `let`), a message in a module
+ * the concern imports, and a kill switch named in a way none of the patterns
+ * matches. This is a pattern gate over parsed source, not a proof about emitted
+ * bytes.
  *
  * Exit codes: 0 clean · 1 a deny names a bypass · 2 the corpus could not be read.
  */
@@ -46,6 +59,7 @@ import path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
 import * as yaml from 'js-yaml';
+import ts from 'typescript';
 
 import { GateLedger } from './_lib/gate_ledger.js';
 import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
@@ -109,123 +123,153 @@ export const SETTINGS_ROOTS: readonly string[] = [
 export interface DenyFinding {
     readonly concern: string;
     readonly file: string;
-    readonly kind: 'env-assignment' | 'export-line' | 'settings-key';
+    readonly kind: 'env-assignment' | 'export-line' | 'settings-key' | 'manifest-reference' | 'unresolvable';
     readonly text: string;
 }
 
+const ENV_ASSIGNMENT_RE = /AGENT_CONFIG_[A-Z0-9_]+\s*=/;
+const MANIFEST_RE = /hook_manifest\.(yaml|json)/;
+const EXPORT_RE = /(^|[\s`'"(])export\s/;
+
+function settingsKeyIn(text: string): boolean {
+    for (const root of SETTINGS_ROOTS) {
+        const re = new RegExp(`(^|[^A-Za-z0-9_.])${root}\\.[a-z][a-z0-9_]*`);
+        if (re.test(text)) {
+            return true;
+        }
+    }
+    return false;
+}
+
+/** Above this many printable variants a message is not certified. */
+export const MAX_VARIANTS = 4096;
+
 /**
- * Characters after which a `/` begins a REGEX literal rather than a division.
- *
- * Regex handling is not a nicety here, it is the difference between a working
- * gate and a nonsense one — measured on the first run against the real tree.
- * `turn_end_gate_hook.ts` carries `/\bI (wi)ll\b/i`; without this the
- * apostrophe inside a pattern like `/\bI'll\b/` opens a phantom string literal
- * that swallows the next few hundred characters of real code and comments, and
- * the gate then reports `export function …` as deny text. Three such
- * false positives, all in one file, all from one unhandled token class.
+ * Every string a `const` declarator in the module is initialised with, by
+ * name, at any scope and for every declarator of a list. Scope is not tracked:
+ * a name declared twice keeps both values, so shadowing can over-report and
+ * never hide a switch.
  */
-const REGEX_PRECEDERS = new Set('(,=:[!&|?{};+-*%~^<>'.split(''));
+export function stringConstants(sf: ts.SourceFile): Map<string, string[]> {
+    // Three passes so a constant built from other constants resolves too.
+    let known = new Map<string, string[]>();
+    for (let pass = 0; pass < 3; pass += 1) {
+        known = collectConstants(sf, known);
+    }
+    return known;
+}
 
-/** Strip `//` and block comments, preserving string literals and regexes. */
-export function stripComments(src: string): string {
-    let out = '';
-    let i = 0;
-    let quote: string | null = null;
-    let lastSignificant = '';
-    while (i < src.length) {
-        const c = src[i] as string;
-        const next = src[i + 1];
-        if (quote !== null) {
-            out += c;
-            if (c === '\\') {
-                out += src[i + 1] ?? '';
-                i += 2;
-                continue;
-            }
-            if (c === quote) {
-                quote = null;
-            }
-            i += 1;
-            continue;
-        }
-        if (c === "'" || c === '"' || c === '`') {
-            quote = c;
-            out += c;
-            i += 1;
-            lastSignificant = c;
-            continue;
-        }
-        if (c === '/' && next === '/') {
-            while (i < src.length && src[i] !== '\n') i += 1;
-            continue;
-        }
-        if (c === '/' && next === '*') {
-            i += 2;
-            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
-            i += 2;
-            continue;
-        }
-        if (c === '/' && (lastSignificant === '' || REGEX_PRECEDERS.has(lastSignificant))) {
-            // Regex literal — consumed whole, emitted as a placeholder so the
-            // scanner below never sees its contents as a message.
-            i += 1;
-            let inClass = false;
-            while (i < src.length) {
-                const r = src[i] as string;
-                if (r === '\\') {
-                    i += 2;
-                    continue;
-                }
-                if (r === '[') inClass = true;
-                else if (r === ']') inClass = false;
-                else if (r === '/' && !inClass) break;
-                else if (r === '\n') break;
-                i += 1;
+function collectConstants(sf: ts.SourceFile, known: ReadonlyMap<string, readonly string[]>): Map<string, string[]> {
+    const out = new Map<string, string[]>();
+    const visit = (node: ts.Node): void => {
+        if (
+            ts.isVariableDeclarationList(node) &&
+            (node.flags & ts.NodeFlags.Const) !== 0
+        ) {
+            for (const decl of node.declarations) {
+                if (!ts.isIdentifier(decl.name) || decl.initializer === undefined) continue;
+                const values = evaluate(decl.initializer, known, 0);
+                if (values === null || values.some((v) => v.includes('\u0000HOLE'))) continue;
+                const name = decl.name.text;
+                out.set(name, [...new Set([...(out.get(name) ?? []), ...values])]);
             }
-            i += 1;
-            out += '0';
-            lastSignificant = '0';
-            continue;
         }
-        out += c;
-        i += 1;
-        if (!/\s/.test(c)) {
-            lastSignificant = c;
-        }
-    }
+        ts.forEachChild(node, visit);
+    };
+    visit(sf);
     return out;
 }
 
-/** Message-shaped string literals — comments already stripped. */
-export function messageLiterals(src: string): string[] {
-    const out: string[] = [];
-    const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
-    for (const m of src.matchAll(re)) {
-        const body = m[1] ?? m[2] ?? m[3] ?? '';
-        if (/\s/.test(body)) {
-            out.push(body);
+/**
+ * The texts an expression can evaluate to, from string literals, templates,
+ * `+` concatenation and identifiers bound to known constants. Anything else
+ * becomes a marked hole, kept as its source text. `null` when the variants
+ * exceed {@link MAX_VARIANTS}. String escapes, line continuations and an
+ * escaped `\${` are already resolved by the parser's cooked text.
+ */
+function evaluate(node: ts.Expression, constants: ReadonlyMap<string, readonly string[]>, depth: number): string[] | null {
+    const join = (left: string[] | null, right: string[] | null): string[] | null => {
+        if (left === null || right === null || left.length * right.length > MAX_VARIANTS) return null;
+        return left.flatMap((l) => right.map((r) => l + r));
+    };
+    const hole = (n: ts.Node): string[] => [`\u0000HOLE\${${n.getText()}}`];
+    if (depth > 64) return hole(node);
+    if (ts.isParenthesizedExpression(node)) return evaluate(node.expression, constants, depth + 1);
+    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
+    if (ts.isTemplateExpression(node)) {
+        let acc: string[] | null = [node.head.text];
+        for (const span of node.templateSpans) {
+            acc = join(acc, evaluate(span.expression, constants, depth + 1));
+            acc = join(acc, [span.literal.text]);
         }
+        return acc;
     }
-    return out;
+    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
+        return join(evaluate(node.left, constants, depth + 1), evaluate(node.right, constants, depth + 1));
+    }
+    if (ts.isIdentifier(node)) {
+        const values = constants.get(node.text);
+        return values !== undefined && values.length > 0 ? [...values] : hole(node);
+    }
+    return hole(node);
 }
 
-const ENV_ASSIGNMENT_RE = /AGENT_CONFIG_[A-Z0-9_]+\s*=/;
-const EXPORT_RE = /(^|[\s`'"(])export\s/;
+/** A string-bearing expression that is not itself part of a larger one. */
+function isOutermostString(node: ts.Node): node is ts.Expression {
+    const stringy =
+        ts.isStringLiteral(node) ||
+        ts.isNoSubstitutionTemplateLiteral(node) ||
+        ts.isTemplateExpression(node) ||
+        (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken);
+    if (!stringy) return false;
+    let parent = node.parent;
+    while (parent !== undefined && ts.isParenthesizedExpression(parent)) parent = parent.parent;
+    if (parent === undefined) return true;
+    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.PlusToken) return false;
+    if (ts.isTemplateSpan(parent)) return false;
+    // Module specifiers and property names are not output.
+    if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isPropertyAssignment(parent) && parent.name === node) return false;
+    return true;
+}
 
-function settingsKeyIn(text: string): boolean {
-    for (const root of SETTINGS_ROOTS) {
-        const re = new RegExp(`(^|[^A-Za-z0-9_.])${root}\\.[a-z][a-z0-9_]*`);
-        if (re.test(text)) {
-            return true;
+/**
+ * Every message a module can print from literal parts: each outermost string
+ * expression, evaluated to all its variants, kept when a variant is
+ * message-shaped (contains whitespace). The shape test runs AFTER resolution,
+ * so a template whose own text is bare still counts once its holes fill in.
+ * `null` marks an expression with too many variants to certify.
+ */
+export function messageTexts(src: string, fileName = 'concern.ts'): Array<string[] | null> {
+    const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
+    const constants = stringConstants(sf);
+    const out: Array<string[] | null> = [];
+    const visit = (node: ts.Node): void => {
+        if (isOutermostString(node)) {
+            const variants = evaluate(node, constants, 0);
+            if (variants === null) {
+                out.push(null);
+            } else {
+                const texts = variants.map((v) => v.replace(/\u0000HOLE/g, ''));
+                if (texts.some((t) => /\s/.test(t))) out.push(texts);
+            }
         }
-    }
-    return false;
+        ts.forEachChild(node, visit);
+    };
+    visit(sf);
+    return out;
 }
 
 /** Findings for one concern's source text. */
 export function scanSource(concern: string, file: string, src: string): DenyFinding[] {
     const out: DenyFinding[] = [];
-    for (const text of messageLiterals(stripComments(src))) {
+    for (const variants of messageTexts(src, file)) {
+        if (variants === null) {
+            out.push({ concern, file, kind: 'unresolvable', text: '(too many variants)' });
+            continue;
+        }
+        const text =
+            variants.find((v) => ENV_ASSIGNMENT_RE.test(v) || EXPORT_RE.test(v) || settingsKeyIn(v) || MANIFEST_RE.test(v)) ??
+            (variants[0] as string);
         if (ENV_ASSIGNMENT_RE.test(text)) {
             out.push({ concern, file, kind: 'env-assignment', text });
             continue;
@@ -236,6 +280,10 @@ export function scanSource(concern: string, file: string, src: string): DenyFind
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
@@ -274,6 +322,8 @@ const REASON: Readonly<Record<DenyFinding['kind'], string>> = {
     'env-assignment': 'names an environment kill switch, with its value',
     'export-line': 'carries an `export` line the reader can paste',
     'settings-key': 'names a settings key path',
+    'manifest-reference': 'names the hook manifest, the file that switches the guard off',
+    unresolvable: `prints more variants than the gate enumerates (${String(MAX_VARIANTS)}), so it cannot be certified`,
 };
 
 export function main(argv: readonly string[]): number {
@@ -361,8 +411,8 @@ function selfTest(): number {
 
     return runSelfTest({
         gate: GATE,
-        minCases: 7,
-        minRejectCases: 3,
+        minCases: 19,
+        minRejectCases: 12,
         cases: [
             {
                 name: 'an empty corpus is refused, not certified green',
@@ -384,6 +434,117 @@ function selfTest(): number {
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
+                name: 'a bare template becomes a message once its hole fills in',
+                expect: 'reject',
+                run: () =>
+                    run(plant('bare-template', "const DENY = 'Blocked: AGENT_CONFIG_X';\nprocess.stderr.write(`${DENY}=1`);\n")),
+            },
+            {
+                name: 'every declarator of a const list is collected',
+                expect: 'reject',
+                run: () =>
+                    run(plant('declarators', "const A = 'AGENT_CONFIG_', B = 'X';\nprocess.stderr.write(`Blocked: ${A}${B}=1`);\n")),
+            },
+            {
+                name: 'a switch split across a + chain is joined before matching',
+                expect: 'reject',
+                run: () => run(plant('concat', "process.stderr.write('Blocked: AGENT_CONFIG_' +\n    'X=1 to skip');\n")),
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
