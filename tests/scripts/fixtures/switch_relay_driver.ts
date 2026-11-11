// One hook's half of the agent-switch link, run as its own process so two of
// them can overlap for real.
// argv[2] is a JSON job:
//   { op: 'prompt' | 'stop', session, stateHome, binEnv, startAt?, holdMs?, log?, label?, pidFile? }
// `prompt` runs the prompt hook's reply and prints its lines as JSON.
// `stop` runs the Stop path's checkpoint; its write appends `<label>:start` and
// `<label>:written` to `log` around a `holdMs` pause, and prints whether it wrote.
import * as fs from 'node:fs';

import { checkpointBeforeMove } from '../../../src/scripts/_lib/switch_relay.js';
import { hashSessionId } from '../../../src/scripts/_lib/quota_ledger.js';
import { noticeReply } from '../../../src/scripts/quota_notice_hook.js';

interface Job {
    op: 'prompt' | 'stop';
    session: string;
    stateHome: string;
    binEnv: Record<string, string>;
    startAt?: number;
    holdMs?: number;
    log?: string;
    label?: string;
    pidFile?: string;
}

const job = JSON.parse(process.argv[2] ?? '{}') as Job;
const stateEnv = { EVENT4U_CONFIG_HOME: job.stateHome };
const env = { AGENT_CONFIG_SWITCH_QUESTION: '1' };
if (job.pidFile !== undefined) fs.writeFileSync(job.pidFile, String(process.pid));

function sleep(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Both processes start their work at the same instant, after their startup.
if (job.startAt !== undefined) sleep(Math.max(0, job.startAt - Date.now()));

if (job.op === 'prompt') {
    const r = noticeReply({
        sessionId: job.session,
        viaHost: true,
        env,
        stateEnv,
        billing: { billing_class: 'plan', source: null },
        now: Date.now(),
        link: { env: job.binEnv },
    });
    process.stdout.write(JSON.stringify(r.lines));
} else {
    const note = (what: string): void => {
        if (job.log !== undefined) fs.appendFileSync(job.log, `${job.label ?? process.pid}:${what}\n`);
    };
    const wrote = checkpointBeforeMove(
        hashSessionId(job.session),
        () => {
            note('start');
            sleep(job.holdMs ?? 0);
            note('written');
            return true;
        },
        stateEnv,
        { env: job.binEnv },
        env,
    );
    process.stdout.write(JSON.stringify(wrote));
}
