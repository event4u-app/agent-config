/**
 * Help-coverage tests — the fix for "`agent-config help` is outdated".
 *
 * Two help surfaces exist:
 *   1. TS-shell banner (`buildHelp()` in src/cli/help.ts) — printed on
 *      bare `agent-config help` / `--help`.
 *   2. Bash `usage()` in src/scripts/_dispatch.bash — printed on
 *      `agent-config help --tier=1|all`.
 *
 * The Bash `usage()` (`help --tier=all`) MUST list every command in the
 * REGISTRY (which registry.test.ts in turn locks to the Bash dispatcher's
 * case-block) — that is exactly how `upgrade` once went missing. The
 * default TS banner is a curated, task-grouped subset and may only name
 * registered commands.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REGISTRY } from '../../src/cli/registry.js';
import { buildHelp } from '../../src/cli/help.js';

function escapeRe(name: string): string {
    return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Regex matching a help line that starts with the command name. */
function commandLineRe(name: string): RegExp {
    // Two-space indent, the exact name, then whitespace or end-of-line.
    // The trailing boundary keeps `settings` from being satisfied by
    // `settings:check` and vice versa.
    return new RegExp(`^\\s{2}${escapeRe(name)}(\\s|$)`, 'm');
}

function bashUsageText(): string {
    const bashFile = resolve(process.cwd(), 'src/scripts/_dispatch.bash');
    const text = readFileSync(bashFile, 'utf8');
    const start = text.indexOf('usage() {');
    expect(start, 'usage() not found in _dispatch.bash').toBeGreaterThanOrEqual(0);
    const end = text.indexOf('\n}', start);
    expect(end, 'usage() closing brace not found').toBeGreaterThan(start);
    return text.slice(start, end);
}

describe('help coverage', () => {
    it('every registered command carries a non-empty synopsis', () => {
        const missing = REGISTRY.filter(
            (entry) => typeof entry.synopsis !== 'string' || entry.synopsis.trim().length === 0,
        ).map((entry) => entry.name);
        expect(missing, 'registry entries without a synopsis render empty help lines').toEqual([]);
    });

    it('Bash usage() lists every registered command across its tiers', () => {
        const usage = bashUsageText();
        const missing = REGISTRY.filter((entry) => !commandLineRe(entry.name).test(usage)).map(
            (entry) => entry.name,
        );
        expect(missing, 'commands dispatched but absent from `help --tier=all`').toEqual([]);
    });
});

// road-to-docs-that-sell 4.1 — the default help is a task-grouped front page,
// not the full registry dump. The full surface stays one flag away.
describe('default help (agent-config --help)', () => {
    const help = buildHelp();
    const lines = help.split('\n');
    // Command rows: two-space indent + a lowercase name, below the first heading
    // (the Usage block above it shows `agent-config <command>`, not a command).
    const commandRows = lines.slice(lines.indexOf('Get started:')).filter((l) => /^ {2}[a-z]/.test(l));

    it('fits in 60 lines', () => {
        expect(lines.length).toBeLessThanOrEqual(60);
    });

    it('groups commands by task, in the order a user meets them', () => {
        const headings = ['Get started:', 'Daily use:', 'Inspect:', 'Configure:', 'Maintain:'];
        const at = headings.map((h) => lines.indexOf(h));
        expect(at.every((i) => i >= 0), `missing heading in:\n${help}`).toBe(true);
        expect([...at].sort((a, b) => a - b)).toEqual(at);
    });

    it('lists only commands the CLI actually dispatches', () => {
        const shown = commandRows.map((l) => l.trim().split(/\s+/)[0] as string);
        expect(shown.length).toBeGreaterThan(10);
        const unknown = shown.filter((name) => REGISTRY.every((e) => e.name !== name));
        expect(unknown).toEqual([]);
    });

    it('teaches init first and keeps the advanced installers out of it', () => {
        const first = commandRows[0] ?? '';
        expect(first.trim().startsWith('init ')).toBe(true);
        for (const hidden of ['first-run', 'global', 'dispatch:hook', 'ui:serve']) {
            expect(help, hidden).not.toMatch(commandLineRe(hidden));
        }
        for (const shown of ['install', 'setup', 'config', 'refresh']) {
            expect(help, shown).toMatch(commandLineRe(shown));
        }
        // `install` is the same wizard as `init`, never sold as the CI path.
        expect(lines.find((l) => commandLineRe('install').test(l))).not.toMatch(/CI|non-interactive|script/i);
    });

    it('carries no ADR numbers or implementation labels', () => {
        expect(help).not.toMatch(/ADR-\d+/);
        expect(help).not.toMatch(/TS[ -]shell|Bash dispatcher|delegate/i);
    });

    it('points to the full command list', () => {
        expect(help).toContain('agent-config help --tier=all');
    });

    it('matches the committed snapshot', () => {
        expect(help).toMatchSnapshot();
    });
});
