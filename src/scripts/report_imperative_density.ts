#!/usr/bin/env tsx
/**
 * report_imperative_density.ts — an advisory number whose direction is unknown.
 *
 * Prints the ratio of imperative-marker lines to prose lines across the
 * authored rules and skills. **It gates on nothing, and it must not acquire a
 * threshold without the measurement that would justify one.**
 *
 * WHY THIS IS NOT A GATE, AND MUST NOT BECOME ONE
 * -----------------------------------------------
 * Three external sources disagree about which direction is better. One asserts
 * reasoning-based phrasing outperforms rigid directives. One ships a metric
 * that scores instruction files HIGHER for imperative-marker density — the
 * opposite ranking from the same observation. A third sits between them and
 * supplies the only part all three can live with: a rule the agent consistently
 * fails to follow needs structural enforcement or deletion, not a louder rule.
 *
 * This suite's house style sits at the imperative end and has no measurement
 * either way. A gate would prejudge exactly the question the sweep left open
 * (`skill-ecosystem-sweep-2026-08.md` § R2). An advisory number is the input a
 * future decision needs; a target is the thing that would corrupt it, because
 * the moment a number is optimised it stops measuring what it measured.
 *
 * So: no exit-2, no baseline entry, no `gate-coverage.yml` row, and the header
 * of every run says the direction is unsettled. Read it as a description, not
 * as a score.
 *
 * Exit: 0 always (except a usage/IO error, which is 1). That is deliberate.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const RULES_ROOT = 'src/rules';
export const SKILLS_ROOT = 'src/skills';

/**
 * Lines counted as imperative markers.
 *
 * Deliberately narrow and stated: an all-caps directive line, a bullet opening
 * with a modal or a bare imperative verb, and the fenced Iron-Law blocks this
 * suite uses. A broader net would inflate the number without making it mean
 * more, and the number's meaning is already the open question.
 */
