#!/usr/bin/env tsx
/**
 * Materialise the `with`, `without`, and `with-rdp` clones for the value bench.
 *
 * Ported from the retired Python `src/scripts/bench_ab_clone.py` (ADR-200 py2ts
 * Phase 8 / Wave 8d). The CLI contract mirrors the retired Python implementation
 * EXACTLY — `--refresh`, `--variant`, `--print-shape-hash`, exit codes,
 * stdout/stderr split, byte-identical written manifest
 * (`json.dumps(indent=2)` + trailing newline) and the
 * `target_shape_hash` (sha256 over the same surface definition + the
 * sorted fixture tree). No behaviour changes; latent Python bugs are
 * replicated and flagged as divergence candidates.
 *
 * Phase 1 Step 2 of `agents/roadmaps/road-to-package-impact-benchmark.md`.
 *
 * The fixture lives at `internal/bench/ab/fixture/`. Both clones are byte-identical
 * copies of the fixture; the `with` clone additionally receives the agent-config
 * surface (`.claude/`, `.augment/`, `AGENTS.md`, `CLAUDE.md`) so a Claude Code
 * session run inside it sees the same files a consumer project would after
 * running the installer.
 *
 * Idempotent: re-running without `--refresh` leaves an existing clone alone. With
 * `--refresh`, the target clone is removed and rebuilt from scratch.
 *
 * The clones tree (`internal/bench/ab/clones/`) is gitignored — only this script's
 * output schema is committed.
 *
 * ## The `candidate` variant
 *
 * `road-to-governed-harness-evolution` Phase 3 step 3.1. The roadmap's own
 * `corrected-from-reproduction` note is why this is small: the master design
 * described this script as living on a single "package present / absent" axis
 * needing an axis extension, when `--variant` already carried three real
 * variants whose third (`with-rdp`) sits on a different axis entirely. Adding a
 * candidate is a new enum member on existing multi-variant machinery, NOT a new
 * isolation mechanism.
 *
 * A candidate clone is `with` plus a validated set of mutations confined to the
 * agent-config surface. Unlike the three fixed variants it is many-per-run, so
 * it lands at `clones/candidate-<id>` and takes its id, dimension and lifecycle
 * from a record file validated by `_lib/candidate_record.ts` BEFORE any bytes
 * are copied. A mutation reaching outside the surface is refused there and
 * again here against the resolved path; `bench_ab_integrity` is the third,
 * independent check, over what actually landed on disk.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    type CandidateRecord,
    PathOwnershipError,
    assertMutationPathsOwned,
    candidateRecordToJson,
    parseCandidateRecord,
} from './_lib/candidate_record.js';

const _HERE = fileURLToPath(import.meta.url);
// Python: Path(__file__).resolve().parents[2] → repo root.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const AB_ROOT = path.join(REPO_ROOT, 'internal', 'bench', 'ab');
const FIXTURE = path.join(AB_ROOT, 'fixture');
/**
 * The clones tree. Exported so a caller can DISCOVER candidate clones without
 * recomputing the path from the repo root — a fourth copy of that join is a
 * fourth thing to keep in step with the two scripts that already hardcode it.
 */
export const CLONES = path.join(AB_ROOT, 'clones');

// Surfaces the `with` clone inherits from the package root.
export const WITH_SURFACES: readonly string[] = ['.claude', '.augment', 'AGENTS.md', 'CLAUDE.md'];

/**
 * Directory-name prefix for a candidate clone: `clones/candidate-<id>`.
 *
 * A candidate is NOT a fourth fixed variant sharing one directory the way
 * `with` / `without` / `with-rdp` do — there are many candidates at once (the
 * roadmap's exit criterion materialises five), so the id is part of the path.
 * `bench_ab_integrity` discovers candidate roots by this prefix.
 */
export const CANDIDATE_PREFIX = 'candidate-';

/**
 * Filename of the candidate record dropped inside a candidate clone.
 *
 * Kept in sync with `bench_ab_integrity`'s `ALLOWED_DELTA_FILES` by
 * `tests/scripts/candidate_surface_parity.test.ts` — a candidate clone
 * legitimately carries a file the baseline does not, and integrity must know
 * that before it can call anything else a violation.
 */
export const CANDIDATE_RECORD_FILE = '.bench-ab-candidate.json';

/** Does this variant layer the agent-config surface onto the fixture? */
function _layersSurface(variant: string): boolean {
    return variant === 'with' || variant === 'with-rdp' || variant === 'candidate';
}

