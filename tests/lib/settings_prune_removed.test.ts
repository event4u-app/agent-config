/**
 * road-to-docs-that-sell 4.6 — removed settings keys cost one line, and that
 * line names the command that deletes them.
 *
 * Before: one stderr line per leftover key, per process, on every invocation —
 * ~45 lines on a settings file from an older install, with no way to make it
 * stop short of editing YAML by hand.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { REMOVED_KEYS, warnRemovedKeys, _resetRemovedKeyWarnings } from '../../src/scripts/_lib/settings_removed_keys.js';
import { pruneRemovedText } from '../../src/scripts/_lib/settings_prune_removed.js';
import { main as syncMain } from '../../src/scripts/sync_agent_settings.js';

const FIXTURE = path.resolve('tests/fixtures/settings/legacy-removed-keys.yml');
const LEFTOVERS = [
    'subagents.enabled',
    'subagents.downshift',
    'ai_team.enabled',
    'lean_projection.mode',
    'lean_projection.hosts',
    'explain.enable_last',
    'consistency.cross_source',
    'projection.rule_packs',
];

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prune-removed-'));
    _resetRemovedKeyWarnings();
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function capture(fn: () => unknown): { out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    const o = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => (out.push(String(c)), true));
    const e = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => (err.push(String(c)), true));
    try {
        fn();
    } finally {
        o.mockRestore();
        e.mockRestore();
    }
    return { out, err };
}

describe('the fixture really is a legacy file', () => {
    it('every leftover is a registered removed key', () => {
        for (const k of LEFTOVERS) expect(REMOVED_KEYS.has(k), k).toBe(true);
    });
});

describe('warnRemovedKeys', () => {
    it('collapses every leftover into ONE line naming the cleanup command', () => {
        const tree = parseYaml(fs.readFileSync(FIXTURE, 'utf-8')) as Record<string, unknown>;
        const { err } = capture(() => warnRemovedKeys(tree));
        expect(err).toHaveLength(1);
        expect(err[0]).toMatch(/^8 removed settings keys are ignored/);
        expect(err[0]).toContain('agent-config settings:sync --prune-removed');
        expect(err[0]?.endsWith('\n')).toBe(true);
        expect(err[0]?.split('\n')).toHaveLength(2);
    });

    it('stays silent for keys it already reported in this process', () => {
        const tree = parseYaml(fs.readFileSync(FIXTURE, 'utf-8')) as Record<string, unknown>;
        capture(() => warnRemovedKeys(tree));
        expect(capture(() => warnRemovedKeys(tree)).err).toEqual([]);
    });
});

describe('pruneRemovedText', () => {
    it('deletes the removed keys, keeps every live key and comment, and drops emptied parents', () => {
        const src = fs.readFileSync(FIXTURE, 'utf-8');
        const r = pruneRemovedText(src, [...REMOVED_KEYS.keys()]);
        expect([...r.removed].sort()).toEqual([...LEFTOVERS].sort());
        const tree = parseYaml(r.text) as Record<string, unknown>;
        expect(tree).toEqual({
            personal: { autonomy: 'on', canary_name: 'Sam' },
            quality: { local_auto_run: false },
        });
        expect(r.text).toContain('# the nickname the canary greets');
        expect(pruneRemovedText(r.text, [...REMOVED_KEYS.keys()]).removed).toEqual([]);
    });
});

describe('settings:sync --prune-removed', () => {
    it('--dry-run lists each key with its reason and writes nothing', () => {
        const f = path.join(tmp, '.agent-settings.yml');
        fs.copyFileSync(FIXTURE, f);
        const before = fs.readFileSync(f, 'utf-8');
        let rc = -1;
        const { out } = capture(() => (rc = syncMain(['--prune-removed', '--dry-run', '--path', f])));
        expect(rc).toBe(0);
        expect(fs.readFileSync(f, 'utf-8')).toBe(before);
        const text = out.join('');
        for (const k of LEFTOVERS) expect(text, k).toContain(`${k} — ${REMOVED_KEYS.get(k) ?? ''}`);
    });

    it('removes them from the file', () => {
        const f = path.join(tmp, '.agent-settings.yml');
        fs.copyFileSync(FIXTURE, f);
        let rc = -1;
        capture(() => (rc = syncMain(['--prune-removed', '--path', f])));
        expect(rc).toBe(0);
        const tree = parseYaml(fs.readFileSync(f, 'utf-8')) as Record<string, unknown>;
        expect(Object.keys(tree).sort()).toEqual(['personal', 'quality']);
    });
});
