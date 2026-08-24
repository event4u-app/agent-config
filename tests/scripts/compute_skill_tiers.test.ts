// Phase 2.1 of `road-to-skill-delivery-over-mcp` — the tier split, and above all
// the record of WHY a skill landed in Tier B.
//
// The split is only as trustworthy as the order it was filled in, and the order
// is usually a fallback: `agents/runtime/metrics/skill-usage.jsonl` was last
// written 2026-05-16 and is absent in a fresh checkout. So the assertion that
// matters most here is not the split itself but that `model_inputs.fallback`
// says which order produced it — a tier with no stated order is a number nobody
// can re-derive.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { computeTiers, usageOrderFrom } from '../../src/scripts/compute_skill_tiers.js';

let tmp: string;

function writeSkill(slug: string, description: string): void {
    const dir = path.join(tmp, 'skills', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\ndescription: ${description}\n---\n\n# ${slug}\n`);
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tiers-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('computeTiers — the split', () => {
    it('partitions the catalogue with no skill lost and none counted twice', () => {
        for (let i = 0; i < 40; i++) writeSkill(`s${String(i).padStart(2, '0')}`, 'x'.repeat(400));
        const out = computeTiers({ skillsDir: path.join(tmp, 'skills'), usageOrder: [] });
        expect(out.tier_a.length + out.tier_b.length).toBe(40);
        expect(new Set([...out.tier_a, ...out.tier_b]).size).toBe(40);
        expect(out.catalogue_count).toBe(40);
        // 8,000-char budget / 400-char descriptions = 20 survive.
        expect(out.tier_a).toHaveLength(20);
    });

    it('records the model inputs, so a tier is explicable after the fact', () => {
        writeSkill('one', 'short');
        const out = computeTiers({ skillsDir: path.join(tmp, 'skills'), usageOrder: [] });
        expect(out.model_inputs.context_window_tokens).toBe(200_000);
        expect(out.model_inputs.fraction).toBe(0.01);
        expect(out.model_inputs.per_entry_cap_chars).toBe(1536);
        expect(out.model_inputs.usage_rows_used).toBe(0);
        expect(out.model_inputs.budget_chars).toBe(8_000);
    });

    it('names the fallback when no usage order exists', () => {
        writeSkill('one', 'short');
        const out = computeTiers({ skillsDir: path.join(tmp, 'skills'), usageOrder: [] });
        expect(out.model_inputs.fallback).toBe('alphabetical');
        expect(out.model_inputs.fill_order).toBe('alphabetical-fallback');
    });

    it('names no fallback when a usage order IS supplied, and honours it', () => {
        // `aaa` is long enough to be capped at 1,536 chars, `zzz` is tiny, and
        // the budget is shrunk to 400 chars so exactly one of them can fit.
        // Alphabetical order would take `aaa` and starve `zzz`; the usage order
        // must invert that.
        writeSkill('aaa', 'x'.repeat(7_900));
        writeSkill('zzz', 'short');
        const out = computeTiers({
            skillsDir: path.join(tmp, 'skills'),
            usageOrder: ['zzz'],
            fraction: 0.0005,
        });
        expect(out.model_inputs.fallback).toBe(null);
        expect(out.model_inputs.usage_rows_used).toBe(1);
        expect(out.tier_a).toContain('zzz');
        expect(out.tier_b).toContain('aaa');
    });

    it('carries the model assumptions with the split, not in a separate doc', () => {
        writeSkill('one', 'short');
        const out = computeTiers({ skillsDir: path.join(tmp, 'skills'), usageOrder: [] });
        expect(out.model_assumptions.map((a) => a.id)).toContain('fill-order-is-invocation-frequency');
    });

    it('returns an empty split rather than throwing on a missing skills dir', () => {
        const out = computeTiers({ skillsDir: path.join(tmp, 'nope'), usageOrder: [] });
        expect(out.catalogue_count).toBe(0);
        expect(out.tier_a).toEqual([]);
        expect(out.tier_b).toEqual([]);
    });
});

describe('usageOrderFrom — the observed order', () => {
    it('returns an empty order when the usage file is absent', () => {
        expect(usageOrderFrom(path.join(tmp, 'absent.jsonl'))).toEqual([]);
    });

    it('orders by invocation count, most-invoked first, ties on name', () => {
        const f = path.join(tmp, 'skill-usage.jsonl');
        fs.writeFileSync(
            f,
            [
                '{"slug":"beta","kind":"skill"}',
                '{"slug":"alpha","kind":"skill"}',
                '{"slug":"beta","kind":"skill"}',
                '{"slug":"beta","kind":"skill"}',
                '{"slug":"alpha","kind":"skill"}',
                '{"slug":"gamma","kind":"skill"}',
            ].join('\n') + '\n',
        );
        expect(usageOrderFrom(f)).toEqual(['beta', 'alpha', 'gamma']);
    });

    it('skips malformed lines instead of failing the whole read', () => {
        const f = path.join(tmp, 'skill-usage.jsonl');
        fs.writeFileSync(f, 'not json\n{"slug":"alpha","kind":"skill"}\n{"no_slug":1}\n');
        expect(usageOrderFrom(f)).toEqual(['alpha']);
    });
});
