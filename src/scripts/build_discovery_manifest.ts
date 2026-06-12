#!/usr/bin/env tsx
/**
 * Release-time discovery scanner — produces discovery-manifest.json.
 *
 * TypeScript twin of `src/scripts/build_discovery_manifest.py` (ADR-089,
 * Phase 5). The CLI contract is mirrored EXACTLY — every flag (`--write`,
 * `--out`, `--summary`, `--deprecation-report`, `--trust-report`,
 * `--orphan-report`, `--workspaces-json`, `--packs-json`, `--strict`,
 * `--quiet`), the CI-strict env override, exit codes, the stdout/stderr
 * split, byte-identical messages, and — critically — byte-identical
 * MANIFEST JSON (sort order, key order, 2-space indent, ensure_ascii=False,
 * sha256 checksum algorithm). The manifest is consumed by
 * `validate_discovery_manifest` / `check_discovery_determinism` /
 * `check_artefact_checksums`, which must keep passing.
 *
 * Walks the trusted-root tree, extracts the five Phase-4 frontmatter keys
 * (`workspaces`, `packs`, `lifecycle`, `trust`, `install`), validates each
 * value against the closed vocabulary in `src/config/discovery/*.yml`, and
 * emits a deterministic JSON manifest plus human-readable Markdown summaries.
 *
 * Imports the `_lib/agent_src` twin for the artefact walk and the
 * `validate_frontmatter` twin for frontmatter parse + schema-default
 * injection (the SAME functions the Python original imports). The checksum
 * primitive `_artefact_checksum` / `_CATEGORY_SCHEMA` / `_FRONTMATTER_RE` are
 * replicated here EXACTLY and kept in agreement with the inline copy in
 * `check_artefact_checksums.ts`.
 *
 * No behaviour changes — latent Python quirks replicated.
 *
 * DIVERGENCE CANDIDATE (documented under the ADR-089 process):
 * `_scanner_version()` in the Python original hashes the scanner file's OWN
 * bytes (`Path(__file__).read_bytes()`). For the TS-built manifest to remain
 * byte-identical to the Python-built one — and to keep passing the
 * Python-rebuild diff in `validate_discovery_manifest.py` — this twin hashes
 * the SIBLING `build_discovery_manifest.py` bytes (falling back to its own
 * `.ts` bytes only when the `.py` is absent, e.g. after the same-PR deletion).
 * Until the `.py` is deleted the manifest is byte-identical; after deletion
 * the manifest is regenerated from the `.ts` self-hash in the same PR.
 *
 * Schema: docs/contracts/discovery-manifest.schema.json
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import {
    apply_schema_defaults,
    load_schema,
    parse_frontmatter,
    type YamlValue,
} from './validate_frontmatter.js';
import {
    artefact_roots as _artefact_roots,
    command_slug,
    resolve_logical as _resolve_logical,
    strip_source_prefix,
} from './_lib/agent_src.js';

// Free-form JSON value alias. The manifest carries strings, numbers,
// booleans, null, nested objects, and arrays of those — no `any`.
type Json = unknown;
type JsonObject = Record<string, Json>;

const _HERE = fileURLToPath(import.meta.url);

// --- Module-level path config (mutable to mirror Python monkeypatch seam) ----
//
// The Python original derives ROOT / SRC / VOCAB_DIR / DEFAULT_* as
// module-level constants and `tests/test_build_discovery_manifest.py`
// reassigns `mod.ROOT`, `mod.SRC`, `mod.VOCAB_DIR`, `mod.artefact_roots`, and
// `mod.resolve_logical` via monkeypatch. To preserve that injection surface,
// the roots live in a mutable config the rest of the module reads through;
// tests mutate the same object via `_setConfigForTest`.

interface ModuleConfig {
    ROOT: string;
    SRC: string;
    VOCAB_DIR: string;
    DEFAULT_OUT: string;
    DEFAULT_SUMMARY: string;
    DEFAULT_DEPRECATION_REPORT: string;
    DEFAULT_TRUST_REPORT: string;
    DEFAULT_ORPHAN_REPORT: string;
    DEFAULT_WORKSPACES_JSON: string;
    DEFAULT_PACKS_JSON: string;
    // Patchable seams (Python monkeypatches these module attributes).
    artefact_roots: () => string[];
    resolve_logical: (rel: string) => string | null;
}

function _deriveConfig(root: string): ModuleConfig {
    const disc = path.join(root, 'dist', 'discovery');
    return {
        ROOT: root,
        SRC: path.join(root, '.agent-src.uncondensed'),
        VOCAB_DIR: path.join(root, 'src', 'config', 'discovery'),
        DEFAULT_OUT: path.join(disc, 'discovery-manifest.json'),
        DEFAULT_SUMMARY: path.join(disc, 'discovery-manifest.summary.md'),
        DEFAULT_DEPRECATION_REPORT: path.join(disc, 'deprecation-report.md'),
        DEFAULT_TRUST_REPORT: path.join(disc, 'trust-report.md'),
        DEFAULT_ORPHAN_REPORT: path.join(disc, 'orphan-report.md'),
        DEFAULT_WORKSPACES_JSON: path.join(disc, 'workspaces.json'),
        DEFAULT_PACKS_JSON: path.join(disc, 'packs.json'),
        artefact_roots: _artefact_roots,
        resolve_logical: _resolve_logical,
    };
}

// _HERE === <repo>/src/scripts/build_discovery_manifest.ts ; parents[2] of the
// .py file is the repo root — two dirs up from src/scripts.
const _DEFAULT_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const _config: ModuleConfig = _deriveConfig(_DEFAULT_ROOT);

/**
 * Test seam mirroring the Python tests' monkeypatch of `mod.ROOT`,
 * `mod.SRC`, `mod.VOCAB_DIR`, `mod.artefact_roots`, `mod.resolve_logical`.
 * Pass a partial config; unspecified fields keep their current values.
 * Not part of the Python surface — a TS-only injection point.
 */
export function _setConfigForTest(overrides: Partial<ModuleConfig>): void {
    Object.assign(_config, overrides);
}

/** Snapshot the current config (for save/restore in tests). */
export function _getConfigForTest(): ModuleConfig {
    return { ..._config };
}

