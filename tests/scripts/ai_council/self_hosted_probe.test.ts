// The real self-hosted probe: local weights are a file on this machine, and the
// serving process opens no non-loopback connection while it answers one call.
// Every command goes through an injected runner, so no test reaches a server.

import { describe, expect, it } from 'vitest';

import { parseRouteFields, type RouteSpec } from '../../../src/scripts/ai_council/free_route.js';
import {
    makeSelfHostedProbe,
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
}

function fake(o: FakeOpts): { deps: SelfHostedProbeDeps; calls: string[] } {
    const calls: string[] = [];
    let psCalls = 0;
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
            return 4242;
        },
        fileSize: (p) => (o.files ?? {})[p] ?? null,
        readText: () => o.reply ?? JSON.stringify({ model: 'llama3', choices: [{ message: { content: 'OK' } }] }),
        remove: () => undefined,
        tmpFile: () => '/tmp/probe-out.json',
        home: '/home/u',
        now: (() => {
            let t = 0;
            return () => (t += 10);
        })(),
        sleep: () => undefined,
    };
    return { deps, calls };
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
