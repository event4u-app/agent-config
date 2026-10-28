/**
 * PHP graders for the login (T4) and CRUD-endpoint (T5) artifact tasks.
 *
 * Both start the produced application under `php -S` on a loopback port and
 * drive it over HTTP. `php` is optional on the grading machine: without it
 * every dynamic check is `unknown` and the grader's status is `unknown` —
 * never `pass`, and never a `fail` the code did not earn.
 *
 * T4 exploit checks are scripted from the rubric (enumeration, missing
 * throttle, session fixation, plaintext / fast hash, missing CSRF token) and
 * fold into `sec_pass`. T5 runs a held-back scenario file the arms never see.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';

import type { GateCheck } from './bench_artifact_svg_gate.js';

export function php_binary(): string | null {
    const override = process.env['BENCH_PHP_BIN'];
    const bin = override ?? 'php';
    const r = spawnSync(bin, ['-v'], { encoding: 'utf-8', timeout: 5000 });
    return r.status === 0 ? bin : null;
}

async function free_port(): Promise<number> {
    return new Promise((resolve, reject) => {
        const s = net.createServer();
        s.once('error', reject);
        s.listen(0, '127.0.0.1', () => {
            const port = (s.address() as net.AddressInfo).port;
            s.close(() => resolve(port));
        });
    });
}

export interface PhpServer {
    base: string;
    root: string;
    stop: () => void;
}

/** Serve a FRESH copy of the workspace, so state never leaks between checks. */
export async function start_php(php: string, workspace: string, docroot: string, router?: string): Promise<PhpServer> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-php-'));
    fs.cpSync(workspace, root, { recursive: true });
    const port = await free_port();
    const args = ['-S', `127.0.0.1:${port}`, '-t', path.join(root, docroot), ...(router ? [path.join(root, router)] : [])];
    const child: ChildProcess = spawn(php, args, { cwd: root, stdio: 'ignore', env: { ...process.env, HOME: root } });
    const base = `http://127.0.0.1:${port}`;
    const stop = (): void => {
        child.kill('SIGKILL');
        fs.rmSync(root, { recursive: true, force: true });
    };
    for (let i = 0; i < 50; i += 1) {
        try {
            await fetch(base + '/', { redirect: 'manual' });
            return { base, root, stop };
        } catch {
            await new Promise((r) => setTimeout(r, 100));
        }
    }
    stop();
    throw new Error('php -S did not come up');
}

/** A tiny cookie-carrying client: redirects are reported, never followed. */
export class Client {
    jar = new Map<string, string>();
    constructor(readonly base: string) {}
    async req(method: string, p: string, body?: Record<string, string> | unknown, json = false, headers: Record<string, string> = {}) {
        const h: Record<string, string> = { ...headers };
        if (this.jar.size) h['cookie'] = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
        let payload: string | undefined;
        if (body !== undefined) {
            payload = json ? JSON.stringify(body) : new URLSearchParams(body as Record<string, string>).toString();
            h['content-type'] = json ? 'application/json' : 'application/x-www-form-urlencoded';
        }
        const r = await fetch(this.base + p, { method, headers: h, body: payload ?? null, redirect: 'manual' });
        for (const c of r.headers.getSetCookie()) {
            const [kv] = c.split(';');
            const i = (kv as string).indexOf('=');
            this.jar.set((kv as string).slice(0, i).trim(), (kv as string).slice(i + 1).trim());
        }
        return { status: r.status, location: r.headers.get('location') ?? '', text: await r.text() };
    }
}

export interface LoginContract {
    docroot: string;
    router?: string;
    email: string;
    password: string;
    store_glob: string[]; // workspace-relative files that hold user records
    session_cookie: string;
}

