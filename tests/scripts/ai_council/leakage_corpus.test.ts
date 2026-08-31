// Tests for src/scripts/ai_council/leakage_corpus.ts — the corpus assembler
// for the provider-recognition leakage bench
// (road-to-inbox-harvest-2026-08-e-council-topology-evidence,
// blocker: leakage-bench-needs-assembler-and-design-forks, todo item 1).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    DEFAULT_RETENTION_DAYS,
    IDENTITY_ANONYMISE,
    SYNTHETIC_FIXTURE_BASENAME,
    SyntheticCorpusRefusal,
    assembleLeakageCorpus,
    leakageItemId,
} from '../../../src/scripts/ai_council/leakage_corpus.js';

const NOW = Date.UTC(2026, 7, 31, 12, 0, 0);
const DAY = 86_400_000;

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'leakage-corpus-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function writeRecord(name: string, body: unknown, mtimeMs = NOW - DAY): string {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(body), 'utf8');
    const secs = mtimeMs / 1000;
    fs.utimesSync(target, secs, secs);
    return target;
}

function response(provider: string, text: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { provider, model: `${provider}-model`, text, error: null, ...extra };
}

function assemble(overrides: Record<string, unknown> = {}) {
    return assembleLeakageCorpus({ responsesDir: root, now: NOW, ...overrides });
}

describe('assembleLeakageCorpus — happy path', () => {
    beforeEach(() => {
        writeRecord('b-run.json', {
            responses: [response('openai', 'Three options, and only the second preserves the prompt.')],
        });
        writeRecord('a-run.json', {
            responses: [
                response('anthropic', 'The proposal holds only if the window outlives the audit.'),
                response('gemini', 'The weakest assumption is that the two sets are the same.'),
            ],
        });
    });

    it('emits one item per usable response body', () => {
        const c = assemble();
        expect(c.items).toHaveLength(3);
        expect(c.census.items_kept).toBe(3);
        expect(c.census.responses_seen).toBe(3);
        expect(c.census.files_scanned).toBe(2);
        expect(c.excluded).toEqual([]);
    });

    it('true_family is the provider field and families is the sorted distinct set', () => {
        const c = assemble();
        expect(c.families).toEqual(['anthropic', 'gemini', 'openai']);
        expect(c.items.map((i) => i.true_family).sort()).toEqual(['anthropic', 'gemini', 'openai']);
    });

    it('ids are distinct, stable across runs, and index-suffixed within a file', () => {
        const first = assemble().items.map((i) => i.id);
        const second = assemble().items.map((i) => i.id);
        expect(new Set(first).size).toBe(3);
        expect(second).toEqual(first);
        expect(leakageItemId('a-run.json', 0)).not.toBe(leakageItemId('a-run.json', 1));
        expect(leakageItemId('a-run.json', 0)).toBe(assemble().items[0]?.id);
    });

    it('items carry provenance the scorer needs and a rater must not see', () => {
        const c = assemble();
        const item = c.items.find((i) => i.true_family === 'gemini');
        expect(item?.source_file).toBe('a-run.json');
        expect(item?.response_index).toBe(1);
        expect(item?.mtime_ms).toBeGreaterThan(0);
    });

    it('two calls are deeply equal — deterministic ordering', () => {
        expect(assemble()).toEqual(assemble());
    });

    it('an empty directory is an empty corpus, not a throw', () => {
        const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'leakage-empty-'));
        try {
            const c = assembleLeakageCorpus({ responsesDir: empty, now: NOW });
            expect(c.items).toEqual([]);
            expect(c.families).toEqual([]);
            expect(c.census.items_kept).toBe(0);
        } finally {
            fs.rmSync(empty, { recursive: true, force: true });
        }
    });
});

describe('assembleLeakageCorpus — the id must not leak ground truth', () => {
    it('an id never contains the provider name, even when the filename does', () => {
        // Real filenames under agents/runtime/council/responses/ include
        // `anthropic-design-skills-integration.json` and several `claude-*`.
        writeRecord('anthropic-design-skills-integration.json', {
            responses: [response('anthropic', 'A label stripped from a header is not a signal removed.')],
        });
        writeRecord('claude-code-distribution.json', {
            responses: [response('anthropic', 'Cost first: doubling every judged pair is a cost.')],
        });
        const c = assemble();
        expect(c.items).toHaveLength(2);
        for (const item of c.items) {
            for (const leak of ['anthropic', 'openai', 'gemini', 'claude', 'gpt', 'xai', 'perplexity']) {
                expect(item.id.toLowerCase()).not.toContain(leak);
            }
        }
    });
});

