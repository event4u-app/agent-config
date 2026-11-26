/**
 * `agent-config deliberation:get|set` — read and change `deliberation.mode`,
 * globally or for one session.
 *
 *   deliberation:get [--session <id>] [--json]
 *       The effective mode and where it came from: `session` (an override for
 *       that session), `global` (the user-global setting) or `default`.
 *   deliberation:set <off|offer|auto|inherit> [--session <id>] [--source S] [--json]
 *       Without --session: writes `deliberation.mode` through `settings:set`
 *       (same class fence, schema check, atomic write and provenance stamp;
 *       --source defaults to `manual`). `inherit` is refused there — the global
 *       key has no "inherit" value.
 *       With --session: writes `<user-global root>/state/deliberation/<id>.json`
 *       (0600, atomic); `inherit` deletes it, so the session follows the global
 *       setting again.
 *
 * Exit codes: 0 done · 1 refused (bad session id, settings:set refusal) · 2 usage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    clearSessionOverride,
    DELIBERATION_MODES,
    effectiveToJson,
    isDeliberationMode,
    resolveDeliberationMode,
    validSessionId,
    writeSessionOverride,
    type EffectiveMode,
} from '../_lib/deliberation_mode.js';
import { resolvePackageRoot } from '../_lib/package_root.js';
import { globalRoot, PROVENANCE_SOURCES, runSettingsSet, type ProvenanceSource } from './cmd_settings_set.js';

const USAGE = [
    'usage: agent-config deliberation:get [--session <id>] [--json]',
    '       agent-config deliberation:set <off|offer|auto|inherit> [--session <id>] [--source auto-detected|jit-answer|manual|gui] [--json]',
].join('\n');

export interface CmdResult {
    code: 0 | 1 | 2;
    out: string[];
    err: string[];
}

interface Parsed {
    positional: string[];
    session: string | null;
    source: ProvenanceSource;
    json: boolean;
    error?: string;
}

function parse(argv: readonly string[]): Parsed {
    const r: Parsed = { positional: [], session: null, source: 'manual', json: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--json') r.json = true;
        else if (a === '--session' || a.startsWith('--session=')) {
            const v = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i];
            if (v === undefined || v === '') return { ...r, error: '--session needs a session id' };
            r.session = v;
        } else if (a === '--source') {
            const v = argv[++i];
            if (v === undefined || !(PROVENANCE_SOURCES as readonly string[]).includes(v)) {
                return { ...r, error: `--source must be one of: ${PROVENANCE_SOURCES.join(' | ')}` };
            }
            r.source = v as ProvenanceSource;
        } else if (a === '-h' || a === '--help') return { ...r, error: USAGE };
        else if (a.startsWith('--')) return { ...r, error: `unknown flag: ${a}` };
        else r.positional.push(a);
    }
    return r;
}

function describe(e: EffectiveMode): string {
    const where = e.file === null ? 'default' : `${e.source} · ${e.file}`;
    return `deliberation: ${e.mode} (${where})`;
}

export interface RunOptions {
    readonly env?: NodeJS.ProcessEnv;
    readonly settingsPaths?: readonly string[];
    readonly packageRoot?: string;
    readonly now?: Date;
}

function badSession(id: string): CmdResult {
    return {
        code: 1,
        out: [],
        err: [`❌  deliberation: ${JSON.stringify(id)} is not a session id (letters, digits, - and _; 8–128 characters).`],
    };
}

export function runGet(argv: readonly string[], opts: RunOptions = {}): CmdResult {
    const p = parse(argv);
    if (p.error !== undefined || p.positional.length > 0) return { code: 2, out: [], err: [p.error ?? USAGE] };
    if (p.session !== null && validSessionId(p.session) === null) return badSession(p.session);
    const e = resolveDeliberationMode({ sessionId: p.session, settingsPaths: opts.settingsPaths, env: opts.env ?? null });
    return { code: 0, out: [p.json ? JSON.stringify(effectiveToJson(e)) : describe(e)], err: [] };
}

export function runSet(argv: readonly string[], opts: RunOptions = {}): CmdResult {
    const p = parse(argv);
    const [value, ...rest] = p.positional;
    if (p.error !== undefined || value === undefined || rest.length > 0) return { code: 2, out: [], err: [p.error ?? USAGE] };
    if (value !== 'inherit' && !isDeliberationMode(value)) {
        return { code: 2, out: [], err: [`deliberation:set: mode must be one of ${[...DELIBERATION_MODES, 'inherit'].join(' | ')}`] };
    }
    const env = opts.env ?? process.env;
    const report = (lines: string[], scope: 'session' | 'global'): CmdResult => {
        const e = resolveDeliberationMode({ sessionId: p.session, settingsPaths: opts.settingsPaths, env });
        if (!p.json) return { code: 0, out: [...lines, describe(e)], err: [] };
        return { code: 0, out: [JSON.stringify({ ok: true, scope, set: value, effective: effectiveToJson(e) })], err: [] };
    };

    if (p.session !== null) {
        if (validSessionId(p.session) === null) return badSession(p.session);
        if (value === 'inherit') {
            const removed = clearSessionOverride(p.session, env);
            return report([removed ? `✅  deliberation: session ${p.session} follows the global setting again` : `✅  deliberation: session ${p.session} had no override`], 'session');
        }
        const file = writeSessionOverride(p.session, value, opts.now ?? new Date(), env);
        return report([`✅  deliberation: session ${p.session} → ${value} · ${file}`], 'session');
    }

    if (value === 'inherit') {
        return {
            code: 2,
            out: [],
            err: ['deliberation:set inherit applies to a session override (--session <id>); the global setting takes off | offer | auto.'],
        };
    }
    const r = runSettingsSet({
        key: 'deliberation.mode',
        rawValue: value,
        source: p.source,
        root: globalRoot(env),
        packageRoot: opts.packageRoot ?? resolvePackageRoot(import.meta.url),
        now: (opts.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        dryRun: false,
    });
    if (r.code !== 0) return { code: r.code, out: r.out, err: r.err };
    return report(r.out, 'global');
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const [sub, ...rest] = argv;
    const r = sub === 'get' ? runGet(rest) : sub === 'set' ? runSet(rest) : { code: 2 as const, out: [], err: [USAGE] };
    for (const line of r.out) process.stdout.write(`${line}\n`);
    for (const line of r.err) process.stderr.write(`${line}\n`);
    return r.code;
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

if (_isCliEntry()) {
    process.exitCode = main();
}
