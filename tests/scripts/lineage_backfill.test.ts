// Step 9.4 of road-to-a-graph-that-follows-you — backfill drafts, never rows.
//
// A fixture repository carries one roadmap with a clear Provenance block (token,
// mechanism and verdict on one line) and an unclear one (a token and nothing else).
// The run must yield one draft and one "unclear" line and leave both ledgers as
// they were.
import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { lineageDir, mergeIntoLedger } from '../../src/scripts/_lib/lineage_ledger.js';
import { BACKFILL_DIR_REL } from '../../src/scripts/_lib/lineage_backfill.js';
import { encrypt } from '../../src/scripts/_lib/link_crypto.js';
import { sourceId } from '../../src/scripts/_lib/source_id.js';
import { main as lineageMain } from '../../src/scripts/code_graph/lineage_cli.js';

const KEY = 'lineage-backfill-key-0123456789abcdef';
const CLEAR = 'https://github.com/zorblax-labs/widget';
const UNCLEAR = 'https://example.org/an-article';
const temps: string[] = [];
afterEach(() => {
    while (temps.length > 0) fs.rmSync(temps.pop() as string, { recursive: true, force: true });
});
const tmp = (prefix: string): string => {
    const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    temps.push(d);
    return d;
};
const git = (root: string, ...args: string[]): string => execFileSync('git', ['-C', root, ...args], { encoding: 'utf-8' });

function fixture(ignore = true): string {
    const root = tmp('lineage-backfill-repo-');
    execFileSync('git', ['init', '-q', root]);
    const write = (rel: string, body: string): void => {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    };
    if (ignore) write('.gitignore', '/agents/.harvest-local/\n');
    write('provenance/mechanisms.jsonl', '{"mechanism_id":"retry-budget","verdict":"gap","roadmap":"open","decided_at":"2026-08-01"}\n');
    write(
        'agents/roadmaps/road-to-x.md',
        [
            '# Road to x',
            '',
            '## Provenance',
            '',
            `- Source A — \`${encrypt(CLEAR, KEY)}\` — mechanism: retry-budget — verdict: adapt`,
            `- Source B — \`${encrypt(UNCLEAR, KEY)}\``,
            '',
            '## Next',
            '',
            `Outside any Provenance block: ${encrypt('https://example.org/elsewhere', KEY)} — mechanism: x — verdict: adopt`,
            '',
        ].join('\n'),
    );
    git(root, 'add', '-A');
    return root;
}

function digest(files: string[]): string {
    const h = crypto.createHash('sha256');
    for (const f of files) h.update(fs.existsSync(f) ? fs.readFileSync(f) : 'absent');
    return h.digest('hex');
}

async function run(argv: string[], home: string, keys: string[] = [KEY]): Promise<{ rc: number; out: string; err: string }> {
    let out = '';
    let err = '';
    const rc = await lineageMain(argv, { env: { EVENT4U_CONFIG_HOME: home }, keys, stdout: (s) => void (out += s), stderr: (s) => void (err += s) });
    return { rc, out, err };
}

describe('code-graph lineage backfill --draft', () => {
    it('yields one draft and one unclear line, and leaves both ledgers untouched', async () => {
        const root = fixture();
        const home = tmp('lineage-backfill-home-');
        const dir = lineageDir({ EVENT4U_CONFIG_HOME: home });
        mergeIntoLedger(dir, { sources: [], edges: [] });
        const ledgers = [path.join(root, 'provenance', 'mechanisms.jsonl'), path.join(dir, 'sources.jsonl'), path.join(dir, 'edges.jsonl')];
        const before = digest(ledgers);

        const res = await run(['backfill', '--draft', '--root', root], home);
        expect(res.err).toBe('');
        expect(res.rc).toBe(0);
        expect(res.out).toMatch(/1 draft\(s\), 1 unclear/);
        expect(res.out.match(/^unclear /gm)).toHaveLength(1);
        expect(res.out).toMatch(/^unclear agents\/roadmaps\/road-to-x\.md:6/m);
        expect(digest(ledgers)).toBe(before);

        const out = path.join(root, BACKFILL_DIR_REL);
        const drafts = fs
            .readFileSync(path.join(out, 'drafts.jsonl'), 'utf-8')
            .trim()
            .split('\n')
            .map((l) => JSON.parse(l) as Record<string, string>);
        expect(drafts).toEqual([
            { file: 'agents/roadmaps/road-to-x.md', line: 5, source_id: sourceId(CLEAR, KEY), mechanism_id: 'retry-budget', verdict: 'adapt' },
        ]);
        const tokens = fs.readFileSync(path.join(out, 'tokens.jsonl'), 'utf-8');
        expect(tokens).toContain(UNCLEAR);
        expect(tokens.trim().split('\n')).toHaveLength(3);
        expect(git(root, 'status', '--porcelain')).not.toMatch(/harvest-local/);
    });

    it('refuses to decrypt into a directory git would track', async () => {
        const root = fixture(false);
        const res = await run(['backfill', '--draft', '--root', root], tmp('lineage-backfill-home-'));
        expect(res.rc).toBe(2);
        expect(res.err).toMatch(/not ignored/);
        expect(fs.existsSync(path.join(root, BACKFILL_DIR_REL))).toBe(false);
    });

    it('refuses without --draft — there is no mode that writes rows', async () => {
        const res = await run(['backfill', '--root', fixture()], tmp('lineage-backfill-home-'));
        expect(res.rc).toBe(2);
        expect(res.err).toMatch(/--draft/);
    });

    it('refuses without the key', async () => {
        const res = await run(['backfill', '--draft', '--root', fixture()], tmp('lineage-backfill-home-'), []);
        expect(res.rc).toBe(2);
        expect(res.err).toMatch(/link_encryption_key/);
    });
});
