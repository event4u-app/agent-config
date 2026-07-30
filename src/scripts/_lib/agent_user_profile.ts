#!/usr/bin/env tsx
/**
 * Two-layer cascade for the user-persona profile (ADR-138,
 * road-to-global-user-memory Phase 1 — read path only).
 *
 * Layers, weakest first:
 *
 *   1. Global  — `~/.event4u/agent-config/user/profile.md` (this package's
 *      vendor-namespaced root; `$EVENT4U_CONFIG_HOME` override honoured,
 *      legacy `~/.config/agent-config/` read as a fallback — see
 *      `user_global_paths.ts`).
 *   2. Project — `.agent-user.md` at the project root (unchanged; the sole
 *      layer before this phase — see `docs/contracts/agent-user-schema.md`).
 *
 * Merge rule: the authoring discipline is DISJOINT FIELDS (global owns
 * durable identity/style, project owns project-specific addenda). The
 * mechanism for when a field is declared in both anyway is
 * PRIMITIVE-LEVEL DEEPEST-WINS — the project value replaces the global
 * value outright, never an object/array merge. `notes` is the one
 * exception: both layers' text is concatenated under `[global]` /
 * `[project]` markers so neither voice is dropped.
 *
 * The 100-line cap (`docs/contracts/agent-user-schema.md`) applies PER
 * LAYER, never as a shared total — a shared cap would force deleting
 * global identity to make room for project context.
 *
 * Parsing reuses `parseLegacyUserMd` from `shared/userMd/utils.ts` — the
 * same fenced-frontmatter-plus-body parser the wizard's legacy-read path
 * already uses for `.agent-user.md`, so both layers are read identically.
 *
 * Pure, read-only. Never writes, never creates directories.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { composeLegacyUserMd, parseLegacyUserMd } from '../../shared/userMd/utils.js';
import * as revocations from './user_global_revocations.js';
import type { RevocationEntry } from './user_global_revocations.js';
import * as user_global_paths from './user_global_paths.js';
import { recordObservationAccepted } from './user_memory_gate_counters.js';

/** Relative-to-root path of the global profile (weakest layer). */
export const GLOBAL_PROFILE_RELATIVE = path.join('user', 'profile.md');

/** Hard cap, enforced per layer independently (see module docstring). */
export const USER_PROFILE_LINE_CAP = 100;

export type ProfileSource = 'global' | 'project';

export interface UserProfileLayer {
    source: ProfileSource;
    path: string;
    raw: string;
    data: Record<string, unknown>;
    lineCount: number;
    overCap: boolean;
}

export interface MergedUserProfile {
    /** Merged plain object — only the fields a layer actually declared. */
    profile: Record<string, unknown>;
    /** Dotted-path -> which layer supplied the value (`identity.name`, `style.pace`, ...). */
    sources: Record<string, ProfileSource>;
    /** One entry per layer that exceeds `USER_PROFILE_LINE_CAP`; empty when both are within cap. */
    capWarnings: string[];
}

/**
 * Leaf field paths the cascade resolves individually. `notes` is handled
 * separately (concatenation, not override) and is deliberately absent here.
 */
const KNOWN_LEAF_PATHS: readonly (readonly string[])[] = [
    ['identity', 'name'],
    ['identity', 'nickname'],
    ['language'],
    ['role'],
    ['style', 'pace'],
    ['voice_sample'],
    ['last_updated'],
];

/** Canonical write target for the global profile (Phase 2 writes here; Phase 1 only reads). */
export function globalProfileWriteTarget(env?: user_global_paths.EnvMap | null): string {
    return user_global_paths.write_target(GLOBAL_PROFILE_RELATIVE, { env: env ?? null });
}

/** Resolve the global profile's on-disk path — new namespace first, legacy fallback, `null` if neither exists. */
export function resolveGlobalProfilePath(env?: user_global_paths.EnvMap | null): string | null {
    return user_global_paths.resolve_with_fallback(GLOBAL_PROFILE_RELATIVE, { env: env ?? null });
}

