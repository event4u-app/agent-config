/**
 * road-to-docs-that-sell 4.2 — `agent-config init --help` is about `init`.
 *
 * It used to print the bash installer's own header (`bash scripts/install
 * [OPTIONS]`), a path no consumer has and a command nobody should type.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { INIT_HELP } from '../../src/cli/initHelp.js';

const ROOT = process.cwd();
const TSX = resolve(ROOT, 'node_modules/.bin/tsx');
const MAIN = resolve(ROOT, 'src/cli/main.ts');

let home: string;
let project: string;
beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'init-help-home-'));
    project = mkdtempSync(join(tmpdir(), 'init-help-project-'));
});
afterEach(() => {
    rmSync(home, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
});

describe('init --help', () => {
    it('is routed to the init help, exits 0 and installs nothing', () => {
        for (const flag of ['--help', '-h']) {
            const res = spawnSync(TSX, [MAIN, 'init', flag], {
                cwd: project,
                encoding: 'utf8',
                env: { ...process.env, HOME: home, CI: '1' },
            });
            expect(res.status, res.stderr).toBe(0);
            expect(res.stdout).toBe(INIT_HELP);
        }
        expect(readdirSync(home)).toEqual([]);
        expect(readdirSync(project)).toEqual([]);
    });

    it('shows agent-config init usage, not the bash installer', () => {
        expect(INIT_HELP.startsWith('Usage: agent-config init [options]')).toBe(true);
        expect(INIT_HELP).not.toMatch(/bash scripts\/install|scripts\/install|install\.sh|install\.ts/);
    });

    it('names the flags a user passes', () => {
        for (const flag of ['--yes', '--global', '--tools', '--dry-run', '--offline', '--no-ui', '--gui', '--project', '--list-tools']) {
            expect(INIT_HELP, flag).toMatch(new RegExp(`^ {2}(-y, )?${flag}\\b`, 'm'));
        }
    });

    it('describes --project as the repository surface ruling 0.5 names', () => {
        const block = INIT_HELP.slice(INIT_HELP.indexOf('  --project'), INIT_HELP.indexOf('Wizard options:'));
        expect(block).toMatch(/agents\/overrides\//);
        expect(block).toMatch(/\.gitignore/);
        expect(block).toMatch(/\.gitattributes/);
        expect(block).not.toMatch(/marker/);
    });

    it('matches the committed snapshot', () => {
        expect(INIT_HELP).toMatchSnapshot();
    });
});
