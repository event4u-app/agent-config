#!/usr/bin/env tsx
/**
 * Code-graph benchmark **v3**, suites A–E — third-party subjects, deterministic,
 * zero model calls (road-to-a-graph-that-wins step 2.3).
 *
 *   tsx internal/bench/code-graph/run_bench_v3.ts --subjects-dir <dir>
 *       [--clone] [--foreign <subject>=<graph.json>]… [--date YYYY-MM-DD]
 *       [--suite-a] [--force] [--truth <truth-v3-DATE.yaml>]
 *
 * `--truth` takes the file `oracle_truth.ts` writes and `apply_check.ts` seals. It is
 * refused while any item of the registered 20 % sample lacks a verdict, or while a
 * delegated verdict does not name its checker; after that, an item counts when the
 * oracle answered it completely or a check sealed it, and anything else stays PENDING.
 * The checker (`human` or `council`) is printed beside every result.
 *
 * Registered by `PREREGISTRATION-v3-2026-11-05.md` before this runner existed. The
 * arms, the verb map, the scoring and the refusal rules are that document's; where
 * it is silent this runner follows `run_bench_inrepo_v2.ts`, whose endpoint-to-file
 * rule and relevance filter it imports rather than copies.
 *
 * Refusals, each a non-zero exit naming the cause:
 * - any registered input whose SHA-256 differs from the registration's Hashes block;
 * - a subject clone whose `git rev-parse HEAD` is not its pin (`--clone` clones a
 *   missing subject from its fork with plain git, then checks the pin out; the
 *   runner never clones otherwise);
 * - `git grep` exiting above 1, or an engine verb throwing.
 *
 * Truth: while a question carries `truth: pending-oracle` its score is PENDING, never
 * a number, and every arm's raw answer is still written to the trace so it can be
 * scored when the oracle lands. Suite D (`expected: empty`) is a clean-rate.
 *
 * The foreign arm, when no export is passed for a subject, is ABSENT: kept out of
 * every aggregate and printed as ABSENT, never as zero.
 *
 * Suite A is the v2 runner, unchanged (`--suite-a` spawns it under its own report
 * stem). Suite F is agentic and is not run here.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as yaml from 'js-yaml';

import { withDeclaringFileTests, testsForModuleAnswer } from '../../../src/scripts/code_graph/answer_correctness.js';
import { buildFromRepo } from '../../../src/scripts/code_graph/build.js';
import { affected, loadGraph, path as graphPath, query, resolveSeeds, type LoadedGraph } from '../../../src/scripts/code_graph/query.js';
import { isTestFile } from '../../../src/scripts/code_graph/scope.js';
import type { EdgeConfidence } from '../../../src/scripts/code_graph/types.js';
import { impact, type ChangedHunk } from '../../../src/scripts/code_graph/verbs.js';
import { readForeignGraph } from './foreign_reader.js';
import { fileOfEndpoint, isRelevantRelation } from './run_bench_inrepo_v2.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const PREREG_FILE = 'PREREGISTRATION-v3-2026-11-05.md';
const CORPUS_FILE = 'corpus-v3-2026-11-05.yaml';
const V2_RUNNER = 'run_bench_inrepo_v2.ts';

/** v2's budget for every engine verb, kept. */
const VERB_BUDGET = 500;
/** Bars, registration § Bars. */
const RECALL_DELTA_REQUIRED_PP = 10;
const PRECISION_FLOOR_PP = 5;
/** The class whose verdict is computed on `unopim` alone (registration § larasend deviation). */
const ROUTE_CLASS = 'route-trace';
const ROUTE_VERDICT_SUBJECT = 'unopim';
const NEGATIVE_CLASS = 'negative-control';
const SCORED_CLASSES = ['precise-semantics', 'route-trace', 'model-table', 'tests-for', 'change-impact', 'change-impact-xplane'] as const;

/** Excluded from every root (corpus header): applied to the grep pathspec and to every engine answer. */
const EXCLUDE_GLOBS = [
    '**/vendor/**',
    '**/node_modules/**',
    'public/**/build/**',
    '**/storage/**',
    'bootstrap/cache/**',
    '**/composer.lock',
    '**/package-lock.json',
    '**/yarn.lock',
    '**/pnpm-lock.yaml',
    '**/bun.lock',
    '**/bun.lockb',
];
const EXCLUDE_RE = [
    /(^|\/)vendor\//,
    /(^|\/)node_modules\//,
    /^public\/(.+\/)?build\//,
    /(^|\/)storage\//,
    /^bootstrap\/cache\//,
    /(^|\/)(composer\.lock|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?)$/,
];
export function isExcluded(rel: string): boolean {
    return EXCLUDE_RE.some((re) => re.test(rel));
}


export interface RegisteredHash {
    sha256: string;
    path: string;
}

