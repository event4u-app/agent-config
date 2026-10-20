// ONE resolver for `lean_projection`, across every layer and every reader
// (`road-to-a-rule-carrier-that-works-outside-the-repo` step 1.2, decision D3).
//
// WHAT THIS PINS, and why each case is here rather than being obvious:
//
// The carrier used to read `<cwd>/.agent-settings.yml` and nothing else, while
// the installer WRITES `<root>/agents/settings/.agent-settings.yml` and the
// projector read the full cascade. So on a normal install the carrier opened a
// file that does not exist, resolved `eager-all`, and closed its own gate — the
// pointer arm reached by configuration rather than by choice, and a second
// independent cause of the silence step 1.1 repaired.
//
// Every case below therefore states the EXPECTED answer for one layer state
// before any code is consulted, which is what the roadmap's risk 2 ("making the
// hook agree with the projector could also move the projector") asks for.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _reset_template_defaults_cache } from '../../src/scripts/_lib/agent_settings.js';
import { leanProjectionModeRaw } from '../../src/scripts/_lib/hook_settings.js';
import {
    resolveLeanProjection,
    type ResolvedLeanProjection,
} from '../../src/scripts/_lib/lean_projection_mode.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
/** The shipped template — the base layer every real layer sits on. */
const TEMPLATE = path.join(REPO_ROOT, 'src', 'config', 'agent-settings.template.yml');

function tree(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'lean-parity-'));
}

/**
 * The USER-GLOBAL layer is pinned to an empty temp root for every case here.
 *
 * Without this, "no settings file anywhere" is false on any machine whose
 * `~/.event4u/agent-config/settings/.agent-settings.yml` carries a
 * `lean_projection` block — `resolveLeanProjection` reads the full cascade by
 * design, and the developer's own file is part of it. The cases below each
 * state a layer state and then assert the answer for it, so a layer the case
 * did not write must not be present; otherwise the suite measures the machine
 * it runs on and quietly disagrees between a laptop and a CI runner.
 *
 * It did not fail before only because `MERGEABLE_KEYS` filtered the key out of
 * the user-global layer entirely — a filter that was itself the defect
 * `road-to-an-installed-layer-that-is-thinned` step 1.1 had to repair, since a
 * global-only install has no other layer to carry the opt-in. Removing the
 * filter made the missing isolation visible rather than creating it.
 */
let _savedEvent4uHome: string | undefined;
let _isolatedHome: string;

beforeEach(() => {
    _isolatedHome = fs.mkdtempSync(path.join(os.tmpdir(), 'lean-parity-home-'));
    _savedEvent4uHome = process.env['EVENT4U_CONFIG_HOME'];
    process.env['EVENT4U_CONFIG_HOME'] = _isolatedHome;
});

