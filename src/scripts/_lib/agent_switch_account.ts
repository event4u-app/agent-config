/**
 * Which signed-in account a vendor-CLI seat starts on.
 *
 * agent-switch's balancing lives in its shell wrapper function, which a
 * subprocess never runs — so every seat AC spawned inherited the parent's
 * config dir (or none, the default login): one account, every time. This asks
 * agent-switch directly (`agent-switch dir --provider <p> --json`) and hands
 * back the env var a spawn should carry.
 *
 * `null` means "agent-switch has no answer" — binary missing, call failed,
 * malformed JSON, no `configDir`, or a vendor agent-switch does not serve. The
 * caller then spawns exactly as it did before this module existed. Exit 86 is
 * different: a folder rule pins this project to an account that cannot be
 * served, and falling back to the default login would spill this project's
 * traffic onto an account the owner fenced it off from — so it is a typed
 * refusal, never a null.
 */
import { spawnSync } from 'node:child_process';

import { hardenedSpawnEnv } from './spawn_env.js';

/** How a seat's account is chosen. `rules` honours folder rules, `balance` ignores them, `off` never asks. */
export type AgentSwitchMode = 'rules' | 'balance' | 'off';
export const AGENT_SWITCH_MODES: readonly AgentSwitchMode[] = ['rules', 'balance', 'off'];
export const DEFAULT_AGENT_SWITCH_MODE: AgentSwitchMode = 'rules';
/** Env override for the mode; wins over `.ai-council.yml`'s `agent_switch:`. */
export const AGENT_SWITCH_MODE_ENV = 'AGENT_CONFIG_AGENT_SWITCH';

/** The exit agent-switch uses when a folder rule cannot be served. */
export const FOLDER_RULE_EXIT = 86;
const RESOLVE_TIMEOUT_MS = 5000;

/** Seat vendor (AC's member name) → agent-switch provider + the env var it reads. */
const VENDORS: Readonly<Record<string, { provider: string; envVar: string }>> = {
    openai: { provider: 'codex', envVar: 'CODEX_HOME' },
    anthropic: { provider: 'claude', envVar: 'CLAUDE_CONFIG_DIR' },
};

export interface SeatHome {
    readonly envVar: string;
    readonly dir: string;
    /** `<provider>/<name>`, e.g. `codex/Matze1`. The only part ever recorded. */
    readonly profile: string;
}

export class FolderRuleRefusal extends Error {
    constructor(readonly rule: string) {
        super(`agent-switch folder rule cannot be served: ${rule}`);
        this.name = 'FolderRuleRefusal';
    }
}

/** An agent-switch older than `--exclude`: retries and spreading are unavailable. */
export class ExcludeUnsupported extends Error {
    constructor() {
        super('agent-switch does not support --exclude (needs 2.12.0+)');
        this.name = 'ExcludeUnsupported';
    }
}

export interface RunResult {
    readonly status: number | null;
    readonly stdout: string;
    readonly stderr: string;
    readonly missing?: boolean;
}

export type Runner = (args: readonly string[], cwd: string) => RunResult;

function defaultRunner(args: readonly string[], cwd: string): RunResult {
    const r = spawnSync('agent-switch', [...args], {
        cwd,
        encoding: 'utf-8',
        timeout: RESOLVE_TIMEOUT_MS,
        env: hardenedSpawnEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (r.error) {
        return { status: null, stdout: '', stderr: '', missing: (r.error as NodeJS.ErrnoException).code === 'ENOENT' };
    }
    return { status: r.status, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? '') };
}

let runner: Runner = defaultRunner;
let configuredMode: AgentSwitchMode = DEFAULT_AGENT_SWITCH_MODE;

/** Test seam. Returns the previous runner so a test can restore it. */
export function _setRunner(next: Runner | null): Runner {
    const prev = runner;
    runner = next ?? defaultRunner;
    return prev;
}

/** Set from the council config at load; the env override still wins. */
export function setAgentSwitchMode(mode: AgentSwitchMode): void {
    configuredMode = mode;
}

export function isAgentSwitchMode(v: unknown): v is AgentSwitchMode {
    return typeof v === 'string' && (AGENT_SWITCH_MODES as readonly string[]).includes(v);
}

export function agentSwitchMode(env: NodeJS.ProcessEnv = process.env): AgentSwitchMode {
    const raw = env[AGENT_SWITCH_MODE_ENV];
    return isAgentSwitchMode(raw) ? raw : configuredMode;
}

/** The agent-switch provider for an AC seat vendor, or null when it serves none. */
export function providerFor(vendor: string): string | null {
    return VENDORS[vendor]?.provider ?? null;
}

export function resolveSeatHome(
    vendor: string,
    opts: { exclude?: readonly string[]; cwd?: string; mode?: AgentSwitchMode } = {},
): SeatHome | null {
    const mode = opts.mode ?? agentSwitchMode();
    const spec = VENDORS[vendor];
    if (mode === 'off' || spec === undefined) return null;
    const args = ['dir', '--provider', spec.provider, '--json'];
    if (mode === 'balance') args.push('--plain');
    // agent-switch takes bare profile names after the provider prefix.
    const exclude = (opts.exclude ?? []).map((p) => p.split('/').pop() ?? p).filter((p) => p !== '');
    if (exclude.length > 0) args.push('--exclude', exclude.join(','));
    let r: RunResult;
    try {
        r = runner(args, opts.cwd ?? process.cwd());
    } catch {
        return null;
    }
    if (r.status === FOLDER_RULE_EXIT) {
        throw new FolderRuleRefusal(folderRuleText(r));
    }
    if (exclude.length > 0 && r.status !== 0 && !r.missing && /unknown (option|flag|argument)|--exclude/i.test(r.stderr)) {
        throw new ExcludeUnsupported();
    }
    if (r.missing || r.status !== 0) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(r.stdout);
    } catch {
        return null;
    }
    if (parsed === null || typeof parsed !== 'object') return null;
    const o = parsed as Record<string, unknown>;
    const dir = o['configDir'];
    const profile = o['profile'];
    if (typeof dir !== 'string' || dir === '') return null;
    // No profile name → the account cannot be excluded, recorded or spread;
    // `profile: ''` still runs the seat on the dir agent-switch chose.
    return { envVar: spec.envVar, dir, profile: typeof profile === 'string' ? profile : '' };
}

