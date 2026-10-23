// The real self-hosted probe: local weights are a file on this machine, and the
// serving process opens no non-loopback connection while it answers one call.
// Every command goes through an injected runner, so no test reaches a server.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseRouteFields, type RouteSpec } from '../../../src/scripts/ai_council/free_route.js';
import {
    makeMemoisedProbe,
    makeSelfHostedProbe,
    NODE_PROBE_DEPS,
    SELF_HOSTED_PROBE_TTL_MS,
    type ProbeRoute,
    type ProbeRunResult,
    type SelfHostedProbeDeps,
} from '../../../src/scripts/ai_council/self_hosted_probe.js';

const BLOB = '/home/u/.ollama/models/blobs/sha256-abc123';
const BIG = 4_000_000_000;

function route(base_url: string): RouteSpec {
    const r = parseRouteFields('local', { base_url, model: 'llama3', content_ceiling: 'project-content' }, false);
    if ('error' in r || r.route === null) throw new Error('fixture route did not parse');
    return r.route;
}

interface FakeOpts {
    show?: unknown;
    props?: unknown;
    lmstudio?: unknown;
    files?: Record<string, number>;
    /** lsof absent: every lsof call fails to execute. */
    noLsof?: boolean;
    listenPid?: string;
    /** ESTABLISHED lines reported for the listener during the call. */
    established?: string[];
    reply?: string;
    env?: Record<string, string>;
    /** Keys `resolveKey` answers, by ref. */
    keys?: Record<string, string>;
    /** The server answers only a call carrying this exact header. */
    requireHeader?: string;
}

interface Fake {
    deps: SelfHostedProbeDeps;
    calls: string[];
    removed: string[];
    written: Map<string, string>;
}

function fake(o: FakeOpts): Fake {
    const calls: string[] = [];
    const removed: string[] = [];
    const written = new Map<string, string>();
    let psCalls = 0;
    let authorised = o.requireHeader === undefined;
    const json = (v: unknown): ProbeRunResult => (v === undefined ? { status: 22, stdout: '' } : { status: 0, stdout: JSON.stringify(v) });
    const deps: SelfHostedProbeDeps = {
        run(cmd, args) {
            calls.push([cmd, ...args].join(' '));
            if (cmd === 'curl') {
                const url = args.find((a) => a.startsWith('http')) ?? '';
                if (url.endsWith('/api/show')) return json(o.show);
                if (url.endsWith('/props')) return json(o.props);
                if (url.endsWith('/api/v0/models')) return json(o.lmstudio);
                return { status: 7, stdout: '' };
            }
            if (cmd === 'lsof') {
                if (o.noLsof === true) return null;
                if (args.includes('-sTCP:LISTEN')) return { status: 0, stdout: `${o.listenPid ?? '777'}\n` };
                const lines = o.established ?? [];
                if (lines.length === 0) return { status: 1, stdout: '' };
                const header = 'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME';
                return { status: 0, stdout: [header, ...lines.map((l) => `ollama 777 u 9u IPv4 0x1 0t0 TCP ${l} (ESTABLISHED)`)].join('\n') };
            }
            if (cmd === 'ps') {
                psCalls += 1;
                return psCalls === 1 ? { status: 0, stdout: 'S\n' } : { status: 1, stdout: '' };
            }
            return { status: 0, stdout: '' };
        },
        start(cmd, args) {
            calls.push(`start ${[cmd, ...args].join(' ')}`);
            if (o.requireHeader !== undefined) {
                authorised = args.some((a, i) => args[i - 1] === '-H' && a.startsWith('@') && (written.get(a.slice(1)) ?? '').trim() === o.requireHeader);
            }
            return 4242;
        },
        fileSize: (p) => (o.files ?? {})[p] ?? null,
        readText: () => (authorised ? o.reply ?? JSON.stringify({ model: 'llama3', choices: [{ message: { content: 'OK' } }] }) : '{"error":"unauthorized"}'),
        writeText: (p, text) => {
            written.set(p, text);
        },
        remove: (p) => {
            removed.push(p);
        },
        tmpDir: () => '/tmp/fresh-1',
        resolveKey: (ref) => (o.keys ?? {})[ref] ?? null,
        env: o.env ?? {},
        home: '/home/u',
        now: (() => {
            let t = 0;
            return () => (t += 10);
        })(),
        sleep: () => undefined,
    };
    return { deps, calls, removed, written };
}

