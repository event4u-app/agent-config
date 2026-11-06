/**
 * Seal oracle truth with the delegated check (registration § The owner deviation for
 * the check): a source reader and two judges, a file in the truth when two of the
 * three put it there.
 *
 *   tsx internal/bench/code-graph/apply_check.ts --check <dir> --truth <truth.yaml> [--date YYYY-MM-DD]
 *
 * `<dir>` holds `answers-<group>.json` (reader), `rulings-<group>.json` (both judges'
 * raw replies) and optionally `round2-<group>.json` (rulings on files a judge named
 * missing). The truth file is rewritten in place: per item `files` and `checked`, the
 * split files, and the missing claims no second round settled.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as yaml from 'js-yaml';

import { bothValidEdges, closureFromEdges, fakesItsChain, parseEdgeRulings, standingEdges, type Edge, type EdgeVerdict, type Target } from './closure_check.js';
import { deriveModelTable } from './model_table.js';
import { isTestPath, statedHopLimit } from './oracle_truth.js';

export type Verdict = 'IN' | 'OUT' | 'UNSURE';

export interface Ruling {
    files: { path: string; verdict: Verdict; reason?: string }[];
    missing?: { path: string; reason?: string }[];
}

export interface ItemInput {
    reader: string[];
    oracle: string[];
    judges: Record<string, Ruling>;
    round2?: Record<string, Ruling>;
}

export interface ItemDecision {
    files: string[];
    verdict: 'agree' | 'corrected';
    /** Files on which the three voices did not all agree. */
    split: string[];
    /** Files a judge named missing that no second round admitted. */
    missingClaims: string[];
}

const sorted = (xs: Iterable<string>): string[] => [...new Set(xs)].sort();

export function decideItem(input: ItemInput): ItemDecision {
    const reader = new Set(input.reader);
    const judges = Object.values(input.judges);
    const candidates = new Set([...input.reader, ...input.oracle]);
    for (const j of judges) for (const f of j.files) candidates.add(f.path);

    const voteIn = (j: Ruling, p: string): boolean => j.files.some((f) => f.path === p && f.verdict === 'IN');
    const ins = (p: string): boolean[] => [reader.has(p), ...judges.map((j) => voteIn(j, p))];

    const files = new Set([...candidates].filter((p) => ins(p).filter(Boolean).length >= 2));
    const split = sorted([...candidates].filter((p) => new Set(ins(p)).size > 1));

    const claimed = sorted(judges.flatMap((j) => (j.missing ?? []).map((m) => m.path)).filter((p) => !files.has(p)));
    const second = Object.values(input.round2 ?? {});
    const admitted = claimed.filter((p) => second.length >= 2 && second.every((j) => voteIn(j, p)));
    for (const p of admitted) files.add(p);

    const result = sorted(files);
    const oracle = sorted(input.oracle);
    const verdict = result.length === oracle.length && result.every((p, i) => p === oracle[i]) ? 'agree' : 'corrected';
    return { files: result, verdict, split, missingClaims: claimed.filter((p) => !admitted.includes(p)) };
}

/** The `{"items": [...]}` object out of one judge reply. A reply without one is refused. */
export function parseRulings(text: string): Map<string, Ruling> {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    let parsed: { items?: (Ruling & { id: string })[] } | null = null;
    if (start >= 0 && end > start) {
        try {
            parsed = JSON.parse(text.slice(start, end + 1)) as { items?: (Ruling & { id: string })[] };
        } catch {
            parsed = null;
        }
    }
    if (!parsed?.items) throw new Error('judge reply carries no ruling ({"items": [...]})');
    return new Map(parsed.items.map((i) => [i.id, i]));
}

export interface CalibrationItem {
    gold: string[];
    decoys: string[];
}

/** One judge against blind calibration gold: IN on gold is a hit, IN on a decoy a false positive. */
export function calibrationScore(items: Record<string, CalibrationItem>, rulings: Map<string, Ruling>) {
    let gold = 0;
    let decoys = 0;
    let trueIn = 0;
    let falseIn = 0;
    for (const [id, c] of Object.entries(items)) {
        const r = rulings.get(id) ?? { files: [] };
        const isIn = (p: string): boolean => r.files.some((f) => f.path === p && f.verdict === 'IN');
        gold += c.gold.length;
        decoys += c.decoys.length;
        trueIn += c.gold.filter(isIn).length;
        falseIn += c.decoys.filter(isIn).length;
    }
    const round = (x: number): number => Math.round(x * 1000) / 1000;
    return {
        gold,
        decoys,
        true_in: trueIn,
        false_in: falseIn,
        recall: gold === 0 ? 0 : round(trueIn / gold),
        precision: trueIn + falseIn === 0 ? 0 : round(trueIn / (trueIn + falseIn)),
    };
}