function die(msg: string): never {
    process.stderr.write(`bench_ab_clone: ${msg}\n`);
    process.exit(1);
}

/**
 * Copy tree, dereferencing symlinks.
 *
 * The package installs the `.claude/` surface as a tree of symlinks into
 * `dist/agent-src/`. Cloning the surface as symlinks would carry pointers that
 * resolve against the package root, not the clone — meaning a Claude Code
 * session inside the clone could not actually read the rule bodies. Deref
 * at copy time produces standalone files inside the clone.
 */
// Python: shutil.ignore_patterns("worktrees", ".git", "clones", "node_modules").
const _IGNORE_PATTERNS: readonly string[] = ['worktrees', '.git', 'clones', 'node_modules'];

/**
 * Mirror the Python `_ignore` callback passed to shutil.copytree:
 *
 *   - exclude any name matching one of the ignore_patterns globs, AND
 *   - exclude any broken symlink (islink && !exists) so `symlinks=False`
 *     never tries to copy a missing target and crash.
 *
 * `os.path.exists` follows the symlink from its own directory, so resolve
 * against the joined absolute path (not the raw target).
 */
function _ignoredNames(directory: string, names: string[]): Set<string> {
    const skip = new Set<string>();
    for (const name of names) {
        if (_IGNORE_PATTERNS.some((pat) => _fnmatch(name, pat))) {
            skip.add(name);
            continue;
        }
        const p = path.join(directory, name);
        if (_isSymlink(p) && !_exists(p)) {
            skip.add(name);
        }
    }
    return skip;
}

function copytree_preserve(src: string, dst: string): void {
    if (_exists(dst)) {
        fs.rmSync(dst, { recursive: true, force: true });
    }
    // shutil.copytree(src, dst, symlinks=False, ignore=_ignore) — dereference
    // symlinks; exclude dev/VCS artifacts + broken symlinks per _ignoredNames.
    _copytreeDeref(src, dst);
}

/** shutil.copytree with symlinks=False semantics (deref) + copy2 metadata + ignore. */
function _copytreeDeref(src: string, dst: string): void {
    fs.mkdirSync(dst, { recursive: true });
    // Python: copytree lists names, calls ignore(src, names), skips ignored.
    const allNames = fs.readdirSync(src);
    const ignored = _ignoredNames(src, allNames);
    for (const name of allNames) {
        if (ignored.has(name)) {
            continue;
        }
        const s = path.join(src, name);
        const d = path.join(dst, name);
        // Resolve symlink-to-dir vs symlink-to-file by stat (deref).
        const st = fs.statSync(s);
        if (st.isDirectory()) {
            _copytreeDeref(s, d);
        } else {
            fs.copyFileSync(s, d);
            _copyStat(s, d);
        }
    }
    _copyStat(src, dst);
}

/** shutil.copy2 preserves mtime/atime + mode; mirror the parts that matter. */
function _copyStat(src: string, dst: string): void {
    try {
        const st = fs.statSync(src);
        fs.chmodSync(dst, st.mode);
        fs.utimesSync(dst, st.atime, st.mtime);
    } catch {
        // Best-effort; metadata copy must never fail the clone.
    }
}

/**
 * Write a minimal `.agent-settings.yml` carrying the RDP toggle.
 *
 * `with` pins `reasoning.enabled: false` (package without the RDP lift);
 * `with-rdp` sets `reasoning.enabled: true` (package + RDP lift). This is the
 * A/B/C lever for the 3-condition value benchmark — the RDP artifacts in the
 * copied surface are gated on this flag (see contexts/execution/rdp-gate.md),
 * so the diff between the two `with*` clones is exactly the lift under test.
 */
export function write_clone_settings(variant: string, target: string): void {
    const enabled = variant === 'with-rdp' ? 'true' : 'false';
    const settings =
        '# Generated by bench_ab_clone.py for the A/B/C value benchmark.\n' +
        '# Only the RDP toggle is set here; everything else uses package defaults.\n' +
        'reasoning:\n' +
        `  enabled: ${enabled}\n` +
        '  auto_gate: true\n';
    fs.writeFileSync(path.join(target, '.agent-settings.yml'), settings, 'utf-8');
}

