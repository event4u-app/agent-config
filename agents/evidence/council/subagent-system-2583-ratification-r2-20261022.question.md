# Ratification review, round 2 — gated hook-plumbing changes on feat/subagent-system-2583

<!-- evidence-type: analysis -->

You are one of two independent reviewers asked to ratify or refuse a change to
gated hook-plumbing files under ADR-268 § 4 (an agent may modify its constitution
but may not ratify its own increase in power). Review the diff and the evidence
below and answer with: your verdict (`ratified` or `refused`), every defect you
find with file, line and a concrete failure scenario, and whether each defect is
blocking. Judge the change on what is shown.

## Subject

subject: 97978d036ce433a7cc3f381c184c9de46da7adc125e42bb2a407bd8731867054
revision: be08dc0b678218b788cb72ce390b8ac19d0e6107

Gated files (5), all in this subject digest: `src/config/hook-bundle-budget.json`,
`src/scripts/_lib/egress_rules.ts`, `src/scripts/hook_manifest.yaml`,
`src/scripts/hook_manifest.json` (a compiled projection of the YAML — its diff is a
two-line fingerprint-and-body swap, shown truncated below; `check_generator_sync`
verifies it equals a fresh compile of the YAML), `src/scripts/hooks/egress_stage.ts`.

## What each change is for

1. `hook_manifest.yaml`
   - `spawn-guard-shadow` gains `SendMessage` in `tools:`, `needs_payload_bodies: [input, result]`, and a
     `post_tool_use` binding on claude and cowork. On `PostToolUse(Agent)` it records a
     `subagent_named` ledger line `{ref: sha-hash of agent id, name, session_id}`, so a later
     `SendMessage` whose `to` is that name resolves `recipient_kind: name` against this session's
     spawns only. The shadow line gains `rate_window: would_wait|clear` from a recent host-sourced
     `quota_parked` marker. Advisory, exit 0 on every path; it never denies.
   - New concern `host-rate-marker` (advisory, telemetry) bound to `agent_error` on claude, plus the
     native alias `StopFailure -> agent_error` for claude. On `StopFailure` with error `rate_limit`
     it writes a `quota_parked` marker with `source: host`; any other error writes nothing; exit 0
     always. A forced `StopFailure` on Claude Code 2.1.308 was observed carrying `error`.
2. `hook-bundle-budget.json` — the egress engine chunk ceiling moves 28,000 -> 32,000 B with a
   `raise_log` entry naming what was added (identifier rows and their validators). The chunk
   measures 30,493 B. The dispatch bundle ceiling (1,550,000 B) is unchanged; it measures 1,548,222 B.
3. `egress_rules.ts` — validated identifier rows (IBAN by country length + MOD-97, card by Luhn +
   context word, e-mail with documentation/no-reply allowlist, phone shapes, German tax ID by ISO
   7064 + context, US SSN), three credential prefix rows (`hf_`, `nvapi-`, `r8_`) with minimum
   lengths, and the IBAN country-length table extended to every country in the ISO 13616 registry
   the author could source (prior rounds 5 and 6 closed `OM23`; rows were cross-checked against
   the published registry, but no registry release number is pinned in the file).
4. `egress_stage.ts` — `egressInjection` in `protect`/`strict` now catches a throwing engine and
   returns a visible `[egress: injected text withheld (engine-threw)]` instead of letting the
   exception escape the concern; `off`/`observe` remain the identity.

## Round 1 findings and what changed

Round 1 (2026-10-22, both seats) refused on one blocking defect and named three non-blocking ones:

1. **Blocking — `TokenScope` constructed outside the guard in `egress_stage.ts`.** Fixed in
   `9c2260c940`: the scope is created lazily inside the same `try` as `injectText`, once per
   dispatch. New test `egress_injection.test.ts` › `protect and strict withhold visibly when the
   scope constructor throws`, seen red before the fix (1 failed), green after.
2. **Budget measurement mismatch (30,445 vs 30,493).** The raise-log entry now records both: 30,445 B
   when the raise landed, 30,493 B at this revision after the round-6 IBAN rows.
3. **`StopFailure` `rate_limit` not observed live.** The manifest comment now says so plainly: the
   live observation on 2.1.308 carried `server_error`; `rate_limit` is the host's documented value
   and is unobserved, so a different spelling would leave the marker unwritten. The concern is
   record-only and its absence changes no behaviour.
4. **Expanded payload access of `spawn-guard-shadow`.** The consumer diff is included below. New
   test `spawn_guard_shadow.test.ts` › `prompts, results, messages and the raw agent id are absent
   from every ledger file` drives a pre-tool `Agent`, a post-tool `Agent` with a result body and
   agent id, and a `SendMessage` with a body, then asserts no body marker and no raw id in any
   ledger file while the `subagent_named` line is present.

## Evidence (run at the revision above, clean worktree)

Tests over every suite that exercises these files
(`npx vitest run egress hook_manifest hook_bundle spawn_guard_shadow quota_parked host_rate check_egress_mutations _lib_egress lint_hook_manifest`):

```
 Test Files  38 passed (38)
      Tests  1428 passed (1428)
```

Gates:

```
✅  hook bundle: 1548235 B / 1550000 B ceiling, 1 YAML reader(s) [yaml], 311 modules
✅  chunk src/scripts/_lib/svg_rules.ts: 61070 B
✅  chunk src/scripts/_lib/egress_engine.ts: 30493 B
✅  chunk src/scripts/chat_history.ts: 210270 B
✅  hook-manifest-compiled: 1 source(s) changed, src/scripts/hook_manifest.json matches a fresh run
✅  owned-digest: 8 source(s) changed, agents/roadmaps-owned.md matches a fresh run
✅  check_generator_sync: 2 in-scope generated artefact(s) match a fresh run
✅  check_egress_mutations: every mutation killed (4 recipe(s)).
```

