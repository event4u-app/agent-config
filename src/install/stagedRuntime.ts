/**
 * The runtime the hook carrier and the rule stubs need, staged under the
 * machine root (`~/.event4u/agent-config/runtime/`).
 *
 * road-to-a-hook-carrier-that-is-never-silent Phases 1–3. An `npx` install runs
 * from a package directory inside the npm cache (`_npx`), a directory
 * the package manager may clear at any time, and leaves nothing on `PATH`. Every
 * absolute pointer a thinned stub carries and every carrier path the hook command
 * tries therefore resolves HERE, in a directory the package owns.
 *
 * Layout, with `current` a relative symlink swapped by rename:
 *
 *     runtime/current -> v-<version>-<nonce>
 *     runtime/v-…                   the version `current` pointed at before the
 *                                   last swap stays too: two versions at most
 *     runtime/.install.lock/        held while an install stages and swaps
 *     runtime/v-…/node              the node the install ran under
 *     runtime/v-…/dist/hooks/…      the dispatcher bundle
 *     runtime/v-…/dist/agent-src/…  rule bodies the stubs point at, with the
 *                                   trees their relative links resolve into
 *     runtime/v-…/src/scripts/ (data files only), src/config/, package.json,
 *     the `yaml` package, in a `node_modules` directory of the stage
 *                                   what the bundle reads from its package root
 *     runtime/v-…/claude-rules/     the installed claude layer before thinning,
 *                                   stamped files only — the copy a dead carrier
 *                                   restores from, in shell
 *     runtime/thinned               present while the claude layer is thinned;
 *                                   its content is that layer's directory
 *     runtime/demoted               written by the shell branch after a restore
 *     runtime/carrier.json          the last stripped-environment probe per host
 *
 * The state files are shared with the shell branch in `claude_settings_hooks`,
 * which reads them without node; their names are part of that contract.
 */

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';

import { build_claude_hook_matrix } from '../scripts/_lib/claude_settings_hooks.js';
import { event4u_root } from '../scripts/_lib/user_global_paths.js';
import { describeUserPin, readUserPin, writeUserPin } from './userPin.js';

export const RUNTIME_DIRNAME = 'runtime';
export const CLAUDE_LAYER_DIRNAME = 'claude-rules';
export const THINNED_MARKER = 'thinned';
export const DEMOTED_MARKER = 'demoted';
export const CARRIER_RECORD = 'carrier.json';
export const PACKAGE_STAMP_LINE = 'package: event4u/agent-config';

/**
 * Package-relative entries the staged dispatcher reads. A missing entry is
 * skipped, not an error: a checkout without a built bundle still stages its
 * rule bodies, and the hook command checks for the bundle itself.
 */
export const STAGED_ENTRIES: readonly string[] = [
    'package.json',
    'dist/hooks',
    'dist/agent-src',
    'dist/router.json',
    'src/scripts',
    'src/config',
];

/**
 * Packages the bundle still resolves at run time (a `createRequire` the bundler
 * cannot inline). Each is copied into the stage's own `node_modules` from wherever
 * the package root resolves it; `yaml` has no dependencies of its own.
 */
export const STAGED_RUNTIME_DEPS: readonly string[] = ['yaml'];

function stageRuntimeDeps(packageRoot: string, stage: string): void {
    const req = createRequire(path.join(packageRoot, 'package.json'));
    for (const dep of STAGED_RUNTIME_DEPS) {
        let manifest: string;
        try {
            manifest = req.resolve(`${dep}/package.json`);
        } catch {
            continue;
        }
        fs.cpSync(path.dirname(manifest), path.join(stage, 'node_modules', dep), { recursive: true, dereference: true });
    }
}

/**
 * Source under `src/scripts/` stays behind: the bundle carries the code, and
 * reads only the data tables beside it (the manifest, the host lowering table,
 * schemas), which are a small fraction of the TypeScript's size.
 */
function stagedFilter(src: string): boolean {
    return !/\.m?ts$/.test(src);
}

export function runtimeRootFor(env?: NodeJS.ProcessEnv): string {
    return path.join(event4u_root(env ?? process.env), RUNTIME_DIRNAME);
}