/** Copy the fixture into the target, then layer the variant-specific surface. */
export function materialise_clone(variant: string, target: string): void {
    fs.mkdirSync(target, { recursive: true });
    // Mirror the fixture — Python iterates FIXTURE.iterdir() (OS order).
    for (const entry of _iterdir(FIXTURE)) {
        const dest = path.join(target, path.basename(entry));
        if (_isDir(entry)) {
            copytree_preserve(entry, dest);
        } else {
            fs.copyFileSync(entry, dest);
            _copyStat(entry, dest);
        }
    }
    // Layer the agent-config surface onto the `with` + `with-rdp` + `candidate` variants
    if (_layersSurface(variant)) {
        for (const surface of WITH_SURFACES) {
            const src = path.join(REPO_ROOT, surface);
            if (!_exists(src)) {
                // Best-effort: a missing surface is reported but does not fail
                process.stderr.write(
                    `bench_ab_clone: surface '${surface}' missing in package root; ` +
                        `${variant}-clone may not be representative\n`,
                );
                continue;
            }
            const dest = path.join(target, surface);
            if (_isDir(src)) {
                copytree_preserve(src, dest);
            } else {
                fs.copyFileSync(src, dest);
                _copyStat(src, dest);
            }
        }
        // The RDP cost-gate reads `reasoning.enabled` from .agent-settings.yml,
        // which is NOT in WITH_SURFACES. Write a minimal settings file so the
        // toggle is the explicit A/B/C lever: `with` = RDP off, `with-rdp` = on.
        write_clone_settings(variant, target);
    }
}

/**
 * Stable hash of the fixture tree + the with-surface list.
 *
 * Used by Phase 2's cache key. Recomputing this here keeps the cache code
 * and the clone code reading the same surface definition.
 */
export function target_shape_hash(): string {
    const h = createHash('sha256');
    // Python: b"with-surfaces:" + json.dumps(WITH_SURFACES).encode() + b"\n".
    // json.dumps(tuple) → JSON array with default separators (", " / ": ").
    h.update(Buffer.from(`with-surfaces:${_jsonDumpsCompact(WITH_SURFACES)}\n`, 'utf-8'));
    for (const p of _rglobSorted(FIXTURE)) {
        if (!_isFile(p)) {
            continue;
        }
        const rel = path.relative(FIXTURE, p).split(path.sep).join('/');
        h.update(Buffer.from(`${rel}\n`, 'utf-8'));
        h.update(fs.readFileSync(p));
        h.update(Buffer.from('\n', 'utf-8'));
    }
    return h.digest('hex').slice(0, 16);
}

/** Drop a small manifest so other scripts can verify the clone shape. */
export function write_manifest(variant: string, target: string): void {
    const manifest = {
        variant,
        reasoning_enabled: variant === 'with-rdp',
        target_shape_hash: target_shape_hash(),
        with_surfaces: _layersSurface(variant) ? [...WITH_SURFACES] : [],
        fixture_relpath: path.relative(REPO_ROOT, FIXTURE).split(path.sep).join('/'),
    };
    fs.writeFileSync(path.join(target, '.bench-ab-manifest.json'), `${_pyJsonDumps(manifest, 2)}\n`, 'utf-8');
}

/**
 * Apply a candidate's mutations inside an already-materialised clone.
 *
 * Two refusals, and the order matters. `assertMutationPathsOwned` runs over the
 * WHOLE set before the first byte is written, so a set whose third mutation
 * escapes the surface leaves no half-mutated clone behind. Then each write is
 * re-checked against the resolved absolute path, which catches the case the
 * relative check cannot see: a symlink already inside `.claude/` pointing out
 * of the clone. The relative form is what the record declares; the resolved
 * form is what the filesystem would actually write, and a candidate that
 * mutates the real package tree would corrupt the source of truth this whole
 * programme is trying to evaluate.
 *
 * Throws rather than exiting so the resolved-path branch is reachable from a
 * unit test — `main` turns it back into the CLI's exit 1. A guard that can only
 * be exercised by killing the test process is a guard nobody has seen red.
 *
 * @throws {PathOwnershipError} on a declared or a resolved escape.
 */
export function apply_candidate_mutations(record: CandidateRecord, target: string): void {
    assertMutationPathsOwned(record.mutations);
    const root = fs.realpathSync(target);
    for (const m of record.mutations) {
        const dest = path.join(target, m.path);
        const parent = path.dirname(dest);
        fs.mkdirSync(parent, { recursive: true });
        const realParent = fs.realpathSync(parent);
        if (realParent !== root && !realParent.startsWith(root + path.sep)) {
            throw new PathOwnershipError(
                `${m.path} (resolves to ${realParent}, outside candidate clone ${record.id})`,
            );
        }
        fs.writeFileSync(dest, m.content, 'utf-8');
    }
}

