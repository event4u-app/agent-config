<!-- evidence-type: analysis -->

<!-- A prompt given to the council on 2026-10-20 for branch drain/road-to-one-detector-senders-20261020,
     committed verbatim so the verdict recorded beside it can be checked
     against what was actually asked. Not edited after the run. -->

# Review branch drain/road-to-one-detector-senders-20261020, part A2 (council channel) — the council channel and injected context pass the egress engine

Roadmap `road-to-one-detector-and-the-senders-we-own`, steps 3.3 and 3.5, plus the
table rows step 3.3 reads.

What the delta does:

- **Rule table.** `REVIEW_CREDENTIAL_ROWS`: a value after a credential keyword that is
  not a code expression or a type word, on one line, and the value of a line that
  opens with an `Authorization` header. Kept out of `EGRESS_RULES`, so the commit
  scanner and the refusing consumers keep their verdicts. The keyword vocabulary and
  `assignmentPattern` builder (part B) sit in the same file.
- **Council bundle (3.3).** `council_egress.ts` holds one token scope per council run.
  The bundler, which masked every line holding a credential, now replaces each
  detected value with a placeholder of the token grammar, span by span; an unproven
  key block is replaced through the nearest END marker, as the line masks did. The
  values replaced in the run are kept in memory only, for the final check.
  Credentials are replaced whatever `egress.placeholders.mode` says; identifiers (no
  identifier row exists yet) only in `protect` or `strict`, because whether they are
  replaced by default is an owner decision the change does not take.
- **Final check (3.3).** Immediately before a request is written — in `callMember`,
  in `curlJsonPost` before curl is spawned, and in a CLI seat before it spawns — the
  body is rescanned for every value replaced in the run and every high-confidence
  finding (a credential row other than the keyword-entropy one, or a validated
  identifier when identifiers are in scope). A hit refuses the send with a reason
  that names no value. This also applies to callers of the client classes outside a
  council round (team review, the low-impact fast path, `ask_transport`).
- **Shadow dispatch** redacts through a scope of its own and drops any query that
  needed a placeholder.
- **Injected context (3.5).** The dispatcher passes every concern reply it hands back
  to the session — the `context` block at session start and every
  `reason` + `additional_context` — through `egressInjection`: in `protect`/`strict`
  each listed value becomes its token under one scope per dispatch; text whose secret
  has no provable extent, or that no engine can read, is withheld whole; `off` and
  `observe` change nothing. The mode is read once per dispatch, only when a reply
  carries text.
- **Engine chunk.** The per-text work (`tallyText`, `injectText`, `replaceJson`)
  moved into `_lib/egress_text.ts`, reached only through the conditional engine
  chunk; `ENGINE_SCHEMA` and the loader's expected schema go to 2 and the loader
  requires the three new exports. That move is what pays for 3.5: the dispatch bundle
  reads 1,549,728 B of its unchanged 1,550,000 B ceiling, the chunk 22,969 B of 28,000 B.

Tests (not all quoted): `tests/scripts/ai_council/council_egress.test.ts` (quoted
below); `tests/scripts/hooks/egress_injection.test.ts` — `egressInjection` in each
mode, one token per value per dispatch, the mode read once, withholding on an
unproven key block, an unavailable engine and an unreadable mode, and through the
real dispatcher a stored entry injected at session start and a recalled one on a
prompt arriving as their token in `protect`, unchanged under `mode: off`. The
`tests/scripts/ai_council/`, `tests/scripts/hooks/`, `tests/hooks/` and
`src/scripts/_lib/egress_*` suites pass; `tsc --noEmit` is clean.

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

## Source diff, part A2

