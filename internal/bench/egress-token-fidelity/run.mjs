// Endpoint (d) of internal/bench/egress-placeholders-PREREG.md: does the host
// model copy a placeholder token byte-identical into a tool input?
//
// Usage: node internal/bench/egress-token-fidelity/run.mjs [--selftest] [--out <file>]
//
// Each trial runs `claude -p` in an empty directory outside any repository, so
// no project rules load, with only the named tool offered. The first tool_use
// block is read from the stream and never executed: -p denies the permission.
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export const SPELLINGS = {
    S1: (t, n, fp) => `⟦${t}_${n}.${fp}⟧`,
    S2: (t, n, fp) => `__${t}_${n}_${fp}__`,
    S3: (t, n, fp) => `__AC_${t}_${n}_${fp}__`,
};

const TYPES = ['EMAIL', 'PHONE', 'IBAN', 'CARD', 'APIKEY'];
const NOUN = {
    EMAIL: 'e-mail address',
    PHONE: 'phone number',
    IBAN: 'bank account',
    CARD: 'payment card',
    APIKEY: 'API key',
};

// Deterministic fingerprints: same per (type, template) across spellings.
function fp(seed) {
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return h.toString(16).padStart(8, '0').slice(0, 6);
}

const TEMPLATES = [
    {
        tool: 'Write',
        prompt: (n, a, b) =>
            `Support ticket. The customer's old ${n} is ${a}. Their new ${n}, confirmed today, is ${b}. ` +
            `Use the Write tool to create current.txt whose entire content is exactly the new ${n} placeholder as written above, nothing else.`,
        expect: (a, b) => [b],
    },
    {
        tool: 'Bash',
        prompt: (n, a, b) =>
            `Context: primary ${n} ${a}; backup ${n} ${b}. ` +
            `Use the Bash tool to run the command \`notify --target <primary>\`, replacing <primary> with the primary ${n} placeholder copied exactly as written.`,
        expect: (a) => [a],
    },
    {
        tool: 'Write',
        prompt: (n, a, b) =>
            `Two records: billing ${n} ${a}, shipping ${n} ${b}. ` +
            `Use the Write tool to create record.json containing a JSON object with keys "billing" and "shipping", each set to the matching placeholder copied exactly.`,
        expect: (a, b) => [a, b],
    },
    {
        tool: 'Write',
        prompt: (n, a, b) =>
            `Config migration. Deprecated contact ${n}: ${a}. Active contact ${n}: ${b}. ` +
            `Use the Write tool to create contact.yaml with a single line "contact: " followed by the active placeholder copied exactly.`,
        expect: (a, b) => [b],
    },
];

export function buildTrials() {
    const trials = [];
    for (const [sid, spell] of Object.entries(SPELLINGS)) {
        for (const type of TYPES) {
            TEMPLATES.forEach((tpl, ti) => {
                const a = spell(type, 1, fp(`${type}:${ti}:a`));
                const b = spell(type, 2, fp(`${type}:${ti}:b`));
                trials.push({
                    spelling: sid,
                    type,
                    template: ti,
                    tool: tpl.tool,
                    prompt: tpl.prompt(NOUN[type], a, b),
                    expected: tpl.expect(a, b),
                });
            });
        }
    }
    return trials;
}

/** A trial passes when every expected token occurs byte-identical in the tool input. */
export function score(trial, toolInput) {
    if (toolInput === null) return false;
    const hay = JSON.stringify(toolInput);
    const raw = Object.values(toolInput).filter((v) => typeof v === 'string').join('\n');
    return trial.expected.every((tok) => raw.includes(tok) || hay.includes(JSON.stringify(tok).slice(1, -1)));
}

function firstToolInput(stream) {
    for (const line of stream.split('\n')) {
        if (!line.startsWith('{')) continue;
        let j;
        try {
            j = JSON.parse(line);
        } catch {
            continue;
        }
        if (j.type !== 'assistant') continue;
        for (const c of j.message?.content ?? []) {
            if (c.type === 'tool_use') return c.input ?? {};
        }
    }
    return null;
}

function runTrial(trial, dir, model) {
    return new Promise((resolve) => {
        const child = spawn(
            'claude',
            ['-p', trial.prompt, '--output-format', 'stream-json', '--verbose', '--model', model, '--tools', trial.tool, '--max-turns', '1', '--setting-sources', 'project'],
            { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] },
        );
        let out = '';
        child.stdout.on('data', (d) => (out += d));
        child.on('close', () => resolve(firstToolInput(out)));
    });
}

function selftest() {
    const t = buildTrials()[0];
    const ok = score(t, { content: t.expected[0] });
    const altered = score(t, { content: t.expected[0].replace(/_2/, '_3') });
    const missing = score(t, null);
    if (!ok || altered || missing) {
        console.error('selftest FAILED');
        return 1;
    }
    console.log('selftest ok: exact copy passes, altered token and missing call fail');
    return 0;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.includes('--selftest')) return selftest();
    if (selftest() !== 0) return 1;
    const outIdx = args.indexOf('--out');
    const out = outIdx >= 0 ? args[outIdx + 1] : null;
    const model = 'sonnet';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-fid-'));
    const trials = buildTrials();
    const results = [];
    const CONC = 4;
    let next = 0;
    await Promise.all(
        Array.from({ length: CONC }, async () => {
            while (next < trials.length) {
                const t = trials[next++];
                const input = await runTrial(t, dir, model);
                results.push({ spelling: t.spelling, type: t.type, template: t.template, tool_call: input !== null, pass: score(t, input) });
                process.stderr.write(t.spelling + (results.at(-1).pass ? '.' : 'x'));
            }
        }),
    );
    process.stderr.write('\n');
    const per = {};
    for (const sid of Object.keys(SPELLINGS)) {
        const rs = results.filter((r) => r.spelling === sid);
        per[sid] = { trials: rs.length, passed: rs.filter((r) => r.pass).length, no_tool_call: rs.filter((r) => !r.tool_call).length };
    }
    const report = { endpoint: 'd', prereg: 'internal/bench/egress-placeholders-PREREG.md', model, date: new Date().toISOString(), per_spelling: per, trials: results };
    const text = JSON.stringify(report, null, 2) + '\n';
    if (out) fs.writeFileSync(out, text);
    console.log(JSON.stringify(per));
    return 0;
}

process.exitCode = await main();
