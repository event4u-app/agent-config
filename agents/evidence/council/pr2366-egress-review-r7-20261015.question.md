<!-- evidence-type: analysis -->

<!-- The round-7 prompt given to the council on 2026-10-15 for PR #2366, committed
     verbatim so the verdict recorded beside it can be checked against what was
     actually asked. Not edited after the run. -->

# Review PR #2366 — delta since council round 6

Review this change. Scope: only the commit after council round 6 (0aca4ea38), shown below, plus the current PEM rule for context. Round 6 found two defects: a PEM block whose END label differs from its BEGIN label could truncate the replacement span and leak the remaining key bytes; and the end-to-end suite only asserted substring absence rather than the exact replacement boundary. The rest of the PR was reviewed in rounds 1–6.

Report defects: secret bytes left in plaintext, a replacement span that ends early or late, a path that partially replaces instead of refusing, tests that would pass without the code they cover. For each: file:line, the failure scenario, severity. State your stance.

```diff
commit 0aca4ea38066a66c27306fe5811760d5ff6dd2cb
Author: matze4u <171579628+matze4u@users.noreply.github.com>
Date:   Thu Oct 15 10:12:07 2026 +0200

    fix(egress): end a key block only at an END with the same label
    
    pemBlockEnd accepted the nearest END marker of any label, so an RSA
    block containing an earlier "END EC PRIVATE KEY" was cut short there
    and the rest of the key left in plaintext. The nearest marker must now
    be an END carrying the header's own label; any other marker or none
    means the extent is unproven and the text is refused. Red before with a
    mismatched END followed by more key material.
    
    The end-to-end suite now asserts the exact shape of the output (the
    bytes before the secret, one token, the bytes after) instead of the
    absence of chosen substrings, which a partial replacement of a long
    value would also satisfy; seen red with the PEM extent shortened by its
    END marker, which the old assertion accepted. Each fixture also checks
    that the rule it is filed under is the rule that detects it. The
    contract states both.
    
    Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

diff --git a/src/scripts/_lib/egress_replacement_e2e.test.ts b/src/scripts/_lib/egress_replacement_e2e.test.ts
index a8d9e176f..a7cf2181f 100644
--- a/src/scripts/_lib/egress_replacement_e2e.test.ts
+++ b/src/scripts/_lib/egress_replacement_e2e.test.ts
@@ -1,16 +1,18 @@
 /**
  * End to end: every credential row of the rule table, planted in text, goes
- * through the full replacement path, and no planted sensitive byte sequence may
- * survive in the output. Detection parity says what the scanner reports; this
- * suite says what actually leaves.
+ * through the full replacement path. Each fixture is split into the bytes
+ * before the secret, the secret's full replacement span, and the bytes after
+ * it, and the output must equal exactly `before + one token + after`: every
+ * byte inside the span is gone and every byte outside it is untouched. Checking
+ * that a substring is absent would pass a partial replacement of a long value.
  *
  * Fixtures are assembled at runtime, so no credential-shaped literal sits in
  * this file, and every assertion is a boolean so a failure never prints one.
  */
 import { describe, expect, it } from 'vitest';
 
-import { EGRESS_RULES } from './egress_rules.js';
-import { EgressRefusedError, parseTokens, replaceValues, TokenScope } from './egress_token.js';
+import { detect, EGRESS_RULES } from './egress_rules.js';
+import { EgressRefusedError, formatToken, parseTokens, replaceValues, TokenScope } from './egress_token.js';
 
 const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
 function run(n: number, salt = 0): string {
@@ -21,57 +23,63 @@ function run(n: number, salt = 0): string {
 }
 const B64 = (n: number, salt: number): string => run(n, salt).replace(/[_-]/g, 'x');
 
-const PEM_LABEL = ['RSA', 'PRIVATE', 'KEY'].join(' ');
-function pem(lines: string[]): string {
-    return [`-----BEGIN ${PEM_LABEL}-----`, ...lines, `-----END ${PEM_LABEL}-----`].join('\n');
-}
-const uri = (scheme: string, user: string, password: string): string =>
-    `${scheme}${'://'}${user}:${password}@db.internal:5432/app`;
+const RSA = ['RSA', 'PRIVATE', 'KEY'].join(' ');
+const EC = ['EC', 'PRIVATE', 'KEY'].join(' ');
+const begin = (label: string): string => `-----BEGIN ${label}-----`;
+const end = (label: string): string => `-----END ${label}-----`;
+const pem = (lines: string[], sep = '\n'): string => [begin(RSA), ...lines, end(RSA)].join(sep);
+const uri = (scheme: string, user: string, password: string): string => `${scheme}${'://'}${user}:${password}@`;
 const jwt = (a: number, b: number, c: number): string => `eyJ${run(a, 1)}.${run(b, 2)}.${run(c, 3)}`;
+const q = (s: string): string => s.replace(/[_-]/g, 'q');
 
 interface Fixture {
     readonly rule: string;
-    readonly text: string;
-    /** Byte sequences of which no copy may remain after replacement. */
-    readonly secrets: readonly string[];
+    readonly before: string;
+    /** The full replacement span: every byte here must go. */
+    readonly secret: string;
+    readonly after: string;
 }
 
 const PEM_BODY = [B64(64, 4), B64(64, 5), B64(40, 6)];
 const PASSWORD = run(20, 7);
-const LONG_SCHEME = 'a'.repeat(33);
 
 const FIXTURES: readonly Fixture[] = [
-    { rule: 'anthropic-api-key', text: `key sk-ant-${run(90, 8)} end`, secrets: [`sk-ant-${run(90, 8)}`] },
-    { rule: 'anthropic-api-key', text: `key sk-ant-${run(5000, 9)}`, secrets: [run(5000, 9).slice(-40)] },
-    { rule: 'anthropic-project-key', text: `key sk-proj-${run(60, 10)}`, secrets: [run(60, 10)] },
-    { rule: 'aws-access-key', text: 'id AKIA' + 'ABCDEFGHIJ234567 x', secrets: ['ABCDEFGHIJ234567'] },
-    { rule: 'google-api-key', text: `g AIza${run(35, 11)} x`, secrets: [run(35, 11)] },
-    {
-        rule: 'github-pat',
-        text: `t ghp_${run(36, 12).replace(/[_-]/g, 'q')} x`,
-        secrets: [run(36, 12).replace(/[_-]/g, 'q')],
-    },
-    { rule: 'github-fine-grained-pat', text: `t github_pat_${run(80, 13)} x`, secrets: [run(80, 13)] },
-    { rule: 'jwt', text: `Bearer ${jwt(30, 40, 30)}`, secrets: [jwt(30, 40, 30).slice(3)] },
-    { rule: 'jwt', text: `glued x${jwt(30, 40, 30)} y`, secrets: [jwt(30, 40, 30).slice(3)] },
-    { rule: 'jwt', text: `long ${jwt(9000, 20, 20)}`, secrets: [run(9000, 1).slice(-30)] },
+    { rule: 'anthropic-api-key', before: 'key ', secret: `sk-ant-${run(90, 8)}`, after: ' end' },
+    { rule: 'anthropic-api-key', before: 'key ', secret: `sk-ant-${run(5000, 9)}`, after: '' },
+    { rule: 'anthropic-project-key', before: 'key ', secret: `sk-proj-${run(60, 10)}`, after: '\n' },
+    { rule: 'aws-access-key', before: 'id ', secret: 'AKIA' + 'ABCDEFGHIJ234567', after: ' x' },
+    { rule: 'google-api-key', before: 'g ', secret: `AIza${run(35, 11)}`, after: ' x' },
+    { rule: 'github-pat', before: 't ', secret: `ghp_${q(run(36, 12))}`, after: ' x' },
+    { rule: 'github-fine-grained-pat', before: 't ', secret: `github_pat_${run(80, 13)}`, after: ' x' },
+    { rule: 'jwt', before: 'Bearer ', secret: jwt(30, 40, 30), after: '' },
+    { rule: 'jwt', before: 'glued x', secret: jwt(30, 40, 30), after: ' y' },
+    { rule: 'jwt', before: 'long ', secret: jwt(9000, 20, 20), after: '' },
+    { rule: 'stripe-secret-key', before: 's ', secret: `sk_live_${q(run(40, 14))}`, after: '' },
+    { rule: 'slack-token', before: 's ', secret: `xoxb-${run(40, 15)}`, after: '' },
+    { rule: 'pem-private-key', before: 'before\n', secret: pem(PEM_BODY), after: '\nafter' },
+    { rule: 'pem-private-key', before: 'in a string: "', secret: pem(PEM_BODY, '\\n'), after: '"' },
     {
-        rule: 'stripe-secret-key',
-        text: `s sk_live_${run(40, 14).replace(/[_-]/g, 'q')}`,
-        secrets: [run(40, 14).replace(/[_-]/g, 'q')],
+        rule: 'db-connection-uri',
+        before: 'url ',
+        secret: uri('postgres', 'svc', PASSWORD),
+        after: 'db.internal:5432/app',
     },
-    { rule: 'slack-token', text: `s xoxb-${run(40, 15)}`, secrets: [run(40, 15)] },
-    { rule: 'pem-private-key', text: `before\n${pem(PEM_BODY)}\nafter`, secrets: PEM_BODY },
-    { rule: 'pem-private-key', text: `in a string: "${pem(PEM_BODY).split('\n').join('\\n')}"`, secrets: PEM_BODY },
-    { rule: 'db-connection-uri', text: `url ${uri('postgres', 'svc', PASSWORD)}`, secrets: [PASSWORD] },
-    { rule: 'db-connection-uri', text: `url ${uri(LONG_SCHEME, 'svc', PASSWORD)}`, secrets: [PASSWORD] },
-    { rule: 'db-connection-uri', text: `url ${uri('a.'.repeat(20) + 'x', 'svc', PASSWORD)}`, secrets: [PASSWORD] },
-    { rule: 'generic-assignment', text: `password = "${run(30, 16)}"`, secrets: [run(30, 16)] },
-    { rule: 'generic-assignment', text: `secret: ${run(3000, 17)}`, secrets: [run(3000, 17).slice(-40)] },
-    { rule: 'generic-assignment', text: `AuthToken=AuthToken=AuthToken=`, secrets: ['AuthToken=AuthToken='] },
+    { rule: 'db-connection-uri', before: 'url ', secret: uri('a'.repeat(33), 'svc', PASSWORD), after: 'db/app' },
+    { rule: 'db-connection-uri', before: 'url ', secret: uri(`${'a.'.repeat(20)}x`, 'svc', PASSWORD), after: 'db' },
+    { rule: 'generic-assignment', before: 'password = "', secret: run(30, 16), after: '"' },
+    { rule: 'generic-assignment', before: 'secret: ', secret: run(3000, 17), after: '' },
+    { rule: 'generic-assignment', before: 'AuthToken=', secret: 'AuthToken=AuthToken=', after: '' },
 ];
 
-describe('end-to-end replacement leaves no planted byte', () => {
+/** True when `out` is exactly `before`, one well-formed token, then `after`. */
+function exactlyReplaced(out: string, f: Fixture): boolean {
+    if (!out.startsWith(f.before) || !out.endsWith(f.after)) return false;
+    const middle = out.slice(f.before.length, out.length - f.after.length);
+    const toks = parseTokens(middle);
+    return toks.length === 1 && toks[0]?.start === 0 && toks[0]?.end === middle.length;
+}
+
+describe('end-to-end replacement removes exactly the replacement span', () => {
     it('every credential row has at least one fixture', () => {
         const covered = new Set(FIXTURES.map((f) => f.rule));
         const missing = EGRESS_RULES.filter((r) => r.class === 'credential' && !covered.has(r.rule)).map((r) => r.rule);
@@ -80,23 +88,46 @@ describe('end-to-end replacement leaves no planted byte', () => {
 
     FIXTURES.forEach((f, i) => {
         it(`${f.rule} #${i}`, () => {
