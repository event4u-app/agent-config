// free-hands 6.2 harness (internal/bench/free-hands-shadow): the deterministic
// verifier, the paced and capped window over the production askHand path, the
// AC-3 demo and the refusal to run a paid arm that could bill an API — all
// against loopback stubs in a child process (the route client posts through a
// synchronous curl, so an in-process server could never answer it).
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { curlJsonPost } from '../../src/scripts/ai_council/api_transport.js';
import { CouncilResponse, type ExternalAIClient } from '../../src/scripts/ai_council/clients.js';
import { load_council_config } from '../../src/scripts/ai_council/config.js';
import { CouncilEgress } from '../../src/scripts/ai_council/council_egress.js';
import { readShadowLedger } from '../../src/scripts/ai_council/free_hand_shadow.js';
import { resolveRouteTransport } from '../../src/scripts/ai_council/free_route.js';
import { build_members } from '../../src/scripts/council_cli.js';
import {
    buildCorpus,
    classifySpec,
    extractSpec,
    frontmatterOf,
    inconsistencyOf,
    type Corpus,
    type CorpusItem,
} from '../../internal/bench/free-hands-shadow/corpus.js';
import {
    ac3Demo,
    BACKOFF_START_MS,
    buildReport,
    claudeHead,
    FREE_FAILURE_STREAK_MAX,
    readRunLedger,
    runAudit,
    runWindow,
    subscriptionRefusals,
    type HarnessDeps,
} from '../../internal/bench/free-hands-shadow/run.js';
import { verifyAnswer } from '../../internal/bench/free-hands-shadow/verify.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const STUB = `
const http = require('node:http');
const stats = { free: 0, paid: 0, models: 0 };
let freeFail = { code: 0, n: 0 };
const label = (p) => p.startsWith('src/skills/') ? 'skill' : p.startsWith('src/rules/') ? 'rule' : 'script';
function answer(system, user, side) {
  if (system.includes('"classify"')) {
    const p = (/File path: (\\S+)/.exec(user) || [])[1] || '';
    return JSON.stringify({ label: label(p), confidence: 0.9 });
  }
  const n = (/^name: *(\\S+)/m.exec(user) || [])[1] || '';
  return JSON.stringify({ items: [side === 'free' ? 'wrong-' + n : n] });
}
http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.method === 'GET' && req.url === '/v1/models') { stats.models++; return send(200, { data: [{ id: 'stub-free' }, { id: 'community-x' }] }); }
    if (req.method === 'GET' && req.url === '/first-party') return send(200, [{ name: 'stub-free', community: false }, { name: 'community-x', community: true }]);
    if (req.method === 'GET' && req.url === '/stats') return send(200, stats);
    if (req.method === 'GET' && req.url.startsWith('/set?')) {
      const q = new URL(req.url, 'http://stub').searchParams;
      freeFail = { code: Number(q.get('code')), n: Number(q.get('n')) };
      return send(200, {});
    }
    const side = req.url === '/v1/chat/completions' ? 'free' : req.url === '/paid/chat/completions' ? 'paid' : null;
    if (side === null) return send(404, {});
    stats[side]++;
    if (side === 'free' && freeFail.n > 0) { freeFail.n--; return send(freeFail.code, { error: { message: 'stub failure' } }); }
    const b = JSON.parse(body);
    send(200, { model: b.model, choices: [{ message: { content: answer(b.messages[0].content, b.messages[1].content, side) } }], usage: { prompt_tokens: 20, completion_tokens: 5 } });
  });
}).listen(0, '127.0.0.1', function () { process.stdout.write(String(this.address().port) + '\\n'); });
`;

let server: ChildProcess;
let port = 0;
let tmp: string;

beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fhs-stub-'));
    const file = path.join(dir, 'stub.cjs');
    fs.writeFileSync(file, STUB, 'utf8');
    server = spawn(process.execPath, [file], { stdio: ['ignore', 'pipe', 'inherit'] });
    port = await new Promise<number>((resolve) => server.stdout!.once('data', (d: Buffer) => resolve(Number(String(d).trim()))));
});
afterAll(() => {
    server.kill();
});
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fhs-run-'));
});
afterEach(async () => {
    fs.rmSync(tmp, { recursive: true, force: true });
    await failFree(0, 0);
});

const base = (): string => `http://127.0.0.1:${String(port)}`;

