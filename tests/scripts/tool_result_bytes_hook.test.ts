// Tests for src/scripts/hooks/tool_result_bytes_hook.ts — the PostToolUse
// tool-result byte census (road-to-inbox-harvest-2026-08-d-context-ledger
// Step 1.1). Imports `processEnvelope` directly so the written JSONL can be
// inspected; a subprocess-only test could only see the exit code, and this
// concern's entire output is the file.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { JsonObject } from '../../src/scripts/hooks/envelope.js';
import {
    CENSUS_FILE,
    CENSUS_OPT_IN_ENV,
    MAINTAINER_PACKAGE_NAME,
    _resetMaintainerCache,
    _resultBytes,
    _toolName,
    processEnvelope,
    resolveConsumerRoot,
    resolvesMaintainerWorkspace,
} from '../../src/scripts/hooks/tool_result_bytes_hook.js';

let tmp: string;

/**
 * Mark a directory as the maintainer workspace. The census is default-off
 * everywhere else (step 3.3), so a fixture that wants a written line has to
 * say which workspace it is — which is the behaviour, stated as a helper.
 */
function markMaintainer(root: string): void {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: MAINTAINER_PACKAGE_NAME }));
    _resetMaintainerCache();
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tool-result-bytes-'));
    markMaintainer(tmp);
});
afterEach(() => {
    delete process.env[CENSUS_OPT_IN_ENV];
    _resetMaintainerCache();
    fs.rmSync(tmp, { recursive: true, force: true });
});