/** Count lines the same way the schema's 100-line cap is defined: whole-file, `\r\n` normalized. */
export function countLines(body: string): number {
    const normalized = body.replace(/\r\n/g, '\n');
    return normalized === '' ? 0 : normalized.split('\n').length;
}

/** Read + parse a single layer file. Returns `null` when the file does not exist. */
export function loadProfileLayer(filePath: string, source: ProfileSource): UserProfileLayer | null {
    let raw: string;
    try {
        raw = fs.readFileSync(filePath, 'utf-8');
    } catch {
        return null;
    }
    const lineCount = countLines(raw);
    return {
        source,
        path: filePath,
        raw,
        data: parseLegacyUserMd(raw),
        lineCount,
        overCap: lineCount > USER_PROFILE_LINE_CAP,
    };
}

/** Load the global (weakest) layer, honouring the new-namespace/legacy-fallback resolution order. */
export function loadGlobalProfileLayer(env?: user_global_paths.EnvMap | null): UserProfileLayer | null {
    const resolved = resolveGlobalProfilePath(env);
    return resolved === null ? null : loadProfileLayer(resolved, 'global');
}

/** Load the project (deepest) layer — `.agent-user.md` directly under `projectRoot`. */
export function loadProjectProfileLayer(projectRoot: string): UserProfileLayer | null {
    return loadProfileLayer(path.join(projectRoot, '.agent-user.md'), 'project');
}

/** Read a dotted leaf path out of a parsed profile object. Exported for the Phase 4 audit render (`user_global_memory_audit.ts`), which enumerates `mergeUserProfileLayers`' `sources` keys back into values. */
export function getPath(obj: Record<string, unknown> | undefined, keys: readonly string[]): unknown {
    let cur: unknown = obj;
    for (const key of keys) {
        if (cur === null || typeof cur !== 'object') return undefined;
        cur = (cur as Record<string, unknown>)[key];
    }
    return cur;
}

export function setPath(obj: Record<string, unknown>, keys: readonly string[], value: unknown): void {
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i += 1) {
        const key = keys[i] as string;
        const next = cur[key];
        if (typeof next !== 'object' || next === null) {
            cur[key] = {};
        }
        cur = cur[key] as Record<string, unknown>;
    }
    cur[keys[keys.length - 1] as string] = value;
}

/** Concatenate `# Notes` bodies with `[global]` / `[project]` markers — only when BOTH sides carry text. */
function mergeNotes(globalNotes: string | undefined, projectNotes: string | undefined): string | undefined {
    const g = globalNotes?.trim();
    const p = projectNotes?.trim();
    if (g && p) {
        return `[global]\n${g}\n\n[project]\n${p}`;
    }
    return p || g || undefined;
}

/**
 * Merge two already-loaded layers per the deepest-wins rule above.
 * Either layer may be `null` (file absent) — the "neither" case returns an
 * empty profile so the existing "agent uses generic address forms"
 * fallback keeps working unchanged.
 */
