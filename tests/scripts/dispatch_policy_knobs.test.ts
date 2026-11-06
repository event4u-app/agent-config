/**
 * A default knob AC ships without a policy row fails `check_claims`. Knobs that
 * predate the check sit in the table's `known_unbound` baseline, which may only
 * shrink: an entry that is now bound, or gone, is a finding too.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { load_ledger, policy_findings } from '../../src/scripts/check_claims.js';
import { knobsIn, unboundKnobFindings, type PolicyTable } from '../../src/scripts/_lib/dispatch_policy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const tmps: string[] = [];
afterEach(() => {
    for (const t of tmps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
});

function fixture(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knobs-'));
    tmps.push(root);
    for (const [rel, text] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), text);
    }
    return root;
}

const agent = (body: string): string => `---\nname: x\n${body}\n---\n\nBody.\n`;
const row = (file: string, key: string) => ({
    id: `${file}:${key}`,
    value: 'inherit',
    sink: { kind: 'subagent-frontmatter' as const, file, key },
    claim: 'unmeasured',
    review_by: '2026-12-31',
    local: 'learnable' as const,
});

describe('knobsIn', () => {
    it('reads the dispatch keys of every subagent, the subagents section of the template, and the council round defaults', () => {
        const root = fixture({
            'src/subagents/a.md': agent('model_tier: inherit\nomit_project_instructions: true\ndescription: d'),
            'src/subagents/_partial.md': agent('model_tier: lite'),
            'src/config/agent-settings.template.yml': 'other:\n  x: 1\nsubagents:\n  max_parallel: 3\n  model_map:\n    a: b\n  judge_model: ""\nnext: 1\n',
            'agents/templates/.ai-council.yml.example': 'defaults:\n  min_rounds: 2\n  model: x\n  fast:\n    max_rounds: 1\n',
        });
        expect(knobsIn(root).map((k) => `${k.file}:${k.key}`)).toEqual([
            'src/subagents/a.md:model_tier',
            'src/subagents/a.md:omit_project_instructions',
            'src/config/agent-settings.template.yml:subagents.max_parallel',
            'src/config/agent-settings.template.yml:subagents.judge_model',
            'agents/templates/.ai-council.yml.example:defaults.min_rounds',
        ]);
    });
});

describe('unboundKnobFindings', () => {
    const files = { 'src/subagents/a.md': agent('model_tier: inherit'), 'src/subagents/b.md': agent('model_tier: inherit') };
    it('a knob with no row fails', () => {
        const table: PolicyTable = { rows: [row('src/subagents/a.md', 'model_tier')] };
        expect(unboundKnobFindings(fixture(files), table)).toEqual([
            'src/subagents/b.md:model_tier is a default knob with no row in src/config/dispatch-policy.json — add a row (claim or `unmeasured` + review_by)',
        ]);
    });
    it('a knob bound through `also` counts as bound', () => {
        const table: PolicyTable = { rows: [{ ...row('src/subagents/a.md', 'model_tier'), also: [{ kind: 'subagent-frontmatter', file: 'src/subagents/b.md', key: 'model_tier' }] }] };
        expect(unboundKnobFindings(fixture(files), table)).toEqual([]);
    });
    it('the baseline admits a knob that predates the check, and may only shrink', () => {
        const root = fixture(files);
        expect(unboundKnobFindings(root, { rows: [row('src/subagents/a.md', 'model_tier')], known_unbound: ['src/subagents/b.md:model_tier'] })).toEqual([]);
        expect(unboundKnobFindings(root, { rows: [row('src/subagents/a.md', 'model_tier'), row('src/subagents/b.md', 'model_tier')], known_unbound: ['src/subagents/b.md:model_tier'] })).toEqual([
            'known_unbound lists src/subagents/b.md:model_tier, which is bound or gone — remove it from the baseline',
        ]);
    });
    it('check_claims reports it: a fixture adding a knob without a row yields a dispatch-policy finding', () => {
        const root = fixture({
            ...files,
            'src/config/dispatch-policy.json': JSON.stringify({ rows: [row('src/subagents/a.md', 'model_tier')] }),
        });
        expect(policy_findings(root, new Map()).some((r) => r.includes('src/subagents/b.md:model_tier is a default knob with no row'))).toBe(true);
    });
    it('the shipped tree has no unbound knob outside its baseline', () => {
        expect(policy_findings(ROOT, load_ledger())).toEqual([]);
    });
});