Named tests include: `spawn_guard_shadow.test.ts` › `records-would-resume-and-never-denies`,
`recent-rate-marker-yields-would-wait`; `quota_parked.test.ts` › `host-stop-failure-writes-marker`,
`any other failure class writes nothing, and nothing ever blocks`; `egress_injection.test.ts` ›
`off and observe deliver every concern context byte-identical`, `an engine that throws withholds
visibly with a reason, never an empty or raw delivery`; `_lib_egress_free_tier_prefixes.test.ts`
(50/50 per prefix, minimum lengths); the IBAN country test generates a checksum-valid IBAN per
table row and asserts it is masked; `check_egress_mutations` kills four mutations including the
disabled IBAN checksum.

## The gated diff (against origin/main)

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 1c634b3fb5..a22da70a19 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -17,6 +17,16 @@
             "what_was_added": "Nothing in this commit. The 1,500,000 ceiling was red on the very commit that registered it: measured 1,511,489 bytes at 22b19e520, which is the merge of the PR that introduced the budget. Its derivation read 1,469,738 bytes on the PR branch, whose base predated three PRs that had merged meanwhile \u2014 the failure-event binding of #2160 (sixteen concerns on a new slot), the touched-file quality pass of #2152, and the evidence classification of #2153 \u2014 and #2162 landed after it. The gate ran on each PR's pre-merge tree and never on the merge result, so every one of those PRs was green alone and the trunk was red the moment they were together.",
             "why_it_could_not_be_avoided": "The bytes are deliberately merged capability, not an accident to trim: the composition check above shows one parser and no duplicate dependency, so there is nothing to remove that would not remove a feature. The alternative \u2014 reverting a merged lane to fit a ceiling derived against a base that no longer exists \u2014 would discard working code to satisfy a number that never described this tree.",
             "what_would_have_caught_it": "Measuring the ceiling against the merge result rather than the PR branch. A ceiling derived on a branch is a statement about that branch; the trunk is what the gate defends, and the two diverge exactly when several lanes land in one day."
+        },
+        {
+            "date": "2026-10-22",
+            "chunk": "src/scripts/_lib/egress_engine.ts",
+            "from": 28000,
+            "to": 32000,
+            "by": "agent, during the feat/subagent-system-2583 run",
+            "what_was_added": "The queued engine work the 28,000 ceiling was sized for, landed together: the validated identifier rows of one-detector 2.3 (IBAN, card, e-mail with a keyed-digest allowlist, three phone shapes, German tax id, US SSN), the invisible-character and lookalike-letter normalisation of 2.5, and three free-tier credential rows (Hugging Face, NVIDIA, Replicate) of free-hands 1.2. Measured 30,445 bytes when the raise landed; 30,493 bytes at the ratified revision, after the round-6 IBAN rows.",
+            "why_it_could_not_be_avoided": "Each addition is a detection row or the normalisation that keeps one from being hidden; the 2026-10-18 derivation already counted them as the chunk's planned growth and underestimated their sum by about 2.4 KB. The chunk is loaded only when a caller needs detection, so no dispatch pays these bytes; the dispatch bundle itself is unchanged.",
+            "what_would_have_caught_it": "Re-measuring the queued items' sum when the ceiling was set, rather than estimating each."
         }
     ],
     "chunks": [
@@ -28,7 +38,7 @@
         },
         {
             "entry": "src/scripts/_lib/egress_engine.ts",
-            "max_bytes": 28000,
+            "max_bytes": 32000,
             "registered_at": "2026-10-18",
             "derivation": "Measured 18,478 bytes on 2026-10-18 (the rule table, the token grammar and the commit scanner, with the per-rule linearity prose moved to a test-only module). The ceiling is that reading plus the queued engine work of road-to-one-detector-and-the-senders-we-own (validated identifier rules about 4.3 KB, known values, the invisible-character rescan and the variant suffix about 1-2 KB each), rounded up. An AI council of two providers chose on 2026-10-18 to move the engine out of the dispatch bundle into this conditional chunk rather than raise the dispatch ceiling, and asked that the chunk carry a measured budget of its own so the move does not just relocate uncontrolled growth. A raise follows the same rule as max_bytes: a raise_log entry naming the chunk (`chunk`: this entry) and what was added."
         },
diff --git a/src/scripts/_lib/egress_rules.ts b/src/scripts/_lib/egress_rules.ts
index 53b79227b5..a2218b3598 100644
--- a/src/scripts/_lib/egress_rules.ts
+++ b/src/scripts/_lib/egress_rules.ts
@@ -192,6 +192,115 @@ export function pemMaskEnd(text: string, span: SpanBounds): number | null {
     return null;
 }
 
