// Step 8.4 of road-to-a-graph-that-follows-you — seed both ledgers from what exists.
//
// The tracked half is checked against the real repo: one decision row per harvest
// row, carried over and nothing added. The local half runs against a fixture root
// and a temp EVENT4U_CONFIG_HOME, with a key the test owns.
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { checkLedger, lineageDir, PIN_UNKNOWN, readLedger } from '../../src/scripts/_lib/lineage_ledger.js';
import { seedMechanismsFromHarvests } from '../../src/scripts/_lib/lineage_seed.js';
import { decrypt, encrypt } from '../../src/scripts/_lib/link_crypto.js';
import { sourceId } from '../../src/scripts/_lib/source_id.js';
import { main as lineageMain } from '../../src/scripts/code_graph/lineage_cli.js';
import { lintMechanismsText, parseLedgerText } from '../../src/scripts/lint_harvest_provenance.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const KEY = 'lineage-seed-key-0123456789abcdef';

const temps: string[] = [];
afterEach(() => {
    while (temps.length > 0) fs.rmSync(temps.pop() as string, { recursive: true, force: true });
});
const tmp = (prefix: string): string => {
    const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    temps.push(d);
    return d;
};
const read = (rel: string): string => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');

describe('the tracked decision ledger is seeded from harvests.jsonl', () => {
    const harvests = parseLedgerText(read('provenance/harvests.jsonl')).parsed.map((p) => p.value as Record<string, string>);
    const mechText = read('provenance/mechanisms.jsonl');

    it('has exactly one row per harvest row — 19 of them', () => {
        expect(harvests).toHaveLength(19);
        expect(parseLedgerText(mechText).parsed).toHaveLength(19);
    });

    it('is exactly the seed: id, verdict, stated_in and date carried over, nothing invented', () => {
        const expected = seedMechanismsFromHarvests(harvests as never)
            .map((r) => JSON.stringify(r))
            .join('\n');
        expect(mechText.trimEnd()).toBe(expected);
        for (const h of harvests) {
            const row = seedMechanismsFromHarvests([h as never])[0];
            expect(row).toEqual({ mechanism_id: h.harvest_id, verdict: h.verdict, realised_in: [h.stated_in], decided_at: h.harvested_at });
        }
    });

    it('passes the 8.2 linter against the real tree', () => {
        expect(lintMechanismsText(mechText, REPO_ROOT).findings).toEqual([]);
    });

    it('carries no source reference of any kind', () => {
        expect(mechText).not.toMatch(/opaque:|ENC1:|src_|source|https?:\/\//);
    });
});

function fixtureRoot(): string {
    const root = tmp('lineage-seed-root-');
    const harvests = [
        { harvest_id: 'opaque-mechanism', stated_in: 'a.md', source_ref: 'opaque:reference-a', evidence_locator: 'section two — the retry budget', harvested_at: '2026-08-20', verdict: 'adapt' },
        { harvest_id: 'pinned-mechanism', stated_in: 'a.md', source_ref: 'https://github.com/acme/widget@a1b2c3d4e5f6', evidence_locator: 'src/retry.ts:10', harvested_at: '2026-08-21', verdict: 'adopt' },
    ];
    fs.mkdirSync(path.join(root, 'provenance'), { recursive: true });
    fs.writeFileSync(path.join(root, 'provenance', 'harvests.jsonl'), harvests.map((h) => JSON.stringify(h)).join('\n') + '\n');
    fs.mkdirSync(path.join(root, 'agents', 'settings', 'contexts'), { recursive: true });
    const yml = [
        '# fixture',
        'wrapper-skill:',
        `  source_enc: ${encrypt('https://github.com/acme/wrapped.git', KEY)}`,
        `  pinned_to_enc: ${encrypt('v1.2.3', KEY)}`,
        '  license: MIT',
        '  kind: wrapper',
        '  last_verified: 2026-05-08',
        'method-skill:',
        `  source_enc: ${encrypt('https://example.org/a-methodology', KEY)}`,
        `  pinned_to_enc: ${encrypt('2026-05-09', KEY)}`,
        '  license: CC-BY-4.0',
        '  kind: methodology',
        '  last_verified: 2026-05-09',
        '',
    ].join('\n');
    fs.writeFileSync(path.join(root, 'agents', 'settings', 'contexts', 'skills-provenance.yml'), yml);
    fs.writeFileSync(path.join(root, 'a.md'), '# a\n');
    return root;
}

function digestTree(root: string): string {
    const h = crypto.createHash('sha256');
    for (const rel of ['provenance/harvests.jsonl', 'agents/settings/contexts/skills-provenance.yml']) h.update(fs.readFileSync(path.join(root, rel)));
    return h.digest('hex');
}

async function run(argv: string[], env: Record<string, string>, keys: string[]): Promise<{ rc: number; out: string; err: string }> {
    let out = '';
    let err = '';
    const rc = await lineageMain(argv, { env, keys, stdout: (s) => void (out += s), stderr: (s) => void (err += s) });
    return { rc, out, err };
}

describe('code-graph lineage import seeds the local ledger', () => {
    it('imports harvest refs as pin-unknown edges and skills with their sealed pins', async () => {
        const root = fixtureRoot();
        const home = tmp('lineage-seed-home-');
        const before = digestTree(root);
        const res = await run(['import', '--root', root], { EVENT4U_CONFIG_HOME: home }, [KEY]);
        expect(res.err).toBe('');
        expect(res.rc).toBe(0);
        const dir = lineageDir({ EVENT4U_CONFIG_HOME: home });
        const { sources, edges } = readLedger(dir);
        expect(checkLedger(dir, [KEY])).toEqual([]);

        const opaque = edges.find((e) => e.mechanism_id === 'opaque-mechanism');
        expect(opaque?.pin).toBe(PIN_UNKNOWN);
        expect(decrypt(opaque?.locator as string, KEY)).toBe('section two — the retry budget');
        expect(sources.find((s) => s.source_id === opaque?.source_id)?.kind).toBe('unknown');

        const pinned = edges.find((e) => e.mechanism_id === 'pinned-mechanism');
        expect(pinned?.source_id).toBe(sourceId('https://github.com/acme/widget', KEY));
        expect(decrypt(pinned?.pin as string, KEY)).toBe('a1b2c3d4e5f6');

        const wrapped = edges.find((e) => e.mechanism_id === 'wrapper-skill');
        expect(wrapped?.source_id).toBe(sourceId('https://github.com/acme/wrapped', KEY));
        expect(decrypt(wrapped?.pin as string, KEY)).toBe('v1.2.3');
        const method = sources.find((s) => s.source_id === sourceId('https://example.org/a-methodology', KEY));
        expect(method).toMatchObject({ kind: 'url', license: 'CC-BY-4.0', watch: false });

        expect(sources.every((s) => s.watch === false)).toBe(true);
        expect(edges).toHaveLength(4);
        expect(digestTree(root)).toBe(before);
    });

    it('is idempotent — a second import adds nothing', async () => {
        const root = fixtureRoot();
        const env = { EVENT4U_CONFIG_HOME: tmp('lineage-seed-home-') };
        await run(['import', '--root', root], env, [KEY]);
        const res = await run(['import', '--root', root], env, [KEY]);
        expect(res.out).toMatch(/0 new source\(s\), 0 new edge\(s\)/);
        expect(readLedger(lineageDir(env)).edges).toHaveLength(4);
    });

    it('refuses without a key instead of inventing identities', async () => {
        const home = tmp('lineage-seed-home-');
        const res = await run(['import', '--root', fixtureRoot()], { EVENT4U_CONFIG_HOME: home }, []);
        expect(res.rc).toBe(2);
        expect(res.err).toMatch(/link_encryption_key/);
        expect(fs.existsSync(lineageDir({ EVENT4U_CONFIG_HOME: home }))).toBe(false);
    });

    it('reports a skills entry sealed under another key and imports the rest', async () => {
        const root = fixtureRoot();
        const yml = path.join(root, 'agents', 'settings', 'contexts', 'skills-provenance.yml');
        fs.appendFileSync(yml, `foreign-skill:\n  source_enc: ${encrypt('https://github.com/x/y', 'some-other-key-0000000000')}\n  license: MIT\n`);
        const res = await run(['import', '--root', root], { EVENT4U_CONFIG_HOME: tmp('lineage-seed-home-') }, [KEY]);
        expect(res.rc).toBe(1);
        expect(res.err).toMatch(/foreign-skill: .*decrypt/);
        expect(res.out).toMatch(/4 new edge\(s\)/);
    });
});
