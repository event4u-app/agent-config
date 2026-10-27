// Metric computation for the map task set, on synthetic transcripts and
// synthetic run records — no model, no fixture clone.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import {
    check_assertion,
    evaluate_hidden_check,
    glob_to_regex,
    load_map_tasks,
    parse_affected_section,
    score_affected,
    summarise_arm,
    total_tokens,
    type AffectedItem,
    type MapRunRecord,
} from '../../src/scripts/_lib/bench_map_metrics.js';
import { DRY_RUN_STUB, MAP_ARMS, dry_run_problems, parse_args, run_trial, stub_transcript } from '../../src/scripts/bench_map_task_set.js';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'map-metrics-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

function tree(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(tmp, 't-'));
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    }
    return root;
}

describe('parse_affected_section', () => {
    it('reads bullets, numbers and backticks, deduplicated, up to the footer', () => {
        const text = [
            'I renamed it.',
            '',
            'AFFECTED SET',
            '- `src/a.js`',
            '* src/b.js',
            '1. users.email',
            '- src/a.js',
            'END AFFECTED SET',
            '- after the footer',
        ].join('\n');
        expect(parse_affected_section(text)).toEqual(['src/a.js', 'src/b.js', 'users.email']);
    });

    it('accepts a markdown or bold heading and a missing footer', () => {
        expect(parse_affected_section('## Affected set:\n- x.ts\n- y.ts')).toEqual(['x.ts', 'y.ts']);
        expect(parse_affected_section('**AFFECTED SET**\n- x.ts\n**END AFFECTED SET**')).toEqual(['x.ts']);
    });

    it('takes the last section when the answer repeats it', () => {
        const text = 'AFFECTED SET\n- old.ts\nEND AFFECTED SET\n\nAFFECTED SET\n- new.ts\nEND AFFECTED SET';
        expect(parse_affected_section(text)).toEqual(['new.ts']);
    });

    it('returns null without a section and [] for an empty one', () => {
        expect(parse_affected_section('I changed src/a.js and src/b.js.')).toBeNull();
        expect(parse_affected_section('')).toBeNull();
        expect(parse_affected_section('AFFECTED SET\nEND AFFECTED SET')).toEqual([]);
    });

    it('drops the template placeholder echoed back', () => {
        expect(parse_affected_section('AFFECTED SET\n- <place>\nEND AFFECTED SET')).toEqual([]);
    });
});

describe('score_affected', () => {
    const truth: AffectedItem[] = [
        { kind: 'file', id: 'src/a.js' },
        { kind: 'file', id: 'src/b.js' },
        { kind: 'column', id: 'users.email', aliases: ['email column'] },
        { kind: 'file', id: 'db/view.sql' },
    ];

    it('computes recall over planted items and precision over declared lines', () => {
        const s = score_affected({ affected: truth }, ['SRC/A.js', 'the Email Column', 'docs/notes.md']);
        expect(s.recall).toBeCloseTo(2 / 4);
        expect(s.precision).toBeCloseTo(2 / 3);
        expect(s.matched).toEqual(['src/a.js', 'users.email']);
        expect(s.missed).toEqual(['src/b.js', 'db/view.sql']);
        expect(s.unmatched_lines).toEqual(['docs/notes.md']);
    });

    it('scores a complete, exact declaration as 1 / 1', () => {
        const s = score_affected({ affected: truth }, truth.map((t) => t.id));
        expect(s.recall).toBe(1);
        expect(s.precision).toBe(1);
    });

    it('reports no precision, not zero, when nothing was declared', () => {
        expect(score_affected({ affected: truth }, null)).toMatchObject({ recall: 0, precision: null, section_missing: true });
        expect(score_affected({ affected: truth }, [])).toMatchObject({ recall: 0, precision: null, section_missing: false });
    });

    it('lets one declared line cover several planted items', () => {
        const s = score_affected(
            { affected: [{ kind: 'file', id: 'db/view.sql' }, { kind: 'view', id: 'view' }] },
            ['db/view.sql'],
        );
        expect(s.recall).toBe(1);
        expect(s.precision).toBe(1);
    });
});