describe('assembleLeakageCorpus — exclusions are reported, never silent', () => {
    it('an entry with error set is excluded with a reason', () => {
        writeRecord('r.json', {
            responses: [
                response('openai', 'usable body here'),
                response('anthropic', 'body that should not count', { error: 'exit_1 quota exhausted' }),
            ],
        });
        const c = assemble();
        expect(c.items.map((i) => i.true_family)).toEqual(['openai']);
        expect(c.excluded).toEqual([
            { source: 'r.json', index: 1, reason: 'response-carried-error', detail: 'exit_1 quota exhausted' },
        ]);
        expect(c.census.items_excluded).toBe(1);
    });

    it('an entry with empty text is excluded with a reason', () => {
        writeRecord('r.json', { responses: [response('openai', '   '), response('anthropic', 'real body')] });
        const c = assemble();
        expect(c.items.map((i) => i.true_family)).toEqual(['anthropic']);
        expect(c.excluded.map((e) => [e.index, e.reason])).toEqual([[0, 'empty-text']]);
    });

    it('an entry with no provider is excluded with a reason', () => {
        writeRecord('r.json', { responses: [{ model: 'm', text: 'orphan body', error: null }] });
        const c = assemble();
        expect(c.items).toEqual([]);
        expect(c.excluded.map((e) => [e.index, e.reason])).toEqual([[0, 'missing-provider']]);
    });

    it('an entry that is not an object is excluded with a reason', () => {
        writeRecord('r.json', { responses: ['just a string'] });
        expect(assemble().excluded.map((e) => e.reason)).toEqual(['not-an-object']);
    });

    it('unparseable JSON is excluded with a reason and the run still succeeds', () => {
        fs.writeFileSync(path.join(root, 'broken.json'), '{ this is not json', 'utf8');
        writeRecord('good.json', { responses: [response('openai', 'still assembled')] });
        const c = assemble();
        expect(c.items).toHaveLength(1);
        const broken = c.excluded.find((e) => e.source === 'broken.json');
        expect(broken?.reason).toBe('unparseable-json');
        expect(broken?.index).toBeNull();
        expect(c.census.files_excluded).toBe(1);
    });

    it('a record with no responses array is excluded with a reason', () => {
        writeRecord('meta.json', { schema_version: 3, mode: 'prompt' });
        expect(assemble().excluded.map((e) => e.reason)).toEqual(['no-responses-array']);
    });

    it('a non-json file is excluded with a reason', () => {
        fs.writeFileSync(path.join(root, 'notes.md'), '# convergence', 'utf8');
        expect(assemble().excluded.map((e) => [e.source, e.reason])).toEqual([['notes.md', 'not-json-file']]);
    });

    it('nested per-round records under a `<slug>.json/` directory are collected', () => {
        writeRecord('0B6-decision.json/debate-round-1.json', { responses: [response('anthropic', 'round one body')] });
        writeRecord('0B6-decision.json/debate-round-2.json', { responses: [response('openai', 'round two body')] });
        const c = assemble();
        expect(c.items.map((i) => i.source_file)).toEqual([
            '0B6-decision.json/debate-round-1.json',
            '0B6-decision.json/debate-round-2.json',
        ]);
        expect(new Set(c.items.map((i) => i.id)).size).toBe(2);
    });
});

