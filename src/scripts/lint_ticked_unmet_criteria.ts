#!/usr/bin/env tsx
/**
 * Reports an acceptance criterion ticked over its own "NOT met".
 *
 * A `- [x] AC-<n>` item whose own text says a half of it `is NOT met` is a
 * contradiction a reader of the checkbox never sees: the glyph says done, the
 * prose says not. The honest glyph is `[~]`, which carries the unmet half as a
 * deferral rather than hiding it under a tick.
 *
 * The criterion's text is the bullet line plus its indented continuation lines,
 * up to a blank line, a less-indented line or the next checkbox. Fenced code is
 * skipped and inline code spans are masked, so a quoted example is not a
 * finding — a roadmap that writes ABOUT this lint quotes the phrase it hunts,
 * and reporting the quoter is the detector reading its own name. The match is
 * the literal `NOT met` — upper-case on purpose, because that is how an author
 * marks the unmet half, and a lower-case "not met" inside an explanation is
 * prose.
 *
 * HTML comments are masked for the same reason, one step further out: the
 * premise above is "a contradiction a READER OF THE CHECKBOX never sees", and
 * a comment is invisible on the rendered page, so it cannot be the text that
 * misleads that reader. The hit this removes said "One clause of the GOAL is
 * NOT met" — a statement about a different proposition, parked in a comment
 * beside a criterion it does not describe.
 *
 * A criterion whose block carries a DATED closure marker — `MET YYYY-MM-DD` or
 * `CLOSED YYYY-MM-DD` — is read as closed, and a `NOT met` below it as the
 * history that closure resolved. Archived roadmaps preserve their audits on
 * purpose ("the audit below is preserved"), and a preserved audit saying what
 * WAS missing is not the glyph lying about what IS. Excluded criteria are
 * COUNTED AND NAMED in the pass line rather than silently dropped, so the
 * exemption is auditable without a suppression marker.
 *
 * What all of this costs, stated rather than discovered later, and pinned by
 * tests:
 *
 *   · an author who writes the unmet half inside backticks escapes the lint;
 *   · an author who writes it inside an HTML comment escapes the lint;
 *   · an author who stamps `CLOSED <date>` on a block whose other half really
 *     is unmet escapes the lint — this detector cannot tell an honest closure
 *     from a dishonest one, and a dishonest one is a review finding rather
 *     than something a text scanner can decide.
 *
 * The bare phrase with no date and no masking still fails, which is the case
 * the lint exists for.
 *
 * Verdict of the AI council, 2026-10-13, ONE seat of two (the second returned
 * `os_error: ENOBUFS` and answered nothing — a one-seat reading, not
 * convergence): refine the detector rather than edit the archived prose,
 * because the roadmap step's "no criterion text is reworded to clear the lint"
 * carries no exception for a case change.
 *
 * Usage:
 *   ./scripts-run src/scripts/lint_ticked_unmet_criteria
 *   ./scripts-run src/scripts/lint_ticked_unmet_criteria --root <repo>
 *   ./scripts-run src/scripts/lint_ticked_unmet_criteria --self-test
 *
 * Scans every `*.md` under the roadmap tree, archive included: an archived
 * roadmap is exactly where a contradictory tick outlives the session that
 * made it.
 *
 * Exit codes: 0 no hit · 1 at least one hit · 2 usage error.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

interface Hit {
    file: string;
    line: number;
    criterion: string;
}

const TICKED_AC_RE = /^([ \t]*)[-*][ \t]+\[[xX]\][ \t]+(AC-[\w.-]+)/;
const CHECKBOX_RE = /^[ \t]*[-*][ \t]+\[[ xX~-]\]/;
const FENCE_RE = /^[ \t]*(```|~~~)/;
const UNMET = 'NOT met';

function _indent(line: string): number {
    return (/^[ \t]*/.exec(line)?.[0] ?? '').length;
}

/**
 * Blanks the contents of every inline code span, keeping the delimiters and
 * every newline so offsets and line structure survive.
 *
 * A run of N backticks opens a span that closes at the next run of exactly N.
 * An unterminated run is literal text in markdown and masks nothing here, so a
 * stray backtick cannot blind the scanner for the rest of a criterion.
 */
