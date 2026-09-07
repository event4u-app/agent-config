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
 *
 * `$HOME` is pinned to an empty fixture too, and that is not belt-and-braces.
 * Since the ADR-236 amendment of 2026-09-07 the colon-form emitter withholds a
 * command `~/.claude/commands/<cluster>/<sub>.md` already holds, so a test that
 * left `$HOME` alone asserted whatever the developer's install happened to carry:
 * green on CI (no host layer) and red on a maintainer machine (both fixtures
 * withheld, counts 0 instead of 2 and 1). The empty fixture makes the withhold
 * inert; the last test seeds it deliberately and asserts the withhold instead.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as condense from '../../src/scripts/condense.js';
import { _resetClaudeLayerMemoForTest } from '../../src/install/claudeLayerCarriage.js';

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
    let home: string;
    let savedHome: string | undefined;

    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cmddedup-'));
        home = fs.mkdtempSync(path.join(os.tmpdir(), 'cmddedup-home-'));
        savedHome = process.env['HOME'];
        process.env['HOME'] = home;
        _resetClaudeLayerMemoForTest();
        // Two clustered commands and one flat one, under a real pack id so the
        // slug-prefix logic behaves as it does in the tree.
        writeCommand(tmp, 'product-basic/roadmap/process-full', 'roadmap-process-full');
        writeCommand(tmp, 'product-basic/roadmap/create', 'roadmap-create');
        writeCommand(tmp, 'product-basic/standalone', 'standalone');
        condense._resetStateForTest(tmp);
    });

    afterEach(() => {
        condense._setStateForTest(saved);
        if (savedHome === undefined) delete process.env['HOME'];
        else process.env['HOME'] = savedHome;
        _resetClaudeLayerMemoForTest();
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.rmSync(home, { recursive: true, force: true });
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

    it('withholds a colon command the HOST layer already carries, and only that one', () => {
        // ADR-236 amendment, 2026-09-07. The host deduplicates `/cluster:sub` and
        // the GLOBAL copy wins (measured 2026-08-21), so a project copy of a
        // command the host holds is dead weight. Per NAME: seeding one of the two
        // clustered commands must withhold exactly that one.
        const seeded = path.join(home, '.claude', 'commands', 'roadmap');
        fs.mkdirSync(seeded, { recursive: true });
        fs.writeFileSync(path.join(seeded, 'create.md'), 'x', 'utf-8');
        _resetClaudeLayerMemoForTest();

        expect(condense.generate_claude_project_commands()).toBe(1);
        expect(fs.existsSync(colonCommand('roadmap/create'))).toBe(false);
        expect(fs.existsSync(colonCommand('roadmap/process-full'))).toBe(true);
    });

    it('RECONCILES a colon command the host layer started carrying', () => {
        // The removal half: a copy an earlier run wrote must go, not merely stop
        // being rewritten. A gate that only declines to write keeps the duplicate.
        expect(condense.generate_claude_project_commands()).toBe(2);
        expect(fs.existsSync(colonCommand('roadmap/create'))).toBe(true);

        const seeded = path.join(home, '.claude', 'commands', 'roadmap');
        fs.mkdirSync(seeded, { recursive: true });
        fs.writeFileSync(path.join(seeded, 'create.md'), 'x', 'utf-8');
        _resetClaudeLayerMemoForTest();

        expect(condense.generate_claude_project_commands()).toBe(1);
        expect(fs.existsSync(colonCommand('roadmap/create'))).toBe(false);
    });
});
