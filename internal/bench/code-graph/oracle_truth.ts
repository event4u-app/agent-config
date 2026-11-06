#!/usr/bin/env tsx
/**
 * Oracle arm of the code-graph benchmark v3 (road-to-a-graph-that-wins step 2.2).
 *
 *   tsx internal/bench/code-graph/oracle_truth.ts --work <dir> [--date YYYY-MM-DD] [--max-depth N]
 *
 * `<dir>/<subject>/` is a THROWAWAY copy of each pinned clone whose dependencies
 * `oracle/oracle.sh deps` installed — never the clone the arms read. Everything the
 * oracle runs, runs in the `oracle/` image with `--network none`.
 *
 * Writes `truth-v3-<date>.yaml` next to the corpus. Per question it records what the
 * REGISTERED oracle can say (PREREGISTRATION-v3-2026-11-05.md § Truth): Psalm
 * references for PHP, scip-typescript references for TS/JS, at symbol level, projected
 * to files, hop strata re-derived from the oracle's own caller chain. What no
 * reference engine emits — route, model-to-migration, Inertia and Blade relations —
 * is `human-required`, and an item whose oracle answer is known to be incomplete
 * names why under `open`. The 20 % human sample is copied in with `human_checked:
 * null`; the v3 runner scores nothing until every sampled item carries a verdict.
 * The graph under test is never consulted.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as yaml from 'js-yaml';

import { alignScipLinesUnder, readScipIndex, type ScipDocument } from '../../../src/scripts/code_graph/scip_reader.js';
import { checkRegisteredHashes } from './run_bench_v3.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus-v3-2026-11-05.yaml');
const ORACLE_SH = path.join(HERE, 'oracle', 'oracle.sh');
const PSALM_VERSION = '7.0.3';
const SCIP_TYPESCRIPT_VERSION = '0.6.1';
/** Registration § Truth: the draw, seed 20261105. */
export const HUMAN_SAMPLE = [
    'uo-b-05', 'ls-b-06', 'uo-b-02', 'uo-c-route-02', 'ls-c-route-02', 'ls-c-model-02', 'ls-c-model-01',
    'uo-c-tests-03', 'uo-d-03', 'ls-d-03', 'ls-e-01', 'uo-e-02', 'ls-e-x-01',
] as const;
const HUMAN_CLASSES = new Set(['route-trace', 'model-table', 'change-impact-xplane']);
const CLOSURE_CLASSES = new Set(['change-impact', 'tests-for']);

export interface Question {
    id: string;
    class: string;
    shape?: string;
    subject: string;
    language: string;
    probe: string;
    probe_to?: string;
    declared_in?: string;
    question?: string;
    hop_stratum?: number | string;
    expected?: string;
}

export type Status = 'oracle' | 'oracle-partial' | 'human-required' | 'confirms-empty' | 'void' | 'unresolved';

export interface TruthItem {
    id: string;
    status: Status;
    truth_via: 'oracle' | 'human';
    symbol?: string;
    files: string[];
    hop_stratum_oracle?: number | '>=3';
    hop_stratum_corpus?: number | string;
    open?: string[];
    human_checked?: null;
}

export type Refs = Map<string, { file: string; line: number }[]>;
export type Enclosing = Map<string, string>;

export function isTestPath(file: string): boolean {
    return /(^|\/)tests?\//i.test(file) || /Test\.php$/.test(file);
}

export function stratum(hop: number): number | '>=3' {
    return hop >= 3 ? '>=3' : hop;
}

/**
 * Breadth-first caller closure over oracle references. `refs` maps a symbol to its
 * reference sites, `enclosing` maps "file:line" to the symbol containing it ('-' at
 * file scope). Returns each file at the hop it was first reached, every caller symbol,
 * the entry points (symbols nothing references), the symbols whose references are not
 * known yet, and whether the depth cap cut the walk.
 */
export function callerClosure(seed: string, refs: Refs, enclosing: Enclosing, maxDepth: number) {
    const fileHop = new Map<string, number>();
    const seen = new Set([seed]);
    const terminals: string[] = [];
    const missing: string[] = [];
    let frontier = [seed];
    let truncated = false;
    for (let hop = 1; frontier.length > 0; hop++) {
        if (hop > maxDepth) {
            truncated = true;
            break;
        }
        const next: string[] = [];
        for (const sym of frontier) {
            const sites = refs.get(sym);
            if (sites === undefined) {
                missing.push(sym);
                continue;
            }
            if (sites.length === 0 && sym !== seed) terminals.push(sym);
            for (const s of sites) {
                if (!fileHop.has(s.file)) fileHop.set(s.file, hop);
                const caller = enclosing.get(`${s.file}:${s.line}`);
                if (caller && caller !== '-' && !seen.has(caller)) {
                    seen.add(caller);
                    next.push(caller);
                }
            }
        }
        frontier = next;
    }
    seen.delete(seed);
    return { fileHop, callers: seen, terminals, missing, truncated };
}

