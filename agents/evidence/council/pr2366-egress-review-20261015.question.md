<!-- evidence-type: analysis -->

<!-- The round-1 prompt given to the council on 2026-10-15 for PR #2366, committed
     verbatim so the verdict recorded beside it can be checked against what was
     actually asked. Not edited after the run. -->

# Review PR #2366 — egress rule table, placeholder tokens, secret detector refactor

Review this change. Scope: the diff below against origin/main — src/scripts/_lib/ (new egress_rules.ts and egress_token.ts with tests; secret_detector.ts now reads its credential rules from the table) and the new contract docs/contracts/egress-placeholders-v1.md. Omitted for size: SECURITY.md and docs/threat-model.md edits, the roadmap, the bench harness, its report and the pre-registration.

This is a secrets and PII detection and replacement surface. Report defects: detection regressions in secret_detector (patterns lost, narrowed or broadened), regex denial-of-service, token forgery or cross-scope resolution, secret values retained or logged, contract claims the code does not honour, tests that would pass without the code they cover. For each: file:line, the failure scenario, severity. State your stance.

```diff
diff --git a/docs/contracts/egress-placeholders-v1.md b/docs/contracts/egress-placeholders-v1.md
new file mode 100644
index 000000000..5e3ce54e1
--- /dev/null
+++ b/docs/contracts/egress-placeholders-v1.md
@@ -0,0 +1,125 @@
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
+  number and one fingerprint. Two different values get two numbers.
+- **Scope.** For a request this package writes, the scope is the one invocation
+  that builds and sends it. For a host carrier, the scope is set by that
+  roadmap's session table, which must keep the key out of every request.
+- **Lifecycle.** A token is minted on first replacement and dies with its scope's
+  key. A token from another scope, a token the model invented and a token whose
+  fingerprint does not match its number are **unresolved** — never resolved by
+  number alone, never guessed.
+- **Owner of resolution state.** The process that minted the token. No other
+  process resolves it unless the at-rest decision gives it the state.
+- **Stability of bytes.** Replacing already-replaced text yields the same bytes
+  (a token never matches a detector rule). One recogniser parses the grammar;
+  the grammar's spelling is one constant, and no second spelling exists under
+  `src/`.
+- **Spelling: `__TYPE_n_fp__`** — e.g. `__IBAN_1_495cff__`: type upper-case
+  (2–16 characters), number from 1, fingerprint six lower-case hex digits. Chosen
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
diff --git a/src/scripts/_lib/egress_rules.test.ts b/src/scripts/_lib/egress_rules.test.ts
new file mode 100644
index 000000000..81683ec41
--- /dev/null
+++ b/src/scripts/_lib/egress_rules.test.ts
@@ -0,0 +1,211 @@
+/**
+ * egress_rules — the one rule table for egress placeholders.
+ *
+ * Planted values are assembled at runtime so no credential-shaped literal sits
+ * in this file, and assertions compare spans by boolean equality so a failure
+ * never prints a planted value.
+ */
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import { describe, expect, it } from 'vitest';
+
+import {
+    detect,
+    EGRESS_RULES,
+    type EgressRule,
+    type EgressSpan,
+    findUnboundedQuantifier,
+    replaceSpans,
+    resolveOverlaps,
+} from './egress_rules.js';
+
+const HERE = path.dirname(fileURLToPath(import.meta.url));
+
+const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
+function mixed(n: number): string {
+    let s = '';
+    while (s.length < n) s += ALNUM;
+    return s.slice(0, n);
+}
+
+describe('rule table shape', () => {
+    it('every rule names exactly one class and carries the global flag', () => {
+        expect(EGRESS_RULES.length).toBeGreaterThan(0);
+        for (const r of EGRESS_RULES) {
+            expect(['credential', 'identifier']).toContain(r.class);
+            expect(r.pattern.flags).toContain('g');
+            expect(r.type).toMatch(/^[A-Z][A-Z0-9]*$/);
+        }
+    });
+
+    it('rule ids are unique', () => {
+        const ids = EGRESS_RULES.map((r) => r.rule);
+        expect(new Set(ids).size).toBe(ids.length);
+    });
+
+    it('no rule carries an unbounded quantifier', () => {
+        const offenders = EGRESS_RULES.filter((r) => findUnboundedQuantifier(r.pattern) !== null).map((r) => r.rule);
+        expect(offenders).toEqual([]);
+    });
+
+    it('the quantifier check refuses unbounded forms and accepts bounded ones', () => {
+        expect(findUnboundedQuantifier(/a+/g)).not.toBeNull();
+        expect(findUnboundedQuantifier(/a*/g)).not.toBeNull();
+        expect(findUnboundedQuantifier(/a{3,}/g)).not.toBeNull();
+        expect(findUnboundedQuantifier(/(?:ab)+/g)).not.toBeNull();
+        expect(findUnboundedQuantifier(/a{1,8}[+*]\+\*b{2}/g)).toBeNull();
+    });
+
+    it('the module is pure: it imports nothing', () => {
+        const src = fs.readFileSync(path.join(HERE, 'egress_rules.ts'), 'utf-8');
+        expect(/^\s*import\s/m.test(src)).toBe(false);
+        expect(/\brequire\(/.test(src)).toBe(false);
+    });
+});
+
+describe('no rule backtracks on a pathological input', () => {
+    const N = 60_000;
+    const inputs: Record<string, string> = {
+        letters: 'a'.repeat(N),
+        schemeish: 'ab+'.repeat(N / 3),
+        colons: 'a:'.repeat(N / 2),
+        jwtish: `eyJ${'a'.repeat(N)}`,
+        assignment: `password${' '.repeat(N)}`,
+        dashes: 'xoxb-'.repeat(N / 5),
+    };
+    for (const [name, input] of Object.entries(inputs)) {
+        it(`completes in bounded time on ${name}`, () => {
+            const t0 = performance.now();
+            detect(input);
+            expect(performance.now() - t0).toBeLessThan(1_500);
+        });
+    }
+});
+
+describe('spans', () => {
+    it('carry start and end that slice exactly the value', () => {
+        const key = `sk-ant-${mixed(40)}`;
+        const text = `before ${key} after`;
+        const spans = detect(text);
+        expect(spans.length).toBe(1);
+        const s = spans[0] as EgressSpan;
+        expect(s.class).toBe('credential');
+        expect(text.slice(s.start, s.end) === key).toBe(true);
+    });
+
+    it('a value group narrows the span to the value, not the keyword', () => {
+        const value = mixed(24);
+        const text = `api_key = "${value}"`;
+        const spans = detect(text);
+        expect(spans.length).toBe(1);
+        const s = spans[0] as EgressSpan;
+        expect(text.slice(s.start, s.end) === value).toBe(true);
+    });
+
+    it('a keyword assignment of a low-entropy word is not a finding', () => {
+        expect(detect('secret: moderate')).toEqual([]);
+        expect(detect('const token = getToken();')).toEqual([]);
+    });
+
+    it('spans are reported across lines with absolute offsets', () => {
+        const key = `ghp_${mixed(36)}`;
+        const text = `line one\nline two ${key}\n`;
+        const s = detect(text)[0] as EgressSpan;
+        expect(text.slice(s.start, s.end) === key).toBe(true);
+    });
+});
+
+describe('context words, validators and exclusions', () => {
+    const digits: EgressRule = {
+        rule: 'test-digits',
+        type: 'NUM',
+        class: 'identifier',
+        pattern: /\b\d{6,10}\b/g,
+        context: { words: /\b(?:account|konto)\b/i, window: 20 },
+        validator: (v) => v.endsWith('0'),
+        exclusions: [/^1234560$/],
+    };
+
+    it('fires only with a context word inside the window', () => {
+        expect(detect('account 9876540', [digits]).length).toBe(1);
+        expect(detect(`account${' '.repeat(40)}9876540`, [digits]).length).toBe(0);
+        expect(detect('nothing here 9876540', [digits]).length).toBe(0);
+    });
+
+    it('drops a value its validator rejects and marks an accepted one validated', () => {
+        expect(detect('account 9876541', [digits]).length).toBe(0);
+        expect((detect('account 9876540', [digits])[0] as EgressSpan).validated).toBe(true);
+    });
+
+    it('drops an excluded value', () => {
+        expect(detect('account 1234560', [digits]).length).toBe(0);
+    });
+});
+
+describe('overlap resolution', () => {
+    const span = (o: Partial<EgressSpan>): EgressSpan => ({
+        rule: 'r',
+        type: 'T',
+        class: 'identifier',
+        start: 0,
+        end: 1,
+        validated: false,
+        ...o,
+    });
+
+    it('the more sensitive class wins over a longer identifier', () => {
+        const out = resolveOverlaps([
+            span({
+                rule: 'id',
+                class: 'identifier',
+                start: 0,
+                end: 30,
+                validated: true,
+            }),
+            span({ rule: 'cred', class: 'credential', start: 5, end: 15 }),
+        ]);
+        expect(out.map((s) => s.rule)).toEqual(['cred']);
+    });
+
+    it('then the validated span wins over a longer unvalidated one', () => {
+        const out = resolveOverlaps([
+            span({ rule: 'long', start: 0, end: 30 }),
+            span({ rule: 'checked', start: 5, end: 15, validated: true }),
+        ]);
+        expect(out.map((s) => s.rule)).toEqual(['checked']);
+    });
+
+    it('then the longer span wins', () => {
+        const out = resolveOverlaps([
+            span({ rule: 'short', start: 2, end: 6 }),
+            span({ rule: 'long', start: 0, end: 10 }),
+        ]);
+        expect(out.map((s) => s.rule)).toEqual(['long']);
+    });
+
+    it('keeps non-overlapping spans, ordered by start', () => {
+        const out = resolveOverlaps([span({ rule: 'b', start: 10, end: 12 }), span({ rule: 'a', start: 0, end: 4 })]);
+        expect(out.map((s) => s.rule)).toEqual(['a', 'b']);
+    });
+});
+
+describe('replaceSpans', () => {
+    it('applies replacements right to left on the original offsets', () => {
+        const text = 'aa XX bb YYY cc';
+        const spans = [
+            { start: 3, end: 5 },
+            { start: 9, end: 12 },
+        ] as EgressSpan[];
+        expect(replaceSpans(text, spans, (_s, i) => `<${i}>`)).toBe('aa <0> bb <1> cc');
+    });
+
+    it('refuses overlapping input rather than corrupting the text', () => {
+        const spans = [
+            { start: 0, end: 5 },
+            { start: 3, end: 8 },
+        ] as EgressSpan[];
+        expect(() => replaceSpans('0123456789', spans, () => '#')).toThrow(/overlap/);
+    });
+});
diff --git a/src/scripts/_lib/egress_rules.ts b/src/scripts/_lib/egress_rules.ts
new file mode 100644
index 000000000..257aa0ed4
--- /dev/null
+++ b/src/scripts/_lib/egress_rules.ts
@@ -0,0 +1,276 @@
+// The one rule table for values that must not leave for a model provider in
+// plaintext (docs/contracts/egress-placeholders-v1.md). Every credential and
+// identifier pattern is defined here and nowhere else; consumers decide policy
+// (refuse, replace, report), this module only detects.
+//
+// Pure: no import, no I/O, no network. Every quantifier is bounded so no rule
+// can backtrack quadratically on a hostile input; the test suite enforces both.
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
+    /** MUST carry the global flag and bounded quantifiers only. */
+    readonly pattern: RegExp;
+    /** Capture group holding the value; the whole match when absent. */
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
+// Upper bounds are generous on purpose: a span cut short by its bound would
+// leave the rest of the value in plaintext after a replacement.
+export const EGRESS_RULES: readonly EgressRule[] = [
+    {
+        rule: 'anthropic-api-key',
+        type: 'APIKEY',
+        class: 'credential',
+        kind: 'anthropic-api-key',
+        pattern: /sk-ant-[A-Za-z0-9_-]{20,1024}/g,
+    },
+    {
+        rule: 'anthropic-project-key',
+        type: 'APIKEY',
+        class: 'credential',
+        kind: 'anthropic-api-key',
+        pattern: /sk-proj-[A-Za-z0-9_-]{20,1024}/g,
+    },
+    {
+        rule: 'aws-access-key',
+        type: 'APIKEY',
+        class: 'credential',
+        pattern: /AKIA[0-9A-Z]{16}/g,
+    },
+    {
+        rule: 'google-api-key',
+        type: 'APIKEY',
+        class: 'credential',
+        pattern: /AIza[0-9A-Za-z_-]{35}/g,
+    },
+    {
+        rule: 'github-pat',
+        type: 'TOKEN',
+        class: 'credential',
+        pattern: /ghp_[0-9A-Za-z]{36}/g,
+    },
+    {
+        rule: 'github-fine-grained-pat',
+        type: 'TOKEN',
+        class: 'credential',
+        kind: 'github-pat',
+        pattern: /github_pat_[0-9A-Za-z_]{22,1024}/g,
+    },
+    {
+        rule: 'jwt',
+        type: 'TOKEN',
+        class: 'credential',
+        pattern: /eyJ[A-Za-z0-9_-]{10,8192}\.[A-Za-z0-9_-]{10,8192}\.[A-Za-z0-9_-]{10,8192}/g,
+    },
+    {
+        rule: 'stripe-secret-key',
+        type: 'APIKEY',
+        class: 'credential',
+        pattern: /sk_(?:live|test)_[0-9A-Za-z]{16,1024}/g,
+    },
+    {
+        rule: 'slack-token',
+        type: 'TOKEN',
+        class: 'credential',
+        pattern: /xox[baprs]-[0-9A-Za-z-]{10,1024}/g,
+    },
+    {
+        rule: 'pem-private-key',
+        type: 'PRIVATEKEY',
+        class: 'credential',
+        pattern: /-----BEGIN [A-Z ]{0,64}PRIVATE KEY-----/g,
+    },
+    {
+        rule: 'db-connection-uri',
+        type: 'DBURI',
+        class: 'credential',
+        pattern: /\b[a-z][a-z0-9+.-]{0,31}:\/\/[^\s:/@]{1,256}:[^\s:/@]{1,256}@/g,
+    },
+    {
+        rule: 'generic-assignment',
+        type: 'SECRET',
+        class: 'credential',
+        pattern:
+            /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token)\s{0,16}[:=]\s{0,16}['"]?([^'"\s]{8,1024})['"]?/gi,
+        valueGroup: 1,
+        validator: looksLikeSecretValue,
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
+            const value = r.valueGroup !== undefined ? m[r.valueGroup] : m[0];
+            if (value === undefined || value.length === 0) continue;
+            const offset = r.valueGroup !== undefined ? m[0].indexOf(value) : 0;
+            const start = m.index + offset;
+            const end = start + value.length;
+            if (r.exclusions?.some((x) => x.test(value))) continue;
+            if (r.context) {
+                const lo = Math.max(0, start - r.context.window);
+                const hi = Math.min(text.length, end + r.context.window);
+                const around = text.slice(lo, start) + ' ' + text.slice(end, hi);
+                r.context.words.lastIndex = 0;
+                if (!r.context.words.test(around)) continue;
+            }
+            let validated = false;
+            if (r.validator) {
+                if (!r.validator(value)) continue;
+                validated = true;
+            }
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
diff --git a/src/scripts/_lib/egress_token.test.ts b/src/scripts/_lib/egress_token.test.ts
new file mode 100644
index 000000000..d75be2308
--- /dev/null
+++ b/src/scripts/_lib/egress_token.test.ts
@@ -0,0 +1,164 @@
+/**
+ * egress_token — the placeholder grammar and its one recogniser.
+ *
+ * Planted values are assembled at runtime; assertions compare by boolean so a
+ * failure never prints a planted value.
+ */
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+import { fileURLToPath } from 'node:url';
+
+import { describe, expect, it } from 'vitest';
+
+import { detect } from './egress_rules.js';
+import { formatToken, parseTokens, replaceValues, TOKEN_FP_LENGTH, TOKEN_PATTERN, TokenScope } from './egress_token.js';
+
+const HERE = path.dirname(fileURLToPath(import.meta.url));
+const SRC = path.resolve(HERE, '..', '..');
+
+const ALNUM = 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7';
+function mixed(n: number): string {
+    let s = '';
+    while (s.length < n) s += ALNUM;
+    return s.slice(0, n);
+}
+const KEY = `sk-ant-${mixed(40)}`;
+
+describe('grammar', () => {
+    it('format and parse round-trip the parts', () => {
+        const tok = formatToken({ type: 'IBAN', number: 3, fingerprint: 'a1b2c3' });
+        const parsed = parseTokens(`x ${tok} y`);
+        expect(parsed).toHaveLength(1);
+        expect(parsed[0]).toMatchObject({
+            type: 'IBAN',
+            number: 3,
+            fingerprint: 'a1b2c3',
+        });
+    });
+
+    it('the recogniser carries the global flag and bounded quantifiers only', () => {
+        expect(TOKEN_PATTERN.flags).toContain('g');
+        expect(/(?<!\\)[+*]|\{\d+,\}/.test(TOKEN_PATTERN.source.replace(/\[[^\]]*\]/g, ''))).toBe(false);
+    });
+
+    it('rejects malformed shapes', () => {
+        const good = formatToken({
+            type: 'EMAIL',
+            number: 1,
+            fingerprint: 'abcdef',
+        });
+        expect(parseTokens(good.replace('abcdef', 'abcde'))).toHaveLength(0);
+        expect(parseTokens(good.replace('abcdef', 'ABCDEF'))).toHaveLength(0);
+        expect(parseTokens(good.replace('EMAIL', 'email'))).toHaveLength(0);
+    });
+
+    it('no detector rule matches a token, alone or after a keyword', () => {
+        for (const type of ['APIKEY', 'SECRET', 'TOKEN', 'EMAIL', 'IBAN', 'DBURI']) {
+            const tok = formatToken({ type, number: 12, fingerprint: 'f00d42' });
+            expect(detect(tok)).toEqual([]);
+            const line = `api_key = "${tok}"`;
+            expect(replaceValues(line, new TokenScope())).toBe(line);
+        }
+    });
+});
+
+describe('TokenScope', () => {
+    it('one canonical value gets one token; two values get two numbers', () => {
+        const scope = new TokenScope();
+        const a = scope.mint('EMAIL', 'identifier', 'one@corp.test');
+        const b = scope.mint('EMAIL', 'identifier', 'two@corp.test');
+        expect(scope.mint('EMAIL', 'identifier', 'one@corp.test')).toBe(a);
+        expect(a).not.toBe(b);
+        expect(parseTokens(a)[0]?.number).toBe(1);
+        expect(parseTokens(b)[0]?.number).toBe(2);
+        expect(parseTokens(a)[0]?.fingerprint).toHaveLength(TOKEN_FP_LENGTH);
+    });
+
+    it('resolves its own identifier tokens', () => {
+        const scope = new TokenScope();
+        const tok = scope.mint('EMAIL', 'identifier', 'one@corp.test');
+        expect(scope.resolve(tok) === 'one@corp.test').toBe(true);
+    });
+
+    it('never resolves a credential token and never holds the credential value', () => {
+        const scope = new TokenScope();
+        const tok = scope.mint('APIKEY', 'credential', KEY);
+        expect(scope.resolve(tok)).toBeNull();
+        expect(JSON.stringify(scope.snapshot()).includes(KEY)).toBe(false);
+    });
+
+    it('a forged token with the right number and a wrong fingerprint does not resolve', () => {
+        const scope = new TokenScope();
+        const tok = scope.mint('EMAIL', 'identifier', 'one@corp.test');
+        const p = parseTokens(tok)[0];
+        const forged = formatToken({
+            type: 'EMAIL',
+            number: p?.number ?? 0,
+            fingerprint: '000000' === p?.fingerprint ? '000001' : '000000',
+        });
+        expect(scope.resolve(forged)).toBeNull();
+    });
+
+    it('a token minted under another scope key does not resolve', () => {
+        const other = new TokenScope();
+        const scope = new TokenScope();
+        scope.mint('EMAIL', 'identifier', 'one@corp.test');
+        const foreign = other.mint('EMAIL', 'identifier', 'one@corp.test');
+        expect(scope.resolve(foreign)).toBeNull();
+    });
+
+    it('fingerprints differ across scopes for the same value', () => {
+        const a = new TokenScope().mint('EMAIL', 'identifier', 'one@corp.test');
+        const b = new TokenScope().mint('EMAIL', 'identifier', 'one@corp.test');
+        expect(a).not.toBe(b);
+    });
+
+    it('refuses a key shorter than 32 bytes', () => {
+        expect(() => new TokenScope(new Uint8Array(8))).toThrow(/key/);
+    });
+});
+
+describe('replaceValues', () => {
+    it('replaces every detected value with a token of its type', () => {
+        const scope = new TokenScope();
+        const text = `deploy with ${KEY} today`;
+        const out = replaceValues(text, scope);
+        expect(out.includes(KEY)).toBe(false);
+        expect(parseTokens(out).map((t) => t.type)).toEqual(['APIKEY']);
+    });
+
+    it('replacing twice yields the same bytes as replacing once', () => {
+        const scope = new TokenScope();
+        const text = `a ${KEY} b api_key = "${mixed(24)}" c`;
+        const once = replaceValues(text, scope);
+        expect(replaceValues(once, scope)).toBe(once);
+    });
+
+    it('two occurrences of one value share one token', () => {
+        const scope = new TokenScope();
+        const out = replaceValues(`${KEY} and ${KEY}`, scope);
+        const toks = parseTokens(out);
+        expect(toks).toHaveLength(2);
+        expect(toks[0]?.fingerprint).toBe(toks[1]?.fingerprint);
+    });
+});
+
+describe('one spelling under src/', () => {
+    it('no file outside egress_token.ts writes a token-shaped literal', () => {
+        const SHAPES = [/⟦[A-Z]{2,16}_\d{1,6}\.[0-9a-f]{6}⟧/, /__(?:AC_)?[A-Z]{2,16}_\d{1,6}_[0-9a-f]{6}__/];
+        const offenders: string[] = [];
+        const walk = (dir: string): void => {
+            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
+                const p = path.join(dir, e.name);
+                if (e.isDirectory()) {
+                    if (e.name !== 'node_modules' && e.name !== 'fixtures') walk(p);
+                } else if (/\.(?:ts|js|mjs)$/.test(e.name) && !/egress_token(?:\.test)?\.ts$/.test(e.name)) {
+                    const body = fs.readFileSync(p, 'utf-8');
+                    if (SHAPES.some((s) => s.test(body))) offenders.push(path.relative(SRC, p));
+                }
+            }
+        };
+        walk(SRC);
+        expect(offenders).toEqual([]);
+    });
+});
diff --git a/src/scripts/_lib/egress_token.ts b/src/scripts/_lib/egress_token.ts
new file mode 100644
index 000000000..347c17a21
--- /dev/null
+++ b/src/scripts/_lib/egress_token.ts
@@ -0,0 +1,111 @@
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
+export function formatToken(p: TokenParts): string {
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
+    readonly #key: Uint8Array;
+    readonly #byDigest = new Map<string, Entry>();
+    readonly #byToken = new Map<string, Entry>();
+    readonly #counters = new Map<string, number>();
+
+    constructor(key: Uint8Array = randomBytes(32)) {
+        if (key.length < 32) {
+            throw new Error('TokenScope: key must be at least 32 bytes');
+        }
+        this.#key = key;
+    }
+
+    mint(type: string, cls: EgressClass, canonical: string): string {
+        const digest = createHmac('sha256', this.#key).update(`${type}\u0000${canonical}`).digest('hex');
+        const known = this.#byDigest.get(digest);
+        if (known !== undefined) {
+            return formatToken(known);
+        }
+        const number = (this.#counters.get(type) ?? 0) + 1;
+        this.#counters.set(type, number);
+        const entry: Entry = {
+            type,
+            class: cls,
+            number,
+            fingerprint: digest.slice(0, TOKEN_FP_LENGTH),
+            value: cls === 'identifier' ? canonical : null,
+        };
+        this.#byDigest.set(digest, entry);
+        this.#byToken.set(formatToken(entry), entry);
+        return formatToken(entry);
+    }
+
+    /** The identifier value a token stands for, or null: unknown, forged, foreign or credential. */
+    resolve(token: string): string | null {
+        return this.#byToken.get(token)?.value ?? null;
+    }
+
+    /** What the scope holds, without any value. */
+    snapshot(): Array<Omit<Entry, 'value'>> {
+        return [...this.#byDigest.values()].map(({ value: _value, ...rest }) => rest);
+    }
+}
+
+/**
+ * Replaces every detected value with its token. Spans that overlap an existing
+ * token are left alone, so a second pass returns the same bytes.
+ */
+export function replaceValues(text: string, scope: TokenScope): string {
+    const tokens = parseTokens(text);
+    const spans = detect(text).filter((s) => !tokens.some((t) => s.start < t.end && t.start < s.end));
+    return replaceSpans(text, spans, (s) => scope.mint(s.type, s.class, text.slice(s.start, s.end)));
+}
diff --git a/src/scripts/_lib/secret_detector.ts b/src/scripts/_lib/secret_detector.ts
index 51a94403b..616cfb01e 100644
--- a/src/scripts/_lib/secret_detector.ts
+++ b/src/scripts/_lib/secret_detector.ts
@@ -21,6 +21,8 @@
 // returned so callers can choose), and the masked preview never reproduces the
 // full secret.
 
+import { EGRESS_RULES, shannonEntropy } from './egress_rules.js';
+
 /** One detected secret. Never carries the raw value — see `masked`. */
 export interface SecretFinding {
     rule: string;
@@ -48,48 +50,11 @@ export const BASE64_ENTROPY_THRESHOLD = 4.5;
 export const HEX_ENTROPY_THRESHOLD = 3.0;
 
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
 
 // ---------------------------------------------------------------------
 // Suppression + placeholder detection.
@@ -133,36 +98,6 @@ function isAllSameChar(value: string): boolean {
     return value.length > 0 && /^(.)\1*$/.test(value);
 }
 
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
     if (pathHint !== undefined) {
         if (
@@ -190,20 +125,6 @@ function maskSecret(value: string): string {
     return `${front}…${back}`;
 }
 
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
     return spans.some(([s, e]) => start < e && s < end);
 }
@@ -230,21 +151,21 @@ export function scanText(text: string, opts: ScanOptions = {}): SecretFinding[]
 
         // Layer 1 — regex rule pack (HIGH, demoted to LOW for placeholders).
         for (const rule of RULES) {
-            rule.regex.lastIndex = 0;
+            rule.pattern.lastIndex = 0;
             let m: RegExpExecArray | null;
-            while ((m = rule.regex.exec(line)) !== null) {
+            while ((m = rule.pattern.exec(line)) !== null) {
                 const value = rule.valueGroup !== undefined ? m[rule.valueGroup] : m[0];
                 if (value === undefined) {
-                    if (m.index === rule.regex.lastIndex) {
-                        rule.regex.lastIndex += 1;
+                    if (m.index === rule.pattern.lastIndex) {
+                        rule.pattern.lastIndex += 1;
                     }
                     continue;
                 }
-                // The keyword-anchored generic rule needs a value-likeness gate:
-                // a low-entropy word after `secret:`/`token:` is not a credential.
-                if (rule.rule === 'generic-assignment' && !looksLikeSecretValue(value)) {
-                    if (m.index === rule.regex.lastIndex) {
-                        rule.regex.lastIndex += 1;
+                // A rule's validator gates the value: a low-entropy word after
+                // `secret:`/`token:` is not a credential.
+                if (rule.validator !== undefined && !rule.validator(value)) {
+                    if (m.index === rule.pattern.lastIndex) {
+                        rule.pattern.lastIndex += 1;
                     }
                     continue;
                 }
@@ -254,15 +175,15 @@ export function scanText(text: string, opts: ScanOptions = {}): SecretFinding[]
                     : 'high';
                 findings.push({
                     rule: rule.rule,
-                    kind: rule.kind,
+                    kind: rule.kind ?? rule.rule,
                     line: lineNo,
                     column: valueStart + 1,
                     masked: maskSecret(value),
                     confidence,
                 });
                 covered.push([valueStart, valueStart + value.length]);
-                if (m.index === rule.regex.lastIndex) {
-                    rule.regex.lastIndex += 1;
+                if (m.index === rule.pattern.lastIndex) {
+                    rule.pattern.lastIndex += 1;
                 }
             }
         }
```
