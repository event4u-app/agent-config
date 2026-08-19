/**
 * decision_memo — the memo channel's shape and index contract.
 *
 * What is worth pinning here, and why each one is not obvious:
 *
 *   · **Refusal on an incomplete memo.** The channel's value is that a reader
 *     can review a resolution afterwards. A memo missing its reasoning is a
 *     log line pretending to be a record, so the writer refuses rather than
 *     writing a partial one.
 *   · **Monotonic, gap-free index per run.** With gaps, "003 exists and 002
 *     does not" is ambiguous between a pruned memo and an unwritten one.
 *   · **Run-id containment.** The id becomes a directory name; a traversal or
 *     a silently-sanitised id would put two runs in one directory, which
 *     destroys exactly the per-run reviewability the channel exists for.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    DECISIONS_DIR_REL,
    isSafeRunId,
    listMemos,
    main,
    nextIndex,
    render,
    runDir,
    validate,
    writeMemo,
    type DecisionMemo,
} from '../../src/scripts/decision_memo.js';

const dirs: string[] = [];
afterEach(() => {
    while (dirs.length > 0) {
        const d = dirs.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

function tmpRoot(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'decision-memo-'));
    dirs.push(d);
    return d;
}

const MEMO: DecisionMemo = {
    question: 'Should the debate ledger span the invocation or the round?',
    chosen: 'the invocation',
    reasoning: 'the eligible failure classes are durable, so a per-round ledger re-spawns a dead binary',
    resolver: 'council',
    confidence: 'medium',
};

describe('decision_memo — validation', () => {
    it('accepts a complete memo', () => {
        expect(validate(MEMO)).toEqual([]);
    });

    it('names every missing field at once rather than the first', () => {
        // A caller fixing one field at a time round-trips N times; the point of
        // returning a list is that one run reports the whole gap.
        const problems = validate({});
        expect(problems.length).toBe(5);
        expect(problems.join(' ')).toContain('question');
        expect(problems.join(' ')).toContain('reasoning');
        expect(problems.join(' ')).toContain('confidence');
    });

    it('whitespace is not content', () => {
        expect(validate({ ...MEMO, reasoning: '   ' })).toEqual([
            'reasoning is required and must be non-empty',
        ]);
    });

    it('confidence is a band, never a number', () => {
        expect(validate({ ...MEMO, confidence: '0.7' as never }).join(' ')).toContain('confidence');
        expect(validate({ ...MEMO, confidence: 'HIGH' as never }).join(' ')).toContain('confidence');
    });
});

describe('decision_memo — run id containment', () => {
    it('accepts an ordinary run id', () => {
        expect(isSafeRunId('ad06cc0fd4df1e02')).toBe(true);
        expect(isSafeRunId('run-1_a')).toBe(true);
    });

    it('refuses anything that is not a single filename component', () => {
        for (const bad of ['..', 'a/b', 'a\\b', '', 'a b', 'a.b', 'x'.repeat(65)]) {
            expect(isSafeRunId(bad), bad).toBe(false);
        }
    });

    it('writeMemo throws rather than sanitising — two runs must never share a directory', () => {
        const root = tmpRoot();
        expect(() => writeMemo(root, '../escape', MEMO)).toThrow(/safe filename/);
    });
});

describe('decision_memo — writing', () => {
    it('writes 001 first and lands under the run directory', () => {
        const root = tmpRoot();
        const res = writeMemo(root, 'run1', MEMO);
        expect(res.index).toBe(1);
        expect(res.path).toBe(path.join(root, DECISIONS_DIR_REL, 'run1', '001.md'));
        expect(fs.existsSync(res.path)).toBe(true);
    });

    it('the index is monotonic and gap-free within a run', () => {
        const root = tmpRoot();
        for (let i = 1; i <= 3; i++) {
            expect(writeMemo(root, 'run1', MEMO).index).toBe(i);
        }
        expect(listMemos(root, 'run1').map((p) => path.basename(p))).toEqual([
            '001.md',
            '002.md',
            '003.md',
        ]);
    });

    it('runs do not share an index space', () => {
        const root = tmpRoot();
        writeMemo(root, 'runA', MEMO);
        writeMemo(root, 'runA', MEMO);
        expect(writeMemo(root, 'runB', MEMO).index).toBe(1);
    });

    it('a deleted memo does not renumber the survivors', () => {
        // The index is one past the HIGHEST present, not a count: renumbering
        // would make a memo referenced elsewhere point at a different decision.
        const root = tmpRoot();
        writeMemo(root, 'run1', MEMO);
        writeMemo(root, 'run1', MEMO);
        fs.rmSync(path.join(runDir(root, 'run1'), '001.md'));
        expect(writeMemo(root, 'run1', MEMO).index).toBe(3);
    });

    it('refuses an incomplete memo instead of writing a partial record', () => {
        const root = tmpRoot();
        expect(() => writeMemo(root, 'run1', { ...MEMO, reasoning: '' })).toThrow(/incomplete/);
        expect(listMemos(root, 'run1')).toEqual([]);
    });

    it('non-memo files in the directory are ignored by both the index and the listing', () => {
        const root = tmpRoot();
        const dir = runDir(root, 'run1');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'README.md'), 'notes', 'utf-8');
        fs.writeFileSync(path.join(dir, '7.md'), 'wrong width', 'utf-8');
        expect(nextIndex(dir)).toBe(1);
        expect(writeMemo(root, 'run1', MEMO).index).toBe(1);
        expect(listMemos(root, 'run1').map((p) => path.basename(p))).toEqual(['001.md']);
    });
});

describe('decision_memo — rendering', () => {
    it('carries all five fields plus the stamp', () => {
        const out = render(MEMO, 2, '2026-08-19T00:00:00.000Z');
        expect(out).toContain('# Decision 002');
        expect(out).toContain('**Resolver:** council');
        expect(out).toContain('**Confidence:** medium');
        expect(out).toContain('2026-08-19T00:00:00.000Z');
        expect(out).toContain(MEMO.question);
        expect(out).toContain(MEMO.chosen);
        expect(out).toContain(MEMO.reasoning);
    });

    it('the chosen option is its own section — a reader must see what was not taken', () => {
        expect(render(MEMO, 1, 'x')).toContain('## Chosen');
        expect(render(MEMO, 1, 'x')).toContain('## Reasoning');
    });
});

describe('decision_memo — CLI', () => {
    it('write exits 0 and prints the repo-relative path', () => {
        const root = tmpRoot();
        const out: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((c: string | Uint8Array): boolean => {
            out.push(typeof c === 'string' ? c : Buffer.from(c).toString('utf-8'));
            return true;
        }) as typeof process.stdout.write;
        let rc: number;
        try {
            rc = main([
                'write',
                '--root', root,
                '--run', 'cli1',
                '--question', 'q',
                '--chosen', 'c',
                '--reasoning', 'r',
                '--resolver', 'agent',
                '--confidence', 'low',
            ]);
        } finally {
            process.stdout.write = orig;
        }
        expect(rc).toBe(0);
        expect(out.join('')).toContain(path.join(DECISIONS_DIR_REL, 'cli1', '001.md'));
    });

    it('a missing field exits 2 and writes nothing', () => {
        const root = tmpRoot();
        const errs: string[] = [];
        const orig = process.stderr.write.bind(process.stderr);
        process.stderr.write = ((c: string | Uint8Array): boolean => {
            errs.push(typeof c === 'string' ? c : Buffer.from(c).toString('utf-8'));
            return true;
        }) as typeof process.stderr.write;
        let rc: number;
        try {
            rc = main(['write', '--root', root, '--run', 'cli2', '--question', 'q']);
        } finally {
            process.stderr.write = orig;
        }
        expect(rc).toBe(2);
        expect(errs.join('')).toContain('reasoning');
        expect(listMemos(root, 'cli2')).toEqual([]);
    });

    it('an unknown subcommand exits 2', () => {
        const orig = process.stderr.write.bind(process.stderr);
        process.stderr.write = (() => true) as typeof process.stderr.write;
        try {
            expect(main(['delete', '--run', 'x'])).toBe(2);
        } finally {
            process.stderr.write = orig;
        }
    });
});

describe('writeMemo — a concurrent writer never overwrites a memo', () => {
    // R2 review, finding 10. The claim this module makes is that the index is
    // monotonic and gap-free, so a reader can tell a PRUNED memo from an
    // UNWRITTEN one. A lost write leaves no gap, so it defeats exactly that.
    it('two writers racing the same index each get their own file', () => {
        const root = tmpRoot();
        const run = 'race-run';
        const dir = runDir(root, run);
        fs.mkdirSync(dir, { recursive: true });
        // Simulate the loser of the race: 001 already exists by the time this
        // writer's `wx` lands, which is precisely the window the old
        // read-then-write ignored.
        fs.writeFileSync(path.join(dir, '001.md'), 'written by the other caller', 'utf-8');
        const res = writeMemo(root, run, MEMO);
        expect(res.index).toBe(2);
        expect(fs.readFileSync(path.join(dir, '001.md'), 'utf-8')).toBe(
            'written by the other caller',
        );
        expect(listMemos(root, run)).toHaveLength(2);
    });

    it('a non-EEXIST failure is raised, never retried into a hang', () => {
        const root = tmpRoot();
        // A FILE where the run directory must go: mkdirSync throws EEXIST on
        // the directory itself, before any slot is claimed.
        const dir = runDir(root, 'not-a-dir');
        fs.mkdirSync(path.dirname(dir), { recursive: true });
        fs.writeFileSync(dir, 'x', 'utf-8');
        expect(() => writeMemo(root, 'not-a-dir', MEMO)).toThrow();
    });
});