/** Cohen's kappa for two raters on a binary label; null when chance agreement is total. */
export function cohenKappa(a: boolean[], b: boolean[]): number | null {
    const n = a.length;
    if (n === 0 || n !== b.length) return null;
    const observed = a.filter((x, i) => x === b[i]).length / n;
    const pa = a.filter(Boolean).length / n;
    const pb = b.filter(Boolean).length / n;
    const chance = pa * pb + (1 - pa) * (1 - pb);
    if (chance === 1) return null;
    return Math.round(((observed - chance) / (1 - chance)) * 1000) / 1000;
}

interface ReaderAnswer {
    id: string;
    answer_files: { path: string }[];
    confidence?: string;
    answerable_as_registered?: boolean;
}

function readJudges(file: string): Record<string, Map<string, Ruling>> {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as { responses: { provider: string; text: string }[] };
    return Object.fromEntries(doc.responses.map((r) => [r.provider, parseRulings(r.text)]));
}

const pick = (by: Record<string, Map<string, Ruling>>, id: string): Record<string, Ruling> =>
    Object.fromEntries(Object.entries(by).map(([prov, m]) => [prov, m.get(id) ?? { files: [] }]));

/** Every tracked-looking file under a subject, minus the trees no answer may cite. */
function listFiles(root: string): string[] {
    const out: string[] = [];
    const walk = (rel: string): void => {
        for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
            const p = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) {
                if (!/^(\.git|vendor|node_modules|storage|\.oracle)$/.test(e.name)) walk(p);
            } else out.push(p);
        }
    };
    walk('');
    return out;
}

/**
 * Check v2.1: per closure item, the files reachable over standing edges. `<dir>` holds
 * `edges-*.json` (reader), `edge-ids-<prefix>.json` and `edge-rulings-<prefix>-<n>.json`.
 */
