// Tests for src/scripts/telegraph_stats.ts (py2ts Phase 8 / Wave 8e).
//
// No pytest suite existed, so this is a focused differential suite:
//   1. In-process unit checks of the pure functions (aggregate, render_text)
//      with crafted rows — exercises the suspended-multiplier guard (delta=0),
//      multi-session / multi-conversation bucketing, and the SUSPENDED note.
//   2. A CLI layer (tsx subprocess) on a deterministic temp-fixture JSONL —
//      exercises --input / --format arg parsing and exit codes end-to-end.
//      Converted from the retired python3-vs-tsx golden parity block (the
//      Python original was deleted); fixtures replace the real sessions.jsonl
//      so output is fully deterministic (delta is a hard 0 while the
//      multiplier is suspended).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { aggregate, render_text } from '../../src/scripts/telegraph_stats.js';
import { runTs } from './_wave8e.js';

describe('telegraph_stats — in-process units', () => {
    it('aggregate buckets by session + conversation; delta=0 while suspended', () => {
        const rows = [
            { sessionId: 's1', conversation_id: 'c1', telegraph_condensed_tokens: 100, telegraph_delta_tokens: 42 },
            { sessionId: 's1', conversation_id: 'c2', telegraph_condensed_tokens: 50 },
            { session_id: 's2', conversation_id: 'c1', telegraph_condensed_tokens: 10 },
        ];
        const r = aggregate(rows);
        // MULTIPLIER_ACTIVE is false → every delta is 0 regardless of explicit field.
        expect(r.lifetime.sessions).toBe(3);
        expect(r.lifetime.delta_tokens).toBe(0);
        expect(r.lifetime.condensed_tokens).toBe(160);
        expect(r.by_session.get('s1')!.sessions).toBe(2);
        expect(r.by_session.get('s1')!.condensed_tokens).toBe(150);
        expect(r.by_session.get('s2')!.condensed_tokens).toBe(10);
        expect(r.by_conversation.get('c1')!.sessions).toBe(2);
        expect(r.by_conversation.get('c1')!.condensed_tokens).toBe(110);
        expect(r.multiplier_active).toBe(false);
    });

    it('missing ids fall back to "unknown"', () => {
        const r = aggregate([{ telegraph_condensed_tokens: 7 }]);
        expect(r.by_session.get('unknown')!.condensed_tokens).toBe(7);
        expect(r.by_conversation.get('unknown')!.condensed_tokens).toBe(7);
    });

    it('render_text carries the suspended note + header shape', () => {
        const r = aggregate([{ sessionId: 's1', conversation_id: 'c1', telegraph_condensed_tokens: 1234 }]);
        const out = render_text(r);
        expect(out).toContain('telegraph-stats telegraph-stats/v1 · multiplier v1 (SUSPENDED) · value 0.9155');
        expect(out).toContain('condensed_tokens = 1,234');
        expect(out).toContain('multiplier suspended');
        expect(out.endsWith('\n')).toBe(true);
    });

    it('signed delta renders +0 while suspended', () => {
        const r = aggregate([{ conversation_id: 'cX', telegraph_condensed_tokens: 5 }]);
        const out = render_text(r);
        expect(out).toContain('delta = +0 · condensed = 5');
    });
});

describe('telegraph_stats — CLI on a fixture (tsx)', () => {
    let tmpDir: string;
    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'telegraph-stats-'));
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function writeFixture(): string {
        const p = path.join(tmpDir, 'sessions.jsonl');
        const rows = [
            { sessionId: 's1', conversation_id: 'c1', telegraph_condensed_tokens: 100, telegraph_delta_tokens: 42 },
            { session_id: 's2', conversation_id: 'c1', telegraph_condensed_tokens: 10 },
        ];
        fs.writeFileSync(p, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
        return p;
    }

    it('text format renders the suspended-multiplier report deterministically', () => {
        const t = runTs('telegraph_stats', ['--input', writeFixture()]);
        expect(t.status).toBe(0);
        expect(t.stderr).toBe('');
        expect(t.stdout).toContain(
            'telegraph-stats telegraph-stats/v1 · multiplier v1 (SUSPENDED) · value 0.9155',
        );
        // delta is forced to 0 while suspended — even with an explicit field.
        expect(t.stdout).toContain('lifetime: 2 sessions · delta_tokens = +0 · condensed_tokens = 110');
        expect(t.stdout).toContain('c1: 2 sessions · delta = +0 · condensed = 110');
        expect(t.stdout).toContain('multiplier suspended');
    });

    it('json format emits the schema-versioned structure', () => {
        const t = runTs('telegraph_stats', ['--input', writeFixture(), '--format', 'json']);
        expect(t.status).toBe(0);
        expect(t.stderr).toBe('');
        const doc = JSON.parse(t.stdout) as Record<string, unknown>;
        expect(doc['schema_version']).toBe('telegraph-stats/v1');
        expect(doc['multiplier_version']).toBe('v1');
        expect(doc['multiplier_active']).toBe(false);
        expect(doc['lifetime']).toEqual({ sessions: 2, delta_tokens: 0, condensed_tokens: 110 });
        expect(doc['by_session']).toEqual({
            s1: { sessions: 1, delta_tokens: 0, condensed_tokens: 100 },
            s2: { sessions: 1, delta_tokens: 0, condensed_tokens: 10 },
        });
        expect(doc['by_conversation']).toEqual({
            c1: { sessions: 2, delta_tokens: 0, condensed_tokens: 110 },
        });
    });

    it('missing input file → exit 0 + empty report', () => {
        const t = runTs('telegraph_stats', ['--input', path.join(tmpDir, 'nope.jsonl'), '--format', 'json']);
        expect(t.status).toBe(0);
        const doc = JSON.parse(t.stdout) as Record<string, unknown>;
        expect(doc['lifetime']).toEqual({ sessions: 0, delta_tokens: 0, condensed_tokens: 0 });
        expect(doc['by_session']).toEqual({});
        expect(doc['by_conversation']).toEqual({});
    });
});