```diff
diff --git a/src/scripts/ai_council/api_transport.ts b/src/scripts/ai_council/api_transport.ts
index 76324cb21..483b3abea 100644
--- a/src/scripts/ai_council/api_transport.ts
+++ b/src/scripts/ai_council/api_transport.ts
@@ -1 +1,2 @@
+// egress-content: session-content asserted — every body passes councilEgress().check in curlJsonPost before curl is spawned; the council bundle is replaced through the engine first
 /**
@@ -27,2 +28,4 @@ import { spawnSync } from 'node:child_process';
 
+import { councilEgress } from './council_egress.js';
+
 /** The one network primitive. Swappable so tests never reach the network. */
@@ -30,2 +33,15 @@ export type JsonPost = (url: string, extraHeaders: string[], body: unknown) => u
 
+/** Every string a JSON body carries, in order, decoded — what a provider would read. */
+export function stringLeaves(value: unknown, out: string[] = []): string[] {
+    if (typeof value === 'string') out.push(value);
+    else if (Array.isArray(value)) for (const v of value) stringLeaves(v, out);
+    else if (value !== null && typeof value === 'object') {
+        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
+            out.push(k);
+            stringLeaves(v, out);
+        }
+    }
+    return out;
+}
+
 export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
@@ -40,2 +56,9 @@ export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta
 export function curlJsonPost(url: string, extraHeaders: string[], body: unknown): unknown {
+    // The final egress check over every string the body carries, immediately
+    // before the request is written (road-to-one-detector-and-the-senders-we-own
+    // 3.3). The headers carry the transport's own credential and are not body.
+    const refusal = councilEgress().check(stringLeaves(body).join('\n'));
+    if (refusal !== null) {
+        throw new Error(`egress refused: ${refusal.reason} (${refusal.what}); nothing was sent`);
+    }
     const args = ['-sS', '-X', 'POST', url, '-H', 'content-type: application/json'];
diff --git a/src/scripts/ai_council/bundler.ts b/src/scripts/ai_council/bundler.ts
index 5ef257d59..0f76da5c5 100644
--- a/src/scripts/ai_council/bundler.ts
+++ b/src/scripts/ai_council/bundler.ts
@@ -12,4 +12,5 @@
  * Hard rules:
- * - Redaction is fail-closed. If a redaction pattern fires, the line is
- *   scrubbed *before* the bundle is built.
+ * - Redaction is fail-closed. Every detected value is replaced by its
+ *   placeholder *before* the bundle is built, and the member call refuses a
+ *   body that still carries one.
  * - Size guard is fail-loud. > MAX_BUNDLE_BYTES → raises BundleTooLarge,
@@ -22,3 +23,3 @@ import * as path from 'node:path';
 
-import { detect, maskingEnd, prefixesOf, rawKeyPrefixPattern } from '../_lib/egress_rules.js';
+import { councilEgress, type CouncilEgress } from './council_egress.js';
 
@@ -78,78 +79,15 @@ function _splitlines(s: string): string[] {
 
-// ── redaction patterns ───────────────────────────────────────────────────
-// Each pattern is matched line-wise; matching lines are replaced with the
-// placeholder. Order matters — the most specific pattern goes first. Credential
-// shapes are not spelled here: they come from the one rule table
-// (road-to-one-detector-and-the-senders-we-own 2.2), which this module reads
-// for detection only; replacing whole lines stays this module's policy.
-
-const _REDACTION_LINE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
-    [/~?\/?\.event4u\/agent-config\/[^/\s]+\.key/u, '[redacted: agent-config key path]'],
-    [/~?\/?\.config\/agent-config\/[^/\s]+\.key/u, '[redacted: agent-config key path]'],
-    [/^\s*Authorization:\s/iu, '[redacted: Authorization header]'],
-    [/(api[_-]?key|secret|token|password)\s*[:=]/iu, '[redacted: secret-like assignment]'],
-    [rawKeyPrefixPattern(8, prefixesOf('anthropic-api-key')), '[redacted: anthropic-key-like token]'],
-    [
-        rawKeyPrefixPattern(20, [...prefixesOf('openai-api-key'), ...prefixesOf('anthropic-project-key')], {
-            boundary: 'never',
-        }),
-        '[redacted: openai-key-like token]',
-    ],
-];
-
-const _ANTHROPIC_LABEL = '[redacted: anthropic-key-like token]';
-const _OPENAI_LABEL = '[redacted: openai-key-like token]';
-const _CREDENTIAL_LABEL = '[redacted: credential-like token]';
-const _RULE_LABEL: Readonly<Record<string, string>> = {
-    'anthropic-api-key': _ANTHROPIC_LABEL,
-    'openai-api-key': _OPENAI_LABEL,
-    'anthropic-project-key': _OPENAI_LABEL,
-};
-
-/**
- * Line index -> placeholder for every line a credential's replacement extent
- * touches, so a multi-line value (a PEM block) loses every line it spans.
- */
-function _credentialLines(lines: readonly string[]): Map<number, string> {
-    const joined = lines.join('\n');
-    const starts: number[] = [];
-    let at = 0;
-    for (const line of lines) {
-        starts.push(at);
-        at += line.length + 1;
-    }
-    const lineOf = (offset: number): number => {
-        let i = 0;
-        while (i + 1 < starts.length && (starts[i + 1] as number) <= offset) i += 1;
-        return i;
-    };
-    const out = new Map<number, string>();
-    for (const span of detect(joined)) {
-        if (span.class !== 'credential') continue;
-        const end = maskingEnd(joined, span);
-        const label = _RULE_LABEL[span.rule] ?? _CREDENTIAL_LABEL;
-        for (let i = lineOf(span.start); i <= lineOf(Math.max(span.start, end - 1)); i += 1) {
-            if (!out.has(i)) out.set(i, label);
-        }
-    }
-    return out;
-}
-
-/** Apply redaction patterns to a multi-line text buffer. */
-export function redact(text: string): string {
-    const lines = _splitlines(text);
-    const credential = _credentialLines(lines);
-    const out: string[] = [];
-    lines.forEach((line, i) => {
-        let replaced = line;
-        for (const [pattern, placeholder] of _REDACTION_LINE_PATTERNS) {
-            pattern.lastIndex = 0;
-            if (pattern.test(replaced)) {
-                replaced = placeholder;
-                break;
-            }
-        }
-        out.push(replaced === line ? (credential.get(i) ?? line) : replaced);
-    });
-    return out.join('\n');
+// ── redaction ────────────────────────────────────────────────────────────
+// Every value the one rule table detects — its credential rows, the reviewer-
+// threshold assignment and Authorization rows, and the bundler's own looser
+// readings (council_egress.ts) — is replaced by a typed placeholder of the
+// grammar in docs/contracts/egress-placeholders-v1.md, span by span, so a
+// finding no longer costs the reviewer its whole line
+// (road-to-one-detector-and-the-senders-we-own 3.3). The run's scope remembers
+// what it replaced, and every member call checks its body against it before
+// the request is written (`callMember`).
+
+/** Replace every detected value with its placeholder. Line endings are normalised to `\n`. */
+export function redact(text: string, egress: CouncilEgress = councilEgress()): string {
+    return egress.replace(_splitlines(text).join('\n'));
 }
diff --git a/src/scripts/ai_council/clients.ts b/src/scripts/ai_council/clients.ts
index 55d508d0f..ccf1f364c 100644
--- a/src/scripts/ai_council/clients.ts
+++ b/src/scripts/ai_council/clients.ts
@@ -1 +1,2 @@
+// egress-content: session-content asserted — API seats post through api_transport.curlJsonPost and CLI seats pass councilEgress().check before the spawn; council rounds are replaced through the engine first
 // External-AI clients for the council — ported from the retired Python
@@ -50,2 +51,3 @@ import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
 import { boundFor } from './cli_agency_bounds.js';
+import { councilEgress } from './council_egress.js';
 import {
@@ -1491,2 +1493,16 @@ export abstract class CliClient extends ExternalAIClient {
         const stdinPayload = this._stdin_payload(system_prompt, user_prompt);
+        // The final egress check, immediately before the request is written
+        // (road-to-one-detector-and-the-senders-we-own 3.3): nothing is spawned
+        // and nothing counts against the daily cap when it refuses.
+        const refusal = councilEgress().check(`${cmd.join('\n')}\n${stdinPayload ?? ''}`);
+        if (refusal !== null) {
+            return new CouncilResponse({
+                provider: this.name,
+                model: this.model,
+                text: '',
+                latency_ms: _elapsedMs(t0),
+                error: 'egress_refused',
+                metadata: { cli: true, egress_reason: refusal.reason, egress_rule: refusal.what },
+            });
+        }
         let proc: SubprocessResult;
diff --git a/src/scripts/ai_council/council_egress.ts b/src/scripts/ai_council/council_egress.ts
new file mode 100644
index 000000000..1cc2b50d9
--- /dev/null
+++ b/src/scripts/ai_council/council_egress.ts
@@ -0,0 +1,158 @@
+/**
+ * The council channel's egress state (road-to-one-detector-and-the-senders-we-own
+ * 3.3): one token scope per run, the bundler's replacement through it, and the
+ * final check every member call passes immediately before its request is written.
+ *
+ * The values replaced in this run are held in memory so the final check can
+ * look for them; they are never written, logged or returned. The retained
+ * record carries what the members were sent, so it keeps the placeholders; a
+ * restore is for a display in this process only, and resolves identifiers —
+ * a credential token resolves to nothing (D5).
+ *
+ * Credentials are replaced whatever the settings say: the bundle masked every
+ * credential line before this module existed, so replacing the value instead of
+ * the line changes how much is lost, not whether. Identifiers are replaced — and
+ * checked — only when `egress.placeholders.mode` is `protect` or `strict`;
+ * whether any identifier is replaced by default for consumers is the owner's
+ * decision D8, which this module does not take.
+ */
+
+import {
+    detect,
+    EGRESS_RULES,
+    type EgressRule,
+    type EgressSpan,
+    maskingEnd,
+    prefixesOf,
+    rawKeyPrefixPattern,
+    replaceSpans,
+    resolveOverlaps,
+    findSpans,
+    REVIEW_CREDENTIAL_ROWS,
+} from '../_lib/egress_rules.js';
+import { parseTokens, TokenScope } from '../_lib/egress_token.js';
+import { readEgressMode } from '../hooks/egress_stage.js';
+
+/**
+ * The bundler's own looser readings, kept so moving it from whole-line masks to
+ * spans narrows nothing: an Anthropic key prefix with eight key characters, an
+ * OpenAI or project key glued to a preceding word, and the path of this
+ * package's own key files.
+ */
+const BUNDLER_OWN_ROWS: readonly EgressRule[] = [
+    {
+        rule: 'bundler-short-anthropic-key',
+        type: 'APIKEY',
+        class: 'credential',
+        replacement: 'detection',
+        pattern: rawKeyPrefixPattern(8, prefixesOf('anthropic-api-key')),
+    },
+    {
+        rule: 'bundler-glued-openai-key',
+        type: 'APIKEY',
+        class: 'credential',
+        replacement: 'detection',
+        pattern: rawKeyPrefixPattern(20, [...prefixesOf('openai-api-key'), ...prefixesOf('anthropic-project-key')], {
+            boundary: 'never',
+        }),
+    },
+    {
+        rule: 'bundler-key-path',
+        type: 'KEYPATH',
+        class: 'credential',
+        replacement: 'detection',
+        pattern: /~?\/?\.(?:event4u|config)\/agent-config\/[^/\s]+\.key/gu,
+    },
+];
+
+export const BUNDLE_RULES: readonly EgressRule[] = [...EGRESS_RULES, ...REVIEW_CREDENTIAL_ROWS, ...BUNDLER_OWN_ROWS];
+
+const CLASS_RANK = { credential: 1, identifier: 0 } as const;
+
+/** Why a body was refused; never carries a byte of the body. */
+export interface EgressRefusal {
+    readonly reason: 'replaced-value-present' | 'high-confidence-finding';
+    /** The rule that fired, or the type of the replaced value. */
+    readonly what: string;
+}
+
+export class CouncilEgress {
+    readonly scope = new TokenScope();
+    private readonly replaced = new Set<string>();
+
+    /** `identifiers`: replace and check the identifier class too (mode `protect` or `strict`). */
+    constructor(private readonly opts: { readonly identifiers: boolean } = { identifiers: false }) {}
+
+    /**
+     * Every detected value becomes a token; a key block whose end cannot be
+     * proven is replaced through the nearest END marker, as the line masks did.
+     */
+    replace(text: string): string {
+        const spans = resolveOverlaps(findSpans(text, BUNDLE_RULES))
+            .filter((s) => s.class === 'credential' || this.opts.identifiers)
+            .map((s) => ({ ...s, end: maskingEnd(text, s) }));
+        spans.sort((a, b) => a.start - b.start);
+        const merged: EgressSpan[] = [];
+        for (const s of spans) {
+            const last = merged[merged.length - 1];
+            if (last !== undefined && s.start < last.end) {
+                const keep = CLASS_RANK[s.class] > CLASS_RANK[last.class] ? s : last;
+                merged[merged.length - 1] = { ...keep, start: last.start, end: Math.max(last.end, s.end) };
+            } else {
+                merged.push(s);
+            }
+        }
+        const tokens = merged.map((s) => {
+            const value = text.slice(s.start, s.end);
+            this.replaced.add(value);
+            return this.scope.mint(s.type, s.class, value);
+        });
+        return replaceSpans(text, merged, (_s, i) => tokens[i] as string);
+    }
+
+    /** The final check: null when the body may be sent. */
+    check(body: string): EgressRefusal | null {
+        for (const value of this.replaced) {
+            if (body.includes(value)) return { reason: 'replaced-value-present', what: 'value replaced in this run' };
+        }
+        for (const s of detect(body)) {
+            const high = s.class === 'credential' ? s.rule !== 'generic-assignment' : s.validated && this.opts.identifiers;
+            if (high) return { reason: 'high-confidence-finding', what: s.rule };
+        }
+        return null;
+    }
+
+    /** For a display in this process only: identifier tokens back to their spelling. */
+    restoreForDisplay(text: string): string {
+        let out = text;
+        for (const t of parseTokens(text).reverse()) {
+            const value = this.scope.resolve(text.slice(t.start, t.end));
+            if (value !== null) out = out.slice(0, t.start) + value + out.slice(t.end);
+        }
+        return out;
+    }
+}
+
+let current: CouncilEgress | null = null;
+
+function fromSettings(): CouncilEgress {
+    let mode: string;
+    try {
+        mode = readEgressMode(process.cwd());
+    } catch {
+        mode = 'protect';
+    }
+    return new CouncilEgress({ identifiers: mode === 'protect' || mode === 'strict' });
+}
+
+/** The run's egress state; one council run is one process. */
+export function councilEgress(): CouncilEgress {
+    current ??= fromSettings();
+    return current;
+}
+
+/** A fresh scope, for a test or a second run in one process; the settings are read again unless `opts` is given. */
+export function resetCouncilEgress(opts?: { readonly identifiers: boolean }): CouncilEgress {
+    current = opts === undefined ? fromSettings() : new CouncilEgress(opts);
+    return current;
+}
diff --git a/src/scripts/ai_council/response_render.ts b/src/scripts/ai_council/response_render.ts
index e340eda7c..5c84bcd32 100644
--- a/src/scripts/ai_council/response_render.ts
+++ b/src/scripts/ai_council/response_render.ts
@@ -11,2 +11,3 @@
 import { CouncilResponse, type ExternalAIClient } from './clients.js';
+import { councilEgress } from './council_egress.js';
 import { _metaGet } from './py_parity.js';
@@ -76,6 +77,9 @@ export function renderResponseMeta(r: CouncilResponse, deps: MetaRenderDeps): st
 
-/** Error-tagged member call — the split/ask branch is one shape, not three. */
 /**
  * One member call, error-tagged rather than throwing — the split/ask branch
- * appeared three times before this and is one shape, not three.
+ * appeared three times before this and is one shape, not three. It is also the
+ * council channel's final egress check: immediately before the request is
+ * written, the whole body is rescanned for every value this run replaced and
+ * every high-confidence finding, and a hit refuses the send — the member is
+ * never called and the response carries only the reason.
  */
@@ -89,5 +93,16 @@ export function callMember(
     try {
+        const system = systemFor(client);
+        const body = opts.split ? `${system}\n${opts.split.stable}${opts.split.suffix}` : `${system}\n${question.user_prompt}`;
+        const refusal = councilEgress().check(body);
+        if (refusal !== null) {
+            return new CouncilResponse({
+                provider: client.name,
+                model: client.model,
+                text: '',
+                error: `egress refused: ${refusal.reason} (${refusal.what}); nothing was sent`,
+            });
+        }
         return opts.split
             ? client.ask_split(
-                  systemFor(client),
+                  system,
                   opts.split.stable,
@@ -96,3 +111,3 @@ export function callMember(
               )
-            : client.ask(systemFor(client), question.user_prompt, question.max_tokens);
+            : client.ask(system, question.user_prompt, question.max_tokens);
     } catch (exc) {
diff --git a/src/scripts/ai_council/shadow_dispatch.ts b/src/scripts/ai_council/shadow_dispatch.ts
index 0567a70b9..03fe4c0b6 100644
--- a/src/scripts/ai_council/shadow_dispatch.ts
+++ b/src/scripts/ai_council/shadow_dispatch.ts
@@ -20,3 +20,5 @@ import * as fs from 'node:fs';
 import type { PyRandom } from '../_lib/py_random.js';
+import { parseTokens } from '../_lib/egress_token.js';
 import { redact } from './bundler.js';
+import { CouncilEgress } from './council_egress.js';
 import { createHash } from 'node:crypto';
@@ -69,4 +71,10 @@ const _defaultRandom: RandomLike = {
 
+// Shadow rows are this module's own record, not a council request: a scope of
+// their own keeps them out of the run's final-check state.
+function _redact(query: string): string {
+    return redact(query, new CouncilEgress());
+}
+
 function _hashQuery(query: string): string {
-    const redacted = redact(query);
+    const redacted = _redact(query);
     return createHash('sha256').update(Buffer.from(redacted, 'utf-8')).digest('hex').slice(0, 16);
@@ -79,3 +87,5 @@ function _privacyDropped(redacted: string): boolean {
     }
-    return stripped.startsWith('[redacted');
+    // Any replaced value drops the row: a placeholder in a shadow query means the
+    // query carried something the bundler would not send.
+    return parseTokens(redacted).length > 0;
 }
@@ -108,3 +118,3 @@ export function record_shadow_decision(
 
-    const redactedQ = redact(query);
+    const redactedQ = _redact(query);
     if (_privacyDropped(redactedQ)) {
```

