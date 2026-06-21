// Install-output snapshot tests for src/scripts/install.ts — the TS twin of
// tests/hooks/test_install_snapshot.py (the SPEC). PURE-TS: no python, no
// snapshot oracle. Two behaviors are frozen here:
//
//   1. Per-platform install output — drive `ensure_<platform>_bridge(...)`
//      against a tmp project dir and assert the written bridge file CONTENTS
//      match the expected per-platform strings (frozen INLINE as committed
//      fixtures, ported from the python snapshot expectations).
//   2. Drift guard — each platform's `*_DISPATCHER_BINDINGS` must cover the
//      `scripts/hook_manifest.yaml` platform block (manifest events ⊆ binding
//      ac_events), the silent-no-op failure mode the parser guards.
//
// A breaking change to install.ts (renamed binding, dropped event, shifted CLI
// flag) trips one of these with a useful diff.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as inst from '../../src/scripts/install.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');

// Mirror the python _Base setUp: a fresh tmp consumer dir with the agent-config
// CLI shim install.py expects to find.
let project: string;
let tmpRoot: string;

beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'install-snap-'));
    project = path.join(tmpRoot, 'consumer');
    fs.mkdirSync(project);
    const shim = path.join(project, 'agent-config');
    fs.writeFileSync(shim, '#!/usr/bin/env bash\nexit 0\n');
    fs.chmodSync(shim, 0o755);
});

afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function readJson(rel: string): Record<string, any> {
    return JSON.parse(fs.readFileSync(path.join(project, rel), 'utf8'));
}

describe('Cursor snapshot', () => {
    // `.cursor/hooks.json` is locked to `version: 1` + event-keyed arrays of
    // `{command: "<sh>"}` entries that invoke the dispatcher via
    // `./agent-config dispatch:hook`.
    it('writes the locked per-event dispatcher shape', () => {
        inst.ensure_cursor_bridge(project, false);
        const data = readJson('.cursor/hooks.json');
        expect(data['version']).toBe(1);
        const hooks = data['hooks'];
        const boundNative = new Set(inst.CURSOR_DISPATCHER_BINDINGS.map(([, n]) => n));
        expect(new Set(Object.keys(hooks))).toEqual(boundNative);
        for (const [acEvent, native] of inst.CURSOR_DISPATCHER_BINDINGS) {
            expect(hooks[native]).toHaveLength(1);
            const cmd: string = hooks[native][0]['command'];
            expect(cmd).toContain('./agent-config dispatch:hook');
            expect(cmd).toContain('--platform cursor');
            expect(cmd).toContain(`--event ${acEvent}`);
            expect(cmd).toContain(`--native-event ${native}`);
        }
    });
});

describe('Cline snapshot', () => {
    // One executable script per binding under `.clinerules/hooks/<HookName>`.
    // Filename = native event name; body invokes
    // `./agent-config dispatch:hook --platform cline`.
    it('writes one executable script per binding, body invokes the dispatcher', () => {
        inst.ensure_cline_bridge(project, false);
        const hooksDir = path.join(project, '.clinerules', 'hooks');
        const boundNative = new Set(inst.CLINE_DISPATCHER_BINDINGS.map(([, n]) => n));
        const onDisk = new Set(
            fs
                .readdirSync(hooksDir)
                .filter((n) => fs.statSync(path.join(hooksDir, n)).isFile()),
        );
        expect(onDisk).toEqual(boundNative);
        for (const [acEvent, native] of inst.CLINE_DISPATCHER_BINDINGS) {
            const script = path.join(hooksDir, native);
            expect(fs.statSync(script).mode & 0o111).not.toBe(0);
            const body = fs.readFileSync(script, 'utf8');
            expect(body).toContain('./agent-config dispatch:hook');
            expect(body).toContain('--platform cline');
            expect(body).toContain(`--event ${acEvent}`);
            expect(body).toContain(`--native-event ${native}`);
        }
    });
});

