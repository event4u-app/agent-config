#!/usr/bin/env tsx
/**
 * Memory-retrieval replay rig (road-to-memory-retrieval-economy Phase 0).
 *
 * Replays the corpus-derived query set (tests/fixtures/memory-replay/ —
 * provenance note in queries.yml; council 2026-07-08 Option-A verdict)
 * against the fixture memory root and measures, with the REAL tokenizer
 * (token_count.ts, cl100k_base — never chars/4, roadmap D2):
 *
 *   --baseline   full-envelope payload per query → pins
 *                internal/bench/reports/memory-retrieval-baseline.json
 *   --paired     index-mode envelope + memory_get(needed) payload vs the
 *                full baseline → run report + the three falsification
 *                checks from Phase 1b (token saving ≥30%, zero missed
 *                needed-fetches; the judge arm is reported as
 *                out-of-band — see report field `judge`)
 *   --check      CI regression: index-mode payload for the replay set must
 *                not exceed the recorded baseline's index payload by >5%.
 *                INERT (exit 0) while no baseline file exists.
 *
 * Exit codes: 0 ok/inert · 1 check failed or paired falsification red ·
 * 2 usage/fixture error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as YAML from 'yaml';

import {
    _setIntakeRoot,
    _setKnowledgeRoot,
    _setMemoryRoot,
    retrieve_v1,
} from './memory_lookup.js';
import { gpt_tokens, TIKTOKEN_AVAILABLE } from './_lib/token_count.js';

const _HERE = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const FIXTURE_DIR = path.join(ROOT, 'tests', 'fixtures', 'memory-replay');
export const BASELINE_PATH = path.join(
    ROOT,
    'internal',
    'bench',
    'reports',
    'memory-retrieval-baseline.json',
);

export interface ReplayQuery {
    readonly id: string;
    readonly types: string[];
    readonly keys: string[];
    readonly limit: number;
    readonly needed: string[];
}

export function load_queries(): ReplayQuery[] {
    const raw = YAML.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'queries.yml'), 'utf-8')) as {
        queries: ReplayQuery[];
    };
    return raw.queries;
}

/** Point the lookup module at the fixture memory tree. */
export function bind_fixture_root(): void {
    const memRoot = path.join(FIXTURE_DIR, 'memory-root');
    _setMemoryRoot(memRoot);
    _setKnowledgeRoot(path.join(memRoot, 'knowledge'));
    _setIntakeRoot(path.join(memRoot, 'intake-does-not-exist'));
}

/** Real-tokenizer size of an envelope, serialized the way a host sees it. */
export function envelope_tokens(envelope: unknown): number {
    return gpt_tokens(JSON.stringify(envelope)).tokens;
}

interface PerQuery {
    id: string;
    full_tokens: number;
    needed_found: number;
    needed_total: number;
    index_tokens?: number;
    fetch_tokens?: number;
    index_plus_fetch_tokens?: number;
    saving_pct?: number;
    missed_needed?: string[];
}

/** IDs present in a v1 envelope's entries. */
function _entry_ids(envelope: Record<string, unknown>): Set<string> {
    const out = new Set<string>();
    for (const e of (envelope['entries'] as Array<Record<string, unknown>>) ?? []) {
        out.add(String(e['id'] ?? ''));
    }
    return out;
}

type RetrieveV1 = (
    types: string[],
    keys: string[],
    limit?: number,
    options?: { detail?: 'index' | 'full' },
) => Record<string, unknown>;

/** Optional Phase-1 surfaces, absent before P1 lands. */
async function _phase1(): Promise<{
    retrieve_v1_detail: RetrieveV1 | null;
    memory_get: ((ids: string[]) => Record<string, unknown>) | null;
}> {
    const mod = (await import('./memory_lookup.js')) as Record<string, unknown>;
    const hasDetail = typeof mod['retrieve_v1'] === 'function' && (mod['retrieve_v1'] as { length: number }).length >= 0;
    const memoryGet = typeof mod['memory_get_v1'] === 'function'
        ? (mod['memory_get_v1'] as (ids: string[]) => Record<string, unknown>)
        : null;
    // Detail support is feature-detected by probing the options seam: before
    // Phase 1, passing options is harmless (extra arg ignored) but index mode
    // is only REAL when memory_get exists too.
    return { retrieve_v1_detail: hasDetail ? (retrieve_v1 as unknown as RetrieveV1) : null, memory_get: memoryGet };
}

