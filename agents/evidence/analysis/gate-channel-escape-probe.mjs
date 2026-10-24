#!/usr/bin/env node
// Exploratory fixture for D27 — not normative evidence.
// Does an escaped descendant alter the accepted bytes of a producer channel?
// Compares a regular-file channel against a validator-owned pipe whose
// collection the validator stops itself. `pipe-eof` is the sensitivity control:
// the same pipe, collected until EOF, so the late write must be accepted. Usage: node gate-channel-escape-probe.mjs [repeats]
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const REPEATS = Number(process.argv[2] ?? 5);
const GRACE_MS = 150;
const LATE_WRITE_MS = 400;
const READ_AFTER_MS = 800;

const GOOD = '{"v":1,"aspect":"a","evaluation":"fail"}\n{"v":1,"end":true,"aspects":1}\n';
const FORGED = '{"v":1,"aspect":"a","evaluation":"pass"}\n';

// The producer writes its records, then starts a grandchild in a NEW session
// (detached => setsid), so a kill of the producer's process group misses it.
// The grandchild writes a forged record after the producer has exited.
const PRODUCER = `
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const mode = process.env.PROBE_MODE, escape = process.env.PROBE_ESCAPE === '1';
const write = (s) => mode === 'file' ? fs.appendFileSync(process.env.PROBE_CHANNEL, s) : fs.writeSync(3, s);
write(${JSON.stringify(GOOD)});
if (escape) {
  const late = "setTimeout(() => { try { " + (mode === 'file'
    ? "require('node:fs').appendFileSync(process.env.PROBE_CHANNEL, " + JSON.stringify(${JSON.stringify(FORGED)}) + ")"
    : "require('node:fs').writeSync(3, " + JSON.stringify(${JSON.stringify(FORGED)}) + ")")
    + "; require('node:fs').writeFileSync(process.env.PROBE_ALIVE, 'wrote'); } catch (e) { require('node:fs').writeFileSync(process.env.PROBE_ALIVE, 'err:' + e.code); } }, ${LATE_WRITE_MS});";
  const stdio = mode === 'file' ? 'ignore' : ['ignore', 'ignore', 'ignore', 3];
  spawn(process.execPath, ['-e', late], { detached: true, stdio, env: process.env }).unref();
}
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function killGroup(pid) {
    try {
        process.kill(-pid, 'SIGTERM');
    } catch {}
}

async function runOnce(mode, escape) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chan-'));
    fs.chmodSync(dir, 0o700);
    const channel = path.join(dir, 'channel.jsonl');
    const alive = path.join(dir, 'alive');
    fs.writeFileSync(channel, '', { mode: 0o600 });
    const env = { PATH: process.env.PATH, PROBE_MODE: mode, PROBE_ESCAPE: escape ? '1' : '0', PROBE_CHANNEL: channel, PROBE_ALIVE: alive };
    const stdio = mode === 'file' ? 'ignore' : ['ignore', 'ignore', 'ignore', 'pipe'];
    env.PROBE_MODE = mode === 'file' ? 'file' : 'pipe';
    const child = spawn(process.execPath, ['-e', PRODUCER], { detached: true, stdio, env });

    let accepted = '';
    const piped = mode !== 'file';
    let collecting = piped;
    const eof = piped ? new Promise((r) => child.stdio[3].once('close', r)) : null;
    if (piped) {
        child.stdio[3].on('data', (b) => {
            if (collecting) accepted += b.toString('utf8');
        });
        child.stdio[3].on('error', () => {});
    }
    await new Promise((r) => child.once('exit', r));
    await sleep(GRACE_MS);
    killGroup(child.pid);
    if (mode === 'pipe-eof') await eof;
    if (mode === 'pipe') {
        // The validator, not EOF, ends collection.
        collecting = false;
        child.stdio[3].destroy();
    }
    await sleep(READ_AFTER_MS);
    if (mode === 'file') accepted = fs.readFileSync(channel, 'utf8');
    const grandchild = fs.existsSync(alive) ? fs.readFileSync(alive, 'utf8') : 'no-report';
    fs.rmSync(dir, { recursive: true, force: true });
    return { mode, escape, forgedAccepted: accepted.includes('"pass"'), acceptedEqualsGood: accepted === GOOD, grandchild };
}

const results = [];
for (const mode of ['file', 'pipe', 'pipe-eof']) {
    for (const escape of [false, true]) {
        for (let i = 0; i < REPEATS; i++) results.push(await runOnce(mode, escape));
    }
}
const summary = {};
for (const r of results) {
    const k = `${r.mode}/${r.escape ? 'escape' : 'control'}`;
    summary[k] ??= { runs: 0, forgedAccepted: 0, acceptedEqualsGood: 0, grandchild: {} };
    const s = summary[k];
    s.runs++;
    s.forgedAccepted += r.forgedAccepted ? 1 : 0;
    s.acceptedEqualsGood += r.acceptedEqualsGood ? 1 : 0;
    s.grandchild[r.grandchild] = (s.grandchild[r.grandchild] ?? 0) + 1;
}
console.log(JSON.stringify({ node: process.version, platform: process.platform, GRACE_MS, LATE_WRITE_MS, READ_AFTER_MS, summary }, null, 2));
