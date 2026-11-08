/**
 * Whole-hook latency of `quota-notice` (user_prompt_submit) and `session-eol`
 * (stop) through the built dispatcher, with agent-switch answering, failing,
 * hanging, resting (backed off) and absent. Run from the agent-config root:
 *   npx tsx agents/evidence/analysis/agent-switch-link-latency.mjs [n]
 * after `npm run build:hooks`. Needs no network and touches no real agent-switch:
 * every run gets its own HOME, EVENT4U_CONFIG_HOME and PATH.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { appendQuotaSnapshot, hashSessionId } from '../../../src/scripts/_lib/quota_ledger.ts';
import { writeSwitchRecord } from '../../../src/scripts/_lib/switch_relay.ts';

const ROOT = process.cwd();
const N = Number(process.argv[2] ?? 20);
const FAKE = path.join(ROOT, 'tests/scripts/fixtures/fake_agent_switch.mjs');
const ID = '0123456789abcdef';
const SID = 'bench-sess';


function setup(mode, shape) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'as-lat-'));
    const bin = path.join(home, 'bin');
    const ws = path.join(home, 'ws');
    fs.mkdirSync(bin);
    fs.mkdirSync(ws);
    fs.writeFileSync(path.join(ws, 't.jsonl'), '{"type":"user","message":{"role":"user","content":"weiter"}}\n');
    fs.symlinkSync(process.execPath, path.join(bin, 'node'));
    const reqFile = path.join(home, 'request.json');
    const now = Date.now();
    const reset = Math.trunc(now / 1000) + 3 * 3600;
    const req = {
        v: 1, id: ID, rev: 1, account: 'claude/a', session: `claude/a/${SID}`,
        reason: { window: 'five_hour', fill: 85, resetsAt: new Date(reset * 1000).toISOString() },
        raisedBy: 'ac', candidates: [{ target: 'claude/b', provider: 'claude', fill: 12, resetsAt: null, how: ['after-turn'] }],
        raisedAt: new Date(now).toISOString(), expiresAt: new Date(reset * 1000).toISOString(),
        state: shape === 'stop' ? 'approved' : 'open',
        ...(shape === 'stop' ? { decision: { kind: 'approve', target: 'claude/b', how: 'after-turn', by: 'ac:claude-code', at: 'x' } } : {}),
    };
    if (mode === 'answering') fs.writeFileSync(reqFile, JSON.stringify(req));
    if (mode !== 'absent') {
        const exe = path.join(bin, 'agent-switch');
        const body =
            mode === 'hanging'
                ? `#!/bin/sh\nif [ "$1" = link ]; then exec "${process.execPath}" "${FAKE}" "$@"; fi\nsleep 30\n`
                : `#!/bin/sh\nexec "${process.execPath}" "${FAKE}" "$@"\n`;
        fs.writeFileSync(exe, body);
        fs.chmodSync(exe, 0o755);
    }
    const stateEnv = { EVENT4U_CONFIG_HOME: home };
    const session = hashSessionId(SID);
    if (shape !== 'quiet') [76, 80, 85].forEach((pct, i) =>
        appendQuotaSnapshot({ ts: now - (2 - i) * 5 * 60_000, session, five_hour: { pct, resets_at: reset }, account: 'claude/a' }, stateEnv),
    );
    if (shape !== 'raise' && shape !== 'quiet') {
        writeSwitchRecord(session, { id: ID, decision_told: false, checkpointed: false, outcome_told: false, expires_at: now + 86_400_000 }, stateEnv);
    }
    const env = {
        PATH: `${bin}:/usr/bin:/bin`,
        HOME: home,
        EVENT4U_CONFIG_HOME: home,
        FAKE_AS_SWITCH_FILE: reqFile,
        AGENT_CONFIG_HOOK_TIMINGS: path.join(home, 'timings.jsonl'),
    };
    return { home, ws, env, session, stateEnv, now };
}

function dispatch(event, env, ws) {
    const payload = JSON.stringify({ session_id: SID, prompt: 'weiter', cwd: ws, hook_event_name: event, transcript_path: path.join(ws, 't.jsonl') });
    const t0 = process.hrtime.bigint();
    spawnSync(process.execPath, [path.join(ROOT, 'dist/hooks/dispatch.js'), '--platform', 'claude', '--event', event], {
        input: payload, env, cwd: ws, encoding: 'utf-8', timeout: 60_000,
    });
    return Number(process.hrtime.bigint() - t0) / 1e6;
}

function concernMs(timings, concern) {
    if (!fs.existsSync(timings)) return null;
    const rows = fs.readFileSync(timings, 'utf-8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const hit = rows.filter((r) => r.concern === concern);
    return hit.length === 0 ? null : hit[hit.length - 1].duration_us / 1000;
}

function pct(xs, p) {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
}

const rows = [];
const cells = [];
for (const mode of ['absent', 'answering', 'failing', 'hanging', 'resting']) for (const shape of ['quiet', 'raise', 'relay', 'stop']) cells.push([mode, shape]);

for (const [mode, shape] of cells) {
    const n = mode === 'hanging' ? Math.min(N, 5) : N;
    const wall = [];
    const conc = [];
    const concern = shape === 'stop' ? 'session-eol' : 'quota-notice';
    const event = shape === 'stop' ? 'stop' : 'user_prompt_submit';
    for (let i = 0; i < n; i++) {
        const s = setup(mode === 'resting' ? 'failing' : mode, shape);
        if (mode === 'resting') {
            // Trip the back-off the way production does: three unanswered relays.
            for (let k = 0; k < 3; k++) dispatch('user_prompt_submit', { ...s.env, AGENT_CONFIG_HOOK_TIMINGS: path.join(s.home, 'warm.jsonl') }, s.ws);
        }
        wall.push(dispatch(event, s.env, s.ws));
        const c = concernMs(s.env.AGENT_CONFIG_HOOK_TIMINGS, concern);
        if (c !== null) conc.push(c);
        fs.rmSync(s.home, { recursive: true, force: true });
    }
    const f = (x) => x.toFixed(1);
    rows.push(
        `| ${mode} | ${shape} | ${n} | ${conc.length > 0 ? `${f(pct(conc, 50))} / ${f(pct(conc, 95))}` : 'n/a'} | ${f(pct(wall, 50))} / ${f(pct(wall, 95))} |`,
    );
    process.stderr.write(`${rows[rows.length - 1]}\n`);
}

console.log('| link | shape | n | concern ms p50 / p95 | whole dispatch ms p50 / p95 |');
console.log('|---|---|---|---|---|');
for (const r of rows) console.log(r);
