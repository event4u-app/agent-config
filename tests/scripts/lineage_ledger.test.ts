// Step 8.3 of road-to-a-graph-that-follows-you — the local source ledger.
//
// Every test points EVENT4U_CONFIG_HOME at a temp dir, so the real user-global
// home is never read or written.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { decrypt, encrypt } from '../../src/scripts/_lib/link_crypto.js';
import {
    assertOutsideWorkTree,
    checkLedger,
    lineageDir,
    LineageError,
    mergeIntoLedger,
    PIN_UNKNOWN,
    readLedger,
    type EdgeRow,
    type SourceRow,
} from '../../src/scripts/_lib/lineage_ledger.js';
import { sourceId } from '../../src/scripts/_lib/source_id.js';
import { main as lineageMain } from '../../src/scripts/code_graph/lineage_cli.js';

const KEY = 'lineage-test-key-0123456789abcdef';
const temps: string[] = [];
afterEach(() => {
    while (temps.length > 0) fs.rmSync(temps.pop() as string, { recursive: true, force: true });
});
const tmp = (prefix: string): string => {
    const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    temps.push(d);
    return d;
};

function source(url: string, over: Partial<SourceRow> = {}): SourceRow {
    return { source_id: sourceId(url, KEY), kind: 'repo', identity: encrypt(url, KEY), license: 'MIT', watch: false, ...over };
}
function edge(url: string, mechanism: string, over: Partial<EdgeRow> = {}): EdgeRow {
    return { source_id: sourceId(url, KEY), mechanism_id: mechanism, pin: encrypt('a'.repeat(40), KEY), locator: encrypt('src/a.ts', KEY), ...over };
}

/** Capture a CLI run's stdout/stderr without touching the real streams. */
async function run(argv: string[], env: Record<string, string>): Promise<{ rc: number; out: string; err: string }> {
    let out = '';
    let err = '';
    const rc = await lineageMain(argv, {
        env,
        keys: [KEY],
        stdout: (s) => void (out += s),
        stderr: (s) => void (err += s),
    });
    return { rc, out, err };
}

