// Tests for src/scripts/_lib/install_reach_checks.ts —
// road-to-consumer-repo-reality Phase 1 (1.2, 1.3) and Phase 5 (5.2).
//
// Every fixture is synthetic and written into a throwaway tmp dir, so nothing
// here reads the live tree and nothing can drift with it.
//
// The three-outcome contract is the point of most of this file. Risk-register
// rank 4 of the roadmap: "a checker that parses instruction files can misparse a
// path and report a healthy install as broken, which is worse than not
// checking." So the assertions that a path is reported UNRESOLVABLE rather than
// ABSENT are not edge-case polish — they are the property that makes the check
// safe to run at all, and each one below corresponds to a false positive that
// was measured during development against this repository's own root files.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    checkInstructionPaths,
    checkOverrideSet,
    checkVersionAxis,
    collectOverrideSet,
    readInstalledVersion,
    readVersionPins,
    repeatedOverrides,
    resolveInstructionPaths,
    REACH_CHECK_IDS,
    reachRunners,
} from '../../src/scripts/_lib/install_reach_checks.js';

const tmps: string[] = [];

function tree(files: Record<string, string>, dirs: string[] = []): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reach-'));
    tmps.push(root);
    for (const d of dirs) fs.mkdirSync(path.join(root, d), { recursive: true });
    for (const [rel, body] of Object.entries(files)) {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body, 'utf8');
    }
    return root;
}

afterEach(() => {
    while (tmps.length > 0) {
        const t = tmps.pop() as string;
        fs.rmSync(t, { recursive: true, force: true });
    }
});

