/**
 * run_continuation — road-to-long-horizon-execution Phase 1.2 (partial: the
 * pure surface; the end-to-end eval with a live dispatcher is 1.2's open half).
 *
 * What these tests pin, and why each boundary matters:
 *   · the CONTRACT GATE's mode read — a roadmap without `execution.mode:
 *     autonomous` must never engage, because the checkpointed and interactive
 *     modes bought their conversations on purpose;
 *   · the OPEN-STEP scan's vocabulary — `[~]`/`[-]` are not open work, and a
 *     `blocked-by:` step is open work this run cannot do: engaging into it is
 *     a stall manufactured by the anti-stall mechanism;
 *   · the LADDER's rungs in both directions — an unbounded loop is the
 *     failure the ladder exists against, and a ladder that halts a healthy
 *     run silently deletes the feature.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    DUPLICATE_WINDOW_MS,
    MAX_ITERATIONS,
    STALL_WINDOW,
    WALL_CLOCK_CAP_MS,
    isDuplicateFire,
    ladder,
    parseExecutionMode,
    refusedThisTurn,
    scanOpenSteps,
    stateRelPath,
    type RunState,
} from '../../../src/scripts/hooks/run_continuation_hook.js';
import {
    deriveSessionKey,
    sessionRefusalFile,
} from '../../../src/scripts/_lib/turn_end_refusals.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'run-continuation-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

const fm = (mode: string | null): string =>
    mode === null
        ? '# No frontmatter\n'
        : `---\ncomplexity: structural\nexecution:\n  mode: ${mode}\n---\n\n# T\n`;

describe('parseExecutionMode', () => {
    it('reads the two-level execution.mode', () => {
        expect(parseExecutionMode(fm('autonomous'))).toBe('autonomous');
        expect(parseExecutionMode(fm('phase-checkpoints'))).toBe('phase-checkpoints');
    });

    it('no frontmatter / no execution block → null', () => {
        expect(parseExecutionMode(fm(null))).toBeNull();
        expect(parseExecutionMode('---\ncomplexity: routine\n---\n')).toBeNull();
    });

    it('a mode: line outside the execution block does not count', () => {
        // `mode:` under some OTHER key must not read as the execution mode —
        // the gate would otherwise engage on roadmaps that never opted in.
        const text = '---\nother:\n  mode: autonomous\n---\n';
        // Line-oriented reader: an execution: block is required at all.
        expect(parseExecutionMode(text)).toBeNull();
    });
});

describe('scanOpenSteps', () => {
    it('counts only [ ]; [x]/[~]/[-] are not open', () => {
        const text = [
            '- [x] done',
            '- [ ] first open <!-- verify: ./scripts-run src/scripts/a -->',
            '- [~] deferred',
            '- [-] cancelled',
            '- [ ] second open',
        ].join('\n');
        const r = scanOpenSteps(text);
        expect(r.open).toBe(2);
        expect(r.next!.text).toBe('first open');
        expect(r.next!.verify).toBe('./scripts-run src/scripts/a');
    });

    it('a blocked-by step neither counts nor becomes the pick', () => {
        const text = [
            '- [ ] gated thing <!-- blocked-by: kernel-soak-window -->',
            '- [ ] doable thing',
        ].join('\n');
        const r = scanOpenSteps(text);
        expect(r.open).toBe(1);
        expect(r.blocked).toBe(1);
        expect(r.next!.text).toBe('doable thing');
        expect(r.next!.verify).toBeNull();
    });

    it('all steps blocked → open 0 (complete beats a manufactured stall)', () => {
        const r = scanOpenSteps('- [ ] a <!-- blocked-by: x -->');
        expect(r.open).toBe(0);
        expect(r.next).toBeNull();
    });

    it('indented (nested) open boxes count', () => {
        expect(scanOpenSteps('  - [ ] nested').open).toBe(1);
    });

    it('long step text truncates for the message', () => {
        const r = scanOpenSteps(`- [ ] ${'x'.repeat(400)}`);
        expect(r.next!.text.length).toBeLessThanOrEqual(240);
        expect(r.next!.text.endsWith('...')).toBe(true);
    });
});

describe('ladder — both directions pinned', () => {
    const base = (over: Partial<RunState> = {}): RunState => ({
        started_at: new Date().toISOString(),
        iterations: 0,
        last_turn: -1,
        history: [],
        ...over,
    });

    it('healthy run with open work → engage', () => {
        expect(ladder(base(), 5, Date.now())).toBe('engage');
    });

    it('zero open steps → complete, regardless of every other rung', () => {
        expect(ladder(base({ iterations: MAX_ITERATIONS + 5 }), 0, Date.now())).toBe('complete');
    });

    it('iteration cap halts', () => {
        expect(ladder(base({ iterations: MAX_ITERATIONS }), 3, Date.now())).toBe(
            'halt-max-iterations',
        );
    });

    it('wall clock halts', () => {
        const old = new Date(Date.now() - WALL_CLOCK_CAP_MS - 1000).toISOString();
        expect(ladder(base({ started_at: old, iterations: 1 }), 3, Date.now())).toBe(
            'halt-wall-clock',
        );
    });

    it('an unparseable started_at never halts the clock rung (fail-open)', () => {
        expect(ladder(base({ started_at: 'not-a-date', iterations: 1 }), 3, Date.now())).toBe(
            'engage',
        );
    });

    it(`stall: ${STALL_WINDOW} engagements without a delta halt; a moving count does not`, () => {
        const stalled = base({ iterations: 4, history: [3, 3, 3] });
        expect(ladder(stalled, 3, Date.now())).toBe('halt-stall');
        // Progress since the last engagement (open moved 3 → 2): keep going.
        expect(ladder(stalled, 2, Date.now())).toBe('engage');
        // Fewer than STALL_WINDOW readings can never read as a stall.
        expect(ladder(base({ iterations: 2, history: [3, 3] }), 3, Date.now())).toBe('engage');
    });
});

describe('refusedThisTurn — the quality-gate defer', () => {
    const write = (sessionId: string, turn: number): void => {
        const file = sessionRefusalFile(tmp, deriveSessionKey(sessionId));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(
            file,
            JSON.stringify({
                refused_at: new Date().toISOString(),
                refused_turn: turn,
                detector: 'promissory',
            }),
            'utf8',
        );
    };

    it('marker for this turn → defer; another turn → no defer; no marker → no defer', () => {
        write('sess-1', 7);
        expect(refusedThisTurn(tmp, 'sess-1', 7)).toBe(true);
        expect(refusedThisTurn(tmp, 'sess-1', 8)).toBe(false);
        expect(refusedThisTurn(tmp, 'sess-2', 7)).toBe(false);
    });
});

describe('stateRelPath', () => {
    it('sanitises the run id into a state filename', () => {
        expect(stateRelPath('abc/../etc')).toBe(
            path.join('agents', 'runtime', 'state', 'run-continuation-abc____etc.json'),
        );
    });
});

describe('isDuplicateFire — a re-fire repeats the block, real progress engages', () => {
    const now = Date.now();
    const engaged = (over: Partial<RunState> = {}): RunState => ({
        started_at: new Date(now - 1000).toISOString(),
        iterations: 1,
        last_turn: 3,
        history: [2],
        last_engaged_at: new Date(now - 500).toISOString(),
        ...over,
    });

    it('same ordinal + same open count inside the window → duplicate', () => {
        expect(isDuplicateFire(engaged(), 3, 2, now)).toBe(true);
    });

    it('the open count moving is real progress, same ordinal or not', () => {
        // The ordinal is NOT a turn identity for a re-engaged reply — work in
        // the same user turn keeps it constant while the checkboxes move.
        expect(isDuplicateFire(engaged(), 3, 1, now)).toBe(false);
    });

    it('a different ordinal is a new reply', () => {
        expect(isDuplicateFire(engaged(), 4, 2, now)).toBe(false);
    });

    it('outside the window it is not a re-fire', () => {
        expect(
            isDuplicateFire(
                engaged({ last_engaged_at: new Date(now - DUPLICATE_WINDOW_MS - 1).toISOString() }),
                3,
                2,
                now,
            ),
        ).toBe(false);
    });

    it('no prior state / legacy state without the stamp → never a duplicate', () => {
        expect(isDuplicateFire(null, 3, 2, now)).toBe(false);
        const legacy = engaged();
        delete legacy.last_engaged_at;
        expect(isDuplicateFire(legacy, 3, 2, now)).toBe(false);
    });
});
