#!/usr/bin/env -S npx tsx
/**
 * Offline re-scorer for the Phase-3 search-adherence endpoint — T5.
 *
 * Reads a finished `ab-v2` report, loads each trial's **preserved transcript**
 * (the sibling file `bench_ab_v2_run.preserve_transcript` writes next to the
 * clone), scores it against the k=2 rubric in
 * `_lib/bench_ab_search_adherence.ts`, and writes one number into each trial's
 * `metrics`:
 *
 *   - `search_adherence` — fraction of rubric items **both** judges credited.
 *     Omitted, never zeroed, when the trial is unmeasurable.
 *
 * WHY OFFLINE. T5 is the one endpoint that genuinely needs model calls, which
 * is exactly why it must not run inside the sweep: a judge failure or a rate
 * limit mid-sweep would stall the metered path, and re-judging would mean
 * re-running the arm. Freezing the transcript and judging afterwards is the
 * `anchor_scoring_run.ts` shape — reproducibility comes from freezing, not from
 * pinning a model.
 *
 * WHY IT COSTS MONEY AND WHAT THAT MEANS HERE. Two judge calls per trial (plus
 * at most one retry each) is real spend, so **the default is the mock judge**:
 * deterministic, no key, no network, exercised by the tests. Live judging is
 * opt-in via `--live`, which is the only path that touches a key. There is no
 * `--dry-run` flag — the absence of `--live` IS the dry run, and an earlier
 * version of this line named a flag `main` does not parse.
 *
 * Usage:
 *   bench_ab_v2_search.ts <report.json> [--live] [--write] [--json]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

import {
    type AskFn,
    SEARCH_ADHERENCE_K,
    scoreSearchAdherence,
    transcriptFromPrompt,
} from './_lib/bench_ab_search_adherence.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CORPUS_PATH = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-trackb-v2.yaml');

type Dict = Record<string, unknown>;

function _dictOr(v: unknown): Dict {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Dict) : {};
}

/** task id → the prompt the run was given; the judge needs it for context. */
export function loadTaskPrompts(corpusPath: string | null): Map<string, string> {
    const byId = new Map<string, string>();
    if (!corpusPath || !fs.existsSync(corpusPath)) return byId;
    try {
        const corpus = _dictOr(parseYaml(fs.readFileSync(corpusPath, 'utf8'), { version: '1.1' }));
        const tasks = Array.isArray(corpus['tasks']) ? (corpus['tasks'] as Dict[]) : [];
        for (const t of tasks) {
            if (t['id'] !== undefined) byId.set(String(t['id']), String(t['prompt'] ?? ''));
        }
    } catch {
        return byId;
    }
    return byId;
}

export interface SearchRescore {
    task: string;
    arm: string;
    seed: unknown;
    search_adherence: number | null;
    reason: string;
}

/**
 * Re-score one report payload. Mutates `payload` only when `write` is true.
 *
 * On an unmeasured trial any stale key is **deleted** rather than set to 0 —
 * `compare()` reads a missing metric as "not measured on this pair", while a 0
 * would assert the run searched for nothing.
 */
