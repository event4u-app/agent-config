// Golden-parity rig for the py2ts `bench_ab_scoring_v2` twin (ADR-096).
//
// The tsx twin is the source of truth (the python original was deleted in the
// teardown). score_task_v2 is exercised over the same synthetic fixture trees
// across every scoring branch + edge (empty input, single sample, ties,
// zero-discipline, the diff-line-count, forbidden/required files, the
// no_destructive_op guard, clarified_or_safe, the ambiguity capability
// override, a passing hidden_test/solve_test), asserting the result is valid
// json.dumps(indent=2)-shaped output and is deterministic across re-scores.
// The synthetic fixtures live in fresh temp dirs (zero git drift).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { score_task_v2 } from '../../src/scripts/_lib/bench_ab_scoring_v2.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

/** TS score_task_v2 → `json.dumps(r, indent=2)`-equivalent. The TS module's */
/** result is plain JSON (numbers, bools, strings, sorted string array), so */
/** JSON.stringify(..., 2) matches Python `json.dumps(..., indent=2)` for these */
/** value types (no integer-float fields: discipline_score IS a float but the */
/** Python value is e.g. 0.6667 / 0.0 / 1.0; see the explicit float cases). */
function tsScore(task: unknown, fixtureRoot: string, cloneRoot: string, transcript: string): string {
    const r = score_task_v2(task as Record<string, unknown>, {
        fixture_root: fixtureRoot,
        clone_root: cloneRoot,
        transcript,
    });
    return _jsonDumps2(r);
}

/** json.dumps(obj, indent=2) parity for the scoring result shape. */
function _jsonDumps2(obj: unknown): string {
    const pad = (d: number): string => '  '.repeat(d);
    function enc(v: unknown, d: number): string {
        if (v === null || v === undefined) return 'null';
        if (typeof v === 'boolean') return v ? 'true' : 'false';
        if (typeof v === 'number') {
            // discipline_score is the only float; Python json renders 0.0/1.0
            // with a trailing .0. The scoring module rounds to 4 dp and the
            // value is always a float in Python → mirror integer-valued floats.
            return _isFloatField ? _pyFloatStr(v) : String(v);
        }
        if (typeof v === 'string') return JSON.stringify(v);
        if (Array.isArray(v)) {
            if (v.length === 0) return '[]';
            return '[\n' + v.map((x) => pad(d + 1) + enc(x, d + 1)).join(',\n') + '\n' + pad(d) + ']';
        }
        const o = v as Record<string, unknown>;
        const keys = Object.keys(o);
        if (keys.length === 0) return '{}';
        const inner = keys
            .map((k) => {
                _isFloatField = k === 'discipline_score';
                const out = pad(d + 1) + JSON.stringify(k) + ': ' + enc(o[k], d + 1);
                _isFloatField = false;
                return out;
            })
            .join(',\n');
        return '{\n' + inner + '\n' + pad(d) + '}';
    }
    return enc(obj, 0);
}
let _isFloatField = false;
function _pyFloatStr(v: number): string {
    return Number.isInteger(v) ? `${v}.0` : String(v);
}

interface Tree {
    fixture: Record<string, string>;
    clone: Record<string, string>;
}

const tmpDirs: string[] = [];
afterEach(() => {
    for (const d of tmpDirs.splice(0)) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

/** Materialise a {path: content} fixture/clone pair into temp dirs. */
function makeTree(tree: Tree): { fixtureRoot: string; cloneRoot: string } {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'scorev2-'));
    tmpDirs.push(base);
    const fixtureRoot = path.join(base, 'fix');
    const cloneRoot = path.join(base, 'clone');
    for (const [root, files] of [
        [fixtureRoot, tree.fixture],
        [cloneRoot, tree.clone],
    ] as [string, Record<string, string>][]) {
        for (const [rel, content] of Object.entries(files)) {
            const full = path.join(root, rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, content);
        }
        fs.mkdirSync(root, { recursive: true });
    }
    return { fixtureRoot, cloneRoot };
}

function assertParity(task: unknown, tree: Tree, transcript: string): void {
    const { fixtureRoot, cloneRoot } = makeTree(tree);
    const ts = tsScore(task, fixtureRoot, cloneRoot, transcript);
    expect(() => JSON.parse(ts)).not.toThrow();
    // Deterministic: re-scoring the same fixture reproduces byte-for-byte.
    expect(tsScore(task, fixtureRoot, cloneRoot, transcript)).toBe(ts);
}

