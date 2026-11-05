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

export function main(argv: string[]): number {
    const arg = (k: string): string | undefined => {
        const i = argv.indexOf(k);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const dir = arg('--check');
    const truthPath = arg('--truth');
    if (!dir || !truthPath) {
        process.stderr.write('usage: apply_check.ts --check <dir> --truth <truth.yaml> [--date YYYY-MM-DD]\n');
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

    for (const f of fs.readdirSync(dir).filter((n) => /^answers-.+\.json$/.test(n)).sort()) {
        const group = f.slice('answers-'.length, -'.json'.length);
        const answers = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as ReaderAnswer[];
        const judges = readJudges(path.join(dir, `rulings-${group}.json`));
        const r2file = path.join(dir, `round2-${group}.json`);
        const round2 = fs.existsSync(r2file) ? readJudges(r2file) : null;
        for (const a of answers) {
            const item = byId.get(a.id);
            if (item === undefined) throw new Error(`${a.id}: not in the truth file`);
            const d = decideItem({
                reader: a.answer_files.map((x) => x.path),
                oracle: item.files ?? [],
                judges: pick(judges, a.id),
                ...(round2 === null ? {} : { round2: pick(round2, a.id) }),
            });
            delete item['human_checked'];
            item['oracle_files'] = item.files ?? [];
            item.files = d.files;
            item['checked'] = d.verdict;
            item['check_split'] = d.split;
            if (d.missingClaims.length > 0) item['check_missing_claims'] = d.missingClaims;
            if (a.answerable_as_registered === false) item['check_note'] = 'reader: not answerable as registered';
            decided.push(a.id);
            if (d.verdict === 'corrected') corrected.push(a.id);
            const tally = (byStatus[String(item['status'])] ??= [0, 0]);
            tally[0] += d.verdict === 'corrected' ? 1 : 0;
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
    const header = fs.readFileSync(truthPath, 'utf8').split('\n').filter((l) => l.startsWith('#')).join('\n');
    fs.writeFileSync(truthPath, `${header}\n${yaml.dump(truth, { lineWidth: 120, noRefs: true })}`);
    process.stdout.write(`sealed ${decided.length} items · corrected ${corrected.length} · sample corrected ${sampleCorrected.length}/${truth.human_check.sample.length}\n`);
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
