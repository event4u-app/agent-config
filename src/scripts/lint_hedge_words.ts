#!/usr/bin/env tsx
/**
 * Hedge-word lint — diff-scoped, ADVISORY, with a declared escalation trigger.
 *
 * `bench_honesty_score.ts` has measured hedging in agent OUTPUT since it was
 * written (`HEDGE_WORDS`, `countHedgeWords`). Nothing has ever looked at the
 * hedging in this package's own authored prose, which is where a hedge does the
 * most damage: a rule that says a gate "should probably" fire is a rule nobody
 * can be held to. This linter closes that half, reusing the same lexicon rather
 * than restating a second list that would drift from it.
 *
 * ── Why diff-scoped, not corpus-wide ────────────────────────────────────────
 * ADR-218:93 settled the question for prose-shape tooling outright: the wanted
 * instrument is "one that watches diffs, not one that counts the corpus". A
 * corpus count over 116 rules and 289 skills produces a number nobody can act
 * on — every reading is dominated by prose written years apart under different
 * conventions, and no single commit can move it.
 *
 * ── Why ADVISORY, and what would change that ────────────────────────────────
 * `check_suppression_hygiene.ts` states the rule this gate is measured against:
 * a gate whose corpus has findings on day one ships advisory; a gate whose
 * corpus is already clean ships enforced, "because shipping it advisory would
 * have been a hedge rather than a stage". This one has findings on day one and,
 * unlike the `scripts/`-directory predicate, its false-positive class is NOT
 * empty and cannot be made empty: hedging is legitimate — required, even — in
 * this tree's own calibrated-honesty prose. "May", "typically" and "in doubt"
 * appear in the very rules that teach an agent not to overclaim, and flagging
 * them would be the gate arguing against the house style it exists to protect.
 *
 * So it ships advisory WITH A STAGE, not advisory forever. The escalation
 * trigger is declared here, before any data, so that a later maintainer inherits
 * a condition rather than a judgement call:
 *
 *   ADVISORY → ERROR when ALL THREE hold, and not before:
 *     (a) at least 30 merged PRs have been measured by this gate;
 *     (b) across a sample of at least 50 of the findings those PRs produced, a
 *         human read classifies ≤ 10% as legitimate calibrated hedging — i.e.
 *         the check is mostly right about the prose it flags;
 *     (c) a maintainer records the measured rate and the resulting per-diff
 *         threshold in `docs/CLAIMS.md`, so the number that starts failing
 *         builds is itself bound to evidence.
 *
 *   If (b) fails — the FP rate stays above 10% — the honest outcome is that this
 *   check STAYS advisory permanently, or is removed. It does not get a lowered
 *   bar. That branch is pre-authorised here so that missing the threshold is a
 *   publishable result rather than an awkward conversation.
 *
 * ── Carve-outs (modelled on lint_provenance_vocabulary's quote-the-ban) ─────
 * A line that NAMES a hedge word rather than using one — the word inside
 * backticks or quotes — is exempt, or this file and its own test would be the
 * corpus's worst offenders. Fenced code and indented blocks are skipped: a
 * hedge in a code comment is a different surface with a different reviewer.
 *
 * Scan surfaces: added (`+`) lines in `src/**\/*.md` and `docs/**\/*.md`.
 *
 * Exit codes: 0 always, in the advisory stage — including when findings exist.
 * A non-zero exit is reserved for a usage error or a git failure, so that
 * wiring this into a pipeline today cannot redden a build.
 *
 * Usage:
 *     ./scripts-run src/scripts/lint_hedge_words
 *     ./scripts-run src/scripts/lint_hedge_words --base origin/main
 *     git diff origin/main | ./scripts-run src/scripts/lint_hedge_words --stdin
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { HEDGE_WORDS } from './bench_honesty_score.js';
import { readStdinText } from './_lib/stdin.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Prose surfaces this gate reads. Code and generated trees are out of scope. */
const SCAN_ROOTS = ['src/', 'docs/'] as const;

/**
 * Files exempt because their subject IS the lexicon. Without this, the gate's
 * own source, its test, and the scorer that owns `HEDGE_WORDS` dominate every
 * reading — the file that lists "might, could, perhaps" is not hedging.
 */
const LEXICON_FILES = [
    'src/scripts/lint_hedge_words.ts',
    'src/scripts/bench_honesty_score.ts',
    'tests/scripts/lint_hedge_words.test.ts',
];

export interface HedgeFinding {
    file: string;
    /** The added line, trimmed — line numbers are not recoverable from a `+` line alone. */
    line: string;
    words: string[];
}

