/**
 * The only host environment variables this package will ever write.
 *
 * WHY ITS OWN MODULE. One place owns the question "which host variable may this
 * package write", and the answer is a two-row allow table rather than a rule
 * applied at a call site. `install.ts` imports it; nothing else writes host env.
 * The move out of `install.ts` also keeps that file, already far over its size
 * cap, from paying for this feature — the same reason the doctor's
 * network-posture block moved into its own module.
 *
 * THE GUARANTEE IS THE SHAPE, not a check. Both traffic variables —
 * `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` and `DISABLE_AUTOUPDATER` — reach
 * the host's update-disabled resolver, the blanket one as its THIRD RUNG
 * (measured on Claude Code 2.1.284, `docs/setup/host-traffic-environment.md`).
 * A writer able to express either could disable a consumer's security updates.
 * Owner-decided 2026-09-30 that it never may, and an allow table of two holds
 * that where a deny list of two would have to stay complete as the host grows
 * more variables.
 *
 * Both writable entries are request SIZE caps. Neither suppresses a call, an
 * update check or a download — they bound how big a request is, never how many.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import * as YAML from 'yaml';

/** The allow table. Two rows, and adding a third is a governance change. */
export const WRITABLE_HOST_ENV: readonly { readonly variable: string; readonly settingsKey: string }[] = [
    { variable: 'BASH_MAX_OUTPUT_LENGTH', settingsKey: 'bash_max_output_length' },
    { variable: 'MAX_MCP_OUTPUT_TOKENS', settingsKey: 'max_mcp_output_tokens' },
];

/** Where a project's settings document lives, canonical first. */
const SETTINGS_CANDIDATES: readonly string[][] = [
    ['agents', 'settings', '.agent-settings.yml'],
    ['.agent-settings.yml'],
];

/**
 * The project settings document, or `null` when there is none to read.
 *
 * `null` on an absent or unparseable file rather than `{}`: the caller reads a
 * key whose ABSENCE means "write nothing", and collapsing an unreadable file to
 * an empty object would give the same answer as a readable file with the key
 * unset. Both write nothing, but only one of them is a fact.
 */
export function readSettingsDoc(projectRoot: string): unknown | null {
    for (const parts of SETTINGS_CANDIDATES) {
        const p = path.join(projectRoot, ...parts);
        let text: string;
        try {
            text = fs.readFileSync(p, 'utf-8');
        } catch {
            continue;
        }
        let doc: unknown;
        try {
            doc = YAML.parse(text, { version: '1.1' });
        } catch {
            return null;
        }
        return doc === null || doc === undefined || typeof doc !== 'object' ? null : doc;
    }
    return null;
}

/**
 * The `env` block for the host settings file, or `null` when nothing is set.
 *
 * `null` rather than `{}`: an empty object would still be merged into the
 * consumer's file, leaving an `env: {}` nobody asked for and making "this
 * package wrote nothing" indistinguishable from "this package wrote a blank".
 *
 * A non-integer or non-positive value is IGNORED rather than written. The schema
 * already refuses it; this branch is for a hand-edited settings file, where
 * writing a value the host would silently reinterpret is worse than writing none.
 */
export function hostEnvBlock(settings: unknown): Record<string, string> | null {
    const root = settings as Record<string, unknown> | null | undefined;
    const he = root?.['host_environment'] as Record<string, unknown> | undefined;
    const caps = he?.['request_size_caps'] as Record<string, unknown> | undefined;
    if (caps === undefined) return null;
    const out: Record<string, string> = {};
    for (const { variable, settingsKey } of WRITABLE_HOST_ENV) {
        const v = caps[settingsKey];
        if (typeof v === 'number' && Number.isInteger(v) && v > 0) out[variable] = String(v);
    }
    return Object.keys(out).length === 0 ? null : out;
}

/**
 * The host bridge object with the `env` block merged in, if there is one.
 *
 * Takes the bridge and returns it rather than being called for its side effect,
 * so the caller is one expression and `install.ts` — already far over its size
 * cap — pays one line for this feature instead of six. `announce` is injected
 * rather than imported: this module has no opinion about how a caller reports,
 * and importing the installer's logger would make a leaf depend on its consumer.
 */
export function withHostEnv(
    bridge: Record<string, unknown>,
    projectRoot: string,
    announce: (msg: string) => void,
): Record<string, unknown> {
    const env = hostEnvBlock(readSettingsDoc(projectRoot));
    if (env === null) return bridge;
    announce(`.claude/settings.json: wrote ${Object.keys(env).join(', ')} (request-size caps)`);
    return { ...bridge, env };
}
