// The standing-payload bounds are shrink-only, and until this landed nothing
// checked them. The budget file said "It may never move UP" from 2026-08-24 and
// its own raise history records the stored ceiling rising twice afterwards, on
// 2026-09-02 and 2026-09-08, each time with a careful prose justification and no
// objection from any gate. ADR-264 resolved the contradiction in favour of the
// sentence; these tests are what makes the sentence cost something.
//
// THE SUBJECT MOVED, 2026-09-11. The stored ceiling is gone (ADR-276) and the
// bound is measured at the base ref, so what a config edit can still widen is
// `design_ceiling` (derived from baseline_tokens x headroom_pct) plus every
// existing exception grant and watermark. Those are what these cases now pin —
// the mechanism is unchanged, the numbers it guards are different, and a
// deleted grant is refused on top because a removed number is not a smaller one.
//
// Both directions are pinned. A ratchet that only ever passes is the failure
// this repository already paid for once, so every case below either refuses or
// states why it may not.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { decide, main } from '../../src/scripts/check_preamble_payload_budget.js';
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

/**
 * The bound under test is `design_ceiling` now.
 *
 * It used to be `ci_delivery.grace_ceiling`, a number stored beside the design
 * one. That key is gone (ADR-276): the ceiling is measured at the base ref, so
 * the only config-side number that can widen it is `baseline_tokens` x
 * `headroom_pct`, which derives `design_ceiling`. With `headroom_pct: 0` the
 * baseline IS the design ceiling, so every case below keeps its shape — a
 * fixture written at 500 and raised to 700 is still a raise.
 */
