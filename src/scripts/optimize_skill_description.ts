/**
 * optimize_skill_description.ts — U1 packaged description-optimizer loop
 * (road-to-ecosystem-harvest-skill-authoring-rigor).
 *
 * Chains the suite's existing primitives into ONE authoring workflow:
 * candidate descriptions × the skill's `evals/triggers.json` queries →
 * per-candidate trigger-rate, measured on a HELD-OUT split so the winning
 * description is picked on queries it was never tuned against (avoids
 * overfitting to the training queries).
 *
 * Split: queries are partitioned deterministically (stable hash of the query
 * text, even→train / odd→test) — reproducible without storing a seed.
 *
 * Judges:
 *   default   — deterministic proxy: does the query share ≥ 2 informative
 *               tokens (or one rare token) with the description? Free, fast,
 *               good for iteration.
 *   --live    — model judge (claude-haiku): "would this description fire for
 *               this query? YES/NO" — the real signal, ~$0.001/query·candidate.
 *
 * Usage:
 *   npx tsx src/scripts/optimize_skill_description.ts --skill fe-design \
 *     [--candidate "alt description …"]... [--live] [--max-usd 1]
 *
 * Output: per-candidate train/test trigger-accuracy table plus the paired verdict
 * of each candidate against the current description on the held-out queries. A
 * candidate is picked only on a `pass` that survives Holm correction across the
 * run's candidates — the same rule `_lib/paired_verdict.ts` imposes everywhere
 * else; a raw higher accuracy on ~5 held-out queries is one flipped query.
 * Exit 0 always (authoring tool, not a gate).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { correctForMultiplicity, decidePairedVerdict, type PairedVerdict } from './_lib/paired_verdict.js';

export interface TriggerQuery {
    q: string;
    trigger: boolean;
}

/** Deterministic stable split — even hash → train, odd → test. */
export function split_queries(queries: TriggerQuery[]): { train: TriggerQuery[]; test: TriggerQuery[] } {
    const train: TriggerQuery[] = [];
    const test: TriggerQuery[] = [];
    for (const query of queries) {
        let h = 0;
        for (const ch of query.q) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
        (h % 2 === 0 ? train : test).push(query);
    }
    return { train, test };
}

const STOP = new Set(['the', 'a', 'an', 'for', 'to', 'of', 'and', 'or', 'in', 'on', 'with', 'when', 'use', 'via', 'this', 'that', 'my', 'our', 'me', 'we', 'is', 'are', 'it', 'before', 'after']);

export function tokens(s: string): Set<string> {
    return new Set(
        s.toLowerCase().split(/[^a-z0-9]+/u).filter((t) => t.length > 2 && !STOP.has(t)),
    );
}

/** Deterministic proxy judge: informative-token overlap between query and description. */
export function proxy_fires(description: string, query: string): boolean {
    const d = tokens(description);
    const q = tokens(query);
    let overlap = 0;
    for (const t of q) if (d.has(t)) overlap += 1;
    return overlap >= 2;
}

export function accuracy(
    fires: (desc: string, q: string) => boolean,
    desc: string,
    queries: TriggerQuery[],
): number {
    if (queries.length === 0) return 0;
    let ok = 0;
    for (const query of queries) {
        if (fires(desc, query.q) === query.trigger) ok += 1;
    }
    return ok / queries.length;
}

/**
 * Each candidate against the current description on the same queries: per query
 * +1 when only the candidate judges it right, -1 when only the current one does.
 * Verdicts are corrected together; the pick is the strongest surviving `pass`,
 * else the current description.
 */
