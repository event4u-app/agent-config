// Tests for src/scripts/check_skill_requires.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_check_skill_requires.py — the pytest
// `monkeypatch.setattr(mod, "_collect_skills"/"_load_pack_closure", ...)` maps
// to _set_hooks_for_test(). main() output is captured. Plus golden parity on
// the REAL REPO (skipped without python3).
import { afterEach, describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/check_skill_requires.js';
import type { SkillInfo } from '../../src/scripts/check_skill_requires.js';



function skill(
    packs: readonly string[] = [],
    requires: readonly string[] = [],
    p = 'skills/x/SKILL.md',
): SkillInfo {
    return { packs: new Set(packs), requires_skills: [...requires], path: p };
}

function drive(
    skills: Record<string, SkillInfo>,
    closure: Record<string, Set<string>> = {},
): { rc: number; out: string } {
    const out: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as { write: unknown }).write = (s: string): boolean => {
        out.push(String(s));
        return true;
    };
    let rc: number;
    try {
        mod._set_hooks_for_test({
            collect_skills: () => skills,
            load_pack_closure: () => closure,
        });
        rc = mod.main();
    } finally {
        process.stdout.write = orig;
        mod._set_hooks_for_test({
            collect_skills: mod._collect_skills,
            load_pack_closure: mod._load_pack_closure,
        });
    }
    return { rc, out: out.join('') };
}

describe('check_skill_requires — co-availability gate (ported pytest)', () => {
    afterEach(() => {
        mod._set_hooks_for_test({
            collect_skills: mod._collect_skills,
            load_pack_closure: mod._load_pack_closure,
        });
    });

    it('accepts resolved always-on edges', () => {
        const skills = {
            parent: skill([], ['child'], 'skills/parent/SKILL.md'),
            child: skill(),
        };
        const { rc, out } = drive(skills);
        expect(rc).toBe(0);
        expect(out).toContain('all sub-skills co-available');
    });

    it('accepts same-pack edge', () => {
        const skills = {
            parent: skill(['pack-x'], ['child'], 'skills/parent/SKILL.md'),
            child: skill(['pack-x']),
        };
        const { rc } = drive(skills, { 'pack-x': new Set(['pack-x']) });
        expect(rc).toBe(0);
    });

    it('rejects missing skill and names it', () => {
        const skills = { parent: skill([], ['ghost'], 'skills/parent/SKILL.md') };
        const { rc, out } = drive(skills);
        expect(rc).toBe(1);
        expect(out).toContain('ghost');
        expect(out).toContain('unknown skill');
    });

    it('no requires_skills is clean', () => {
        const skills = {
            lonely: skill([], [], 'skills/lonely/SKILL.md'),
            also: skill(['pack-y'], [], 'skills/also/SKILL.md'),
        };
        const { rc } = drive(skills, { 'pack-y': new Set(['pack-y']) });
        expect(rc).toBe(0);
    });

    it('rejects always-on parent requiring pack-gated sub', () => {
        const skills = {
            parent: skill([], ['child'], 'skills/parent/SKILL.md'),
            child: skill(['pack-z']),
        };
        const { rc, out } = drive(skills, { 'pack-z': new Set(['pack-z']) });
        expect(rc).toBe(1);
        expect(out).toContain('pack-gated');
    });
});


// road-to-skills-that-arrive-when-called 6.4 — one field, one type. A `skills:`
// list on a skill or command names skills; a RULE name there is a type error the
// schema's slug pattern cannot see.
describe('check_skill_requires — skills: carries skills, never rules (6.4)', () => {
    const skills = new Set(['threat-modeling', 'authz-review']);
    const rules = new Set(['security-sensitive-stop', 'reviewer-awareness']);

    it('rejects a seeded rule name and names the file and the rule', () => {
        const errs = mod.skills_field_type_errors(
            [{ path: 'src/domains/p/c/command.md', names: ['threat-modeling', 'security-sensitive-stop'] }],
            skills,
            rules,
        );
        expect(errs).toHaveLength(1);
        expect(errs[0]).toContain('src/domains/p/c/command.md');
        expect(errs[0]).toContain("'security-sensitive-stop'");
        expect(errs[0]).toContain('rule');
    });

    it('accepts a seeded skill name', () => {
        expect(
            mod.skills_field_type_errors([{ path: 'skills/x/SKILL.md', names: ['authz-review'] }], skills, rules),
        ).toEqual([]);
    });

    it('main() exits non-zero on a seeded rule name and zero once it is a skill', () => {
        const base = { collect_skills: () => ({ only: skill() }), load_pack_closure: () => ({}) };
        const out: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        (process.stdout as { write: unknown }).write = (s: string): boolean => (out.push(String(s)), true);
        let bad: number;
        let good: number;
        try {
            mod._set_hooks_for_test({
                ...base,
                collect_skills_field: () => ({
                    refs: [{ path: 'a/command.md', names: ['reviewer-awareness'] }],
                    skills,
                    rules,
                }),
            });
            bad = mod.main();
            mod._set_hooks_for_test({
                collect_skills_field: () => ({
                    refs: [{ path: 'a/command.md', names: ['threat-modeling'] }],
                    skills,
                    rules,
                }),
            });
            good = mod.main();
        } finally {
            process.stdout.write = orig;
            mod._set_hooks_for_test({
                collect_skills: mod._collect_skills,
                load_pack_closure: mod._load_pack_closure,
                collect_skills_field: mod._collect_skills_field,
            });
        }
        expect(bad).toBe(1);
        expect(out.join('')).toContain("'reviewer-awareness'");
        expect(good).toBe(0);
    });

    it('the source tree carries no rule name in any skills: list', () => {
        const { refs, skills: s, rules: r } = mod._collect_skills_field();
        expect(refs.length).toBeGreaterThan(50);
        expect(mod.skills_field_type_errors(refs, s, r)).toEqual([]);
    });
});
