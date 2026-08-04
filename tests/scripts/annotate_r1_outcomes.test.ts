// Tests for src/scripts/annotate_r1_outcomes.ts — the Gate R1 quarterly
// outcome-annotation helper (docs/contracts/plan-review-gates.md § 7).
//
// Two round-3 finding-11 defects are the regression contract here:
//   (a) the prompt loop awaited `rl.question`, whose callback never fires on
//       EOF, so any non-interactive invocation hung forever;
//   (b) `extractRegisterRows` matched each column as a negated-pipe class, so a
//       backslash-escaped pipe inside a cell — the shape the contract's own
//       § 1.2 table example uses (`product \| implementation`) — shifted the
//       column alignment and recorded the DESCRIPTION as the mitigation.
//
// Everything runs against a throwaway cwd under mkdtemp: the helper resolves
// `agents/roadmaps/archive/` and `agents/evidence/metrics/` relative to the
// process cwd, so no tracked corpus or metrics file is ever touched.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';

import { runInProcAsync } from '../_lib/run_in_process.js';
import { annotatedKeys, extractRegisterRows, main } from '../../src/scripts/annotate_r1_outcomes.js';

const ARCHIVE_REL = path.join('agents', 'roadmaps', 'archive');
const METRICS_REL = path.join('agents', 'evidence', 'metrics', 'gate-metrics.jsonl');

const tmpDirs: string[] = [];
afterEach(() => {
    for (const d of tmpDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

/** A § 1.2 register whose Risk-type cell carries the contract's escaped pipe. */
const REGISTER = [
    '# Roadmap: annotated',
    '',
    '## Risk Register',
    '<!-- risk-review: v1 | reviewed: 2026-08-04 | reviewer: tester -->',
    '| Rank | Item | Risk type | Description | Mitigation | Anchored under |',
    '|------|------|-----------|-------------|------------|----------------|',
    '| 1 | Escaped cell | product \\| implementation | describes the risk | THE MITIGATION | Phase 1 |',
    '| 2 | Plain cell | implementation | plain description | second mitigation | Phase 2 |',
    '',
    '## Notes',
    '',
    '| 3 | not in the register | — | — | — | — |',
    '',
].join('\n');

function makeCwd(register = REGISTER): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'r1-annotate-')));
    tmpDirs.push(dir);
    fs.mkdirSync(path.join(dir, ARCHIVE_REL), { recursive: true });
    fs.mkdirSync(path.join(dir, path.dirname(METRICS_REL)), { recursive: true });
    fs.writeFileSync(path.join(dir, ARCHIVE_REL, 'road-x.md'), register, 'utf-8');
    return dir;
}

describe('annotate_r1_outcomes — extractRegisterRows', () => {
    it('honours an escaped pipe inside a cell instead of shifting the columns', () => {
        const rows = extractRegisterRows('road-x.md', REGISTER);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual({
            file: 'road-x.md',
            rank: 1,
            item: 'Escaped cell',
            mitigation: 'THE MITIGATION',
        });
        // The unescaped row must keep working identically.
        expect(rows[1]?.mitigation).toBe('second mitigation');
    });

    it('stops at the next section and skips header / separator rows', () => {
        const rows = extractRegisterRows('road-x.md', REGISTER);
        expect(rows.map((r) => r.rank)).toEqual([1, 2]);
    });

    it('reads a CRLF archived roadmap', () => {
        const rows = extractRegisterRows('road-x.md', REGISTER.replace(/\n/g, '\r\n'));
        expect(rows.map((r) => r.mitigation)).toEqual(['THE MITIGATION', 'second mitigation']);
    });

    it('annotatedKeys tolerates foreign JSONL lines', () => {
        const keys = annotatedKeys(
            ['{"event":"r2_review"}', 'not json at all', '{"event":"r1_mitigation_outcome","file":"a.md","rank":1}'].join(
                '\n',
            ),
        );
        expect([...keys]).toEqual(['a.md#1']);
    });
});

describe('annotate_r1_outcomes — non-interactive input', () => {
    it('a closed input stream ends the pass cleanly instead of hanging', async () => {
        const cwd = makeCwd();
        const res = await runInProcAsync((argv) => main(argv as string[], { input: Readable.from([]) }), [], { cwd });
        expect(res.status).toBe(0);
        expect(res.stdout).toContain('stdin closed');
        // EOF records nothing — the metrics file stays absent.
        expect(fs.existsSync(path.join(cwd, METRICS_REL))).toBe(false);
    }, 5_000);

    // Input that runs out BETWEEN two prompts is the same end-of-input state:
    // `rl.question` on an already-closed interface throws ERR_USE_AFTER_CLOSE,
    // which must end the pass cleanly rather than crash it.
    it('one answer then exhausted input records that answer and exits 0', async () => {
        const cwd = makeCwd(); // two pending rows
        const input = new PassThrough();
        input.end('helped\n');
        const res = await runInProcAsync((argv) => main(argv as string[], { input }), [], { cwd });
        expect(res.stderr).toBe('');
        expect(res.status).toBe(0);
        const lines = fs
            .readFileSync(path.join(cwd, METRICS_REL), 'utf-8')
            .split('\n')
            .filter(Boolean)
            .map((l) => JSON.parse(l) as Record<string, unknown>);
        expect(lines).toHaveLength(1);
        expect(lines[0]?.event).toBe('r1_mitigation_outcome');
        expect(lines[0]?.rank).toBe(1);
        expect(lines[0]?.outcome).toBe('helped');
        // The prompt showed the mitigation cell, not the description cell —
        // the escaped-pipe row would otherwise report `describes the risk`.
        expect(res.stdout).toContain('mitigation: THE MITIGATION');
    }, 5_000);

    it('--list is read-only and needs no input at all', async () => {
        const cwd = makeCwd();
        const res = await runInProcAsync((argv) => main(argv as string[]), ['--list'], { cwd });
        expect(res.status).toBe(0);
        expect(res.stdout).toContain('#1 — Escaped cell');
        expect(fs.existsSync(path.join(cwd, METRICS_REL))).toBe(false);
    }, 5_000);

    it('nothing pending → exit 0 without touching the metrics file', async () => {
        const cwd = makeCwd('# Roadmap: no register\n\n## Phase 1\n\n- [x] done\n');
        const res = await runInProcAsync((argv) => main(argv as string[]), [], { cwd });
        expect(res.status).toBe(0);
        expect(res.stdout).toContain('No un-annotated Risk-Register rows');
    }, 5_000);
});