export function currentRuntimeDir(runtimeRoot: string): string {
    return path.join(runtimeRoot, 'current');
}

export interface StageOptions {
    readonly packageRoot: string;
    readonly runtimeRoot: string;
    /** Absolute node binary the carrier runs the staged dispatcher with. */
    readonly nodePath: string;
    /** The installed claude rule directory to snapshot before thinning. */
    readonly claudeRulesDir?: string | null;
    /** Test hook: throw after this many entries were copied into the stage. */
    readonly _failAfterEntries?: number;
    /** Test hook: how long to wait for another install's lock before refusing. */
    readonly _lockWaitMs?: number;
}

export interface StageResult {
    readonly currentDir: string;
    readonly version: string;
    readonly dispatcher: boolean;
}

function readVersion(packageRoot: string): string {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')) as {
            version?: unknown;
        };
        return typeof pkg.version === 'string' ? pkg.version : 'unknown';
    } catch {
        return 'unknown';
    }
}

function snapshotStampedLayer(rulesDir: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    let names: string[];
    try {
        names = fs.readdirSync(rulesDir);
    } catch {
        return;
    }
    for (const name of names.sort()) {
        if (!name.endsWith('.md')) continue;
        const src = path.join(rulesDir, name);
        let text: string;
        try {
            if (!fs.statSync(src).isFile()) continue;
            text = fs.readFileSync(src, 'utf8');
        } catch {
            continue;
        }
        // The same test the shell branch applies before overwriting a file.
        if (!text.split(/\r?\n/).includes(PACKAGE_STAMP_LINE)) continue;
        fs.writeFileSync(path.join(dest, name), text);
    }
}

/**
 * Serialises stage, swap and sweep across installs (17.0.0 finding
 * 064424ba17b9): without it two installs at once deleted each other's stage or
 * freshly renamed version and left `current` dangling. A directory, because
 * `mkdir` is atomic on every platform the installer runs on.
 */
export const LOCK_DIRNAME = '.install.lock';
/** A lock older than this was left by an install that died; it is taken over. */
export const LOCK_STALE_MS = 10 * 60 * 1000;
const LOCK_WAIT_MS = 120 * 1000;
const LOCK_POLL_MS = 100;

function sleepSync(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function acquireLock(runtimeRoot: string, waitMs: number): () => void {
    const lock = path.join(runtimeRoot, LOCK_DIRNAME);
    const deadline = Date.now() + waitMs;
    for (;;) {
        try {
            fs.mkdirSync(lock);
            fs.writeFileSync(path.join(lock, 'owner'), `${process.pid}\n`);
            return () => fs.rmSync(lock, { recursive: true, force: true });
        } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        }
        try {
            if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) {
                fs.rmSync(lock, { recursive: true, force: true });
                continue;
            }
        } catch {
            continue;
        }
        if (Date.now() >= deadline) {
            throw new Error(`stageRuntime: another install is staging the runtime (${lock}); retry once it has finished`);
        }
        sleepSync(LOCK_POLL_MS);
    }
}

/**
 * Removes what an interrupted stage left behind and every version except the
 * new one and the one `current` pointed at before the swap — a hook started
 * a moment earlier may still be running out of that directory. Two versions
 * stay on disk at most. Runs under the install lock only.
 */
function sweepStale(runtimeRoot: string, keep: ReadonlySet<string>): void {
    for (const name of fs.readdirSync(runtimeRoot)) {
        const stale =
            (name.startsWith('v-') && !keep.has(name)) || name.startsWith('.stage-') || name.startsWith('.current-');
        if (stale) fs.rmSync(path.join(runtimeRoot, name), { recursive: true, force: true });
    }
}

function currentTarget(current: string): string | null {
    try {
        return path.basename(fs.readlinkSync(current));
    } catch {
        return null;
    }
}

/**
 * Stage the runtime, then make it current by one rename, all under the install
 * lock. A stage interrupted at any point leaves `current` on the previous
 * version; the next stage sweeps what the interrupted one left behind.
 */
export function stageRuntime(opts: StageOptions): StageResult {
    const runtimeRoot = path.resolve(opts.runtimeRoot);
    fs.mkdirSync(runtimeRoot, { recursive: true });
    const release = acquireLock(runtimeRoot, opts._lockWaitMs ?? LOCK_WAIT_MS);
    try {
        return stageLocked(opts, runtimeRoot);
    } finally {
        release();
    }
}

