// Tests for the artifact corpus of bench:ab:v2 (road-to-a-baseline-that-has-to-catch-up
// steps 2.1-2.3, 3.1-3.2, 4.1-4.2). No host is ever started and no model is called:
// the parity loop runs against a fake host, PHP graders run against node stand-ins.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
    LADDER_NAMES,
    load_artifact_corpus,
    parse_artifact_corpus,
    select_corpus,
    validate_artifact_task,
    type ArtifactTask,
} from '../../src/scripts/_lib/bench_artifact_corpus.js';
import { fold, grade_primary } from '../../src/scripts/_lib/bench_artifact_graders.js';
import { BLACKHOLE_PROXY, dispose, isolate_arm, type ArmIsolation } from '../../src/scripts/_lib/bench_artifact_isolation.js';
import { parity_loop, PARITY_CAP_K, type ArtifactHost } from '../../src/scripts/_lib/bench_artifact_parity.js';
import { login_checks, run_scenario, SEC_CHECKS, type LoginContract, type Scenario } from '../../src/scripts/_lib/bench_artifact_php.js';
import { selftest_task } from '../../src/scripts/_lib/bench_artifact_selftest.js';
import { svg_render_gate } from '../../src/scripts/_lib/bench_artifact_svg_gate.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const CORPUS = path.join(REPO, 'internal', 'bench', 'corpora', 'ab-artifact-v2.yaml');
const AB = path.join(REPO, 'internal', 'bench', 'ab');
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');
const IDS = [
    'art-svg-prompt-01',
    'art-svg-raster-01',
    'art-landing-01',
    'art-form-01',
    'art-login-framework-01',
    'art-login-plain-01',
    'art-php-endpoint-01',
    'art-page-copy-01',
    'art-app-copy-01',
];

const tasks = load_artifact_corpus(CORPUS);
const task = (id: string): ArtifactTask => tasks.find((t) => t.id === id) as ArtifactTask;
const cleanup: (() => void)[] = [];
afterEach(() => {
    while (cleanup.length) cleanup.pop()?.();
});

describe('2.1 kind: artifact — loader', () => {
    const base = (): Record<string, unknown> => JSON.parse(JSON.stringify(task('art-svg-prompt-01'))) as Record<string, unknown>;

    it('parses the corpus: nine artifact tasks, each with a deliverable, one primary grader and a network mode', () => {
        expect(tasks.map((t) => t.id)).toEqual(IDS);
        for (const t of tasks) {
            expect(t.kind).toBe('artifact');
            expect(t.graders.filter((g) => g.role === 'primary')).toHaveLength(1);
            expect(['none', 'registry']).toContain(t.network);
            expect(fs.existsSync(path.join(AB, t.fixture))).toBe(true);
        }
    });

    it('rejects a task without parity_bar', () => {
        const t = base();
        delete t['parity_bar'];
        expect(validate_artifact_task(t)).toContain('art-svg-prompt-01: parity_bar must be a number in (0, 1]');
        expect(() => parse_artifact_corpus(JSON.stringify({ tasks: [t] }))).toThrow(/parity_bar/);
    });

    it('rejects a missing ladder, a short ladder and an unknown ladder', () => {
        const missing = base();
        delete (missing['feedback_ladder'] as Record<string, unknown>)['informed'];
        expect(validate_artifact_task(missing).join()).toMatch(/feedback_ladder\.informed missing/);
        const short = base();
        (short['feedback_ladder'] as Record<string, unknown>)['naive'] = ['one', 'two'];
        expect(validate_artifact_task(short).join()).toMatch(/naive has 2 steps, needs 3-5/);
        const extra = base();
        (extra['feedback_ladder'] as Record<string, unknown>)['expert'] = ['a', 'b', 'c'];
        expect(validate_artifact_task(extra).join()).toMatch(/unknown ladder/);
        const none = base();
        delete none['feedback_ladder'];
        expect(validate_artifact_task(none).join()).toMatch(/feedback_ladder missing/);
    });

    it('rejects a bad network mode and two primary graders', () => {
        const t = base();
        t['network'] = 'internet';
        (t['graders'] as unknown[]).push({ id: 'x', role: 'primary' });
        const errs = validate_artifact_task(t).join('\n');
        expect(errs).toMatch(/network must be none\|registry/);
        expect(errs).toMatch(/exactly one primary grader required, got 2/);
    });

    it('selects the corpus by alias and leaves the default on the discipline corpus', () => {
        const [rest, sel] = select_corpus(['--mode', 'dry-run', '--corpus', 'artifact'], REPO);
        expect(rest).toEqual(['--mode', 'dry-run']);
        expect(sel).toMatchObject({ name: 'ab-artifact-v2', kind: 'artifact' });
        expect(select_corpus([], REPO)[1]).toMatchObject({ name: 'ab-trackb-v2', kind: 'discipline' });
        expect(select_corpus(['--corpus=trackb'], REPO)[1].kind).toBe('discipline');
    });
});