describe('the local lineage ledger', () => {
    it('lives under the user-global home, not under the cwd', () => {
        const home = tmp('lineage-home-');
        expect(lineageDir({ EVENT4U_CONFIG_HOME: home })).toBe(path.join(home, 'runtime', 'lineage'));
    });

    it('a merged ledger validates clean, with and without the key', () => {
        const dir = lineageDir({ EVENT4U_CONFIG_HOME: tmp('lineage-home-') });
        const url = 'https://github.com/acme/widget';
        mergeIntoLedger(dir, { sources: [source(url)], edges: [edge(url, 'retry-budget'), edge(url, 'opaque-one', { pin: PIN_UNKNOWN, locator: null })] });
        expect(checkLedger(dir)).toEqual([]);
        expect(checkLedger(dir, [KEY])).toEqual([]);
    });

    it('new sources default watch off, and a merge never flips an existing flag', () => {
        const dir = lineageDir({ EVENT4U_CONFIG_HOME: tmp('lineage-home-') });
        const url = 'https://github.com/acme/widget';
        mergeIntoLedger(dir, { sources: [source(url, { watch: true })], edges: [] });
        const added = mergeIntoLedger(dir, { sources: [source(url)], edges: [edge(url, 'x'), edge(url, 'x')] }, [KEY]);
        expect(added).toEqual({ sources: 0, edges: 1 });
        expect(readLedger(dir).sources[0]?.watch).toBe(true);
    });

    it('a re-import appends an edge whose pin or locator changed, and nothing when both are the same', () => {
        const dir = lineageDir({ EVENT4U_CONFIG_HOME: tmp('lineage-home-') });
        const url = 'https://github.com/acme/widget';
        mergeIntoLedger(dir, { sources: [source(url)], edges: [edge(url, 'x', { pin: PIN_UNKNOWN, locator: null })] }, [KEY]);
        expect(mergeIntoLedger(dir, { sources: [], edges: [edge(url, 'x', { pin: PIN_UNKNOWN, locator: null })] }, [KEY]).edges).toBe(0);
        expect(mergeIntoLedger(dir, { sources: [], edges: [edge(url, 'x')] }, [KEY]).edges).toBe(1);
        // A fresh ENC1 token of the same pin and locator is the same edge.
        expect(mergeIntoLedger(dir, { sources: [], edges: [edge(url, 'x')] }, [KEY]).edges).toBe(0);
        expect(mergeIntoLedger(dir, { sources: [], edges: [edge(url, 'x', { pin: encrypt('b'.repeat(40), KEY) })] }, [KEY]).edges).toBe(1);
        expect(mergeIntoLedger(dir, { sources: [], edges: [edge(url, 'x', { locator: encrypt('src/b.ts', KEY), pin: encrypt('b'.repeat(40), KEY) })] }, [KEY]).edges).toBe(1);
        const pins = readLedger(dir).edges.map((e) => (e.pin === PIN_UNKNOWN ? e.pin : decrypt(e.pin, [KEY])));
        expect(pins).toEqual([PIN_UNKNOWN, 'a'.repeat(40), 'b'.repeat(40), 'b'.repeat(40)]);
        expect(checkLedger(dir, [KEY])).toEqual([]);
    });

    it('flags a plaintext identity, an invented pin, an orphan edge and a wrong key', () => {
        const dir = lineageDir({ EVENT4U_CONFIG_HOME: tmp('lineage-home-') });
        const url = 'https://github.com/acme/widget';
        mergeIntoLedger(dir, {
            sources: [source(url, { identity: url })],
            edges: [edge(url, 'x', { pin: 'a1b2c3d' }), edge('https://github.com/acme/other', 'y')],
        });
        const msgs = checkLedger(dir).map((f) => `${f.file}:${String(f.line)} ${f.message}`);
        expect(msgs).toEqual([
            'sources.jsonl:1 identity must be an ENC1 token',
            "edges.jsonl:1 pin must be 'unknown' or an ENC1 token",
            expect.stringMatching(/^edges\.jsonl:2 source_id src_[0-9a-f]{10} names no row/),
        ]);
        const other = lineageDir({ EVENT4U_CONFIG_HOME: tmp('lineage-home-') });
        mergeIntoLedger(other, { sources: [source(url)], edges: [] });
        expect(checkLedger(other, ['a-different-key-entirely-000'])).toEqual([
            { file: 'sources.jsonl', line: 1, message: 'identity must be an ENC1 token that decrypts with the configured key' },
        ]);
    });

    it('never writes a path under runtime/lineage/ inside a git work tree', () => {
        const repo = tmp('lineage-repo-');
        execFileSync('git', ['init', '-q', repo]);
        const dir = lineageDir({ EVENT4U_CONFIG_HOME: path.join(repo, 'home') });
        expect(() => mergeIntoLedger(dir, { sources: [source('https://github.com/acme/widget')], edges: [] })).toThrow(LineageError);
        expect(() => assertOutsideWorkTree(path.join(repo, 'a', 'b.jsonl'))).toThrow(/work tree/);
        expect(fs.existsSync(path.join(repo, 'home'))).toBe(false);
        expect(execFileSync('git', ['-C', repo, 'status', '--porcelain'], { encoding: 'utf-8' })).toBe('');
    });
});

describe('code-graph lineage check', () => {
    it('exits 0 on a clean ledger and names what it checked', async () => {
        const home = tmp('lineage-home-');
        const url = 'https://github.com/acme/widget';
        mergeIntoLedger(lineageDir({ EVENT4U_CONFIG_HOME: home }), { sources: [source(url)], edges: [edge(url, 'x')] });
        const res = await run(['check'], { EVENT4U_CONFIG_HOME: home });
        expect(res.rc).toBe(0);
        expect(res.out).toMatch(/1 source\(s\), 1 edge\(s\)/);
    });

    it('exits 1 and lists findings on a broken ledger', async () => {
        const home = tmp('lineage-home-');
        const url = 'https://github.com/acme/widget';
        mergeIntoLedger(lineageDir({ EVENT4U_CONFIG_HOME: home }), { sources: [source(url, { kind: 'blog' as never })], edges: [] });
        const res = await run(['check'], { EVENT4U_CONFIG_HOME: home });
        expect(res.rc).toBe(1);
        expect(res.err).toMatch(/sources\.jsonl:1 kind must be one of/);
    });

    it('says there is no ledger rather than reporting a clean one', async () => {
        const res = await run(['check'], { EVENT4U_CONFIG_HOME: tmp('lineage-home-') });
        expect(res.rc).toBe(2);
        expect(res.err).toMatch(/no local lineage ledger/);
    });
});
