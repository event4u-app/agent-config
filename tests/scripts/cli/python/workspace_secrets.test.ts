// Intent tests for src/cli/python/workspace_secrets.ts (py2ts ADR-200 —
// shared secret-detection + scrub primitives; a LEAF library, no CLI).
//
// Was a python3-vs-tsx function-level parity rig; the `.py` original is gone, so
// this now asserts the tsx library's own contract directly. The functions
// (`scan` / `scrub` / `scrub_obj`) are pure: deterministic over their input,
// no clock / fs / randomness / PATH dependence, so no env masking is needed.
// The match COUNT and the scrubbed output are the load-bearing surfaces (the
// regex set, the HIGH-before-FUZZY ordering, the `[SECRET]` placeholder, and
// the recursive depth/cycle guard). Each case snapshots a canonical-JSON
// rendering (sorted keys) so the assertion is order-stable.
import { describe, expect, it } from 'vitest';
import { scan, scrub, scrub_obj } from '@cli/python/workspace_secrets.js';

/** Canonical JSON (sorted keys) for a stable, order-independent snapshot. */
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

describe('workspace_secrets — scan', () => {
    it('scan empty (fuzzy on)', () => {
        expect(canon(scan(SCAN_CASES[0][1], { include_fuzzy: true }))).toMatchInlineSnapshot(`"[]"`);
    });
    it('scan empty (fuzzy off)', () => {
        expect(canon(scan(SCAN_CASES[0][1], { include_fuzzy: false }))).toMatchInlineSnapshot(`"[]"`);
    });
    it('scan none (fuzzy on)', () => {
        expect(canon(scan(SCAN_CASES[1][1], { include_fuzzy: true }))).toMatchInlineSnapshot(`"[]"`);
    });
    it('scan none (fuzzy off)', () => {
        expect(canon(scan(SCAN_CASES[1][1], { include_fuzzy: false }))).toMatchInlineSnapshot(`"[]"`);
    });
    it('scan aws (fuzzy on)', () => {
        expect(canon(scan(SCAN_CASES[2][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"[{"confidence":"high","pattern":"aws_access_key"}]"`,
        );
    });
    it('scan aws (fuzzy off)', () => {
        expect(canon(scan(SCAN_CASES[2][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"[{"confidence":"high","pattern":"aws_access_key"}]"`,
        );
    });
    it('scan github (fuzzy on)', () => {
        expect(canon(scan(SCAN_CASES[3][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"[{"confidence":"high","pattern":"github_pat"}]"`,
        );
    });
    it('scan github (fuzzy off)', () => {
        expect(canon(scan(SCAN_CASES[3][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"[{"confidence":"high","pattern":"github_pat"}]"`,
        );
    });
    it('scan openai (fuzzy on)', () => {
        expect(canon(scan(SCAN_CASES[4][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"[{"confidence":"high","pattern":"openai_key"}]"`,
        );
    });
    it('scan openai (fuzzy off)', () => {
        expect(canon(scan(SCAN_CASES[4][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"[{"confidence":"high","pattern":"openai_key"}]"`,
        );
    });
    it('scan pem (fuzzy on)', () => {
        expect(canon(scan(SCAN_CASES[5][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"[{"confidence":"high","pattern":"private_key"}]"`,
        );
    });
    it('scan pem (fuzzy off)', () => {
        expect(canon(scan(SCAN_CASES[5][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"[{"confidence":"high","pattern":"private_key"}]"`,
        );
    });
    it('scan kv-fuzzy (fuzzy on)', () => {
        expect(canon(scan(SCAN_CASES[6][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"[{"confidence":"fuzzy","pattern":"kv_secret"}]"`,
        );
    });
    it('scan kv-fuzzy (fuzzy off)', () => {
        expect(canon(scan(SCAN_CASES[6][1], { include_fuzzy: false }))).toMatchInlineSnapshot(`"[]"`);
    });
    it('scan mixed (fuzzy on)', () => {
        expect(canon(scan(SCAN_CASES[7][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"[{"confidence":"high","pattern":"aws_access_key"},{"confidence":"high","pattern":"github_pat"},{"confidence":"fuzzy","pattern":"kv_secret"}]"`,
        );
    });
    it('scan mixed (fuzzy off)', () => {
        expect(canon(scan(SCAN_CASES[7][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"[{"confidence":"high","pattern":"aws_access_key"},{"confidence":"high","pattern":"github_pat"}]"`,
        );
    });
    it('scan pem-wraps-kv (fuzzy on)', () => {
        expect(canon(scan(SCAN_CASES[8][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"[{"confidence":"high","pattern":"private_key"},{"confidence":"fuzzy","pattern":"kv_secret"}]"`,
        );
    });
    it('scan pem-wraps-kv (fuzzy off)', () => {
        expect(canon(scan(SCAN_CASES[8][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"[{"confidence":"high","pattern":"private_key"}]"`,
        );
    });
    it('scan two-aws (fuzzy on)', () => {
        expect(canon(scan(SCAN_CASES[9][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"[{"confidence":"high","pattern":"aws_access_key"},{"confidence":"high","pattern":"aws_access_key"}]"`,
        );
    });
    it('scan two-aws (fuzzy off)', () => {
        expect(canon(scan(SCAN_CASES[9][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"[{"confidence":"high","pattern":"aws_access_key"},{"confidence":"high","pattern":"aws_access_key"}]"`,
        );
    });
});

describe('workspace_secrets — scrub', () => {
    it('scrub empty (fuzzy on)', () => {
        expect(canon(scrub(SCAN_CASES[0][1], { include_fuzzy: true }))).toMatchInlineSnapshot(`"["",0]"`);
    });
    it('scrub empty (fuzzy off)', () => {
        expect(canon(scrub(SCAN_CASES[0][1], { include_fuzzy: false }))).toMatchInlineSnapshot(`"["",0]"`);
    });
    it('scrub none (fuzzy on)', () => {
        expect(canon(scrub(SCAN_CASES[1][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"["just some prose with no secrets at all",0]"`,
        );
    });
    it('scrub none (fuzzy off)', () => {
        expect(canon(scrub(SCAN_CASES[1][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"["just some prose with no secrets at all",0]"`,
        );
    });
    it('scrub aws (fuzzy on)', () => {
        expect(canon(scrub(SCAN_CASES[2][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"["here [SECRET] done",1]"`,
        );
    });
    it('scrub aws (fuzzy off)', () => {
        expect(canon(scrub(SCAN_CASES[2][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"["here [SECRET] done",1]"`,
        );
    });
    it('scrub github (fuzzy on)', () => {
        expect(canon(scrub(SCAN_CASES[3][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"["token [SECRET]",1]"`,
        );
    });
    it('scrub github (fuzzy off)', () => {
        expect(canon(scrub(SCAN_CASES[3][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"["token [SECRET]",1]"`,
        );
    });
    it('scrub openai (fuzzy on)', () => {
        expect(canon(scrub(SCAN_CASES[4][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"["key [SECRET]",1]"`,
        );
    });
    it('scrub openai (fuzzy off)', () => {
        expect(canon(scrub(SCAN_CASES[4][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"["key [SECRET]",1]"`,
        );
    });
    it('scrub pem (fuzzy on)', () => {
        expect(canon(scrub(SCAN_CASES[5][1], { include_fuzzy: true }))).toMatchInlineSnapshot(`"["[SECRET]",1]"`);
    });
    it('scrub pem (fuzzy off)', () => {
        expect(canon(scrub(SCAN_CASES[5][1], { include_fuzzy: false }))).toMatchInlineSnapshot(`"["[SECRET]",1]"`);
    });
    it('scrub kv-fuzzy (fuzzy on)', () => {
        expect(canon(scrub(SCAN_CASES[6][1], { include_fuzzy: true }))).toMatchInlineSnapshot(`"["[SECRET]",1]"`);
    });
    it('scrub kv-fuzzy (fuzzy off)', () => {
        expect(canon(scrub(SCAN_CASES[6][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"["api_key = abcdef1234567890",0]"`,
        );
    });
    it('scrub mixed (fuzzy on)', () => {
        expect(canon(scrub(SCAN_CASES[7][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"["[SECRET] and [SECRET] and [SECRET]",3]"`,
        );
    });
    it('scrub mixed (fuzzy off)', () => {
        expect(canon(scrub(SCAN_CASES[7][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"["[SECRET] and api_key = abcdef1234567890 and [SECRET]",2]"`,
        );
    });
    it('scrub pem-wraps-kv (fuzzy on)', () => {
        expect(canon(scrub(SCAN_CASES[8][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"["[SECRET]\\n[SECRET]",2]"`,
        );
    });
    it('scrub pem-wraps-kv (fuzzy off)', () => {
        expect(canon(scrub(SCAN_CASES[8][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"["[SECRET]\\nsecret = zzzzzzzzzzzzzzzzzzzz",1]"`,
        );
    });
    it('scrub two-aws (fuzzy on)', () => {
        expect(canon(scrub(SCAN_CASES[9][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"["[SECRET] [SECRET]",2]"`,
        );
    });
    it('scrub two-aws (fuzzy off)', () => {
        expect(canon(scrub(SCAN_CASES[9][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"["[SECRET] [SECRET]",2]"`,
        );
    });
});

describe('workspace_secrets — scrub_obj', () => {
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
    it('scrub_obj scalar-str (fuzzy on)', () => {
        expect(canon(scrub_obj(OBJ_CASES[0][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"["key [SECRET]",1]"`,
        );
    });
    it('scrub_obj scalar-str (fuzzy off)', () => {
        expect(canon(scrub_obj(OBJ_CASES[0][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"["key [SECRET]",1]"`,
        );
    });
    it('scrub_obj scalar-int (fuzzy on)', () => {
        expect(canon(scrub_obj(OBJ_CASES[1][1], { include_fuzzy: true }))).toMatchInlineSnapshot(`"[42,0]"`);
    });
    it('scrub_obj scalar-int (fuzzy off)', () => {
        expect(canon(scrub_obj(OBJ_CASES[1][1], { include_fuzzy: false }))).toMatchInlineSnapshot(`"[42,0]"`);
    });
    it('scrub_obj scalar-null (fuzzy on)', () => {
        expect(canon(scrub_obj(OBJ_CASES[2][1], { include_fuzzy: true }))).toMatchInlineSnapshot(`"[null,0]"`);
    });
    it('scrub_obj scalar-null (fuzzy off)', () => {
        expect(canon(scrub_obj(OBJ_CASES[2][1], { include_fuzzy: false }))).toMatchInlineSnapshot(`"[null,0]"`);
    });
    it('scrub_obj scalar-bool (fuzzy on)', () => {
        expect(canon(scrub_obj(OBJ_CASES[3][1], { include_fuzzy: true }))).toMatchInlineSnapshot(`"[true,0]"`);
    });
    it('scrub_obj scalar-bool (fuzzy off)', () => {
        expect(canon(scrub_obj(OBJ_CASES[3][1], { include_fuzzy: false }))).toMatchInlineSnapshot(`"[true,0]"`);
    });
    it('scrub_obj flat-dict (fuzzy on)', () => {
        expect(canon(scrub_obj(OBJ_CASES[4][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"[{"a":"[SECRET]","b":"clean","n":3},1]"`,
        );
    });
    it('scrub_obj flat-dict (fuzzy off)', () => {
        expect(canon(scrub_obj(OBJ_CASES[4][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"[{"a":"[SECRET]","b":"clean","n":3},1]"`,
        );
    });
    it('scrub_obj nested (fuzzy on)', () => {
        expect(canon(scrub_obj(OBJ_CASES[5][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"[{"count":2,"outer":{"inner":["[SECRET]","x",{"deep":"[SECRET]"}]}},2]"`,
        );
    });
    it('scrub_obj nested (fuzzy off)', () => {
        expect(canon(scrub_obj(OBJ_CASES[5][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"[{"count":2,"outer":{"inner":["[SECRET]","x",{"deep":"api_key = abcdef1234567890"}]}},1]"`,
        );
    });
    it('scrub_obj list (fuzzy on)', () => {
        expect(canon(scrub_obj(OBJ_CASES[6][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"[["[SECRET]","[SECRET]","plain",7],2]"`,
        );
    });
    it('scrub_obj list (fuzzy off)', () => {
        expect(canon(scrub_obj(OBJ_CASES[6][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"[["[SECRET]","api_key = abcdef1234567890","plain",7],1]"`,
        );
    });
    it('scrub_obj mixed-leaves (fuzzy on)', () => {
        expect(canon(scrub_obj(OBJ_CASES[7][1], { include_fuzzy: true }))).toMatchInlineSnapshot(
            `"[{"b":false,"l":[1,"two",{"three":"[SECRET]"}],"s":"[SECRET]","z":null},2]"`,
        );
    });
    it('scrub_obj mixed-leaves (fuzzy off)', () => {
        expect(canon(scrub_obj(OBJ_CASES[7][1], { include_fuzzy: false }))).toMatchInlineSnapshot(
            `"[{"b":false,"l":[1,"two",{"three":"[SECRET]"}],"s":"[SECRET]","z":null},2]"`,
        );
    });
});
