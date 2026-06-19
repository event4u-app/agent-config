// Tests for src/scripts/memory_lookup.ts — file-based retrieval fallback.
//
// 1:1 port of tests/test_memory_lookup.py (pytest → vitest, ADR-094 parity
// contract). The pytest suite imports the module and calls retrieve() /
// retrieve_v1() directly; these mirror that against the TS twin. The
// retrieve() contract (signature + return shape) is cited by rules, so it is
// exercised directly. A trailing golden-parity block runs python3 + tsx —
// retrieve() via a python3 -c driver and the CLI surfaces on identical
// fixtures — asserting byte-exact output, skipped without python3.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ml from '../../src/scripts/memory_lookup.js';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'memory_lookup.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'memory_lookup.py');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

type Hit = InstanceType<typeof ml.Hit>;

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
            last_validated: 2026-01-01
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
        last_validated: 2026-01-01
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

// =========================================================================
// golden parity vs python3
// =========================================================================

describe.skipIf(!HAVE_PYTHON)('memory_lookup — golden parity', () => {
    let goldenTmp: string;

    function seedMemoryTree(root: string): void {
        write(
            join(root, 'agents/memory/ownership.yml'),
            `
        version: 1
        entries:
          - id: own-1
            status: active
            confidence: high
            source: ["docs/teams.md"]
            owner: team-payments
            last_validated: 2026-01-01
            review_after_days: 180
            path: "app/Http/Controllers/Billing/**"
    `,
        );
        const intake = join(root, 'agents/memory/intake/learnings.jsonl');
        mkdirSync(dirname(intake), { recursive: true });
        writeFileSync(
            intake,
            JSON.stringify({ id: 'i-1', entry_type: 'historical-patterns', path: 'app/Http/Foo.php', body: 'off-by-one' }) + '\n',
        );
    }

    beforeEach(() => {
        goldenTmp = mkdtempSync(join(tmpdir(), 'memlook-gold-'));
        seedMemoryTree(goldenTmp);
    });
    afterEach(() => {
        rmSync(goldenTmp, { recursive: true, force: true });
    });

    function runTs(args: readonly string[]): ReturnType<typeof spawnSync> {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: goldenTmp, encoding: 'utf8' });
    }
    function runPy(args: readonly string[]): ReturnType<typeof spawnSync> {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: goldenTmp, encoding: 'utf8' });
    }
    function expectParity(args: readonly string[]): void {
        const ts = runTs(args);
        const py = runPy(args);
        expect(ts.stdout, `args=${args.join(' ')}`).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    }

    it('CLI text parity (ownership)', () => {
        expectParity(['--types', 'ownership', '--key', 'billing']);
    });
    it('CLI json parity (ownership)', () => {
        expectParity(['--types', 'ownership', '--key', 'billing', '--format', 'json']);
    });
    it('CLI json parity (mixed types, intake hit)', () => {
        expectParity(['--types', 'ownership,historical-patterns', '--key', 'foo.php', '--format', 'json']);
    });
    it('CLI v1 envelope parity (with dated entry)', () => {
        expectParity(['--types', 'ownership', '--key', 'billing', '--envelope', 'v1']);
    });
    it('CLI v1 unknown-type parity', () => {
        expectParity(['--types', 'nope-type', '--key', 'x', '--envelope', 'v1']);
    });
    it('CLI v1 partial (known + unknown) parity', () => {
        expectParity(['--types', 'ownership,bad-type', '--key', 'billing', '--envelope', 'v1']);
    });
    it('CLI no-key parity', () => {
        expectParity(['--types', 'ownership']);
    });
    it('CLI no-hits text parity', () => {
        expectParity(['--types', 'ownership', '--key', 'no-such-key']);
    });
    it('CLI missing --types (exit 2) parity', () => {
        const ts = runTs(['--types', '']);
        const py = runPy(['--types', '']);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    // retrieve() is the rules-cited function — differential it directly via a
    // python3 -c driver that imports the module and prints the JSON Hit list.
    function pyRetrieveJson(types: string[], keys: string[], limit: number): string {
        const driver = [
            'import sys, json',
            'sys.path.insert(0, sys.argv[1])',
            'import memory_lookup as m',
            'types = json.loads(sys.argv[2]); keys = json.loads(sys.argv[3]); limit = int(sys.argv[4])',
            'hits = m.retrieve(types, keys, limit)',
            'print(json.dumps([h.as_dict() for h in hits], sort_keys=True, default=str))',
        ].join('; ');
        const r = spawnSync(
            'python3',
            ['-c', driver, join(REPO_ROOT, 'src', 'scripts'), JSON.stringify(types), JSON.stringify(keys), String(limit)],
            { cwd: goldenTmp, encoding: 'utf8' },
        );
        return r.stdout.trim();
    }

    it('retrieve() Hit-list parity via python driver', () => {
        const py = pyRetrieveJson(['ownership', 'historical-patterns'], ['billing'], 5);
        // Run the TS retrieve in the same cwd by importing & chdir.
        const prev = process.cwd();
        process.chdir(goldenTmp);
        ml._setMemoryRoot(join('agents', 'memory'));
        ml._setIntakeRoot(join('agents', 'memory', 'intake'));
        ml._setKnowledgeRoot(join('agents', 'memory', 'knowledge'));
        const hits = ml.retrieve(['ownership', 'historical-patterns'], ['billing'], 5) as Hit[];
        process.chdir(prev);
        // Compare structurally (key-sorted JSON) to match the driver's dump.
        const tsJson = JSON.stringify(
            hits.map((h) => h.as_dict()).map((d) => _normalizeForCompare(d)),
            null,
        );
        const pyParsed = (JSON.parse(py) as Array<Record<string, unknown>>).map((d) => _normalizeForCompare(d));
        expect(JSON.parse(tsJson)).toEqual(pyParsed);
    });

    // retrieve_with_meta() — differential the {results, skipped} envelope
    // (staleness + supersession) against the python3 driver with a fixed
    // _today so the stale-age math is deterministic.
    function seedSupersessionTree(root: string): void {
        write(
            join(root, 'agents/memory/ownership.yml'),
            `
        version: 1
        entries:
          - id: own-active
            status: active
            path: "app/Http/Controllers/Billing/**"
            owner: team-payments
          - id: own-superseded
            status: superseded
            path: "app/Http/Controllers/Billing/**"
            owner: team-payments
          - id: own-stale
            status: active
            path: "app/Http/Controllers/Billing/**"
            owner: team-payments
            last_validated: 2025-01-01
            review_after_days: 90
    `,
        );
    }

    function pyRetrieveWithMetaJson(types: string[], keys: string[], limit: number, isoToday: string): string {
        const driver = [
            'import sys, json, datetime',
            'sys.path.insert(0, sys.argv[1])',
            'import memory_lookup as m',
            'types = json.loads(sys.argv[2]); keys = json.loads(sys.argv[3]); limit = int(sys.argv[4])',
            'today = datetime.date.fromisoformat(sys.argv[5])',
            'r = m.retrieve_with_meta(types, keys, limit, _today=today)',
            'out = {"results": [h.as_dict() for h in r["results"]], "skipped": r["skipped"]}',
            'print(json.dumps(out, sort_keys=True, default=str))',
        ].join('; ');
        const r = spawnSync(
            'python3',
            [
                '-c',
                driver,
                join(REPO_ROOT, 'src', 'scripts'),
                JSON.stringify(types),
                JSON.stringify(keys),
                String(limit),
                isoToday,
            ],
            { cwd: goldenTmp, encoding: 'utf8' },
        );
        return r.stdout.trim();
    }

    it('retrieve_with_meta() {results, skipped} parity via python driver', () => {
        seedSupersessionTree(goldenTmp);
        const isoToday = '2026-06-15';
        const py = pyRetrieveWithMetaJson(['ownership'], ['billing'], 5, isoToday);

        const prev = process.cwd();
        process.chdir(goldenTmp);
        ml._setMemoryRoot(join('agents', 'memory'));
        ml._setIntakeRoot(join('agents', 'memory', 'intake'));
        ml._setKnowledgeRoot(join('agents', 'memory', 'knowledge'));
        const today = new Date(Date.UTC(2026, 5, 15));
        const result = ml.retrieve_with_meta(['ownership'], ['billing'], 5, today);
        process.chdir(prev);

        const tsNormalized = {
            results: result.results.map((h) => _normalizeForCompare(h.as_dict())),
            skipped: result.skipped.map((s) => _normalizeForCompare(s)),
        };
        const pyParsed = _normalizeForCompare(JSON.parse(py));
        expect(tsNormalized).toEqual(pyParsed);
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