describe('2.2 seed tasks — dry run', () => {
    it('lists all nine tasks for both arms', () => {
        const r = spawnSync(TSX, ['src/scripts/bench_ab_v2_run.ts', '--corpus', 'artifact', '--arms', 'vanilla,package', '--mode', 'dry-run', '--seeds', '1'], {
            cwd: REPO,
            encoding: 'utf-8',
        });
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('9 tasks × 2 arms');
        for (const id of IDS) {
            for (const arm of ['vanilla', 'package']) expect(r.stdout).toMatch(new RegExp(`${id}\\s+arm=${arm}\\s`));
        }
    });

    it('keeps the discipline corpus dry run unchanged (no listing lines)', () => {
        const r = spawnSync(TSX, ['src/scripts/bench_ab_v2_run.ts', '--mode', 'dry-run', '--limit', '1'], { cwd: REPO, encoding: 'utf-8' });
        expect(r.status).toBe(0);
        expect(r.stdout.trim().split('\n')).toHaveLength(1);
    });

    it('ships only original fixtures: the mascot is a PNG drawn in-repo, every brief exists', () => {
        const png = fs.readFileSync(path.join(AB, 'fixtures-artifact', 'art-svg-raster-01', 'mascot.png'));
        expect(png.subarray(1, 4).toString()).toBe('PNG');
        for (const t of tasks) expect(fs.existsSync(path.join(AB, t.fixture, 'BRIEF.md'))).toBe(true);
    });

    it('keeps held-back tests out of every fixture', () => {
        for (const t of tasks) {
            const ref = t.graders.find((g) => g.role === 'primary')?.args ?? {};
            for (const v of [ref['spec'], ref['scenario']].filter(Boolean)) {
                expect(String(v).startsWith('hidden-artifact/')).toBe(true);
                expect(fs.existsSync(path.join(AB, String(v)))).toBe(true);
            }
        }
    });
});

describe('2.3 isolation contract', () => {
    const iso = (arm: string, network: 'none' | 'registry' = 'none'): ArmIsolation => {
        const i = isolate_arm(arm, 'art-svg-prompt-01', network, { repo_root: REPO });
        cleanup.push(() => dispose(i));
        return i;
    };

    it('gives each arm its own HOME, config dir and workspace, all outside the repo', () => {
        const a = iso('vanilla');
        const b = iso('package');
        for (const k of ['home', 'config_dir', 'workspace'] as const) {
            expect(a[k]).not.toBe(b[k]);
            for (const x of [a, b]) {
                const rel = path.relative(fs.realpathSync(REPO), fs.realpathSync(x[k]));
                expect(rel.startsWith('..') || path.isAbsolute(rel)).toBe(true);
            }
        }
        expect(a.env['HOME']).toBe(a.home);
        expect(a.env['CLAUDE_CONFIG_DIR']).toBe(a.config_dir);
    });

    it('blackholes the network by default and lifts only the registry layer for network: registry', () => {
        const none = iso('vanilla');
        expect(none.env['HTTPS_PROXY']).toBe(BLACKHOLE_PROXY);
        expect(none.env['npm_config_offline']).toBe('true');
        expect(none.host_flags.join(' ')).toMatch(/WebFetch/);
        const reg = iso('vanilla', 'registry');
        expect(reg.env['HTTPS_PROXY']).toBeUndefined();
        expect(reg.env['npm_config_offline']).toBe('false');
        expect(reg.host_flags.join(' ')).toMatch(/WebFetch/);
    });

    it('refuses a temp root inside the repository', () => {
        const inside = fs.mkdtempSync(path.join(REPO, 'internal', 'bench', '.iso-probe-'));
        cleanup.push(() => fs.rmSync(inside, { recursive: true, force: true }));
        expect(() => isolate_arm('vanilla', 't', 'none', { repo_root: REPO, tmp_root: inside })).toThrow(/inside the repository/);
    });
});