-            const out = replaceValues(f.text, new TokenScope());
-            expect(f.secrets.every((s) => !out.includes(s))).toBe(true);
-            expect(parseTokens(out).length).toBeGreaterThan(0);
+            const text = f.before + f.secret + f.after;
+            // The fixture's named rule is what detects it, at the secret's start.
+            expect(detect(text).some((s) => s.rule === f.rule && s.start === f.before.length)).toBe(true);
+            expect(exactlyReplaced(replaceValues(text, new TokenScope()), f)).toBe(true);
         });
     });
+
+    it('the exact-boundary check rejects a partial replacement', () => {
+        const f = FIXTURES[1] as Fixture;
+        const tok = formatToken({ type: 'APIKEY', number: 1, fingerprint: 'abcdef' });
+        const partial = `${f.before}${tok}${f.secret.slice(-10)}${f.after}`;
+        expect(exactlyReplaced(partial, f)).toBe(false);
+    });
 });
 
 describe('a rule without a provable replacement span fails closed', () => {
-    it('a private-key header with no matching end marker refuses the whole text', () => {
-        const text = `-----BEGIN ${PEM_LABEL}-----\n${PEM_BODY.join('\n')}\n(truncated)`;
-        expect(() => replaceValues(text, new TokenScope())).toThrow(EgressRefusedError);
+    const refuses = (text: string): boolean => {
+        try {
+            replaceValues(text, new TokenScope());
+            return false;
+        } catch (e) {
+            return e instanceof EgressRefusedError;
+        }
+    };
+
+    it('a private-key header with no end marker refuses the whole text', () => {
+        expect(refuses(`${begin(RSA)}\n${PEM_BODY.join('\n')}\n(truncated)`)).toBe(true);
+    });
+
+    it('an end marker with a different label refuses, even when the right one follows', () => {
+        expect(refuses([begin(RSA), PEM_BODY[0], end(EC), PEM_BODY[1], end(RSA)].join('\n'))).toBe(true);
+    });
+
+    it('a second header before any end marker refuses', () => {
+        expect(refuses([begin(RSA), PEM_BODY[0], begin(RSA), PEM_BODY[1], end(RSA)].join('\n'))).toBe(true);
     });
 
     it('the refusal names the rule and carries no byte of the text', () => {
-        const text = `-----BEGIN ${PEM_LABEL}-----\n${PEM_BODY.join('\n')}`;
         try {
-            replaceValues(text, new TokenScope());
+            replaceValues(`${begin(RSA)}\n${PEM_BODY.join('\n')}`, new TokenScope());
             expect.unreachable();
         } catch (e) {
             const msg = (e as Error).message;
diff --git a/src/scripts/_lib/egress_rules.ts b/src/scripts/_lib/egress_rules.ts
index 30e049c0e..e5ef4eaba 100644
--- a/src/scripts/_lib/egress_rules.ts
+++ b/src/scripts/_lib/egress_rules.ts
@@ -81,16 +81,19 @@ export function looksLikeSecretValue(value: string): boolean {
     return shannonEntropy(value) >= GENERIC_MIN_ENTROPY;
 }
 
-// The nearest key marker after the header decides: the matching END ends the
-// block; another BEGIN first, or no marker at all, means the extent is unproven.
-// One sticky scan from the header to the nearest marker keeps this linear even
-// over many headers.
-const KEY_MARKER = /-----(BEGIN|END) [A-Z ]*PRIVATE KEY-----/g;
+// The nearest key marker after the header decides: an END carrying the same
+// label as the header ends the block; another BEGIN, an END with a different
+// label, or no marker at all means the extent is unproven. One sticky scan from
+// the header to the nearest marker keeps this linear even over many headers.
+const KEY_MARKER = /-----(BEGIN|END) ([A-Z ]*)PRIVATE KEY-----/g;
+const BEGIN_LABEL = /^-----BEGIN ([A-Z ]*)PRIVATE KEY-----/;
 
 export function pemBlockEnd(text: string, span: SpanBounds): number | null {
+    const label = BEGIN_LABEL.exec(text.slice(span.start, span.end))?.[1];
+    if (label === undefined) return null;
     KEY_MARKER.lastIndex = span.end;
     const m = KEY_MARKER.exec(text);
-    if (m === null || m[1] !== 'END') return null;
+    if (m === null || m[1] !== 'END' || m[2] !== label) return null;
     return m.index + m[0].length;
 }
 
```

Current PEM rule and its replacement function, for context:

```ts
186-        linearity: PREFIX_RUN,
187-    },
188-    {
189:        rule: 'pem-private-key',
190-        type: 'PRIVATEKEY',
191-        class: 'credential',
192-
193-        pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
194-        replacement: { through: pemBlockEnd },
195-        linearity:
196-            'Starts only at the literal header; the label class excludes the dash, so label runs of different headers are disjoint, and backtracking over one run tries the fixed 16-character suffix at each position: linear with a constant factor of 16.',
197-    },
198-    {
199-        rule: 'db-connection-uri',
200-        type: 'DBURI',
201-        class: 'credential',
202-        replacement: 'detection',
203-        pattern: /(?<![a-z0-9+.-])(?=((?:(?!\b[a-z])[a-z0-9+.-])*))\1(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s:/@]+@)/dg,
204-        valueGroup: 2,
205-        linearity:
206-            'One attempt per scheme-character run: the lookbehind admits a start only at the run boundary, and the lookahead-plus-backreference consumes the run up to its first word-boundary letter atomically. Every such start in one run reaches the same :// at the same run end, so the first one matches whenever any later one would, and nothing the unbounded scheme matched is lost. The userinfo classes exclude : and /, so each userinfo run is read by one attempt per side.',
207-    },
208-    {
209-        rule: 'generic-assignment',
210-        type: 'SECRET',
211-        class: 'credential',
212-        replacement: 'detection',
213-        pattern:
214-            /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]?([^'"\s]{8,})['"]?/dgi,
215-        valueGroup: 1,
216-        validator: looksLikeSecretValue,
217-        linearity:
218-            'Starts only at a keyword; the whitespace runs end at the first non-space and the value run at the first quote or space, and a match moves the global scan past the value, so no character is read by more than one successful attempt and a failed attempt stops at the first character after the whitespace.',
219-    },
220-];
221-
222-/**
223- * Returns a description of the first unbounded quantifier (`+`, `*`, `{n,}`)
224- * outside a character class, or null. Escapes and classes are skipped.
225- */
226-export function findUnboundedQuantifier(pattern: RegExp): string | null {
227-    const src = pattern.source;
228-    let inClass = false;
229-    for (let i = 0; i < src.length; i++) {
```
