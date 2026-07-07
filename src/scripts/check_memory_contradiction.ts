#!/usr/bin/env tsx
/**
 * Contradiction surfacing for `/memory promote` — road-to-second-brain
 * Phase 2 (council 2026-07-07, verdict:
 * `agents/settings/contexts/second-brain-delta-verdict.md`).
 *
 * Mechanical detector, deliberately NOT NLI: a candidate entry that shares a
 * PRIMARY KEY with an existing curated entry of the same durable type but has
 * LOW body similarity (Jaccard < 0.3) is a potential contradiction — same
 * topic, different claim. High similarity on the same key is a rewording /
 * extension (dedup territory, handled by `check_memory_similarity.ts`);
 * different keys are different topics.
 *
 * Scoped to the behaviorally load-bearing durable types only
 * (`incident-learnings`, `product-rules`, `domain-invariants` by default) —
 * exploratory types evolve legitimately and are never checked.
 *
 * The detector SURFACES; it never resolves. Resolution goes through the
 * existing contested flow in `/memory promote` (approve new + mark old
 * `contested` with provenance, or revise the new entry). Auto-resolution is
 * on the council REJECT list.
 *
 * Usage:
 *   check_memory_contradiction.ts --type <type> --key <primary-key> \
 *       --body "<text>" [--memory-root <dir>] [--durable-types a,b,c] [--format text|json]
 *
 * Exit codes: 0 = no contradiction (or type not durable — silent no-op),
 * 1 = potential contradiction found (surface the pair, ask the human),
 * 2 = usage error, 3 = internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

import { jaccardSimilarity } from './_lib/text_similarity.js';

const PROG = 'check_memory_contradiction.ts';

export const CONTRADICTION_THRESHOLD = 0.3;
export const DEFAULT_DURABLE_TYPES = new Set([
    'incident-learnings',
    'product-rules',
    'domain-invariants',
]);

// Fields whose values carry the entry's CLAIM (compared via Jaccard).
const BODY_FIELDS = ['rule', 'symptom', 'body', 'description', 'text', 'summary'] as const;
// Fields that can serve as the entry's primary key, in precedence order.
const KEY_FIELDS = ['key', 'id'] as const;

export interface CuratedEntry {
    file: string;
    key: string;
    body: string;
}

export interface ContradictionHit {
    existing: CuratedEntry;
    key: string;
    similarity: number;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function entryKey(entry: Record<string, unknown>): string {
    for (const f of KEY_FIELDS) {
        const v = entry[f];
        if (typeof v === 'string' && v.trim()) {
            return v.trim().toLowerCase();
        }
    }
    return '';
}

function entryBody(entry: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const f of BODY_FIELDS) {
        const v = entry[f];
        if (typeof v === 'string' && v.trim()) {
            parts.push(v.trim());
        }
    }
    return parts.join('\n');
}

function parseYamlDocs(file: string): Array<Record<string, unknown>> {
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf-8');
    } catch {
        return [];
    }
    const out: Array<Record<string, unknown>> = [];
    let parsed: unknown;
    try {
        parsed = YAML.parse(text);
    } catch {
        return [];
    }
    if (Array.isArray(parsed)) {
        for (const item of parsed) {
            if (isPlainObject(item)) out.push(item);
        }
    } else if (isPlainObject(parsed)) {
        // single-entry file (content-addressed layout) OR legacy
        // `{entries: [...]}` shape.
        const entries = parsed['entries'];
        if (Array.isArray(entries)) {
            for (const item of entries) {
                if (isPlainObject(item)) out.push(item);
            }
        } else {
            out.push(parsed);
        }
    }
    return out;
}

/** Load curated entries of one type — content-addressed dir + legacy single file. */
export function loadCuratedEntries(memoryRoot: string, type: string): CuratedEntry[] {
    const out: CuratedEntry[] = [];
    const shardDir = path.join(memoryRoot, type);
    let shardFiles: string[] = [];
    try {
        shardFiles = fs
            .readdirSync(shardDir)
            .filter((n) => n.endsWith('.yml') || n.endsWith('.yaml'))
            .sort()
            .map((n) => path.join(shardDir, n));
    } catch {
        // no shard dir — fine
    }
    const legacy = path.join(memoryRoot, `${type}.yml`);
    const files = fs.existsSync(legacy) ? [...shardFiles, legacy] : shardFiles;
    for (const file of files) {
        for (const entry of parseYamlDocs(file)) {
            const key = entryKey(entry);
            const body = entryBody(entry);
            if (key && body) {
                out.push({ file, key, body });
            }
        }
    }
    return out;
}