/** Symbols whose references the closure still needs, for the next Psalm round. */
export function pendingSymbols(seed: string, refs: Refs, enclosing: Enclosing, maxDepth: number): string[] {
    return callerClosure(seed, refs, enclosing, maxDepth).missing;
}

export function oracle(subjectDir: string, args: string[], input?: string): string {
    const res = spawnSync(ORACLE_SH, ['run', subjectDir, ...args], { encoding: 'utf8', input, maxBuffer: 1 << 28 });
    if (res.status !== 0) throw new Error(`oracle.sh run ${args.join(' ')} exited ${res.status}: ${(res.stderr || '').slice(-800)}`);
    return res.stdout;
}

/**
 * Translation directories: PHP files that return string arrays. They hold no symbol
 * reference (checked per run, below) and Psalm's inference over a 300 KB nested array
 * exhausts a 16 GB VM, so they are left out of the analysis and named in the output.
 */
export function dataOnlyDirs(dir: string): string[] {
    const files = spawnSync('git', ['ls-files', '*.php'], { cwd: dir, encoding: 'utf8' }).stdout.split('\n');
    const dirs = [...new Set(files.map((f) => /^(.*?(?:^|\/)lang)\//.exec(f)?.[1]).filter((d): d is string => !!d))].sort();
    if (dirs.length === 0) return [];
    const g = spawnSync('git', ['grep', '-lE', '::class|::[a-zA-Z_]+\\(|new [A-Z]|^use ', '--', ...dirs], { cwd: dir, encoding: 'utf8' });
    if (g.stdout.trim()) throw new Error(`oracle_truth: a translation file carries code, refusing to exclude it:\n${g.stdout}`);
    return dirs;
}

/**
 * Single files Psalm's own inference cannot finish inside a 16 GB VM, measured one by
 * one (`-m 6g`, the file alone). Each is refused as an exclusion if it mentions any
 * probe token of the corpus, so leaving it out cannot drop a reference the truth needs.
 */
export const PATHOLOGICAL_FILES: Record<string, string[]> = {
    unopim: ['packages/Webkul/ProductPassport/tests/Feature/PassportAclCoverageTest.php'],
};

export function exclusionConflicts(text: string, probes: readonly string[]): string[] {
    return probes.filter((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text));
}

export function writePsalmConfig(dir: string, excluded: string[], files: string[]): void {
    const extra = excluded.map((d) => `\n            <directory name="${d}" />`).join('') + files.map((f) => `\n            <file name="${f}" />`).join('');
    fs.writeFileSync(path.join(dir, 'psalm-oracle.xml'), `<?xml version="1.0"?>
<psalm errorLevel="8" findUnusedCode="false" findUnusedBaselineEntry="false" cacheDirectory="/subject/.oracle/psalm-cache">
    <projectFiles>
        <directory name="." />
        <ignoreFiles allowMissingFiles="true">
            <directory name="vendor" />
            <directory name="node_modules" />
            <directory name="storage" />
            <directory name="bootstrap/cache" />
            <directory name="public" />
            <directory name=".oracle" />${extra}
        </ignoreFiles>
    </projectFiles>
    <plugins>
        <plugin filename="/opt/oracle/OracleReferencesPlugin.php" />
        <pluginClass class="Psalm\\LaravelPlugin\\Plugin"><resolveConfigReturnTypes value="false" /></pluginClass>
    </plugins>
</psalm>
`);
}

/** One Psalm analysis answering every symbol; results merge into `refs`. */
export function psalmRound(dir: string, symbols: string[], refs: Refs): void {
    if (symbols.length === 0) return;
    fs.writeFileSync(path.join(dir, '.oracle', 'symbols.txt'), symbols.join('\n') + '\n');
    oracle(dir, ['psalm', '--config=psalm-oracle.xml', '--monochrome', '--no-progress', '--threads=1', `--find-references-to=${symbols[0]}`]);
    for (const line of fs.readFileSync(path.join(dir, '.oracle', 'references.jsonl'), 'utf8').split('\n')) {
        if (!line.trim()) continue;
        const r = JSON.parse(line) as { symbol: string; sites: { file: string; line: number }[]; error: string | null };
        refs.set(r.symbol, r.error ? [] : r.sites);
    }
}

export function resolveEnclosing(dir: string, sites: string[], enclosing: Enclosing): void {
    const todo = [...new Set(sites)].filter((s) => !enclosing.has(s));
    if (todo.length === 0) return;
    for (const line of oracle(dir, ['php', '/opt/oracle/enclosing.php'], todo.join('\n') + '\n').split('\n')) {
        const [site, sym] = line.split('\t');
        if (site && sym) enclosing.set(site, sym);
    }
}

/** Declaration sites of `name` in tracked PHP files, read by the parser, never by the graph. */
function declarationsOf(dir: string, name: string, enclosing: Enclosing): string[] {
    const g = spawnSync('git', ['grep', '-nE', `(class|interface|trait|enum|function)[[:space:]]+${name}([^A-Za-z0-9_]|$)`, '--', '*.php'], { cwd: dir, encoding: 'utf8' });
    const sites = g.stdout.split('\n').filter(Boolean).map((l) => l.split(':').slice(0, 2).join(':'));
    resolveEnclosing(dir, sites, enclosing);
    const syms = sites.map((s) => enclosing.get(s)).filter((s): s is string => !!s && s !== '-');
    return [...new Set(syms.filter((s) => s === name || s.endsWith(`\\${name}`) || s.endsWith(`::${name}`)))];
}

export function scipReferences(docs: ScipDocument[], declaredIn: string, probe: string): { symbol?: string; files: string[] } {
    const [file, lineStr] = declaredIn.split(':');
    const line = Number(lineStr) - 1;
    const doc = docs.find((d) => d.path === file);
    const def = doc?.occurrences.find((o) => o.definition && o.line === line && o.symbol.includes(probe));
    if (!def) return { files: [] };
    const files = docs.filter((d) => d.occurrences.some((o) => !o.definition && o.symbol === def.symbol)).map((d) => d.path);
    return { symbol: def.symbol, files: [...new Set(files)].sort() };
}

function sha256(file: string): string {
    return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function parseArgs(argv: string[]): Record<string, string> {
    const out: Record<string, string> = {};
    for (let i = 0; i < argv.length; i += 2) out[(argv[i] ?? '').replace(/^--/, '')] = argv[i + 1] ?? '';
    return out;
}

export function main(argv: string[]): number {
    const args = parseArgs(argv);
    if (!args.work) {
        process.stderr.write('usage: oracle_truth.ts --work <dir> [--date YYYY-MM-DD] [--max-depth N]\n');
        return 2;
    }
    const problems = checkRegisteredHashes(path.resolve(HERE, '..', '..', '..'), fs.readFileSync(path.join(HERE, 'PREREGISTRATION-v3-2026-11-05.md'), 'utf8'));
    if (problems.length > 0) {
        for (const p of problems) process.stderr.write(`${p}\n`);
        process.stderr.write('oracle_truth: refused — the registration binds these inputs\n');
        return 2;
    }
    const date = args.date || new Date().toISOString().slice(0, 10);
    const maxDepth = Number(args['max-depth'] || 6);
    const corpus = yaml.load(fs.readFileSync(CORPUS, 'utf8')) as { subjects: { name: string; pin: string }[]; questions: Question[] };
    const items: TruthItem[] = [];
    const excludedBySubject: Record<string, number> = {};

    for (const subject of corpus.subjects) {
        const dir = path.resolve(args.work, subject.name);
        const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
        if (head !== subject.pin) {
            process.stderr.write(`oracle_truth: ${dir} is at ${head || 'nothing'}, not the pin ${subject.pin}\n`);
            return 3;
        }
        fs.mkdirSync(path.join(dir, '.oracle'), { recursive: true });
        const excluded = dataOnlyDirs(dir);
        excludedBySubject[subject.name] = excluded.length;
        const qs = corpus.questions.filter((q) => q.subject === subject.name);
        const probes = qs.flatMap((q) => [q.probe, ...(q.probe_to ? [q.probe_to] : [])]).filter((p) => /^\w+$/.test(p));
        const badFiles = PATHOLOGICAL_FILES[subject.name] ?? [];
        for (const f of badFiles) {
            const hits = exclusionConflicts(fs.readFileSync(path.join(dir, f), 'utf8'), probes);
            if (hits.length > 0) {
                process.stderr.write(`oracle_truth: refusing to exclude ${f} — it mentions ${hits.join(', ')}\n`);
                return 2;
            }
        }
        writePsalmConfig(dir, excluded, badFiles);
        const refs: Refs = new Map();
        const enclosing: Enclosing = new Map();

        // Seeds: the symbol each PHP question is about.
        const seeds = new Map<string, string[]>();
        for (const q of qs) {
            if (HUMAN_CLASSES.has(q.class) || q.language !== 'php') continue;
            if (q.declared_in) {
                resolveEnclosing(dir, [q.declared_in], enclosing);
                const s = enclosing.get(q.declared_in);
                seeds.set(q.id, s && s !== '-' ? [s] : []);
            } else {
                seeds.set(q.id, declarationsOf(dir, q.probe, enclosing));
            }
            if (q.probe_to) seeds.set(`${q.id}>to`, declarationsOf(dir, q.probe_to, enclosing));
        }

        // Psalm rounds until every closure is complete or capped.
        let round = [...new Set([...seeds.values()].flat())];
        while (round.length > 0) {
            psalmRound(dir, round, refs);
            resolveEnclosing(dir, [...refs.values()].flat().map((s) => `${s.file}:${s.line}`), enclosing);
            const want = new Set<string>();
            for (const q of qs) {
                const closure = CLOSURE_CLASSES.has(q.class) || q.shape === 'callers-transitive' || q.shape === 'path';
                if (!closure) continue;
                for (const seed of seeds.get(q.shape === 'path' ? `${q.id}>to` : q.id) ?? []) {
                    for (const s of pendingSymbols(seed, refs, enclosing, maxDepth)) want.add(s);
                }
            }
            round = [...want];
        }

        // TS / JS through scip-typescript, once per subject.
        let docs: ScipDocument[] = [];
        const hasVue = spawnSync('git', ['ls-files', '*.vue'], { cwd: dir, encoding: 'utf8' }).stdout.trim() !== '';
        if (qs.some((q) => !HUMAN_CLASSES.has(q.class) && q.language !== 'php')) {
            // scip-typescript's --infer-tsconfig writes `{}`, which indexes no .js file at all.
            const tracked = spawnSync('git', ['ls-files', '--error-unmatch', 'tsconfig.json'], { cwd: dir }).status === 0;
            if (!tracked) {
                fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
                    compilerOptions: { allowJs: true, checkJs: false, noEmit: true },
                    include: ['**/*.js', '**/*.ts'],
                    exclude: ['node_modules', 'vendor', 'public', 'storage', '.oracle', '**/build/**'],
                }, null, 2));
            }
            oracle(dir, ['scip-typescript', 'index', '--output', '/subject/.oracle/index.scip']);
            docs = alignScipLinesUnder(readScipIndex(fs.readFileSync(path.join(dir, '.oracle', 'index.scip'))), dir);
        }

        for (const q of qs) items.push(truthFor(q, seeds, refs, enclosing, docs, hasVue, maxDepth));
    }

    const order = new Map(corpus.questions.map((q, i) => [q.id, i]));
    items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    const sample = new Set<string>(HUMAN_SAMPLE);
    for (const it of items) if (sample.has(it.id)) it.human_checked = null;
    const doc = {
        truth_version: 3,
        generated: date,
        corpus: { file: path.basename(CORPUS), sha256: sha256(CORPUS) },
        oracle: { image: 'agent-config-graph-oracle:v3', psalm: PSALM_VERSION, scip_typescript: SCIP_TYPESCRIPT_VERSION, max_depth: maxDepth,
            laravel_plugin: 'bundled psalm/plugin-laravel on, resolveConfigReturnTypes off — literal config value types carry no reference and exhausted 16 GB on one Pest test',
            excluded_from_analysis: { rule: 'translation directories (`lang/`), checked to carry no class, call, instantiation or use', directories: excludedBySubject },
            excluded_files: { rule: 'Psalm inference exceeds 6 GB on the file alone; checked to mention no probe token of the corpus', files: PATHOLOGICAL_FILES } },
        human_check: { seed: 20261105, sample: [...HUMAN_SAMPLE], completed: null },
        items,
    };
    const out = path.join(HERE, `truth-v3-${date}.yaml`);
    fs.writeFileSync(out, `# Oracle truth for corpus v3 -- written by oracle_truth.ts, never by hand except the\n# human_checked verdicts and human-required files. See PREREGISTRATION-v3-2026-11-05.md § Truth.\n${yaml.dump(doc, { lineWidth: 120 })}`);
    const counts = items.reduce<Record<string, number>>((acc, it) => ((acc[it.status] = (acc[it.status] ?? 0) + 1), acc), {});
    process.stdout.write(`oracle_truth: wrote ${path.relative(process.cwd(), out)} · ${JSON.stringify(counts)}\n`);
    return 0;
}

const HOP_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

/** The hop limit a question states ("within two call hops"), or null when it states none. */
export function statedHopLimit(question: string | undefined): number | null {
    const m = question?.match(/within (\w+) call hops?/i);
    if (!m?.[1]) return null;
    return HOP_WORDS[m[1].toLowerCase()] ?? (Number.isInteger(Number(m[1])) ? Number(m[1]) : null);
}

export function truthFor(q: Question, seeds: Map<string, string[]>, refs: Refs, enclosing: Enclosing, docs: ScipDocument[], hasVue: boolean, maxDepth: number): TruthItem {
    const base = { id: q.id, ...(q.hop_stratum !== undefined ? { hop_stratum_corpus: q.hop_stratum } : {}) };
    if (HUMAN_CLASSES.has(q.class)) {
        return { ...base, status: 'human-required', truth_via: 'human', files: [], open: ['no reference engine emits this relation (registration § Truth)'] };
    }
    if (q.language !== 'php') {
        const r = q.declared_in ? scipReferences(docs, q.declared_in, q.probe) : { files: [] as string[] };
        if (!r.symbol) return { ...base, status: 'unresolved', truth_via: 'oracle', files: [], open: ['declaration not found in the scip index'] };
        const open = hasVue ? ['scip-typescript does not index .vue single-file components; Vue call sites need the human reading'] : [];
        return { ...base, status: open.length ? 'oracle-partial' : 'oracle', truth_via: 'oracle', symbol: r.symbol, files: r.files, hop_stratum_oracle: 1, ...(open.length ? { open } : {}) };
    }
    const own = seeds.get(q.id) ?? [];
    if (q.class === 'negative-control') {
        if (q.shape === 'path') {
            const reached = (seeds.get(`${q.id}>to`) ?? []).some((to) => {
                const { callers } = callerClosure(to, refs, enclosing, maxDepth);
                return own.some((from) => [...callers].some((c) => c === from || c.startsWith(`${from}::`)));
            });
            return { ...base, status: reached ? 'void' : 'confirms-empty', truth_via: 'oracle', files: [], open: ['engine-only: route, queue and event dispatch hops are not followed'] };
        }
        if (own.length === 0) return { ...base, status: 'confirms-empty', truth_via: 'oracle', files: [], open: ['no declaration of the probe exists at the pin'] };
        const files = [...new Set(own.flatMap((s) => (refs.get(s) ?? []).map((x) => x.file)))].sort();
        return { ...base, status: files.length ? 'void' : 'confirms-empty', truth_via: 'oracle', symbol: own.join(' | '), files };
    }
    if (own.length !== 1) {
        return { ...base, status: 'unresolved', truth_via: 'oracle', files: [], open: [own.length ? `ambiguous declaration: ${own.join(', ')}` : 'declaration not found'] };
    }
    const seed = own[0] as string;
    const closure = CLOSURE_CLASSES.has(q.class) || q.shape === 'callers-transitive';
    const open: string[] = [];
    let fileHop: Map<string, number>;
    if (closure) {
        const limit = statedHopLimit(q.question);
        const c = callerClosure(seed, refs, enclosing, limit ?? maxDepth);
        fileHop = c.fileHop;
        if (c.truncated && limit === null) open.push(`depth cap ${maxDepth} reached`);
        const routes = c.terminals.filter((t) => /\\Http\\Controllers\\/.test(t));
        const framework = c.terminals.filter((t) => !routes.includes(t));
        if (routes.length) open.push(`route hops not followed from ${routes.length} controller entry point(s)`);
        if (framework.length) open.push(`framework-invoked entry point(s) not followed: ${framework.join(', ')}`);
    } else {
        fileHop = new Map((refs.get(seed) ?? []).map((s) => [s.file, 1] as const));
    }
    let files = [...fileHop.keys()];
    if (q.class === 'tests-for') files = files.filter(isTestPath);
    files.sort();
    const maxHop = Math.max(0, ...files.map((f) => fileHop.get(f) ?? 0));
    return {
        ...base,
        status: open.length ? 'oracle-partial' : 'oracle',
        truth_via: 'oracle',
        symbol: seed,
        files,
        ...(maxHop ? { hop_stratum_oracle: stratum(maxHop) } : {}),
        ...(open.length ? { open } : {}),
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(main(process.argv.slice(2)));
}
