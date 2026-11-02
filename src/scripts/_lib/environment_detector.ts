/**
 * Read-only environment detection — one report, no spend (Phase 1 of
 * `road-to-zero-ceremony-detection`).
 *
 * Answers "what does this machine already have?" in a single pass so the
 * `doctor` surface and the council's transport resolution read the SAME
 * facts instead of each probing on its own. Three record kinds:
 *
 * - `hosts` — which AI hosts are installed, their resolved binary, version.
 * - `auth`  — which provider credentials are PRESENT, and of which source.
 * - `keys`  — the `api_key_ref`-shaped reference for each present key.
 *
 * ## Guarantees
 *
 * - **Zero network.** Nothing here opens a socket. Enforced by the static
 *   import check in the test suite, not by convention.
 * - **Zero spend.** The only subprocess is `<binary> --version`, which no
 *   provider bills. No completion, no token, ever — the roadmap's
 *   install-time-completion item was cut for exactly this reason.
 * - **Presence, never validity.** An `auth` record says "a credential of this
 *   shape exists at this path". It does NOT say the credential works, is
 *   unexpired, or is accepted by the provider. Runtime auth failure stays
 *   authoritative (`CliClient._AUTH_FAILURE_PATTERNS`).
 * - **Read-only.** Reads the filesystem and the injected env map; writes
 *   nothing, creates no directory.
 *
 * ## No third probe shape — what each field absorbs
 *
 * Auth probing already existed in two shapes before this module and a third
 * must not appear. This module composes; it re-implements nothing:
 *
 * - hosts reuse the signal table of `install/toolDetection.ts` and the version
 *   parser of `install/agentSwitchDetection.ts`;
 * - auth reuses `_lib/provider_home.ts` for every provider dir, `_lib/codex_auth.ts`
 *   (shared with `cmd_doctor`) and `_lib/user_global_paths.ts` for key files.
 *
 * The council's TTL'd `AuthCache` (`ai_council/solo_dispatch.ts`) is the third
 * existing shape and is deliberately NOT absorbed: it caches a *liveness*
 * verdict from an injected probe that may spend a call. This module only
 * reports presence, so it needs no TTL — a per-process memo is enough.
 *
 * ## Known limitation — CLI logins the filesystem does not reveal
 *
 * A vendor CLI that stores its subscription credential OUTSIDE the filesystem
 * is undetectable here. Measured case: on macOS the `claude` CLI keeps its
 * OAuth credential in the system Keychain, so `~/.claude/.credentials.json`
 * is absent even for a logged-in Claude Pro user. The detector reports
 * `cli-subscription` only where a credential FILE exists (Linux, and the
 * `CLAUDE_CONFIG_DIR` profile layouts).
 *
 * Consequence, stated because it costs money: with no detectable CLI login,
 * `mode: auto` skips the cli rung and resolves to `api` — metered — for a user
 * who does hold a subscription. This is a FALSE NEGATIVE, which is the
 * direction this module is built to fail in (a false positive would claim a
 * subscription that is not there and switch the USD gate off). The remedy is an
 * explicit `mode: cli` on the member; `doctor` shows the detected source so the
 * gap is visible rather than silent. Reading the Keychain would require a
 * `security(1)` subprocess against a credential store — a spend-free but
 * privacy-relevant probe, and out of scope here.
 *
 * @see docs/contracts/ai-council-config.md § Transport modes — the billing rules
 *      `classifyBilling` implements.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
    detectInstalledTools,
    knownToolIds,
    resolveToolBinary,
} from '../../install/toolDetection.js';
import { parseVersionOutput } from '../../install/agentSwitchDetection.js';
import { claude_config_dir } from './claude_plugin.js';
import { readCodexAuth } from './codex_auth.js';
import { claudeKeychainService, codexHome, geminiHome, userHome } from './provider_home.js';
import { hardenedSpawnEnv } from './spawn_env.js';
import { resolve_with_fallback, type EnvMap } from './user_global_paths.js';

/** Where a present credential was found. Never a claim that it works. */
export type AuthSource = 'cli-subscription' | 'cli-api-key' | 'key-file' | 'env-key';

/**
 * How a call against this provider is paid for.
 *
 * `subscription` — covered by a flat-rate plan the user already pays; the USD
 * cost gate does not apply (`cli_call_budget` guards the quota instead).
 * `per-token` — metered spend; the full `cost_budget` applies.
 * `free-quota` — a `base_url` route whose free terms carry a dated proof; USD 0.
 * `self-hosted` — a loopback route whose probe showed local weights; USD 0.
 *
 * `classifyBilling` never returns the last two: only a route resolution can.
 */
export type BillingClass = 'subscription' | 'per-token' | 'free-quota' | 'self-hosted';