/** The next `n` free completions answer HTTP `code`. */
async function failFree(code: number, n: number): Promise<void> {
    await fetch(`${base()}/set?code=${String(code)}&n=${String(n)}`);
}

async function stats(): Promise<{ free: number; paid: number; models: number }> {
    return (await (await fetch(`${base()}/stats`)).json()) as { free: number; paid: number; models: number };
}

/** A subscription-CLI-shaped paid seat whose completion is a loopback stub. */
function paidSeat(over: Record<string, unknown> = {}): ExternalAIClient {
    return {
        name: 'anthropic',
        model: 'stub-paid',
        transport: 'cli',
        billable: false,
        ask: (system: string, user: string) => {
            const r = curlJsonPost(`${base()}/paid/chat/completions`, [], {
                model: 'stub-paid',
                messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            }) as { choices: { message: { content: string } }[] };
            return new CouncilResponse({ provider: 'anthropic', model: 'stub-paid', text: r.choices[0]!.message.content, input_tokens: 20, output_tokens: 5, latency_ms: 1 });
        },
        ...over,
    } as unknown as ExternalAIClient;
}

function settings(): Record<string, unknown> {
    return {
        ai_council: {
            enabled: true,
            members: {
                hands: {
                    enabled: true,
                    model: 'placeholder',
                    base_url: `${base()}/v1`,
                    billing_proof: { kind: 'keyless', url: 'https://route.example.test/free', checked: '2026-10-22' },
                },
            },
        },
    };
}

function item(kind: 'classify' | 'extract', p: string, content: string, truth: string): CorpusItem {
    return { id: `${kind}:${p}`, kind, path: p, truth, spec: kind === 'classify' ? classifySpec(p, content) : extractSpec(content) };
}

function corpus(extraClassify = 0): Corpus {
    const skill = (n: string): string => `---\nname: ${n}\ndescription: x\n---\n# ${n}\n`;
    const extra = Array.from({ length: extraClassify }, (_, i) => item('classify', `src/scripts/extra${String(i)}.ts`, 'export const x = 1;\n', 'script'));
    return {
        ref: 'test',
        digest: 'd1',
        inconsistencies: [],
        items: {
            classify: [
                item('classify', 'src/skills/alpha/SKILL.md', skill('alpha'), 'skill'),
                item('classify', 'src/rules/beta.md', '---\ntype: auto\n---\n', 'rule'),
                item('classify', 'src/scripts/gamma.ts', 'export const g = 1;\n', 'script'),
                ...extra,
            ],
            extract: ['delta', 'epsilon', 'zeta'].map((n) => item('extract', `src/skills/${n}/SKILL.md`, skill(n), n)),
        },
    };
}

interface Clock {
    t: number;
    sleeps: number[];
}

function deps(over: Partial<HarnessDeps> = {}, clock: Clock = { t: Date.parse('2026-10-22T10:00:00Z'), sleeps: [] }): HarnessDeps {
    return {
        root: tmp,
        env: {},
        now: () => new Date(clock.t),
        sleep: async (ms) => {
            clock.sleeps.push(ms);
            clock.t += ms;
        },
        log: () => undefined,
        loadSettings: settings,
        buildMembers: (s, opts) => [paidSeat(), ...build_members(s, opts)],
        corpus,
        egress: new CouncilEgress({ identifiers: true }),
        firstPartyList: `${base()}/first-party`,
        trackedFiles: 1000,
        auditDir: path.join(tmp, 'audit'),
        ...over,
    };
}

function auditLines(): Record<string, unknown>[] {
    const dir = path.join(tmp, 'audit');
    return fs
        .readdirSync(dir)
        .flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n'))
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as Record<string, unknown>);
}

describe('fhs-verify/1 — the deterministic verifier', () => {
    it('rejects a planted wrong answer of each kind and accepts the true one', () => {
        expect(verifyAnswer('classify', 'skill', { label: 'rule', confidence: 1 })).toBe('fail');
        expect(verifyAnswer('extract', 'adr-create', { items: ['adr-creator'] })).toBe('fail');
        expect(verifyAnswer('extract', 'adr-create', { items: ['adr-create', 'x'] })).toBe('fail');
        expect(verifyAnswer('extract', 'adr-create', { items: ['"adr-create"'] })).toBe('fail');
        expect(verifyAnswer('classify', 'skill', { label: ' Skill ', confidence: 0.2 })).toBe('pass');
        expect(verifyAnswer('extract', 'adr-create', { items: ['adr-create'] })).toBe('pass');
    });
});

