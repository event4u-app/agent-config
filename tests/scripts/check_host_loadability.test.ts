import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { expect, test } from 'vitest';

import { run } from '../../src/scripts/check_host_loadability.js';

function mk(root: string, rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

test('clean projection passes; malformed projection is caught (U4 verify criterion)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'u4-'));
    mk(root, '.claude/skills/good-skill/SKILL.md', '---\nname: good-skill\ndescription: fine\n---\nbody\n');
    mk(root, '.cursor/rules/good.mdc', '---\ndescription: ok\nglobs: "src/**"\n---\nbody\n');
    expect(run(root)).toEqual([]);

    // deliberately-malformed: name/dir mismatch + broken YAML
    mk(root, '.claude/skills/bad-skill/SKILL.md', '---\nname: other-name\ndescription: x\n---\nbody\n');
    mk(root, '.cursor/rules/broken.mdc', '---\ndescription: [unclosed\n---\nbody\n');
    const errors = run(root);
    expect(errors.some((e) => e.includes("name 'other-name' != dir 'bad-skill'"))).toBe(true);
    expect(errors.some((e) => e.includes('broken.mdc'))).toBe(true);
});

// Loadability and completeness are different questions. Until 2026-08-06 only
// the first was asked: deleting `.claude/skills/laravel` left this gate AND
// check_condensation green, so a skill that never projected was
// indistinguishable from one that does not exist. The host simply never saw it.
test('an authored skill that never reached the Claude tree is a failure, not a silent absence', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'u4-complete-'));
    // Two authored skills; only one is projected.
    mk(root, 'src/skills/arrives/SKILL.md', '---\nname: arrives\ndescription: x\n---\nbody\n');
    mk(root, 'src/skills/vanishes/SKILL.md', '---\nname: vanishes\ndescription: x\n---\nbody\n');
    mk(root, '.claude/skills/arrives/SKILL.md', '---\nname: arrives\ndescription: x\n---\nbody\n');

    const errors = run(root);
    expect(errors.some((e) => e.includes('vanishes'))).toBe(true);
    // The one that DID arrive must not be reported — a gate that names
    // everything teaches the reader to skim past the real entry.
    expect(errors.some((e) => e.includes('arrives'))).toBe(false);
});

test('a complete projection passes, and a domain-projected skill is not mistaken for missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'u4-complete-ok-'));
    mk(root, 'src/skills/authored/SKILL.md', '---\nname: authored\ndescription: x\n---\nbody\n');
    mk(root, '.claude/skills/authored/SKILL.md', '---\nname: authored\ndescription: x\n---\nbody\n');
    // Projected from a domain command whose directory name differs — extra in
    // the host tree, sourced nowhere under src/skills, and legitimately so.
    mk(root, '.claude/skills/git-commit/SKILL.md', '---\nname: git-commit\ndescription: x\n---\nbody\n');

    expect(run(root)).toEqual([]);
});

test('no authored tree yet — an ungenerated projection is not an incomplete one', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'u4-nogen-'));
    mk(root, 'src/skills/authored/SKILL.md', '---\nname: authored\ndescription: x\n---\nbody\n');
    mk(root, '.cursor/rules/ok.mdc', '---\ndescription: ok\n---\nbody\n');
    // .claude/skills absent entirely: a fresh checkout, nothing to compare.
    expect(run(root)).toEqual([]);
});
