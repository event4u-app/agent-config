/**
 * `agent-config prune` — remove orphaned project bridge markers (TypeScript twin).
 *
 * TypeScript twin of `src/scripts/_cli/cmd_prune.py` (ADR-200, py2ts
 * migration). The CLI contract mirrors the Python original EXACTLY — same
 * flags, same exit codes, same stdout/stderr split, byte-identical emitted
 * output, same filesystem effects. No behaviour changes — latent quirks are
 * replicated and flagged inline, not fixed.
 *
 * Sibling to `uninstall`: where `uninstall` removes bridges for an explicit
 * tool list, `prune` removes every bridge marker present on disk that is
 * **not** declared in `agents/installed-tools.lock`. Mirrors the `npm prune` /
 * `cargo prune` convention — the lockfile is the source of truth; anything
 * else is drift.
 *
 * Scope: project only. Global pruning would touch user anchor dirs
 * (`~/.claude/`, `~/.cursor/`…) that may contain unrelated user content; the
 * safer surface there is `uninstall --global --purge`.
 *
 * Hard Floor: refuses to operate without a lockfile (would otherwise delete
 * every bridge it finds). Pass `--all-missing-lock` to opt into that behaviour
 * explicitly.
 *
 * Schema v2 (P2.1): when the manifest carries per-tool `files[]` inventories,
 * prune enumerates them in addition to the legacy `PROJECT_BRIDGE_MARKERS`
 * disk scan. Files whose owning tool has `status: uninstalling` (forward-compat
 * for P2.2 two-phase uninstall) are surfaced as orphans even when the tool
 * entry still exists. Manifests without `files[]` fall back to the v1 disk-scan
 * path unchanged.
 *
 * Drift detection (P2.3): orphaned files with a recorded `sha256` are hashed
 * before deletion. A mismatch flags the file as **modified** — prune surfaces
 * the path and skips removal so user / neighbour-tool edits to deployed content
 * survive the prune sweep. Files without a recorded hash (bridges) skip the
 * check and prune normally.
 *
 * Resume-uninstall (P2.2): `--resume-uninstall` narrows prune to the
 * crash-recovery scope — only files belonging to tools with
 * `status: uninstalling` are surfaced. The legacy disk scan is skipped and
 * healthy tools / unmanaged drift are untouched. Intended for re-running after
 * an uninstall crashed mid-flight; no-op when no tool is in the `uninstalling`
 * state.
 *
 * --- Parity notes (ADR-200) ---
 *
 * - `process.exitCode` is set; `process.exit()` is never called. argparse
 *   usage errors throw `ArgparseExit(2)`; `-h`/`--help` throws
 *   `ArgparseExit(0)`. Python's `raise SystemExit(main())` propagates the int.
 * - LATENT QUIRK PRESERVED: `main()` computes
 *   `failed = [r for r in results if not r[2]]` — `r[2]` is the `state` STRING
 *   (`"orphan"` / `"modified"`), always truthy, so `not r[2]` is always False
 *   and `failed` is always empty. The exit code is therefore always 0 even
 *   when a `_remove` reported `ok=False` (which lives in `r[3]`). The Python
 *   intent was likely `not r[3]`, but the twin replicates the shipped quirk
 *   exactly: the filter tests `state` truthiness and the return is always 0.
 * - JSON byte-parity: `json.dumps(payload, indent=2)` (Python default
 *   `ensure_ascii=True`, `sort_keys=False`) → `_jsonDumpsIndentAscii(payload, 2)`.
 *   Dict insertion order is preserved.
 * - `hashlib.sha256(path.read_bytes()).hexdigest()` → `crypto.createHash`.
 * - `from scripts.install import PROJECT_BRIDGE_MARKERS` resolves to the `.ts`
 *   twin's exported const (never a `.py`).
 * - `Path.relative_to` raising `ValueError` when not a subpath →
 *   `_relativeToOr(target, base)` which falls back to the original path,
 *   mirroring the Python `try/except ValueError` in the emitters.
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as installed_tools from '../_lib/installed_tools.js';
import { resolve_project_root } from '../_lib/agent_settings.js';
import { PROJECT_BRIDGE_MARKERS } from '../install.js';

type AnyDict = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Python-runtime parity helpers
// ---------------------------------------------------------------------------

class ArgparseExit extends Error {
    code: number;
    constructor(code: number) {
        super(`ArgparseExit(${code})`);
        this.name = 'ArgparseExit';
        this.code = code;
    }
}

interface OutSink {
    write(text: string): void;
}
const _stdout: OutSink = { write: (t) => process.stdout.write(t) };
const _stderr: OutSink = { write: (t) => process.stderr.write(t) };
function _print(out: OutSink, line = ''): void {
    out.write(line + '\n');
}

function expanduser(p: string): string {
    if (p === '~' || p.startsWith('~/')) {
        const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? '';
        return home + p.slice(1);
    }
    return p;
}

function _exists(p: string): boolean {
    try {
        fs.lstatSync(p);
        return true;
    } catch {
        return false;
    }
}

function _listOf(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

// --- JSON byte-parity (ensure_ascii=True, sort_keys=False, insertion order) ---

function _jsonStrAscii(s: string): string {
    let out = '"';
    for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        const ch = s[i];
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
                if (code < 0x20 || code > 0x7e) {
                    out += '\\u' + code.toString(16).padStart(4, '0');
                } else {
                    out += ch;
                }
        }
    }
    return out + '"';
}

function _jsonScalarAscii(value: unknown): string | null {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            if (Number.isNaN(value)) return 'NaN';
            return value > 0 ? 'Infinity' : '-Infinity';
        }
        return String(value);
    }
    if (typeof value === 'string') return _jsonStrAscii(value);
    return null;
}

function _dumpIndentAscii(value: unknown, indent: number, depth: number): string {
    const scalar = _jsonScalarAscii(value);
    if (scalar !== null) return scalar;
    const pad = ' '.repeat(indent * (depth + 1));
    const closePad = ' '.repeat(indent * depth);
    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';
        const items = value.map((v) => pad + _dumpIndentAscii(v, indent, depth + 1));
        return `[\n${items.join(',\n')}\n${closePad}]`;
    }
    if (typeof value === 'object' && value !== null) {
        const obj = value as AnyDict;
        const keys = Object.keys(obj);
        if (keys.length === 0) return '{}';
        const items = keys.map(
            (k) => `${pad}${_jsonStrAscii(k)}: ${_dumpIndentAscii(obj[k], indent, depth + 1)}`,
        );
        return `{\n${items.join(',\n')}\n${closePad}}`;
    }
    return _jsonStrAscii(String(value));
}

function _jsonDumpsIndentAscii(value: unknown, indent: number): string {
    return _dumpIndentAscii(value, indent, 0);
}

// ---------------------------------------------------------------------------

/**
 * Resolve the project root using the shared Phase-3 helper.
 *
 * Drops the origin tag — `prune` does not surface it in output but still
 * honors `AGENT_CONFIG_PROJECT_ROOT` and the anchor walk.
 */
