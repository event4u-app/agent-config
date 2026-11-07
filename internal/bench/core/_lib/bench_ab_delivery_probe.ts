/**
 * Zero-cost delivery pre-flight for the bench:ab v2 sweep (roadmap step 2.1, D4).
 *
 * The end-of-run activation audit can only see a mis-wired arm AFTER every paid
 * trial has run. This probe answers the same question before the first one: it
 * starts the host with the exact arm command line, reads the `system/init`
 * event the host emits before its first model request, and kills the child.
 *
 * Three things keep it free, and each is asserted by the test suite:
 * - the environment is an allowlist — no API key or auth token reaches the child;
 * - `ANTHROPIC_BASE_URL` points at a closed local port, so a request that did
 *   leave would have nowhere to go;
 * - the child is killed the moment `system/init` is read, before any `result`.
 *
 * The probe needs to kill on an event while the sweep's `main` is synchronous,
 * so it runs a small plain-JS supervisor under `spawnSync`; the supervisor owns
 * the asynchronous read-and-kill and prints only the init event.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const UNREACHABLE_BASE_URL = 'http://127.0.0.1:9';

/** Variables the host needs to start and find the operator's settings — nothing that authenticates. */
export const PROBE_ENV_ALLOWLIST: readonly string[] = [
    'HOME',
    'PATH',
    'USER',
    'LOGNAME',
    'SHELL',
    'TMPDIR',
    'LANG',
    'LC_ALL',
    'TERM',
    'CLAUDE_CONFIG_DIR',
];

const CREDENTIAL_NAME = /(API_KEY|AUTH_TOKEN|ACCESS_TOKEN|SECRET|PASSWORD|CREDENTIAL)/i;

export interface InitInfo {
    skills: string[];
    plugins: string[];
    apiKeySource: string | null;
}

export interface ProbeResult {
    ok: boolean;
    init: InitInfo | null;
    reason: string;
}

/**
 * The child's environment: the allowlist from `base`, then the arm's own extra
 * variables, with every credential-shaped name removed from both and the base
 * URL forced unreachable last so nothing can override it.
 */
export function probe_env(
    base: NodeJS.ProcessEnv,
    extra: Record<string, string> | null = null,
): Record<string, string> {
    const out: Record<string, string> = {};
    for (const k of PROBE_ENV_ALLOWLIST) {
        const v = base[k];
        if (typeof v === 'string') out[k] = v;
    }
    for (const [k, v] of Object.entries(extra ?? {})) {
        if (!CREDENTIAL_NAME.test(k)) out[k] = v;
    }
    out['ANTHROPIC_BASE_URL'] = UNREACHABLE_BASE_URL;
    return out;
}

function _names(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v
        .map((e) => (typeof e === 'string' ? e : e && typeof e === 'object' ? (e as Record<string, unknown>)['name'] : null))
        .filter((n): n is string => typeof n === 'string')
        .sort();
}

/** Extract the init event from stream-json output, or null when none is present. */
export function parse_init_event(stdout: string): InitInfo | null {
    for (const line of stdout.split('\n')) {
        const t = line.trim();
        if (!t.startsWith('{')) continue;
        let ev: unknown;
        try {
            ev = JSON.parse(t);
        } catch {
            continue;
        }
        if (!ev || typeof ev !== 'object') continue;
        const e = ev as Record<string, unknown>;
        if (e['type'] === 'system' && e['subtype'] === 'init') {
            return {
                skills: _names(e['skills']),
                plugins: _names(e['plugins']),
                apiKeySource: typeof e['apiKeySource'] === 'string' ? e['apiKeySource'] : null,
            };
        }
    }
    return null;
}

/** Skill names this package ships, read from the source tree. */
export function package_skill_names(skillsDir: string): Set<string> {
    if (!fs.existsSync(skillsDir)) return new Set();
    return new Set(
        fs
            .readdirSync(skillsDir, { withFileTypes: true })
            .filter((d) => d.isDirectory() && fs.existsSync(path.join(skillsDir, d.name, 'SKILL.md')))
            .map((d) => d.name),
    );
}

