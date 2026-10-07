<!-- evidence-type: analysis -->

# Ratification prompt, round 4 — header derived from seats

The prompt package sent verbatim to the council seats in round 4 for step 3.1 of
`road-to-release-evidence-that-reproduces`. Committed so the verdict can be
checked against what was asked. Rounds 1-3 are the `…-prompt.md`,
`…-prompt-r2.md` and `…-prompt-r3.md` files beside it.

## Question

You are reviewing a diff to the ratification mechanism of this repository.
`src/scripts/_lib/ratification_artifact.ts` is the reader the CI gate
`check_kernel_edit_ratified` uses; any edit to it requires a ratification
artifact. The complete diff against the base is below; read it, not a summary.

Round 3 (one seat answered; the other seat's transport failed) raised: a seat
repeated under a quoted key spelling (`"openai":`) might hide a refusing seat if
the parser normalised quotes. The author reports that this repository's
frontmatter parser keeps the quotes in the key (so such a key fails the
provider-id grammar), and has added key normalisation to the duplicate scan plus
tests. Check that against the diff yourself. The two named historical artifacts
are still not edited.

Please answer, each seat independently:

1. Defects: list any correctness, security or authority defects in the diff,
   each with file and line, including any earlier point you judge still open.
   Say "none found" if none.
2. Classification: does this diff expand, narrow or leave unchanged the
   authority of an agent under the ratification mechanism? Give your final
   verdict as exactly one of `ratified`, `confirmed-non-expanding`, `refused`,
   `non-convergent`.
3. For each of the three release-review findings listed after the diff, state
   which terminal disposition the evidence supports — `fixed`, `false_positive`,
   `accepted_risk`, or `still_open` (the finding is true and not closed) — and
   why. `fixed` requires that this diff closes what the finding describes.

## Diff

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index ad604a9ab..42893c7e2 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -45,6 +45,21 @@ could follow and everybody broke.
 | `verdict` | `ratified` · `confirmed-non-expanding` · `refused` · `non-convergent` | a closed vocabulary; an open one always reads as approval to a grep |
 | `effective_after` | `merge`, or an ISO-8601 instant with a timezone | an authority-expanding change is inert until this passes |
 
+A seventh field, `seats:`, is required: a map from provider id to that seat's
+**final** verdict (the four above, or `no-final-verdict` for a seat that closed
+or was absent at the last round). `providers` and `verdict` are not
+free-written: `./scripts-run src/scripts/ratification_header --seat
+<provider>=<verdict> …` prints all three, and the reader requires the recorded
+`providers` (in seat order) and `verdict` to equal the derived ones. It names
+the two overclaims that motivated the field — a passing verdict over a refusing
+or non-convergent seat (`seat-dissent`), a provider that gave no final verdict
+(`providers-exceed-seats`) — and reports any other mismatch as
+`header-not-derived`. A `seats:` key that is empty, not a map, repeats a seat
+or uses a key outside `^[a-z0-9][a-z0-9._-]*$` is refused, never read as
+absent; a missing `seats:` is `no-seats`. The gate reads only the artifacts in
+the diff under review, so an artifact merged before the field existed is never
+re-read and is not migrated.
+
 `ratified` and `confirmed-non-expanding` let a diff land; `refused` and
 `non-convergent` do not. The second passing verdict exists because the gate
 demands an artifact for **every** kernel and governance-hook diff, a typo fix
diff --git a/src/scripts/_lib/ratification_artifact.ts b/src/scripts/_lib/ratification_artifact.ts
index c962f1e23..43dd23e36 100644
--- a/src/scripts/_lib/ratification_artifact.ts
+++ b/src/scripts/_lib/ratification_artifact.ts
@@ -96,10 +96,227 @@ export interface RatificationProblem {
         | 'no-providers'
         | 'diversity-required'
         | 'diversity-unverifiable'
-        | 'bad-effective-after';
+        | 'bad-effective-after'
+        | 'no-seats'
+        | 'malformed-seats'
+        | 'bad-seat-provider'
+        | 'unknown-seat-verdict'
+        | 'seat-dissent'
+        | 'providers-exceed-seats'
+        | 'header-not-derived';
     message: string;
 }
 
+/** A seat that closed, timed out or was absent at the last round gave no final verdict. */
+export const SEAT_NO_FINAL_VERDICT = 'no-final-verdict';
+export type SeatVerdict = RatificationVerdict | typeof SEAT_NO_FINAL_VERDICT;
+/** Every value a seat's final verdict may take — shared by the writer and the reader. */
+export const SEAT_VERDICTS: readonly string[] = [...RATIFICATION_VERDICTS, SEAT_NO_FINAL_VERDICT];
+
+/**
+ * A provider id as a seat key: lower-case, no whitespace and no YAML
+ * metacharacter, so a rendered header cannot be split or extended by a name
+ * and two spellings of one provider cannot collide after normalisation.
+ */
+export const SEAT_PROVIDER_RE = /^[a-z0-9][a-z0-9._-]*$/u;
+
+export type SeatsReading =
+    | { kind: 'absent' }
+    | { kind: 'invalid'; problems: RatificationProblem[] }
+    | { kind: 'present'; seats: Map<string, SeatVerdict> };
+
+/**
+ * The `seats:` map — provider id to that seat's FINAL verdict — in source
+ * order, which is the order `providers` is derived in.
+ *
+ * Absent and present-but-unusable are reported apart: a missing key and a
+ * `seats:` key that is empty, a scalar, a list, or carries a bad id or verdict
+ * are both refusals, with different codes.
+ */
+export function readSeats(fm: AdrFrontmatter, text = ''): SeatsReading {
+    const duplicates = duplicateSeatKeys(text);
+    if (duplicates.length > 0) {
+        return {
+            kind: 'invalid',
+            problems: [
+                {
+                    code: 'bad-seat-provider',
+                    message: `seat \`${duplicates.join('`, `')}\` is recorded more than once — the parser keeps only the last`,
+                },
+            ],
+        };
+    }
+    const hasScalar = Object.prototype.hasOwnProperty.call(fm.scalars, 'seats');
+    const node = fm.nested['seats'];
+    if (node === undefined && !hasScalar) {
+        return { kind: 'absent' };
+    }
+    if (node === undefined || typeof node === 'string' || Array.isArray(node)) {
+        return {
+            kind: 'invalid',
+            problems: [{ code: 'malformed-seats', message: '`seats:` is present but is not a provider-to-verdict map' }],
+        };
+    }
+    const problems: RatificationProblem[] = [];
+    const seats = new Map<string, SeatVerdict>();
+    for (const [provider, verdict] of Object.entries(node)) {
+        if (!SEAT_PROVIDER_RE.test(provider)) {
+            problems.push({
+                code: 'bad-seat-provider',
+                message: `seat key \`${provider}\` is not a provider id (${String(SEAT_PROVIDER_RE)})`,
+            });
+            continue;
+        }
+        if (typeof verdict !== 'string' || !SEAT_VERDICTS.includes(verdict.trim())) {
+            problems.push({
+                code: 'unknown-seat-verdict',
+                message: `seat \`${provider}\` records \`${String(verdict)}\`, not one of ${SEAT_VERDICTS.join(', ')}`,
+            });
+            continue;
+        }
+        seats.set(provider, verdict.trim() as SeatVerdict);
+    }
+    if (problems.length === 0 && seats.size === 0) {
+        problems.push({ code: 'malformed-seats', message: '`seats:` is present and empty' });
+    }
+    return problems.length > 0 ? { kind: 'invalid', problems } : { kind: 'present', seats };
+}
+
+/** Keys repeated inside the frontmatter `seats:` block, read from the raw text. */
+function duplicateSeatKeys(text: string): string[] {
+    if (!text.startsWith('---\n')) return [];
+    const end = text.indexOf('\n---\n', 4);
+    const lines = text.slice(4, end === -1 ? undefined : end).split('\n');
+    const start = lines.findIndex((l) => /^seats:\s*$/u.test(l));
+    if (start === -1) return [];
+    const seen = new Set<string>();
+    const dup = new Set<string>();
+    for (const line of lines.slice(start + 1)) {
+        if (!/^\s/u.test(line)) break;
+        // Compared by the identity a YAML parser would give the key, so a quoted
+        // spelling cannot hide a second entry for the same seat.
+        const key = line
+            .slice(0, line.indexOf(':') === -1 ? undefined : line.indexOf(':'))
+            .trim()
+            .replace(/^(["'])(.*)\1$/u, '$2')
+            .trim();
+        if (key === '') continue;
+        if (seen.has(key)) dup.add(key);
+        seen.add(key);
+    }
+    return [...dup];
+}
+
+/**
+ * The header a set of seat verdicts supports, and no more.
+ *
+ * `providers` is every seat that gave a final verdict — a closed seat is not a
+ * provider the verdict came from. Any refusing seat makes the verdict `refused`,
+ * any non-convergent one `non-convergent`; only when every final seat passed is
+ * the verdict passing, and then `ratified` if any seat said so. No final seat at
+ * all is `non-convergent`: a review that ended without a verdict did not pass.
+ */
+export function deriveRatificationHeader(
+    seats: ReadonlyMap<string, SeatVerdict> | Readonly<Record<string, SeatVerdict>>,
+): { providers: string[]; verdict: RatificationVerdict } {
+    const entries = seats instanceof Map ? [...seats.entries()] : Object.entries(seats);
+    const final = entries.filter(([, v]) => v !== SEAT_NO_FINAL_VERDICT) as [string, RatificationVerdict][];
+    const verdicts = final.map(([, v]) => v);
+    let verdict: RatificationVerdict;
+    if (verdicts.includes('refused')) {
+        verdict = 'refused';
+    } else if (final.length === 0 || verdicts.includes('non-convergent')) {
+        verdict = 'non-convergent';
+    } else {
+        verdict = verdicts.includes('ratified') ? 'ratified' : 'confirmed-non-expanding';
+    }
+    return { providers: final.map(([p]) => p), verdict };
+}
+
+/**
+ * The `providers:`, `verdict:` and `seats:` frontmatter lines, derived — never
+ * typed. Throws on a provider id outside {@link SEAT_PROVIDER_RE}: a name that
+ * could carry YAML syntax is refused rather than escaped.
+ */
+export function renderRatificationHeader(
+    seats: ReadonlyMap<string, SeatVerdict> | Readonly<Record<string, SeatVerdict>>,
+): string {
+    const entries = seats instanceof Map ? [...seats.entries()] : Object.entries(seats);
+    for (const [p, v] of entries) {
+        if (!SEAT_PROVIDER_RE.test(p)) throw new Error(`not a provider id: ${JSON.stringify(p)}`);
+        if (!SEAT_VERDICTS.includes(v)) throw new Error(`not a seat verdict: ${JSON.stringify(v)}`);
+    }
+    const { providers, verdict } = deriveRatificationHeader(seats);
+    return [
+        `providers: [${providers.join(', ')}]`,
+        `verdict: ${verdict}`,
+        'seats:',
+        ...entries.map(([p, v]) => `  ${p}: ${v}`),
+    ].join('\n');
+}
+
+/**
+ * The header claims the seats do not support.
+ *
+ * `seats:` is required. Optional, it left `providers` and `verdict` free-written
+ * for every author who omitted it, which is the defect it exists to close; the
+ * round-2 ratification review refused that shape. The gate reads only the
+ * artifacts in the diff under review, so an artifact merged before the field
+ * existed is never re-read and needs no migration to stay valid.
+ *
+ * The recorded header must EQUAL the derived one; the two named overclaims get
+ * their own codes so a reader sees which one it was.
+ */
+function seatProblems(reading: SeatsReading, providers: readonly string[], verdict: string | null): RatificationProblem[] {
+    if (reading.kind === 'absent') {
+        return [
+            {
+                code: 'no-seats',
+                message:
+                    'missing `seats:` — `providers` and `verdict` are derived from the per-seat final ' +
+                    'verdicts, never typed (print all three with `ratification_header`)',
+            },
+        ];
+    }
+    if (reading.kind === 'invalid') return reading.problems;
+    const seats = reading.seats;
+    const problems: RatificationProblem[] = [];
+    if (verdict !== null && PASSING_VERDICTS.has(verdict)) {
+        const dissent = [...seats].filter(([, v]) => v === 'refused' || v === 'non-convergent');
+        if (dissent.length > 0) {
+            problems.push({
+                code: 'seat-dissent',
+                message:
+                    `verdict \`${verdict}\` while ${dissent.map(([p, v]) => `${p} was \`${v}\``).join(', ')} ` +
+                    'at the final round — a header cannot say more than its seats said',
+            });
+        }
+    }
+    const derived = deriveRatificationHeader(seats);
+    const extra = providers.filter((p) => !derived.providers.includes(p));
+    if (extra.length > 0) {
+        problems.push({
+            code: 'providers-exceed-seats',
+            message:
+                `providers names ${extra.join(', ')}, which gave no final verdict ` +
+                `(${String(derived.providers.length)} seat(s) did) — diversity is counted over seats that answered`,
+        });
+    }
+    if (
+        problems.length === 0 &&
+        (verdict !== derived.verdict || providers.join('\u0000') !== derived.providers.join('\u0000'))
+    ) {
+        problems.push({
+            code: 'header-not-derived',
+            message:
+                `recorded providers [${providers.join(', ')}] / verdict \`${String(verdict)}\` differ from the ` +
+                `header the seats derive: [${derived.providers.join(', ')}] / \`${derived.verdict}\` ` +
+                '(print it with `ratification_header`)',
+        });
+    }
+    return problems;
+}
+
 export interface RatificationReading {
     artifact: RatificationArtifact | null;
     problems: RatificationProblem[];
@@ -208,6 +425,8 @@ export function readRatification(
         }
     }
 
+    problems.push(...seatProblems(readSeats(fm, text), providers, verdict));
+
     // Diversity, against the REQUIRED count.
     //
     // Round 1 refused the previous shape: the count came from the user-global
diff --git a/src/scripts/ratification_header.ts b/src/scripts/ratification_header.ts
new file mode 100644
index 000000000..9342a7c7a
--- /dev/null
+++ b/src/scripts/ratification_header.ts
@@ -0,0 +1,77 @@
+#!/usr/bin/env tsx
+/**
+ * ratification_header — print a ratification artifact's `providers:`,
+ * `verdict:` and `seats:` frontmatter lines, derived from per-seat final
+ * verdicts.
+ *
+ * The two header fields used to be typed by the author, and three findings in
+ * one release were the header saying more than the seats had: `ratified` over a
+ * non-convergent seat, two providers over one closing seat. This is the writer
+ * side of the fix; `readRatification` refuses the same shapes on the reader
+ * side whenever `seats:` is recorded.
+ *
+ * Usage: ratification_header --seat <provider>=<final-verdict> [--seat …]
+ *   final-verdict: ratified | confirmed-non-expanding | refused | non-convergent
+ *                  | no-final-verdict (the seat closed or was absent at the end)
+ *
+ * Exit codes: 0 = header printed · 2 = usage error.
+ */
+
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+
+import {
+    SEAT_PROVIDER_RE,
+    SEAT_VERDICTS,
+    renderRatificationHeader,
+    type SeatVerdict,
+} from './_lib/ratification_artifact.js';
+
+export function main(argv: readonly string[] = process.argv.slice(2)): number {
+    const seats = new Map<string, SeatVerdict>();
+    for (let i = 0; i < argv.length; i += 1) {
+        if (argv[i] !== '--seat') {
+            process.stderr.write(`error: unknown argument ${String(argv[i])}\n`);
+            return 2;
+        }
+        const raw = argv[i + 1] ?? '';
+        i += 1;
+        const eq = raw.indexOf('=');
+        const provider = raw.slice(0, eq);
+        const verdict = raw.slice(eq + 1);
+        if (eq <= 0 || !SEAT_PROVIDER_RE.test(provider) || !SEAT_VERDICTS.includes(verdict)) {
+            process.stderr.write(
+                `error: --seat needs <provider id ${String(SEAT_PROVIDER_RE)}>=<one of ` +
+                    `${SEAT_VERDICTS.join('|')}>, got \`${raw}\`\n`,
+            );
+            return 2;
+        }
+        if (seats.has(provider)) {
+            process.stderr.write(`error: seat \`${provider}\` given twice\n`);
+            return 2;
+        }
+        seats.set(provider, verdict as SeatVerdict);
+    }
+    if (seats.size === 0) {
+        process.stderr.write('error: at least one --seat is required\n');
+        return 2;
+    }
+    process.stdout.write(`${renderRatificationHeader(seats)}\n`);
+    return 0;
+}
+
+function _isCliEntry(): boolean {
+    if (process.argv[1] === undefined) return false;
+    const here = fileURLToPath(import.meta.url);
+    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
+    try {
+        return fs.realpathSync(here) === fs.realpathSync(path.resolve(process.argv[1]));
+    } catch {
+        return false;
+    }
+}
+
+if (_isCliEntry()) {
+    process.exit(main());
+}
diff --git a/tests/scripts/check_kernel_edit_ratified.test.ts b/tests/scripts/check_kernel_edit_ratified.test.ts
index f84ab2e5a..e4e133bf2 100644
--- a/tests/scripts/check_kernel_edit_ratified.test.ts
+++ b/tests/scripts/check_kernel_edit_ratified.test.ts
@@ -41,6 +41,11 @@ function writeArtifact(name: string, fields: Record<string, string>, providers:
     for (const p of providers) {
         lines.push(`  - ${p}`);
     }
+    // Each seat records the artifact's verdict, so the header is the one the seats derive.
+    lines.push('seats:');
+    for (const p of providers) {
+        lines.push(`  ${p}: ${fields['verdict'] ?? ''}`);
+    }
     lines.push('---', '', '<!-- evidence-type: ratification -->', '', 'Review body.', '');
     fs.writeFileSync(abs, lines.join('\n'));
     return rel;
diff --git a/tests/scripts/ratification_artifact.test.ts b/tests/scripts/ratification_artifact.test.ts
index 06d5293a3..6e32ab28d 100644
--- a/tests/scripts/ratification_artifact.test.ts
+++ b/tests/scripts/ratification_artifact.test.ts
@@ -36,6 +36,12 @@ function artifact(overrides: Record<string, string> = {}, providers = ['anthropi
     for (const p of providers) {
         lines.push(`  - ${p}`);
     }
+    // Every seat records the artifact's own verdict, so the header is the one
+    // the seats derive and these cases exercise the other checks.
+    lines.push('seats:');
+    for (const p of providers) {
+        lines.push(`  ${p}: ${fields['verdict'] ?? ''}`);
+    }
     lines.push('---', '', '# Ratification', '', 'Body.', '');
     return lines.join('\n');
 }
@@ -136,6 +142,9 @@ describe('readRatification', () => {
             'reviewed_by: openai/gpt-5',
             'providers: [anthropic, openai]',
             'verdict: ratified',
+            'seats:',
+            '  anthropic: ratified',
+            '  openai: ratified',
             'effective_after: merge',
             '---',
             '',
diff --git a/tests/scripts/ratification_header_from_seats.test.ts b/tests/scripts/ratification_header_from_seats.test.ts
new file mode 100644
index 000000000..f97c7eb84
--- /dev/null
+++ b/tests/scripts/ratification_header_from_seats.test.ts
@@ -0,0 +1,169 @@
+// A ratification header must not say more than its seats said: `providers:`
+// and `verdict:` are derived from per-seat final verdicts, and the reader
+// refuses a recorded header that contradicts the recorded seats.
+import { describe, expect, it, vi } from 'vitest';
+
+import {
+    deriveRatificationHeader,
+    isRatified,
+    readRatification,
+    renderRatificationHeader,
+    type SeatVerdict,
+} from '../../src/scripts/_lib/ratification_artifact.js';
+import { main as headerMain } from '../../src/scripts/ratification_header.js';
+
+function artifact(header: string): string {
+    return [
+        '---',
+        'proposed_by: session-a',
+        'implemented_by: session-a',
+        'reviewed_by: council/anthropic+openai',
+        header,
+        'effective_after: merge',
+        '---',
+        '',
+        '<!-- evidence-type: ratification -->',
+        '',
+    ].join('\n');
+}
+
+const codes = (text: string): string[] => readRatification(text, 2).problems.map((p) => p.code);
+
+describe('deriveRatificationHeader', () => {
+    const cases: [Record<string, SeatVerdict>, string[], string][] = [
+        [{ anthropic: 'ratified', openai: 'ratified' }, ['anthropic', 'openai'], 'ratified'],
+        [{ anthropic: 'ratified', openai: 'confirmed-non-expanding' }, ['anthropic', 'openai'], 'ratified'],
+        [{ anthropic: 'confirmed-non-expanding', openai: 'confirmed-non-expanding' }, ['anthropic', 'openai'], 'confirmed-non-expanding'],
+        [{ anthropic: 'non-convergent', openai: 'ratified' }, ['anthropic', 'openai'], 'non-convergent'],
+        [{ anthropic: 'refused', openai: 'non-convergent' }, ['anthropic', 'openai'], 'refused'],
+        [{ anthropic: 'confirmed-non-expanding', openai: 'no-final-verdict' }, ['anthropic'], 'confirmed-non-expanding'],
+        [{ anthropic: 'no-final-verdict' }, [], 'non-convergent'],
+    ];
+    for (const [seats, providers, verdict] of cases) {
+        it(`${JSON.stringify(seats)} -> ${verdict} over [${providers.join(', ')}]`, () => {
+            expect(deriveRatificationHeader(seats)).toEqual({ providers, verdict });
+        });
+    }
+});
+
+describe('the reader checks a recorded header against its seats', () => {
+    it('accepts a header rendered from two ratifying seats', () => {
+        const text = artifact(renderRatificationHeader({ anthropic: 'ratified', openai: 'ratified' }));
+        const r = readRatification(text, 2);
+        expect(r.problems).toEqual([]);
+        expect(isRatified(r)).toBe(true);
+    });
+
+    it('flags `ratified` written over a non-convergent seat', () => {
+        const text = artifact(
+            ['providers: [anthropic, openai]', 'verdict: ratified', 'seats:', '  anthropic: non-convergent', '  openai: ratified'].join('\n'),
+        );
+        expect(codes(text)).toContain('seat-dissent');
+        expect(isRatified(readRatification(text, 2))).toBe(false);
+    });
+
+    it('flags `confirmed-non-expanding` written over a refusing seat', () => {
+        const text = artifact(
+            ['providers: [anthropic, openai]', 'verdict: confirmed-non-expanding', 'seats:', '  anthropic: confirmed-non-expanding', '  openai: refused'].join('\n'),
+        );
+        expect(codes(text)).toContain('seat-dissent');
+    });
+
+    it('flags two providers where one seat closed without a final verdict', () => {
+        const text = artifact(
+            ['providers: [anthropic, openai]', 'verdict: confirmed-non-expanding', 'seats:', '  anthropic: confirmed-non-expanding', '  openai: no-final-verdict'].join('\n'),
+        );
+        expect(codes(text)).toContain('providers-exceed-seats');
+    });
+
+    it('lets the derived single-seat header reach the diversity rule instead of passing it', () => {
+        const text = artifact(renderRatificationHeader({ anthropic: 'ratified', openai: 'no-final-verdict' }));
+        expect(codes(text)).toEqual(['diversity-required']);
+    });
+
+    it('flags an unknown seat verdict', () => {
+        const text = artifact(['providers: [anthropic, openai]', 'verdict: ratified', 'seats:', '  anthropic: ratified', '  openai: approved'].join('\n'));
+        expect(codes(text)).toContain('unknown-seat-verdict');
+    });
+
+    it('flags a passing header that differs from the derived one', () => {
+        const text = artifact(
+            ['providers: [anthropic, openai]', 'verdict: ratified', 'seats:', '  anthropic: confirmed-non-expanding', '  openai: confirmed-non-expanding'].join('\n'),
+        );
+        expect(codes(text)).toEqual(['header-not-derived']);
+    });
+
+    it('flags a final seat left out of providers', () => {
+        const text = artifact(['providers: [anthropic]', 'verdict: ratified', 'seats:', '  anthropic: ratified', '  openai: ratified'].join('\n'));
+        expect(codes(text)).toContain('header-not-derived');
+    });
+
+    it('refuses a present but empty or non-map `seats:` rather than reading it as absent', () => {
+        expect(codes(artifact(['providers: [anthropic, openai]', 'verdict: ratified', 'seats: []'].join('\n')))).toContain('malformed-seats');
+        expect(codes(artifact(['providers: [anthropic, openai]', 'verdict: ratified', 'seats: anthropic'].join('\n')))).toContain('malformed-seats');
+    });
+
+    it('refuses a seat key that is not a provider id', () => {
+        const text = artifact(['providers: [anthropic, openai]', 'verdict: ratified', 'seats:', '  Open AI: ratified', '  anthropic: ratified'].join('\n'));
+        expect(codes(text)).toContain('bad-seat-provider');
+    });
+
+    it('refuses a seat recorded twice', () => {
+        const text = artifact(['providers: [anthropic, openai]', 'verdict: ratified', 'seats:', '  openai: refused', '  anthropic: ratified', '  openai: ratified'].join('\n'));
+        expect(codes(text)).toContain('bad-seat-provider');
+    });
+
+    for (const spelling of ['"openai"', "'openai'", ' "openai" ']) {
+        it(`refuses a seat repeated under the quoted spelling ${spelling}`, () => {
+            const text = artifact(
+                ['providers: [anthropic, openai]', 'verdict: ratified', 'seats:', '  openai: refused', '  anthropic: ratified', `  ${spelling}: ratified`].join('\n'),
+            );
+            const r = readRatification(text, 2);
+            expect(r.problems.map((p) => p.code)).toEqual(['bad-seat-provider']);
+            expect(r.problems[0]?.message).toContain('more than once');
+            expect(isRatified(r)).toBe(false);
+        });
+    }
+
+    it('the writer refuses a provider id that could carry YAML syntax', () => {
+        expect(() => renderRatificationHeader({ 'openai]\nverdict: ratified': 'refused' } as Record<string, SeatVerdict>)).toThrow(
+            /not a provider id/u,
+        );
+    });
+
+    it('refuses an artifact without `seats:` — the header is never free-written', () => {
+        const text = artifact(['providers: [anthropic, openai]', 'verdict: ratified'].join('\n'));
+        expect(codes(text)).toEqual(['no-seats']);
+        expect(isRatified(readRatification(text, 2))).toBe(false);
+    });
+
+    it('refuses an explicit `seats: null`', () => {
+        expect(codes(artifact(['providers: [anthropic, openai]', 'verdict: ratified', 'seats: null'].join('\n')))).toContain(
+            'malformed-seats',
+        );
+    });
+});
+
+describe('ratification_header CLI', () => {
+    it('prints the derived lines and refuses a malformed seat', () => {
+        let out = '';
+        const w = vi.spyOn(process.stdout, 'write').mockImplementation((s: string | Uint8Array) => {
+            out += String(s);
+            return true;
+        });
+        const e = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
+        try {
+            expect(headerMain(['--seat', 'anthropic=non-convergent', '--seat', 'openai=ratified'])).toBe(0);
+            expect(out).toBe(
+                'providers: [anthropic, openai]\nverdict: non-convergent\nseats:\n  anthropic: non-convergent\n  openai: ratified\n',
+            );
+            expect(headerMain(['--seat', 'openai=approved'])).toBe(2);
+            expect(headerMain(['--seat', '   =ratified'])).toBe(2);
+            expect(headerMain(['--seat', 'open]ai=ratified'])).toBe(2);
+            expect(headerMain([])).toBe(2);
+        } finally {
+            w.mockRestore();
+            e.mockRestore();
+        }
+    });
+});
```

## Findings for question 3

- `2c9959f7262d` (medium, claim), file
  `agents/evidence/ratifications/drain-failed-command-recorder.md`: "Recorded
  verdict `ratified` while one seat's final verdict was non-convergent." The
  frontmatter says `verdict: ratified`; its own table shows the final pass as
  anthropic `non-convergent` and openai `ratified`, and lists both providers.
- `13568e8fe68a` (medium, claim), file
  `agents/evidence/ratifications/fix-dependabot-prs-can-reach-their-required-check.md`:
  "lists two providers but the closing verdict came from one seat"; the quorum
  line read `1/2 present` after the final round, and the degraded quorum is in
  the body but not in the machine-read header.
- `541a64c5b619` (medium, claim), file
  `agents/evidence/analysis/blocking-severities-ratification-prompt.md`:
  "Governance ratification rests on council seats that read an author-written
  description, not the diff." The seats were shown a description written by the
  change's author, with the author's recommendation in the prompt.

The diff does not edit any of the three named files.