function closureAnswers(dir: string | undefined, corpusPath: string | undefined): { answers: Map<string, { files: string[]; strictFiles: string[]; stated: number; standing: number }>; kappa: number | null } {
    const out = new Map<string, { files: string[]; strictFiles: string[]; stated: number; standing: number }>();
    if (!dir) return { answers: out, kappa: null };
    if (!corpusPath) throw new Error('--closure needs --corpus (class and hop limit per question)');
    const corpus = yaml.load(fs.readFileSync(corpusPath, 'utf8')) as { questions: { id: string; class: string; question?: string }[] };
    const qs = new Map(corpus.questions.map((q) => [q.id, q]));
    const names = fs.readdirSync(dir);
    const verdicts: Record<string, Map<string, EdgeVerdict>> = {};
    for (const prefix of ['ls', 'uo']) {
        const idsFile = path.join(dir, `edge-ids-${prefix}.json`);
        if (!fs.existsSync(idsFile)) continue;
        const ids = JSON.parse(fs.readFileSync(idsFile, 'utf8')) as Record<string, string>;
        for (const n of names.filter((x) => x.startsWith(`edge-rulings-${prefix}-`) && x.endsWith('.json'))) {
            const doc = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')) as { responses: { provider: string; text: string }[] };
            for (const r of doc.responses) {
                const m = (verdicts[r.provider] ??= new Map());
                for (const [k, v] of parseEdgeRulings(r.text, ids)) m.set(k, v);
            }
        }
        // Context round: a judge re-rules only edges it called UNSURE, with more lines shown.
        for (const n of names.filter((x) => x.startsWith(`context-rulings-${prefix}.`) && x.endsWith('.txt'))) {
            const provider = n.slice(`context-rulings-${prefix}.`.length, -'.txt'.length);
            const m = verdicts[provider];
            if (m === undefined) throw new Error(`${n}: no first-round rulings from ${provider}`);
            for (const [k, v] of parseEdgeRulings(fs.readFileSync(path.join(dir, n), 'utf8'), ids)) {
                if (m.get(k) === 'UNSURE') m.set(k, v);
            }
        }
    }
    // Enclosing symbol per <file>:<line>, from the oracle image's enclosing.php.
    const enclosing = new Map<string, Map<string, string>>();
    for (const prefix of ['ls', 'uo']) {
        const tsv = path.join(dir, `enclosing-${prefix}.tsv`);
        if (!fs.existsSync(tsv)) continue;
        enclosing.set(prefix, new Map(fs.readFileSync(tsv, 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t') as [string, string])));
    }
    for (const n of names.filter((x) => /^edges-.+\.json$/.test(x))) {
        const items = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8')) as { id: string; target: Target; edges: Edge[] }[];
        for (const it of items) {
            const q = qs.get(it.id);
            if (q === undefined) throw new Error(`${it.id}: not in the corpus`);
            const edges = it.edges.map((e) => ({ ...e, from_line: Number(e.from_line), to_line: Number(e.to_line) }));
            const standing = standingEdges(edges, verdicts);
            const limit = statedHopLimit(q.question);
            const symbols = enclosing.get(it.id.slice(0, 2));
            const close = (set: Edge[]): string[] =>
                [...closureFromEdges(
                    { ...it.target, line: Number(it.target.line) },
                    set,
                    { ...(limit === null ? {} : { hopLimit: limit }), testsOnly: q.class === 'tests-for' },
                    symbols === undefined ? undefined : (file, line) => symbols.get(`${file}:${line}`),
                ).keys()].sort();
            out.set(it.id, { files: close(standing), strictFiles: close(bothValidEdges(edges, verdicts)), stated: edges.length, standing: standing.length });
        }
    }
    const [va, vb] = Object.values(verdicts);
    const both = va && vb ? [...va.keys()].filter((k) => vb.has(k)) : [];
    const kappa = va && vb ? cohenKappa(both.map((k) => va.get(k) === 'VALID'), both.map((k) => vb.get(k) === 'VALID')) : null;
    return { answers: out, kappa };
}

function deriveClass3(corpusPath: string | undefined, work: string | undefined): Map<string, { table: string; files: string[] }> {
    const out = new Map<string, { table: string; files: string[] }>();
    if (!corpusPath || !work) return out;
    const corpus = yaml.load(fs.readFileSync(corpusPath, 'utf8')) as { questions: { id: string; class: string; subject: string; probe: string }[] };
    const lists = new Map<string, string[]>();
    for (const q of corpus.questions.filter((x) => x.class === 'model-table')) {
        const root = path.join(work, q.subject);
        if (!lists.has(q.subject)) lists.set(q.subject, listFiles(root));
        const d = deriveModelTable(q.probe, lists.get(q.subject) as string[], (p) => fs.readFileSync(path.join(root, p), 'utf8'));
        if (d !== null) out.set(q.id, d);
    }
    return out;
}

export function main(argv: string[]): number {
    const arg = (k: string): string | undefined => {
        const i = argv.indexOf(k);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const dir = arg('--check');
    const truthPath = arg('--truth');
    const outPath = arg('--out') ?? truthPath;
    const work = arg('--work');
    const lowerBound = new Set((arg('--lower-bound') ?? '').split(',').filter(Boolean));
    if (!dir || !truthPath) {
        process.stderr.write('usage: apply_check.ts --check <dir> --truth <truth.yaml> [--corpus <corpus.yaml> --work <dir>] [--closure <dir>] [--lower-bound <ids>] [--out <file>] [--date YYYY-MM-DD]\n');
        return 2;
    }
    const truth = yaml.load(fs.readFileSync(truthPath, 'utf8')) as {
        human_check: Record<string, unknown> & { sample: string[] };
        items: (Record<string, unknown> & { id: string; files: string[] })[];
    };
    const byId = new Map(truth.items.map((i) => [i.id, i]));
    const decided: string[] = [];
    const corrected: string[] = [];
    const byStatus: Record<string, [number, number]> = {};
    const derived = deriveClass3(arg('--corpus'), arg('--work'));
    const { answers: closure, kappa: edgeKappa } = closureAnswers(arg('--closure'), arg('--corpus'));
    const judgeRulings: Record<string, Map<string, Ruling>> = {};
    const kappaPairs: [boolean[], boolean[]] = [[], []];

    for (const f of fs.readdirSync(dir).filter((n) => /^answers-.+\.json$/.test(n)).sort()) {
        const group = f.slice('answers-'.length, -'.json'.length);
        const answers = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as ReaderAnswer[];
        const judges = readJudges(path.join(dir, `rulings-${group}.json`));
        for (const [prov, m] of Object.entries(judges)) for (const [id, r] of m) (judgeRulings[prov] ??= new Map()).set(id, r);
        const r2file = path.join(dir, `round2-${group}.json`);
        const round2 = fs.existsSync(r2file) ? readJudges(r2file) : null;
        for (const a of answers) {
            const item = byId.get(a.id);
            if (item === undefined) throw new Error(`${a.id}: not in the truth file`);
            const oracle = (item['oracle_files'] as string[] | undefined) ?? item.files ?? [];
            const picked = pick(judges, a.id);
            const [ja, jb] = Object.values(picked);
            if (ja && jb) {
                for (const p of new Set([...ja.files, ...jb.files].map((f) => f.path))) {
                    kappaPairs[0].push(ja.files.some((f) => f.path === p && f.verdict === 'IN'));
                    kappaPairs[1].push(jb.files.some((f) => f.path === p && f.verdict === 'IN'));
                }
            }
            const d = decideItem({
                reader: a.answer_files.map((x) => x.path),
                oracle,
                judges: picked,
                ...(round2 === null ? {} : { round2: pick(round2, a.id) }),
            });
            delete item['human_checked'];
            item['oracle_files'] = oracle;
            const derivation = derived.get(a.id);
            const byEdges = closure.get(a.id);
            if (byEdges !== undefined) {
                item.files = byEdges.files;
                item['check_rule'] = 'edges';
                item['check_edges'] = { stated: byEdges.stated, standing: byEdges.standing };
                const twoVoice = byEdges.files.filter((f) => !byEdges.strictFiles.includes(f));
                if (twoVoice.length > 0) item['two_voice_files'] = twoVoice;
                const subjectDir = work === undefined ? undefined : path.join(work, a.id.startsWith('ls') ? 'larasend' : 'unopim');
                const faked = subjectDir === undefined ? [] : byEdges.files.filter((f) => isTestPath(f) && fs.existsSync(path.join(subjectDir, f)) && fakesItsChain(fs.readFileSync(path.join(subjectDir, f), 'utf8')));
                if (faked.length > 0) item['faked_files'] = faked;
                item['check_vote_files'] = d.files;
            } else if (derivation === undefined) {
                item.files = d.files;
                delete item['check_rule'];
            } else {
                item.files = derivation.files;
                item['check_rule'] = 'derived';
                item['check_table'] = derivation.table;
                item['check_vote_files'] = d.files;
            }
            const final = [...item.files].sort();
            const verdict = final.length === oracle.length && [...oracle].sort().every((p, i) => p === final[i]) ? 'agree' : 'corrected';
            item['checked'] = verdict;
            item['check_split'] = d.split;
            if (d.missingClaims.length > 0) item['check_missing_claims'] = d.missingClaims;
            if (a.answerable_as_registered === false) item['check_note'] = 'reader: not answerable as registered';
            decided.push(a.id);
            if (verdict === 'corrected') corrected.push(a.id);
            const tally = (byStatus[String(item['status'])] ??= [0, 0]);
            tally[0] += verdict === 'corrected' ? 1 : 0;
            tally[1] += 1;
        }
    }

    const unsealed = truth.human_check.sample.filter((id) => !decided.includes(id));
    if (unsealed.length > 0) throw new Error(`sample items without a check: ${unsealed.join(', ')}`);
    const sampleCorrected = truth.human_check.sample.filter((id) => corrected.includes(id));
    truth.human_check['checked_by'] = 'council';
    truth.human_check['completed'] = arg('--date') ?? new Date().toISOString().slice(0, 10);
    truth.human_check['disagreement'] = {
        sample: `${sampleCorrected.length}/${truth.human_check.sample.length}`,
        sample_corrected: sampleCorrected,
        all_checked: `${corrected.length}/${decided.length}`,
        // An item the oracle could not answer at all is `corrected` by construction;
        // only the `oracle` and `oracle-partial` rows measure disagreement with an answer.
        corrected_by_oracle_status: Object.fromEntries(Object.entries(byStatus).map(([k, [c, n]]) => [k, `${c}/${n}`])),
    };
    const calFile = path.join(dir, 'calibration.json');
    if (fs.existsSync(calFile)) {
        const cal = JSON.parse(fs.readFileSync(calFile, 'utf8')) as Record<string, CalibrationItem>;
        truth.human_check['calibration'] = {
            items: Object.keys(cal).sort(),
            ...Object.fromEntries(Object.entries(judgeRulings).map(([prov, m]) => [prov, calibrationScore(cal, m)])),
        };
    }
    truth.human_check['judge_kappa'] = cohenKappa(kappaPairs[0], kappaPairs[1]);
    if (closure.size > 0) truth.human_check['edge_judge_kappa'] = edgeKappa;
    const classThree = [...derived.entries()].map(([id, d]) => {
        const vote = (byId.get(id)?.['check_vote_files'] as string[] | undefined) ?? [];
        return { id, agrees: vote.length === d.files.length && vote.every((p) => d.files.includes(p)) };
    });
    if (classThree.length > 0) truth.human_check['class3_vote_agrees_with_derivation'] = `${classThree.filter((c) => c.agrees).length}/${classThree.length}`;
    const header = fs.readFileSync(truthPath, 'utf8').split('\n').filter((l) => l.startsWith('#')).join('\n');
    for (const id of lowerBound) {
        const item = byId.get(id);
        if (item === undefined) throw new Error(`--lower-bound ${id}: not in the truth file`);
        item['lower_bound'] = true;
    }
    if (outPath === undefined) throw new Error('no output path');
    fs.writeFileSync(outPath, `${header}\n${yaml.dump(truth, { lineWidth: 120, noRefs: true })}`);
    process.stdout.write(`sealed ${decided.length} items · corrected ${corrected.length} · sample corrected ${sampleCorrected.length}/${truth.human_check.sample.length}\n`);
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