/**
 * The rule as agent-switch words it, with absolute paths masked: folder rules
 * are keyed by folder paths, and this text reaches response metadata.
 */
function folderRuleText(r: RunResult): string {
    return redactPaths(rawFolderRuleText(r)).slice(0, 300);
}

export function redactPaths(text: string): string {
    // A path starts a token; `codex/Work` (a profile name) does not match.
    return text.replace(/(^|[\s"'(=])(?:~|[A-Za-z]:)?[/\\][^\s"'`,;)]+/g, '$1<path>');
}

function rawFolderRuleText(r: RunResult): string {
    try {
        const o = JSON.parse(r.stdout) as Record<string, unknown>;
        const note = o['note'] ?? o['blocked'];
        if (typeof note === 'string' && note !== '') return note;
        const why = o['why'];
        if (Array.isArray(why) && why.length > 0) return String(why[why.length - 1]);
    } catch {
        // fall through to stderr
    }
    return r.stderr.trim().split('\n').pop() || 'folder rule (no detail)';
}

/**
 * Profiles already serving the current round, per vendor. Seats run one after
 * another, so "already assigned earlier in this round" is exactly the set a
 * later seat should avoid while a free account exists.
 */
const roundLedger = new Map<string, Set<string>>();
// Only a caller that declares rounds (the orchestrator) spreads; a standalone
// seat (ai_team, self-review) never accumulates exclusions.
let roundOpen = false;

export function beginSeatAccountRound(): void {
    roundLedger.clear();
    roundOpen = true;
}

/** Close the round: later seats run unspread until the next round opens. */
export function endSeatAccountRound(): void {
    roundLedger.clear();
    roundOpen = false;
}

export function roundProfiles(vendor: string): readonly string[] {
    return [...(roundLedger.get(vendor) ?? [])];
}

export function noteRoundProfile(vendor: string, profile: string): void {
    if (!roundOpen || profile === '') return;
    const set = roundLedger.get(vendor) ?? new Set<string>();
    set.add(profile);
    roundLedger.set(vendor, set);
}

/**
 * Pick for one seat in a round: avoid accounts already serving this round,
 * and share one when none is free — sharing beats failing.
 */
export function resolveRoundSeatHome(
    vendor: string,
    opts: { exclude?: readonly string[]; cwd?: string } = {},
): SeatHome | null {
    const taken = roundProfiles(vendor);
    const extra = opts.exclude ?? [];
    if (taken.length > 0) {
        // Spreading is best-effort: a folder rule that leaves no other account,
        // or an agent-switch without --exclude, means sharing — never failing.
        try {
            const spread = resolveSeatHome(vendor, { ...opts, exclude: [...extra, ...taken] });
            if (spread !== null) return spread;
        } catch (exc) {
            if (!(exc instanceof FolderRuleRefusal) && !(exc instanceof ExcludeUnsupported)) throw exc;
        }
    }
    return resolveSeatHome(vendor, { ...opts, exclude: extra });
}

/** One status line per CLI vendor, for `council:status`. */
export function accountSourceLine(vendor: string, label: string): string {
    const provider = providerFor(vendor);
    if (provider === null) return `${label} seats: default login (no agent-switch provider)`;
    const mode = agentSwitchMode();
    if (mode === 'off') return `${label} seats: default login (agent_switch: off)`;
    let r: RunResult;
    try {
        r = runner(['list', '--json'], process.cwd());
    } catch {
        return `${label} seats: default login (agent-switch not found)`;
    }
    if (r.missing || r.status !== 0) return `${label} seats: default login (agent-switch not found)`;
    const n = countProfiles(r.stdout, provider);
    return n === null
        ? `${label} seats: agent-switch (${mode})`
        : `${label} seats: agent-switch (${n} account${n === 1 ? '' : 's'}, ${mode})`;
}

function countProfiles(stdout: string, provider: string): number | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(stdout);
    } catch {
        return null;
    }
    const rows = Array.isArray(parsed)
        ? parsed
        : parsed !== null && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>)['profiles'])
          ? ((parsed as Record<string, unknown>)['profiles'] as unknown[])
          : null;
    if (rows === null) return null;
    return rows.filter((row) => {
        if (typeof row === 'string') return row.startsWith(`${provider}/`);
        if (row !== null && typeof row === 'object') {
            const o = row as Record<string, unknown>;
            if (o['disabled'] === true) return false;
            return o['provider'] === provider || (typeof o['profile'] === 'string' && o['profile'].startsWith(`${provider}/`));
        }
        return false;
    }).length;
}
