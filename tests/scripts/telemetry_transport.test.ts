/**
 * Phase 2 transport — the enqueue half, the sender, and the two properties
 * Phase 0's second spike explicitly deferred to Phase 2 ("whether a detached
 * child survives host teardown of the session process group, and the queue's
 * growth bound across a multi-day outage").
 *
 * The sender is exercised as a REAL detached child against a REAL loopback
 * server rather than by unit-calling its exported functions. That is
 * deliberate: the whole point of the design is that the work happens in
 * another process after the session is gone, and a unit call proves nothing
 * about that. It also means the drain algorithm has exactly one
 * implementation (`flush_sender.mjs`) with no test-only twin to drift from.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    append_class_a_record,
    build_class_a_record,
    type ClassARecord,
} from '../../src/agent-src/templates/scripts/telemetry/remote.js';
import {
    DEFAULT_FLUSH_TIMEOUT_MS,
    spool_has_work,
    spool_path_for,
} from '../../src/agent-src/templates/scripts/telemetry/transport.js';

const SENDER = path.resolve(
    __dirname,
    '../../src/agent-src/templates/scripts/telemetry/flush_sender.mjs',
);

const dirs: string[] = [];
const servers: http.Server[] = [];

function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'telemetry-transport-'));
    dirs.push(d);
    return d;
}

afterEach(() => {
    while (dirs.length > 0) fs.rmSync(dirs.pop() as string, { recursive: true, force: true });
    while (servers.length > 0) (servers.pop() as http.Server).close();
});

function record(skill: string, now = new Date('2026-08-20T10:00:00Z')): ClassARecord {
    return build_class_a_record({
        skill,
        host: 'claude',
        org_id: 'acme',
        salt: 'org-pack-salt',
        hostname: 'box',
        username: 'dev',
        session_id: 'sess-1',
        package_version: '1.2.3',
        discipline_profile: 'essential',
        now,
    });
}

/** A loopback sink. `bodies` collects what actually arrived. */
async function sink(
    handler: (body: string) => { status: number } | 'hang',
): Promise<{ url: string; bodies: string[] }> {
    const bodies: string[] = [];
    const server = http.createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf-8');
            bodies.push(body);
            const verdict = handler(body);
            if (verdict === 'hang') return; // never answers — the wedged-sink shape
            res.statusCode = verdict.status;
            res.end();
        });
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
    return { url: `http://127.0.0.1:${port}/ingest`, bodies };
}

async function waitFor(predicate: () => boolean, ms = 8000): Promise<boolean> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
        if (predicate()) return true;
        await new Promise((r) => setTimeout(r, 25));
    }
    return predicate();
}

/**
 * Run the sender as a real child and await its exit.
 *
 * NOT `spawnSync`: the loopback sink lives in this process, so blocking the
 * event loop would stop the server from ever answering and every test would
 * measure a timeout instead of the path it names.
 */
