<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-20 for branch drain/road-to-one-detector-senders-20261020,
     committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-senders-20261020, part B1 (consumers, spelling gate) — consumers read the shared shapes, two gates, the sender census

Roadmap `road-to-one-detector-and-the-senders-we-own`, steps 2.7, 2.6 (three of four
mutations) and 3.4.

What the delta does:

- **2.7.** The rule table gains `ASSIGNMENT_KEYWORDS` with an `assignmentPattern`
  builder, `AUTHORIZATION_HEADER` and `CLASS_SPELLED_PREFIXES` (part A's diff shows
  the table). Seven consumers rebuild their keyword-assignment regexes from them,
  each keeping its own keyword set, order and value threshold; every rebuilt regex is
  the pre-move spelling byte for byte, which the legacy-superset suite asserts where a
  consumer exposes the regex and asserts as behaviour where it does not. The
  low-impact redactor rides in the dispatch bundle, so it reads its one keyword
  through the generated projection `egress_prefixes.ts`, equality-tested against the
  table. `check_credential_spelling` now also refuses a class or alternation spelling
  that expands to a declared prefix and a keyword-assignment shape (a table keyword
  beside the `[:=]` operator class on one line) outside the table; run over the
  `origin/main` copies of the seven files it flags all eight pre-move lines.
- **2.6.** `check_egress_mutations` copies the three engine modules into a scratch
  directory per recipe and requires the recipe's invariant to hold on the unmutated
  copy and fail on the mutated one. Recipes under `src/config/egress-mutations/`:
  class precedence swapped, a credential token that restores, a raw value in the
  count record. Registered in `src/config/gate-coverage.yml` with a create-only canary
  that plants a recipe changing nothing; `--self-test` rejects a surviving, a stale
  and an unknown recipe. The fourth mutation (IBAN checksum) waits for an IBAN row.
- **3.4.** Every sender module carries an `egress-content:` marker; the census gains
  `coverage` and `reason` columns (2 asserted, 6 fixed-corpus, 15 uncovered, 0
  undeclared). `asserted` is accepted only from a module that imports the final check;
  the census CLI refuses an undeclared sender even with `--write`. The census runs as
  a test in CI, not as a registered gate.

Tests (quoted below, abridged where noted): the legacy-superset additions, the
census tests, the mutation-gate test. `check_credential_spelling --self-test` 8/8,
`check_egress_mutations --self-test` 4/4, `check_gate_coverage` and
`check_ci_local_parity` pass.

## Scope of this review

The branch `drain/road-to-one-detector-senders-20261020` at `ae7e01c2f` (`git diff origin/main...ae7e01c2f`) is reviewed in two
prompts and then four, because one passes the council's input ceiling and two
(about 49 KB each) timed out at both seats twice: A1 the engine and dispatcher, A2
the council channel, B1 the consumers that read the rule table and the spelling
gate, B2 the mutation gate and the sender census. Each part states the whole
change; review the part's diff in that context. Each prompt carries its source diff in full
at one line of context. Left out of both, and available on the branch: the roadmap,
the contract and threat-model prose, the census table regenerated into the contract,
fourteen media adapters and nine sender modules whose only change is one
`egress-content:` marker comment line, the Taskfile and workflow wiring of the new
gate, and test files not quoted below (named with what they assert).

The ratification gate classifies three files of this diff as hook-plumbing source:
`src/scripts/_lib/egress_rules.ts`, `src/scripts/_lib/egress_text.ts` and
`src/scripts/hooks/dispatch_hook.ts`. The rest is reviewed because it is the same
change.

Review the delta for defects in security, architecture and behaviour. For each
finding give file:line, the scenario in which it goes wrong, and a severity. Then
classify the authority question as a trade-off you weigh: does this change widen
what any refusing surface refuses, what leaves for a provider, or what an agent may
do — `authority-expanding` or `non-expanding` — and why. State your stance (APPROVE
or REQUEST_CHANGES) and the single highest-leverage change.