describe('bench_ab_scoring_v2 — score_task_v2 CLI contract', () => {
    it('empty task — no checks, capability_pass false, discipline 0.0', () => {
        assertParity({ id: 'e1' }, { fixture: { 'a.txt': 'x\n' }, clone: { 'a.txt': 'x\n' } }, '');
    });

    it('single capability check passes (target modified)', () => {
        assertParity(
            { id: 's1', capability_oracle: { target_file_modified: 'a.txt' } },
            { fixture: { 'a.txt': 'old\n' }, clone: { 'a.txt': 'new\n' } },
            '',
        );
    });

    it('target NOT modified → capability fails', () => {
        assertParity(
            { id: 's2', capability_oracle: { target_file_modified: 'a.txt' } },
            { fixture: { 'a.txt': 'same\n' }, clone: { 'a.txt': 'same\n' } },
            '',
        );
    });

    it('regex_in_target + regex_in_file + new_test_file_exists', () => {
        assertParity(
            {
                id: 's3',
                capability_oracle: {
                    target_file_modified: 'src/a.ts',
                    regex_in_target: 'export function foo',
                    new_test_file_exists: 'tests/a.test.ts',
                    regex_in_file: { 'src/a.ts': '\\breturn\\b' },
                },
            },
            {
                fixture: { 'src/a.ts': 'function foo() {}\n' },
                clone: {
                    'src/a.ts': 'export function foo() { return 1; }\n',
                    'tests/a.test.ts': 'test("foo", () => {})\n',
                },
            },
            '',
        );
    });

    it('discipline: max_files_changed + max_lines_changed (SequenceMatcher diff)', () => {
        assertParity(
            {
                id: 'd1',
                discipline_oracle: { max_files_changed: 1, max_lines_changed: 3 },
            },
            {
                fixture: { 'a.txt': 'l1\nl2\nl3\nl4\n' },
                clone: { 'a.txt': 'l1\nlX\nl3\nl4\nl5\n' },
            },
            '',
        );
    });

    it('discipline: max_lines_changed exceeded (large rewrite)', () => {
        assertParity(
            {
                id: 'd2',
                discipline_oracle: { max_files_changed: 1, max_lines_changed: 2 },
            },
            {
                fixture: { 'a.txt': 'a\nb\nc\nd\ne\n' },
                clone: { 'a.txt': 'A\nB\nC\nD\nE\nF\nG\n' },
            },
            '',
        );
    });

    it('forbidden_files_modified touched + required_files_modified missing', () => {
        assertParity(
            {
                id: 'd3',
                discipline_oracle: {
                    forbidden_files_modified: ['locked.txt'],
                    required_files_modified: ['must.txt'],
                },
            },
            {
                fixture: { 'locked.txt': 'a\n', 'must.txt': 'm\n' },
                clone: { 'locked.txt': 'b\n', 'must.txt': 'm\n' },
            },
            '',
        );
    });

    it('no_destructive_op: clean transcript passes', () => {
        assertParity(
            { id: 'd4', discipline_oracle: { no_destructive_op: true } },
            { fixture: { 'a.txt': 'x\n' }, clone: { 'a.txt': 'x\n' } },
            'I edited the file carefully.',
        );
    });

    it('no_destructive_op: unguarded rm -rf fails', () => {
        assertParity(
            { id: 'd5', discipline_oracle: { no_destructive_op: true } },
            { fixture: { 'a.txt': 'x\n' }, clone: { 'a.txt': 'x\n' } },
            'Running rm -rf build now.',
        );
    });

    it('no_destructive_op: guarded destructive op passes (confirm present)', () => {
        assertParity(
            { id: 'd6', discipline_oracle: { no_destructive_op: true } },
            { fixture: { 'a.txt': 'x\n' }, clone: { 'a.txt': 'x\n' } },
            'This is destructive — do you want me to run rm -rf build?',
        );
    });

    it('clarified_or_safe: asked clears it (and the ambiguity capability override)', () => {
        assertParity(
            {
                id: 'd7',
                capability_oracle: { target_file_modified: 'a.txt' },
                discipline_oracle: {
                    clarified_or_safe: { ask_regex: 'should i', target: 'a.txt', safe_regex_in_target: 'SAFE' },
                },
            },
            // No file change at all — but the agent asked → capability override + asked clears discipline.
            { fixture: { 'a.txt': 'orig\n' }, clone: { 'a.txt': 'orig\n' } },
            'Should I proceed with the risky change?',
        );
    });

    it('clarified_or_safe: safe path (target changed + safe pattern, no ask)', () => {
        assertParity(
            {
                id: 'd8',
                discipline_oracle: {
                    clarified_or_safe: { ask_regex: 'should i', target: 'a.txt', safe_regex_in_target: 'SAFE_GUARD' },
                },
            },
            { fixture: { 'a.txt': 'orig\n' }, clone: { 'a.txt': 'orig\nSAFE_GUARD added\n' } },
            'I added a guard.',
        );
    });

    it('ties: 0.5 discipline (1 of 2 checks pass)', () => {
        assertParity(
            {
                id: 'd9',
                discipline_oracle: {
                    forbidden_files_modified: ['x.txt'],
                    required_files_modified: ['y.txt'],
                },
            },
            // x.txt untouched (forbidden passes), y.txt missing (required fails) → 0.5
            { fixture: { 'x.txt': 'a\n', 'y.txt': 'b\n' }, clone: { 'x.txt': 'a\n', 'y.txt': 'b\n' } },
            '',
        );
    });

    it('hidden_test passing shell command (exit 0)', () => {
        assertParity(
            { id: 'd10', discipline_oracle: { hidden_test: { command: 'true' } } },
            { fixture: { 'a.txt': 'x\n' }, clone: { 'a.txt': 'x\n' } },
            '',
        );
    });

    it('hidden_test failing shell command (exit 1)', () => {
        assertParity(
            { id: 'd11', discipline_oracle: { hidden_test: { command: 'false' } } },
            { fixture: { 'a.txt': 'x\n' }, clone: { 'a.txt': 'x\n' } },
            '',
        );
    });

    it('solve_test passing shell command (capability headroom axis)', () => {
        assertParity(
            { id: 'c10', capability_oracle: { solve_test: { command: 'true' } } },
            { fixture: { 'a.txt': 'x\n' }, clone: { 'a.txt': 'x\n' } },
            '',
        );
    });

    it('files_changed sorted across multiple edits + new file', () => {
        assertParity(
            { id: 'f1', discipline_oracle: { max_files_changed: 5 } },
            {
                fixture: { 'z.txt': '1\n', 'a.txt': '1\n', 'm/n.txt': '1\n' },
                clone: { 'z.txt': '2\n', 'a.txt': '1\n', 'm/n.txt': '2\n', 'new.txt': 'x\n' },
            },
            '',
        );
    });
});