/**
 * Materialise ONE candidate clone at `clones/candidate-<id>`.
 *
 * The record is validated by `parseCandidateRecord` BEFORE anything is copied,
 * so a candidate that violates the one-primary-dimension rule (3.2), names a
 * fourth mutation dimension (3.3) or carries no lifecycle state (3.4) never
 * reaches the filesystem. Validating after materialisation would leave a clone
 * on disk that no schema admits.
 *
 * The clone's lifecycle state is recorded, never inferred: a candidate clone
 * existing on disk says the candidate was MATERIALISED and nothing more.
 */
export function clone_candidate(record: CandidateRecord, opts: { refresh: boolean; quiet?: boolean }): string {
    const quiet = opts.quiet ?? false;
    const target = path.join(CLONES, `${CANDIDATE_PREFIX}${record.id}`);
    if (_exists(target) && !opts.refresh) {
        if (!quiet) {
            process.stdout.write(
                `bench_ab_clone: candidate ${record.id} clone already present at ${target} (use --refresh to rebuild)\n`,
            );
        }
        return target;
    }
    if (_exists(target)) {
        fs.rmSync(target, { recursive: true, force: true });
    }
    materialise_clone('candidate', target);
    apply_candidate_mutations(record, target);
    write_manifest('candidate', target);
    fs.writeFileSync(
        path.join(target, CANDIDATE_RECORD_FILE),
        `${_pyJsonDumps(candidateRecordToJson(record), 2)}\n`,
        'utf-8',
    );
    if (!quiet) {
        process.stdout.write(`bench_ab_clone: built candidate ${record.id} clone at ${target}\n`);
    }
    return target;
}

/**
 * Load and validate a candidate record file.
 *
 * A malformed record exits 1 with the schema's own message rather than a
 * generic parse error — the schema messages name which invariant was broken,
 * and an operator holding a rejected record needs that, not a line number.
 */
export function load_candidate_record(file: string): CandidateRecord {
    let raw: string;
    try {
        raw = fs.readFileSync(file, 'utf-8');
    } catch {
        die(`candidate record not readable at ${file}`);
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        die(`candidate record at ${file} is not valid JSON: ${(e as Error).message}`);
    }
    try {
        return parseCandidateRecord(parsed);
    } catch (e) {
        die(`candidate record at ${file} rejected — ${(e as Error).message}`);
    }
}

export function clone(variant: string, opts: { refresh: boolean; quiet?: boolean }): string {
    const quiet = opts.quiet ?? false;
    const target = path.join(CLONES, variant);
    if (_exists(target) && !opts.refresh) {
        if (!quiet) {
            process.stdout.write(
                `bench_ab_clone: ${variant} clone already present at ${target} (use --refresh to rebuild)\n`,
            );
        }
        return target;
    }
    if (_exists(target)) {
        fs.rmSync(target, { recursive: true, force: true });
    }
    materialise_clone(variant, target);
    write_manifest(variant, target);
    if (!quiet) {
        process.stdout.write(`bench_ab_clone: built ${variant} clone at ${target}\n`);
    }
    return target;
}

type Variant = 'with' | 'without' | 'with-rdp' | 'candidate' | 'both' | 'all';

interface ParsedArgs {
    refresh: boolean;
    variant: Variant;
    print_shape_hash: boolean;
    /** Paths to candidate record files; only meaningful with `--variant candidate`. */
    candidate_records: string[];
}

