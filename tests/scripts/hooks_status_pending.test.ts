/**
 * `hooks:status --pending` — the enumeration half (dispatch-safety Phase 2.3).
 *
 * Two things have to hold and only one of them is obvious. The obvious one: a
 * staged action is listed. The other: the DEFAULT output is untouched, because
 * `hooks:status` is pinned byte-for-byte by other callers (`task hooks-status`,
 * post-install smoke, CI) and folding a second report into it would break them
 * for a reason no caller asked for.
 *
 * The empty state is asserted on its wording, not just its emptiness — "0
 * pending" and "nothing can stage yet" are different facts, and a reader who
 * cannot tell them apart will read an unbound primitive as a working one.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { stageAction } from '../../src/agent-src/templates/scripts/work_engine/hooks/builtin/confirmation.js';
import { _render_pending, main } from '../../src/scripts/hooks_status.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-pending-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function capture(argv: string[]): { out: string; code: number } {
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as unknown as { write: (s: string) => boolean }).write = (s: string) => {
        chunks.push(String(s));
        return true;
    };
    try {
        const code = main(argv);
        return { out: chunks.join(''), code };
    } finally {
        (process.stdout as unknown as { write: typeof orig }).write = orig;
    }
}

describe('hooks:status --pending', () => {
    it('empty store → says WHY it is empty, not only that it is', () => {
        const { out, code } = capture(['--pending', '--project-root', root]);
        expect(code).toBe(0);
        expect(out).toContain('pending confirmations: none');
        expect(out).toContain('ships unbound');
    });

    it('lists a staged action with its token, verb and object', () => {
        stageAction(
            root,
            { gate_id: 'require_memory_hits', phase: 'refine', action: 'advance', object: 'refine' },
            { token: 'tok-9', now: '2026-08-11T00:00:00.000Z' },
        );
        const { out, code } = capture(['--pending', '--project-root', root]);
        expect(code).toBe(0);
        expect(out).toContain('pending confirmations: 1');
        expect(out).toContain('tok-9');
        expect(out).toContain('advance → refine');
        expect(out).toContain('gate=require_memory_hits');
    });

    it('--format json emits the records as an array', () => {
        stageAction(
            root,
            { gate_id: 'g', phase: '', action: 'publish', object: 'v9.34.0' },
            { token: 'tok-json' },
        );
        const { out } = capture(['--pending', '--format', 'json', '--project-root', root]);
        const parsed = JSON.parse(out) as { token: string; object: string }[];
        expect(parsed).toHaveLength(1);
        expect(parsed[0]?.token).toBe('tok-json');
        expect(parsed[0]?.object).toBe('v9.34.0');
    });

    it('a phase-less staging renders a placeholder rather than an empty field', () => {
        stageAction(root, { gate_id: 'g', phase: '', action: 'publish', object: 'x' }, { token: 't' });
        const { out } = capture(['--pending', '--project-root', root]);
        expect(out).toContain('phase=-');
    });

    it('_render_pending is pure — same rows, same string', () => {
        const rows = [
            {
                token: 't1',
                gate_id: 'g',
                phase: 'p',
                action: 'a',
                object: 'o',
                staged_at: '2026-08-11T00:00:00.000Z',
            },
        ];
        expect(_render_pending(rows)).toBe(_render_pending(rows));
    });
});