describe('Windsurf snapshot', () => {
    // `.windsurf/hooks.json` — one entry per binding pointing at the dispatcher
    // via the agent-config CLI, each with `show_output: false`.
    it('writes one show_output:false dispatcher entry per binding', () => {
        inst.ensure_windsurf_bridge(project, false);
        const data = readJson('.windsurf/hooks.json');
        const hooks = data['hooks'];
        const boundNative = new Set(inst.WINDSURF_DISPATCHER_BINDINGS.map(([, n]) => n));
        expect(new Set(Object.keys(hooks))).toEqual(boundNative);
        for (const [acEvent, native] of inst.WINDSURF_DISPATCHER_BINDINGS) {
            const entries = hooks[native];
            expect(entries).toHaveLength(1);
            const entry = entries[0];
            expect(entry['show_output']).toBe(false);
            const cmd: string = entry['command'];
            expect(cmd).toContain('./agent-config dispatch:hook');
            expect(cmd).toContain('--platform windsurf');
            expect(cmd).toContain(`--event ${acEvent}`);
            expect(cmd).toContain(`--native-event ${native}`);
        }
    });
});

describe('Gemini snapshot', () => {
    // `.gemini/settings.json` uses the nested
    // `hooks → EventName → [{matcher, hooks: [{type, command}]}]` shape.
    it('writes the nested matcher/command group shape', () => {
        inst.ensure_gemini_bridge(project, false);
        const data = readJson('.gemini/settings.json');
        const hooks = data['hooks'];
        const boundNative = new Set(inst.GEMINI_DISPATCHER_BINDINGS.map(([, n]) => n));
        for (const n of boundNative) {
            expect(Object.keys(hooks)).toContain(n);
        }
        for (const [acEvent, native, matcher] of inst.GEMINI_DISPATCHER_BINDINGS) {
            const groups = hooks[native];
            expect(groups).toHaveLength(1);
            const group = groups[0];
            expect(group['matcher']).toBe(matcher);
            const entry = group['hooks'][0];
            expect(entry['type']).toBe('command');
            const cmd: string = entry['command'];
            expect(cmd).toContain('./agent-config dispatch:hook');
            expect(cmd).toContain('--platform gemini');
            expect(cmd).toContain(`--event ${acEvent}`);
            expect(cmd).toContain(`--native-event ${native}`);
        }
    });
});

describe('Binding coverage snapshot', () => {
    // Each platform binding table covers the manifest's platform block. Drift
    // between install.ts and scripts/hook_manifest.yaml is the silent-no-op
    // failure mode the orphan check guards on the manifest side; this layer
    // guards from the install side.
    it('bindings cover the manifest events', () => {
        const manifest = parseYaml(fs.readFileSync(MANIFEST, 'utf8')) as Record<string, any>;
        const platforms = (manifest['platforms'] ?? {}) as Record<string, any>;

        const acEvents = (bindings: ReadonlyArray<readonly [string, ...string[]]>): Set<string> =>
            new Set(bindings.map((b) => b[0]));

        const cases: Array<[string, ReadonlyArray<readonly [string, ...string[]]>]> = [
            ['cursor', inst.CURSOR_DISPATCHER_BINDINGS],
            ['cline', inst.CLINE_DISPATCHER_BINDINGS],
            ['windsurf', inst.WINDSURF_DISPATCHER_BINDINGS],
            ['gemini', inst.GEMINI_DISPATCHER_BINDINGS],
        ];

        for (const [platform, bindings] of cases) {
            const manifestEvents = new Set(
                Object.keys(platforms[platform] ?? {}).filter((e) => e !== 'fallback_only'),
            );
            const bound = acEvents(bindings);
            for (const ev of manifestEvents) {
                expect(
                    bound.has(ev),
                    `${platform}: manifest event ${ev} not covered by install bindings ${[...bound].join(', ')}`,
                ).toBe(true);
            }
        }
    });
});