describe('3.1 primary graders', () => {
    const ref = (id: string, which: 'good' | 'bad', file: string): string => fs.readFileSync(path.join(AB, 'oracle-artifact', id, which, file), 'utf-8');

    it('SVG render gate passes the planted good logo and names each defect of the bad one', () => {
        const good = svg_render_gate(ref('art-svg-prompt-01', 'good', 'out/logo.svg'));
        expect(good.every((c) => c.status === 'pass')).toBe(true);
        const bad = Object.fromEntries(svg_render_gate(ref('art-svg-prompt-01', 'bad', 'out/logo.svg')).map((c) => [c.id, c.status]));
        expect(bad).toMatchObject({ 'no-raster-script-foreign': 'fail', 'no-event-handlers': 'fail', 'no-external-refs': 'fail', 'in-canvas': 'fail' });
    });

    it('SVG render gate rejects malformed, blank and foreignObject SVGs and checks the palette', () => {
        expect(svg_render_gate('<svg viewBox="0 0 10 10"><rect></svg>')[0]).toMatchObject({ id: 'parses', status: 'fail' });
        const blank = svg_render_gate('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="5" height="5" fill="none"/></svg>');
        expect(blank.find((c) => c.id === 'not-blank')?.status).toBe('fail');
        const fo = svg_render_gate('<svg viewBox="0 0 10 10"><foreignObject width="5" height="5"></foreignObject><rect width="5" height="5"/></svg>');
        expect(fo.find((c) => c.id === 'no-raster-script-foreign')?.status).toBe('fail');
        const pal = svg_render_gate(ref('art-svg-raster-01', 'good', 'out/mascot.svg'), { palette: ['#f2a93b', '#000001'], palette_min: 2 });
        expect(pal.find((c) => c.id === 'palette')?.status).toBe('fail');
    });

    it('DOM acceptance runs the held-back tests and reports axe as unknown without axe-core', async () => {
        const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-art-test-'));
        cleanup.push(() => fs.rmSync(ws, { recursive: true, force: true }));
        fs.cpSync(path.join(AB, 'oracle-artifact', 'art-form-01', 'good'), ws, { recursive: true });
        const r = await grade_primary(ws, task('art-form-01'));
        expect(r.status).toBe('pass');
        expect(r.columns['axe']).toMatch(/^unknown\(/);
        fs.rmSync(path.join(ws, 'out', 'index.html'));
        expect((await grade_primary(ws, task('art-form-01'))).status).toBe('fail');
    });

    it('PHP graders report unknown — never pass — when php is absent', async () => {
        for (const id of ['art-login-plain-01', 'art-login-framework-01', 'art-php-endpoint-01']) {
            const r = await grade_primary(path.join(AB, task(id).fixture), task(id), { php: null });
            expect(r.status).toBe('unknown');
            expect(r.score).toBeNull();
            if (id.startsWith('art-login')) expect(r.columns['sec_pass']).toMatch(/^unknown\(/);
        }
    });

    it('bench:ui delegation is unknown without a browser and refuses an embedded original', async () => {
        const t = task('art-page-copy-01');
        const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-art-test-'));
        cleanup.push(() => fs.rmSync(ws, { recursive: true, force: true }));
        fs.cpSync(path.join(AB, 'oracle-artifact', t.id, 'good'), ws, { recursive: true });
        expect((await grade_primary(ws, t, { browser: false })).status).toBe('unknown');
        fs.writeFileSync(path.join(ws, 'out', 'index.html'), '<iframe src="../page/index.html"></iframe>');
        expect((await grade_primary(ws, t, { browser: false })).status).toBe('fail');
    });

    it('fold never turns an unknown check into a pass', () => {
        expect(fold('g', 'primary', [{ id: 'a', status: 'pass' }, { id: 'b', status: 'unknown' }])).toMatchObject({ status: 'unknown', score: null });
        expect(fold('g', 'primary', [])).toMatchObject({ status: 'unknown', score: null });
        expect(fold('g', 'primary', [{ id: 'a', status: 'fail' }, { id: 'b', status: 'unknown' }]).status).toBe('fail');
    });
});

// ── node stand-ins for the PHP graders' logic (php is not on every machine) ──

type Handler = (req: http.IncomingMessage, body: string, res: http.ServerResponse) => void;
async function serve(handler: Handler): Promise<{ base: string; root: string; stop: () => void }> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-standin-'));
    const srv = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c: Buffer) => (body += c.toString()));
        req.on('end', () => handler(req, body, res));
    });
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()));
    const port = (srv.address() as { port: number }).port;
    return { base: `http://127.0.0.1:${port}`, root, stop: () => { srv.close(); fs.rmSync(root, { recursive: true, force: true }); } };
}

