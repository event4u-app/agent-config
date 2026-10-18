#!/usr/bin/env tsx
/**
 * `/design-system:sync plan|reconcile|verify` (road-to-a-canvas-the-code-owns
 * Phase 4).
 *
 * The repository is the only store of the design system; the host's canvas
 * holds a projection of it, which the host's own `/design-sync` produces and
 * which only the user starts. This script never starts it, never writes to the
 * canvas and never touches the network. It reads files and writes exactly one:
 * `<scope>/.claude/design-system/sync-ledger.json`.
 *
 * CLI:
 *
 *   design_sync plan      --code <design-system.json> [--remote <snapshot-dir>]
 *                         [--base-commit <sha>] [--scope-root <dir>]
 *   design_sync reconcile [--set <key>=<disposition>]... [--maturity <m>]
 *                         [--intent preserve|extend|redesign] [--owner fe-design|directives/ui]
 *                         [--scope-root <dir>]
 *   design_sync verify    [--render-check <file>] [--baseline <path>]...
 *                         [--accept-render <field>=<reason>]... [--state <state>]
 *                         [--scope-root <dir>]
 *
 * Exit codes: 0 — done, nothing open · 1 — rows await a disposition, a check
 * failed, or the ledger is invalid · 2 — argument error · 3 — internal error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { detect_component_taxonomy } from '../agent-src/templates/scripts/work_engine/taxonomy/detect.js';
import { importClaudeDesignSnapshot } from './_lib/design_system_claude_design.js';
import type { DesignSystem } from './_lib/design_system_import.js';
import {
    DISPOSITIONS,
    type Disposition,
    LEDGER_RELATIVE,
    type Ledger,
    PROJECTION_STATES,
    type ProjectionState,
    serializeLedger,
    validateLedger,
} from './_lib/design_sync_ledger.js';
import { planCounts, planLedger, readBaseAtCommit } from './_lib/design_sync_plan.js';
import { matrixRows, reconcileLedger } from './_lib/design_sync_reconcile.js';
import { stampBaselines, verifyLedger } from './_lib/design_sync_verify.js';
import type { ChangeIntent, ReferenceMaturity } from './_lib/ui_authority.js';

const _HERE = fileURLToPath(import.meta.url);
const USAGE = 'usage: design_sync {plan|reconcile|verify} [options] — see the file header';
const CONFIG_RELATIVE = '.design-sync/config.json';

class ArgError extends Error {}

interface Parsed {
    verb: 'plan' | 'reconcile' | 'verify';
    single: Map<string, string>;
    multi: Map<string, string[]>;
}

const MULTI = new Set(['--set', '--baseline', '--accept-render']);
const SINGLE = new Set(['--scope-root', '--code', '--remote', '--base-commit', '--maturity', '--intent', '--owner', '--render-check', '--state']);

export function parseArgs(argv: readonly string[]): Parsed {
    const [verb, ...rest] = argv;
    if (verb !== 'plan' && verb !== 'reconcile' && verb !== 'verify') throw new ArgError('the first argument must be plan, reconcile or verify');
    const single = new Map<string, string>();
    const multi = new Map<string, string[]>();
    for (let i = 0; i < rest.length; i++) {
        const flag = rest[i] as string;
        const value = rest[i + 1];
        if (!SINGLE.has(flag) && !MULTI.has(flag)) throw new ArgError(`unrecognized argument: ${flag}`);
        if (value === undefined) throw new ArgError(`argument ${flag}: expected one argument`);
        i += 1;
        if (MULTI.has(flag)) multi.set(flag, [...(multi.get(flag) ?? []), value]);
        else single.set(flag, value);
    }
    return { verb, single, multi };
}

function pairs(values: readonly string[] | undefined, flag: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const v of values ?? []) {
        const eq = v.indexOf('=');
        if (eq <= 0) throw new ArgError(`argument ${flag}: expected <key>=<value>, got "${v}"`);
        out[v.slice(0, eq)] = v.slice(eq + 1);
    }
    return out;
}

function readJson(file: string): unknown {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown;
    } catch {
        return null;
    }
}

function writeIfChanged(file: string, text: string): void {
    try {
        if (fs.readFileSync(file, 'utf-8') === text) return;
    } catch {
        /* first write */
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf-8');
}