## Source diff, part B1

```diff
diff --git a/src/scripts/_cli/explain_last/scrubber.ts b/src/scripts/_cli/explain_last/scrubber.ts
index 7c06229e4..92ab4fa93 100644
--- a/src/scripts/_cli/explain_last/scrubber.ts
+++ b/src/scripts/_cli/explain_last/scrubber.ts
@@ -41,3 +41,3 @@
 
-import { rawKeyPrefixPattern } from '../../_lib/egress_rules.js';
+import { assignmentPattern, rawKeyPrefixPattern } from '../../_lib/egress_rules.js';
 
@@ -52,4 +52,4 @@ const _W = '\\p{L}\\p{N}_';
 const _RAW_KEY_RE = rawKeyPrefixPattern(6);
-const _API_KEY_RE = new RegExp(
-    '\\bapi[_-]?key\\b\\s*[:=]\\s*[A-Za-z0-9+/=_-]{12,}',
+const _API_KEY_RE = assignmentPattern(
+    { keywords: ['apiKey'], before: '\\b', after: '\\b', value: '[A-Za-z0-9+/=_-]{12,}' },
     'giu',
diff --git a/src/scripts/_lib/egress_prefixes.ts b/src/scripts/_lib/egress_prefixes.ts
index 335d7c890..a2185cee8 100644
--- a/src/scripts/_lib/egress_prefixes.ts
+++ b/src/scripts/_lib/egress_prefixes.ts
@@ -1,4 +1,5 @@
 /**
- * GENERATED projection of `CREDENTIAL_PREFIXES` from the rule table
- * (`egress_rules.ts`) — never edit by hand.
+ * GENERATED projection of `CREDENTIAL_PREFIXES` and of the `apiKey` entry of
+ * `ASSIGNMENT_KEYWORDS` from the rule table (`egress_rules.ts`) — never edit by
+ * hand.
  *
@@ -8,3 +9,5 @@
  * fails when this list and the table's differ and prints the body to paste, so
- * the table stays the one place a prefix is decided.
+ * the table stays the one place a prefix is decided. The keyword is the one a
+ * bundled consumer (the low-impact redactor) reads; the full vocabulary and its
+ * builder stay in the table, out of the dispatch bundle's byte budget.
  */
@@ -34 +37,3 @@ export const CREDENTIAL_PREFIXES: readonly string[] = [
 ];
+
+export const API_KEY_ASSIGNMENT_KEYWORD = 'api[_-]?key';
diff --git a/src/scripts/_lib/workspace_secrets.ts b/src/scripts/_lib/workspace_secrets.ts
index 91b91f8d6..08c360f24 100644
--- a/src/scripts/_lib/workspace_secrets.ts
+++ b/src/scripts/_lib/workspace_secrets.ts
@@ -34,2 +34,3 @@
 import {
+    assignmentPattern,
     detect,
@@ -114,4 +115,10 @@ function highSpans(text: string): Span[] {
 // Python `(?i)` inline flag → JS `i` flag. Character class is identical.
-const _RE_KV_SECRET =
-    /(?:api[_-]?key|secret|token|password|passwd|bearer)\s*[:=]\s*['"]?[A-Za-z0-9_\-+/=]{12,}['"]?/i;
+// The keyword shape is the table's; the 12-character value is this module's threshold.
+const _RE_KV_SECRET = assignmentPattern(
+    {
+        keywords: ['apiKey', 'secret', 'token', 'password', 'passwd', 'bearer'],
+        value: `['"]?[A-Za-z0-9_\\-+/=]{12,}['"]?`,
+    },
+    'i',
+);
 
diff --git a/src/scripts/ai_council/redact_low_impact_entry.ts b/src/scripts/ai_council/redact_low_impact_entry.ts
index 849aa0c70..bb6401136 100644
--- a/src/scripts/ai_council/redact_low_impact_entry.ts
+++ b/src/scripts/ai_council/redact_low_impact_entry.ts
@@ -45,2 +45,3 @@
 
