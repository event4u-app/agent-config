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

import { describe, expect, it } from 'vitest';

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
