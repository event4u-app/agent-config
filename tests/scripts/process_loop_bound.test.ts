// The executable bound of the `/roadmap:process-*` drain loop. A finite step
// list is a success condition, not an iteration cap: a step that keeps
// re-opening, or steps the run adds to its own roadmap, would let the loop run
// on with nothing counting. These cases pin the two refusals — the iteration
// cap and the no-progress window — and the CLI that carries them.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    PROCESS_LOOP_MIN_CAP,
    PROCESS_LOOP_STALL_WINDOW,
    processLoopIterationCap,
    tickProcessLoop,
    type ProcessLoopState,
} from '../../src/scripts/_lib/process_loop_bound.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Drive the bound through a sequence of open-step readings. */
function drive(readings: readonly number[]): { state: ProcessLoopState | null; refusals: string[] } {
    let state: ProcessLoopState | null = null;
    const refusals: string[] = [];
    for (const open of readings) {
        const r = tickProcessLoop(state, open);
        state = r.state;
        if (!r.verdict.ok) refusals.push(r.verdict.reason);
    }
    return { state, refusals };
}

describe('the iteration cap', () => {
    it('scales with the roadmap and never drops below the floor', () => {
        expect(processLoopIterationCap(0)).toBe(PROCESS_LOOP_MIN_CAP);
        expect(processLoopIterationCap(1)).toBe(PROCESS_LOOP_MIN_CAP);
        expect(processLoopIterationCap(40)).toBeGreaterThan(40);
    });

    it('lets a run that closes one step per tick finish', () => {
        const readings = Array.from({ length: 30 }, (_, i) => 30 - i);
        expect(drive(readings).refusals).toEqual([]);
    });

    it('refuses the tick past the cap even while the stall window never fires', () => {
        // Each reading is below the one three ticks earlier, so the stall window
        // stays quiet; only the cap can end a run that progresses this slowly.
        const readings = [5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1];
        expect(readings.length).toBe(processLoopIterationCap(5) + 1);
        expect(drive(readings).refusals).toEqual(['iteration-cap']);
    });
});

describe('the no-progress window', () => {
    it(`refuses when the open count has not fallen across ${String(PROCESS_LOOP_STALL_WINDOW)} ticks`, () => {
        const readings = [6, 5, ...Array.from({ length: PROCESS_LOOP_STALL_WINDOW }, () => 5)];
        expect(drive(readings).refusals).toEqual(['stagnated']);
    });

    it('does not fire one tick early', () => {
        const readings = [6, 5, ...Array.from({ length: PROCESS_LOOP_STALL_WINDOW - 1 }, () => 5)];
        expect(drive(readings).refusals).toEqual([]);
    });

    it('a closed roadmap is never refused', () => {
        expect(drive([3, 2, 1, 0, 0, 0, 0]).refusals).toEqual([]);
    });
});

describe('sessions:claim <slug> --step carries the bound', () => {
    function fixture(open: number): string {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-bound-'));
        spawnSync('git', ['init', '-q'], { cwd: root });
        fs.mkdirSync(path.join(root, 'agents', 'roadmaps'), { recursive: true });
        const steps = Array.from({ length: open }, (_, i) => `- [ ] step ${String(i + 1)}`).join('\n');
        fs.writeFileSync(path.join(root, 'agents', 'roadmaps', 'road-to-x.md'), `# x\n\n## Phase 1 — x\n\n${steps}\n`);
        return root;
    }

    function cli(root: string, args: string[]): { status: number | null; out: string } {
        const r = spawnSync(
            path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'),
            [path.join(REPO_ROOT, 'src', 'scripts', 'sessions_cli.ts'), 'claim', ...args],
            { cwd: root, encoding: 'utf-8', env: { ...process.env, AGENT_CONFIG_SESSION_ID: 'loop-bound-test' } },
        );
        return { status: r.status, out: `${r.stdout}${r.stderr}` };
    }

    it('refuses a step on a roadmap this session has not claimed', () => {
        const root = fixture(2);
        expect(cli(root, ['road-to-x', '--step']).status).toBe(3);
    });

    it('counts steps, then refuses with exit 3 once the open count stops falling', () => {
        const root = fixture(2);
        expect(cli(root, ['road-to-x']).status).toBe(0);
        const statuses: Array<number | null> = [];
        for (let i = 0; i < PROCESS_LOOP_STALL_WINDOW + 1; i++) statuses.push(cli(root, ['road-to-x', '--step']).status);
        expect(statuses.slice(0, PROCESS_LOOP_STALL_WINDOW)).toEqual(Array.from({ length: PROCESS_LOOP_STALL_WINDOW }, () => 0));
        const last = cli(root, ['road-to-x', '--step']);
        expect(last.status).toBe(3);
        expect(last.out).toContain('stagnated');
    }, 60_000);
});