export function parse_args(argv: string[]): ParsedArgs {
    let refresh = false;
    let variant: Variant = 'both';
    let print_shape_hash = false;
    const candidate_records: string[] = [];
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] as string;
        if (arg === '--refresh') {
            refresh = true;
            i += 1;
            continue;
        }
        if (arg === '--print-shape-hash') {
            print_shape_hash = true;
            i += 1;
            continue;
        }
        if (arg === '--variant') {
            const next = argv[i + 1];
            if (next === undefined) {
                _argparseError('argument --variant: expected one argument');
            }
            variant = _checkVariant(next as string);
            i += 2;
            continue;
        }
        if (arg.startsWith('--variant=')) {
            variant = _checkVariant(arg.slice('--variant='.length));
            i += 1;
            continue;
        }
        if (arg === '--candidate-record') {
            const next = argv[i + 1];
            if (next === undefined) {
                _argparseError('argument --candidate-record: expected one argument');
            }
            candidate_records.push(next);
            i += 2;
            continue;
        }
        if (arg.startsWith('--candidate-record=')) {
            candidate_records.push(arg.slice('--candidate-record='.length));
            i += 1;
            continue;
        }
        if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: bench_ab_clone [-h] [--refresh] [--variant {with,without,with-rdp,candidate,both,all}] ' +
                    '[--candidate-record PATH] [--print-shape-hash]\n',
            );
            process.exit(0);
        }
        _argparseError(`unrecognized arguments: ${arg}`);
    }
    return { refresh, variant, print_shape_hash, candidate_records };
}

function _checkVariant(v: string): Variant {
    if (v === 'with' || v === 'without' || v === 'with-rdp' || v === 'candidate' || v === 'both' || v === 'all') {
        return v;
    }
    _argparseError(
        `argument --variant: invalid choice: ${_pyRepr(v)} (choose from 'with', 'without', 'with-rdp', 'candidate', 'both', 'all')`,
    );
}

function _argparseError(msg: string): never {
    process.stderr.write(`bench_ab_clone: error: ${msg}\n`);
    process.exit(2);
}

export function main(argv?: string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    if (!_exists(FIXTURE)) {
        die(`fixture missing at ${FIXTURE}`);
    }
    if (args.print_shape_hash) {
        process.stdout.write(`${target_shape_hash()}\n`);
        return 0;
    }
    if (args.candidate_records.length > 0 && args.variant !== 'candidate') {
        _argparseError('--candidate-record requires --variant candidate');
    }
    if (args.variant === 'candidate') {
        if (args.candidate_records.length === 0) {
            _argparseError('--variant candidate requires at least one --candidate-record PATH');
        }
        const seen = new Set<string>();
        for (const file of args.candidate_records) {
            const record = load_candidate_record(file);
            if (seen.has(record.id)) {
                die(`candidate id '${record.id}' given twice — ids name clone directories and must be unique`);
            }
            seen.add(record.id);
            try {
                clone_candidate(record, { refresh: args.refresh });
            } catch (e) {
                if (e instanceof PathOwnershipError) {
                    die(`candidate ${record.id} rejected — ${e.message}`);
                }
                throw e;
            }
        }
        return 0;
    }
    let variants: readonly string[];
    if (args.variant === 'both') {
        variants = ['with', 'without'];
    } else if (args.variant === 'all') {
        // Deliberately NOT extended with candidates: a candidate needs a record
        // to know its dimension and lifecycle, so there is no blind aggregate
        // that could produce one. `all` keeps meaning the three fixed variants.
        variants = ['with', 'without', 'with-rdp'];
    } else {
        variants = [args.variant];
    }
    for (const v of variants) {
        clone(v, { refresh: args.refresh });
    }
    return 0;
}

// --- pathlib / Python parity helpers ----------------------------------------

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

/** os.path.islink — true iff the path itself is a symlink (no deref). */
function _isSymlink(p: string): boolean {
    try {
        return fs.lstatSync(p).isSymbolicLink();
    } catch {
        return false;
    }
}

/**
 * fnmatch.fnmatch for the literal patterns used by shutil.ignore_patterns here
 * ("worktrees", ".git", "clones", "node_modules") — all plain, no glob
 * metacharacters. fnmatch normalises case via os.path.normcase; on POSIX that
 * is a no-op (case-sensitive). Implement the general translation anyway so the
 * helper is correct if a pattern ever gains a wildcard.
 */
function _fnmatch(name: string, pattern: string): boolean {
    return _fnmatchToRegExp(pattern).test(name);
}

