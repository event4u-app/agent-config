// egress-content: fixed-corpus — the only body sent is the fixed "Reply with OK." probe, and only to a loopback base_url
/**
 * The production `SelfHostedProbe`: what a loopback route must show before it
 * may carry its declared ceiling. Both halves, or the answer stays unproven.
 *
 * 1. Local weights — the runtime names the file holding the model's weights
 *    (Ollama `POST /api/show` modelfile `FROM`, llama-server `GET /props`
 *    `model_path`, LM Studio `GET /api/v0/models` `path`), and that file exists
 *    here with a size weights could have. A cloud model, or a path absent from
 *    this machine, is `remote`; a runtime that names no path is `unknown`.
 * 2. No outbound during one call — the PIDs listening on the route's port are
 *    sampled with `lsof` while a one-line completion runs. Any ESTABLISHED
 *    connection to a non-loopback address is outbound. Without `lsof`, a
 *    listener, or a completed call, it is unmeasured (`null`).
 *
 * Limits a reader should not mistake for coverage: `outbound: false` is
 * evidence, not proof. Sampling cannot see a connection opened and closed
 * between two `lsof` rounds, and only the listening PIDs are watched — a child
 * process the server spawns is not.
 *
 * A route that carries a resolvable `api_key_ref` sends the key as a header
 * read from a file in a private temp directory, never on a command line.
 * Results are memoised only when definite, and only for
 * `SELF_HOSTED_PROBE_TTL_MS`, so a swapped proxy is re-probed.
 *
 * Kept out of `free_route.ts`, which sits in the hook bundle: only callers
 * outside the bundle pass this probe. Every command goes through the injected
 * runner and argument arrays; nothing here throws.
 */

import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { resolve_api_key } from './config.js';
import type { RouteSpec, SelfHostedProbe, SelfHostedProbeResult } from './free_route.js';

/** A route as the probe reads it; `api_key_ref` is optional and only read for the call. */
export type ProbeRoute = RouteSpec & { readonly api_key_ref?: string | null };

export interface ProbeRunResult {
    readonly status: number;
    readonly stdout: string;
}

export interface SelfHostedProbeDeps {
    /** `null` when the command could not be executed at all (missing binary, timeout). */
    run(cmd: string, args: readonly string[], timeoutMs: number): ProbeRunResult | null;
    /** Start a command without waiting; its PID, or `null`. */
    start(cmd: string, args: readonly string[]): number | null;
    fileSize(path: string): number | null;
    readText(path: string): string | null;
    writeText(path: string, text: string): void;
    /** Removes a file or a directory tree; never throws on absence. */
    remove(path: string): void;
    /** A freshly created, empty, owner-only directory. */
    tmpDir(): string;
    /** The key an `api_key_ref` names, or `null` when it does not resolve. */
    resolveKey(ref: string): string | null;
    readonly env: Readonly<Record<string, string | undefined>>;
    readonly home: string;
    now(): number;
    sleep(ms: number): void;
}

const UNPROVEN: SelfHostedProbeResult = { weights: 'unknown', outbound: null };
const MIN_WEIGHTS_BYTES = 50 * 1024 * 1024;
const QUERY_TIMEOUT_S = 5;
const CALL_TIMEOUT_S = 60;
/** How long a definite probe answer is reused before the route is probed again. */
export const SELF_HOSTED_PROBE_TTL_MS = 10 * 60 * 1000;

type Weights = SelfHostedProbeResult['weights'];

