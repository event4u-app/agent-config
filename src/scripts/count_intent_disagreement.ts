#!/usr/bin/env tsx
/**
 * count_intent_disagreement.ts — the counter `mandated-lines.md` asks for.
 *
 * `src/agent-src/contexts/execution/mandated-lines.md` § Honest scope names one
 * cheap observation and then names its own precondition:
 *
 *   "track how often an emitted intent line has its three slots **disagree**.
 *    If disagreements are effectively never found, the line is decorating
 *    decisions already made and the set should shrink. [...] That observation
 *    costs one counter and is the first thing to look at before adding a sixth
 *    line."
 *
 * This is that counter. It answers a question no eval in this tree measures:
 * whether the five EXISTING mandated lines earn their place — as opposed to
 * whether a sixth would.
 *
 * WHAT IT CAN AND CANNOT DECIDE, stated here rather than discovered later.
 * "Disagree" is a semantic relation between three claims, and no lexical pass
 * decides it. So the counter reports two layers and never conflates them:
 *
 *   Layer 1, deterministic. Population size, malformed lines (fewer than three
 *   slots), and RESTATEMENT lines — slots whose content-word sets overlap so
 *   heavily that the line reads the same three ways. That shape is the
 *   contract's own named failure ("A line that reads the same three ways is a
 *   line that was written after deciding"), so it is the one disagreement-
 *   adjacent signal a machine can own. `distinct` is NOT `disagree`: three
 *   slots can be phrased differently and still say the same thing.
 *
 *   Layer 2, rated and opt-in. A model rater classifies each well-formed line
 *   as agree / disagree / undecidable. Only meaningful over a non-empty
 *   population, and deliberately not wired here — the rater path already
 *   exists in `rdp_quality_eval.ts --score-only` and duplicating its billing
 *   guard would be a second unguarded way to bill the same account.
 *
 * NO THRESHOLD IS SET IN ADVANCE. The split AI council of 2026-09-07 flagged a
 * proposed "≥ 80 % zero disagreement = ceremony" figure as invented; what
 * counts as ceremony is read off the distribution once one exists. This tool
 * therefore reports a distribution and never a verdict.
 *
 * NOT WIRED INTO THE `ci` CORPUS SWEEP, on the same grounds
 * `lint_mandated_lines.ts` states for itself: there is no standing tree of run
 * reports to scan, and a gate pointed at a root that does not accumulate is
 * the dead-scan-root shape this repository has already paid for. It is a
 * callable counter, invoked when someone wants the reading.
 *
 * An EMPTY population exits 2, not 0. A rate over nothing is not a reading —
 * the same call `rdp_quality_eval --score-only` makes when a results file
 * carries no transcript text.
 *
 * Sources are supplied explicitly so the reading is reproducible and the tool
 * stays hermetic under test:
 *
 *     ./scripts-run src/scripts/count_intent_disagreement --git-log
 *     ./scripts-run src/scripts/count_intent_disagreement --pr-bodies prs.json
 *     ./scripts-run src/scripts/count_intent_disagreement --dir path/to/reports
 *     ./scripts-run src/scripts/count_intent_disagreement --stdin < report.md
 *
 * Gather the durable population for this repository with:
 *
 *     gh pr list --state merged --limit 400 --json number,body > prs.json
 *
 * Exit: 0 population read and classified · 1 usage/IO error · 2 empty population.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { INTENT_RE, stripFences, unwrapLines } from './lint_mandated_lines.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** The slot separator the contract specifies. */
const SLOT_SEPARATOR = '·';

/**
 * Words carrying no discriminating content.
 *
 * Kept small on purpose. A large stop list makes two slots look identical
 * because everything distinguishing them was filtered out, which would inflate
 * the restatement count — the number this tool exists to report honestly.
 */
const STOPWORDS = new Set([
    'a', 'an', 'and', 'as', 'at', 'be', 'but', 'by', 'for', 'from', 'in', 'is',
    'it', 'its', 'of', 'on', 'or', 'that', 'the', 'to', 'was', 'were', 'with',
    'says', 'say', 'expects', 'expect', 'does', 'do', 'should',
]);

export type LineClass = 'malformed' | 'restatement' | 'distinct';

export interface ClassifiedLine {
    /** Where it came from, for the report. */
    source: string;
    /** The raw text after the `Intent:` label. */
    body: string;
    slots: string[];
    klass: LineClass;
    /** Max pairwise Jaccard overlap across the three slots, for the distribution. */
    maxOverlap: number;
}

export interface Population {
    lines: ClassifiedLine[];
    /** Per-source count, so a source contributing nothing is visible. */
    bySource: Record<string, number>;
}

/** Content words of a slot, lower-cased, stop-words and punctuation dropped. */
export function contentWords(slot: string): Set<string> {
    const words = slot
        .toLowerCase()
        .replace(/`[^`]*`/g, (m) => m.replace(/`/g, ''))
        .split(/[^a-z0-9_]+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w));
    return new Set(words);
}