/** Version string when parseable, the literal `'unknown'` when not, `null` when unprobed. */
export type HostVersion = string | 'unknown' | null;

export interface DetectedHost {
    readonly id: string;
    readonly installed: boolean;
    /** Resolved executable path, or `null` when the host has no binary on `$PATH`. */
    readonly binary: string | null;
    readonly version: HostVersion;
}

export interface DetectedAuth {
    readonly provider: string;
    readonly source: AuthSource;
    /** A filesystem path, or `env:<VAR>` — presence evidence only. */
    readonly evidence: string;
}

export interface DetectedKey {
    readonly provider: string;
    /** `api_key_ref`-shaped: `file:<name>.key` or `env:<VAR>`. */
    readonly ref: string;
}

export interface EnvironmentReport {
    readonly hosts: readonly DetectedHost[];
    readonly auth: readonly DetectedAuth[];
    readonly keys: readonly DetectedKey[];
}

/**
 * One row per provider: the default CLI binary, whether that CLI is a
 * community wrapper, the environment variable carrying a raw API key, and the
 * key-file name under the user-global root. Adding a provider is this one
 * edit; a row missing any field is no provider at all (`providerRow`).
 *
 * `community` is the load-bearing billing input: a VENDOR-OFFICIAL CLI
 * (`false`) runs under the user's subscription; a COMMUNITY wrapper (`true`)
 * shells out to the same paid API and stays metered. Mirrors the `CliClient`
 * subclass attributes without importing the client layer.
 */
export interface ProviderRow {
    readonly cli: string;
    readonly community: boolean;
    readonly envKey: string;
    readonly keyFile: string;
}

export const PROVIDER_TABLE: Readonly<Record<string, ProviderRow>> = {
    anthropic: { cli: 'claude', community: false, envKey: 'ANTHROPIC_API_KEY', keyFile: 'anthropic.key' },
    openai: { cli: 'codex', community: false, envKey: 'OPENAI_API_KEY', keyFile: 'openai.key' },
    gemini: { cli: 'gemini', community: false, envKey: 'GEMINI_API_KEY', keyFile: 'gemini.key' },
    xai: { cli: 'grok', community: true, envKey: 'XAI_API_KEY', keyFile: 'xai.key' },
    perplexity: { cli: 'perplexity', community: true, envKey: 'PERPLEXITY_API_KEY', keyFile: 'perplexity.key' },
};

/** The complete row for `provider`, or null when it is absent or any field is missing. */
export function providerRow(provider: string, table: Readonly<Record<string, ProviderRow>> = PROVIDER_TABLE): ProviderRow | null {
    const row = table[provider] as Partial<ProviderRow> | undefined;
    if (row === undefined) return null;
    const complete =
        typeof row.cli === 'string' && row.cli !== '' &&
        typeof row.community === 'boolean' &&
        typeof row.envKey === 'string' && row.envKey !== '' &&
        typeof row.keyFile === 'string' && row.keyFile !== '';
    return complete ? (row as ProviderRow) : null;
}

/** Provider → (default CLI binary, community-wrapper flag); a projection of `PROVIDER_TABLE`. */
export const PROVIDER_CLI_META: Readonly<Record<string, readonly [string, boolean]>> = Object.fromEntries(
    Object.keys(PROVIDER_TABLE).flatMap((p) => {
        const row = providerRow(p);
        return row === null ? [] : [[p, [row.cli, row.community] as const]];
    }),
);

/** Providers this module knows how to classify, in a stable order. */
export function knownProviders(): readonly string[] {
    return Object.keys(PROVIDER_CLI_META);
}

/** True when `provider`'s CLI is a community wrapper around the paid API. */
export function isCommunityCli(provider: string): boolean {
    return PROVIDER_CLI_META[provider]?.[1] ?? false;
}

/**
 * Billing class from (provider, detected auth source) — NEVER from transport.
 *
 * This signature is the invariant: there is no transport / mode parameter, so
 * no caller can make billing depend on which transport was chosen. That is
 * what keeps the per-provider rules intact when `auto` picks a transport at
 * invocation time: a vendor-official CLI logged in under a subscription is
 * unmetered; everything else — including a community CLI and including an
 * unknown source — is metered, i.e. deliberately over-gated.
 *
 * `null` source means "nothing detected" and classifies as `per-token`: the
 * safe direction is to keep the USD gate on.
 */
export function classifyBilling(provider: string, source: AuthSource | null): BillingClass {
    if (source !== 'cli-subscription') return 'per-token';
    if (isCommunityCli(provider)) return 'per-token';
    return 'subscription';
}

/** Codex CLI home — single definition in `provider_home.ts`; re-exported for `cmd_doctor`. */
export { codexHome } from './provider_home.js';

