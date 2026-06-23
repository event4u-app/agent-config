
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    PreviewError,
    load_preview,
    render_plain,
    render_technical,
    _setSkillsDirForTest,
    _getSkillsDirForTest,
} from '../../src/scripts/skill_preview.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'skill_preview.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const MANUAL_SKILL = `---
name: fixture-manual
description: A manual fixture skill.
domain: quality
---

# fixture-manual

## Steps

### 1. Look at the thing
Do the looking.

### 2. Report findings
Write them down.
`;

const ASSISTED_SKILL = `---
name: fixture-assisted
description: An assisted fixture skill.
domain: process
execution:
  type: assisted
  handler: shell
  allowed_tools: [file-editor, shell-runner]
  command:
    - python3
    - src/scripts/do_thing.py
---

# fixture-assisted

## Steps

### 1. Propose the change
Run \`python3 src/scripts/do_thing.py\` against \`config/thing.yml\`.
`;

const MALFORMED_NO_FM = '# no frontmatter here\n\njust prose.\n';
const MALFORMED_BAD_YAML = '---\nname: [unclosed\n---\n# body\n';

function writeSkill(root: string, name: string, content: string): void {
    const d = path.join(root, name);
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'SKILL.md'), content, 'utf-8');
}

describe('skill_preview — in-process (ported from test_skill_preview.py)', () => {
    let tmp: string;
    let prevDir: string;
    beforeEach(() => {
        prevDir = _getSkillsDirForTest();
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skillprev-'));
        const root = path.join(tmp, 'skills');
        fs.mkdirSync(root);
        writeSkill(root, 'fixture-manual', MANUAL_SKILL);
        writeSkill(root, 'fixture-assisted', ASSISTED_SKILL);
        writeSkill(root, 'fixture-no-fm', MALFORMED_NO_FM);
        writeSkill(root, 'fixture-bad-yaml', MALFORMED_BAD_YAML);
        _setSkillsDirForTest(root);
    });
    afterEach(() => {
        _setSkillsDirForTest(prevDir);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('manual skill is instructional only', () => {
        const p = load_preview('fixture-manual');
        expect(p.execution_type).toBe('manual');
        const out = render_plain(p);
        expect(out.toLowerCase()).toContain('instructional only');
        expect(out).toContain('Look at the thing');
        expect(out).toContain('Report findings');
    });

    it('assisted skill renders proposed actions', () => {
        const p = load_preview('fixture-assisted');
        expect(p.execution_type).toBe('assisted');
        const out = render_plain(p);
        expect(out.toLowerCase()).toContain('propose');
        expect(out).toContain('src/scripts/do_thing.py');
    });

    it('allowed_tools are listed', () => {
        const p = load_preview('fixture-assisted');
        expect(p.allowed_tools).toEqual(['file-editor', 'shell-runner']);
        const out = render_plain(p);
        expect(out).toContain('file-editor');
        expect(out).toContain('shell-runner');
    });

    it('body targets are extracted', () => {
        const p = load_preview('fixture-assisted');
        expect(p.commands_named.some((c) => c.includes('do_thing.py'))).toBe(true);
        expect(p.paths_named.some((f) => f.includes('thing.yml'))).toBe(true);
    });

    it('missing skill raises PreviewError', () => {
        expect(() => load_preview('does-not-exist')).toThrow(PreviewError);
    });

    it('malformed no-frontmatter raises', () => {
        expect(() => load_preview('fixture-no-fm')).toThrow(PreviewError);
    });

    it('malformed bad-yaml raises', () => {
        expect(() => load_preview('fixture-bad-yaml')).toThrow(PreviewError);
    });

    it('technical render has step list', () => {
        const p = load_preview('fixture-manual');
        const tech = render_technical(p);
        expect(tech).toContain('Declared steps');
        expect(tech).toContain('1. Look at the thing');
    });
});
