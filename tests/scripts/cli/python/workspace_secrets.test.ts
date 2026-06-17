// Golden-parity tests for src/cli/python/workspace_secrets.ts (py2ts ADR-200 —
// shared secret-detection + scrub primitives; a LEAF library, no CLI).
//
// Strategy: this module has no CLI, so parity is asserted at the function
// level. The TS functions (`scan` / `scrub` / `scrub_obj`) are imported
// in-process; the Python originals are driven by a one-shot `python3 -c`
// harness that imports `workspace_secrets`, runs the same call over a
// JSON-encoded input, and prints a JSON-encoded `[result, count]`. Both sides
// are byte-compared via canonical JSON. The match COUNT and the scrubbed
// output are the load-bearing parity surfaces (the regex set, the HIGH-before-
// FUZZY ordering, the `[SECRET]` placeholder, and the recursive depth/cycle
// guard).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan, scrub, scrub_obj } from '@cli/python/workspace_secrets.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..', '..');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

/** Run the Python `workspace_secrets` over `op(payload, include_fuzzy)`. */
function py(op: 'scan' | 'scrub' | 'scrub_obj', payloadJson: string, includeFuzzy: boolean): unknown {
    const code = [
        'import json,sys',
        'sys.path.insert(0, sys.argv[1])',
        'import workspace_secrets as w',
        'op=sys.argv[2]; inc=sys.argv[3]=="1"',
        'payload=json.loads(sys.argv[4])',
        'if op=="scan":',
        '    out=[{"pattern":f.pattern,"confidence":f.confidence} for f in w.scan(payload, include_fuzzy=inc)]',
        '    print(json.dumps(out, sort_keys=True))',
        'elif op=="scrub":',
        '    clean,n=w.scrub(payload, include_fuzzy=inc)',
        '    print(json.dumps([clean,n], sort_keys=True))',
        'else:',
        '    clean,n=w.scrub_obj(payload, include_fuzzy=inc)',
        '    print(json.dumps([clean,n], sort_keys=True))',
    ].join('\n');
    const r = spawnSync(
        'python3',
        ['-c', code, path.join(REPO_ROOT, 'src', 'cli', 'python'), op, includeFuzzy ? '1' : '0', payloadJson],
        { encoding: 'utf8' },
    );
    if (r.status !== 0) {
        throw new Error(`python harness failed: ${r.stderr}`);
    }
    return JSON.parse(r.stdout);
}

/** Canonical JSON (sorted keys) for a stable cross-language compare. */
function canon(v: unknown): string {
    return JSON.stringify(v, (_k, val) => {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            const sorted: Record<string, unknown> = {};
            for (const k of Object.keys(val as Record<string, unknown>).sort()) {
                sorted[k] = (val as Record<string, unknown>)[k];
            }
            return sorted;
        }
        return val;
    });
}

const AWS = 'AKIAIOSFODNN7EXAMPLE';
const GH = 'ghp_' + 'a'.repeat(36);
const OPENAI = 'sk-' + 'b'.repeat(24);
const PEM = '-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----';
const KV = 'api_key = abcdef1234567890';

const SCAN_CASES: Array<[string, string]> = [
    ['empty', ''],
    ['none', 'just some prose with no secrets at all'],
    ['aws', `here ${AWS} done`],
    ['github', `token ${GH}`],
    ['openai', `key ${OPENAI}`],
    ['pem', PEM],
    ['kv-fuzzy', KV],
    ['mixed', `${AWS} and ${KV} and ${GH}`],
    ['pem-wraps-kv', `${PEM}\nsecret = ${'z'.repeat(20)}`],
    ['two-aws', `${AWS} ${AWS}`],
];

describe.skipIf(!py3)('workspace_secrets — scan parity', () => {
    for (const [name, payload] of SCAN_CASES) {
        it(`scan ${name} (fuzzy on)`, () => {
            const t = scan(payload, { include_fuzzy: true });
            expect(canon(t)).toBe(canon(py('scan', JSON.stringify(payload), true)));
        });
        it(`scan ${name} (fuzzy off)`, () => {
            const t = scan(payload, { include_fuzzy: false });
            expect(canon(t)).toBe(canon(py('scan', JSON.stringify(payload), false)));
        });
    }
});

describe.skipIf(!py3)('workspace_secrets — scrub parity', () => {
    for (const [name, payload] of SCAN_CASES) {
        it(`scrub ${name} (fuzzy on)`, () => {
            const t = scrub(payload, { include_fuzzy: true });
            expect(canon(t)).toBe(canon(py('scrub', JSON.stringify(payload), true)));
        });
        it(`scrub ${name} (fuzzy off)`, () => {
            const t = scrub(payload, { include_fuzzy: false });
            expect(canon(t)).toBe(canon(py('scrub', JSON.stringify(payload), false)));
        });
    }
});

describe.skipIf(!py3)('workspace_secrets — scrub_obj parity', () => {
    const OBJ_CASES: Array<[string, unknown]> = [
        ['scalar-str', `key ${AWS}`],
        ['scalar-int', 42],
        ['scalar-null', null],
        ['scalar-bool', true],
        ['flat-dict', { a: `${AWS}`, b: 'clean', n: 3 }],
        ['nested', { outer: { inner: [`${GH}`, 'x', { deep: KV }] }, count: 2 }],
        ['list', [`${AWS}`, KV, 'plain', 7]],
        ['mixed-leaves', { s: OPENAI, l: [1, 'two', { three: PEM }], b: false, z: null }],
    ];
    for (const [name, payload] of OBJ_CASES) {
        it(`scrub_obj ${name} (fuzzy on)`, () => {
            const t = scrub_obj(payload, { include_fuzzy: true });
            expect(canon(t)).toBe(canon(py('scrub_obj', JSON.stringify(payload), true)));
        });
        it(`scrub_obj ${name} (fuzzy off)`, () => {
            const t = scrub_obj(payload, { include_fuzzy: false });
            expect(canon(t)).toBe(canon(py('scrub_obj', JSON.stringify(payload), false)));
        });
    }
});
