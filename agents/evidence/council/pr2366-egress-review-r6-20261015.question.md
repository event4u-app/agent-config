<!-- evidence-type: analysis -->

<!-- The round-6 prompt given to the council on 2026-10-15 for PR #2366, committed
     verbatim so the verdict recorded beside it can be checked against what was
     actually asked. Not edited after the run. -->

# Review PR #2366, round 6 — egress rule table, placeholder tokens, secret detector

Review this change at head `01f295811e217423f7cac873c9b319da18497c8c`. Round 5 raised: (1) the private-key rule replaced only the header, leaving the key body in plaintext; (2) detection parity was treated as replacement safety, with no test asserting planted credential bytes are absent from replacement output; (3) a JWT preceded by one base64url character was not detected; (4) a connection URI with a 33-character scheme was not detected; (5) the 24-bit fingerprint had no enforced guess budget. The response separates the detection span (what the commit-time scanner reports) from the replacement span (every byte that must not leave), declares a replacement policy per rule, makes the replacer refuse the whole text when a rule cannot prove its replacement span, and adds an end-to-end replacement suite. For each round-5 finding, state whether the code and contract below resolve it, and report any defect, including new ones.

Scope of the diff below: the full PR diff against origin/main of src/scripts/_lib/egress_rules.ts, egress_token.ts, egress_replacement_e2e.test.ts and docs/contracts/egress-placeholders-v1.md. Omitted for size: src/scripts/_lib/secret_detector.ts (unchanged since round 5; it reads its rows from the table and calls evaluateMatch from the table), all other test files (egress_rules.test.ts, egress_token.test.ts, egress_rules_parity.test.ts, secret_detector.test.ts), SECURITY.md, docs/threat-model.md, .secret-allow, the roadmap, the bench harness, its report and the pre-registration.

Report defects: secret bytes that can leave in plaintext through the replacement path, detection regressions against the pre-move rule pack, regex denial-of-service, token forgery or cross-scope resolution, secrets retained or logged, contract claims the code does not honour, tests that would pass without the code they cover. For each: file:line, the failure scenario, severity. State your stance.