function writeBudget(root: string, designCeiling: number): void {
    const dir = path.join(root, path.dirname(BUDGET_CONFIG_PATH));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(root, BUDGET_CONFIG_PATH),
        JSON.stringify(
            { baseline_tokens: designCeiling, headroom_pct: 0, target_tokens: { median: 1, p95: 2 } },
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
 * A throwaway repository whose BASE commit carries `baseDesignCeiling` and `baseBody`.
 *
 * Real git, not a stub, because the module's whole claim is about what
 * `git show <ref>:<path>` returns — a stubbed git would prove the comparison and
 * none of the reading it depends on. Hooks and signing are disabled so the
 * fixture cannot inherit this repository's own guards.
 */
function fixture(baseDesignCeiling: number, baseBody: string): { root: string; base: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bound-ratchet-'));
    tmps.push(root);
    git(['init', '--quiet'], root);
    git(['config', 'core.hooksPath', path.join(root, '.no-hooks')], root);
    git(['config', 'commit.gpgsign', 'false'], root);
    git(['config', 'user.email', 'fixture@example.com'], root);
    git(['config', 'user.name', 'fixture'], root);
    writeBudget(root, baseDesignCeiling);
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

describe('the standing-payload design ceiling is shrink-only', () => {
    it('REFUSES a design ceiling raised in the config against the base ref', () => {
        const { root, base } = fixture(500, BODY);
        writeBudget(root, 700);
        // The config is now the ONLY surface the ceiling can be widened
        // through. `--ceiling` used to be a second one and was removed with the
        // move to a measured ceiling — the case below pins that it is refused
        // rather than ignored.
        const d = decide({
            repoRoot: root,
            budgetFile: path.join(root, BUDGET_CONFIG_PATH),
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

    it('REFUSES --ceiling outright — the second widening surface is gone, not ignored', () => {
        // `--ceiling` was how the CI step handed the gate the stored ceiling,
        // and it was therefore a second way to widen the effective bound. The
        // measured ceiling removes the need for it. Refusing loudly rather than
        // ignoring it is the point: a caller still passing a number believes it
        // is setting the bound, and silently measuring something else would be
        // the most expensive kind of no-op.
        const err: string[] = [];
        const write = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((s: string) => {
            err.push(s);
            return true;
        }) as typeof process.stderr.write;
        try {
            expect(main(['--ceiling', '900'])).toBe(2);
        } finally {
            process.stderr.write = write;
        }
        expect(err.join('')).toMatch(/--ceiling was removed/);
        expect(err.join('')).toMatch(/preamble-payload-exceptions\.json/);
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
            baseRef: base,
        });
        expect(d.bounds.ok).toBe(true);
        expect(d.bounds.baseBounds?.['design_ceiling']).toBe(900);
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
            baseRef: base,
        });
        expect(d.bounds.ok).toBe(true);
        expect(d.bounds.baseBounds?.['design_ceiling']).toBe(900);
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
        expect(d.bounds.baseBounds).toBeNull();
    });

    it('reports NOT verified when the base config is unparseable', () => {
        const { root, base } = fixture(500, BODY);
        const v = assertBoundsDidNotRise({
            repoRoot: root,
            baseRef: base,
            headBounds: { design_ceiling: 999_999 },
            git: (args) =>
                args[0] === 'show'
                    ? { ok: true, stdout: '{ not json', stderr: '' }
                    : { ok: true, stdout: '', stderr: '' },
        });
        expect(v.ok).toBe(true);
        expect(v.note).toMatch(/not parseable/);
    });
});

/**
 * The enforcing posture, added 2026-09-10 after an AI council (2/2) made it
 * blocking for the move to a base-measured ceiling.
 *
 * Every case here is the SAME input as an advisory case above, differing only
 * by `requireBase`. That pairing is the point: a mode that only ever ran in one
 * posture would prove nothing about the other, and the defect being closed was
 * four independent `ok: true` returns nobody had compared.
 */
describe('assertBoundsDidNotRise — enforcing posture', () => {
    const dead = (): { ok: boolean; stdout: string; stderr: string } => ({
        ok: false,
        stdout: '',
        stderr: 'no such ref',
    });

    it('refuses instead of skipping when no base ref resolved', () => {
        const opts = { repoRoot: '.', baseRef: null, headBounds: { design_ceiling: 1 } };
        expect(assertBoundsDidNotRise(opts).ok).toBe(true);
        const v = assertBoundsDidNotRise({ ...opts, requireBase: true });
        expect(v.ok).toBe(false);
        expect(v.violations.join(' ')).toMatch(/no base ref resolved/);
        // The note is KEPT on the refusal, not nulled. Nulling it was the first
        // cut, and it made the refusal indistinguishable from a risen ceiling
        // downstream — a completion review caught the renderer printing ROSE
        // for a fetch problem.
        expect(v.note).toMatch(/NOT verified/);
        expect(v.verified).toBe(false);
    });

    it('refuses instead of skipping when the base config cannot be read', () => {
        const opts = { repoRoot: '.', baseRef: 'deadbeef', git: dead, headBounds: { design_ceiling: 1 } };
        expect(assertBoundsDidNotRise(opts).ok).toBe(true);
        const v = assertBoundsDidNotRise({ ...opts, requireBase: true });
        expect(v.ok).toBe(false);
        expect(v.violations.join(' ')).toMatch(/could not be read/);
    });

    it('refuses instead of skipping when the base config is unparseable', () => {
        const opts = {
            repoRoot: '.',
            baseRef: 'deadbeef',
            headBounds: { design_ceiling: 1 },
            git: (args: readonly string[]) =>
                args[0] === 'show'
                    ? { ok: true, stdout: '{ not json', stderr: '' }
                    : { ok: true, stdout: '', stderr: '' },
        };
        expect(assertBoundsDidNotRise(opts).ok).toBe(true);
        const v = assertBoundsDidNotRise({ ...opts, requireBase: true });
        expect(v.ok).toBe(false);
        expect(v.violations.join(' ')).toMatch(/not parseable/);
    });

    it('refuses instead of skipping when the base carries no bound at all', () => {
        const opts = {
            repoRoot: '.',
            baseRef: 'deadbeef',
            headBounds: { design_ceiling: 1 },
            git: (args: readonly string[]) =>
                args[0] === 'show'
                    ? { ok: true, stdout: JSON.stringify({ ci_delivery: {} }), stderr: '' }
                    : { ok: true, stdout: '', stderr: '' },
        };
        expect(assertBoundsDidNotRise(opts).ok).toBe(true);
        const v = assertBoundsDidNotRise({ ...opts, requireBase: true });
        expect(v.ok).toBe(false);
        expect(v.violations.join(' ')).toMatch(/no shrink-only bounds/);
    });

    it('does not change the verdict when the bound IS verifiable', () => {
        const readable = (args: readonly string[]): { ok: boolean; stdout: string; stderr: string } =>
            args[0] === 'show'
                ? { ok: true, stdout: JSON.stringify({ baseline_tokens: 500, headroom_pct: 0 }), stderr: '' }
                : { ok: true, stdout: '', stderr: '' };
        // The mode gates the UNVERIFIABLE cases only. A real comparison must
        // reach the same answer in both postures, or the flag is not a mode
        // gate but a second policy.
        for (const requireBase of [false, true]) {
            const within = assertBoundsDidNotRise({
                repoRoot: '.', baseRef: 'deadbeef', git: readable, headBounds: { design_ceiling: 400 }, requireBase,
            });
            expect(within.ok).toBe(true);
            const risen = assertBoundsDidNotRise({
                repoRoot: '.', baseRef: 'deadbeef', git: readable, headBounds: { design_ceiling: 600 }, requireBase,
            });
            expect(risen.ok).toBe(false);
            expect(risen.violations.join(' ')).toMatch(/rose from 500 to 600/);
        }
    });
});