function stageLocked(opts: StageOptions, runtimeRoot: string): StageResult {
    const packageRoot = path.resolve(opts.packageRoot);
    const version = readVersion(packageRoot);
    const nonce = `${process.pid}-${randomBytes(4).toString('hex')}`;
    const stage = path.join(runtimeRoot, `.stage-${nonce}`);
    fs.mkdirSync(stage);

    let copied = 0;
    for (const rel of STAGED_ENTRIES) {
        const src = path.join(packageRoot, rel);
        if (!fs.existsSync(src)) continue;
        fs.cpSync(src, path.join(stage, rel), { recursive: true, dereference: true, filter: stagedFilter });
        copied += 1;
        if (opts._failAfterEntries !== undefined && copied >= opts._failAfterEntries) {
            throw new Error('stageRuntime: injected fault');
        }
    }
    stageRuntimeDeps(packageRoot, stage);
    if (opts.claudeRulesDir) snapshotStampedLayer(opts.claudeRulesDir, path.join(stage, CLAUDE_LAYER_DIRNAME));
    fs.writeFileSync(path.join(stage, 'node'), `${opts.nodePath}\n`);

    const versionDir = `v-${version.replace(/[^A-Za-z0-9._-]/g, '_')}-${nonce}`;
    fs.renameSync(stage, path.join(runtimeRoot, versionDir));
    const current = currentRuntimeDir(runtimeRoot);
    const previous = currentTarget(current);
    const link = path.join(runtimeRoot, `.current-${nonce}`);
    if (process.platform === 'win32') {
        // A junction cannot be renamed over: move the old one aside and put the
        // new one in place by two renames, instead of a recursive delete
        // between them, so the window without `current` is two syscalls wide.
        fs.symlinkSync(path.join(runtimeRoot, versionDir), link, 'junction');
        const aside = path.join(runtimeRoot, `.current-old-${nonce}`);
        if (fs.existsSync(current)) fs.renameSync(current, aside);
        fs.renameSync(link, current);
    } else {
        fs.symlinkSync(versionDir, link);
        fs.renameSync(link, current);
    }
    sweepStale(runtimeRoot, new Set(previous === null ? [versionDir] : [versionDir, previous]));
    return {
        currentDir: current,
        version,
        dispatcher: fs.existsSync(path.join(current, 'dist', 'hooks', 'dispatch.js')),
    };
}


export type LayerState = 'full' | 'thinned' | 'demoted';
export type ProbeOutcome = 'reached' | 'not-reached';

export interface ProbeRecord {
    readonly host: string;
    readonly outcome: ProbeOutcome;
    readonly date: string;
    readonly version: string;
    /** First probe date of the current outcome — when the carrier state last changed. */
    readonly since?: string;
}

export interface CarrierState {
    readonly layer: LayerState;
    readonly probe: ProbeRecord | null;
}

/** Write or clear the thinned marker. Clearing it also clears a demotion. */
export function markClaudeLayer(runtimeRoot: string, opts: { thinned: boolean; rulesDir: string }): void {
    fs.mkdirSync(runtimeRoot, { recursive: true });
    const marker = path.join(runtimeRoot, THINNED_MARKER);
    fs.rmSync(path.join(runtimeRoot, DEMOTED_MARKER), { force: true });
    if (opts.thinned) fs.writeFileSync(marker, `${path.resolve(opts.rulesDir)}\n`);
    else fs.rmSync(marker, { force: true });
}

export function readCarrierState(runtimeRoot: string): CarrierState {
    const layer: LayerState = fs.existsSync(path.join(runtimeRoot, DEMOTED_MARKER))
        ? 'demoted'
        : fs.existsSync(path.join(runtimeRoot, THINNED_MARKER))
          ? 'thinned'
          : 'full';
    let probe: ProbeRecord | null = null;
    try {
        const raw = JSON.parse(fs.readFileSync(path.join(runtimeRoot, CARRIER_RECORD), 'utf8')) as {
            hosts?: Record<string, ProbeRecord>;
        };
        probe = raw.hosts?.['claude'] ?? null;
    } catch {
        probe = null;
    }
    return { layer, probe };
}

