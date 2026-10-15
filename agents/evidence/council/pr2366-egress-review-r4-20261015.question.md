<!-- evidence-type: analysis -->

<!-- The round-4 prompt given to the council on 2026-10-15 for PR #2366, committed
     verbatim so the verdict recorded beside it can be checked against what was
     actually asked. Not edited after the run. -->

# Review PR #2366, round 4 — egress rule table, placeholder tokens, secret detector

Review this change at head `c4760bd9066eca0bd5966d5e6d7e066d5e46ffaa`. Round 3 of this review raised these findings: (1) class identity was keyed by (type, value), so one value minted as a credential under one type and as an identifier under another was not caught; (2) the commit-time scanner ignored the table's context and exclusion fields and fell back to the match start for a value-group row without the d flag; (3) formatToken accepted parts the recogniser rejects; (4) the parity suite's ceiling check compared span counts only; (5) the contract's identity wording and type spelling disagreed with the code. For each, state whether the code and contract below resolve it, and report any defect, including new ones.

Scope of the diff below: the full PR diff against origin/main of src/scripts/_lib/egress_rules.ts, egress_token.ts, secret_detector.ts and docs/contracts/egress-placeholders-v1.md; plus the changes since round 3 to src/scripts/_lib/egress_token.test.ts, secret_detector.test.ts and egress_rules_parity.test.ts. Omitted for size: the rest of those three test files and all of egress_rules.test.ts (the per-rule linearity check, restart-heavy timing inputs, the exclusion-state test, the d-flag check), SECURITY.md, docs/threat-model.md, .secret-allow, the roadmap, the bench harness, its report and the pre-registration.

Report defects: detection regressions against the pre-move rule pack, regex denial-of-service, token forgery or cross-scope resolution, secret bytes left in plaintext, secrets retained or logged, contract claims the code does not honour, tests that would pass without the code they cover. For each: file:line, the failure scenario, severity. State your stance.

