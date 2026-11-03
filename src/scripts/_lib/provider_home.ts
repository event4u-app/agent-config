/**
 * The one place that decides where a provider CLI keeps its state for the
 * session AC runs in (`road-to-the-profile-the-session-runs-in` Phase 1).
 *
 * An account profile is nothing more than a different directory behind
 * `CLAUDE_CONFIG_DIR` / `CODEX_HOME` — whether the account tool set it or the
 * user did. Every reader of the active session's login, transcripts or sessions
 * resolves through here, so a profile is honoured everywhere or nowhere.
 * `check_provider_home_joins` keeps new hardcoded `~/.claude` joins out of the
 * runtime tree.
 *
 * Install targets are deliberately NOT routed here: AC's user scope is written
 * to the default directories, which are the share source a profile links to.
 */
import { createHash } from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';

export type EnvMap = Readonly<Record<string, string | undefined>>;

export type HomeSource = 'env' | 'default';

export interface ProviderHome {
    readonly path: string;
    readonly source: HomeSource;
}

function envOf(env?: EnvMap | null): EnvMap {
    return env ?? process.env;
}

/** `HOME` from the map when injected, else the OS home. */
export function userHome(env?: EnvMap | null): string {
    const injected = (envOf(env)['HOME'] ?? '').trim();
    return injected !== '' ? injected : os.homedir();
}

function expandTilde(p: string, home: string): string {
    if (p === '~') return home;
    if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(home, p.slice(2));
    return p;
}

function resolveHome(env: EnvMap | null | undefined, varName: string | null, dirName: string): ProviderHome {
    const map = envOf(env);
    const home = userHome(map);
    const override = varName === null ? '' : (map[varName] ?? '').trim();
    if (override !== '') return { path: expandTilde(override, home), source: 'env' };
    return { path: path.join(home, dirName), source: 'default' };
}

/** Claude Code config dir — `CLAUDE_CONFIG_DIR`, else `~/.claude`. */
export function claudeHomeInfo(env?: EnvMap | null): ProviderHome {
    return resolveHome(env, 'CLAUDE_CONFIG_DIR', '.claude');
}

/** Codex CLI home — `CODEX_HOME`, else `~/.codex`. */
export function codexHomeInfo(env?: EnvMap | null): ProviderHome {
    return resolveHome(env, 'CODEX_HOME', '.codex');
}

/**
 * Gemini CLI home — always `~/.gemini` for now. `GEMINI_CLI_HOME` is not
 * evaluated: whether it replaces the home or the `.gemini` directory is an
 * open spike, and guessing a path formula would report the wrong login.
 */
export function geminiHomeInfo(env?: EnvMap | null): ProviderHome {
    return resolveHome(env, null, '.gemini');
}

export function claudeHome(env?: EnvMap | null): string {
    return claudeHomeInfo(env).path;
}

export function codexHome(env?: EnvMap | null): string {
    return codexHomeInfo(env).path;
}

export function geminiHome(env?: EnvMap | null): string {
    return geminiHomeInfo(env).path;
}

/** The raw `GEMINI_CLI_HOME` value when set, so doctor can say it is not evaluated. */
export function geminiCliHomeOverride(env?: EnvMap | null): string | null {
    const raw = (envOf(env)['GEMINI_CLI_HOME'] ?? '').trim();
    return raw === '' ? null : raw;
}

/** Keychain service name Claude Code uses with no config-dir override. */
export const CLAUDE_KEYCHAIN_SERVICE = 'Claude Code-credentials';

/**
 * Keychain service Claude Code writes its subscription credential under for
 * this environment. With `CLAUDE_CONFIG_DIR` set, Claude Code suffixes the
 * service with the first 8 hex of sha256 over the NFC-normalised RAW variable
 * — raw, not resolved, because that is the string the CLI hashes.
 */
export function claudeKeychainService(env?: EnvMap | null): string {
    const raw = envOf(env)['CLAUDE_CONFIG_DIR'] ?? '';
    if (raw.trim() === '') return CLAUDE_KEYCHAIN_SERVICE;
    const digest = createHash('sha256').update(raw.normalize('NFC'), 'utf8').digest('hex');
    return `${CLAUDE_KEYCHAIN_SERVICE}-${digest.slice(0, 8)}`;
}