+// Identifier validators. A shape alone is never enough to replace an identifier:
+// each row carries a checksum, a context word, or both, because a false positive
+// here damages ordinary code and review text.
+
+// IBAN length per country (ISO 13616 registry), packed as `CCnn` pairs. A country
+// missing here leaves its IBANs unmasked, so the table errs towards inclusion.
+const IBAN_LENGTHS =
+    'AD24AE23AL28AT20AZ28BA20BE16BG22BH22BI27BR29BY28CH21CR22CY28CZ24DE22DJ27DK18DO28EE20EG29ES24FI18FK18FO18FR27GB22GE22GI23GL18GR27GT28HN28HR21HU28IE22IL23IQ23IS26IT27JO30KW30KZ20LB28LC32LI21LT20LU20LV21LY25MC27MD24ME22MK19MN20MR27MT31MU30NI28NL18NO15OM23PK24PL28PS29PT25QA29RO24RS22RU33SA24SC31SD18SE24SI19SK24SM27SO23ST25SV28TL23TN24TR26UA29VA22VG24XK20YE30';
+
+export function isValidIban(value: string): boolean {
+    const iban = value.replace(/ /g, '').toUpperCase();
+    const at = IBAN_LENGTHS.indexOf(iban.slice(0, 2));
+    if (at === -1 || at % 4 !== 0 || Number(IBAN_LENGTHS.slice(at + 2, at + 4)) !== iban.length) return false;
+    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return false;
+    let rest = 0;
+    for (const ch of iban.slice(4) + iban.slice(0, 4)) {
+        const n = ch <= '9' ? ch.charCodeAt(0) - 48 : ch.charCodeAt(0) - 55;
+        rest = n > 9 ? (rest * 100 + n) % 97 : (rest * 10 + n) % 97;
+    }
+    return rest === 1;
+}
+
+export function passesLuhn(value: string): boolean {
+    const digits = value.replace(/[ -]/g, '');
+    if (!/^[0-9]{13,19}$/.test(digits) || /^(.)\1+$/.test(digits)) return false;
+    let sum = 0;
+    for (let i = 0; i < digits.length; i += 1) {
+        let d = digits.charCodeAt(digits.length - 1 - i) - 48;
+        if (i % 2 === 1) {
+            d *= 2;
+            if (d > 9) d -= 9;
+        }
+        sum += d;
+    }
+    return sum % 10 === 0;
+}
+
+/** E.164 bounds: a country code plus at most 15 digits in all; never a date after a diff marker. */
+function phoneDigits(min: number, max: number): (value: string) => boolean {
+    return (value) => {
+        if (/^\+?[0-9]{4}-[0-9]{2}-[0-9]{2}/.test(value)) return false;
+        const n = value.replace(/[^0-9]/g, '').length;
+        return n >= min && n <= max;
+    };
+}
+
+/**
+ * German tax identification number: 11 digits, no leading zero, one digit of
+ * the first ten repeated two or three times and no other repeated, and an
+ * ISO 7064 MOD 11,10 check digit.
+ */
+export function isValidGermanTaxId(value: string): boolean {
+    const d = value.replace(/ /g, '');
+    if (!/^[1-9][0-9]{10}$/.test(d)) return false;
+    const counts = new Map<string, number>();
+    for (const ch of d.slice(0, 10)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
+    const repeated = [...counts.values()].filter((c) => c > 1);
+    if (repeated.length !== 1 || (repeated[0] as number) > 3) return false;
+    let product = 10;
+    for (let i = 0; i < 10; i += 1) {
+        let sum = (d.charCodeAt(i) - 48 + product) % 10;
+        if (sum === 0) sum = 10;
+        product = (sum * 2) % 11;
+    }
+    const check = (11 - product) % 10;
+    return check === d.charCodeAt(10) - 48;
+}
+
+/** US social security number: no 000, 666 or 9xx area, no 00 group, no 0000 serial. */
+export function isValidUsSsn(value: string): boolean {
+    const m = /^([0-9]{3})-([0-9]{2})-([0-9]{4})$/.exec(value);
+    if (m === null) return false;
+    const [area, group, serial] = [m[1] as string, m[2] as string, m[3] as string];
+    return area !== '000' && area !== '666' && !area.startsWith('9') && group !== '00' && serial !== '0000';
+}
+
+// Addresses that name no one: documentation and reserved domains (RFC 2606,
+// RFC 6761), no-reply senders, and image-density file names (`logo@2x.png`).
+const EMAIL_EXCLUSIONS: readonly RegExp[] = [
+    /^git@/i,
+    /@(?:[a-z0-9-]+\.)*(?:example\.(?:com|net|org)|example|test|invalid|localhost|local)$/i,
+    /^(?:no-?reply|do-?not-?reply|noreply\+[^@]*)@/i,
+    /@users\.noreply\.github\.com$/i,
+    /@[0-9]x\.[a-z]+$/i,
+    /\.(?:png|jpe?g|gif|svg|webp|ico|js|mjs|cjs|ts|tsx|css|json|ya?ml|lock)$/i,
+];
+
+/**
+ * The repository's own published identities (package author, copyright holder),
+ * held as keyed 64-bit FNV-1a digests of the lower-cased address so the list
+ * reads as noise. A digest hides an address from a reader, not from someone who
+ * guesses it; the list exists to keep the tree's own metadata out of a review's
+ * placeholder count.
+ */
+const EMAIL_ALLOWLIST_DIGESTS: ReadonlySet<string> = new Set(['924acfa874365f8a', '8066a43fc18158bf']);
+
+export function emailAllowlistDigest(address: string): string {
+    let h = 0xcbf29ce484222325n;
+    for (const ch of `egress-email-allowlist-v1\u0000${address.toLowerCase()}`) {
+        h ^= BigInt(ch.codePointAt(0) as number);
+        h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
+    }
+    return h.toString(16).padStart(16, '0');
+}
+
+function isReportableEmail(value: string): boolean {
+    return !EMAIL_ALLOWLIST_DIGESTS.has(emailAllowlistDigest(value));
+}
+
 // Quantifiers are unbounded where the pattern is linear without a bound, so a
 // long value is matched whole and no suffix survives a replacement. Each rule's
 // argument for why it is linear lives in `egress_rules_linearity.ts`, kept out
@@ -302,6 +411,33 @@ export const EGRESS_RULES: readonly EgressRule[] = [
         tokenStart: true,
         pattern: /(?<![A-Za-z0-9])gsk_[A-Za-z0-9]{20,}/g,
     },
+    {
+        rule: 'huggingface-token',
+        type: 'TOKEN',
+        prefixes: ['hf_'],
+        class: 'credential',
+        replacement: 'detection',
+        tokenStart: true,
+        pattern: /(?<![A-Za-z0-9])hf_[A-Za-z0-9]{30,}/g,
+    },
+    {
+        rule: 'nvidia-api-key',
+        type: 'APIKEY',
+        prefixes: ['nvapi-'],
+        class: 'credential',
+        replacement: 'detection',
+        tokenStart: true,
+        pattern: /(?<![A-Za-z0-9])nvapi-[A-Za-z0-9_-]{40,}/g,
+    },
+    {
+        rule: 'replicate-api-token',
+        type: 'TOKEN',
+        prefixes: ['r8_'],
+        class: 'credential',
+        replacement: 'detection',
+        tokenStart: true,
+        pattern: /(?<![A-Za-z0-9])r8_[A-Za-z0-9]{30,}/g,
+    },
     {
         rule: 'jwt',
         type: 'TOKEN',
@@ -358,6 +494,81 @@ export const EGRESS_RULES: readonly EgressRule[] = [
         valueGroup: 1,
         validator: looksLikeSecretValue,
     },
+    {
+        rule: 'iban',
+        type: 'IBAN',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![A-Za-z0-9])[A-Z]{2}[0-9]{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,3})?(?![A-Za-z0-9])/g,
+        validator: isValidIban,
+    },
+    {
+        rule: 'payment-card',
+        type: 'CARD',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![0-9])[0-9](?:[ -]?[0-9]){12,18}(?![0-9])/g,
+        validator: passesLuhn,
+        context: {
+            words: /\b(?:card|credit|debit|visa|mastercard|amex|maestro|kreditkarte|karte|kartennummer|payment|zahlung)\b/i,
+            window: 48,
+        },
+    },
+    {
+        rule: 'email',
+        type: 'EMAIL',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern:
+            /(?<![A-Za-z0-9._%+\\-])[A-Za-z0-9][A-Za-z0-9._%+-]{0,63}@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.){1,8}[A-Za-z]{2,24}(?![A-Za-z0-9-])/g,
+        exclusions: EMAIL_EXCLUSIONS,
+        validator: isReportableEmail,
+    },
+    {
+        rule: 'phone-international',
+        type: 'PHONE',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![A-Za-z0-9+])\+[1-9][0-9]{0,2}(?:[ ./-]?(?:\([0-9]{1,6}\)|(?=([0-9]{1,6}))\1)){1,5}(?![0-9])/g,
+        validator: phoneDigits(8, 15),
+    },
+    {
+        rule: 'phone-national',
+        type: 'PHONE',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![A-Za-z0-9+(])(?:\(0[1-9][0-9]{1,4}\)|0[1-9][0-9]{1,4})(?:[ ./-]?(?=([0-9]{2,8}))\1){1,3}(?![0-9])/g,
+        validator: phoneDigits(7, 13),
+        context: { words: /\b(?:tel|telefon|telephone|phone|mobil|mobile|cell|fax|handy|call|ruf)\b/i, window: 32 },
+    },
+    {
+        rule: 'phone-nanp',
+        type: 'PHONE',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![A-Za-z0-9+(-])(?:\+?1[ .-]?)?(?:\([2-9][0-9]{2}\) ?|[2-9][0-9]{2}[ .-]?)[2-9][0-9]{2}[ .-]?[0-9]{4}(?![0-9-])/g,
+        context: { words: /\b(?:tel|telephone|phone|mobile|cell|fax|call)\b/i, window: 32 },
+    },
+    {
+        rule: 'de-tax-id',
+        type: 'TAXID',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![0-9])[1-9](?: ?[0-9]){10}(?![0-9])/g,
+        validator: isValidGermanTaxId,
+        context: {
+            words: /\b(?:steuer-?id|steuer-?identifikationsnummer|identifikationsnummer|idnr|tax[ -]?id|tin)\b/i,
+            window: 48,
+        },
+    },
+    {
+        rule: 'us-ssn',
+        type: 'SSN',
+        class: 'identifier',
+        replacement: 'detection',
+        pattern: /(?<![0-9-])[0-9]{3}-[0-9]{2}-[0-9]{4}(?![0-9-])/g,
+        validator: isValidUsSsn,
+    },
 ];
 
 // A value that is a type word, a literal, a language keyword or a credential
