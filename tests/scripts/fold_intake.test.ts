// Tests for src/scripts/fold_intake.ts (memory/knowledge validation Phase 0-pre).
//
// Contract under test: 2^k batching in stable file+line order, deterministic
// fold IDs, idempotent re-runs (byte-level no-op), children never mutated,
// dry-run writes nothing, usage errors on bad batch sizes.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    childRanges,
    foldId,
    planFolds,
    readIntakeLines,
    renderFold,
    type IntakeLine,
} from '../../src/scripts/fold_intake.js';
import { runTs } from './_wave8g.js';

const tmp: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fold-intake-'));
    tmp.push(d);
    return d;
}
afterEach(() => {
    while (tmp.length) {
        fs.rmSync(tmp.pop() as string, { recursive: true, force: true });
    }
});

function event(i: number): string {
    return JSON.stringify({
        ts: `2026-07-0${(i % 9) + 1}T00:00:00Z`,
        type: 'observation',
        observation: `intake event number ${i}`,
    });
}

/** Seed an intake dir with `counts` events per file, returns the dir. */
function seedIntake(counts: number[]): string {
    const dir = path.join(mkTmp(), 'intake');
    fs.mkdirSync(dir, { recursive: true });
    let n = 0;
    counts.forEach((count, f) => {
        const lines: string[] = [];
        for (let i = 0; i < count; i++) lines.push(event(n++));
        fs.writeFileSync(path.join(dir, `events-2026-07-0${f + 1}.jsonl`), lines.join('\n') + '\n', 'utf-8');
    });
    return dir;
}

function run(args: string[]): ReturnType<typeof runTs> {
    return runTs('fold_intake', args);
}

describe('fold_intake — planning primitives', () => {
    it('only complete batches fold; the tail stays live', () => {
        const dir = seedIntake([6, 4]); // 10 events
        const lines = readIntakeLines(dir);
        expect(lines).toHaveLength(10);
        const plans = planFolds(lines, 4);
        expect(plans).toHaveLength(2); // 8 folded, 2 tail
        expect(plans[0]?.children).toHaveLength(4);
        expect(plans[1]?.children).toHaveLength(4);
    });

    it('fold IDs are deterministic and input-sensitive', () => {
        const a: IntakeLine[] = [{ file: 'f', line: 1, raw: '{"x":1}' }];
        const b: IntakeLine[] = [{ file: 'g', line: 9, raw: '{"x":1}' }];
        const c: IntakeLine[] = [{ file: 'f', line: 1, raw: '{"x":2}' }];
        expect(foldId(a)).toBe(foldId(b)); // ID hashes raw content only
        expect(foldId(a)).not.toBe(foldId(c));
        expect(foldId(a)).toMatch(/^[0-9a-f]{12}$/);
    });

    it('stable order: sorted files, then line order', () => {
        const dir = seedIntake([2, 2]);
        const lines = readIntakeLines(dir);
        const order = lines.map((l) => `${path.basename(l.file)}:${l.line}`);
        expect(order).toEqual([
            'events-2026-07-01.jsonl:1',
            'events-2026-07-01.jsonl:2',
            'events-2026-07-02.jsonl:1',
            'events-2026-07-02.jsonl:2',
        ]);
    });

    it('childRanges collapses contiguous per-file runs', () => {
        const mk = (file: string, line: number): IntakeLine => ({ file, line, raw: '{}' });
        const ranges = childRanges([mk('a', 1), mk('a', 2), mk('a', 4), mk('b', 1)]);
        expect(ranges).toEqual(['a:1-2', 'a:4', 'b:1']);
    });

    it('renderFold carries extract snippets + link-backs', () => {
        const dir = seedIntake([4]);
        const [plan] = planFolds(readIntakeLines(dir), 4);
        const page = renderFold(plan!, 4);
        expect(page).toContain(`# Fold ${plan!.id}`);
        expect(page).toContain('intake event number 0');
        expect(page).toContain('## Children (link-backs)');
        expect(page).toContain(':1-4');
    });
});

describe('fold_intake — CLI contract', () => {
    it('writes one page per complete batch; JSON report shape', () => {
        const dir = seedIntake([6]); // 6 events, batch 4 → 1 fold, tail 2
        const out = path.join(mkTmp(), 'archive');
        const r = run(['--intake-dir', dir, '--out-dir', out, '--batch-size', '4', '--format', 'json']);
        expect(r.status).toBe(0);
        const report = JSON.parse(r.stdout);
        expect(report.total_events).toBe(6);
        expect(report.unfolded_tail).toBe(2);
        expect(report.folds).toHaveLength(1);
        expect(report.folds[0].action).toBe('written');
        const page = path.join(out, `fold-${report.folds[0].id}.md`);
        expect(fs.existsSync(page)).toBe(true);
    });

    it('is idempotent — second run is a byte-level no-op', () => {
        const dir = seedIntake([8]);
        const out = path.join(mkTmp(), 'archive');
        const first = run(['--intake-dir', dir, '--out-dir', out, '--batch-size', '4', '--format', 'json']);
        expect(first.status).toBe(0);
        const pages = fs.readdirSync(out).sort();
        const bytes = new Map(pages.map((p) => [p, fs.readFileSync(path.join(out, p), 'utf-8')]));

        const second = run(['--intake-dir', dir, '--out-dir', out, '--batch-size', '4', '--format', 'json']);
        expect(second.status).toBe(0);
        const report = JSON.parse(second.stdout);
        for (const fold of report.folds) {
            expect(fold.action).toContain('skipped — idempotent');
        }
        expect(fs.readdirSync(out).sort()).toEqual(pages);
        for (const p of pages) {
            expect(fs.readFileSync(path.join(out, p), 'utf-8')).toBe(bytes.get(p));
        }
    });

    it('never mutates the intake children', () => {
        const dir = seedIntake([8]);
        const before = fs
            .readdirSync(dir)
            .sort()
            .map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf-8')]);
        const r = run(['--intake-dir', dir, '--out-dir', path.join(mkTmp(), 'archive'), '--batch-size', '4']);
        expect(r.status).toBe(0);
        const after = fs
            .readdirSync(dir)
            .sort()
            .map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf-8')]);
        expect(after).toEqual(before);
    });

    it('--dry-run writes nothing', () => {
        const dir = seedIntake([8]);
        const out = path.join(mkTmp(), 'archive');
        const r = run(['--intake-dir', dir, '--out-dir', out, '--batch-size', '4', '--dry-run', '--format', 'json']);
        expect(r.status).toBe(0);
        const report = JSON.parse(r.stdout);
        expect(report.dry_run).toBe(true);
        expect(report.folds[0].action).toBe('would write');
        expect(fs.existsSync(out)).toBe(false);
    });

    it('missing intake dir is a clean nothing-to-fold, exit 0', () => {
        const r = run(['--intake-dir', path.join(mkTmp(), 'nope'), '--out-dir', path.join(mkTmp(), 'a'), '--format', 'json']);
        expect(r.status).toBe(0);
        expect(JSON.parse(r.stdout).folds).toHaveLength(0);
    });

    it('rejects non-power-of-two batch sizes with exit 2', () => {
        for (const bad of ['3', '0', '1', '-4']) {
            const r = run(['--intake-dir', mkTmp(), '--batch-size', bad]);
            expect(r.status).toBe(2);
            expect(r.stderr).toContain('power of two');
        }
    });
});
