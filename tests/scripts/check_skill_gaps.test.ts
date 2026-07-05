/**
 * Tests for B6 `check_skill_gaps` (the honest-null gaps pointer-integrity lock)
 * + the real check-refs gap wired into the repo.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { collectSkillGaps, findBrokenPointers } from '../../src/scripts/check_skill_gaps.js';

const _tmp: string[] = [];
afterEach(() => {
    for (const d of _tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function _skillsDir(skills: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-'));
    _tmp.push(dir);
    for (const [name, fm] of Object.entries(skills)) {
        fs.mkdirSync(path.join(dir, name), { recursive: true });
        fs.writeFileSync(path.join(dir, name, 'SKILL.md'), `---\n${fm}\n---\n\n# ${name}\n`, 'utf-8');
    }
    return dir;
}

describe('check_skill_gaps', () => {
    it('the real check-refs skill has a gap whose witness pointer resolves', () => {
        const entries = collectSkillGaps(); // real src/skills
        const cr = entries.find((e) => e.skill === 'check-refs');
        expect(cr, 'check-refs should declare a gap').toBeTruthy();
        expect(findBrokenPointers(entries)).toEqual([]);
    });

    it('skips skills without gaps', () => {
        const dir = _skillsDir({ plain: 'name: plain\ndescription: x' });
        expect(collectSkillGaps(dir)).toEqual([]);
    });

    it('collects a gaps array', () => {
        const dir = _skillsDir({
            demo: 'name: demo\ngaps:\n  - description: "does not X"\n    witness: tests/scripts/check_skill_gaps.test.ts',
        });
        const e = collectSkillGaps(dir);
        expect(e.length).toBe(1);
        expect(e[0]!.gaps[0]!.description).toBe('does not X');
    });

    it('flags a witness pointer that does not exist', () => {
        const dir = _skillsDir({
            demo: 'name: demo\ngaps:\n  - description: "does not X"\n    witness: tests/scripts/__nope__.test.ts',
        });
        const errs = findBrokenPointers(collectSkillGaps(dir));
        expect(errs.some((e) => e.includes('witness not found'))).toBe(true);
    });

    it('flags a gap missing its description', () => {
        const dir = _skillsDir({
            demo: 'name: demo\ngaps:\n  - witness: tests/scripts/check_skill_gaps.test.ts',
        });
        const errs = findBrokenPointers(collectSkillGaps(dir));
        expect(errs.some((e) => e.includes('missing/empty description'))).toBe(true);
    });
});