const OLLAMA_LOCAL = { modelfile: `# FROM llama3:latest\nFROM ${BLOB}\nTEMPLATE x`, details: { format: 'gguf' } };
const OLLAMA = 'http://127.0.0.1:11434/v1';

describe('self-hosted probe — local weights', () => {
    it('an Ollama model whose FROM blob exists with a plausible size is local', () => {
        const { deps } = fake({ show: OLLAMA_LOCAL, files: { [BLOB]: BIG } });
        expect(makeSelfHostedProbe(deps)(route(OLLAMA), 'llama3').weights).toBe('local');
    });

    it('a FROM digest resolves to the blob under ~/.ollama/models/blobs', () => {
        const { deps } = fake({ show: { modelfile: 'FROM sha256:abc123\n' }, files: { [BLOB]: BIG } });
        expect(makeSelfHostedProbe(deps)(route(OLLAMA), 'llama3').weights).toBe('local');
    });

    it('a FROM digest honours OLLAMA_MODELS, the documented override of the models directory', () => {
        const moved = '/data/ollama/blobs/sha256-abc123';
        const show = { modelfile: 'FROM sha256:abc123\n' };
        const { deps } = fake({ show, files: { [moved]: BIG }, env: { OLLAMA_MODELS: '/data/ollama' } });
        expect(makeSelfHostedProbe(deps)(route(OLLAMA), 'llama3').weights).toBe('local');
        const { deps: homeOnly } = fake({ show, files: { [BLOB]: BIG }, env: { OLLAMA_MODELS: '/data/ollama' } });
        expect(makeSelfHostedProbe(homeOnly)(route(OLLAMA), 'llama3').weights).toBe('remote');
    });

    it('a reported path that does not exist on this machine is remote', () => {
        const { deps } = fake({ show: OLLAMA_LOCAL, files: {} });
        expect(makeSelfHostedProbe(deps)(route(OLLAMA), 'llama3').weights).toBe('remote');
    });

    it('a reported file too small to hold weights is not local', () => {
        const { deps } = fake({ show: OLLAMA_LOCAL, files: { [BLOB]: 1024 } });
        expect(makeSelfHostedProbe(deps)(route(OLLAMA), 'llama3').weights).toBe('remote');
    });

    it('an Ollama :cloud model is remote, whatever the modelfile says', () => {
        const { deps } = fake({ show: OLLAMA_LOCAL, files: { [BLOB]: BIG } });
        expect(makeSelfHostedProbe(deps)(route(OLLAMA), 'gpt-oss:120b-cloud').weights).toBe('remote');
        expect(makeSelfHostedProbe(deps)(route(OLLAMA), 'qwen3-coder:cloud').weights).toBe('remote');
    });

    it('an Ollama show answer naming a remote_host is remote', () => {
        const { deps } = fake({ show: { ...OLLAMA_LOCAL, remote_host: 'https://ollama.com:443' }, files: { [BLOB]: BIG } });
        expect(makeSelfHostedProbe(deps)(route(OLLAMA), 'llama3').weights).toBe('remote');
    });

    it('llama-server reports its model_path on /props', () => {
        const { deps } = fake({ props: { model_path: '/models/q.gguf' }, files: { '/models/q.gguf': BIG } });
        expect(makeSelfHostedProbe(deps)(route('http://localhost:8080/v1'), 'q').weights).toBe('local');
    });

    it('LM Studio reports a model path relative to its models directory', () => {
        const p = '/home/u/.lmstudio/models/org/q/q.gguf';
        const { deps } = fake({ lmstudio: { data: [{ id: 'q', path: 'org/q/q.gguf' }] }, files: { [p]: BIG } });
        expect(makeSelfHostedProbe(deps)(route('http://localhost:1234/v1'), 'q').weights).toBe('local');
    });

    it('a runtime that reports no path answers unknown', () => {
        const { deps } = fake({ show: { modelfile: 'TEMPLATE only' } });
        expect(makeSelfHostedProbe(deps)(route(OLLAMA), 'llama3').weights).toBe('unknown');
    });
});

