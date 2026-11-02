/**
 * `agent-config audit:security [--root <dir>] [--json]` — the deterministic half
 * of `/audit security` (ADR-304, road-to-a-switch-built-before-it-is-needed 3.1).
 *
 * One question no single audit answers: could this project see, contain, fix
 * and recover from a vulnerability disclosed tomorrow? Four lenses, each
 * `ok | finding | unknown | not-applicable`, every finding with `file:line`:
 *
 *   supply    installed npm packages: an install script, a name one edit away
 *             from a popular package (re-checks what supply-chain-intake only
 *             checks when a dependency is added)
 *   pipeline  the workflow-security scan over the project's .github/workflows
 *   contain   agents/settings/security-ops.yml against its schema; absent on a
 *             deployed product is a finding carrying the offer to plan it
 *   recover   a rollback or runbook signal on a deployed product
 *
 * `run`, `code` and `agents` are routed to `/audit deps`, `/audit code` and
 * `/audit agents`, never rebuilt. No model, no network, writes nothing. There is
 * no total score: a number would hide the lens that could not be read.
 *
 * Exit: 0 every lens ok or not-applicable · 1 a finding · 3 a lens could not be
 * read (`unknown`) and none found anything · 2 usage.
 */
import fs from 'node:fs';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { isDeployed, LEVER_INVENTORY, validateSecurityOps } from './_lib/security_ops.js';
import { scan_workflow } from './lint_workflow_security.js';

export type LensStatus = 'ok' | 'finding' | 'unknown' | 'not-applicable';
export interface LensFinding {
    where: string;
    detail: string;
}
export interface LensResult {
    lens: 'supply' | 'pipeline' | 'contain' | 'recover';
    status: LensStatus;
    reason?: string;
    findings: LensFinding[];
}
export interface SecurityAudit {
    root: string;
    deployed: boolean;
    lenses: LensResult[];
    routed: string[];
}

/** Names a typo-squat imitates. Short on purpose: a near-miss of these is the signal, not a verdict. */
const POPULAR_NPM = [
    'express', 'react', 'react-dom', 'lodash', 'axios', 'next', 'vue', 'chalk', 'commander', 'debug', 'dotenv',
    'moment', 'request', 'webpack', 'typescript', 'eslint', 'prettier', 'jest', 'vitest', 'mongoose', 'redis',
    'jsonwebtoken', 'bcrypt', 'cors', 'body-parser', 'uuid', 'yargs', 'inquirer', 'fastify', 'koa', 'socket.io',
    'node-fetch', 'cross-env', 'nodemon', 'tailwindcss', 'vite', 'esbuild', 'sharp', 'pg', 'mysql2',
];

/** Established packages one edit from a POPULAR_NPM name — measured on this repository's own lockfile. */
const KNOWN_NEAR_NAMES = new Set(['preact', 'redux', 'vuex', 'pino', 'ws', 'pug', 'jest-cli']);

const RECOVER_SIGNALS = /(rollback|runbook|disaster[-_ ]recovery|restore|backup)/i;

function editDistanceIsOne(a: string, b: string): boolean {
    if (a === b || Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    let j = 0;
    let edits = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            i++;
            j++;
            continue;
        }
        if (++edits > 1) return false;
        if (a.length > b.length) i++;
        else if (b.length > a.length) j++;
        else {
            i++;
            j++;
        }
    }
    return edits + (a.length - i) + (b.length - j) === 1;
}

function lineOf(text: string, needle: string): number {
    const at = text.indexOf(needle);
    return at < 0 ? 1 : text.slice(0, at).split('\n').length;
}

function exists(root: string, rel: string): boolean {
    return fs.existsSync(path.join(root, rel));
}

