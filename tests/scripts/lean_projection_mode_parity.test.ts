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
    leanProjectionModeChosen,
    rawExplicitLeanProjectionMode,
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

describe('the template states the shipped answer, and the test states it too', () => {
    it('the template ships delivery on claude-code — asserted on the FILE, not on a constant', () => {
        // If this ever fails, the expectations in every case below are stale and
        // must be re-derived rather than patched. Reading the file is the point:
        // a test that compared the resolver against a constant it also owns
        // would pass whatever the shipped default became.
        const text = fs.readFileSync(TEMPLATE, 'utf-8');
        expect(text).toMatch(/^lean_projection:\s*$/m);
        expect(text).toMatch(/^\s{2}mode:\s*delivery\s*$/m);
        expect(text).toMatch(/^\s{2}hosts:\s*\[claude-code\]\s*$/m);
    });
});

describe('resolveLeanProjection — one answer per layer state (1.2)', () => {
    it('no settings file anywhere resolves to the TEMPLATE value, not the parser fallback', () => {
        const root = tree();
        const r = resolve(root);
        expect(r.mode).toBe('delivery');
        expect(r.hosts.hosts).toEqual(['claude-code']);
    });

    it('with no package root the template cannot be found and the fallback stands', () => {
        // Stated rather than hidden: `agent_settings.default_template_path()`
        // derives the package from `import.meta.url` three dirs up, which is
        // the PARENT of the package inside the composed hook bundle. A caller
        // that cannot name the package root gets `eager-all` — safe, and the
        // reason the carrier passes one.
        const root = tree();
        const r = resolve(root, null);
        expect(['delivery', 'eager-all']).toContain(r.mode);
    });

    it('the CANONICAL file the installer writes is read — and the old reader missed it', () => {
        const root = tree();
        write(root, ['agents', 'settings', '.agent-settings.yml'],
            'lean_projection:\n  mode: eager-all\n');
        expect(resolve(root).mode).toBe('eager-all');

        // The defect itself, pinned rather than described. `leanProjectionModeRaw`
        // is the reader the carrier used before 1.2 and is still the reader two
        // CLI gates use; it opens `<root>/.agent-settings.yml` and nothing else.
        // On this tree — which is the shape `install.ts` actually produces — it
        // finds nothing, which normalised to `eager-all` and closed the delivery
        // gate on every install. If a later change makes this assertion fail,
        // that reader has grown a cascade and the two can drift again.
        expect(leanProjectionModeRaw(root)).toBe('');
    });

    it('the LEGACY root file is read', () => {
        const root = tree();
        write(root, ['.agent-settings.yml'], 'lean_projection:\n  mode: thin\n');
        expect(resolve(root).mode).toBe('thin');
    });

    it('canonical wins over legacy when a tree carries both', () => {
        const root = tree();
        write(root, ['.agent-settings.yml'], 'lean_projection:\n  mode: thin\n');
        write(root, ['agents', 'settings', '.agent-settings.yml'],
            'lean_projection:\n  mode: eager-all\n');
        expect(resolve(root).mode).toBe('eager-all');
    });

    it('a configured hosts list narrows, and an unknown id is dropped rather than enrolled', () => {
        const root = tree();
        write(root, ['agents', 'settings', '.agent-settings.yml'],
            'lean_projection:\n  mode: delivery\n  hosts: [cursor, nonesuch]\n');
        const r = resolve(root);
        expect(r.mode).toBe('delivery');
        expect(r.hosts.hosts).toEqual(['cursor']);
        expect(r.hosts.dropped.map((d) => d.id)).toEqual(['nonesuch']);
    });

    it('an unspellable mode is the safe fallback, never a silent thinning', () => {
        const root = tree();
        write(root, ['agents', 'settings', '.agent-settings.yml'],
            'lean_projection:\n  mode: delivry\n');
        expect(resolve(root).mode).toBe('eager-all');
    });

    it('a malformed settings file never throws — a hook must not fail a turn', () => {
        const root = tree();
        write(root, ['agents', 'settings', '.agent-settings.yml'], 'lean_projection:\n  mode: [\n');
        expect(() => resolve(root)).not.toThrow();
    });

    it('an explicit settingsPath overrides projectRoot — the projector pins its own file', () => {
        const root = tree();
        write(root, ['.agent-settings.yml'], 'lean_projection:\n  mode: thin\n');
        const other = tree();
        write(other, ['pinned.yml'], 'lean_projection:\n  mode: eager-all\n');
        _reset_template_defaults_cache();
        const r = resolveLeanProjection({
            settingsPath: path.join(other, 'pinned.yml'),
            packageRoot: REPO_ROOT,
        });
        expect(r.mode).toBe('eager-all');
    });
});

