/**
 * A consumer's lever inventory — `agents/settings/security-ops.yml`.
 *
 * Shape: `src/scripts/schemas/security-ops.schema.json`; design:
 * `src/skills/security-audit/references/control-section.md`; decision: ADR-304.
 * This validator also carries the cross-field rules the schema cannot express:
 * a lever never locks out the path that releases it.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

export const LEVER_INVENTORY = path.join('agents', 'settings', 'security-ops.yml');

/** A file whose presence says the project is deployed, not a library or script. */
export const DEPLOY_SIGNALS = [
    'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml', 'Procfile', 'vercel.json',
    'netlify.toml', 'fly.toml', 'app.yaml', 'serverless.yml', 'artisan', 'next.config.js', 'next.config.mjs',
    'next.config.ts', 'bin/console',
];

export function isDeployed(root: string): boolean {
    return DEPLOY_SIGNALS.some((f) => fs.existsSync(path.join(root, f)));
}

/**
 * The project's levers when the inventory exists and is valid, `null` when it is
 * absent, and `'invalid'` when it exists but cannot be used — a caller never
 * names a lever from an inventory it could not validate.
 */
export function readLevers(root: string): Lever[] | null | 'invalid' {
    const file = path.join(root, LEVER_INVENTORY);
    if (!fs.existsSync(file)) return null;
    try {
        const doc = parseYaml(fs.readFileSync(file, 'utf8')) as unknown;
        return validateSecurityOps(doc).length === 0 ? (doc as SecurityOps).levers : 'invalid';
    } catch {
        return 'invalid';
    }
}

export const LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;
export const OPERATOR_PATHS = ['sso', 'identity-provider', 'vpn'] as const;
export const BREAK_GLASS = ['cli', 'edge-rule', 'infra-flag'] as const;
export const RELEASES = ['control-surface', 'cli', 'edge-rule', 'infra-flag'] as const;
export const STOPS = ['http', 'queue', 'scheduler', 'webhook-in', 'webhook-out', 'websocket', 'mobile'] as const;

export interface Lever {
    id: string;
    level: (typeof LEVELS)[number];
    fail_mode: 'open' | 'closed';
    owner: string;
    release: (typeof RELEASES)[number];
    stops?: string[];
    packages?: string[];
}

export interface SecurityOps {
    schema_version: 1;
    operator_path: (typeof OPERATOR_PATHS)[number];
    break_glass: (typeof BREAK_GLASS)[number];
    levers: Lever[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const one = (list: readonly string[], v: unknown): boolean => typeof v === 'string' && list.includes(v);

/** Every problem with the inventory; an empty list means it is valid. */
export function validateSecurityOps(value: unknown): string[] {
    if (!isObj(value)) return ['inventory is not an object'];
    const out: string[] = [];
    if (value['schema_version'] !== 1) out.push('schema_version must be 1');
    if (!one(OPERATOR_PATHS, value['operator_path'])) {
        out.push('operator_path must be sso|identity-provider|vpn — a URL secret is break-glass at most, never the primary path');
    }
    if (!one(BREAK_GLASS, value['break_glass'])) out.push('break_glass must be cli|edge-rule|infra-flag — a path that works without the web UI');
    const levers = value['levers'];
    if (!Array.isArray(levers) || levers.length === 0) {
        out.push('levers must name at least one lever');
        return out;
    }
    levers.forEach((l, i) => {
        if (!isObj(l)) {
            out.push(`levers[${i}]: not an object`);
            return;
        }
        const at = `levers[${i}] ${String(l['id'] ?? '?')}`;
        if (!str(l['id'])) out.push(`${at}: id is required`);
        if (!one(LEVELS, l['level'])) out.push(`${at}: level must be L0..L4`);
        if (!one(['open', 'closed'], l['fail_mode'])) out.push(`${at}: fail_mode must be open|closed — what happens when the lever store cannot be read`);
        if (!str(l['owner'])) out.push(`${at}: owner names the role that may throw it`);
        if (!one(RELEASES, l['release'])) out.push(`${at}: release must be control-surface|cli|edge-rule|infra-flag`);
        if (l['level'] === 'L4' && l['release'] === 'control-surface') {
            out.push(`${at}: an L4 lever takes the control surface offline — release through edge-rule|infra-flag|cli`);
        }
        const stops = l['stops'];
        if (stops !== undefined) {
            if (!Array.isArray(stops)) out.push(`${at}: stops must be a list`);
            else
                for (const s of stops) {
                    if (s === 'control-surface') out.push(`${at}: stops the control surface — the operator would be locked out`);
                    else if (!one(STOPS, s)) out.push(`${at}: stops value ${String(s)} must be one of ${STOPS.join('|')}`);
                }
        }
    });
    return out;
}
