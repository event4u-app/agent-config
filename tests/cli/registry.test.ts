/**
 * Tests for src/cli/registry.ts — subcommand-table parity with the
 * Bash dispatcher.
 *
 * Roadmap Phase 2 acceptance: the registry MUST cover every `case`
 * branch in scripts/agent-config. New Bash subcommands without a
 * corresponding registry entry are a regression — the TS shell would
 * silently delegate but `--help` would lie.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REGISTRY, findCommand, isNative } from '../../src/cli/registry.js';

function extractBashSubcommands(bashFile: string): string[] {
    const text = readFileSync(bashFile, 'utf8');
    const names = new Set<string>();
    // Match `<name>) ...` or `<name>|<other>) ...` lines inside case blocks.
    // Restrict to typical command shape so we don't pick up unrelated case
    // branches (numeric, paths, …).
    const lineRe = /^\s*([a-z][a-z0-9:_-]*)\)/gm;
    let m: RegExpExecArray | null;
    while ((m = lineRe.exec(text)) !== null) {
        const name = m[1];
        if (!name) continue;
        // Filter common Bash control-flow names that aren't subcommands.
        if (['exit', 'help', 'unknown', 'esac', 'fi', 'done'].includes(name)) continue;
        names.add(name);
    }
    // 'help' IS a subcommand; re-add explicitly.
    names.add('help');
    return [...names].sort();
}

describe('REGISTRY', () => {
    it('has a stable structure (name + disposition required)', () => {
        for (const entry of REGISTRY) {
            expect(typeof entry.name).toBe('string');
            expect(entry.name.length).toBeGreaterThan(0);
            expect(['native', 'delegate']).toContain(entry.disposition);
        }
    });

    it('declares versions, doctor-shell, and ui:serve as native', () => {
        expect(isNative('versions')).toBe(true);
        expect(isNative('doctor-shell')).toBe(true);
        expect(isNative('ui:serve')).toBe(true);
    });

    it('delegates init and sync to Bash', () => {
        expect(isNative('init')).toBe(false);
        expect(isNative('sync')).toBe(false);
        expect(findCommand('init')?.disposition).toBe('delegate');
    });

    it('contains no duplicate names', () => {
        const names = REGISTRY.map((e) => e.name);
        const dedup = new Set(names);
        expect(dedup.size).toBe(names.length);
    });

    it('covers every subcommand declared in scripts/_dispatch.bash', () => {
        const bashFile = resolve(process.cwd(), 'scripts/_dispatch.bash');
        const bashCommands = extractBashSubcommands(bashFile);
        const registryCommands = new Set(REGISTRY.map((e) => e.name));
        const missing = bashCommands.filter((name) => !registryCommands.has(name));
        // 'doctor-shell' is a TS-native addition that has no Bash counterpart
        // — its absence from the Bash file is expected.
        expect(missing).toEqual([]);
    });
});