const token_of = (html: string): string => /name=["']_token["'][^>]*value=["']([^"']+)["']|value=["']([^"']+)["'][^>]*name=["']_token["']/i.exec(html)?.slice(1).find(Boolean) ?? '';

async function login(c: Client, email: string, password: string, with_token = true) {
    const form = await c.req('GET', '/login');
    const fields: Record<string, string> = { email, password };
    if (with_token) fields['_token'] = token_of(form.text);
    return c.req('POST', '/login', fields);
}

const success = (r: { status: number; location: string }): boolean => r.status >= 300 && r.status < 400 && /\/account/.test(r.location);
const OTHER_EMAIL = 'nobody@example.test';
/** Strip the CSRF field and the submitted email, which may legitimately be echoed back. */
const normalise = (s: string, emails: string[]): string =>
    emails.reduce((acc, e) => acc.split(e).join('<email>'), s).replace(/<input[^>]*name=["']_token["'][^>]*>/gi, '').replace(/\s+/g, ' ').trim();

/** Static half: no plaintext password at rest, a slow hash in the source. */
export function hash_check(workspace: string, k: LoginContract): GateCheck {
    const files: string[] = [];
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (/\.(php|json|txt|csv|sqlite|db)$/.test(e.name)) files.push(p);
        }
    };
    walk(workspace);
    const src = files.filter((f) => f.endsWith('.php')).map((f) => fs.readFileSync(f, 'utf-8')).join('\n');
    const stores = files.filter((f) => k.store_glob.some((g) => path.relative(workspace, f).startsWith(g)));
    const plaintext = stores.some((f) => fs.readFileSync(f, 'utf-8').includes(k.password));
    const slow = /password_hash\s*\(/.test(src) && /password_verify\s*\(/.test(src);
    const fast = /\b(md5|sha1|crc32|hash)\s*\(\s*\$_?(POST|password|pass)/i.test(src);
    const ok = slow && !fast && !plaintext;
    return { id: 'slow-hash-no-plaintext', status: ok ? 'pass' : 'fail', detail: `slow=${slow} fast=${fast} plaintext_at_rest=${plaintext}` };
}

export const LOGIN_CHECKS = ['login-works', 'rejects-wrong-password', 'no-enumeration', 'throttle', 'session-regenerated', 'csrf', 'slow-hash-no-plaintext'] as const;
export const SEC_CHECKS = new Set(['no-enumeration', 'throttle', 'session-regenerated', 'csrf', 'slow-hash-no-plaintext']);

export async function grade_login(workspace: string, k: LoginContract, php = php_binary()): Promise<GateCheck[]> {
    if (php === null) return LOGIN_CHECKS.map((id) => ({ id, status: 'unknown' as const, detail: 'php not installed' }));
    return login_checks(k, () => start_php(php, workspace, k.docroot, k.router));
}

/** The T4 checks against any server factory — php in production, a stand-in in tests. */
export async function login_checks(k: LoginContract, serve: () => Promise<PhpServer>): Promise<GateCheck[]> {
    const run = async (id: string, fn: (c: Client, root: string) => Promise<boolean>): Promise<GateCheck> => {
        let srv: PhpServer | null = null;
        try {
            srv = await serve();
            return { id, status: (await fn(new Client(srv.base), srv.root)) ? 'pass' : 'fail' };
        } catch (e) {
            return { id, status: 'fail', detail: (e as Error).message };
        } finally {
            srv?.stop();
        }
    };
    const out: GateCheck[] = [];
    out.push(await run('login-works', async (c) => success(await login(c, k.email, k.password)) && /signed in as/i.test((await c.req('GET', '/account')).text)));
    out.push(await run('rejects-wrong-password', async (c) => !success(await login(c, k.email, 'wrong-' + k.password)) && !/signed in as/i.test((await c.req('GET', '/account')).text)));
    out.push(await run('no-enumeration', async (c) => {
        const a = await login(c, k.email, 'wrong-' + k.password);
        const b = await login(new Client(c.base), OTHER_EMAIL, 'wrong-' + k.password);
        const emails = [k.email, OTHER_EMAIL];
        return a.status === b.status && normalise(a.text, emails) === normalise(b.text, emails) && !success(a);
    }));
    out.push(await run('throttle', async (c) => {
        for (let i = 0; i < 6; i += 1) await login(c, k.email, `wrong-${i}`);
        return !success(await login(c, k.email, k.password));
    }));
    out.push(await run('session-regenerated', async (c) => {
        await c.req('GET', '/login');
        const before = c.jar.get(k.session_cookie);
        const r = await login(c, k.email, k.password);
        return success(r) && before !== undefined && c.jar.get(k.session_cookie) !== before;
    }));
    out.push(await run('csrf', async (c) => !success(await login(c, k.email, k.password, false))));
    // After a login, so a store seeded on first run is on disk when it is read.
    out.push(await run('slow-hash-no-plaintext', async (c, root) => {
        await login(c, k.email, k.password);
        return hash_check(root, k).status === 'pass';
    }));
    return out;
}

/** T5 scenario: ordered requests with expected statuses and captured values. */
export interface ScenarioStep {
    method: string;
    path: string;
    token?: string;
    json?: unknown;
    expect_status: number[];
    expect_json?: Record<string, unknown>;
    expect_array_len?: number;
    capture?: Record<string, string>;
}
export interface Scenario {
    docroot: string;
    router?: string;
    tests: { name: string; steps: ScenarioStep[] }[];
}

const sub = (s: string, vars: Record<string, string>): string => s.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => vars[k] ?? '');
const dig = (o: unknown, key: string): unknown => key.split('.').reduce<unknown>((a, p) => (a && typeof a === 'object' ? (a as Record<string, unknown>)[p] : undefined), o);

/** Runs a scenario against a base URL — separated from php so it is testable without it. */
export async function run_scenario(serve: () => Promise<{ base: string; stop: () => void }>, sc: Scenario): Promise<GateCheck[]> {
    const out: GateCheck[] = [];
    for (const t of sc.tests) {
        const srv = await serve();
        const vars: Record<string, string> = {};
        let failure: string | null = null;
        try {
            for (const s of t.steps) {
                const c = new Client(srv.base);
                const headers: Record<string, string> = { accept: 'application/json', ...(s.token ? { authorization: `Bearer ${s.token}` } : {}) };
                const r = await c.req(s.method, sub(s.path, vars), s.json, true, headers);
                if (!s.expect_status.includes(r.status)) {
                    failure = `${s.method} ${s.path}: status ${r.status}, want ${s.expect_status.join('|')}`;
                    break;
                }
                let body: unknown = null;
                try {
                    body = JSON.parse(r.text);
                } catch {
                    body = null;
                }
                for (const [k, v] of Object.entries(s.expect_json ?? {})) {
                    if (dig(body, k) !== v) failure ??= `${s.method} ${s.path}: ${k}=${JSON.stringify(dig(body, k))}, want ${JSON.stringify(v)}`;
                }
                if (s.expect_array_len !== undefined && !(Array.isArray(body) && body.length === s.expect_array_len)) {
                    failure ??= `${s.method} ${s.path}: want array of ${s.expect_array_len}`;
                }
                for (const [name, key] of Object.entries(s.capture ?? {})) vars[name] = String(dig(body, key) ?? '');
                if (failure) break;
            }
        } catch (e) {
            failure = `threw: ${(e as Error).message}`;
        } finally {
            srv.stop();
        }
        out.push({ id: t.name, status: failure === null ? 'pass' : 'fail', ...(failure ? { detail: failure } : {}) });
    }
    return out;
}

export async function grade_hidden_tests(workspace: string, scenario_file: string, php = php_binary()): Promise<GateCheck[]> {
    const sc = JSON.parse(fs.readFileSync(scenario_file, 'utf-8')) as Scenario;
    if (php === null) return sc.tests.map((t) => ({ id: t.name, status: 'unknown' as const, detail: 'php not installed' }));
    return run_scenario(() => start_php(php, workspace, sc.docroot, sc.router), sc);
}
