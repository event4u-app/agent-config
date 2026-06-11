// Tests for src/scripts/check_skill_requires.ts (py2ts Phase 4 / Wave 4c).
//
// 1:1 port of tests/test_check_skill_requires.py — the pytest
// `monkeypatch.setattr(mod, "_collect_skills"/"_load_pack_closure", ...)` maps
// to _set_hooks_for_test(). main() output is captured. Plus golden parity on
// the REAL REPO (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/check_skill_requires.js';
import type { SkillInfo } from '../../src/scripts/check_skill_requires.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_skill_requires.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_skill_requires.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

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

const py3 = hasPython3();

describe.skipIf(!py3)('check_skill_requires — golden parity (python3 vs tsx)', () => {
    it('matches byte-for-byte on the real repo', () => {
        const py = spawnSync('python3', [PY_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
