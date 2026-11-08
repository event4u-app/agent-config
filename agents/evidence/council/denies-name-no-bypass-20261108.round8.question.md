<!-- evidence-type: analysis -->

# Council question, round 8: the deny-text change to five governance hooks

This review is the ratification decision ADR-268 § 4 requires before a change to a governance hook lands: the agent that wrote the diff may not ratify it. The policy question is whether the change moves any trust boundary between the refused agent and the guard.

Rounds 1-7 found the hook text non-expanding each time and named misses in the lint. Round 7 named declaration-order masking, destructuring through an alias, and numeric coercion; each now has a regression case. The diff below is the full change. The lint scans the nine blocking concerns in the manifest; on the current tree it reports none, and on the hooks as they were before this diff it reports one finding each. Questions:

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
index b19739e208..f43803afdd 100644
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
@@ -31,11 +32,28 @@
  * would fire on every concern that reads a setting, which is the false-positive
  * shape that gets a young gate disabled.
  *
+ * Messages are read RESOLVED: a template hole or a `+` operand naming a `const`
+ * string in the same module takes that constant's value before the patterns
+ * run. Without that the gate read `${KILL_SWITCH}=1` literally and certified a
+ * deny that printed its own kill switch (round inbox-2026-11-zc). Every value a
+ * name is given anywhere is kept, constants built from constants resolve to a
+ * fixed point, type assertions are seen through, and every combination is
+ * checked, so
+ * shadowing cannot hide a switch; escapes, line continuations and an escaped
+ * `\${` are the parser's own cooked text. A message with more variants than
+ * the gate enumerates, nested deeper than it evaluates, or using a `const`
+ * whose initializer is fixed at author time yet not evaluable here (a
+ * destructuring pattern over literals, say), fails rather than passes. A deny may also not name the
+ * hook manifest: telling the refused agent where its own entry lives is a
+ * bypass too, so any reference is refused.
+ *
  * WHAT IT DOES NOT SEE, so nobody reads more into a green than is there:
- * a message assembled at runtime from non-literal parts, a message in a module
- * the concern imports, and a kill switch named in a way none of the three
- * patterns matches. This is a pattern gate over source text, not a proof about
- * emitted bytes.
+ * text a message takes from a value not fixed at author time (a call, a
+ * property read, an imported value, a `let`, a parameter, or a `const` built
+ * from any of these), which the gate keeps as a hole, a message in a module
+ * the concern imports, and a kill switch named in a way none of the patterns
+ * matches. This is a pattern gate over parsed source, not a proof about emitted
+ * bytes.
  *
  * Exit codes: 0 clean · 1 a deny names a bypass · 2 the corpus could not be read.
  */
@@ -46,6 +64,7 @@ import path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
 import * as yaml from 'js-yaml';
+import ts from 'typescript';
 
 import { GateLedger } from './_lib/gate_ledger.js';
 import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
