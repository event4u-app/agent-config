/**
 * rtk (Rust Token Killer) detection — two-stage identity probe.
 *
 * rtk is a THIRD-PARTY Apache-2.0 tool (upstream: https://github.com/rtk-ai/rtk,
 * not an event4u project). Its binary name collides with an unrelated crate —
 * `reachingforthejack/rtk` (Rust Type Kit), which is also what the bare
 * crates.io `rtk` crate resolves to. Upstream's INSTALL.md documents the
 * collision and the discriminator: `rtk gain` renders the token-savings
 * dashboard only on Rust Token Killer.
 *
 * Stage 1 — presence: an executable named `rtk` resolvable on PATH.
 * Stage 2 — identity: run `rtk gain` (short timeout) and judge the OUTPUT
 * SIGNATURE, not the exit code (upstream documents no exit-code contract for
 * `rtk gain`, and `rtk --version` does not distinguish the two tools — both
 * print `rtk <ver>`). The signature is the dashboard header "RTK Token
 * Savings" (captured live from rtk 0.43.0, 2026-07-28).
 *
 * Four states, never a boolean — a broken RIGHT tool is not the WRONG tool:
 *   { present: false }
 *   { present: true, identity: 'token-killer', version }  — signature matched
 *   { present: true, identity: 'unknown-rtk' }            — probe ran, output
 *       clearly not Token Killer (e.g. unknown-subcommand / usage error)
 *   { present: true, identity: 'unverified' }             — timeout, spawn
 *       failure, crash, or ambiguous (empty) output
 *
 * Consumers: the wizard `detect-rtk` endpoint, the `rtk:detect` CLI readout,
 * and the `rtk_wrap` PreToolUse hook (which gates on
 * `identity === 'token-killer'` — never on bare presence). Contract:
 * docs/contracts/rtk-detection.md.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join, dirname } from 'node:path';
export const RTK_UPSTREAM_REPO = 'https://github.com/rtk-ai/rtk';
/**
 * Output signature of Rust Token Killer's `rtk gain` savings dashboard.
 * Rust Type Kit has no `gain` subcommand and errors with a usage message
 * that never contains this header.
 */
