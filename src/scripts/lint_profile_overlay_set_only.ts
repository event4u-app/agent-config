#!/usr/bin/env tsx
/**
 * lint_profile_overlay_set_only — freeze the set-only overlay invariant.
 *
 * TypeScript twin of `src/scripts/lint_profile_overlay_set_only.py` (ADR-096,
 * Phase 4 / Wave 4b). Mirrors the Python CLI contract EXACTLY — `--quiet`
 * flag from argv at module load, four YAML surfaces + sorted *.yml ordering,
 * finding messages (incl. Python `type(x).__name__` and `{x!r}` rendering),
 * stdout/stderr split, exit codes. No behaviour changes — latent bugs
 * replicated.
 *
 * Two clauses: aliases resolve only to pack-id sets; no static profile/pack
 * definition injects a scalar audience hint or a precedence key into the
 * overlay.
 *
 * Exit codes: 0 clean, 1 on any violation. `--quiet` suppresses the success line.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const ALIASES_YML = path.join(REPO_ROOT, 'src/config/discovery/session-profiles.yml');
const PACKS_YML = path.join(REPO_ROOT, 'src/config/discovery/packs.yml');
const PROFILES_DIR = path.join(REPO_ROOT, 'src/agent-src/profiles');
const PACKS_DIR = path.join(REPO_ROOT, 'src/agent-src/packs');

// A key whose presence on a pack association would imply ordering / precedence.
const PRECEDENCE_KEYS: ReadonlySet<string> = new Set([
    'precedence',
    'priority',
    'order',
    'rank',
    'weight',
]);
const OVERLAY_KEY = 'active_packs';

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Filename (Path.name). */
function _name(p: string): string {
    return path.basename(p);
}

/** POSIX relative path of `target` under `root`. */
function _relToPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

/** Immediate `*.yml` children of `dir`, sorted (sorted(glob('*.yml'))). */
function _globYmlSorted(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.yml')) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out.sort();
}

function _load_yaml(p: string): unknown {
    if (!_exists(p)) {
        return null;
    }
    try {
        return parseYaml(fs.readFileSync(p, 'utf-8'), { version: '1.1' });
    } catch {
        return null;
    }
}