export function rescoreSearch(
    payload: Dict,
    opts: {
        asks: AskFn[];
        write?: boolean;
        corpusPath?: string | null;
        readTranscript?: (p: string) => string | null;
    },
): SearchRescore[] {
    const prompts = loadTaskPrompts(opts.corpusPath === undefined ? CORPUS_PATH : opts.corpusPath);
    const readTranscript =
        opts.readTranscript ??
        ((p: string): string | null => {
            try {
                return fs.readFileSync(p, 'utf8');
            } catch {
                return null;
            }
        });
    const out: SearchRescore[] = [];
    let wrote = 0;
    // Reset every call — see the same note in bench_ab_v2_safety.ts.
    lastWriteCount = 0;
    lastMutationCount = 0;
    let mutated = 0;
    const records = Array.isArray(payload['records']) ? (payload['records'] as Dict[]) : [];

    for (const rec of records) {
        const taskId = String(rec['id'] ?? '<unknown>');
        const taskPrompt = prompts.get(taskId) ?? '';
        const arms = _dictOr(rec['arms']);
        for (const [arm, runsRaw] of Object.entries(arms)) {
            const runs = Array.isArray(runsRaw) ? (runsRaw as Dict[]) : [];
            for (const trial of runs) {
                const row: SearchRescore = {
                    task: taskId,
                    arm,
                    seed: trial['seed'] ?? null,
                    search_adherence: null,
                    reason: '',
                };

                const tp = trial['transcript_path'];
                const transcriptPath = tp === undefined || tp === null ? '' : String(tp);
                if (!transcriptPath) {
                    // Three different causes land here and the re-scorer cannot
                    // tell them apart from the report alone: a sweep older than
                    // transcript preservation, a trial whose transcript was
                    // empty, and the `package-recursive` arm, which records
                    // neither a workspace nor a transcript. Naming one of the
                    // three as THE reason was the first version of this line and
                    // it was wrong for a sweep run today.
                    row.reason =
                        'no transcript recorded (older report, empty transcript, ' +
                        'or an arm that preserves none — e.g. package-recursive)';
                } else {
                    const transcript = readTranscript(transcriptPath);
                    if (transcript === null) {
                        row.reason = 'transcript missing on disk';
                    } else if (taskPrompt === '') {
                        row.reason = 'task id not in the corpus';
                    } else {
                        const res = scoreSearchAdherence({ asks: opts.asks, taskPrompt, transcript });
                        row.search_adherence = res.score;
                        row.reason = res.reason;
                    }
                }

                if (opts.write) {
                    const metrics = _dictOr(trial['metrics']);
                    const before = metrics['search_adherence'];
                    if (row.search_adherence === null) {
                        delete metrics['search_adherence'];
                    } else {
                        metrics['search_adherence'] = row.search_adherence;
                        wrote += 1;
                    }
                    if (before !== metrics['search_adherence']) mutated += 1;
                    trial['metrics'] = metrics;
                }
                out.push(row);
            }
        }
    }
    if (opts.write) {
        lastWriteCount = wrote;
        lastMutationCount = mutated;
    }
    return out;
}

/** Trials the last write-mode call measured. Reset to 0 on every call. */
let lastWriteCount = 0;
export function trialsWrittenByLastSearchRescore(): number {
    return lastWriteCount;
}

/**
 * Trials the last write-mode call CHANGED, deletions included — the number the
 * CLI persists on. See the same note in `bench_ab_v2_safety.ts`.
 */
let lastMutationCount = 0;
export function trialsMutatedByLastSearchRescore(): number {
    return lastMutationCount;
}

/**
 * The dry-run judge — deterministic, keyless, and deliberately NOT all-yes.
 *
 * It credits an item only when the transcript literally carries the evidence
 * shape that item asks about, so a dry run over a real corpus produces a spread
 * rather than a flat ceiling. An all-yes mock would make every smoke test pass
 * while telling nobody whether the pipeline can express a `no`.
 */
export function mockJudge(prompt: string): string {
    // `transcriptFromPrompt`, never a split on the header: the rubric that
    // follows the transcript contains every keyword below, so a naive slice
    // scores the instrument and returns an all-yes ceiling for any input.
    const body = transcriptFromPrompt(prompt);
    const named = /\b(reuse|existing|already have|instead of writing)\b/i.test(body);
    // `cat ` / `ls ` must NOT be followed by `\b`: a word boundary after a space
    // demands a word character next, so `cat /etc/hosts` and `ls -la` — the two
    // shapes a transcript actually contains — never matched. Their boundary goes
    // BEFORE the token instead.
    const inspected = /\b(read|grep|opened|listed)\b|\b(cat|ls) /i.test(body);
    const justified = /\b(because|so I|therefore|rather than)\b/i.test(body);
    return [
        `NAMED: ${named ? 'yes' : 'no'}`,
        `INSPECTED: ${inspected ? 'yes' : 'no'}`,
        `JUSTIFIED: ${justified ? 'yes' : 'no'}`,
    ].join('\n');
}

/**
 * Build the two live judges.
 *
 * The client import is lazy and lives inside this function on purpose: nothing
 * that imports this module for its pure parts should resolve a key path, which
 * is what keeps the whole test suite keyless. A missing key is a hard exit with
 * a pointer, never a silent degrade to one judge — k=2 is pre-registered, and
 * quietly running at k=1 would report a number the record does not describe.
 */
