#!/usr/bin/env tsx
/**
 * Phase-6 checksum-stability gate (monorepo Phase 2, ADR-015).
 *
 * TypeScript twin of `src/scripts/check_artefact_checksums.py` (ADR-089,
 * Phase 4 / Wave 4c). The CLI contract is mirrored EXACTLY — `--manifest`
 * / `--quiet` flags, exit codes (0 match, 1 drift / malformed / missing),
 * stdout/stderr split, byte-identical messages, the same per-artefact
 * checksum recomputation and the same error truncation (first 20 + "… and N
 * more"). No behaviour changes — latent bugs replicated.
 *
 * The Python original imports `_artefact_checksum` + `_CATEGORY_SCHEMA` from
 * `build_discovery_manifest.py` (which has no TS twin yet). To keep the TS
 * twin self-contained AND in lockstep, the checksum primitive is ported
 * inline here from `build_discovery_manifest._artefact_checksum` /
 * `_CATEGORY_SCHEMA` / `_FRONTMATTER_RE`, and frontmatter parsing +
 * schema-default injection reuse the existing `validate_frontmatter.ts`
 * twin (the SAME functions the Python imports).
 *
 * DIVERGENCE CANDIDATE (documented under the ADR-089 process): the recomputed
 * checksum hashes a compact-JSON re-serialization of the parsed frontmatter
 * (`json.dumps(fm, sort_keys=True, ensure_ascii=False, separators=(",",":"))`).
 * Byte-parity with Python depends on PyYAML and the `yaml` npm package parsing
 * every frontmatter scalar to the same JSON shape. The committed manifest is a
 * generated / gitignored artefact; golden parity skips when it is absent.
 *
 * Exit codes:
 *   0  every artefact checksum matches its source bytes
 *   1  one or more checksums drifted (manifest is stale, or source moved)
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    apply_schema_defaults,
    load_schema,
    parse_frontmatter,
    type YamlValue,
} from './validate_frontmatter.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_MANIFEST = path.join(ROOT, 'dist', 'discovery', 'discovery-manifest.json');

// Discovery category → frontmatter schema name (build_discovery_manifest._CATEGORY_SCHEMA).
const _CATEGORY_SCHEMA: Record<string, string> = {
    skill: 'skill',
    rule: 'rule',
    command: 'command',
};

// build_discovery_manifest._FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
const _FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;

type Json = unknown;
type JsonObject = Record<string, Json>;

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _relPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

// --- Compact sorted JSON (json.dumps(sort_keys=True, separators=(",",":"))) ---

function _sortRec(v: Json): Json {
    if (Array.isArray(v)) {
        return v.map(_sortRec);
    }
    if (v !== null && typeof v === 'object') {
        const out: JsonObject = {};
        for (const k of Object.keys(v as JsonObject).sort()) {
            out[k] = _sortRec((v as JsonObject)[k]);
        }
        return out;
    }
    return v;
}

/** Mirror json.dumps(fm, sort_keys=True, ensure_ascii=False, separators=(",",":")). */
function _compactSorted(fm: JsonObject): string {
    return JSON.stringify(_sortRec(fm));
}

/** Mirror build_discovery_manifest._artefact_checksum. */
function _artefact_checksum(p: string, fm: JsonObject | null): string {
    const text = fs.readFileSync(p, 'utf-8');
    const match = _FRONTMATTER_RE.exec(text);
    let raw: Buffer;
    if (fm === null || match === null) {
        const body =
            text
                .split('\n')
                .map((line) => line.replace(/\s+$/, ''))
                .join('\n')
                .replace(/\s+$/, '') + '\n';
        raw = Buffer.from(body, 'utf-8');
    } else {
        const fmJson = _compactSorted(fm);
        const bodyText = text.slice(match.index + match[0].length);
        const body =
            bodyText
                .split('\n')
                .map((line) => line.replace(/\s+$/, ''))
                .join('\n')
                .replace(/\s+$/, '') + '\n';
        raw = Buffer.from(fmJson + '\n' + body, 'utf-8');
    }
    return 'sha256:' + crypto.createHash('sha256').update(raw).digest('hex');
}