function _resolve_project_root(arg: string | null): string {
    const [root] = resolve_project_root(arg);
    return root;
}

/**
 * Return `[manifest, declared]`.
 *
 * `declared` is the set of project-scope tool names whose entry is healthy
 * (`status` absent or `installed`). When the manifest is missing, returns
 * `[null, new Set()]` if `force_empty` else `[null, null]`.
 */
function _load_manifest(
    project_root: string,
    opts: { force_empty: boolean },
): [AnyDict | null, Set<string> | null] {
    const manifest_path = installed_tools.manifest_path(project_root);
    const manifest = installed_tools.read_manifest(manifest_path);
    if (manifest === null) {
        if (opts.force_empty) {
            return [null, new Set()];
        }
        return [null, null];
    }
    const tools = (_listOf(manifest['tools']) as AnyDict[]) ?? [];
    const declared = new Set<string>();
    for (const e of tools) {
        const name = e['name'];
        if (
            name &&
            e['scope'] === 'project' &&
            (e['status'] ?? 'installed') === 'installed'
        ) {
            declared.add(String(name));
        }
    }
    return [manifest, declared];
}

/** Expand a manifest path (repo-relative or absolute / `~`-prefixed). */
function _resolve_path(project_root: string, raw: string): string {
    const p = expanduser(raw);
    if (!path.isAbsolute(p)) {
        return path.join(project_root, p);
    }
    return p;
}

