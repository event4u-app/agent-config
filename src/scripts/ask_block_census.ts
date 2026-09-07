#!/usr/bin/env tsx
/**
 * The ask-block census — how this package's own authored surfaces put decisions
 * to the user, counted by a unit that is defined before it is counted.
 *
 * road-to-asked-not-parked 1.2. The source draft carried a figure of 157
 * batch-shaped commands. It does not reproduce — the natural grep returns 129 —
 * so NO number is carried forward from it. The definition below is this
 * script's own, and it is published here, above any count, because a
 * classification that counts `1.`-lines instead of decision regions produces a
 * number that moves without the surface moving.
 *
 * THE UNIT
 *
 * A **region** is one contiguous stretch of an authored file. Every region
 * falls into exactly one of four classes, decided in this precedence order:
 *
 *   1. `count-only`   — a line that renders a NUMBER where a question belongs:
 *                       it mentions `question(s)` and carries a `{count}`
 *                       placeholder. This is the shape that prints how many
 *                       decisions are outstanding instead of putting one.
 *   2. `file-parked`  — an `Open questions` SECTION heading whose body carries
 *                       no ask obligation. The section is then a parking lot:
 *                       a place a question is written down instead of asked.
 *   3. `batch`        — a run of non-blank lines carrying TWO OR MORE question
 *                       lines: one hand-back, several decisions.
 *   4. `single`       — the same run carrying exactly one.
 *
 * A **question line** is a non-blank line that either ends in `?` (after
 * trailing backticks, emphasis and whitespace are stripped) or is a list item
 * whose content carries a `{question…}` placeholder. The placeholder half is
 * load-bearing: `/feature:plan` Round 4 lists its questions as `- {question 1}`
 * bullets and closes with ONE collective `?`, which is precisely the shape the
 * owner named as the hurdle and which a `?`-only detector scores as `single`.
 *
 * FENCED CODE IS NOT STRIPPED, and that is deliberate. The two `{count}`
 * surfaces this census exists to find live inside display templates
 * (`feature/refactor/command.md`, `feature/plan/command.md`) — a fence there is
 * the rendering the user sees, not a documentation example. Stripping fences
 * would make the census blind to its own subject.
 *
 * A FENCE IS ONE REGION, whole. Outside a fence a region is a blank-line-
 * delimited run. The asymmetry is the point: a fenced block in a command file
 * is one rendered hand-back, so three questions separated by blank lines INSIDE
 * it are still three decisions in one turn. Splitting on blank lines there
 * would score `/feature:plan` Round 1 — which the roadmap describes as asking
 * three — as three separate singles, i.e. as already fixed.
 *
 * WHAT IT IS NOT: a gate. It exits 0 whatever it counts. Its output is a frozen
 * artefact pinned to a commit, and the only legitimate use of a later run is to
 * diff two artefacts — never to quote a number in prose.
 *
 * Usage:
 *   ./scripts-run src/scripts/ask_block_census [--root PREFIX]... [--file PATH]
 *   ./scripts-run src/scripts/ask_block_census --write [--out PATH]
 *   ./scripts-run src/scripts/ask_block_census --json
 *   ./scripts-run src/scripts/ask_block_census --file PATH --regions
 *   ./scripts-run src/scripts/ask_block_census --self-test
 *
 * Exit codes: 0 always. `--self-test` exits 1 when a fixture misclassifies.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** The census classes, in precedence order. */
export const ASK_CLASSES = ['single', 'batch', 'count-only', 'file-parked'] as const;
export type AskClass = (typeof ASK_CLASSES)[number];

/** Default scan roots. `src/domains` is narrowed to `command.md` — the ask surface. */
export const DEFAULT_ROOTS: readonly string[] = [
    'src/domains',
    'src/skills',
    'src/agent-src/contexts',
];

/** A line printing a question COUNT where a question belongs. */
export const COUNT_ONLY_RE = /\bquestions?\b/i;
export const COUNT_PLACEHOLDER_RE = /\{count\}/;

/** An `Open questions` section heading, levels 2-4. */
export const PARK_HEADING_RE = /^#{2,4}[ \t]+open questions?\b/i;

/** A fence delimiter. A whole fenced block is ONE region — see the header. */
const FENCE_RE = /^[ \t]*(?:```|~~~)/;

/** Any heading — where a section body ends. */
const ANY_HEADING_RE = /^#{1,6}[ \t]+\S/;

/**
 * An ask obligation stated in prose: the section is owed to the user, not
 * stored. Matched per line so a distant sentence cannot launder a parking lot
 * three sections away.
 */
export const ASK_OBLIGATION_RE =
    /(ask[a-z]*\b[^\n]{0,90}\buser\b)|(\buser\b[^\n]{0,90}\bask[a-z]*\b)|one at a time|one question per|separately before/i;

/** A `{question…}` placeholder inside a list item. */
const QUESTION_PLACEHOLDER_RE = /^[ \t]*(?:[-*+•]|\d+[.)])[ \t]+.*\{question/i;

/** Trailing markdown noise that hides a question mark. */
const TRAILING_NOISE_RE = /[`*_~\s)\]]+$/;