describe('the frozen corpus', () => {
    it('draws 333 classify items, 37 per label, and 333 extract items from the registered ref', () => {
        const c = buildCorpus(REPO);
        expect(c.items.classify).toHaveLength(333);
        expect(c.items.extract).toHaveLength(333);
        const per = new Map<string, number>();
        for (const i of c.items.classify) per.set(i.truth, (per.get(i.truth) ?? 0) + 1);
        expect([...per.values()].every((n) => n === 37)).toBe(true);
        expect(c.items.extract.every((i) => i.spec.includes(i.truth))).toBe(true);
    });

    it('the byproduct check flags a path class its frontmatter contradicts', () => {
        expect(inconsistencyOf('src/skills/a/SKILL.md', 'skill', '---\nname: b\ndescription: x\n---\n')).toMatch(/not the directory/);
        expect(inconsistencyOf('src/rules/r.md', 'rule', '---\ntype: sometimes\n---\n')).toMatch(/always\|auto\|manual/);
        expect(inconsistencyOf('docs/decisions/ADR-012-x.md', 'adr', '---\nadr: 013\nstatus: accepted\n---\n')).toMatch(/filename number/);
        expect(inconsistencyOf('src/skills/a/SKILL.md', 'skill', '---\nname: a\ndescription: x\n---\n')).toBeNull();
    });

    it('a quoted scalar keeps a `#` inside its quotes; a comment after it or after a plain scalar is dropped', () => {
        const f = (v: string): string | undefined => frontmatterOf(`---\nname: ${v}\n---\n`).fields['name'];
        expect(f('"a #b"')).toBe('a #b');
        expect(f("'a #b' # note")).toBe('a #b');
        expect(f('"x" # note')).toBe('x');
        expect(f('plain # note')).toBe('plain');
        expect(f('a#b')).toBe('a#b');
    });
});

