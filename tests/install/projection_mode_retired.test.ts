/**
 * road-to-a-setup-that-decides-itself step 4.7 — `projection.mode` is retired
 * (owner answer OQ-1, 2026-10-24, option 1).
 *
 * Skill and command scope at a global install is decided per host: a host with
 * a listing lever gets every artefact and scopes by visibility (claude-code's
 * `skillOverrides`, codex's finder index); every other host gets the active
 * profile's packs. The full-surface guarantee on hosts without a lever is
 * retired, and so is the `legacy-all` pseudo-profile.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    LISTING_LEVER_HOSTS,
    compute_active_pack_ids,
    load_packs_registry,
    prune_scoped_modules,
    prune_scoped_modules_per_host,
    scopesByProfile,
} from '../../src/scripts/_lib/scoped_projection.js';
import { REMOVED_KEYS } from '../../src/scripts/_lib/settings_removed_keys.js';
import { main as useProfile } from '../../src/scripts/profile_use.js';

const REPO = path.resolve(__dirname, '..', '..');
const SKILLS = path.join(REPO, 'dist', 'agent-src', 'skills');
const NAMES = fs.readdirSync(SKILLS).filter((d) => fs.existsSync(path.join(SKILLS, d, 'SKILL.md')));
const ACTIVE = compute_active_pack_ids(load_packs_registry(REPO), []);

type Tuple = [number, number, string, string[]];
const scratch: string[] = [];
afterEach(() => {
    for (const d of scratch.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/**
 * A deploy result per tool over a SCRATCH copy of the skill tree: the prune
 * deletes the directories it drops, so it must never be pointed at the repo.
 */
function results(tools: readonly string[]): Record<string, Tuple> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mode-retired-deploy-'));
    scratch.push(root);
    return Object.fromEntries(
        tools.map((t) => {
            const paths = NAMES.map((n) => {
                const dest = path.join(root, t, 'skills', n, 'SKILL.md');
                fs.mkdirSync(path.dirname(dest), { recursive: true });
                fs.copyFileSync(path.join(SKILLS, n, 'SKILL.md'), dest);
                return dest;
            });
            return [t, [paths.length, 0, 'deployed', paths] as Tuple];
        }),
    );
}

describe('scope is per host, not a setting', () => {
    it('the two hosts with a listing lever scope by visibility; every other host by profile', () => {
        expect([...LISTING_LEVER_HOSTS].sort()).toEqual(['claude-code', 'codex']);
        expect(scopesByProfile('claude-code')).toBe(false);
        expect(scopesByProfile('codex')).toBe(false);
        for (const host of ['cursor', 'cline', 'windsurf', 'augment', 'gemini-cli']) expect(scopesByProfile(host)).toBe(true);
    });

    it('a lever host keeps every artefact; a host without one is pruned exactly as the profile prune does', () => {
        const both = results(['claude-code', 'cursor']);
        const claudeBefore = [...(both['claude-code']?.[3] ?? [])];
        const [pruned, out] = prune_scoped_modules_per_host(both, ACTIVE);
        expect(out['claude-code']?.[3]).toEqual(claudeBefore);
        expect(claudeBefore.every((p) => fs.existsSync(p))).toBe(true);
        const [alone, cursorOnly] = prune_scoped_modules(results(['cursor']), ACTIVE);
        expect(alone).toBeGreaterThan(0);
        expect(pruned).toBe(alone);
        const names = (t: Tuple | undefined): string[] => (t?.[3] ?? []).map((p) => path.basename(path.dirname(p))).sort();
        expect(names(out['cursor'])).toEqual(names(cursorOnly['cursor']));
    });
});

describe('the key is gone, with a tombstone', () => {
    it('neither the template nor the schema carries projection.mode', () => {
        const template = fs.readFileSync(path.join(REPO, 'src/config/agent-settings.template.yml'), 'utf8');
        expect(template).not.toMatch(/^projection:\s*\n\s+mode:/m);
        expect(fs.readFileSync(path.join(REPO, 'src/server/schemas/settings.ts'), 'utf8')).not.toContain('projectionMode.default');
    });

    it('REMOVED_KEYS names the per-host decision', () => {
        expect(REMOVED_KEYS.get('projection.mode')).toContain('listing lever');
    });
});

describe('`use --profile` no longer writes a projection mode', () => {
    const temps: string[] = [];
    const prev = process.cwd();
    afterEach(() => {
        process.chdir(prev);
        for (const d of temps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
    });
    const root = (): string => {
        const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mode-retired-')));
        temps.push(d);
        process.chdir(d);
        return d;
    };
    const quiet = <T>(fn: () => T): T => {
        const out = process.stdout.write.bind(process.stdout);
        const err = process.stderr.write.bind(process.stderr);
        process.stdout.write = (() => true) as typeof process.stdout.write;
        process.stderr.write = (() => true) as typeof process.stderr.write;
        try {
            return fn();
        } finally {
            process.stdout.write = out;
            process.stderr.write = err;
        }
    };

    it('a real profile records profile.id only', () => {
        const d = root();
        expect(quiet(() => useProfile(['--profile', 'founder']))).toBe(0);
        const text = fs.readFileSync(path.join(d, 'agents/settings/.agent-settings.yml'), 'utf8');
        expect(text).toContain('id: founder');
        expect(text).not.toContain('mode:');
    });

    it('the legacy-all pseudo-profile is gone: exit 2, nothing written', () => {
        const d = root();
        expect(quiet(() => useProfile(['--profile', 'legacy-all']))).toBe(2);
        expect(fs.existsSync(path.join(d, 'agents/settings/.agent-settings.yml'))).toBe(false);
    });
});