export function mergeUserProfileLayers(
    global: UserProfileLayer | null,
    project: UserProfileLayer | null,
): MergedUserProfile {
    const profile: Record<string, unknown> = {};
    const sources: Record<string, ProfileSource> = {};

    for (const leafPath of KNOWN_LEAF_PATHS) {
        const globalValue = global ? getPath(global.data, leafPath) : undefined;
        const projectValue = project ? getPath(project.data, leafPath) : undefined;
        if (projectValue !== undefined) {
            setPath(profile, leafPath, projectValue);
            sources[leafPath.join('.')] = 'project';
        } else if (globalValue !== undefined) {
            setPath(profile, leafPath, globalValue);
            sources[leafPath.join('.')] = 'global';
        }
    }

    const globalNotes = typeof global?.data.notes === 'string' ? global.data.notes : undefined;
    const projectNotes = typeof project?.data.notes === 'string' ? project.data.notes : undefined;
    const mergedNotes = mergeNotes(globalNotes, projectNotes);
    if (mergedNotes !== undefined) {
        profile.notes = mergedNotes;
        // Provenance for `notes` is "both" whenever concatenation actually
        // happened; a single-layer note keeps that layer's provenance.
        sources.notes = globalNotes && projectNotes ? 'project' : project ? 'project' : 'global';
    }

    const capWarnings: string[] = [];
    if (global?.overCap) {
        capWarnings.push(
            `global profile exceeds ${USER_PROFILE_LINE_CAP}-line cap (${global.lineCount} lines): ${global.path}`,
        );
    }
    if (project?.overCap) {
        capWarnings.push(
            `project profile exceeds ${USER_PROFILE_LINE_CAP}-line cap (${project.lineCount} lines): ${project.path}`,
        );
    }

    return { profile, sources, capWarnings };
}

/** Load both layers for `projectRoot` and merge them — the one call sites need. */
export function loadEffectiveUserProfile(
    projectRoot: string,
    env?: user_global_paths.EnvMap | null,
): MergedUserProfile {
    const global = loadGlobalProfileLayer(env);
    const project = loadProjectProfileLayer(projectRoot);
    return mergeUserProfileLayers(global, project);
}

// ---------------------------------------------------------------------------
// Write path (road-to-global-user-memory Phase 2) — the learning channel's
// ONLY writer of `profile.md`. Everything upstream of this function
// (`user_global_observations.ts`'s buffer, `/agents:user review`) only ever
// proposes; this is the human-gated `accept` step's write primitive. No
// other function in this module, and no function in
// `user_global_observations.ts`, ever touches `profile.md`.
// ---------------------------------------------------------------------------

/** Leaf path a `field` string from the observation-buffer schema resolves to (`'notes'` is top-level, never nested). */
function fieldToLeafPath(field: string): readonly string[] {
    return field === 'notes' ? ['notes'] : field.split('.');
}

export interface ApplyObservationResult {
    /** Absolute path written. */
    readonly path: string;
    /** Line count of the file AFTER the write (already validated ≤ the cap). */
    readonly lineCount: number;
}

/**
 * Apply one accepted observation to the global `profile.md`, bump
 * `last_updated`, and enforce the per-layer 100-line cap. The ONLY function
 * in this module (or in `user_global_observations.ts`) that writes
 * `profile.md` — everything else in the learning channel only reads or
 * proposes. Called exclusively from the human-confirmed
 * `/agents:user accept` step; never invoked automatically.
 *
 * Preserves every field the file already declares (round-trips through
 * `parseLegacyUserMd` / `composeLegacyUserMd`) except the one field being
 * set and `last_updated`. Throws rather than writing when the result would
 * exceed the cap — the caller is expected to surface that as a rollback,
 * matching `/agents:user accept`'s "any violation → roll back and print the
 * error" contract.
 */
export function applyObservationToGlobalProfile(
    field: string,
    value: unknown,
    options: { env?: user_global_paths.EnvMap | null; today?: string } = {},
): ApplyObservationResult {
    const target = globalProfileWriteTarget(options.env ?? null);
    let raw = '';
    try {
        raw = fs.readFileSync(target, 'utf-8');
    } catch {
        raw = '';
    }
    const data = raw === '' ? {} : parseLegacyUserMd(raw);

    setPath(data, fieldToLeafPath(field), value);
    if (data.version === undefined) {
        data.version = 1;
    }
    data.last_updated = options.today ?? new Date().toISOString().slice(0, 10);

    const serialized = composeLegacyUserMd(data);
    const lineCount = countLines(serialized);
    if (lineCount > USER_PROFILE_LINE_CAP) {
        throw new Error(
            `applying '${field}' would grow the global profile to ${lineCount} lines, ` +
                `exceeding the ${USER_PROFILE_LINE_CAP}-line-per-layer cap — write refused`,
        );
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, serialized, 'utf-8');
    // Phase 5 gate: the accept count is what makes the kill-criterion able to
    // fire, so it increments where the accept actually lands — not at the
    // command layer, which a caller could bypass. Counter failures never fail
    // the accept: the profile write already succeeded and is the user's data.
    try {
        recordObservationAccepted({ env: options.env ?? null });
    } catch {
        /* a counter is telemetry, never a gate on the user's own write */
    }
    return { path: target, lineCount };
}