function supplyLens(root: string): LensResult {
    const rel = 'package-lock.json';
    if (!exists(root, rel)) return { lens: 'supply', status: 'not-applicable', reason: 'no package-lock.json', findings: [] };
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    let doc: { packages?: Record<string, { hasInstallScript?: boolean; link?: boolean }> };
    try {
        doc = JSON.parse(text);
    } catch (e) {
        return { lens: 'supply', status: 'unknown', reason: `${rel} unreadable: ${(e as Error).message}`, findings: [] };
    }
    const findings: LensFinding[] = [];
    const seen = new Set<string>();
    for (const [key, pkg] of Object.entries(doc.packages ?? {})) {
        if (key === '' || pkg?.link === true) continue;
        const name = key.replace(/^.*node_modules\//, '');
        if (seen.has(name)) continue;
        seen.add(name);
        const where = `${rel}:${lineOf(text, `"${key}": {`)}`;
        if (pkg.hasInstallScript === true) findings.push({ where, detail: `${name} runs an install script — confirm it is expected, or install with --ignore-scripts` });
        if (!POPULAR_NPM.includes(name) && !KNOWN_NEAR_NAMES.has(name)) {
            const near = POPULAR_NPM.find((p) => editDistanceIsOne(name, p));
            if (near !== undefined) findings.push({ where, detail: `${name} is one edit away from ${near} — confirm it is not a typo-squat` });
        }
    }
    return { lens: 'supply', status: findings.length > 0 ? 'finding' : 'ok', findings };
}

function pipelineLens(root: string): LensResult {
    const dir = path.join(root, '.github', 'workflows');
    if (!fs.existsSync(dir)) return { lens: 'pipeline', status: 'not-applicable', reason: 'no .github/workflows', findings: [] };
    const files = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort();
    const findings: LensFinding[] = [];
    let unreadable = 0;
    for (const f of files) {
        for (const x of scan_workflow(path.join(dir, f), [])) {
            if (x['rule'] === 'parse-error') unreadable++;
            const loc = typeof x['location'] === 'string' && /^\d+$/.test(x['location']) ? `:${x['location']}` : '';
            findings.push({ where: `.github/workflows/${f}${loc}`, detail: `${String(x['severity'])} ${String(x['rule'])}${x['detail'] ? ` — ${String(x['detail'])}` : ''}` });
        }
    }
    if (findings.length === 0) return { lens: 'pipeline', status: 'ok', findings };
    if (unreadable === findings.length) return { lens: 'pipeline', status: 'unknown', reason: 'workflow files could not be parsed', findings };
    return { lens: 'pipeline', status: 'finding', findings };
}

function containLens(root: string, deployed: boolean): LensResult {
    if (!exists(root, LEVER_INVENTORY)) {
        if (!deployed) return { lens: 'contain', status: 'not-applicable', reason: 'no deploy signal — a library or script has nothing to switch at runtime', findings: [] };
        return {
            lens: 'contain',
            status: 'finding',
            findings: [
                {
                    where: LEVER_INVENTORY,
                    detail: 'no lever inventory — could this product be switched off, in part or whole, within minutes, with the operator still able to get in? Offer: plan a security & maintenance section (feature-planning, blueprint security-audit/references/control-section.md)',
                },
            ],
        };
    }
    let doc: unknown;
    try {
        doc = parseYaml(fs.readFileSync(path.join(root, LEVER_INVENTORY), 'utf8'));
    } catch (e) {
        return { lens: 'contain', status: 'unknown', reason: `${LEVER_INVENTORY} unreadable: ${(e as Error).message.split('\n')[0]}`, findings: [] };
    }
    const problems = validateSecurityOps(doc);
    if (problems.length === 0) return { lens: 'contain', status: 'ok', findings: [] };
    return { lens: 'contain', status: 'finding', findings: problems.map((p) => ({ where: LEVER_INVENTORY, detail: p })) };
}

function recoverLens(root: string, deployed: boolean): LensResult {
    if (!deployed) return { lens: 'recover', status: 'not-applicable', reason: 'no deploy signal', findings: [] };
    const candidates: string[] = [];
    for (const dir of ['docs', 'doc', 'runbooks', path.join('docs', 'runbooks'), path.join('.github', 'workflows'), 'agents']) {
        const abs = path.join(root, dir);
        if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) continue;
        for (const f of fs.readdirSync(abs)) if (RECOVER_SIGNALS.test(f)) candidates.push(path.join(dir, f));
    }
    for (const f of fs.readdirSync(root)) if (RECOVER_SIGNALS.test(f)) candidates.push(f);
    if (candidates.length > 0) return { lens: 'recover', status: 'ok', reason: `found ${candidates.sort()[0]}`, findings: [] };
    return { lens: 'recover', status: 'finding', findings: [{ where: '.', detail: 'no rollback, restore or runbook signal (a file named rollback / runbook / restore / backup under docs/, runbooks/ or .github/workflows/)' }] };
}

export function auditSecurity(root: string): SecurityAudit {
    const deployed = isDeployed(root);
    return {
        root,
        deployed,
        lenses: [supplyLens(root), pipelineLens(root), containLens(root, deployed), recoverLens(root, deployed)],
        routed: ['/audit deps', '/audit code', '/audit agents'],
    };
}

export function exitCode(a: SecurityAudit): number {
    if (a.lenses.some((l) => l.status === 'finding')) return 1;
    if (a.lenses.some((l) => l.status === 'unknown')) return 3;
    return 0;
}

export function render(a: SecurityAudit): string {
    const lines = [`Security audit — ${a.deployed ? 'deployed product' : 'no deploy signal'}`, ''];
    for (const l of a.lenses) {
        lines.push(`${l.lens.padEnd(9)} ${l.status}${l.reason ? ` — ${l.reason}` : ''}`);
        for (const f of l.findings) lines.push(`  - ${f.where} · ${f.detail}`);
    }
    lines.push('', `routed (not rebuilt here): ${a.routed.join(' · ')}`);
    lines.push('`unknown` is not `ok`: a lens that could not be read was not checked.');
    return `${lines.join('\n')}\n`;
}

export function main(argv: readonly string[]): number {
    const unknownArg = argv.find((a, i) => a.startsWith('--') && a !== '--root' && a !== '--json' && argv[i - 1] !== '--root');
    if (unknownArg !== undefined) {
        process.stderr.write('usage: audit:security [--root <dir>] [--json]\n');
        return 2;
    }
    const i = argv.indexOf('--root');
    const root = i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : (process.env['AGENT_CONFIG_PROJECT_ROOT'] ?? process.cwd());
    const result = auditSecurity(root);
    process.stdout.write(argv.includes('--json') ? `${JSON.stringify(result, null, 2)}\n` : render(result));
    return exitCode(result);
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(path.basename(process.argv[1]))) {
    process.exitCode = main(process.argv.slice(2));
}