describe('1.2 — instruction-file paths resolve, or say why not', () => {
    it('reports one existing and one absent directory, naming exactly the absent one', () => {
        const root = tree(
            { 'AGENTS.md': 'Rules live in `src/rules` and skills in `src/skills`.\n' },
            ['src/rules'],
        );
        const c = checkInstructionPaths(root);
        expect(c.status).toBe('fail');
        expect(c.message).toContain('src/skills');
        expect(c.message).not.toContain('→ src/rules');
        expect(c.remedy).not.toBe('');
    });

    it('exits ok when every named path resolves', () => {
        const root = tree(
            { 'AGENTS.md': 'See `src/rules` and `src/skills`.\n' },
            ['src/rules', 'src/skills'],
        );
        expect(checkInstructionPaths(root).status).toBe('ok');
    });

    it('reports a path it cannot interpret as unresolvable WITH a reason, never as absent', () => {
        const root = tree(
            {
                'AGENTS.md': [
                    'A url: `https://example.com/rules`',
                    'Absolute: `/etc/agent/rules`',
                    'Home: `~/.config/agent/rules`',
                    'Glob: `src/rules/*.md`',
                    'Placeholder: `src/rules/<name>.md`',
                    'Escape: `../outside/rules`',
                    'Bare dir: `archive/`',
                ].join('\n'),
            },
            ['src'],
        );
        const named = resolveInstructionPaths(root);
        expect(named.length).toBeGreaterThan(0);
        expect(named.every((n) => n.outcome === 'unresolvable')).toBe(true);
        expect(named.every((n) => (n.reason ?? '') !== '')).toBe(true);
        expect(named.some((n) => n.outcome === 'dangling')).toBe(false);
    });

    it('attributes an unresolvable path to the CHECKER in the report text', () => {
        // An absolute path, because it is one of the shapes that reaches
        // classification. A URL never does — it fails the anchor test at
        // extraction and is dropped as "not a path claim" rather than reported,
        // which is the right answer for a URL and is asserted separately below.
        const root = tree({ 'AGENTS.md': 'See `/etc/agent/rules` and `src/rules`.\n' }, ['src/rules']);
        const c = checkInstructionPaths(root);
        expect(c.status).toBe('ok');
        expect(c.message).toContain('THIS CHECKER could not interpret');
        expect(c.message).toContain('absolute');
    });

    it('drops a URL at extraction rather than reporting it', () => {
        const root = tree({ 'AGENTS.md': 'See `https://example.com/x/y`.\n' });
        expect(resolveInstructionPaths(root)).toHaveLength(0);
    });

    // The three measured false positives. Each of these was reported DANGLING by
    // an earlier revision against this repository's own root files.
    it('does not treat a bare agent-layer word as a path claim', () => {
        const root = tree({ 'AGENTS.md': 'The `skills` layer and the `rules` layer.\n' });
        expect(resolveInstructionPaths(root)).toHaveLength(0);
    });

    it('does not treat a package name as a path claim', () => {
        const root = tree({ 'AGENTS.md': 'Install `event4u/agent-config` first.\n' });
        expect(resolveInstructionPaths(root)).toHaveLength(0);
    });

    it('does not treat a bare filename or a dotted identifier as a path claim', () => {
        const root = tree({ 'AGENTS.md': 'See `link_crypto.ts`, `size-enforcement.md`, `pathlib.Path` and `.md`.\n' });
        expect(resolveInstructionPaths(root)).toHaveLength(0);
    });

    it('still reports a wholly absent layer under an EXISTING parent as dangling', () => {
        // The anchoring rule must not swallow the defect it exists to catch.
        const root = tree({ 'AGENTS.md': 'Guidelines live in `src/guidelines`.\n' }, ['src']);
        const named = resolveInstructionPaths(root);
        expect(named).toHaveLength(1);
        expect(named[0]?.outcome).toBe('dangling');
    });

    it('reads markdown link targets as well as backticked spans', () => {
        const root = tree({ 'AGENTS.md': 'See [the rules](src/rules/index.md).\n' }, ['src']);
        const named = resolveInstructionPaths(root);
        expect(named.map((n) => n.raw)).toEqual(['src/rules/index.md']);
        expect(named[0]?.outcome).toBe('dangling');
    });

    it('skips a tree whose root files name no path at all', () => {
        const root = tree({ 'AGENTS.md': 'Be careful and read the code.\n' });
        expect(checkInstructionPaths(root).status).toBe('skipped');
    });

    it('reads every root instruction file, not only AGENTS.md', () => {
        const root = tree(
            {
                'CLAUDE.md': 'See `src/rules`.\n',
                '.github/copilot-instructions.md': 'See `src/skills`.\n',
            },
            ['src'],
        );
        const sources = new Set(resolveInstructionPaths(root).map((n) => n.source));
        expect(sources).toEqual(new Set(['CLAUDE.md', '.github/copilot-instructions.md']));
    });
});

describe('1.3 — the version axis is a three-way comparison', () => {
    it('reads a pin under the LEGACY filename and labels it legacy', () => {
        const root = tree({
            '.agent-settings.yml': 'agent_config_version: "9.1.0"\n',
            'agents/installed-tools.lock': 'agent_config_version: "14.12.0"\n',
        });
        const pins = readVersionPins(root);
        expect(pins).toHaveLength(1);
        expect(pins[0]?.legacy).toBe(true);
        expect(pins[0]?.version).toBe('9.1.0');
        expect(readInstalledVersion(root)).toBe('14.12.0');

        const c = checkVersionAxis(root, '14.12.0');
        expect(c.status).toBe('warn');
        expect(c.message).toContain('LEGACY filename');
        expect(c.message).toContain('9.1.0');
        expect(c.message).toContain('14.12.0');
    });

    it('prints all three numbers together even when they agree', () => {
        const root = tree({
            'agents/settings/.agent-settings.yml': 'agent_config_version: "14.12.0"\n',
            'agents/installed-tools.lock': 'agent_config_version: "14.12.0"\n',
        });
        const c = checkVersionAxis(root, '14.12.0');
        expect(c.status).toBe('ok');
        expect(c.message).toContain('pinned:');
        expect(c.message).toContain('installed:');
        expect(c.message).toContain('resolvable now:');
    });

    it('does not label the canonical location as legacy', () => {
        const root = tree({ 'agents/settings/.agent-settings.yml': 'agent_config_version: "14.12.0"\n' });
        expect(readVersionPins(root)[0]?.legacy).toBe(false);
    });

    it('skips a tree with no pin and no lockfile', () => {
        expect(checkVersionAxis(tree({}), '14.12.0').status).toBe('skipped');
    });

    it('reports an unknown installed version rather than inventing one', () => {
        const root = tree({ 'agents/settings/.agent-settings.yml': 'agent_config_version: "14.12.0"\n' });
        expect(checkVersionAxis(root, null).message).toContain('resolvable now: unknown');
        expect(checkVersionAxis(root, null).message).toContain('installed: unknown');
    });
});