export interface HedgeReport {
    findings: HedgeFinding[];
    filesScanned: number;
    addedProseLines: number;
    addedWords: number;
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const HEDGE_RES: readonly { word: string; re: RegExp }[] = HEDGE_WORDS.map((w) => ({
    word: w,
    re: new RegExp(`\\b${escapeRegExp(w)}\\b`, 'g'),
}));

/**
 * Spans where a hedge word is being NAMED, not used: backticked code spans and
 * quoted strings. Mirrors `lint_provenance_vocabulary`'s carve-out for a line
 * that quotes the ban it enforces.
 */
const QUOTED_SPAN = /`[^`]*`|"[^"]*"|'[^']*'|“[^”]*”|«[^»]*»/g;

function stripQuotedSpans(line: string): string {
    return line.replace(QUOTED_SPAN, ' ');
}

/** True for a line whose surface is code rather than prose. */
function isCodeSurface(line: string): boolean {
    if (/^\s{4,}\S/.test(line)) return true; // indented block
    if (/^\s*(?:```|~~~)/.test(line)) return true; // fence marker
    if (/^\s*(?:\/\/|\/\*|\*|#!)/.test(line)) return true; // comment
    if (/^\s*<!--/.test(line)) return true; // html comment / verify marker
    return false;
}

function inScope(file: string): boolean {
    if (!file.endsWith('.md')) return false;
    if (LEXICON_FILES.includes(file)) return false;
    return SCAN_ROOTS.some((r) => file.startsWith(r));
}

/**
 * Scan a unified diff for hedge words in added prose.
 *
 * Pure over the diff string — no filesystem access — so the whole gate is
 * testable from a fixture diff without a repo.
 */
export function scanDiff(diffText: string): HedgeReport {
    const findings: HedgeFinding[] = [];
    const files = new Set<string>();
    let curFile: string | null = null;
    let inFence = false;
    let addedProseLines = 0;
    let addedWords = 0;

    for (const raw of diffText.split('\n')) {
        if (raw.startsWith('+++ b/')) {
            curFile = raw.slice(6);
            inFence = false;
            if (inScope(curFile)) files.add(curFile);
            continue;
        }
        if (raw.startsWith('@@')) {
            // A hunk boundary loses fence context; assume prose rather than
            // silently swallowing a whole file because one fence opened above.
            inFence = false;
            continue;
        }
        if (!raw.startsWith('+') || raw.startsWith('+++')) continue;
        if (curFile === null || !inScope(curFile)) continue;

        const line = raw.slice(1);
        if (/^\s*(?:```|~~~)/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence || isCodeSurface(line)) continue;

        const prose = stripQuotedSpans(line);
        if (prose.trim() === '') continue;
        addedProseLines += 1;
        addedWords += prose.trim().split(/\s+/).length;

        const lower = prose.toLowerCase();
        const hits: string[] = [];
        for (const { word, re } of HEDGE_RES) {
            re.lastIndex = 0;
            if (re.test(lower)) hits.push(word);
        }
        if (hits.length > 0) {
            findings.push({ file: curFile, line: line.trim(), words: hits });
        }
    }

    return { findings, filesScanned: files.size, addedProseLines, addedWords };
}

function baseRef(argv: string[]): string {
    const i = argv.indexOf('--base');
    if (i !== -1 && i + 1 < argv.length) return argv[i + 1]!;
    return 'origin/main';
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(
            'usage: lint_hedge_words [--base <ref>] [--stdin] [--quiet]\n' +
                '  Advisory: reports hedge words in added prose. Always exits 0 on findings.\n',
        );
        return 0;
    }
    const quiet = argv.includes('--quiet');

    let diffText: string;
    if (argv.includes('--stdin')) {
        diffText = readStdinText();
    } else {
        const base = baseRef(argv);
        const proc = spawnSync('git', ['diff', base, '--', ...SCAN_ROOTS], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            maxBuffer: 64 * 1024 * 1024,
        });
        if (proc.error) {
            process.stderr.write(`lint_hedge_words: git diff failed: ${proc.error.message}\n`);
            return 2;
        }
        if (proc.status !== 0 && proc.status !== 1) {
            // Base ref absent (shallow clone, detached CI checkout) — a missing
            // base is not a finding, and inventing one would be worse.
            process.stdout.write(
                `lint_hedge_words: base ref '${base}' unavailable — advisory scan skipped.\n`,
            );
            return 0;
        }
        diffText = proc.stdout ?? '';
    }

    const report = scanDiff(diffText);

    if (report.addedProseLines === 0) {
        if (!quiet) {
            process.stdout.write('lint_hedge_words: no added prose under src/ or docs/ — nothing to read.\n');
            process.stdout.write('scanned: 0\n');
        }
        return 0;
    }

    const per100 = (report.findings.length / report.addedWords) * 100;
    if (report.findings.length > 0 && !quiet) {
        process.stdout.write(
            `lint_hedge_words (ADVISORY): ${report.findings.length} hedged line(s) ` +
                `in ${report.filesScanned} file(s):\n`,
        );
        for (const f of report.findings) {
            const clipped = f.line.length > 140 ? `${f.line.slice(0, 137)}…` : f.line;
            process.stdout.write(`    ${f.file} · [${f.words.join(', ')}] ${clipped}\n`);
        }
        process.stdout.write(
            '\n    Not every hit is a defect: calibrated hedging is house style in honesty\n' +
                '    prose. Read each one; this gate never fails a build in its current stage.\n' +
                '    Escalation trigger: see the header of src/scripts/lint_hedge_words.ts.\n',
        );
    } else if (!quiet) {
        process.stdout.write('lint_hedge_words (ADVISORY): no hedged lines in added prose.\n');
    }

    if (!quiet) {
        process.stdout.write(
            `hedged_lines: ${report.findings.length} · added_prose_lines: ${report.addedProseLines} ` +
                `· added_words: ${report.addedWords} · hedged_per_100_words: ${per100.toFixed(2)}\n`,
        );
        process.stdout.write(`scanned: ${report.filesScanned}\n`);
    }
    return 0;
}

/* c8 ignore start */
function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    return pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(_FILEPATH()).href;
}
function _FILEPATH(): string {
    return _HERE;
}
if (isCliEntry()) {
    process.exit(main());
}
/* c8 ignore stop */
