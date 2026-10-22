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
    inconsistencyOf,
    type Corpus,
    type CorpusItem,
} from '../../internal/bench/free-hands-shadow/corpus.js';
import {
    ac3Demo,
    buildReport,
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
    const side = req.url === '/v1/chat/completions' ? 'free' : req.url === '/paid/chat/completions' ? 'paid' : null;
    if (side === null) return send(404, {});
    stats[side]++;
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
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

const base = (): string => `http://127.0.0.1:${String(port)}`;

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

function corpus(): Corpus {
    const skill = (n: string): string => `---\nname: ${n}\ndescription: x\n---\n# ${n}\n`;
    return {
        ref: 'test',
        digest: 'd1',
        inconsistencies: [],
        items: {
            classify: [
                item('classify', 'src/skills/alpha/SKILL.md', skill('alpha'), 'skill'),
                item('classify', 'src/rules/beta.md', '---\ntype: auto\n---\n', 'rule'),
                item('classify', 'src/scripts/gamma.ts', 'export const g = 1;\n', 'script'),
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
