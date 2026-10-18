<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-18 for branch drain/road-to-one-detector-and-the-senders-we-own-20261018b,
     round 2, committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-and-the-senders-we-own-20261018b, round 2 — every credential consumer reads the one rule table

Round 2 of the ratification review of the change described in round 1 (every credential
consumer reads the one rule table, roadmap step 2.2). The gated file is still only
`src/scripts/_lib/egress_rules.ts`; its subject digest at the reviewed commit
`35ee7a32f` is `fc6c5632f1024f46a88626186f2168833619c86df1cb6e38eaa843d2c62ee935`.

Round 1 returned REQUEST_CHANGES from both seats. Their findings and what changed:

1. **Bundler leaves the body of an unproven key block (High, both seats).** Fixed:
   `maskingEnd(text, span)` in the table returns `replacementEnd ?? pemMaskEnd (for
   the key-block row) ?? span.end`; the bundler and `workspace_secrets` both read it
   (the only two masking consumers that compute an extent from a span). A drift-matrix
   test asserts that `workspace_secrets.scrub`, `cross_repo_retrieve.redact` and the
   bundler leave no body of a block whose BEGIN and END labels differ; it was seen red
   with the bundler reverted to `span.end`.
2. **MCP lint promotes the keyword assignment into HIGH (Medium, both seats).** Fixed:
   `hasInlineSecret` excludes `generic-assignment`, so its HIGH tier stays the
   structural rows. The drift matrix records that as an explicit, reasoned policy
   exclusion for that one consumer and asserts the exclusion holds; a superset test
   freezes it.
3. **Token-start semantics inferred from regex source text (Low, openai).** Fixed:
   rows declare `tokenStart: true`; `rawKeyPrefixPattern` reads the flag. A test checks
   the flag against behaviour — for every prefix row, the row matches its fixture glued
   to a word exactly when `tokenStart` is unset — and was seen red with the flag
   removed from one row. The `boundary` option's two values are documented at the
   function.
4. **Authority classification (both seats).** Accepted: adding credential rows widens
   what `check_secret_leak` can refuse, so this record is filed as `ratified`, not
   `confirmed-non-expanding`.
5. **Test visibility (both seats).** The legacy-superset suite is included below in
   full.

Unchanged since round 1 apart from the above. 103 test files / 2,793 tests across the
egress, council, secret-detector, workspace, cross-repo, MCP and explain suites pass;
`tsc --noEmit` and eslint are clean; the hook bundle reads 1,546,845 B of 1,550,000 B.

Review the delta and the suite. For each defect report file:line, the failure scenario
and a severity. Say whether each round-1 finding is closed. State your stance (APPROVE
or REQUEST_CHANGES) and the single highest-leverage change.

## Delta since round 1