```diff
diff --git a/src/scripts/_lib/egress_rules.ts b/src/scripts/_lib/egress_rules.ts
new file mode 100644
index 000000000..f6faa66ba
--- /dev/null
+++ b/src/scripts/_lib/egress_rules.ts
@@ -0,0 +1,334 @@
+// The one rule table for values that must not leave for a model provider in
+// plaintext (docs/contracts/egress-placeholders-v1.md). Every credential and
+// identifier pattern is defined here and nowhere else; consumers decide policy
+// (refuse, replace, report), this module only detects.
+//
+// Pure: no import, no I/O, no network. Every rule states why it is linear on a
+// hostile input; the parity test pins what the move from secret_detector kept.
+
+export type EgressClass = 'credential' | 'identifier';
+
+export interface EgressRule {
+    readonly rule: string;
+    /** Placeholder type a replacement prints, e.g. `APIKEY`. */
+    readonly type: string;
+    readonly class: EgressClass;
+    /** Finding kind reported by the commit-time scanner; defaults to `rule`. */
+    readonly kind?: string;
+    /** MUST carry the global flag. */
+    readonly pattern: RegExp;
+    /** Why the pattern runs in linear time on any input; required, reviewed with the pattern. */
+    readonly linearity: string;
+    /** Capture group holding the value; the whole match when absent. A rule that sets it MUST carry the d flag. */
+    readonly valueGroup?: number;
+    readonly validator?: (value: string) => boolean;
+    /** The rule fires only when `words` matches within `window` chars of the value. */
+    readonly context?: { readonly words: RegExp; readonly window: number };
+    readonly exclusions?: readonly RegExp[];
+}
+
+/** A detected value: offsets into the scanned text, never the value itself. */
+export interface EgressSpan {
+    readonly rule: string;
+    readonly type: string;
+    readonly class: EgressClass;
+    readonly start: number;
+    readonly end: number;
+    readonly validated: boolean;
+}
+
+export function shannonEntropy(value: string): number {
+    const freq = new Map<string, number>();
+    for (const ch of value) {
+        freq.set(ch, (freq.get(ch) ?? 0) + 1);
+    }
+    const n = value.length;
+    let entropy = 0;
+    for (const count of freq.values()) {
+        const p = count / n;
+        entropy -= p * Math.log2(p);
+    }
+    return entropy;
+}
+
+// A keyword-shaped assignment of a low-entropy word (`secret: moderate`) or of a
+// code expression (`opts.apiKey`, `${API_KEY}`, `load()`) is not a credential.
+const GENERIC_MIN_LENGTH = 16;
+const GENERIC_MIN_ENTROPY = 3.3;
+const CODE_EXPR = /[()$`{}<>[\];,]|->|=>|\.\w/;
+
+export function looksLikeSecretValue(value: string): boolean {
+    if (value.length < GENERIC_MIN_LENGTH || CODE_EXPR.test(value)) {
+        return false;
+    }
+    const hasDigit = /[0-9]/.test(value);
+    const mixedCase = /[a-z]/.test(value) && /[A-Z]/.test(value);
+    if (!hasDigit && !mixedCase) {
+        return false;
+    }
+    return shannonEntropy(value) >= GENERIC_MIN_ENTROPY;
+}
+
+const PREFIX_RUN =
+    'Starts only where the literal prefix occurs; the single class after it either reaches its minimum and consumes the whole run (the global scan resumes past it) or fails within the minimum, so each character is read a bounded number of times.';
+const FIXED_RUN =
+    'Fixed-length class after a literal prefix: every attempt reads at most the prefix plus the fixed count.';
+
+// Quantifiers are unbounded where the pattern is linear without a bound, so a
+// long value is matched whole and no suffix survives a replacement. Each rule
+// states why it is linear; a bound remains only where the unbounded form was
+// quadratic, and what that bound loses is published in DETECTION_CEILINGS.
+export const EGRESS_RULES: readonly EgressRule[] = [
+    {
+        rule: 'anthropic-api-key',
+        type: 'APIKEY',
+        class: 'credential',
+        kind: 'anthropic-api-key',
+        pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g,
+        linearity: PREFIX_RUN,
+    },
+    {
+        rule: 'anthropic-project-key',
+        type: 'APIKEY',
+        class: 'credential',
+        kind: 'anthropic-api-key',
+        pattern: /sk-proj-[A-Za-z0-9_-]{20,}/g,
+        linearity: PREFIX_RUN,
+    },
+    { rule: 'aws-access-key', type: 'APIKEY', class: 'credential', pattern: /AKIA[0-9A-Z]{16}/g, linearity: FIXED_RUN },
+    {
+        rule: 'google-api-key',
+        type: 'APIKEY',
+        class: 'credential',
+        pattern: /AIza[0-9A-Za-z_-]{35}/g,
+        linearity: FIXED_RUN,
+    },
+    { rule: 'github-pat', type: 'TOKEN', class: 'credential', pattern: /ghp_[0-9A-Za-z]{36}/g, linearity: FIXED_RUN },
+    {
+        rule: 'github-fine-grained-pat',
+        type: 'TOKEN',
+        class: 'credential',
+        kind: 'github-pat',
+        pattern: /github_pat_[0-9A-Za-z_]{22,}/g,
+        linearity: PREFIX_RUN,
+    },
+    {
+        rule: 'jwt',
+        type: 'TOKEN',
+        class: 'credential',
+        pattern: /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
+        linearity:
+            'The lookbehind admits a start only where a segment run begins, so no attempt starts inside a run another attempt already read; an attempt spans at most three dot-separated runs, so each character is read by at most three attempts. Without the lookbehind every inner eyJ restarted a scan of the same run, which is quadratic.',
+    },
+    {
+        rule: 'stripe-secret-key',
+        type: 'APIKEY',
+        class: 'credential',
+        pattern: /sk_(?:live|test)_[0-9A-Za-z]{16,}/g,
+        linearity: PREFIX_RUN,
+    },
+    {
+        rule: 'slack-token',
+        type: 'TOKEN',
+        class: 'credential',
+        pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/g,
+        linearity: PREFIX_RUN,
+    },
+    {
+        rule: 'pem-private-key',
+        type: 'PRIVATEKEY',
+        class: 'credential',
+        pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
+        linearity:
+            'Starts only at the literal header; the label class excludes the dash, so label runs of different headers are disjoint, and backtracking over one run tries the fixed 16-character suffix at each position: linear with a constant factor of 16.',
+    },
+    {
+        rule: 'db-connection-uri',
+        type: 'DBURI',
+        class: 'credential',
+        pattern: /\b[a-z][a-z0-9+.-]{0,31}:\/\/[^\s:/@]+:[^\s:/@]+@/g,
+        linearity:
+            'The scheme is bounded to 32 characters, so at most 32 starts reach any one ://; the userinfo classes exclude : and /, so a userinfo run belongs to exactly one :// and is read at most 32 times per side. Unbounded, the scheme let every inner word boundary of a dotted run restart the scan, which is quadratic.',
+    },
+    {
+        rule: 'generic-assignment',
+        type: 'SECRET',
+        class: 'credential',
+        pattern:
+            /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]?([^'"\s]{8,})['"]?/dgi,
+        valueGroup: 1,
+        validator: looksLikeSecretValue,
+        linearity:
+            'Starts only at a keyword; the whitespace runs end at the first non-space and the value run at the first quote or space, and a match moves the global scan past the value, so no character is read by more than one successful attempt and a failed attempt stops at the first character after the whitespace.',
+    },
+];
+
+/**
+ * Returns a description of the first unbounded quantifier (`+`, `*`, `{n,}`)
+ * outside a character class, or null. Escapes and classes are skipped.
+ */
+export function findUnboundedQuantifier(pattern: RegExp): string | null {
+    const src = pattern.source;
+    let inClass = false;
+    for (let i = 0; i < src.length; i++) {
+        const ch = src[i];
+        if (ch === '\\') {
+            i++;
+            continue;
+        }
+        if (inClass) {
+            if (ch === ']') inClass = false;
+            continue;
+        }
+        if (ch === '[') {
+            inClass = true;
+            continue;
+        }
+        if (ch === '+' || ch === '*') {
+            return `'${ch}' at ${i}`;
+        }
+        if (ch === '{') {
+            const m = /^\{\d+,\}/.exec(src.slice(i));
+            if (m) return `'${m[0]}' at ${i}`;
+        }
+    }
+    return null;
+}
+
+const CLASS_RANK: Readonly<Record<EgressClass, number>> = {
+    credential: 1,
+    identifier: 0,
+};
+
+/** A global or sticky regex keeps lastIndex between calls; reset it so every call tests the whole value. */
+function matchesFromStart(re: RegExp, value: string): boolean {
+    re.lastIndex = 0;
+    return re.test(value);
+}
+
+/**
+ * Applies every field of a row to one regex match: value extraction from the
+ * engine's capture offsets, exclusions, the context window and the validator.
+ * The single place both readers of the table evaluate a candidate.
+ */
+export function evaluateMatch(
+    r: EgressRule,
+    text: string,
+    m: RegExpExecArray,
+): { start: number; end: number; validated: boolean } | null {
+    const value = r.valueGroup !== undefined ? m[r.valueGroup] : m[0];
+    if (value === undefined || value.length === 0) return null;
+    const start = r.valueGroup !== undefined ? (m.indices?.[r.valueGroup]?.[0] ?? -1) : m.index;
+    if (start < 0) {
+        throw new Error(`egress rule ${r.rule}: a valueGroup rule needs the d flag for capture offsets`);
+    }
+    const end = start + value.length;
+    if (r.exclusions?.some((x) => matchesFromStart(x, value))) return null;
+    if (r.context) {
+        const lo = Math.max(0, start - r.context.window);
+        const hi = Math.min(text.length, end + r.context.window);
+        const around = text.slice(lo, start) + ' ' + text.slice(end, hi);
+        r.context.words.lastIndex = 0;
+        if (!r.context.words.test(around)) return null;
+    }
+    if (r.validator) {
+        return r.validator(value) ? { start, end, validated: true } : null;
+    }
+    return { start, end, validated: false };
+}
+
+/** Candidate spans per rule, before overlap resolution. */
+export function findSpans(text: string, rules: readonly EgressRule[] = EGRESS_RULES): EgressSpan[] {
+    const out: EgressSpan[] = [];
+    for (const r of rules) {
+        r.pattern.lastIndex = 0;
+        let m: RegExpExecArray | null;
+        while ((m = r.pattern.exec(text)) !== null) {
+            if (m[0].length === 0) {
+                r.pattern.lastIndex += 1;
+                continue;
+            }
+            const c = evaluateMatch(r, text, m);
+            if (c === null) continue;
+            const { start, end, validated } = c;
+            out.push({
+                rule: r.rule,
+                type: r.type,
+                class: r.class,
+                start,
+                end,
+                validated,
+            });
+        }
+    }
+    return out;
+}
+
+/**
+ * Resolves overlaps: the more sensitive class wins, then the validated span,
+ * then the longer one, then the earlier one. Result is ordered by start.
+ */
+export function resolveOverlaps(spans: readonly EgressSpan[]): EgressSpan[] {
+    const ranked = [...spans].sort(
+        (a, b) =>
+            CLASS_RANK[b.class] - CLASS_RANK[a.class] ||
+            Number(b.validated) - Number(a.validated) ||
+            b.end - b.start - (a.end - a.start) ||
+            a.start - b.start,
+    );
+    const kept: EgressSpan[] = [];
+    for (const s of ranked) {
+        if (!kept.some((k) => s.start < k.end && k.start < s.end)) kept.push(s);
+    }
+    return kept.sort((a, b) => a.start - b.start);
+}
+
+export function detect(text: string, rules: readonly EgressRule[] = EGRESS_RULES): EgressSpan[] {
+    return resolveOverlaps(findSpans(text, rules));
+}
+
+/**
+ * Replaces non-overlapping spans right to left, so every offset still refers
+ * to the original text. `index` is the span's position in start order.
+ */
+export function replaceSpans(
+    text: string,
+    spans: readonly EgressSpan[],
+    replacement: (span: EgressSpan, index: number) => string,
+): string {
+    const ordered = [...spans].sort((a, b) => a.start - b.start);
+    for (let i = 1; i < ordered.length; i++) {
+        if ((ordered[i] as EgressSpan).start < (ordered[i - 1] as EgressSpan).end) {
+            throw new Error('replaceSpans: spans overlap; resolve them first');
+        }
+    }
+    let out = text;
+    for (let i = ordered.length - 1; i >= 0; i--) {
+        const s = ordered[i] as EgressSpan;
+        out = out.slice(0, s.start) + replacement(s, i) + out.slice(s.end);
+    }
+    return out;
+}
+
+/** A case the pre-move rule pack detected and this table deliberately does not. */
+export interface DetectionCeiling {
+    readonly rule: string;
+    readonly ceiling: string;
+    /** Case ids in egress_rules_parity.test.ts that demonstrate the loss. */
+    readonly cases: readonly string[];
+}
+
+export const DETECTION_CEILINGS: readonly DetectionCeiling[] = [
+    {
+        rule: 'jwt',
+        ceiling:
+            'A JWT glued to a preceding base64url character (letter, digit, _ or -) is not detected; the pre-move pattern matched from the inner eyJ. The lookbehind is what makes the rule linear.',
+        cases: ['jwt-glued-word'],
+    },
+    {
+        rule: 'db-connection-uri',
+        ceiling:
+            'A scheme longer than 32 characters with no inner word boundary is not detected, and a dotted scheme longer than 32 characters is matched from a later boundary, so the span starts inside the scheme; the userinfo, which holds the secret, is covered either way.',
+        cases: ['uri-scheme-33', 'uri-scheme-dotted-40'],
+    },
+];
diff --git a/src/scripts/_lib/egress_token.ts b/src/scripts/_lib/egress_token.ts
new file mode 100644
index 000000000..bfd738ac6
--- /dev/null
+++ b/src/scripts/_lib/egress_token.ts
@@ -0,0 +1,144 @@
+// The placeholder grammar of docs/contracts/egress-placeholders-v1.md and its
+// one recogniser. The spelling is the one the pre-registered model-fidelity bar
+// selected (internal/bench/egress-placeholders-PREREG.md, endpoint d); no other
+// spelling may exist under src/, which egress_token.test.ts enforces.
+
+import { createHmac, randomBytes } from 'node:crypto';
+
+import { detect, type EgressClass, replaceSpans } from './egress_rules.js';
+
+export const TOKEN_FP_LENGTH = 6;
+
+/** `__TYPE_n_fingerprint__` — type upper-case, number from 1, fingerprint lower hex. */
+export const TOKEN_PATTERN = /__([A-Z][A-Z0-9]{1,15})_([1-9][0-9]{0,5})_([0-9a-f]{6})__/g;
+
+const TOKEN_TYPE = /^[A-Z][A-Z0-9]{1,15}$/;
+const MAX_TOKEN_NUMBER = 999_999;
+
+export interface TokenParts {
+    readonly type: string;
+    readonly number: number;
+    readonly fingerprint: string;
+}
+
+export interface ParsedToken extends TokenParts {
+    readonly start: number;
+    readonly end: number;
+}
+
+const TOKEN_FP = /^[0-9a-f]{6}$/;
+
+/** The one writer of the grammar; it refuses parts the recogniser would not parse back. */
+export function formatToken(p: TokenParts): string {
+    if (
+        !TOKEN_TYPE.test(p.type) ||
+        !Number.isInteger(p.number) ||
+        p.number < 1 ||
+        p.number > MAX_TOKEN_NUMBER ||
+        !TOKEN_FP.test(p.fingerprint)
+    ) {
+        throw new Error('formatToken: parts outside the token grammar');
+    }
+    return `__${p.type}_${p.number}_${p.fingerprint}__`;
+}
+
+export function parseTokens(text: string): ParsedToken[] {
+    const out: ParsedToken[] = [];
+    TOKEN_PATTERN.lastIndex = 0;
+    let m: RegExpExecArray | null;
+    while ((m = TOKEN_PATTERN.exec(text)) !== null) {
+        out.push({
+            type: m[1] as string,
+            number: Number(m[2]),
+            fingerprint: m[3] as string,
+            start: m.index,
+            end: m.index + m[0].length,
+        });
+    }
+    return out;
+}
+
+interface Entry {
+    readonly type: string;
+    readonly class: EgressClass;
+    readonly number: number;
+    readonly fingerprint: string;
+    /** Held in memory for identifiers only; a credential value is never kept. */
+    readonly value: string | null;
+}
+
+/**
+ * One issuing scope: a random key that is never sent and never persisted, and
+ * the in-memory mapping from minted tokens back to identifier values.
+ */
+export class TokenScope {
+    private readonly key: Uint8Array;
+    private readonly byDigest = new Map<string, Entry>();
+    private readonly byToken = new Map<string, Entry>();
+    private readonly counters = new Map<string, number>();
+    /** Keyed digest of the canonical value alone → its class, whatever type it was minted under. */
+    private readonly classByValue = new Map<string, EgressClass>();
+
+    constructor() {
+        this.key = randomBytes(32);
+    }
+
+    mint(type: string, cls: EgressClass, canonical: string): string {
+        if (!TOKEN_TYPE.test(type)) {
+            throw new Error(`TokenScope: type ${JSON.stringify(type)} is outside the token grammar`);
+        }
+        const valueDigest = createHmac('sha256', this.key).update(`value\u0000${canonical}`).digest('hex');
+        const seenClass = this.classByValue.get(valueDigest);
+        if (seenClass !== undefined && seenClass !== cls) {
+            throw new Error(`TokenScope: this value was minted under class ${seenClass}, refusing class ${cls}`);
+        }
+        const digest = createHmac('sha256', this.key).update(`${type}\u0000${canonical}`).digest('hex');
+        const known = this.byDigest.get(digest);
+        if (known !== undefined) {
+            return formatToken(known);
+        }
+        const number = (this.counters.get(type) ?? 0) + 1;
+        if (number > MAX_TOKEN_NUMBER) {
+            throw new Error(`TokenScope: ${type} has used every number the grammar can carry`);
+        }
+        this.counters.set(type, number);
+        const entry: Entry = {
+            type,
+            class: cls,
+            number,
+            fingerprint: digest.slice(0, TOKEN_FP_LENGTH),
+            value: cls === 'identifier' ? canonical : null,
+        };
+        this.classByValue.set(valueDigest, cls);
+        this.byDigest.set(digest, entry);
+        this.byToken.set(formatToken(entry), entry);
+        return formatToken(entry);
+    }
+
+    /** True only for a token this scope minted; token syntax alone proves nothing. */
+    owns(token: string): boolean {
+        return this.byToken.has(token);
+    }
+
+    /** The identifier value a token stands for, or null: unknown, forged, foreign or credential. */
+    resolve(token: string): string | null {
+        return this.byToken.get(token)?.value ?? null;
+    }
+
+    /** What the scope holds, without any value. */
+    snapshot(): Array<Omit<Entry, 'value'>> {
+        return [...this.byDigest.values()].map(({ value: _value, ...rest }) => rest);
+    }
+}
+
+/**
+ * Replaces every detected value with its token. A span is left alone only when
+ * it lies inside a token this scope minted, so a second pass returns the same
+ * bytes while a token-shaped substring planted inside a credential, or a token
+ * from another scope, shields nothing.
+ */
+export function replaceValues(text: string, scope: TokenScope): string {
+    const owned = parseTokens(text).filter((t) => scope.owns(text.slice(t.start, t.end)));
+    const spans = detect(text).filter((s) => !owned.some((t) => t.start <= s.start && s.end <= t.end));
+    return replaceSpans(text, spans, (s) => scope.mint(s.type, s.class, text.slice(s.start, s.end)));
+}
diff --git a/src/scripts/_lib/secret_detector.ts b/src/scripts/_lib/secret_detector.ts
index 51a94403b..93b14217e 100644
--- a/src/scripts/_lib/secret_detector.ts
+++ b/src/scripts/_lib/secret_detector.ts
@@ -23,2 +23,4 @@
 
+import { EGRESS_RULES, type EgressRule, evaluateMatch, shannonEntropy } from './egress_rules.js';
+
 /** One detected secret. Never carries the raw value — see `masked`. */
@@ -36,2 +38,4 @@ export interface ScanOptions {
     path?: string;
+    /** Rule rows to scan with; defaults to the table's credential rows. */
+    rules?: readonly EgressRule[];
 }
@@ -50,44 +54,7 @@ export const HEX_ENTROPY_THRESHOLD = 3.0;
 // ---------------------------------------------------------------------
-// Regex rule pack (HIGH-confidence).
+// Regex rule pack (HIGH-confidence) — the credential rows of the one rule
+// table in egress_rules.ts, which owns every pattern literal.
 // ---------------------------------------------------------------------
 
-interface Rule {
-    rule: string;
-    kind: string;
-    regex: RegExp; // MUST carry the global flag
-    valueGroup?: number; // capture group holding the sensitive value (default 0)
-}
-
-// Reused verbatim from lint_mcp_config_security.ts `_SECRET` (do NOT weaken),
-// split into individually-kinded rules, plus the extension set from the spec.
-const RULES: readonly Rule[] = [
-    { rule: 'anthropic-api-key', kind: 'anthropic-api-key', regex: /sk-ant-[A-Za-z0-9_-]{20,}/g },
-    { rule: 'anthropic-project-key', kind: 'anthropic-api-key', regex: /sk-proj-[A-Za-z0-9_-]{20,}/g },
-    { rule: 'aws-access-key', kind: 'aws-access-key', regex: /AKIA[0-9A-Z]{16}/g },
-    { rule: 'google-api-key', kind: 'google-api-key', regex: /AIza[0-9A-Za-z_-]{35}/g },
-    { rule: 'github-pat', kind: 'github-pat', regex: /ghp_[0-9A-Za-z]{36}/g },
-    // Fine-grained PATs (github_pat_…) were a measured detector gap: the
-    // 2026-07-28 adversarial corpus pass flagged them as missed positives.
-    { rule: 'github-fine-grained-pat', kind: 'github-pat', regex: /github_pat_[0-9A-Za-z_]{22,}/g },
-    {
-        rule: 'jwt',
-        kind: 'jwt',
-        regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
-    },
-    // Extensions.
-    { rule: 'stripe-secret-key', kind: 'stripe-secret-key', regex: /sk_(?:live|test)_[0-9A-Za-z]{16,}/g },
-    { rule: 'slack-token', kind: 'slack-token', regex: /xox[baprs]-[0-9A-Za-z-]{10,}/g },
-    { rule: 'pem-private-key', kind: 'pem-private-key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
-    {
-        rule: 'db-connection-uri',
-        kind: 'db-connection-uri',
-        regex: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s:/@]+@/g,
-    },
-    {
-        rule: 'generic-assignment',
-        kind: 'generic-assignment',
-        regex: /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"]?([^'"\s]{8,})['"]?/gi,
-        valueGroup: 1,
-    },
-];
+const RULES = EGRESS_RULES.filter((r) => r.class === 'credential');
 