## `tests/scripts/ai_council/council_egress.test.ts`

```ts
/**
 * road-to-one-detector-and-the-senders-we-own 3.3: the council bundle goes
 * through the engine, and the member call checks what it is about to send.
 *
 * Every value is assembled at runtime and never printed.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { EGRESS_RULES } from '../../../src/scripts/_lib/egress_rules.js';
import { parseTokens } from '../../../src/scripts/_lib/egress_token.js';
import { bundle_prompt, redact } from '../../../src/scripts/ai_council/bundler.js';
import { curlJsonPost, stringLeaves } from '../../../src/scripts/ai_council/api_transport.js';
import { AnthropicCliClient, CouncilResponse, ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import { CouncilEgress, resetCouncilEgress } from '../../../src/scripts/ai_council/council_egress.js';
import { callMember } from '../../../src/scripts/ai_council/response_render.js';

const ALNUM = 'Qw3Er5Ty7Ui9Op2As4Df6Gh8Jk1Lz3Xc5Vb7Nm9';
const run = (n: number, shift = 0): string => {
    let s = '';
    for (let i = 0; i < n; i += 1) s += ALNUM[(i + shift) % ALNUM.length];
    return s;
};

const PAT = `${'gh'}p_${run(36, 2)}`;
const DB_PASSWORD = `pw${run(10, 4)}`;
const DB_URI = `postgres://app:${DB_PASSWORD}@db.example.com:5432/app`;
const EMAIL = ['jane.doe', 'example.org'].join('@');
const IBAN = 'DE89 3704 0044 0532 0130 00';
const PHONE = '+49 30 1234567';
const AWS = `AKIA${'ABCDEFGHIJ234567'}`;
const CODE_LINE = 'const token = getToken();';