function loadLedger(scope: string): Ledger | null {
    const raw = readJson(path.join(scope, LEDGER_RELATIVE));
    if (raw === null) return null;
    const errors = validateLedger(raw);
    if (errors.length > 0) throw new ArgError(`the existing ledger is invalid: ${errors.join('; ')}`);
    return raw as Ledger;
}

function gitRoot(dir: string): string | null {
    let d = path.resolve(dir);
    for (;;) {
        if (fs.existsSync(path.join(d, '.git'))) return d;
        const up = path.dirname(d);
        if (up === d) return null;
        d = up;
    }
}

function runPlan(p: Parsed, scope: string, out: string[]): number {
    const codeFile = p.single.get('--code');
    if (codeFile === undefined) throw new ArgError('plan requires --code <design-system.json> — the code-side inventory from /design-system:capture');
    const code = readJson(codeFile) as DesignSystem | null;
    if (code === null) throw new ArgError(`--code ${codeFile} is not readable JSON`);
    const config = readJson(path.join(scope, CONFIG_RELATIVE)) as Record<string, unknown> | null;
    const projectId = config !== null && typeof config['projectId'] === 'string' ? config['projectId'] : null;
    const previous = loadLedger(scope);
    const commit = p.single.get('--base-commit') ?? previous?.projection.commit ?? null;

    let base: DesignSystem | null = null;
    if (commit !== null) {
        const root = gitRoot(scope);
        if (root !== null) base = readBaseAtCommit(root, commit, path.relative(root, path.resolve(codeFile)).split(path.sep).join('/'));
        if (base === null) out.push(`note: ${codeFile} is not readable at ${commit} — the comparison is two-way`);
    }
    const remoteDir = p.single.get('--remote');
    let remote: DesignSystem | null = null;
    if (remoteDir !== undefined) {
        const r = importClaudeDesignSnapshot(remoteDir);
        if (r.ok) remote = r.design_system;
        else out.push(`note: remote unreachable — ${r.reason}`);
    }
    const ledger = planLedger({
        scopeRoot: path.relative(gitRoot(scope) ?? scope, path.resolve(scope)) || '.',
        config: CONFIG_RELATIVE,
        code,
        remote,
        base,
        projection: { projectId, commit, ...(previous?.projection.anchor_hash ? { anchor_hash: previous.projection.anchor_hash } : {}) },
        previous,
    });
    writeIfChanged(path.join(scope, LEDGER_RELATIVE), serializeLedger(ledger));
    const c = planCounts(ledger);
    out.push(`overwrite: ${c.overwrite}  (remote-only:collides + conflict — what /design-sync would overwrite)`);
    out.push(`twin: ${c.twin}  (remote-only:twin — left on the canvas as a second system unless dispositioned)`);
    if (c.unknown > 0) out.push(`unknown: ${c.unknown}  (could not be classified — not empty, not in sync)`);
    out.push(`pending: ${c.pending}`);
    out.push(`handover: ${ledger.handover.recommended === null ? 'no recommendation' : ledger.handover.recommended ? 'ready' : 'not ready'} — ${ledger.handover.reason}`);
    return c.pending > 0 || ledger.handover.recommended !== true ? 1 : 0;
}

function locksFrom(designMd: string): { palette: boolean; type_family: boolean } {
    return { palette: /^\s*-\s*Colou?r Lock:/m.test(designMd), type_family: /^\s*-\s*(Type|Font) Lock:/m.test(designMd) };
}

