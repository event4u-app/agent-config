// Tests for src/scripts/memory_lookup.ts — file-based retrieval fallback.
//
// 1:1 port of tests/test_memory_lookup.py (pytest → vitest, ADR-094 parity
// contract). The pytest suite imports the module and calls retrieve() /
// retrieve_v1() directly; these mirror that against the TS twin. The
// retrieve() contract (signature + return shape) is cited by rules, so it is
// exercised directly. A trailing golden-parity block runs python3 + tsx —
// retrieve() via a python3 -c driver and the CLI surfaces on identical
// fixtures — asserting byte-exact output, skipped without python3.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ml from '../../src/scripts/memory_lookup.js';



type Hit = InstanceType<typeof ml.Hit>;

// Freshness fixtures must be relative to the real clock — a hardcoded date
// silently expires past `review_after_days` and flips retrieve() to 0 hits
// (memory-test clock-drift, 2026-07-04). Use today so the entry is always fresh.
const TODAY_ISO = new Date().toISOString().slice(0, 10);

// dedent helper mirroring textwrap.dedent.
function dedent(s: string): string {
    const lines = s.replace(/^\n/, '').split('\n');
    const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)?.[0].length ?? 0);
    const min = indents.length ? Math.min(...indents) : 0;
    return lines.map((l) => l.slice(min)).join('\n');
}

function write(p: string, content: string): void {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, dedent(content), 'utf-8');
}

let tmp: string;
let origCwd: string;

// _chdir analog: chdir into tmp + repoint module roots at relative paths.
function chdirInto(dir: string): void {
    process.chdir(dir);
    ml._setMemoryRoot(join('agents', 'memory'));
    ml._setIntakeRoot(join('agents', 'memory', 'intake'));
    ml._setKnowledgeRoot(join('agents', 'memory', 'knowledge'));
}

beforeEach(() => {
    origCwd = process.cwd();
    tmp = mkdtempSync(join(tmpdir(), 'memlook-'));
});
afterEach(() => {
    process.chdir(origCwd);
    ml._setMemoryRoot(join('agents', 'memory'));
    ml._setIntakeRoot(join('agents', 'memory', 'intake'));
    ml._setKnowledgeRoot(join('agents', 'memory', 'knowledge'));
    rmSync(tmp, { recursive: true, force: true });
});

// =========================================================================
// 1:1 port of test_memory_lookup.py
// =========================================================================