describe('the window stops, backs off and resumes from its own ledger', () => {
    const shadowRows = (): number => readShadowLedger(tmp).length;

    it('a 402 from the free route stops the run at once, with the row ledgered', async () => {
        await failFree(402, 1);
        const res = await runWindow(deps(), { perKind: 3, kinds: ['classify'], minIntervalMs: 0 });
        expect(res.code).toBe(1);
        expect(res.calls).toBe(1);
        expect(res.stopped).toMatch(/402/);
        expect(readShadowLedger(tmp)[0]!.free.outcome).toBe('billing');
    });

    it('a 429 doubles the wait from 120 s; four in a row stop the run', async () => {
        await failFree(429, 2);
        const clock: Clock = { t: Date.parse('2026-10-22T10:00:00Z'), sleeps: [] };
        const res = await runWindow(deps({}, clock), { perKind: 3, kinds: ['classify'], minIntervalMs: 0 });
        expect(res.code).toBe(0);
        expect(clock.sleeps).toEqual([BACKOFF_START_MS, 2 * BACKOFF_START_MS]);
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.mkdirSync(tmp);
        await failFree(429, 10);
        const stop = await runWindow(deps({ corpus: () => corpus(6) }), { perKind: 9, kinds: ['classify'], minIntervalMs: 0 });
        expect(stop.code).toBe(1);
        expect(stop.calls).toBe(4);
        expect(stop.stopped).toMatch(/4 rate-limited/);
    });

    it('the back-off survives a restart: the next run waits it out from the last ledgered start', async () => {
        await failFree(429, 1);
        const clock: Clock = { t: Date.parse('2026-10-22T10:00:00Z'), sleeps: [] };
        await runWindow(deps({}, clock), { perKind: 1, kinds: ['classify'], minIntervalMs: 0 });
        expect(clock.sleeps).toEqual([]);
        clock.t += 20_000;
        await runWindow(deps({}, clock), { perKind: 2, kinds: ['classify'], minIntervalMs: 0 });
        expect(clock.sleeps).toEqual([BACKOFF_START_MS - 20_000]);
    });

    it(`${String(10)} failed free answers in a row (any class) stop the run, and a restart only probes once`, async () => {
        expect(FREE_FAILURE_STREAK_MAX).toBe(10);
        await failFree(500, 100);
        const before = await stats();
        const res = await runWindow(deps({ corpus: () => corpus(12) }), { perKind: 15, kinds: ['classify'], minIntervalMs: 0 });
        expect(res.code).toBe(1);
        expect(res.calls).toBe(FREE_FAILURE_STREAK_MAX);
        expect(res.stopped).toMatch(/failed free answers in a row/);
        const again = await runWindow(deps({ corpus: () => corpus(12) }), { perKind: 15, kinds: ['classify'], minIntervalMs: 0 });
        expect(again.calls).toBe(1);
        expect(again.code).toBe(1);
        expect((await stats()).paid - before.paid).toBe(FREE_FAILURE_STREAK_MAX + 1);
    });

    it('pacing holds across restarts and counts the --ac3-demo call', async () => {
        const clock: Clock = { t: Date.parse('2026-10-22T10:00:00Z'), sleeps: [] };
        await ac3Demo(deps({}, clock), { minIntervalMs: 31_000 });
        await runWindow(deps({}, clock), { perKind: 1, kinds: ['classify'] });
        expect(clock.sleeps).toEqual([31_000]);
        clock.t += 1_000;
        await runWindow(deps({}, clock), { perKind: 2, kinds: ['classify'] });
        expect(clock.sleeps).toEqual([31_000, 30_000]);
    });

    it('refuses a production ledger carrying rows this run did not write', async () => {
        await runWindow(deps(), { perKind: 1, kinds: ['classify'], minIntervalMs: 0 });
        const file = path.join(tmp, 'agents/runtime/state/free-hand-shadow.jsonl');
        fs.appendFileSync(file, fs.readFileSync(file, 'utf8'), 'utf8');
        const before = await stats();
        const res = await runWindow(deps(), { perKind: 3, kinds: ['classify'], minIntervalMs: 0 });
        expect(res.code).toBe(2);
        expect(res.stopped).toMatch(/foreign shadow rows/);
        expect((await stats()).paid - before.paid).toBe(0);
    });

    it('an item that wrote no shadow row is retried on resume, so a kind can still reach its cap', async () => {
        const first = await runWindow(deps({ trackedFiles: 1 }), { perKind: 3, kinds: ['classify'], minIntervalMs: 0 });
        expect(first.code).toBe(1);
        expect(first.stopped).toMatch(/no shadow row/);
        expect(shadowRows()).toBe(0);
        const again = await runWindow(deps(), { perKind: 3, kinds: ['classify'], minIntervalMs: 0 });
        expect(again.code).toBe(0);
        expect(shadowRows()).toBe(3);
        expect(new Set(readShadowLedger(tmp).map((r) => r.kind))).toEqual(new Set(['classify']));
    });

    it('rejects a cap that is not a positive integer instead of running uncapped', async () => {
        const before = await stats();
        for (const o of [{ maxTotal: Number('abc') }, { perKind: 0 }, { maxTotal: -1 }, { perKind: 2.5 }]) {
            const res = await runWindow(deps(), { ...o, minIntervalMs: 0 });
            expect(res.code).toBe(2);
            expect(res.stopped).toMatch(/positive integer/);
        }
        expect((await stats()).paid - before.paid).toBe(0);
    });

    it('the report reads only the rows this run ledgered, and a rerun of the audit neither re-asks nor double-counts', async () => {
        await runWindow(deps(), { perKind: 3, minIntervalMs: 0 });
        const file = path.join(tmp, 'agents/runtime/state/free-hand-shadow.jsonl');
        const organic = JSON.parse(fs.readFileSync(file, 'utf8').split('\n')[0]!) as Record<string, unknown>;
        fs.appendFileSync(file, `${JSON.stringify({ ...organic, ts: '2026-11-01T00:00:00.000Z' })}\n`, 'utf8');
        expect(buildReport({ root: tmp }, corpus()).kinds.find((k) => k.kind === 'classify')!.calls).toBe(3);
        let asked = 0;
        const head = (): string => (asked++, '{"correct": true}');
        await runAudit(deps({ askHead: head }));
        expect(asked).toBe(4);
        const second = await runAudit(deps({ askHead: head }));
        expect(asked).toBe(4);
        expect(second).toHaveLength(0);
        const ext = buildReport({ root: tmp }, corpus()).kinds.find((k) => k.kind === 'extract')!;
        expect(ext.audit.questions).toBe(2);
    });
});