function maskHtmlComments(text: string): string {
    return text.replace(/<!--[\s\S]*?-->/gu, (m) => m.replace(/[^\n]/gu, ' '));
}

/**
 * `MET 2026-08-31`, `CLOSED 2026-08-31` — a criterion stamping its own closure
 * with a date.
 *
 * Upper-case and dated on purpose, the same convention `NOT met` follows: a
 * lower-case "closed" or an undated "CLOSED" is prose and does not exempt.
 */
const DATED_CLOSURE_RE = /\b(?:MET|CLOSED)\s+\d{4}-\d{2}-\d{2}\b/u;

function maskInlineCode(text: string): string {
    let out = '';
    let i = 0;
    while (i < text.length) {
        if (text[i] !== '`') {
            out += text[i];
            i += 1;
            continue;
        }
        let n = 0;
        while (text[i + n] === '`') {
            n += 1;
        }
        let j = i + n;
        let close = -1;
        while (j < text.length) {
            if (text[j] === '`') {
                let m = 0;
                while (text[j + m] === '`') {
                    m += 1;
                }
                if (m === n) {
                    close = j;
                    break;
                }
                j += m;
            } else {
                j += 1;
            }
        }
        if (close === -1) {
            out += text.slice(i, i + n);
            i += n;
            continue;
        }
        out += text.slice(i, i + n);
        out += text
            .slice(i + n, close)
            .replace(/[^\n]/gu, ' ');
        out += text.slice(close, close + n);
        i = close + n;
    }
    return out;
}

function scanText(text: string, file: string, historical: Hit[] = []): Hit[] {
    const lines = text.split('\n');
    const hits: Hit[] = [];
    let inFence = false;
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] as string;
        if (FENCE_RE.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) {
            continue;
        }
        const m = TICKED_AC_RE.exec(line);
        if (!m) {
            continue;
        }
        const base = (m[1] as string).length;
        const block = [line];
        for (let j = i + 1; j < lines.length; j += 1) {
            const next = lines[j] as string;
            if (next.trim() === '' || CHECKBOX_RE.test(next) || FENCE_RE.test(next) || _indent(next) <= base) {
                break;
            }
            block.push(next);
        }
        const visible = maskHtmlComments(maskInlineCode(block.join('\n')));
        if (visible.includes(UNMET)) {
            if (DATED_CLOSURE_RE.test(visible)) {
                historical.push({ file, line: i + 1, criterion: m[2] as string });
            } else {
                hits.push({ file, line: i + 1, criterion: m[2] as string });
            }
        }
    }
    return hits;
}

function _walk(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            out.push(..._walk(full));
        } else if (e.isFile() && e.name.endsWith('.md')) {
            out.push(full);
        }
    }
    return out;
}

function scanTree(root: string): { hits: Hit[]; historical: Hit[]; scanned: number } {
    const files = _walk(path.join(root, 'agents', 'roadmaps'));
    const hits: Hit[] = [];
    const historical: Hit[] = [];
    for (const abs of files) {
        const rel = path.relative(root, abs).split(path.sep).join('/');
        hits.push(...scanText(fs.readFileSync(abs, 'utf8'), rel, historical));
    }
    return { hits, historical, scanned: files.length };
}

const _DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Four fixtures over a temporary roadmap tree, driven through the real CLI.
 *
 * Three of them are the three masks the detector grew, each paired with the
 * bare case it must still reject — a suite that only proved the masks would
 * certify a scanner that had stopped matching anything at all.
 */