describe('assembleLeakageCorpus — refuses synthetic data', () => {
    it('a file named smoke-items.json throws, and the message names the file', () => {
        writeRecord(SYNTHETIC_FIXTURE_BASENAME, { responses: [response('openai', 'fixture prose')] });
        expect(() => assemble()).toThrow(SyntheticCorpusRefusal);
        expect(() => assemble()).toThrow(/smoke-items\.json/);
        expect(() => assemble()).toThrow(/must refuse/);
    });

    it('a file carrying "synthetic": true throws under any name', () => {
        writeRecord('perfectly-normal-name.json', {
            synthetic: true,
            responses: [response('openai', 'hand-written fixture body')],
        });
        let caught: unknown;
        try {
            assemble();
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(SyntheticCorpusRefusal);
        expect((caught as SyntheticCorpusRefusal).source).toBe('perfectly-normal-name.json');
        expect((caught as Error).message).toMatch(/synthetic/);
    });

    it('refusal is a throw, not an exclude-and-continue', () => {
        writeRecord('a-good.json', { responses: [response('openai', 'real body')] });
        writeRecord('z-synth.json', { synthetic: 1, responses: [response('anthropic', 'fixture')] });
        expect(() => assemble()).toThrow(SyntheticCorpusRefusal);
    });

    it('a responsesDir under council-provider-leakage/ throws before any read', () => {
        const dir = path.join(root, 'internal', 'bench', 'council-provider-leakage');
        fs.mkdirSync(dir, { recursive: true });
        expect(() => assembleLeakageCorpus({ responsesDir: dir, now: NOW })).toThrow(SyntheticCorpusRefusal);
        expect(() => assembleLeakageCorpus({ responsesDir: dir, now: NOW })).toThrow(/council-provider-leakage/);
    });
});

describe('assembleLeakageCorpus — retention is partitioned, never enforced', () => {
    it('old and new mtimes land in the right census buckets and nothing is deleted', () => {
        const fresh = writeRecord('fresh.json', { responses: [response('openai', 'recent body')] }, NOW - 2 * DAY);
        const stale = writeRecord(
            'stale.json',
            { responses: [response('anthropic', 'body from 117 days ago'), response('openai', 'sibling body')] },
            NOW - 117 * DAY,
        );

        const c = assemble();

        expect(c.census.retention_days).toBe(DEFAULT_RETENTION_DAYS);
        expect(c.census.within_retention).toEqual({ openai: 1 });
        expect(c.census.over_retention).toEqual({ anthropic: 1, openai: 1 });
        expect(c.census.within_retention_total).toBe(1);
        expect(c.census.over_retention_total).toBe(2);
        expect(c.items.filter((i) => i.within_retention).map((i) => i.source_file)).toEqual(['fresh.json']);

        // The corpus is the measurement subject: the assembler must never prune it.
        expect(fs.existsSync(fresh)).toBe(true);
        expect(fs.existsSync(stale)).toBe(true);
        expect(fs.readdirSync(root).sort()).toEqual(['fresh.json', 'stale.json']);
    });

    it('a wider retentionDays moves items between partitions without touching disk', () => {
        writeRecord('stale.json', { responses: [response('anthropic', 'older body')] }, NOW - 30 * DAY);
        expect(assemble().census.over_retention_total).toBe(1);
        const wide = assemble({ retentionDays: 365 });
        expect(wide.census.within_retention).toEqual({ anthropic: 1 });
        expect(wide.census.over_retention_total).toBe(0);
        expect(fs.existsSync(path.join(root, 'stale.json'))).toBe(true);
    });

    it('the module calls no fs mutation — no write, unlink, or rm', () => {
        // Matched as CALL forms, not as substrings: the module's own header
        // prose names `unlink` and `rm` while explaining why it never calls
        // them, and a substring scan would fail on the documentation.
        const src = fs.readFileSync('src/scripts/ai_council/leakage_corpus.ts', 'utf8');
        const mutators = /\bfs\.(write|append|unlink|rm|rmdir|truncate|mkdir|copyFile|rename|open)\w*\s*\(/;
        expect(src).not.toMatch(mutators);
        // Sanity: the same regex does catch a real call, so a green result above
        // is a property of the module and not of an unmatchable pattern.
        expect('fs.writeFileSync(p, x)').toMatch(mutators);
    });
});

describe('assembleLeakageCorpus — the anonymise seam is identity by default', () => {
    const BODY = 'I am Claude, made by Anthropic, and this body is raw.';

    it('the default returns bodies byte-identical to disk — no anonymisation happens', () => {
        writeRecord('r.json', { responses: [response('anthropic', BODY)] });
        expect(assemble().items[0]?.text).toBe(BODY);
        expect(IDENTITY_ANONYMISE(BODY)).toBe(BODY);
    });

    it('an injected anonymiser is applied to the body and nothing else', () => {
        writeRecord('r.json', { responses: [response('anthropic', BODY)] });
        const c = assemble({ anonymise: (t: string) => t.replace(/Claude|Anthropic/g, '[REDACTED]') });
        expect(c.items[0]?.text).toBe('I am [REDACTED], made by [REDACTED], and this body is raw.');
        expect(c.items[0]?.true_family).toBe('anthropic');
    });
});