function runReconcile(p: Parsed, scope: string, out: string[]): number {
    const ledger = loadLedger(scope);
    if (ledger === null) throw new ArgError(`no ledger at ${LEDGER_RELATIVE} — run plan first`);
    const sets = pairs(p.multi.get('--set'), '--set');
    for (const v of Object.values(sets)) {
        if (!DISPOSITIONS.includes(v as Disposition)) throw new ArgError(`--set: "${v}" is not one of ${DISPOSITIONS.join(', ')}`);
    }
    let designMd = '';
    try {
        designMd = fs.readFileSync(path.join(scope, 'DESIGN.md'), 'utf-8');
    } catch {
        designMd = '';
    }
    const codeColours = ledger.rows.filter((r) => r.key.startsWith('colors.') && r.code !== null).map((r) => r.code as string);
    const intent = p.single.get('--intent') as ChangeIntent | undefined;
    const owner = p.single.get('--owner') ?? 'fe-design';
    if (owner !== 'fe-design' && owner !== 'directives/ui') throw new ArgError('--owner must be fe-design or directives/ui');
    const { ledger: next, errors } = reconcileLedger(ledger, {
        referenceMaturity: (p.single.get('--maturity') ?? 'finished-comp') as Exclude<ReferenceMaturity, null>,
        incumbent: { coherent: ledger.rows.some((r) => r.code !== null), palette: codeColours },
        locks: locksFrom(designMd),
        ...(intent !== undefined ? { userIntent: { change_intent: intent } } : {}),
        dispositions: sets as Record<string, Disposition>,
        tiers: detect_component_taxonomy(scope).tiers,
        owner,
    });
    writeIfChanged(path.join(scope, LEDGER_RELATIVE), serializeLedger(next));
    for (const b of next.briefs ?? []) out.push(`brief → ${String(b['owner'])}: ${String(b['component'])}`);
    for (const m of matrixRows(next)) out.push(`matrix | ${m.chapter} | ${m.claim} | ${m.evidence} | ${m.status}`);
    for (const e of errors) out.push(`open: ${e}`);
    return errors.length > 0 ? 1 : 0;
}

function runVerify(p: Parsed, scope: string, out: string[]): number {
    let ledger = loadLedger(scope);
    if (ledger === null) throw new ArgError(`no ledger at ${LEDGER_RELATIVE} — run plan first`);
    const state = p.single.get('--state');
    if (state !== undefined) {
        if (!PROJECTION_STATES.includes(state as ProjectionState)) throw new ArgError(`--state must be one of ${PROJECTION_STATES.join(', ')}`);
        if (state === 'picker-confirmed') throw new ArgError('picker-confirmed is recorded by the maintainer after the host picker, never by this command');
        ledger = { ...ledger, projection: { ...ledger.projection, state: state as ProjectionState } };
    }
    const baselines = p.multi.get('--baseline');
    if (baselines !== undefined) ledger = stampBaselines(ledger, baselines);
    const accepted = pairs(p.multi.get('--accept-render'), '--accept-render');
    if (Object.keys(accepted).length > 0) ledger = { ...ledger, render_dispositions: { ...(ledger.render_dispositions ?? {}), ...accepted } };
    writeIfChanged(path.join(scope, LEDGER_RELATIVE), serializeLedger(ledger));
    const renderFile = p.single.get('--render-check') ?? path.join(scope, '.design-sync', '.render-check.json');
    const result = verifyLedger(ledger, { renderCheck: readJson(renderFile), renderDispositions: ledger.render_dispositions ?? {} });
    out.push(`verification: ${result.verification}`);
    for (const r of result.reasons) out.push(`reason: ${r}`);
    for (const s of result.stale_baselines) out.push(`stale: ${s}`);
    for (const f of result.failures) out.push(`fail: ${f}`);
    return result.failures.length > 0 ? 1 : 0;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let parsed: Parsed;
    try {
        parsed = parseArgs(argv);
        const scope = parsed.single.get('--scope-root') ?? '.';
        const out: string[] = [];
        const code = parsed.verb === 'plan' ? runPlan(parsed, scope, out) : parsed.verb === 'reconcile' ? runReconcile(parsed, scope, out) : runVerify(parsed, scope, out);
        process.stdout.write(`${out.join('\n')}\n`);
        return code;
    } catch (exc) {
        if (exc instanceof ArgError) {
            process.stderr.write(`${USAGE}\ndesign_sync: error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (exc) {
        process.stderr.write(`design_sync: internal error: ${exc instanceof Error ? exc.message : String(exc)}\n`);
        process.exit(3);
    }
}
