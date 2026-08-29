/**
 * In-repo code-graph vs grep benchmark, **v2** — 2-arm, deterministic, zero
 * model calls.
 *
 * Registered by `internal/bench/code-graph/PREREGISTRATION-inrepo-v2-2026-08-29.md`
 * BEFORE any v2 result existed. A SIBLING of `run_bench_inrepo.ts`, never an
 * edit of it: v1's runner is bound to v1's registration and its report stands.
 *
 * ## Why v2 exists — three scorer defects in v1, all confirmed by execution
 *
 * 1. **The `path-between` class discarded correct answers.** v1's relevance
 *    filter compared each returned node's symbol segment against the ENTIRE
 *    probe string, which for that class was `"cmdBuild -> getParser"`. No
 *    symbol contains that, so every relation was dropped and the class scored
 *    0/0 for the graph arm. The engine had answered; the scorer threw the
 *    answer away.
 * 2. **v1 never invoked the shipped `path` verb.** `cli.ts` dispatches
 *    `path <a> <b>` and implements it; v1's graph arm ran only `affected` and
 *    `query`. The class that asks "is there a path from A to B" was measured
 *    with the two verbs that do not answer it.
 * 3. **`symbol:` pseudo-nodes were counted as files.** `p.split('#')[0]` on an
 *    unresolved endpoint such as `symbol:DatabaseSync` yields the whole token,
 *    which v1 added to a set the scorer treats as files. Every class carrying
 *    unresolved call targets was precision-deflated by it — `callers` was ruled
 *    NULL on the precision floor alone, with recall tied at 1.000/1.000.
 *
 * A fourth defect is not a scorer bug but was silent: `run()` returned a
 * `status` neither arm read, so a crashed probe was indistinguishable from an
 * honest empty answer. Here a non-zero status is a hard failure of the run.
 *
 * NOT COMPARABLE to the 2026-07-28 run, and NOT COMPARABLE to the v1 run of
 * 2026-08-28. Different corpus (19 questions vs 16, two classes restructured),
 * different arm-B verb set, different scorer. No delta may be computed against
 * either.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as yaml from 'js-yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_FILE = 'inrepo-corpus-v2-2026-08-29.yaml';
const PREREG_FILE = 'PREREGISTRATION-inrepo-v2-2026-08-29.md';
const REPORT_STEM = 'code-graph-vs-grep-inrepo-v2-2026-08-29';

/** The extractor repair this benchmark exists to measure against. */
const REPAIR_DATE = '2026-08-22';

const EXCLUDES = ['vendor', 'node_modules', 'dist', '.nuxt', '.git', 'storage'];
const GRAPH_CLASSES = ['callers', 'transitive-impact', 'path-between', 'references'] as const;
const IN_DOMAIN_NEGATIVE = 'negative-control-in-domain';
const CAPABILITY_BOUNDARY = 'capability-boundary';

/** Per-class bars — IDENTICAL to v1's, deliberately. A bar re-chosen after a
 * defect is diagnosed is a bar chosen to fit a number. */
const RECALL_DELTA_REQUIRED_PP = 10;
const PRECISION_FLOOR_PP = 5;

interface TruthSite { path: string; why: string }
interface Question {
    id: string;
    root: string;
    category: string;
    question: string;
    probe: string;
    probe_to?: string;
    probe_kind: 'symbol' | 'literal';
    truth: TruthSite[];
}
interface Root { name: string; path: string }
interface Corpus { corpus_version: number; generated: string; roots: Root[]; questions: Question[] }
interface ArmResult { files: Set<string>; wall_ms: number; output_bytes: number }

class ProbeFailure extends Error {}