```diff
diff --git a/src/cli/python/workspace_secrets.ts b/src/cli/python/workspace_secrets.ts
index b75f16028..4b7287c68 100644
--- a/src/cli/python/workspace_secrets.ts
+++ b/src/cli/python/workspace_secrets.ts
@@ -33,10 +33,9 @@ import {
     detect,
     EGRESS_RULES,
     type EgressRule,
-    pemMaskEnd,
+    maskingEnd,
     prefixesOf,
     rawKeyPrefixPattern,
-    replacementEnd,
 } from '../../scripts/_lib/egress_rules.js';
 
 export const PLACEHOLDER = '[SECRET]';
@@ -89,9 +88,7 @@ function highSpans(text: string): Span[] {
     const spans: Span[] = detect(text, HIGH_RULES).map((s) => ({
         name: LEGACY_NAME[s.rule] ?? s.rule,
         start: s.start,
-        // A masking surface cannot refuse; an unproven extent masks through the
-        // nearest key-end marker, else the detection span.
-        end: replacementEnd(text, s) ?? (s.rule === 'pem-private-key' ? pemMaskEnd(text, s) : null) ?? s.end,
+        end: maskingEnd(text, s),
     }));
     for (const [name, re] of OWN_SHAPES) {
         for (const m of text.matchAll(re)) spans.push({ name, start: m.index, end: m.index + m[0].length });
diff --git a/src/scripts/_lib/egress_drift_matrix.test.ts b/src/scripts/_lib/egress_drift_matrix.test.ts
index e4c88c27e..e2e0b0e86 100644
--- a/src/scripts/_lib/egress_drift_matrix.test.ts
+++ b/src/scripts/_lib/egress_drift_matrix.test.ts
@@ -24,7 +24,7 @@ import { load_council_config } from '../ai_council/config.js';
 import { redact_low_impact_entry } from '../ai_council/redact_low_impact_entry.js';
 import { redact as crossRepoRedact } from '../cross_repo_retrieve.js';
 import { hasInlineSecret } from '../lint_mcp_config_security.js';
-import { EGRESS_RULES } from './egress_rules.js';
+import { detect, EGRESS_RULES } from './egress_rules.js';
 import { scanText } from './secret_detector.js';
 
 const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
@@ -76,6 +76,13 @@ const PATTERN_GRADE: Readonly<Record<string, Consumer>> = {
     council_bundler: (f, s) => !bundlerRedact(inSentence(f)).includes(s),
 };
 
+// A row a consumer's policy deliberately leaves out, with the reason. The MCP
+// lint's HIGH tier is structural credentials; a keyword assignment was never in
+// it, and promoting one would change that consumer's policy, not its detection.
+const POLICY_EXCLUDED: Readonly<Record<string, readonly string[]>> = {
+    lint_mcp_config_security: ['generic-assignment'],
+};
+
 function councilRefRefused(ref: string): boolean {
     const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-drift-'));
     const file = path.join(dir, 'council.yml');
@@ -109,8 +116,9 @@ describe('drift matrix: one table, every consumer', () => {
         const fixture = FIXTURES[row.rule] ?? '';
         const secret = secretOf(row.rule, fixture);
         for (const [name, consumer] of Object.entries(PATTERN_GRADE)) {
-            it(`${name} acts on ${row.rule}`, () => {
-                expect(consumer(fixture, secret)).toBe(true);
+            const excluded = POLICY_EXCLUDED[name]?.includes(row.rule) === true;
+            it(`${name} ${excluded ? 'leaves to its own policy' : 'acts on'} ${row.rule}`, () => {
+                expect(consumer(fixture, secret)).toBe(!excluded);
             });
         }
         if ((row.prefixes ?? []).length === 0) continue;
@@ -120,4 +128,20 @@ describe('drift matrix: one table, every consumer', () => {
             });
         }
     }
+
+    it('a row declares tokenStart exactly when it does not match glued to a word', () => {
+        for (const row of credentialRows) {
+            if ((row.prefixes ?? []).length === 0) continue;
+            const glued = detect(`x${FIXTURES[row.rule] ?? ''}`, [row]).length > 0;
+            expect({ rule: row.rule, glued }).toEqual({ rule: row.rule, glued: row.tokenStart !== true });
+        }
+    });
+
+    it('a masking consumer leaves no body of an unproven key block', () => {
+        const body = 'MIIq7w3e5r7t9y';
+        const block = '-----BEGIN RSA ' + 'PRIVATE KEY-----\n' + body + '\n-----END EC ' + 'PRIVATE KEY-----';
+        expect(workspaceScrub(inSentence(block))[0]).not.toContain(body);
+        expect(crossRepoRedact(inSentence(block), {})[0]).not.toContain(body);
+        expect(bundlerRedact(`a\n${block}\nb`)).not.toContain(body);
+    });
 });
diff --git a/src/scripts/_lib/egress_legacy_superset.test.ts b/src/scripts/_lib/egress_legacy_superset.test.ts
index 619aebb3a..036100ce0 100644
--- a/src/scripts/_lib/egress_legacy_superset.test.ts
+++ b/src/scripts/_lib/egress_legacy_superset.test.ts
@@ -156,4 +156,9 @@ describe('legacy superset: no consumer misses what it caught before the move', (
     it('the council api_key_ref check still refuses every old prefix', () => {
         for (const p of OLD.councilRef) expect(councilRefPrefixes).toContain(p);
     });
+
+    it('the MCP config lint keeps a keyword assignment out of its HIGH tier', () => {
+        expect(hasInlineSecret(`"api_key": "${run(24, 3)}"`)).toBe(false);
+        expect(hasInlineSecret(`"token": "${SK}ant-api03-${run(40, 1)}"`)).toBe(true);
+    });
 });
diff --git a/src/scripts/_lib/egress_rules.ts b/src/scripts/_lib/egress_rules.ts
index 38ce919ab..c60973c6b 100644
--- a/src/scripts/_lib/egress_rules.ts
+++ b/src/scripts/_lib/egress_rules.ts
@@ -38,6 +38,13 @@ export interface EgressRule {
      * spelling their own list.
      */
     readonly prefixes?: readonly string[];
+    /**
+     * The row matches only at a token start (its pattern opens with a lookbehind
+     * for a key character). A shape-only surface reading the prefixes holds them
+     * to a token start exactly when this is set; a test checks it against what the
+     * row actually matches.
+     */
+    readonly tokenStart?: true;
 }
 
 export interface SpanBounds {
@@ -189,6 +196,7 @@ export const EGRESS_RULES: readonly EgressRule[] = [
         prefixes: ['sk-'],
         class: 'credential',
         replacement: 'detection',
+        tokenStart: true,
         pattern: /(?<![A-Za-z0-9])sk-[A-Za-z0-9]{20,}/g,
         linearity: PREFIX_RUN,
     },
@@ -198,6 +206,7 @@ export const EGRESS_RULES: readonly EgressRule[] = [
         prefixes: ['ya29.'],
         class: 'credential',
         replacement: 'detection',
+        tokenStart: true,
         pattern: /(?<![A-Za-z0-9])ya29\.[0-9A-Za-z_-]{20,}/g,
         linearity: PREFIX_RUN,
     },
@@ -216,6 +225,7 @@ export const EGRESS_RULES: readonly EgressRule[] = [
         prefixes: ['xai-'],
         class: 'credential',
         replacement: 'detection',
+        tokenStart: true,
         pattern: /(?<![A-Za-z0-9])xai-[A-Za-z0-9]{20,}/g,
         linearity: PREFIX_RUN,
     },
@@ -234,6 +244,7 @@ export const EGRESS_RULES: readonly EgressRule[] = [
         prefixes: ['gsk_'],
         class: 'credential',
         replacement: 'detection',
+        tokenStart: true,
         pattern: /(?<![A-Za-z0-9])gsk_[A-Za-z0-9]{20,}/g,
         linearity: PREFIX_RUN,
     },
@@ -319,18 +330,21 @@ export function vendorPrefix(rule: string): string {
     return first;
 }
 
-// A prefix is held to a token start only where its own row is; a prefix whose
-// row matches mid-word stays unanchored, so a shape-only surface never misses
-// what the row would catch.
-const ANCHORED_PREFIXES: ReadonlySet<string> = new Set(
-    EGRESS_RULES.filter((r) => r.pattern.source.startsWith('(?<!')).flatMap((r) => r.prefixes ?? []),
+const TOKEN_START_PREFIXES: ReadonlySet<string> = new Set(
+    EGRESS_RULES.filter((r) => r.tokenStart === true).flatMap((r) => r.prefixes ?? []),
 );
 
 /**
  * A raw-key prefix followed by at least `minTail` key characters. Coarser than
  * the rows on purpose: it is for surfaces that refuse or mask on shape alone,
- * where a short or truncated key must still be caught. `boundary: 'never'` drops
- * the token-start requirement for every prefix; `tail` narrows the key class.
+ * where a short or truncated key must still be caught.
+ *
+ * `boundary: 'row'` (the default) holds a prefix to a token start exactly where
+ * its own row declares `tokenStart`, so the pattern never misses what the row
+ * would catch and a short prefix (`sk-`) does not fire inside a word.
+ * `boundary: 'never'` drops the token start for every prefix: it is for a
+ * consumer whose own pre-table reading matched mid-word, and dropping it there
+ * is what keeps that consumer from narrowing. `tail` narrows the key class.
  */
 export function rawKeyPrefixPattern(
     minTail: number,
@@ -341,7 +355,7 @@ export function rawKeyPrefixPattern(
         .sort((a, b) => b.length - a.length)
         .map((p) => {
             const lit = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
-            return opts.boundary !== 'never' && ANCHORED_PREFIXES.has(p) ? `(?<![A-Za-z0-9])${lit}` : lit;
+            return opts.boundary !== 'never' && TOKEN_START_PREFIXES.has(p) ? `(?<![A-Za-z0-9])${lit}` : lit;
         })
         .join('|');
     return new RegExp(`(?:${alt})[${opts.tail ?? 'A-Za-z0-9_-'}]{${minTail},}`, 'g');
@@ -360,6 +374,17 @@ export function replacementEnd(text: string, span: EgressSpan): number | null {
     return end === null || end < span.end ? null : end;
 }
 
+/**
+ * End of the bytes a MASKING surface removes for `span`. A surface that cannot
+ * refuse must not leave key material behind when the row cannot prove the extent:
+ * an unproven key block is masked through the nearest END marker of any label,
+ * and only a span with nothing better falls back to its detection span. Every
+ * masking consumer reads this, so the fallback is decided once.
+ */
+export function maskingEnd(text: string, span: EgressSpan): number {
+    return replacementEnd(text, span) ?? (span.rule === 'pem-private-key' ? pemMaskEnd(text, span) : null) ?? span.end;
+}
+
 /**
  * Returns a description of the first unbounded quantifier (`+`, `*`, `{n,}`)
  * outside a character class, or null. Escapes and classes are skipped.
diff --git a/src/scripts/ai_council/bundler.ts b/src/scripts/ai_council/bundler.ts
index 5e421a6d5..5ef257d59 100644
--- a/src/scripts/ai_council/bundler.ts
+++ b/src/scripts/ai_council/bundler.ts
@@ -20,7 +20,7 @@ import { spawnSync } from 'node:child_process';
 import * as fs from 'node:fs';
 import * as path from 'node:path';
 
-import { detect, prefixesOf, rawKeyPrefixPattern, replacementEnd } from '../_lib/egress_rules.js';
+import { detect, maskingEnd, prefixesOf, rawKeyPrefixPattern } from '../_lib/egress_rules.js';
 
 export const MAX_BUNDLE_BYTES = 50 * 1024; // 50 KB hard ceiling; user must narrow scope on hit.
 
@@ -126,7 +126,7 @@ function _credentialLines(lines: readonly string[]): Map<number, string> {
     const out = new Map<number, string>();
     for (const span of detect(joined)) {
         if (span.class !== 'credential') continue;
-        const end = replacementEnd(joined, span) ?? span.end;
+        const end = maskingEnd(joined, span);
         const label = _RULE_LABEL[span.rule] ?? _CREDENTIAL_LABEL;
         for (let i = lineOf(span.start); i <= lineOf(Math.max(span.start, end - 1)); i += 1) {
             if (!out.has(i)) out.set(i, label);
diff --git a/src/scripts/lint_mcp_config_security.ts b/src/scripts/lint_mcp_config_security.ts
index 554e30b6f..8e263f5eb 100644
--- a/src/scripts/lint_mcp_config_security.ts
+++ b/src/scripts/lint_mcp_config_security.ts
@@ -33,9 +33,11 @@ export const CHECK = 'mcp-config-security';
 const _NAME_HINTS = /(^|\/)(\.mcp\.json|mcp\.json|claude_desktop_config\.json)/;
 
 // Real secret VALUES — detected by the one rule table, which owns every
-// credential pattern (road-to-one-detector-and-the-senders-we-own 2.2).
+// credential pattern (road-to-one-detector-and-the-senders-we-own 2.2). The
+// heuristic keyword assignment is not a structural credential and never was HIGH
+// here; this lint's HIGH tier stays the structural rows.
 export function hasInlineSecret(text: string): boolean {
-    return detect(text).some((span) => span.class === 'credential');
+    return detect(text).some((span) => span.class === 'credential' && span.rule !== 'generic-assignment');
 }
 
 // Line-level smells (match on a single line).
```