@@ -109,123 +128,252 @@ export const SETTINGS_ROOTS: readonly string[] = [
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
-
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
+export function stringConstants(sf: ts.SourceFile): Map<string, string[]> {
+    // To a fixed point, so a chain of constants of any length resolves. Each pass
+    // can only add values, so it settles within one pass per declaration.
+    let declarators = 0;
+    const count = (node: ts.Node): void => {
+        if (ts.isVariableDeclaration(node)) declarators += 1;
+        ts.forEachChild(node, count);
+    };
+    count(sf);
+    let known = new Map<string, string[]>();
+    for (let pass = 0; pass <= declarators + 1; pass += 1) {
+        const next = collectConstants(sf, known);
+        if (sameConstants(known, next)) return next;
+        known = next;
+    }
+    return known;
+}
+
+function sameConstants(a: ReadonlyMap<string, readonly string[]>, b: ReadonlyMap<string, readonly string[]>): boolean {
+    if (a.size !== b.size) return false;
+    for (const [k, v] of a) {
+        const w = b.get(k);
+        if (w === undefined || w.length !== v.length || w.some((x, i) => x !== v[i])) return false;
+    }
+    return true;
+}
+
+function collectConstants(sf: ts.SourceFile, known: ReadonlyMap<string, readonly string[]>): Map<string, string[]> {
+    const out = new Map<string, string[]>();
+    // Names with any declaration the gate cannot read. Applied after the walk,
+    // so declaration order cannot let a readable twin mask one.
+    const poisoned = new Set<string>();
+    const visit = (node: ts.Node): void => {
+        if (
+            ts.isVariableDeclarationList(node) &&
+            (node.flags & ts.NodeFlags.Const) !== 0
+        ) {
+            for (const decl of node.declarations) {
+                if (decl.initializer === undefined) continue;
+                // A const whose initializer carries literal text but does not
+                // evaluate (a destructuring pattern, an unsupported form, a
+                // too-large product) is recorded EMPTY: a message using it is
+                // then unresolvable, never certified. A const with no literal
+                // text at all is runtime assembly and stays a hole.
+                const literal = staticLiteralInit(decl.initializer, known);
+                if (!ts.isIdentifier(decl.name)) {
+                    if (literal) for (const name of boundNames(decl.name)) poisoned.add(name);
                     continue;
                 }
-                if (r === '[') inClass = true;
-                else if (r === ']') inClass = false;
-                else if (r === '/' && !inClass) break;
-                else if (r === '\n') break;
-                i += 1;
+                const name = decl.name.text;
+                const values = evaluate(decl.initializer, known, 0);
+                if (values === null || values.some((v) => v.includes('\u0000HOLE'))) {
+                    if (values === null || literal) poisoned.add(name);
+                    continue;
+                }
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
+    for (const name of poisoned) out.set(name, []);
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
+ * Is the initializer fixed at author time — built only from literals, array and
+ * object literals, operators, type assertions and constants already known — and
+ * does it carry string text? Such a value is the author's text however it is
+ * shaped, so one the gate cannot evaluate must not pass. Anything reaching a
+ * call, a property read or an unknown name is runtime assembly.
+ */
+function staticLiteralInit(node: ts.Node, known: ReadonlyMap<string, readonly string[]>): boolean {
+    let text = false;
+    const isStatic = (n: ts.Node): boolean => {
+        if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
+            text = true;
+            return true;
         }
-    }
-    return out;
+        if (ts.isNumericLiteral(n) || n.kind === ts.SyntaxKind.TrueKeyword || n.kind === ts.SyntaxKind.FalseKeyword || n.kind === ts.SyntaxKind.NullKeyword) return true;
+        if (ts.isIdentifier(n)) {
+            // A known constant is text by construction (or unreadable text).
+            if (known.has(n.text)) text = true;
+            return known.has(n.text);
+        }
+        if (
+            ts.isTemplateExpression(n) || ts.isTemplateSpan(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) ||
+            ts.isArrayLiteralExpression(n) || ts.isObjectLiteralExpression(n) || ts.isPropertyAssignment(n) ||
+            ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) ||
+            ts.isTypeAssertionExpression(n) || ts.isNonNullExpression(n) || ts.isBinaryExpression(n) ||
+            ts.isConditionalExpression(n) || ts.isSpreadElement(n) || ts.isTypeNode(n) || ts.isToken(n)
+        ) {
+            if (ts.isPropertyAssignment(n)) return isStatic(n.initializer);
+            return ts.forEachChild(n, (c) => (isStatic(c) ? undefined : true)) !== true;
+        }
+        return false;
+    };
+    return isStatic(node) && text;
 }
 
-const ENV_ASSIGNMENT_RE = /AGENT_CONFIG_[A-Z0-9_]+\s*=/;
-const EXPORT_RE = /(^|[\s`'"(])export\s/;
+/** Every identifier a binding pattern binds. */
+function boundNames(name: ts.BindingName): string[] {
+    if (ts.isIdentifier(name)) return [name.text];
+    return name.elements.flatMap((el) => (ts.isOmittedExpression(el) ? [] : boundNames(el.name)));
+}
 
-function settingsKeyIn(text: string): boolean {
-    for (const root of SETTINGS_ROOTS) {
-        const re = new RegExp(`(^|[^A-Za-z0-9_.])${root}\\.[a-z][a-z0-9_]*`);
-        if (re.test(text)) {
-            return true;
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
+    // Past the budget the expression is uncertified, never a silent hole.
+    if (depth > 256) return null;
+    if (
+        ts.isParenthesizedExpression(node) ||
+        ts.isAsExpression(node) ||
+        ts.isSatisfiesExpression(node) ||
+        ts.isTypeAssertionExpression(node) ||
+        ts.isNonNullExpression(node)
+    ) {
+        return evaluate(node.expression, constants, depth + 1);
+    }
+    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
+    // Primitives coerce to text inside a concatenation or a template.
+    if (ts.isNumericLiteral(node)) return [String(Number(node.text))];
+    if (node.kind === ts.SyntaxKind.TrueKeyword) return ['true'];
+    if (node.kind === ts.SyntaxKind.FalseKeyword) return ['false'];
+    if (node.kind === ts.SyntaxKind.NullKeyword) return ['null'];
+    if (ts.isTemplateExpression(node)) {
+        let acc: string[] | null = [node.head.text];
+        for (const span of node.templateSpans) {
+            acc = join(acc, evaluate(span.expression, constants, depth + 1));
+            acc = join(acc, [span.literal.text]);
         }
+        return acc;
     }
-    return false;
+    if (ts.isConditionalExpression(node)) {
+        const a = evaluate(node.whenTrue, constants, depth + 1);
+        const b = evaluate(node.whenFalse, constants, depth + 1);
+        if (a === null || b === null || a.length + b.length > MAX_VARIANTS) return null;
+        return [...a, ...b];
+    }
+    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
+        return join(evaluate(node.left, constants, depth + 1), evaluate(node.right, constants, depth + 1));
+    }
+    if (ts.isIdentifier(node)) {
+        const values = constants.get(node.text);
+        if (values === undefined) return hole(node);
+        return values.length > 0 ? [...values] : null;
+    }
+    return hole(node);
+}
+
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
+
+/**
+ * Every message a module can print from literal parts: each outermost string
+ * expression, evaluated to all its variants, kept when a variant is
+ * message-shaped (contains whitespace). The shape test runs AFTER resolution,
+ * so a template whose own text is bare still counts once its holes fill in.
+ * `null` marks an expression with too many variants to certify.
+ */
+export function messageTexts(src: string, fileName = 'concern.ts'): Array<{ variants: string[] | null; at: string }> {
+    const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
+    const constants = stringConstants(sf);
+    const out: Array<{ variants: string[] | null; at: string }> = [];
+    const visit = (node: ts.Node): void => {
+        if (isOutermostString(node)) {
+            const variants = evaluate(node, constants, 0);
+            const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
+            const at = `line ${String(line)}: ${node.getText(sf).replace(/\s+/g, ' ').slice(0, 80)}`;
+            if (variants === null) {
+                out.push({ variants: null, at });
+            } else {
+                const texts = variants.map((v) => v.replace(/\u0000HOLE/g, ''));
+                if (texts.some((t) => /\s/.test(t))) out.push({ variants: texts, at });
+            }
+        }
+        ts.forEachChild(node, visit);
+    };
+    visit(sf);
+    return out;
 }
 
 /** Findings for one concern's source text. */
 export function scanSource(concern: string, file: string, src: string): DenyFinding[] {
     const out: DenyFinding[] = [];
-    for (const text of messageLiterals(stripComments(src))) {
+    for (const { variants, at } of messageTexts(src, file)) {
+        if (variants === null) {
+            out.push({ concern, file, kind: 'unresolvable', text: at });
+            continue;
+        }
+        const text =
+            variants.find((v) => ENV_ASSIGNMENT_RE.test(v) || EXPORT_RE.test(v) || settingsKeyIn(v) || MANIFEST_RE.test(v)) ??
+            (variants[0] as string);
         if (ENV_ASSIGNMENT_RE.test(text)) {
             out.push({ concern, file, kind: 'env-assignment', text });
             continue;
@@ -236,6 +384,10 @@ export function scanSource(concern: string, file: string, src: string): DenyFind
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
@@ -274,6 +426,8 @@ const REASON: Readonly<Record<DenyFinding['kind'], string>> = {
     'env-assignment': 'names an environment kill switch, with its value',
     'export-line': 'carries an `export` line the reader can paste',
     'settings-key': 'names a settings key path',
+    'manifest-reference': 'names the hook manifest, the file that switches the guard off',
+    unresolvable: 'uses literal text the gate cannot evaluate (too many variants, too deep, or a const it cannot read), so it cannot be certified',
 };
 
 export function main(argv: readonly string[]): number {
@@ -361,8 +515,8 @@ function selfTest(): number {
 
     return runSelfTest({
         gate: GATE,
-        minCases: 7,
-        minRejectCases: 3,
+        minCases: 28,
+        minRejectCases: 20,
         cases: [
             {
                 name: 'an empty corpus is refused, not certified green',
@@ -384,6 +538,183 @@ function selfTest(): number {
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
+                name: 'a chain of four constants still resolves',
+                expect: 'reject',
+                run: () =>
+                    run(
+                        plant(
+                            'const-chain',
+                            "const A = 'AGENT_CONFIG_';\nconst B = A;\nconst C = B;\nconst D = C;\n" +
+                                'process.stderr.write(`Blocked: ${D}X=1`);\n',
+                        ),
+                    ),
+            },
+            {
+                name: 'a + chain deeper than the evaluation budget fails, not passes',
+                expect: 'reject',
+                run: () =>
+                    run(
+                        plant(
+                            'deep-chain',
+                            "process.stderr.write('Blocked: AGENT_CONFIG_' + " + "'' + ".repeat(300) + "'X=1');\n",
+                        ),
+                    ),
+            },
+            {
+                name: 'a long constant chain inside one function still resolves',
+                expect: 'reject',
+                run: () => {
+                    const chain = Array.from({ length: 101 }, (_, i) => (i === 0 ? "    const A0 = 'AGENT_CONFIG_';" : `    const A${String(i)} = A${String(i - 1)};`));
+                    return run(plant('fn-chain', `function deny() {\n${chain.join('\n')}\n    process.stderr.write(\`Blocked: \${A100}X=1\`);\n}\nvoid deny;\n`));
+                },
+            },
+            {
+                name: 'a type assertion does not hide a constant',
+                expect: 'reject',
+                run: () =>
+                    run(plant('as-const', "const PREFIX = 'AGENT_CONFIG_' as const;\nprocess.stderr.write(`Blocked: ${PREFIX}X=1`);\n")),
+            },
+            {
+                name: 'a destructured literal constant fails rather than passes',
+                expect: 'reject',
+                run: () =>
+                    run(plant('destructure', "const [PREFIX] = ['AGENT_CONFIG_'];\nprocess.stderr.write(`Blocked: ${PREFIX}X=1`);\n")),
+            },
+            {
+                name: 'an unreadable shadow is not masked by a readable twin declared first',
+                expect: 'reject',
+                run: () =>
+                    run(plant('poison-order', "const PREFIX = 'safe';\nfunction deny() {\n    const [PREFIX] = ['AGENT_CONFIG_'];\n    return `Blocked: ${PREFIX}X=1`;\n}\nvoid deny;\n")),
+            },
+            {
+                name: 'destructuring through another literal constant still fails closed',
+                expect: 'reject',
+                run: () =>
+                    run(plant('poison-alias', "const PARTS = ['AGENT_CONFIG_'];\nconst [PREFIX] = PARTS;\nprocess.stderr.write(`Blocked: ${PREFIX}X=1`);\n")),
+            },
+            {
+                name: 'a numeric literal in a concatenation is coerced, not a hole',
+                expect: 'reject',
+                run: () => run(plant('numeric', "process.stderr.write('Blocked: AGENT_CONFIG_' + 1 + '=1');\n")),
+            },
+            {
+                name: 'a hole bound at runtime is not a finding',
+                expect: 'accept',
+                run: () =>
+                    run(plant('runtime-hole', "const [ok, reason] = check(process.argv);\nvoid ok;\nprocess.stderr.write(`BLOCKED — ${reason}`);\n")),
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
