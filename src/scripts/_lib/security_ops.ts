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

import { globalRoot, provenanceFilePath, settingsFilePath } from '../_cli/cmd_settings_set.js';

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

/**
 * The inventory's `automation` mode, `off` when the inventory is absent or
 * invalid — a proposal is only ever built from an inventory that validated.
 */
export function readAutomation(root: string): Automation {
    const file = path.join(root, LEVER_INVENTORY);
    if (!fs.existsSync(file)) return 'off';
    try {
        const doc = parseYaml(fs.readFileSync(file, 'utf8')) as unknown;
        return validateSecurityOps(doc).length === 0 && (doc as SecurityOps).automation === 'propose' ? 'propose' : 'off';
    } catch {
        return 'off';
    }
}

export type Automation = 'off' | 'propose';

/** The persisted answer to "plan a security & maintenance section?" (OQ-60 item 2). */
export type PlanAnswer = 'unanswered' | 'yes' | 'no';

const DECIDING_SOURCES = new Set(['jit-answer', 'manual', 'gui']);

/**
 * `security_ops.plan` as a decision, read from the user-global settings file and
 * its provenance sidecar. Only a boolean value counts; anything else is
 * `unanswered`. A boolean with a deciding stamp (`jit-answer`, `manual`, `gui`)
 * is the recorded answer. With NO sidecar entry, a `true` is a hand edit and
 * counts, while the template default `false` stays `unanswered`. A sidecar that
 * exists but cannot be read is not the same as an absent one: it is
 * `unanswered`, as is a stamp of `auto-detected`, because the machine may not
 * reach this answer for the user. Unreadable is never `yes`.
 */
export function planAnswer(env: NodeJS.ProcessEnv = process.env): PlanAnswer {
    const root = globalRoot(env);
    let value: unknown;
    try {
        const doc = parseYaml(fs.readFileSync(settingsFilePath(root), 'utf8')) as unknown;
        const section = isObj(doc) ? doc['security_ops'] : undefined;
        value = isObj(section) ? section['plan'] : undefined;
    } catch {
        return 'unanswered';
    }
    if (typeof value !== 'boolean') return 'unanswered';
    const sidecar = provenanceFilePath(root);
    if (!fs.existsSync(sidecar)) return value ? 'yes' : 'unanswered';
    let entry: unknown;
    try {
        const prov = JSON.parse(fs.readFileSync(sidecar, 'utf8')) as unknown;
        if (!isObj(prov)) return 'unanswered';
        entry = prov['security_ops.plan'];
    } catch {
        return 'unanswered';
    }
    if (entry === undefined) return value ? 'yes' : 'unanswered';
    const source = isObj(entry) ? entry['source'] : undefined;
    if (typeof source !== 'string' || !DECIDING_SOURCES.has(source)) return 'unanswered';
    return value ? 'yes' : 'no';
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
    /** `separate` (the blueprint, default): the control surface does not share the app's HTTP stack. */
    control_surface?: 'separate' | 'same-app';
    /**
     * `off` (default): an advisory names the mapped lever in its report only.
     * `propose`: the product's own advisory hook may raise a proposal to throw the
     * mapped lever, which an operator confirms. Nothing throws a lever unattended.
     */
    automation?: Automation;
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
    const surface = value['control_surface'] ?? 'separate';
    if (!one(['separate', 'same-app'], surface)) out.push('control_surface must be separate|same-app');
    const automation = value['automation'] ?? 'off';
    if (!one(['off', 'propose'], automation)) {
        out.push('automation must be off|propose — an advisory may propose a lever, an operator confirms it; nothing throws one unattended (ADR-304)');
    }
    const levers = value['levers'];
    if (!Array.isArray(levers) || levers.length === 0) {
        out.push('levers must name at least one lever');
        return out;
    }
    if (automation === 'propose' && !levers.some((l) => isObj(l) && Array.isArray(l['packages']) && l['packages'].length > 0)) {
        out.push('automation: propose needs at least one lever with packages — otherwise no advisory maps to a lever and there is nothing to propose');
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
        } else if (surface === 'same-app' && l['release'] === 'control-surface' && (l['level'] === 'L3' || (Array.isArray(l['stops']) && l['stops'].includes('http')))) {
            out.push(`${at}: the control surface is served by the same app this lever switches off, so releasing it locks out the operator — release through cli|edge-rule|infra-flag, or separate the control surface`);
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
