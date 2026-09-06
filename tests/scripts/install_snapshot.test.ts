// Install-output snapshot tests for src/scripts/install.ts — the TS twin of
// tests/hooks/test_install_snapshot.py (the SPEC). PURE-TS: no python, no
// snapshot oracle. Two behaviors are frozen here:
//
//   1. Per-platform install output — drive `ensure_<platform>_bridge(...)`
//      against a tmp project dir and assert the written bridge file CONTENTS
//      match the expected per-platform strings (frozen INLINE as committed
//      fixtures, ported from the python snapshot expectations).
//   2. Drift guard — each platform's `host_lowering.yaml` slot list must cover
//      the `src/scripts/hook_manifest.yaml` platform block (manifest events ⊆
//      table slots), the silent-no-op failure mode the parser guards.
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
import type { JsonObject, JsonValue } from '../../src/scripts/hooks/dispatch_hook.js';
import {
    _resetHostLoweringCache,
    hostBindings,
    loadHostLowering,
    parseHostLowering,
} from '../../src/scripts/hooks/host_lowering.js';

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

/**
 * Read a generated bridge. The shape differs per host, so the return type is
 * the loose JSON record the dispatcher already defines rather than a per-host
 * interface — these assertions exist to catch a drifted BRIDGE, and a hand-kept
 * mirror of each host's shape would be a second thing to drift.
 */
function readJson(rel: string): JsonObject {
    return JSON.parse(fs.readFileSync(path.join(project, rel), 'utf8')) as JsonObject;
}

/** Narrow one bridge entry group to the array of objects it always is here. */
function groupsOf(v: JsonValue | undefined): JsonObject[] {
    return (v ?? []) as JsonObject[];
}

describe('Cursor snapshot', () => {
    // `.cursor/hooks.json` is locked to `version: 1` + event-keyed arrays of
    // `{command: "<sh>"}` entries that invoke the dispatcher via
    // `./agent-config dispatch:hook`.
    it('writes the locked per-event dispatcher shape', () => {
        inst.ensure_cursor_bridge(project, false);
        const data = readJson('.cursor/hooks.json');
        expect(data['version']).toBe(1);
        const hooks = data['hooks'] as JsonObject;
        const boundNative = new Set(hostBindings('cursor').map((b) => b.native));
        expect(new Set(Object.keys(hooks))).toEqual(boundNative);
        for (const { slot: acEvent, native } of hostBindings('cursor')) {
            expect(groupsOf(hooks[native])).toHaveLength(1);
            const cmd = String(groupsOf(hooks[native])[0]?.['command']);
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
        const boundNative = new Set(hostBindings('cline').map((b) => b.native));
        const onDisk = new Set(
            fs
                .readdirSync(hooksDir)
                .filter((n) => fs.statSync(path.join(hooksDir, n)).isFile()),
        );
        expect(onDisk).toEqual(boundNative);
        for (const { slot: acEvent, native } of hostBindings('cline')) {
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
        const hooks = data['hooks'] as JsonObject;
        const boundNative = new Set(hostBindings('windsurf').map((b) => b.native));
        expect(new Set(Object.keys(hooks))).toEqual(boundNative);
        for (const { slot: acEvent, native } of hostBindings('windsurf')) {
            const entries = groupsOf(hooks[native]);
            expect(entries).toHaveLength(1);
            const entry = entries[0] as JsonObject;
            expect(entry['show_output']).toBe(false);
            const cmd = String(entry['command']);
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
        const hooks = data['hooks'] as JsonObject;
        const boundNative = new Set(hostBindings('gemini').map((b) => b.native));
        for (const n of boundNative) {
            expect(Object.keys(hooks)).toContain(n);
        }
        for (const { slot: acEvent, native, matcher } of hostBindings('gemini')) {
            const groups = groupsOf(hooks[native]);
            expect(groups).toHaveLength(1);
            const group = groups[0] as JsonObject;
            expect(group['matcher']).toBe(matcher);
            const entry = (group['hooks'] as JsonObject[])[0] as JsonObject;
            expect(entry['type']).toBe('command');
            const cmd = String(entry['command']);
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
        const manifest = parseYaml(fs.readFileSync(MANIFEST, 'utf8')) as JsonObject;
        const platforms = (manifest['platforms'] ?? {}) as JsonObject;

        for (const platform of ['augment', 'cursor', 'cline', 'windsurf', 'gemini']) {
            const manifestEvents = new Set(
                Object.keys((platforms[platform] ?? {}) as JsonObject).filter((e) => e !== 'fallback_only'),
            );
            const bound = new Set(hostBindings(platform).map((b) => b.slot));
            for (const ev of manifestEvents) {
                expect(
                    bound.has(ev),
                    `${platform}: manifest event ${ev} not covered by host_lowering.yaml slots ${[...bound].join(', ')}`,
                ).toBe(true);
            }
        }
    });
});

describe('Install smoke probe derivation', () => {
    // 1.4 / AC-6. The probe list used to be hand-written and named an event no
    // bridge writes, so it could not fail on the regression it exists to catch.
    afterEach(() => {
        _resetHostLoweringCache();
    });

    it('probes only events the table actually binds', () => {
        for (const [platform, native] of inst.smokeProbeEvents()) {
            expect(
                hostBindings(platform).map((b) => b.native),
                `${platform}: probed native event ${native} is not bound`,
            ).toContain(native);
        }
    });

    it('fails when the probed binding is removed from the table', () => {
        const raw = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'host_lowering.yaml'),
            'utf8',
        );
        const sabotaged = parseHostLowering(raw);
        sabotaged.get('cursor')!.get('any')!.slots.delete('session_start');
        _resetHostLoweringCache(sabotaged);
        expect(() => inst.smokeProbeEvents()).toThrow(/no `session_start` binding for `cursor`/);

        _resetHostLoweringCache(parseHostLowering(raw));
        expect(() => inst.smokeProbeEvents()).not.toThrow();
    });

    it('loads the committed table', () => {
        expect(loadHostLowering().size).toBeGreaterThan(0);
    });
});