@@ -435,6 +646,10 @@ export const REVIEW_CREDENTIAL_ROWS: readonly EgressRule[] = [
     },
 ];
 
+/** The credential rows alone, for consumers whose verdict reads credentials only. */
+export const CREDENTIAL_RULES: readonly EgressRule[] = EGRESS_RULES.filter((r) => r.class === 'credential');
+export const IDENTIFIER_RULES: readonly EgressRule[] = EGRESS_RULES.filter((r) => r.class === 'identifier');
+
 /** Every raw-key prefix the table declares, longest first. */
 export const CREDENTIAL_PREFIXES: readonly string[] = EGRESS_RULES.flatMap((r) => r.prefixes ?? []).sort(
     (a, b) => b.length - a.length,
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index ece9e52e93..4dea6058b6 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1416,7 +1416,21 @@ concerns:
     fail_closed: false
     severity: advisory
     effect: telemetry
-    tools: [Agent, Task]
+    # SendMessage: a resume is admitted past the host's spawn cap, so the guard
+    # counts it with the spawns (road-to-a-cold-start-paid-once 1.5, 3.3). On
+    # post_tool_use a completed named spawn records which ledger ref its name
+    # addresses, because a send names the worker and the ledger keys its id.
+    tools: [Agent, Task, SendMessage]
+    needs_payload_bodies: [input, result]
+  # The host's StopFailure with error class rate_limit writes the quota_parked
+  # marker tagged host-sourced; record-only, and every other class writes
+  # nothing (road-to-a-cold-start-paid-once 4.3).
+  host-rate-marker:
+    script: src/scripts/hooks/host_rate_marker_hook.ts
+    args: []
+    fail_closed: false
+    severity: advisory
+    effect: telemetry
   # road-to-source-first-frontend Phase 3 Steps 1-2 — source-first gate, SHADOW
   # ONLY, per docs/contracts/concern-activation-policy.md. On every
   # capture-shaped tool call it appends one `source_first_gate_shadow` line
@@ -1607,7 +1621,7 @@ platforms:
     # `project_thin_rules.path_only_ids`; the receiver is
     # `agents/roadmaps/stubs/road-to-a-path-route-under-delivery.md`.
     pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, one-question-per-ask, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, spawn-guard-shadow, source-first-gate, memory-recall]