## The legacy-superset suite, in full

```ts
/**
 * Moving a consumer onto the rule table must not narrow what it catches
 * (road-to-one-detector-and-the-senders-we-own 2.2). Each consumer's detection as
 * it stood before the move is frozen here as the regexes it spelled, and an
 * adversarial corpus — glued to a preceding word, after an underscore, in quotes,
 * in a URL, with a tail longer than a row's fixed length, with `_` and `-` in the
 * tail — is run through old and new. Wherever the old consumer acted, the new one
 * must act too, and a masking consumer must leave none of the old match behind.
 *
 * The drift matrix asks "does every consumer catch every row"; this asks "does
 * any consumer now miss something it used to catch". Values are built at runtime
 * and never printed.
 */
import { describe, expect, it } from 'vitest';

import { scan as workspaceScan, scrub as workspaceScrub } from '../../cli/python/workspace_secrets.js';
import { scrub_string as explainScrub } from '../_cli/explain_last/scrubber.js';
import { redact as bundlerRedact } from '../ai_council/bundler.js';
import { _RAW_KEY_PREFIXES as councilRefPrefixes } from '../ai_council/config.js';
import { redact as crossRepoRedact } from '../cross_repo_retrieve.js';
import { hasInlineSecret } from '../lint_mcp_config_security.js';

const SK = 'sk' + '-';
const GH = 'gh';

// The pre-move spellings, verbatim except that prefixes are assembled.
const OLD = {
    workspace: [
        /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
        /AKIA[0-9A-Z]{16}/g,
        new RegExp(`${GH}[pousr]_[A-Za-z0-9]{36,}`, 'g'),
        new RegExp(`${SK}[A-Za-z0-9]{20,}`, 'g'),
    ],
    crossRepoKv: /(?:api[_-]?key|secret|token|password|passwd|bearer)\s*[:=]\s*['"]?[A-Za-z0-9_\-+/=]{12,}['"]?/gi,
    bundler: [new RegExp(`${SK}ant-[A-Za-z0-9_\\-]{8,}`, 'gu'), new RegExp(`${SK}[A-Za-z0-9_\\-]{20,}`, 'gu')],
    explain: new RegExp(
        `(?:${['sk_live_', 'sk_test_', `${GH}p_`, 'github_pat_', `${GH}o_`, `${GH}s_`, `${GH}u_`, 'xoxb-', 'xoxp-', 'AIza', 'AKIA']
            .map((p) => p.replace(/-/g, '\\u002d'))
            .join('|')})[A-Za-z0-9_-]{6,}`,
        'gu',
    ),
    mcp: new RegExp(
        `${SK}ant-[A-Za-z0-9_\\-]{20,}|${SK}proj-[A-Za-z0-9_\\-]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_\\-]{35}|` +
            `${GH}p_[0-9A-Za-z]{36}|eyJ[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}`,
    ),
    councilRef: [SK, `${SK}ant-`, 'ya29.', 'AIza', 'xai-', 'pplx-', 'gsk_'],
};

const ALNUM = 'Qw3Er5Ty7Ui9Op2As4Df6Gh8Jk1Lz3Xc5Vb7Nm9';
const run = (n: number, shift = 0): string => {
    let s = '';
    for (let i = 0; i < n; i += 1) s += ALNUM[(i + shift) % ALNUM.length];
    return s;
};

const VALUES: readonly string[] = [
    `${SK}${run(20)}`,
    `${SK}${run(48, 3)}`,
    `${SK}ant-api03-${run(40, 1)}`,
    `${SK}ant-${run(8, 2)}`,
    `${SK}proj-${run(24, 4)}`,
    `${SK}${run(10)}_${run(10, 5)}-${run(6, 6)}`,
    `AKIA${'ABCDEFGHIJ234567'}`,
    `AIza${run(35, 7)}`,
    `${GH}p_${run(36, 8)}`,
    `${GH}p_${run(44, 9)}`,
    `${GH}s_${run(40, 10)}`,
    `${GH}r_${run(36, 11)}`,
    `${GH}o_${run(6, 12)}`,
    `github_pat_${run(30, 13)}`,
    `sk_live_${run(24, 14)}`,
    `sk_test_${run(6, 15)}`,
    `xoxb-${run(24, 16)}`,
    `xoxp-${run(6, 17)}`,
    `eyJ${run(12)}.${run(12, 1)}.${run(12, 2)}`,
    '-----BEGIN RSA PRIVATE KEY-----\nMIIab3cd4ef5\n-----END RSA PRIVATE KEY-----',
    '-----BEGIN RSA PRIVATE KEY-----\nMIIgh6ij7kl8\n-----END EC PRIVATE KEY-----',
];

const CONTEXTS: readonly ((v: string) => string)[] = [
    (v) => v,
    (v) => `see ${v} here`,
    (v) => `x${v} glued`,
    (v) => `my_${v}`,
    (v) => `"${v}"`,
    (v) => `https://h.example/p?k=${v}&a=1`,
    (v) => `KEY=${v}`,
];