/**
 * Hex SHA-256 of `path` content, or `null` if unreadable.
 *
 * Mirrors `scripts.install._sha256_of_file`. Drift detection (P2.3) calls this
 * for every orphan with a recorded hash.
 */
function _sha256(p: string): string | null {
    try {
        return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    } catch {
        return null;
    }
}

type Candidate = [string, string, string | null, string | null];

/**
 * Return `[(tool_id, target_path, kind, expected_sha256), …]`.
 *
 * `kind` is `"bridge"` / `"marker"` / `"deployed"` for v2 entries, `null` for
 * the legacy disk scan. `expected_sha256` is the hash recorded at install time
 * (drift detector, P2.3); `null` skips the check.
 */
function _orphaned(
    project_root: string,
    manifest: AnyDict | null,
    declared: Set<string>,
    opts: { resume_uninstall?: boolean } = {},
): Candidate[] {
    const resume_uninstall = opts.resume_uninstall ?? false;
    const out: Candidate[] = [];
    const seen = new Set<string>();

    if (!resume_uninstall) {
        for (const tool_id of Object.keys(PROJECT_BRIDGE_MARKERS)) {
            const rel = PROJECT_BRIDGE_MARKERS[tool_id] as string;
            if (declared.has(tool_id)) {
                continue;
            }
            const target = path.join(project_root, rel);
            if (!_exists(target)) {
                continue;
            }
            out.push([tool_id, target, null, null]);
            seen.add(_realpath(target));
        }
    }

    if (manifest === null) {
        return out;
    }

    for (const tool of _listOf(manifest['tools']) as AnyDict[]) {
        if (tool['scope'] !== 'project') {
            continue;
        }
        const files = _listOf(tool['files']) as AnyDict[];
        if (!files.length) {
            continue;
        }
        const tool_id = String(tool['name'] ?? '');
        const status = tool['status'] ?? 'installed';
        if (resume_uninstall) {
            if (status !== 'uninstalling') {
                continue;
            }
        } else if (status === 'installed' && declared.has(tool_id)) {
            continue;
        }
        for (const entry of files) {
            const kind = entry['kind'];
            if (kind !== 'bridge' && kind !== 'marker' && kind !== 'deployed') {
                continue;
            }
            const raw = (entry['path'] as string | undefined) ?? '';
            if (!raw) {
                continue;
            }
            const target = _resolve_path(project_root, raw);
            const resolved = _realpath(target);
            if (seen.has(resolved) || !_exists(target)) {
                continue;
            }
            out.push([tool_id, target, kind as string, (entry['sha256'] as string | null) ?? null]);
            seen.add(resolved);
        }
    }
    return out;
}

/** `Path.resolve()` — realpath, falling back to the input on OSError. */
function _realpath(p: string): string {
    try {
        return fs.realpathSync(p);
    } catch {
        return path.resolve(p);
    }
}

/**
 * Return `[state, actual_sha]` for a prune candidate.
 *
 * - `"orphan"` — safe to delete (hash matches or no hash recorded).
 * - `"modified"` — recorded hash differs from disk; skip deletion.
 */
function _classify(target: string, expected_sha: string | null): [string, string | null] {
    if (expected_sha === null) {
        return ['orphan', null];
    }
    const actual = _sha256(target);
    if (actual === null || actual !== expected_sha) {
        return ['modified', actual];
    }
    return ['orphan', actual];
}

