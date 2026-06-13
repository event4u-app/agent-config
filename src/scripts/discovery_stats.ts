#!/usr/bin/env tsx
/**
 * Pretty-print the `stats` block from the committed discovery manifest.
 *
 * TypeScript twin of `src/scripts/discovery_stats.py` (ADR-094, Phase 8 /
 * Wave 8a). The CLI contract is mirrored EXACTLY — the single `--manifest`
 * flag (default `dist/discovery/discovery-manifest.json`), exit codes
 * (0 printed · 1 manifest missing or malformed), the stdout/stderr split,
 * and byte-identical messages. Cheap sanity surface for developers: counts
 * by category, lifecycle, and trust level. Reads only the committed
 * manifest; no scan, no generation. See ADR-015.
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Free-form JSON value alias — the manifest carries strings, numbers,
// booleans, null, nested objects, and arrays of those. No `any`.
type Json = unknown;
type JsonObject = Record<string, Json>;

const _HERE = fileURLToPath(import.meta.url);

// src/scripts/discovery_stats.ts → parents[2] of the .py file
// (src/scripts/discovery_stats.py) is the repo root.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const DEFAULT_MANIFEST = path.join(ROOT, 'dist', 'discovery', 'discovery-manifest.json');

/**
 * Mirror `f"  {label:<14} " + "  ".join(parts)` where each part is `k=v`.
 * The label is left-justified to width 14.
 */
export function _fmt_row(label: string, counts: Record<string, number>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(counts)) {
        parts.push(`${k}=${v}`);
    }
    return `  ${label.padEnd(14)} ` + parts.join('  ');
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _isAbsolute(p: string): boolean {
    return path.isAbsolute(p);
}

/** POSIX relative path of `child` under `root` (mirrors `relative_to().as_posix()` use here). */
function _relativeToPosix(child: string, root: string): string {
    const rel = path.relative(root, child);
    return rel.split(path.sep).join('/');
}

/** Mirror `Path.relative_to` raising when `child` is not under `root`. */
function _isUnder(child: string, root: string): boolean {
    const rel = path.relative(root, child);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function _asObject(v: Json): JsonObject | null {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        return v as JsonObject;
    }
    return null;
}

/** Mirror Python truthiness used in `if stats.get(...)` guards. */
function _pyTruthy(v: Json): boolean {
    if (v === undefined || v === null || v === false || v === '' || v === 0) {
        return false;
    }
    if (Array.isArray(v)) {
        return v.length > 0;
    }
    if (typeof v === 'object') {
        return Object.keys(v as object).length > 0;
    }
    return Boolean(v);
}

/** Render a value the way Python `str()` would for the int-or-string fields here. */
function _str(v: Json): string {
    if (v === null || v === undefined) {
        return 'None';
    }
    if (typeof v === 'boolean') {
        return v ? 'True' : 'False';
    }
    return String(v);
}

/** Coerce a nested `stats` block value to a `Record<string, number>` for `_fmt_row`. */
function _countsBlock(v: Json): Record<string, number> {
    const o = _asObject(v);
    if (!o) {
        return {};
    }
    const out: Record<string, number> = {};
    for (const [k, val] of Object.entries(o)) {
        out[k] = val as number;
    }
    return out;
}

export interface ParsedArgs {
    manifest: string;
}

/**
 * Mirror the argparse surface: a single `--manifest PATH` option defaulting to
 * `DEFAULT_MANIFEST`. Unknown flags / `--help` are not a parity contract.
 */
export function parse_args(argv: string[]): ParsedArgs {
    let manifest = DEFAULT_MANIFEST;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--manifest') {
            const next = argv[i + 1];
            if (next === undefined) {
                process.stderr.write('discovery_stats: error: argument --manifest: expected one argument\n');
                process.exit(2);
            }
            manifest = next;
            i += 1;
        } else if (a.startsWith('--manifest=')) {
            manifest = a.slice('--manifest='.length);
        } else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: discovery_stats [-h] [--manifest MANIFEST]\n');
            process.exit(0);
        }
    }
    return { manifest };
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    if (!_exists(args.manifest)) {
        process.stderr.write(
            `error: manifest not found at ${args.manifest} ` +
                '— run `task build-discovery` first.\n',
        );
        return 1;
    }

    let manifest: Json;
    try {
        manifest = JSON.parse(fs.readFileSync(args.manifest, 'utf-8'));
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`error: invalid JSON: ${msg}\n`);
        return 1;
    }

    const manifestObj = _asObject(manifest);
    const stats = manifestObj ? manifestObj['stats'] : undefined;
    const statsObj = _asObject(stats);
    if (!statsObj) {
        process.stderr.write('error: manifest has no `stats` block (regenerate)\n');
        return 1;
    }

    // rel = args.manifest.relative_to(ROOT) if args.manifest.is_absolute() else args.manifest
    //
    // LATENT-BUG PARITY: when the manifest is an ABSOLUTE path that is not
    // under ROOT, `Path.relative_to(ROOT)` raises ValueError in the Python
    // original — uncaught, so the process prints a traceback and exits with a
    // non-zero code. The default manifest is always under ROOT, so this only
    // bites a custom absolute `--manifest` outside the repo. We replicate the
    // raise (the traceback prose is interpreter-dependent and not a parity
    // contract; the non-zero exit IS). Relative paths are echoed verbatim.
    let rel: string;
    if (_isAbsolute(args.manifest)) {
        const resolved = args.manifest; // pathlib does not resolve() here
        if (resolved === ROOT || _isUnder(resolved, ROOT)) {
            rel = _relativeToPosix(resolved, ROOT);
        } else {
            throw new Error(
                `'${resolved}' is not in the subpath of '${ROOT}' ` +
                    'OR one path is relative and the other is absolute.',
            );
        }
    } else {
        rel = args.manifest;
    }

    // dict.get(key, 0): present → value (even if falsy); absent → 0.
    const totalArtefacts = 'total_artefacts' in statsObj ? statsObj['total_artefacts'] : 0;

    process.stdout.write(`Discovery stats — ${rel}\n`);
    process.stdout.write(`  total          ${_str(totalArtefacts)}\n`);
    process.stdout.write(_fmt_row('by category', _countsBlock(statsObj['by_category'] ?? {})) + '\n');
    process.stdout.write(_fmt_row('by lifecycle', _countsBlock(statsObj['by_lifecycle'] ?? {})) + '\n');
    process.stdout.write(_fmt_row('by trust', _countsBlock(statsObj['by_trust_level'] ?? {})) + '\n');
    if (_pyTruthy(statsObj['unassigned_count'])) {
        process.stdout.write(`  unassigned     ${_str(statsObj['unassigned_count'])}\n`);
    }
    if (_pyTruthy(statsObj['documented_unassigned_count'])) {
        process.stdout.write(`  documented     ${_str(statsObj['documented_unassigned_count'])}\n`);
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