describe('hidden check assertions', () => {
    const root = tree({
        'src/a.js': 'export function next() {}\n',
        'db/m/001.php': "rename('a', 'b')\n",
        'db/m/002.php': 'other\n',
        'ci.yml': 'jobs:\n  unit:\n    run: x\n',
    });

    it('holds and fails path match / no_match', () => {
        expect(check_assertion({ path: 'src/a.js', match: 'function next' }, root)).toBeNull();
        expect(check_assertion({ path: 'src/a.js', match: 'function prev' }, root)).toMatch(/lacks/);
        expect(check_assertion({ path: 'src/a.js', no_match: 'next' }, root)).toMatch(/still has/);
        expect(check_assertion({ path: 'src/missing.js', match: 'x' }, root)).toMatch(/missing/);
        expect(check_assertion({ path: 'src/missing.js', no_match: 'x' }, root)).toBeNull();
    });

    it('honours regex flags', () => {
        expect(check_assertion({ path: 'ci.yml', match: '^  unit:$', flags: 'm' }, root)).toBeNull();
        expect(check_assertion({ path: 'ci.yml', match: '^  unit:$' }, root)).not.toBeNull();
    });

    it('needs one glob hit for match and none for no_match', () => {
        expect(check_assertion({ glob: 'db/m/*.php', match: "rename\\('a'" }, root)).toBeNull();
        expect(check_assertion({ glob: 'db/m/*.php', match: 'absent-text' }, root)).toMatch(/no file/);
        expect(check_assertion({ glob: 'db/**/*.php', no_match: 'other' }, root)).toMatch(/002\.php/);
    });

    it('checks absence and rejects an empty assertion', () => {
        expect(check_assertion({ absent: 'src/gone.js' }, root)).toBeNull();
        expect(check_assertion({ absent: 'src/a.js' }, root)).toMatch(/still exists/);
        expect(check_assertion({}, root)).toMatch(/neither/);
    });

    it('lists each broken protected place once and fails an empty check', () => {
        const r = evaluate_hidden_check(
            {
                hidden_check: [
                    { path: 'src/a.js', match: 'nope', protects: 'src/a.js' },
                    { path: 'src/a.js', no_match: 'next', protects: 'src/a.js' },
                    { path: 'ci.yml', match: 'jobs' },
                ],
            },
            root,
        );
        expect(r.pass).toBe(false);
        expect(r.failures.map((f) => f.index)).toEqual([0, 1]);
        expect(r.broken_dependents).toEqual(['src/a.js']);
        expect(evaluate_hidden_check({ hidden_check: [] }, root).pass).toBe(false);
    });

    it('translates the two glob shapes the corpus uses', () => {
        expect(glob_to_regex('db/*.php').test('db/x.php')).toBe(true);
        expect(glob_to_regex('db/*.php').test('db/sub/x.php')).toBe(false);
        expect(glob_to_regex('src/**/*.js').test('src/a.js')).toBe(true);
        expect(glob_to_regex('src/**/*.js').test('src/x/y/a.js')).toBe(true);
        expect(glob_to_regex('src/**/*.js').test('src/a.jsx')).toBe(false);
    });
});

function rec(over: Partial<MapRunRecord>): MapRunRecord {
    return {
        task_id: 't',
        area: 'code',
        arm: 'a',
        seed: 0,
        errored: false,
        success: false,
        broken_dependents: [],
        affected: score_affected({ affected: [{ kind: 'file', id: 'x' }] }, ['x']),
        tokens: 0,
        usd: 0,
        ...over,
    };
}