```diff
diff --git a/src/scripts/_lib/egress_rules.ts b/src/scripts/_lib/egress_rules.ts
new file mode 100644
index 000000000..30e049c0e
--- /dev/null
+++ b/src/scripts/_lib/egress_rules.ts
@@ -0,0 +1,374 @@
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
+    /**
+     * Which bytes a replacement must remove. `'detection'`: the detection span is
+     * the whole secret. A `through` function returns the end of the secret for a
+     * detection span, or null when that end cannot be proven; the replacer then
+     * refuses the whole text rather than replace part of it.
+     */
+    readonly replacement: 'detection' | { readonly through: (text: string, span: SpanBounds) => number | null };
+    /** Capture group holding the value; the whole match when absent. A rule that sets it MUST carry the d flag. */
+    readonly valueGroup?: number;
+    readonly validator?: (value: string) => boolean;
+    /** The rule fires only when `words` matches within `window` chars of the value. */
+    readonly context?: { readonly words: RegExp; readonly window: number };
+    readonly exclusions?: readonly RegExp[];
+}
+
+export interface SpanBounds {
+    readonly start: number;
+    readonly end: number;
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
+// The nearest key marker after the header decides: the matching END ends the
+// block; another BEGIN first, or no marker at all, means the extent is unproven.
+// One sticky scan from the header to the nearest marker keeps this linear even
+// over many headers.
+const KEY_MARKER = /-----(BEGIN|END) [A-Z ]*PRIVATE KEY-----/g;
+
+export function pemBlockEnd(text: string, span: SpanBounds): number | null {
+    KEY_MARKER.lastIndex = span.end;
+    const m = KEY_MARKER.exec(text);
+    if (m === null || m[1] !== 'END') return null;
+    return m.index + m[0].length;
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
+        replacement: 'detection',
+        kind: 'anthropic-api-key',
+        pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g,
+        linearity: PREFIX_RUN,
+    },
+    {
+        rule: 'anthropic-project-key',
+        type: 'APIKEY',
+        class: 'credential',
+        replacement: 'detection',
+        kind: 'anthropic-api-key',
+        pattern: /sk-proj-[A-Za-z0-9_-]{20,}/g,
+        linearity: PREFIX_RUN,
+    },
+    {
+        rule: 'aws-access-key',
+        type: 'APIKEY',
+        class: 'credential',
+        replacement: 'detection',
+        pattern: /AKIA[0-9A-Z]{16}/g,
+        linearity: FIXED_RUN,
+    },
+    {
+        rule: 'google-api-key',
+        type: 'APIKEY',
+        class: 'credential',
+        replacement: 'detection',
+        pattern: /AIza[0-9A-Za-z_-]{35}/g,
+        linearity: FIXED_RUN,
+    },
+    {
+        rule: 'github-pat',
+        type: 'TOKEN',
+        class: 'credential',
+        replacement: 'detection',
+        pattern: /ghp_[0-9A-Za-z]{36}/g,
+        linearity: FIXED_RUN,
+    },
+    {
+        rule: 'github-fine-grained-pat',
+        type: 'TOKEN',
+        class: 'credential',
+        replacement: 'detection',
+        kind: 'github-pat',
+        pattern: /github_pat_[0-9A-Za-z_]{22,}/g,
+        linearity: PREFIX_RUN,
+    },
+    {
+        rule: 'jwt',
+        type: 'TOKEN',
+        class: 'credential',
+        replacement: 'detection',
+        pattern:
+            /(?<![A-Za-z0-9_-])(?=((?:(?!eyJ)[A-Za-z0-9_-])*))\1(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/dg,
+        valueGroup: 2,
+        linearity:
+            'One attempt per base64url run: the lookbehind admits a start only at the run boundary, and the lookahead-plus-backreference consumes the run up to its first eyJ atomically, so the engine never retries a later eyJ in the same run. That loses nothing: every eyJ in one run reaches the same run end, so the first one, which has the most characters after it, matches whenever any later one would. An attempt spans at most three dot-separated runs, so each character is read a bounded number of times.',
+    },
+    {
+        rule: 'stripe-secret-key',
+        type: 'APIKEY',
+        class: 'credential',
+        replacement: 'detection',
+        pattern: /sk_(?:live|test)_[0-9A-Za-z]{16,}/g,
+        linearity: PREFIX_RUN,
+    },
+    {
+        rule: 'slack-token',
+        type: 'TOKEN',
+        class: 'credential',
+        replacement: 'detection',
+        pattern: /xox[baprs]-[0-9A-Za-z-]{10,}/g,
+        linearity: PREFIX_RUN,
+    },
+    {
+        rule: 'pem-private-key',
+        type: 'PRIVATEKEY',
+        class: 'credential',
+
+        pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
+        replacement: { through: pemBlockEnd },
+        linearity:
+            'Starts only at the literal header; the label class excludes the dash, so label runs of different headers are disjoint, and backtracking over one run tries the fixed 16-character suffix at each position: linear with a constant factor of 16.',
+    },
+    {
+        rule: 'db-connection-uri',
+        type: 'DBURI',
+        class: 'credential',
+        replacement: 'detection',
+        pattern: /(?<![a-z0-9+.-])(?=((?:(?!\b[a-z])[a-z0-9+.-])*))\1(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s:/@]+@)/dg,
+        valueGroup: 2,
+        linearity:
+            'One attempt per scheme-character run: the lookbehind admits a start only at the run boundary, and the lookahead-plus-backreference consumes the run up to its first word-boundary letter atomically. Every such start in one run reaches the same :// at the same run end, so the first one matches whenever any later one would, and nothing the unbounded scheme matched is lost. The userinfo classes exclude : and /, so each userinfo run is read by one attempt per side.',
+    },
+    {
+        rule: 'generic-assignment',
+        type: 'SECRET',
+        class: 'credential',
+        replacement: 'detection',
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
+function testWholeValue(re: RegExp, value: string): boolean {
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
+    if (r.exclusions?.some((x) => testWholeValue(x, value))) return null;
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
+export const DETECTION_CEILINGS: readonly DetectionCeiling[] = [];
diff --git a/src/scripts/_lib/egress_token.ts b/src/scripts/_lib/egress_token.ts
new file mode 100644
index 000000000..319e67919
--- /dev/null
+++ b/src/scripts/_lib/egress_token.ts
@@ -0,0 +1,199 @@
+// The placeholder grammar of docs/contracts/egress-placeholders-v1.md and its
+// one recogniser. The spelling is the one the pre-registered model-fidelity bar
+// selected (internal/bench/egress-placeholders-PREREG.md, endpoint d); no other
+// spelling may exist under src/, which egress_token.test.ts enforces.
+
+import { createHmac, randomBytes } from 'node:crypto';
+
+import { detect, EGRESS_RULES, type EgressClass, type EgressSpan, replaceSpans } from './egress_rules.js';
+
+export const TOKEN_FP_LENGTH = 6;
+
+/** `__TYPE_n_fingerprint__` — type upper-case, number from 1, fingerprint lower hex. */
+export const TOKEN_PATTERN = /__([A-Z][A-Z0-9]{1,15})_([1-9][0-9]{0,5})_([0-9a-f]{6})__/g;
+
+const TOKEN_TYPE = /^[A-Z][A-Z0-9]{1,15}$/;
+const MAX_TOKEN_NUMBER = 999_999;
+/**
+ * Unknown tokens a scope answers before it stops resolving anything. With a
+ * 24-bit fingerprint this bounds the chance that guessing ever resolves a value
+ * to at most 64 × 2^-24 (about 4 in a million) per scope.
+ */
+export const MAX_FAILED_RESOLUTIONS = 64;
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
+    private failedResolutions = 0;
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
+        if (this.failedResolutions >= MAX_FAILED_RESOLUTIONS) return null;
+        const entry = this.byToken.get(token);
+        if (entry === undefined) {
+            this.failedResolutions += 1;
+            return null;
+        }
+        return entry.value;
+    }
+
+    /** What the scope holds, without any value. */
+    snapshot(): Array<Omit<Entry, 'value'>> {
+        return [...this.byDigest.values()].map(({ value: _value, ...rest }) => rest);
+    }
+}
+
+/** Thrown when a rule cannot prove which bytes its secret spans; carries the rule id, never a byte of the text. */
+export class EgressRefusedError extends Error {
+    constructor(readonly rule: string) {
+        super(`egress refused: rule ${rule} could not prove the extent of a detected secret`);
+        this.name = 'EgressRefusedError';
+    }
+}
+
+const RULE_BY_ID = new Map(EGRESS_RULES.map((r) => [r.rule, r]));
+const CLASS_RANK: Readonly<Record<EgressClass, number>> = { credential: 1, identifier: 0 };
+
+/** The bytes each detection obliges a replacement to remove; overlapping extents merge. */
+function replacementSpans(text: string, detected: readonly EgressSpan[]): EgressSpan[] {
+    const extents = detected.map((s) => {
+        const policy = RULE_BY_ID.get(s.rule)?.replacement;
+        if (policy === undefined) throw new EgressRefusedError(s.rule);
+        if (policy === 'detection') return s;
+        const end = policy.through(text, s);
+        if (end === null || end < s.end) throw new EgressRefusedError(s.rule);
+        return { ...s, end };
+    });
+    extents.sort((a, b) => a.start - b.start);
+    const merged: EgressSpan[] = [];
+    for (const s of extents) {
+        const last = merged[merged.length - 1];
+        if (last !== undefined && s.start < last.end) {
+            const keep = CLASS_RANK[s.class] > CLASS_RANK[last.class] ? s : last;
+            merged[merged.length - 1] = { ...keep, start: last.start, end: Math.max(last.end, s.end) };
+        } else {
+            merged.push(s);
+        }
+    }
+    return merged;
+}
+
+/**
+ * Replaces every detected secret with its token, removing each rule's full
+ * replacement extent, not just the bytes that triggered detection. A rule that
+ * cannot prove its extent makes the whole call throw EgressRefusedError: the
+ * text is refused, never partly replaced. A detection is left alone only when it
+ * lies inside a token this scope minted, so a second pass returns the same bytes
+ * while a token-shaped substring planted inside a credential, or a token from
+ * another scope, shields nothing.
+ */
+export function replaceValues(text: string, scope: TokenScope): string {
+    const owned = parseTokens(text).filter((t) => scope.owns(text.slice(t.start, t.end)));
+    const detected = detect(text).filter((s) => !owned.some((t) => t.start <= s.start && s.end <= t.end));
+    const spans = replacementSpans(text, detected);
+    // Mint in text order first: replaceSpans substitutes right to left, and minting
+    // inside its callback would number the last value 1.
+    const tokens = spans.map((s) => scope.mint(s.type, s.class, text.slice(s.start, s.end)));
+    return replaceSpans(text, spans, (_s, i) => tokens[i] as string);
+}
diff --git a/src/scripts/_lib/egress_replacement_e2e.test.ts b/src/scripts/_lib/egress_replacement_e2e.test.ts
new file mode 100644
index 000000000..a8d9e176f
--- /dev/null
+++ b/src/scripts/_lib/egress_replacement_e2e.test.ts
@@ -0,0 +1,107 @@
+/**
+ * End to end: every credential row of the rule table, planted in text, goes
+ * through the full replacement path, and no planted sensitive byte sequence may
+ * survive in the output. Detection parity says what the scanner reports; this
+ * suite says what actually leaves.
+ *
+ * Fixtures are assembled at runtime, so no credential-shaped literal sits in
+ * this file, and every assertion is a boolean so a failure never prints one.
+ */
+import { describe, expect, it } from 'vitest';
+
+import { EGRESS_RULES } from './egress_rules.js';
+import { EgressRefusedError, parseTokens, replaceValues, TokenScope } from './egress_token.js';
+
+const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
+function run(n: number, salt = 0): string {
+    const src = ALNUM.slice(salt % ALNUM.length) + ALNUM.slice(0, salt % ALNUM.length);
+    let s = '';
+    while (s.length < n) s += src;
+    return s.slice(0, n);
+}
+const B64 = (n: number, salt: number): string => run(n, salt).replace(/[_-]/g, 'x');
+
+const PEM_LABEL = ['RSA', 'PRIVATE', 'KEY'].join(' ');
+function pem(lines: string[]): string {
+    return [`-----BEGIN ${PEM_LABEL}-----`, ...lines, `-----END ${PEM_LABEL}-----`].join('\n');
+}
+const uri = (scheme: string, user: string, password: string): string =>
+    `${scheme}${'://'}${user}:${password}@db.internal:5432/app`;
+const jwt = (a: number, b: number, c: number): string => `eyJ${run(a, 1)}.${run(b, 2)}.${run(c, 3)}`;
+
+interface Fixture {
+    readonly rule: string;
+    readonly text: string;
+    /** Byte sequences of which no copy may remain after replacement. */
+    readonly secrets: readonly string[];
+}
+
+const PEM_BODY = [B64(64, 4), B64(64, 5), B64(40, 6)];
+const PASSWORD = run(20, 7);
+const LONG_SCHEME = 'a'.repeat(33);
+
+const FIXTURES: readonly Fixture[] = [
+    { rule: 'anthropic-api-key', text: `key sk-ant-${run(90, 8)} end`, secrets: [`sk-ant-${run(90, 8)}`] },
+    { rule: 'anthropic-api-key', text: `key sk-ant-${run(5000, 9)}`, secrets: [run(5000, 9).slice(-40)] },
+    { rule: 'anthropic-project-key', text: `key sk-proj-${run(60, 10)}`, secrets: [run(60, 10)] },
+    { rule: 'aws-access-key', text: 'id AKIA' + 'ABCDEFGHIJ234567 x', secrets: ['ABCDEFGHIJ234567'] },
+    { rule: 'google-api-key', text: `g AIza${run(35, 11)} x`, secrets: [run(35, 11)] },
+    {
+        rule: 'github-pat',
+        text: `t ghp_${run(36, 12).replace(/[_-]/g, 'q')} x`,
+        secrets: [run(36, 12).replace(/[_-]/g, 'q')],
+    },
+    { rule: 'github-fine-grained-pat', text: `t github_pat_${run(80, 13)} x`, secrets: [run(80, 13)] },
+    { rule: 'jwt', text: `Bearer ${jwt(30, 40, 30)}`, secrets: [jwt(30, 40, 30).slice(3)] },
+    { rule: 'jwt', text: `glued x${jwt(30, 40, 30)} y`, secrets: [jwt(30, 40, 30).slice(3)] },
+    { rule: 'jwt', text: `long ${jwt(9000, 20, 20)}`, secrets: [run(9000, 1).slice(-30)] },
+    {
+        rule: 'stripe-secret-key',
+        text: `s sk_live_${run(40, 14).replace(/[_-]/g, 'q')}`,
+        secrets: [run(40, 14).replace(/[_-]/g, 'q')],
+    },
+    { rule: 'slack-token', text: `s xoxb-${run(40, 15)}`, secrets: [run(40, 15)] },
+    { rule: 'pem-private-key', text: `before\n${pem(PEM_BODY)}\nafter`, secrets: PEM_BODY },
+    { rule: 'pem-private-key', text: `in a string: "${pem(PEM_BODY).split('\n').join('\\n')}"`, secrets: PEM_BODY },
+    { rule: 'db-connection-uri', text: `url ${uri('postgres', 'svc', PASSWORD)}`, secrets: [PASSWORD] },
+    { rule: 'db-connection-uri', text: `url ${uri(LONG_SCHEME, 'svc', PASSWORD)}`, secrets: [PASSWORD] },
+    { rule: 'db-connection-uri', text: `url ${uri('a.'.repeat(20) + 'x', 'svc', PASSWORD)}`, secrets: [PASSWORD] },
+    { rule: 'generic-assignment', text: `password = "${run(30, 16)}"`, secrets: [run(30, 16)] },
+    { rule: 'generic-assignment', text: `secret: ${run(3000, 17)}`, secrets: [run(3000, 17).slice(-40)] },
+    { rule: 'generic-assignment', text: `AuthToken=AuthToken=AuthToken=`, secrets: ['AuthToken=AuthToken='] },
+];
+
+describe('end-to-end replacement leaves no planted byte', () => {
+    it('every credential row has at least one fixture', () => {
+        const covered = new Set(FIXTURES.map((f) => f.rule));
+        const missing = EGRESS_RULES.filter((r) => r.class === 'credential' && !covered.has(r.rule)).map((r) => r.rule);
+        expect(missing).toEqual([]);
+    });
+
+    FIXTURES.forEach((f, i) => {
+        it(`${f.rule} #${i}`, () => {
+            const out = replaceValues(f.text, new TokenScope());
+            expect(f.secrets.every((s) => !out.includes(s))).toBe(true);
+            expect(parseTokens(out).length).toBeGreaterThan(0);
+        });
+    });
+});
+
+describe('a rule without a provable replacement span fails closed', () => {
+    it('a private-key header with no matching end marker refuses the whole text', () => {
+        const text = `-----BEGIN ${PEM_LABEL}-----\n${PEM_BODY.join('\n')}\n(truncated)`;
+        expect(() => replaceValues(text, new TokenScope())).toThrow(EgressRefusedError);
+    });
+
+    it('the refusal names the rule and carries no byte of the text', () => {
+        const text = `-----BEGIN ${PEM_LABEL}-----\n${PEM_BODY.join('\n')}`;
+        try {
+            replaceValues(text, new TokenScope());
+            expect.unreachable();
+        } catch (e) {
+            const msg = (e as Error).message;
+            expect(msg.includes('pem-private-key')).toBe(true);
+            expect(PEM_BODY.some((b) => msg.includes(b))).toBe(false);
+        }
+    });
+});
diff --git a/docs/contracts/egress-placeholders-v1.md b/docs/contracts/egress-placeholders-v1.md
new file mode 100644
index 000000000..446141413
--- /dev/null
+++ b/docs/contracts/egress-placeholders-v1.md
@@ -0,0 +1,201 @@
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
+## Detection span and replacement span
+
+A rule's **detection span** is what the commit-time scanner reports: enough
+bytes to say a secret is there. Its **replacement span** is every byte that
+must not leave. They are declared separately, per rule, in the table's
+`replacement` field:
+
+- `'detection'` — the detection span is the whole secret (keys, tokens, JWTs,
+  the connection URI's scheme-to-`@` authority, an assigned value);
+- a `through` function — the secret extends past the detection span and the
+  function proves where it ends. `pem-private-key` detects on the header and
+  replaces through the matching `-----END … PRIVATE KEY-----`.
+
+**A rule that cannot prove its replacement span fails closed.** When `through`
+returns no end — a private-key header with no matching end marker, or another
+header first — the replacer refuses the whole text (`EgressRefusedError`,
+naming the rule and carrying no byte of the text). It never replaces part of a
+secret and lets the rest leave. Overlapping replacement spans merge, and the
+merged span takes the more sensitive class.
+
+An end-to-end suite plants a credential for every rule — a multi-line key, a
+JWT glued to a word, a connection URI with a long scheme, values thousands of
+characters long — runs the full replacement path, and asserts that no planted
+sensitive byte sequence survives.
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
+| number | per type, in the order values first appear in the text within the scope, from 1 to 999,999 (a scope refuses a further value of that type); what a human reads |
+| fingerprint | a truncated keyed digest over type and canonical value, under a key drawn at random per scope and **never sent and never persisted** |
+| variant | optional; distinguishes two spellings of one entity (a spaced and a compact IBAN) so a restore reproduces each spelling byte for byte |
+
+- **Identity.** A token stands for one **(type, canonical value)** pair. Two
+  occurrences of one pair in one scope get one number and one fingerprint; two
+  different values of one type get two numbers; one value matched under two
+  types gets two tokens, one per type. One
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
+  2^-24 (about 6 in 100 million). The guess budget is enforced, not assumed:
+  after 64 failed resolutions a scope resolves nothing at all, genuine tokens
+  included, so the chance that guessing ever resolves a value is at most
+  64·2^-24 (about 4 in a million) per scope. Resolving a credential token is
+  not a failed guess and spends no budget. What a successful guess returns is an
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
+  letter, then 1–15 upper-case letters or digits), number 1–999,999, fingerprint six lower-case hex digits. Chosen
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
+None. The credential rows match everything the commit-time scanner matched
+before they moved into the rule table. `jwt` and `db-connection-uri`, whose
+unbounded pre-move forms were quadratic on a hostile input, now make one
+attempt per character run and consume the run up to its first possible start
+atomically; their `linearity` fields state why that loses nothing.
+`DETECTION_CEILINGS` stays as the place a future ceiling would be declared; a
+test fails when a listed ceiling no longer loses its case, and the parity suite
+fails on any loss that is not listed.
+
+**Line scope.** The commit-time scanner evaluates each line on its own, as it
+did before the move; `detect()` and the replacement read the whole text. The
+replacement therefore sees at least what the scanner sees, and more — an
+assignment split across lines (`password =` then the value on the next line)
+is replaced but not reported at commit time. A test pins both directions.
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
```
