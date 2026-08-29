/**
 * In-repo code-graph vs grep benchmark — 2-arm, deterministic, zero model calls.
 *
 * Registered by `internal/bench/code-graph/PREREGISTRATION-inrepo-2026-08-28.md`
 * BEFORE any result existed. This runner is deliberately a SIBLING of
 * `run_bench.ts` rather than a flag on it: that one is bound by SHA-256 to four
 * question files that live outside the public tree and to three private corpus
 * clones, and its hashes may not be re-pinned — a mismatch voids its run by its
 * own terms. Editing it to accept a different corpus would silently convert a
 * voided pre-registration into a passing one.
 *
 * NOT COMPARABLE to the 2026-07-28 run: different corpus, different question
 * set, different build, different bars. No delta may be computed between them.
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
const CORPUS_FILE = 'inrepo-corpus-2026-08-28.yaml';
const PREREG_FILE = 'PREREGISTRATION-inrepo-2026-08-28.md';
const REPORT_STEM = 'code-graph-vs-grep-inrepo-2026-08-28';

/** The extractor repair this benchmark exists to measure against. AC-4. */
const REPAIR_DATE = '2026-08-22';

const EXCLUDES = ['vendor', 'node_modules', 'dist', '.nuxt', '.git', 'storage'];
const NEGATIVE = 'negative-control';
const GRAPH_CLASSES = ['callers', 'transitive-impact', 'path-between', 'references'] as const;

/** Per-class bars, fixed in the pre-registration before any number existed. */
const RECALL_DELTA_REQUIRED_PP = 10;
const PRECISION_FLOOR_PP = 5;
const NEGATIVE_CONTROL_RATIO = 0.9;

interface TruthSite { path: string; why: string }
interface Question {
    id: string;
    root: string;
    category: string;
    question: string;
    probe: string;
    probe_kind: 'symbol' | 'literal';
    truth: TruthSite[];
}
interface Root { name: string; path: string }
interface Corpus { corpus_version: number; generated: string; roots: Root[]; questions: Question[] }
interface ArmResult { files: Set<string>; wall_ms: number; output_bytes: number }