async function runSender(
    spool: string,
    endpoint: string,
    timeout = DEFAULT_FLUSH_TIMEOUT_MS,
): Promise<void> {
    const child = spawn(
        process.execPath,
        [SENDER, '--spool', spool, '--endpoint', endpoint, '--timeout', String(timeout)],
        { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    child.stdout.on('data', (c: Buffer) => {
        out += c.toString();
    });
    const code = await new Promise<number>((resolve) => {
        child.on('exit', (c) => resolve(c ?? -1));
    });
    // Always 0, on every path — nothing reads a detached child's exit code.
    expect(code).toBe(0);
    expect(out).toBe('');
}

describe('spool_path_for', () => {
    it('sits beside the log and does not itself end in a bare .jsonl record name', () => {
        expect(spool_path_for('/p/.agent-telemetry.jsonl')).toBe('/p/.agent-telemetry.spool.jsonl');
    });

    it('is derived, so a log path change moves the spool with it', () => {
        expect(spool_path_for('/p/other.jsonl')).toBe('/p/other.spool.jsonl');
        expect(spool_path_for('/p/nosuffix')).toBe('/p/nosuffix.spool.jsonl');
    });
});

describe('append_class_a_record — the spool is written by the only writer', () => {
    it('writes the log only when no spool is asked for', () => {
        const d = tmp();
        const log = path.join(d, '.agent-telemetry.jsonl');
        append_class_a_record(log, record('brand'), undefined, new Date());
        expect(fs.existsSync(log)).toBe(true);
        expect(fs.existsSync(spool_path_for(log))).toBe(false);
    });

    it('writes BYTE-IDENTICAL lines to log and spool', () => {
        const d = tmp();
        const log = path.join(d, '.agent-telemetry.jsonl');
        const spool = spool_path_for(log);
        append_class_a_record(log, record('brand'), undefined, new Date(), spool);
        append_class_a_record(log, record('laravel'), undefined, new Date(), spool);
        expect(fs.readFileSync(spool, 'utf-8')).toBe(fs.readFileSync(log, 'utf-8'));
        expect(fs.readFileSync(spool, 'utf-8').trimEnd().split('\n')).toHaveLength(2);
    });

    it('bounds the spool with the SAME policy as the log — the multi-day-outage answer', () => {
        const d = tmp();
        const log = path.join(d, '.agent-telemetry.jsonl');
        const spool = spool_path_for(log);
        // A sink that has been down for a long time: nothing drains the spool,
        // so only the growth budget stands between it and unbounded growth.
        const policy = { max_age_days: 90, max_bytes: 4096 };
        for (let i = 0; i < 400; i += 1) {
            append_class_a_record(log, record(`skill-${i}`), policy, new Date(), spool);
        }
        expect(fs.statSync(spool).size).toBeLessThanOrEqual(4096);
        expect(fs.statSync(log).size).toBeLessThanOrEqual(4096);
        // Bounded, not emptied: the newest records survive.
        expect(fs.readFileSync(spool, 'utf-8')).toContain('skill-399');
    });
});

describe('flush_sender — drain semantics', () => {
    it('sends the spooled bytes verbatim and removes the spool on 2xx', async () => {
        const d = tmp();
        const log = path.join(d, '.agent-telemetry.jsonl');
        const spool = spool_path_for(log);
        append_class_a_record(log, record('brand'), undefined, new Date(), spool);
        const expected = fs.readFileSync(spool, 'utf-8');

        const s = await sink(() => ({ status: 204 }));
        await runSender(spool, s.url);

        expect(s.bodies).toEqual([expected]);
        expect(spool_has_work(spool)).toBe(false);
        // The local log is untouched — it is the documented inspection path.
        expect(fs.readFileSync(log, 'utf-8')).toBe(expected);
    });

    it('RETAINS the batch for the next flush on a non-2xx', async () => {
        const d = tmp();
        const log = path.join(d, '.agent-telemetry.jsonl');
        const spool = spool_path_for(log);
        append_class_a_record(log, record('brand'), undefined, new Date(), spool);
        const expected = fs.readFileSync(spool, 'utf-8');

        const s = await sink(() => ({ status: 500 }));
        await runSender(spool, s.url);

        expect(fs.readFileSync(spool, 'utf-8')).toBe(expected);
        expect(fs.readdirSync(d).filter((f) => f.includes('.sending.'))).toEqual([]);
    });

    it('RETAINS the batch when the sink accepts and never answers', async () => {
        const d = tmp();
        const log = path.join(d, '.agent-telemetry.jsonl');
        const spool = spool_path_for(log);
        append_class_a_record(log, record('brand'), undefined, new Date(), spool);
        const expected = fs.readFileSync(spool, 'utf-8');

        const s = await sink(() => 'hang');
        // The blackhole shape from spike 2 — the one an inline flush paid
        // 1002 ms for. Here the wait is in a process the session does not
        // await, so it costs the session nothing.
        await runSender(spool, s.url, 300);

        expect(fs.readFileSync(spool, 'utf-8')).toBe(expected);
    });

    it('does nothing at all with no spool, an empty spool, or no endpoint', async () => {
        const d = tmp();
        const spool = path.join(d, '.agent-telemetry.spool.jsonl');
        const s = await sink(() => ({ status: 204 }));

        await runSender(spool, s.url); // absent
        fs.writeFileSync(spool, '');
        await runSender(spool, s.url); // empty
        fs.writeFileSync(spool, '{"schema_version":1}\n');
        await runSender(spool, ''); // no endpoint

        expect(s.bodies).toEqual([]);
        expect(fs.readFileSync(spool, 'utf-8')).toBe('{"schema_version":1}\n');
    });

    it('claim-by-rename does not lose a record appended DURING the send', async () => {
        const d = tmp();
        const log = path.join(d, '.agent-telemetry.jsonl');
        const spool = spool_path_for(log);
        append_class_a_record(log, record('during-a'), undefined, new Date(), spool);

        let concurrent = '';
        const s = await sink(() => {
            // The session appends while the sender holds the claim. Under
            // read-then-truncate this line is the one that vanishes.
            append_class_a_record(log, record('during-b'), undefined, new Date(), spool);
            concurrent = fs.readFileSync(spool, 'utf-8');
            return { status: 204 };
        });
        await runSender(spool, s.url);

        expect(concurrent).toContain('during-b');
        expect(concurrent).not.toContain('during-a');
        // Sent batch carried only the claimed record; the new one is still queued.
        expect(s.bodies[0]).toContain('during-a');
        expect(s.bodies[0]).not.toContain('during-b');
        expect(fs.readFileSync(spool, 'utf-8')).toContain('during-b');
    });
});

describe('detached survival — the property spike 2 deferred to Phase 2', () => {
    it('the sender completes after its whole spawning process group is torn down', async () => {
        const d = tmp();
        const log = path.join(d, '.agent-telemetry.jsonl');
        const spool = spool_path_for(log);
        append_class_a_record(log, record('survives'), undefined, new Date(), spool);

        // The sink answers only after a delay, so the session's process group
        // is certain to be gone before the request completes.
        let answered = false;
        const server = http.createServer((req, res) => {
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', () => {
                setTimeout(() => {
                    answered = true;
                    res.statusCode = 204;
                    res.end();
                }, 700);
            });
        });
        servers.push(server);
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const addr = server.address();
        const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
        const url = `http://127.0.0.1:${port}/ingest`;

        // A stand-in "session": its own process group, spawns the detached
        // sender exactly as the hook does, then sits still so we can kill the
        // GROUP rather than just the leader.
        const sessionSrc = `
            const { spawn } = require('node:child_process');
            const c = spawn(process.execPath,
                [${JSON.stringify(SENDER)}, '--spool', ${JSON.stringify(spool)},
                 '--endpoint', ${JSON.stringify(url)}, '--timeout', '5000'],
                { detached: true, stdio: 'ignore' });
            c.unref();
            console.log('spawned');
            setInterval(() => {}, 1000);
        `;
        const session = spawn(process.execPath, ['-e', sessionSrc], {
            detached: true,
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        await new Promise<void>((resolve) => {
            session.stdout.on('data', () => resolve());
        });

        // Tear down the entire group the session leads. If the sender were a
        // member of it, this is where the batch would be lost.
        process.kill(-(session.pid as number), 'SIGKILL');
        await waitFor(() => {
            try {
                process.kill(session.pid as number, 0);
                return false;
            } catch {
                return true;
            }
        }, 4000);

        // Order matters here, and getting it wrong once is why it is spelled
        // out: `spool_has_work` goes false the instant the sender CLAIMS the
        // spool by rename, which happens before the request completes. So an
        // "is the spool gone" assertion alone passes even for a sender that
        // was killed mid-flight. The load-bearing assertion is that the
        // request reached the sink AFTER the group was torn down, and then
        // that the claim was cleaned up — which only a live sender does.
        expect(await waitFor(() => answered)).toBe(true);
        expect(
            await waitFor(
                () =>
                    !spool_has_work(spool) &&
                    fs.readdirSync(d).every((f) => !f.includes('.sending.')),
            ),
        ).toBe(true);
    }, 30000);
});
