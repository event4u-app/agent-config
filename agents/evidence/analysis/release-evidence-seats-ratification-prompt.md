<!-- evidence-type: analysis -->

# Ratification prompt — header derived from seats

This file is the prompt package sent verbatim to the council seats for step 3.1
of `road-to-release-evidence-that-reproduces`. It is committed so the verdict can
be checked against what was asked.

## Question

You are reviewing a diff to the ratification mechanism of this repository.
`src/scripts/_lib/ratification_artifact.ts` is the reader the CI gate
`check_kernel_edit_ratified` uses; any edit to it requires a ratification
artifact. The complete diff is below; read it, not a summary of it.

Context you can check in the diff: a ratification artifact's `providers:` and
`verdict:` frontmatter fields were free-written by the author. The diff adds an
optional `seats:` map (provider to that seat's final verdict), a writer
(`ratification_header`) that derives `providers` and `verdict` from it, and
reader checks that refuse a recorded header contradicting recorded seats.
Artifacts without `seats:` are read as before.

Please answer, each seat independently:

1. Defects: list any correctness, security or authority defects you find in the
   diff, each with file and line. Say "none found" if none.
2. Classification: does this diff expand, narrow or leave unchanged the
   authority of an agent under the ratification mechanism? Give your final
   verdict as exactly one of `ratified`, `confirmed-non-expanding`, `refused`,
   `non-convergent`.
3. Three release-review findings about ratification headers are listed after
   the diff. For each, state which terminal disposition the evidence supports
   (`fixed`, `false_positive` or `accepted_risk`) and why. `fixed` requires that
   this diff actually closes what the finding describes.

## Diff

```diff
diff --git a/docs/contracts/ratification-artifact.md b/docs/contracts/ratification-artifact.md
index ad604a9ab..4fbc5ba75 100644
--- a/docs/contracts/ratification-artifact.md
+++ b/docs/contracts/ratification-artifact.md
@@ -45,6 +45,15 @@ could follow and everybody broke.
 | `verdict` | `ratified` · `confirmed-non-expanding` · `refused` · `non-convergent` | a closed vocabulary; an open one always reads as approval to a grep |
 | `effective_after` | `merge`, or an ISO-8601 instant with a timezone | an authority-expanding change is inert until this passes |
 
+A seventh field, `seats:`, is a map from provider id to that seat's **final**
+verdict (the four above, or `no-final-verdict` for a seat that closed or was
+absent at the last round). When it is recorded, `providers` and `verdict` are
+not free-written: `./scripts-run src/scripts/ratification_header --seat
+<provider>=<verdict> …` prints all three, and the reader refuses a passing
+verdict over a refusing or non-convergent seat (`seat-dissent`) and a provider
+that gave no final verdict (`providers-exceed-seats`). An artifact without
+`seats:` is read as before.
+
 `ratified` and `confirmed-non-expanding` let a diff land; `refused` and
 `non-convergent` do not. The second passing verdict exists because the gate
 demands an artifact for **every** kernel and governance-hook diff, a typo fix
diff --git a/src/scripts/_lib/ratification_artifact.ts b/src/scripts/_lib/ratification_artifact.ts
index c962f1e23..34c596b0f 100644
--- a/src/scripts/_lib/ratification_artifact.ts
+++ b/src/scripts/_lib/ratification_artifact.ts
@@ -96,10 +96,118 @@ export interface RatificationProblem {
         | 'no-providers'
         | 'diversity-required'
         | 'diversity-unverifiable'
-        | 'bad-effective-after';
+        | 'bad-effective-after'
+        | 'unknown-seat-verdict'
+        | 'seat-dissent'
+        | 'providers-exceed-seats';
     message: string;
 }
 
+/** A seat that closed, timed out or was absent at the last round gave no final verdict. */
+export const SEAT_NO_FINAL_VERDICT = 'no-final-verdict';
+export type SeatVerdict = RatificationVerdict | typeof SEAT_NO_FINAL_VERDICT;
+const SEAT_VERDICTS: readonly string[] = [...RATIFICATION_VERDICTS, SEAT_NO_FINAL_VERDICT];
+
+/**
+ * The `seats:` map — provider id to that seat's FINAL verdict — or `null` when
+ * the artifact records none. Source order is kept; it is the order `providers`
+ * is derived in.
+ */
+export function readSeats(fm: AdrFrontmatter): Map<string, string> | null {
+    const node = fm.nested['seats'];
+    if (node === undefined || typeof node === 'string' || Array.isArray(node)) {
+        return null;
+    }
+    const seats = new Map<string, string>();
+    for (const [provider, verdict] of Object.entries(node)) {
+        seats.set(provider.trim(), typeof verdict === 'string' ? verdict.trim() : '');
+    }
+    return seats.size > 0 ? seats : null;
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
+/** The `providers:`, `verdict:` and `seats:` frontmatter lines, derived — never typed. */
+export function renderRatificationHeader(
+    seats: ReadonlyMap<string, SeatVerdict> | Readonly<Record<string, SeatVerdict>>,
+): string {
+    const entries = seats instanceof Map ? [...seats.entries()] : Object.entries(seats);
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
+ * The header claims the seats do not support. Empty when `seats:` is absent —
+ * an artifact written before the field existed is read as it always was.
+ */
+function seatProblems(
+    seats: ReadonlyMap<string, string> | null,
+    providers: readonly string[],
+    verdict: string | null,
+): RatificationProblem[] {
+    if (seats === null) return [];
+    const problems: RatificationProblem[] = [];
+    for (const [p, v] of seats) {
+        if (!SEAT_VERDICTS.includes(v)) {
+            problems.push({
+                code: 'unknown-seat-verdict',
+                message: `seat \`${p}\` records \`${v}\`, not one of ${SEAT_VERDICTS.join(', ')}`,
+            });
+        }
+    }
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
+    const finalSeats = new Set([...seats].filter(([, v]) => v !== SEAT_NO_FINAL_VERDICT).map(([p]) => p));
+    const extra = providers.filter((p) => !finalSeats.has(p));
+    if (extra.length > 0) {
+        problems.push({
+            code: 'providers-exceed-seats',
+            message:
+                `providers names ${extra.join(', ')}, which gave no final verdict ` +
+                `(${String(finalSeats.size)} seat(s) did) — diversity is counted over seats that answered`,
+        });
+    }
+    return problems;
+}
+
 export interface RatificationReading {
     artifact: RatificationArtifact | null;
     problems: RatificationProblem[];
@@ -208,6 +316,8 @@ export function readRatification(
         }
     }
 