const IMPERATIVE_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
    ['all-caps directive', /^[^a-z]*\b(NEVER|ALWAYS|MUST|DO NOT|STOP|REFUSE|FORBIDDEN)\b[^a-z]*$/],
    ['inline modal', /\b(MUST|NEVER|ALWAYS|DO NOT|SHALL)\b/],
    ['imperative bullet', /^\s*[-*]\s+(Always|Never|Do not|Don't|Use|Run|Check|Verify|Refuse|Stop|Add|Remove|Keep|Prefer|Avoid)\b/],
];

export interface FileDensity {
    file: string;
    prose: number;
    imperative: number;
    ratio: number;
}

export interface DensityReport {
    files: FileDensity[];
    totalProse: number;
    totalImperative: number;
    /** Ratio over the whole corpus, or null when nothing was counted. */
    ratio: number | null;
}

/**
 * Lines that carry prose. Fenced code, frontmatter, table rows, and blanks are
 * excluded — counting them would make the ratio a function of how much YAML a
 * file happens to carry.
 */
export function proseLines(text: string): string[] {
    const lines = text.split('\n');

    // Frontmatter only when the opening `---` actually CLOSES. A file whose
    // first line is a horizontal rule used to swallow everything to the next
    // `---`, and a file with an unterminated opener swallowed all of it.
    let start = 0;
    if (lines[0]?.trim() === '---') {
        const close = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
        // …and only when the block LOOKS like YAML. `---` opening a document
        // that then reads as prose is a horizontal rule, and treating it as
        // frontmatter silently ate everything up to the next one.
        const looksYaml = close > 0 && lines.slice(1, close).some((l) => /^\s*[\w.-]+:\s/.test(l));
        if (close !== -1 && looksYaml) start = close + 1;
    }

    // Fences are matched BY CHARACTER, so `~~~` cannot close a ```-opened
    // block, and an opener that never closes is treated as though it never
    // opened — dropping the rest of a file silently is worse than counting a
    // few code lines as prose, because the denominator is the thing this
    // report publishes.
    const openers: Array<{ index: number; marker: string }> = [];
    const fenced = new Set<number>();
    let open: { index: number; marker: string } | null = null;
    for (let i = start; i < lines.length; i++) {
        const m = /^\s*(`{3,}|~{3,})/.exec(lines[i] ?? '');
        if (m === null) continue;
        const marker = (m[1] as string)[0] as string;
        if (open === null) {
            open = { index: i, marker };
            openers.push(open);
        } else if (open.marker === marker) {
            for (let j = open.index; j <= i; j++) fenced.add(j);
            open = null;
        }
    }

    const out: string[] = [];
    for (let i = start; i < lines.length; i++) {
        if (fenced.has(i)) continue;
        const line = (lines[i] ?? '').trimEnd();
        if (line.trim() === '') continue;
        if (/^\s*\|/.test(line)) continue;
        out.push(line);
    }
    return out;
}

export function countImperative(lines: readonly string[]): number {
    let n = 0;
    for (const line of lines) {
        if (IMPERATIVE_PATTERNS.some(([, re]) => re.test(line))) n += 1;
    }
    return n;
}

function _walkMarkdown(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) out.push(..._walkMarkdown(full));
        else if (e.name.endsWith('.md')) out.push(full);
    }
    return out.sort();
}

export function buildReport(root: string): DensityReport {
    const files: FileDensity[] = [];
    let totalProse = 0;
    let totalImperative = 0;
    for (const dir of [RULES_ROOT, SKILLS_ROOT]) {
        for (const abs of _walkMarkdown(path.join(root, dir))) {
            const lines = proseLines(fs.readFileSync(abs, 'utf-8'));
            if (lines.length === 0) continue;
            const imperative = countImperative(lines);
            totalProse += lines.length;
            totalImperative += imperative;
            files.push({
                file: path.relative(root, abs).split(path.sep).join('/'),
                prose: lines.length,
                imperative,
                ratio: imperative / lines.length,
            });
        }
    }
    return {
        files,
        totalProse,
        totalImperative,
        ratio: totalProse === 0 ? null : totalImperative / totalProse,
    };
}

const HEADER = [
    'imperative-density report — ADVISORY, and the direction of this number is UNSETTLED.',
    '',
    'Three sources disagree on whether higher is better. One prefers reasoning-based',
    'phrasing; one scores instruction files higher for imperative density; the third',
    'declines the question and supplies the operational fork instead. This suite has',
    'no measurement either way — see skill-ecosystem-sweep-2026-08.md § R2.',
    '',
    'Do not read this as a score, and do not optimise it. It gates nothing on purpose:',
    'a threshold here would prejudge the open question, and a number that gets',
    'optimised stops measuring what it measured.',
].join('\n');

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const top = argv.includes('--top') ? Number.parseInt(argv[argv.indexOf('--top') + 1] ?? '10', 10) : 10;
    const json = argv.includes('--json');

    const report = buildReport(REPO_ROOT);
    if (json) {
        process.stdout.write(`${JSON.stringify({ note: 'advisory; direction unsettled (§ R2)', ...report }, null, 2)}\n`);
        return 0;
    }

    process.stdout.write(`${HEADER}\n\n`);
    if (report.ratio === null) {
        // `renderShare`'s rule, applied by hand: an empty denominator renders as
        // "not measured", never as 0.0 %.
        process.stdout.write('corpus ratio: not measured — zero prose lines found under the scanned roots\n');
        process.stdout.write(`files: ${String(report.files.length)}\n`);
        return 0;
    }
    process.stdout.write(
        `corpus ratio: ${(report.ratio * 100).toFixed(1)} % ` +
            `(${String(report.totalImperative)} imperative lines of ${String(report.totalProse)} prose lines, ` +
            `${String(report.files.length)} files)\n\n`,
    );
    const ranked = [...report.files].sort((a, b) => b.ratio - a.ratio).slice(0, top);
    process.stdout.write(`densest ${String(ranked.length)}:\n`);
    for (const f of ranked) {
        process.stdout.write(
            `  ${(f.ratio * 100).toFixed(1).padStart(5)} %  ${String(f.imperative).padStart(4)}/${String(f.prose).padEnd(5)}  ${f.file}\n`,
        );
    }
    // `files:` and not `scanned:` on purpose. The latter is the machine-read
    // coverage signal `check_gate_coverage` parses, and emitting it would
    // enlist an advisory report as a gate with a coverage floor — the exact
    // promotion this report must not undergo.
    process.stdout.write(`\nfiles: ${String(report.files.length)}\n`);
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}

export { REPO_ROOT };
