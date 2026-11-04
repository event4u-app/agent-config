// road-to-a-noted-that-is-a-write 2.2 — five layouts for the AGENTS.md shadow detector.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { detectAgentsMdShadow } from '../../src/scripts/agents_md_shadow.js';

let root: string;
beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'shadow-')));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function write(rel: string, text: string): void {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text, 'utf-8');
}

describe('detectAgentsMdShadow', () => {
    it('layout 1 — no AGENTS.md, or an empty one: nothing to shadow', () => {
        write('CLAUDE.md', '# project rules\n');
        expect(detectAgentsMdShadow(root)).toEqual([]);
        write('AGENTS.md', '  \n');
        expect(detectAgentsMdShadow(root)).toEqual([]);
    });

    it('layout 2 — CLAUDE.md imports AGENTS.md', () => {
        write('AGENTS.md', '# conventions\nTabs.\n');
        write('CLAUDE.md', '# Claude\n\n@AGENTS.md\n');
        expect(detectAgentsMdShadow(root)).toEqual([]);
    });

    it('layout 3 — CLAUDE.md is a symlink to AGENTS.md', () => {
        write('AGENTS.md', '# conventions\n');
        fs.symlinkSync('AGENTS.md', path.join(root, 'CLAUDE.md'));
        expect(detectAgentsMdShadow(root)).toEqual([]);
    });

    it('layout 4 — CLAUDE.md with its own content and no import is a shadow', () => {
        write('AGENTS.md', '# conventions\n');
        write('CLAUDE.md', '# Claude only\nSee AGENTS.md for more.\n');
        expect(detectAgentsMdShadow(root).map((f) => f.file)).toEqual(['CLAUDE.md']);
    });

    it('layout 5 — .claude/CLAUDE.md imports with a relative path; CLAUDE.local.md does not', () => {
        write('AGENTS.md', '# conventions\n');
        write('.claude/CLAUDE.md', '@../AGENTS.md\n');
        write('CLAUDE.local.md', 'my personal notes\n');
        expect(detectAgentsMdShadow(root).map((f) => f.file)).toEqual(['CLAUDE.local.md']);
    });

    it('an email-like token is not an import', () => {
        write('AGENTS.md', '# conventions\n');
        write('CLAUDE.md', 'mail me at me@AGENTS.md.example\n');
        expect(detectAgentsMdShadow(root)).toHaveLength(1);
    });
});