// Read-only accessors mirroring the Python module-level constants. Functions
// because the underlying `_config` is mutable per the test seam.
export const ROOT = (): string => _config.ROOT;
export const SRC = (): string => _config.SRC;
export const VOCAB_DIR = (): string => _config.VOCAB_DIR;
export const DEFAULT_OUT = (): string => _config.DEFAULT_OUT;

// ``src`` is the 6.0.0-D flat-library container. Iteration is category-scoped,
// so only the artefact subtrees under src/ ever reach the trust gate.
const TRUST_ROOTS = [
    '.agent-src.uncondensed',
    '.augment',
    '.claude',
    'dist/agent-src',
    'packages',
    'src',
] as const;

const _FM_KEYS = ['workspaces', 'packs', 'lifecycle', 'trust', 'install'] as const;
const _TRUST_REQ = ['level', 'confidence', 'human_review_required'] as const;
const _INSTALL_REQ = ['default', 'removable'] as const;
const _LIFECYCLE_VALUES = ['active', 'experimental', 'deprecated', 'archived'] as const;
const _TRUST_VALUES = ['core', 'professional', 'experimental', 'advisory', 'restricted'] as const;
const _CATEGORY_VALUES = ['skill', 'rule', 'command', 'template'] as const;

// build_discovery_manifest._FRONTMATTER_RE (imported from validate_frontmatter
// in Python; the literal pattern is `^---\n(.*?)\n---\n` with re.DOTALL).
const _FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;

// Discovery category → frontmatter schema name. `template` has no schema and
// carries none of the defaulted fields, so it is left raw.
const _CATEGORY_SCHEMA: Record<string, string> = {
    skill: 'skill',
    rule: 'rule',
    command: 'command',
};

// --- Filesystem helpers reproducing pathlib semantics ------------------------

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _resolved(p: string): string {
    return path.resolve(p);
}

