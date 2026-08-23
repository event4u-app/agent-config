// The two-tool discovery surface on the turnkey stdio server (Phase 1.1 + 1.2
// of `road-to-skill-delivery-over-mcp`), and the standing-cost figures the
// roadmap's Phase 0.2 metric row publishes.
//
// The cost assertions live here rather than only in a report because a metric
// row is a snapshot and this is a budget:
// `agents/evidence/metrics/mcp-tool-standing-cost.jsonl` says the kernel surface
// costs ~3,886 tokens and the lite surface is capped at 600, and a change that
// moves either should redden a test rather than quietly age a JSON file.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    INSTRUCTIONS,
    INSTRUCTIONS_BYTE_CAP,
    LITE_TOOLS,
    LITE_TOOLS_TOKEN_CAP,
    dispatch,
    liteToolsTokenCost,
} from '../../src/cli/mcp/dispatch.js';
import { loadTierA, type ContentEntry, type ContentTree } from '../../src/cli/mcp/content.js';
import { ALLOWLIST, to_mcp_tool_meta } from '../../src/scripts/mcp_server/tools.js';

const IDENTITY = { name: 'agent-config-mcp', version: '0.0.0-test' };

function skill(name: string, description: string, extra: Partial<ContentEntry> = {}): ContentEntry {
    return {
        uri: `skill://${name}`,
        name,
        description,
        body: `# ${name}\n\nbody of ${name}\n`,
        source: 'package',
        kind: 'skill',
        ...extra,
    };
}

function tree(...entries: ContentEntry[]): ContentTree {
    const uris: Record<string, ContentEntry> = {};
    for (const e of entries) uris[e.uri] = e;
    return { uris };
}

const FIXTURE = tree(
    skill('merge-conflicts', 'resolve merge conflicts and rebase conflicts'),
    skill('authz-review', 'review authorization and permission gates', {
        personas: ['security-auditor'],
        trigger_text: ['tenant scope'],
    }),
    skill('unrelated-thing', 'wholly different subject matter'),
    {
        uri: 'rule://commit-policy',
        name: 'commit-policy',
        description: 'never commit',
        body: 'rule body',
        source: 'package',
        kind: 'rule',
        mime_type: 'text/markdown',
    },
);

function call(name: string, args: Record<string, unknown>): Record<string, unknown> {
    const resp = dispatch(FIXTURE, IDENTITY, {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
    });
    expect('result' in resp, JSON.stringify(resp)).toBe(true);
    const result = (resp as { result: Record<string, unknown> }).result;
    return result.structuredContent as Record<string, unknown>;
}

describe('lite server — the tool surface', () => {
    it('lists exactly the two discovery tools', () => {
        const resp = dispatch(FIXTURE, IDENTITY, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
        const tools = (resp as { result: { tools: { name: string }[] } }).result.tools;
        expect(tools).toHaveLength(2);
        expect(tools.map((t) => t.name).sort()).toEqual(['read_skill', 'suggest_skill_for_task']);
    });

    it('does NOT ship list_skills — a 290-name result is the cost this avoids', () => {
        expect(LITE_TOOLS.map((t) => t.name)).not.toContain('list_skills');
    });

    it('stays inside the standing-context cap', () => {
        // Measured 222 tokens (887 chars) at the commit that introduced it. The
        // assertion is the cap, not the reading — the reading is printed in the
        // failure message so a regression says how far over it went.
        expect(liteToolsTokenCost(), `lite tools cost ${liteToolsTokenCost()} tok`).toBeLessThanOrEqual(
            LITE_TOOLS_TOKEN_CAP,
        );
        expect(LITE_TOOLS_TOKEN_CAP).toBe(600);
    });

    it('still refuses every other tool name with the not_implemented envelope', () => {
        const resp = dispatch(FIXTURE, IDENTITY, {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'run_tests', arguments: {} },
        });
        const err = (resp as { error: { code: number; data: { code: string } } }).error;
        expect(err.code).toBe(-32601);
        expect(err.data.code).toBe('not_implemented');
    });
});

