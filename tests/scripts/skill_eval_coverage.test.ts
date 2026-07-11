/**
 * Behavioural-eval coverage metric + ratchet
 * (road-to-skill-eval-coverage Phase 1 + Phase 3).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    checkRatchet,
    checkTierFloor,
    computeCoverage,
    writeFloor,
} from '../../src/scripts/skill_eval_coverage.js';

let tmp = '';
let skillsDir = '';
let profilesDir = '';
let floorPath = '';

function mkSkill(name: string, opts: { rich?: boolean; covered?: boolean } = {}): void {
    const dir = path.join(skillsDir, name);
    fs.mkdirSync(dir, { recursive: true });
    const fm = ['---', `name: ${name}`, 'description: x', 'source: package', 'domain: engineering'];
    if (opts.rich) fm.push('token_budget_class: rich');
    fm.push('---', '', `# ${name}`, '', 'Body.');
    fs.writeFileSync(path.join(dir, 'SKILL.md'), fm.join('\n') + '\n');
    if (opts.covered) {
        fs.mkdirSync(path.join(dir, 'evals'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'evals', 'evals.json'),
            JSON.stringify({ skill: name, scenarios: [{ id: 's', prompt: 'p', assertions: [] }] }),
        );
    }
}

function mkProfile(id: string, skillsHint: string[]): void {
    const doc = [
        'profile:',
        `  id: ${id}`,
        '  defaults:',
        '    skills_hint:',
        ...skillsHint.map((s) => `      - ${s}`),
    ].join('\n');
    fs.writeFileSync(path.join(profilesDir, `${id}.yml`), doc + '\n');
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-'));
    skillsDir = path.join(tmp, 'skills');
    profilesDir = path.join(tmp, 'profiles');
    floorPath = path.join(tmp, 'floor.json');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(profilesDir, { recursive: true });
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

const opts = () => ({
    skillsDir,
    profilesDir,
    floorPath,
    exemptionsPath: path.join(tmp, 'exemptions.json'),
});

function writeExemptions(exemptions: Record<string, string>): void {
    fs.writeFileSync(
        path.join(tmp, 'exemptions.json'),
        JSON.stringify({ exemptions }),
    );
}

describe('computeCoverage', () => {
    it('counts overall + per-tier from source-derived tier sets', () => {
        mkSkill('rich-covered', { rich: true, covered: true });
        mkSkill('rich-bare', { rich: true });
        mkSkill('analysis-skill-router', { covered: true }); // router, covered
        mkSkill('command-routing'); // router, uncovered
        mkSkill('surface-a', { covered: true });
        mkSkill('surface-b');
        mkSkill('tail-x'); // not in any priority tier
        mkProfile('p1', ['surface-a', 'surface-b']);

        const r = computeCoverage(opts());
        expect(r.overall).toMatchObject({ covered: 3, total: 7 });
        expect(r.tiers.rich).toMatchObject({ covered: 1, total: 2 });
        expect(r.tiers['default-surface']).toMatchObject({ covered: 1, total: 2 });
        expect(r.tiers.router).toMatchObject({ covered: 1, total: 2 });
        // priority = rich ∪ default-surface ∪ router (dedup): 6 skills, 3 covered
        expect(r.tiers.priority).toMatchObject({ covered: 3, total: 6 });
        // other = everything not priority: just tail-x
        expect(r.tiers.other).toMatchObject({ covered: 0, total: 1 });
        expect(r.tiers.rich.uncovered).toEqual(['rich-bare']);
    });

    it('a profile skills_hint entry that is not a real skill is not counted', () => {
        mkSkill('real-one', { covered: true });
        mkProfile('p1', ['real-one', 'ghost-skill']);
        const r = computeCoverage(opts());
        expect(r.tiers['default-surface']).toMatchObject({ covered: 1, total: 1 });
    });
});

describe('ratchet — writeFloor + checkRatchet', () => {
    it('passes at the pinned floor and fails on a decrease', () => {
        mkSkill('a', { covered: true });
        mkSkill('b', { covered: true });
        writeFloor(opts());
        expect(checkRatchet(opts()).ok).toBe(true);

        // remove one eval → coverage drops below floor
        fs.rmSync(path.join(skillsDir, 'b', 'evals'), { recursive: true, force: true });
        const res = checkRatchet(opts());
        expect(res.ok).toBe(false);
        expect(res.regressions.some((r) => r.includes('overall'))).toBe(true);
    });

    it('missing floor file is an all-zero floor (bootstrap-inert)', () => {
        mkSkill('a', { covered: true });
        expect(checkRatchet(opts()).ok).toBe(true); // no floor file yet
    });

    it('a per-tier decrease is caught even when overall holds', () => {
        mkSkill('rich-covered', { rich: true, covered: true });
        mkSkill('plain-covered', { covered: true });
        writeFloor(opts());
        // swap coverage: drop the rich eval, add nothing elsewhere → rich tier drops
        fs.rmSync(path.join(skillsDir, 'rich-covered', 'evals'), { recursive: true, force: true });
        const res = checkRatchet(opts());
        expect(res.ok).toBe(false);
        expect(res.regressions.some((r) => r.includes("tier 'rich'"))).toBe(true);
    });
});

describe('tier floor — checkTierFloor', () => {
    it('fails when a priority-tier skill has no evals and no exemption', () => {
        mkSkill('routing-skill', { covered: false });
        mkProfile('dev', ['routing-skill']);
        const r = checkTierFloor(opts());
        expect(r.ok).toBe(false);
        expect(r.violations.join('\n')).toContain("'routing-skill'");
    });

    it('passes when the uncovered priority skill is exempted with a reason', () => {
        mkSkill('routing-skill', { covered: false });
        mkProfile('dev', ['routing-skill']);
        writeExemptions({ 'routing-skill': 'fixture-only skill; eval pending harness support' });
        const r = checkTierFloor(opts());
        expect(r.ok).toBe(true);
        expect(r.stale).toEqual([]);
    });

    it('an empty-string reason does not count as an exemption', () => {
        mkSkill('routing-skill', { covered: false });
        mkProfile('dev', ['routing-skill']);
        writeExemptions({ 'routing-skill': '  ' });
        expect(checkTierFloor(opts()).ok).toBe(false);
    });

    it('reports a stale exemption when the skill is now covered', () => {
        mkSkill('routing-skill', { covered: true });
        mkProfile('dev', ['routing-skill']);
        writeExemptions({ 'routing-skill': 'was uncovered once' });
        const r = checkTierFloor(opts());
        expect(r.ok).toBe(true);
        expect(r.stale.join('\n')).toContain("'routing-skill'");
    });

    it('non-priority (other-tier) skills are exempt from the floor', () => {
        mkSkill('niche-skill', { covered: false });
        mkProfile('dev', []);
        expect(checkTierFloor(opts()).ok).toBe(true);
    });
});