+    problems.push(...seatProblems(readSeats(fm), providers, verdict));
+
     // Diversity, against the REQUIRED count.
     //
     // Round 1 refused the previous shape: the count came from the user-global
diff --git a/src/scripts/ratification_header.ts b/src/scripts/ratification_header.ts
new file mode 100644
index 000000000..0ab6a2678
--- /dev/null
+++ b/src/scripts/ratification_header.ts
@@ -0,0 +1,76 @@
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
+    RATIFICATION_VERDICTS,
+    SEAT_NO_FINAL_VERDICT,
+    renderRatificationHeader,
+    type SeatVerdict,
+} from './_lib/ratification_artifact.js';
+
+const ALLOWED: readonly string[] = [...RATIFICATION_VERDICTS, SEAT_NO_FINAL_VERDICT];
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
+        const provider = raw.slice(0, eq).trim();
+        const verdict = raw.slice(eq + 1).trim();
+        if (eq <= 0 || !ALLOWED.includes(verdict)) {
+            process.stderr.write(`error: --seat needs <provider>=<one of ${ALLOWED.join('|')}>, got \`${raw}\`\n`);
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
diff --git a/tests/scripts/ratification_header_from_seats.test.ts b/tests/scripts/ratification_header_from_seats.test.ts
new file mode 100644
index 000000000..84a9b9193
--- /dev/null
+++ b/tests/scripts/ratification_header_from_seats.test.ts
@@ -0,0 +1,115 @@
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
+    it('reads an artifact without `seats:` as before', () => {
+        const text = artifact(['providers: [anthropic, openai]', 'verdict: ratified'].join('\n'));
+        expect(readRatification(text, 2).problems).toEqual([]);
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