function liveJudges(model: { anthropic: string; openai: string }): AskFn[] {
    const require_ = createRequire(_HERE);
    const clients = require_('./ai_council/clients.js') as {
        AnthropicClient: new (o: { model: string; api_key: string }) => { ask(s: string, u: string): { text: string } };
        OpenAIClient: new (o: { model: string; api_key: string }) => { ask(s: string, u: string): { text: string } };
        load_anthropic_key: () => string;
        load_openai_key: () => string;
    };
    const system = 'You are a strict evidence scorer. Answer only in the requested three-line format.';
    const a = new clients.AnthropicClient({
        model: model.anthropic,
        api_key: clients.load_anthropic_key(),
    });
    const o = new clients.OpenAIClient({ model: model.openai, api_key: clients.load_openai_key() });
    return [
        (p: string) => requireText(a.ask(system, p).text, 'anthropic'),
        (p: string) => requireText(o.ask(system, p).text, 'openai'),
    ];
}

/**
 * Assert the client returned a string.
 *
 * The `as` cast above describes the client surface by hand, so TypeScript
 * verifies nothing about it: if a client's `ask` ever becomes async, `.text` is
 * `undefined`, both judges return incomplete readings, and EVERY trial reports
 * unmeasured — a silent, total, and entirely plausible-looking null on the only
 * path that spends money. Throwing turns that into one loud failure, which the
 * caller already converts into a hard exit.
 */
function requireText(value: unknown, vendor: string): string {
    if (typeof value !== 'string') {
        throw new Error(
            `${vendor} judge returned ${typeof value}, not a string — ` +
                'the client surface changed (async ask?), and AskFn is synchronous',
        );
    }
    return value;
}

async function main(argv: string[]): Promise<number> {
    const args = argv.filter((a) => !a.startsWith('--'));
    const write = argv.includes('--write');
    const asJson = argv.includes('--json');
    const live = argv.includes('--live');
    const reportPath = args[0];
    if (!reportPath) {
        process.stderr.write(
            'usage: bench_ab_v2_search.ts <report.json> [--live] [--write] [--json]\n',
        );
        return 1;
    }
    if (!fs.existsSync(reportPath)) {
        process.stderr.write(`report not found: ${reportPath}\n`);
        return 1;
    }

    let asks: AskFn[];
    if (live) {
        try {
            asks = liveJudges({ anthropic: 'claude-sonnet-4-5', openai: 'gpt-5' });
        } catch (err) {
            process.stderr.write(
                `error: live judging unavailable (${String(err)}). ` +
                    `T5 is pre-registered at k=${SEARCH_ADHERENCE_K}; running with fewer judges ` +
                    'would report a number the record does not describe. Use --dry-run semantics ' +
                    '(omit --live) or install the keys.\n',
            );
            return 1;
        }
    } else {
        process.stderr.write('⚠️  no --live: deterministic mock judges, no API, no spend.\n');
        asks = [mockJudge, mockJudge];
    }

    const payload = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Dict;
    const rows = rescoreSearch(payload, { asks, write });
    if (write && trialsMutatedByLastSearchRescore() > 0) {
        fs.writeFileSync(reportPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    } else if (write) {
        process.stderr.write('nothing changed — report left untouched\n');
    }
    process.stdout.write(asJson ? `${JSON.stringify(rows, null, 2)}\n` : `${renderSearchTable(rows)}\n`);
    return 0;
}

export function renderSearchTable(rows: SearchRescore[]): string {
    const L: string[] = [];
    L.push('task | arm | seed | search | note');
    L.push('-----|-----|------|--------|-----');
    for (const r of rows) {
        L.push(
            [
                r.task,
                r.arm,
                String(r.seed ?? ''),
                r.search_adherence === null ? '-' : r.search_adherence.toFixed(2),
                r.reason,
            ].join(' | '),
        );
    }
    const measured = rows.filter((r) => r.search_adherence !== null).length;
    L.push('');
    L.push(`${measured}/${rows.length} trials carry a search-adherence observation.`);
    return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(_HERE)) {
    main(process.argv.slice(2)).then(
        (code) => process.exit(code),
        (err: unknown) => {
            process.stderr.write(`${String(err)}\n`);
            process.exit(1);
        },
    );
}
