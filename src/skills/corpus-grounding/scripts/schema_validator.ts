#!/usr/bin/env node
/**
 * corpus-grounding · schema_validator — manifest contract (interface v1).
 *
 * TypeScript twin of `src/skills/corpus-grounding/scripts/schema_validator.py`
 * (ADR-094 Python→TS migration). Validates a domain's plug-in manifest
 * (`manifest.json`) against the schema-agnostic contract from ADR-061 §3. Each
 * domain declares its OWN axes — the validator checks structure + provenance
 * discipline, never a uniform schema.
 *
 * Pure stdlib, no network. Standalone skill script — no `_lib` imports.
 * Interface contract: SKILL.md § Interface contract.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { pyRepr } from './bm25_search.js';

export const MANIFEST_VERSION = 1;

/** Output sophistication tiers (ADR-061 §3). */
export const TIERS = ['lookup-only', 'conditional-grounding', 'constraint-emission'] as const;

const _REQUIRED_TOP = ['manifest_version', 'domain', 'tier', 'domains'] as const;
const _REQUIRED_PROVENANCE = ['owner', 'refresh_cadence', 'upstream'] as const;
const _REQUIRED_DOMAIN_KEYS = ['file', 'search_cols', 'output_cols'] as const;
const _REQUIRED_REASONING_KEYS = ['file', 'match_column', 'plan'] as const;

/** A decoded manifest — heterogeneous JSON object. */
export type Manifest = Record<string, unknown>;

/** Raised when a manifest violates the v1 contract (Python ManifestError). */
export class ManifestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ManifestError';
    }
}

// ── Python-parity helpers ───────────────────────────────────────────────────

/** Python truthiness: '', 0, 0.0, [], {}, None, False are falsy. */
function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined || value === false) {
        return false;
    }
    if (value === true) {
        return true;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value).length > 0;
    }
    return true;
}

