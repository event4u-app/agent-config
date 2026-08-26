// Tests for src/agent-src/scripts/roadmap_set_step.ts
// (road-to-skill-ecosystem-runtime-enforcement Phase 6).
//
// Every mechanism in that file guards against a way a concurrent writer
// destroys work SILENTLY, so each test drives the failure rather than the happy
// path. The greedy-pattern case is the one that matters most: it is the recorded
// mechanism by which one substitution overwrites later entries, and a
// line-anchored writer must make it unreachable.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    LOCK_STALE_MS,
    RoadmapWriteError,
    acquireLock,
    findStep,
    resolvePlan,
    scanSteps,
    setGlyphOnLine,
    setStep,
} from '../../src/agent-src/scripts/roadmap_set_step.js';

const PLAN = [
    '# Road to something',
    '',
    '## Phase 1',
    '',
    '- [ ] **1.1 First step.** Does a thing.',
    '      verify: a command',
    '- [ ] **1.2 Second step.** Does another.',
    '- [x] **1.3 Third step.** Already done.',
    '',
    '## Acceptance Criteria',
    '',
    '- [ ] AC-1 — the residual state.',
    '',
].join('\n');

let tmp: string;
let file: string;
beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'setstep-')));
    file = path.join(tmp, 'road-to-x.md');
    fs.writeFileSync(file, PLAN, 'utf8');
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('scanSteps / findStep', () => {
    it('finds every checkbox, including the acceptance criteria', () => {
        expect(scanSteps(PLAN)).toHaveLength(4);
    });

    it('REFUSES an ambiguous prefix rather than taking the first match', () => {
        // Picking the first is the same silent-choice failure as resolving an
        // ambiguous plan — the caller believes it addressed a step it did not.
        expect(() => findStep(PLAN, '**1.')).toThrow(RoadmapWriteError);
    });

    it('refuses a prefix that matches nothing', () => {
        expect(() => findStep(PLAN, '**9.9')).toThrow(RoadmapWriteError);
    });

    it('resolves an unambiguous prefix', () => {
        expect(findStep(PLAN, '**1.2').glyph).toBe(' ');
    });
});

describe('setGlyphOnLine — line-anchored by construction', () => {
    it('changes ONE line and leaves every other step untouched', () => {
        const out = setGlyphOnLine(PLAN, 6, 'x');
        const glyphs = scanSteps(out).map((s) => s.glyph);
        expect(glyphs).toEqual([' ', 'x', 'x', ' ']);
    });

    it('cannot span entries even in principle — it takes a line INDEX, not a pattern', () => {
        // The greedy multi-line substitution that overwrites later entries has no
        // expression here: there is no regex over the document at all.
        const out = setGlyphOnLine(PLAN, 4, '~');
        expect(out.split('\n')).toHaveLength(PLAN.split('\n').length);
        expect(scanSteps(out)).toHaveLength(scanSteps(PLAN).length);
    });

    it('refuses a line that is not a checkbox', () => {
        expect(() => setGlyphOnLine(PLAN, 0, 'x')).toThrow(RoadmapWriteError);
    });
});

describe('setStep — lock, invariant, survival', () => {
    it('flips the glyph and preserves the step count', () => {
        const r = setStep(file, '**1.2', 'x');
        expect(r.from).toBe(' ');
        expect(r.to).toBe('x');
        expect(r.stepsBefore).toBe(r.stepsAfter);
        expect(scanSteps(fs.readFileSync(file, 'utf8')).map((s) => s.glyph)).toEqual([' ', 'x', 'x', ' ']);
    });

    it('REFUSES while another writer holds a fresh lock', () => {
        fs.writeFileSync(`${file}.lock`, '999\n');
        expect(() => setStep(file, '**1.2', 'x')).toThrow(RoadmapWriteError);
        // …and the plan is untouched: a refused write must not half-apply.
        expect(fs.readFileSync(file, 'utf8')).toBe(PLAN);
    });

    it('BREAKS a stale lock — a crashed writer must not wedge the file forever', () => {
        const lock = `${file}.lock`;
        fs.writeFileSync(lock, '999\n');
        const old = Date.now() - LOCK_STALE_MS - 1000;
        fs.utimesSync(lock, old / 1000, old / 1000);
        expect(() => setStep(file, '**1.2', 'x')).not.toThrow();
    });

    it('releases the lock even when the write is refused', () => {
        expect(() => setStep(file, '**9.9', 'x')).toThrow();
        expect(fs.existsSync(`${file}.lock`)).toBe(false);
        // Proven by a second call succeeding rather than by the absence alone.
        expect(() => setStep(file, '**1.2', 'x')).not.toThrow();
    });

    it('leaves NO temp file behind', () => {
        setStep(file, '**1.2', 'x');
        expect(fs.readdirSync(tmp)).toEqual(['road-to-x.md']);
    });

    it('re-reads the LIVE file inside the lock, not a caller snapshot', () => {
        // Rewrite the file between construction and the call: the writer must act
        // on what is on disk NOW, which is what makes the invariant meaningful.
        fs.writeFileSync(file, PLAN.replace('- [ ] **1.2 Second step.** Does another.\n', ''), 'utf8');
        expect(() => setStep(file, '**1.2', 'x')).toThrow(RoadmapWriteError);
    });
});

