import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { askOnce, main } from '../../src/scripts/ask_transport.js';
import { CouncilResponse, type ExternalAIClient } from '../../src/scripts/ai_council/clients.js';
import { HAND_KIND_SCHEMAS, parseHandReturn } from '../../src/scripts/ai_council/hand_schemas.js';
import { HAND_KINDS, isHandKind } from '../../src/scripts/_lib/hand_kinds.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ask-hand-kinds-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function stub(text: string): ExternalAIClient {
    return {
        name: 'anthropic',
        ask: () =>
            new CouncilResponse({
                provider: 'anthropic',
                model: 'test-model',
                text,
                input_tokens: 40,
                output_tokens: 10,
                latency_ms: 5,
            }),
    } as unknown as ExternalAIClient;
}

function auditLines(dir: string): Array<Record<string, unknown>> {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.jsonl'))
        .flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n'))
        .filter((l) => l.trim())
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

const VALID: Record<string, string> = {
    classify: '{"label":"timeout","confidence":0.8}',
    extract: '{"items":["a","b"]}',
    'summarise-given-text': '{"summary":"short"}',
    'draft-candidate': '{"candidate":"function f() {}"}',
    'test-candidates': '{"tests":[{"name":"t1","body":"expect(1).toBe(1)"}]}',
    'finding-proposal': '{"findings":[{"claim":"c","evidence":"e","severity":"low"}]}',
};

describe('typed hand kinds — a closed set, each with a JSON output schema', () => {
    it('the set is exactly the six kinds, and nothing else is a kind', () => {
        expect([...HAND_KINDS].sort()).toEqual(
            ['classify', 'draft-candidate', 'extract', 'finding-proposal', 'summarise-given-text', 'test-candidates'].sort(),
        );
        expect(isHandKind('plan')).toBe(false);
        expect(isHandKind('decide')).toBe(false);
        for (const k of HAND_KINDS) expect(HAND_KIND_SCHEMAS[k]).toBeDefined();
    });

    it('accepts a schema-valid return for every kind, including one fenced JSON block', () => {
        for (const k of HAND_KINDS) {
            expect(parseHandReturn(k, VALID[k] as string).ok).toBe(true);
        }
        expect(parseHandReturn('classify', '```json\n{"label":"x","confidence":1}\n```').ok).toBe(true);
    });

    it('refuses prose, a wrong type, a missing field, an out-of-range number and an extra field', () => {
        expect(parseHandReturn('classify', 'the label is timeout').ok).toBe(false);
        expect(parseHandReturn('classify', '{"label":3,"confidence":0.5}').ok).toBe(false);
        expect(parseHandReturn('classify', '{"label":"x"}').ok).toBe(false);
        expect(parseHandReturn('classify', '{"label":"x","confidence":1.5}').ok).toBe(false);
        expect(parseHandReturn('classify', '{"label":"x","confidence":0.5,"note":"hi"}').ok).toBe(false);
        expect(parseHandReturn('test-candidates', '{"tests":[]}').ok).toBe(false);
        expect(parseHandReturn('finding-proposal', '{"findings":[{"claim":"c","evidence":"e","severity":"fatal"}]}').ok).toBe(
            false,
        );
    });
});

describe('askOnce with a kind — a return that does not parse is a failed call', () => {
    it('returns the parsed value when the return matches the schema', async () => {
        const r = await askOnce('classify: ETIMEDOUT', { members: [stub(VALID['classify'] as string)], kind: 'classify', auditDir: null });
        expect(r).not.toBeNull();
        expect(r!.parsed).toEqual({ label: 'timeout', confidence: 0.8 });
    });

    it('returns null and logs a schema-invalid line, never a partial answer', async () => {
        const dir = path.join(tmp, 'audit');
        const r = await askOnce('classify: ETIMEDOUT', {
            members: [stub('I think it is a timeout')],
            kind: 'classify',
            auditDir: dir,
            now: () => new Date('2026-10-22T10:00:00Z'),
            id: () => 'hand-invalid-1',
        });
        expect(r).toBeNull();
        const lines = auditLines(dir);
        expect(lines).toHaveLength(1);
        const o = lines[0]!['orchestration'] as Record<string, unknown>;
        expect(o['hand_kind']).toBe('classify');
        expect(o['schema_valid']).toBe(false);
        expect(o['outcome']).toBe('BLOCKED');
    });
});

describe('ask_transport --kind (CLI)', () => {
    it('schema-invalid stub output exits 3 and is logged', async () => {
        const dir = path.join(tmp, 'cli-audit');
        const rc = await main(['--kind', 'classify', '--dir', dir, 'classify: ETIMEDOUT'], {
            members: [stub('not json at all')],
        });
        expect(rc).toBe(3);
        const o = auditLines(dir)[0]!['orchestration'] as Record<string, unknown>;
        expect(o['schema_valid']).toBe(false);
    });

    it('an unknown kind is a usage error (exit 2), not a call', async () => {
        const rc = await main(['--kind', 'plan', '--no-record', 'make a plan'], { members: [stub('{}')] });
        expect(rc).toBe(2);
    });
});
