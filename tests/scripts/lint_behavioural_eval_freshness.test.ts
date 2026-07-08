/**
 * Behavioural-eval freshness lint (road-to-skill-eval-coverage Phase 3).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    checkFreshness,
    skillBodySha,
    _setSkillsDirForTest,
} from '../../src/scripts/lint_behavioural_eval_freshness.js';

let tmp = '';

function bodyShaOf(body: string): string {
    // mirror _splitBody: no frontmatter here, just trailing-ws trim
    return crypto.createHash('sha256').update(body.replace(/\s+$/, ''), 'utf-8').digest('hex');
}

function mkSkill(name: string, body: string, evals: Record<string, unknown> | null): void {
    const dir = path.join(tmp, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\n---\n\n${body}\n`);
    if (evals) {
        fs.mkdirSync(path.join(dir, 'evals'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'evals', 'evals.json'), JSON.stringify(evals));
    }
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bef-'));
    _setSkillsDirForTest(tmp);
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('skillBodySha', () => {
    it('hashes the post-frontmatter body, ignoring the frontmatter block', () => {
        const a = skillBodySha('---\nname: x\n---\n\n# Title\n\nBody.\n');
        const b = skillBodySha('---\nname: DIFFERENT\ndescription: q\n---\n\n# Title\n\nBody.\n');
        expect(a).toBe(b); // frontmatter changes do not move the body sha
    });
});

describe('checkFreshness', () => {
    it('unpinned eval → out of scope, clean', () => {
        mkSkill('alpha', '# A\n\nbody', { skill: 'alpha', scenarios: [] });
        const r = checkFreshness();
        expect(r.ok).toBe(true);
        expect(r.inScope).toBe(0);
    });

    it('pinned + current sha → in scope, clean', () => {
        const body = '# A\n\nbody';
        mkSkill('beta', body, {
            skill: 'beta',
            skill_body_sha: bodyShaOf(`# A\n\nbody`),
            scenarios: [],
        });
        const r = checkFreshness();
        expect(r.ok).toBe(true);
        expect(r.inScope).toBe(1);
    });

    it('pinned + stale sha → flagged', () => {
        mkSkill('gamma', '# NEW BODY\n\nchanged', {
            skill: 'gamma',
            skill_body_sha: 'a'.repeat(64), // does not match current body
            scenarios: [],
        });
        const r = checkFreshness();
        expect(r.ok).toBe(false);
        expect(r.stale[0]!.skill).toBe('gamma');
    });

    it('skill without evals.json is ignored', () => {
        mkSkill('delta', '# D\n\nb', null);
        expect(checkFreshness().inScope).toBe(0);
    });
});
