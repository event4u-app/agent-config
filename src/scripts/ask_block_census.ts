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
 *   1. `bypass`      — a line recording an EXPLICIT user bypass of a gate
 *                       ("just write it", "skip closure", "einfach machen").
 *                       Its own axis, and that is the whole point: a bypass is
 *                       a decision the user took, and counting it as an absent
 *                       closure would read as a surface that forgot to close
 *                       rather than one the user told to stop. It is also never
 *                       inferred — only an explicit phrasing matches.
 *   2. `count-only`   — a line that renders a NUMBER where a question belongs:
 *                       it mentions `question(s)` and carries a `{count}`
 *                       placeholder. This is the shape that prints how many
 *                       decisions are outstanding instead of putting one.
 *   3. `file-parked`  — an `Open questions` SECTION heading whose body carries
 *                       no ask obligation. The section is then a parking lot:
 *                       a place a question is written down instead of asked.
 *   4. `batch`        — a run of non-blank lines carrying TWO OR MORE question
 *                       lines: one hand-back, several decisions.
 *   5. `single`       — the same run carrying exactly one.
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
 * THE NATIVE-ASK RATE is carried IN, not computed here. It is a transcript
 * measurement (`probe_unblocked_ask --limit N --store …`), and a transcript
 * store is a property of the machine, not of the commit — computing it inside
 * this script would make the artefact non-reproducible on any other checkout
 * and quietly break the byte-identity the pin promises. So it arrives as three
 * explicit flags carrying the numerator, the denominator and the source they
 * were read from, and the artefact records all three. Same flags, same bytes.
 *
 * WHAT IT IS NOT: a gate. It exits 0 whatever it counts. Its output is a frozen
 * artefact pinned to a commit, and the only legitimate use of a later run is to
 * diff two artefacts — never to quote a number in prose.
 *
 * Usage:
 *   ./scripts-run src/scripts/ask_block_census [--root PREFIX]... [--file PATH]
 *   ./scripts-run src/scripts/ask_block_census --write [--out PATH]
 *        [--native-asks N --unblocked-asks M --native-source TEXT]
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
export const ASK_CLASSES = ['single', 'batch', 'count-only', 'file-parked', 'bypass'] as const;
export type AskClass = (typeof ASK_CLASSES)[number];

/** Default scan roots. `src/domains` is narrowed to `command.md` — the ask surface. */
export const DEFAULT_ROOTS: readonly string[] = [
    'src/domains',
    'src/skills',
    'src/agent-src/contexts',
];

/**
 * An EXPLICIT user bypass of a gate. Every alternative is a phrasing the user
 * types; none of them is a state the agent can infer. A mission grant, an
 * autonomy setting and momentum are deliberately absent from this list — an
 * inferred bypass is the failure this axis exists to make visible, not a
 * second way to match.
 */
export const BYPASS_RE =
    /\b(?:just write it|just do it|skip (?:the )?(?:closure|protocol|validation)|einfach machen|mach einfach|skip closure)\b/i;

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

/**
 * THE FOUR AXES
 *
 * The class above says what SHAPE an ask has. It does not say whether the ask
 * should have existed, and that is the question the targets are about. Four
 * axes, each decidable from the region and its file — never from intent:
 *
 *   `phase`               planning · execution · delivery. Read from the file's
 *                         role, because "an owner ask in execution" and the same
 *                         ask during planning are different defects: planning is
 *                         where a decision is SUPPOSED to be closed.
 *   `ownership`           which class the ask routes to, from the same mapping
 *                         `closure_scan` uses. `unknown` when the region carries
 *                         no signal — reported as unknown, never as technical.
 *   `avoidable`           the ask is one the surface could have closed itself: a
 *                         commit / push / CI / conflict ask, a continuation, a
 *                         count, or a TECHNICAL question routed to the owner.
 *   `resolver_attempted`  the region names a rung it tried before asking —
 *                         evidence, convention, the agent, an independent
 *                         session, the council, the team. An ask that names none
 *                         went to the person first.
 *
 * All four are properties of an AUTHORED surface. The third target — zero
 * repeats of an already-answered question — is a property of a TRANSCRIPT and
 * is reported NOT MEASURED rather than as zero, on the same ground the
 * native-ask rate is carried in rather than computed: a number this script
 * cannot see must not be published as a number it measured.
 */
export const PHASES = ['planning', 'execution', 'delivery'] as const;
export type Phase = (typeof PHASES)[number];