// ---------------------------------------------------------------------------
// Phase 4 (road-to-global-user-memory) — delete, revoke, audit. Delete
// counterpart of `applyObservationToGlobalProfile` above: this module
// remains the ONLY writer (now also the only revoker) of `profile.md`.
// ---------------------------------------------------------------------------

/** Unset a dotted leaf path, pruning an emptied parent object so a revoked `identity.name` does not leave a dangling `identity: {}` behind. */
function _deletePath(obj: Record<string, unknown>, keys: readonly string[]): void {
    if (keys.length === 0) {
        return;
    }
    const [head, ...rest] = keys as [string, ...string[]];
    if (rest.length === 0) {
        delete obj[head];
        return;
    }
    const child = obj[head];
    if (typeof child !== 'object' || child === null || Array.isArray(child)) {
        return;
    }
    _deletePath(child as Record<string, unknown>, rest);
    if (Object.keys(child as Record<string, unknown>).length === 0) {
        delete obj[head];
    }
}

export interface RevokeProfileFieldResult {
    /** `false` when the field had no value in `profile.md` to revoke (no tombstone written, no file touched). */
    readonly revoked: boolean;
    readonly tombstone?: RevocationEntry | undefined;
    /** Absolute path of the global profile that was (or would have been) rewritten. */
    readonly path: string;
}

/**
 * Revoke (delete) one field's value from the global `profile.md` — the
 * delete counterpart of `applyObservationToGlobalProfile`, covering BOTH the
 * plain-accept write and the Phase 3 promotion write (promotion calls the
 * same function, so one revoke path covers both). Writes an append-only
 * tombstone to `user_global_revocations.ts`'s ledger BEFORE the file is
 * rewritten without the field — reusing ADR-121's tombstone-before-deletion
 * discipline exactly as `user_global_observations.ts`'s
 * `deleteGlobalObservation` does for the buffer.
 *
 * A profile field has no natural content-derived id the way a buffered
 * observation or a knowledge card does — it is a fixed YAML key in a
 * closed enum — so the tombstone's `entity_id` is simply `profile:<field>`,
 * human-readable and stable across revokes of the same field.
 *
 * Never invoked automatically; the matching `/agents user delete` step
 * requires the same explicit human confirmation `accept` requires to write.
 */
export function revokeGlobalProfileField(
    field: string,
    reason: string,
    options: { env?: user_global_paths.EnvMap | null; today?: string } = {},
): RevokeProfileFieldResult {
    const target = globalProfileWriteTarget(options.env ?? null);
    let raw: string;
    try {
        raw = fs.readFileSync(target, 'utf-8');
    } catch {
        return { revoked: false, path: target };
    }
    const data = parseLegacyUserMd(raw);
    const leafPath = fieldToLeafPath(field);
    if (getPath(data, leafPath) === undefined) {
        return { revoked: false, path: target };
    }

    const tombstone = revocations.appendTombstone(`profile:${field}`, reason, {
        today: options.today,
        env: options.env ?? null,
    });

    _deletePath(data, leafPath);
    data.last_updated = options.today ?? new Date().toISOString().slice(0, 10);
    const serialized = composeLegacyUserMd(data);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, serialized, 'utf-8');
    return { revoked: true, tombstone, path: target };
}
