// Tests for src/scripts/lint_eval_freshness.ts (py2ts — ADR-200).
//
// Two layers:
//  1. Unit tests over the exported `check()` on a sandboxed SKILLS_DIR
//     (via _setSkillsDirForTest), covering every in-scope / out-of-scope /
//     missing / stale branch.
//  2. Golden parity: python3 lint_eval_freshness.py vs tsx
//     lint_eval_freshness.ts, both pointed at the SAME tmp SKILLS_DIR (Python
//     via an importlib wrapper that monkeypatches SKILLS_DIR; TS via the
//     _setSkillsDirForTest seam), asserting byte-identical stdout/stderr +
//     exit across clean / missing-last_eval / stale-sha / unreadable-manifest /
//     out-of-scope corpora, plus --quiet and the argparse usage/error paths.
//     Skipped without python3.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { check, _setSkillsDirForTest } from '../../src/scripts/lint_eval_freshness.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');


// --- helpers to build a sandbox skills tree --------------------------------

interface SkillSpec {
    triggers?: boolean; // ships evals/triggers.json
    manifest?: unknown | 'invalid' | 'absent'; // data/manifest.json content
}

function mkSkills(root: string, skills: Record<string, SkillSpec>): void {
    for (const [name, spec] of Object.entries(skills)) {
        const dir = path.join(root, name);
        fs.mkdirSync(dir, { recursive: true });
        if (spec.triggers) {
            fs.mkdirSync(path.join(dir, 'evals'), { recursive: true });
            fs.writeFileSync(path.join(dir, 'evals', 'triggers.json'), '{}', 'utf-8');
        }
        if (spec.manifest === 'absent' || spec.manifest === undefined) {
            continue;
        }
        fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
        const mp = path.join(dir, 'data', 'manifest.json');
        if (spec.manifest === 'invalid') {
            fs.writeFileSync(mp, '{ not json', 'utf-8');
        } else {
            fs.writeFileSync(mp, JSON.stringify(spec.manifest), 'utf-8');
        }
    }
}

// --- Unit: check() ----------------------------------------------------------

describe('lint_eval_freshness — check()', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(REPO_ROOT, 'lef-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
        _setSkillsDirForTest(path.join(REPO_ROOT, 'src', 'skills'));
    });

    it('current last_eval → no error', () => {
        mkSkills(tmp, {
            alpha: {
                triggers: true,
                manifest: { upstream: { sha: 'abc', last_eval: { sha_at_eval: 'abc' } } },
            },
        });
        _setSkillsDirForTest(tmp);
        expect(check()).toEqual([]);
    });

    it('missing last_eval → one error', () => {
        mkSkills(tmp, {
            beta: { triggers: true, manifest: { upstream: { sha: 'abc' } } },
        });
        _setSkillsDirForTest(tmp);
        const errs = check();
        expect(errs.length).toBe(1);
        expect(errs[0]!.startsWith('beta: ships evals/triggers.json')).toBe(true);
    });

    it('stale sha_at_eval → one error citing both shas', () => {
        mkSkills(tmp, {
            gamma: {
                triggers: true,
                manifest: { upstream: { sha: 'newsha', last_eval: { sha_at_eval: 'oldsha' } } },
            },
        });
        _setSkillsDirForTest(tmp);
        const errs = check();
        expect(errs.length).toBe(1);
        expect(errs[0]).toContain("('oldsha')");
        expect(errs[0]).toContain("('newsha')");
    });

    it('no triggers.json → out of scope (skipped)', () => {
        mkSkills(tmp, {
            delta: { triggers: false, manifest: { upstream: { sha: 'abc' } } },
        });
        _setSkillsDirForTest(tmp);
        expect(check()).toEqual([]);
    });

    it('upstream: null / no sha → out of scope (skipped)', () => {
        mkSkills(tmp, {
            eps: { triggers: true, manifest: { upstream: null } },
            zeta: { triggers: true, manifest: { upstream: { sha: '' } } },
        });
        _setSkillsDirForTest(tmp);
        expect(check()).toEqual([]);
    });

    it('invalid JSON manifest → unreadable error', () => {
        mkSkills(tmp, { theta: { triggers: true, manifest: 'invalid' } });
        _setSkillsDirForTest(tmp);
        const errs = check();
        expect(errs).toEqual(['theta: manifest.json is unreadable / invalid JSON']);
    });

    it('missing SKILLS_DIR → empty', () => {
        _setSkillsDirForTest(path.join(tmp, 'nope'));
        expect(check()).toEqual([]);
    });
});

// --- Golden parity (python3 vs tsx) ----------------------------------------