const TOKEN_KILLER_GAIN_SIGNATURE = /RTK Token Savings/;
/** Probe timeout — `rtk gain` renders from a local DB (sub-second upstream). */
const PROBE_TIMEOUT_MS = 3000;
/** Resolve the first executable named `name` on the given PATH string. */
export function resolveBinaryOnPath(name, pathEnv) {
    const pathVar = pathEnv ?? process.env['PATH'] ?? '';
    if (pathVar.length === 0)
        return null;
    const suffixes = process.platform === 'win32' ? ['', '.exe', '.cmd', '.bat'] : [''];
    for (const dir of pathVar.split(delimiter)) {
        if (dir.length === 0)
            continue;
        for (const suffix of suffixes) {
            const candidate = join(dir, `${name}${suffix}`);
            if (existsSync(candidate))
                return candidate;
        }
    }
    return null;
}
function runGainProbe(binPath) {
    try {
        const res = spawnSync(binPath, ['gain'], {
            timeout: PROBE_TIMEOUT_MS,
            encoding: 'utf-8',
            windowsHide: true,
        });
        // spawn error or timeout/signal kill → not a completed probe.
        if (res.error !== undefined || res.signal !== null) {
            return { completed: false, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
        }
        return { completed: true, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
    }
    catch {
        return { completed: false, stdout: '', stderr: '' };
    }
}
function readVersion(binPath) {
    try {
        const res = spawnSync(binPath, ['--version'], {
            timeout: PROBE_TIMEOUT_MS,
            encoding: 'utf-8',
            windowsHide: true,
        });
        const m = /^rtk\s+(\S+)/m.exec(res.stdout ?? '');
        return m?.[1];
    }
    catch {
        return undefined;
    }
}
/** Judge identity from a finished probe — output signature, never exit code. */
export function classifyGainOutput(probe) {
    if (!probe.completed)
        return 'unverified';
    const combined = `${probe.stdout}\n${probe.stderr}`;
    if (TOKEN_KILLER_GAIN_SIGNATURE.test(probe.stdout))
        return 'token-killer';
    // Probe ran and produced output that is clearly not the savings dashboard
    // (Rust Type Kit answers `gain` with a usage/unknown-subcommand error).
    if (combined.trim().length > 0)
        return 'unknown-rtk';
    // Completed silently with no output — ambiguous, don't accuse the tool.
    return 'unverified';
}
/**
 * Two-stage rtk detection. Never throws; failure modes collapse into
 * `unverified` (fail-open for diagnostics, fail-CLOSED for consumers that
 * gate behavior — `rtk_wrap` activates only on `token-killer`).
 */
export function detectRtk(options = {}) {
    const binPath = resolveBinaryOnPath('rtk', options.pathEnv);
    if (binPath === null)
        return { present: false };
    const probe = options.probe ?? runGainProbe;
    const identity = classifyGainOutput(probe(binPath));
    if (identity !== 'token-killer')
        return { present: true, identity, binPath };
    const version = (options.versionReader ?? readVersion)(binPath);
    return version === undefined
        ? { present: true, identity, binPath }
        : { present: true, identity, version, binPath };
}
function cacheFile() {
    return join(homedir(), '.event4u', 'agent-config', 'state', 'rtk-identity.json');
}
/**
 * `detectRtk` with a user-global identity cache keyed on the resolved binary's
 * path + mtime + size — the probe re-runs only when the binary changes. An
 * `unverified` verdict is never cached (transient by definition). Any cache
 * I/O error falls through to a live probe (fail-open).
 */
export function detectRtkCached(options = {}) {
    const binPath = resolveBinaryOnPath('rtk', options.pathEnv);
    if (binPath === null)
        return { present: false };
    let stat = null;
    try {
        const st = statSync(binPath);
        stat = { mtimeMs: st.mtimeMs, size: st.size };
    }
    catch {
        stat = null;
    }
    const file = cacheFile();
    if (stat !== null) {
        try {
            const cached = JSON.parse(readFileSync(file, 'utf-8'));
            if (cached.binPath === binPath &&
                cached.mtimeMs === stat.mtimeMs &&
                cached.size === stat.size) {
                return cached.version === undefined
                    ? { present: true, identity: cached.identity, binPath }
                    : { present: true, identity: cached.identity, version: cached.version, binPath };
            }
        }
        catch {
            /* no / stale / unreadable cache — fall through to a live probe */
        }
    }
    const detection = detectRtk(options);
    if (stat !== null && detection.identity !== undefined && detection.identity !== 'unverified') {
        const entry = {
            binPath,
            mtimeMs: stat.mtimeMs,
            size: stat.size,
            identity: detection.identity,
            checkedAt: new Date().toISOString(),
        };
        if (detection.version !== undefined)
            entry.version = detection.version;
        try {
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, `${JSON.stringify(entry, null, 2)}\n`, 'utf-8');
        }
        catch {
            /* cache write is best-effort */
        }
    }
    return detection;
}
/**
 * Per-OS install commands from verified upstream paths. NEVER emit a bare
 * `cargo install rtk` — the crates.io `rtk` crate is the colliding Rust Type
 * Kit, not Rust Token Killer.
 */
export function rtkInstallCommands(platform = process.platform) {
    switch (platform) {
        case 'darwin':
            return {
                recommended: 'brew install rtk',
                recommendedLabel: 'Homebrew (official homebrew-core formula)',
            };
        case 'win32':
            return {
                recommended: 'winget install rtk-ai.rtk',
                recommendedLabel: 'Recommended (automated, winget)',
                manual: `Download rtk-x86_64-pc-windows-msvc.zip from ${RTK_UPSTREAM_REPO}/releases and place rtk.exe on PATH`,
                manualLabel: 'Manual (all Windows versions, incl. winget-less images)',
                note: 'ripgrep is a documented Windows runtime dependency: `winget install BurntSushi.ripgrep.MSVC`. ' +
                    'The winget path is documented upstream (microsoft/winget-pkgs manifests) but has not been live-verified by agent-config — verify with `rtk gain` after install.',
            };
        default:
            // linux + everything POSIX-ish: upstream's install.sh (errors out
            // on unsupported platforms itself; installs to ~/.local/bin).
            return {
                recommended: `curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh | sh`,
                recommendedLabel: "Upstream install.sh (installs to ~/.local/bin)",
                note: 'Ensure ~/.local/bin is on PATH.',
            };
    }
}
//# sourceMappingURL=rtkDetection.js.map