/** The F1 sample: five values that left unchanged before, and a code line that was lost whole. */
const F1 = [
    `Contact: ${EMAIL}`,
    `IBAN: ${IBAN}`,
    `Phone: ${PHONE}`,
    `DATABASE_URL=${DB_URI}`,
    `export GITHUB=${PAT}`,
    CODE_LINE,
].join('\n');

class FakeClient extends ExternalAIClient {
    readonly sent: string[] = [];
    constructor() {
        super();
        this.name = 'fake';
        this.model = 'fake-1';
    }
    ask(system_prompt: string, user_prompt: string): CouncilResponse {
        this.sent.push(`${system_prompt}\n${user_prompt}`);
        return new CouncilResponse({ provider: this.name, model: this.model, text: 'ok' });
    }
}

const call = (client: FakeClient, user_prompt: string, system = 'You review.'): CouncilResponse =>
    callMember(client, { user_prompt, max_tokens: 64 }, {}, () => system, (e) => String(e));

const IDENTIFIER_TYPES = new Set(EGRESS_RULES.filter((r) => r.class === 'identifier').map((r) => r.type));
const hasIdentifierRows = ['EMAIL', 'IBAN', 'PHONE'].every((t) => IDENTIFIER_TYPES.has(t));

describe('council bundle: span replacement through the engine (3.3)', () => {
    beforeEach(() => {
        resetCouncilEgress({ identifiers: false });
    });

    it('replaces the credentials of the F1 sample and keeps the code line', () => {
        const out = redact(F1);
        expect(out).not.toContain(PAT);
        expect(out).not.toContain(DB_PASSWORD);
        expect(out.split('\n')).toContain(CODE_LINE);
        const types = parseTokens(out).map((t) => t.type);
        expect(types).toContain('DBURI');
        expect(types).toContain('TOKEN');
        // A finding costs the value, not the line: the key names stay readable.
        expect(out).toMatch(/^DATABASE_URL=/m);
        expect(out).toMatch(/^export GITHUB=__TOKEN_1_/m);
    });

    it.skipIf(!hasIdentifierRows)('the F1 sample leaves with five placeholders in protect', () => {
        const out = redact(F1, new CouncilEgress({ identifiers: true }));
        expect(parseTokens(out)).toHaveLength(5);
        for (const v of [EMAIL, IBAN, PHONE, DB_PASSWORD, PAT]) expect(out).not.toContain(v);
        expect(out.split('\n')).toContain(CODE_LINE);
    });

    it.skipIf(!hasIdentifierRows)('identifiers are left, and not refused, under the shipped default (D8)', () => {
        const egress = new CouncilEgress({ identifiers: false });
        const out = redact(F1, egress);
        expect(out).toContain(EMAIL);
        expect(egress.check(out)).toBeNull();
    });

    it('a low-entropy password and a bearer value lose the value, not the line', () => {
        const out = redact(['password = hunter2', 'Authorization: Bearer abc.def', 'token: string;'].join('\n')).split('\n');
        expect(out[0]).toMatch(/^password = __SECRET_1_[0-9a-f]{6}__$/);
        expect(out[1]).toMatch(/^Authorization: __TOKEN_1_[0-9a-f]{6}__$/);
        expect(out[2]).toBe('token: string;');
    });

    it('code after a credential keyword is not a secret (found by bundling this branch)', () => {
        const code = [
            "    password: 'password',",
            "    readonly token: typeof import('./x.js');",
            '    apiKey: new RegExp(source),',
            '    secret: await load(),',
        ].join('\n');
        expect(redact(code)).toBe(code);
    });

    it('replacing twice yields the same bytes as replacing once', () => {
        const egress = new CouncilEgress();
        const once = redact(F1, egress);
        expect(redact(once, egress)).toBe(once);
    });

    it('a credential token never restores for display', () => {
        const egress = new CouncilEgress();
        const out = redact(F1, egress);
        expect(egress.restoreForDisplay(out)).toBe(out);
    });
});