// ---------------------------------------------------------------------------
// Provenance — "did a HUMAN ask for this", which `mode` cannot answer.
//
// Step 1.1 of `road-to-an-installed-layer-that-is-thinned` keys the installer
// on `lean_projection.mode: delivery` "set on a layer OTHER than the shipped
// template", and the reason is in that roadmap's Context: the template already
// ships `delivery`, so an installer that merely resolved the mode would thin
// every consumer the day it started reading it — a consumer-facing default flip
// nobody decided, while the decision itself is owner-reserved (blocker
// `default-flip-of-the-installed-layer`).
//
// The first case below is therefore the whole point: template says `delivery`,
// user said nothing, and the answer must be "not chosen".
// ---------------------------------------------------------------------------

describe('resolveLeanProjection — provenance, so a template value is never read as consent', () => {
    it('the TEMPLATE saying delivery is NOT explicit, and is not a choice of delivery', () => {
        const root = tree();
        _reset_template_defaults_cache();
        const r = resolveLeanProjection({ projectRoot: root, packageRoot: REPO_ROOT });
        // The mode resolves to the template value — unchanged, and the carrier
        // depends on it.
        expect(r.mode).toBe('delivery');
        // and it is nonetheless not a decision anyone took
        expect(r.modeExplicit).toBe(false);
        expect(leanProjectionModeChosen('delivery', { projectRoot: root })).toBe(false);
        expect(rawExplicitLeanProjectionMode({ projectRoot: root })).toBe('');
    });

    it('a project layer saying delivery IS explicit, and IS a choice of delivery', () => {
        const root = tree();
        write(root, ['.agent-settings.yml'], 'lean_projection:\n  mode: delivery\n');
        _reset_template_defaults_cache();
        expect(
            resolveLeanProjection({ projectRoot: root, packageRoot: REPO_ROOT }).modeExplicit,
        ).toBe(true);
        expect(leanProjectionModeChosen('delivery', { projectRoot: root })).toBe(true);
    });

    it('the CANONICAL layer the installer writes counts, not only the legacy root file', () => {
        // The installer writes `agents/settings/.agent-settings.yml`. A
        // provenance reader that only opened the legacy root path would call
        // every real install "not explicit" — the same which-file defect step
        // 1.2 removed, reintroduced one question later.
        const root = tree();
        write(root, ['agents', 'settings', '.agent-settings.yml'], 'lean_projection:\n  mode: delivery\n');
        _reset_template_defaults_cache();
        expect(leanProjectionModeChosen('delivery', { projectRoot: root })).toBe(true);
    });

    it('explicit eager-all is explicit, and is NOT a choice of delivery', () => {
        // The case that makes `modeExplicit` insufficient on its own: a human
        // who explicitly asked for the full layer has set the key, and must not
        // be thinned because the key is set.
        const root = tree();
        write(root, ['.agent-settings.yml'], 'lean_projection:\n  mode: eager-all\n');
        _reset_template_defaults_cache();
        expect(
            resolveLeanProjection({ projectRoot: root, packageRoot: REPO_ROOT }).modeExplicit,
        ).toBe(true);
        expect(leanProjectionModeChosen('delivery', { projectRoot: root })).toBe(false);
        expect(leanProjectionModeChosen('eager-all', { projectRoot: root })).toBe(true);
    });

    it('an unrecognised explicit value is explicit but chooses nothing it did not say', () => {
        const root = tree();
        write(root, ['.agent-settings.yml'], 'lean_projection:\n  mode: banana\n');
        _reset_template_defaults_cache();
        expect(
            resolveLeanProjection({ projectRoot: root, packageRoot: REPO_ROOT }).modeExplicit,
        ).toBe(true);
        // `banana` normalises to the safe value, so it chooses eager-all and
        // emphatically not delivery.
        expect(leanProjectionModeChosen('delivery', { projectRoot: root })).toBe(false);
    });

    it('provenance does not depend on a package root being findable', () => {
        // The installer may resolve provenance before it has decided anything
        // about the template. With no package root the MODE falls back, and the
        // explicit answer must still be the user's.
        const root = tree();
        write(root, ['.agent-settings.yml'], 'lean_projection:\n  mode: delivery\n');
        _reset_template_defaults_cache();
        expect(resolveLeanProjection({ projectRoot: root, packageRoot: null }).modeExplicit).toBe(
            true,
        );
    });
});