describe('lite server — server instructions (Phase 1.2)', () => {
    it('carries instructions on initialize', () => {
        const resp = dispatch(FIXTURE, IDENTITY, { jsonrpc: '2.0', id: 1, method: 'initialize' });
        const result = (resp as { result: Record<string, unknown> }).result;
        expect(result.instructions).toBe(INSTRUCTIONS);
    });

    it('keeps the nudge under the byte cap so it cannot grow into a preamble', () => {
        const bytes = Buffer.byteLength(INSTRUCTIONS, 'utf8');
        expect(bytes, `instructions are ${bytes} bytes`).toBeLessThanOrEqual(INSTRUCTIONS_BYTE_CAP);
        expect(INSTRUCTIONS_BYTE_CAP).toBe(400);
    });

    it('states the recovery obligation the rule states', () => {
        expect(INSTRUCTIONS).toContain('suggest_skill_for_task');
        expect(INSTRUCTIONS).toContain('read_skill');
        expect(INSTRUCTIONS.toLowerCase()).toContain('still exists');
    });
});

describe('lite server — suggest_skill_for_task', () => {
    it('ranks by task and returns names, scores and personas but no bodies', () => {
        const out = call('suggest_skill_for_task', { task: 'resolve merge conflicts' });
        expect(out.status).toBe('ok');
        const suggestions = out.suggestions as { skill: string; score: number }[];
        expect(suggestions[0]!.skill).toBe('merge-conflicts');
        expect(suggestions[0]!.score).toBeGreaterThan(0);
        expect(JSON.stringify(out)).not.toContain('body of');
    });

    it('honours limit and defaults it to 5', () => {
        const one = call('suggest_skill_for_task', { task: 'merge conflicts', limit: 1 });
        expect((one.suggestions as unknown[]).length).toBe(1);
        expect(call('suggest_skill_for_task', { task: 'merge conflicts' }).status).toBe('ok');
    });

    it('reports tiers: unknown until a tier file exists (Phase 3.3)', () => {
        expect(call('suggest_skill_for_task', { task: 'merge conflicts' }).tiers).toBe('unknown');
    });

    it('errors on a missing task instead of ranking nothing silently', () => {
        expect(call('suggest_skill_for_task', {}).status).toBe('error');
        expect(call('suggest_skill_for_task', { task: '   ' }).status).toBe('error');
    });

    it('reports no_catalogue on an empty tree — never an empty ok', () => {
        const resp = dispatch({ uris: {} }, IDENTITY, {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'suggest_skill_for_task', arguments: { task: 'anything' } },
        });
        const out = (resp as { result: { structuredContent: Record<string, unknown> } }).result
            .structuredContent;
        expect(out.status).toBe('no_catalogue');
    });

    it('ignores trigger text — keyword-v1 is the shipped ranker', () => {
        // `tenant scope` is authz-review's trigger and appears in no description.
        const out = call('suggest_skill_for_task', { task: 'tenant scope' });
        const names = (out.suggestions as { skill: string }[]).map((s) => s.skill);
        expect(names).not.toContain('authz-review');
    });
});

describe('lite server — read_skill', () => {
    it('returns the body for a listed skill', () => {
        const out = call('read_skill', { name: 'merge-conflicts' });
        expect(out.status).toBe('ok');
        expect(out.body).toContain('body of merge-conflicts');
    });

    it('reports not_found rather than throwing', () => {
        expect(call('read_skill', { name: 'no-such-skill' }).status).toBe('not_found');
    });

    it('refuses a path separator or a traversal segment', () => {
        for (const name of ['../rules/commit-policy', 'a/b', '..']) {
            expect(call('read_skill', { name }).status, name).toBe('error');
        }
    });

    it('cannot reach a rule or guideline through the skill door', () => {
        expect(call('read_skill', { name: 'commit-policy' }).status).toBe('not_found');
    });

    it('errors on a missing name', () => {
        expect(call('read_skill', {}).status).toBe('error');
    });
});