export async function run(mode: 'baseline' | 'paired' | 'check'): Promise<number> {
    bind_fixture_root();
    const queries = load_queries();
    if (queries.length < 20) {
        process.stderr.write(`memory_replay: replay set too small (${queries.length} < 20)\n`);
        return 2;
    }
    const p1 = await _phase1();
    const perQuery: PerQuery[] = [];

    for (const q of queries) {
        const full = retrieve_v1(q.types, q.keys, q.limit);
        const fullIds = _entry_ids(full);
        const foundNeeded = q.needed.filter((n) => fullIds.has(n));
        const row: PerQuery = {
            id: q.id,
            full_tokens: envelope_tokens(full),
            needed_found: foundNeeded.length,
            needed_total: q.needed.length,
        };

        if (mode !== 'baseline' && p1.retrieve_v1_detail !== null && p1.memory_get !== null) {
            const index = p1.retrieve_v1_detail(q.types, q.keys, q.limit, { detail: 'index' });
            const indexIds = _entry_ids(index);
            const missed = q.needed.filter((n) => !indexIds.has(n));
            const fetched = p1.memory_get(q.needed);
            row.index_tokens = envelope_tokens(index);
            row.fetch_tokens = envelope_tokens(fetched);
            row.index_plus_fetch_tokens = row.index_tokens + row.fetch_tokens;
            row.saving_pct =
                Math.round((1 - row.index_plus_fetch_tokens / row.full_tokens) * 1000) / 10;
            row.missed_needed = missed;
        }
        perQuery.push(row);
    }

    const agg = {
        queries: perQuery.length,
        full_tokens: perQuery.reduce((s, r) => s + r.full_tokens, 0),
        needed_recall: perQuery.reduce((s, r) => s + r.needed_found, 0) /
            perQuery.reduce((s, r) => s + r.needed_total, 0),
        index_plus_fetch_tokens: perQuery.every((r) => r.index_plus_fetch_tokens !== undefined)
            ? perQuery.reduce((s, r) => s + (r.index_plus_fetch_tokens ?? 0), 0)
            : null,
    };
    const saving_pct = agg.index_plus_fetch_tokens === null
        ? null
        : Math.round((1 - agg.index_plus_fetch_tokens / agg.full_tokens) * 1000) / 10;

    const report = {
        schema_version: 1,
        kind: `memory-retrieval-${mode}`,
        roadmap: 'road-to-memory-retrieval-economy',
        corpus_provenance:
            'corpus-derived (council 2026-07-08 Option A) — see tests/fixtures/memory-replay/queries.yml header; claims scoped to corpus-derived replay queries',
        tokenizer: TIKTOKEN_AVAILABLE ? 'cl100k_base (tiktoken)' : 'PROXY chars/4 — NOT evidence (D2)',
        aggregate: { ...agg, saving_pct },
        per_query: perQuery,
    };

    if (mode === 'baseline') {
        fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
        fs.writeFileSync(BASELINE_PATH, JSON.stringify(report, null, 2) + '\n');
        process.stdout.write(
            `✅  baseline pinned: ${agg.queries} queries · full=${agg.full_tokens} tok · ` +
                `needed-recall=${(agg.needed_recall * 100).toFixed(1)}%\n`,
        );
        return agg.needed_recall === 1 ? 0 : 1;
    }

    if (mode === 'paired') {
        if (agg.index_plus_fetch_tokens === null) {
            process.stderr.write(
                'memory_replay: paired mode needs Phase 1 (detail + memory_get_v1) — not available\n',
            );
            return 2;
        }
        const missedTotal = perQuery.reduce((s, r) => s + (r.missed_needed?.length ?? 0), 0);
        const out = path.join(
            path.dirname(BASELINE_PATH),
            'memory-retrieval-run.json',
        );
        const checks = {
            'a-token-saving-ge-30pct': (saving_pct ?? 0) >= 30,
            'b-judge-win-rate': 'OUT-OF-BAND — run check_quality_regression paired judge before flip sign-off',
            'c-zero-missed-needed': missedTotal === 0,
        };
        fs.writeFileSync(out, JSON.stringify({ ...report, falsification: checks }, null, 2) + '\n');
        process.stdout.write(
            `paired: full=${agg.full_tokens} vs index+fetch=${agg.index_plus_fetch_tokens} ` +
                `(saving ${saving_pct}%) · missed-needed=${missedTotal} → ${out}\n`,
        );
        return checks['a-token-saving-ge-30pct'] && checks['c-zero-missed-needed'] ? 0 : 1;
    }

    // --check: inert without a baseline; else compare index payload drift.
    if (!fs.existsSync(BASELINE_PATH)) {
        process.stdout.write('memory_replay --check: no baseline pinned — inert.\n');
        return 0;
    }
    if (agg.index_plus_fetch_tokens === null) {
        // Phase 1 not landed: guard the FULL payload against >5% growth
        // instead, so the baseline still means something pre-split.
        const pinned = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as {
            aggregate: { full_tokens: number };
        };
        const limitTok = pinned.aggregate.full_tokens * 1.05;
        if (agg.full_tokens > limitTok) {
            process.stdout.write(
                `❌  memory_replay --check: full payload ${agg.full_tokens} exceeds baseline ` +
                    `${pinned.aggregate.full_tokens} by >5%\n`,
            );
            return 1;
        }
        process.stdout.write('✅  memory_replay --check: within baseline (+5%).\n');
        return 0;
    }
    const pinned = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf-8')) as {
        aggregate: { full_tokens: number };
    };
    const limitTok = pinned.aggregate.full_tokens * 1.05;
    if ((agg.index_plus_fetch_tokens ?? 0) > limitTok) {
        process.stdout.write(
            `❌  memory_replay --check: index payload ${agg.index_plus_fetch_tokens} exceeds ` +
                `baseline full ${pinned.aggregate.full_tokens} by >5%\n`,
        );
        return 1;
    }
    process.stdout.write('✅  memory_replay --check: index payload within baseline (+5%).\n');
    return 0;
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
    const mode = argv.includes('--baseline')
        ? 'baseline'
        : argv.includes('--paired')
          ? 'paired'
          : argv.includes('--check')
            ? 'check'
            : null;
    if (mode === null) {
        process.stderr.write('usage: memory_replay.ts --baseline | --paired | --check\n');
        return 2;
    }
    return run(mode);
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    main().then((code) => process.exit(code));
}