describe('council member call: the final check (3.3)', () => {
    beforeEach(() => {
        resetCouncilEgress({ identifiers: false });
    });

    it('sends a bundled body', () => {
        const client = new FakeClient();
        const r = call(client, bundle_prompt(F1).text);
        expect(r.error).toBeNull();
        expect(client.sent).toHaveLength(1);
        expect(client.sent[0]).not.toContain(PAT);
    });

    it('canary: a raw value planted past the replacement is refused before the request is written', () => {
        const bundled = bundle_prompt(F1).text;
        const planted = `${bundled}\n\nappendix: ${PAT}`;
        const client = new FakeClient();
        const r = call(client, planted);
        expect(r.error).toMatch(/^egress refused: replaced-value-present/);
        expect(r.error).not.toContain(PAT);
        expect(client.sent).toHaveLength(0);
        // The canary is live: without the check this body would reach the member.
        expect(new FakeClient().ask('You review.', planted).text).toBe('ok');
        expect(planted).toContain(PAT);
    });

    it('a high-confidence finding that never went through the bundler is refused, in the system prompt too', () => {
        const client = new FakeClient();
        expect(call(client, `plain question ${AWS}`).error).toMatch(/high-confidence-finding \(aws-access-key\)/);
        expect(call(client, 'plain question', `system ${AWS}`).error).toMatch(/high-confidence-finding/);
        expect(client.sent).toHaveLength(0);
    });

    it('the split path is checked as one body', () => {
        const client = new FakeClient();
        const r = callMember(
            client,
            { user_prompt: 'unused', max_tokens: 64 },
            { split: { stable: 'artefact', suffix: `\nround 2: ${AWS}` } },
            () => 'You review.',
            (e) => String(e),
        );
        expect(r.error).toMatch(/egress refused/);
        expect(client.sent).toHaveLength(0);
    });
});

