/**
 * Flat-command → skill-wrapper re-projection for Claude Code
 * (council 2026-07-08, cc-user-command-discovery).
 *
 * Claude Code ≤ 2.1.204 does not register flat user-scope command files;
 * user-scope skills do. The installer projects tier-0/1 VISIBLE flat
 * commands as `skills/<name>/SKILL.md` wrappers and drops the flat file
 * (single source — no dupes once upstream fixes flat discovery).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _apply_claude_flat_command_wrappers } from '../../src/scripts/install.js';

let anchor: string;
let pkgRoot: string;

function writeManifest(commands: Array<{ slug: string; tier: number; visibility: string }>): void {
    mkdirSync(join(pkgRoot, 'dist', 'discovery'), { recursive: true });
    writeFileSync(
        join(pkgRoot, 'dist', 'discovery', 'discovery-manifest.json'),
        JSON.stringify({ artefacts: commands.map((c) => ({ category: 'command', ...c })) }),
    );
}

function writeCommand(slug: string, description = 'A test command.'): void {
    mkdirSync(join(anchor, 'commands'), { recursive: true });
    writeFileSync(
        join(anchor, 'commands', `${slug}.md`),
        `---\ndescription: ${description}\n---\n\nDo the ${slug} thing.\n`,
    );
}

beforeEach(() => {
    anchor = mkdtempSync(join(tmpdir(), 'cc-anchor-'));
    pkgRoot = mkdtempSync(join(tmpdir(), 'cc-pkg-'));
});
afterEach(() => {
    rmSync(anchor, { recursive: true, force: true });
    rmSync(pkgRoot, { recursive: true, force: true });
});

describe('_apply_claude_flat_command_wrappers', () => {
    it('wraps a tier-0 visible command as a skill and drops the flat file', () => {
        writeManifest([{ slug: 'optimize-project', tier: 0, visibility: 'public' }]);
        writeCommand('optimize-project');
        const current = new Set(['commands/optimize-project.md']);

        const res = _apply_claude_flat_command_wrappers(anchor, pkgRoot, current);

        expect(res.wrapped).toContain('optimize-project');
        const skill = readFileSync(join(anchor, 'skills', 'optimize-project', 'SKILL.md'), 'utf8');
        expect(skill).toContain('name: optimize-project');
        expect(skill).toContain('description: A test command.');
        expect(skill).toContain('Do the optimize-project thing.');
        expect(existsSync(join(anchor, 'commands', 'optimize-project.md'))).toBe(false);
        // Inventory set reflects the transform (reaping stays consistent).
        expect(current.has('commands/optimize-project.md')).toBe(false);
        expect(current.has('skills/optimize-project/SKILL.md')).toBe(true);
    });

    it('leaves tier-2 / internal commands as flat command files', () => {
        writeManifest([
            { slug: 'bug-fix', tier: 2, visibility: 'internal' },
            { slug: 'chat-history', tier: 1, visibility: 'internal' },
        ]);
        writeCommand('bug-fix');
        writeCommand('chat-history');
        const current = new Set(['commands/bug-fix.md', 'commands/chat-history.md']);

        const res = _apply_claude_flat_command_wrappers(anchor, pkgRoot, current);

        expect(res.wrapped).toEqual([]);
        expect(existsSync(join(anchor, 'commands', 'bug-fix.md'))).toBe(true);
        expect(existsSync(join(anchor, 'skills', 'bug-fix'))).toBe(false);
    });

    it('never overwrites a real skill with the same name (collision skip)', () => {
        writeManifest([{ slug: 'estimate-ticket', tier: 1, visibility: 'public' }]);
        writeCommand('estimate-ticket');
        mkdirSync(join(anchor, 'skills', 'estimate-ticket'), { recursive: true });
        writeFileSync(join(anchor, 'skills', 'estimate-ticket', 'SKILL.md'), 'REAL SKILL');
        const current = new Set(['commands/estimate-ticket.md', 'skills/estimate-ticket/SKILL.md']);

        const res = _apply_claude_flat_command_wrappers(anchor, pkgRoot, current);

        expect(res.collisions).toContain('estimate-ticket');
        expect(readFileSync(join(anchor, 'skills', 'estimate-ticket', 'SKILL.md'), 'utf8')).toBe('REAL SKILL');
        expect(existsSync(join(anchor, 'commands', 'estimate-ticket.md'))).toBe(true);
    });

    it('wraps the hardcoded essentials (commit) even without a manifest entry', () => {
        writeManifest([]);
        writeCommand('commit', 'Commit the working tree.');
        const current = new Set(['commands/commit.md']);

        const res = _apply_claude_flat_command_wrappers(anchor, pkgRoot, current);

        expect(res.wrapped).toEqual(['commit']);
        expect(existsSync(join(anchor, 'skills', 'commit', 'SKILL.md'))).toBe(true);
    });
});
