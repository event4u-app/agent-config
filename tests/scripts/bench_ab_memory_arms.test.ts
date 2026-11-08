// The multi-session memory family and the with/without-memory arm pair.
//
// A prior session is modelled by the memory it left on disk; the no-memory arm
// is the same fixture with that store removed from BOTH the pristine tree and
// the clone, so the scorer never reads the removal as the run's own work.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { audit_activation } from '../../internal/bench/core/_lib/bench_ab_activation.js';
import { changed_files, oracleRootFor, score_task_v2 } from '../../internal/bench/core/_lib/bench_ab_scoring_v2.js';
import { scoreReference } from '../../internal/bench/core/_lib/bench_task_validity.js';
import { reset_fixture, stripped_pristine } from '../../internal/bench/core/_lib/bench_ab_workspace.js';
import { ARMS, lift_audit_arms, selftest_run } from '../../internal/bench/core/bench_ab_v2_run.js';
import { analyse, to_markdown } from '../../internal/bench/core/bench_ab_v2_stats.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const CORPUS = path.join(REPO_ROOT, 'internal', 'bench', 'corpora', 'ab-trackb-v2.yaml');
const MEMORY_TASKS = ['memA-recall-01', 'memB-supersede-01', 'memC-stale-01'] as const;
const OPTS = { model: 'claude-haiku-4-5', max_budget: null, timeout: 30, placebo_chars: 2000, sp_dir: os.tmpdir() };

type Dict = Record<string, unknown>;

function task(id: string): Dict {
    const corpus = parseYaml(fs.readFileSync(CORPUS, 'utf8'), { version: '1.1' }) as { tasks: Dict[] };
    const t = corpus.tasks.find((x) => x['id'] === id);
    if (!t) throw new Error(`no task ${id}`);
    return t;
}

function readTree(root: string): string {
    const out: string[] = [];
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else out.push(fs.readFileSync(p, 'utf8'));
        }
    };
    walk(root);
    return out.join('\n');
}

const tmp: string[] = [];
afterEach(() => {
    for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('memory arms', () => {
    it('package-memory is the package arm; package-no-memory is the same arm minus agents/memory', () => {
        const { strip_paths: strip, ...rest } = ARMS['package-no-memory']!;
        expect(ARMS['package-memory']).toEqual(ARMS['package']);
        expect(rest).toEqual(ARMS['package']);
        expect(strip).toEqual(['agents/memory']);
    });

    it('both memory arms keep the plugin lift audit, and the selftest audit passes on them', () => {
        expect(lift_audit_arms(['vanilla', 'package-memory', 'package-no-memory'])).toEqual(['package-memory', 'package-no-memory']);
        const t = task('memA-recall-01');
        const arms: Record<string, Dict[]> = {};
        for (const arm of ['vanilla', 'package-memory', 'package-no-memory']) {
            arms[arm] = [{ ...selftest_run(t, arm, { ...OPTS, seed: 0 }), seed: 0 }];
        }
        const audit = audit_activation([{ id: t['id'], arms }], {
            baseline_arm: 'vanilla',
            lift_arms: lift_audit_arms(['vanilla', 'package-memory', 'package-no-memory']),
        });
        expect(audit.checked).toBe(2);
        expect(audit.violations).toEqual([]);
    });

    it('selftest: the no-memory clone has no store, the memory clone has it, and neither diff counts the store', () => {
        const t = task('memB-supersede-01');
        const withMem = selftest_run(t, 'package-memory', { ...OPTS, seed: 0 });
        const without = selftest_run(t, 'package-no-memory', { ...OPTS, seed: 0 });
        expect(fs.existsSync(path.join(String(withMem['workspace']), 'agents', 'memory'))).toBe(true);
        expect(fs.existsSync(path.join(String(without['workspace']), 'agents', 'memory'))).toBe(false);
        expect(without['stripped_paths']).toEqual(['agents/memory']);
        expect(withMem).not.toHaveProperty('stripped_paths');
        expect(without['final_files']).toEqual({});
        expect(without['capability_pass']).toBe(false);
    });
});

describe('with/without-memory report row', () => {
    const run = (cap: boolean) => ({ capability_pass: cap, discipline_score: 1, discipline_pass: true, errored: false });
    const rec = (id: string, withMem: boolean, without: boolean) => ({
        id,
        arms: { 'package-memory': [run(withMem)], 'package-no-memory': [run(without)] },
    });
    const labels = (a: Dict): string[] => (a['comparisons'] as Dict[]).map((c) => String(c['label']));

    it('a sweep with both memory arms reports the memory arm against the no-memory arm', () => {
        const payload = {
            arms: ['package-memory', 'package-no-memory'],
            records: [rec('memA-recall-01', true, false), rec('memB-supersede-01', true, false), rec('memC-stale-01', false, true)],
        };
        const a = analyse(payload);
        const row = (a['comparisons'] as Dict[]).find((c) => c['label'] === 'memory task outcome (with vs without memory)');
        expect(row).toBeDefined();
        expect(row?.['arm_treatment']).toBe('package-memory');
        expect(row?.['arm_baseline']).toBe('package-no-memory');
        expect(to_markdown(a, payload)).toContain('`package-memory` vs `package-no-memory`');
    });

    it('without both memory arms the row does not appear', () => {
        const recs = [{ id: 't', arms: { 'package-memory': [run(true)], vanilla: [run(true)] } }];
        expect(labels(analyse({ arms: ['vanilla', 'package-memory'], records: recs }))).not.toContain(
            'memory task outcome (with vs without memory)',
        );
    });
});

describe('stripped_pristine', () => {
    it('removes the paths from the pristine copy, keeps the verifier beside it, and the clone matches it', () => {
        const t = task('memA-recall-01');
        const [clone, pristine] = reset_fixture(t, 'package-no-memory', 0, undefined, ['agents/memory']);
        expect(fs.existsSync(path.join(pristine, 'agents', 'memory'))).toBe(false);
        expect(fs.existsSync(path.join(clone, 'agents', 'memory'))).toBe(false);
        expect(changed_files(pristine, clone).size).toBe(0);
        expect(oracleRootFor(pristine)).not.toBeNull();
    });

    it('without paths it returns the in-repo fixture unchanged', () => {
        const t = task('memA-recall-01');
        const [, pristine] = reset_fixture(t, 'package-memory', 0);
        expect(pristine).toBe(path.join(REPO_ROOT, 'internal', 'bench', 'ab', 'fixtures-v2', 'memA-recall-01'));
    });

    it('refuses a path that leaves the fixture', () => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'strip-'));
        tmp.push(base);
        const fx = path.join(base, 'fixtures-v2', 'x');
        fs.mkdirSync(fx, { recursive: true });
        expect(() => stripped_pristine(fx, ['../y'], path.join(base, 'out'))).toThrow(/outside the fixture/);
        expect(() => stripped_pristine(fx, ['/etc'], path.join(base, 'out'))).toThrow(/outside the fixture/);
    });
});

