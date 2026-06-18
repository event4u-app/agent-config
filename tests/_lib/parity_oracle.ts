// Parity oracle for the Python→TypeScript golden-parity rigs.
//
// Golden-parity rigs historically spawned BOTH `python3 <stem>.py` AND
// `tsx <stem>.ts` at run time and byte-compared the two. That keeps the
// original `.py` alive forever. This oracle breaks that dependency: the
// Python side is captured ONCE into a committed snapshot (while the `.py`
// still exists), then every normal test run reads the frozen snapshot
// instead of spawning `python3`. The rig keeps spawning the REAL `.ts`
// twin and asserts `ts === oracle(...)` byte-for-byte.
//
// Modes (env `PY2TS_CAPTURE`):
//   - "1"  → CAPTURE: spawn the python3 invocation, write the snapshot,
//            return it. Run once with the `.py` present to freeze the goldens.
//   - else → NORMAL: read the snapshot and return it. A missing snapshot
//            THROWS loudly — never silently skips or passes.
//
// ─── v1 vs v2 ────────────────────────────────────────────────────────────
// v1 (`oracle(stem, args, input)`) modelled ONLY `python3 <stem>.py args`
// — the "script" invocation kind. ~38% of rigs invoke python3 differently:
//   - inline  → `python3 -c "<code>" args`  (often code that itself inserts
//               `src` onto sys.path or loads sibling modules by abs path).
//   - module  → `python3 -m <module> args` with `PYTHONPATH=<repo>/src`
//               (and sometimes other env, e.g. a frozen clock).
//
// v2 (`oracle2({ kind, target, args?, input?, env?, normalize? })`) models
// all three. v1 `oracle(...)` is kept as a thin wrapper over
// `oracle2({ kind: 'script', target: stem, args, input })`, so already-
// converted rigs (e.g. templates_telemetry_report.test.ts) keep passing
// against their EXISTING snapshots — the v1 key scheme is preserved exactly
// for `kind: 'script'` with no `env`/`normalize` (see snapshotKey).
//
// Snapshot layout (keyed by a stable hash of kind+target+args+input(+env) so
// the same invocation always resolves to the same file, and any change to the
// invocation surfaces as a new key rather than overwriting a golden):
//   tests/_lib/__parity_snapshots__/<bucket>/<sha256>.json
//
// This package is ESM ("type":"module"); a bare `require` throws under tsx,
// so everything below uses top-level `import`.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Captured / frozen result of one invocation. */
export interface OracleResult {
    stdout: string;
    stderr: string;
    status: number;
    /**
     * v3 — frozen file side-effects (sub-shape A "file-sink" rigs). Keyed by the
     * caller's logical name (the key of `OracleSpec.outputs`), value is the
     * base64 of the bytes python wrote to that path, or `null` if python did not
     * create the file. Absent entirely for invocations that declare no `outputs`
     * (v1/v2 snapshots stay byte-identical — no `files` field is written).
     */
    files?: Record<string, string | null>;
}

/** The three python3 invocation kinds v2 models. */
export type OracleKind = 'script' | 'inline' | 'module';

/**
 * Descriptor for one python3 invocation.
 *
 * - `script`: spawn `python3 <target>.py ...args`. `target` is a repo-relative
 *   path WITHOUT the `.py` extension (e.g. `src/.../telemetry_report`).
 * - `inline`: spawn `python3 -c <target> ...args`. `target` is the literal
 *   code string handed to `-c`.
 * - `module`: spawn `python3 -m <target> ...args`. `target` is the module name
 *   (e.g. `work_engine`); pass `env: { PYTHONPATH: ... }` so the module
 *   resolves. CWD is always REPO_ROOT (see resolveCwd note below).
 *
 * `env` is merged over `process.env` for BOTH capture and normal modes —
 * but env is NEVER stored in the snapshot beyond its effect on the output.
 * (For `module`, PYTHONPATH is part of the key — see keying note below.)
 *
 * `normalize`, when given, is applied to stdout AND stderr symmetrically
 * BEFORE the snapshot is written (capture) and BEFORE the result is returned
 * (normal). It strips volatile noise (tmp paths, clock text) so the frozen
 * golden is machine-independent.
 *
 * ── normalize contract (READ THIS) ──────────────────────────────────────
 * The oracle applies `normalize` to its OWN (python) output. The caller's
 * `.ts` side compares against `oracle2(...).stdout`. Therefore the CALLER
 * MUST apply the SAME `normalize` to the `.ts` stdout/stderr before
 * `expect(tsOut).toBe(oracle2(...).stdout)`. The oracle cannot reach into the
 * rig's tsx spawn — symmetry is the caller's responsibility. Keep one shared
 * `normalize` fn in the rig and pass it both here and to the tsx side.
 *
 * `cwd` overrides the spawn working directory (default REPO_ROOT). Volatile
 * absolute `cwd` values (a per-test `os.tmpdir()` dir) are NOT part of the key
 * — pass a `normalize` if the cwd leaks into the output, and keep the
 * invocation's *observable* output cwd-independent.
 */