describe('self-hosted probe — no outbound during the call', () => {
    const local = { show: OLLAMA_LOCAL, files: { [BLOB]: BIG } };

    it('an established non-loopback connection during the call is outbound', () => {
        const { deps } = fake({ ...local, established: ['127.0.0.1:11434->127.0.0.1:50000', '192.168.1.5:50001->34.36.133.15:443'] });
        expect(makeSelfHostedProbe(deps)(route(OLLAMA), 'llama3')).toEqual({ weights: 'local', outbound: true });
    });

    it('only loopback connections during the call are no outbound', () => {
        const { deps, calls } = fake({ ...local, established: ['127.0.0.1:11434->127.0.0.1:50000', '[::1]:11434->[::1]:50002'] });
        expect(makeSelfHostedProbe(deps)(route(OLLAMA), 'llama3')).toEqual({ weights: 'local', outbound: false });
        expect(calls.some((c) => c.startsWith('start curl') && c.includes('/chat/completions') && c.includes('Reply with OK.'))).toBe(true);
        expect(calls.some((c) => c === 'lsof -nP -a -p 777 -iTCP -sTCP:ESTABLISHED')).toBe(true);
    });

    it('lsof absent leaves outbound unmeasured', () => {
        const { deps } = fake({ ...local, noLsof: true });
        expect(makeSelfHostedProbe(deps)(route(OLLAMA), 'llama3')).toEqual({ weights: 'local', outbound: null });
    });

    it('no PID listening on the port leaves outbound unmeasured', () => {
        const { deps } = fake({ ...local, listenPid: '' });
        expect(makeSelfHostedProbe(deps)(route(OLLAMA), 'llama3').outbound).toBeNull();
    });

    it('a probe call that never completed leaves outbound unmeasured', () => {
        const { deps } = fake({ ...local, established: [], reply: '' });
        expect(makeSelfHostedProbe(deps)(route(OLLAMA), 'llama3').outbound).toBeNull();
    });
});

describe('self-hosted probe — temp output and auth', () => {
    it('the call writes its output inside a fresh private directory and removes that directory', () => {
        const { deps, calls, removed } = fake({ ...local(), established: [] });
        makeSelfHostedProbe(deps)(route(OLLAMA), 'llama3');
        const call = calls.find((c) => c.startsWith('start curl')) ?? '';
        expect(call).toContain('-o /tmp/fresh-1/out.json');
        expect(removed).toContain('/tmp/fresh-1');
    });

    it('the production temp directory is fresh, empty, private and distinct per call', () => {
        const a = NODE_PROBE_DEPS.tmpDir();
        const b = NODE_PROBE_DEPS.tmpDir();
        try {
            expect(a).not.toBe(b);
            for (const d of [a, b]) {
                expect([os.tmpdir(), fs.realpathSync(os.tmpdir())]).toContain(path.dirname(d));
                expect(fs.readdirSync(d)).toEqual([]);
                expect(fs.statSync(d).mode & 0o777).toBe(0o700);
            }
        } finally {
            NODE_PROBE_DEPS.remove(a);
            NODE_PROBE_DEPS.remove(b);
        }
        expect(fs.existsSync(a)).toBe(false);
    });

    it('a route whose key resolves sends it as a header file, never on the command line', () => {
        const keyed: ProbeRoute = { ...route(OLLAMA), keyless: false, api_key_ref: 'env:LOCAL_KEY' };
        const { deps, calls } = fake({ ...local(), established: [], keys: { 'env:LOCAL_KEY': 'sk-local-secret' }, requireHeader: 'Authorization: Bearer sk-local-secret' });
        expect(makeSelfHostedProbe(deps)(keyed, 'llama3')).toEqual({ weights: 'local', outbound: false });
        expect(calls.some((c) => c.includes('sk-local-secret'))).toBe(false);
    });

    it('a route needing a key that does not resolve stays unproven and sends no header', () => {
        const keyed: ProbeRoute = { ...route(OLLAMA), keyless: false, api_key_ref: 'env:LOCAL_KEY' };
        const { deps, calls, written } = fake({ ...local(), established: [], requireHeader: 'Authorization: Bearer sk-local-secret' });
        expect(makeSelfHostedProbe(deps)(keyed, 'llama3').outbound).toBeNull();
        expect(written.size).toBe(0);
        expect(calls.find((c) => c.startsWith('start curl'))).not.toContain('-H @');
    });
});

