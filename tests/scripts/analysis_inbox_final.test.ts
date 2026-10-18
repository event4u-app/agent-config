import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    convergenceRow,
    directiveBinding,
    foldLaneLedgers,
    InboxFinalError,
    planLanes,
    roundUnion,
    type Directive,
} from '../../src/scripts/analysis_inbox_final.js';

let root: string;

function write(rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'inbox-final-')));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('roundUnion (step 3.4)', () => {
    it('reads the runtime round and the owner drops as one union, lineage from the manifest', () => {
        write('agents/runtime/analysis/inbox-2026-10-x/analyst-a.md', 'A');
        write('agents/runtime/analysis/inbox-2026-10-x/run-state.json', '{}');
        write('agents/runtime/analysis/inbox-2026-10-x/manifest.json', JSON.stringify({ lineage: { 'analyst-a.md': ['seed.md'] } }));
        write('agents/tmp/inbox-2026-10-x/handoff-b.md', 'B');
        const u = roundUnion(root, 'inbox-2026-10-x');
        expect(u.files).toEqual([
            { rel: 'agents/runtime/analysis/inbox-2026-10-x/analyst-a.md', origin: 'runtime' },
            { rel: 'agents/tmp/inbox-2026-10-x/handoff-b.md', origin: 'drop' },
        ]);
        expect(u.lineage).toEqual({ 'analyst-a.md': ['seed.md'] });
        expect(u.renameBeforeTriage).toBe(false);
    });

    it('a speaking round name still asks for the Phase 1 rename', () => {
        write('agents/tmp/better-frontend/notes.md', 'x');
        expect(roundUnion(root, 'better-frontend').renameBeforeTriage).toBe(true);
    });

    it('refuses a round id that walks out of the round folders', () => {
        expect(() => roundUnion(root, '../secrets')).toThrow(InboxFinalError);
    });
});

describe('directiveBinding (step 3.4)', () => {
    const d = (over: Partial<Directive>): Directive => ({ id: 'd1', role: 'user', provenance: 'current-session', text: 'always ready', ...over });

    it('current-session user turns bind; structured transcript user turns bind unless contradicted', () => {
        expect(directiveBinding(d({}))).toBe('binds');
        expect(directiveBinding(d({ provenance: 'transcript-structured' }))).toBe('binds');
        expect(directiveBinding(d({ provenance: 'transcript-structured', contradictedBy: 'current-session d0' }))).toBe('batch');
    });

    it('a heuristically recovered role never binds automatically, and an AI turn is a claim', () => {
        expect(directiveBinding(d({ provenance: 'transcript-recovered' }))).toBe('batch');
        expect(directiveBinding(d({ role: 'assistant' }))).toBe('claim');
    });
});

describe('convergenceRow (step 3.4)', () => {
    const ds: Directive[] = [
        { id: 'a', role: 'user', provenance: 'current-session', text: 'always ready' },
        { id: 'b', role: 'user', provenance: 'transcript-structured', text: 'one PR, marked ready' },
        { id: 'c', role: 'assistant', provenance: 'transcript-structured', text: 'I suggest draft' },
    ];

    it('names every binding directive it checked', () => {
        const row = convergenceRow(ds, [
            { directive: 'a', roadmap: 'agents/roadmaps/road-to-x.md', verdict: 'honoured', evidence: 'status: ready' },
            { directive: 'b', roadmap: 'agents/roadmaps/road-to-x.md', verdict: 'honoured', evidence: 'isDraft false' },
        ]);
        expect(row.lens).toBe('convergence');
        expect(row.directives_checked).toEqual(['a', 'b']);
        expect(row.violated).toEqual([]);
    });

    it('refuses a row that leaves a binding directive unchecked', () => {
        expect(() =>
            convergenceRow(ds, [{ directive: 'a', roadmap: 'agents/roadmaps/road-to-x.md', verdict: 'honoured', evidence: 'x' }]),
        ).toThrow(/b/u);
    });

    it('reports a violated directive instead of hiding it', () => {
        const row = convergenceRow(ds, [
            { directive: 'a', roadmap: 'agents/roadmaps/road-to-x.md', verdict: 'violated', evidence: 'status: draft' },
            { directive: 'b', roadmap: 'agents/roadmaps/road-to-x.md', verdict: 'honoured', evidence: 'ok' },
        ]);
        expect(row.violated).toEqual(['a']);
    });
});

describe('planLanes and foldLaneLedgers (step 3.4)', () => {
    it('a small round is one lane; a large one splits into parallel lanes without asking', () => {
        expect(planLanes([{ topic: 't1', bytes: 80_000 }])).toEqual([{ lane: 'L1', topics: ['t1'] }]);
        const big = Array.from({ length: 7 }, (_, i) => ({ topic: `t${i + 1}`, bytes: 100_000 }));
        const lanes = planLanes(big);
        expect(lanes.length).toBeGreaterThan(1);
        expect(lanes.flatMap((l) => l.topics).sort()).toEqual(big.map((t) => t.topic).sort());
        for (const l of lanes) expect(l.topics.length).toBeLessThanOrEqual(5);
    });

    it('folds once, and refuses a lane without its own census or point ledger', () => {
        const folded = foldLaneLedgers([
            { lane: 'L1', census: 12, points: [{ id: 'p1', disposition: 'adopted' }] },
            { lane: 'L2', census: 9, points: [{ id: 'p2', disposition: 'killed' }] },
        ]);
        expect(folded).toEqual({ lanes: 2, census: 21, points: 2 });
        expect(() => foldLaneLedgers([{ lane: 'L1', census: 0, points: [] }])).toThrow(InboxFinalError);
    });
});
