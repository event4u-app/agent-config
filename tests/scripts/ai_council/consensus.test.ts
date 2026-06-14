// Tests for src/scripts/ai_council/consensus.ts (py2ts Phase 1).
//
// consensus computes per-finding agreement/convergence (float math → format
// parity) plus best-effort JSON extraction. Golden parity drives the LIVE
// Python twin via a `python3 -c` importlib direct-file load (the ai_council
// `__init__` pulls networked clients; consensus.py has no intra-package deps
// so it loads straight off disk).
//
// Number divergence (ADR-094): Python `round(mean, 2)` yields a float whose
// repr keeps `.0` (`8.0`); JS has one number type (`8`). Differential blocks
// parse both sides as JSON so `8.0 == 8` compares equal.
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

import {
    aggregate_scores,
    anonymize_findings,
    anonymize_responses,
    bucket_by_threshold,
    DEFAULT_MINORITY_THRESHOLD,
    DEFAULT_STRONG_THRESHOLD,
    evidence_quality,
    Finding,
    FindingScore,
    parse_findings_response,
    parse_scores_response,
} from '../../../src/scripts/ai_council/consensus.js';

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

const CONSENSUS_PY = 'src/scripts/ai_council/consensus.py';

function pyLoadPreamble(): string[] {
    return [
        'import importlib.util, sys, json',
        `_spec = importlib.util.spec_from_file_location("cs", ${JSON.stringify(CONSENSUS_PY)})`,
        'cs = importlib.util.module_from_spec(_spec)',
        'sys.modules["cs"] = cs',
        '_spec.loader.exec_module(cs)',
    ];
}

