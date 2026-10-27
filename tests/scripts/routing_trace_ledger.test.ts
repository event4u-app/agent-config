// `road-to-routing-assurance-live-floors` 5.1 and 5.2 — the trace ledger and
// the drain that proposes corpus candidates from it.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
    DEFAULT_LEDGER,
    appendRows,
    exportRows,
    fidelityCases,
    harvestSession,
    landCandidate,
    proposeCandidates,
    refuseTrackedLedger,
    type TraceRow,
} from '../../src/scripts/routing_trace_ledger.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function tmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-ledger-'));
    dirs.push(d);
    return d;
}

const session = [
    { type: 'attachment', attachment: { type: 'skill_listing', content: '- code-review: Use when…\n- ai-council: Use when…\n' } },
    { type: 'user', message: { content: 'please review my diff before I push' } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'code-review' } }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', content: 'skill body…' }] } },
    { type: 'user', isMeta: true, message: { content: 'meta line' } },
    { type: 'user', message: { content: 'thanks, now explain the change' } },
]
    .map((o) => JSON.stringify(o))
    .join('\n');

describe('harvestSession — 5.1', () => {
    it('keeps one row per human prompt with what its turn invoked and the listing it saw', () => {
        const rows = harvestSession(session, 's1');
        expect(rows.map((r) => r.prompt)).toEqual(['please review my diff before I push', 'thanks, now explain the change']);
        expect(rows[0]?.invoked).toEqual(['code-review']);
        expect(rows[1]?.invoked).toEqual([]);
        expect(rows[0]?.catalogue_sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(rows[0]?.prompt_sha256).toMatch(/^[0-9a-f]{64}$/);
    });

    it('strips a plugin namespace from the invoked name', () => {
        const ns = [
            { type: 'user', message: { content: 'q' } },
            { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'ac:code-review' } }] } },
        ]
            .map((o) => JSON.stringify(o))
            .join('\n');
        expect(harvestSession(ns, 's')[0]?.invoked).toEqual(['code-review']);
    });
});

describe('the ledger stays local — 5.1', () => {
    it('the default ledger path is gitignored', () => {
        expect(() => refuseTrackedLedger(DEFAULT_LEDGER, REPO)).not.toThrow();
    });

    it('refuses a ledger path git would track', () => {
        expect(() => refuseTrackedLedger(path.join(REPO, 'src', 'scripts', 'ledger.jsonl'), REPO)).toThrow(/not gitignored/);
    });

    it('an export contains no free text', () => {
        const rows = harvestSession(session, 's1');
        const exported = exportRows(rows);
        for (const r of exported) {
            expect(Object.keys(r)).not.toContain('prompt');
            const text = JSON.stringify(r);
            expect(text).not.toContain('review my diff');
            expect(text).not.toContain('explain the change');
        }
    });

    it('appends idempotently, deduplicated on (session, turn)', () => {
        const file = path.join(tmp(), 'ledger.jsonl');
        const rows = harvestSession(session, 's1');
        expect(appendRows(file, rows)).toBe(2);
        expect(appendRows(file, rows)).toBe(0);
    });
});

describe('proposeCandidates / landCandidate — 5.2', () => {
    function corpus(): string {
        const root = tmp();
        fs.mkdirSync(path.join(root, 'code-review', 'evals'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'code-review', 'evals', 'triggers.json'),
            JSON.stringify({ queries: [{ id: 'cr1', q: 'Review this PR', trigger: true }] }),
        );
        return root;
    }
    const row = (prompt: string, invoked: string[]): TraceRow => ({
        session_id: 's',
        turn_idx: 0,
        prompt,
        prompt_sha256: prompt,
        invoked,
        catalogue_sha256: null,
    });

    it('proposes a prompt that invoked a skill whose corpus lacks it', () => {
        const got = proposeCandidates([row('please review my diff', ['code-review'])], corpus());
        expect(got).toHaveLength(1);
        expect(got[0]).toMatchObject({ skill: 'code-review', confirmed_by: null });
    });

    it('does not propose a prompt the corpus already holds, nor a skill with no corpus', () => {
        expect(proposeCandidates([row('review  this pr', ['code-review'])], corpus())).toEqual([]);
        expect(proposeCandidates([row('anything', ['no-corpus-skill'])], corpus())).toEqual([]);
    });

    it('an unconfirmed candidate cannot land; a confirmed one lands as a positive', () => {
        const root = corpus();
        const [c] = proposeCandidates([row('please review my diff', ['code-review'])], root);
        expect(() => landCandidate(c!, root, 'cr-t1')).toThrow(/unconfirmed/);
        landCandidate({ ...c!, confirmed_by: 'maintainer' }, root, 'cr-t1');
        const doc = JSON.parse(fs.readFileSync(path.join(root, 'code-review', 'evals', 'triggers.json'), 'utf8')) as {
            queries: { id: string; trigger: boolean }[];
        };
        expect(doc.queries.find((q) => q.id === 'cr-t1')?.trigger).toBe(true);
    });
});

describe('fidelityCases — 5.4 inputs', () => {
    it('takes own-session prompts that are corpus queries and baseline runs, counted apart', () => {
        const root = tmp();
        fs.mkdirSync(path.join(root, 'code-review', 'evals'), { recursive: true });
        fs.writeFileSync(
            path.join(root, 'code-review', 'evals', 'triggers.json'),
            JSON.stringify({ queries: [{ id: 'cr1', q: 'Review this PR', trigger: true }] }),
        );
        const rows: TraceRow[] = [
            { session_id: 's', turn_idx: 0, prompt: 'review this  pr', prompt_sha256: 'x', invoked: [], catalogue_sha256: null },
            { session_id: 's', turn_idx: 1, prompt: 'unrelated', prompt_sha256: 'y', invoked: ['code-review'], catalogue_sha256: null },
        ];
        const got = fidelityCases(rows, [{ skill: 'code-review', id: 'cr1', invoked: ['code-review'] }], root);
        expect(got.sources).toEqual({ 'own-sessions': 1, 'baseline-runs': 1 });
        expect(got.cases.map((c) => c.consulted)).toEqual([false, true]);
    });
});
