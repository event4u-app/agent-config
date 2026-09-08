// The standing-payload grace ceiling is shrink-only, and until this landed
// nothing checked it. The budget file said "It may never move UP" from
// 2026-08-24 and its own `grace_ceiling_history` records it rising twice
// afterwards, on 2026-09-02 and 2026-09-08, each time with a careful prose
// justification and no objection from any gate. ADR-264 resolved the
// contradiction in favour of the sentence; these tests are what makes the
// sentence cost something.
//
// Both directions are pinned. A ratchet that only ever passes is the failure
// this repository already paid for once, so every case below either refuses or
// states why it may not.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { decide } from '../../src/scripts/check_preamble_payload_budget.js';
import {
    assertBoundsDidNotRise,
    BUDGET_CONFIG_PATH,
} from '../../src/scripts/_lib/standing_bound_ratchet.js';

const tmps: string[] = [];

afterEach(() => {
    while (tmps.length) fs.rmSync(tmps.pop() as string, { recursive: true, force: true });
});

function git(args: readonly string[], cwd: string): string {
    return execFileSync('git', [...args], { cwd, encoding: 'utf-8' });
}

function writeBudget(root: string, grace: number): void {
    const dir = path.join(root, path.dirname(BUDGET_CONFIG_PATH));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(root, BUDGET_CONFIG_PATH),
        JSON.stringify(
            {
                baseline_tokens: 1,
                headroom_pct: 0,
                target_tokens: { median: 1, p95: 2 },
                ci_delivery: { grace_ceiling: grace },
            },
            null,
            2,
        ),
        'utf-8',
    );
}

function writePayload(root: string, ruleBody: string): void {
    const rules = path.join(root, 'dist', 'agent-src', 'rules');
    fs.rmSync(rules, { recursive: true, force: true });
    fs.mkdirSync(rules, { recursive: true });
    fs.writeFileSync(path.join(rules, 'a.md'), ruleBody, 'utf-8');
    const skill = path.join(root, 'dist', 'agent-src', 'skills', 's0');
    fs.mkdirSync(skill, { recursive: true });
    fs.writeFileSync(
        path.join(skill, 'SKILL.md'),
        '---\nname: s0\ndescription: a fixture skill\n---\n\nbody\n',
        'utf-8',
    );
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# fixture\n', 'utf-8');
}

/**
 * A throwaway repository whose BASE commit carries `baseGrace` and `baseBody`.
 *
 * Real git, not a stub, because the module's whole claim is about what
 * `git show <ref>:<path>` returns — a stubbed git would prove the comparison and
 * none of the reading it depends on. Hooks and signing are disabled so the
 * fixture cannot inherit this repository's own guards.
 */
function fixture(baseGrace: number, baseBody: string): { root: string; base: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bound-ratchet-'));
    tmps.push(root);
    git(['init', '--quiet'], root);
    git(['config', 'core.hooksPath', path.join(root, '.no-hooks')], root);
    git(['config', 'commit.gpgsign', 'false'], root);
    git(['config', 'user.email', 'fixture@example.com'], root);
    git(['config', 'user.name', 'fixture'], root);
    writeBudget(root, baseGrace);
    writePayload(root, baseBody);
    git(['add', '-A'], root);
    git(['commit', '--quiet', '-m', 'base'], root);
    return { root, base: git(['rev-parse', 'HEAD'], root).trim() };
}

const BODY = '# r\n\n' + 'x'.repeat(400) + '\n';

function measured(root: string, base: string): number {
    return decide({
        repoRoot: root,
        budgetFile: path.join(root, BUDGET_CONFIG_PATH),
        baseRef: base,
    }).verdict.measured;
}