function _remove(target: string, opts: { dry_run: boolean }): [boolean, string] {
    if (opts.dry_run) {
        return [true, 'would remove'];
    }
    try {
        // Mirror Python `Path.unlink()` control flow: attempt the unlink and
        // branch on the raised error class.
        //   - IsADirectoryError (errno EISDIR, e.g. on Linux) → dir-refusal.
        //   - any other OSError (e.g. macOS unlink-on-dir → PermissionError /
        //     EPERM) → the generic `❌ failed ({exc})` branch.
        // We do NOT pre-`stat` for a directory because Python does not — its
        // message depends on the errno the platform actually raises, and a
        // pre-check would force the EISDIR wording on platforms (macOS) where
        // Python surfaces PermissionError instead.
        fs.unlinkSync(target);
        return [true, 'removed'];
    } catch (exc) {
        const e = exc as NodeJS.ErrnoException;
        if (e && e.code === 'EISDIR') {
            return [false, '❌ is a directory (refusing — use uninstall --purge)'];
        }
        // `str(OSError)` in Python is `[Errno N] strerror: 'filename'`.
        return [false, `❌ failed (${_pyOSErrorStr(e, target)})`];
    }
}

/** Reconstruct Python's `str(OSError)` shape: `[Errno N] strerror: 'filename'`. */
function _pyOSErrorStr(e: NodeJS.ErrnoException, filename: string): string {
    const errno = typeof e.errno === 'number' ? Math.abs(e.errno) : null;
    // Node carries the POSIX errno; map the common ones to Python's strerror.
    const STRERROR: Record<string, string> = {
        EPERM: 'Operation not permitted',
        EISDIR: 'Is a directory',
        EACCES: 'Permission denied',
        ENOENT: 'No such file or directory',
        EBUSY: 'Device or resource busy',
        ENOTEMPTY: 'Directory not empty',
    };
    const strerror = (e.code && STRERROR[e.code]) || (e.message ?? String(e));
    if (errno !== null) {
        return `[Errno ${errno}] ${strerror}: '${filename}'`;
    }
    return strerror;
}

interface Options {
    project: string | null;
    dry_run: boolean;
    json: boolean;
    all_missing_lock: boolean;
    resume_uninstall: boolean;
}

function _parse(argv: string[]): Options {
    const prog = 'agent-config prune';
    // argparse wraps usage to terminal width (80 cols when piped). The exact
    // 2-line break point is reproduced verbatim for the error path.
    const usage =
        'usage: agent-config prune [-h] [--project PROJECT] [--dry-run] [--json]\n' +
        '                          [--all-missing-lock] [--resume-uninstall]\n';

    const emitError = (msg: string): never => {
        _stderr.write(usage);
        _stderr.write(`${prog}: error: ${msg}\n`);
        throw new ArgparseExit(2);
    };

    const opts: Options = {
        project: null,
        dry_run: false,
        json: false,
        all_missing_lock: false,
        resume_uninstall: false,
    };

    let i = 0;
    while (i < argv.length) {
        const tok = argv[i] as string;
        const flag = tok.includes('=') ? tok.slice(0, tok.indexOf('=')) : tok;
        if (flag === '-h' || flag === '--help') {
            _stdout.write(usage);
            throw new ArgparseExit(0);
        } else if (flag === '--project') {
            const eq = tok.indexOf('=');
            if (eq >= 0) {
                opts.project = tok.slice(eq + 1);
                i += 1;
            } else {
                const val = argv[i + 1];
                if (val === undefined) {
                    emitError('argument --project: expected one argument');
                }
                opts.project = val as string;
                i += 2;
            }
        } else if (flag === '--dry-run') {
            opts.dry_run = true;
            i += 1;
        } else if (flag === '--json') {
            opts.json = true;
            i += 1;
        } else if (flag === '--all-missing-lock') {
            opts.all_missing_lock = true;
            i += 1;
        } else if (flag === '--resume-uninstall') {
            opts.resume_uninstall = true;
            i += 1;
        } else {
            emitError(`unrecognized arguments: ${tok}`);
        }
    }
    return opts;
}