function readCensus(root: string): Record<string, unknown>[] {
    const file = path.join(root, CENSUS_FILE);
    if (!fs.existsSync(file)) return [];
    return fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

function envelope(payload: JsonObject, event = 'post_tool_use'): JsonObject {
    return { schema_version: 1, platform: 'claude', event, payload };
}

describe('byte measurement is derived, never asserted', () => {
    it('measures an object result as its serialised UTF-8 length', () => {
        const result = { stdout: 'hello', code: 0 };
        const expected = Buffer.byteLength(JSON.stringify(result), 'utf8');
        expect(_resultBytes({ tool_response: result as never })).toBe(expected);
    });

    it('measures a bare-string result — the shape the sibling extractor drops', () => {
        // `Bash` returns stdout directly. This is precisely the large-result
        // case the counter exists for, and an object-only extractor reports it
        // as absent.
        const out = 'On branch main\n';
        expect(_resultBytes({ tool_response: out })).toBe(Buffer.byteLength(out, 'utf8'));
    });

    it('counts BYTES, not characters, for a multibyte result', () => {
        // Four-byte emoji plus two-byte umlauts: a character count would
        // under-report what the result actually costs.
        const out = '🙂 Grüße';
        const bytes = _resultBytes({ tool_response: out });
        expect(bytes).toBe(Buffer.byteLength(out, 'utf8'));
        expect(bytes).toBeGreaterThan(out.length);
    });

    it('scales linearly with result size rather than matching a fixed value', () => {
        const small = _resultBytes({ tool_response: 'x'.repeat(10) })!;
        const large = _resultBytes({ tool_response: 'x'.repeat(10_000) })!;
        expect(large - small).toBe(9_990);
    });

    it('reads every documented result key, not only the first', () => {
        for (const key of ['tool_response', 'toolResponse', 'tool_result', 'toolUseResult']) {
            expect(_resultBytes({ [key]: 'abc' } as never)).toBe(3);
        }
    });

    it('returns null — never 0 — when no result key is present', () => {
        expect(_resultBytes({ tool_name: 'Read' })).toBeNull();
    });

    it('returns null for an unserialisable result rather than throwing', () => {
        const circular: Record<string, unknown> = {};
        circular['self'] = circular;
        expect(_resultBytes({ tool_response: circular as never })).toBeNull();
    });
});

describe('the census line', () => {
    it('records tool name and byte count for a normal call', () => {
        processEnvelope(envelope({ tool_name: 'Read', tool_response: 'abcd' }), tmp);
        const lines = readCensus(tmp);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({ tool: 'Read', raw_bytes: 4, delivered_bytes: 4, measurable: true });
        expect(typeof lines[0]!['ts']).toBe('string');
    });

    it('records an absent result as measurable:false, never as zero bytes', () => {
        // The instrument-goes-quiet failure: a host whose payload carries no
        // result must be distinguishable from a host where no tools ran.
        processEnvelope(envelope({ tool_name: 'Read' }), tmp);
        const lines = readCensus(tmp);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatchObject({ raw_bytes: null, delivered_bytes: null, measurable: false });
    });

    it('carries no field able to hold result content', () => {
        const secret = 'AKIAIOSFODNN7EXAMPLE and a customer email';
        processEnvelope(envelope({ tool_name: 'Bash', tool_response: secret }), tmp);
        const raw = fs.readFileSync(path.join(tmp, CENSUS_FILE), 'utf8');
        expect(raw).not.toContain(secret);
        expect(raw).not.toContain('AKIA');
        // Privacy is a property of the shape: exactly five keys, all scalar.
        expect(Object.keys(readCensus(tmp)[0]!).sort()).toEqual([
            'delivered_bytes',
            'measurable',
            'raw_bytes',
            'tool',
            'ts',
        ]);
    });

    it('appends rather than overwrites across calls', () => {
        processEnvelope(envelope({ tool_name: 'Read', tool_response: 'a' }), tmp);
        processEnvelope(envelope({ tool_name: 'Grep', tool_response: 'bb' }), tmp);
        expect(readCensus(tmp).map((l) => l['tool'])).toEqual(['Read', 'Grep']);
    });

    it('records a null tool name rather than dropping the line', () => {
        processEnvelope(envelope({ tool_response: 'abc' }), tmp);
        expect(readCensus(tmp)[0]).toMatchObject({ tool: null, raw_bytes: 3, delivered_bytes: 3, measurable: true });
    });
});

describe('it never disturbs the run', () => {
    it('ignores every event that is not post_tool_use', () => {
        for (const event of ['pre_tool_use', 'stop', 'session_start']) {
            expect(processEnvelope(envelope({ tool_name: 'Read', tool_response: 'x' }, event), tmp)).toBe(0);
        }
        expect(readCensus(tmp)).toHaveLength(0);
    });

    it('returns 0 on a non-object envelope and writes nothing', () => {
        expect(processEnvelope('not an envelope', tmp)).toBe(0);
        expect(processEnvelope(null, tmp)).toBe(0);
        expect(readCensus(tmp)).toHaveLength(0);
    });

    it('returns 0 when the census path cannot be written', () => {
        const blocked = path.join(tmp, 'blocked');
        fs.writeFileSync(blocked, 'not a directory');
        process.env[CENSUS_OPT_IN_ENV] = '1'; // past the workspace gate, into the write
        // `agents/` under a regular file cannot be created — the write throws
        // inside, and the hook must still allow the turn.
        expect(processEnvelope(envelope({ tool_name: 'Read', tool_response: 'x' }), blocked)).toBe(0);
    });
});

describe('root and tool-name resolution', () => {
    it('prefers an envelope-level root over the payload cwd', () => {
        expect(resolveConsumerRoot({ workspace_root: '/a', payload: { cwd: '/b' } })).toBe('/a');
        expect(resolveConsumerRoot({ project_root: '/a', payload: { cwd: '/b' } })).toBe('/a');
    });

    it('falls back to the payload cwd, which is where the host actually puts it', () => {
        expect(resolveConsumerRoot({ payload: { cwd: '/b' } })).toBe('/b');
    });

    it('reads the tool name from payload and envelope positions alike', () => {
        expect(_toolName({ tool_name: 'A' }, {})).toBe('A');
        expect(_toolName({ toolName: 'B' }, {})).toBe('B');
        expect(_toolName({ tool: 'C' }, {})).toBe('C');
        expect(_toolName({}, { tool_name: 'D' })).toBe('D');
        expect(_toolName({}, {})).toBeNull();
    });
});

// -- Steps 3.2 / 3.3 (road-to-a-bytes-row-that-exists) -----------------

describe('delivered_bytes is equal to raw_bytes BY CONSTRUCTION, not by copy', () => {
    it('records both fields with equal values on every measurable line', () => {
        for (const body of ['a', 'x'.repeat(5000), '\u{1F642} Gr\u00fc\u00dfe']) {
            const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trb-equal-'));
            markMaintainer(root);
            processEnvelope(envelope({ tool_name: 'Bash', tool_response: body }), root);
            const line = readCensus(root)[0]!;
            expect(line['raw_bytes']).toBe(Buffer.byteLength(body, 'utf8'));
            expect(line['delivered_bytes']).toBe(line['raw_bytes']);
            fs.rmSync(root, { recursive: true, force: true });
        }
    });

    it('the construction still holds: nothing in the tree rewrites a tool result', () => {
        // The equality above is only meaningful while no concern can rewrite a
        // result on its way to the model. This is that premise, checked rather
        // than asserted - the day a rewrite lands, this goes red and the two
        // fields stop being redundant.
        const repoRoot = path.resolve(__dirname, '..', '..');
        // `grep` exits 1 on NO MATCH, which is the outcome this asserts, so the
        // throw has to be read as a result rather than as a failure. A
        // directory sweep rather than `git grep`: an untracked file that emits
        // the field would still rewrite results, and git would not see it.
        let hits: string;
        try {
            hits = execFileSync('grep', ['-rl', '--', 'updatedToolOutput', 'src', 'docs'], {
                cwd: repoRoot,
                encoding: 'utf8',
            }).trim();
        } catch (err) {
            const status = (err as { status?: number }).status;
            if (status !== 1) throw err;
            hits = '';
        }
        expect(hits).toBe('');
    });
});

describe('the recorder is default-off outside the maintainer workspace', () => {
    it('writes NO byte record at all when no maintainer workspace resolves', () => {
        const consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'trb-consumer-'));
        _resetMaintainerCache();
        expect(processEnvelope(envelope({ tool_name: 'Read', tool_response: 'abcd' }), consumer)).toBe(0);
        expect(fs.existsSync(path.join(consumer, CENSUS_FILE))).toBe(false);
        expect(readCensus(consumer)).toHaveLength(0);
        fs.rmSync(consumer, { recursive: true, force: true });
    });

    it('stays off for a DIFFERENT package, not merely for a root with no package.json', () => {
        const other = fs.mkdtempSync(path.join(os.tmpdir(), 'trb-other-'));
        fs.writeFileSync(path.join(other, 'package.json'), JSON.stringify({ name: 'some-consumer-app' }));
        _resetMaintainerCache();
        processEnvelope(envelope({ tool_name: 'Read', tool_response: 'abcd' }), other);
        expect(readCensus(other)).toHaveLength(0);
        fs.rmSync(other, { recursive: true, force: true });
    });

    it('resolves the maintainer workspace off package.json name, and nothing else', () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trb-resolve-'));
        _resetMaintainerCache();
        expect(resolvesMaintainerWorkspace(root)).toBe(false);
        fs.writeFileSync(path.join(root, 'package.json'), '{ not json');
        _resetMaintainerCache();
        expect(resolvesMaintainerWorkspace(root)).toBe(false);
        markMaintainer(root);
        expect(resolvesMaintainerWorkspace(root)).toBe(true);
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('lets a consumer opt in deliberately with the env marker', () => {
        const consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'trb-optin-'));
        _resetMaintainerCache();
        process.env[CENSUS_OPT_IN_ENV] = '1';
        processEnvelope(envelope({ tool_name: 'Read', tool_response: 'abcd' }), consumer);
        expect(readCensus(consumer)).toHaveLength(1);
        fs.rmSync(consumer, { recursive: true, force: true });
    });
});