export function isQuestionLine(line: string): boolean {
    if (line.trim() === '') {
        return false;
    }
    if (QUESTION_PLACEHOLDER_RE.test(line)) {
        return true;
    }
    return line.replace(TRAILING_NOISE_RE, '').endsWith('?');
}

export interface Region {
    readonly cls: AskClass;
    readonly line: number;
    readonly questions: number;
}

/**
 * Classify one file's regions.
 *
 * Count-only lines are consumed first and removed from the run-scanner's view,
 * so a `{count}` line that happens to end in `?` cannot be double-counted.
 */
export function scanFile(text: string): Region[] {
    const lines = text.split('\n');
    const out: Region[] = [];
    const consumed = new Set<number>();

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] as string;
        if (COUNT_ONLY_RE.test(line) && COUNT_PLACEHOLDER_RE.test(line)) {
            out.push({ cls: 'count-only', line: i + 1, questions: 0 });
            consumed.add(i);
        }
    }

    for (let i = 0; i < lines.length; i += 1) {
        if (!PARK_HEADING_RE.test(lines[i] as string)) {
            continue;
        }
        let end = i + 1;
        while (end < lines.length && !ANY_HEADING_RE.test(lines[end] as string)) {
            end += 1;
        }
        const body = lines.slice(i, end);
        if (!body.some((l) => ASK_OBLIGATION_RE.test(l))) {
            out.push({ cls: 'file-parked', line: i + 1, questions: 0 });
        }
    }

    let start = -1;
    let questions = 0;
    const flush = (): void => {
        if (start >= 0 && questions > 0) {
            out.push({
                cls: questions >= 2 ? 'batch' : 'single',
                line: start + 1,
                questions,
            });
        }
        start = -1;
        questions = 0;
    };
    let inFence = false;
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] as string;
        if (FENCE_RE.test(line)) {
            flush();
            inFence = !inFence;
            if (inFence) {
                start = i;
            }
            continue;
        }
        if (!inFence && line.trim() === '') {
            flush();
            continue;
        }
        if (start < 0) {
            start = i;
        }
        if (!consumed.has(i) && isQuestionLine(line)) {
            questions += 1;
        }
    }
    flush();

    out.sort((a, b) => a.line - b.line || ASK_CLASSES.indexOf(a.cls) - ASK_CLASSES.indexOf(b.cls));
    return out;
}

/** Every scannable file under one root. `src/domains` contributes `command.md` only. */
function filesUnder(root: string): string[] {
    const abs = path.join(REPO_ROOT, root);
    const out: string[] = [];
    const domainsOnly = root === 'src/domains' || root.startsWith('src/domains/');
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(p);
            } else if (e.name.endsWith('.md') && (!domainsOnly || e.name === 'command.md')) {
                out.push(p);
            }
        }
    };
    walk(abs);
    return out.sort();
}

export interface FileCensus {
    readonly file: string;
    readonly counts: Record<AskClass, number>;
}

export interface Census {
    readonly roots: readonly string[];
    readonly totals: Record<AskClass, number>;
    readonly files: readonly FileCensus[];
    readonly scanned: number;
}

function zero(): Record<AskClass, number> {
    return { single: 0, batch: 0, 'count-only': 0, 'file-parked': 0 };
}

export function census(roots: readonly string[], only: string | null): Census {
    const totals = zero();
    const files: FileCensus[] = [];
    const targets = only
        ? [path.join(REPO_ROOT, only)]
        : roots.flatMap((r) => filesUnder(r));
    for (const abs of targets) {
        let text: string;
        try {
            text = fs.readFileSync(abs, 'utf8');
        } catch {
            continue;
        }
        const counts = zero();
        for (const r of scanFile(text)) {
            counts[r.cls] += 1;
            totals[r.cls] += 1;
        }
        if (ASK_CLASSES.some((c) => counts[c] > 0)) {
            files.push({ file: path.relative(REPO_ROOT, abs).split(path.sep).join('/'), counts });
        }
    }
    return { roots, totals, files, scanned: targets.length };
}

/** `<sha> <ISO commit date>` — the pin. Deterministic at a given commit. */
function pin(): { sha: string; date: string } {
    const git = (args: string[]): string =>
        execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    try {
        return { sha: git(['rev-parse', 'HEAD']), date: git(['show', '-s', '--format=%cI', 'HEAD']) };
    } catch {
        return { sha: 'unknown', date: 'unknown' };
    }
}

