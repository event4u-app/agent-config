#!/usr/bin/env node
/**
 * Never-silent lint (P4.4 of road-to-rule-delivery-integrity).
 *
 * No shipped rule, skill, or command may DIRECT a silent re-run or the
 * concealment of a detected miss. The mechanism was built, benchmarked and
 * falsified — `src/skills/recursive-verification/SKILL.md` records the
 * 2026-07-28 honest null as TERMINAL — so guidance that resurrects it is guidance
 * against a measured verdict. Correction is always visible.
 *
 * ── Why this is not a plain phrase grep ──────────────────────────────
 *
 * The corpus's only hit is `self-repair-loop.md`:
 *
 *     CORRECT THE TURN OPENLY IN FRONT OF THE USER. NEVER RE-RUN IT SILENTLY
 *     TO HIDE THE MISS.
 *
 * which is the PROHIBITION, not the instruction. A gate that flagged it would
 * fail on the one artefact stating the rule it enforces — and the obvious
 * repair, allowlisting that path, would then let a real directive land in the
 * same file unnoticed. So the discriminator is grammatical: a directive phrase
 * accompanied by a negation or non-goal marker is DESCRIPTION; the same phrase
 * standing alone is a DIRECTIVE.
 *
 * The marker escape (`<!-- never-silent-ok: <reason> -->`) exists for prose the
 * heuristic cannot read, and requires a stated reason — a bare marker is
 * rejected, which is the same anti-degenerate-pass shape the ledger exemption
 * uses.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned } from './_lib/scan_scope.js';

const GATE = 'lint_never_silent';

export const SCAN_ROOTS = [
    path.join('src', 'rules'),
    path.join('src', 'skills'),
    path.join('src', 'agent-src', 'commands'),
] as const;

/** Phrases that, unqualified, direct a silent re-run or a concealed miss. */
export const DIRECTIVE_PATTERNS: readonly RegExp[] = [
    /\bsilently re-?run\b/i,
    /\bre-?run (?:it |the turn )?(?:silently|quietly)\b/i,
    /\bquietly (?:retry|re-?run|redo)\b/i,
    /\bhide the miss\b/i,
    /\bconceal(?:ment of)? (?:the |a )?(?:miss|defect|failure|error)\b/i,
    /\bwithout (?:telling|informing|surfacing (?:it )?to) the user\b/i,
    /\bohne es zu erwähnen\b/i,
];

/**
 * Markers that turn a directive phrase into a description of one.
 *
 * Read over the text BEFORE the match — never the whole window — and the
 * asymmetry is the entire discriminator, found by a seeded fixture rather than
 * by reasoning:
 *
 *     NEVER re-run it silently to hide the miss.        prohibition  (negation before)
 *     silently re-run so the user never sees it.        DIRECTIVE    (negation after)
 *
 * A window-wide search calls the second one description too, because "never
 * sees it" is the directive's PURPOSE rather than its prohibition. Position is
 * what separates them, so position is what the check reads.
 *
 * The lookback still spans lines, because a prohibition routinely names its
 * subject one line below the negation — the pinned non-goal in this roadmap's
 * Phase 4 does exactly that.
 */
export const NEGATION_MARKERS: readonly RegExp[] = [
    /\bnever\b/i,
    /\bmust not\b/i,
    /\bdo not\b/i,
    /\bforbidden\b/i,
    /\bprohibited\b/i,
    /\bnon-goal\b/i,
    /\bfalsified\b/i,
    /\bstays out\b/i,
    /\brefuse[sd]?\b/i,
    /\bis a violation\b/i,
    /\bnicht\b/i,
    /\bnie\b/i,
];

export const OK_MARKER_RE = /<!--\s*never-silent-ok:\s*(.+?)\s*-->/;

/** Lines of context searched ABOVE a hit for a negation marker. */
const WINDOW = 2;

export interface Violation {
    file: string;
    line: number;
    text: string;
}

/** Pure: audit one file's lines. Exported so a test can seed a violation. */
export function auditLines(file: string, lines: readonly string[]): Violation[] {
    const out: Violation[] = [];
    for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i] as string;
        // Strip the exemption marker before ANY matching: its own name contains
        // "never", so leaving it in makes every marked line read as a
        // prohibition — a marker that exempts itself regardless of its reason.
        const line = raw.replace(OK_MARKER_RE, '');
        let at = -1;
        for (const re of DIRECTIVE_PATTERNS) {
            const m = re.exec(line);
            if (m !== null && (at === -1 || m.index < at)) {
                at = m.index;
            }
        }
        if (at === -1) {
            continue;
        }
        const marker = OK_MARKER_RE.exec(raw);
        if (marker !== null && (marker[1] ?? '').trim().length > 3) {
            continue;
        }
        const from = Math.max(0, i - WINDOW);
        const before = [...lines.slice(from, i), line.slice(0, at)].join(' ');
        if (NEGATION_MARKERS.some((re) => re.test(before))) {
            continue;
        }
        out.push({ file, line: i + 1, text: raw.trim().slice(0, 120) });
    }
    return out;
}

function walk(dir: string): string[] {
    if (!fs.existsSync(dir)) {
        return [];
    }
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
        a.name < b.name ? -1 : 1,
    )) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            out.push(...walk(p));
        } else if (e.isFile() && p.endsWith('.md')) {
            out.push(p);
        }
    }
    return out;
}

export function main(repoRoot: string = process.cwd()): number {
    const files = SCAN_ROOTS.flatMap((r) => walk(path.join(repoRoot, r)));
    const violations: Violation[] = [];
    for (const f of files) {
        const rel = path.relative(repoRoot, f);
        violations.push(...auditLines(rel, fs.readFileSync(f, 'utf-8').split('\n')));
    }

    assertScanned({
        gate: GATE,
        scanned: files.length,
        units: 'shipped rule / skill / command files',
        roots: [...SCAN_ROOTS],
    });

    if (violations.length > 0) {
        process.stderr.write(`${GATE}: ${String(violations.length)} violation(s)\n\n`);
        for (const v of violations) {
            process.stderr.write(`  ${v.file}:${String(v.line)}  ${v.text}\n`);
        }
        process.stderr.write(
            '\nA shipped artefact may not DIRECT a silent re-run or a concealed miss —\n' +
                'the mechanism was benchmarked and falsified (recursive-verification, TERMINAL\n' +
                '2026-07-28), and correction is always visible. If the prose DESCRIBES the\n' +
                'falsified mechanism rather than instructing it, either phrase it with the\n' +
                'negation it deserves or add `<!-- never-silent-ok: <reason> -->` on the line.\n',
        );
        return 1;
    }

    process.stdout.write(
        `✅  ${GATE}: ${String(files.length)} shipped artefact(s), no silent-rerun directive\n`,
    );
    return 0;
}

function isCliEntry(): boolean {
    const argv1 = process.argv[1];
    if (argv1 === undefined) {
        return false;
    }
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(argv1))
        );
    } catch {
        return pathToFileURL(argv1).href === import.meta.url;
    }
}

if (isCliEntry()) {
    process.exit(main());
}