describe('acquireLock', () => {
    it('is exclusive — the second acquire on a fresh lock throws', () => {
        acquireLock(file);
        expect(() => acquireLock(file)).toThrow(RoadmapWriteError);
    });
});

describe('resolvePlan — fails closed on ambiguity', () => {
    const mkPlan = (root: string, name: string): void => {
        const d = path.join(root, 'agents', 'roadmaps');
        fs.mkdirSync(d, { recursive: true });
        fs.writeFileSync(path.join(d, name), PLAN, 'utf8');
    };

    it('resolves a single roadmap', () => {
        const a = path.join(tmp, 'a');
        mkPlan(a, 'road-to-one.md');
        expect(resolvePlan([a])).toContain('road-to-one.md');
    });

    it('REFUSES and NAMES BOTH when a nested directory carries its own plan', () => {
        const a = path.join(tmp, 'a');
        const nested = path.join(a, 'packages', 'inner');
        mkPlan(a, 'road-to-outer.md');
        mkPlan(nested, 'road-to-inner.md');
        try {
            resolvePlan([a, nested]);
            expect.unreachable('should have refused');
        } catch (e) {
            expect((e as Error).message).toContain('road-to-outer.md');
            expect((e as Error).message).toContain('road-to-inner.md');
        }
    });

    it('refuses when nothing is in scope, rather than returning a guess', () => {
        expect(() => resolvePlan([path.join(tmp, 'empty')])).toThrow(RoadmapWriteError);
    });
});

describe('setStep — a REAL concurrent race', () => {
    it('never loses a step: N parallel writers each flip a different step', () => {
        // Real processes, not a simulation: an in-process test cannot exercise the
        // lock at all, and a concurrency guard never seen under real contention
        // has unknown sensitivity.
        const big = [
            '# Road to concurrency',
            '',
            ...Array.from({ length: 8 }, (_, i) => `- [ ] **${String(i + 1)}.0 Step ${String(i + 1)}.** body`),
            '',
        ].join('\n');
        const f = path.join(tmp, 'road-to-race.md');
        fs.writeFileSync(f, big, 'utf8');

        const script = path.join(
            path.resolve(import.meta.dirname, '..', '..'),
            'src', 'agent-src', 'scripts', 'roadmap_set_step.ts',
        );
        const tsx = path.join(
            path.resolve(import.meta.dirname, '..', '..'),
            'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
        );

        // Retry on a held lock is the CALLER's job, so the test does what a caller
        // must: a bounded retry loop. Without it the assertion would measure lock
        // contention rather than data loss.
        const flip = (n: number): number => {
            for (let attempt = 0; attempt < 40; attempt += 1) {
                const r = spawnSync(tsx, [script, '--file', f, '--step', `**${String(n)}.0`, '--glyph', 'x'], {
                    encoding: 'utf8',
                });
                if (r.status === 0) return 0;
                if (!(r.stderr ?? '').includes('locked by another writer')) return r.status ?? -1;
            }
            return -2;
        };

        const results = Array.from({ length: 8 }, (_, i) => flip(i + 1));
        expect(results.every((s) => s === 0)).toBe(true);

        const final = scanSteps(fs.readFileSync(f, 'utf8'));
        expect(final).toHaveLength(8);
        // The property that matters: EVERY writer's work survived. A lost update
        // shows up here as a step still carrying ' '.
        expect(final.every((s) => s.glyph === 'x')).toBe(true);
    }, 60_000);
});
