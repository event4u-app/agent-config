/**
 * Whether the council config declares an unpaid route a hand could reach —
 * the question the per-prompt delegation nudge asks before naming the free
 * rung. Kept apart from `route_member.ts` and `config.ts`, whose import graph
 * would put the whole council loader into the hook bundle.
 *
 * It is a pointer check, not the admission: `ask_transport`'s route chooser
 * still decides per call. A key reference other than `env:` cannot be resolved
 * here cheaply, so it answers false rather than name a rung it cannot verify.
 */
import * as fs from 'node:fs';

import { parse as parseYaml } from 'yaml';

import { resolve_with_fallback } from '../_lib/user_global_paths.js';
import { parseRouteFields, resolveRouteTransport } from './free_route.js';

const COUNCIL_CONFIG_ENV = 'AI_COUNCIL_CONFIG';
const COUNCIL_CONFIG_REL = 'settings/.ai-council.yml';

function keyPresent(ref: unknown): boolean {
    if (ref === undefined || ref === null) return true;
    if (typeof ref !== 'string' || !ref.startsWith('env:')) return false;
    return (process.env[ref.slice(4)] ?? '') !== '';
}

export function freeRouteAvailable(configPath: string): boolean {
    let raw: unknown;
    try {
        raw = parseYaml(fs.readFileSync(configPath, 'utf-8'), { version: '1.1' });
    } catch {
        return false;
    }
    const members = (raw as { members?: unknown } | null)?.members;
    if (members === null || typeof members !== 'object') return false;
    for (const [name, value] of Object.entries(members as Record<string, unknown>)) {
        if (value === null || typeof value !== 'object') continue;
        const cfg = value as Record<string, unknown>;
        if (cfg['enabled'] !== true) continue;
        const parsed = parseRouteFields(name, cfg, false);
        if ('error' in parsed || parsed.route === null) continue;
        const model = typeof cfg['model'] === 'string' ? cfg['model'] : '';
        const t = resolveRouteTransport({ name, route: parsed.route, model, contentClass: 'public-artifact', keyPresent: keyPresent(cfg['api_key_ref']) });
        if (t.available && t.billing !== 'per-token') return true;
    }
    return false;
}

/** The user-global council config path, honouring the explicit override (ADR-104). */
export function councilConfigPath(): string | null {
    const override = process.env[COUNCIL_CONFIG_ENV];
    if (override) return override.startsWith('~/') ? `${process.env['HOME'] ?? ''}${override.slice(1)}` : override;
    return resolve_with_fallback(COUNCIL_CONFIG_REL, { env: null });
}