describe('memory_lookup.ts — retrieve()', () => {
    it('no memory dir returns empty', () => {
        chdirInto(tmp);
        expect(ml.retrieve(['ownership'], ['anything'])).toEqual([]);
    });

    it('curated single-file layout', () => {
        chdirInto(tmp);
        write(
            join(tmp, 'agents/memory/ownership.yml'),
            `
        version: 1
        entries:
          - id: own-1
            status: active
            confidence: high
            source: ["docs/teams.md"]
            owner: team-payments
            last_validated: ${TODAY_ISO}
            review_after_days: 180
            path: "app/Http/Controllers/Billing/**"
    `,
        );
        const hits = ml.retrieve(['ownership'], ['billing'], 5) as Hit[];
        expect(hits.length).toBe(1);
        expect(hits[0]?.id).toBe('own-1');
        expect(hits[0]?.source).toBe('curated');
        expect(hits[0]?.score).toBeGreaterThan(0);
    });

    it('content-addressed layout', () => {
        chdirInto(tmp);
        write(
            join(tmp, 'agents/memory/domain-invariants/abc123.yml'),
            `
        id: di-1
        status: active
        confidence: high
        source: ["docs/domain.md"]
        owner: team-x
        last_validated: ${TODAY_ISO}
        review_after_days: 180
        rule: "invoice total equals sum of line items"
        feature: "billing"
    `,
        );
        const hits = ml.retrieve(['domain-invariants'], ['billing']) as Hit[];
        expect(hits.length).toBe(1);
        expect(hits[0]?.id).toBe('di-1');
        expect(hits[0]?.source).toBe('curated');
    });

    it('intake jsonl basic', () => {
        chdirInto(tmp);
        const intake = join(tmp, 'agents/memory/intake/learnings.jsonl');
        mkdirSync(dirname(intake), { recursive: true });
        writeFileSync(
            intake,
            JSON.stringify({ id: 'i-1', entry_type: 'historical-patterns', path: 'app/Http/Foo.php', body: 'off-by-one' }) + '\n',
        );
        const hits = ml.retrieve(['historical-patterns'], ['foo.php']) as Hit[];
        expect(hits.length).toBe(1);
        expect(hits[0]?.source).toBe('intake');
        expect(hits[0]?.score).toBeGreaterThan(0);
        expect(hits[0]?.score).toBeLessThan(0.9);
    });

    it('intake supersede chain', () => {
        chdirInto(tmp);
        const intake = join(tmp, 'agents/memory/intake/learnings.jsonl');
        mkdirSync(dirname(intake), { recursive: true });
        writeFileSync(
            intake,
            [
                JSON.stringify({ id: 'i-1', entry_type: 'incident-learnings', path: 'queue', body: 'old' }),
                JSON.stringify({ id: 'i-2', entry_type: 'incident-learnings', path: 'queue', body: 'new' }),
                JSON.stringify({ type: 'supersede', supersedes: 'i-1' }),
            ].join('\n') + '\n',
        );
        const hits = ml.retrieve(['incident-learnings'], ['queue']) as Hit[];
        const ids = hits.map((h) => h.id);
        expect(ids).toContain('i-2');
        expect(ids, 'superseded entries must not be returned').not.toContain('i-1');
    });

    it('unknown type is ignored', () => {
        chdirInto(tmp);
        write(
            join(tmp, 'agents/memory/ownership.yml'),
            `
        version: 1
        entries:
          - id: own-1
            path: "x"
    `,
        );
        const hits = ml.retrieve(['ownership', 'not-a-type'], ['x']) as Hit[];
        expect(hits.length).toBe(1);
        expect(hits[0]?.type).toBe('ownership');
    });

    it('limit applied', () => {
        chdirInto(tmp);
        const entries = Array.from({ length: 10 }, (_, i) => `  - id: own-${i}\n    path: "src/${i}"`).join('\n');
        write(join(tmp, 'agents/memory/ownership.yml'), `version: 1\nentries:\n${entries}\n`);
        const hits = ml.retrieve(['ownership'], ['src/'], 3) as Hit[];
        expect(hits.length).toBe(3);
    });

    // --- knowledge namespace ---------------------------------------------

    function writeKnowledgeIngest(ingestId: string, source: string, chunks: string[], pinned = false): void {
        const ingestDir = join(tmp, 'agents/memory/knowledge', ingestId);
        const chunksDir = join(ingestDir, 'chunks');
        mkdirSync(chunksDir, { recursive: true });
        const manifest = {
            ingest_id: ingestId,
            source,
            created_at: '2026-05-25T00:00:00Z',
            last_touched: '2026-05-25T00:00:00Z',
            documents: 1,
            chunks: chunks.length,
            bytes_stored: chunks.reduce((a, c) => a + c.length, 0),
            redacted: true,
            pinned,
            pii_redacted: {},
            secrets_redacted: 0,
            skipped: [],
            files: [],
            contains_redactions: false,
        };
        writeFileSync(join(ingestDir, 'manifest.json'), JSON.stringify(manifest), 'utf-8');
        chunks.forEach((body, i) => {
            writeFileSync(join(chunksDir, `${String(i).padStart(4, '0')}.md`), body, 'utf-8');
        });
    }

    it('knowledge retrieval returns chunks', () => {
        chdirInto(tmp);
        writeKnowledgeIngest('018f4a1b-0000-7000-8000-000000000001', '/Users/maintainer/clients/acme/brief.pdf', [
            'Acme pricing model uses tiered SaaS billing.',
        ]);
        const hits = ml.retrieve(['knowledge'], ['acme'], 5) as Hit[];
        expect(hits.length).toBe(1);
        expect(hits[0]?.type).toBe('knowledge');
        expect(hits[0]?.source).toBe('knowledge');
        expect((hits[0]?.entry as Record<string, unknown>)['source_kind']).toBe('knowledge');
        expect(hits[0]?.score).toBeGreaterThan(0);
    });

    it('knowledge retrieval returns empty when no root', () => {
        chdirInto(tmp);
        expect(ml.retrieve(['knowledge'], ['anything'])).toEqual([]);
    });

    it('knowledge pinned chunks rank higher', () => {
        chdirInto(tmp);
        writeKnowledgeIngest('018f4a1b-0000-7000-8000-000000000002', 'docs/normal.md', ['acme normal content'], false);
        writeKnowledgeIngest('018f4a1b-0000-7000-8000-000000000003', 'docs/pinned.md', ['acme pinned content'], true);
        const hits = ml.retrieve(['knowledge'], ['acme'], 5) as Hit[];
        expect(hits.length).toBe(2);
        const pinnedHit = hits.find((h) => (h.entry as Record<string, unknown>)['pinned']) as Hit;
        const normalHit = hits.find((h) => !(h.entry as Record<string, unknown>)['pinned']) as Hit;
        expect(pinnedHit.score).toBeGreaterThanOrEqual(normalHit.score);
    });

    it('knowledge v1 envelope maps to repo', () => {
        chdirInto(tmp);
        writeKnowledgeIngest('018f4a1b-0000-7000-8000-000000000004', 'docs/spec.md', ['billing rules and edge cases']);
        const envelope = ml.retrieve_v1(['knowledge'], ['billing'], 5);
        expect(envelope['status']).toBe('ok');
        const slices = envelope['slices'] as Record<string, Record<string, unknown>>;
        expect(slices['knowledge']?.['status']).toBe('ok');
        expect(slices['knowledge']?.['count'] as number).toBeGreaterThanOrEqual(1);
        const entries = envelope['entries'] as Array<Record<string, unknown>>;
        const knowledgeEntries = entries.filter((e) => e['type'] === 'knowledge');
        expect(knowledgeEntries.length).toBe(1);
        expect(knowledgeEntries[0]?.['source']).toBe('repo');
        expect((knowledgeEntries[0]?.['body'] as Record<string, unknown>)['source_kind']).toBe('knowledge');
    });

    it('knowledge skips dir without manifest', () => {
        chdirInto(tmp);
        const stray = join(tmp, 'agents/memory/knowledge/stray-dir');
        mkdirSync(stray, { recursive: true });
        writeFileSync(join(stray, 'random.txt'), 'noise', 'utf-8');
        const hits = ml.retrieve(['knowledge'], ['noise']);
        expect(hits).toEqual([]);
    });
});

