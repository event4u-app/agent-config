/**
 * Profiles-as-views resolver (6.0.0-D Step 14/15).
 *
 * A profile is commands→profile aggregation: `src/profiles/<id>.yaml` declares
 * a curated `view` (the focused default command set) plus the `packs` whose
 * full command set `--expanded` adds. The curated tree is RENDERED here, never
 * stored. Built-in profiles are immutable in 6.0 (ADR-044 / road-to-6.0.0-D
 * Step 14); a consumer file of the same id does NOT override the built-in.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { PROFILES_DIR } from '../paths.js';
import type { DiscoveryArtefact } from '../discovery/loadManifest.js';

export interface ProfileView {
    readonly id: string;
    readonly label?: string;
    readonly immutable: boolean;
    readonly packs: readonly string[];
    readonly view: readonly string[];
}

interface RawProfileFile {
    profile?: {
        id?: unknown;
        label?: unknown;
        immutable?: unknown;
        packs?: unknown;
        view?: unknown;
    };
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Load a built-in profile view, or `null` if no such profile exists. */
export function loadProfile(id: string): ProfileView | null {
    // Guard against path traversal — ids are flat slugs.
    if (!/^[a-z][a-z0-9_-]*$/.test(id)) return null;
    const file = resolve(PROFILES_DIR, `${id}.yaml`);
    if (!existsSync(file)) return null;
    let raw: RawProfileFile;
    try {
        raw = (yamlLoad(readFileSync(file, 'utf8')) ?? {}) as RawProfileFile;
    } catch {
        return null;
    }
    const p = raw.profile;
    if (!p || typeof p.id !== 'string') return null;
    return {
        id: p.id,
        ...(typeof p.label === 'string' ? { label: p.label } : {}),
        immutable: p.immutable === true,
        packs: asStringArray(p.packs),
        view: asStringArray(p.view),
    };
}

/** The canonical invocation slug for a manifest command (path-derived). */
function slugOf(cmd: DiscoveryArtefact): string {
    return cmd.slug ?? cmd.name ?? '';
}

/**
 * Resolve the command set a profile surfaces.
 *
 * - default (`expanded = false`): exactly the curated `view`, in declared
 *   order, intersected with the live command surface (a view entry with no
 *   matching command is silently dropped — the manifest is the source of truth).
 * - `expanded = true`: the curated view first, then every other command whose
 *   owning pack is in the profile's `packs`, name-sorted. De-duplicated.
 */
export function resolveProfileView(
    profile: ProfileView,
    commands: readonly DiscoveryArtefact[],
    opts: { expanded?: boolean } = {},
): DiscoveryArtefact[] {
    const bySlug = new Map<string, DiscoveryArtefact>();
    for (const c of commands) bySlug.set(slugOf(c), c);

    const curated: DiscoveryArtefact[] = [];
    const seen = new Set<string>();
    for (const slug of profile.view) {
        const c = bySlug.get(slug);
        if (c && !seen.has(slug)) {
            curated.push(c);
            seen.add(slug);
        }
    }
    if (!opts.expanded) return curated;

    const packSet = new Set(profile.packs);
    const extra = commands
        .filter((c) => !seen.has(slugOf(c)) && packSet.has(c.pack ?? ''))
        .sort((a, b) => slugOf(a).localeCompare(slugOf(b)));
    return [...curated, ...extra];
}
