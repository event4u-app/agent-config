// Tests for src/scripts/ai_council/events_log.ts (py2ts Phase 1).
//
// Appends one JSON line per council event. The only non-determinism is
// `ts_utc` (wall-clock); the TS twin accepts an injectable `now` for unit
// tests, and the golden-parity check strips `ts_utc` from BOTH sides before
// comparing the JSON line byte-for-byte (the timestamp format itself is
// asserted separately).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    SCHEMA_VERSION,
    appendEvent,
    defaultLogPath,
} from '../../../src/scripts/ai_council/events_log.js';

const PY_MOD = 'src/scripts/ai_council/events_log.py';

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Append `event` (Python literal) to `logPath` via the Python twin; return the line. */
function pyAppend(eventPyLiteral: string, logPath: string): string {
    const code = [
        'import importlib.util, sys',
        `spec = importlib.util.spec_from_file_location("el", ${JSON.stringify(PY_MOD)})`,
        'el = importlib.util.module_from_spec(spec)',
        'sys.modules["el"] = el',
        'spec.loader.exec_module(el)',
        `el.append_event(${eventPyLiteral}, log_path=el.Path(${JSON.stringify(logPath)}))`,
        `print(open(${JSON.stringify(logPath)}, encoding="utf-8").read(), end="")`,
    ].join('\n');
    const r = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr}`);
    }
    return r.stdout;
}

const created: string[] = [];
function tmpDir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'el-test-'));
    created.push(d);
    return d;
}
afterEach(() => {
    delete process.env.AGENT_CONFIG_NO_EVENTS_LOG;
    while (created.length) {
        fs.rmSync(created.pop()!, { recursive: true, force: true });
    }
});

/** Strip the wall-clock `ts_utc` field from a JSON line for stable comparison. */
function stripTs(line: string): unknown {
    const rec = JSON.parse(line.trim()) as Record<string, unknown>;
    delete rec.ts_utc;
    return rec;
}

const FIXED = new Date(Date.UTC(2026, 5, 14, 8, 30, 15));

describe('events_log — write + schema', () => {
    it('writes a v1 record, injects hash, pops original_ask', () => {
        const lp = path.join(tmpDir(), 'events.log');
        const event: Record<string, unknown> = {
            lens: 'security',
            invocation: '/council',
            action: 'skip_necessity',
            verdict: 'no',
            provider_caps: { api: true },
            original_ask: 'Why skip this?',
            category: 'extra',
        };
        expect(appendEvent(event, { logPath: lp, now: FIXED })).toBe(true);
        expect('original_ask' in event).toBe(false); // popped (Python side effect)

        const rec = JSON.parse(fs.readFileSync(lp, 'utf-8').trim()) as Record<string, unknown>;
        expect(rec.schema_version).toBe(SCHEMA_VERSION);
        expect(rec.ts_utc).toBe('2026-06-14T08:30:15Z');
        expect(rec.lens).toBe('security');
        expect(rec.action).toBe('skip_necessity');
        expect(rec.provider_caps).toEqual({ api: true });
        expect(rec.original_ask_hash).toMatch(/^[0-9a-f]{12}$/);
        expect('original_ask' in rec).toBe(false);
        expect(rec.category).toBe('extra'); // pass-through
    });

    it('empty original_ask → sentinel hash', () => {
        const lp = path.join(tmpDir(), 'e.log');
        appendEvent({ action: 'proceed' }, { logPath: lp, now: FIXED });
        const rec = JSON.parse(fs.readFileSync(lp, 'utf-8').trim()) as Record<string, unknown>;
        expect(rec.original_ask_hash).toBe('000000000000');
    });

    it('appends (does not truncate) across calls', () => {
        const lp = path.join(tmpDir(), 'multi.log');
        appendEvent({ action: 'proceed' }, { logPath: lp, now: FIXED });
        appendEvent({ action: 'block_quota' }, { logPath: lp, now: FIXED });
        const lines = fs.readFileSync(lp, 'utf-8').trimEnd().split('\n');
        expect(lines).toHaveLength(2);
    });

    it('creates the parent dir on demand', () => {
        const lp = path.join(tmpDir(), 'nested', 'deep', 'events.log');
        expect(appendEvent({ action: 'proceed' }, { logPath: lp, now: FIXED })).toBe(true);
        expect(fs.existsSync(lp)).toBe(true);
    });

    it('schema-v1 fields win over pass-through collisions', () => {
        const lp = path.join(tmpDir(), 'c.log');
        appendEvent(
            { action: 'proceed', lens: 'real', schema_version: 999, ts_utc: 'fake' },
            { logPath: lp, now: FIXED },
        );
        const rec = JSON.parse(fs.readFileSync(lp, 'utf-8').trim()) as Record<string, unknown>;
        expect(rec.schema_version).toBe(1);
        expect(rec.ts_utc).toBe('2026-06-14T08:30:15Z');
        expect(rec.lens).toBe('real');
    });

    it('invalid action throws (Python ValueError parity)', () => {
        expect(() => appendEvent({ action: 'nope' }, { logPath: path.join(tmpDir(), 'x.log') })).toThrow(
            "events_log: action='nope' not in ['block_quota', 'proceed', 'skip_necessity'].",
        );
    });

    it('missing action throws with None repr', () => {
        expect(() => appendEvent({}, { logPath: path.join(tmpDir(), 'x.log') })).toThrow(
            "events_log: action=None not in ['block_quota', 'proceed', 'skip_necessity'].",
        );
    });

    it('kill-switch suppresses the write (returns false, no file)', () => {
        process.env.AGENT_CONFIG_NO_EVENTS_LOG = '1';
        const lp = path.join(tmpDir(), 'killed.log');
        expect(appendEvent({ action: 'proceed' }, { logPath: lp })).toBe(false);
        expect(fs.existsSync(lp)).toBe(false);
    });

    it('kill-switch falsy values do NOT suppress', () => {
        const lp = path.join(tmpDir(), 'k.log');
        for (const v of ['', '0', 'false', 'False']) {
            process.env.AGENT_CONFIG_NO_EVENTS_LOG = v;
            expect(appendEvent({ action: 'proceed' }, { logPath: lp, now: FIXED })).toBe(true);
        }
    });

    it('defaultLogPath ends with the canonical suffix', () => {
        expect(defaultLogPath().endsWith(path.join('agents', 'runtime', 'council', 'events.log'))).toBe(
            true,
        );
    });
});

describe.runIf(hasPython3())('events_log — golden parity vs CPython twin', () => {
    const cases: Array<{ desc: string; tsEvent: () => Record<string, unknown>; pyLiteral: string }> =
        [
            {
                desc: 'full record with non-ASCII ask + pass-through',
                tsEvent: () => ({
                    lens: 'security',
                    invocation: '/council',
                    action: 'skip_necessity',
                    verdict: 'no',
                    provider_caps: { api: true, cli: false },
                    original_ask: 'Why skip? äöü ümlaut',
                    category: 'extra',
                    rationale: 'quota',
                }),
                pyLiteral:
                    "{'lens':'security','invocation':'/council','action':'skip_necessity','verdict':'no','provider_caps':{'api':True,'cli':False},'original_ask':'Why skip? äöü ümlaut','category':'extra','rationale':'quota'}",
            },
            {
                desc: 'minimal proceed (defaults + sentinel hash)',
                tsEvent: () => ({ action: 'proceed' }),
                pyLiteral: "{'action':'proceed'}",
            },
            {
                desc: 'block_quota with empty caps',
                tsEvent: () => ({ action: 'block_quota', lens: 'cost', original_ask: 'long ask here' }),
                pyLiteral: "{'action':'block_quota','lens':'cost','original_ask':'long ask here'}",
            },
        ];

    it.each(cases)('$desc — line matches (sans ts_utc)', ({ tsEvent, pyLiteral }) => {
        const tsLog = path.join(tmpDir(), 'ts.log');
        const pyLog = path.join(tmpDir(), 'py.log');
        appendEvent(tsEvent(), { logPath: tsLog, now: FIXED });
        const tsLine = fs.readFileSync(tsLog, 'utf-8');
        const pyLine = pyAppend(pyLiteral, pyLog);

        // ts_utc differs (wall-clock) — strip and compare the parsed record.
        expect(stripTs(tsLine)).toEqual(stripTs(pyLine));

        // Byte-parity of everything except the ts_utc value: replace the
        // ts_utc value in both with a placeholder and compare the raw line.
        const norm = (l: string): string => l.trim().replace(/"ts_utc":"[^"]*"/, '"ts_utc":"X"');
        expect(norm(tsLine)).toBe(norm(pyLine));
    });

    it('Python ts_utc format is YYYY-MM-DDTHH:MM:SSZ (matches TS shape)', () => {
        const pyLog = path.join(tmpDir(), 'fmt.log');
        const line = pyAppend("{'action':'proceed'}", pyLog);
        const rec = JSON.parse(line.trim()) as Record<string, unknown>;
        expect(rec.ts_utc).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });
});
