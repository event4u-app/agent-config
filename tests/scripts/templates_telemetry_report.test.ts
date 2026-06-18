// Tests for src/agent-src/templates/scripts/telemetry_report.ts (ADR-094).
//
// Template-only entry point over the telemetry/ package. Golden-parity:
// python3 vs tsx on a fixed JSONL fixture, byte-identical stdout / stderr /
// exit for markdown and JSON formats. `--since all` is used everywhere so the
// wall-clock cutoff never enters the comparison; the malformed-line skip path
// and the quartile bucketing are exercised on a deterministic fixture.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { oracle } from '../_lib/parity_oracle';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const S = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');
const TS_SCRIPT = path.join(S, 'telemetry_report.ts');
// scriptStem is relative to REPO_ROOT; parity_oracle appends `.py` in capture mode.
const PY_STEM = 'src/agent-src/templates/scripts/telemetry_report';
const TSX_BIN = process.env.TSX_BIN
    ? path.resolve(REPO_ROOT, process.env.TSX_BIN)
    : path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tele-rep-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

/** Build a deterministic JSONL fixture with N distinct artefacts + skews. */
function makeLog(dir: string, opts: { malformed?: boolean; small?: boolean } = {}): string {
    const p = path.join(dir, 'log.jsonl');
    const lines: string[] = [];
    const ev = (ts: string, consulted: Record<string, string[]>, applied: Record<string, string[]>, outcomes?: string[]): string => {
        const obj: Record<string, unknown> = {
            schema_version: 1, ts, task_id: `tk-${lines.length}`, boundary_kind: 'task',
            consulted, applied,
        };
        if (outcomes) {
            obj['outcomes'] = outcomes;
        }
        // Compact sorted to match the on-disk shape (not strictly required —
        // the reader re-parses — but keeps the fixture honest).
        return JSON.stringify(obj);
    };
    const count = opts.small ? 2 : 8;
    for (let i = 1; i <= count; i += 1) {
        const day = String(i).padStart(2, '0');
        // skew applied counts so ranking + buckets are non-trivial
        const appliedTimes = i <= 2 ? 3 : (i <= 5 ? 1 : 0);
        lines.push(ev(`2026-01-${day}T00:00:00Z`, { skills: [`s${i}`] }, appliedTimes > 0 ? { skills: [`s${i}`] } : {}, i === 1 ? ['blocked', 'verification_failed'] : undefined));
        for (let k = 1; k < appliedTimes; k += 1) {
            const d2 = String(i).padStart(2, '0');
            lines.push(ev(`2026-02-${d2}T0${k}:00:00Z`, { skills: [`s${i}`] }, { skills: [`s${i}`] }));
        }
    }
    if (opts.malformed) {
        lines.push('this is not json');
        lines.push('{"schema_version":1,"ts":"2026-01-01T00:00:00Z"}'); // missing task_id → skipped
    }
    fs.writeFileSync(p, `${lines.join('\n')}\n`);
    return p;
}

interface Run {
    status: number | null;
    stdout: string;
    stderr: string;
}

function run(bin: string, script: string, args: string[]): Run {
    const r = spawnSync(bin, [script, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function assertParity(args: string[]): void {
    const py = oracle(PY_STEM, args, '');
    const ts = run(TSX_BIN, TS_SCRIPT, args);
    expect(ts.status).toBe(py.status);
    expect(ts.stdout).toBe(py.stdout);
    expect(ts.stderr).toBe(py.stderr);
}

describe('telemetry_report — golden parity (snapshot oracle vs tsx)', () => {
    it('markdown over an 8-artefact log (quartile buckets, --since all)', () => {
        const log = makeLog(mkTmp());
        assertParity(['--log-path', log, '--since', 'all']);
    });

    it('json over an 8-artefact log, no truncation (--top 0)', () => {
        const log = makeLog(mkTmp());
        assertParity(['--log-path', log, '--since', 'all', '--format', 'json', '--top', '0']);
    });

    it('json with truncation (--top 1 per bucket)', () => {
        const log = makeLog(mkTmp());
        assertParity(['--log-path', log, '--since', 'all', '--format', 'json', '--top', '1']);
    });

    it('markdown with malformed lines → skip + stderr warning', () => {
        const log = makeLog(mkTmp(), { malformed: true });
        assertParity(['--log-path', log, '--since', 'all']);
    });

    it('small log (2 artefacts) collapses the quartile cuts', () => {
        const log = makeLog(mkTmp(), { small: true });
        assertParity(['--log-path', log, '--since', 'all', '--format', 'json', '--top', '0']);
    });

    it('empty / missing log → empty-but-valid report, exit 0', () => {
        const missing = path.join(mkTmp(), 'nope.jsonl');
        assertParity(['--log-path', missing, '--since', 'all']);
        assertParity(['--log-path', missing, '--since', 'all', '--format', 'json']);
    });

    it('unparseable --since → byte-identical error + exit 2', () => {
        const log = makeLog(mkTmp());
        const args = ['--log-path', log, '--since', 'zzz'];
        const py = oracle(PY_STEM, args, '');
        const ts = run(TSX_BIN, TS_SCRIPT, args);
        expect(ts.status).toBe(py.status);
        expect(ts.status).toBe(2);
        expect(ts.stderr).toBe(py.stderr);
    });

    it('outcomes summary renders in markdown and json', () => {
        const log = makeLog(mkTmp());
        assertParity(['--log-path', log, '--since', 'all', '--top', '0']);
    });
});