afterEach(() => {
    if (_savedEvent4uHome === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
    else process.env['EVENT4U_CONFIG_HOME'] = _savedEvent4uHome;
    fs.rmSync(_isolatedHome, { recursive: true, force: true });
});

function write(root: string, rel: string[], body: string): void {
    const p = path.join(root, ...rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf-8');
}

/** Resolve a tree, with the template cache dropped so each case reads it fresh. */
function resolve(root: string, packageRoot: string | null = REPO_ROOT): ResolvedLeanProjection {
    _reset_template_defaults_cache();
    return resolveLeanProjection({ projectRoot: root, packageRoot });
}

describe('the template no longer states an answer, and the test states that', () => {
    it('the shipped template carries no projection key at all — asserted on the FILE', () => {
        // ADR-292. Reading the file is still the point: the expectations below
        // are derived from what the template says, so if a key ever comes back
        // they are stale and must be re-derived rather than patched.
        const text = fs.readFileSync(TEMPLATE, 'utf-8');
        expect(text).not.toMatch(/^lean_projection:\s*$/m);
        expect(text).not.toMatch(/^\s{2}mode:\s*delivery\s*$/m);
    });
});

// ---------------------------------------------------------------------------
// ADR-292 removed `lean_projection.*`, and with it the CASCADE this block used
// to pin. Each case below is its predecessor inverted: the layer that used to
// decide the answer is still written, and the answer must not move. That is the
// sensitive direction — a cascade read coming back would red here — and it is
// what makes the key's tombstone line ("ignored") true for this reader rather
// than only for the docs. What decides instead is the package-owned record in
// `project-tree-form.json`, read through `packageRoot`.
// ---------------------------------------------------------------------------

describe('resolveLeanProjection — no settings layer moves the answer (ADR-292)', () => {
    it('this repository\'s own record is what a packageRoot resolves to', () => {
        const root = tree();
        expect(resolve(root).mode).toBe('delivery');
        expect(resolve(root).hosts.hosts).toEqual(['claude-code']);
    });

    it('with no package root there is no record to read, and the full form stands', () => {
        const root = tree();
        expect(resolve(root, null).mode).toBe('eager-all');
    });

    it('the CANONICAL file the installer writes no longer moves it', () => {
        const root = tree();
        write(root, ['agents', 'settings', '.agent-settings.yml'],
            'lean_projection:\n  mode: eager-all\n');
        expect(resolve(root).mode).toBe('delivery');
        // `leanProjectionModeRaw` is the OTHER reader — the one two CLI gates
        // still use. It opens `<root>/.agent-settings.yml` and nothing else, so
        // it finds nothing here, exactly as before. Pinned so the two readers
        // cannot quietly start disagreeing again.
        expect(leanProjectionModeRaw(root)).toBe('');
    });

    it('the LEGACY root file no longer moves it', () => {
        const root = tree();
        write(root, ['.agent-settings.yml'], 'lean_projection:\n  mode: thin\n');
        expect(resolve(root).mode).toBe('delivery');
    });

    it('a tree carrying BOTH files is still unmoved', () => {
        const root = tree();
        write(root, ['.agent-settings.yml'], 'lean_projection:\n  mode: thin\n');
        write(root, ['agents', 'settings', '.agent-settings.yml'],
            'lean_projection:\n  mode: eager-all\n');
        expect(resolve(root).mode).toBe('delivery');
    });

    it('a hosts list written by hand enrols nobody', () => {
        const root = tree();
        write(root, ['agents', 'settings', '.agent-settings.yml'],
            'lean_projection:\n  mode: delivery\n  hosts: [cursor, nonesuch]\n');
        const r = resolve(root);
        // `cursor` is the sensitive id: before ADR-292 this read `['cursor']`.
        expect(r.hosts.hosts).toEqual(['claude-code']);
        expect(r.hosts.dropped).toEqual([]);
    });

    it('a malformed settings file never throws — a hook must not fail a turn', () => {
        const root = tree();
        write(root, ['agents', 'settings', '.agent-settings.yml'], 'lean_projection:\n  mode: [\n');
        expect(() => resolve(root)).not.toThrow();
    });

    it('an explicit settingsPath is accepted and ignored — no caller has to change', () => {
        const other = tree();
        write(other, ['pinned.yml'], 'lean_projection:\n  mode: thin\n');
        _reset_template_defaults_cache();
        const r = resolveLeanProjection({
            settingsPath: path.join(other, 'pinned.yml'),
            packageRoot: REPO_ROOT,
        });
        expect(r.mode).toBe('delivery');
    });
});

// ---------------------------------------------------------------------------
// Provenance — "did a HUMAN ask for this", which `mode` cannot answer.
//
// Step 1.1 of `road-to-an-installed-layer-that-is-thinned` keyed the installer
// on `lean_projection.mode: delivery` "set on a layer OTHER than the shipped
// template", because the template already shipped `delivery` and an installer
// that merely resolved the mode would have thinned every consumer the day it
// started reading it.
//
// ADR-292 answers that question by removing the thing it was about. There is no
// layer a human can write the key on that any reader consults, so provenance is
// the constant `false` — and the cases below pin it against the exact layers
// that used to make it `true`, which is the direction a regression would come
// back from.
// ---------------------------------------------------------------------------

describe('resolveLeanProjection — provenance is constant false, because no layer carries consent', () => {
    it('a package-owned record is not a consumer choice', () => {
        const root = tree();
        _reset_template_defaults_cache();
        const r = resolveLeanProjection({ projectRoot: root, packageRoot: REPO_ROOT });
        expect(r.mode).toBe('delivery');
        expect(r.modeExplicit).toBe(false);
    });

    it('a project layer saying delivery is NOT a choice of delivery any more', () => {
        const root = tree();
        write(root, ['.agent-settings.yml'], 'lean_projection:\n  mode: delivery\n');
        _reset_template_defaults_cache();
        // Before ADR-292 this read `true`. It is the sensitive case: a `true`
        // here would mean a hand-written leftover had become consent again.
        expect(resolveLeanProjection({ projectRoot: root, packageRoot: REPO_ROOT }).modeExplicit).toBe(false);
    });

    it('the CANONICAL layer the installer writes is not consent either', () => {
        const root = tree();
        write(root, ['agents', 'settings', '.agent-settings.yml'],
            'lean_projection:\n  mode: delivery\n');
        _reset_template_defaults_cache();
        expect(resolveLeanProjection({ projectRoot: root, packageRoot: REPO_ROOT }).modeExplicit).toBe(false);
    });

    it('provenance does not depend on a package root being findable', () => {
        const root = tree();
        write(root, ['.agent-settings.yml'], 'lean_projection:\n  mode: delivery\n');
        expect(resolveLeanProjection({ projectRoot: root, packageRoot: null }).modeExplicit).toBe(false);
    });
});