/** Path fragments that put a file in a phase. First match wins, in order. */
const PHASE_MARKERS: ReadonlyArray<readonly [Phase, RegExp]> = [
    ['delivery', /(commit|\/pr\/|pull-request|release|push|merge)/],
    [
        'planning',
        /(roadmap\/create|roadmap\/materialize|feature\/plan|feature\/roadmap|challenge-me|analyze\/|refine-ticket|estimate-ticket|plan-confidence)/,
    ],
    ['execution', /(process-full|process-phase|process-step|implement-ticket|work|roadmap-process-loop|jira-ticket)/],
];

/** Ask shapes the surface could have closed itself. */
export const AVOIDABLE_RE =
    /\b(?:shall i (?:continue|go on|proceed)|weiter\?|should i commit|commit this|one commit or multiple|push (?:this|it)\?|re-?run ci|resolve the conflicts?\?|which branch|new pr\?)\b/i;

/** A rung named before the ask — the region tried something first. */
export const RESOLVER_RE =
    /\b(?:evidence|convention|ADR-\d+|contract|independent session|the council|council:status|the team|ai_team)\b/i;

/** Ownership signals, the same mapping the closure detector uses. */
const OWNERSHIP_MARKERS: ReadonlyArray<readonly [string, RegExp]> = [
    ['destructive-owned', /\b(?:merge|force-push|deploy|publish|purchase|delete the branch)\b/i],
    ['product-owned', /\b(?:user-visible|what the user sees|product semantics|UX)\b/i],
    ['business-owned', /\b(?:deadline|budget|policy|pricing)\b/i],
    ['spend-exhaustion', /\b(?:ceiling|quota|spend)\b/i],
    ['critical-technical', /\b(?:security|auth|tenant|authority)\b/i],
    ['contested-technical', /\b(?:architecture|two valid|trade-?off|migration design)\b/i],
    ['reversible-technical', /\b(?:refactor|test organisation|pattern)\b/i],
    ['deterministic', /\b(?:naming|file placement|commit split)\b/i],
];

/** The three owner-routed classes — the ones an ask legitimately reaches. */
const OWNER_OWNED: ReadonlySet<string> = new Set([
    'product-owned',
    'business-owned',
    'destructive-owned',
]);

export function phaseOf(file: string): Phase {
    for (const [phase, re] of PHASE_MARKERS) {
        if (re.test(file)) return phase;
    }
    return 'planning';
}

export function ownershipOf(text: string): string {
    for (const [cls, re] of OWNERSHIP_MARKERS) {
        if (re.test(text)) return cls;
    }
    return 'unknown';
}

export interface Region {
    readonly cls: AskClass;
    readonly line: number;
    readonly questions: number;
    /** The region's own text, for the axis classifiers. */
    readonly text: string;
}

/** One region with its four axes resolved. */
export interface AxisRow {
    readonly file: string;
    readonly line: number;
    readonly cls: AskClass;
    readonly phase: Phase;
    readonly ownership: string;
    /** A commit / push / CI / conflict / continuation ask — target 2's subject. */
    readonly workflow: boolean;
    readonly avoidable: boolean;
    readonly resolver_attempted: boolean;
}

export function axesFor(file: string, region: Region): AxisRow {
    const ownership = ownershipOf(region.text);
    const technical = ownership !== 'unknown' && !OWNER_OWNED.has(ownership);
    const phase = phaseOf(file);
    const workflow = AVOIDABLE_RE.test(region.text);
    return {
        file,
        line: region.line,
        cls: region.cls,
        phase,
        ownership,
        workflow,
        // A technical question put to a person in EXECUTION is avoidable by
        // construction: planning owned it, and the ownership ladder closes it
        // without a person at all.
        avoidable: workflow || (technical && phase === 'execution'),
        resolver_attempted: RESOLVER_RE.test(region.text),
    };
}

/** The three targets, and whether the corpus meets them. */
export interface Targets {
    readonly technical_owner_asks_in_execution: number;
    readonly workflow_asks: number;
    /** Transcript-only. `null` is NOT MEASURED, never zero. */
    readonly repeat_asks: number | null;
}

