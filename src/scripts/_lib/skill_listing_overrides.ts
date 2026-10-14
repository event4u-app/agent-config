/**
 * The host listing override for package-owned skills — the one host setting
 * this package writes beyond its hook entries.
 *
 * Owner decision 2026-10-14 (blocker `listing-override-write-is-owner-owned`,
 * option (a)): the package writes Claude Code's `skillOverrides` into the
 * user-global settings file for skills it owns, never over a user value, removes
 * exactly what it wrote on uninstall, and offers no settings key. That lowered
 * a recorded never-write commitment; the exception is named wherever that
 * commitment is stated (`mcp_bridge.ts` § tierBAdvisory, `docs/mcp-server.md`).
 *
 * WHICH SKILLS. The resident set keeps its description; every other owned skill
 * goes `name-only` — still listed, still invocable by name and by `/name`.
 * The split is COMPUTED by `modelListingBudget` over the owned catalogue with the
 * host's documented defaults, so nothing is configured. Without a usage ledger
 * the fill order is the model's alphabetical fallback; the override makes the
 * split deterministic instead of leaving it to the host's own fill order.
 *
 * OWNERSHIP. A value cannot carry a signature the way a hook command can — a
 * user's own `name-only` is byte-identical to ours — so what this package wrote
 * is recorded in a sidecar beside the deploy inventory. An entry is ours only
 * while the settings file still holds exactly the value the record names; a
 * value the user changed afterwards is theirs and is never touched again.
 *
 * ROLLBACK. `agent-config uninstall` removes exactly the recorded entries. By
 * hand: delete the named keys under `skillOverrides` in `~/.claude/settings.json`
 * and the sidecar `skill-overrides.json`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { atomicWriteFile } from '../../install/atomic.js';
import { _read_settings, _with_lock } from './claude_settings_hooks.js';
import * as global_deploy_inventory from './global_deploy_inventory.js';
import { type CatalogueEntry, modelListingBudget } from './host_listing_model.js';
import * as user_global_paths from './user_global_paths.js';

export const OVERRIDE_KEY = 'skillOverrides';
export const NAME_ONLY = 'name-only';
export const RECORD_BASENAME = 'skill-overrides.json';

export interface OverrideRecord {
    schema_version: 1;
    settings_path: string;
    /** True when this package created the `skillOverrides` object itself. */
    created_key: boolean;
    entries: Record<string, string>;
}

export interface EnsureOverridesResult {
    changed: boolean;
    written: string[];
    removed: string[];
    /** Owned skills left alone because the settings file already holds a user value. */
    skipped_user: string[];
}

export interface RemoveOverridesResult {
    changed: boolean;
    removed: string[];
    /** Recorded entries whose value the user changed since; left in place. */
    kept_user: string[];
}

export function recordPath(env?: user_global_paths.EnvMap | null): string {
    return user_global_paths.write_target(RECORD_BASENAME, { env: env ?? null });
}

/** Owned skill slugs from a deploy's anchor-relative file set. */
export function ownedSkillNames(currentFiles: Iterable<string>): string[] {
    const out = new Set<string>();
    for (const rel of currentFiles) {
        const m = /^skills\/([^/]+)\/SKILL\.md$/.exec(rel.split(path.sep).join('/'));
        if (m) out.add(m[1]!);
    }
    return [...out].sort();
}

/**
 * The owned catalogue as deployed. Not `compute_skill_tiers.readCatalogue`:
 * that module is a CLI whose main-guard fires inside the install bundle.
 */
function ownedCatalogue(skillsDir: string, owned: readonly string[]): CatalogueEntry[] {
    const out: CatalogueEntry[] = [];
    for (const name of owned) {
        let raw: string;
        try {
            raw = fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8');
        } catch {
            continue;
        }
        const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
        const line = fm ? /^description:[ \t]*(.*)$/m.exec(fm[1]!) : null;
        out.push({ name, descriptionChars: line ? line[1]!.replace(/^["']|["']$/g, '').length : 0 });
    }
    return out;
}

/** The wanted override map: every owned skill outside the resident set → `name-only`. */
export function computeOverrides(skillsDir: string, owned: readonly string[]): Record<string, string> {
    const catalogue = ownedCatalogue(skillsDir, owned);
    const { bare } = modelListingBudget(catalogue, { contextWindowTokens: 200_000 });
    const out: Record<string, string> = {};
    for (const name of bare) out[name] = NAME_ONLY;
    return out;
}

function loadRecord(file: string, settingsPath: string): OverrideRecord {
    const empty: OverrideRecord = { schema_version: 1, settings_path: settingsPath, created_key: false, entries: {} };
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
        return empty;
    }
    const r = data as Partial<OverrideRecord> | null;
    if (!r || typeof r !== 'object' || typeof r.entries !== 'object' || r.entries === null) return empty;
    // A record about a different settings file proves nothing about this one.
    if (path.resolve(String(r.settings_path)) !== path.resolve(settingsPath)) return empty;
    const entries: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.entries)) if (typeof v === 'string') entries[k] = v;
    return { schema_version: 1, settings_path: settingsPath, created_key: r.created_key === true, entries };
}

function saveRecord(file: string, rec: OverrideRecord): void {
    if (Object.keys(rec.entries).length === 0) {
        fs.rmSync(file, { force: true });
        return;
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    atomicWriteFile(file, `${JSON.stringify({ ...rec, entries: sortKeys(rec.entries) }, null, 2)}\n`);
}

function sortKeys(o: Record<string, string>): Record<string, string> {
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]!]));
}