/** Loaded skills that belong to this package; a plugin namespace (`plugin:skill`) is stripped. */
export function loaded_package_skills(init: InitInfo, packageSkills: ReadonlySet<string>): string[] {
    return init.skills.filter((s) => packageSkills.has(s.slice(s.lastIndexOf(':') + 1)));
}

/**
 * Whether one arm's delivery matches its contract. An arm that keeps global
 * settings (`setting_sources: null`) is the arm the package rides on and must
 * load at least one package skill; an arm that scopes settings away must load none.
 */
export function delivery_verdict(
    arm: string,
    setting_sources: string | null,
    init: InitInfo | null,
    packageSkills: ReadonlySet<string>,
): { ok: boolean; reason: string } {
    if (init === null) {
        return { ok: false, reason: `${arm}: host emitted no system/init event — delivery unproven` };
    }
    const loaded = loaded_package_skills(init, packageSkills);
    if (setting_sources === null && loaded.length === 0) {
        return { ok: false, reason: `${arm}: expected the package, but no package skill is loaded (${init.skills.length} skills total)` };
    }
    if (setting_sources !== null && loaded.length > 0) {
        return {
            ok: false,
            reason: `${arm}: settings scoped to ${setting_sources}, yet ${loaded.length} package skill(s) loaded (e.g. ${loaded.slice(0, 3).join(', ')})`,
        };
    }
    return { ok: true, reason: `${arm}: ${loaded.length} package skill(s), apiKeySource=${init.apiKeySource ?? 'n/a'}` };
}

// Plain JS on purpose: it runs under bare `node -e`, whatever loader the caller uses.
const SUPERVISOR = `
const { spawn } = require('node:child_process');
const [bin, argsJson, timeoutMs] = process.argv.slice(1);
const child = spawn(bin, JSON.parse(argsJson), { stdio: ['ignore', 'pipe', 'ignore'], env: process.env });
let buf = '';
let done = false;
const finish = (code, line) => {
    if (done) return;
    done = true;
    try { child.kill('SIGKILL'); } catch (e) {}
    if (line) process.stdout.write(line + '\\n');
    process.exit(code);
};
const timer = setTimeout(() => finish(4, null), Number(timeoutMs));
child.stdout.on('data', (d) => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        try {
            const ev = JSON.parse(line);
            if (ev && ev.type === 'system' && ev.subtype === 'init') { clearTimeout(timer); finish(0, line); return; }
        } catch (e) {}
    }
});
child.on('error', () => { clearTimeout(timer); finish(5, null); });
child.on('exit', () => { clearTimeout(timer); finish(3, null); });
`;

/**
 * Start `binary args` in `cwd` with `env`, return the init event, kill the child.
 * `args` must already ask for `--output-format stream-json --verbose`.
 */
export function run_delivery_probe(
    binary: string,
    args: readonly string[],
    opts: { cwd: string; env: Record<string, string>; timeout_ms?: number },
): ProbeResult {
    const timeout_ms = opts.timeout_ms ?? 30_000;
    const r = spawnSync(process.execPath, ['-e', SUPERVISOR, binary, JSON.stringify(args), String(timeout_ms)], {
        cwd: opts.cwd,
        env: opts.env,
        encoding: 'utf-8',
        timeout: timeout_ms + 5_000,
    });
    const init = parse_init_event(r.stdout ?? '');
    if (init !== null) return { ok: true, init, reason: 'init read; child killed' };
    const why =
        r.status === 4
            ? `no system/init within ${timeout_ms} ms`
            : r.status === 5
              ? `could not start ${binary}`
              : `host exited before system/init (status ${String(r.status)})`;
    return { ok: false, init: null, reason: why };
}