function selfTest(): number {
    const repoRoot = _DEFAULT_ROOT;
    const rel = 'src/scripts/lint_ticked_unmet_criteria.ts';

    const over = (body: string): (() => number) => (): number => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ticked-unmet-self-'));
        try {
            const roadmaps = path.join(dir, 'agents', 'roadmaps');
            fs.mkdirSync(roadmaps, { recursive: true });
            fs.writeFileSync(path.join(roadmaps, 'road-to-fixture.md'), body);
            return runGateCli(repoRoot, rel, ['--root', dir], repoRoot);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };

    return runSelfTest({
        gate: 'lint_ticked_unmet_criteria',
        minCases: 6,
        minRejectCases: 3,
        cases: [
            {
                name: 'a bare NOT met under a tick is rejected',
                expect: 'reject',
                run: over('- [x] AC-1 — One half lands. The other half is NOT met.\n'),
            },
            {
                name: 'the same phrase inside backticks is accepted',
                expect: 'accept',
                run: over('- [x] AC-1 — The lint reports a criterion saying `NOT met`.\n'),
            },
            {
                name: 'an unterminated backtick does not mask, so the bare phrase is rejected',
                expect: 'reject',
                run: over('- [x] AC-1 — an opening ` and then NOT met in the clear.\n'),
            },
            {
                name: 'the same phrase inside an HTML comment is accepted',
                expect: 'accept',
                run: over('- [x] AC-1 — The gate ships.\n      <!-- the Goal clause is NOT met -->\n'),
            },
            {
                name: 'a dated closure marker exempts the block',
                expect: 'accept',
                run: over('- [x] AC-1 — Both halves land.\n      **CLOSED 2026-08-31.** First conjunct — NOT met.\n'),
            },
            {
                name: 'an UNDATED closure word does not exempt, so the block is rejected',
                expect: 'reject',
                run: over('- [x] AC-1 — Both halves land.\n      **CLOSED.** First conjunct — NOT met.\n'),
            },
            {
                name: 'a roadmap tree with no criterion at all is accepted',
                expect: 'accept',
                run: over('# Road to nothing\n\nNo criteria here.\n'),
            },
        ],
    });
}

function main(argv: string[] = process.argv.slice(2)): number {
    let root = _DEFAULT_ROOT;
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--self-test') {
            if (process.env['GATE_SELF_TEST_CHILD'] === '1') {
                process.stderr.write('lint_ticked_unmet_criteria: --self-test does not recurse\n');
                return 2;
            }
            return selfTest();
        }
        if (arg === '--root') {
            const v = argv[i + 1];
            if (v === undefined) {
                process.stderr.write('lint_ticked_unmet_criteria: --root requires a value\n');
                return 2;
            }
            root = path.resolve(v);
            i += 1;
        } else {
            process.stderr.write(`lint_ticked_unmet_criteria: unknown argument: ${String(arg)}\n`);
            return 2;
        }
    }
    const { hits, historical, scanned } = scanTree(root);
    reportScanned({
        gate: 'lint_ticked_unmet_criteria',
        scanned,
        units: 'roadmap file(s)',
        roots: ['agents/roadmaps'],
        allowEmpty: 'EMPTY_VALID: a checkout with no roadmap has no criterion to tick',
    });
    // Named, not merely counted: an exemption nobody can enumerate is a
    // suppression surface, and this one is granted by a date stamp an author
    // types.
    for (const h of historical) {
        process.stdout.write(
            `   exempt (dated closure): ${h.file}:${String(h.line)} · ${h.criterion}\n`,
        );
    }
    if (hits.length === 0) {
        process.stdout.write(
            `✅  lint_ticked_unmet_criteria: ${String(scanned)} roadmap file(s), ` +
                `no criterion ticked over "${UNMET}" (${String(historical.length)} exempt by a dated closure marker).\n`,
        );
        return 0;
    }
    process.stderr.write(
        `❌  lint_ticked_unmet_criteria: ${String(hits.length)} criterion/criteria ticked [x] over their own "${UNMET}":\n`,
    );
    for (const h of hits) {
        process.stderr.write(`  ${h.file}:${String(h.line)} · ${h.criterion}\n`);
    }
    process.stderr.write('\n    The unmet half is a deferral: use `[~]` and carry it, or meet it.\n');
    return 1;
}

if (process.argv[1] !== undefined) {
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        if (here === argv1) {
            process.exit(main());
        }
    } catch {
        if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
            process.exit(main());
        }
    }
}

export { maskHtmlComments, maskInlineCode, scanText, scanTree, main };
export type { Hit };