/** Jaccard overlap of two content-word sets. Empty-vs-anything is 0. */
export function overlap(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let shared = 0;
    for (const w of a) if (b.has(w)) shared += 1;
    const union = a.size + b.size - shared;
    return union === 0 ? 0 : shared / union;
}

/**
 * The overlap above which two slots are read as restating each other.
 *
 * A STATED DEFAULT, not a measured optimum — said plainly rather than implying
 * a derivation it does not have. It is reported alongside every reading so a
 * later reader can recompute at a different value from the published
 * `maxOverlap` per line, which is why the per-line number is in the output.
 */
export const RESTATEMENT_OVERLAP = 0.6;

export function classify(body: string, source: string): ClassifiedLine {
    const slots = body.split(SLOT_SEPARATOR).map((s) => s.trim()).filter((s) => s !== '');
    if (slots.length < 3) {
        return { source, body, slots, klass: 'malformed', maxOverlap: 0 };
    }
    const sets = slots.map(contentWords);
    let maxOverlap = 0;
    for (let i = 0; i < sets.length; i++) {
        for (let j = i + 1; j < sets.length; j++) {
            maxOverlap = Math.max(maxOverlap, overlap(sets[i] as Set<string>, sets[j] as Set<string>));
        }
    }
    maxOverlap = Math.round(maxOverlap * 1000) / 1000;
    return {
        source,
        body,
        slots,
        klass: maxOverlap >= RESTATEMENT_OVERLAP ? 'restatement' : 'distinct',
        maxOverlap,
    };
}

/**
 * Extract emitted intent lines from one text.
 *
 * Reuses `lint_mandated_lines`' own regex and its two preparation passes
 * verbatim. That matters more than it looks: `stripFences` is what stops the
 * contract's own illustrative example from counting as an emitted line, and
 * this counter's whole finding turns on that distinction.
 */
export function extract(text: string, source: string): ClassifiedLine[] {
    const prepared = unwrapLines(stripFences(text));
    INTENT_RE.lastIndex = 0;
    return [...prepared.matchAll(INTENT_RE)].map((m) => classify(m[1] ?? '', source));
}

/**
 * Decode a JSONL transcript into the prose it actually carries.
 *
 * WHY THIS IS NOT OPTIONAL. A session transcript is newline-delimited JSON, so
 * the assistant prose inside it carries `\n` as a two-character ESCAPE, not as
 * a newline. A line-anchored regex therefore matches nothing in a raw `.jsonl`
 * and the source reads zero — a false null that looks exactly like a real one.
 * The first version of this tool had that bug and reported `dir: 0` over 4,909
 * transcript files while a plain grep found five candidate labels in them.
 *
 * Every string leaf is concatenated with a real newline between values, so a
 * label that began a line in the original prose begins a line here too.
 */
export function decodeJsonl(raw: string): string {
    const chunks: string[] = [];
    const visit = (v: unknown): void => {
        if (typeof v === 'string') chunks.push(v);
        else if (Array.isArray(v)) for (const x of v) visit(x);
        else if (v !== null && typeof v === 'object') for (const x of Object.values(v)) visit(x);
    };
    for (const line of raw.split('\n')) {
        if (line.trim() === '') continue;
        try {
            visit(JSON.parse(line));
        } catch {
            // Not a JSON record — treat the line as prose rather than dropping
            // it, so a mixed or truncated file degrades to the plain-text read.
            chunks.push(line);
        }
    }
    return chunks.join('\n');
}

function walkFiles(root: string): string[] {
    const found: string[] = [];
    const stack = [root];
    while (stack.length > 0) {
        const dir = stack.pop() as string;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) stack.push(p);
            else if (e.isFile()) found.push(p);
        }
    }
    return found.sort();
}

