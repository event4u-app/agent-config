import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { evidence_root, main, sha256_file, store_bundle, verify_bundle } from '../../src/scripts/bench_evidence_store.js';

type Dict = Record<string, unknown>;

function run(cap: boolean, dis: number, input: number): Dict {
    return {
        errored: false,
        reason: null,
        capability_pass: cap,
        discipline_score: dis,
        metrics: { tokens: 0, status_bucket: 'completed' },
        tokens_breakdown: { input_tokens: input, output_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    };
}

/** A small paired report: 16 pairs, the package arm lifts discipline on 6. */
function pairedReport(): Dict {
    const records: Dict[] = [];
    for (let i = 0; i < 16; i += 1) {
        records.push({
            id: `t${i}`,
            arms: {
                vanilla: [run(i % 3 !== 0, i < 6 ? 0.25 : 1.0, 100_000)],
                package: [run(true, 1.0, 400_000)],
            },
        });
    }
    return {
        schema: 'ab-bench-v2/0.1',
        stamp: '2026-11-05T15-15-11Z',
        model: 'claude-haiku-4-5',
        seeds: 1,
        arms: ['vanilla', 'package'],
        records,
    };
}

let tmp: string;
let root: string;
let report: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-evidence-'));
    root = path.join(tmp, 'store');
    report = path.join(tmp, '2026-11-05T15-15-11Z-ab-v2-paired.json');
    fs.writeFileSync(report, JSON.stringify(pairedReport(), null, 2) + '\n');
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

/** Rewrite one file and re-seal its manifest hash, so only the re-score layer can catch the edit. */
function tamperAndReseal(dir: string, file: string, edit: (d: Dict) => void): void {
    const p = path.join(dir, file);
    const d = JSON.parse(fs.readFileSync(p, 'utf-8')) as Dict;
    edit(d);
    fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n');
    const mp = path.join(dir, 'manifest.json');
    const m = JSON.parse(fs.readFileSync(mp, 'utf-8')) as { files: Record<string, string> };
    m.files[file] = sha256_file(p);
    fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
}

describe('bench_evidence_store', () => {
    it('resolves the store under the user-global config home, outside any checkout', () => {
        expect(evidence_root({ EVENT4U_CONFIG_HOME: '/x/cfg' })).toBe(path.join('/x/cfg', 'bench-evidence'));
    });

    it('store → verify round-trips: hashes match and an offline re-score reproduces the reference', () => {
        const ckpt = path.join(tmp, 'abc123.jsonl');
        fs.writeFileSync(ckpt, '{"key":"t0|vanilla|0","result":{}}\n');
        const res = store_bundle(report, { root, checkpoints: [ckpt] });
        expect(res.status).toBe('stored');
        expect(fs.existsSync(path.join(res.dir, 'checkpoints', 'abc123.jsonl'))).toBe(true);
        const manifest = JSON.parse(fs.readFileSync(path.join(res.dir, 'manifest.json'), 'utf-8')) as Dict;
        expect(Object.keys(manifest['files'] as Dict).sort()).toEqual(
            ['checkpoints/abc123.jsonl', '2026-11-05T15-15-11Z-ab-v2-paired.json', 'pricing.yaml', 'reference.json'].sort(),
        );
        const v = verify_bundle(res.dir);
        expect(v.problems).toEqual([]);
        expect(v.ok).toBe(true);
        expect(v.rescored).toBe(true);
    });

    it('storing the same report again is idempotent; a differing report under the same name is refused', () => {
        const first = store_bundle(report, { root });
        expect(store_bundle(report, { root }).status).toBe('unchanged');
        const d = pairedReport();
        (d['records'] as Dict[]).pop();
        fs.writeFileSync(report, JSON.stringify(d, null, 2) + '\n');
        expect(() => store_bundle(report, { root })).toThrow(/refusing to overwrite/);
        expect(verify_bundle(first.dir).ok).toBe(true);
    });

    it('a tampered file fails verify on its hash', () => {
        const { dir } = store_bundle(report, { root });
        fs.appendFileSync(path.join(dir, '2026-11-05T15-15-11Z-ab-v2-paired.json'), ' ');
        const v = verify_bundle(dir);
        expect(v.ok).toBe(false);
        expect(v.problems.join('\n')).toMatch(/sha256 mismatch: 2026-11-05T15-15-11Z-ab-v2-paired\.json/);
    });

    it('a tampered record number fails the re-score even when the manifest is re-sealed', () => {
        const { dir } = store_bundle(report, { root });
        tamperAndReseal(dir, '2026-11-05T15-15-11Z-ab-v2-paired.json', (d) => {
            const r = (d['records'] as Dict[])[0] as Dict;
            ((r['arms'] as Dict)['vanilla'] as Dict[])[0]!['discipline_score'] = 0.9;
        });
        const v = verify_bundle(dir);
        expect(v.problems.some((p) => p.startsWith('sha256'))).toBe(false);
        expect(v.ok).toBe(false);
        expect(v.problems.join('\n')).toMatch(/re-score differs/);
    });

    it('a tampered reference number fails the re-score even when the manifest is re-sealed', () => {
        const { dir } = store_bundle(report, { root });
        tamperAndReseal(dir, 'reference.json', (d) => {
            const comp = ((d['analysis'] as Dict)['comparisons'] as Dict[])[0] as Dict;
            (comp['discipline'] as Dict)['wilcoxon_p'] = 0.5;
        });
        const v = verify_bundle(dir);
        expect(v.ok).toBe(false);
        expect(v.problems.join('\n')).toMatch(/analysis\.comparisons\[0\]\.discipline\.wilcoxon_p/);
    });

    it('an unlisted file in the bundle fails verify', () => {
        const { dir } = store_bundle(report, { root });
        fs.writeFileSync(path.join(dir, 'extra.txt'), 'x');
        expect(verify_bundle(dir).problems.join('\n')).toMatch(/not in manifest: extra\.txt/);
    });

    it('stores an artifact sweep with its transcripts; verify checks hashes only and says so', () => {
        const art = path.join(tmp, 'artifact-2026-11-05T21-46-57-655Z.jsonl');
        fs.writeFileSync(art, '{"task":"a","outcome":"pass"}\n');
        fs.mkdirSync(path.join(tmp, 'artifact-2026-11-05T21-46-57-655Z-transcripts', 'run1'), { recursive: true });
        fs.writeFileSync(path.join(tmp, 'artifact-2026-11-05T21-46-57-655Z-transcripts', 'run1', 's.jsonl'), '{}\n');
        const { dir } = store_bundle(art, { root });
        const v = verify_bundle(dir);
        expect(v.ok).toBe(true);
        expect(v.rescored).toBe(false);
        expect(fs.existsSync(path.join(dir, 'transcripts', 'run1', 's.jsonl'))).toBe(true);
    });

    it('CLI: verify exits non-zero on a mismatch and zero on a clean bundle', () => {
        const { dir } = store_bundle(report, { root });
        expect(main(['verify', dir])).toBe(0);
        fs.appendFileSync(path.join(dir, 'reference.json'), ' ');
        expect(main(['verify', dir])).toBe(1);
        expect(main(['nope'])).toBe(2);
    });
});