/**
 * What a session leaves behind. A live carrier changes nothing; a dead one on a
 * thinned layer restores it and demotes. Nothing a session does promotes — that
 * is what keeps a terminal launch and an app launch from flapping the layer.
 * The shell branch is the implementation; this is its specification.
 */
export function layerAfterSession(state: LayerState, carrierAlive: boolean): LayerState {
    if (state === 'thinned' && !carrierAlive) return 'demoted';
    return state;
}

/**
 * What an install, upgrade or doctor run leaves behind. A layer is thinned only
 * on a carrier the stripped-environment probe reached, so a demoted machine is
 * promoted by a passing probe and by nothing else.
 */
export function layerAfterInstall(
    state: LayerState,
    opts: { wantsThin: boolean; probe: ProbeOutcome },
): LayerState {
    if (!opts.wantsThin) return 'full';
    if (opts.probe === 'reached') return 'thinned';
    return state === 'demoted' ? 'demoted' : 'full';
}


export const STRIPPED_PATH = '/usr/bin:/bin';

/**
 * Run an installed hook command the way a launcher with a bare `PATH` would,
 * from an empty project directory, and report whether it reached a dispatcher.
 *
 * The command is run with `--read-exit` appended to each dispatch, the
 * dispatcher's measurement-only mode, which exits before any concern runs; and
 * with `AC_HOOK_PROBE` set, which the shell branch reads to skip the restore.
 */
export function probeHookCommand(command: string, env: NodeJS.ProcessEnv = process.env): ProbeOutcome {
    const probeCommand = command.replace(/--min-version (\d+)/g, '--min-version $1 --read-exit');
    const project = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-carrier-probe-'));
    const stdinPath = path.join(project, 'stdin.json');
    fs.writeFileSync(stdinPath, '{}');
    const fd = fs.openSync(stdinPath, 'r');
    try {
        const childEnv: NodeJS.ProcessEnv = {
            PATH: STRIPPED_PATH,
            CLAUDE_PROJECT_DIR: project,
            AC_HOOK_PROBE: '1',
        };
        for (const key of ['HOME', 'USERPROFILE', 'EVENT4U_CONFIG_HOME']) {
            if (env[key] !== undefined) childEnv[key] = env[key];
        }
        const res = spawnSync('/bin/sh', ['-c', probeCommand], {
            cwd: project,
            stdio: [fd, 'pipe', 'pipe'],
            encoding: 'utf-8',
            env: childEnv,
            timeout: 30000,
        });
        return typeof res.stderr === 'string' && res.stderr.includes('--read-exit ok') ? 'reached' : 'not-reached';
    } catch {
        return 'not-reached';
    } finally {
        fs.closeSync(fd);
        fs.rmSync(project, { recursive: true, force: true });
    }
}

export function recordCarrierProbe(
    runtimeRoot: string,
    host: string,
    outcome: ProbeOutcome,
    version: string,
    now: Date = new Date(),
): ProbeRecord {
    fs.mkdirSync(runtimeRoot, { recursive: true });
    const file = path.join(runtimeRoot, CARRIER_RECORD);
    let receipt: { hosts?: Record<string, ProbeRecord> } & Record<string, unknown> = {};
    try {
        receipt = JSON.parse(fs.readFileSync(file, 'utf8')) as typeof receipt;
    } catch {
        receipt = {};
    }
    const hosts: Record<string, ProbeRecord> = receipt.hosts ?? {};
    const date = now.toISOString().slice(0, 10);
    const previous = hosts[host];
    const since = previous !== undefined && previous.outcome === outcome ? (previous.since ?? previous.date) : date;
    const record: ProbeRecord = { host, outcome, date, version, since };
    hosts[host] = record;
    // Other receipt fields — the `install --full` pin among them — survive a probe.
    fs.writeFileSync(file, `${JSON.stringify({ ...receipt, hosts }, null, 2)}\n`);
    return record;
}