describe('the shadow window over the production askHand path', () => {
    it('3 calls per kind against two loopback stubs ledger both verify results and serve the paid answer', async () => {
        const before = await stats();
        const res = await runWindow(deps(), { perKind: 3 });
        expect(res.code).toBe(0);
        expect(res.calls).toBe(6);
        const shadow = readShadowLedger(tmp);
        expect(shadow).toHaveLength(6);
        for (const r of shadow) {
            expect(r.paid.verified).toBe('pass');
            expect(r.free.billing).toBe('free-quota');
            expect(r.free.verified).toBe(r.kind === 'classify' ? 'pass' : 'fail');
            expect(r.free.verify_tokens).toBe(0);
        }
        const { header, rows } = readRunLedger(tmp);
        expect(header?.free_model).toBe('stub-free');
        expect(rows.every((r) => r.served_by === 'anthropic' && r.route_billing === 'subscription')).toBe(true);
        const ext = rows.filter((r) => r.kind === 'extract');
        expect(ext.map((r) => (r.paid_answer as { items: string[] }).items[0])).toEqual(['delta', 'epsilon', 'zeta']);
        expect(ext.every((r) => (r.free_answer as { items: string[] }).items[0]!.startsWith('wrong-'))).toBe(true);
        const after = await stats();
        expect(after.paid - before.paid).toBe(6);
        expect(after.free - before.free).toBe(6);
        expect(auditLines().filter((l) => (l['orchestration'] as Record<string, unknown>)['route_billing'] === 'subscription')).toHaveLength(6);

        const rep = buildReport({ root: tmp }, corpus());
        const byKind = Object.fromEntries(rep.kinds.map((k) => [k.kind, k]));
        expect(byKind['classify']!.free_pass).toBe(1);
        expect(byKind['extract']!.free_pass).toBe(0);
        expect(byKind['extract']!.quality).toBe('underpowered');
        expect(rep.markdown).toContain('manufactured');
    });

    it('free calls start at least the minimum interval apart (injected clock)', async () => {
        const clock: Clock = { t: Date.parse('2026-10-22T10:00:00Z'), sleeps: [] };
        await runWindow(deps({}, clock), { perKind: 3, kinds: ['classify'] });
        const starts = readRunLedger(tmp).rows.map((r) => Date.parse(r.started_at));
        expect(starts).toHaveLength(3);
        for (let i = 1; i < starts.length; i++) expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(31_000);
        expect(clock.sleeps).toEqual([31_000, 31_000]);
    });

    it('a kind stops at its cap and the window at its total', async () => {
        const perKind = await runWindow(deps(), { perKind: 2, minIntervalMs: 0 });
        expect(readShadowLedger(tmp).map((r) => r.kind)).toEqual(['classify', 'classify', 'extract', 'extract']);
        expect(perKind.calls).toBe(4);
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.mkdirSync(tmp);
        const total = await runWindow(deps(), { perKind: 3, maxTotal: 3, minIntervalMs: 0 });
        expect(readShadowLedger(tmp)).toHaveLength(3);
        expect(total.stopped).toMatch(/window cap 3/);
    });

    it('resumes from the ledger without repeating an item', async () => {
        await runWindow(deps(), { perKind: 2, kinds: ['classify'], minIntervalMs: 0 });
        const again = await runWindow(deps(), { perKind: 3, kinds: ['classify'], minIntervalMs: 0 });
        expect(again.calls).toBe(1);
        expect(new Set(readRunLedger(tmp).rows.map((r) => r.id)).size).toBe(3);
    });

    it('--ac3-demo: the production chooser serves one classify ask on the free stub and the head verifies it', async () => {
        const before = await stats();
        const res = await ac3Demo(deps(), { minIntervalMs: 0 });
        expect(res.code).toBe(0);
        const after = await stats();
        expect(after.free - before.free).toBe(1);
        expect(after.paid - before.paid).toBe(0);
        expect(readShadowLedger(tmp)).toHaveLength(0);
        const demo = JSON.parse(fs.readFileSync(path.join(tmp, 'agents/runtime/bench/free-hands-shadow/ac3-demo.json'), 'utf8')) as Record<string, unknown>;
        expect(demo).toMatchObject({ served_by: 'hands', route_billing: 'free-quota', verified: 'pass', model_served: 'stub-free' });
        const verify = auditLines().filter((l) => l['work_id'] === demo['work_id'] && l['phase'] === 'verify');
        expect(verify).toHaveLength(1);
        expect(verify[0]!['orchestration']).toMatchObject({ route_billing: 'free-quota', verified: 'pass', verify_tokens: 0 });
    });

    it('the blind audit samples 10 % per kind, both sides, and reports agreement', async () => {
        await runWindow(deps(), { perKind: 3, minIntervalMs: 0 });
        const prompts: string[] = [];
        const rows = await runAudit(deps({ askHead: (p) => (prompts.push(p), '{"correct": true}') }));
        expect(rows).toHaveLength(4);
        expect(prompts.every((p) => !/free|paid|hands|anthropic|pass|fail/i.test(p.split('Task:')[0]!))).toBe(true);
        const ext = buildReport({ root: tmp }, corpus()).kinds.find((k) => k.kind === 'extract')!;
        expect(ext.audit.agreement).toBe(0.5);
        expect(ext.audit.suspect).toBe(true);
    });
});