describe('summarise_arm', () => {
    const records = [
        rec({ success: true, tokens: 100, usd: 0.5, area: 'code' }),
        rec({ success: false, tokens: 300, broken_dependents: ['y'], area: 'data' }),
        rec({ errored: true, tokens: 50, area: 'data', affected: score_affected({ affected: [{ kind: 'file', id: 'x' }] }, null) }),
        rec({ success: true, tokens: 900, area: 'code' }),
        rec({ arm: 'other', success: true, tokens: 1 }),
    ];
    const s = summarise_arm('a', records, 500);

    it('counts errored runs as wrong and failed runs in the cost per success', () => {
        expect(s.runs).toBe(4);
        expect(s.errored).toBe(1);
        expect(s.successes).toBe(2);
        expect(s.m1_wrong_change_share).toBe(0.5);
        expect(s.m1_runs_with_broken_dependent).toBe(1);
        expect(s.m3_tokens_total).toBe(1350);
        expect(s.m3_tokens_per_success).toBe(675);
        expect(s.usd_total).toBeCloseTo(0.5);
    });

    it('averages recall over all runs and precision over runs that declared something', () => {
        expect(s.m2_mean_recall).toBeCloseTo(3 / 4);
        expect(s.m2_mean_precision).toBe(1);
        expect(s.m2_section_missing).toBe(1);
    });

    it('reads the token budget two ways', () => {
        expect(s.success_within_budget_share).toBeCloseTo(1 / 4);
        expect(s.successes_per_budget).toBeCloseTo((2 * 500) / 1350);
        expect(s.by_area).toEqual({ code: { runs: 2, successes: 2, checks_passed: 2 }, data: { runs: 2, successes: 0, checks_passed: 0 } });
    });

    it('returns nulls, not zeros, for an arm with no runs or no success', () => {
        const empty = summarise_arm('none', records, 500);
        expect(empty).toMatchObject({ runs: 0, m1_wrong_change_share: null, m2_mean_recall: null, m3_tokens_per_success: null });
        const fail = summarise_arm('a', [rec({ tokens: 10 })], 500);
        expect(fail.m3_tokens_per_success).toBeNull();
        expect(fail.successes_per_budget).toBe(0);
    });

    it('sums every token bucket', () => {
        expect(total_tokens({ input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 4 })).toBe(10);
        expect(total_tokens(null)).toBe(0);
    });
});

describe('dry-run plumbing', () => {
    const tasks = load_map_tasks().slice(0, 3);

    it('keeps one arm per stub behaviour', () => {
        expect(Object.keys(DRY_RUN_STUB).sort()).toEqual(Object.keys(MAP_ARMS).sort());
        expect(new Set(Object.values(DRY_RUN_STUB)).size).toBe(3);
        expect(MAP_ARMS['ac-map']?.map).toBe(true);
        expect(MAP_ARMS['ac']?.map).toBe(false);
        expect(MAP_ARMS['vanilla']?.setting_sources).toBe('project,local');
    });

    it('the stub transcript round-trips through the parser', () => {
        const t = tasks[0]!;
        expect(parse_affected_section(stub_transcript(t, 'reference'))).toEqual([...t.affected.map((a) => a.id), 'README.md']);
        expect(parse_affected_section(stub_transcript(t, 'naive'))).toEqual(t.primary);
        expect(parse_affected_section(stub_transcript(t, 'none'))).toBeNull();
    });

    it('a stubbed sweep scores as its behaviours imply, and a broken score is reported', () => {
        const records = tasks.flatMap((t) =>
            Object.keys(MAP_ARMS).map((arm) =>
                run_trial(t, arm, { seed: 0, model: null, max_budget: null, timeout: 1, rates: null, sp_dir: tmp, dry_run: true, map_build: false }),
            ),
        );
        const sums = Object.fromEntries(Object.keys(MAP_ARMS).map((arm) => [arm, summarise_arm(arm, records, 300_000)]));
        expect(dry_run_problems(sums, tasks, 1)).toEqual([]);

        const naiveAsPass = records.map((r) => (r.arm === 'ac' ? { ...r, success: true } : r));
        const broken = Object.fromEntries(Object.keys(MAP_ARMS).map((arm) => [arm, summarise_arm(arm, naiveAsPass, 300_000)]));
        expect(dry_run_problems(broken, tasks, 1).some((p) => p.startsWith('ac:'))).toBe(true);
    });

    it('rejects an unknown arm or flag', () => {
        expect(() => parse_args(['--arms', 'vanilla,nope'])).toThrow(/unknown arm/);
        expect(() => parse_args(['--bogus'])).toThrow(/unknown argument/);
        expect(parse_args(['--dry-run', '--seeds', '2'])).toMatchObject({ dry_run: true, seeds: 2 });
    });
});