function login_app(secure: boolean): () => Promise<{ base: string; root: string; stop: () => void }> {
    return async () => {
        const sessions = new Map<string, Record<string, string>>();
        const fails = new Map<string, number>();
        let n = 0;
        const srv = await serve((req, body, res) => {
            const sid = /PHPSESSID=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
            let s = sid ? sessions.get(sid) : undefined;
            let id = sid;
            if (!s) {
                id = `s${(n += 1)}`;
                s = { _token: `t${n}` };
                sessions.set(id, s);
                res.setHeader('set-cookie', `PHPSESSID=${id}; path=/`);
            }
            const form = (msg = ''): string => `${msg}<form><input type="hidden" name="_token" value="${s?._token}"></form>`;
            if (req.url === '/login' && req.method === 'GET') return void res.end(form());
            if (req.url === '/login' && req.method === 'POST') {
                const p = new URLSearchParams(body);
                const email = p.get('email') ?? '';
                if (secure && p.get('_token') !== s._token) return void res.writeHead(419).end(form('expired'));
                if (secure && (fails.get(email) ?? 0) >= 5) return void res.writeHead(429).end(form('slow down'));
                const known = email === 'demo@example.test';
                if (known && p.get('password') === 'changeme-bench') {
                    const user = { _token: 'fresh', user: email };
                    if (secure) {
                        const fresh = `s${(n += 1)}`;
                        sessions.set(fresh, user);
                        res.setHeader('set-cookie', `PHPSESSID=${fresh}; path=/`);
                    } else sessions.set(id as string, user);
                    fs.writeFileSync(path.join(srv.root, 'data-users.json'), secure ? '{"demo@example.test":"$hash"}' : '{"demo@example.test":"changeme-bench"}');
                    return void res.writeHead(302, { location: '/account' }).end();
                }
                fails.set(email, (fails.get(email) ?? 0) + 1);
                return void res.writeHead(secure ? 401 : known ? 401 : 404).end(form(secure ? 'Invalid credentials.' : known ? 'Wrong password' : 'No such user'));
            }
            if (req.url === '/account') return s.user ? void res.end(`Signed in as ${s.user}`) : void res.writeHead(302, { location: '/login' }).end();
            res.writeHead(404).end();
        });
        fs.mkdirSync(path.join(srv.root, 'data'));
        if (secure) fs.writeFileSync(path.join(srv.root, 'app.php'), '<?php password_hash($p, PASSWORD_DEFAULT); password_verify($p, $h);');
        return srv;
    };
}