-    post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, language-mirror, design-pass, journal-record]
+    post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, language-mirror, design-pass, journal-record, spawn-guard-shadow]
     # `language-mirror` — round-5 § 6.1. `pre_compact` sets a pin-lost marker;
     # the `post_tool_use` entry above re-emits the pin exactly once while that
     # marker is set, then clears it. One extra injection per compaction EVENT —
@@ -1622,6 +1636,7 @@ platforms:
     # binary (2.1.229 — see the evidence page cited on the alias rows below).
     subagent_start:   [subagent-ledger, journal-record]
     subagent_stop:    [subagent-ledger, journal-record]
+    agent_error:      [host-rate-marker]
 
   # Cowork — the Claude desktop app's local-agent-mode runtime, built
   # on top of the Claude Code CLI. Same lifecycle vocabulary, same
@@ -1654,7 +1669,7 @@ platforms:
     stop:             [chat-history, verify-before-complete, self-repair, session-register, roadmap-progress, design-pass-stop]
     user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, git-authorization, session-canary, self-repair, session-register]
     pre_tool_use:     [block-no-verify, evidence-independence, block-kernel-rule-writes, block-plumbing-writes, block-config-weakening, block-speaking-inbox-dir, block-credential-reads, rtk-wrap, design-slop, ui-route-nudge, code-graph-context, chain-nudge, ship-diff-volume, reread-guard, spawn-guard-shadow, source-first-gate, memory-recall]
-    post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, design-pass]
+    post_tool_use:    [chat-history, roadmap-progress, context-hygiene, verify-before-complete, minimal-safe-diff, injection-scan, pr-url-reminder, push-settle, orchestration-record, telemetry-usage, mcp-usage-observation, tool-result-bytes, edit-shape, comment-discipline, design-pass, spawn-guard-shadow]
     # subagent-ledger IS bound here, unlike the two nudges above, and the
     # difference is the delivery channel rather than the platform: the nudges
     # depend on stdout reaching the model, which this trampoline discards by
@@ -1778,6 +1793,12 @@ native_event_aliases:
     # agents/evidence/investigations/subagent-lifecycle-phase0-host-pin.md.
     SubagentStart:     subagent_start
     SubagentStop:      subagent_stop
+    # StopFailure fires on an API failure and carries its class in `error`
+    # (observed on 2.1.308 with `server_error`; `rate_limit` is the host's
+    # documented value for the plan limit and has not been observed live, so a
+    # different spelling would leave the marker unwritten); lowered onto the agent-level
+    # crash slot, which no concern bound before. Claude-only: measured nowhere else.
+    StopFailure:       agent_error
   # Cowork shares Claude Code's PascalCase event vocabulary verbatim
   # (Cowork is Claude Code under the hood). Native names are duplicated
   # here rather than aliased so dispatcher logs / feedback carry the
diff --git a/src/scripts/hooks/egress_stage.ts b/src/scripts/hooks/egress_stage.ts
index 22df347f80..9652921bd5 100644
--- a/src/scripts/hooks/egress_stage.ts
+++ b/src/scripts/hooks/egress_stage.ts
@@ -404,8 +404,15 @@ function injector(
   if (mode !== "protect" && mode !== "strict") return (t) => t;
   const load = loadEngine();
   if (!load.ok) return () => `${WITHHELD_PREFIX}${ENGINE_UNAVAILABLE})]`;
-  const scope = new load.engine.TokenScope();
-  return (t) => load.engine.injectText(t, scope);
+  let scope: InstanceType<typeof load.engine.TokenScope> | undefined;
+  return (t) => {
+    try {
+      scope ??= new load.engine.TokenScope();
+      return load.engine.injectText(t, scope);
+    } catch {
+      return `${WITHHELD_PREFIX}engine-threw)]`;
+    }
+  };
 }
 
 const WITHHELD_PREFIX = "[egress: injected text withheld (";