function homeOf(env?: EnvMap | null): string {
    return userHome(env);
}

const VERSION_PROBE_TIMEOUT_MS = 2000;

/** Injected `<binary> --version` runner. Returns raw combined output, or `null`. */
export type VersionProbe = (binary: string) => string | null;

export interface DetectEnvironmentOptions {
    /** Home directory override (tests / fixture machines). */
    readonly home?: string;
    /** `$PATH` override (tests / fixture machines). */
    readonly pathEnv?: string;
    /** Environment map override; also carries `CODEX_HOME` / `EVENT4U_CONFIG_HOME`. */
    readonly env?: EnvMap;
    /**
     * Version probe override. Omit to spawn `<binary> --version` with a
     * hardened env and a 2s timeout; pass `() => null` to skip probing.
     */
    readonly probeVersion?: VersionProbe;
    /**
     * macOS Keychain presence probe for the Claude Code subscription
     * credential. Omit to shell out to `security find-generic-password`;
     * pass `() => false` to skip it entirely — every test that is not
     * specifically about this probe should, so a developer machine's real
     * Keychain never decides a test outcome.
     */
    readonly probeKeychain?: KeychainProbe;
}

/** `(service) => present?` — never returns the secret, only whether it exists. */
export type KeychainProbe = (service: string) => boolean;

/** Keychain service name Claude Code uses with no config-dir override. */
export { CLAUDE_KEYCHAIN_SERVICE } from './provider_home.js';

/**
 * Is the Claude Code subscription credential in the macOS login Keychain?
 *
 * Claude Code stores its OAuth credential in the Keychain on macOS and only
 * falls back to `~/.claude/.credentials.json` elsewhere. Looking for the file
 * alone therefore reports "no subscription" on the platform where the
 * subscription is most likely to exist — which sent every macOS anthropic
 * member down the metered `api` rung while a paid Claude subscription sat
 * unused on the same machine. That is the defect this probe closes.
 *
 * `-w` is deliberately NOT passed: without it `security` prints attributes and
 * never the password, so the secret cannot reach a log, a report, or a crash
 * dump. Presence is read from the exit code alone.
 */
function defaultProbeKeychain(service: string): boolean {
    if (process.platform !== 'darwin') return false;
    try {
        const res = spawnSync('security', ['find-generic-password', '-s', service], {
            timeout: VERSION_PROBE_TIMEOUT_MS,
            encoding: 'utf-8',
            windowsHide: true,
            env: hardenedSpawnEnv(),
        });
        if (res.error !== undefined || res.signal !== null) return false;
        return res.status === 0;
    } catch {
        return false;
    }
}

/**
 * `<binary> --version` under a hardened env. Never throws — a spawn error,
 * timeout, signal, or unparseable output all collapse to `null`, which the
 * caller degrades to `'unknown'`.
 *
 * Hardened per `docs/spawn-site-policy.md` (this runs on the consumer runtime
 * via `doctor`). Note the env scrub deliberately does NOT strip
 * `CLAUDE_CONFIG_DIR` — see `docs/threat-model.md` row i.
 */
function defaultProbeVersion(binary: string): string | null {
    try {
        const res = spawnSync(binary, ['--version'], {
            timeout: VERSION_PROBE_TIMEOUT_MS,
            encoding: 'utf-8',
            windowsHide: true,
            env: hardenedSpawnEnv(),
        });
        if (res.error !== undefined || res.signal !== null) return null;
        return `${res.stdout ?? ''}\n${res.stderr ?? ''}`;
    } catch {
        return null;
    }
}

function isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function exists(p: string): boolean {
    try {
        return fs.existsSync(p);
    } catch {
        return false;
    }
}

/** Provider-specific `cli-subscription` evidence path, or `null` when none applies. */
function cliSubscriptionEvidence(
    provider: string,
    home: string,
    env: EnvMap,
    claudeConfigDir: string,
    probeKeychain: KeychainProbe,
): { source: AuthSource; evidence: string } | null {
    if (provider === 'anthropic') {
        const configDir = claudeConfigDir;
        for (const rel of ['.credentials.json', 'credentials.json']) {
            const p = path.join(configDir, rel);
            if (isFile(p)) return { source: 'cli-subscription', evidence: p };
        }
        // macOS keeps the credential in the Keychain instead of the file above.
        // The evidence string is a locator, never the secret.
        // Under a profile Claude Code suffixes the service; asking the bare one
        // would report the DEFAULT account's subscription for this profile.
        const service = claudeKeychainService(env);
        if (probeKeychain(service)) {
            return { source: 'cli-subscription', evidence: `keychain:${service}` };
        }
        return null;
    }
    if (provider === 'openai') {
        const p = path.join(codexHome(env), 'auth.json');
        const verdict = readCodexAuth(p);
        if (verdict.present && verdict.class !== null) return { source: verdict.class, evidence: p };
        return null;
    }
    if (provider === 'gemini') {
        const p = path.join(geminiHome({ ...env, HOME: home }), 'oauth_creds.json');
        if (isFile(p)) return { source: 'cli-subscription', evidence: p };
        return null;
    }
    // xai / perplexity ship no subscription login — their CLIs read an API key.
    return null;
}

