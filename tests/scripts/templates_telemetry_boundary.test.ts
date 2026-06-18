// Pure-TS behaviour test for the telemetry boundary twin
// (`src/agent-src/templates/scripts/telemetry/boundary.ts`).
//
// Ports `tests/telemetry/test_boundary.py` faithfully so the Python spec can be
// retired. Covers the `BoundarySession` lifecycle (coalesce + dedup + sort,
// empty-does-not-write, exception-suppresses-flush, double-flush idempotent,
// unknown-kind / unknown-boundary rejection) and `record_event`
// (validate-before-write, every-line-complete-JSON).
//
// Divergence note: the Python `test_record_event_concurrent_writes_no_interleaving`
// test uses `multiprocessing` to assert cross-process append atomicity via
// `fcntl.flock`. The TS twin documents itself as the best-effort-append branch
// (Node has no portable advisory lock) and is single-writer in tests; the
// realistic TS equivalent is sequential writers, which is the behaviour
// `test_record_event_each_line_is_complete_json` already asserts. The
// no-interleaving guarantee is therefore covered by the sequential round-trip
// below, not a process pool.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    BoundarySession,
    open_boundary,
    record_event,
} from '../../src/agent-src/templates/scripts/telemetry/boundary.js';
import {
    EngagementEvent,
    EngagementSchemaError,
    now_utc_iso,
    parse_event,
} from '../../src/agent-src/templates/scripts/telemetry/engagement.js';

const _tmpDirs: string[] = [];

function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'boundary-'));
    _tmpDirs.push(d);
    return d;
}

function readLines(p: string): string[] {
    return fs
        .readFileSync(p, 'utf-8')
        .split('\n')
        .filter((line) => line.trim().length > 0);
}

afterEach(() => {
    while (_tmpDirs.length > 0) {
        const d = _tmpDirs.pop();
        if (d) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

describe('BoundarySession', () => {
    it('coalesces duplicates into a single sorted, deduped event', () => {
        const log = path.join(mkTmp(), '.agent-engagement.jsonl');
        open_boundary('ticket-1', 'task', log, (session) => {
            session.add_consulted('skills', ['php-coder', 'eloquent']);
            session.add_consulted('skills', ['php-coder']); // duplicate
            session.add_applied('skills', ['php-coder']);
            session.add_applied('rules', ['scope-control']);
        });

        const lines = readLines(log);
        expect(lines).toHaveLength(1);
        const event = parse_event(`${lines[0]}\n`);
        expect(event.consulted).toEqual({ skills: ['eloquent', 'php-coder'] }); // sorted, deduped
        expect(event.applied).toEqual({ skills: ['php-coder'], rules: ['scope-control'] });
    });

    it('empty boundary does not write a file', () => {
        const log = path.join(mkTmp(), '.agent-engagement.jsonl');
        open_boundary('ticket-2', 'task', log, () => {
            // no add_* calls
        });
        expect(fs.existsSync(log)).toBe(false);
    });

    it('exception inside the boundary suppresses the flush', () => {
        const log = path.join(mkTmp(), '.agent-engagement.jsonl');
        expect(() =>
            open_boundary('ticket-3', 'phase-step', log, (session) => {
                session.add_consulted('skills', ['x']);
                throw new Error('boundary failed');
            }),
        ).toThrow('boundary failed');
        expect(fs.existsSync(log)).toBe(false);
    });

    it('double flush is idempotent', () => {
        const log = path.join(mkTmp(), '.agent-engagement.jsonl');
        const session = new BoundarySession({
            task_id: 'ticket-4',
            boundary_kind: 'task',
            log_path: log,
        });
        session.add_consulted('rules', ['scope-control']);
        expect(session.flush()).toBe(true);
        expect(session.flush()).toBe(false); // no-op on second call
        expect(readLines(log)).toHaveLength(1);
    });

    it('rejects an unknown artefact kind', () => {
        const log = path.join(mkTmp(), '.agent-engagement.jsonl');
        const session = new BoundarySession({
            task_id: 't',
            boundary_kind: 'task',
            log_path: log,
        });
        expect(() => session.add_consulted('plugins', ['x'])).toThrow(EngagementSchemaError);
        expect(() => session.add_consulted('plugins', ['x'])).toThrow('not an allowed artefact kind');
    });

    it('rejects an unknown boundary kind at construction', () => {
        const log = path.join(mkTmp(), 'log.jsonl');
        expect(
            () =>
                new BoundarySession({ task_id: 't', boundary_kind: 'day', log_path: log }),
        ).toThrow(EngagementSchemaError);
        expect(
            () =>
                new BoundarySession({ task_id: 't', boundary_kind: 'day', log_path: log }),
        ).toThrow('boundary_kind must be one of');
    });
});

describe('record_event', () => {
    it('validates before writing — no partial write on bad event', () => {
        const log = path.join(mkTmp(), '.agent-engagement.jsonl');
        const bad = new EngagementEvent({ ts: now_utc_iso(), task_id: '', boundary_kind: 'task' });
        expect(() => record_event(log, bad)).toThrow(EngagementSchemaError);
        expect(fs.existsSync(log)).toBe(false);
    });

    it('writes well-formed, non-interleaved lines that each round-trip', () => {
        // TS-equivalent of the Python concurrent-writers test: sequential
        // writers must each produce one complete, parseable line.
        const log = path.join(mkTmp(), '.agent-engagement.jsonl');
        const nWriters = 20;
        for (let i = 0; i < nWriters; i++) {
            record_event(
                log,
                new EngagementEvent({
                    ts: now_utc_iso(),
                    task_id: `ticket-${i}`,
                    boundary_kind: 'task',
                    consulted: { skills: [`skill-${i}`] },
                }),
            );
        }
        const lines = readLines(log);
        expect(lines).toHaveLength(nWriters);
        const seen = new Set<string>();
        for (const line of lines) {
            const event = parse_event(`${line}\n`);
            seen.add(event.task_id);
        }
        const expected = new Set(Array.from({ length: nWriters }, (_, i) => `ticket-${i}`));
        expect(seen).toEqual(expected);
    });

    it('every line is complete JSON, no truncation', () => {
        const log = path.join(mkTmp(), '.agent-engagement.jsonl');
        for (let i = 0; i < 5; i++) {
            record_event(
                log,
                new EngagementEvent({
                    ts: now_utc_iso(),
                    task_id: `t-${i}`,
                    boundary_kind: 'task',
                    consulted: { skills: ['x'] },
                }),
            );
        }
        for (const line of readLines(log)) {
            const parsed = JSON.parse(line) as Record<string, unknown>;
            expect(parsed['schema_version']).toBe(1);
            expect(parsed['boundary_kind']).toBe('task');
        }
    });
});
