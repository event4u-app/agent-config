#!/usr/bin/env tsx
/**
 * Abstraction-threshold drift gate (ADR-213).
 *
 * ## The defect this prevents
 *
 * Before ADR-213, four artifacts stated four bare extraction thresholds
 * (2 / 3+ / ≥4 / ≥3) with no scope tags — an agent loading them together
 * received contradictory instructions. The per-class canon now lives in
 * `docs/guidelines/abstraction-thresholds.md`; every other site names its
 * artifact class and cites the canon. This gate makes that arrangement
 * durable in both directions:
 *
 * 1. CITATION — a paragraph anywhere in the governed tree that states a
 *    numeric extraction threshold must contain the string
 *    `abstraction-thresholds` (the canon citation). A bare number is drift.
 *    A heading is its own block; a threshold-stating heading is satisfied
 *    when the block immediately below it carries the citation.
 * 2. PINNING — the six deliberate sites are pinned to their current
 *    number + scope (SITES), and the canon's four table rows are pinned
 *    (CANON_ROWS). Changing either side without the other is a finding:
 *    the canon and its citing sites move together or not at all.
 *
 * ## Regex tuning record (2026-08-03, measured against the real tree)
 *
 * The ordinal branch accepts only `repetition|occurrence` — NOT
 * `caller|use|strategy`. Those nouns appear in deliberately *qualitative*
 * prose that is consistent with the canon and must stay finding-free:
 * "No second caller, no second strategy → no abstraction"
 * (simplicity-and-goal-demos), "cite the second caller — or inline it"
 * (minimal-safe-diff-mechanics), "until the third use earns extraction"
 * (tailwind-engineer, adjacent to its canon-citing section). The cardinal
 * branch requires the count directly before its repetition-noun, which
 * also excludes code-clarity's extract-to-VARIABLE row ("Used 2 or more
 * times" — a different concern, and "or more" breaks adjacency).
 * No QUALITATIVE_ALLOW list is needed at this tuning.
 *
 * Exit: 0 clean · 1 usage/IO error · 2 findings.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Governed roots — recursive `.md`. */
export const SCAN_ROOTS = [
    'src/rules',
    'src/skills',
    'src/agent-src/commands',
    'docs/guidelines',
] as const;

/** Never scanned even when nested under a root or passed explicitly. */
export const EXCLUDED_SEGMENTS = ['docs/decisions', 'docs/archive', 'dist', 'agents', 'tests'] as const;

/** The canon file — exempt from the citation rule (it IS the citation target). */
export const CANON_FILE = 'docs/guidelines/abstraction-thresholds.md';

/** The citation every threshold statement outside the canon must carry. */
export const CANON_CITATION = 'abstraction-thresholds';

/** (a) the paragraph talks about extraction / componentization / abstraction … */
export const THRESHOLD_VERB = /\b(extract\w*|componenti[sz]\w*|abstraction)\b/i;

/**
 * … and (b) states a numeric repetition bar. Three branches:
 * cardinal count + repetition-noun · ordinal (repetition|occurrence only —
 * see the tuning record above) · `≥ N` + repetition-noun.
 */
export const NUMERIC_REPETITION =
    /(\b(one|two|three|four|five|\d+)\s*(\+|×|x)?\s*(real\s+)?(repetitions?|repeats?|times|uses?|duplications?|occurrences?)\b)|(\b(second|third|fourth)\s+(real\s+)?(repetitions?|occurrences?)\b)|(≥\s*\d+\s*(real\s+)?(repetitions?|repeats?|times|uses?|duplications?|occurrences?))/i;

/** The canon's four table rows — all must match CANON_FILE. */
export const CANON_ROWS: ReadonlyArray<{ row: RegExp; why: string }> = [
    { row: /\*\*2 real repetitions\*\*/, why: 'code-level abstraction bar' },
    { row: /\*\*3\+ uses\*\*/, why: 'pure-markup UI-shell bar' },
    { row: /\*\*~4\+ repeats AND real state\*\*/, why: 'stateful UI-component bar' },
    { row: /\*\*≥ 3 duplications\*\*/, why: 'utility-class string bar' },
];