describe('the transports check what they are about to write (3.3)', () => {
    beforeEach(() => {
        resetCouncilEgress({ identifiers: false });
    });

    it('the API post refuses a body carrying a high-confidence finding before curl is spawned', () => {
        expect(() =>
            curlJsonPost('https://unreachable.invalid/v1/messages', [], { messages: [{ role: 'user', content: `q ${AWS}` }] }),
        ).toThrow(/^egress refused: high-confidence-finding \(aws-access-key\); nothing was sent$/);
    });

    it('the API post refuses a value the bundler replaced in this run', () => {
        bundle_prompt(F1);
        expect(() => curlJsonPost('https://unreachable.invalid/v1', [], { prompt: `x ${PAT}` })).toThrow(
            /replaced-value-present/,
        );
    });

    it('the body check reads every string the provider would read, keys included', () => {
        expect(stringLeaves({ a: ['x', { [AWS]: 1 }], b: 'y' })).toEqual(['a', 'x', AWS, 'b', 'y']);
    });

    it('a CLI seat refuses before spawning and books no call', () => {
        const callsPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'egress-cli-')), 'cli-calls.json');
        const client = new AnthropicCliClient({ cli_calls_path: callsPath, binary: '/bin/echo' });
        const spawned: string[] = [];
        (client as unknown as { _runSubprocess: (c: string[], s: string | null) => unknown })._runSubprocess = (c) => {
            spawned.push(c.join(' '));
            return { returncode: 0, stdout: '{}', stderr: '' };
        };
        const r = client.ask('You review.', `question ${AWS}`);
        expect(r.error).toBe('egress_refused');
        expect(spawned).toHaveLength(0);
        expect(fs.existsSync(callsPath)).toBe(false);
    });
});
```