/** One receipt / doctor line per probe outcome, including the never-probed one. */
export function describeCarrierProbe(probe: ProbeRecord | null): string[] {
    if (probe === null) return ['hook carrier (claude): not probed'];
    const verdict = probe.outcome === 'reached' ? 'reached' : 'NOT reached';
    return [
        `hook carrier (${probe.host}): ${verdict} from a stripped environment (PATH=${STRIPPED_PATH}) — ` +
            `probed ${probe.date}, package ${probe.version}`,
    ];
}

/** The doctor line: the layer on disk, and since when the carrier outcome holds. */
export function describeCarrierState(state: CarrierState): string {
    const since = state.probe === null ? 'never probed' : `carrier ${state.probe.outcome} since ${state.probe.since ?? state.probe.date}`;
    return `hook carrier (claude): rule layer ${state.layer}, ${since}`;
}

export interface ClaudeCarrierPlan {
    /** Run the thin pass, with stub pointers rooted at {@link bodyLinkRoot}. */
    readonly thin: boolean;
    readonly bodyLinkRoot: string | null;
    readonly runtimeRoot: string;
    readonly lines: readonly string[];
    readonly warnings: readonly string[];
}

/**
 * The install-time half of the carrier, run after the claude layer is copied
 * and rewritten and before it may be thinned: stage the runtime, probe the
 * SessionStart command from a stripped environment, record the outcome, and
 * decide the layer by {@link layerAfterInstall}. The caller thins only when
 * `thin` is true and then calls {@link markClaudeLayer}; a full outcome is
 * marked here and a demoted one is left as the shell branch wrote it.
 *
 * Windows has no `/bin/sh` to probe with, so there the decision stays what it
 * was before the probe existed and nothing is recorded — "not probed" is the
 * honest reading.
 */
export function prepareClaudeCarrier(opts: {
    readonly packageRoot: string;
    readonly rulesDir: string;
    readonly sessionStartCommand: string | null;
    readonly wantsThin: boolean;
    /** `install --full`: write the sticky user pin before anything is decided. */
    readonly userPin?: boolean;
    readonly env?: NodeJS.ProcessEnv;
}): ClaudeCarrierPlan {
    const env = opts.env ?? process.env;
    const runtimeRoot = runtimeRootFor(env);
    const warnings: string[] = [];
    let staged: StageResult | null = null;
    try {
        staged = stageRuntime({
            packageRoot: opts.packageRoot,
            runtimeRoot,
            nodePath: process.execPath,
            claudeRulesDir: opts.rulesDir,
        });
    } catch (e) {
        warnings.push(`claude-code: runtime not staged under ${runtimeRoot} — ${String(e)}`);
    }
    if (opts.userPin === true) writeUserPin(runtimeRoot);
    const pin = readUserPin(runtimeRoot);
    const wantsThin = opts.wantsThin && staged !== null && pin === null;
    const probe =
        process.platform === 'win32' || opts.sessionStartCommand === null
            ? null
            : probeHookCommand(opts.sessionStartCommand, env);
    if (probe !== null) recordCarrierProbe(runtimeRoot, 'claude', probe, staged?.version ?? 'unknown');
    const before = readCarrierState(runtimeRoot);
    const next: LayerState =
        probe === null ? (wantsThin ? 'thinned' : 'full') : layerAfterInstall(before.layer, { wantsThin, probe });
    if (next === 'full') markClaudeLayer(runtimeRoot, { thinned: false, rulesDir: opts.rulesDir });
    const lines = describeCarrierProbe(readCarrierState(runtimeRoot).probe);
    const pinLine = describeUserPin(pin);
    if (pinLine !== null) lines.push(pinLine);
    if (next === 'demoted') {
        lines.push('hook carrier (claude): machine demoted — the rule layer stays full until the probe passes');
    }
    return { thin: next === 'thinned', bodyLinkRoot: staged?.currentDir ?? null, runtimeRoot, lines, warnings };
}

/**
 * The doctor half of 3.3: probe the installed command, record it, and promote
 * a demoted machine whose probe now passes. Promotion clears the demotion only;
 * the layer stays full until the next install thins it, because the thin pass
 * belongs to the installer.
 */
