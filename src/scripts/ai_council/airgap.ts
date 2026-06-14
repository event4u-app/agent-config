/**
 * Airgap detection for the AI Council installer / first-run (step-9 P11 · U1).
 *
 * TypeScript twin of `src/scripts/ai_council/airgap.py` (ADR-094 —
 * Python→TS migration, Phase 1; ai_council FOUNDATION wave). Public surface
 * mirrors the Python module exactly (snake_case kept deliberately):
 * `COUNCIL_PROBE_HOSTS`, `DEFAULT_TIMEOUT_S`, `AIRGAP_BANNER`,
 * `airgap_banner`, `probe_host`, `detect_airgap`, `recommended_member_mode`,
 * `main`.
 *
 * Probes DNS for the three primary council provider hosts with a short
 * timeout. If **all** probes fail the environment is treated as airgapped
 * and the installer is expected to seed `defaults.member_mode: api`.
 *
 * Why DNS, not HTTP: DNS is cheap, a hit disproves airgap, no auth, no false
 * negatives from proxies that block HTTPS but allow DNS.
 *
 * PARITY NOTES
 * - `probe_host` / `detect_airgap` are synchronous with an injectable
 *   `resolver` (a function that throws on failure), exactly like Python.
 *   Every test injects a resolver; the default resolver is only used by the
 *   CLI `main`, which touches the live network and is non-deterministic
 *   (DIVERGENCE: not byte-golden-diffable, mirrors the update_prices.ts
 *   network carve-out).
 * - The default resolver performs a **synchronous** DNS lookup in a short
 *   subprocess (`node -e dns.lookup`) so the sync API is preserved without
 *   blocking the event loop in a way that breaks `getaddrinfo` parity.
 *   Python enforces the timeout via `socket.setdefaulttimeout`; here the
 *   timeout is enforced via the subprocess `timeout` (best-effort, identical
 *   observable result: a slow/failed lookup counts as unreachable).
 * - CLI argument errors mirror Python's argparse exit code (2) and message
 *   tail; `prog` is the basename of argv[1] (so it reads `airgap.ts` under
 *   tsx, `airgap.py` under python3 — the only intrinsic runtime difference).
 */

import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

export const COUNCIL_PROBE_HOSTS: readonly string[] = [
    'api.anthropic.com',
    'api.openai.com',
    'generativelanguage.googleapis.com',
];

export const DEFAULT_TIMEOUT_S = 1.0;

/**
 * Banner string the installer prints when airgap is detected. Wording is
 * part of the Phase 11 contract (roadmap step-9 line 147) and is asserted by
 * the airgap-detection tests.
 */
export const AIRGAP_BANNER = 'airgapped environment detected — defaulting to mode: api';

/** Return the canonical airgap banner (step-9 P11). */
export function airgap_banner(): string {
    return AIRGAP_BANNER;
}

/** A resolver throws on DNS / socket failure, returns nothing on success. */
export type Resolver = (host: string) => void;

/**
 * Resolve `host` synchronously via a short `node -e dns.lookup` subprocess.
 *
 * Throws on failure (mirrors `socket.getaddrinfo` raising `gaierror`). The
 * `_timeoutS`-derived subprocess timeout enforces the per-host budget that
 * Python applies via `socket.setdefaulttimeout`.
 */
function _defaultResolver(host: string, timeoutS: number): void {
    execFileSync(
        process.execPath,
        [
            '-e',
            'const d=require("node:dns");d.lookup(process.argv[1],(e)=>{process.exit(e?3:0)})',
            host,
        ],
        { timeout: Math.max(1, Math.round(timeoutS * 1000)), stdio: 'ignore' },
    );
}

/**
 * Return `true` iff `host` resolves within `timeout`.
 *
 * Any DNS / socket error is treated as unreachable. Test code can inject
 * `resolver` to simulate reachability without touching the network.
 */
export function probe_host(
    host: string,
    options: { timeout?: number; resolver?: Resolver | null } = {},
): boolean {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT_S;
    const resolver: Resolver = options.resolver ?? ((h: string): void => _defaultResolver(h, timeout));
    try {
        resolver(host);
    } catch {
        return false;
    }
    return true;
}

/**
 * Return `true` iff **every** host in `hosts` is unreachable.
 *
 * A single reachable host is enough to disprove airgap. Empty `hosts` is
 * treated as airgap by definition (no providers to reach).
 */