function overridesOf(settings: Record<string, unknown>): Record<string, unknown> | null | undefined {
    const raw = settings[OVERRIDE_KEY];
    if (raw === undefined) return undefined;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    return raw as Record<string, unknown>;
}

/**
 * Idempotently bring the settings file's owned overrides to `wanted`.
 *
 * Never writes over a value the record does not name; drops an entry it wrote
 * when the skill rejoins the resident set or stops being deployed; a second run
 * with the same `wanted` changes nothing. A `skillOverrides` that is not an
 * object is foreign-shaped and left alone.
 */
export function ensureListingOverrides(
    settingsPath: string,
    recordFile: string,
    wanted: Readonly<Record<string, string>>,
): EnsureOverridesResult {
    return _with_lock(settingsPath, () => {
        const settings = _read_settings(settingsPath);
        const rec = loadRecord(recordFile, settingsPath);
        const existing = overridesOf(settings);
        const result: EnsureOverridesResult = { changed: false, written: [], removed: [], skipped_user: [] };
        if (existing === null) {
            result.skipped_user.push(...Object.keys(wanted).sort());
            return result;
        }
        const overrides: Record<string, unknown> = { ...(existing ?? {}) };
        const next: Record<string, string> = {};
        for (const [name, value] of Object.entries(rec.entries)) {
            if (overrides[name] !== value) continue; // the user changed it: theirs now
            const want = wanted[name];
            if (want === undefined) {
                delete overrides[name];
                result.removed.push(name);
            } else {
                if (want !== value) {
                    overrides[name] = want;
                    result.written.push(name);
                }
                next[name] = want;
            }
        }
        for (const [name, value] of Object.entries(wanted)) {
            if (name in next) continue;
            if (name in overrides) {
                result.skipped_user.push(name);
                continue;
            }
            overrides[name] = value;
            next[name] = value;
            result.written.push(name);
        }
        const createdKey = rec.created_key || (existing === undefined && Object.keys(next).length > 0);
        if (Object.keys(overrides).length === 0 && createdKey) delete settings[OVERRIDE_KEY];
        else if (existing !== undefined || Object.keys(overrides).length > 0) settings[OVERRIDE_KEY] = overrides;
        result.changed = result.written.length + result.removed.length > 0;
        if (result.changed) atomicWriteFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
        saveRecord(recordFile, { schema_version: 1, settings_path: settingsPath, created_key: createdKey, entries: next });
        result.written.sort();
        result.removed.sort();
        result.skipped_user.sort();
        return result;
    });
}

/** Remove exactly the recorded entries whose value is still ours. Missing files → no-op. */
export function removeListingOverrides(settingsPath: string, recordFile: string): RemoveOverridesResult {
    const result: RemoveOverridesResult = { changed: false, removed: [], kept_user: [] };
    if (!fs.existsSync(recordFile)) return result;
    if (!fs.existsSync(settingsPath)) {
        fs.rmSync(recordFile, { force: true });
        return result;
    }
    return _with_lock(settingsPath, () => {
        const settings = _read_settings(settingsPath);
        const rec = loadRecord(recordFile, settingsPath);
        const existing = overridesOf(settings);
        if (existing) {
            for (const [name, value] of Object.entries(rec.entries)) {
                if (existing[name] === value) {
                    delete existing[name];
                    result.removed.push(name);
                } else if (name in existing) {
                    result.kept_user.push(name);
                }
            }
            if (rec.created_key && Object.keys(existing).length === 0) delete settings[OVERRIDE_KEY];
        }
        result.changed = result.removed.length > 0;
        if (result.changed) atomicWriteFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
        fs.rmSync(recordFile, { force: true });
        result.removed.sort();
        result.kept_user.sort();
        return result;
    });
}

/**
 * The installer's one call: compute, write, report. Never throws — a failure
 * here must not sink the content deploy, same as the hook registration.
 *
 * Ownership is the deploy inventory's record for `claude-code`; a recorded
 * skill a later prune removed from disk is skipped by `ownedCatalogue`, so the
 * caller must run this after every prune.
 */
export function applyListingOverrides(anchor: string, report: (msg: string) => void): void {
    try {
        const owned = ownedSkillNames(global_deploy_inventory.recorded_rel_files('claude-code', anchor));
        const wanted = computeOverrides(path.join(anchor, 'skills'), owned);
        const res = ensureListingOverrides(path.join(anchor, 'settings.json'), recordPath(), wanted);
        if (res.changed) {
            report(
                `claude-code: listing override in ~/.claude/settings.json — ` +
                    `${res.written.length} set name-only, ${res.removed.length} removed`,
            );
        }
        if (res.skipped_user.length > 0) {
            report(
                `claude-code: listing override left ${res.skipped_user.length} user value(s) ` +
                    `untouched (${res.skipped_user.slice(0, 5).join(', ')}${res.skipped_user.length > 5 ? ', …' : ''})`,
            );
        }
    } catch (e) {
        report(`claude-code: listing override skipped — ${String(e)}`);
    }
}