/** Every `<sha256>  <path>` line inside the registration's `## Hashes` section. */
export function parseRegisteredHashes(prereg: string): RegisteredHash[] {
    const at = prereg.search(/^## Hashes/m);
    if (at < 0) return [];
    const out: RegisteredHash[] = [];
    for (const line of prereg.slice(at).split('\n')) {
        const m = line.match(/^([0-9a-f]{64})\s+(\S+)\s*$/);
        if (m?.[1] !== undefined && m[2] !== undefined) out.push({ sha256: m[1], path: m[2] });
    }
    return out;
}

function sha256File(p: string): string {
    return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

/** One problem line per registered input that is missing or changed; empty = intact. */
export function checkRegisteredHashes(repoRoot: string, prereg: string): string[] {
    const want = parseRegisteredHashes(prereg);
    if (want.length === 0) return ['the registration carries no Hashes block — run voided'];
    const problems: string[] = [];
    for (const w of want) {
        const abs = path.join(repoRoot, w.path);
        if (!fs.existsSync(abs)) {
            problems.push(`registered input missing: ${w.path}`);
            continue;
        }
        const got = sha256File(abs);
        if (got !== w.sha256) problems.push(`registered input changed: ${w.path}\n  got  ${got}\n  want ${w.sha256}`);
    }
    return problems;
}


/** `null` when `dir` is a git clone whose HEAD is `pin`; otherwise why not. */
export function verifySubjectPin(dir: string, pin: string): string | null {
    if (!fs.existsSync(dir)) return `subject clone not found: ${dir}`;
    const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf-8' });
    if (r.status !== 0) return `not a git clone: ${dir} — ${(r.stderr ?? '').trim().slice(0, 200)}`;
    const head = (r.stdout ?? '').trim();
    if (head !== pin) return `subject ${dir} is at ${head}, not at its registered pin ${pin}`;
    return null;
}

function cloneSubject(repo: string, pin: string, dir: string): string | null {
    const c = spawnSync('git', ['clone', '--filter=blob:none', `https://github.com/${repo}.git`, dir], { encoding: 'utf-8' });
    if (c.status !== 0) return `git clone of ${repo} failed: ${(c.stderr ?? '').trim().slice(0, 200)}`;
    const co = spawnSync('git', ['checkout', '--quiet', pin], { cwd: dir, encoding: 'utf-8' });
    if (co.status !== 0) return `git checkout ${pin} in ${dir} failed: ${(co.stderr ?? '').trim().slice(0, 200)}`;
    return null;
}


export interface Question {
    id: string;
    suite: string;
    class: string;
    shape?: string;
    subject: string;
    language: string;
    target_language?: string;
    question: string;
    probe: string;
    probe_to?: string;
    hop_stratum?: number | string;
    truth?: unknown;
    expected?: unknown;
}
interface Subject {
    name: string;
    repo: string;
    pin: string;
}
interface Corpus {
    corpus_version: number;
    subjects: Subject[];
    questions: Question[];
}

/** `lowerBound`: registration § Residual strata item 2 — scored recall-only. */
export type Truth = { kind: 'pending' } | { kind: 'expected-empty' } | { kind: 'set'; files: string[]; lowerBound?: true };

export function truthOf(q: { truth?: unknown; expected?: unknown }): Truth {
    if (q.expected === 'empty') return { kind: 'expected-empty' };
    if (Array.isArray(q.truth)) {
        const files = q.truth
            .map((t) => (typeof t === 'string' ? t : typeof t === 'object' && t !== null && typeof (t as { path?: unknown }).path === 'string' ? (t as { path: string }).path : null))
            .filter((f): f is string => f !== null);
        return { kind: 'set', files };
    }
    return { kind: 'pending' };
}

/** `truth-v3-<date>.yaml`, written by oracle_truth.ts; the corpus itself stays hash-bound. */
export interface TruthDoc {
    /** `checked_by` names who sealed the verdicts; absent means the registered human check. */
    human_check: { sample: string[]; checked_by?: 'human' | 'council' };
    items: {
        id: string;
        status: string;
        files: string[];
        human_checked?: string | null;
        checked?: string | null;
        /** Registration § Residual strata: markings the strict stratum removes, and the recall-only flag. */
        two_voice_files?: string[];
        faked_files?: string[];
        lower_bound?: boolean;
    }[];
}

const VERDICTS = new Set(['agree', 'corrected']);

const verdictOf = (item: TruthDoc['items'][number] | undefined): string => item?.checked ?? item?.human_checked ?? '';

export function truthCheckedBy(doc: TruthDoc): 'human' | 'council' {
    return doc.human_check.checked_by ?? 'human';
}

/**
 * Registration § Truth: no truth is scored until the 20 % sample is checked. A verdict
 * in `checked` is a delegated one and counts only when the file says who gave it.
 * Returns the reason to refuse, or null.
 */
export function truthDocRefusal(doc: TruthDoc): string | null {
    if (doc.human_check.checked_by === undefined && doc.items.some((i) => i.checked != null)) {
        return 'verdicts in `checked` without `human_check.checked_by` — the file must name who checked';
    }
    const unchecked = doc.human_check.sample.filter((id) => !VERDICTS.has(verdictOf(doc.items.find((i) => i.id === id))));
    return unchecked.length > 0 ? `the checked sample is not complete — no verdict (agree | corrected) on ${unchecked.join(', ')}` : null;
}

/**
 * The truth one question takes from an oracle truth file. An item counts when the
 * oracle answered it completely, or when a check sealed it. A negative control the
 * oracle reached is VOID: removed from the clean-rate, listed.
 */
export function truthFromDoc(q: { id: string; truth?: unknown; expected?: unknown }, doc: TruthDoc): Truth | 'void' {
    const item = doc.items.find((i) => i.id === q.id);
    if (q.expected === 'empty') return item?.status === 'void' && verdictOf(item) !== 'corrected' ? 'void' : { kind: 'expected-empty' };
    if (item === undefined) return truthOf(q);
    const sealed = VERDICTS.has(verdictOf(item));
    if (item.status !== 'oracle' && !sealed) return { kind: 'pending' };
    return item.lower_bound === true ? { kind: 'set', files: [...item.files], lowerBound: true } : { kind: 'set', files: [...item.files] };
}

/**
 * The strict stratum (registration § Residual strata): the same truth with the
 * two-voice and faked files removed. It carries no bar and never turns a verdict.
 */
export function strictTruthFromDoc(q: { id: string; truth?: unknown; expected?: unknown }, doc: TruthDoc): Truth | 'void' {
    const t = truthFromDoc(q, doc);
    if (t === 'void' || t.kind !== 'set') return t;
    const item = doc.items.find((i) => i.id === q.id);
    const drop = new Set([...(item?.two_voice_files ?? []), ...(item?.faked_files ?? [])]);
    const files = t.files.filter((f) => !drop.has(f));
    return t.lowerBound ? { kind: 'set', files, lowerBound: true } : { kind: 'set', files };
}

export interface ArmAnswer {
    status: 'ANSWERED' | 'ABSENT';
    files: Set<string>;
    /** Highest confidence label an engine relation gave each returned file. grep carries none. */
    confidence: Map<string, EdgeConfidence>;
    /** The raw verb output (engine) or per-probe hit lines (grep), for later scoring. */
    raw: string[];
    verbs?: string[][];
    refusal?: string;
    wall_ms?: number;
}

export function absentAnswer(): ArmAnswer {
    return { status: 'ABSENT', files: new Set(), confidence: new Map(), raw: [] };
}

export interface Scored {
    status: 'PENDING' | 'SCORED' | 'CLEAN' | 'NOT-CLEAN' | 'ABSENT';
    precision: number | null;
    recall: number | null;
    answered: number | null;
    missed: string[];
    wrong: string[];
    /** Calibration diagnostic, no bar: items carrying EXTRACTED, and how many were not in truth. */
    top_label_items: number | null;
    top_label_wrong: number | null;
}

const r3 = (x: number): number => +x.toFixed(3);

export function scoreAnswer(a: ArmAnswer, truth: Truth): Scored {
    if (a.status === 'ABSENT') return { status: 'ABSENT', precision: null, recall: null, answered: null, missed: [], wrong: [], top_label_items: null, top_label_wrong: null };
    const answered = a.files.size;
    if (truth.kind === 'pending') return { status: 'PENDING', precision: null, recall: null, answered, missed: [], wrong: [], top_label_items: null, top_label_wrong: null };
    if (truth.kind === 'expected-empty') {
        return { status: answered === 0 ? 'CLEAN' : 'NOT-CLEAN', precision: null, recall: null, answered, missed: [], wrong: [...a.files].sort(), top_label_items: null, top_label_wrong: null };
    }
    const expected = new Set(truth.files);
    const hit = [...expected].filter((f) => a.files.has(f));
    const wrong = [...a.files].filter((f) => !expected.has(f)).sort();
    const top = [...a.confidence.entries()].filter(([, c]) => c === 'EXTRACTED').map(([f]) => f);
    return {
        status: 'SCORED',
        recall: r3(expected.size > 0 ? hit.length / expected.size : 1),
        precision: truth.lowerBound ? null : r3(answered > 0 ? hit.length / answered : 0),
        answered,
        missed: [...expected].filter((f) => !a.files.has(f)).sort(),
        wrong,
        top_label_items: a.confidence.size > 0 ? top.length : null,
        top_label_wrong: a.confidence.size > 0 ? top.filter((f) => !expected.has(f)).length : null,
    };
}

export interface ClassSummary {
    status: 'ABSENT' | 'PENDING' | 'SCORED' | 'CLEAN-RATE' | 'EMPTY';
    n: number;
    pending: number;
    precision: number | null;
    recall: number | null;
    clean_rate: number | null;
    overconfidence_rate: number | null;
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * One arm's rows of one class. ABSENT rows are dropped before anything is counted;
 * a class with any PENDING row carries no mean (a partial mean would be a verdict
 * drawn on a sample the registration never named).
 */
export function classSummary(rows: readonly Scored[]): ClassSummary {
    const live = rows.filter((r) => r.status !== 'ABSENT');
    const base = { n: live.length, pending: live.filter((r) => r.status === 'PENDING').length, precision: null, recall: null, clean_rate: null, overconfidence_rate: null };
    if (rows.length > 0 && live.length === 0) return { ...base, status: 'ABSENT' };
    if (live.length === 0) return { ...base, status: 'EMPTY' };
    if (base.pending > 0) return { ...base, status: 'PENDING' };
    const clean = live.filter((r) => r.status === 'CLEAN' || r.status === 'NOT-CLEAN');
    if (clean.length === live.length) return { ...base, status: 'CLEAN-RATE', clean_rate: r3(clean.filter((r) => r.status === 'CLEAN').length / clean.length) };
    const items = live.reduce((a, r) => a + (r.top_label_items ?? 0), 0);
    const wrong = live.reduce((a, r) => a + (r.top_label_wrong ?? 0), 0);
    const labelled = live.some((r) => r.top_label_items !== null);
    const withPrecision = live.filter((r) => r.precision !== null);
    return {
        ...base,
        status: 'SCORED',
        // A recall-only (lower-bound) row has no precision and stays out of its mean.
        precision: withPrecision.length > 0 ? r3(mean(withPrecision.map((r) => r.precision as number))) : null,
        recall: r3(mean(live.map((r) => r.recall ?? 0))),
        overconfidence_rate: labelled && items > 0 ? r3(wrong / items) : null,
    };
}

/**
 * Registration § Bars, the calibration diagnostic (no bar): per class and arm, the share of
 * items carrying the arm's highest confidence label (EXTRACTED) that are not in the truth.
 * grep carries no label, so it has no rate rather than a zero.
 */
export function calibrationSection(cells: ReadonlyArray<{ class: string; subject: string; arms: Record<string, ClassSummary> }>): string[] {
    const rate = (arm: string, c: ClassSummary | undefined): string => {
        if (!c || c.status === 'ABSENT' || c.status === 'PENDING' || c.status === 'EMPTY') return c?.status ?? '—';
        if (arm === 'grep') return 'no label';
        return c.overconfidence_rate === null ? 'no EXTRACTED item' : String(c.overconfidence_rate);
    };
    return [
        '## Calibration diagnostic (no bar)',
        '',
        'Overconfidence rate: the share of returned items carrying the arm\'s highest confidence label (`EXTRACTED`) that are not in the truth. It decides nothing.',
        '',
        '| Class | Subject | grep | native | foreign |',
        '|---|---|---|---|---|',
        ...cells.map((c) => `| ${c.class} | ${c.subject} | ${rate('grep', c.arms['grep'])} | ${rate('native', c.arms['native'])} | ${rate('foreign', c.arms['foreign'])} |`),
        '',
    ];
}

/** Registration § Bars: `arm` against grep. */
export function classVerdict(arm: ClassSummary, grep: ClassSummary): string {
    if (arm.status === 'ABSENT') return 'ABSENT';
    if (arm.status === 'PENDING' || grep.status === 'PENDING') return 'PENDING';
    if (arm.status !== 'SCORED' || grep.status !== 'SCORED') return 'n/a';
    const delta = ((arm.recall ?? 0) - (grep.recall ?? 0)) * 100;
    const precisionOk = (arm.precision ?? 0) >= (grep.precision ?? 0) - PRECISION_FLOOR_PP / 100;
    if (!precisionOk) return 'NULL';
    return delta >= RECALL_DELTA_REQUIRED_PP ? 'WIN' : 'TIE';
}


export interface GrepProbe {
    fixed: boolean;
    pattern: string;
}

const ROUTE_METHOD = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|ANY)\s+(\/\S*)$/;

/** The probes the grep arm runs for a question, in order (registration § Arms 1). */
export function grepArgsFor(q: { class: string; probe: string; probe_to?: string }): GrepProbe[] {
    const out: GrepProbe[] = [];
    if (q.class === ROUTE_CLASS) {
        const m = q.probe.match(ROUTE_METHOD);
        if (m?.[2] !== undefined) {
            for (const seg of m[2].split('/')) if (seg !== '' && !seg.includes('{') && !seg.includes('}')) out.push({ fixed: true, pattern: seg });
        } else out.push({ fixed: true, pattern: q.probe });
    } else out.push({ fixed: false, pattern: `\\b${q.probe}\\b` });
    if (q.probe_to !== undefined) out.push({ fixed: false, pattern: `\\b${q.probe_to}\\b` });
    return out;
}

class ProbeFailure extends Error {}

function armGrep(subjectDir: string, q: Question): ArmAnswer {
    const files = new Set<string>();
    const raw: string[] = [];
    let wall = 0;
    for (const p of grepArgsFor(q)) {
        const args = ['grep', '--line-number', ...(p.fixed ? ['-F', p.pattern] : ['-P', p.pattern]), '--', '.'];
        for (const g of EXCLUDE_GLOBS) args.push(`:(exclude,glob)${g}`);
        const t0 = performance.now();
        const r = spawnSync('git', args, { cwd: subjectDir, encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 });
        wall += performance.now() - t0;
        const status = r.status ?? 2;
        if (status > 1) throw new ProbeFailure(`${q.id}: git grep exited ${status} — ${(r.stderr ?? '').trim().slice(0, 200)}`);
        let hits = 0;
        for (const line of (r.stdout ?? '').split('\n')) {
            const m = line.match(/^(.+?):\d+:/);
            if (m?.[1] === undefined) continue;
            hits += 1;
            files.add(m[1].replace(/^\.\//, ''));
        }
        raw.push(`${p.fixed ? '-F' : '-P'} ${p.pattern} → ${hits} lines`);
    }
    return { status: 'ANSWERED', files, confidence: new Map(), raw, wall_ms: Math.round(wall) };
}


/** Registration § Arms 2: the verb a class is answered with. */
export function verbFor(q: Pick<Question, 'class' | 'shape' | 'probe_to'>): 'affected+query' | 'path' | 'query' | 'tests-for' | 'impact' {
    if (q.class === ROUTE_CLASS) return 'path';
    if (q.class === NEGATIVE_CLASS) return q.shape === 'path' && q.probe_to !== undefined ? 'path' : 'affected+query';
    if (q.class === 'model-table') return 'query';
    if (q.class === 'tests-for') return 'tests-for';
    if (q.class === 'change-impact' || q.class === 'change-impact-xplane') return 'impact';
    return 'affected+query';
}

/** v2's edge-line shape, with the leading confidence label captured. */
const EDGE_LINE = /^\s+(\w+)\s+(\S+)\s+--\S+-->\s+(\S+)\s*$/;
const RANK: Record<string, number> = { EXTRACTED: 3, INFERRED: 2, AMBIGUOUS: 1 };

function note(conf: Map<string, EdgeConfidence>, file: string, label: string): void {
    if (RANK[label] === undefined) return;
    const prev = conf.get(file);
    if (prev === undefined || (RANK[label] ?? 0) > (RANK[prev] ?? 0)) conf.set(file, label as EdgeConfidence);
}

function filesFromLines(lines: readonly string[], tokens: readonly string[] | null, files: Set<string>, conf: Map<string, EdgeConfidence>): void {
    for (const line of lines) {
        const m = line.match(EDGE_LINE);
        if (!m) continue;
        const parts = [m[2] as string, m[3] as string];
        if (tokens !== null && !isRelevantRelation(parts, tokens)) continue;
        for (const p of parts) {
            const f = fileOfEndpoint(p);
            if (f === null || isExcluded(f)) continue;
            files.add(f);
            note(conf, f, m[1] as string);
        }
    }
}

export function armEngine(g: LoadedGraph, q: Question): ArmAnswer {
    const verb = verbFor(q);
    const tokens = q.probe_to !== undefined ? [q.probe, q.probe_to] : [q.probe];
    const files = new Set<string>();
    const conf = new Map<string, EdgeConfidence>();
    const raw: string[] = [];
    const t0 = performance.now();
    let refusal: string | undefined;
    const verbs: string[][] = [];
    if (verb === 'path') {
        verbs.push(['path', q.probe, q.probe_to as string]);
        const r = graphPath(g, q.probe, q.probe_to as string, VERB_BUDGET);
        raw.push(...r.lines.map((l) => `  ${l}`));
        filesFromLines(raw, null, files, conf);
    } else if (verb === 'affected+query' || verb === 'query') {
        const runs = verb === 'query' ? [query(g, q.probe, VERB_BUDGET)] : [affected(g, q.probe, 2, VERB_BUDGET), query(g, q.probe, VERB_BUDGET)];
        if (verb === 'affected+query') verbs.push(['affected', q.probe], ['query', q.probe]);
        else verbs.push(['query', q.probe]);
        for (const r of runs) raw.push(...r.lines.map((l) => `  ${l}`));
        filesFromLines(raw, tokens, files, conf);
    } else if (verb === 'tests-for') {
        verbs.push(['tests-for', q.probe]);
        const r = testsForModuleAnswer(g, q.probe, 'fresh');
        raw.push(`seeds: ${r.seeds.join(', ')}`, ...r.tests.map((t) => `  test ${t}`));
        for (const t of r.tests) {
            const f = fileOfEndpoint(t);
            if (f !== null && !isExcluded(f)) files.add(f);
        }
        for (const e of r.accepted_edges) {
            const f = fileOfEndpoint(e.source);
            if (f !== null && files.has(f)) note(conf, f, e.confidence);
        }
    } else {
        // `impact` takes changed files and hunks; a question names a symbol. The
        // mechanical bridge: the symbol's resolved declarations ARE the change —
        // their files and their spans as hunks — then the CLI's own composition
        // (impact, then the declaring files' tests).
        verbs.push(['impact', q.probe]);
        const seeds = resolveSeeds(g, q.probe);
        const hunks: ChangedHunk[] = [];
        const changed = new Set<string>();
        for (const id of seeds) {
            const n = g.byId.get(id);
            if (n === undefined || n.source_file === '') continue;
            changed.add(n.source_file);
            const loc = n.source_location ?? [];
            const from = loc[0];
            if (from !== undefined) hunks.push({ file: n.source_file, from, to: loc[2] ?? from });
        }
        const r = withDeclaringFileTests(g, impact(g, [...changed], 'fresh', 2, isTestFile, hunks), isTestFile);
        if (r.refusal) refusal = r.refusal;
        raw.push(`seeds: ${r.seeds.join(', ')}`, ...r.producing_edges.map((e) => `  ${e}`), ...r.test_files.map((t) => `  test ${t}`));
        filesFromLines(r.producing_edges.map((e) => `  ${e}`), null, files, conf);
        for (const t of r.test_files) if (!isExcluded(t)) files.add(t);
    }
    return { status: 'ANSWERED', files, confidence: conf, raw, verbs, ...(refusal !== undefined ? { refusal } : {}), wall_ms: Math.round(performance.now() - t0) };
}


interface Args {
    subjectsDir: string | null;
    clone: boolean;
    foreign: Map<string, string>;
    date: string;
    suiteA: boolean;
    force: boolean;
    truth: string | null;
}

function parseArgs(argv: string[]): Args | string {
    const a: Args = { subjectsDir: null, clone: false, foreign: new Map(), date: new Date().toISOString().slice(0, 10), suiteA: false, force: false, truth: null };
    for (let i = 0; i < argv.length; i += 1) {
        const k = argv[i];
        const v = argv[i + 1];
        if (k === '--subjects-dir' && v !== undefined) (a.subjectsDir = path.resolve(v)), (i += 1);
        else if (k === '--clone') a.clone = true;
        else if (k === '--suite-a') a.suiteA = true;
        else if (k === '--force') a.force = true;
        else if (k === '--date' && v !== undefined) (a.date = v), (i += 1);
        else if (k === '--truth' && v !== undefined) (a.truth = path.resolve(v)), (i += 1);
        else if (k === '--foreign' && v !== undefined) {
            const eq = v.indexOf('=');
            if (eq <= 0) return `--foreign takes <subject>=<graph.json>, got '${v}'`;
            a.foreign.set(v.slice(0, eq), path.resolve(v.slice(eq + 1)));
            i += 1;
        } else return `unknown argument '${k}'`;
    }
    if (a.subjectsDir === null) return '--subjects-dir <dir> is required';
    return a;
}

interface Row {
    id: string;
    suite: string;
    class: string;
    subject: string;
    language: string;
    target_language?: string;
    hop_stratum?: number | string;
    truth: Truth['kind'];
    verb: string;
    grep: Scored;
    native: Scored;
    foreign: Scored;
    /** Registration § Residual strata: the same answers against the strict truth; no bar. */
    strict?: { grep: Scored; native: Scored; foreign: Scored };
}

export async function main(argv: string[]): Promise<number> {
    const args = parseArgs(argv);
    if (typeof args === 'string') {
        console.error(`run_bench_v3: ${args}`);
        return 2;
    }

    const prereg = fs.readFileSync(path.join(HERE, PREREG_FILE), 'utf-8');
    const problems = checkRegisteredHashes(REPO_ROOT, prereg);
    if (problems.length > 0) {
        for (const p of problems) console.error(p);
        console.error(`run voided — ${PREREG_FILE} binds these inputs; a corrected experiment is a new registration`);
        return 2;
    }
    const corpusSha = sha256File(path.join(HERE, CORPUS_FILE));
    const corpus = yaml.load(fs.readFileSync(path.join(HERE, CORPUS_FILE), 'utf-8')) as Corpus;
    let truthDoc: TruthDoc | null = null;
    if (args.truth !== null) {
        truthDoc = yaml.load(fs.readFileSync(args.truth, 'utf-8')) as TruthDoc;
        const refusal = truthDocRefusal(truthDoc);
        if (refusal !== null) {
            console.error(`run refused: ${refusal}`);
            return 2;
        }
    }
    const voided: string[] = [];

    const tracesDir = path.join(REPO_ROOT, 'internal', 'bench', 'reports', `code-graph-v3-traces-${args.date}`);
    if (fs.existsSync(tracesDir) && !args.force) {
        console.error(`refusing to overwrite ${path.relative(REPO_ROOT, tracesDir)} — pass --force or another --date`);
        return 2;
    }

    // Pins first, for every subject, before any work is done.
    const subjectDirs = new Map<string, string>();
    for (const s of corpus.subjects) {
        const dir = path.join(args.subjectsDir as string, s.name);
        if (!fs.existsSync(dir) && args.clone) {
            const err = cloneSubject(s.repo, s.pin, dir);
            if (err !== null) {
                console.error(err);
                return 2;
            }
        }
        const err = verifySubjectPin(dir, s.pin);
        if (err !== null) {
            console.error(`run refused: ${err}`);
            return 2;
        }
        subjectDirs.set(s.name, dir);
    }

    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-v3-'));
    const natives = new Map<string, LoadedGraph>();
    const foreigns = new Map<string, LoadedGraph>();
    const run: Record<string, unknown> = { native: {}, foreign: {} };
    for (const s of corpus.subjects) {
        const out = path.join(work, `${s.name}.native.json`);
        const t0 = performance.now();
        const b = await buildFromRepo(subjectDirs.get(s.name) as string, out);
        const ms = Math.round(performance.now() - t0);
        natives.set(s.name, loadGraph(out, `native:${s.name}`));
        (run['native'] as Record<string, unknown>)[s.name] = { build_ms: ms, files: b.fileCount, nodes: b.graph.nodes.length, edges: b.graph.edges.length, graph_sha256: sha256File(out) };
        console.log(`native ${s.name}: ${b.fileCount} files, ${b.graph.nodes.length} nodes, ${b.graph.edges.length} edges in ${ms} ms`);

        const fp = args.foreign.get(s.name);
        if (fp === undefined) {
            (run['foreign'] as Record<string, unknown>)[s.name] = { status: 'ABSENT', reason: 'no foreign graph.json passed for this subject' };
            continue;
        }
        if (!fs.existsSync(fp)) {
            console.error(`foreign graph for ${s.name} not found: ${fp}`);
            return 2;
        }
        const read = readForeignGraph(JSON.parse(fs.readFileSync(fp, 'utf-8')));
        if (read === null) {
            console.error(`foreign graph for ${s.name} is not a graph document: ${fp}`);
            return 2;
        }
        const adapted = path.join(work, `${s.name}.foreign.json`);
        fs.writeFileSync(adapted, JSON.stringify(read.graph));
        foreigns.set(s.name, loadGraph(adapted, `foreign:${s.name}`));
        (run['foreign'] as Record<string, unknown>)[s.name] = {
            status: 'PRESENT',
            input_sha256: sha256File(fp),
            nodes: read.graph.nodes.length,
            edges: read.graph.edges.length,
            unmapped_relations: read.unmapped_relations,
            unmapped_confidences: read.unmapped_confidences,
            malformed_edges: read.malformed_edges,
            rewritten_ids: read.rewritten_ids,
        };
    }

    fs.mkdirSync(tracesDir, { recursive: true });
    const traceLines: string[] = [];
    const rows: Row[] = [];
    for (const q of corpus.questions) {
        const dir = subjectDirs.get(q.subject);
        const g = natives.get(q.subject);
        if (dir === undefined || g === undefined) {
            console.error(`question ${q.id} names unknown subject '${q.subject}'`);
            return 2;
        }
        let ga: ArmAnswer;
        let na: ArmAnswer;
        let fa: ArmAnswer;
        try {
            ga = armGrep(dir, q);
            na = armEngine(g, q);
            const fg = foreigns.get(q.subject);
            fa = fg === undefined ? absentAnswer() : armEngine(fg, q);
        } catch (e) {
            console.error(`probe failed, run aborted: ${e instanceof Error ? e.message : String(e)}`);
            return 2;
        }
        const resolved = truthDoc === null ? truthOf(q) : truthFromDoc(q, truthDoc);
        if (resolved === 'void') {
            voided.push(q.id);
            continue;
        }
        const truth = resolved;
        const row: Row = {
            id: q.id, suite: q.suite, class: q.class, subject: q.subject, language: q.language,
            ...(q.target_language !== undefined ? { target_language: q.target_language } : {}),
            ...(q.hop_stratum !== undefined ? { hop_stratum: q.hop_stratum } : {}),
            truth: truth.kind, verb: verbFor(q),
            grep: scoreAnswer(ga, truth), native: scoreAnswer(na, truth), foreign: scoreAnswer(fa, truth),
        };
        const strict = truthDoc === null ? 'void' : strictTruthFromDoc(q, truthDoc);
        if (strict !== 'void') row.strict = { grep: scoreAnswer(ga, strict), native: scoreAnswer(na, strict), foreign: scoreAnswer(fa, strict) };
        rows.push(row);
        for (const [arm, a] of [['grep', ga], ['native', na], ['foreign', fa]] as const) {
            traceLines.push(JSON.stringify({
                id: q.id, subject: q.subject, class: q.class, arm, status: a.status,
                verbs: a.verbs ?? null, refusal: a.refusal ?? null, wall_ms: a.wall_ms ?? null,
                files: [...a.files].sort(), confidence: Object.fromEntries([...a.confidence.entries()].sort()), raw: a.raw,
            }));
        }
        const show = (s: Scored): string => (s.status === 'ABSENT' ? 'ABSENT' : `${s.status} n=${s.answered}`);
        console.log(`${q.id} [${q.class}] grep ${show(row.grep)} | native ${show(row.native)} | foreign ${show(row.foreign)}`);
    }
    for (const g of [...natives.values(), ...foreigns.values()]) g.close();
    fs.rmSync(work, { recursive: true, force: true });

    // Per class (route-trace per subject, never pooled), then suite D.
    type Arm = 'grep' | 'native' | 'foreign';
    const ARMS: Arm[] = ['grep', 'native', 'foreign'];
    const cells: Array<{
        class: string;
        subject: string;
        arms: Record<Arm, ClassSummary>;
        native_verdict: string;
        foreign_verdict: string;
        verdict_bearing: boolean;
        strict?: Record<Arm, ClassSummary>;
    }> = [];
    for (const c of SCORED_CLASSES) {
        const groups = c === ROUTE_CLASS ? corpus.subjects.map((s) => s.name) : ['all'];
        for (const sub of groups) {
            const set = rows.filter((r) => r.class === c && (sub === 'all' || r.subject === sub));
            if (set.length === 0) continue;
            const arms = Object.fromEntries(ARMS.map((a) => [a, classSummary(set.map((r) => r[a]))])) as Record<Arm, ClassSummary>;
            const withStrict = set.filter((r) => r.strict !== undefined);
            const strictArms = withStrict.length === set.length && set.length > 0
                ? (Object.fromEntries(ARMS.map((a) => [a, classSummary(withStrict.map((r) => (r.strict as NonNullable<Row['strict']>)[a]))])) as Record<Arm, ClassSummary>)
                : undefined;
            cells.push({
                class: c, subject: sub, arms,
                ...(strictArms === undefined ? {} : { strict: strictArms }),
                native_verdict: classVerdict(arms.native, arms.grep),
                foreign_verdict: classVerdict(arms.foreign, arms.grep),
                verdict_bearing: c !== ROUTE_CLASS || sub === ROUTE_VERDICT_SUBJECT,
            });
        }
    }
    const negatives = rows.filter((r) => r.class === NEGATIVE_CLASS);
    const suiteD = Object.fromEntries(ARMS.map((a) => [a, classSummary(negatives.map((r) => r[a]))])) as Record<Arm, ClassSummary>;
    const pendingQuestions = rows.filter((r) => r.truth === 'pending').length;
    const answersPerArm = Object.fromEntries(ARMS.map((a) => [a, rows.filter((r) => r[a].status !== 'ABSENT').length]));
    const nonEmptyPerArm = Object.fromEntries(ARMS.map((a) => [a, rows.filter((r) => (r[a].answered ?? 0) > 0).length]));
    const byLanguage: Record<string, number> = {};
    for (const r of rows) byLanguage[r.language] = (byLanguage[r.language] ?? 0) + 1;
    const wins = cells.filter((c) => c.verdict_bearing && c.native_verdict === 'WIN').map((c) => c.class);
    // Registration § Bars, amendment of 2026-10-27: every figure per language too (scored classes only, no bar).
    const perLanguage = [...new Set(rows.map((r) => r.language))].sort().map((lang) => {
        const set = rows.filter((r) => r.language === lang && (SCORED_CLASSES as readonly string[]).includes(r.class));
        return { language: lang, n: set.length, arms: Object.fromEntries(ARMS.map((a) => [a, classSummary(set.map((r) => r[a]))])) as Record<Arm, ClassSummary> };
    }).filter((l) => l.n > 0);

    const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf-8' }).stdout.trim();
    const engineTree = spawnSync('git', ['rev-parse', 'HEAD:src/scripts/code_graph'], { cwd: REPO_ROOT, encoding: 'utf-8' }).stdout.trim();
    const summary = {
        benchmark: 'code-graph-v3-suites-B-E',
        date: args.date,
        registration: `internal/bench/code-graph/${PREREG_FILE}`,
        corpus_sha256: corpusSha,
        measured_commit: head,
        engine_tree: engineTree,
        engine_tree_note: 'tree of src/scripts/code_graph at HEAD; an uncommitted engine edit would not show here',
        subjects: corpus.subjects.map((s) => ({ name: s.name, repo: s.repo, pin: s.pin })),
        arms: run,
        questions: rows.length,
        pending_truth: pendingQuestions,
        truth_file: args.truth === null ? null : path.relative(REPO_ROOT, args.truth),
        truth_checked_by: truthDoc === null ? null : truthCheckedBy(truthDoc),
        voided_negative_controls: voided,
        answers_per_arm: answersPerArm,
        non_empty_answers_per_arm: nonEmptyPerArm,
        questions_per_language: byLanguage,
        per_class: cells,
        per_language: perLanguage,
        suite_d: suiteD,
        native_classes_won: wins,
        null_path: pendingQuestions > 0 ? 'PENDING — truth has not landed' : wins.length < 4 ? 'graph-first wording withheld (fewer than 4 of 6 classes won)' : 'graph-first wording supported',
        suite_a: 'v2 runner, unchanged; `--suite-a` spawns it under its own report stem',
        suite_f: 'agentic arms; not run by this runner',
        rows,
    };
    fs.writeFileSync(path.join(tracesDir, 'traces.jsonl'), `${traceLines.join('\n')}\n`);
    fs.writeFileSync(path.join(tracesDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

    const md: string[] = [];
    md.push(`# Code-graph benchmark v3 — suites B–E, ${args.date}`, '');
    md.push(`Registered in \`internal/bench/code-graph/${PREREG_FILE}\`; every registered input matched its SHA-256 before the run. Corpus \`${corpusSha.slice(0, 16)}…\`.`, '');
    md.push(`**Measured commit** \`${head}\` · engine tree \`${engineTree}\`.`, '');
    md.push('| Subject | Pin | native graph | foreign arm |', '|---|---|---|---|');
    for (const s of corpus.subjects) {
        const n = (run['native'] as Record<string, { nodes: number; edges: number; build_ms: number }>)[s.name];
        const f = (run['foreign'] as Record<string, { status: string }>)[s.name];
        md.push(`| ${s.name} | \`${s.pin}\` | ${n?.nodes ?? '?'} nodes · ${n?.edges ?? '?'} edges · ${n?.build_ms ?? '?'} ms | ${f?.status ?? '?'} |`);
    }
    md.push('');
    md.push(`**Truth:** ${pendingQuestions} of ${rows.length} questions are \`pending-oracle\` — scored as PENDING, never as a number. Every arm's raw answer is in \`traces.jsonl\` for scoring once the step-2.2 oracle lands.`, '');
    if (args.truth !== null) md.push(`**Truth file:** \`${path.relative(REPO_ROOT, args.truth)}\`, checked by ${truthDoc === null ? 'nobody' : truthCheckedBy(truthDoc)} · VOID negative controls (removed from the clean-rate): ${voided.length === 0 ? 'none' : voided.join(', ')}.`, '');
    md.push(`**Answers per arm:** grep ${answersPerArm['grep']} (${nonEmptyPerArm['grep']} non-empty) · native ${answersPerArm['native']} (${nonEmptyPerArm['native']} non-empty) · foreign ${answersPerArm['foreign']}${answersPerArm['foreign'] === 0 ? ' — ABSENT, not zero' : ` (${nonEmptyPerArm['foreign']} non-empty)`}.`, '');
    md.push('## Per class (route-trace per subject, never pooled)', '');
    md.push('| Class | Subject | n | grep | native | foreign | native verdict | foreign verdict | verdict-bearing |', '|---|---|---|---|---|---|---|---|---|');
    const cell = (s: ClassSummary): string => (s.status === 'SCORED' ? `P ${s.precision} / R ${s.recall}` : s.status);
    for (const c of cells) md.push(`| ${c.class} | ${c.subject} | ${c.arms.grep.n} | ${cell(c.arms.grep)} | ${cell(c.arms.native)} | ${cell(c.arms.foreign)} | ${c.native_verdict} | ${c.foreign_verdict} | ${c.verdict_bearing ? 'yes' : 'no (larasend route-trace, published beside)'} |`);
    md.push('');
    if (cells.some((c) => c.strict !== undefined)) {
        md.push('## Strict stratum (no bar)', '', 'The same answers against the truth without its two-voice and faked files (registration § Residual strata). It cannot turn a verdict; it shows how much of each result rests on them.', '');
        md.push('| Class | Subject | grep | native | foreign | native verdict under the same rule |', '|---|---|---|---|---|---|');
        for (const c of cells) if (c.strict) md.push(`| ${c.class} | ${c.subject} | ${cell(c.strict.grep)} | ${cell(c.strict.native)} | ${cell(c.strict.foreign)} | ${classVerdict(c.strict.native, c.strict.grep)} |`);
        md.push('');
    }
    md.push(...calibrationSection(cells));
    md.push('## Per language (scored classes, no bar)', '', '| Language | n | grep | native | foreign |', '|---|---|---|---|---|');
    for (const l of perLanguage) md.push(`| ${l.language} | ${l.n} | ${cell(l.arms.grep)} | ${cell(l.arms.native)} | ${cell(l.arms.foreign)} |`);
    md.push('');
    md.push('## Suite D — negative controls (clean-rate, no bar)', '');
    md.push('| Arm | clean rate | n |', '|---|---|---|');
    for (const a of ARMS) md.push(`| ${a} | ${suiteD[a].status === 'CLEAN-RATE' ? suiteD[a].clean_rate : suiteD[a].status} | ${suiteD[a].n} |`);
    md.push('', 'An item the oracle later finds non-empty is VOID and leaves the clean-rate; none is voided before the oracle has run.', '');
    md.push('## Null path', '', `${summary.null_path}.`, '');
    md.push('## Not in this run', '', '- **Suite A** is the v2 runner, unchanged (`--suite-a`).', '- **Suite F** is agentic and runs separately.', '');
    md.push('## Per question', '', '| id | class | subject | lang | verb | grep n | native n | foreign | score |', '|---|---|---|---|---|---|---|---|---|');
    for (const r of rows) md.push(`| \`${r.id}\` | ${r.class} | ${r.subject} | ${r.language} | ${r.verb} | ${r.grep.answered} | ${r.native.answered} | ${r.foreign.status === 'ABSENT' ? 'ABSENT' : r.foreign.answered} | ${r.native.status} |`);
    md.push('');
    const reportMd = path.join(REPO_ROOT, 'internal', 'bench', 'reports', `code-graph-v3-${args.date}.md`);
    fs.writeFileSync(reportMd, `${md.join('\n')}\n`);
    fs.writeFileSync(path.join(tracesDir, 'summary.md'), `${md.join('\n')}\n`);

    console.log('');
    console.log(`pending truth: ${pendingQuestions}/${rows.length} · answers grep ${answersPerArm['grep']} native ${answersPerArm['native']} foreign ${answersPerArm['foreign'] === 0 ? 'ABSENT' : answersPerArm['foreign']}`);
    console.log(`suite D clean rate: grep ${suiteD.grep.clean_rate ?? suiteD.grep.status} · native ${suiteD.native.clean_rate ?? suiteD.native.status} · foreign ${suiteD.foreign.clean_rate ?? suiteD.foreign.status}`);
    console.log(`wrote ${path.relative(REPO_ROOT, tracesDir)}/ and ${path.relative(REPO_ROOT, reportMd)}`);
    console.log('suite F (agentic) is not run by this runner — it runs separately.');

    if (args.suiteA) {
        console.log('suite A: running the v2 runner unchanged …');
        const a = spawnSync(process.execPath, [...process.execArgv, path.join(HERE, V2_RUNNER), '--report-stem', `code-graph-v3-suite-a-${args.date}`], { cwd: REPO_ROOT, stdio: 'inherit' });
        if (a.status !== 0) {
            console.error(`suite A (v2 runner) exited ${a.status}`);
            return 2;
        }
    } else console.log('suite A is the v2 runner, unchanged — pass --suite-a to run it.');
    return 0;
}

const invokedDirectly = (() => {
    const entry = process.argv[1];
    if (entry === undefined) return false;
    try {
        return path.resolve(entry) === fileURLToPath(import.meta.url);
    } catch {
        return false;
    }
})();

if (invokedDirectly) process.exit(await main(process.argv.slice(2)));
