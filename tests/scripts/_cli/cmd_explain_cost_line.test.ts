/**
 * `explain` distinguishes a figure that bounds from a figure that is printed.
 *
 * Step 3.5 of `road-to-a-spend-bound-only-where-one-was-set`, under ADR-279.
 *
 * Three presets carry `cost.daily_max_usd` / `weekly_max_usd` /
 * `monthly_max_usd` and two `mcp.*_max_usd` figures. `explain` printed the
 * first three under the label **"cost caps"**, and no reader compares spend
 * with any of the five: `presets.ts` maps the preset to an environment name
 * and nothing else reads them. The label asserted a bound that did not exist
 * — the same error ADR-279 removes one layer down, where a default ceiling
 * nobody set did bound.
 *
 * So the assertions below are about WORDING, deliberately. A test that only
 * checked the numbers would have passed before and after, and the defect was
 * never in the numbers.
 *
 * Units: every figure on both lines is US dollars.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from '../../../src/scripts/_cli/cmd_explain.js';

let tmp: string;
let stdoutSpy: { mockRestore: () => void };
let captured: string;

const ROUTER = JSON.stringify({
    schema_version: 1,
    kernel: ['direct-answers', 'no-cheap-questions'],
    tier_1: [{ id: 'architecture', triggers: [{ keyword: 'controller' }] }],
    tier_2: [],
});

function seedProject(root: string): void {
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'router.json'), ROUTER, 'utf-8');
    const presets = path.join(root, '.agent-src.uncondensed', 'presets');
    fs.mkdirSync(presets, { recursive: true });
    fs.writeFileSync(
        path.join(presets, 'balanced.yml'),
        'preset:\n' +
            '  id: balanced\n' +
            '  cost: {daily_max_usd: 10, weekly_max_usd: 50, monthly_max_usd: 150}\n' +
            '  mcp: {per_call_max_usd: 1, per_session_max_usd: 2}\n' +
            '  autonomy: {default: auto}\n',
        'utf-8',
    );
    const profiles = path.join(root, '.agent-src.uncondensed', 'profiles');
    fs.mkdirSync(profiles, { recursive: true });
    fs.writeFileSync(
        path.join(profiles, 'developer.yml'),
        'profile:\n  id: developer\n  preset: balanced\n',
        'utf-8',
    );
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'explain-cost-'));
    seedProject(tmp);
    captured = '';
    stdoutSpy = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation((chunk: string | Uint8Array) => {
            captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
            return true;
        });
});

afterEach(() => {
    stdoutSpy.mockRestore();
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('explain — preset cost figures are labelled as not enforced', () => {
    it('no longer calls the preset figures "cost caps"', () => {
        // The exact wrong construct, pinned as a literal. It said the figures
        // bounded something; nothing reads them.
        expect(main(['config', '--project', tmp])).toBe(0);
        expect(captured).not.toContain('cost caps:');
    });

    it('says the preset figures are shown and not enforced', () => {
        expect(main(['config', '--project', tmp])).toBe(0);
        expect(captured).toContain('NOT enforced');
        expect(captured).toContain('nothing compares spend with these');
    });

    it('still prints the three preset figures it always printed', () => {
        // The label changed; the information did not disappear.
        expect(main(['config', '--project', tmp])).toBe(0);
        expect(captured).toContain('daily $10');
        expect(captured).toContain('weekly $50');
        expect(captured).toContain('monthly $150');
    });

    it('also prints the two mcp figures, which were never shown at all', () => {
        expect(main(['config', '--project', tmp])).toBe(0);
        expect(captured).toContain('per-call $1');
        expect(captured).toContain('per-session $2');
    });
});

describe('explain — the configured budgets are printed beside them', () => {
    it('reports every window unset, and says that means no ceiling applies', () => {
        // No `.agent-settings.yml` at all: the shipped state.
        expect(main(['config', '--project', tmp])).toBe(0);
        expect(captured).toContain('configured cost.budgets');
        expect(captured).toContain('daily unset');
        expect(captured).toContain('no ceiling on money applies');
    });

    it('reports a window that was set, with its mode', () => {
        fs.writeFileSync(
            path.join(tmp, '.agent-settings.yml'),
            'cost:\n  enforcement: hard-stop\n  budgets:\n    daily: 20\n    weekly: 0\n    monthly: 0\n',
            'utf-8',
        );
        expect(main(['config', '--project', tmp])).toBe(0);
        expect(captured).toContain('daily $20');
        // 0 is unbounded, not a cap of nothing — the line must not render `$0`.
        expect(captured).toContain('weekly unset');
        expect(captured).toContain('mode: hard-stop');
        // The no-ceiling sentence is for the case where NOTHING is set.
        expect(captured).not.toContain('no ceiling on money applies');
    });

    it('defaults the mode to advisory when the settings file does not state one', () => {
        fs.writeFileSync(
            path.join(tmp, '.agent-settings.yml'),
            'cost:\n  budgets:\n    daily: 5\n',
            'utf-8',
        );
        expect(main(['config', '--project', tmp])).toBe(0);
        expect(captured).toContain('mode: advisory');
    });

    it('keeps the two kinds of figure on separate, differently labelled lines', () => {
        // The whole point of the step: a reader must be able to tell which
        // figures bound. If both ever render under one heading again, this
        // fails.
        expect(main(['config', '--project', tmp])).toBe(0);
        const presetAt = captured.indexOf('preset cost figures');
        const configuredAt = captured.indexOf('configured cost.budgets');
        expect(presetAt).toBeGreaterThan(-1);
        expect(configuredAt).toBeGreaterThan(presetAt);
    });
});