export function gather(argv: readonly string[]): Population | { error: string } {
    const lines: ClassifiedLine[] = [];
    const bySource: Record<string, number> = {};
    const add = (source: string, text: string): void => {
        const got = extract(text, source);
        bySource[source] = (bySource[source] ?? 0) + got.length;
        lines.push(...got);
    };

    if (argv.includes('--git-log')) {
        try {
            const body = execFileSync('git', ['log', '--all', '--format=%B'], {
                cwd: REPO_ROOT,
                encoding: 'utf-8',
                maxBuffer: 256 * 1024 * 1024,
            });
            add('git-log', body);
        } catch (e) {
            return { error: `--git-log failed: ${String(e)}` };
        }
    }

    const prIdx = argv.indexOf('--pr-bodies');
    if (prIdx !== -1) {
        const p = argv[prIdx + 1];
        if (p === undefined) return { error: '--pr-bodies needs a path to a `gh pr list --json body` dump' };
        try {
            const raw = JSON.parse(fs.readFileSync(path.resolve(p), 'utf-8')) as Array<{ body?: string | null }>;
            bySource['pr-bodies'] = 0;
            for (const pr of raw) {
                if (typeof pr.body === 'string' && pr.body !== '') add('pr-bodies', pr.body);
            }
            // A dump of N bodies that yields zero lines must still record that N
            // bodies were read — otherwise an empty result is indistinguishable
            // from a source that was never consulted.
            process.stdout.write(`  pr-bodies: read ${String(raw.length)} PR body/bodies\n`);
        } catch (e) {
            return { error: `cannot read ${p}: ${String(e)}` };
        }
    }

    const dirIdx = argv.indexOf('--dir');
    if (dirIdx !== -1) {
        const d = argv[dirIdx + 1];
        if (d === undefined) return { error: '--dir needs a path' };
        const files = walkFiles(path.resolve(d));
        bySource['dir'] = 0;
        let jsonl = 0;
        for (const f of files) {
            try {
                const raw = fs.readFileSync(f, 'utf-8');
                if (f.endsWith('.jsonl') || f.endsWith('.json')) {
                    jsonl += 1;
                    add('dir', decodeJsonl(raw));
                } else {
                    add('dir', raw);
                }
            } catch {
                continue;
            }
        }
        process.stdout.write(
            `  dir: read ${String(files.length)} file(s) under ${d} ` +
                `(${String(jsonl)} JSON/JSONL, string leaves decoded)\n`,
        );
    }

    if (argv.includes('--stdin')) {
        try {
            add('stdin', fs.readFileSync(0, 'utf-8'));
        } catch (e) {
            return { error: `cannot read stdin: ${String(e)}` };
        }
    }

    if (Object.keys(bySource).length === 0) {
        return {
            error:
                'no source selected. Pass at least one of --git-log, --pr-bodies <file>, --dir <path>, --stdin.\n' +
                'Gather this repository\'s durable population with:\n' +
                '  gh pr list --state merged --limit 400 --json number,body > prs.json',
        };
    }
    return { lines, bySource };
}

export function report(pop: Population, write: (s: string) => void): void {
    const total = pop.lines.length;
    const counts: Record<LineClass, number> = { malformed: 0, restatement: 0, distinct: 0 };
    for (const l of pop.lines) counts[l.klass] += 1;

    write('\nintent-line population\n');
    for (const [src, n] of Object.entries(pop.bySource)) {
        write(`  ${src}: ${String(n)} emitted intent line(s)\n`);
    }
    write(`  total: ${String(total)}\n`);
    if (total === 0) return;

    write('\nlayer 1 — deterministic classification\n');
    write(`  malformed (<3 slots):        ${String(counts.malformed)}\n`);
    write(`  restatement (overlap >= ${RESTATEMENT_OVERLAP}): ${String(counts.restatement)}\n`);
    write(`  distinct:                    ${String(counts.distinct)}\n`);
    const wellFormed = total - counts.malformed;
    if (wellFormed > 0) {
        const rate = Math.round((counts.restatement / wellFormed) * 1000) / 10;
        write(`  restatement rate over well-formed lines: ${String(rate)} %\n`);
    }
    write('\n  per-line max pairwise slot overlap (recompute at another threshold from these)\n');
    for (const [i, l] of pop.lines.entries()) {
        write(`    ${String(i + 1).padStart(3, ' ')}. [${l.klass}] overlap=${String(l.maxOverlap)} ${l.source} :: ${l.body.slice(0, 90)}\n`);
    }
    write(
        '\nlayer 2 — semantic agree/disagree is NOT reported here. `distinct` is not ' +
            '`disagree`: three slots can be worded differently and still say the same thing.\n',
    );
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--help') || argv.length === 0) {
        process.stdout.write(
            'usage: count_intent_disagreement [--git-log] [--pr-bodies <file.json>] [--dir <path>] [--stdin]\n',
        );
        return argv.length === 0 ? 1 : 0;
    }
    const got = gather(argv);
    if ('error' in got) {
        process.stderr.write(`${got.error}\n`);
        return 1;
    }
    report(got, (s) => process.stdout.write(s));

    try {
        assertScanned({
            gate: 'count_intent_disagreement',
            scanned: got.lines.length,
            units: 'emitted intent line(s)',
            roots: Object.keys(got.bySource),
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(
                `\n❌  ${e.message}\n\n` +
                    'This is a FINDING, not a tool failure. Zero emitted intent lines means the\n' +
                    'disagreement rate the `mandated-lines.md` lock asks for does not exist yet,\n' +
                    'because the line whose slots would disagree is not being emitted at all.\n' +
                    'Record the null. Do not read it as "no disagreements found".\n',
            );
            return 2;
        }
        throw e;
    }

    process.stdout.write(`\nscanned: ${String(got.lines.length)}\n`);
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}

export { REPO_ROOT };