/** `true` when `child` is at or below `root` (mirrors `root in p.parents`). */
function _isUnder(child: string, root: string): boolean {
    const rel = path.relative(root, child);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** POSIX relative path of `child` under `root` (mirrors `relative_to().as_posix()`). */
function _relPosix(child: string, root: string): string {
    return path.relative(root, child).split(path.sep).join('/');
}

/**
 * `root.rglob(pattern)` returning a SORTED list of absolute path strings.
 * `pattern` is `"SKILL.md"` / `"*.md"` / `"command.md"` style — exact name or
 * `*<suffix>` glob. Recursive; sorted by full POSIX-string key (mirrors
 * `sorted(root.rglob(pattern))` over PosixPath).
 */
function _rglobSorted(root: string, pattern: string): string[] {
    const out: string[] = [];
    const matchExact = !pattern.includes('*');
    const suffix = pattern.startsWith('*') ? pattern.slice(1) : pattern;
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            const matches = matchExact ? ent.name === pattern : ent.name.endsWith(suffix);
            if (matches) {
                out.push(full);
            }
            if (ent.isDirectory()) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort();
    return out;
}

// --- Compact-sorted-JSON (json.dumps(sort_keys, separators=(",",":"))) -------

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
function _compactSorted(obj: JsonObject): string {
    return JSON.stringify(_sortRec(obj));
}

// --- YAML vocab loader -------------------------------------------------------

function _load_yaml(p: string): Json {
    // PyYAML safe_load parity. `version: '1.1'` matches PyYAML's 1.1 scalar
    // resolution (the discovery vocab uses only plain scalars / lists / maps).
    return parseYaml(fs.readFileSync(p, 'utf-8'), { version: '1.1' }) as Json;
}

interface VocabEntry {
    [key: string]: Json;
    id: string;
}

/**
 * Load discovery vocab. `overrides` keys are normalised to the *current*
 * physical repo-relative path, regardless of whether the YAML lists the legacy
 * `.agent-src.uncondensed/...` prefix or a `packages/*\/.agent-src.uncondensed/...`
 * prefix. The lookup site (`_build`) compares against physical paths emitted by
 * `_iter_artefacts`. Mirrors `_vocab`.
 */
function _vocab(): [VocabEntry[], VocabEntry[], Record<string, string>] {
    const workspaces = (_load_yaml(path.join(_config.VOCAB_DIR, 'workspaces.yml')) ??
        []) as VocabEntry[];
    const packs = (_load_yaml(path.join(_config.VOCAB_DIR, 'packs.yml')) ?? []) as VocabEntry[];
    const rawUn = (_load_yaml(path.join(_config.VOCAB_DIR, 'unassigned-artefacts.yml')) ??
        []) as Array<{ path: string; reason: string }>;
    const overrides: Record<string, string> = {};
    for (const entry of rawUn ?? []) {
        const rawPath = entry.path;
        const reason = entry.reason;
        const logical = strip_source_prefix(rawPath);
        if (logical === null) {
            // Path isn't under any source root — keep as-is (e.g. docs/).
            overrides[rawPath] = reason;
            continue;
        }
        // Map logical → current physical, so the lookup matches whatever root
        // the file actually lives in post-move.
        const physical = _config.resolve_logical(logical);
        if (physical !== null) {
            overrides[_relPosix(physical, _config.ROOT)] = reason;
        } else {
            // Not yet present — keep both the raw and the logical key so the
            // manifest stays stable when the file later lands.
            overrides[rawPath] = reason;
        }
    }
    return [workspaces, packs, overrides];
}

function _scanner_version(): string {
    // DIVERGENCE CANDIDATE: hash the SIBLING build_discovery_manifest.py bytes
    // so the manifest stays byte-identical to the Python-built one (and keeps
    // passing the Python-rebuild diff in validate_discovery_manifest.py). Fall
    // back to this twin's own bytes once the .py is deleted (same-PR; the
    // manifest is regenerated then anyway).
    const pyPath = path.join(path.dirname(_HERE), 'build_discovery_manifest.py');
    const target = _isFile(pyPath) ? pyPath : _HERE;
    const h = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    return h.slice(0, 12);
}

/**
 * sha256 over normalized artefact content (ADR-015). Mirrors
 * `_artefact_checksum`.
 *
 * Normalization: frontmatter re-serialized as compact JSON with sorted keys,
 * body stripped of trailing whitespace per line + single trailing newline.
 */
function _artefact_checksum(p: string, fm: JsonObject | null): string {
    const text = fs.readFileSync(p, 'utf-8'); // errors="replace" parity: Node utf-8 substitutes U+FFFD
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

/**
 * Deterministic order: skills → rules → commands → templates. Mirrors
 * `_iter_artefacts`. Yields `[physicalPath, category]`.
 */
function* _iter_artefacts(): Generator<[string, string]> {
    const _collect = (subdir: string, pattern: string): string[] => {
        const seen = new Map<string, string>();
        for (const root of _config.artefact_roots()) {
            const base = path.join(root, subdir);
            if (!_exists(base)) {
                continue;
            }
            for (const p of _rglobSorted(base, pattern)) {
                if (!_isFile(p)) {
                    continue;
                }
                const rel = _relPosix(p, root);
                if (!seen.has(rel)) {
                    seen.set(rel, p);
                }
            }
        }
        return [...seen.keys()].sort().map((k) => seen.get(k) as string);
    };

    for (const p of _collect('skills', 'SKILL.md')) {
        yield [p, 'skill'];
    }
    for (const p of _collect('rules', '*.md')) {
        yield [p, 'rule'];
    }
    // Commands: the legacy / packages command trees via artefact_roots, PLUS
    // the 6.0.0-D src/domains/<pack>/<subpath>/command.md homes scanned
    // relative to the (patchable) module ROOT.
    for (const p of _collect('commands', '*.md')) {
        yield [p, 'command'];
    }
    const domainsRoot = path.join(_config.ROOT, 'src', 'domains');
    if (_isDir(domainsRoot)) {
        for (const p of _rglobSorted(domainsRoot, 'command.md')) {
            if (_isFile(p)) {
                yield [p, 'command'];
            }
        }
    }
    // 6.0.0-D Step 16b moved the install-scaffold templates to src/templates/.
    // Those are install scaffold shipped via package.json files[], NOT
    // discovery "template" content. Skip them so strict mode does not demand
    // artefact frontmatter on them.
    const scaffold = _resolved(path.join(_config.ROOT, 'src', 'templates'));
    for (const p of _collect('templates', '*.md')) {
        const rp = _resolved(p);
        if (rp === scaffold || _isUnder(rp, scaffold)) {
            continue;
        }
        yield [p, 'template'];
    }
}

function _trusted(p: string): boolean {
    const rel = _relPosix(p, _config.ROOT);
    return TRUST_ROOTS.some((r) => rel.startsWith(r + '/'));
}

/** Mirrors `_parse`. */
function _parse(p: string, category: string | null = null): JsonObject | null {
    const text = fs.readFileSync(p, 'utf-8');
    const [fm] = parse_frontmatter(text);
    if (fm === null || typeof fm !== 'object' || Array.isArray(fm)) {
        return null;
    }
    // Inject schema defaults so an artefact that omits a field equal to its
    // default still presents the field to the required-key checks AND the
    // drift checksum — keeping the checksum byte-stable across the migration.
    const schemaName = _CATEGORY_SCHEMA[category ?? ''];
    if (schemaName !== undefined) {
        apply_schema_defaults(fm as Record<string, YamlValue>, load_schema(schemaName));
    }
    return fm as JsonObject;
}

function _isObject(v: Json): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Return `[artefactPayload, unassignedReason]`. Exactly one is null. Mirrors
 * `_classify`.
 */
function _classify(
    fm: JsonObject | null,
    wsIds: Set<string>,
    packIds: Set<string>,
): [JsonObject | null, string | null] {
    if (fm === null) {
        return [null, 'missing or unparseable frontmatter'];
    }
    const missing = _FM_KEYS.filter((k) => !(k in fm));
    if (missing.length > 0) {
        return [null, `missing required key(s): ${missing.join(', ')}`];
    }

    const ws = fm['workspaces'];
    if (!Array.isArray(ws) || ws.length === 0) {
        return [null, 'workspaces: must be a non-empty list'];
    }
    let bad = ws.filter((w) => !wsIds.has(w as string));
    if (bad.length > 0) {
        return [null, `unknown workspace(s): ${bad.join(', ')} (not in vocabulary)`];
    }

    const pk = fm['packs'];
    if (!Array.isArray(pk) || pk.length === 0) {
        return [null, 'packs: must be a non-empty list'];
    }
    bad = pk.filter((p) => !packIds.has(p as string));
    if (bad.length > 0) {
        return [null, `unknown pack(s): ${bad.join(', ')} (not in vocabulary)`];
    }

    const lc = fm['lifecycle'];
    if (!(_LIFECYCLE_VALUES as readonly Json[]).includes(lc)) {
        return [null, `lifecycle: invalid value '${String(lc)}'`];
    }

    const trust = fm['trust'];
    if (!_isObject(trust) || _TRUST_REQ.some((k) => !(k in trust))) {
        // Mirror Python's tuple repr `('level', 'confidence', 'human_review_required')`.
        return [null, `trust: missing required key(s) ${_pyTupleRepr(_TRUST_REQ)}`];
    }
    if (!(_TRUST_VALUES as readonly Json[]).includes(trust['level'])) {
        return [null, `trust.level: invalid '${String(trust['level'])}'`];
    }
    if (!(['high', 'medium', 'low'] as Json[]).includes(trust['confidence'])) {
        return [null, `trust.confidence: invalid '${String(trust['confidence'])}'`];
    }
    if (typeof trust['human_review_required'] !== 'boolean') {
        return [null, 'trust.human_review_required: must be boolean'];
    }

    const install = fm['install'];
    if (!_isObject(install) || _INSTALL_REQ.some((k) => !(k in install))) {
        return [null, `install: missing required key(s) ${_pyTupleRepr(_INSTALL_REQ)}`];
    }
    if (typeof install['default'] !== 'boolean' || typeof install['removable'] !== 'boolean') {
        return [null, 'install.default and install.removable must be boolean'];
    }

    // Optional `requires` — ADR-015 dependency edges. Closed vocabulary.
    const requiresRaw = fm['requires'];
    let requires: Json[] = [];
    if (requiresRaw !== undefined && requiresRaw !== null) {
        if (!Array.isArray(requiresRaw)) {
            return [null, 'requires: must be a list of pack ids'];
        }
        const badReq = requiresRaw.filter((r) => !packIds.has(r as string));
        if (badReq.length > 0) {
            return [null, `requires: unknown pack(s) ${badReq.join(', ')}`];
        }
        requires = [...requiresRaw];
    }

    // Optional `pack` — capability-packs.md canonical owner. Single id, closed
    // vocabulary. Orthogonal to `packs`.
    const owner = fm['pack'];
    if (owner !== undefined && owner !== null && (typeof owner !== 'string' || !packIds.has(owner))) {
        return [null, `pack: unknown owner '${String(owner)}'`];
    }

    const payload: JsonObject = {
        workspaces: [...ws],
        packs: [...pk],
        lifecycle: lc,
        trust: {
            level: trust['level'],
            confidence: trust['confidence'],
            human_review_required: trust['human_review_required'],
        },
        install: { default: install['default'], removable: install['removable'] },
    };
    if (requires.length > 0) {
        payload['requires'] = requires;
    }
    if (typeof owner === 'string' && owner) {
        payload['pack'] = owner;
    }
    return [payload, null];
}

/** Python tuple repr `('a', 'b', 'c')` for the missing-key messages. */
function _pyTupleRepr(items: readonly string[]): string {
    if (items.length === 1) {
        return `('${items[0]}',)`;
    }
    return `(${items.map((i) => `'${i}'`).join(', ')})`;
}

/** Class thrown to mirror `raise SystemExit(msg)` from `_build`. */
class ExitError extends Error {}

/** Mirrors `_build`. Returns `[manifest, unassigned]`. */
function _build(strict: boolean): [JsonObject, JsonObject[]] {
    const [workspaces, packs, overrides] = _vocab();
    const wsIds = new Set(workspaces.map((w) => w['id'] as string));
    const packIds = new Set(packs.map((p) => p['id'] as string));

    const artefacts: JsonObject[] = [];
    const unassigned: JsonObject[] = [];
    const packCounts = new Map<string, number>();
    for (const pid of packIds) {
        packCounts.set(pid, 0);
    }
    // Phase 5.1 (ADR-018): per-pack trust mix + HRR count for installer.
    const packTrustCounts = new Map<string, Map<string, number>>();
    for (const pid of packIds) {
        const m = new Map<string, number>();
        for (const lvl of _TRUST_VALUES) {
            m.set(lvl, 0);
        }
        packTrustCounts.set(pid, m);
    }
    const packHrrCounts = new Map<string, number>();
    for (const pid of packIds) {
        packHrrCounts.set(pid, 0);
    }

    const documentedUnassigned: JsonObject[] = [];

    for (const [p, category] of _iter_artefacts()) {
        const rel = _relPosix(p, _config.ROOT);
        if (!_trusted(p)) {
            unassigned.push({ path: rel, category, reason: 'outside trusted-root allow-list' });
            continue;
        }
        if (rel in overrides) {
            documentedUnassigned.push({ path: rel, category, reason: overrides[rel] });
            continue;
        }
        const fm = _parse(p, category);
        const [payload, reason] = _classify(fm, wsIds, packIds);
        if (reason !== null) {
            unassigned.push({ path: rel, category, reason });
            continue;
        }
        const name = fm !== null && _isObject(fm) ? fm['name'] : null;
        const entry: JsonObject = { path: rel, category };
        if (typeof name === 'string' && name) {
            entry['name'] = name;
        }
        Object.assign(entry, payload ?? {});
        // 6.0.0-C: surface command routing metadata. Does not affect the
        // per-file checksum (computed over frontmatter, below).
        if (category === 'command' && fm !== null && _isObject(fm)) {
            if (fm['tier'] !== undefined && fm['tier'] !== null) {
                entry['tier'] = fm['tier'];
            }
            for (const k of ['intent', 'routes_to', 'replaces']) {
                if (fm[k] !== undefined && fm[k] !== null) {
                    entry[k] = fm[k];
                }
            }
            // Canonical path-derived slug (ADR-044).
            const slug = command_slug(p);
            if (slug) {
                entry['slug'] = slug;
            }
        }
        entry['checksum'] = _artefact_checksum(p, fm);
        artefacts.push(entry);
        const trustObj = payload ? (payload['trust'] as JsonObject | undefined) : undefined;
        const trustLevel = trustObj ? (trustObj['level'] as string | undefined) : undefined;
        const hrr = trustObj ? Boolean(trustObj['human_review_required']) : false;
        const payloadPacks = payload ? (payload['packs'] as Json[]) : [];
        for (const pidRaw of payloadPacks) {
            const pid = pidRaw as string;
            packCounts.set(pid, (packCounts.get(pid) ?? 0) + 1);
            const tcMap = packTrustCounts.get(pid);
            if (trustLevel !== undefined && tcMap && tcMap.has(trustLevel)) {
                tcMap.set(trustLevel, (tcMap.get(trustLevel) ?? 0) + 1);
            }
            if (hrr) {
                packHrrCounts.set(pid, (packHrrCounts.get(pid) ?? 0) + 1);
            }
        }
    }

    artefacts.sort((a, b) => _cmpStr(a['path'] as string, b['path'] as string));
    unassigned.sort((a, b) => _cmpStr(a['path'] as string, b['path'] as string));
    documentedUnassigned.sort((a, b) => _cmpStr(a['path'] as string, b['path'] as string));

    const wsOut: JsonObject[] = workspaces.map((w) => {
        const o: JsonObject = {
            id: w['id'],
            label: w['label'],
            description: w['description'],
            default_packs: [...((w['default_packs'] as Json[] | undefined) ?? [])],
        };
        if (_pyTruthy(w['optional_packs'])) {
            o['optional_packs'] = [...(w['optional_packs'] as Json[])];
        }
        if (_pyTruthy(w['example_roles'])) {
            o['example_roles'] = [...(w['example_roles'] as Json[])];
        }
        return o;
    });

    const pkOut: JsonObject[] = [];
    for (const p of packs) {
        const pid = p['id'] as string;
        const trustSummary: JsonObject = {};
        const tcMap = packTrustCounts.get(pid);
        for (const lvl of _TRUST_VALUES) {
            trustSummary[lvl] = tcMap ? (tcMap.get(lvl) ?? 0) : 0;
        }
        const item: JsonObject = {
            id: pid,
            label: p['label'],
            description: p['description'],
            workspaces: [...((p['workspaces'] as Json[] | undefined) ?? [])],
            trust_level_default: p['trust_level_default'],
            artefact_count: packCounts.get(pid) ?? 0,
            trust_summary: trustSummary,
            human_review_required: packHrrCounts.get(pid) ?? 0,
        };
        // `requires` (capability-packs.md) supersedes the legacy `requires_hint`
        // name. Read either; emit both during the deprecation window.
        const requires = [
            ...(((p['requires'] as Json[] | undefined) ??
                (p['requires_hint'] as Json[] | undefined)) ??
                []),
        ];
        if (requires.length > 0) {
            item['requires'] = requires;
            item['requires_hint'] = requires;
        }
        if (_pyTruthy(p['suggests'])) {
            item['suggests'] = [...(p['suggests'] as Json[])];
        }
        if (_pyTruthy(p['domain'])) {
            item['domain'] = p['domain'];
        }
        if (_pyTruthy(p['size_class'])) {
            item['size_class'] = p['size_class'];
        }
        if (_pyTruthy(p['always_on'])) {
            item['always_on'] = true;
        }
        if (_pyTruthy(p['cluster'])) {
            item['cluster'] = p['cluster'];
        }
        pkOut.push(item);
    }

    if (strict && unassigned.length > 0) {
        const first = unassigned[0] as JsonObject;
        throw new ExitError(
            `strict mode: ${unassigned.length} unassigned artefact(s); ` +
                `first: ${String(first['path'])} — ${String(first['reason'])}`,
        );
    }

    const stats = _compute_stats(artefacts, unassigned, documentedUnassigned);

    const manifest: JsonObject = {
        version: 1,
        generated_at: _nowUtc(),
        scanner_version: _scanner_version(),
        checksum: 'sha256:' + '0'.repeat(64),
        workspaces: wsOut,
        packs: pkOut,
        artefacts,
        unassigned,
        documented_unassigned: documentedUnassigned,
        stats,
    };
    return [manifest, unassigned];
}

/** Mirror Python str comparison (code-point order) used by `sort(key=...)`. */
function _cmpStr(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Mirror Python truthiness (`if w.get(...)`). Falsy: undefined, null, false,
 * 0, "" and the EMPTY array/object — distinct from JS, where `[]`/`{}` are
 * truthy. Used at the optional-field emission sites in `_build` so an empty
 * `optional_packs` / `example_roles` / `suggests` is omitted exactly as the
 * Python original omits it.
 */
function _pyTruthy(v: Json): boolean {
    if (v === undefined || v === null || v === false || v === '' || v === 0) {
        return false;
    }
    if (Array.isArray(v)) {
        return v.length > 0;
    }
    if (typeof v === 'object') {
        return Object.keys(v).length > 0;
    }
    return Boolean(v);
}

/** Mirror `datetime.now(utc).strftime("%Y-%m-%dT%H:%M:%SZ")`. */
function _nowUtc(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Aggregate counts derived from the artefact list (ADR-015). Mirrors `_compute_stats`. */
function _compute_stats(
    artefacts: JsonObject[],
    unassigned: JsonObject[],
    documentedUnassigned: JsonObject[],
): JsonObject {
    const byCategory: JsonObject = {};
    for (const k of _CATEGORY_VALUES) {
        byCategory[k] = 0;
    }
    const byLifecycle: JsonObject = {};
    for (const k of _LIFECYCLE_VALUES) {
        byLifecycle[k] = 0;
    }
    const byTrustLevel: JsonObject = {};
    for (const k of _TRUST_VALUES) {
        byTrustLevel[k] = 0;
    }
    for (const a of artefacts) {
        const cat = a['category'];
        if (typeof cat === 'string' && cat in byCategory) {
            byCategory[cat] = (byCategory[cat] as number) + 1;
        }
        const lc = a['lifecycle'];
        if (typeof lc === 'string' && lc in byLifecycle) {
            byLifecycle[lc] = (byLifecycle[lc] as number) + 1;
        }
        const trust = a['trust'];
        const lvl = _isObject(trust) ? trust['level'] : undefined;
        if (typeof lvl === 'string' && lvl in byTrustLevel) {
            byTrustLevel[lvl] = (byTrustLevel[lvl] as number) + 1;
        }
    }
    return {
        total_artefacts: artefacts.length,
        by_category: byCategory,
        by_lifecycle: byLifecycle,
        by_trust_level: byTrustLevel,
        unassigned_count: unassigned.length,
        documented_unassigned_count: documentedUnassigned.length,
    };
}

/** Deterministic JSON: sorted keys, 2-space indent, trailing newline. Mirrors `_serialize`. */
function _serialize(manifest: JsonObject): string {
    return JSON.stringify(_sortRec(manifest), null, 2) + '\n';
}

/** Mirrors `_finalise_checksum`. */
function _finalise_checksum(manifest: JsonObject): void {
    // Checksum covers structural content only — `generated_at` is wall-clock
    // and intentionally excluded so the hash stays byte-stable across runs.
    const generatedAt = manifest['generated_at'];
    manifest['checksum'] = 'sha256:' + '0'.repeat(64);
    manifest['generated_at'] = '<normalised>';
    const raw = Buffer.from(_serialize(manifest), 'utf-8');
    const digest = crypto.createHash('sha256').update(raw).digest('hex');
    manifest['generated_at'] = generatedAt;
    manifest['checksum'] = `sha256:${digest}`;
}

/** List every `lifecycle: deprecated` artefact (ADR-015, Phase 4). Mirrors `_deprecation_report`. */
function _deprecation_report(manifest: JsonObject): string {
    const items = (manifest['artefacts'] as JsonObject[]).filter(
        (a) => a['lifecycle'] === 'deprecated',
    );
    items.sort((a, b) => _cmpStr(a['path'] as string, b['path'] as string));
    const lines = ['# Discovery — Deprecation Report', ''];
    lines.push(`- Generated: \`${String(manifest['generated_at'])}\``);
    lines.push(`- Deprecated artefacts: **${items.length}**`);
    lines.push('');
    if (items.length === 0) {
        lines.push('_None. Tree is clean._');
        lines.push('');
        return lines.join('\n') + '\n';
    }
    lines.push('| Path | Category | Trust |');
    lines.push('|---|---|---|');
    for (const a of items) {
        const trust = a['trust'] as JsonObject;
        lines.push(`| \`${String(a['path'])}\` | ${String(a['category'])} | ${String(trust['level'])} |`);
    }
    lines.push('');
    return lines.join('\n') + '\n';
}

/** Trust-level breakdown by workspace + human-review sanity flag. Mirrors `_trust_report`. */
function _trust_report(manifest: JsonObject): string {
    const byWs = new Map<string, JsonObject>();
    const reviewFlags: JsonObject[] = [];
    for (const a of manifest['artefacts'] as JsonObject[]) {
        const trust = a['trust'] as JsonObject;
        const level = trust['level'] as string;
        for (const ws of a['workspaces'] as string[]) {
            if (!byWs.has(ws)) {
                const m: JsonObject = {};
                for (const k of _TRUST_VALUES) {
                    m[k] = 0;
                }
                byWs.set(ws, m);
            }
            const counts = byWs.get(ws) as JsonObject;
            counts[level] = (counts[level] as number) + 1;
        }
        if (trust['human_review_required']) {
            reviewFlags.push(a);
        }
    }
    reviewFlags.sort((a, b) => _cmpStr(a['path'] as string, b['path'] as string));
    const lines = ['# Discovery — Trust Report', ''];
    lines.push(`- Generated: \`${String(manifest['generated_at'])}\``);
    lines.push(`- Workspaces tracked: **${byWs.size}**`);
    lines.push(`- Human-review-required artefacts: **${reviewFlags.length}**`);
    lines.push('');
    lines.push('## Trust levels by workspace');
    lines.push('');
    const header = '| Workspace | ' + _TRUST_VALUES.join(' | ') + ' |';
    const sep = '|---|' + Array(_TRUST_VALUES.length).fill('---').join('|') + '|';
    lines.push(header, sep);
    for (const ws of [...byWs.keys()].sort(_cmpStr)) {
        const counts = byWs.get(ws) as JsonObject;
        const row =
            `| \`${ws}\` | ` + _TRUST_VALUES.map((k) => String(counts[k])).join(' | ') + ' |';
        lines.push(row);
    }
    lines.push('');
    if (reviewFlags.length > 0) {
        lines.push('## Human-review-required artefacts');
        lines.push('');
        lines.push('| Path | Workspaces | Trust |');
        lines.push('|---|---|---|');
        for (const a of reviewFlags) {
            const trust = a['trust'] as JsonObject;
            lines.push(
                `| \`${String(a['path'])}\` | ${(a['workspaces'] as string[]).join(', ')} | ${String(trust['level'])} |`,
            );
        }
        lines.push('');
    }
    return lines.join('\n') + '\n';
}

/**
 * Artefacts whose declared pack has no other members (likely typo).
 * `experimental` lifecycle is a sanctioned carve-out (ADR-015). Mirrors
 * `_orphan_artefacts`.
 */
function _orphan_artefacts(manifest: JsonObject): JsonObject[] {
    const packMembers = new Map<string, JsonObject[]>();
    for (const a of manifest['artefacts'] as JsonObject[]) {
        for (const pid of a['packs'] as string[]) {
            const arr = packMembers.get(pid) ?? [];
            arr.push(a);
            packMembers.set(pid, arr);
        }
    }
    const orphans: JsonObject[] = [];
    for (const a of manifest['artefacts'] as JsonObject[]) {
        if (a['lifecycle'] === 'experimental') {
            continue;
        }
        for (const pid of a['packs'] as string[]) {
            if ((packMembers.get(pid) ?? []).length === 1) {
                orphans.push({ path: a['path'], pack: pid, category: a['category'] });
                break;
            }
        }
    }
    orphans.sort((a, b) => _cmpStr(a['path'] as string, b['path'] as string));
    return orphans;
}

/** Mirrors `_orphan_report`. */
function _orphan_report(manifest: JsonObject): string {
    const orphans = _orphan_artefacts(manifest);
    const lines = ['# Discovery — Orphan Report', ''];
    lines.push(`- Generated: \`${String(manifest['generated_at'])}\``);
    lines.push(`- Orphan artefacts: **${orphans.length}**`);
    lines.push('');
    lines.push('> An orphan is an artefact whose declared pack has no other members.');
    lines.push('> `lifecycle: experimental` is a sanctioned carve-out (ADR-015).');
    lines.push('');
    if (orphans.length === 0) {
        lines.push('_No orphans. Pack assignments look healthy._');
        lines.push('');
        return lines.join('\n') + '\n';
    }
    lines.push('| Path | Pack | Category |');
    lines.push('|---|---|---|');
    for (const o of orphans) {
        lines.push(`| \`${String(o['path'])}\` | \`${String(o['pack'])}\` | ${String(o['category'])} |`);
    }
    lines.push('');
    return lines.join('\n') + '\n';
}

/** Flattened workspace sub-view (ADR-015 Phase 5). Mirrors `_workspaces_view`. */
function _workspaces_view(manifest: JsonObject): JsonObject {
    const packToArtefacts = new Map<string, string[]>();
    for (const a of manifest['artefacts'] as JsonObject[]) {
        for (const pid of a['packs'] as string[]) {
            const arr = packToArtefacts.get(pid) ?? [];
            arr.push(a['path'] as string);
            packToArtefacts.set(pid, arr);
        }
    }
    for (const arr of packToArtefacts.values()) {
        arr.sort(_cmpStr);
    }
    const workspaces: JsonObject[] = [];
    for (const w of manifest['workspaces'] as JsonObject[]) {
        const packsBlock: JsonObject[] = [];
        const defaultPacks = (w['default_packs'] as string[] | undefined) ?? [];
        const optionalPacks = (w['optional_packs'] as string[] | undefined) ?? [];
        for (const pid of [...defaultPacks, ...optionalPacks]) {
            const ids = packToArtefacts.get(pid) ?? [];
            packsBlock.push({ id: pid, artefact_count: ids.length, artefacts: ids });
        }
        const visible = new Set<string>();
        for (const entry of packsBlock) {
            for (const a of entry['artefacts'] as string[]) {
                visible.add(a);
            }
        }
        workspaces.push({
            id: w['id'],
            label: w['label'],
            description: w['description'],
            default_packs: [...defaultPacks],
            optional_packs: [...optionalPacks],
            artefact_count: visible.size,
            packs: packsBlock,
        });
    }
    return {
        generated_at: manifest['generated_at'],
        scanner_version: manifest['scanner_version'],
        checksum: manifest['checksum'],
        workspaces,
    };
}

/** Flattened pack sub-view (ADR-015 Phase 5). Mirrors `_packs_view`. */
function _packs_view(manifest: JsonObject): JsonObject {
    const packToArtefacts = new Map<string, JsonObject[]>();
    for (const a of manifest['artefacts'] as JsonObject[]) {
        for (const pid of a['packs'] as string[]) {
            const arr = packToArtefacts.get(pid) ?? [];
            arr.push(a);
            packToArtefacts.set(pid, arr);
        }
    }
    const packs: JsonObject[] = [];
    for (const p of manifest['packs'] as JsonObject[]) {
        const members = packToArtefacts.get(p['id'] as string) ?? [];
        const lifecycleCounts: JsonObject = {};
        for (const k of _LIFECYCLE_VALUES) {
            lifecycleCounts[k] = 0;
        }
        const trustCounts: JsonObject = {};
        for (const k of _TRUST_VALUES) {
            trustCounts[k] = 0;
        }
        const ids: string[] = [];
        for (const a of members) {
            ids.push(a['path'] as string);
            const lc = a['lifecycle'] as string;
            lifecycleCounts[lc] = (lifecycleCounts[lc] as number) + 1;
            const lvl = (a['trust'] as JsonObject)['level'] as string;
            trustCounts[lvl] = (trustCounts[lvl] as number) + 1;
        }
        ids.sort(_cmpStr);
        packs.push({
            id: p['id'],
            label: p['label'],
            description: p['description'],
            workspaces: [...((p['workspaces'] as Json[] | undefined) ?? [])],
            requires: [
                ...(((p['requires'] as Json[] | undefined) ??
                    (p['requires_hint'] as Json[] | undefined)) ??
                    []),
            ],
            requires_hint: [...((p['requires_hint'] as Json[] | undefined) ?? [])],
            suggests: [...((p['suggests'] as Json[] | undefined) ?? [])],
            domain: p['domain'] ?? null,
            size_class: p['size_class'] ?? null,
            always_on: Boolean(p['always_on']),
            cluster: p['cluster'] ?? null,
            trust_level_default: p['trust_level_default'] ?? null,
            artefact_count: ids.length,
            artefacts: ids,
            by_lifecycle: lifecycleCounts,
            by_trust_level: trustCounts,
        });
    }
    return {
        generated_at: manifest['generated_at'],
        scanner_version: manifest['scanner_version'],
        checksum: manifest['checksum'],
        packs,
    };
}

/** Mirrors `_summary`. */
function _summary(manifest: JsonObject): string {
    const lines = ['# Discovery Manifest — Summary', ''];
    lines.push(`- Generated: \`${String(manifest['generated_at'])}\``);
    lines.push(`- Scanner: \`${String(manifest['scanner_version'])}\``);
    lines.push(`- Artefacts: **${(manifest['artefacts'] as Json[]).length}**`);
    lines.push(`- Unassigned: **${(manifest['unassigned'] as Json[]).length}**`);
    lines.push('');
    const packById = new Map<string, JsonObject>();
    for (const p of manifest['packs'] as JsonObject[]) {
        packById.set(p['id'] as string, p);
    }
    for (const w of manifest['workspaces'] as JsonObject[]) {
        lines.push(`## \`${String(w['id'])}\` — ${String(w['label'])}`);
        lines.push('');
        lines.push(`> ${String(w['description'])}`);
        lines.push('');
        lines.push('| Pack | Artefacts |');
        lines.push('|---|---|');
        const defaultPacks = (w['default_packs'] as string[] | undefined) ?? [];
        const optionalPacks = (w['optional_packs'] as string[] | undefined) ?? [];
        for (const pid of [...defaultPacks, ...optionalPacks]) {
            const p = packById.get(pid);
            if (p) {
                lines.push(`| \`${pid}\` — ${String(p['label'])} | ${String(p['artefact_count'])} |`);
            }
        }
        lines.push('');
    }
    return lines.join('\n') + '\n';
}

// --- CLI ---------------------------------------------------------------------

interface ParsedArgs {
    write: boolean;
    out: string;
    summary: string;
    deprecation_report: string;
    trust_report: string;
    orphan_report: string;
    workspaces_json: string;
    packs_json: string;
    strict: boolean;
    quiet: boolean;
}

const _PROG = 'build_discovery_manifest.py';

/** Emit argparse's `usage:\n{prog}: error: {msg}\n` to stderr and exit 2. */
function _argError(usage: string, msg: string): never {
    process.stderr.write(usage);
    process.stderr.write(`${_PROG}: error: ${msg}\n`);
    process.exit(2);
}

function _parsePathArg(
    argv: readonly string[],
    i: number,
    flag: string,
    usage: string,
): [string, number] {
    const next = argv[i + 1];
    if (next === undefined) {
        _argError(usage, `argument ${flag}: expected one argument`);
    }
    return [path.isAbsolute(next) ? next : path.resolve(next), i + 1];
}

function parse_args(argv: readonly string[]): ParsedArgs {
    const args: ParsedArgs = {
        write: false,
        out: _config.DEFAULT_OUT,
        summary: _config.DEFAULT_SUMMARY,
        deprecation_report: _config.DEFAULT_DEPRECATION_REPORT,
        trust_report: _config.DEFAULT_TRUST_REPORT,
        orphan_report: _config.DEFAULT_ORPHAN_REPORT,
        workspaces_json: _config.DEFAULT_WORKSPACES_JSON,
        packs_json: _config.DEFAULT_PACKS_JSON,
        strict: false,
        quiet: false,
    };
    const usage =
        'usage: build_discovery_manifest.py [-h] [--write] [--out OUT]\n' +
        '                                   [--summary SUMMARY]\n' +
        '                                   [--deprecation-report DEPRECATION_REPORT]\n' +
        '                                   [--trust-report TRUST_REPORT]\n' +
        '                                   [--orphan-report ORPHAN_REPORT]\n' +
        '                                   [--workspaces-json WORKSPACES_JSON]\n' +
        '                                   [--packs-json PACKS_JSON] [--strict]\n' +
        '                                   [--quiet]\n';
    // Map of `--flag` → config key for the path-valued options.
    const pathFlags: Record<string, keyof ParsedArgs> = {
        '--out': 'out',
        '--summary': 'summary',
        '--deprecation-report': 'deprecation_report',
        '--trust-report': 'trust_report',
        '--orphan-report': 'orphan_report',
        '--workspaces-json': 'workspaces_json',
        '--packs-json': 'packs_json',
    };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i] as string;
        if (arg === '-h' || arg === '--help') {
            process.stdout.write(usage);
            process.exit(0);
        } else if (arg === '--write') {
            args.write = true;
        } else if (arg === '--strict') {
            args.strict = true;
        } else if (arg === '--quiet') {
            args.quiet = true;
        } else if (arg in pathFlags) {
            const [val, ni] = _parsePathArg(argv, i, arg, usage);
            (args[pathFlags[arg] as keyof ParsedArgs] as string) = val;
            i = ni;
        } else {
            const eq = arg.indexOf('=');
            const flag = eq === -1 ? arg : arg.slice(0, eq);
            if (eq !== -1 && flag in pathFlags) {
                const v = arg.slice(eq + 1);
                (args[pathFlags[flag] as keyof ParsedArgs] as string) = path.isAbsolute(v)
                    ? v
                    : path.resolve(v);
            } else {
                _argError(usage, `unrecognized arguments: ${arg}`);
            }
        }
    }
    return args;
}

function _writeFileMkdir(target: string, body: string): void {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body, 'utf-8');
}

function main(argv: readonly string[]): number {
    const args = parse_args(argv);

    // Phase 4.4 gate: in CI, behave as if --strict were passed. Local
    // invocations stay permissive unless --strict is explicit.
    const ciEnv = (process.env.CI ?? '').toLowerCase();
    const strict = args.strict || ciEnv === 'true' || ciEnv === '1';
    let manifest: JsonObject;
    let unassigned: JsonObject[];
    [manifest, unassigned] = _build(strict);
    _finalise_checksum(manifest);
    const body = _serialize(manifest);

    // ADR-015 Phase 4: orphan gate. Strict (CI) mode fails; local runs warn.
    const orphans = _orphan_artefacts(manifest);
    if (orphans.length > 0 && strict) {
        process.stderr.write(
            `error: ${orphans.length} orphan artefact(s) found ` +
                '(non-experimental, pack has no other members). ' +
                'See dist/discovery/orphan-report.md.\n',
        );
        for (const o of orphans.slice(0, 10)) {
            process.stderr.write(`  - ${String(o['path'])} (pack '${String(o['pack'])}')\n`);
        }
        return 1;
    }

    if (args.write) {
        _writeFileMkdir(args.out, body);
        _writeFileMkdir(args.summary, _summary(manifest));
        _writeFileMkdir(args.deprecation_report, _deprecation_report(manifest));
        _writeFileMkdir(args.trust_report, _trust_report(manifest));
        _writeFileMkdir(args.orphan_report, _orphan_report(manifest));
        // Phase 5 sub-views.
        _writeFileMkdir(
            args.workspaces_json,
            JSON.stringify(_sortRec(_workspaces_view(manifest)), null, 2) + '\n',
        );
        _writeFileMkdir(
            args.packs_json,
            JSON.stringify(_sortRec(_packs_view(manifest)), null, 2) + '\n',
        );
        // Sidecar SHA-256 of the on-disk manifest bytes for tamper detection.
        const sidecar = args.out + '.sha256';
        const fileDigest = crypto.createHash('sha256').update(Buffer.from(body, 'utf-8')).digest('hex');
        fs.writeFileSync(sidecar, `${fileDigest}  ${path.basename(args.out)}\n`, 'utf-8');
        if (!args.quiet) {
            process.stdout.write(
                `wrote ${_relPosix(args.out, _config.ROOT)} ` +
                    `(${(manifest['artefacts'] as Json[]).length} artefacts, ${unassigned.length} unassigned, ` +
                    `${orphans.length} orphans)\n`,
            );
        }
    } else {
        // Write the full manifest (~290 KB) to fd 1 in a loop so it is flushed
        // before `process.exit`. A single `fs.writeSync` / `process.stdout.write`
        // to a pipe stops at the ~64 KB pipe buffer (partial write / backpressure)
        // and silently truncates. Looping on the byte offset mirrors Python's
        // blocking `sys.stdout.write`.
        _writeAllSync(1, Buffer.from(body, 'utf-8'));
    }
    return 0;
}

/** Write the whole buffer to `fd`, looping past short pipe writes. */
function _writeAllSync(fd: number, buf: Buffer): void {
    let offset = 0;
    while (offset < buf.length) {
        try {
            offset += fs.writeSync(fd, buf, offset, buf.length - offset);
        } catch (exc) {
            // EAGAIN on a non-blocking pipe: retry the same offset.
            if ((exc as NodeJS.ErrnoException).code === 'EAGAIN') {
                continue;
            }
            throw exc;
        }
    }
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exit(main(process.argv.slice(2)));
    } catch (exc) {
        if (exc instanceof ExitError) {
            // Mirror `raise SystemExit(msg)` — message to stderr, exit 1.
            process.stderr.write(`${exc.message}\n`);
            process.exit(1);
        }
        throw exc;
    }
}

export {
    TRUST_ROOTS,
    _FRONTMATTER_RE,
    _CATEGORY_SCHEMA,
    _vocab,
    _scanner_version,
    _artefact_checksum,
    _iter_artefacts,
    _trusted,
    _parse,
    _classify,
    _build,
    _compute_stats,
    _serialize,
    _finalise_checksum,
    _deprecation_report,
    _trust_report,
    _orphan_artefacts,
    _orphan_report,
    _workspaces_view,
    _packs_view,
    _summary,
    parse_args,
    main,
    ExitError,
};