+import { API_KEY_ASSIGNMENT_KEYWORD } from '../_lib/egress_prefixes.js';
 import { _RAW_KEY_PREFIXES } from './config.js';
@@ -191,5 +192,7 @@ const _MONEY_RE = new RegExp(
 
-// Python: (?i)\bapi[_-]?key\b\s*[:=]\s*[A-Za-z0-9+/=_\-]{12,}
+// The keyword is the rule table's, read through its bundled projection (this
+// module rides in the dispatch bundle); the Unicode word boundary and the
+// 12-character value are this redactor's threshold.
 const _API_KEY_RE = new RegExp(
-    `${_UNB_BEFORE}api[_-]?key${_UNB_AFTER}\\s*[:=]\\s*[A-Za-z0-9+/=_\\-]{12,}`,
+    `${_UNB_BEFORE}${API_KEY_ASSIGNMENT_KEYWORD}${_UNB_AFTER}\\s*[:=]\\s*[A-Za-z0-9+/=_\\-]{12,}`,
     'giu',
diff --git a/src/scripts/check_credential_spelling.ts b/src/scripts/check_credential_spelling.ts
index 8e180014d..46fd69b1f 100644
--- a/src/scripts/check_credential_spelling.ts
+++ b/src/scripts/check_credential_spelling.ts
@@ -14,7 +14,10 @@
  * What it sees: a prefix written as a literal, in a string or a regex, with
- * backslash escapes removed first so `ya29\.` counts. What it does not see: a
- * prefix spelled through a character class (`gh[pousr]_`) or a keyword
- * assignment (`password =`), which carry no vendor literal. A line that names a
- * prefix in prose or as an inert fake value carries
- * `not-a-credential-pattern: <reason>`; a bare marker does not mute.
+ * backslash escapes removed first so `ya29\.` counts; a prefix spelled through a
+ * character class or an alternation (`gh[pousr]_`, `(sk|pk)-`) that expands to
+ * one of the table's prefixes; and a keyword-assignment shape — a credential
+ * keyword of the table's vocabulary and the `[:=]` operator class on one line
+ * (step 2.7). What it does not see: a shape assembled across lines, or a keyword
+ * spelled through a variable. A line that names a prefix in prose or as an inert
+ * fake value carries `not-a-credential-pattern: <reason>`; a bare marker does
+ * not mute.
  *
@@ -29,3 +32,3 @@ import { fileURLToPath, pathToFileURL } from 'node:url';
 import { CREDENTIAL_PREFIXES as PROJECTED } from './_lib/egress_prefixes.js';
-import { CREDENTIAL_PREFIXES, EGRESS_RULES } from './_lib/egress_rules.js';
+import { ASSIGNMENT_KEYWORDS, CREDENTIAL_PREFIXES, EGRESS_RULES } from './_lib/egress_rules.js';
 import { GateLedger } from './_lib/gate_ledger.js';
@@ -71,3 +74,46 @@ const RULE_ID = new RegExp(
 
-/** 1-based lines that spell a prefix; comment lines and reasoned markers excluded. */
+// One alternative of a class spelling: a stem with at most one character class.
+const CLASS_ALT = /^([a-z_]{1,16})(?:\[([a-z]{1,16})\])?$/;
+// What follows a class spelling: one separator, or a class of separators.
+const SEPARATOR = /^(?:\[[-_]{1,2}\]|[-_])/;
+const CLASS_GROUP = /\(([a-z_|[\]]{1,80})\)/g;
+const BARE_CLASS = /(?<![A-Za-z0-9_(|])([a-z]{1,16})\[([a-z]{1,16})\]/g;
+
+function expandAlt(alt: string): string[] {
+    const m = CLASS_ALT.exec(alt);
+    if (m === null) return [];
+    const stem = m[1] as string;
+    return m[2] === undefined ? [stem] : [...(m[2] as string)].map((c) => stem + c);
+}
+
+/** The table prefixes a class or alternation spelling on this line expands to. */
+export function classSpelledHits(code: string, prefixes: readonly string[] = CREDENTIAL_PREFIXES): string[] {
+    const hits = new Set<string>();
+    const judge = (stems: readonly string[], after: string): void => {
+        const sep = SEPARATOR.exec(after)?.[0];
+        if (sep === undefined) return;
+        const seps = sep.length === 1 ? [sep] : [...sep.slice(1, -1)];
+        for (const stem of stems) for (const c of seps) if (prefixes.includes(stem + c)) hits.add(stem + c);
+    };
+    for (const m of code.matchAll(CLASS_GROUP)) {
+        judge(
+            (m[1] as string).split('|').flatMap(expandAlt),
+            code.slice((m.index ?? 0) + m[0].length),
+        );
+    }
+    for (const m of code.matchAll(BARE_CLASS)) {
+        judge(expandAlt(`${m[1] as string}[${m[2] as string}]`), code.slice((m.index ?? 0) + m[0].length));
+    }
+    return [...hits];
+}
+
+const KEYWORD = new RegExp(Object.values(ASSIGNMENT_KEYWORDS).map(escapeRe).join('|'), 'i');
+const ASSIGNMENT_OPERATOR = /\[:=\]/;
+
+/** A keyword-assignment shape spelled on one line: a table keyword beside the `[:=]` operator class. */
+export function spellsAssignmentShape(code: string): boolean {
+    return ASSIGNMENT_OPERATOR.test(code) && KEYWORD.test(code);
+}
+
+/** 1-based lines that spell a prefix or a shape; comment lines and reasoned markers excluded. */
 export function offendingLines(text: string, prefixes: readonly string[] = CREDENTIAL_PREFIXES): number[] {
@@ -79,3 +125,10 @@ export function offendingLines(text: string, prefixes: readonly string[] = CREDE
         if (NOT_A_PATTERN.test(code)) return;
-        if (re.test(code.replace(RULE_ID, '').replace(/\\/g, ''))) out.push(i + 1);
+        const bare = code.replace(RULE_ID, '');
+        if (
+            re.test(bare.replace(/\\/g, '')) ||
+            classSpelledHits(bare, prefixes).length > 0 ||
+            spellsAssignmentShape(bare)
+        ) {
+            out.push(i + 1);
+        }
     });
@@ -142,4 +195,4 @@ function selfTest(): number {
             gate: GATE,
-            minCases: 5,
-            minRejectCases: 3,
+            minCases: 8,
+            minRejectCases: 5,
             cases: [
@@ -166,2 +219,24 @@ function selfTest(): number {
                 },
+                {
+                    name: 'a prefix family spelled as a character class is rejected',
+                    expect: 'reject',
+                    run: () => run(fixture('class', 'src/scripts/e.ts', 'const RE = /\\b(gh[pousr]|x)[-_][A-Za-z0-9]{8,}/g;\n')), // not-a-credential-pattern: self-test fixture
+                },
+                {
+                    name: 'a keyword-assignment shape spelled outside the table is rejected',
+                    expect: 'reject',
+                    run: () => run(fixture('assign', 'src/cli/f.ts', 'const RE = /(?:password|api[_-]?key)\\s*[:=]\\s*\\S{8,}/i;\n')), // not-a-credential-pattern: self-test fixture
+                },
+                {
+                    name: 'a shape read from the table passes',
+                    expect: 'accept',
+                    run: () =>
+                        run(
+                            fixture(
+                                'reads',
+                                'src/scripts/g.ts',
+                                "const RE = assignmentPattern({ keywords: ['password'], value: '\\\\S{8,}' }, 'i');\n",
+                            ),
+                        ),
+                },
                 {
diff --git a/src/scripts/check_memory.ts b/src/scripts/check_memory.ts
index c14922f14..a0bac5346 100644
--- a/src/scripts/check_memory.ts
+++ b/src/scripts/check_memory.ts
@@ -56,2 +56,3 @@ import YAML, { parseDocument } from 'yaml';
 import { asOf } from './_lib/as_of.js';
+import { assignmentPattern } from './_lib/egress_rules.js';
 import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
@@ -114,3 +115,3 @@ const _TYPE_COUNTS: Record<string, number> = {};
 // negatives are a curator responsibility.
-const REDACTION_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
+export const REDACTION_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
     // Key=value secret with a clear credential-word prefix. The value must
@@ -118,3 +119,12 @@ const REDACTION_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
     [
-        /\b(api[_-]?key|auth[_-]?token|access[_-]?token|bearer|secret|password|passwd|private[_-]?key)\b\s*[:=]\s*[A-Za-z0-9+/=_\-]{8,}(?![/.\w])/i,
+        assignmentPattern(
+            {
+                keywords: ['apiKey', 'authToken', 'accessToken', 'bearer', 'secret', 'password', 'passwd', 'privateKey'],
+                before: '\\b',
+                after: '\\b',
+                capture: true,
+                value: '[A-Za-z0-9+/=_\\-]{8,}(?![/.\\w])',
+            },
+            'i',
+        ),
         'inline credential',
diff --git a/src/scripts/check_reach_channels.ts b/src/scripts/check_reach_channels.ts
index 5ad2673ff..669f24c4b 100644
--- a/src/scripts/check_reach_channels.ts
+++ b/src/scripts/check_reach_channels.ts
@@ -55,2 +55,3 @@ import { parse as parseYaml } from 'yaml';
 
+import { AUTHORIZATION_HEADER, CLASS_SPELLED_PREFIXES } from './_lib/egress_rules.js';
 import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
@@ -147,3 +148,3 @@ export const REDACTIONS: readonly (readonly [RegExp, string])[] = [
     // Runs to end of line: everything after the colon is the credential.
-    [/(\bauthorization\s*:\s*)(\S.*)$/gi, `$1${REDACTED}`],
+    [new RegExp(`(\\b${AUTHORIZATION_HEADER}\\s*:\\s*)(\\S.*)$`, 'gi'), `$1${REDACTED}`],
     // `KEY=VALUE`. Two narrowings carry their weight. The lookbehind requires
@@ -155,4 +156,5 @@ export const REDACTIONS: readonly (readonly [RegExp, string])[] = [
     // Provider key prefixes — the shapes that are a secret by construction.
-    [/\b(sk|pk|rk)-[A-Za-z0-9_-]{8,}/gi, `$1-${REDACTED}`],
-    [/\b(gh[pousr]|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{8,}/gi, `$1_${REDACTED}`],
+    // Spelled as classes in the rule table; the prefix stem stays, the value does not.
+    [new RegExp(`\\b${CLASS_SPELLED_PREFIXES.dashKeys.family}[A-Za-z0-9_-]{8,}`, 'gi'), `$1-${REDACTED}`],
+    [new RegExp(`\\b${CLASS_SPELLED_PREFIXES.tokens.family}[A-Za-z0-9_-]{8,}`, 'gi'), `$1_${REDACTED}`],
     // A hex digest ≥ 32: an API key or a signature, never part of an install verb.
diff --git a/src/scripts/lint_example_fences.ts b/src/scripts/lint_example_fences.ts
index afcfaf674..5b8c8acf6 100644
--- a/src/scripts/lint_example_fences.ts
+++ b/src/scripts/lint_example_fences.ts
@@ -73,2 +73,3 @@ import { fileURLToPath, pathToFileURL } from 'node:url';
 
+import { assignmentPattern } from './_lib/egress_rules.js';
 import { GateLedger } from './_lib/gate_ledger.js';
@@ -161,4 +162,12 @@ export const PATTERNS: readonly FencePattern[] = [
         label: 'Credential assigned a literal value in an example',
-        pattern:
-            /\b(api[_-]?key|apikey|password|passwd|secret|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*["'][^"']{8,}["']/i,
+        pattern: assignmentPattern(
+            {
+                keywords: ['apiKey', 'apikey', 'password', 'passwd', 'secret', 'accessToken', 'clientSecret'],
+                before: '\\b',
+                after: '\\b',
+                capture: true,
+                value: `["'][^"']{8,}["']`,
+            },
+            'i',
+        ),
         // Placeholders are the correct way to show the shape and must not fire.
```

## Test diff

```diff
diff --git a/src/scripts/_lib/egress_legacy_superset.test.ts b/src/scripts/_lib/egress_legacy_superset.test.ts
index 9857305d6..39b1eda68 100644
--- a/src/scripts/_lib/egress_legacy_superset.test.ts
+++ b/src/scripts/_lib/egress_legacy_superset.test.ts
@@ -15,3 +15,8 @@ import { describe, expect, it } from 'vitest';
 
-import { scan as workspaceScan, scrub as workspaceScrub } from './workspace_secrets.js';
+import { CLASS_SPELLED_PREFIXES, CREDENTIAL_PREFIXES, EGRESS_RULES } from './egress_rules.js';
+import { FUZZY, scan as workspaceScan, scrub as workspaceScrub } from './workspace_secrets.js';
+import { redact_low_impact_entry } from '../ai_council/redact_low_impact_entry.js';
+import { REDACTION_PATTERNS as memoryRedactions } from '../check_memory.js';
+import { REDACTIONS as reachRedactions } from '../check_reach_channels.js';
+import { PATTERNS as fencePatterns } from '../lint_example_fences.js';
 import { scrub_string as explainScrub } from '../_cli/explain_last/scrubber.js';
@@ -164 +169,86 @@ describe('legacy superset: no consumer misses what it caught before the move', (
 });
+
+// Step 2.7: the shapes with no vendor literal, frozen as each consumer spelled
+// them before they read the table. A regex the consumer exposes must be the
+// frozen one byte for byte; one it keeps private is held to the frozen
+// behaviour over an assignment corpus.
+const UW = '[\\p{L}\\p{N}_]';
+const OLD_SHAPES = {
+    rowGeneric:
+        /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]?([^'"\s]{8,})['"]?/dgi,
+    workspaceFuzzy: /(?:api[_-]?key|secret|token|password|passwd|bearer)\s*[:=]\s*['"]?[A-Za-z0-9_\-+/=]{12,}['"]?/i,
+    memory: /\b(api[_-]?key|auth[_-]?token|access[_-]?token|bearer|secret|password|passwd|private[_-]?key)\b\s*[:=]\s*[A-Za-z0-9+/=_\-]{8,}(?![/.\w])/i,
+    fences: /\b(api[_-]?key|apikey|password|passwd|secret|access[_-]?token|client[_-]?secret)\b\s*[:=]\s*["'][^"']{8,}["']/i,
+    reachAuthorization: /(\bauthorization\s*:\s*)(\S.*)$/gi,
+    reachDashKeys: /\b(sk|pk|rk)-[A-Za-z0-9_-]{8,}/gi,
+    reachTokens: /\b(gh[pousr]|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{8,}/gi,
+    lowImpactApiKey: new RegExp(`(?<!${UW})api[_-]?key(?!${UW})\\s*[:=]\\s*[A-Za-z0-9+/=_\\-]{12,}`, 'giu'),
+    explainApiKey: /\bapi[_-]?key\b\s*[:=]\s*[A-Za-z0-9+/=_-]{12,}/giu,
+    bundlerAssignment: /(api[_-]?key|secret|token|password)\s*[:=]/iu,
+    bundlerAuthorization: /^\s*Authorization:\s/iu,
+};
+
+const sameRegex = (actual: RegExp | undefined, frozen: RegExp): void => {
+    expect(actual?.source).toBe(frozen.source);
+    expect(actual?.flags).toBe(frozen.flags);
+};
+
+const KEYWORDS = ['password', 'passwd', 'pwd', 'secret', 'api_key', 'api-key', 'apikey', 'access_token', 'token', 'bearer'];
+const ASSIGN_VALUES = [run(8, 3), run(12, 4), run(30, 5), 'hunter2hunter2', 'A1b2C3d4E5f6G7h8'];
+const ASSIGN_INPUTS: readonly string[] = KEYWORDS.flatMap((k) =>
+    ASSIGN_VALUES.flatMap((v) => [`${k}=${v}`, `${k}: "${v}"`, `  ${k.toUpperCase()} = '${v}'`, `x_${k}:${v}`]),
+);
+
+describe('legacy superset: the shapes with no vendor literal (2.7)', () => {
+    it('the exposed regexes are the frozen spellings, byte for byte', () => {
+        sameRegex(EGRESS_RULES.find((r) => r.rule === 'generic-assignment')?.pattern, OLD_SHAPES.rowGeneric);
+        sameRegex(FUZZY.find(([name]) => name === 'kv_secret')?.[1], OLD_SHAPES.workspaceFuzzy);
+        sameRegex(memoryRedactions.find(([, label]) => label === 'inline credential')?.[0], OLD_SHAPES.memory);
+        sameRegex(fencePatterns.find((p) => p.id === 'secret-literal')?.pattern, OLD_SHAPES.fences);
+        sameRegex(reachRedactions[0]?.[0], OLD_SHAPES.reachAuthorization);
+        sameRegex(reachRedactions[2]?.[0], OLD_SHAPES.reachDashKeys);
+        sameRegex(reachRedactions[3]?.[0], OLD_SHAPES.reachTokens);
+    });
+
+    it('each class-spelled family covers the table prefixes it claims', () => {
+        for (const { family, covers } of Object.values(CLASS_SPELLED_PREFIXES)) {
+            const re = new RegExp(`^${family}`, 'i');
+            for (const p of covers) {
+                expect(CREDENTIAL_PREFIXES).toContain(p);
+                expect(re.exec(p)?.[0]).toBe(p);
+            }
+        }
+    });
+
+    it('the assignment corpus exercises every private frozen shape', () => {
+        for (const re of [OLD_SHAPES.lowImpactApiKey, OLD_SHAPES.explainApiKey, OLD_SHAPES.bundlerAssignment]) {
+            expect(ASSIGN_INPUTS.some((t) => new RegExp(re.source, re.flags).test(t))).toBe(true);
+        }
+    });
+
+    it('the low-impact redactor refuses every input its old api-key shape refused', () => {
+        const missed = ASSIGN_INPUTS.filter(
+            (t) =>
+                new RegExp(OLD_SHAPES.lowImpactApiKey.source, OLD_SHAPES.lowImpactApiKey.flags).test(t) &&
+                !redact_low_impact_entry(t).violations.some((v) => v.note === 'inline api_key'),
+        );
+        expect(missed).toEqual([]);
+    });
+
+    it('the explain scrubber masks every input its old api-key shape masked', () => {
+        const left = ASSIGN_INPUTS.filter((t) => {
+            const m = new RegExp(OLD_SHAPES.explainApiKey.source, OLD_SHAPES.explainApiKey.flags).exec(t);
+            return m !== null && String(explainScrub(t)).includes(m[0]);
+        });
+        expect(left).toEqual([]);
+    });
+
+    it('the council bundler replaces every line its old assignment and header shapes replaced', () => {
+        const lines = [...ASSIGN_INPUTS, 'Authorization: Basic Zm9vOmJhcg==', '  authorization: Bearer abc'];
+        const missed = lines.filter(
+            (t) =>
+                (OLD_SHAPES.bundlerAssignment.test(t) || OLD_SHAPES.bundlerAuthorization.test(t)) && bundlerRedact(t) === t,
+        );
+        expect(missed).toEqual([]);
+    });
+});
```