export function render(c: Census): string {
    const p = pin();
    const lines: string[] = [];
    lines.push('<!-- evidence-type: analysis -->');
    lines.push(`<!-- ask-block-census: v1 | commit: ${p.sha} | commit-date: ${p.date} -->`);
    lines.push('');
    lines.push('# Ask-block census');
    lines.push('');
    lines.push(
        'Emitted by `src/scripts/ask_block_census.ts`. The classification definition is',
    );
    lines.push(
        'published in that script\'s module header, above any count — read it before reading',
    );
    lines.push('a number here. No figure from the source draft is carried forward.');
    lines.push('');
    lines.push(`- **Commit pin:** \`${p.sha}\` (${p.date})`);
    lines.push(`- **Roots:** ${c.roots.map((r) => `\`${r}\``).join(', ')}`);
    lines.push(`- **Files scanned:** ${String(c.scanned)}`);
    lines.push('');
    lines.push('## Totals');
    lines.push('');
    lines.push('| class | regions |');
    lines.push('|---|---|');
    for (const cls of ASK_CLASSES) {
        lines.push(`| \`${cls}\` | ${String(c.totals[cls])} |`);
    }
    lines.push('');
    lines.push('## Per file');
    lines.push('');
    lines.push('| file | single | batch | count-only | file-parked |');
    lines.push('|---|---|---|---|---|');
    for (const f of c.files) {
        lines.push(
            `| \`${f.file}\` | ${String(f.counts.single)} | ${String(f.counts.batch)} | ` +
                `${String(f.counts['count-only'])} | ${String(f.counts['file-parked'])} |`,
        );
    }
    lines.push('');
    return `${lines.join('\n')}`;
}

export function selfTest(): number {
    const cases: Array<[string, string, AskClass, number]> = [
        [
            'a count placeholder is count-only',
            'OPEN QUESTIONS: {count}\n',
            'count-only',
            1,
        ],
        [
            'a bare Open questions section with no obligation is file-parked',
            '## Open questions\n\n- something\n',
            'file-parked',
            1,
        ],
        [
            'an Open questions section carrying an ask obligation is NOT file-parked',
            '## Open questions\n\nEach one is put to the user separately before the first work step.\n',
            'file-parked',
            0,
        ],
        [
            'two question lines in one run are a batch',
            'What belongs in scope?\nAnd what can we leave out?\n',
            'batch',
            1,
        ],
        [
            'one question line is a single',
            'What belongs in scope?\n',
            'single',
            1,
        ],
        [
            'question placeholders in bullets count as questions',
            'I have some open questions:\n- {question 1}\n- {question 2}\nAny opinion?\n',
            'batch',
            1,
        ],
        [
            'a fence is one region even when blank lines split its questions',
            '```\nDo I understand the problem?\n\nAnd the solution?\n\nWhat is missing?\n```\n',
            'batch',
            1,
        ],
        [
            'prose with no question is neither single nor batch',
            'This paragraph states a fact.\n',
            'single',
            0,
        ],
    ];
    let failed = 0;
    for (const [name, text, cls, want] of cases) {
        const got = scanFile(text).filter((r) => r.cls === cls).length;
        const ok = got === want;
        process.stdout.write(
            `${ok ? '✅' : '❌'}  ${name} — ${cls}=${String(got)}` +
                (ok ? '\n' : ` (wanted ${String(want)})\n`),
        );
        if (!ok) failed += 1;
    }
    process.stdout.write(
        `\nask_block_census --self-test: ${String(cases.length - failed)}/${String(cases.length)} case(s) behaved\n`,
    );
    return failed > 0 ? 1 : 0;
}

export function main(argv: string[]): number {
    const roots: string[] = [];
    let only: string | null = null;
    let out: string | null = null;
    let write = false;
    let json = false;
    let regions = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--self-test') return selfTest();
        else if (a === '--root') roots.push(String(argv[++i]));
        else if (a === '--file') only = String(argv[++i]);
        else if (a === '--out') out = String(argv[++i]);
        else if (a === '--write') write = true;
        else if (a === '--json') json = true;
        else if (a === '--regions') regions = true;
        else {
            process.stderr.write(`ask_block_census: unrecognized argument: ${a}\n`);
            return 0;
        }
    }
    if (regions) {
        if (only === null) {
            process.stderr.write('ask_block_census: --regions needs --file\n');
            return 0;
        }
        const text = fs.readFileSync(path.join(REPO_ROOT, only), 'utf8');
        for (const r of scanFile(text)) {
            process.stdout.write(
                `${only}:${String(r.line)}  ${r.cls}  (question lines: ${String(r.questions)})\n`,
            );
        }
        return 0;
    }
    const c = census(roots.length ? roots : DEFAULT_ROOTS, only);
    if (write) {
        const target = path.join(
            REPO_ROOT,
            out ?? 'agents/evidence/analysis/ask-block-census-baseline.md',
        );
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, render(c), 'utf8');
        process.stdout.write(`ask_block_census: wrote ${path.relative(REPO_ROOT, target)}\n`);
        return 0;
    }
    if (json) {
        process.stdout.write(`${JSON.stringify(c, null, 2)}\n`);
        return 0;
    }
    process.stdout.write(
        `ask_block_census · ${String(c.scanned)} file(s) under ${c.roots.join(', ')}\n`,
    );
    for (const cls of ASK_CLASSES) {
        process.stdout.write(`  ${cls.padEnd(12)} ${String(c.totals[cls])}\n`);
    }
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