/** Python `isinstance(x, dict)` — a plain JSON object (not array, not null). */
function _isDict(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Python `repr(x)` for the JSON value shapes a manifest carries. */
function _repr(value: unknown): string {
    if (typeof value === 'string') {
        return pyRepr(value);
    }
    if (value === null || value === undefined) {
        return 'None';
    }
    if (value === true) {
        return 'True';
    }
    if (value === false) {
        return 'False';
    }
    if (typeof value === 'number') {
        // Integral JSON numbers print as ints (repr(2) -> "2").
        return String(value);
    }
    return String(value);
}

/** Render the TIERS tuple the way Python's f-string interpolates it. */
function _tiersRepr(): string {
    return `(${TIERS.map((t) => pyRepr(t)).join(', ')})`;
}

// ── manifest loading + validation ───────────────────────────────────────────

/** Load + validate a manifest. Raises ManifestError on violation. */
export function load_manifest(p: string): Manifest {
    if (!fs.existsSync(p)) {
        throw new ManifestError(`Manifest not found: ${p}`);
    }
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (exc) {
        // Python: json.JSONDecodeError → ManifestError(f"... {path}: {exc}").
        throw new ManifestError(`Manifest is not valid JSON: ${p}: ${_jsonErr(exc)}`);
    }
    const errors = validate_manifest(data);
    if (errors.length > 0) {
        throw new ManifestError(
            `Manifest contract violations in ${p}:\n  - ${errors.join('\n  - ')}`,
        );
    }
    const manifest = data as Manifest;
    // Python: str(path.resolve().parent) — resolve() follows symlinks.
    manifest._manifest_dir = path.dirname(pyResolve(p));
    return manifest;
}

/** Return a list of contract violations (empty = valid). */
export function validate_manifest(data: unknown): string[] {
    const errors: string[] = [];
    if (!_isDict(data)) {
        return ['manifest must be a JSON object'];
    }

    for (const key of _REQUIRED_TOP) {
        if (!(key in data)) {
            errors.push(`missing required key: ${pyRepr(key)}`);
        }
    }
    if (errors.length > 0) {
        return errors;
    }

    if (data.manifest_version !== MANIFEST_VERSION) {
        errors.push(`manifest_version ${_repr(data.manifest_version)} unsupported (engine speaks v${MANIFEST_VERSION})`);
    }
    if (!(TIERS as readonly string[]).includes(data.tier as string)) {
        errors.push(`tier ${_repr(data.tier)} not in ${_tiersRepr()}`);
    }

    const domains = data.domains;
    if (!_isDict(domains) || Object.keys(domains).length === 0) {
        errors.push('domains must be a non-empty object');
    } else {
        for (const name of Object.keys(domains)) {
            const cfg = domains[name];
            if (!_isDict(cfg)) {
                errors.push(`domains.${name} must be an object`);
                continue;
            }
            for (const key of _REQUIRED_DOMAIN_KEYS) {
                if (!(key in cfg)) {
                    errors.push(`domains.${name} missing ${pyRepr(key)}`);
                }
            }
            for (const key of ['search_cols', 'output_cols']) {
                if (key in cfg && (!Array.isArray(cfg[key]) || (cfg[key] as unknown[]).length === 0)) {
                    errors.push(`domains.${name}.${key} must be a non-empty list`);
                }
            }
        }
    }

    const default_domain = data.default_domain;
    if (_pyTruthy(default_domain) && _isDict(domains) && !(String(default_domain) in domains)) {
        errors.push(`default_domain ${_repr(default_domain)} not in domains`);
    }

    const detect = data.detect;
    if (detect !== undefined && detect !== null) {
        if (!_isDict(detect)) {
            errors.push('detect must be an object of domain → keyword list');
        } else if (_isDict(domains)) {
            for (const name of Object.keys(detect)) {
                const kws = detect[name];
                if (!(name in domains) && name !== '_stack') {
                    errors.push(`detect.${name} references unknown domain`);
                }
                if (!Array.isArray(kws)) {
                    errors.push(`detect.${name} must be a list of keywords`);
                }
            }
        }
    }

    const reasoning = data.reasoning;
    if (reasoning !== undefined && reasoning !== null) {
        if (data.tier === 'lookup-only') {
            errors.push('reasoning block present but tier is lookup-only');
        }
        if (!_isDict(reasoning)) {
            errors.push('reasoning must be an object');
        } else {
            for (const key of _REQUIRED_REASONING_KEYS) {
                if (!(key in reasoning)) {
                    errors.push(`reasoning missing ${pyRepr(key)}`);
                }
            }
            const plan = reasoning.plan;
            if (plan !== undefined && plan !== null) {
                if (!_isDict(plan)) {
                    errors.push('reasoning.plan must be an object of domain → max_results');
                } else if (_isDict(domains)) {
                    for (const name of Object.keys(plan)) {
                        if (!(name in domains)) {
                            errors.push(`reasoning.plan.${name} references unknown domain`);
                        }
                    }
                }
            }
        }
    }

    const stacks = data.stacks;
    if (stacks !== undefined && stacks !== null) {
        if (!_isDict(stacks)) {
            errors.push('stacks must be an object of stack-id → csv path');
        } else if (!('stack_cols' in data)) {
            errors.push('stacks present but stack_cols missing');
        }
    }

    // Provenance discipline (ADR-061 §6) — a corpus without an owner rots.
    for (const key of _REQUIRED_PROVENANCE) {
        if (!(key in data)) {
            errors.push(`missing provenance key: ${pyRepr(key)} (ADR-061 §6)`);
        }
    }
    const upstream = data.upstream;
    if (_isDict(upstream)) {
        for (const key of ['repo', 'sha', 'last_checked']) {
            if (!(key in upstream)) {
                errors.push(`upstream missing ${pyRepr(key)}`);
            }
        }
    } else if (upstream !== undefined && upstream !== null) {
        errors.push('upstream must be an object {repo, sha, last_checked}');
    }

    const retriever = data.retriever;
    if (retriever !== undefined && retriever !== null && !['bm25', 'structured', 'hybrid'].includes(retriever as string)) {
        errors.push(`retriever ${_repr(retriever)} unknown`);
    }

    return errors;
}

/**
 * Resolve a corpus file path relative to the manifest's directory.
 *
 * Refuses absolute paths and parent-escapes — corpus files live beside their
 * manifest by contract (runtime-safety: read-only, local).
 */
export function resolve_data_path(manifest: Manifest, relative: string): string {
    // Python: rel = Path(relative); rel.is_absolute() or ".." in rel.parts.
    if (path.isAbsolute(relative) || _pathParts(relative).includes('..')) {
        throw new ManifestError(`corpus path must be manifest-relative: ${pyRepr(relative)}`);
    }
    const base = (manifest._manifest_dir as string | undefined) ?? '.';
    const data_dir = (manifest.data_dir as string | undefined) ?? '.';
    if (path.isAbsolute(data_dir) || _pathParts(data_dir).includes('..')) {
        throw new ManifestError(`data_dir must be manifest-relative: ${pyRepr(data_dir)}`);
    }
    // Python: (base / dd / rel).resolve() — resolve() follows symlinks.
    return pyResolve(path.join(base, data_dir, relative));
}

/** Mirror pathlib Path(p).parts for the relative-path containment check. */
function _pathParts(p: string): string[] {
    return p.split(/[\\/]/u).filter((seg) => seg !== '' && seg !== '.');
}

/**
 * Mirror pathlib `Path(p).resolve()` (strict=False): make absolute, then
 * resolve symlinks in the longest existing ancestor and append the
 * non-existent suffix. On macOS this turns `/var/...` into `/private/var/...`,
 * matching the Python error / file paths byte-for-byte.
 */
function pyResolve(p: string): string {
    const abs = path.resolve(p);
    let cur = abs;
    const suffix: string[] = [];
    for (;;) {
        try {
            const real = fs.realpathSync.native(cur);
            return suffix.length > 0 ? path.join(real, ...suffix) : real;
        } catch {
            const parent = path.dirname(cur);
            if (parent === cur) {
                return abs;
            }
            suffix.unshift(path.basename(cur));
            cur = parent;
        }
    }
}

/** Best-effort JSON parse-error text for the ManifestError message. */
function _jsonErr(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}