function _json(deps: SelfHostedProbeDeps, args: readonly string[]): Record<string, unknown> | null {
    const r = deps.run('curl', ['-s', '-f', '--max-time', String(QUERY_TIMEOUT_S), ...args], (QUERY_TIMEOUT_S + 1) * 1000);
    if (r === null || r.status !== 0 || r.stdout.trim() === '') return null;
    try {
        const v: unknown = JSON.parse(r.stdout);
        return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

function _isCloudModel(model: string): boolean {
    return /(?:^|[:\-])cloud$/i.test(model.trim());
}

function _weightsAt(deps: SelfHostedProbeDeps, file: string): Weights {
    const size = deps.fileSize(file);
    return size !== null && size > MIN_WEIGHTS_BYTES ? 'local' : 'remote';
}

function _expandHome(deps: SelfHostedProbeDeps, p: string): string {
    return p.startsWith('~/') ? path.join(deps.home, p.slice(2)) : p;
}

function _ollamaModelsDir(deps: SelfHostedProbeDeps): string {
    const override = (deps.env['OLLAMA_MODELS'] ?? '').trim();
    return override !== '' ? _expandHome(deps, override) : path.join(deps.home, '.ollama', 'models');
}

function _ollamaWeights(deps: SelfHostedProbeDeps, origin: string, model: string): Weights | null {
    const show = _json(deps, ['-X', 'POST', '-H', 'content-type: application/json', '-d', JSON.stringify({ model }), `${origin}/api/show`]);
    if (show === null) return null;
    if (show['remote_host'] !== undefined || show['remote_model'] !== undefined) return 'remote';
    const modelfile = typeof show['modelfile'] === 'string' ? show['modelfile'] : '';
    for (const line of modelfile.split('\n')) {
        const m = /^FROM\s+(\S+)/.exec(line.trim());
        if (m === null) continue;
        const ref = m[1] as string;
        const digest = /^sha256[:-]([0-9a-f]+)$/i.exec(ref);
        if (digest !== null) return _weightsAt(deps, path.join(_ollamaModelsDir(deps), 'blobs', `sha256-${digest[1]}`));
        if (ref.startsWith('/') || ref.startsWith('~/')) return _weightsAt(deps, _expandHome(deps, ref));
    }
    return 'unknown';
}

function _llamaServerWeights(deps: SelfHostedProbeDeps, origin: string): Weights | null {
    const props = _json(deps, [`${origin}/props`]);
    if (props === null) return null;
    const p = props['model_path'];
    return typeof p === 'string' && p !== '' ? _weightsAt(deps, _expandHome(deps, p)) : 'unknown';
}

function _lmStudioWeights(deps: SelfHostedProbeDeps, origin: string, model: string): Weights | null {
    const list = _json(deps, [`${origin}/api/v0/models`]);
    if (list === null) return null;
    const data = Array.isArray(list['data']) ? (list['data'] as Record<string, unknown>[]) : [];
    const entry = data.find((d) => d !== null && typeof d === 'object' && d['id'] === model);
    const p = entry?.['path'];
    if (typeof p !== 'string' || p === '') return 'unknown';
    if (p.startsWith('/') || p.startsWith('~/')) return _weightsAt(deps, _expandHome(deps, p));
    for (const dir of [path.join(deps.home, '.lmstudio', 'models'), path.join(deps.home, '.cache', 'lm-studio', 'models')]) {
        if (_weightsAt(deps, path.join(dir, p)) === 'local') return 'local';
    }
    return 'remote';
}

function _weights(deps: SelfHostedProbeDeps, origin: string, model: string): Weights {
    if (_isCloudModel(model)) return 'remote';
    return _ollamaWeights(deps, origin, model) ?? _llamaServerWeights(deps, origin) ?? _lmStudioWeights(deps, origin, model) ?? 'unknown';
}

function _isLoopbackHost(host: string): boolean {
    const h = host.replace(/^\[|\]$/g, '').toLowerCase();
    if (h === '::1' || h === 'localhost') return true;
    return /^(?:::ffff:)?127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

/** The remote host of each `local->remote` pair in `lsof` NAME output. */
function _remoteHosts(stdout: string): string[] {
    const hosts: string[] = [];
    for (const line of stdout.split('\n')) {
        const m = /->(\S+)/.exec(line);
        if (m === null) continue;
        const remote = m[1] as string;
        hosts.push(remote.startsWith('[') ? remote.slice(0, remote.indexOf(']') + 1) : remote.slice(0, remote.lastIndexOf(':')));
    }
    return hosts;
}

/** `true` on any non-loopback peer, `false` on none, `null` when lsof could not answer. */
function _sample(deps: SelfHostedProbeDeps, pids: string): boolean | null {
    const r = deps.run('lsof', ['-nP', '-a', '-p', pids, '-iTCP', '-sTCP:ESTABLISHED'], 5000);
    if (r === null || (r.status !== 0 && r.stdout.trim() !== '') || r.status > 1) return null;
    return _remoteHosts(r.stdout).some((h) => !_isLoopbackHost(h));
}

function _running(deps: SelfHostedProbeDeps, pid: number): boolean {
    const r = deps.run('ps', ['-o', 'stat=', '-p', String(pid)], 2000);
    if (r === null) return true;
    const stat = r.stdout.trim();
    return r.status === 0 && stat !== '' && !stat.startsWith('Z');
}

function _completed(text: string | null): boolean {
    if (text === null || text.trim() === '') return false;
    try {
        const v = JSON.parse(text) as Record<string, unknown> | null;
        return v !== null && Array.isArray(v['choices']) && v['choices'].length > 0;
    } catch {
        return false;
    }
}

function _authHeaderArgs(deps: SelfHostedProbeDeps, route: ProbeRoute, dir: string): string[] {
    const ref = route.api_key_ref;
    if (typeof ref !== 'string' || ref === '') return [];
    const key = deps.resolveKey(ref);
    if (key === null || key === '') return [];
    const file = path.join(dir, 'auth.header');
    deps.writeText(file, `Authorization: Bearer ${key}\n`);
    return ['-H', `@${file}`];
}

function _outbound(deps: SelfHostedProbeDeps, route: ProbeRoute, url: URL, model: string): boolean | null {
    const port = url.port !== '' ? url.port : url.protocol === 'https:' ? '443' : '80';
    const listen = deps.run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], 5000);
    if (listen === null) return null;
    const pids = [...new Set(listen.stdout.split('\n').map((s) => s.trim()).filter((s) => /^\d+$/.test(s)))];
    if (pids.length === 0) return null;
    const pidList = pids.join(',');
    let seen = _sample(deps, pidList);
    if (seen === null) return null;
    const dir = deps.tmpDir();
    try {
        const out = path.join(dir, 'out.json');
        const body = JSON.stringify({ model, max_tokens: 8, messages: [{ role: 'user', content: 'Reply with OK.' }] });
        const pid = deps.start('curl', [
            '-s', '--max-time', String(CALL_TIMEOUT_S), '-o', out,
            '-H', 'content-type: application/json', ..._authHeaderArgs(deps, route, dir),
            '-d', body, `${route.base_url}/chat/completions`,
        ]);
        if (pid === null) return null;
        const deadline = deps.now() + (CALL_TIMEOUT_S + 5) * 1000;
        while (_running(deps, pid)) {
            const s = _sample(deps, pidList);
            if (s === null) return null;
            seen = seen || s;
            if (deps.now() > deadline) {
                deps.run('kill', [String(pid)], 2000);
                return null;
            }
            deps.sleep(50);
        }
        const last = _sample(deps, pidList);
        if (last === null) return null;
        seen = seen || last;
        return _completed(deps.readText(out)) ? seen : null;
    } finally {
        deps.remove(dir);
    }
}

export function makeSelfHostedProbe(deps: SelfHostedProbeDeps): SelfHostedProbe {
    return (route, model) => {
        if (!route.loopback || model === '') return UNPROVEN;
        try {
            const url = new URL(route.base_url);
            const weights = _weights(deps, url.origin, model);
            if (weights !== 'local') return { weights, outbound: null };
            return { weights, outbound: _outbound(deps, route as ProbeRoute, url, model) };
        } catch {
            return UNPROVEN;
        }
    };
}

const _sleeper = new Int32Array(new SharedArrayBuffer(4));

export const NODE_PROBE_DEPS: SelfHostedProbeDeps = {
    run(cmd, args, timeoutMs) {
        const r = spawnSync(cmd, args, { encoding: 'utf-8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'ignore'] });
        if (r.error !== undefined || r.status === null) return null;
        return { status: r.status, stdout: r.stdout ?? '' };
    },
    start(cmd, args) {
        try {
            const child = spawn(cmd, args, { stdio: 'ignore' });
            child.on('error', () => undefined);
            child.unref();
            return child.pid ?? null;
        } catch {
            return null;
        }
    },
    fileSize(p) {
        try {
            const st = fs.statSync(p);
            return st.isFile() ? st.size : null;
        } catch {
            return null;
        }
    },
    readText(p) {
        try {
            return fs.readFileSync(p, 'utf-8');
        } catch {
            return null;
        }
    },
    writeText(p, text) {
        fs.writeFileSync(p, text, { encoding: 'utf-8', mode: 0o600, flag: 'wx' });
    },
    remove(p) {
        fs.rmSync(p, { force: true, recursive: true });
    },
    tmpDir: () => fs.mkdtempSync(path.join(os.tmpdir(), 'self-hosted-probe-')),
    resolveKey(ref) {
        try {
            return resolve_api_key(ref);
        } catch {
            return null;
        }
    },
    env: process.env,
    home: os.homedir(),
    now: () => Date.now(),
    sleep: (ms) => {
        Atomics.wait(_sleeper, 0, 0, ms);
    },
};

/** A definite answer: remote weights, or local weights with outbound measured. */
function _definite(r: SelfHostedProbeResult): boolean {
    return r.weights === 'remote' || (r.weights === 'local' && r.outbound !== null);
}

/** Memoise definite answers per route and model for `ttlMs`; anything unmeasured is probed again. */
export function makeMemoisedProbe(probe: SelfHostedProbe, now: () => number, ttlMs = SELF_HOSTED_PROBE_TTL_MS): SelfHostedProbe {
    const memo = new Map<string, { readonly result: SelfHostedProbeResult; readonly until: number }>();
    return (route, model) => {
        const key = `${route.base_url}\0${model}`;
        const hit = memo.get(key);
        if (hit !== undefined && now() < hit.until) return hit.result;
        memo.delete(key);
        const result = probe(route, model);
        if (_definite(result)) memo.set(key, { result, until: now() + ttlMs });
        return result;
    };
}

/** The production probe. */
export const SELF_HOSTED_PROBE: SelfHostedProbe = makeMemoisedProbe(makeSelfHostedProbe(NODE_PROBE_DEPS), () => Date.now());