function py(snippet: string): string {
    const code = [...pyLoadPreamble(), snippet].join('\n');
    const r = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr}`);
    }
    return r.stdout;
}

// ── Unit tests ───────────────────────────────────────────────────────

describe('consensus — evidence_quality buckets', () => {
    it('H / M / L thresholds', () => {
        expect(evidence_quality(8.0)).toBe('H');
        expect(evidence_quality(9.5)).toBe('H');
        expect(evidence_quality(7.99)).toBe('M');
        expect(evidence_quality(6.0)).toBe('M');
        expect(evidence_quality(5.99)).toBe('L');
        expect(evidence_quality(0.0)).toBe('L');
    });
});

describe('consensus — aggregate_scores', () => {
    it('drops self-scores; empty → zero metadata', () => {
        const findings = [new Finding('a', 'm1', 'A'), new Finding('b', 'm2', 'B')];
        const scores = [
            new FindingScore('a', 'm1', 10, true, 'self'), // self-score dropped
            new FindingScore('a', 'm2', 8, true, 'good'),
            new FindingScore('a', 'm3', 6, false, 'meh'),
        ];
        const meta = aggregate_scores(findings, scores);
        const a = meta.get('a')!;
        expect(a.scorers).toEqual(['m2', 'm3']);
        expect(a.mean_score).toBe(7.0);
        expect(a.dissent_count).toBe(1);
        expect(a.concur_count).toBe(1);
        expect(a.dissent_reasons).toEqual([['m3', 'meh']]);
        // b has no scorers → all-zero metadata
        const b = meta.get('b')!;
        expect(b.consensus_strength).toBe(0.0);
        expect(b.scorers).toEqual([]);
        expect(b.evidence_quality).toBe('L');
    });
    it('consensus_strength = mean/10 * agree_rate, rounded to 3', () => {
        const findings = [new Finding('x', 'src', 'X')];
        const scores = [
            new FindingScore('x', 'a', 9, true, ''),
            new FindingScore('x', 'b', 6, false, 'no'),
        ];
        const m = aggregate_scores(findings, scores).get('x')!;
        // mean=7.5, agree_rate=0.5, strength=0.375
        expect(m.mean_score).toBe(7.5);
        expect(m.consensus_strength).toBe(0.375);
    });
});

describe('consensus — bucket_by_threshold', () => {
    it('strong > strong threshold; minority gets unscored', () => {
        const findings = [
            new Finding('hi', 's', 'H'),
            new Finding('mid', 's', 'M'),
            new Finding('lo', 's', 'L'),
            new Finding('none', 's', 'N'),
        ];
        const meta = new Map([
            ['hi', aggregate_scores([findings[0]!], [new FindingScore('hi', 'a', 10, true, '')]).get('hi')!],
            ['mid', aggregate_scores([findings[1]!], [new FindingScore('mid', 'a', 5, true, '')]).get('mid')!],
            ['lo', aggregate_scores([findings[2]!], [new FindingScore('lo', 'a', 1, false, '')]).get('lo')!],
        ]);
        const b = bucket_by_threshold(findings, meta);
        expect(b.strong.map((p) => p[0].id)).toEqual(['hi']); // 1.0 > 0.7
        expect(b.findings.map((p) => p[0].id)).toEqual(['mid']); // 0.5 in (0.4, 0.7]
        expect(b.minority.map((p) => p[0].id)).toEqual(['lo', 'none']); // 0.0, and unscored
    });
    it('raises on broken threshold ordering', () => {
        expect(() => bucket_by_threshold([], new Map(), { strong: 0.3, minority: 0.5 })).toThrow(
            /Threshold ordering broken/,
        );
    });
    it('default thresholds are 0.7 / 0.4', () => {
        expect(DEFAULT_STRONG_THRESHOLD).toBe(0.7);
        expect(DEFAULT_MINORITY_THRESHOLD).toBe(0.4);
    });
});

describe('consensus — parsing', () => {
    it('parse_findings_response: fenced + skip bad items', () => {
        const out = parse_findings_response(
            '```json\n[{"id":"x","text":" hi "},{"text":"no id"},{"id":"y","text":"ok"}]\n```',
            { source: 'src1' },
        );
        expect(out.map((f) => [f.id, f.source, f.text])).toEqual([
            ['x', 'src1', 'hi'],
            ['y', 'src1', 'ok'],
        ]);
    });
    it('parse_findings_response: bare array fallback + invalid json → []', () => {
        expect(parse_findings_response('[{"id":"z","text":"zz"}]', { source: 's' }).length).toBe(1);
        expect(parse_findings_response('not json at all', { source: 's' })).toEqual([]);
        expect(parse_findings_response('```json\n{bad}\n```', { source: 's' })).toEqual([]);
    });
    it('parse_scores_response: clamps, falls back id, defaults agree=true', () => {
        const out = parse_scores_response(
            '[{"finding_id":"a","score":12},{"id":"b","score":5.9,"agree":false,"reason":" r "},{"finding_id":"c","score":0}]',
            { scorer: 'sc' },
        );
        // a clamped out (12>10), c clamped out (0<1); b kept (5.9 → int 5)
        expect(out.map((s) => [s.finding_id, s.score, s.agree, s.reason])).toEqual([
            ['b', 5, false, 'r'],
        ]);
    });
    it('parse_scores_response: non-numeric score skipped', () => {
        expect(parse_scores_response('[{"finding_id":"a","score":"hi"}]', { scorer: 'z' })).toEqual([]);
    });
});

describe('consensus — anonymize', () => {
    it('anonymize_findings labels A/B/C in order', () => {
        const m = anonymize_findings([new Finding('a', 's', 'A'), new Finding('b', 's', 'B')]);
        expect([...m.keys()]).toEqual(['Finding-A', 'Finding-B']);
    });
    it('anonymize_responses skips empty, applies persona, preserves order', () => {
        const [text, src] = anonymize_responses(
            [
                ['p:1', ' hi '],
                ['q:2', '   '],
                ['r:3', 'yo'],
            ],
            { persona_labels: new Map([['r:3', 'Contra']]) },
        );
        expect([...text]).toEqual([
            ['Response-A', 'hi'],
            ['Response-B (Contra)', 'yo'],
        ]);
        expect([...src]).toEqual([
            ['Response-A', 'p:1'],
            ['Response-B (Contra)', 'r:3'],
        ]);
    });
});

// ── Golden parity vs the CPython twin ────────────────────────────────

describe.runIf(py3)('consensus — golden parity vs CPython twin', () => {
    // Drive aggregate + bucket on a fixed corpus; compare the JSON-able view.
    const AGG_DRIVER = `
findings = [cs.Finding(id="a", source="m1", text="A"),
            cs.Finding(id="b", source="m2", text="B"),
            cs.Finding(id="c", source="m3", text="C")]
