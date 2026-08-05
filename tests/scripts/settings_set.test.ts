// Tests for src/scripts/_cli/cmd_settings_set.ts — Phase 2 of
// road-to-zero-ceremony-settings.
//
// The fence is the point, so the suite is weighted towards refusals: a writer
// that writes is easy to prove, a writer that refuses the right things is not.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    leafSchemaAt,
    loadClassIndex,
    parseScalar,
    provenanceFilePath,
    runSettingsSet,
    settingsFilePath,
    globalRoot,
    PACKAGE_ROOT,
    type SettingsSetOptions,
} from '../../src/scripts/_cli/cmd_settings_set.js';
import { settingsSchema } from '../../src/server/schemas/settings.js';

const NOW = '2026-08-05T00:00:00Z';

describe('settings:set', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-set-'));
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    function run(over: Partial<SettingsSetOptions> = {}) {
        return runSettingsSet({
            key: 'personal.play_by_play',
            rawValue: 'true',
            source: 'manual',
            root,
            packageRoot: PACKAGE_ROOT,
            now: NOW,
            dryRun: false,
            ...over,
        });
    }

    function readSettings(): Record<string, unknown> {
        return parseYaml(fs.readFileSync(settingsFilePath(root), 'utf-8')) as Record<string, unknown>;
    }

    it('writes an A-class key, echoing one loud line', () => {
        const res = run();
        expect(res.code).toBe(0);
        expect(res.out).toHaveLength(1);
        expect(res.out[0]).toContain('personal.play_by_play');
        expect(res.out[0]).toContain('class A');
        expect((readSettings()['personal'] as Record<string, unknown>)['play_by_play']).toBe(true);
    });

    it('stamps provenance in a sidecar, leaving the settings file schema-clean', () => {
        run({ source: 'jit-answer' });
        const sidecar = JSON.parse(fs.readFileSync(provenanceFilePath(root), 'utf-8')) as Record<
            string,
            { source: string; at: string }
        >;
        expect(sidecar['personal.play_by_play']).toEqual({ source: 'jit-answer', at: NOW });
        // The stamp must NOT leak into the settings file — that file has a
        // leaf-for-leaf parity test against the zod schema, and a bookkeeping
        // key there would mean relaxing the one gate keeping the GUI honest.
        expect(JSON.stringify(readSettings())).not.toContain('jit-answer');
    });

    it('refuses a C-class key and names why', () => {
        const res = run({ key: 'personal.autonomy', rawValue: 'on' });
        expect(res.code).toBe(1);
        expect(res.err.join('\n')).toContain('class C (guarded)');
        expect(fs.existsSync(settingsFilePath(root))).toBe(false);
    });

    it('refuses a key with no row in the contract', () => {
        const res = run({ key: 'not.a.real.key', rawValue: '1' });
        expect(res.code).toBe(1);
        expect(res.err.join('\n')).toContain('has no class');
    });

    it('fails CLOSED when the class contract cannot be read', () => {
        // The whole fence rests on one markdown file. If it goes missing the
        // writer must refuse EVERYTHING — an A-class write included — rather
        // than conclude that nothing is guarded.
        const res = run({ packageRoot: path.join(root, 'no-such-package') });
        expect(res.code).toBe(1);
        expect(res.err.join('\n')).toContain('missing or has no rows');
        expect(fs.existsSync(settingsFilePath(root))).toBe(false);
    });

    it('refuses a value the schema rejects, before touching disk', () => {
        const res = run({ rawValue: 'banana' });
        expect(res.code).toBe(1);
        expect(res.err.join('\n')).toContain('Expected boolean');
        expect(fs.existsSync(settingsFilePath(root))).toBe(false);
    });

    it('is a no-op when the value is already set', () => {
        expect(run().code).toBe(0);
        const mtime = fs.statSync(settingsFilePath(root)).mtimeMs;
        const again = run();
        expect(again.code).toBe(0);
        expect(again.out[0]).toContain('already');
        expect(fs.statSync(settingsFilePath(root)).mtimeMs).toBe(mtime);
    });

    it('--dry-run reports the write without performing it', () => {
        const res = run({ dryRun: true });
        expect(res.code).toBe(0);
        expect(res.out[0]).toContain('would set');
        expect(fs.existsSync(settingsFilePath(root))).toBe(false);
    });

    it('preserves values written by an earlier call', () => {
        run();
        run({ key: 'personal.minimal_output', rawValue: 'false' });
        const personal = readSettings()['personal'] as Record<string, unknown>;
        expect(personal['play_by_play']).toBe(true);
        expect(personal['minimal_output']).toBe(false);
    });

    it('rebuilds a corrupt provenance sidecar instead of refusing the write', () => {
        run();
        fs.writeFileSync(provenanceFilePath(root), 'not json at all', 'utf-8');
        const res = run({ key: 'personal.minimal_output', rawValue: 'false' });
        expect(res.code).toBe(0);
        const sidecar = JSON.parse(fs.readFileSync(provenanceFilePath(root), 'utf-8')) as Record<string, unknown>;
        // Provenance is a record ABOUT a decision, never a gate ON one.
        expect(sidecar['personal.minimal_output']).toBeDefined();
    });
});