/**
 * Same primary key + Jaccard body similarity below the threshold →
 * potential contradiction. Returns at most ONE hit (the lowest-similarity
 * same-key entry) — one surfaced pair per promote is enough.
 */
export function findContradiction(
    candidateKey: string,
    candidateBody: string,
    existing: CuratedEntry[],
): ContradictionHit | null {
    const key = candidateKey.trim().toLowerCase();
    if (!key || !candidateBody.trim()) return null;
    let worst: ContradictionHit | null = null;
    for (const entry of existing) {
        if (entry.key !== key) continue;
        const similarity = jaccardSimilarity(candidateBody, entry.body);
        if (similarity < CONTRADICTION_THRESHOLD) {
            if (worst === null || similarity < worst.similarity) {
                worst = { existing: entry, key, similarity };
            }
        }
    }
    return worst;
}

function main(argv: string[]): number {
    let type = '';
    let key = '';
    let body = '';
    let memoryRoot = path.join('agents', 'memory');
    let durableTypes = DEFAULT_DURABLE_TYPES;
    let format = 'text';

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = (): string => {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write(`${PROG}: error: ${a} requires a value\n`);
                process.exit(2);
            }
            return v;
        };
        if (a === '--type') type = next();
        else if (a === '--key') key = next();
        else if (a === '--body') body = next();
        else if (a === '--memory-root') memoryRoot = next();
        else if (a === '--durable-types')
            durableTypes = new Set(
                next()
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
            );
        else if (a === '--format') {
            format = next();
            if (format !== 'text' && format !== 'json') {
                process.stderr.write(`${PROG}: error: --format must be text|json\n`);
                return 2;
            }
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                `usage: ${PROG} --type <type> --key <primary-key> --body <text> ` +
                    `[--memory-root <dir>] [--durable-types a,b,c] [--format text|json]\n`,
            );
            return 0;
        } else {
            process.stderr.write(`${PROG}: error: unknown argument ${a}\n`);
            return 2;
        }
    }

    if (!type || !key || !body) {
        process.stderr.write(`${PROG}: error: --type, --key and --body are required\n`);
        return 2;
    }

    if (!durableTypes.has(type)) {
        if (format === 'json') {
            process.stdout.write(JSON.stringify({ checked: false, reason: 'type-not-durable' }) + '\n');
        }
        return 0; // exploratory types are never contradiction-checked
    }

    let hit: ContradictionHit | null;
    try {
        hit = findContradiction(key, body, loadCuratedEntries(path.resolve(memoryRoot), type));
    } catch (exc) {
        process.stderr.write(`${PROG}: internal error: ${String(exc)}\n`);
        return 3;
    }

    if (!hit) {
        if (format === 'json') {
            process.stdout.write(JSON.stringify({ checked: true, contradiction: null }) + '\n');
        }
        return 0;
    }

    if (format === 'json') {
        process.stdout.write(
            JSON.stringify(
                {
                    checked: true,
                    contradiction: {
                        key: hit.key,
                        similarity: Number(hit.similarity.toFixed(4)),
                        threshold: CONTRADICTION_THRESHOLD,
                        existing_file: hit.existing.file,
                    },
                },
                null,
                2,
            ) + '\n',
        );
    } else {
        process.stdout.write(
            `⚠️  potential contradiction on key '${hit.key}' (similarity ` +
                `${hit.similarity.toFixed(2)} < ${CONTRADICTION_THRESHOLD}):\n` +
                `    existing: ${hit.existing.file}\n` +
                `    Resolve via the contested flow — approve new + mark old ` +
                `'contested' (with provenance), or revise the new entry. NEVER auto-resolve.\n`,
        );
    }
    return 1;
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