function sha256(p: string): string {
    return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function run(cmd: string, args: string[], cwd: string): { stdout: string; stderr: string; wall_ms: number; status: number } {
    const t0 = performance.now();
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', wall_ms: performance.now() - t0, status: r.status ?? 1 };
}

/** Both endpoints for `path-between`, the single probe otherwise. Mechanical. */
function probesOf(q: Question): string[] {
    return q.probe_to !== undefined ? [q.probe, q.probe_to] : [q.probe];
}

/**
 * Arm A — `git grep` over the root, answers = files with >= 1 hit, UNIONED
 * over every probe the question carries. For `path-between` that is two
 * searches rather than one, which is strictly more than v1 gave this arm.
 *
 * `git grep` exits 1 on "no match", which is an answer, not a failure. Any
 * status above 1 is a failure and aborts the run.
 */
function armGrep(rootPath: string, q: Question): ArmResult {
    const files = new Set<string>();
    let wall = 0;
    let bytes = 0;
    for (const probe of probesOf(q)) {
        const args = ['grep', '--line-number'];
        if (q.probe_kind === 'literal') args.push('-F', probe);
        else args.push('-P', `\\b${probe}\\b`);
        args.push('--', '.');
        for (const e of EXCLUDES) args.push(`:(exclude)${e}`, `:(exclude)**/${e}/**`);
        const r = run('git', args, path.join(REPO_ROOT, rootPath));
        if (r.status > 1) throw new ProbeFailure(`${q.id}: git grep exited ${r.status} — ${r.stderr.trim().slice(0, 200)}`);
        wall += r.wall_ms;
        bytes += Buffer.byteLength(r.stdout);
        for (const line of r.stdout.split('\n')) {
            const m = line.match(/^(.+?):\d+:/);
            if (m?.[1] !== undefined) files.add(m[1].replace(/^\.\//, ''));
        }
    }
    return { files, wall_ms: wall, output_bytes: bytes };
}

/**
 * A relation endpoint names a FILE only when its pre-`#` segment carries a file
 * extension and is not an unresolved `symbol:` placeholder. v1 lacked this test
 * and counted `symbol:DatabaseSync` as a file, which deflated graph precision
 * in every class holding an unresolved call target. Defect 3.
 */
export function fileOfEndpoint(endpoint: string): string | null {
    const head = endpoint.split('#')[0];
    if (head === undefined || head.length === 0) return null;
    if (head.startsWith('symbol:')) return null;
    if (!/\.[A-Za-z0-9]+$/.test(head)) return null;
    return head;
}

/**
 * Arm B — the code graph, through the verb that answers the class:
 *
 *   `path-between` → `path <probe> <probe_to>`; the verb returns the path
 *                    itself, so every returned relation IS the answer and no
 *                    relevance filter is applied. Filtering here is exactly
 *                    v1's defect 1: an intermediate hop matches neither
 *                    endpoint by construction, and the intermediates are what
 *                    "and through what?" asks for.
 *   every other class → `affected <probe>` + `query <probe>`, unchanged from
 *                    v1, with the relevance filter applied per probe TOKEN
 *                    rather than against the whole probe string.
 *
 * The split is per class, declared in the pre-registration before the run, and
 * mechanical — no question is routed by hand.
 */
function armGraph(graphPath: string, q: Question): ArmResult {
    const cliTs = path.join(REPO_ROOT, 'src', 'scripts', 'code_graph', 'cli.ts');
    const isPath = q.category === 'path-between' && q.probe_to !== undefined;
    const invocations: string[][] = isPath
        ? [['path', q.probe, q.probe_to as string]]
        : [['affected', q.probe], ['query', q.probe]];
    let stdout = '';
    let wall = 0;
    for (const inv of invocations) {
        const r = run('npx', ['tsx', cliTs, ...inv, '--graph', graphPath, '--budget', '500'], REPO_ROOT);
        if (r.status !== 0) throw new ProbeFailure(`${q.id}: code_graph ${inv[0]} exited ${r.status} — ${r.stderr.trim().slice(0, 200)}`);
        stdout += r.stdout;
        wall += r.wall_ms;
    }
    const tokens = probesOf(q);
    const files = new Set<string>();
    for (const line of stdout.split('\n')) {
        const m = line.match(/^\s+\w+\s+(\S+)\s+--\S+-->\s+(\S+)\s*$/);
        if (!m) continue;
        const parts = [m[1] as string, m[2] as string];
        if (!isPath) {
            const relevant = parts.some((p) => {
                const sym = p.includes('#') ? (p.split('#')[1] ?? '') : path.basename(p);
                return tokens.some((t) => sym === t || sym.includes(t));
            });
            if (!relevant) continue;
        }
        for (const p of parts) {
            const f = fileOfEndpoint(p);
            if (f !== null) files.add(f);
        }
    }
    return { files, wall_ms: wall, output_bytes: Buffer.byteLength(stdout) };
}

function score(answer: Set<string>, q: Question): { precision: number; recall: number; missed: string[]; wrong: string[] } {
    const expected = new Set(q.truth.map((t) => t.path));
    const hit = [...expected].filter((f) => answer.has(f));
    return {
        recall: expected.size > 0 ? hit.length / expected.size : 1,
        precision: answer.size > 0 ? hit.length / answer.size : 0,
        missed: [...expected].filter((f) => !answer.has(f)),
        wrong: [...answer].filter((f) => !expected.has(f)),
    };
}

const mean = (xs: number[]): number => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pp = (x: number): number => +(x * 100).toFixed(1);
const r3 = (x: number): number => +x.toFixed(3);

interface Row {
    id: string; root: string; category: string; question: string;
    grep: { precision: number; recall: number; wall_ms: number; output_bytes: number; answered: number };
    graph: { precision: number; recall: number; wall_ms: number; output_bytes: number; answered: number };
    missed_by_graph: string[]; wrong_by_graph: string[];
    missed_by_grep: string[]; wrong_by_grep: string[];
}

/**
 * The VOID check is carried over from v1 unchanged in mechanism and corrected
 * in wording. In v1 it fired on `path-between` and the note it printed said
 * both arms had returned the empty set — true of the grep arm, FALSE of the
 * graph arm, which had answered and been discarded by the scorer. The note now
 * states only what the runner can see: that this class measured nothing, and
 * that the cause has to be established by reading the arms rather than assumed
 * to be symmetric.
 */
function classVerdict(rows: Row[]): { verdict: string; validity: string; validity_note: string; recall_delta_pp: number; precision_ok: boolean; grep: { p: number; r: number }; graph: { p: number; r: number } } {
    const gR = mean(rows.map((r) => r.grep.recall));
    const gP = mean(rows.map((r) => r.grep.precision));
    const cR = mean(rows.map((r) => r.graph.recall));
    const cP = mean(rows.map((r) => r.graph.precision));
    const delta = pp(cR - gR);
    const precision_ok = cP >= gP - PRECISION_FLOOR_PP / 100;
    let verdict: string;
    if (delta >= RECALL_DELTA_REQUIRED_PP && precision_ok) verdict = 'WIN';
    else if (delta <= -RECALL_DELTA_REQUIRED_PP) verdict = 'NULL';
    else verdict = precision_ok ? 'TIE' : 'NULL';
    const noSignal = rows.every((r) => r.grep.recall === 0 && r.graph.recall === 0 && r.grep.precision === 0 && r.graph.precision === 0);
    const validity = noSignal ? 'VOID — NOTHING MEASURED' : 'VALID';
    const validity_note = noSignal
        ? 'Every question in this class scored zero on every metric for both arms. The registered verdict above is the runner\'s arithmetic and is preserved, but it is not a defensible substantive interpretation. WHY each arm returned nothing must be established by reading that arm — a shared zero is not evidence that the two arms failed for the same reason, and in v1 it was not: the graph arm had answered and the scorer discarded it.'
        : '';
    return { verdict, validity, validity_note, recall_delta_pp: delta, precision_ok, grep: { p: r3(gP), r: r3(gR) }, graph: { p: r3(cP), r: r3(cR) } };
}

function main(): number {
    const corpusPath = path.join(HERE, CORPUS_FILE);
    const preregPath = path.join(HERE, PREREG_FILE);
    if (!fs.existsSync(corpusPath)) { console.error(`missing corpus: ${corpusPath}`); return 2; }

    // --- Pre-registration integrity gate. A mismatch voids the run. ---
    const got = sha256(corpusPath);
    const prereg = fs.readFileSync(preregPath, 'utf-8');
    const want = prereg.match(/^([0-9a-f]{64})\s+inrepo-corpus-v2-2026-08-29\.yaml$/m)?.[1];
    if (want === undefined) { console.error(`pre-registration carries no SHA-256 for ${CORPUS_FILE} — run voided`); return 2; }
    if (got !== want) {
        console.error(`prereg hash mismatch for ${CORPUS_FILE}:\n  got  ${got}\n  want ${want}\n  run voided — re-pinning after the fact is not available`);
        return 2;
    }

    // --- The measured build must postdate the extractor repair. ---
    const head = run('git', ['rev-parse', 'HEAD'], REPO_ROOT).stdout.trim();
    const headDate = run('git', ['show', '-s', '--format=%cs', 'HEAD'], REPO_ROOT).stdout.trim();
    if (headDate < REPAIR_DATE) {
        console.error(`measured commit ${head} dates ${headDate}, before the ${REPAIR_DATE} extractor repair — this benchmark is meaningless on that build`);
        return 2;
    }

    const corpus = yaml.load(fs.readFileSync(corpusPath, 'utf-8')) as Corpus;
    const rootByName = new Map(corpus.roots.map((r) => [r.name, r]));

    // --- Every truth path resolves inside this repository. ---
    for (const q of corpus.questions) {
        const root = rootByName.get(q.root);
        if (!root) { console.error(`question ${q.id} names unknown root '${q.root}'`); return 2; }
        if (q.category === 'path-between' && q.probe_to === undefined) { console.error(`question ${q.id} is path-between and carries no probe_to`); return 2; }
        if (q.category === IN_DOMAIN_NEGATIVE && q.truth.length > 0) { console.error(`question ${q.id} is an in-domain negative control and must carry an empty truth set`); return 2; }
        for (const t of q.truth) {
            const abs = path.resolve(REPO_ROOT, root.path, t.path);
            if (!abs.startsWith(REPO_ROOT + path.sep)) { console.error(`question ${q.id} truth path escapes the repository: ${t.path}`); return 2; }
            if (!fs.existsSync(abs)) { console.error(`question ${q.id} truth path does not exist: ${root.path}/${t.path}`); return 2; }
        }
    }

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-inrepo-v2-'));
    const graphs = new Map<string, string>();
    const buildMs: Record<string, number> = {};
    const cliTs = path.join(REPO_ROOT, 'src', 'scripts', 'code_graph', 'cli.ts');
    for (const root of corpus.roots) {
        const out = path.join(tmp, `${root.name}.json`);
        const b = run('npx', ['tsx', cliTs, 'build', '--root', root.path, '--out', out], REPO_ROOT);
        if (b.status !== 0 || !fs.existsSync(out)) { console.error(`graph build failed for ${root.name} (exit ${b.status})`); return 2; }
        graphs.set(root.name, out);
        buildMs[root.name] = Math.round(b.wall_ms);
        console.log(`built ${root.name} in ${buildMs[root.name]}ms`);
    }

    const rows: Row[] = [];
    for (const q of corpus.questions) {
        const root = rootByName.get(q.root) as Root;
        let a: ArmResult;
        let g: ArmResult;
        try {
            a = armGrep(root.path, q);
            g = armGraph(graphs.get(q.root) as string, q);
        } catch (e) {
            if (e instanceof ProbeFailure) { console.error(`probe failed, run aborted: ${e.message}`); return 2; }
            throw e;
        }
        const sa = score(a.files, q);
        const sg = score(g.files, q);
        rows.push({
            id: q.id, root: q.root, category: q.category, question: q.question,
            grep: { precision: r3(sa.precision), recall: r3(sa.recall), wall_ms: Math.round(a.wall_ms), output_bytes: a.output_bytes, answered: a.files.size },
            graph: { precision: r3(sg.precision), recall: r3(sg.recall), wall_ms: Math.round(g.wall_ms), output_bytes: g.output_bytes, answered: g.files.size },
            missed_by_graph: sg.missed, wrong_by_graph: sg.wrong.slice(0, 12),
            missed_by_grep: sa.missed, wrong_by_grep: sa.wrong.slice(0, 12),
        });
        console.log(`${q.id} [${q.category}] grep P=${sa.precision.toFixed(2)} R=${sa.recall.toFixed(2)} n=${a.files.size} | graph P=${sg.precision.toFixed(2)} R=${sg.recall.toFixed(2)} n=${g.files.size}`);
    }

    const perClass: Record<string, ReturnType<typeof classVerdict> & { n: number }> = {};
    for (const c of GRAPH_CLASSES) {
        const set = rows.filter((r) => r.category === c);
        if (set.length === 0) continue;
        perClass[c] = { ...classVerdict(set), n: set.length };
    }

    // --- In-domain negative controls: a clean-rate, never a recall floor. ---
    const inDomain = rows.filter((r) => r.category === IN_DOMAIN_NEGATIVE);
    const cleanRate = (arm: 'grep' | 'graph'): number => r3(mean(inDomain.map((r) => (r[arm].answered === 0 ? 1 : 0))));
    const inDomainResult = {
        n: inDomain.length,
        note: 'An arm passes an item iff it returned the EMPTY set for a symbol-shaped probe that names nothing in the root. Scored as a clean-rate; recall is undefined over an empty truth set and is not computed. These rows are excluded from every recall figure and from the macro average.',
        grep_clean_rate: cleanRate('grep'),
        graph_clean_rate: cleanRate('graph'),
        graph_false_positives: inDomain.filter((r) => r.graph.answered > 0).map((r) => ({ id: r.id, answered: r.wrong_by_graph })),
        grep_false_positives: inDomain.filter((r) => r.grep.answered > 0).map((r) => ({ id: r.id, answered: r.wrong_by_grep })),
    };

    // --- Capability boundary: reported, never folded into a floor. ---
    const boundary = rows.filter((r) => r.category === CAPABILITY_BOUNDARY);
    const boundaryResult = {
        n: boundary.length,
        note: 'LITERAL-string probes. A symbol index cannot answer them by construction. v1 folded these four into a negative-control recall FLOOR and then reported the floor FAILED; v2 reports the class and derives NO verdict from it. It is a statement about where grep stays necessary, not a measurement of the engine.',
        grep_recall: r3(mean(boundary.map((r) => r.grep.recall))),
        graph_recall: r3(mean(boundary.map((r) => r.graph.recall))),
    };

    const graphShaped = rows.filter((r) => (GRAPH_CLASSES as readonly string[]).includes(r.category));
    const macro = {
        note: 'REPORTED ONLY — not a pass criterion. Covers the four graph-shaped classes; the in-domain controls (undefined recall) and the capability-boundary class (unanswerable by construction) are excluded.',
        grep: { precision: r3(mean(graphShaped.map((r) => r.grep.precision))), recall: r3(mean(graphShaped.map((r) => r.grep.recall))) },
        graph: { precision: r3(mean(graphShaped.map((r) => r.graph.precision))), recall: r3(mean(graphShaped.map((r) => r.graph.recall))) },
    };

    const wins = Object.entries(perClass).filter(([, v]) => v.verdict === 'WIN' && v.validity === 'VALID').map(([k]) => k);
    const voidClasses = Object.entries(perClass).filter(([, v]) => v.validity !== 'VALID').map(([k]) => k);
    const summary = {
        benchmark: 'code-graph-vs-grep-inrepo-v2',
        generated: new Date().toISOString().slice(0, 10),
        measured_commit: head,
        measured_commit_date: headDate,
        postdates_extractor_repair: headDate >= REPAIR_DATE,
        not_comparable_to: {
            runs: [
                { report: 'internal/bench/reports/code-graph-vs-grep.md', run_date: '2026-07-28', reason: 'Different corpus (three private external repositories), different question set, a build predating the 2026-08-22 extractor repair, and a single aggregate bar.' },
                { report: 'internal/bench/reports/code-graph-vs-grep-inrepo-2026-08-28.md', run_date: '2026-08-28', reason: 'v1 of this benchmark. Same three roots, but a different corpus (19 questions vs 16; path-between re-probed, two classes restructured, three items added), a different arm-B verb set (path-between now uses the shipped `path` verb), and a corrected scorer (symbol: pseudo-nodes no longer counted as files). Three variables moved at once; no delta may be computed.' },
            ],
        },
        corpus: { file: `internal/bench/code-graph/${CORPUS_FILE}`, sha256: got, questions: rows.length, graph_shaped: graphShaped.length, in_domain_negative_controls: inDomain.length, capability_boundary: boundary.length },
        bars: { per_class_recall_delta_required_pp: RECALL_DELTA_REQUIRED_PP, per_class_precision_floor_pp: PRECISION_FLOOR_PP, note: 'Identical to v1. Re-choosing a bar after diagnosing a defect is choosing a bar to fit a number.' },
        build_ms: buildMs,
        per_class: perClass,
        in_domain_negative_controls: inDomainResult,
        capability_boundary: boundaryResult,
        macro_average_reported_only: macro,
        classes_won: wins,
        classes_void: voidClasses,
        rows,
    };

    const outDir = path.join(REPO_ROOT, 'internal', 'bench', 'reports');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${REPORT_STEM}.json`), `${JSON.stringify(summary, null, 2)}\n`);

    const md: string[] = [];
    md.push(`# Code-graph vs grep — in-repo corpus **v2**, ${summary.generated}`);
    md.push('');
    md.push('> **NOT COMPARABLE to the 2026-07-28 run, and NOT COMPARABLE to the v1 run of');
    md.push('> 2026-08-28.** v2 is a new registration, not a repaired continuation: a');
    md.push('> different corpus, a different arm-B verb set, and a corrected scorer. No');
    md.push('> delta may be computed against either. Both earlier reports are untouched.');
    md.push('');
    md.push(`Pre-registered in \`internal/bench/code-graph/${PREREG_FILE}\` before this run.`);
    md.push(`Corpus \`${CORPUS_FILE}\` bound by SHA-256 \`${got.slice(0, 16)}…\`; the runner refuses on mismatch.`);
    md.push('');
    md.push(`**Measured commit:** \`${head}\` (${headDate}) — postdates the ${REPAIR_DATE} extractor repair, asserted by the runner rather than read by eye.`);
    md.push('');
    md.push('## What v1 got wrong, and why v2 exists');
    md.push('');
    md.push('v1 published `path-between` as `VOID — INSTRUMENT FAILURE` with the note');
    md.push('*"Both arms returned the empty set on every question in this class"*. **That');
    md.push('was false for the graph arm.** The engine answered all three questions; v1\'s');
    md.push('relevance filter compared each returned symbol against the whole probe string');
    md.push('`"cmdBuild -> getParser"`, which no symbol contains, and discarded every');
    md.push('relation. The class was not symmetric silence — grep genuinely had no text to');
    md.push('find, and the graph found the answer and had it thrown away by the scorer.');
    md.push('');
    md.push('Two further scorer defects are corrected here: v1 never invoked the shipped');
    md.push('`path <a> <b>` verb (its graph arm ran only `affected` and `query`), and it');
    md.push('counted unresolved `symbol:` pseudo-nodes as files, deflating graph precision');
    md.push('in every class carrying one. `callers` was ruled NULL on the precision floor');
    md.push('alone, with recall tied — so that verdict was harness-caused too.');
    md.push('');
    md.push('**v1\'s numbers are not retro-edited.** They were faithful to v1\'s own');
    md.push('registration, which defines arm B as `affected` + `query`. The correction is');
    md.push('this new registration, plus the correction of v1\'s false *explanation*.');
    md.push('');
    md.push('## Per-class verdicts — bars identical to v1');
    md.push('');
    md.push('Bar per class: recall delta ≥ +10 pp **and** precision within 5 pp.');
    md.push('');
    md.push('| Class | n | grep R | graph R | Δ recall (pp) | grep P | graph P | precision ok | verdict | validity |');
    md.push('|---|---|---|---|---|---|---|---|---|---|');
    for (const c of GRAPH_CLASSES) {
        const v = perClass[c];
        if (!v) continue;
        md.push(`| \`${c}\` | ${v.n} | ${v.grep.r} | ${v.graph.r} | ${v.recall_delta_pp >= 0 ? '+' : ''}${v.recall_delta_pp} | ${v.grep.p} | ${v.graph.p} | ${v.precision_ok ? 'yes' : 'no'} | **${v.verdict}** | ${v.validity} |`);
    }
    for (const c of GRAPH_CLASSES) {
        const v = perClass[c];
        if (v && v.validity !== 'VALID') { md.push(''); md.push(`> **\`${c}\` — ${v.validity}.** ${v.validity_note}`); }
    }
    md.push('');
    md.push(`**Classes won:** ${wins.length > 0 ? wins.map((w) => `\`${w}\``).join(', ') : 'none'}.`);
    if (voidClasses.length > 0) md.push(`**Classes void:** ${voidClasses.map((w) => `\`${w}\``).join(', ')}.`);
    md.push('');
    md.push('## In-domain negative controls — false positives, not recall');
    md.push('');
    md.push(inDomainResult.note);
    md.push('');
    md.push(`| Arm | clean rate (n=${inDomainResult.n}) |`);
    md.push('|---|---|');
    md.push(`| grep | ${inDomainResult.grep_clean_rate} |`);
    md.push(`| graph | ${inDomainResult.graph_clean_rate} |`);
    md.push('');
    md.push('## Capability boundary — where grep stays necessary');
    md.push('');
    md.push(boundaryResult.note);
    md.push('');
    md.push(`| Arm | recall (n=${boundaryResult.n}) |`);
    md.push('|---|---|');
    md.push(`| grep | ${boundaryResult.grep_recall} |`);
    md.push(`| graph | ${boundaryResult.graph_recall} |`);
    md.push('');
    md.push('## Macro average — reported only, NOT a pass criterion');
    md.push('');
    md.push(macro.note);
    md.push('');
    md.push('| Arm | precision | recall |');
    md.push('|---|---|---|');
    md.push(`| grep | ${macro.grep.precision} | ${macro.grep.recall} |`);
    md.push(`| graph | ${macro.graph.precision} | ${macro.graph.recall} |`);
    md.push('');
    md.push('## Per-question rows');
    md.push('');
    md.push('| id | class | root | grep P/R | graph P/R | graph missed |');
    md.push('|---|---|---|---|---|---|');
    for (const r of rows) {
        const missed = r.missed_by_graph.length > 0 ? r.missed_by_graph.map((m) => `\`${m}\``).join(', ') : '—';
        md.push(`| \`${r.id}\` | ${r.category} | ${r.root} | ${r.grep.precision}/${r.grep.recall} | ${r.graph.precision}/${r.graph.recall} | ${missed} |`);
    }
    md.push('');
    md.push('## Build times');
    md.push('');
    for (const [k, v] of Object.entries(buildMs)) md.push(`- \`${k}\` — ${v} ms`);
    md.push('');
    md.push('## What this result may and may not change');
    md.push('');
    md.push('It may change **routing** — which classes the code-intelligence skill and the');
    md.push('`external-code-graph-interop` rule name as graph-first. It may **not** change');
    md.push('permission: no setting default moves and no dependency moves between');
    md.push('`devDependencies` and `dependencies`. That is ADR-246\'s question, and any');
    md.push('reopen is a separate change under `decision-revisit-gate`.');
    md.push('');
    fs.writeFileSync(path.join(outDir, `${REPORT_STEM}.md`), `${md.join('\n')}\n`);

    console.log('');
    for (const c of GRAPH_CLASSES) {
        const v = perClass[c];
        if (v) console.log(`class ${c}: ${v.verdict} (Δrecall ${v.recall_delta_pp} pp, precision ok=${v.precision_ok})`);
    }
    console.log(`in-domain negative controls: grep clean ${inDomainResult.grep_clean_rate}, graph clean ${inDomainResult.graph_clean_rate}`);
    console.log(`capability boundary: grep recall ${boundaryResult.grep_recall}, graph recall ${boundaryResult.graph_recall}`);
    console.log(`wrote internal/bench/reports/${REPORT_STEM}.{md,json}`);
    return 0;
}

process.exit(main());