describe('the paid arm is subscription-only', () => {
    const free = (): ExternalAIClient => ({ name: 'hands', billing: 'free-quota', base_url: 'http://127.0.0.1:1', model: 'm' }) as unknown as ExternalAIClient;

    it('refuses an API-billed seat, a vendor key in the environment, and a metered free side', () => {
        expect(subscriptionRefusals([paidSeat(), free()], {})).toEqual([]);
        expect(subscriptionRefusals([paidSeat({ transport: 'api', billable: true }), free()], {})[0]).toMatch(/not a subscription CLI/);
        expect(subscriptionRefusals([paidSeat(), free()], { ANTHROPIC_API_KEY: 'k' })[0]).toMatch(/ANTHROPIC_API_KEY is set/);
        for (const v of ['ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_FOUNDRY', 'ANTHROPIC_FOUNDRY_API_KEY']) {
            expect(subscriptionRefusals([paidSeat(), free()], { [v]: '1' }).join(' ')).toContain(`${v} is set`);
        }
        expect(subscriptionRefusals([paidSeat({ name: 'openai' }), free()], { OPENAI_BASE_URL: 'http://x' }).join(' ')).toContain('OPENAI_BASE_URL is set');
        const metered = { ...free(), billing: 'per-token', billable: true } as unknown as ExternalAIClient;
        expect(subscriptionRefusals([paidSeat(), metered], {}).join(' ')).toMatch(/no unpaid route/);
    });

    it('runWindow refuses to start, and calls neither arm, when the seat could bill an API', async () => {
        const before = await stats();
        const res = await runWindow(deps({ env: { ANTHROPIC_API_KEY: 'k' } }), { perKind: 3 });
        expect(res.code).toBe(2);
        expect(res.stopped).toMatch(/refusing to start/);
        const after = await stats();
        expect([after.paid - before.paid, after.free - before.free]).toEqual([0, 0]);
        expect(readShadowLedger(tmp)).toHaveLength(0);
    });

    it('the audit head refuses to run, and spawns nothing, when a billing variable is set', async () => {
        const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fhs-bin-'));
        const marker = path.join(bin, 'spawned');
        fs.writeFileSync(path.join(bin, 'claude'), `#!/bin/sh\n/usr/bin/touch ${marker}\necho '{"correct": true}'\n`, { mode: 0o755 });
        try {
            for (const v of ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'CLAUDE_CODE_USE_FOUNDRY']) {
                expect(claudeHead('haiku', { PATH: bin, [v]: '1' })('q')).toBeNull();
            }
            expect(fs.existsSync(marker)).toBe(false);
            expect(claudeHead('haiku', { PATH: bin })('q')).toContain('"correct": true');
            expect(fs.existsSync(marker)).toBe(true);
        } finally {
            fs.rmSync(bin, { recursive: true, force: true });
        }
    });

    it('the documented run-local config parses; its `mode: cli` is an ignored key, the hands route is free-quota', () => {
        const cfg = load_council_config(path.join(REPO, 'internal/bench/free-hands-shadow/council.example.yml'));
        expect(cfg.members.get('anthropic')?.model).toBe('haiku');
        expect(cfg.ignored_transport_keys).toContain('members.anthropic.mode');
        const hands = cfg.members.get('hands')!;
        expect(hands.route?.base_url).toBe('https://text.pollinations.ai/openai');
        const t = resolveRouteTransport({ name: 'hands', route: hands.route!, model: 'any', contentClass: 'public-artifact' });
        expect(t.billing).toBe('free-quota');
    });
});