export interface OracleSpec {
    kind: OracleKind;
    target: string;
    args?: string[];
    input?: string;
    env?: Record<string, string>;
    normalize?: (s: string) => string;
    cwd?: string;
    /**
     * v3 — file side-effects to freeze (sub-shape A "file-sink" rigs whose
     * observable python artefact is a written FILE, not stdout). Maps a stable
     * logical name → the path python writes (absolute, or relative to `cwd`).
     * Capture mode reads each path AFTER the spawn and freezes its bytes into the
     * snapshot under `OracleResult.files[name]` (base64; `null` if not written).
     * Normal mode returns the frozen bytes — the caller compares the `.ts` twin's
     * own written bytes against `oracle2(...).files[name]`.
     *
     * The path VALUES are volatile (per-test tmp dirs) and are NOT part of the
     * snapshot key — they are capture-side read instructions, not invocation
     * identity. The logical NAMES are the stable contract. Declare `outputs` and
     * the rig's observable becomes file-content parity instead of stdout parity.
     */
    outputs?: Record<string, string>;
    /**
     * v3 — volatile scratch paths (sub-shape B: a per-test scratch DIR or output
     * FILE passed as a CLI arg, e.g. `--root /tmp/sessprof-XXXX` or `--out
     * /tmp/cc-XXXX/lock.yaml`). Such an absolute-path arg destabilises the
     * snapshot key (the random basename / content-hash differs every run and
     * capture-vs-replay). Listing it here replaces every matching arg (the path
     * itself, or any path UNDER it) with a stable `<scratch:i>` token in the KEY
     * only — the spawn still receives the real path. `outputs` values are folded
     * in automatically (an output path is volatile by definition). Use `scratch`
     * for script/module/inline-with-path-args rigs where the path cannot be baked
     * into an inline code body.
     */
    scratch?: string[];
}

// tests/_lib/parity_oracle.ts → repo root is two levels up.
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SNAPSHOT_ROOT = path.join(REPO_ROOT, 'tests', '_lib', '__parity_snapshots__');

function isCaptureMode(): boolean {
    return process.env.PY2TS_CAPTURE === '1';
}

/**
 * Normalise one argv token for keying. An absolute filesystem path (e.g. a
 * per-run `os.tmpdir()` fixture) is volatile across runs/machines, so for the
 * KEY it is reduced to a stable form:
 *   - basename (drops the volatile dir prefix), AND
 *   - a short hash of the file's CONTENTS when the file exists.
 *
 * Folding contents into the key is what keeps file-driven rigs both
 * key-STABLE (same fixture → same key across runs) and collision-FREE (two
 * tests that pass the same basename but different fixture content get
 * distinct keys). The spawn itself (capture mode) always receives the
 * original, unmodified args — this normalisation never changes what Python
 * sees; it only affects which snapshot file the invocation maps to.
 *
 * Rig contract this assumes: the invocation's *output* must not depend on the
 * absolute path text (only on basename + contents). Rigs whose stdout/stderr
 * echoes an absolute path are NOT key-stable under this scheme and need a
 * `normalize` hook (see fan-out obstacles in the report).
 */
function normalizeArgForKey(arg: string): string {
    if (!path.isAbsolute(arg)) {
        return arg;
    }
    const base = path.basename(arg);
    if (fs.existsSync(arg) && fs.statSync(arg).isFile()) {
        const contentHash = createHash('sha256')
            .update(fs.readFileSync(arg))
            .digest('hex')
            .slice(0, 16);
        return `<abs:${contentHash}>/${base}`;
    }
    // Missing path (e.g. the "missing log" test): basename only — stable, and
    // the absence is itself part of the deterministic invocation.
    return `<abs:missing>/${base}`;
}