function detectHosts(opts: DetectEnvironmentOptions): DetectedHost[] {
    const installedMap = detectInstalledTools({
        ...(opts.home !== undefined ? { home: opts.home } : {}),
        pathEnv: opts.pathEnv,
    });
    const probe = opts.probeVersion ?? defaultProbeVersion;
    const out: DetectedHost[] = [];
    for (const id of knownToolIds()) {
        const binary = resolveToolBinary(id, opts.pathEnv);
        let version: HostVersion = null;
        if (binary !== null) {
            let raw: string | null;
            try {
                raw = probe(binary);
            } catch {
                raw = null;
            }
            // An unparseable version degrades to 'unknown' — never throws,
            // never omits the host from the report.
            version = raw === null ? 'unknown' : (parseVersionOutput(raw) ?? 'unknown');
        }
        out.push({ id, installed: installedMap[id] ?? false, binary, version });
    }
    return out;
}

function detectAuth(opts: DetectEnvironmentOptions): {
    auth: DetectedAuth[];
    keys: DetectedKey[];
} {
    const env = opts.env ?? process.env;
    const home = opts.home ?? homeOf(opts.env);
    // Delegate to claude_plugin's resolver on the live path (it owns the
    // CLAUDE_CONFIG_DIR override); derive from the injected home otherwise.
    const claudeConfigDir =
        opts.home === undefined && opts.env === undefined
            ? claude_config_dir()
            : ((env['CLAUDE_CONFIG_DIR'] ?? '').trim() || path.join(home, '.claude'));
    const probeKeychain = opts.probeKeychain ?? defaultProbeKeychain;
    const auth: DetectedAuth[] = [];
    const keys: DetectedKey[] = [];

    for (const provider of knownProviders()) {
        const cli = cliSubscriptionEvidence(provider, home, env, claudeConfigDir, probeKeychain);
        if (cli !== null) {
            auth.push({ provider, source: cli.source, evidence: cli.evidence });
        }

        const keyFile = providerRow(provider)?.keyFile;
        if (keyFile !== undefined) {
            let resolved: string | null = null;
            try {
                resolved = resolve_with_fallback(keyFile, { env });
            } catch {
                resolved = null;
            }
            if (resolved !== null && exists(resolved)) {
                auth.push({ provider, source: 'key-file', evidence: resolved });
                keys.push({ provider, ref: `file:${keyFile}` });
            }
        }

        const envVar = providerRow(provider)?.envKey;
        if (envVar !== undefined && (env[envVar] ?? '').trim() !== '') {
            auth.push({ provider, source: 'env-key', evidence: `env:${envVar}` });
            keys.push({ provider, ref: `env:${envVar}` });
        }
    }
    return { auth, keys };
}

/**
 * Strongest auth source detected for `provider`, or `null`.
 *
 * "Strongest" is the transport-preference order `auto` walks: a vendor CLI
 * login beats a stored key. Pure over an already-built report.
 */
export function strongestAuth(
    report: EnvironmentReport,
    provider: string,
): DetectedAuth | null {
    const order: readonly AuthSource[] = [
        'cli-subscription',
        'cli-api-key',
        'key-file',
        'env-key',
    ];
    for (const source of order) {
        const hit = report.auth.find((a) => a.provider === provider && a.source === source);
        if (hit !== undefined) return hit;
    }
    return null;
}

let _cached: EnvironmentReport | null = null;

/**
 * Build the environment report.
 *
 * Cached per process for the no-argument call (the production shape) so
 * `doctor` and transport resolution observe one consistent snapshot; any call
 * that injects options bypasses the cache and returns a fresh read, so tests
 * and fixture machines never poison each other. Reset with
 * `resetEnvironmentCache()`.
 */
export function detectEnvironment(opts: DetectEnvironmentOptions = {}): EnvironmentReport {
    const isDefaultCall = Object.keys(opts).length === 0;
    if (isDefaultCall && _cached !== null) return _cached;
    const hosts = detectHosts(opts);
    const { auth, keys } = detectAuth(opts);
    const report: EnvironmentReport = { hosts, auth, keys };
    if (isDefaultCall) _cached = report;
    return report;
}

/** Drop the per-process memo. Tests only. */
export function resetEnvironmentCache(): void {
    _cached = null;
}