describe('3.1 PHP grader logic against node stand-ins', () => {
    const k: LoginContract = { docroot: 'public', email: 'demo@example.test', password: 'changeme-bench', store_glob: ['data-users'], session_cookie: 'PHPSESSID' };

    it('a hardened login passes every check and sec_pass holds', async () => {
        const checks = await login_checks(k, login_app(true));
        expect(checks.filter((c) => c.status !== 'pass')).toEqual([]);
    });

    it('a naive login works functionally but fails every exploit check', async () => {
        const by = Object.fromEntries((await login_checks(k, login_app(false))).map((c) => [c.id, c.status]));
        expect(by['login-works']).toBe('pass');
        for (const id of SEC_CHECKS) expect(by[id]).toBe('fail');
    });

    function items_app(scoped: boolean): () => Promise<{ base: string; root: string; stop: () => void }> {
        return async () => {
            const items = new Map<number, { id: number; title: string; done: boolean; owner: string }>();
            let next = 1;
            return serve((req, body, res) => {
                const json = (status: number, b?: unknown): void => void res.writeHead(status, { 'content-type': 'application/json' }).end(b === undefined ? '' : JSON.stringify(b));
                const who = { 'Bearer sample-token-alice': 'alice', 'Bearer sample-token-bob': 'bob' }[req.headers.authorization ?? ''];
                if (!who) return json(401, { error: 'unauthenticated' });
                const input = (body ? JSON.parse(body) : {}) as Record<string, unknown>;
                const bad = (partial: boolean): boolean =>
                    ((!partial || 'title' in input) && (typeof input['title'] !== 'string' || input['title'] === '' || (input['title'] as string).length > 120)) ||
                    ('done' in input && typeof input['done'] !== 'boolean');
                const m = /^\/items(?:\/(\d+))?$/.exec(req.url ?? '');
                if (!m) return json(404);
                if (!m[1] && req.method === 'GET') return json(200, [...items.values()].filter((i) => !scoped || i.owner === who));
                if (!m[1] && req.method === 'POST') {
                    if (bad(false)) return json(422, { errors: {} });
                    const it = { id: next, title: input['title'] as string, done: (input['done'] as boolean) ?? false, owner: who };
                    items.set((next += 1) - 1, it);
                    return json(201, it);
                }
                const it = items.get(Number(m[1]));
                if (!it || (scoped && it.owner !== who)) return json(404);
                if (req.method === 'GET') return json(200, it);
                if (req.method === 'PATCH') return bad(true) ? json(422, { errors: {} }) : json(200, Object.assign(it, input));
                items.delete(it.id);
                return json(204);
            });
        };
    }

    it('the hidden T5 scenario passes a scoped API and catches cross-user access', async () => {
        const sc = JSON.parse(fs.readFileSync(path.join(AB, 'hidden-artifact', 'art-php-endpoint-01', 'scenario.json'), 'utf-8')) as Scenario;
        expect((await run_scenario(items_app(true), sc)).filter((c) => c.status !== 'pass')).toEqual([]);
        const leaky = Object.fromEntries((await run_scenario(items_app(false), sc)).map((c) => [c.id, c.status]));
        expect(leaky['no-cross-user-access']).toBe('fail');
        expect(leaky['create-and-list-own']).toBe('fail');
    });
});