```

`hook_manifest.json` (compiled projection; lines truncated to 300 characters):

```diff
diff --git a/src/scripts/hook_manifest.json b/src/scripts/hook_manifest.json
index 6802a095eb..37eedc9bd2 100644
--- a/src/scripts/hook_manifest.json
+++ b/src/scripts/hook_manifest.json
@@ -1 +1 @@
-{"fingerprint":"d854f99ddf6525a8c45f698b122dd21931eb29e507c0ba6ca9497737c64a82cc:107798","body_fingerprint":"589f1cae77e192582cb87ceb0e8b86a47dd67ee611388b697a00cf6f90a09a00:20467","manifest":{"schema_version":1,"concerns":{"chat-history":{"script":"src/scripts/chat_history.ts","args":["hook-dispat
\ No newline at end of file
+{"fingerprint":"08b7193fdf2e5c821c287e4869cca75073cba044364aeb1e632c86478d6ca877:109044","body_fingerprint":"4d292b77bb366df6440741112db86aad404dc85ff237387c132f49137009feef:20776","manifest":{"schema_version":1,"concerns":{"chat-history":{"script":"src/scripts/chat_history.ts","args":["hook-dispat
\ No newline at end of file
```

## Consumer code the manifest binds (not gated, shown for finding 4)

```diff
diff --git a/src/scripts/hooks/host_rate_marker_hook.ts b/src/scripts/hooks/host_rate_marker_hook.ts
new file mode 100644
index 0000000000..d1cbeee2bf
--- /dev/null
+++ b/src/scripts/hooks/host_rate_marker_hook.ts
@@ -0,0 +1,73 @@
+#!/usr/bin/env tsx
+/**
+ * host-rate-marker — the host's own `StopFailure` with error class
+ * `rate_limit` writes the `quota_parked` marker, tagged host-sourced.
+ *
+ * Bound on `agent_error`, onto which Claude's `StopFailure` is lowered. Any
+ * other failure class is not a rate signal and writes nothing. It records and
+ * never acts: nothing here sleeps, retries or relaunches, and the exit is 0 on
+ * every path.
+ */
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+
+import { writeQuotaParked } from '../_lib/quota_parked.js';
+import { resolveConsumerRoot } from './subagent_ledger_hook.js';
+import { readHookStdin } from './hook_stdin.js';
+import { EXIT_ALLOW } from './exit_codes.js';
+
+type JsonObject = { [k: string]: unknown };
+const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);
+
+/** The host vendor whose plan window a host-sourced marker describes. */
+const HOST_PROVIDER = 'anthropic';
+
+function processEnvelope(envelope: unknown, root: string): number {
+    try {
+        if (!isObject(envelope)) return EXIT_ALLOW;
+        const payload = isObject(envelope['payload']) ? envelope['payload'] : envelope;
+        if (payload['hook_event_name'] !== 'StopFailure' || payload['error'] !== 'rate_limit') return EXIT_ALLOW;
+        const session = payload['session_id'];
+        if (typeof session !== 'string' || session === '') return EXIT_ALLOW;
+        writeQuotaParked(root, session, [HOST_PROVIDER], () => new Date(), 'host');
+    } catch {
+        // A marker that cannot be written is a missed record, never a blocked stop.
+    }
+    return EXIT_ALLOW;
+}
+
+/** String-in entry for tests and the dispatcher. */
+export function run(stdinText: string, root: string): number {
+    let envelope: unknown;
+    try {
+        envelope = stdinText.trim() ? JSON.parse(stdinText) : {};
+    } catch {
+        return EXIT_ALLOW;
+    }
+    return processEnvelope(envelope, root);
+}
+
+export function main(): number {
+    const raw = readHookStdin();
+    let envelope: unknown = {};
+    try {
+        envelope = raw.trim() ? JSON.parse(raw) : {};
+    } catch {
+        return EXIT_ALLOW;
+    }
+    return processEnvelope(envelope, resolveConsumerRoot(envelope as never));
+}
+
+declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
+function _isCliEntry(): boolean {
+    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
+    if (process.argv[1] === undefined) return false;
+    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
+    try {
+        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
+    } catch {
+        return false;
+    }
+}
+if (_isCliEntry()) process.exit(main());
diff --git a/src/scripts/hooks/spawn_guard_shadow_hook.ts b/src/scripts/hooks/spawn_guard_shadow_hook.ts
index 60f7a31ab0..d0a3c0da5f 100644
--- a/src/scripts/hooks/spawn_guard_shadow_hook.ts
+++ b/src/scripts/hooks/spawn_guard_shadow_hook.ts
@@ -3,10 +3,12 @@
  * Spawn-guard — SHADOW ONLY (road-to-subagent-lifecycle-integrity Phase 3
  * Step 1, activated per `docs/contracts/concern-activation-policy.md`).
  *
- * What it does: on every `Agent` / `Task` tool call, read the open-dispatch
- * set the Phase-1 ledger maintains, and append one `spawn_guard_shadow` line
- * recording what a guard WOULD have done at several candidate thresholds.
- * It emits nothing to the model and it never blocks. Exit is always 0.
+ * What it does: on every `Agent` / `Task` call and every resume (`SendMessage`),
+ * read the open-dispatch set the Phase-1 ledger maintains, and append one
+ * `spawn_guard_shadow` line recording what a guard WOULD have done at several
+ * candidate thresholds; a spawn also records whether a warm worker would have
+ * been re-tasked instead (`reuse`). It emits nothing to the model and it never
+ * blocks. Exit is always 0.
  *
  * ── Why shadow and not warn ───────────────────────────────────────────────
  *
@@ -46,14 +48,25 @@
  * rides along as context and becomes a real measurement only when Phase 0
  * Step 4 establishes whether `agent_id` reaches a PreToolUse payload.
  *
- * PRIVACY BY CONSTRUCTION: counts and candidate verdicts only. No prompt, no
- * agent id, no tool input — the record type has no field able to hold any.
+ * PRIVACY BY CONSTRUCTION: counts, candidate verdicts, and a reuse verdict whose
+ * only free string is a worker's durable name from the register — never read
+ * from the tool input. No prompt, no message, no recipient, no agent id.
  */
 import * as fs from 'node:fs';
 import * as path from 'node:path';
 import { fileURLToPath, pathToFileURL } from 'node:url';
 
-import { appendLedgerLine, openRecordStats, resolveConsumerRoot } from './subagent_ledger_hook.js';
+import { probeHostCapabilities } from '../_lib/host_capability.js';
+import { recentHostMarker } from '../_lib/quota_parked.js';
+import { shadowReuseVerdict, type ReuseContext, type WorkerState } from '../_lib/worker_reuse.js';
+import {
+    LEDGER_DIR,
+    appendLedgerLine,
+    openRecordStats,
+    readOpenRecords,
+    refFor,
+    resolveConsumerRoot,
+} from './subagent_ledger_hook.js';
 import { readHookStdin } from './hook_stdin.js';
 import { EXIT_ALLOW } from './exit_codes.js';
 
@@ -67,6 +80,144 @@ function isObject(v: unknown): v is JsonObject {
 /** The two subagent-dispatch tool names this repo has observed across hosts. */
 export const DISPATCH_TOOL_NAMES: ReadonlySet<string> = new Set(['Agent', 'Task']);
 
+/**
+ * The tool that re-tasks a finished worker — and also messages a running one,
+ * a teammate, or the lead. The host's concurrency cap checks new spawns only
+ * and admits a resume past it, so a guard that counted spawns only would
+ * undercount exactly the runs the host does not bound. Only a send the ledger
+ * can place on a finished leg is called a resume; see {@link classifySend}.
+ */
+export const RESUME_TOOL_NAMES: ReadonlySet<string> = new Set(['SendMessage']);
+
+/**
+ * `resume` — the recipient hashes to a ledger ref that is not open and whose
+ * stop this same session recorded: a finished leg of this session is
+ * re-entered, which starts a run.
+ * `message_running` — the ref is open: the message starts no run.
+ * `message_or_resume` — the ledger cannot place the recipient in this session
+ * (a name, a teammate, the lead, another session's leg, no session id, a stop
+ * older than the scan window). Recorded, never called a resume.
+ *
+ * The verdict describes the attempted send at `pre_tool_use`; whether the host
+ * then accepts it is not visible here.
+ */
+export type SendKind = 'resume' | 'message_running' | 'message_or_resume';
+
+/** Bytes read from the end of each monthly ledger file when looking for a stop. */
+export const STOP_SCAN_BYTES = 1024 * 1024;
+
+function tailOf(file: string): string {
+    let fd: number;
+    try {
+        fd = fs.openSync(file, 'r');
+    } catch {
+        return '';
+    }
+    try {
+        const size = fs.fstatSync(fd).size;
+        const length = Math.min(size, STOP_SCAN_BYTES);
+        const buf = Buffer.alloc(length);
+        fs.readSync(fd, buf, 0, length, size - length);
+        return buf.toString('utf8');
+    } finally {
+        fs.closeSync(fd);
+    }
+}
+
+function stoppedInSession(root: string, ref: string, sessionId: string, now: Date): boolean {
+    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
+    for (const month of [now.toISOString().slice(0, 7), prev.toISOString().slice(0, 7)]) {
+        for (const line of tailOf(path.join(root, LEDGER_DIR, `${month}.jsonl`)).split('\n')) {
+            if (!line.includes(ref)) continue;
+            try {
+                const rec = JSON.parse(line) as Record<string, unknown>;
+                if (rec['event'] === 'subagent_stop' && rec['ref'] === ref && rec['session_id'] === sessionId) {
+                    return true;
+                }
+            } catch {
+                // The first line of a tail is usually cut; a torn line is no evidence.
+            }
+        }
+    }
+    return false;
+}
+
+/**
+ * The ref a named spawn of this session left in the register, read from the
+ * same bounded tails as a stop; null when this session named no such worker.
+ */
+function refForName(root: string, name: string, sessionId: string, now: Date): string | null {
+    let found: string | null = null;
+    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
+    for (const month of [prev.toISOString().slice(0, 7), now.toISOString().slice(0, 7)]) {
+        for (const line of tailOf(path.join(root, LEDGER_DIR, `${month}.jsonl`)).split('\n')) {
+            if (!line.includes('subagent_named')) continue;
+            try {
+                const rec = JSON.parse(line) as Record<string, unknown>;
+                if (rec['event'] === 'subagent_named' && rec['name'] === name && rec['session_id'] === sessionId && typeof rec['ref'] === 'string') {
+                    found = rec['ref'];
+                }
+            } catch {
+                // A torn line is no evidence.
+            }
+        }
+    }
+    return found;
+}
+
+/**
+ * Classify one send. `recipient_kind: name` is resolved through the register a
+ * named spawn of this session left; any other recipient is taken as an agent id
+ * and hashed with the ledger's own `refFor`. Neither the recipient nor its ref
+ * is written.
+ */
+export function classifySend(
+    root: string,
+    toolInput: unknown,
+    sessionId: string | null,
+    now: Date = new Date(),
+): SendKind {
+    const input = isObject(toolInput) ? toolInput : {};
+    const recipient = input['to'];
+    if (typeof recipient !== 'string' || recipient === '') return 'message_or_resume';
+    if (sessionId === null || sessionId === '') return 'message_or_resume';
+    const ref = input['recipient_kind'] === 'name' ? refForName(root, recipient, sessionId, now) : refFor(recipient);
+    if (ref === null) return 'message_or_resume';
+    if (readOpenRecords(root).has(ref)) return 'message_running';
+    return stoppedInSession(root, ref, sessionId, now) ? 'resume' : 'message_or_resume';
+}
+
+/**
+ * On a completed named spawn, record which ledger ref the name now addresses.
+ * A name is the only address that may reach disk; the agent id is hashed first.
+ */
+export function recordNamedSpawn(root: string, payload: JsonObject, sessionId: string | null, nowIso: string): void {
+    const input = isObject(payload['tool_input']) ? payload['tool_input'] : {};
+    const result = isObject(payload['tool_response']) ? payload['tool_response'] : {};
+    const name = input['name'];
+    const agentId = result['agentId'];
+    if (typeof name !== 'string' || name === '' || typeof agentId !== 'string' || agentId === '') return;
+    if (sessionId === null) return;
+    appendLedgerLine(root, nowIso, { event: 'subagent_named', ts: nowIso, ref: refFor(agentId), name, session_id: sessionId });
+}
+
+/**
+ * Platforms where `pre_tool_use` was observed firing on the resume tool, with a
+ * deny honoured there. Elsewhere the line says the resume half is unobserved.
+ */
+export const RESUME_ADMISSION_OBSERVED: ReadonlySet<string> = new Set(['claude']);
+
+/**
+ * Inputs to the reuse verdict. Production passes none: `host_resume` comes
+ * from the host row, and no worker register is recorded yet, which the verdict
+ * names as `worker_register_unrecorded` rather than reading as empty.
+ */
+export interface ShadowDeps {
+    host_resume?: boolean;
+    workers?: readonly WorkerState[] | null;
+    context?: ReuseContext | null;
+}
+
 /** One candidate guard configuration under shadow evaluation. */
 export interface Candidate {
     readonly label: string;
@@ -136,12 +287,34 @@ function extractToolName(payload: JsonObject): string | null {
     return typeof v === 'string' && v ? v : null;
 }
 
-export function processEnvelope(envelope: JsonValue, consumerRoot: string): number {
+export function processEnvelope(envelope: JsonValue, consumerRoot: string, deps: ShadowDeps = {}): number {
     try {
         if (!isObject(envelope)) return EXIT_ALLOW;
         const payload = unwrapPayload(envelope);
         const toolName = extractToolName(payload);
-        if (toolName === null || !DISPATCH_TOOL_NAMES.has(toolName)) return EXIT_ALLOW;
+        if (toolName === null) return EXIT_ALLOW;
+        if (envelope['event'] === 'post_tool_use' || payload['hook_event_name'] === 'PostToolUse') {
+            if (DISPATCH_TOOL_NAMES.has(toolName)) {
+                const sid = payload['session_id'] ?? envelope['session_id'];
+                recordNamedSpawn(consumerRoot, payload, typeof sid === 'string' ? sid : null, new Date().toISOString());
+            }
+            return EXIT_ALLOW;
+        }
+        const isResume = RESUME_TOOL_NAMES.has(toolName);
+        if (!isResume && !DISPATCH_TOOL_NAMES.has(toolName)) return EXIT_ALLOW;
+        const platform = typeof envelope['platform'] === 'string' ? envelope['platform'] : null;
+        const toolInput = isObject(payload['tool_input']) ? payload['tool_input'] : {};
+        const sessionRaw = payload['session_id'] ?? envelope['session_id'];
+        const sessionId = typeof sessionRaw === 'string' ? sessionRaw : null;
+        const sendKind: SendKind | null = isResume ? classifySend(consumerRoot, toolInput, sessionId) : null;
+        // Only the verdict's label and reason codes reach disk — never the tool input.
+        const reuse = isResume
+            ? null
+            : shadowReuseVerdict({
+                  host_resume: deps.host_resume ?? probeHostCapabilities(platform).worker_resume,
+                  workers: deps.workers ?? null,
+                  context: deps.context ?? null,
+              });
 
         const stats = openRecordStats(consumerRoot);
         // Pre-spawn there is no agent id to resolve a parent from; the deepest
@@ -167,7 +340,16 @@ export function processEnvelope(envelope: JsonValue, consumerRoot: string): numb
             // one the ledger already fixed for itself.
             ledger_present: stats.ledger_present,
             stale_open_excluded: stats.stale_excluded,
-            candidates: verdicts.map((v) => ({ label: v.label, would_deny: v.would_deny, on: v.on })),
+            // A message to a running worker starts no run, so it is not set
+            // against a threshold that counts runs.
+            ...(sendKind === 'message_running'
+                ? {}
+                : { candidates: verdicts.map((v) => ({ label: v.label, would_deny: v.would_deny, on: v.on })) }),
+            dispatch_kind: sendKind ?? 'spawn',
+            resume_admission: platform !== null && RESUME_ADMISSION_OBSERVED.has(platform) ? 'counted' : 'unobserved',
+            ...(reuse === null ? {} : { reuse }),
+            // A recent host-sourced rate marker: a new spawn would have waited.
+            ...(isResume ? {} : { rate_window: recentHostMarker(consumerRoot) ? 'would_wait' : 'clear' }),
             // Shadow posture is a property of this file, not of a setting —
             // there is no code path here that can deny.
             posture: 'shadow',
```