export function pairedPick(
    fires: (desc: string, q: string) => boolean,
    current: string,
    candidates: readonly string[],
    queries: readonly TriggerQuery[],
): { verdicts: PairedVerdict[]; pick: number } {
    const right = (desc: string, q: TriggerQuery): number => (fires(desc, q.q) === q.trigger ? 1 : 0);
    const raw = candidates.map((c) => decidePairedVerdict({ deltas: queries.map((q) => right(c, q) - right(current, q)) }));
    const verdicts = correctForMultiplicity(raw);
    let pick = 0;
    let bestP = Infinity;
    verdicts.forEach((v, i) => {
        if (v.kind === 'pass' && v.p < bestP) {
            bestP = v.p;
            pick = i + 1;
        }
    });
    return { verdicts, pick };
}

async function live_judge_factory(maxUsd: number): Promise<(desc: string, q: string) => boolean> {
    const c = await import('./ai_council/clients.js');
    const client = new c.AnthropicClient({ api_key: c.load_anthropic_key(), model: 'claude-haiku-4-5-20251001' });
    let spent = 0;
    return (desc: string, q: string): boolean => {
        if (spent >= maxUsd) throw new Error(`live-judge budget $${maxUsd} exhausted`);
        const resp = client.ask(
            'You decide whether an agent skill would activate. Answer exactly YES or NO.',
            `Skill description: "${desc}"\nUser query: "${q}"\nWould this skill fire for this query?`,
            8,
        );
        if (resp.error) throw new Error(resp.error);
        spent += ((resp.input_tokens / 1e6) * 0.25) + ((resp.output_tokens / 1e6) * 1.25);
        return /YES/i.test(resp.text);
    };
}

export async function main(argv: string[]): Promise<number> {
    const skillIdx = argv.indexOf('--skill');
    if (skillIdx === -1) {
        process.stderr.write('usage: --skill <id> [--candidate "…"]... [--live] [--max-usd 1]\n');
        return 2;
    }
    const skill = argv[skillIdx + 1] ?? '';
    const live = argv.includes('--live');
    const mu = argv.indexOf('--max-usd');
    const maxUsd = mu !== -1 ? Number(argv[mu + 1]) : 1;
    const candidates: string[] = [];
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--candidate') candidates.push(argv[i + 1] ?? '');
    }

    const skillMd = fs.readFileSync(path.join('src/skills', skill, 'SKILL.md'), 'utf-8');
    const current = (skillMd.match(/^description:\s*["']?(.+?)["']?\s*$/m) ?? [])[1] ?? '';
    const triggers = JSON.parse(
        fs.readFileSync(path.join('src/skills', skill, 'evals', 'triggers.json'), 'utf-8'),
    ) as { queries: TriggerQuery[] };
    const { train, test } = split_queries(triggers.queries);
    process.stdout.write(`skill ${skill}: ${triggers.queries.length} queries → train ${train.length} / held-out ${test.length}\n\n`);

    const judge = live ? await live_judge_factory(maxUsd) : proxy_fires;
    const all = [current, ...candidates];
    const { verdicts, pick } = pairedPick(judge, current, candidates, test);
    process.stdout.write('| # | description (first 70 chars) | train | TEST (held-out) | paired vs current |\n|---|---|---:|---:|---|\n');
    all.forEach((desc, i) => {
        const tr = accuracy(judge, desc, train);
        const te = accuracy(judge, desc, test);
        const v = i === 0 ? '—' : (verdicts[i - 1]?.kind ?? '—');
        process.stdout.write(`| ${i === 0 ? 'current' : i} | ${desc.slice(0, 70)} | ${(tr * 100).toFixed(0)}% | ${(te * 100).toFixed(0)}% | ${v} |\n`);
    });
    for (const [i, v] of verdicts.entries()) process.stdout.write(`candidate ${String(i + 1)}: ${v.kind} — ${v.reason}\n`);
    process.stdout.write(`\npick: ${pick === 0 ? 'current description (no candidate passed after correction)' : `candidate ${String(pick)}`}\n`);
    return 0;
}

const isMain = process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
    main(process.argv.slice(2)).then(
        (code) => process.exit(code),
        (err) => {
            process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
            process.exit(1);
        },
    );
}