export function targets(rows: readonly AxisRow[]): Targets {
    const asks = rows.filter((r) => r.cls === 'single' || r.cls === 'batch');
    return {
        technical_owner_asks_in_execution: asks.filter(
            (r) =>
                r.phase === 'execution' &&
                r.ownership !== 'unknown' &&
                !OWNER_OWNED.has(r.ownership),
        ).length,
        workflow_asks: asks.filter((r) => r.workflow).length,
        repeat_asks: null,
    };
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
        if (BYPASS_RE.test(line)) {
            out.push({ cls: 'bypass', line: i + 1, questions: 0, text: line });
            consumed.add(i);
            continue;
        }
        if (COUNT_ONLY_RE.test(line) && COUNT_PLACEHOLDER_RE.test(line)) {
            out.push({ cls: 'count-only', line: i + 1, questions: 0, text: line });
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
            out.push({ cls: 'file-parked', line: i + 1, questions: 0, text: body.join(' ') });
        }
    }

    let start = -1;
    let questions = 0;
    let end = -1;
    const flush = (): void => {
        if (start >= 0 && questions > 0) {
            out.push({
                cls: questions >= 2 ? 'batch' : 'single',
                line: start + 1,
                questions,
                text: lines.slice(start, end + 1).join(' '),
            });
        }
        start = -1;
        questions = 0;
        end = -1;
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
        end = i;
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

/** The native-ask rate, carried in from a transcript probe with its source. */
export interface NativeRate {
    readonly native: number;
    readonly unblocked: number;
    readonly source: string;
}

export interface Census {
    readonly roots: readonly string[];
    readonly totals: Record<AskClass, number>;
    readonly files: readonly FileCensus[];
    readonly scanned: number;
    readonly axes: readonly AxisRow[];
}

/** One line per target, for the terminal summary. */
export function renderTargets(t: Targets): string[] {
    const verdict = (n: number): string => (n === 0 ? 'MET' : `MISSED (${String(n)})`);
    return [
        `  target: zero technical owner asks in execution  ${verdict(t.technical_owner_asks_in_execution)}`,
        `  target: zero commit/push/CI/conflict asks       ${verdict(t.workflow_asks)}`,
        `  target: zero repeats of an answered question    NOT MEASURED (transcript axis)`,
    ];
}

function zero(): Record<AskClass, number> {
    return { single: 0, batch: 0, 'count-only': 0, 'file-parked': 0, bypass: 0 };
}

export function census(roots: readonly string[], only: string | null): Census {
    const totals = zero();
    const axes: AxisRow[] = [];
    const files: FileCensus[] = [];
    // Renamed off `targets` — that name is the exported target-summary
    // function now, and a local shadowing it reads as a call site that works.
    const targetFiles = only
        ? [path.join(REPO_ROOT, only)]
        : roots.flatMap((r) => filesUnder(r));
    for (const abs of targetFiles) {
        let text: string;
        try {
            text = fs.readFileSync(abs, 'utf8');
        } catch {
            continue;
        }
        const counts = zero();
        const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/');
        for (const r of scanFile(text)) {
            counts[r.cls] += 1;
            totals[r.cls] += 1;
            axes.push(axesFor(rel, r));
        }
        if (ASK_CLASSES.some((c) => counts[c] > 0)) {
            files.push({ file: path.relative(REPO_ROOT, abs).split(path.sep).join('/'), counts });
        }
    }
    return { roots, totals, files, scanned: targetFiles.length, axes };
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

export function render(c: Census, native: NativeRate | null): string {
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
    lines.push('## Native-ask rate');
    lines.push('');
    if (native === null) {
        lines.push(
            'NOT MEASURED in this run. The rate is a transcript measurement carried in via',
        );
        lines.push(
            '`--native-asks` / `--unblocked-asks` / `--native-source`; absent, it is recorded as',
        );
        lines.push('absent rather than as zero.');
    } else {
        const pct =
            native.unblocked === 0
                ? 'n/a'
                : `${((100 * native.native) / native.unblocked).toFixed(1)}%`;
        lines.push(
            `- **Native asks:** ${String(native.native)} of ${String(native.unblocked)} unblocked asks (${pct})`,
        );
        lines.push(`- **Source:** ${native.source}`);
        lines.push('');
        lines.push(
            'A native ask is a hand-back carrying a structured-ask tool call. No host in the',
        );
        lines.push(
            'capability registry has an observed structured-ask tool, so a zero here is a',
        );
        lines.push('MEASURED zero, not an uninstrumented one.');
    }
    lines.push('');
    lines.push('## Axes');
    lines.push('');
    lines.push(
        'Four axes per ask region — `phase`, `ownership`, `avoidable`,',
    );
    lines.push(
        '`resolver_attempted`. Every one is decidable from the region and its file;',
    );
    lines.push('none is read from intent.');
    lines.push('');
    lines.push('| phase | regions | avoidable | resolver named |');
    lines.push('|---|---|---|---|');
    for (const phase of PHASES) {
        const rows = c.axes.filter((r) => r.phase === phase);
        lines.push(
            `| \`${phase}\` | ${String(rows.length)} | ` +
                `${String(rows.filter((r) => r.avoidable).length)} | ` +
                `${String(rows.filter((r) => r.resolver_attempted).length)} |`,
        );
    }
    lines.push('');
    lines.push('| ownership | regions |');
    lines.push('|---|---|');
    const byOwnership = new Map<string, number>();
    for (const r of c.axes) byOwnership.set(r.ownership, (byOwnership.get(r.ownership) ?? 0) + 1);
    for (const key of [...byOwnership.keys()].sort()) {
        lines.push(`| \`${key}\` | ${String(byOwnership.get(key) ?? 0)} |`);
    }
    lines.push('');
    lines.push('### Targets');
    lines.push('');
    const t = targets(c.axes);
    const verdict = (n: number): string => (n === 0 ? 'MET' : `MISSED (${String(n)})`);
    lines.push(
        `- **Zero technical owner asks in execution:** ${verdict(t.technical_owner_asks_in_execution)}`,
    );
    lines.push(`- **Zero commit / push / CI / conflict asks:** ${verdict(t.workflow_asks)}`);
    lines.push(
        '- **Zero repeats of an already-answered question:** NOT MEASURED — a repeat is a',
    );
    lines.push(
        '  property of a TRANSCRIPT, not of an authored surface. Reported absent rather than',
    );
    lines.push('  as zero, on the same ground the native-ask rate is carried in.');
    if (t.technical_owner_asks_in_execution > 0 || t.workflow_asks > 0) {
        lines.push('');
        lines.push('Rows that miss a target:');
        lines.push('');
        for (const r of c.axes) {
            if (r.cls !== 'single' && r.cls !== 'batch') continue;
            const missesOne =
                r.phase === 'execution' && r.ownership !== 'unknown' && !OWNER_OWNED.has(r.ownership);
            if (!missesOne && !r.workflow) continue;
            lines.push(
                `- \`${r.file}:${String(r.line)}\` — ${r.cls}, ${r.phase}, ${r.ownership}` +
                    (r.workflow ? ', workflow ask' : ''),
            );
        }
    }
    lines.push('');
    lines.push('## Per file');
    lines.push('');
    // Derived from ASK_CLASSES rather than written out: a hand-written header
    // and a derived Totals block drift the moment a class is added, and the
    // drift is silent because both tables still render.
    lines.push(`| file | ${ASK_CLASSES.join(' | ')} |`);
    lines.push(`|${'---|'.repeat(ASK_CLASSES.length + 1)}`);
    for (const f of c.files) {
        lines.push(
            `| \`${f.file}\` | ${ASK_CLASSES.map((cls) => String(f.counts[cls])).join(' | ')} |`,
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
            'an explicit user bypass is its own axis',
            'An explicit *just write it* drops the closure pass.\n',
            'bypass',
            1,
        ],
        [
            'a bypass line is not also counted as a question',
            'Did the user say just write it?\n',
            'single',
            0,
        ],
        [
            'a mission grant is NOT a bypass — an inferred one never matches',
            'The mission grant authorises the run end to end.\n',
            'bypass',
            0,
        ],
        [
            'an autonomy setting is NOT a bypass either',
            'With personal.autonomy on, trivial questions are suppressed.\n',
            'bypass',
            0,
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
    let nativeAsks: number | null = null;
    let unblockedAsks: number | null = null;
    let nativeSource: string | null = null;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--self-test') return selfTest();
        else if (a === '--root') roots.push(String(argv[++i]));
        else if (a === '--file') only = String(argv[++i]);
        else if (a === '--out') out = String(argv[++i]);
        else if (a === '--write') write = true;
        else if (a === '--json') json = true;
        else if (a === '--regions') regions = true;
        else if (a === '--native-asks') nativeAsks = Number(argv[++i]);
        else if (a === '--unblocked-asks') unblockedAsks = Number(argv[++i]);
        else if (a === '--native-source') nativeSource = String(argv[++i]);
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
        const native: NativeRate | null =
            nativeAsks !== null && unblockedAsks !== null && nativeSource !== null
                ? { native: nativeAsks, unblocked: unblockedAsks, source: nativeSource }
                : null;
        fs.writeFileSync(target, render(c, native), 'utf8');
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
    for (const line of renderTargets(targets(c.axes))) {
        process.stdout.write(`${line}\n`);
    }
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