function _isPlainObject(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** Mirror Python `type(value).__name__` for the values this lint sees. */
function _typeName(value: unknown): string {
    if (value === null || value === undefined) {
        return 'NoneType';
    }
    if (typeof value === 'string') {
        return 'str';
    }
    if (typeof value === 'boolean') {
        return 'bool';
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? 'int' : 'float';
    }
    if (Array.isArray(value)) {
        return 'list';
    }
    if (typeof value === 'object') {
        return 'dict';
    }
    return typeof value;
}

/** Mirror Python `repr()` for the scalar values that flow into messages. */
function _pyRepr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (typeof value === 'string') {
        const hasSingle = value.includes("'");
        const hasDouble = value.includes('"');
        const useDouble = hasSingle && !hasDouble;
        const quote = useDouble ? '"' : "'";
        let body = value.replace(/\\/g, '\\\\');
        body = useDouble ? body.replace(/"/g, '\\"') : body.replace(/'/g, "\\'");
        body = body.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
        return `${quote}${body}${quote}`;
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    if (typeof value === 'number') {
        return String(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => _pyRepr(v)).join(', ')}]`;
    }
    if (typeof value === 'object') {
        const parts = Object.entries(value as Record<string, unknown>).map(
            ([k, v]) => `${_pyRepr(k)}: ${_pyRepr(v)}`,
        );
        return `{${parts.join(', ')}}`;
    }
    return String(value);
}

/** Mirror Python `sorted(set_of_strings)` rendered as a list literal. */
function _pyReprStrList(items: string[]): string {
    return `[${items.map((s) => _pyRepr(s)).join(', ')}]`;
}

function _pack_universe(): Set<string> {
    const data = _load_yaml(PACKS_YML);
    if (!Array.isArray(data)) {
        return new Set();
    }
    const out = new Set<string>();
    for (const e of data) {
        if (_isPlainObject(e) && e['id']) {
            out.add(String(e['id']));
        }
    }
    return out;
}

/** Every mapping key anywhere in the tree (depth-first). */
function _walk_keys(node: unknown): string[] {
    const keys: string[] = [];
    if (_isPlainObject(node)) {
        for (const [k, v] of Object.entries(node)) {
            keys.push(String(k));
            keys.push(..._walk_keys(v));
        }
    } else if (Array.isArray(node)) {
        for (const item of node) {
            keys.push(..._walk_keys(item));
        }
    }
    return keys;
}

/** True if `active_packs` appears anywhere as a non-list scalar/dict. */
function _find_scalar_active_packs(node: unknown): boolean {
    if (_isPlainObject(node)) {
        for (const [k, v] of Object.entries(node)) {
            if (String(k) === OVERLAY_KEY && !Array.isArray(v)) {
                return true;
            }
            if (_find_scalar_active_packs(v)) {
                return true;
            }
        }
    } else if (Array.isArray(node)) {
        return node.some((item) => _find_scalar_active_packs(item));
    }
    return false;
}

function lint(quiet = false): number {
    const errors: string[] = [];
    const universe = _pack_universe();

    // --- Clause 1a: aliases resolve only to pack-id sets ----------------------
    const aliasData = _load_yaml(ALIASES_YML);
    // Mirror: `alias_data.get("aliases") if isinstance(alias_data, dict) else None`.
    const aliases: unknown = _isPlainObject(aliasData) ? aliasData['aliases'] : null;
    const aliasesIsDict = _isPlainObject(aliases);
    if (!aliasesIsDict) {
        errors.push(`${_name(ALIASES_YML)}: no \`aliases:\` mapping found`);
    } else {
        for (const [name, value] of Object.entries(aliases as Record<string, unknown>)) {
            if (!Array.isArray(value)) {
                errors.push(
                    `${_name(ALIASES_YML)}: alias '${name}' is not a list ` +
                        `(set-only invariant — got ${_typeName(value)}). ` +
                        `An alias must resolve to a pack-id set, never a scalar/dict.`,
                );
                continue;
            }
            for (const pid of value) {
                if (typeof pid !== 'string') {
                    errors.push(
                        `${_name(ALIASES_YML)}: alias '${name}' has a non-string member ${_pyRepr(pid)}`,
                    );
                } else if (universe.size > 0 && !universe.has(pid)) {
                    errors.push(
                        `${_name(ALIASES_YML)}: alias '${name}' → unknown pack '${pid}'`,
                    );
                }
            }
        }
    }

    // --- Clause 1b + 2: per static definition file ----------------------------
    const dirs: Array<[string, string, string, string | null]> = [
        ['profile', PROFILES_DIR, 'profile', 'packs'],
        ['pack', PACKS_DIR, 'pack', null],
    ];
    for (const [, directory, rootKey, seedKey] of dirs) {
        if (!_exists(directory)) {
            continue;
        }
        for (const p of _globYmlSorted(directory)) {
            const doc = _load_yaml(p);
            if (!_isPlainObject(doc)) {
                continue;
            }
            const rel = _relToPosix(p, REPO_ROOT);

            // Clause 2a: no scalar `active_packs` pre-seed anywhere in the file.
            if (_find_scalar_active_packs(doc)) {
                errors.push(
                    `${rel}: declares a scalar \`active_packs\` — the overlay is a ` +
                        `set written only by set_overlay(); a static scalar seed is a ` +
                        `precedence regression.`,
                );
            }

            // Clause 2b: no precedence/priority/order key anywhere.
            const walked = new Set(_walk_keys(doc));
            const bad = [...walked].filter((k) => PRECEDENCE_KEYS.has(k)).sort();
            if (bad.length > 0) {
                errors.push(
                    `${rel}: carries ordering key(s) ${_pyReprStrList(bad)} — the overlay union is ` +
                        `order-independent; precedence is intentionally undefined.`,
                );
            }

            // Clause 1b: a profile's seed `profile.packs` is a list of known ids.
            if (seedKey) {
                const inner = doc[rootKey];
                if (_isPlainObject(inner) && seedKey in inner) {
                    const seeds = inner[seedKey];
                    if (!Array.isArray(seeds)) {
                        errors.push(
                            `${rel}: ${rootKey}.${seedKey} is not a list ` +
                                `(got ${_typeName(seeds)}) — seed packs must be a set.`,
                        );
                    } else {
                        for (const pid of seeds) {
                            if (typeof pid !== 'string') {
                                errors.push(`${rel}: ${rootKey}.${seedKey} non-string ${_pyRepr(pid)}`);
                            } else if (universe.size > 0 && !universe.has(pid)) {
                                errors.push(`${rel}: ${rootKey}.${seedKey} → unknown pack '${pid}'`);
                            }
                        }
                    }
                }
            }
        }
    }

    if (errors.length > 0) {
        for (const e of errors) {
            process.stderr.write(`❌ ${e}\n`);
        }
        return 1;
    }
    if (!quiet) {
        const nAlias = aliasesIsDict ? Object.keys(aliases as Record<string, unknown>).length : 0;
        process.stdout.write(
            `✅ profile overlay set-only OK — ${nAlias} aliases, precedence undefined by design\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(lint(process.argv.includes('--quiet')));
}

export {
    REPO_ROOT,
    PRECEDENCE_KEYS,
    OVERLAY_KEY,
    _pack_universe,
    _walk_keys,
    _find_scalar_active_packs,
    lint,
};
