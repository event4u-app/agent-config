// Tests for src/scripts/_lib/skill_estate.ts — the two dimensions
// `check_estate_count` ratchets over the skill corpus.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    SKILLS_POSIX,
    descriptionOf,
    isDeprecated,
    measureSkillEstate,
} from '../../src/scripts/_lib/skill_estate';

const REPO = path.resolve(__dirname, '..', '..');

let root: string;

function writeSkill(name: string, frontmatter: string): void {
    const dir = path.join(root, ...SKILLS_POSIX.split('/'), name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\n${frontmatter}\n---\n\n# ${name}\n`);
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'skest-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('the corpus is counted from SKILL.md, one per directory', () => {
    it('counts maintained skills and their description tokens', () => {
        writeSkill('alpha', 'name: alpha\ndescription: Does the alpha thing.');
        writeSkill('beta', 'name: beta\ndescription: Does the beta thing.');
        const e = measureSkillEstate(root);
        expect(e.skill_count).toBe(2);
        expect(e.skill_description_tokens).toBeGreaterThan(0);
        expect(e.deprecated_count).toBe(0);
    });

    it('a directory with no SKILL.md is not a skill', () => {
        fs.mkdirSync(path.join(root, ...SKILLS_POSIX.split('/'), 'not-a-skill'), { recursive: true });
        expect(measureSkillEstate(root).skill_count).toBe(0);
    });

    it('an absent corpus reads zero and null rather than throwing', () => {
        // The base-ref case: a tag with no src/skills. The verdict must be able
        // to DROP the metric, which needs a reading it can recognise as absent.
        const e = measureSkillEstate(root);
        expect(e.skill_count).toBe(0);
        expect(e.skill_description_tokens).toBeNull();
    });
});

describe('deprecated skills are excluded — the headroom property', () => {
    it('a deprecated skill leaves the count and the token total', () => {
        writeSkill('alpha', 'name: alpha\ndescription: Does the alpha thing.');
        writeSkill('old', 'name: old\nlifecycle: deprecated\ndescription: A long retired description here.');
        const e = measureSkillEstate(root);
        expect(e.skill_count).toBe(1);
        expect(e.deprecated_count).toBe(1);
    });

    it('deprecating a skill LOWERS the count — otherwise retirement buys nothing', () => {
        // The load-bearing case. With deprecated skills counted, the retirement
        // mechanism the council chose (deprecate for one release, then delete)
        // would create no headroom against this gate and be unusable.
        writeSkill('alpha', 'name: alpha\ndescription: Does the alpha thing.');
        writeSkill('beta', 'name: beta\ndescription: Does the beta thing.');
        const before = measureSkillEstate(root);
        writeSkill('beta', 'name: beta\nlifecycle: deprecated\ndescription: Does the beta thing.');
        const after = measureSkillEstate(root);
        expect(after.skill_count).toBe(before.skill_count - 1);
        expect(after.skill_description_tokens!).toBeLessThan(before.skill_description_tokens!);
    });

    it('recognises the quoted form and rejects a near-miss', () => {
        expect(isDeprecated('---\nlifecycle: deprecated\n---\n')).toBe(true);
        expect(isDeprecated('---\nlifecycle: "deprecated"\n---\n')).toBe(true);
        expect(isDeprecated('---\nlifecycle: archived\n---\n')).toBe(false);
        // `deprecated_in` is a different key with a different meaning; matching
        // it would silently drop skills from the count.
        expect(isDeprecated('---\ndeprecated_in: 15.0.0\n---\n')).toBe(false);
        expect(isDeprecated('no frontmatter at all')).toBe(false);
    });
});

describe('the token dimension is independent of the count', () => {
    it('a longer description grows tokens with the count unchanged', () => {
        // codex seat's anti-gaming case: merging or padding moves one dimension
        // and not the other, which is why the gate carries both.
        writeSkill('alpha', 'name: alpha\ndescription: Short.');
        const before = measureSkillEstate(root);
        writeSkill(
            'alpha',
            'name: alpha\ndescription: A considerably longer description with many more words in it than before.',
        );
        const after = measureSkillEstate(root);
        expect(after.skill_count).toBe(before.skill_count);
        expect(after.skill_description_tokens!).toBeGreaterThan(before.skill_description_tokens!);
    });

    it('descriptionOf reads the frontmatter field and unquotes it', () => {
        expect(descriptionOf('---\ndescription: plain text here\n---\nbody')).toBe('plain text here');
        expect(descriptionOf('---\ndescription: "quoted text"\n---\n')).toBe('quoted text');
        expect(descriptionOf('---\nname: x\n---\n')).toBe('');
        // A `description:` in the BODY is not the frontmatter field.
        expect(descriptionOf('---\nname: x\n---\ndescription: not this one\n')).toBe('');
    });
});

describe('the live corpus', () => {
    it('reads 299 maintained skills and an exact token total', () => {
        // Pinned so a later reader can tell movement from a re-derivation. If
        // this fails after a legitimate change, the gate has already said so.
        //
        // 11461 -> 11455 on 2026-08-27: this branch shortened the
        // `test-driven-development` and `testing-anti-patterns` descriptions to
        // fit the standing-payload ceiling and to add the sibling-routing
        // clauses a description cluster requires. Six tokens, in the direction
        // the ceiling wants — a re-derivation of the pin after a decided
        // change, which is what the comment above describes.
        //
        // 11455 -> 11445 on 2026-09-04: `conventional-commits-writing` gained a
        // house-convention procedure, and its description was rewritten to name
        // that (187 -> 166 chars) rather than grown. Ten tokens, again in the
        // direction the ceiling wants — the preamble sat 10 tokens under its
        // grace ceiling at the time, which is why the body carries the
        // capability and the description paid part of it back.
        const e = measureSkillEstate(REPO);
        expect(e.skill_count).toBe(299);
        expect(e.skill_description_tokens).toBe(11445);
        expect(e.deprecated_count).toBe(0);
    });

    it('the tokeniser resolves here, so the metric is exact and not a proxy', () => {
        expect(measureSkillEstate(REPO).skill_description_tokens).not.toBeNull();
    });
});
