#!/usr/bin/env tsx
/**
 * Egress canary run — road-to-free-hands-a-paid-head-checks step 1.3.
 *
 * Planted synthetic values — credentials, personal data and internal
 * identifiers — are placed in the payload, in the system prompt and in rule
 * text a payload could quote, and sent through `ask_transport` to an
 * OpenAI-compatible mock on loopback that records every body it receives. No
 * network, synthetic values only.
 *
 * Each canary × placement is reported as:
 *   replaced       — it left as a placeholder;
 *   refused        — the final check refused the call, with its reason;
 *   not-detectable — it left in clear and no rule in the final check sees it
 *                    on its own (identifier rows have not landed for it);
 * and `leaked` lists any canary the final check WOULD refuse on its own that
 * still reached the mock in clear. Zero observed leaks is a test result, never
 * a guarantee.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { askOnce } from './ask_transport.js';
import { _OpenAICompatibleClient, type ExternalAIClient } from './ai_council/clients.js';
import { councilEgress, resetCouncilEgress } from './ai_council/council_egress.js';

export interface Canary {
    readonly id: string;
    readonly class: 'credential' | 'personal' | 'internal';
    readonly value: string;
}

/**
 * Synthetic: no value below belongs to anyone or opens anything. Prefixes are
 * assembled from parts so the rule table stays the one place that spells one.
 */
export const CANARIES: readonly Canary[] = [
    { id: 'anthropic-key', class: 'credential', value: `${'s' + 'k-' + 'ant-' + 'api03-'}${'CANARYx7Qm2LwZp9Rt4Vn8Kd3Hs6Jf1Bg5'.repeat(2)}AA` },
    { id: 'github-pat', class: 'credential', value: 'gh' + 'p_' + 'CANARY0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5' },
    { id: 'huggingface-token', class: 'credential', value: 'h' + 'f_' + 'CANARYabcdefghijklmnopqrstuvwxyzABCD' },
    { id: 'aws-access-key', class: 'credential', value: 'AK' + 'IA' + 'CANARY7Q2W3E4R5T' },
    { id: 'email', class: 'personal', value: 'max.mustermann.canary' + '@' + 'galawork-kunde.de' },
    { id: 'iban', class: 'personal', value: 'DE89' + '3704' + '0044' + '0532' + '0130' + '00' },
    { id: 'phone', class: 'personal', value: '+49 170' + ' 1234567' },
    { id: 'repo-path', class: 'internal', value: '/Users/canary-owner/projects/galawork/secret-module' },
    { id: 'internal-host', class: 'internal', value: 'billing-db.canary.internal' },
];

export const PLACEMENTS = ['payload', 'system', 'rule-text'] as const;
export type Placement = (typeof PLACEMENTS)[number];

export interface CanaryRow {
    canary: string;
    class: Canary['class'];
    placement: Placement;
    outcome: 'replaced' | 'refused' | 'not-detectable';
    placeholder?: string;
    reason?: string;
}

export interface CanaryReport {
    rows: CanaryRow[];
    leaked: string[];
}

const MOCK = `
const http = require('node:http');
const fs = require('node:fs');
const out = process.argv[1];
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => (body += d));
  req.on('end', () => {
    fs.appendFileSync(out, JSON.stringify(body) + '\\n');
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ model: 'mock', choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
  });
});
server.listen(0, '127.0.0.1', () => process.stdout.write(String(server.address().port) + '\\n'));
`;

async function startMock(recordFile: string): Promise<{ port: number; stop: () => void }> {
    const child = spawn(process.execPath, ['-e', MOCK, recordFile], { stdio: ['ignore', 'pipe', 'inherit'] });
    const port = await new Promise<number>((resolve, reject) => {
        child.stdout.once('data', (d: Buffer) => resolve(Number(d.toString().trim())));
        child.once('exit', (code) => reject(new Error(`mock exited ${code}`)));
    });
    return { port, stop: () => child.kill() };
}

function placeIn(placement: Placement, value: string): { system: string; prompt: string } {
    const base = 'Summarise the given text in one line.';
    if (placement === 'system') return { system: `You are a summariser. Context id: ${value}.`, prompt: base };
    if (placement === 'rule-text') {
        return { system: 'You are a summariser.', prompt: `${base}\n\nQuoted rule:\n> Contact the owner at ${value} before editing.` };
    }
    return { system: 'You are a summariser.', prompt: `${base}\n\nText: the job failed while reading ${value}.` };
}

function readBodies(file: string): string[] {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as string);
}

/**
 * `identifiers: true` is the `protect` mode, the one free hands send under: the
 * final check then refuses identifiers as well as credentials.
 */
export async function runEgressCanary(opts: { readonly identifiers: boolean } = { identifiers: true }): Promise<CanaryReport> {
    resetCouncilEgress(opts);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-canary-'));
    const recordFile = path.join(dir, 'bodies.jsonl');
    const mock = await startMock(recordFile);
    const rows: CanaryRow[] = [];
    const leaked: string[] = [];
    try {
        const client = new _OpenAICompatibleClient({ model: 'mock', api_key: 'mock-key', base_url: `http://127.0.0.1:${mock.port}/v1` });
        for (const canary of CANARIES) {
            const detectable = councilEgress().check(canary.value);
            for (const placement of PLACEMENTS) {
                const before = readBodies(recordFile).length;
                const { system, prompt } = placeIn(placement, canary.value);
                await askOnce(prompt, { members: [client as unknown as ExternalAIClient], systemPrompt: system, auditDir: null });
                const sent = readBodies(recordFile).slice(before);
                const row: CanaryRow = { canary: canary.id, class: canary.class, placement, outcome: 'not-detectable' };
                if (sent.length === 0) {
                    row.outcome = 'refused';
                    row.reason = detectable !== null ? `${detectable.reason} (${detectable.what})` : 'refused before send';
                } else if (sent.some((b) => b.includes(canary.value))) {
                    if (detectable !== null) leaked.push(`${canary.id}@${placement}`);
                    row.outcome = 'not-detectable';
                } else {
                    row.outcome = 'replaced';
                    row.placeholder = sent.join('').match(/__[A-Z]+_\d+_[a-z0-9]+__/)?.[0] ?? 'placeholder';
                }
                rows.push(row);
            }
        }
    } finally {
        resetCouncilEgress();
        mock.stop();
        fs.rmSync(dir, { recursive: true, force: true });
    }
    return { rows, leaked };
}

async function main(): Promise<number> {
    const report = await runEgressCanary();
    for (const r of report.rows) {
        const extra = r.outcome === 'refused' ? ` — ${r.reason}` : r.outcome === 'replaced' ? ` — ${r.placeholder}` : '';
        process.stdout.write(`${r.canary.padEnd(18)} ${r.class.padEnd(10)} ${r.placement.padEnd(9)} ${r.outcome}${extra}\n`);
    }
    if (report.leaked.length > 0) {
        process.stderr.write(`❌  egress_canary: ${report.leaked.length} detectable canary(ies) reached the mock in clear: ${report.leaked.join(', ')}\n`);
        return 1;
    }
    process.stdout.write(`✅  egress_canary: no detectable canary left in clear (${report.rows.length} placements). A test result, never a guarantee.\n`);
    return 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
    void main().then((code) => process.exit(code));
}
