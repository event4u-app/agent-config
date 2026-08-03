/**
 * Command double-listing de-duplication (road-to-renewal-foundation Phase 2).
 *
 * Every clustered command used to be listed TWICE for a Claude Code session
 * with a global install: once as a hyphen skill wrapper in `.claude/skills/`
 * (written by `generate_claude_commands`) and once as `/cluster:sub` from the
 * user-global `~/.claude/commands/` tree. 4,214 GPT tok of always-loaded
 * catalog for zero added reach.
 *
 * `generate_claude_project_commands` emits the colon form into the PROJECT
 * tree, and `generate_claude_commands` then skips exactly those commands.
 * Flat commands keep their wrapper — Claude Code does not register flat
 * command FILES (probed ≤ 2.1.204, see install.ts's flat-command mitigation),
 * so dropping their wrapper would drop real reachability.
 *
 * Isolated via the condense test-state seam; never touches the real tree.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as condense from '../../src/scripts/condense.js';

function writeCommand(root: string, relDir: string, name: string): void {
    const dir = path.join(root, 'src', 'domains', relDir);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'command.md'),
        ['---', `name: ${name}`, 'description: Demo command.', '---', '', 'Body.', ''].join('\n'),
        'utf-8',
    );
}

describe('claude command de-duplication', () => {
    let saved: ReturnType<typeof condense._getStateForTest>;
    let tmp: string;

    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmddedup-'));
        // Two clustered commands and one flat one, under a real pack id so the
        // slug-prefix logic behaves as it does in the tree.
        writeCommand(tmp, 'product-basic/roadmap/process-full', 'roadmap-process-full');
        writeCommand(tmp, 'product-basic/roadmap/create', 'roadmap-create');
        writeCommand(tmp, 'product-basic/standalone', 'standalone');
        condense._resetStateForTest(tmp);
    });

    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    const skillWrapper = (slug: string): string =>
        path.join(tmp, '.claude', 'skills', slug, 'SKILL.md');
    const colonCommand = (sub: string): string =>
        path.join(tmp, '.claude', 'commands', `${sub}.md`);

    it('emits one colon command per clustered command', () => {
        expect(condense.generate_claude_project_commands()).toBe(2);
        expect(fs.existsSync(colonCommand('roadmap/process-full'))).toBe(true);
        expect(fs.existsSync(colonCommand('roadmap/create'))).toBe(true);
    });

    it('never emits a colon command for a flat command', () => {
        condense.generate_claude_project_commands();
        expect(fs.existsSync(colonCommand('standalone'))).toBe(false);
    });

    it('links to the real source — no dangling symlink', () => {
        condense.generate_claude_project_commands();
        // The off-by-one this pins actually happened: a hand-counted `../` run
        // produced links that resolve nowhere while looking correct in `ls -l`.
        const body = fs.readFileSync(colonCommand('roadmap/process-full'), 'utf-8');
        expect(body).toContain('roadmap-process-full');
    });

    it('drops the hyphen wrapper for a command that has a colon form', () => {
        condense.generate_claude_project_commands();
        condense.generate_claude_commands();
        expect(fs.existsSync(skillWrapper('roadmap-process-full'))).toBe(false);
        expect(fs.existsSync(skillWrapper('roadmap-create'))).toBe(false);
    });

    it('keeps the hyphen wrapper for a flat command — its only access path', () => {
        condense.generate_claude_project_commands();
        condense.generate_claude_commands();
        expect(fs.existsSync(skillWrapper('standalone'))).toBe(true);
    });

    it('sweeps a colon command whose source disappeared', () => {
        condense.generate_claude_project_commands();
        fs.rmSync(path.join(tmp, 'src', 'domains', 'product-basic', 'roadmap', 'create'), {
            recursive: true,
            force: true,
        });
        expect(condense.generate_claude_project_commands()).toBe(1);
        expect(fs.existsSync(colonCommand('roadmap/create'))).toBe(false);
        expect(fs.existsSync(colonCommand('roadmap/process-full'))).toBe(true);
    });

    it('is a no-op without a src/domains tree (the consumer case)', () => {
        fs.rmSync(path.join(tmp, 'src', 'domains'), { recursive: true, force: true });
        expect(condense.generate_claude_project_commands()).toBe(0);
    });
});