function _fnmatchToRegExp(pattern: string): RegExp {
    let re = '';
    let i = 0;
    while (i < pattern.length) {
        const c = pattern[i] as string;
        i += 1;
        if (c === '*') {
            re += '.*';
        } else if (c === '?') {
            re += '.';
        } else if (c === '[') {
            let j = i;
            if (j < pattern.length && (pattern[j] === '!' || pattern[j] === '^')) {
                j += 1;
            }
            if (j < pattern.length && pattern[j] === ']') {
                j += 1;
            }
            while (j < pattern.length && pattern[j] !== ']') {
                j += 1;
            }
            if (j >= pattern.length) {
                re += '\\[';
            } else {
                let stuff = pattern.slice(i, j).replace(/\\/g, '\\\\');
                i = j + 1;
                if (stuff.startsWith('!')) {
                    stuff = `^${stuff.slice(1)}`;
                } else if (stuff.startsWith('^')) {
                    stuff = `\\${stuff}`;
                }
                re += `[${stuff}]`;
            }
        } else {
            re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(`^(?:${re})$`, 's');
}

/** Path.iterdir() — NOT sorted (OS order). */
function _iterdir(dir: string): string[] {
    return fs.readdirSync(dir).map((name) => path.join(dir, name));
}

/** sorted(root.rglob("*")) — every descendant, sorted component-wise (pathlib). */
function _rglobSorted(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            out.push(full);
            // rglob descends into real directories (rglob does not follow
            // symlinks to dirs by default on the relevant CPython versions).
            if (ent.isDirectory()) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort(_pathPartsCompare);
    return out;
}

/** Compare two paths the way pathlib compares `Path` objects: component-wise. */
function _pathPartsCompare(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i += 1) {
        const x = pa[i] as string;
        const y = pb[i] as string;
        if (x < y) return -1;
        if (x > y) return 1;
    }
    return pa.length - pb.length;
}

/** Mirror repr(x) for the argparse invalid-choice message. */
function _pyRepr(v: string): string {
    return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

// --- JSON serializers — json.dumps parity (ensure_ascii=True) ---------------

/** json.dumps(value) with DEFAULT separators (", " / ": "), no indent. */
function _jsonDumpsCompact(value: unknown): string {
    return _escapeNonAscii(_dumpsCompact(value));
}

function _dumpsCompact(value: unknown): string {
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _jsonNum(value);
    }
    if (typeof value === 'string') {
        return _jsonStrAscii(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((v) => _dumpsCompact(v)).join(', ')}]`;
    }
    if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const items = Object.keys(obj).map((k) => `${_jsonStrAscii(k)}: ${_dumpsCompact(obj[k])}`);
        return `{${items.join(', ')}}`;
    }
    return _jsonStrAscii(String(value));
}

/** json.dumps(value, indent=2). */
function _pyJsonDumps(value: unknown, indent: number): string {
    return _escapeNonAscii(_dumpsIndent(value, indent, 0));
}

function _dumpsIndent(value: unknown, indent: number, depth: number): string {
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (value === null || value === undefined) {
        return 'null';
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }
    if (typeof value === 'number') {
        return _jsonNum(value);
    }
    if (typeof value === 'string') {
        return _jsonStrAscii(value);
    }
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return '[]';
        }
        const items = value.map((v) => pad + _dumpsIndent(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 0) {
            return '{}';
        }
        const items = keys.map((k) => `${pad}${_jsonStrAscii(k)}: ${_dumpsIndent(obj[k], indent, depth + 1)}`);
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrAscii(String(value));
}

function _jsonNum(n: number): string {
    if (!Number.isFinite(n)) {
        if (Number.isNaN(n)) {
            return 'NaN';
        }
        return n > 0 ? 'Infinity' : '-Infinity';
    }
    if (Number.isInteger(n)) {
        return String(n);
    }
    return String(n);
}

function _jsonStrAscii(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        switch (ch) {
            case '"':
                out += '\\"';
                break;
            case '\\':
                out += '\\\\';
                break;
            case '\n':
                out += '\\n';
                break;
            case '\r':
                out += '\\r';
                break;
            case '\t':
                out += '\\t';
                break;
            case '\b':
                out += '\\b';
                break;
            case '\f':
                out += '\\f';
                break;
            default:
                if (code < 0x20) {
                    out += `\\u${code.toString(16).padStart(4, '0')}`;
                } else {
                    out += ch;
                }
        }
    }
    return `${out}"`;
}

function _escapeNonAscii(s: string): string {
    let out = '';
    for (const ch of s) {
        const code = ch.codePointAt(0) ?? 0;
        if (code > 0x7f) {
            for (let i = 0; i < ch.length; i += 1) {
                out += `\\u${ch.charCodeAt(i).toString(16).padStart(4, '0')}`;
            }
        } else {
            out += ch;
        }
    }
    return out;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const _isMain =
    _isCliEntry();
if (_isMain) {
    process.exit(main());
}
