/**
 * Domain-soundness validation status + ratchet
 * (road-to-domain-soundness Phase 1 + Phase 3).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    checkRatchet,
    computeStatus,
    validationSet,
    writeFloor,
} from '../../src/scripts/domain_soundness_status.js';

let tmp = '';
let skillsDir = '';
let profilesDir = '';
let floorPath = '';

function mkSkill(name: string, opts: { validated?: boolean } = {}): void {
    const dir = path.join(skillsDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\n---\n\n# ${name}\n`);
    if (opts.validated) {
        fs.mkdirSync(path.join(dir, 'evals'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'evals', 'domain-truth.json'),
            JSON.stringify({ skill: name, domain: 'finance', cases: [] }),
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
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-'));
    skillsDir = path.join(tmp, 'skills');
    profilesDir = path.join(tmp, 'profiles');
    floorPath = path.join(tmp, 'floor.json');
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(profilesDir, { recursive: true });
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

const opts = () => ({ skillsDir, profilesDir, floorPath });

describe('validationSet', () => {
    it('is the union of the non-coding profiles skills_hint, restricted to real skills', () => {
        mkSkill('runway-cognition');
        mkSkill('dcf-modeling');
        mkSkill('threat-modeling');
        mkProfile('finance', ['runway-cognition', 'dcf-modeling', 'ghost-skill']);
        mkProfile('ops', ['threat-modeling']);
        mkProfile('developer', ['runway-cognition']); // coding profile — ignored
        const set = validationSet(opts());
        expect(set).toEqual(['dcf-modeling', 'runway-cognition', 'threat-modeling']);
    });
});

describe('computeStatus', () => {
    it('marks a skill validated iff it ships evals/domain-truth.json', () => {
        mkSkill('runway-cognition', { validated: true });
        mkSkill('dcf-modeling');
        mkProfile('finance', ['runway-cognition', 'dcf-modeling']);
        const r = computeStatus(opts());
        expect(r).toMatchObject({ validated: 1, unvalidated: 1, total: 2 });
        expect(r.validationSet.find((s) => s.skill === 'runway-cognition')?.status).toBe('validated');
    });
});

describe('ratchet', () => {
    it('passes at the floor, fails on a regression', () => {
        mkSkill('runway-cognition', { validated: true });
        mkProfile('finance', ['runway-cognition']);
        writeFloor(opts());
        expect(checkRatchet(opts()).ok).toBe(true);
        fs.rmSync(path.join(skillsDir, 'runway-cognition', 'evals'), { recursive: true, force: true });
        expect(checkRatchet(opts()).ok).toBe(false);
    });

    it('missing floor is all-zero (bootstrap-inert)', () => {
        mkSkill('dcf-modeling');
        mkProfile('finance', ['dcf-modeling']);
        expect(checkRatchet(opts()).ok).toBe(true);
    });
});