scores = [
    cs.FindingScore(finding_id="a", scorer="m1", score=10, agree=True, reason="self"),
    cs.FindingScore(finding_id="a", scorer="m2", score=9, agree=True, reason="strong"),
    cs.FindingScore(finding_id="a", scorer="m3", score=7, agree=False, reason="off"),
    cs.FindingScore(finding_id="b", scorer="m1", score=6, agree=True, reason="ok"),
    cs.FindingScore(finding_id="b", scorer="m3", score=4, agree=False, reason="weak"),
]
meta = cs.aggregate_scores(findings, scores)
def md(m):
    return {"finding_id": m.finding_id, "consensus_strength": m.consensus_strength,
            "dissent_count": m.dissent_count, "scorers": list(m.scorers),
            "mean_score": m.mean_score, "concur_count": m.concur_count,
            "dissent_reasons": [list(x) for x in m.dissent_reasons],
            "evidence_quality": m.evidence_quality}
print(json.dumps({k: md(v) for k, v in meta.items()}, sort_keys=True))
bucket = cs.bucket_by_threshold(findings, meta)
print(json.dumps({"strong": [p[0].id for p in bucket.strong],
                  "findings": [p[0].id for p in bucket.findings],
                  "minority": [p[0].id for p in bucket.minority]}))