export function probeAndPromote(sessionStartCommand: string, env: NodeJS.ProcessEnv = process.env): CarrierState {
    const runtimeRoot = runtimeRootFor(env);
    const before = readCarrierState(runtimeRoot);
    if (process.platform === 'win32') return before;
    const outcome = probeHookCommand(sessionStartCommand, env);
    const staged = readVersion(currentRuntimeDir(runtimeRoot));
    const version = staged !== 'unknown' ? staged : (before.probe?.version ?? 'unknown');
    recordCarrierProbe(runtimeRoot, 'claude', outcome, version);
    if (before.layer === 'demoted' && outcome === 'reached') {
        fs.rmSync(path.join(runtimeRoot, DEMOTED_MARKER), { force: true });
    }
    return readCarrierState(runtimeRoot);
}

/** Remove the staged runtime and its state files; returns the path removed, or null when absent. */
export function removeStagedRuntime(env: NodeJS.ProcessEnv = process.env): string | null {
    const runtimeRoot = runtimeRootFor(env);
    if (!fs.existsSync(runtimeRoot)) return null;
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
    return runtimeRoot;
}

/** The `SessionStart` command the installer writes for this package, or null. */
export function sessionStartCommandFor(packageRoot: string): string | null {
    try {
        return build_claude_hook_matrix(path.join(packageRoot, 'src', 'scripts', 'hook_manifest.yaml'))['SessionStart'] ?? null;
    } catch {
        return null;
    }
}

/**
 * The claude-code deploy step, after the copy and the rewrite: prepare the
 * carrier, thin through `thin` only when the plan says so, and mark the layer
 * by what actually happened — a thin pass that throws leaves it marked full.
 */
export function deployClaudeCarrier(opts: {
    readonly packageRoot: string;
    readonly rulesDir: string;
    readonly wantsThin: boolean;
    readonly userPin?: boolean;
    readonly quiet: boolean;
    readonly thin: (bodyLinkRoot: string | null) => readonly string[];
    readonly info: (line: string) => void;
    readonly warn: (line: string) => void;
}): void {
    const carrier = prepareClaudeCarrier({
        packageRoot: opts.packageRoot,
        rulesDir: opts.rulesDir,
        sessionStartCommand: sessionStartCommandFor(opts.packageRoot),
        wantsThin: opts.wantsThin,
        ...(opts.userPin === true ? { userPin: true } : {}),
    });
    for (const w of carrier.warnings) opts.warn(w);
    if (!opts.quiet) for (const l of carrier.lines) opts.info(l);
    if (!carrier.thin) return;
    try {
        const lines = opts.thin(carrier.bodyLinkRoot);
        markClaudeLayer(carrier.runtimeRoot, { thinned: true, rulesDir: opts.rulesDir });
        if (!opts.quiet) for (const l of lines) opts.info(l);
    } catch (e) {
        markClaudeLayer(carrier.runtimeRoot, { thinned: false, rulesDir: opts.rulesDir });
        opts.warn(`claude-code: thinned rule layer not written — ${String(e)}`);
    }
}

/**
 * The doctor `hook-carrier` check (2.2, 3.3, 4.1): probe the SessionStart
 * command from a stripped environment, record it, promote a demoted machine
 * whose probe now passes, and print the layer and since when the carrier
 * outcome holds. Skipped until an install staged a runtime.
 */
export function checkHookCarrier(
    packageRoot: string,
    env: NodeJS.ProcessEnv = process.env,
): { id: string; status: string; message: string; remedy: string } {
    const runtimeRoot = runtimeRootFor(env);
    const command = sessionStartCommandFor(packageRoot);
    if (!fs.existsSync(currentRuntimeDir(runtimeRoot)) || command === null) {
        return {
            id: 'hook-carrier',
            status: 'skipped',
            message: `no staged runtime under ${runtimeRoot}`,
            remedy: 'run `agent-config upgrade` (or `npx -y @event4u/agent-config init`) to stage it',
        };
    }
    const state = probeAndPromote(command, env);
    const reached = state.probe?.outcome === 'reached';
    return {
        id: 'hook-carrier',
        status: reached ? 'ok' : 'warn',
        message: [...describeCarrierProbe(state.probe), describeCarrierState(state)].join(' · '),
        remedy: reached ? '' : 'install node where the hook launcher can run it, then run `agent-config upgrade`',
    };
}