/**
 * Stabilise an inline `-c` code string for KEYING. The code commonly embeds
 * volatile absolute paths (a JSON-quoted `/Users/.../foo.py` injected via
 * `JSON.stringify(ABS)`) or a `sys.path.insert(..., 'src')` line. Hashing the
 * raw literal would make the key machine-dependent. So for the key we:
 *   - replace every absolute-path-looking run with a stable placeholder, then
 *   - hash the result.
 * The spawn still receives the ORIGINAL code unchanged. The placeholder keeps
 * two genuinely-different code bodies distinct while folding out the volatile
 * dir prefix that differs per machine / per checkout.
 */
function stableInlineKeyMaterial(code: string): string {
    // Collapse POSIX + Windows absolute paths to a placeholder for the key.
    // (Common shapes: "/Users/...", "/home/...", "/private/...", "C:\\...".)
    const stabilised = code
        .replace(/(["'`])(?:\/[^"'`\s]+)\1/g, '$1<abspath>$1')
        .replace(/(["'`])[A-Za-z]:\\[^"'`]+\1/g, '$1<abspath>$1');
    return createHash('sha256').update(stabilised, 'utf8').digest('hex').slice(0, 24);
}

/**
 * Stable key for one invocation.
 *
 * v1 compatibility: for `kind: 'script'` with no env, the material is exactly
 * `<target>\0<keyArgs>\0<input>` — byte-identical to the v1 scheme — so
 * existing `kind: 'script'` snapshots resolve unchanged. v2 adds the `kind`
 * tag and (for module) the PYTHONPATH only for NON-script kinds, so no
 * existing script key shifts.
 *
 * - inline: `target` is hashed via `stableInlineKeyMaterial` (NOT treated as a
 *   path), so the key stays stable across machines even when the code embeds
 *   absolute paths.
 * - module: PYTHONPATH (basename-stabilised) joins the material so two runs
 *   with different module-search roots can't collide.
 *
 * The NUL separators keep fields unambiguous (no field contains a NUL byte in
 * practice), so distinct invocations never collide on a single key.
 */
/**
 * Reduce a volatile scratch path to a stable key token. If `arg` equals a scratch
 * entry it becomes `<scratch:i>`; if it lives UNDER one it keeps the relative
 * suffix (`<scratch:i>/overlay.yml`) so distinct files under the same scratch dir
 * stay distinct. Non-scratch args fall through unchanged (the caller then applies
 * `normalizeArgForKey`). Index-based so the token is stable as long as the rig
 * lists scratch paths in a fixed order (it does — they are local consts).
 */
function stabiliseScratchArg(arg: string, scratchPaths: string[]): string | null {
    if (!path.isAbsolute(arg)) {
        return null;
    }
    for (let i = 0; i < scratchPaths.length; i++) {
        const s = scratchPaths[i];
        if (s === undefined || !path.isAbsolute(s)) {
            continue;
        }
        if (arg === s) {
            return `<scratch:${i}>`;
        }
        if (arg.startsWith(s + path.sep)) {
            return `<scratch:${i}>${arg.slice(s.length)}`;
        }
    }
    return null;
}

function snapshotKey(spec: OracleSpec): string {
    const args = spec.args ?? [];
    const input = spec.input ?? '';
    // Scratch set = explicit scratch paths + every declared output path (an output
    // is volatile by definition). Stabilise those in the key, normalise the rest.
    const scratchPaths = [...(spec.scratch ?? []), ...Object.values(spec.outputs ?? {})];
    const keyArgs = args.map((a) => {
        const stabilised = scratchPaths.length ? stabiliseScratchArg(a, scratchPaths) : null;
        return stabilised ?? normalizeArgForKey(a);
    });

    if (spec.kind === 'script' && !spec.env) {
        // v1-identical material — keeps existing script snapshots resolving.
        const material = `${spec.target}\0${JSON.stringify(keyArgs)}\0${input}`;
        return createHash('sha256').update(material, 'utf8').digest('hex');
    }

    let targetForKey: string;
    if (spec.kind === 'inline') {
        targetForKey = `inline:${stableInlineKeyMaterial(spec.target)}`;
    } else {
        targetForKey = `${spec.kind}:${spec.target}`;
    }

    // Fold PYTHONPATH into the key for module runs (basename-stabilised so the
    // volatile checkout prefix drops out but a different search root still
    // produces a distinct key).
    const pythonPath = spec.env?.['PYTHONPATH'];
    const envMaterial =
        spec.kind === 'module' && pythonPath
            ? `\0PYTHONPATH=${pythonPath.split(path.sep).slice(-2).join('/')}`
            : '';

    const material = `${spec.kind}\0${targetForKey}\0${JSON.stringify(keyArgs)}\0${input}${envMaterial}`;
    return createHash('sha256').update(material, 'utf8').digest('hex');
}

/**
 * Bucket directory for the snapshot. Script: basename of the stem (v1 layout).
 * Inline / module: the kind plus a short stable tag, so the snapshot tree is
 * navigable and the inline code literal never becomes a path.
 */
function snapshotBucket(spec: OracleSpec): string {
    if (spec.kind === 'script') {
        return path.basename(spec.target);
    }
    if (spec.kind === 'module') {
        return `module-${spec.target.replace(/[^A-Za-z0-9._-]/g, '_')}`;
    }
    // inline: stable short tag from the code body.
    return `inline-${stableInlineKeyMaterial(spec.target).slice(0, 12)}`;
}

function snapshotPath(spec: OracleSpec): string {
    return path.join(SNAPSHOT_ROOT, snapshotBucket(spec), `${snapshotKey(spec)}.json`);
}

/** Absolute path to the script (stem given relative to REPO_ROOT). */
function resolveStem(scriptStem: string): string {
    return path.isAbsolute(scriptStem) ? scriptStem : path.join(REPO_ROOT, scriptStem);
}

/** Build the argv + spawn options for one invocation kind. */
function buildSpawn(spec: OracleSpec): { argv: string[]; cwd: string } {
    const args = spec.args ?? [];
    const cwd = spec.cwd ?? REPO_ROOT;
    if (spec.kind === 'script') {
        const pyScript = `${resolveStem(spec.target)}.py`;
        if (!fs.existsSync(pyScript)) {
            throw new Error(
                `parity_oracle CAPTURE: python source not found at ${pyScript} ` +
                    `(target="${spec.target}"). Capture must run while the .py original exists.`,
            );
        }
        return { argv: [pyScript, ...args], cwd };
    }
    if (spec.kind === 'inline') {
        return { argv: ['-c', spec.target, ...args], cwd };
    }
    // module
    return { argv: ['-m', spec.target, ...args], cwd };
}

function capture(spec: OracleSpec): OracleResult {
    const { argv, cwd } = buildSpawn(spec);
    const env = spec.env ? { ...process.env, ...spec.env } : process.env;
    const r = spawnSync('python3', argv, {
        cwd,
        input: spec.input ?? '',
        encoding: 'utf8',
        env,
    });
    if (r.error) {
        throw new Error(`parity_oracle CAPTURE: spawning python3 failed: ${r.error.message}`);
    }
    const norm = spec.normalize ?? ((s: string): string => s);
    const result: OracleResult = {
        stdout: norm(r.stdout ?? ''),
        stderr: norm(r.stderr ?? ''),
        // spawnSync reports status `null` when the process was killed by a
        // signal; -1 is a deterministic, JSON-serialisable stand-in.
        status: r.status ?? -1,
    };
    // v3 — freeze declared file side-effects (raw bytes, base64; never coerced
    // through stdout). Read AFTER the spawn so we capture what python wrote.
    if (spec.outputs) {
        const files: Record<string, string | null> = {};
        for (const [name, outPath] of Object.entries(spec.outputs)) {
            const abs = path.isAbsolute(outPath) ? outPath : path.join(cwd, outPath);
            files[name] =
                fs.existsSync(abs) && fs.statSync(abs).isFile()
                    ? fs.readFileSync(abs).toString('base64')
                    : null;
        }
        result.files = files;
    }
    const target = snapshotPath(spec);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`);
    return result;
}

function readSnapshot(spec: OracleSpec): OracleResult {
    const target = snapshotPath(spec);
    if (!fs.existsSync(target)) {
        throw new Error(
            `parity_oracle: no snapshot for kind="${spec.kind}" target="${spec.target}" ` +
                `args=${JSON.stringify(spec.args ?? [])} (expected ${target}). ` +
                `Re-run capture with PY2TS_CAPTURE=1 while the .py original exists. ` +
                `Refusing to pass without a frozen golden.`,
        );
    }
    const raw = fs.readFileSync(target, 'utf8');
    const parsed = JSON.parse(raw) as Partial<OracleResult>;
    if (
        typeof parsed.stdout !== 'string' ||
        typeof parsed.stderr !== 'string' ||
        typeof parsed.status !== 'number'
    ) {
        throw new Error(`parity_oracle: malformed snapshot at ${target}`);
    }
    const result: OracleResult = {
        stdout: parsed.stdout,
        stderr: parsed.stderr,
        status: parsed.status,
    };
    // v3 — when the caller declares `outputs`, the snapshot MUST carry the frozen
    // file bytes for every declared name, or it is a stale pre-v3 snapshot.
    // Throw rather than silently pass (the R6 no-neutering guard, extended to
    // file side-effects). Re-capture with PY2TS_CAPTURE=1 while the .py exists.
    if (spec.outputs) {
        const files = parsed.files;
        if (files === undefined) {
            throw new Error(
                `parity_oracle: snapshot at ${target} has no frozen file outputs but the ` +
                    `invocation declares outputs=${JSON.stringify(Object.keys(spec.outputs))}. ` +
                    `Stale pre-v3 snapshot — re-run capture with PY2TS_CAPTURE=1 while the .py original exists.`,
            );
        }
        for (const name of Object.keys(spec.outputs)) {
            if (!(name in files)) {
                throw new Error(
                    `parity_oracle: snapshot at ${target} is missing frozen output "${name}". ` +
                        `Re-run capture with PY2TS_CAPTURE=1 while the .py original exists.`,
                );
            }
        }
        result.files = files;
    } else if (parsed.files !== undefined) {
        result.files = parsed.files;
    }
    return result;
}

/**
 * Resolve the frozen Python-side result for one invocation descriptor (v2).
 *
 * Capture mode spawns python3 per `spec.kind`, applies `spec.normalize` to
 * stdout/stderr, writes the snapshot, and returns it. Normal mode reads the
 * frozen snapshot (a missing one throws — never silently passes).
 *
 * The caller MUST apply the same `spec.normalize` to the `.ts` twin's output
 * before comparing — see the normalize contract on `OracleSpec`.
 */
export function oracle2(spec: OracleSpec): OracleResult {
    return isCaptureMode() ? capture(spec) : readSnapshot(spec);
}

/**
 * v1 entry point — kept as a thin wrapper so already-converted `kind: 'script'`
 * rigs keep passing against their existing snapshots.
 *
 * @param scriptStem  Path to the script WITHOUT extension, relative to the
 *                    repo root (e.g. `src/agent-src/templates/scripts/telemetry_report`).
 *                    `.py` is appended only in CAPTURE mode.
 * @param args        argv passed to the script.
 * @param input       stdin fed to the script (use `''` when the script reads no stdin).
 */
export function oracle(scriptStem: string, args: string[], input: string): OracleResult {
    return oracle2({ kind: 'script', target: scriptStem, args, input });
}

/**
 * v3 — decode one frozen file side-effect from an OracleResult to raw bytes.
 * Returns `null` when python did not write the file (the frozen `null` sentinel),
 * letting the caller assert the .ts twin likewise produced no file. Throws if the
 * name was never frozen (mis-wired rig — declare it in `spec.outputs`).
 */
export function oracleFile(
    result: { files?: Record<string, string | null> },
    name: string,
): Buffer | null {
    if (!result.files || !(name in result.files)) {
        throw new Error(
            `parity_oracle: no frozen file output "${name}" in result ` +
                `(declare it in spec.outputs and re-capture). Present: ` +
                `${JSON.stringify(Object.keys(result.files ?? {}))}.`,
        );
    }
    const b64 = result.files[name];
    return b64 === null || b64 === undefined ? null : Buffer.from(b64, 'base64');
}
