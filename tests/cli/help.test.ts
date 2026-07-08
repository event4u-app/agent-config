/**
 * Help-coverage tests — the fix for "`agent-config help` is outdated".
 *
 * Two help surfaces exist:
 *   1. TS-shell banner (`buildHelp()` in src/cli/help.ts) — printed on
 *      bare `agent-config help` / `--help`.
 *   2. Bash `usage()` in src/scripts/_dispatch.bash — printed on
 *      `agent-config help --tier=1|all`.
 *
 * Both MUST list every command in the REGISTRY (which registry.test.ts
 * in turn locks to the Bash dispatcher's case-block). A command that
 * dispatches but is missing from help is a regression — that is exactly
 * how `upgrade` went missing.
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
    it('TS-shell help lists every registered command', () => {
        const help = buildHelp();
        const missing = REGISTRY.filter((entry) => !commandLineRe(entry.name).test(help)).map(
            (entry) => entry.name,
        );
        expect(missing, 'commands dispatched but absent from `agent-config help`').toEqual([]);
    });

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

    it('TS-shell help groups native and delegated commands', () => {
        const help = buildHelp();
        expect(help).toContain('Native commands (TS shell):');
        expect(help).toContain('Delegated commands (Bash dispatcher):');
        // Regression anchor for the original report: `upgrade` was
        // dispatchable but invisible in `agent-config help`.
        expect(help).toMatch(commandLineRe('upgrade'));
    });
});