describe('settings:set — the existing file', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-set-file-'));
        fs.mkdirSync(path.join(root, 'settings'), { recursive: true });
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    function seed(body: string): void {
        fs.writeFileSync(settingsFilePath(root), body, 'utf-8');
    }

    function run(over: Partial<SettingsSetOptions> = {}) {
        return runSettingsSet({
            key: 'personal.play_by_play',
            rawValue: 'true',
            source: 'manual',
            root,
            packageRoot: PACKAGE_ROOT,
            now: NOW,
            dryRun: false,
            ...over,
        });
    }

    it('preserves the comments around a key it rewrites', () => {
        // The file this writes to IS the commented template the wizard lays
        // down; a dump-based write would strip ~1,200 lines of explanation to
        // set one boolean.
        seed('# top comment\npersonal:\n  # keep me\n  play_by_play: false\n');
        expect(run().code).toBe(0);
        const after = fs.readFileSync(settingsFilePath(root), 'utf-8');
        expect(after).toContain('# top comment');
        expect(after).toContain('# keep me');
        expect(after).toMatch(/play_by_play:\s*true/);
    });

    it('says so when it had to rewrite a file that lacked the key', () => {
        seed('personal:\n  minimal_output: true\n');
        const res = run();
        expect(res.code).toBe(0);
        // Losing comments is bad; losing them silently is worse, and emitting a
        // flat dotted key the next read cannot see would be worse still.
        expect(res.out.join('\n')).toContain('comments are gone');
        const after = parseYaml(fs.readFileSync(settingsFilePath(root), 'utf-8')) as Record<string, unknown>;
        expect((after['personal'] as Record<string, unknown>)['play_by_play']).toBe(true);
        expect((after['personal'] as Record<string, unknown>)['minimal_output']).toBe(true);
    });

    it('refuses a file that is not a settings map instead of replacing it', () => {
        seed('- this\n- is\n- a list\n');
        const res = run();
        expect(res.code).toBe(1);
        expect(res.err.join('\n')).toContain('not a settings map');
        // The user's content survives. Overwriting it to set one key is the
        // failure this branch exists to prevent.
        expect(fs.readFileSync(settingsFilePath(root), 'utf-8')).toContain('- a list');
    });

    it('refuses malformed YAML with an exit code, not a stack trace', () => {
        seed('personal:\n  play_by_play: [unclosed\n');
        const res = run();
        expect(res.code).toBe(1);
        expect(res.err.join('\n')).toContain('not a settings map');
    });

    it('treats a comments-only file as an empty document', () => {
        seed('# nothing decided yet\n');
        expect(run().code).toBe(0);
        const after = parseYaml(fs.readFileSync(settingsFilePath(root), 'utf-8')) as Record<string, unknown>;
        expect((after['personal'] as Record<string, unknown>)['play_by_play']).toBe(true);
    });

    it('does not pollute Object.prototype through a dotted key', () => {
        const res = run({ key: '__proto__.polluted', rawValue: 'true' });
        expect(res.code).toBe(1);
        expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });
});

describe('settings:set — helpers', () => {
    it('parseScalar types the CLI token the way YAML would', () => {
        expect(parseScalar('true')).toBe(true);
        expect(parseScalar('3')).toBe(3);
        expect(parseScalar('[]')).toEqual([]);
        expect(parseScalar('hello')).toBe('hello');
    });

    it('leafSchemaAt walks to a leaf and returns null off the schema', () => {
        expect(leafSchemaAt(settingsSchema, 'personal.play_by_play')).not.toBeNull();
        expect(leafSchemaAt(settingsSchema, 'personal.nope')).toBeNull();
        expect(leafSchemaAt(settingsSchema, 'nope')).toBeNull();
    });

    it('the shipped contract loads and marks a known guarded key', () => {
        const index = loadClassIndex(PACKAGE_ROOT);
        expect(index).not.toBeNull();
        expect(index?.get('personal.autonomy')).toBe('C');
        expect(index?.get('personal.play_by_play')).toBe('A');
    });

    it('globalRoot honours EVENT4U_CONFIG_HOME', () => {
        expect(globalRoot({ EVENT4U_CONFIG_HOME: '/tmp/somewhere' })).toBe(path.resolve('/tmp/somewhere'));
        expect(globalRoot({})).toContain(path.join('.event4u', 'agent-config'));
    });
});
