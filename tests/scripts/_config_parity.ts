// Shared parity harness for the src/scripts/config/* twins (py2ts Phase 8).
//
// Committed helper (never an untracked import). Provides:
//   * REPO_ROOT — the package root resolved from this file.
//   * hasPython3 — gate for golden-parity blocks (always true now — see below).
//   * runPy / runTsx — runners for a config module's CLI, used to diff the
//     python side vs the tsx twin byte-for-byte where the output is
//     deterministic.
//
// ── Snapshot-oracle conversion (py2ts Phase 4/5) ──────────────────────────
// `runPy` no longer spawns `python3` at run time. It inspects its argv to pick
// the python invocation KIND and delegates to the parity oracle
// (`tests/_lib/parity_oracle.ts`):
//   * `['-c', code, ...rest]`  → kind:'inline'  (target = the code string)
//   * `['-m', module, ...rest]`→ kind:'module'  (target = the module name)
//   * `[scriptPath, ...rest]`  → kind:'script'  (target = path sans `.py`)
// Capture mode (`PY2TS_CAPTURE=1`) spawns python3 ONCE and freezes the
// `{status,stdout,stderr}` into a committed snapshot; every normal run reads the
// frozen golden instead (a missing one throws — never silently skips). The
// `RunResult` return shape is preserved so the 5 importer rigs need no change.
// `runTsx` (the REAL `.ts` twin) is untouched — it still spawns `tsx`.
// `hasPython3` returns `true` unconditionally so the parity blocks always run.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { oracle2, type OracleKind } from '../_lib/parity_oracle.js';

export const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

export const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

export interface RunResult {
    status: number;
    stdout: string;
    stderr: string;
    /** v3 — frozen file side-effects, present only when the call declares `outputs`. */
    files?: Record<string, string | null>;
}

/**
 * Gate for the golden-parity blocks. Always `true`: the snapshot oracle replays
 * the frozen Python output with no live `python3`, so the parity blocks must
 * always run. A missing snapshot throws in the oracle — never a silent skip.
 */
export function hasPython3(): boolean {
    return true;
}

/**
 * Run the .py twin's CLI via the parity oracle. The invocation kind is inferred
 * from `moduleArgs[0]`:
 *   * `-c` → inline (code = moduleArgs[1], rest = sys.argv[1:])
 *   * `-m` → module (module = moduleArgs[1], rest = the module's argv)
 *   * else → script (moduleArgs[0] is a `.py` path, rest = its argv)
 * `src/` is on PYTHONPATH (package mode) in capture mode.
 */
export function runPy(
    moduleArgs: string[],
    options: {
        cwd?: string;
        env?: NodeJS.ProcessEnv;
        scratch?: string[];
        outputs?: Record<string, string>;
    } = {},
): RunResult {
    const pythonPath = path.join(REPO_ROOT, 'src');
    // Stringify any caller-supplied env onto the oracle env (only used in
    // capture mode); PYTHONPATH stays load-bearing for `-m`/package resolution.
    const env: Record<string, string> = { PYTHONPATH: pythonPath };
    if (options.env) {
        for (const [k, v] of Object.entries(options.env)) {
            if (typeof v === 'string') {
                env[k] = v;
            }
        }
    }

    let kind: OracleKind;
    let target: string;
    let rest: string[];
    if (moduleArgs[0] === '-c') {
        kind = 'inline';
        target = moduleArgs[1] ?? '';
        rest = moduleArgs.slice(2);
    } else if (moduleArgs[0] === '-m') {
        kind = 'module';
        target = moduleArgs[1] ?? '';
        rest = moduleArgs.slice(2);
    } else {
        kind = 'script';
        const first = moduleArgs[0] ?? '';
        target = first.endsWith('.py') ? first.slice(0, -'.py'.length) : first;
        rest = moduleArgs.slice(1);
    }

    const r = oracle2({
        kind,
        target,
        args: rest,
        env,
        cwd: options.cwd ?? REPO_ROOT,
        ...(options.scratch !== undefined ? { scratch: options.scratch } : {}),
        ...(options.outputs !== undefined ? { outputs: options.outputs } : {}),
    });
    return {
        status: r.status,
        stdout: r.stdout,
        stderr: r.stderr,
        ...(r.files !== undefined ? { files: r.files } : {}),
    };
}

/** Run the .ts twin via tsx. */
export function runTsx(
    tsScript: string,
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): RunResult {
    const r = spawnSync(TSX_BIN, [tsScript, ...args], {
        encoding: 'utf8',
        cwd: options.cwd ?? REPO_ROOT,
        env: { ...process.env, ...options.env },
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}
