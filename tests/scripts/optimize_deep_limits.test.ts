/**
 * /optimize:deep bounded-autonomy pin (release-truth Phase 4).
 *
 * The reviews' P0: an autonomous deep-refactoring loop shipped without
 * technically enforced limits. This deterministic test pins the command's
 * machine-readable `limits:` frontmatter, the flow text that enforces each
 * limit, and the eval fixtures that cover them — so none of the three can
 * silently drift from the others.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(HERE), '..', '..');
const COMMAND = path.join(ROOT, 'src/domains/meta/optimize/deep/command.md');
const FIXTURES = path.join(ROOT, 'tests/optimize-deep/eval-fixtures.md');

function frontmatter(text: string): Record<string, unknown> {
    const m = /^---\n([\s\S]*?)\n---\n/u.exec(text);
    expect(m, 'command.md must carry frontmatter').not.toBeNull();
    return parse(m![1]!) as Record<string, unknown>;
}

const commandText = fs.readFileSync(COMMAND, 'utf-8');
const fm = frontmatter(commandText);
const limits = fm['limits'] as Record<string, unknown>;

describe('machine-readable limits block', () => {
    it('pins the exact limit values', () => {
        expect(limits).toEqual({
            mode_default: 'plan',
            max_iterations: 3,
            hard_ceiling: 5,
            no_gain_stop: 2,
            target_metric: 'required',
        });
    });

    it('offers the mode flag in the argument hint', () => {
        expect(String(fm['argument-hint'])).toContain('--mode=plan|execute');
    });
});

describe('flow text enforces what the frontmatter pins', () => {
    it('plan-only default: execute must be explicit, plan mode stops before Step 5', () => {
        expect(commandText).toContain('`--mode=plan` is the **default**');
        expect(commandText).toMatch(/`--mode=execute` must be \*\*explicitly present in the invocation\*\*/u);
        expect(commandText).toContain('No push, no PR, no\nrefinement loop');
        expect(commandText).toContain('### Step 5 — Pull request (execute mode only)');
    });

    it('pre-registered target metric gates loop 1', () => {
        expect(commandText).toContain('Pre-registered target metric — required before loop 1');
        expect(commandText).toContain('target metric not pre-registered');
        expect(commandText).toContain('measured baseline at the branch SHA');
    });

    it('loop budget: default 3, ceiling 5 clamped', () => {
        expect(commandText).toMatch(/\*\*Default: 3\*\*/u);
        expect(commandText).toMatch(/Hard ceiling: 5 — a larger `--loops` value is clamped/u);
    });

    it('per-loop verification + two-consecutive-no-gain stop', () => {
        expect(commandText).toContain('re-measure the pre-registered\ntarget metric at the new SHA');
        expect(commandText).toMatch(/Two consecutive loops deliver no measurable gain/u);
    });

    it('hard exclusions: kernel rules + stable contracts + unchanged floors', () => {
        expect(commandText).toContain('Hard exclusions — never inside this command');
        expect(commandText).toContain('is_kernel_rule');
        expect(commandText).toContain('contexts/authority/kernel-rule-edits.md');
        expect(commandText).toContain('`stability: stable`');
        expect(commandText).toMatch(/merge,\s+deploy, and every Hard-Floor action stay this-turn gated/u);
    });
});

describe('eval fixtures cover every pinned limit', () => {
    const fixtures = fs.readFileSync(FIXTURES, 'utf-8');

    it('carries the six fixture ids and the decidable patterns', () => {
        for (const id of ['odl-1', 'odl-2', 'odl-3', 'odl-4', 'odl-5', 'odl-6']) {
            expect(fixtures).toContain(`### ${id} `);
        }
        for (const pattern of ['P1', 'P2', 'P3']) {
            expect(fixtures).toContain(`**${pattern} `);
        }
    });

    it('fixture semantics match the frontmatter values', () => {
        // odl-2 exercises the ceiling; odl-3 the no-gain stop — the fixture
        // text must name the same numbers the frontmatter pins.
        expect(fixtures).toContain('clamped to the hard ceiling (5)');
        expect(fixtures).toContain('two consecutive no-gain');
        expect(fixtures).toContain('target metric not pre-registered');
        expect(fixtures).toContain('contexts/authority/kernel-rule-edits.md');
    });
});

describe('kernel exclusion names the real registry', () => {
    it('is_kernel_rule accepts the kernel rule the odl-5 fixture uses', async () => {
        const { is_kernel_rule } = await import('../../src/scripts/_lib/kernel_rules.js');
        expect(is_kernel_rule('src/rules/verify-before-complete.md')).toBe(true);
        expect(is_kernel_rule('src/rules/icon-consistency.md')).toBe(false);
    });
});