`;

    it('aggregate_scores + bucket_by_threshold match', () => {
        const out = py(AGG_DRIVER).trim().split('\n');
        const findings = [
            new Finding('a', 'm1', 'A'),
            new Finding('b', 'm2', 'B'),
            new Finding('c', 'm3', 'C'),
        ];
        const scores = [
            new FindingScore('a', 'm1', 10, true, 'self'),
            new FindingScore('a', 'm2', 9, true, 'strong'),
            new FindingScore('a', 'm3', 7, false, 'off'),
            new FindingScore('b', 'm1', 6, true, 'ok'),
            new FindingScore('b', 'm3', 4, false, 'weak'),
        ];
        const meta = aggregate_scores(findings, scores);
        const md = (m: ReturnType<typeof meta.get>) => ({
            finding_id: m!.finding_id,
            consensus_strength: m!.consensus_strength,
            dissent_count: m!.dissent_count,
            scorers: [...m!.scorers],
            mean_score: m!.mean_score,
            concur_count: m!.concur_count,
            dissent_reasons: m!.dissent_reasons.map((x) => [...x]),
            evidence_quality: m!.evidence_quality,
        });
        const tsMeta: Record<string, unknown> = {};
        for (const [k, v] of meta) {
            tsMeta[k] = md(v);
        }
        expect(tsMeta).toEqual(JSON.parse(out[0] as string));
        const bucket = bucket_by_threshold(findings, meta);
        expect({
            strong: bucket.strong.map((p) => p[0].id),
            findings: bucket.findings.map((p) => p[0].id),
            minority: bucket.minority.map((p) => p[0].id),
        }).toEqual(JSON.parse(out[1] as string));
    });

    // Float-format corpus: drive round(mean,2)/round(strength,3) over scores
    // chosen to exercise half-even rounding boundaries.
    const ROUND_CASES: Array<[number[], boolean[]]> = [
        [[7, 8], [true, true]], // mean 7.5
        [[1, 2, 4], [true, false, true]], // mean 2.333…
        [[5, 6, 7], [true, true, false]], // mean 6.0, agree 0.666…
        [[9, 9, 9], [true, true, true]], // strength 0.9
        [[3, 3, 4, 5], [false, true, false, true]], // mean 3.75
        [[2, 5, 5], [true, true, true]], // mean 4.0
    ];

    it.each(ROUND_CASES.map((_, i) => i))('round-parity case %i', (idx) => {
        const [vals, agrees] = ROUND_CASES[idx]!;
        const scores = vals.map(
            (v, i) => new FindingScore('f', `s${i}`, v, agrees[i] as boolean, ''),
        );
        const m = aggregate_scores([new Finding('f', 'author', 'F')], scores).get('f')!;
        const pyScores = vals
            .map(
                (v, i) =>
                    `cs.FindingScore(finding_id="f", scorer="s${i}", score=${v}, agree=${agrees[i] ? 'True' : 'False'}, reason="")`,
            )
            .join(', ');
        const expected = py(
            `meta = cs.aggregate_scores([cs.Finding(id="f", source="author", text="F")], [${pyScores}])\n` +
                `m = meta["f"]\n` +
                `print(json.dumps([m.mean_score, m.consensus_strength, m.evidence_quality]))`,
        ).trim();
        expect([m.mean_score, m.consensus_strength, m.evidence_quality]).toEqual(JSON.parse(expected));
    });

    // JSON-extraction corpus: fenced / bare / malformed / surrounding prose.
    const EXTRACT_CASES: Record<string, string> = {
        fenced: '```json\n[{"id":"a","text":"alpha"}]\n```',
        fenced_no_lang: '```\n[{"id":"b","text":"beta"}]\n```',
        bare: 'prose before [{"id":"c","text":"gamma"}] prose after',
        multiline: '```json\n[\n  {"id":"d","text":"delta over\\ntwo lines"}\n]\n```',
        nested_obj: '```json\n[{"id":"e","text":"e"},{"id":"f","text":"f"}]\n```',
        malformed: '```json\n[{"id":}]\n```',
        none: 'no array here at all',
        empty: '',
    };

    it.each(Object.keys(EXTRACT_CASES))('parse_findings_response(%s) matches', (key) => {
        const text = EXTRACT_CASES[key] as string;
        const expected = py(
            `out = cs.parse_findings_response(${JSON.stringify(text)}, source="S")\n` +
                `print(json.dumps([[f.id, f.source, f.text] for f in out]))`,
        ).trim();
        const got = parse_findings_response(text, { source: 'S' }).map((f) => [f.id, f.source, f.text]);
        expect(got).toEqual(JSON.parse(expected));
    });

    const SCORE_CASES: Record<string, string> = {
        ok: '[{"finding_id":"a","score":8,"agree":true,"reason":" r1 "}]',
        clamp_high: '[{"finding_id":"a","score":11}]',
        clamp_low: '[{"finding_id":"a","score":0}]',
        float_score: '[{"finding_id":"a","score":7.9}]',
        id_fallback: '[{"id":"b","score":5}]',
        non_numeric: '[{"finding_id":"a","score":"x"}]',
        default_agree: '[{"finding_id":"a","score":5}]',
        bool_score: '[{"finding_id":"a","score":true}]',
        missing_fid: '[{"score":5}]',
    };

    it.each(Object.keys(SCORE_CASES))('parse_scores_response(%s) matches', (key) => {
        const text = SCORE_CASES[key] as string;
        const expected = py(
            `out = cs.parse_scores_response(${JSON.stringify(text)}, scorer="SC")\n` +
                `print(json.dumps([[s.finding_id, s.scorer, s.score, s.agree, s.reason] for s in out]))`,
        ).trim();
        const got = parse_scores_response(text, { scorer: 'SC' }).map((s) => [
            s.finding_id,
            s.scorer,
            s.score,
            s.agree,
            s.reason,
        ]);
        expect(got).toEqual(JSON.parse(expected));
    });

    it('threshold-ordering error text matches', () => {
        const expected = py(
            'import json\n' +
                'try:\n' +
                '    cs.bucket_by_threshold([], {}, strong=0.3, minority=0.5)\n' +
                'except ValueError as e:\n' +
                '    print(json.dumps(str(e)))',
        ).trim();
        let msg = '';
        try {
            bucket_by_threshold([], new Map(), { strong: 0.3, minority: 0.5 });
        } catch (e) {
            msg = (e as Error).message;
        }
        expect(msg).toEqual(JSON.parse(expected));
    });

    it('anonymize_responses matches (persona + skip empty + order)', () => {
        const expected = py(
            'at, ls = cs.anonymize_responses(' +
                '[("p:1", " hi "), ("q:2", "   "), ("r:3", "yo"), ("s:4", "z")],' +
                ' persona_labels={"r:3": "Contra"})\n' +
                'print(json.dumps([list(at.items()), list(ls.items())]))',
        ).trim();
        const [text, src] = anonymize_responses(
            [
                ['p:1', ' hi '],
                ['q:2', '   '],
                ['r:3', 'yo'],
                ['s:4', 'z'],
            ],
            { persona_labels: new Map([['r:3', 'Contra']]) },
        );
        expect([[...text], [...src]]).toEqual(JSON.parse(expected));
    });
});
