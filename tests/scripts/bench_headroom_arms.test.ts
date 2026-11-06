/**
 * Control flow and false-positive accounting of the 1.7 orchestrated arms, with
 * scripted calls — no live model. The definitions pinned here are the
 * pre-registered ones (proof-where 1.7, D4).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import * as YAML from 'yaml';

import {
    GENERATED_TEST_REL,
    parse_findings,
    restore_outside_tests,
    run_review,
    run_test_first,
    sum_breakdowns,
    tests_pass_on_reference,
    type CallFn,
    type StepCall,
} from '../../src/scripts/_lib/bench_headroom_arms.js';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const AB = path.join(REPO, 'internal', 'bench', 'ab');

const tmps: string[] = [];
afterEach(() => {
    for (const t of tmps.splice(0)) fs.rmSync(t, { recursive: true, force: true });
});
function scratchClone(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'h17-test-'));
    tmps.push(d);
    fs.mkdirSync(path.join(d, 'src'));
    fs.mkdirSync(path.join(d, 'tests'));
    fs.writeFileSync(path.join(d, 'src', 'a.mjs'), 'export const a = 1;\n');
    return d;
}
const run = (text: string, input = 10): Record<string, unknown> => ({
    transcript: text,
    errored: false,
    tokens: input + 1,
    tokens_breakdown: { input_tokens: input, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    wall_time_seconds: 2,
});

describe('parse_findings', () => {
    it('reads a findings list out of surrounding prose', () => {
        const r = parse_findings('Here:\n{"findings":[{"file":"src/a.mjs","issue":"misses 0"}]}');
        expect(r).toEqual({ findings: [{ file: 'src/a.mjs', issue: 'misses 0' }], parse_ok: true });
    });
    it('an empty list is zero findings and parses', () => {
        expect(parse_findings('{"findings": []}')).toEqual({ findings: [], parse_ok: true });
    });
    it('garbage is zero findings, flagged as unparsed', () => {
        expect(parse_findings('looks fine to me')).toEqual({ findings: [], parse_ok: false });
    });
    it('drops findings with an empty issue', () => {
        expect(parse_findings('{"findings":[{"file":null,"issue":"  "}]}').findings).toEqual([]);
    });
});

describe('run_review (arm D)', () => {
    it('findings on an attempt that already passed are false positives, and the author revises once', () => {
        const clone = scratchClone();
        const roles: string[] = [];
        const call: CallFn = (s: StepCall) => {
            roles.push(s.role);
            return s.role === 'reviewer' ? run('{"findings":[{"file":"x","issue":"a"},{"file":"y","issue":"b"}]}') : run('done');
        };
        const r = run_review({ requirement: 'R', clone, call, diff: () => 'D', passes_now: () => true });
        expect(roles).toEqual(['author', 'reviewer', 'author-revision']);
        expect(r.findings_fp).toBe(2);
        expect(r.findings_confirmed).toBe(0);
        expect(r.revised).toBe(true);
    });
    it('findings on a failing attempt are confirmed', () => {
        const clone = scratchClone();
        const call: CallFn = (s) => (s.role === 'reviewer' ? run('{"findings":[{"file":"x","issue":"a"}]}') : run('done'));
        const r = run_review({ requirement: 'R', clone, call, diff: () => 'D', passes_now: () => false });
        expect(r.findings_fp).toBe(0);
        expect(r.findings_confirmed).toBe(1);
    });
    it('no findings → no revision call', () => {
        const clone = scratchClone();
        const roles: string[] = [];
        const call: CallFn = (s) => {
            roles.push(s.role);
            return s.role === 'reviewer' ? run('{"findings":[]}') : run('done');
        };
        const r = run_review({ requirement: 'R', clone, call, diff: () => 'D', passes_now: () => false });
        expect(roles).toEqual(['author', 'reviewer']);
        expect(r.revised).toBe(false);
    });
    it('the reviewer sees the requirement and the diff, and cost sums every step', () => {
        const clone = scratchClone();
        const prompts: string[] = [];
        const call: CallFn = (s) => {
            prompts.push(s.prompt);
            return s.role === 'reviewer' ? run('{"findings":[{"file":"x","issue":"a"}]}', 100) : run('done', 10);
        };
        const r = run_review({ requirement: 'REQ-TEXT', clone, call, diff: () => 'DIFF-TEXT', passes_now: () => false });
        expect(prompts[1]).toContain('REQ-TEXT');
        expect(prompts[1]).toContain('DIFF-TEXT');
        expect(r.tokens_breakdown['input_tokens']).toBe(120);
        expect(r.wall_time_seconds).toBe(6);
    });
});

describe('run_test_first (arm C)', () => {
    it('runs tester then author, records red/green, scores without the generated file', () => {
        const clone = scratchClone();
        const roles: string[] = [];
        const call: CallFn = (s) => {
            roles.push(s.role);
            if (s.role === 'tester') fs.writeFileSync(path.join(clone, GENERATED_TEST_REL), 'process.exit(0)\n');
            return run('ok');
        };
        let execs = 0;
        const r = run_test_first({
            requirement: 'R',
            clone,
            call,
            exec: () => (execs++ === 0 ? 1 : 0),
            tests_pass_on_reference: () => true,
        });
        expect(roles).toEqual(['tester', 'author']);
        expect(r.tests_red_before).toBe(true);
        expect(r.tests_green_after).toBe(true);
        expect(r.tests_fp).toBe(false);
        expect(fs.existsSync(path.join(clone, GENERATED_TEST_REL))).toBe(false);
    });
    it('tests that fail on the reference are a false positive', () => {
        const clone = scratchClone();
        const call: CallFn = (s) => {
            if (s.role === 'tester') fs.writeFileSync(path.join(clone, GENERATED_TEST_REL), 'x');
            return run('ok');
        };
        const r = run_test_first({ requirement: 'R', clone, call, exec: () => 1, tests_pass_on_reference: () => false });
        expect(r.tests_fp).toBe(true);
    });
    it('a tester that edits source is undone and recorded', () => {
        const clone = scratchClone();
        const call: CallFn = (s) => {
            if (s.role === 'tester') {
                fs.writeFileSync(path.join(clone, 'src', 'a.mjs'), 'export const a = 2;\n');
                fs.writeFileSync(path.join(clone, 'src', 'b.mjs'), 'new\n');
            }
            return run('ok');
        };
        const r = run_test_first({ requirement: 'R', clone, call, exec: () => 0, tests_pass_on_reference: () => true });
        expect(r.tester_touched_source).toEqual(['src/a.mjs', 'src/b.mjs']);
        expect(fs.readFileSync(path.join(clone, 'src', 'a.mjs'), 'utf-8')).toBe('export const a = 1;\n');
        expect(fs.existsSync(path.join(clone, 'src', 'b.mjs'))).toBe(false);
    });
    it('no generated file → the author gets the plain requirement and nothing is counted', () => {
        const clone = scratchClone();
        const prompts: string[] = [];
        const r = run_test_first({
            requirement: 'PLAIN',
            clone,
            call: (s) => {
                prompts.push(s.prompt);
                return run('ok');
            },
            exec: () => 0,
            tests_pass_on_reference: () => true,
        });
        expect(prompts[1]).toBe('PLAIN');
        expect(r.tests_fp).toBeNull();
    });
});

describe('helpers', () => {
    it('restore_outside_tests restores a deleted source file', () => {
        const clone = scratchClone();
        const before = new Map([['src/a.mjs', 'export const a = 1;\n']]);
        fs.rmSync(path.join(clone, 'src', 'a.mjs'));
        expect(restore_outside_tests(clone, before)).toEqual(['src/a.mjs']);
        expect(fs.existsSync(path.join(clone, 'src', 'a.mjs'))).toBe(true);
    });
    it('sum_breakdowns adds numeric fields', () => {
        const s = (n: number) => ({ role: 'author' as const, errored: false, tokens: 0, wall_time_seconds: 0, tokens_breakdown: { input_tokens: n } });
        expect(sum_breakdowns([s(1), s(2)])).toEqual({ input_tokens: 3 });
    });
    it('tests_pass_on_reference distinguishes a correct test from a wrong one on a real hold-out', () => {
        const fixture = path.join(AB, 'fixtures-v2', 'hdhS-sentinel-01');
        const patch = path.join(AB, 'oracle-v2', 'hdhS-sentinel-01.patch');
        const right = "import { loadConfig } from '../src/config/load.mjs';\nif (loadConfig({ maxItems: 0 }).maxItems !== 0) process.exit(1);\n";
        const wrong = "import { loadConfig } from '../src/config/load.mjs';\nif (loadConfig({ maxItems: 0 }).maxItems !== 50) process.exit(1);\n";
        expect(tests_pass_on_reference(fixture, patch, right)).toBe(true);
        expect(tests_pass_on_reference(fixture, patch, wrong)).toBe(false);
    });
});

describe('the 1.7 corpus', () => {
    const load = (f: string): Array<Record<string, unknown>> =>
        (YAML.parse(fs.readFileSync(path.join(REPO, 'internal', 'bench', 'corpora', f), 'utf-8')) as { tasks: Array<Record<string, unknown>> }).tasks;
    it('carries the three headroom tasks verbatim from ab-trackb-v2', () => {
        const trackb = new Map(load('ab-trackb-v2.yaml').map((t) => [t['id'], t]));
        const mine = load('ab-headroom-17.yaml').filter((t) => !t['holdout']);
        expect(mine.map((t) => t['id'])).toEqual(['capH-debug-08', 'hdrH-done-01', 'hdrL-multistep-01']);
        for (const t of mine) expect(t).toEqual(trackb.get(t['id']));
    });
    it('marks exactly the three hold-out tasks, each with a reference patch and a hidden verifier', () => {
        const hold = load('ab-headroom-17.yaml').filter((t) => t['holdout'] === true);
        expect(hold.map((t) => t['id'])).toEqual(['hdhB-boundary-01', 'hdhI-invalidation-01', 'hdhS-sentinel-01']);
        for (const t of hold) {
            expect(fs.existsSync(path.join(AB, 'oracle-v2', `${String(t['id'])}.patch`))).toBe(true);
            expect(fs.existsSync(path.join(AB, 'verifiers-v2', String(t['id']), 'tests', 'solve.check.mjs'))).toBe(true);
        }
    });
});

describe('restore_outside_tests ignores the package runtime state', () => {
    it('leaves files the installed hooks write under agents/ and dot-dirs alone', () => {
        const clone = scratchClone();
        const before = new Map([['src/a.mjs', 'export const a = 1;\n']]);
        fs.mkdirSync(path.join(clone, 'agents', 'runtime'), { recursive: true });
        fs.writeFileSync(path.join(clone, 'agents', 'runtime', 'x.json'), '{}');
        fs.mkdirSync(path.join(clone, '.cache'));
        fs.writeFileSync(path.join(clone, '.cache', 'y'), 'y');
        expect(restore_outside_tests(clone, before)).toEqual([]);
        expect(fs.existsSync(path.join(clone, 'agents', 'runtime', 'x.json'))).toBe(true);
    });
});
