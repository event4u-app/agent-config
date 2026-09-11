// The safety regression `docs/contracts/install-scopes.md` cites.
//
// It cited `tests/test_cleanup_other_scope.py` until 2026-09-05, when a
// contract review established that the file existed under no extension and that
// nothing else in the tree covered the cleanup path. The citation was removed
// rather than repointed — repointing at a neighbouring test would have claimed
// coverage that was not there — and restoring it became the named precondition
// on that contract's beta window. This is the restoration.
//
// It runs the REAL script against a throwaway root. A mocked filesystem would
// prove nothing here: the whole question is what `rm -rf` reaches, and the
// contract's promise is about paths, not about a function's arguments.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'cleanup_other_scope.sh');

/** Everything the script may remove, plus everything it promises never to. */
const REMOVABLE = [
    '.claude/skills/a.md',
    '.claude/rules/b.md',
    '.claude-plugin/marketplace.json',
    '.augment/c.md',
    '.cursor/rules/d.mdc',
    '.clinerules/e.md',
    '.windsurf/rules/f.md',
    '.windsurfrules',
    '.github/copilot-instructions.md',
];
const PROTECTED = [
    '.agent-settings.yml',
    'agents/roadmaps/keep-me.md',
    'src/scripts/mine.ts',
    'README.md',
    '.claude/settings.json',
];

let root: string;

function seed(): void {
    for (const rel of [...REMOVABLE, ...PROTECTED]) {
        const p = path.join(root, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, 'x');
    }
}

function run(...args: string[]): string {
    return execFileSync('bash', [SCRIPT, '--project', root, ...args], {
        encoding: 'utf-8',
        // HOME is redirected so a bug in the scope resolution destroys a temp
        // directory rather than the machine running the suite.
        env: { ...process.env, HOME: path.join(root, 'fake-home') },
    });
}

function exists(rel: string): boolean {
    return fs.existsSync(path.join(root, rel));
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-scope-'));
    fs.mkdirSync(path.join(root, 'fake-home'), { recursive: true });
    seed();
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('cleanup_other_scope — it deletes nothing without --confirm', () => {
    it('a bare run removes nothing at all', () => {
        const out = run();
        expect(out).toContain('DRY RUN');
        for (const rel of [...REMOVABLE, ...PROTECTED]) {
            expect(exists(rel), rel).toBe(true);
        }
    });

    it('the dry run still NAMES what it would remove, or it is not a preview', () => {
        const out = run();
        expect(out).toContain('would remove');
        expect(out).toContain('.claude/skills');
    });
});

describe('cleanup_other_scope — what --confirm reaches, and what it never does', () => {
    it('removes every declared target', () => {
        run('--confirm');
        for (const rel of REMOVABLE) {
            expect(exists(rel), rel).toBe(false);
        }
    });

    // The contract's own promise, and the reason this file is a SAFETY
    // regression rather than a coverage nicety: settings the operator edited and
    // content the operator authored survive a full cleanup.
    it('never removes settings, authored content, or anything outside the declared set', () => {
        run('--confirm');
        for (const rel of PROTECTED) {
            expect(exists(rel), rel).toBe(true);
        }
    });

    it('leaves the scope root itself standing', () => {
        run('--confirm');
        expect(fs.existsSync(root)).toBe(true);
    });
});

describe('cleanup_other_scope — --tools narrows the blast radius', () => {
    it('touches only the selected tool', () => {
        run('--confirm', '--tools=claude-code');
        expect(exists('.claude/skills/a.md')).toBe(false);
        expect(exists('.claude/rules/b.md')).toBe(false);
        expect(exists('.augment/c.md')).toBe(true);
        expect(exists('.clinerules/e.md')).toBe(true);
        expect(exists('.github/copilot-instructions.md')).toBe(true);
    });

    it('refuses an empty selection rather than falling back to everything', () => {
        let code = 0;
        try {
            run('--confirm', '--tools=nothing-matches');
        } catch (e) {
            code = (e as { status?: number }).status ?? 1;
        }
        expect(code).not.toBe(0);
        for (const rel of REMOVABLE) {
            expect(exists(rel), rel).toBe(true);
        }
    });
});

describe('cleanup_other_scope — a bad scope root is refused, not guessed', () => {
    it('exits non-zero on a project root that does not exist', () => {
        let code = 0;
        try {
            execFileSync('bash', [SCRIPT, '--project', path.join(root, 'no-such-dir'), '--confirm'], {
                encoding: 'utf-8',
                env: { ...process.env, HOME: path.join(root, 'fake-home') },
            });
        } catch (e) {
            code = (e as { status?: number }).status ?? 1;
        }
        expect(code).not.toBe(0);
    });

    it('exits non-zero when --project is given no path', () => {
        let code = 0;
        try {
            execFileSync('bash', [SCRIPT, '--project', '--confirm'], {
                encoding: 'utf-8',
                env: { ...process.env, HOME: path.join(root, 'fake-home') },
            });
        } catch (e) {
            code = (e as { status?: number }).status ?? 1;
        }
        expect(code).not.toBe(0);
    });
});
