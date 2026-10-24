// Step 9.3 of road-to-a-graph-that-follows-you — two lineage map views.
//
// The tracked view sits next to the repo's shared map and shows mechanisms by
// verdict only (council O6): no source id, no identity, no per-source count. The
// source view is rendered from the local ledger into the user-global home and is
// refused anywhere inside a git work tree.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { sourceGateFindings } from '../_lib/source_gate.js';
import { lineageDir, mergeIntoLedger } from '../../src/scripts/_lib/lineage_ledger.js';
import { LINEAGE_VIEW_REL, renderTrackedLineage } from '../../src/scripts/_lib/lineage_map.js';
import { readDecisions } from '../../src/scripts/_lib/lineage_query.js';
import { encrypt } from '../../src/scripts/_lib/link_crypto.js';
import { sourceId } from '../../src/scripts/_lib/source_id.js';
import { main as codeGraphMain } from '../../src/scripts/code_graph/cli.js';
import { main as lineageMain } from '../../src/scripts/code_graph/lineage_cli.js';

const KEY = 'lineage-map-key-0123456789abcdef';
// Not a placeholder owner: the shape gate allowlists `acme`, so a leak of it would pass unseen.
const URL = 'https://github.com/zorblax-labs/widget';
const temps: string[] = [];
afterEach(() => {
    while (temps.length > 0) fs.rmSync(temps.pop() as string, { recursive: true, force: true });
});
const tmp = (prefix: string): string => {
    const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    temps.push(d);
    return d;
};

function fixture(): { root: string; home: string } {
    const root = tmp('lineage-map-repo-');
    execFileSync('git', ['init', '-q', root]);
    fs.mkdirSync(path.join(root, 'provenance'), { recursive: true });
    fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(root, 'a.md'), '# a\n');
    const rows = [
        { mechanism_id: 'retry-budget', verdict: 'adopt', realised_in: ['a.md'], decided_at: '2026-08-01' },
        { mechanism_id: 'persona-catalog', verdict: 'reject', reason: 'too broad', decided_at: '2026-08-02' },
        { mechanism_id: 'estate-impact', verdict: 'gap', roadmap: 'open', decided_at: '2026-08-03' },
    ];
    fs.writeFileSync(path.join(root, 'provenance', 'mechanisms.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    const home = tmp('lineage-map-home-');
    const id = sourceId(URL, KEY);
    mergeIntoLedger(lineageDir({ EVENT4U_CONFIG_HOME: home }), {
        sources: [{ source_id: id, kind: 'repo', identity: encrypt(URL, KEY), license: 'MIT', watch: false }],
        edges: [
            { source_id: id, mechanism_id: 'retry-budget', pin: encrypt('abc1234', KEY), locator: encrypt('src/retry.ts', KEY) },
            { source_id: id, mechanism_id: 'persona-catalog', pin: 'unknown', locator: null },
        ],
    });
    return { root, home };
}

async function run(argv: string[], home: string): Promise<{ rc: number; out: string; err: string }> {
    let out = '';
    let err = '';
    const rc = await lineageMain(argv, { env: { EVENT4U_CONFIG_HOME: home }, keys: [KEY], stdout: (s) => void (out += s), stderr: (s) => void (err += s) });
    return { rc, out, err };
}

describe('the tracked lineage view', () => {
    it('shows mechanisms grouped by verdict and nothing about sources', () => {
        const { root } = fixture();
        const md = renderTrackedLineage(readDecisions(root));
        expect(md).toMatch(/## adopt \(1\)[\s\S]*retry-budget/);
        expect(md).toMatch(/## reject \(1\)[\s\S]*persona-catalog/);
        expect(md).toMatch(/## gap \(1\)[\s\S]*estate-impact/);
        expect(md).not.toMatch(/src_|ENC1|zorblax|widget|source/i);
    });

    it('is written next to the shared map and passes the source gate', async () => {
        const { root, home } = fixture();
        const res = await run(['map', '--root', root], home);
        expect(res.rc).toBe(0);
        const text = fs.readFileSync(path.join(root, LINEAGE_VIEW_REL), 'utf-8');
        expect(text).not.toContain('src_');
        expect(sourceGateFindings(LINEAGE_VIEW_REL, text)).toEqual([]);
    });

    it('is reachable as code-graph map --lineage', async () => {
        const { root } = fixture();
        const rc = await codeGraphMain(['map', '--lineage', '--root', root]);
        expect(rc).toBe(0);
        expect(fs.existsSync(path.join(root, LINEAGE_VIEW_REL))).toBe(true);
    });

    it('refuses a repository without agents/ rather than creating it', async () => {
        const { root, home } = fixture();
        fs.rmSync(path.join(root, 'agents'), { recursive: true });
        const res = await run(['map', '--root', root], home);
        expect(res.rc).toBe(2);
        expect(fs.existsSync(path.join(root, 'agents'))).toBe(false);
    });

    it('the gate helper does catch a leaked slug, so a clean result means something', () => {
        expect(sourceGateFindings(LINEAGE_VIEW_REL, `fed by ${URL}`)).not.toEqual([]);
    });
});

describe('the source view', () => {
    it('renders from the local ledger into the user-global home', async () => {
        const { root, home } = fixture();
        const res = await run(['map', '--sources', '--root', root], home);
        expect(res.err).toBe('');
        expect(res.rc).toBe(0);
        const text = fs.readFileSync(path.join(lineageDir({ EVENT4U_CONFIG_HOME: home }), 'map', 'sources.md'), 'utf-8');
        expect(text).toContain(URL);
        expect(text).toMatch(/retry-budget\s+—\s+adopt/);
        expect(execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf-8' })).not.toMatch(/sources/);
    });

    it('is refused inside a git work tree', async () => {
        const { root, home } = fixture();
        const res = await run(['map', '--sources', '--root', root, '--out', path.join(root, 'agents', 'sources.md')], home);
        expect(res.rc).toBe(2);
        expect(res.err).toMatch(/work tree/);
        expect(fs.existsSync(path.join(root, 'agents', 'sources.md'))).toBe(false);
    });

    it('is refused when the user-global home itself sits inside a work tree', async () => {
        const { root } = fixture();
        const res = await run(['map', '--sources', '--root', root], path.join(root, 'home'));
        expect(res.rc).toBe(2);
        expect(res.err).toMatch(/work tree/);
        expect(fs.existsSync(path.join(root, 'home'))).toBe(false);
    });
});