type Result = [string, string, string, boolean, string];

/** `Path.relative_to(base)` with the Python `try/except ValueError` fallback. */
function _relativeToOr(target: string, base: string): string {
    if (!path.isAbsolute(target)) {
        // Python only calls relative_to when target.is_absolute(); otherwise it
        // uses the path verbatim.
        return target;
    }
    const rel = path.relative(base, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        // Not a subpath — Python raises ValueError, the caller keeps `target`.
        return target;
    }
    return rel;
}

function _emit_text(
    project_root: string,
    candidates: Candidate[],
    results: Result[],
    opts: { dry_run: boolean },
    out: OutSink,
): void {
    const prefix = opts.dry_run ? '[dry-run] ' : '';
    if (!candidates.length) {
        _print(out, `✅  ${prefix}no orphaned bridges in ${project_root}`);
        return;
    }
    const modified = results.filter((r) => r[2] === 'modified');
    const orphans = results.filter((r) => r[2] === 'orphan');
    _print(
        out,
        `${prefix}${orphans.length} orphaned, ${modified.length} modified ` +
            `bridge(s) under ${project_root}:`,
    );
    for (const [tool_id, target, state, ok, msg] of results) {
        const rel = _relativeToOr(target, project_root);
        if (state === 'modified') {
            _print(out, `  ⚠  ${tool_id}: modified — skipped ${rel}`);
            continue;
        }
        const mark = ok ? '·' : '!';
        _print(out, `  ${mark} ${tool_id}: ${msg} ${rel}`);
    }
}

function _emit_json(
    project_root: string,
    results: Result[],
    opts: { dry_run: boolean },
    out: OutSink,
): void {
    const payload = {
        project_root: project_root,
        dry_run: opts.dry_run,
        orphans: results.map(([tool_id, target, state, ok, msg]) => ({
            tool: tool_id,
            path: _relativeToOr(target, project_root),
            state,
            ok,
            status: msg,
        })),
    };
    _print(out, _jsonDumpsIndentAscii(payload, 2));
}

export function main(argv: string[] | null = null): number {
    const opts = _parse(argv !== null ? [...argv] : process.argv.slice(2));
    const project_root = _resolve_project_root(opts.project);
    const [manifest, declared] = _load_manifest(project_root, {
        force_empty: opts.all_missing_lock,
    });
    if (declared === null) {
        const manifest_path = installed_tools.manifest_path(project_root);
        _print(_stderr, `❌  no project lockfile at ${manifest_path}`);
        _print(
            _stderr,
            '    pass --all-missing-lock to prune every known marker (destructive)',
        );
        return 1;
    }
    const candidates = _orphaned(project_root, manifest, declared, {
        resume_uninstall: opts.resume_uninstall,
    });
    const results: Result[] = [];
    for (const [tool_id, target, _kind, expected_sha] of candidates) {
        const [state] = _classify(target, expected_sha);
        if (state === 'modified') {
            // Drift — leave the file alone, surface in output.
            results.push([tool_id, target, state, true, 'skipped (modified)']);
            continue;
        }
        const [ok, msg] = _remove(target, { dry_run: opts.dry_run });
        results.push([tool_id, target, state, ok, msg]);
    }
    if (opts.json) {
        _emit_json(project_root, results, { dry_run: opts.dry_run }, _stdout);
    } else {
        _emit_text(project_root, candidates, results, { dry_run: opts.dry_run }, _stdout);
    }
    // LATENT QUIRK PRESERVED (see header): `r[2]` is the always-truthy state
    // string, so this filter is always empty and the return is always 0.
    const failed = results.filter((r) => !r[2]);
    return failed.length ? 1 : 0;
}

// CLI entry guard — set process.exitCode; never call process.exit().
const _HERE = fileURLToPath(import.meta.url);
const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exitCode = main(process.argv.slice(2));
    } catch (exc) {
        if (exc instanceof ArgparseExit) {
            process.exitCode = exc.code;
        } else {
            throw exc;
        }
    }
}
