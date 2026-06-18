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
//   - "1"  → CAPTURE: spawn `python3 <stem>.py`, write the snapshot, return it.
//            Run once with the `.py` present to freeze the goldens.
//   - else → NORMAL: read the snapshot and return it. A missing snapshot
//            THROWS loudly — never silently skips or passes.
//
// Snapshot layout (keyed by a stable hash of stem+args+input so the same
// invocation always resolves to the same file, and any change to the
// invocation surfaces as a new key rather than overwriting a golden):
//   tests/_lib/__parity_snapshots__/<basename(stem)>/<sha256>.json
//
// This package is ESM ("type":"module"); a bare `require` throws under tsx,
// so everything below uses top-level `import`.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Captured / frozen result of one script invocation. */
export interface OracleResult {
    stdout: string;
    stderr: string;
    status: number;
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
 * different normalisation (see fan-out obstacles in the report).
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
 * Stable key for one invocation. The NUL separators keep the three fields
 * unambiguous (no field can contain a NUL byte in practice), so distinct
 * (stem, args, input) triples never collide on a single key.
 */
function snapshotKey(scriptStem: string, args: string[], input: string): string {
    const keyArgs = args.map(normalizeArgForKey);
    const material = `${scriptStem}\0${JSON.stringify(keyArgs)}\0${input}`;
    return createHash('sha256').update(material, 'utf8').digest('hex');
}

function snapshotPath(scriptStem: string, args: string[], input: string): string {
    const base = path.basename(scriptStem);
    const key = snapshotKey(scriptStem, args, input);
    return path.join(SNAPSHOT_ROOT, base, `${key}.json`);
}

/** Absolute path to the script (stem given relative to REPO_ROOT). */
function resolveStem(scriptStem: string): string {
    return path.isAbsolute(scriptStem) ? scriptStem : path.join(REPO_ROOT, scriptStem);
}

function capture(scriptStem: string, args: string[], input: string): OracleResult {
    const pyScript = `${resolveStem(scriptStem)}.py`;
    if (!fs.existsSync(pyScript)) {
        throw new Error(
            `parity_oracle CAPTURE: python source not found at ${pyScript} ` +
                `(scriptStem="${scriptStem}"). Capture must run while the .py original exists.`,
        );
    }
    const r = spawnSync('python3', [pyScript, ...args], {
        cwd: REPO_ROOT,
        input,
        encoding: 'utf8',
    });
    if (r.error) {
        throw new Error(`parity_oracle CAPTURE: spawning python3 failed: ${r.error.message}`);
    }
    const result: OracleResult = {
        stdout: r.stdout ?? '',
        stderr: r.stderr ?? '',
        // spawnSync reports status `null` when the process was killed by a
        // signal; -1 is a deterministic, JSON-serialisable stand-in.
        status: r.status ?? -1,
    };
    const target = snapshotPath(scriptStem, args, input);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`);
    return result;
}

function readSnapshot(scriptStem: string, args: string[], input: string): OracleResult {
    const target = snapshotPath(scriptStem, args, input);
    if (!fs.existsSync(target)) {
        throw new Error(
            `parity_oracle: no snapshot for scriptStem="${scriptStem}" args=${JSON.stringify(args)} ` +
                `(expected ${target}). Re-run capture with PY2TS_CAPTURE=1 while the .py original exists. ` +
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
    return { stdout: parsed.stdout, stderr: parsed.stderr, status: parsed.status };
}

/**
 * Resolve the frozen Python-side result for one script invocation.
 *
 * @param scriptStem  Path to the script WITHOUT extension, relative to the
 *                    repo root (e.g. `src/agent-src/templates/scripts/telemetry_report`).
 *                    `.py` is appended only in CAPTURE mode.
 * @param args        argv passed to the script.
 * @param input       stdin fed to the script (use `''` when the script reads no stdin).
 */
export function oracle(scriptStem: string, args: string[], input: string): OracleResult {
    return isCaptureMode()
        ? capture(scriptStem, args, input)
        : readSnapshot(scriptStem, args, input);
}
