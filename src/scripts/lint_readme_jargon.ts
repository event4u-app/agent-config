#!/usr/bin/env tsx
/**
 * CI guard for README.md above-fold jargon density.
 *
 * TypeScript twin of `src/scripts/lint_readme_jargon.py` (ADR-096, Phase 4 /
 * Wave 4b). The CLI contract is mirrored EXACTLY — `--quiet` flag, exit
 * codes (0 within budget, 1 over budget / missing), stdout/stderr split,
 * byte-identical finding messages, same noise-stripping order, same
 * whole-word watchlist matching.
 *
 * The role-first-onboarding roadmap (Phase 2 Step 3) targets non-developer
 * readers above the fold. Lines 1..ABOVE_FOLD_LINES of README.md MUST
 * contain at most MAX_HITS occurrences of the watchlist terms below
 * (case-insensitive, whole-word matched).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

const README = 'README.md';
const ABOVE_FOLD_LINES = 120;
const MAX_HITS = 3;

const WATCHLIST = [
    'kernel',
    'contract',
    'iron law',
    'projection',
    'manifest',
    'lint',
    'ADR',
    'soak',
    'drift',
    'gate',
    'harness',
] as const;

/** Escape a string for safe insertion into a RegExp (mirrors re.escape). */
function _reEscape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Python str.splitlines() — drops the trailing empty element. */
function _splitlines(text: string): string[] {
    if (text === '') {
        return [];
    }
    const normalised = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const parts = normalised.split('\n');
    if (parts[parts.length - 1] === '') {
        parts.pop();
    }
    return parts;
}

/**
 * Return per-line content with fences / HTML comments / URLs removed.
 *
 * Order matters: drop URLs first (they may sit inside fences), then
 * blank out fenced code regions so word-boundary matches don't trip
 * on stack-trace or shell tokens.
 */
function _stripNoise(lines: string[]): string[] {
    const urlRe = /https?:\/\/\S+|\(\.[\w./-]+\)/g;
    const cleaned: string[] = [];
    let inFence = false;
    let inHtml = false;
    for (const raw of lines) {
        const line = raw;
        if (line.includes('<!--') && !line.includes('-->')) {
            inHtml = true;
        }
        if (inHtml) {
            cleaned.push('');
            if (line.includes('-->')) {
                inHtml = false;
            }
            continue;
        }
        const stripped = line.trim();
        if (stripped.startsWith('```')) {
            inFence = !inFence;
            cleaned.push('');
            continue;
        }
        if (inFence) {
            cleaned.push('');
            continue;
        }
        cleaned.push(line.replace(urlRe, ' '));
    }
    return cleaned;
}

interface Hit {
    line: number;
    term: string;
    match: string;
}

/** Mirror Python `repr(str)` for ASCII finding output: single-quoted. */
function _pyRepr(s: string): string {
    let out = "'";
    for (const ch of s) {
        if (ch === '\\') {
            out += '\\\\';
        } else if (ch === "'") {
            out += "\\'";
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else {
            out += ch;
        }
    }
    return out + "'";
}

function main(): number {
    const quiet = process.argv.slice(2).includes('--quiet');
    if (!fs.existsSync(README)) {
        process.stderr.write(`error: ${README} not found\n`);
        return 1;
    }

    const allLines = _splitlines(fs.readFileSync(README, 'utf-8'));
    const head = _stripNoise(allLines.slice(0, ABOVE_FOLD_LINES));

    const patterns: Array<[string, RegExp]> = WATCHLIST.map((term) => [
        term,
        new RegExp(`(?<![A-Za-z0-9])${_reEscape(term)}(?![A-Za-z0-9])`, 'gi'),
    ]);

    const hits: Hit[] = [];
    head.forEach((content, idx) => {
        for (const [term, pat] of patterns) {
            pat.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = pat.exec(content)) !== null) {
                hits.push({ line: idx + 1, term, match: m[0] });
                if (m.index === pat.lastIndex) {
                    pat.lastIndex += 1;
                }
            }
        }
    });

    if (hits.length > MAX_HITS) {
        process.stdout.write(
            `FAIL  ${README}: ${hits.length} jargon hits above the fold ` +
                `(lines 1..${ABOVE_FOLD_LINES}, limit ${MAX_HITS}).\n`,
        );
        for (const { line, term, match } of hits) {
            // Python f"  L{line_no:>3}  {term:<10}  -> {match!r}"
            const lineStr = String(line).padStart(3, ' ');
            const termStr = term.padEnd(10, ' ');
            process.stdout.write(`  L${lineStr}  ${termStr}  -> ${_pyRepr(match)}\n`);
        }
        process.stdout.write(
            '\nFix: rewrite the line in role-first language. Move the ' +
                'term below line ' +
                `${ABOVE_FOLD_LINES + 1} (architecture / contracts section).\n`,
        );
        return 1;
    }

    if (!quiet) {
        process.stdout.write(
            `OK    ${README}: ${hits.length} jargon hits above the fold ` +
                `(limit ${MAX_HITS}).\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { README, ABOVE_FOLD_LINES, MAX_HITS, WATCHLIST, main };