/**
 * The deliberate citing sites, pinned to their current number + scope.
 * A regex that stops matching means the site was edited — update the canon
 * AND this gate together (plus ADR-213 if the number itself moved).
 */
export const SITES: ReadonlyArray<{ file: string; mustMatch: RegExp; why: string }> = [
    {
        file: 'src/rules/architecture.md',
        mustMatch: /two real repetitions before you extract a \*\*code-level\*\*/,
        why: 'the rule carrying the code-level two-repetition bar',
    },
    {
        file: 'docs/guidelines/component-oriented-and-oop-development.md',
        mustMatch:
            /two real repetitions \(or a genuine second axis of change\)\s+before you extract a code-level abstraction/,
        why: 'guideline restating the code-level bar',
    },
    {
        file: 'docs/guidelines/component-oriented-and-oop-development.md',
        mustMatch: /shell 3\+ · stateful\s+component ~4 \+ real state/,
        why: 'guideline pointer to the scoped UI bars',
    },
    {
        // Moved with the fe-design progressive-disclosure split (2026-08-04):
        // the componentization bar lives in the design-patterns reference now.
        file: 'src/skills/fe-design/references/design-patterns.md',
        mustMatch: /Extract a props-only UI shell when used 3\+ times[\s\S]{0,160}?~4 \+ real state/,
        why: 'UI-shell 3+ bar and the stateful ~4 pointer',
    },
    {
        file: 'src/skills/ui-component-architect/SKILL.md',
        mustMatch: /## Componentization threshold — ≥4 repeats AND real state/,
        why: 'stateful-component bar (both-conditions form)',
    },
    {
        file: 'src/skills/tailwind-engineer/SKILL.md',
        mustMatch: /### 4\. Extract only when duplicated ≥ 3 times/,
        why: 'utility-class string ≥3 bar',
    },
    {
        file: 'docs/guidelines/agent-infra/minimal-safe-diff-mechanics.md',
        mustMatch: /\*\*code-level\*\* threshold in this suite is the \*\*second real repetition\*\*/,
        why: 'the second-repetition code-level lock (rule-of-three not adopted)',
    },
];

export interface Block {
    /** 1-based line of the block's first line. */
    startLine: number;
    text: string;
    heading: boolean;
}

export interface Finding {
    /** repo-relative path */
    file: string;
    line: number;
    message: string;
}

/**
 * Blank-line-separated blocks; a markdown heading line is its own block;
 * table rows (non-blank lines) belong to their surrounding block.
 */
export function split_blocks(content: string): Block[] {
    const lines = content.split('\n');
    const blocks: Block[] = [];
    let cur: string[] = [];
    let start = 1;
    const flush = () => {
        if (cur.length > 0) {
            blocks.push({ startLine: start, text: cur.join('\n'), heading: false });
        }
        cur = [];
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (line.trim() === '') {
            flush();
            continue;
        }
        if (/^#{1,6}\s/.test(line)) {
            flush();
            blocks.push({ startLine: i + 1, text: line, heading: true });
            continue;
        }
        if (cur.length === 0) {
            start = i + 1;
        }
        cur.push(line);
    }
    flush();
    return blocks;
}

export function is_threshold_statement(text: string): boolean {
    return THRESHOLD_VERB.test(text) && NUMERIC_REPETITION.test(text);
}

function is_excluded(rel: string): boolean {
    const parts = rel.split(path.sep).join('/');
    return EXCLUDED_SEGMENTS.some(
        (seg) => parts === seg || parts.startsWith(`${seg}/`) || parts.includes(`/${seg}/`),
    );
}

function* iter_md_files(dir: string): Generator<string> {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            yield* iter_md_files(p);
        } else if (entry.name.endsWith('.md')) {
            yield p;
        }
    }
}