describe('5.2 — the override signal is identity and a count, and nothing else', () => {
    it('has no field capable of holding a path, a diff, or consumer content', () => {
        const root = tree({ 'agents/overrides/rules/foo.md': 'x\n' });
        const set = collectOverrideSet(root);
        expect(set).toHaveLength(1);
        // PII-exclusion by construction: the exact key set, asserted.
        expect(Object.keys(set[0] as object).sort()).toEqual(['kind', 'layers', 'name']);
        expect(set[0]).toEqual({ kind: 'rule', name: 'foo', layers: 1 });
    });

    it('produces the signal for an artifact overridden in TWO layers', () => {
        const root = tree({
            'agents/overrides/rules/foo.md': 'x\n',
            '.agent/overrides/rules/foo.md': 'y\n',
        });
        expect(repeatedOverrides(collectOverrideSet(root))).toEqual([{ kind: 'rule', name: 'foo', layers: 2 }]);
        expect(checkOverrideSet(root).status).toBe('warn');
    });

    it('produces NO signal for a single override — the other direction', () => {
        const root = tree({ 'agents/overrides/rules/foo.md': 'x\n' });
        expect(repeatedOverrides(collectOverrideSet(root))).toEqual([]);
        expect(checkOverrideSet(root).status).toBe('ok');
    });

    it('does not confuse two different artifacts for one repeated override', () => {
        const root = tree({
            'agents/overrides/rules/foo.md': 'x\n',
            '.agent/overrides/rules/bar.md': 'y\n',
        });
        expect(repeatedOverrides(collectOverrideSet(root))).toEqual([]);
    });

    it('separates identical names of different kinds', () => {
        const root = tree({
            'agents/overrides/rules/foo.md': 'x\n',
            'agents/overrides/skills/foo.md': 'y\n',
        });
        expect(repeatedOverrides(collectOverrideSet(root))).toEqual([]);
        expect(collectOverrideSet(root)).toHaveLength(2);
    });

    it('refuses to change a default on one tree — the report says so', () => {
        const root = tree({
            'agents/overrides/rules/foo.md': 'x\n',
            '.agent/overrides/rules/foo.md': 'y\n',
        });
        const c = checkOverrideSet(root);
        expect(c.message).toContain('ONE tree is not');
        expect(c.remedy).toContain('upstream-contribution path');
    });

    it('skips a tree with no overrides', () => {
        expect(checkOverrideSet(tree({})).status).toBe('skipped');
    });
});

describe('wiring — the shape cmd_doctor consumes', () => {
    it('every declared id has a runner, and every runner a declared id', () => {
        const runners = reachRunners({ projectRoot: tree({}), resolvableVersion: null });
        expect(Object.keys(runners).sort()).toEqual([...REACH_CHECK_IDS].sort());
    });

    it('every runner returns its own id', () => {
        const runners = reachRunners({ projectRoot: tree({}), resolvableVersion: null });
        for (const [id, run] of Object.entries(runners)) expect(run().id).toBe(id);
    });
});