describe('memory task family', () => {
    // The fact each task turns on, and where it must live. A token that also
    // sat in the code would make the no-memory arm a second with-memory arm.
    const deciding: Record<string, { inMemory: RegExp; notInCode: RegExp }> = {
        'memA-recall-01': { inMemory: /half-to-even/, notInCode: /half[- ](?:to[- ])?even|banker/i },
        'memB-supersede-01': { inMemory: /250 ms[\s\S]*4000 ms/, notInCode: /\b(?:250|4000)\b/ },
        'memC-stale-01': { inMemory: /positive integers/, notInCode: /positive integers/ },
    };

    for (const id of MEMORY_TASKS) {
        it(`${id}: the deciding fact lives only in the memory store`, () => {
            const fx = path.join(REPO_ROOT, 'internal', 'bench', 'ab', 'fixtures-v2', id);
            const memory = readTree(path.join(fx, 'agents', 'memory'));
            const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mem-code-'));
            tmp.push(base);
            const code = readTree(stripped_pristine(fx, ['agents/memory'], base));
            expect(memory).toMatch(deciding[id]!.inMemory);
            expect(code).not.toMatch(deciding[id]!.notInCode);
        });

        it(`${id}: the reference passes and the untouched tree fails, with and without memory`, () => {
            const t = task(id);
            for (const strip of [[], ['agents/memory']]) {
                const [clone, pristine] = reset_fixture(t, strip.length ? 'package-no-memory' : 'package-memory', 7, undefined, strip);
                expect(score_task_v2(t, { fixture_root: pristine, clone_root: clone }).capability_pass).toBe(false);
                expect(scoreReference(t, pristine)).toEqual({ status: 'ok', detail: '' });
            }
        });
    }

    it('memC-stale-01: the stale entry is still in its review window, so a lookup would surface it', () => {
        const fx = path.join(REPO_ROOT, 'internal', 'bench', 'ab', 'fixtures-v2', 'memC-stale-01');
        const doc = parseYaml(fs.readFileSync(path.join(fx, 'agents', 'memory', 'domain-invariants.yml'), 'utf8')) as {
            entries: Dict[];
        };
        const stale = doc.entries.find((e) => e['id'] === 'customer-id-integer')!;
        expect(stale['status']).toBe('active');
        const due = new Date(String(stale['last_validated'])).getTime() + Number(stale['review_after_days']) * 86_400_000;
        expect(due).toBeGreaterThan(Date.parse('2027-01-01'));
    });

    it('memB-supersede-01: the older decision is recorded as superseded by the newer one', () => {
        const fx = path.join(REPO_ROOT, 'internal', 'bench', 'ab', 'fixtures-v2', 'memB-supersede-01');
        const doc = parseYaml(fs.readFileSync(path.join(fx, 'agents', 'memory', 'product-rules.yml'), 'utf8')) as {
            entries: Dict[];
        };
        const byId = Object.fromEntries(doc.entries.map((e) => [String(e['id']), e]));
        expect(byId['retry-fixed-1s']?.['status']).toBe('superseded');
        expect(byId['retry-exponential-250']?.['status']).toBe('active');
        expect(String(byId['retry-exponential-250']?.['rule'])).toMatch(/retry-fixed-1s/);
    });
});

describe('reset_fixture with git_init', () => {
    it('makes the clone a git repository with the fixture as its one base commit, and leaves the pristine tree alone', () => {
        const t = { id: 'refA-chunk-01', fixture: 'fixtures-v2/refA-chunk-01', git_init: true };
        const [clone, pristine] = reset_fixture(t, 'ref-nothing', 0);
        const count = spawnSync('git', ['rev-list', '--count', 'HEAD'], { cwd: clone, encoding: 'utf8' });
        expect(count.stdout.trim()).toBe('1');
        expect(spawnSync('git', ['status', '--porcelain'], { cwd: clone, encoding: 'utf8' }).stdout.trim()).toBe('');
        expect(fs.existsSync(path.join(pristine, '.git'))).toBe(false);
        expect(changed_files(pristine, clone).size).toBe(0);
    });
});