/**
 * Citation rule over one file's content. Exported so the test can drive it
 * against synthetic content without touching the tree.
 */
export function scan_content(rel: string, content: string): Finding[] {
    const findings: Finding[] = [];
    const blocks = split_blocks(content);
    for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i]!;
        if (!is_threshold_statement(b.text)) {
            continue;
        }
        if (b.text.includes(CANON_CITATION)) {
            continue;
        }
        // A threshold-stating heading is satisfied by the block directly below.
        if (b.heading && blocks[i + 1]?.text.includes(CANON_CITATION)) {
            continue;
        }
        findings.push({
            file: rel,
            line: b.startLine,
            message: `bare threshold, cite the canon (${CANON_FILE})`,
        });
    }
    return findings;
}

/** Citation rule over a whole tree. Returns findings + files scanned. */
export function scan_citations(repoRoot: string): { findings: Finding[]; scanned: number } {
    const findings: Finding[] = [];
    let scanned = 0;
    for (const root of SCAN_ROOTS) {
        const abs = path.join(repoRoot, root);
        if (!fs.existsSync(abs)) {
            continue;
        }
        for (const f of iter_md_files(abs)) {
            const rel = path.relative(repoRoot, f).split(path.sep).join('/');
            if (is_excluded(rel)) {
                continue;
            }
            scanned += 1;
            if (rel === CANON_FILE) {
                continue; // the canon states its own numbers — CANON_ROWS pins them
            }
            findings.push(...scan_content(rel, fs.readFileSync(f, 'utf-8')));
        }
    }
    return { findings, scanned };
}

/** Bidirectional pins: canon rows + the six citing sites. */
export function check_pins(repoRoot: string): Finding[] {
    const findings: Finding[] = [];

    const canonAbs = path.join(repoRoot, CANON_FILE);
    if (!fs.existsSync(canonAbs)) {
        findings.push({ file: CANON_FILE, line: 1, message: 'canon file missing' });
    } else {
        const canon = fs.readFileSync(canonAbs, 'utf-8');
        for (const { row, why } of CANON_ROWS) {
            if (!row.test(canon)) {
                findings.push({
                    file: CANON_FILE,
                    line: 1,
                    message: `canon row missing (${why}): expected /${row.source}/ — update the canon + this gate together`,
                });
            }
        }
    }

    for (const { file, mustMatch, why } of SITES) {
        const abs = path.join(repoRoot, file);
        if (!fs.existsSync(abs)) {
            findings.push({ file, line: 1, message: `canonical site missing (${why})` });
            continue;
        }
        if (!mustMatch.test(fs.readFileSync(abs, 'utf-8'))) {
            findings.push({
                file,
                line: 1,
                message: `canonical site changed (${why}) — update the canon + this gate together`,
            });
        }
    }

    return findings;
}

export function main(argv?: readonly string[]): number {
    let quiet = false;
    for (const arg of argv ?? process.argv.slice(2)) {
        if (arg === '--quiet') {
            quiet = true;
        } else {
            process.stderr.write(`usage: lint_abstraction_thresholds [--quiet]\n`);
            return 1;
        }
    }

    let citations: { findings: Finding[]; scanned: number };
    let pins: Finding[];
    try {
        citations = scan_citations(REPO_ROOT);
        pins = check_pins(REPO_ROOT);
    } catch (e) {
        process.stderr.write(`error: ${String(e)}\n`);
        return 1;
    }

    const findings = [...citations.findings, ...pins];
    for (const f of findings) {
        process.stdout.write(`❌  ${f.file}:${String(f.line)}  ${f.message}\n`);
    }
    if (findings.length === 0 && !quiet) {
        process.stdout.write(
            `✅  abstraction thresholds: every numeric extraction threshold cites the canon; all pins hold\n`,
        );
    }
    // gate-coverage contract (src/config/gate-coverage.yml): files inspected.
    process.stdout.write(`scanned: ${String(citations.scanned)}\n`);
    return findings.length > 0 ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main());
}