@@ -135,32 +102,2 @@ function isAllSameChar(value: string): boolean {
 
-// Minimum length + entropy for a `generic-assignment` value to count as a real
-// credential. A bare `secret: moderate` / `token: modelName` / `key: request()`
-// is a keyword-shaped assignment of a low-entropy WORD — not a secret. Real
-// credentials assigned this way are long and high-entropy. Without this gate the
-// generic rule floods on prose, config, and test data (the FP class the council
-// warned about — precision over allowlist growth).
-const GENERIC_MIN_LENGTH = 16;
-const GENERIC_MIN_ENTROPY = 3.3;
-// Code-expression shapes: an assignment RHS that is a reference / call /
-// interpolation, not a literal credential (`opts.apiKey`, `${API_KEY}`,
-// `load()`, `process.env.X`, `$this->get()`). Never a real inline secret.
-const CODE_EXPR = /[()$`{}<>[\];,]|->|=>|\.\w/;
-
-function looksLikeSecretValue(value: string): boolean {
-    if (value.length < GENERIC_MIN_LENGTH) {
-        return false;
-    }
-    if (CODE_EXPR.test(value)) {
-        return false;
-    }
-    // A real credential carries entropy AND is not a plain lowercase word —
-    // it has a digit or mixed case.
-    const hasDigit = /[0-9]/.test(value);
-    const mixedCase = /[a-z]/.test(value) && /[A-Z]/.test(value);
-    if (!hasDigit && !mixedCase) {
-        return false;
-    }
-    return shannonEntropy(value) >= GENERIC_MIN_ENTROPY;
-}
-
 function isPlaceholderValue(value: string, pathHint?: string): boolean {
@@ -192,16 +129,2 @@ function maskSecret(value: string): string {
 
-function shannonEntropy(value: string): number {
-    const freq = new Map<string, number>();
-    for (const ch of value) {
-        freq.set(ch, (freq.get(ch) ?? 0) + 1);
-    }
-    const n = value.length;
-    let entropy = 0;
-    for (const count of freq.values()) {
-        const p = count / n;
-        entropy -= p * Math.log2(p);
-    }
-    return entropy;
-}
-
 function overlaps(spans: ReadonlyArray<[number, number]>, start: number, end: number): boolean {
@@ -231,18 +154,12 @@ export function scanText(text: string, opts: ScanOptions = {}): SecretFinding[]
         // Layer 1 — regex rule pack (HIGH, demoted to LOW for placeholders).
-        for (const rule of RULES) {
-            rule.regex.lastIndex = 0;
+        for (const rule of opts.rules ?? RULES) {
+            rule.pattern.lastIndex = 0;
             let m: RegExpExecArray | null;
-            while ((m = rule.regex.exec(line)) !== null) {
-                const value = rule.valueGroup !== undefined ? m[rule.valueGroup] : m[0];
-                if (value === undefined) {
-                    if (m.index === rule.regex.lastIndex) {
-                        rule.regex.lastIndex += 1;
-                    }
-                    continue;
-                }
-                // The keyword-anchored generic rule needs a value-likeness gate:
-                // a low-entropy word after `secret:`/`token:` is not a credential.
-                if (rule.rule === 'generic-assignment' && !looksLikeSecretValue(value)) {
-                    if (m.index === rule.regex.lastIndex) {
-                        rule.regex.lastIndex += 1;
+            while ((m = rule.pattern.exec(line)) !== null) {
+                // Every field of the row — capture offsets, exclusions, context,
+                // validator — is applied by the table, the same way for both readers.
+                const c = evaluateMatch(rule, line, m);
+                if (c === null) {
+                    if (m.index === rule.pattern.lastIndex) {
+                        rule.pattern.lastIndex += 1;
                     }
@@ -250,3 +167,4 @@ export function scanText(text: string, opts: ScanOptions = {}): SecretFinding[]
                 }
-                const valueStart = m.index + m[0].indexOf(value);
+                const valueStart = c.start;
+                const value = line.slice(c.start, c.end);
                 const confidence: SecretFinding['confidence'] = isPlaceholderValue(value, pathHint)
@@ -256,3 +174,3 @@ export function scanText(text: string, opts: ScanOptions = {}): SecretFinding[]
                     rule: rule.rule,
-                    kind: rule.kind,
+                    kind: rule.kind ?? rule.rule,
                     line: lineNo,
@@ -263,4 +181,4 @@ export function scanText(text: string, opts: ScanOptions = {}): SecretFinding[]
                 covered.push([valueStart, valueStart + value.length]);
-                if (m.index === rule.regex.lastIndex) {
-                    rule.regex.lastIndex += 1;
+                if (m.index === rule.pattern.lastIndex) {
+                    rule.pattern.lastIndex += 1;
                 }
diff --git a/docs/contracts/egress-placeholders-v1.md b/docs/contracts/egress-placeholders-v1.md
new file mode 100644
index 000000000..4dcf860d2
--- /dev/null
+++ b/docs/contracts/egress-placeholders-v1.md
@@ -0,0 +1,167 @@
+---
+stability: experimental
+---
+
+# Egress placeholders v1 — what leaves for a model provider, and what each state proves
+
+**Purpose.** Fix the vocabulary every egress-placeholder surface is built and
+judged against: which values are listed, what happens to each class, what a
+placeholder token is, and what a published coverage state is allowed to claim.
+
+**Scope.** Any byte sequence that travels from a session or from this package
+toward an external model provider. Two owners build against this contract:
+`road-to-one-detector-and-the-senders-we-own` (requests this package writes
+itself) and `road-to-placeholders-on-the-wire` (channels a host writes). Neither
+re-defines a term below.
+
+**Stability: experimental.** The rule table, the token grammar and an in-memory
+replacement exist; identifier rules, the senders' final check and every host
+carrier do not. A
+section below that names an open decision is not a promise of its outcome.
+
+## What this is not
+
+Replacing a value with a token that a local mapping can turn back into the value
+is **pseudonymisation**. Nothing built under this contract may be described with
+a stronger word, and no published state claims that a request is free of
+personal or confidential meaning. A sentence that identifies a person or a
+customer without a recognisable span — a role, a nickname, a description — is
+outside every rule and is reported as the **implicit-identity residue**, never
+as covered.
+
+## The two classes
+
+| Class | Members | Restore policy |
+|---|---|---|
+| `credential` | values that grant access: API keys, tokens, private keys, passwords, connection strings with an inline secret | **Never restored, never stored.** The value is not written anywhere — not in a mapping, a log, a cache or a record. A local edit that needs the value re-derives it from the object it came from. |
+| `identifier` | values that point at a person, account or payment instrument: e-mail address, phone number, IBAN, payment card, tax ID | **Restored locally for display or for a sink the human controls.** How an identifier value rests between processes, if at all, is the `identifier-table-at-rest` decision of `road-to-placeholders-on-the-wire`; until that records a verdict, no identifier value rests anywhere outside the memory of the process that replaced it. |
+
+A rule belongs to exactly one class. When two rules claim overlapping bytes, the
+more sensitive class wins (`credential` over `identifier`), then the span a
+validator confirmed, then the longer span. Only the rule table
+(`src/scripts/_lib/egress_rules.ts`) defines a pattern for either class.
+
+## Refuse or replace (D4)
+
+**Refuse where content has not yet moved; replace where it has.** A surface that
+can decline to produce or send output — a writer, a store, a pre-send check —
+refuses on a finding and names the type. A surface that has already received
+the content and must pass something on — a tool result being returned, a bundle
+being assembled for a request that will be sent — replaces. A surface never
+masks a value into a shortened form: a masked fragment is a partial disclosure.
+
+## The placeholder token
+
+A token stands for one value inside one **issuing scope**. It carries four parts:
+
+| Part | Meaning |
+|---|---|
+| type | the rule type that found the value (`EMAIL`, `IBAN`, …) |
+| number | per type, in first-seen order within the scope; what a human reads |
+| fingerprint | a truncated keyed digest over type and canonical value, under a key drawn at random per scope and **never sent and never persisted** |
+| variant | optional; distinguishes two spellings of one entity (a spaced and a compact IBAN) so a restore reproduces each spelling byte for byte |
+
+- **Identity.** Two occurrences of one canonical value in one scope get one
+  number and one fingerprint. Two different values get two numbers. One
+  canonical value has one class for the life of the scope, **whatever type it is
+  minted under**: minting it again under the other class is refused, so a value
+  first seen as a credential can never become restorable, and the reverse cannot
+  silently drop a restore. The class is indexed by a keyed digest of the value
+  alone, never by the value.
+- **Scope.** For a request this package writes, the scope is the one invocation
+  that builds and sends it. For a host carrier, the scope is set by that
+  roadmap's session table, which must keep the key out of every request.
+- **Lifecycle.** A token is minted on first replacement and dies with its scope's
+  key. A token from another scope, a token the model invented and a token whose
+  fingerprint does not match its number are **unresolved** — never resolved by
+  number alone, never guessed. This holds with high probability, not with
+  certainty: the fingerprint is 24 bits, so one invented or foreign token whose
+  type and number match a token the scope issued resolves with probability
+  2^-24 (about 6 in 100 million), and k such guesses against one issued token
+  with probability about k·2^-24. What a successful guess returns is an
+  identifier value to the local process that holds the scope — never a
+  credential, which no scope stores.
+- **Owner of resolution state.** The process that minted the token. No other
+  process resolves it unless the at-rest decision gives it the state.
+- **Stability of bytes.** Replacing already-replaced text yields the same bytes.
+  A span is left alone only when it is exactly a token **this scope minted**;
+  token syntax alone protects nothing, so a token-shaped substring planted inside
+  a credential, or a token from another scope, does not stop detection. Rules do
+  match tokens in places — `generic-assignment` matches one after a keyword —
+  which is why the scope check, not the grammar, carries idempotence. One recogniser parses the grammar;
+  the grammar's spelling is one constant, and no second spelling exists under
+  `src/`.
+- **Spelling: `__TYPE_n_fp__`** — e.g. `__IBAN_1_495cff__`: type `[A-Z][A-Z0-9]{1,15}` (an upper-case
+  letter, then 1–15 upper-case letters or digits), number from 1, fingerprint six lower-case hex digits. Chosen
+  by the model-fidelity bar pre-registered in
+  `internal/bench/egress-placeholders-PREREG.md` (endpoint d) among spellings that
+  survive an unquoted shell word, YAML, JSON and an anchored regex; reading in
+  `internal/bench/reports/egress-placeholders-fidelity-2026-10-15.md`. The
+  bracket form `[TYPE_n]` is excluded on that survival test. The variant suffix
+  is not yet part of the spelling; adding it is a change to this section. A
+  surface that renders Markdown must escape a token, which renders as bold
+  otherwise. Constant and recogniser: `src/scripts/_lib/egress_token.ts`.
+
+## The four published states
+
+A channel is published in exactly one state per class. The state is a claim
+about evidence, not intent.
+
+| State | Where it may be claimed | What counts as proof |
+|---|---|---|
+| `asserted` | only where this package writes the request itself | the outbound body is rescanned immediately before the write for every value replaced in the scope and every high-confidence finding, a hit refuses the send, and a canary that plants a raw value past the replacement is refused — removing the check turns the canary red |
+| `replaced` | where a host hook substitutes content before it reaches the model | the substitution runs on the channel, and the rate at which the host drops or ignores the substituted content is measured and published beside the state |
+| `gated` | where content can only be refused, not rewritten | the refusal fires on a planted value on that channel, and what the refusal costs the user is stated |
+| `uncovered` | everywhere nothing above reaches | none required — this is the default, and a channel without evidence is `uncovered`, never left unlisted |
+
+A channel moves out of `uncovered` only with its proof committed. A measured null
+or a regression is published in the same table, not withheld.
+
+## Logging
+
+Anything written about a finding — a log line, a record, a report, a hook
+message, a test failure text — carries the **type and a count**, and nothing
+else derived from the value: no value, no masked fragment, no prefix, no length,
+no digest a reader could test a guess against. Counts are aggregated per type
+per surface. A test that checks a finding asserts on type and count; a planted
+fixture value is never echoed into the test's own failure output.
+
+**Known exception, not yet conforming.** The commit-time scanner
+(`secret_detector.ts`, read by `check_secret_leak`) reports a masked preview —
+up to four leading and two trailing characters — because `secret-vcs-guard`
+asks the agent to show the match to the human before a commit. When that scanner
+runs inside an agent session, the preview reaches the model provider with the
+rest of the tool output. It predates this contract and is recorded here rather
+than claimed conforming; moving the scanner onto this rule is part of step 2.2
+of `road-to-one-detector-and-the-senders-we-own`, which shares detection across
+consumers.
+
+## Detection ceilings
+
+The credential rows moved here from the commit-time scanner unchanged in what
+they match, with two exceptions, each the price of making a pattern that was
+quadratic on a hostile input linear. `DETECTION_CEILINGS` in the rule table
+holds the same list; a test fails when the two disagree or when a listed ceiling
+no longer loses anything.
+
+| Rule | What is not detected | Why |
+|---|---|---|
+| `jwt` | a JWT glued to a preceding letter, digit, `_` or `-` (the old pattern matched from the inner `eyJ`) | a lookbehind admits a start only where a segment run begins; without it every inner `eyJ` restarted the same scan |
+| `db-connection-uri` | a scheme over 32 characters with no inner word boundary; a dotted scheme over 32 characters is matched from a later boundary, so the span starts inside the scheme while the userinfo is still covered | the scheme bound caps the restarts that reach one `://` |
+
+Every other rule states in its `linearity` field why it runs in linear time
+without a bound, and matches a value of any length whole, so a replacement never
+leaves a suffix in plaintext.
+
+## Settings
+
+Replacement paths are switched by `egress.placeholders.mode`. The shipped
+default is `off`; whether any class is replaced by default for consumers is an
+owner decision (`default-mode-for-consumers`). `observe` detects and counts only
+and never changes what any surface sees.
+
+## See also
+
+- `docs/threat-model.md` row j — the threats this contract answers.
+- `src/scripts/_lib/secret_detector.ts` — the commit-time credential scanner,
+  which reads its rules from the same table.
diff --git a/src/scripts/_lib/egress_token.test.ts b/src/scripts/_lib/egress_token.test.ts
index fa39c8c78..4484b4431 100644
--- a/src/scripts/_lib/egress_token.test.ts
+++ b/src/scripts/_lib/egress_token.test.ts
@@ -68,0 +69,7 @@ describe('grammar', () => {
+    it('formatToken refuses parts the recogniser would not parse', () => {
+        expect(() => formatToken({ type: 'A', number: 1, fingerprint: 'abcdef' })).toThrow(/grammar/);
+        expect(() => formatToken({ type: 'EMAIL', number: 0, fingerprint: 'abcdef' })).toThrow(/grammar/);
+        expect(() => formatToken({ type: 'EMAIL', number: 1_000_000, fingerprint: 'abcdef' })).toThrow(/grammar/);
+        expect(() => formatToken({ type: 'EMAIL', number: 1, fingerprint: 'xyz' })).toThrow(/grammar/);
+    });
+
@@ -127,0 +135,11 @@ describe('TokenScope', () => {
+    it('refuses one value under a second class even when the type differs', () => {
+        const a = new TokenScope();
+        a.mint('APIKEY', 'credential', KEY);
+        expect(() => a.mint('EMAIL', 'identifier', KEY)).toThrow(/class/);
+        expect(a.resolve(a.mint('APIKEY', 'credential', KEY))).toBeNull();
+        expect(reachableStrings(a).some((v) => v.includes(KEY))).toBe(false);
+        const b = new TokenScope();
+        b.mint('EMAIL', 'identifier', KEY);
+        expect(() => b.mint('APIKEY', 'credential', KEY)).toThrow(/class/);
+    });
+
diff --git a/src/scripts/_lib/secret_detector.test.ts b/src/scripts/_lib/secret_detector.test.ts
index 91c69c849..302cf27ff 100644
--- a/src/scripts/_lib/secret_detector.test.ts
+++ b/src/scripts/_lib/secret_detector.test.ts
@@ -14,0 +15 @@ import { describe, expect, it } from 'vitest';
+import type { EgressRule } from './egress_rules.js';
@@ -116,0 +118,31 @@ describe('column of a captured value', () => {
+
+describe('the scanner applies every field of a table row', () => {
+    // A credential row that uses the fields no shipped credential row uses yet.
+    const row: EgressRule = {
+        rule: 'test-pin',
+        type: 'SECRET',
+        class: 'credential',
+        pattern: /\b\d{6}\b/g,
+        context: { words: /\bpin\b/i, window: 12 },
+        exclusions: [/^000000$/],
+        linearity: 'Fixed six-digit run between word boundaries.',
+    };
+
+    it('reports a value with its context word nearby', () => {
+        expect(scanText('pin 482915', { rules: [row] }).map((f) => f.rule)).toEqual(['test-pin']);
+    });
+
+    it('drops a value without its context word', () => {
+        expect(scanText('order 482915', { rules: [row] })).toEqual([]);
+    });
+
+    it('drops an excluded value', () => {
+        expect(scanText('pin 000000', { rules: [row] })).toEqual([]);
+    });
+
+    it('refuses a value-group row without the d flag instead of guessing the column', () => {
+        const { context: _context, ...rest } = row;
+        const noD: EgressRule = { ...rest, pattern: /pin (\d{6})/g, valueGroup: 1 };
+        expect(() => scanText('pin 482915', { rules: [noD] })).toThrow(/d flag/);
+    });
+});
diff --git a/src/scripts/_lib/egress_rules_parity.test.ts b/src/scripts/_lib/egress_rules_parity.test.ts
index 85ec85ed1..7fa3b2888 100644
--- a/src/scripts/_lib/egress_rules_parity.test.ts
+++ b/src/scripts/_lib/egress_rules_parity.test.ts
@@ -117,0 +118,13 @@ function oldLooksLikeSecretValue(value: string): boolean {
+// What each documented ceiling is allowed to lose, stated exactly per case.
+const CEILING_EXPECT: Readonly<Record<string, (before: string[], after: string[]) => boolean>> = {
+    'jwt|jwt-glued-word': (before, after) => before.length === 1 && after.length === 0,
+    'db-connection-uri|uri-scheme-33': (before, after) => before.length === 1 && after.length === 0,
+    // Matched from a later boundary: same end (the userinfo and its @ are covered), later start.
+    'db-connection-uri|uri-scheme-dotted-40': (before, after) => {
+        if (before.length !== 1 || after.length !== 1) return false;
+        const [b0, b1] = (before[0] as string).split('-').map(Number);
+        const [a0, a1] = (after[0] as string).split('-').map(Number);
+        return a1 === b1 && (a0 as number) > (b0 as number);
+    },
+};
+
@@ -150,0 +164 @@ describe('old-versus-new parity of the credential rows', () => {
+                const expected = CEILING_EXPECT[`${rule.rule}|${id}`];
@@ -152 +166,2 @@ describe('old-versus-new parity of the credential rows', () => {
-                    expect(after.length <= before.length).toBe(true);
+                    expect(expected).toBeDefined();
+                    expect(expected?.(before, after)).toBe(true);
```