const INPUTS: readonly string[] = VALUES.flatMap((v) => CONTEXTS.map((c) => c(v)));

function matches(res: readonly RegExp[], text: string): string[] {
    const out: string[] = [];
    for (const re of res) {
        const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
        for (const m of text.matchAll(g)) out.push(m[0]);
    }
    return out;
}

/**
 * Old matches any part of whose key material survives. Key material is every
 * six-character window carrying a digit — the corpus values are digit-dense and
 * the surrounding prose has none — so a mask that leaves a key's tail behind
 * counts, not only one that leaves the whole match.
 */
function survivors(old: readonly string[], output: string): string[] {
    return old.filter((m) => {
        for (let i = 0; i + 6 <= m.length; i += 1) {
            const w = m.slice(i, i + 6);
            if (/[0-9]/.test(w) && /^[A-Za-z0-9]+$/.test(w) && output.includes(w)) return true;
        }
        return false;
    });
}

describe('legacy superset: no consumer misses what it caught before the move', () => {
    it('the corpus exercises every frozen pattern', () => {
        for (const re of [...OLD.workspace, ...OLD.bundler, OLD.explain, OLD.mcp]) {
            expect(INPUTS.some((t) => matches([re], t).length > 0)).toBe(true);
        }
    });

    it('workspace_secrets scan reports every old HIGH hit', () => {
        const missed = INPUTS.filter((t) => matches(OLD.workspace, t).length > 0 && workspaceScan(t).length === 0);
        expect(missed.length).toBe(0);
    });

    it('workspace_secrets scrub leaves no old HIGH match behind', () => {
        const left = INPUTS.filter((t) => survivors(matches(OLD.workspace, t), workspaceScrub(t)[0]).length > 0);
        expect(left.length).toBe(0);
    });

    it('cross_repo_retrieve leaves no old secret match behind', () => {
        const left = INPUTS.filter(
            (t) => survivors(matches([...OLD.workspace, OLD.crossRepoKv], t), crossRepoRedact(t, {})[0]).length > 0,
        );
        expect(left.length).toBe(0);
    });

    it('the council bundler leaves no old key match behind', () => {
        const left = INPUTS.filter((t) => survivors(matches(OLD.bundler, t), bundlerRedact(t)).length > 0);
        expect(left.length).toBe(0);
    });

    it('the explain scrubber leaves no old raw-key match behind', () => {
        const left = INPUTS.filter((t) => survivors(matches([OLD.explain], t), String(explainScrub(t))).length > 0);
        expect(left.length).toBe(0);
    });

    it('the MCP config lint flags every old inline secret', () => {
        const missed = INPUTS.filter((t) => OLD.mcp.test(t) && !hasInlineSecret(t));
        expect(missed.length).toBe(0);
    });

    it('the council api_key_ref check still refuses every old prefix', () => {
        for (const p of OLD.councilRef) expect(councilRefPrefixes).toContain(p);
    });

    it('the MCP config lint keeps a keyword assignment out of its HIGH tier', () => {
        expect(hasInlineSecret(`"api_key": "${run(24, 3)}"`)).toBe(false);
        expect(hasInlineSecret(`"token": "${SK}ant-api03-${run(40, 1)}"`)).toBe(true);
    });
});
```
