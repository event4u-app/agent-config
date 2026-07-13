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