function sha256(p: string): string {
    return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function run(cmd: string, args: string[], cwd: string): { stdout: string; wall_ms: number; status: number } {
    const t0 = performance.now();
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    return { stdout: r.stdout ?? '', wall_ms: performance.now() - t0, status: r.status ?? 1 };
}

/** Arm A — uniform `git grep` over the root, answers = files with >= 1 hit. */
function armGrep(rootPath: string, q: Question): ArmResult {
    const args = ['grep', '-n'];
    if (q.probe_kind === 'literal') args.push('-F', q.probe);
    else args.push('-P', `\\b${q.probe}\\b`);
    args.push('--', '.');
    for (const e of EXCLUDES) args.push(`:(exclude)${e}`, `:(exclude)**/${e}/**`);
    const r = run('git', args, path.join(REPO_ROOT, rootPath));
    const files = new Set<string>();
    for (const line of r.stdout.split('\n')) {
        const m = line.match(/^(.+?):\d+:/);
        if (m?.[1] !== undefined) files.add(m[1].replace(/^\.\//, ''));
    }
    return { files, wall_ms: r.wall_ms, output_bytes: Buffer.byteLength(r.stdout) };
}

/** Arm B — code-graph `affected` + `query`; answers = matching relation endpoints. */
function armGraph(graphPath: string, q: Question): ArmResult {
    const cliTs = path.join(REPO_ROOT, 'src', 'scripts', 'code_graph', 'cli.ts');
    let stdout = '';
    let wall = 0;
    for (const sub of ['affected', 'query']) {
        const r = run('npx', ['tsx', cliTs, sub, q.probe, '--graph', graphPath, '--budget', '500'], REPO_ROOT);
        stdout += r.stdout;
        wall += r.wall_ms;
    }
    const files = new Set<string>();
    for (const line of stdout.split('\n')) {
        const m = line.match(/^\s+\w+\s+(\S+)\s+--\S+-->\s+(\S+)\s*$/);
        if (!m) continue;
        const parts = [m[1] as string, m[2] as string];
        const anyMatches = parts.some((p) => {
            const sym = p.includes('#') ? (p.split('#')[1] ?? '') : path.basename(p);
            return sym === q.probe || sym.includes(q.probe);
        });
        if (!anyMatches) continue;
        for (const p of parts) {
            const file = p.split('#')[0];
            if (file !== undefined && file.length > 0) files.add(file);
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
    grep: { precision: number; recall: number; wall_ms: number; output_bytes: number };
    graph: { precision: number; recall: number; wall_ms: number; output_bytes: number };
    missed_by_graph: string[]; wrong_by_graph: string[];
    missed_by_grep: string[]; wrong_by_grep: string[];
}

/**
 * A class where every metric read zero for both arms measured nothing. The
 * registered arithmetic calls that a TIE, and that output is preserved
 * verbatim — but a tie between two zeros is not comparative evidence, so the
 * validity flag says so beside it rather than in place of it.
 *
 * Resolved by AI council 2026-08-28: publish the mechanically computed
 * registered verdict AND the validity assessment, never silently replacing one
 * with the other. Relabelling after seeing a result is itself a post-hoc
 * judgement; showing both is what makes it auditable.
 *
 * CORRECTED 2026-08-29 — the note this function used to print was FALSE.
 * It said both arms had returned the empty set. Only the grep arm had. On the
 * `path-between` class the graph arm answered every question and `armGraph`
 * above discarded the answer: its relevance filter compares each returned
 * node's symbol segment against the ENTIRE probe string, which for that class
 * is `"cmdBuild -> getParser"` — a string no symbol contains. Confirmed by
 * direct execution; see `PREREGISTRATION-inrepo-v2-2026-08-29.md` § The v1
 * defects. Only the note changes here. No score, bar, or arm is touched: this
 * runner's arithmetic was faithful to its own registration, and repairing the
 * scorer under that registration would convert a published result into a
 * different one. The repair lives in `run_bench_inrepo_v2.ts`.
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
    const validity = noSignal ? 'VOID — INSTRUMENT FAILURE' : 'VALID';
    const validity_note = noSignal
        ? 'Every metric read zero for both arms in this class, so this run measured nothing here — but NOT symmetrically, and the two arms did not fail for the same reason. CORRECTED 2026-08-29, replacing a note that claimed both arms returned the empty set: on `path-between` the grep arm genuinely found nothing (a word-boundary search for a token containing " -> " matches no text), while the GRAPH ARM ANSWERED ALL THREE QUESTIONS and this runner\'s relevance filter discarded the answer, because it compares each returned symbol against the whole two-endpoint probe string. The defect is in this scorer, not in the engine. The registered verdict above is this runner\'s arithmetic and is preserved unchanged; the repaired measurement is a separate registration, `PREREGISTRATION-inrepo-v2-2026-08-29.md`.'
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
    const want = prereg.match(/^([0-9a-f]{64})\s+inrepo-corpus-2026-08-28\.yaml$/m)?.[1];
    if (want === undefined) {
        console.error(`pre-registration carries no SHA-256 for ${CORPUS_FILE} — run voided`);
        return 2;
    }
    if (got !== want) {
        console.error(`prereg hash mismatch for ${CORPUS_FILE}:\n  got  ${got}\n  want ${want}\n  run voided — re-pinning after the fact is not available`);
        return 2;
    }

    // --- AC-4: the measured build must postdate the extractor repair. ---
    const head = run('git', ['rev-parse', 'HEAD'], REPO_ROOT).stdout.trim();
    const headDate = run('git', ['show', '-s', '--format=%cs', 'HEAD'], REPO_ROOT).stdout.trim();
    if (headDate < REPAIR_DATE) {
        console.error(`measured commit ${head} dates ${headDate}, before the ${REPAIR_DATE} extractor repair — this benchmark is meaningless on that build`);
        return 2;
    }

    const corpus = yaml.load(fs.readFileSync(corpusPath, 'utf-8')) as Corpus;
    const rootByName = new Map(corpus.roots.map((r) => [r.name, r]));

    // --- AC-3: every truth path resolves inside this repository. ---
    for (const q of corpus.questions) {
        const root = rootByName.get(q.root);
        if (!root) { console.error(`question ${q.id} names unknown root '${q.root}'`); return 2; }
        for (const t of q.truth) {
            const abs = path.resolve(REPO_ROOT, root.path, t.path);
            if (!abs.startsWith(REPO_ROOT + path.sep)) { console.error(`question ${q.id} truth path escapes the repository: ${t.path}`); return 2; }
            if (!fs.existsSync(abs)) { console.error(`question ${q.id} truth path does not exist: ${root.path}/${t.path}`); return 2; }
        }
    }

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-inrepo-'));
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
        const a = armGrep(root.path, q);
        const g = armGraph(graphs.get(q.root) as string, q);
        const sa = score(a.files, q);
        const sg = score(g.files, q);
        rows.push({
            id: q.id, root: q.root, category: q.category, question: q.question,
            grep: { precision: r3(sa.precision), recall: r3(sa.recall), wall_ms: Math.round(a.wall_ms), output_bytes: a.output_bytes },
            graph: { precision: r3(sg.precision), recall: r3(sg.recall), wall_ms: Math.round(g.wall_ms), output_bytes: g.output_bytes },
            missed_by_graph: sg.missed, wrong_by_graph: sg.wrong.slice(0, 12),
            missed_by_grep: sa.missed, wrong_by_grep: sa.wrong.slice(0, 12),
        });
        console.log(`${q.id} [${q.category}] grep P=${sa.precision.toFixed(2)} R=${sa.recall.toFixed(2)} | graph P=${sg.precision.toFixed(2)} R=${sg.recall.toFixed(2)}`);
    }

    // --- Per-class verdicts. The bars are per class; the macro is reported only. ---
    const perClass: Record<string, ReturnType<typeof classVerdict> & { n: number }> = {};
    for (const c of GRAPH_CLASSES) {
        const set = rows.filter((r) => r.category === c);
        if (set.length === 0) continue;
        perClass[c] = { ...classVerdict(set), n: set.length };
    }
    const negatives = rows.filter((r) => r.category === NEGATIVE);
    const negGrep = mean(negatives.map((r) => r.grep.recall));
    const negGraph = mean(negatives.map((r) => r.graph.recall));
    const negativeControlOk = negGraph >= NEGATIVE_CONTROL_RATIO * negGrep;

    const graphShaped = rows.filter((r) => r.category !== NEGATIVE);
    const macro = {
        note: 'REPORTED ONLY — not a pass criterion. Printed so a reader can see the aggregate the 2026-07-28 run would have reported. No verdict is derived from it.',
        grep: { precision: r3(mean(graphShaped.map((r) => r.grep.precision))), recall: r3(mean(graphShaped.map((r) => r.grep.recall))) },
        graph: { precision: r3(mean(graphShaped.map((r) => r.graph.precision))), recall: r3(mean(graphShaped.map((r) => r.graph.recall))) },
    };

    const wins = Object.entries(perClass).filter(([, v]) => v.verdict === 'WIN' && v.validity === 'VALID').map(([k]) => k);
    const voidClasses = Object.entries(perClass).filter(([, v]) => v.validity !== 'VALID').map(([k]) => k);
    const summary = {
        benchmark: 'code-graph-vs-grep-inrepo',
        generated: new Date().toISOString().slice(0, 10),
        measured_commit: head,
        measured_commit_date: headDate,
        postdates_extractor_repair: headDate >= REPAIR_DATE,
        not_comparable_to: {
            report: 'internal/bench/reports/code-graph-vs-grep.md',
            run_date: '2026-07-28',
            reason: 'Different corpus (three private external repositories vs three in-repo TypeScript subtrees), different question set (18 vs 16, no shared item), different build (predates the 2026-08-22 extractor repair), different bars (single aggregate vs per-class). No delta may be computed between the two runs in either direction.',
        },
        corpus: { file: `internal/bench/code-graph/${CORPUS_FILE}`, sha256: got, questions: rows.length, graph_shaped: graphShaped.length, negative_controls: negatives.length },
        bars: { per_class_recall_delta_required_pp: RECALL_DELTA_REQUIRED_PP, per_class_precision_floor_pp: PRECISION_FLOOR_PP, negative_control_ratio: NEGATIVE_CONTROL_RATIO },
        build_ms: buildMs,
        per_class: perClass,
        negative_controls: { n: negatives.length, grep_recall: r3(negGrep), graph_recall: r3(negGraph), floor_ok: negativeControlOk },
        macro_average_reported_only: macro,
        classes_won: wins,
        classes_void: voidClasses,
        negative_control_construct_caveat:
            'The four controls are literal-string searches (a config key, a log filename, an env var name, a comment fragment). This engine indexes SYMBOLS and call relations, not string literals, so it scores 0.000 on all four by construction. The pre-registered floor is reported FAILED because it was registered and cannot be discarded after the fact — but a reader must not read it as an implementation defect. AI council 2026-08-28 split on this and resolved it by naming the claim: if the claim were "graph retrieval replaces grep for repository investigation" the controls are valid and the failure matters; if the claim is "graph retrieval improves structural code questions" the controls sit outside that construct. This benchmark makes only the second claim. A v2 registration must separate IN-DOMAIN negative controls (symbol-shaped probes whose correct answer is empty, testing false positives) from CAPABILITY-BOUNDARY tests (literals, filenames, config keys), reported separately.',
        overall_verdict_withheld:
            'No overall engine verdict is derived from this run. Two of five classes measured the instrument rather than the engine: path-between is VOID — and CORRECTED 2026-08-29, because of a defect in THIS RUNNER rather than a symmetric silence, the graph arm having answered and been discarded by the scorer — and the negative-control floor tests a construct this benchmark does not claim. The defensible statement is "zero classes met the pre-registered win criterion", NOT "grep proved superior across all classes". A v2 registration is a NEW confirmatory experiment, never a repaired continuation of this one; it exists at PREREGISTRATION-inrepo-v2-2026-08-29.md and its result is at internal/bench/reports/code-graph-vs-grep-inrepo-v2-2026-08-29.md.',
        rows,
    };

    const outDir = path.join(REPO_ROOT, 'internal', 'bench', 'reports');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${REPORT_STEM}.json`), `${JSON.stringify(summary, null, 2)}\n`);

    const md: string[] = [];
    md.push(`# Code-graph vs grep — in-repo corpus, ${summary.generated}`);
    md.push('');
    md.push('> **NOT COMPARABLE to the 2026-07-28 run.** Different corpus, different');
    md.push('> question set, different build, different bars. No delta may be computed');
    md.push('> between the two in either direction. That run is untouched and remains the');
    md.push('> only measurement of the registered external corpora.');
    md.push('');
    md.push(`Pre-registered in \`internal/bench/code-graph/${PREREG_FILE}\` before this run.`);
    md.push(`Corpus \`${CORPUS_FILE}\` bound by SHA-256 \`${got.slice(0, 16)}…\`; the runner refuses on mismatch.`);
    md.push('');
    md.push(`**Measured commit:** \`${head}\` (${headDate}) — postdates the ${REPAIR_DATE} extractor repair, asserted by the runner rather than read by eye.`);
    md.push('');
    md.push('A commit id is not a durable pointer under this repository\'s squash-merge');
    md.push('workflow — see the reachability note in the published report. Verify the');
    md.push('measured CONTENT by tree hash instead: `git rev-parse <ref>:src/scripts/code_graph`.');
    md.push('');
    md.push('## Per-class verdicts — the pre-registered bars');
    md.push('');
    md.push('Bar per class: recall delta ≥ +10 pp **and** precision within 5 pp.');
    md.push('');
    md.push('| Class | n | grep R | graph R | Δ recall (pp) | grep P | graph P | precision ok | registered verdict | validity |');
    md.push('|---|---|---|---|---|---|---|---|---|---|');
    for (const c of GRAPH_CLASSES) {
        const v = perClass[c];
        if (!v) continue;
        md.push(`| \`${c}\` | ${v.n} | ${v.grep.r} | ${v.graph.r} | ${v.recall_delta_pp >= 0 ? '+' : ''}${v.recall_delta_pp} | ${v.grep.p} | ${v.graph.p} | ${v.precision_ok ? 'yes' : 'no'} | ${v.verdict} | **${v.validity}** |`);
    }
    md.push('');
    md.push('Two columns, deliberately. **Registered verdict** is the runner\'s arithmetic under the pre-registered bars, preserved verbatim. **Validity** is whether that arithmetic measured anything. Neither replaces the other.');
    for (const c of GRAPH_CLASSES) {
        const v = perClass[c];
        if (v && v.validity !== 'VALID') { md.push(''); md.push(`> **\`${c}\` — ${v.validity}.** ${v.validity_note}`); }
    }
    md.push('');
    md.push(`**Negative controls** (n=${negatives.length}): grep recall ${r3(negGrep)}, graph recall ${r3(negGraph)} — floor (graph ≥ 0.9 × grep) **${negativeControlOk ? 'held' : 'FAILED'}**.`);
    md.push('');
    md.push(`**Classes won (valid classes only):** ${wins.length > 0 ? wins.map((w) => `\`${w}\``).join(', ') : 'none'}.`);
    if (voidClasses.length > 0) md.push(`**Classes void:** ${voidClasses.map((w) => `\`${w}\``).join(', ')} — measured nothing, excluded from any win count.`);
    md.push('');
    md.push('## Negative controls — the floor failed, and what that does and does not mean');
    md.push('');
    md.push(summary.negative_control_construct_caveat);
    md.push('');
    md.push('## No overall engine verdict is derived from this run');
    md.push('');
    md.push(summary.overall_verdict_withheld);
    md.push('');
    md.push('## Macro average — reported only, NOT a pass criterion');
    md.push('');
    md.push(`Printed so a reader can see the aggregate the old run would have reported. No verdict is derived from it, by the pre-registration's own terms.`);
    md.push('');
    md.push(`| Arm | precision | recall |`);
    md.push(`|---|---|---|`);
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
    md.push('`devDependencies` and `dependencies`. That is ADR-246\'s question, and reopening');
    md.push('it is a separate change under `decision-revisit-gate`.');
    md.push('');
    fs.writeFileSync(path.join(outDir, `${REPORT_STEM}.md`), `${md.join('\n')}\n`);

    console.log('');
    for (const c of GRAPH_CLASSES) {
        const v = perClass[c];
        if (v) console.log(`class ${c}: ${v.verdict} (Δrecall ${v.recall_delta_pp} pp, precision ok=${v.precision_ok})`);
    }
    console.log(`negative-control floor: ${negativeControlOk ? 'held' : 'FAILED'}`);
    console.log(`wrote internal/bench/reports/${REPORT_STEM}.{md,json}`);
    return 0;
}

process.exit(main());