export function detect_airgap(
    options: { hosts?: Iterable<string>; timeout?: number; resolver?: Resolver | null } = {},
): boolean {
    const hosts = options.hosts ?? COUNCIL_PROBE_HOSTS;
    const timeout = options.timeout ?? DEFAULT_TIMEOUT_S;
    const resolver = options.resolver ?? null;
    const hostsList = Array.from(hosts);
    if (hostsList.length === 0) {
        return true;
    }
    for (const host of hostsList) {
        if (probe_host(host, { timeout, resolver })) {
            return false;
        }
    }
    return true;
}

/**
 * Return `"api"` when airgapped, `"cli"` otherwise.
 *
 * Convenience wrapper for the installer: matches the Phase 8 default of
 * `cli` and the Phase 11 airgap override of `api`.
 */
export function recommended_member_mode(
    options: { hosts?: Iterable<string>; timeout?: number; resolver?: Resolver | null } = {},
): string {
    return detect_airgap(options) ? 'api' : 'cli';
}

/** argparse `prog` — basename of argv[1] (script path). */
function _prog(): string {
    const argv1 = process.argv[1];
    if (argv1 === undefined || argv1 === '') {
        return 'airgap.py';
    }
    return path.basename(argv1);
}

const _USAGE = (prog: string): string => `usage: ${prog} [-h] [--timeout TIMEOUT]`;

const _HELP = (prog: string): string =>
    `${_USAGE(prog)}\n\n` +
    'Detect airgap state and print recommended member_mode.\n\n' +
    'optional arguments:\n' +
    '  -h, --help         show this help message and exit\n' +
    `  --timeout TIMEOUT  per-host DNS timeout in seconds (default: ${pyFloatRepr(
        DEFAULT_TIMEOUT_S,
    )})\n`;

/** Render a float like Python's f-string (1.0 → "1.0", 0.5 → "0.5"). */
function pyFloatRepr(x: number): string {
    return Number.isInteger(x) ? `${x}.0` : String(x);
}

/** argparse-style error: usage to stderr, message, exit 2. */
function _argError(prog: string, message: string): never {
    process.stderr.write(`${_USAGE(prog)}\n`);
    process.stderr.write(`${prog}: error: ${message}\n`);
    process.exitCode = 2;
    throw new _ExitSignal(2);
}

/** Internal control-flow signal so `main` can return the argparse exit code. */
class _ExitSignal extends Error {
    constructor(readonly code: number) {
        super(`exit ${code}`);
    }
}

/** Parse a float the way argparse's `type=float` does. */
function _parseFloat(prog: string, raw: string): number {
    const t = raw.trim();
    let n: number;
    const lower = t.toLowerCase();
    if (lower === 'inf' || lower === 'infinity' || lower === '+inf' || lower === '+infinity') {
        n = Infinity;
    } else if (lower === '-inf' || lower === '-infinity') {
        n = -Infinity;
    } else if (lower === 'nan' || lower === '+nan' || lower === '-nan') {
        n = NaN;
    } else if (t === '') {
        _argError(prog, `argument --timeout: invalid float value: '${raw}'`);
    } else {
        n = Number(t);
        if (Number.isNaN(n)) {
            _argError(prog, `argument --timeout: invalid float value: '${raw}'`);
        }
    }
    return n;
}

/**
 * CLI entry-point: print recommended mode + banner if airgapped.
 *
 * Probe the three provider hosts and exit `0` with the recommended mode on
 * stdout. When airgapped also emit the banner on stderr.
 */
export function main(argv: string[] | null = null): number {
    const args = argv ?? process.argv.slice(2);
    const prog = _prog();
    let timeout = DEFAULT_TIMEOUT_S;
    try {
        for (let i = 0; i < args.length; i += 1) {
            const a = args[i] as string;
            if (a === '-h' || a === '--help') {
                process.stdout.write(_HELP(prog));
                return 0;
            }
            if (a === '--timeout') {
                const v = args[i + 1];
                if (v === undefined) {
                    _argError(prog, 'argument --timeout: expected one argument');
                }
                timeout = _parseFloat(prog, v as string);
                i += 1;
            } else if (a.startsWith('--timeout=')) {
                timeout = _parseFloat(prog, a.slice('--timeout='.length));
            } else {
                _argError(prog, `unrecognized arguments: ${a}`);
            }
        }
    } catch (exc) {
        if (exc instanceof _ExitSignal) {
            return exc.code;
        }
        throw exc;
    }

    const isAirgapped = detect_airgap({ timeout });
    const mode = isAirgapped ? 'api' : 'cli';
    if (isAirgapped) {
        process.stderr.write(`${AIRGAP_BANNER}\n`);
    }
    process.stdout.write(`${mode}\n`);
    return 0;
}

const _isMain = import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? '')).href;
if (_isMain) {
    process.exitCode = main(process.argv.slice(2));
}