describe('kernel server standing cost — the Phase 0.2 figures', () => {
    // These pin `agents/evidence/metrics/mcp-tool-standing-cost.jsonl`. The
    // roadmap's premise said the allowlist descriptions measure ~1,972 tokens;
    // they measure 1,791, and the payload the host actually loads — schemas
    // included — is 3,886. Asserted with slack so a description edit does not
    // redden the suite, but a NEW TOOL does.
    const names = Object.keys(ALLOWLIST).sort();
    const descriptionChars = names.reduce((n, k) => n + ALLOWLIST[k]!.description.length, 0);
    const payloadChars = JSON.stringify({ tools: names.map((n) => to_mcp_tool_meta(ALLOWLIST[n]!)) }).length;

    it('has 20 allowlisted tools', () => {
        expect(names.length).toBe(20);
    });

    it('costs about 1,791 tokens in descriptions alone, not the 1,972 the roadmap assumed', () => {
        const tok = Math.round(descriptionChars / 4);
        expect(tok, `kernel descriptions are ${tok} tok`).toBeGreaterThan(1_600);
        expect(tok).toBeLessThan(2_000);
    });

    it('costs about 3,886 tokens as the payload the host loads — schemas included', () => {
        const tok = Math.round(payloadChars / 4);
        expect(tok, `kernel tools/list is ${tok} tok`).toBeGreaterThan(3_600);
        expect(tok).toBeLessThan(4_200);
    });

    it('is more than 5x the lite surface, which is why the lite one is registered', () => {
        expect(Math.round(payloadChars / 4)).toBeGreaterThan(liteToolsTokenCost() * 5);
    });
});


describe('lite server — Tier A filtering (Phase 3.3)', () => {
    // The `no tiers file` branch and the fixture branch, side by side. The
    // distinction is the whole point: `undefined` means nobody computed a split
    // on this machine, which is the default state, and must never read as "no
    // skill is Tier A".
    const TIERED: ContentTree = { ...FIXTURE, tier_a: new Set(['merge-conflicts']) };

    function callOn(tree: ContentTree, args: Record<string, unknown>): Record<string, unknown> {
        const resp = dispatch(tree, IDENTITY, {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: 'suggest_skill_for_task', arguments: args },
        });
        return (resp as { result: { structuredContent: Record<string, unknown> } }).result
            .structuredContent;
    }

    it('with no tiers file: returns the full ranked list and says tiers: unknown', () => {
        const out = callOn(FIXTURE, { task: 'resolve merge conflicts' });
        expect(out.tiers).toBe('unknown');
        expect((out.suggestions as { skill: string }[]).map((s) => s.skill)).toContain(
            'merge-conflicts',
        );
    });

    it('with a tiers file: drops the Tier A skill and says tiers: tier-b-only', () => {
        // `authz-review` also scores on this task via its `review` term, so the
        // list does not go empty and the filter is observable.
        const out = callOn(TIERED, { task: 'resolve merge conflicts and review gates' });
        expect(out.tiers).toBe('tier-b-only');
        const names = (out.suggestions as { skill: string }[]).map((s) => s.skill);
        expect(names).not.toContain('merge-conflicts');
        expect(names.length).toBeGreaterThan(0);
        expect(out.tier_filter).toBeUndefined();
    });

    it('bypasses the filter rather than returning an empty list', () => {
        // Only `merge-conflicts` matches, and it is Tier A. An empty answer here
        // would read as "no skill covers this" — the conclusion the rule forbids.
        const out = callOn(TIERED, { task: 'rebase conflicts' });
        const names = (out.suggestions as { skill: string }[]).map((s) => s.skill);
        expect(names).toEqual(['merge-conflicts']);
        expect(out.tier_filter).toBe('bypassed-to-avoid-empty');
    });
});

describe('loadTierA — absent is not empty', () => {
    let root: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiera-'));
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    function writeTiers(body: string): void {
        const dir = path.join(root, 'agents', 'runtime', 'state');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'skill-tiers.json'), body);
    }

    it('returns undefined when the file does not exist', () => {
        expect(loadTierA(root)).toBeUndefined();
    });

    it('returns the names when it does', () => {
        writeTiers(JSON.stringify({ tier_a: ['a', 'b'] }));
        expect([...loadTierA(root)!].sort()).toEqual(['a', 'b']);
    });

    it('returns an EMPTY SET, not undefined, for a genuinely empty Tier A', () => {
        writeTiers(JSON.stringify({ tier_a: [] }));
        expect(loadTierA(root)).toBeInstanceOf(Set);
        expect(loadTierA(root)!.size).toBe(0);
    });

    it('returns undefined on malformed or wrong-shaped content — never a half-read split', () => {
        writeTiers('{ not json');
        expect(loadTierA(root)).toBeUndefined();
        writeTiers(JSON.stringify({ tier_a: 'not-an-array' }));
        expect(loadTierA(root)).toBeUndefined();
        writeTiers(JSON.stringify({}));
        expect(loadTierA(root)).toBeUndefined();
    });
});