describe('standing-payload grace ceiling is shrink-only', () => {
    it('REFUSES a grace_ceiling raised in the config against the base ref', () => {
        const { root, base } = fixture(500, BODY);
        writeBudget(root, 700);
        // `overrideCeiling` mirrors the CI step, which reads the ceiling out of
        // the config and passes it as a flag — so the raise arrives through both
        // surfaces at once, which is what a real raising PR looks like.
        const d = decide({
            repoRoot: root,
            budgetFile: path.join(root, BUDGET_CONFIG_PATH),
            overrideCeiling: 700,
            baseRef: base,
        });
        expect(d.bounds.ok).toBe(false);
        expect(d.ok).toBe(false);
        expect(d.bounds.violations.join(' ')).toMatch(/rose from 500 to 700/);
        // The refusal has to survive the payload being comfortably inside the
        // ceiling: a raise is refused because it is a raise, not because the
        // tree happened to be too big.
        expect(d.verdict.withinBudget).toBe(true);
    });

    it('REFUSES a bigger ceiling smuggled through --ceiling with no config edit', () => {
        const { root, base } = fixture(500, BODY);
        const d = decide({
            repoRoot: root,
            budgetFile: path.join(root, BUDGET_CONFIG_PATH),
            overrideCeiling: 900,
            baseRef: base,
        });
        // Nothing in the diff changed. The CI step reads the ceiling out of the
        // config and passes it as a flag, so the flag is the second way to raise
        // the effective bound and it closes here rather than in a second check.
        expect(fs.readFileSync(path.join(root, BUDGET_CONFIG_PATH), 'utf-8')).toContain('500');
        expect(d.bounds.ok).toBe(false);
        expect(d.bounds.violations.join(' ')).toMatch(/rose from 500 to 900/);
    });

    it('REFUSES payload growth past an unchanged ceiling', () => {
        const { root, base } = fixture(1, BODY);
        const pin = measured(root, base);
        writeBudget(root, pin);
        git(['add', '-A'], root);
        git(['commit', '--quiet', '-m', 'pin the ceiling at the measurement'], root);
        const pinned = git(['rev-parse', 'HEAD'], root).trim();
        writePayload(root, BODY + 'y'.repeat(2000) + '\n');
        const d = decide({
            repoRoot: root,
            budgetFile: path.join(root, BUDGET_CONFIG_PATH),
            overrideCeiling: pin,
            baseRef: pinned,
        });
        expect(d.bounds.ok).toBe(true);
        expect(d.verdict.withinBudget).toBe(false);
        expect(d.ok).toBe(false);
    });

    it('passes when the bound is unchanged and the payload did not grow', () => {
        const { root, base } = fixture(900, BODY);
        const d = decide({
            repoRoot: root,
            budgetFile: path.join(root, BUDGET_CONFIG_PATH),
            overrideCeiling: 900,
            baseRef: base,
        });
        expect(d.bounds.ok).toBe(true);
        expect(d.bounds.baseGraceCeiling).toBe(900);
        expect(d.verdict.withinBudget).toBe(true);
        expect(d.ok).toBe(true);
        // Green with a stated comparison, never green with a silent skip: the
        // two are different facts and the note distinguishes them.
        expect(d.bounds.note).toBeNull();
    });

    it('passes a LOWERED bound — shrink-only, not frozen', () => {
        const { root, base } = fixture(900, BODY);
        writeBudget(root, 600);
        const d = decide({
            repoRoot: root,
            budgetFile: path.join(root, BUDGET_CONFIG_PATH),
            overrideCeiling: 600,
            baseRef: base,
        });
        expect(d.bounds.ok).toBe(true);
        expect(d.bounds.baseGraceCeiling).toBe(900);
        expect(d.ok).toBe(true);
    });

    it('reports SKIPPED rather than refusing when no base ref resolves', () => {
        const { root } = fixture(500, BODY);
        writeBudget(root, 9_000_000);
        const d = decide({
            repoRoot: root,
            budgetFile: path.join(root, BUDGET_CONFIG_PATH),
            baseRef: null,
        });
        // Deliberately the opposite posture to the reserve the council refused:
        // an unreadable base there would have GRANTED budget on an
        // infrastructure failure, here it would REFUSE a change on one. A
        // shallow clone must not red, and the skip is stated, not silent.
        expect(d.bounds.ok).toBe(true);
        expect(d.bounds.note).toMatch(/NOT verified/);
        expect(d.bounds.baseGraceCeiling).toBeNull();
    });

    it('reports NOT verified when the base config is unparseable', () => {
        const { root, base } = fixture(500, BODY);
        const v = assertBoundsDidNotRise({
            repoRoot: root,
            baseRef: base,
            headGraceCeiling: 999_999,
            git: (args) =>
                args[0] === 'show'
                    ? { ok: true, stdout: '{ not json', stderr: '' }
                    : { ok: true, stdout: '', stderr: '' },
        });
        expect(v.ok).toBe(true);
        expect(v.note).toMatch(/not parseable/);
    });
});