describe('self-hosted probe — memo', () => {
    const proven = { weights: 'local', outbound: false } as const;

    function counting(results: ReturnType<ReturnType<typeof makeSelfHostedProbe>>[]): { probe: ReturnType<typeof makeSelfHostedProbe>; count: () => number } {
        let n = 0;
        return { probe: () => results[Math.min(n++, results.length - 1)] as (typeof results)[number], count: () => n };
    }

    it('an unmeasured outbound is not cached', () => {
        const inner = counting([{ weights: 'local', outbound: null }, proven]);
        const memo = makeMemoisedProbe(inner.probe, () => 0);
        expect(memo(route(OLLAMA), 'llama3').outbound).toBeNull();
        expect(memo(route(OLLAMA), 'llama3')).toEqual(proven);
        expect(inner.count()).toBe(2);
    });

    it('an unknown weights answer is not cached', () => {
        const inner = counting([{ weights: 'unknown', outbound: null }]);
        const memo = makeMemoisedProbe(inner.probe, () => 0);
        memo(route(OLLAMA), 'llama3');
        memo(route(OLLAMA), 'llama3');
        expect(inner.count()).toBe(2);
    });

    it('a proven result is reused inside the TTL and re-probed after it', () => {
        let t = 1_000;
        const inner = counting([proven, { weights: 'local', outbound: true }]);
        const memo = makeMemoisedProbe(inner.probe, () => t);
        expect(memo(route(OLLAMA), 'llama3')).toEqual(proven);
        t += SELF_HOSTED_PROBE_TTL_MS - 1;
        expect(memo(route(OLLAMA), 'llama3')).toEqual(proven);
        expect(inner.count()).toBe(1);
        t += 2;
        expect(memo(route(OLLAMA), 'llama3')).toEqual({ weights: 'local', outbound: true });
        expect(inner.count()).toBe(2);
    });
});

describe('self-hosted probe — scope', () => {
    it('a non-loopback route executes no command and proves nothing', () => {
        const { deps, calls } = fake({ show: OLLAMA_LOCAL, files: { [BLOB]: BIG } });
        expect(makeSelfHostedProbe(deps)(route('https://gpu.example.test/v1'), 'llama3')).toEqual({ weights: 'unknown', outbound: null });
        expect(calls).toEqual([]);
    });

    it('a runner that throws never escapes the probe', () => {
        const { deps } = fake(local());
        const boom: SelfHostedProbeDeps = { ...deps, run: () => { throw new Error('boom'); } };
        expect(makeSelfHostedProbe(boom)(route(OLLAMA), 'llama3')).toEqual({ weights: 'unknown', outbound: null });
    });
});

function local(): FakeOpts {
    return { show: OLLAMA_LOCAL, files: { [BLOB]: BIG } };
}