// =========================================================================
// Supersession / staleness — 1:1 port of the Phase-1 additions in
// test_memory_lookup.py (test_superseded_entry_excluded_from_retrieve,
// test_stale_entry_excluded_from_retrieve_appears_in_skipped,
// test_find_duplicate_returns_match_above_threshold_none_below).
// =========================================================================

describe('memory_lookup.ts — supersession & staleness', () => {
    function writeOwnership(entries: Record<string, unknown>[]): void {
        const body = entries
            .map((e) =>
                Object.entries(e)
                    .map(([k, v], i) => `${i === 0 ? '  - ' : '    '}${k}: ${typeof v === 'string' ? `"${v}"` : String(v)}`)
                    .join('\n'),
            )
            .join('\n');
        write(join(tmp, 'agents/memory/ownership.yml'), `version: 1\nentries:\n${body}\n`);
    }

    it('superseded entry excluded from retrieve()', () => {
        chdirInto(tmp);
        writeOwnership([
            { id: 'own-active', status: 'active', path: 'app/Http/Controllers/Billing/**', owner: 'team-payments' },
            { id: 'own-superseded', status: 'superseded', path: 'app/Http/Controllers/Billing/**', owner: 'team-payments' },
        ]);
        const hits = ml.retrieve(['ownership'], ['billing']) as Hit[];
        const hitIds = hits.map((h) => h.id);
        expect(hitIds).toContain('own-active');
        expect(hitIds).not.toContain('own-superseded');
    });

    it('stale entry excluded from retrieve() but present in retrieve_with_meta().skipped', () => {
        chdirInto(tmp);
        const today = new Date(Date.UTC(2026, 5, 15));
        // Entry validated 200 days ago, review_after_days=90 → STALE.
        const stale = new Date(today.getTime() - 200 * 86_400_000);
        const iso = (d: Date): string =>
            `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        writeOwnership([
            {
                id: 'own-stale',
                status: 'active',
                path: 'app/Http/Controllers/Billing/**',
                owner: 'team-payments',
                last_validated: iso(stale),
                review_after_days: 90,
            },
            {
                id: 'own-fresh',
                status: 'active',
                path: 'app/Http/Controllers/Billing/**',
                owner: 'team-payments',
                last_validated: iso(today),
                review_after_days: 90,
            },
        ]);
        // retrieve() (real today, which is ≥ 2026-06-15 → the 200-day-old entry stays stale)
        const hits = ml.retrieve(['ownership'], ['billing']) as Hit[];
        const hitIds = hits.map((h) => h.id);
        expect(hitIds).not.toContain('own-stale');
        expect(hitIds).toContain('own-fresh');

        // retrieve_with_meta() lists the stale entry in skipped with the injected today.
        const result = ml.retrieve_with_meta(['ownership'], ['billing'], 5, today);
        const skippedIds = new Set(result.skipped.map((s) => s.id));
        const skippedReasons = Object.fromEntries(result.skipped.map((s) => [s.id, s.reason]));
        expect(skippedIds.has('own-stale')).toBe(true);
        expect(skippedReasons['own-stale']).toBe('stale');
        expect(result.results.map((h) => h.id)).toContain('own-fresh');
    });

    it('find_duplicate returns a match at/above threshold, null below', () => {
        chdirInto(tmp);
        writeOwnership([
            { id: 'own-billing', status: 'active', path: 'app/Http/Controllers/Billing/**', owner: 'team-payments' },
        ]);
        const hit = ml.find_duplicate(['ownership'], ['billing']);
        expect(hit).not.toBeNull();
        expect(hit?.id).toBe('own-billing');

        const noHit = ml.find_duplicate(['ownership'], ['unrelated-xyz-qwerty']);
        expect(noHit).toBeNull();
    });
});

/**
 * Sort object keys recursively so structural comparison ignores key order, and
 * unwrap the TS twin's PyTimestamp marker to its string form. PyTimestamp is
 * the faithful analog of the `datetime.date` object PyYAML leaves inside an
 * entry — the Python driver dumps it with `default=str` (→ "YYYY-MM-DD"), so
 * the TS side normalizes the marker the same way for the comparison.
 */
function _normalizeForCompare(value: unknown): unknown {
    if (value && typeof value === 'object' && 'pyStr' in value && typeof (value as { pyStr: unknown }).pyStr === 'string') {
        return (value as { pyStr: string }).pyStr;
    }
    // Unwrap the PyFloat marker (the `score` field) to its numeric value, since
    // the Python driver dumps the underlying float as a JSON number.
    if (
        value &&
        typeof value === 'object' &&
        'value' in value &&
        Object.keys(value as Record<string, unknown>).length === 1 &&
        typeof (value as { value: unknown }).value === 'number'
    ) {
        return (value as { value: number }).value;
    }
    if (Array.isArray(value)) {
        return value.map(_normalizeForCompare);
    }
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(value as Record<string, unknown>).sort()) {
            out[k] = _normalizeForCompare((value as Record<string, unknown>)[k]);
        }
        return out;
    }
    return value;
}