/** Mirror check_artefact_checksums._frontmatter. */
function _frontmatter(p: string, category: string | null = null): JsonObject | null {
    if (!_exists(p)) {
        return null;
    }
    const text = fs.readFileSync(p, 'utf-8');
    const [fm] = parse_frontmatter(text);
    // Inject the same schema defaults the builder injects.
    if (fm !== null && typeof fm === 'object' && !Array.isArray(fm)) {
        const schemaName = _CATEGORY_SCHEMA[category ?? ''];
        if (schemaName !== undefined) {
            apply_schema_defaults(fm as Record<string, YamlValue>, load_schema(schemaName));
        }
        return fm as JsonObject;
    }
    return null;
}

function _check(manifestPath: string): [number, string[]] {
    if (!_exists(manifestPath)) {
        return [1, [`manifest not found at ${manifestPath}`]];
    }

    let manifest: JsonObject;
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as JsonObject;
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        return [1, [`invalid JSON: ${msg}`]];
    }

    const errors: string[] = [];
    const artefacts = Array.isArray(manifest['artefacts'])
        ? (manifest['artefacts'] as Json[])
        : [];
    for (const artRaw of artefacts) {
        const art = (artRaw ?? {}) as JsonObject;
        const rel = art['path'];
        const recorded = art['checksum'];
        if (typeof rel !== 'string' || typeof recorded !== 'string') {
            errors.push(`malformed entry: ${_pyRepr(artRaw)}`);
            continue;
        }
        const src = path.join(ROOT, rel);
        if (!_exists(src)) {
            errors.push(`${rel}: source file missing`);
            continue;
        }
        const category = typeof art['category'] === 'string' ? (art['category'] as string) : null;
        const actual = _artefact_checksum(src, _frontmatter(src, category));
        if (actual !== recorded) {
            errors.push(
                `${rel}: checksum drift ` +
                    `(manifest=${recorded.slice(0, 23)}…, source=${actual.slice(0, 23)}…)`,
            );
        }
    }
    return [errors.length === 0 ? 0 : 1, errors];
}

/** Approximate Python `repr()` of a dict for the malformed-entry message. */
function _pyRepr(v: Json): string {
    if (v === null) return 'None';
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (typeof v === 'string') return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    if (typeof v === 'number') return String(v);
    if (Array.isArray(v)) {
        return '[' + v.map(_pyRepr).join(', ') + ']';
    }
    if (typeof v === 'object') {
        const parts = Object.entries(v as JsonObject).map(
            ([k, val]) => `${_pyRepr(k)}: ${_pyRepr(val)}`,
        );
        return '{' + parts.join(', ') + '}';
    }
    return String(v);
}

interface ParsedArgs {
    manifest: string;
    quiet: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    const args: ParsedArgs = { manifest: DEFAULT_MANIFEST, quiet: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--manifest') {
            const v = argv[++i];
            if (v === undefined) {
                process.stderr.write(
                    'check_artefact_checksums: error: argument --manifest: expected one argument\n',
                );
                process.exit(2);
            }
            args.manifest = path.isAbsolute(v) ? v : path.resolve(v);
        } else if (arg.startsWith('--manifest=')) {
            const v = arg.slice('--manifest='.length);
            args.manifest = path.isAbsolute(v) ? v : path.resolve(v);
        } else if (arg === '--quiet') {
            args.quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: check_artefact_checksums [-h] [--manifest MANIFEST] [--quiet]\n',
            );
            process.exit(0);
        } else {
            process.stderr.write(
                `check_artefact_checksums: error: unrecognized arguments: ${arg}\n`,
            );
            process.exit(2);
        }
    }
    return args;
}

function main(argv: readonly string[]): number {
    const args = parse_args(argv);

    const [code, errors] = _check(args.manifest);
    if (code !== 0) {
        for (const e of errors.slice(0, 20)) {
            process.stderr.write(`error: ${e}\n`);
        }
        if (errors.length > 20) {
            process.stderr.write(`  ... and ${errors.length - 20} more\n`);
        }
        process.stderr.write(
            'checksum-stability gate failed — run `task build-discovery` ' +
                'and commit dist/discovery/.\n',
        );
        return 1;
    }
    if (!args.quiet) {
        const manifest = JSON.parse(fs.readFileSync(args.manifest, 'utf-8')) as JsonObject;
        const artefacts = manifest['artefacts'] as Json[];
        process.stdout.write(
            `OK ${_relPosix(args.manifest, ROOT)}: ` +
                `${artefacts.length} artefact checksums verified.\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}

export {
    ROOT,
    DEFAULT_MANIFEST,
    _CATEGORY_SCHEMA,
    _artefact_checksum,
    _frontmatter,
    _check,
    main,
};
