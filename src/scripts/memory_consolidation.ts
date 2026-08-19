#!/usr/bin/env tsx
/**
 * Store-wide consolidation candidates for the curated engineering memory.
 *
 * WHY THIS EXISTS (road-to-context-fidelity Phase 2, step 2).
 * The session index injects a capped list of curated entries
 * (`SESSION_INDEX_ROW_CAP = 30` in `session_memory_index.ts`), so two entries
 * saying the same thing do not merely waste a row — they spend a scarce one
 * twice and crowd out an entry the session never sees.
 *
 * WHAT IS NEW HERE IS THE POLICY, NOT THE MACHINERY. The similarity function
 * is `_lib/text_similarity`, unchanged and shared with
 * `check_memory_similarity` — the same Jaccard tokeniser and the same
 * `MERGE_THRESHOLD` / `WARN_THRESHOLD` bands a `/memory propose` run already
 * uses. What that script cannot do is look at the store: it takes one
 * *candidate* body and scans intake. This iterates the curated store itself,
 * which is a different entry point, and it is the only thing this file adds.
 *
 * IT NEVER MERGES. A merge decides which of two claims survives, which is a
 * semantic judgement — the same class of judgement cf04 measured a mechanical
 * proxy for and found at 0.00x lift over the base rate. Auto-resolution was
 * also put on a prior council's explicit REJECT list for the contradiction
 * detector, and the reasoning transfers unchanged. This reports pairs; a human
 * decides.
 *
 * Not a gate: always exits 0, no gate-coverage entry. A blocking gate on a
 * similarity threshold would fail a PR for writing a second entry about a
 * topic that legitimately has two.
 *
 * Usage:
 *     memory_consolidation                    # merge + warn bands
 *     memory_consolidation --threshold 0.5
 *     memory_consolidation --format json
 *
 * Exit codes: 0 always (report), 3 = internal error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

import {
    MERGE_THRESHOLD,
    WARN_THRESHOLD,
    classifySimilarity,
    jaccardSimilarity,
    type SimilarityClass,
} from './_lib/text_similarity.js';

const PROG = 'memory_consolidation.ts';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_STORE = 'agents/memory';

export interface Pair {
    a: string;
    b: string;
    type_a: string;
    type_b: string;
    score: number;
    band: SimilarityClass;
}

interface Row {
    id: string;
    type: string;
    text: string;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function loadRows(storeDir: string): Row[] {
    const base = path.isAbsolute(storeDir) ? storeDir : path.join(REPO_ROOT, storeDir);
    let names: string[] = [];
    try {
        names = fs.readdirSync(base).filter((n) => n.endsWith('.yml')).sort();
    } catch {
        return [];
    }
    const rows: Row[] = [];
    for (const n of names) {
        let parsed: unknown;
        try {
            parsed = YAML.parse(fs.readFileSync(path.join(base, n), 'utf-8'));
        } catch {
            continue;
        }
        if (!isPlainObject(parsed) || !Array.isArray(parsed['entries'])) continue;
        for (const e of parsed['entries'] as unknown[]) {
            if (!isPlainObject(e)) continue;
            const parts: string[] = [];
            for (const f of ['key', 'body', 'rule', 'symptom', 'description', 'summary']) {
                const v = e[f];
                if (typeof v === 'string' && v.trim()) parts.push(v);
            }
            rows.push({ id: String(e['id'] ?? ''), type: n.replace(/\.yml$/, ''), text: parts.join('\n') });
        }
    }
    return rows;
}

/**
 * All pairs at or above `threshold`, each reported once.
 *
 * Cross-type pairs are included deliberately: the same claim recorded once as
 * an incident learning and once as a product rule is exactly the duplication
 * worth surfacing, and it is invisible to any per-type scan.
 *
 * `threshold` is the ONLY filter, and the shared band is informational. The
 * first version filtered on the band as well, which silently made
 * `--threshold` inert below `WARN_THRESHOLD` — an instrument that could not
 * fire and reported zero either way, which is indistinguishable from a clean
 * store and is precisely the false-green shape this repo has a name for.
 */
export function candidatePairs(rows: readonly Row[], threshold: number): Pair[] {
    const out: Pair[] = [];
    for (let i = 0; i < rows.length; i += 1) {
        const left = rows[i];
        if (!left) continue;
        for (let j = i + 1; j < rows.length; j += 1) {
            const right = rows[j];
            if (!right) continue;
            const score = jaccardSimilarity(left.text, right.text);
            if (score < threshold) continue;
            const band = classifySimilarity(score);
            out.push({
                a: left.id,
                b: right.id,
                type_a: left.type,
                type_b: right.type,
                score,
                band,
            });
        }
    }
    out.sort((x, y) => y.score - x.score || x.a.localeCompare(y.a));
    return out;
}

export function main(argv: readonly string[]): number {
    let storeDir = DEFAULT_STORE;
    let format = 'text';
    let threshold = WARN_THRESHOLD;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--path') storeDir = argv[++i] ?? DEFAULT_STORE;
        else if (a === '--format') format = argv[++i] ?? 'text';
        else if (a === '--threshold') threshold = parseFloat(argv[++i] ?? '') || WARN_THRESHOLD;
        else if (a === '--help' || a === '-h') {
            process.stdout.write(
                `usage: ${PROG} [--path DIR] [--format text|json] [--threshold N]\n` +
                    `Near-duplicate pairs in the curated memory store. Reports only —\n` +
                    `a merge decides which claim survives, and that is a human call.\n`,
            );
            return 0;
        }
    }

    const rows = loadRows(storeDir);
    const pairs = candidatePairs(rows, threshold);
    if (format === 'json') {
        process.stdout.write(`${JSON.stringify({ scanned: rows.length, pairs }, null, 2)}\n`);
        return 0;
    }
    const lines = [
        `${PROG} · consolidation candidates — reports pairs, never merges`,
        `scanned: ${rows.length} entr(ies) · thresholds: merge ≥ ${MERGE_THRESHOLD}, warn ≥ ${WARN_THRESHOLD}`,
        `candidates: ${pairs.length}`,
        '',
    ];
    for (const p of pairs) {
        lines.push(`  ${p.band.padEnd(5)} ${p.score.toFixed(2)}  ${p.type_a}/${p.a}  ↔  ${p.type_b}/${p.b}`);
    }
    process.stdout.write(`${lines.join('\n')}\n`);
    return 0;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    try {
        process.exit(main(process.argv.slice(2)));
    } catch (e) {
        process.stderr.write(`${PROG}: internal error: ${(e as Error).message}\n`);
        process.exit(3);
    }
}