describe('3.2 grader self-test', () => {
    it('every runnable grader separates its planted pair; toolchain-less ones are skipped, not passed', async () => {
        for (const t of tasks) {
            const row = await selftest_task(t, { php: null, browser: false });
            if (t.graders.some((g) => g.role === 'primary' && ['functional+exploits', 'hidden-tests', 'bench-ui'].includes(g.id))) {
                expect(row.verdict).toBe('skipped');
                expect(row.reason).toMatch(/php not installed|no playwright chromium/);
            } else {
                expect(row).toMatchObject({ task: t.id, verdict: 'separates' });
            }
        }
    }, 120_000);

    it('a swapped pair makes the self-test CLI exit non-zero', () => {
        const ok = spawnSync(TSX, ['src/scripts/bench_artifact_selftest.ts', '--task', 'art-svg-prompt-01'], { cwd: REPO, encoding: 'utf-8' });
        expect(ok.status).toBe(0);
        const swapped = spawnSync(TSX, ['src/scripts/bench_artifact_selftest.ts', '--task', 'art-svg-prompt-01', '--swap'], { cwd: REPO, encoding: 'utf-8' });
        expect(swapped.status).toBe(1);
        expect(swapped.stdout).toMatch(/FAILS/);
    });

    it('a missing planted reference fails rather than skips', async () => {
        const row = await selftest_task(task('art-svg-prompt-01'), { oracle_root: fs.mkdtempSync(path.join(os.tmpdir(), 'no-oracle-')) });
        expect(row.verdict).toBe('fails');
    });
});

describe('4.1 ladders', () => {
    it('every task carries both ladders with 3-5 steps', () => {
        for (const t of tasks) {
            for (const l of LADDER_NAMES) {
                expect(t.feedback_ladder[l].length).toBeGreaterThanOrEqual(3);
                expect(t.feedback_ladder[l].length).toBeLessThanOrEqual(5);
            }
        }
    });
});

describe('4.2 parity loop', () => {
    const t5 = (): ArtifactTask => ({ ...task('art-app-copy-01'), parity_bar: 1 });
    const fake = (improves_at: number | null): { host: ArtifactHost; prompts: string[]; grade: () => Promise<ReturnType<typeof fold>> } => {
        const prompts: string[] = [];
        let state = 0;
        return {
            prompts,
            host: {
                start: async (p) => (prompts.push(p), { session_id: 'sess-1', errored: false, tokens: 100, turns: 2 }),
                resume: async (id, p) => {
                    expect(id).toBe('sess-1');
                    prompts.push(p);
                    state += 1;
                    return { session_id: 'sess-1', errored: false, tokens: 50, turns: 1 };
                },
            },
            grade: async () =>
                fold('acceptance+axe', 'primary', [
                    { id: 'a', status: 'pass' },
                    { id: 'b', status: improves_at !== null && state >= improves_at ? 'pass' : 'fail' },
                ]),
        };
    };

    it('reaches parity on ladder step 3 in the same session', async () => {
        const f = fake(3);
        const run = await parity_loop({ task: t5(), arm: 'vanilla', ladder: 'informed', host: f.host, grade: f.grade });
        expect(run).toMatchObject({ outcome: 'reached', prompts_to_parity: 4, first_shot_score: 0.5, tokens_total: 250, turns_total: 5 });
        expect(f.prompts.slice(1)).toEqual(t5().feedback_ladder.informed.slice(0, 3));
    });

    it('records a censored run at K, never an imputed step count', async () => {
        const f = fake(null);
        const run = await parity_loop({ task: t5(), arm: 'package', ladder: 'informed', host: f.host, grade: f.grade });
        expect(t5().feedback_ladder.informed).toHaveLength(PARITY_CAP_K);
        expect(run).toMatchObject({ outcome: 'censored', prompts_to_parity: null, reason: `not reached by K=${PARITY_CAP_K}` });
        expect(run.steps).toHaveLength(PARITY_CAP_K + 1);
    });

    it('stops as indeterminate when the grader cannot score, and as errored without a session', async () => {
        const f = fake(null);
        const unknown = await parity_loop({ task: t5(), arm: 'vanilla', ladder: 'naive', host: f.host, grade: async () => fold('g', 'primary', [{ id: 'x', status: 'unknown' }]) });
        expect(unknown.outcome).toBe('indeterminate');
        const noSession: ArtifactHost = { start: async () => ({ session_id: null, errored: false, tokens: null, turns: null }), resume: async () => ({ session_id: null, errored: false, tokens: null, turns: null }) };
        const errored = await parity_loop({ task: t5(), arm: 'vanilla', ladder: 'naive', host: noSession, grade: f.grade });
        expect(errored).toMatchObject({ outcome: 'errored', tokens_total: null });
    });
});
