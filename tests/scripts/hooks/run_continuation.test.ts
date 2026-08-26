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
    TRANSCRIPT_READ_MAX_BYTES as GATE_TRANSCRIPT_MAX_BYTES,
    readTranscriptTail,
} from '../../../src/scripts/hooks/turn_end_gate_hook.js';

import {
    DUPLICATE_WINDOW_MS,
    HALT_ACTIONS,
    TRANSCRIPT_READ_MAX_BYTES as CONTINUATION_TRANSCRIPT_MAX_BYTES,
    MAX_ITERATIONS,
    STALL_WINDOW,
    WALL_CLOCK_CAP_MS,
    isDuplicateFire,
    ladder,
    parseExecutionMode,
    refusedThisTurn,
    extractVerify,
    scanOpenSteps,
    stateRelPath,
    type RunState,
} from '../../../src/scripts/hooks/run_continuation_hook.js';
import {
    deriveSessionKey,
    sessionRefusalFile,
} from '../../../src/scripts/_lib/turn_end_refusals.js';
import { readUnavailableDependency } from '../../../src/scripts/_lib/loop_guards.js';

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
        expect(ladder(base(), 5, Date.now(), 0)).toBe('engage');
    });

    it('zero open steps → complete, regardless of every other rung', () => {
        expect(ladder(base({ iterations: MAX_ITERATIONS + 5 }), 0, Date.now(), 0)).toBe('complete');
    });

    // Round 8 finding 3. The two rows differ in ONE input — the blocked count —
    // so a regression that re-collapses them cannot pass by accident.
    it('zero open with blocked steps remaining → blocked, never complete', () => {
        expect(ladder(base(), 0, Date.now(), 1)).toBe('blocked');
        expect(ladder(base(), 0, Date.now(), 0)).toBe('complete');
    });

    it('blocked is terminal but is NOT a halt — it stays out of HALT_ACTIONS', () => {
        expect(HALT_ACTIONS).not.toContain('blocked');
    });

    it('a stamped halt still outranks blocked', () => {
        expect(ladder(base({ halted: 'halt-stall' }), 0, Date.now(), 2)).toBe('halt-stall');
    });

    it('blocked does not pre-empt a run with runnable work left', () => {
        expect(ladder(base(), 3, Date.now(), 4)).toBe('engage');
    });

    it('iteration cap halts', () => {
        expect(ladder(base({ iterations: MAX_ITERATIONS }), 3, Date.now(), 0)).toBe(
            'halt-max-iterations',
        );
    });

    it('wall clock halts', () => {
        const old = new Date(Date.now() - WALL_CLOCK_CAP_MS - 1000).toISOString();
        expect(ladder(base({ started_at: old, iterations: 1 }), 3, Date.now(), 0)).toBe(
            'halt-wall-clock',
        );
    });

    it('an unparseable started_at never halts the clock rung (fail-open)', () => {
        expect(ladder(base({ started_at: 'not-a-date', iterations: 1 }), 3, Date.now(), 0)).toBe(
            'engage',
        );
    });

    it(`stall: ${STALL_WINDOW} engagements without a delta halt; a moving count does not`, () => {
        const stalled = base({ iterations: 4, history: [3, 3, 3] });
        expect(ladder(stalled, 3, Date.now(), 0)).toBe('halt-stall');
        // Progress since the last engagement (open moved 3 → 2): keep going.
        expect(ladder(stalled, 2, Date.now(), 0)).toBe('engage');
        // Fewer than STALL_WINDOW readings can never read as a stall.
        expect(ladder(base({ iterations: 2, history: [3, 3] }), 3, Date.now(), 0)).toBe('engage');
    });
});

describe('ladder — a halt is terminal, and outranks every other rung', () => {
    const base = (over: Partial<RunState> = {}): RunState => ({
        started_at: new Date().toISOString(),
        iterations: 0,
        last_turn: -1,
        history: [],
        ...over,
    });

    // The R2 review's finding 4. Every non-engage rung used to DELETE the
    // state file, so the next Stop — and a host may fire `stop` several times
    // for one reply — read `prev === null`, built `iterations: 0` with a fresh
    // `started_at`, and engaged again. The cap bounded a 25-block, not a run.
    for (const rung of HALT_ACTIONS) {
        it(`${rung} stays ${rung} on a later stop with a healthy-looking state`, () => {
            // Everything else about this state says "engage": no iterations
            // spent, started now, no stall history. Only the stamp halts it.
            expect(ladder(base({ halted: rung }), 5, Date.now(), 0)).toBe(rung);
        });
    }

    it('a halted run does not report `complete` when the roadmap later reads zero-open', () => {
        // Checked before the openCount rung on purpose: a run that was halted
        // for exhausting its budget never reached a completion, and recording
        // one would tell the digest the opposite of what happened.
        expect(ladder(base({ halted: 'halt-stall' }), 0, Date.now(), 0)).toBe('halt-stall');
    });

    it('an un-halted state is unaffected — the stamp is the only new input', () => {
        expect(ladder(base(), 5, Date.now(), 0)).toBe('engage');
        expect(ladder(base(), 0, Date.now(), 0)).toBe('complete');
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
    it('sanitises the run id AND the slug into a state filename', () => {
        // Round 7 findings 2 and 3: the path is keyed on (session, roadmap), because
        // one session-keyed file cannot hold two roadmaps budgets — the absent
        // branch reported one roadmap iteration count under another slug, and a
        // slug mismatch on the main path let the next write overwrite the other
        // roadmap halt stamp.
        expect(stateRelPath('abc/../etc', 'road-to-x')).toBe(
            path.join('agents', 'runtime', 'state', 'run-continuation-abc____etc-road-to-x.json'),
        );
        expect(stateRelPath('s', 'a/../b')).toBe(
            path.join('agents', 'runtime', 'state', 'run-continuation-s-a____b.json'),
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

describe('scanOpenSteps — phase spans only, dashboard bullets', () => {
    // R2 review, finding 15. On the roadmap this review was run against every
    // phase step is closed and the only `- [ ]` sits under `## Acceptance criteria`, so
    // the continuation would have named "A killed session resumes via the
    // watcher…" as the next step — an observation of a live multi-day run, and
    // by construction with no `verify:` line. That is a guaranteed stall of
    // the kind the `blocked-by:` exclusion was added to avoid.
    it('does not re-engage on an acceptance criterion or a blocker row', () => {
        const md = [
            '## Phase 4 — unattended backlog',
            '',
            '- [x] **4.1** the digest',
            '',
            '## Acceptance criteria',
            '',
            '- [ ] A killed session resumes via the watcher and completes',
            '',
            '## Blockers',
            '',
            '- [ ] someone decides whether to fund the benchmark',
        ].join('\n');
        const scan = scanOpenSteps(md);
        expect(scan.open).toBe(0);
        expect(scan.next).toBeNull();
    });

    it('a `*` bullet inside a phase is a real open step', () => {
        // The narrower bullet set read this as zero open work, and
        // `run_supervise.classify` then reports `complete`.
        const scan = scanOpenSteps('## Phase 1\n\n* [ ] **1.0** do the thing\n');
        expect(scan.open).toBe(1);
        expect(scan.next?.text).toContain('do the thing');
    });

    it('an unphased roadmap still yields its steps', () => {
        expect(scanOpenSteps('- [ ] **0.1** a step\n').open).toBe(1);
    });
});

/** This worktree's root — four levels up from tests/scripts/hooks/. */
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const homeDirs: string[] = [];
afterEach(() => {
    while (homeDirs.length > 0) {
        const d = homeDirs.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

describe('the transcript cap agrees with the quality gate', () => {
    // R2 round 2, finding 1 — the critical one. This concern carried its own
    // 2 MB cap while `turn_end_gate_hook` uses 8 MB, and `readTranscriptTail`
    // returns `turnOrdinal: 0` over its cap WITHOUT throwing. On any 2-8 MB
    // transcript the gate wrote `refused_turn: N`, this concern computed 0,
    // the defer compared `N === 0` and was skipped — so the concern BLOCKED a
    // stop the quality gate had just refused. Risk 1 of the register inverted,
    // silently, in the long-run regime the roadmap targets.
    it('reads the SAME constant the gate does, not a matching literal', () => {
        // The identity is the assertion. Two literals that happen to agree
        // re-introduce the defect the next time one side is tuned.
        expect(CONTINUATION_TRANSCRIPT_MAX_BYTES).toBe(GATE_TRANSCRIPT_MAX_BYTES);
    });

    it('a transcript in the old 2-8 MB dead zone yields the gate\'s real ordinal', () => {
        // Built just over the OLD 2 MB cap and well under the shared 8 MB one:
        // under the old constant this read 0, under the shared one it reads the
        // true count, which is what makes the defer comparison meaningful.
        // Under $HOME: `isSafeTranscriptPath` refuses anything else, and a
        // refusal also returns ordinal 0 — which would make this test pass for
        // the wrong reason.
        const home = fs.mkdtempSync(path.join(os.homedir(), '.agent-config-rc-test-'));
        homeDirs.push(home);
        const file = path.join(home, 'big.jsonl');
        const pad = 'y'.repeat(4096);
        const rows: string[] = [];
        for (let i = 0; i < 3; i++) {
            rows.push(JSON.stringify({ type: 'user', message: { role: 'user', content: 'hi' } }));
            rows.push(
                JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: pad } }),
            );
        }
        // Pad past 2 MB with assistant rows, which do not move the ordinal.
        while (rows.join('\n').length < 2.2 * 1024 * 1024) {
            rows.push(
                JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: pad } }),
            );
        }
        fs.writeFileSync(file, `${rows.join('\n')}\n`, 'utf8');
        expect(fs.statSync(file).size).toBeGreaterThan(2 * 1024 * 1024);
        expect(fs.statSync(file).size).toBeLessThan(8 * 1024 * 1024);

        const under2mb = readTranscriptTail(file, { maxBytes: 2 * 1024 * 1024 }).turnOrdinal;
        const shared = readTranscriptTail(file, {
            maxBytes: CONTINUATION_TRANSCRIPT_MAX_BYTES,
        }).turnOrdinal;
        expect(under2mb).toBe(0);
        expect(shared).toBe(3);
    });
});

describe('extractVerify — both forms the tree actually writes', () => {
    // R2 round 2, finding 10. Only the HTML-comment form was matched, and only
    // on the step's own line, while 18 roadmaps — including both this branch
    // ships — write the backticked form on a CONTINUATION line. So the
    // continuation named a next step and omitted the command that proves it,
    // which Risk 7 names as its mitigation.
    it('reads the backticked form from a continuation line', () => {
        const md = [
            '## Phase 1',
            '',
            '- [ ] **1.0** do the thing',
            '      `verify:` `./scripts-run src/scripts/lint_thing`',
        ].join('\n');
        expect(scanOpenSteps(md).next?.verify).toBe('./scripts-run src/scripts/lint_thing');
    });

    it('still reads the HTML-comment form, and it wins when both are present', () => {
        // A step carrying both has a human-facing line and a tooling-facing
        // one — not two commands.
        const md = [
            '## Phase 1',
            '- [ ] **1.0** do it <!-- verify: machine-readable -->',
            '      `verify:` `human-facing`',
        ].join('\n');
        expect(scanOpenSteps(md).next?.verify).toBe('machine-readable');
    });

    it('does not absorb the NEXT step\'s verify line', () => {
        const md = [
            '## Phase 1',
            '- [ ] **1.0** first',
            '- [ ] **1.1** second',
            '      `verify:` `belongs-to-1.1`',
        ].join('\n');
        const scan = scanOpenSteps(md);
        expect(scan.open).toBe(2);
        expect(scan.next?.text).toContain('first');
        expect(scan.next?.verify).toBeNull();
    });

    it('a step with no verify line reports null, not an empty string', () => {
        expect(scanOpenSteps('## Phase 1\n- [ ] **1.0** bare\n').next?.verify).toBeNull();
    });

    it('parses a verify line taken from the real roadmap tree, not a fixture of one', () => {
        // The end-to-end statement: the form the tree actually writes.
        //
        // It used to hardcode `road-to-long-horizon-execution.md` and read it for
        // the mere PRESENCE of a `verify:` string, which made an ordinary
        // archival break the test — and that is exactly what happened when that
        // roadmap was archived. Two defects in one: a path that any completed
        // roadmap invalidates, and an assertion that never ran the matcher over
        // the text it had just gone to the trouble of loading.
        //
        // Now it scans the roadmap tree for a real line and parses THAT:
        // strictly stronger than a substring check, since a malformed line in a
        // shipped roadmap fails here.
        //
        // THE SCAN IS RECURSIVE, AND THAT IS THE ARCHIVAL-IMMUNITY. The previous
        // version scanned `agents/roadmaps` FLAT and claimed immunity it did not
        // have: it had only moved the fragility from one named file to "any
        // active file", and archiving the last such file empties the corpus just
        // as renaming the old one did. Measured 2026-08-22 while archiving
        // `road-to-standing-context-40k`: its two done-note lines were the ONLY
        // command-bearing `verify:` declarations in the entire active tree, so an
        // ordinary, correct archival took the count to 0 and red this test — the
        // same defect one level up. Archival MOVES a file within this tree
        // (`archive/`, `later/`, `stubs/` all live under it), so recursing over
        // the tree is immune by construction rather than by luck: 78 lines across
        // archive/ and later/ at the time of the change, all 78 parseable.
        const dir = path.join(REPO_ROOT, 'agents', 'roadmaps');
        const mdFiles: string[] = [];
        const walk = (d: string): void => {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, e.name);
                if (e.isDirectory()) walk(full);
                else if (e.name.endsWith('.md')) mdFiles.push(full);
            }
        };
        walk(dir);
        const lines: string[] = [];
        for (const f of mdFiles) {
            for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
                // The COMMAND-BEARING declaration form, which is what
                // `extractVerify` exists to parse. Two exclusions, both
                // deliberate:
                //
                // - prose that merely mentions the token (a roadmap explaining
                //   why a step's `verify:` probe holds a full path is not
                //   itself a verify line);
                // - a declaration carrying prose instead of a backticked
                //   command. Those exist — 37 of them across 4 roadmaps at the
                //   time of writing, none touched by this change. They are a
                //   roadmap-lint concern, and pulling them in here would fail
                //   CI on a latent backlog this test did not create, which is
                //   the widen-a-gate-and-red-everything failure this repo has
                //   refused before.
                const t = line.trimStart();
                if (t.startsWith('`verify:`') && /^`verify:`\s*`/.test(t)) lines.push(line);
            }
        }
        expect(lines.length, 'no roadmap in the roadmap tree carries a `verify:` line').toBeGreaterThan(0);
        for (const line of lines) {
            expect(extractVerify(line), line.trim()).not.toBeNull();
        }
    });
});

describe('run_continuation — the dependency-halt WIRING, not only the rung', () => {
    /**
     * Regression, and the reason it is written against the reader rather than
     * against `ladder()`: the inline version of this read referenced a constant
     * that did not exist. The read sits inside a `catch` that fail-opens to
     * `null`, so the ReferenceError was swallowed on every fire and the rung was
     * dead while every pure-ladder assertion stayed green. A decision function
     * cannot observe a caller that never computes its input.
     */
    it('names a dependency the run cannot obtain, from the tail', () => {
        const t = path.join(tmp, 'transcript.txt');
        fs.writeFileSync(t, ['building', 'php: command not found', 'stopped'].join('\n'), 'utf8');
        const got = readUnavailableDependency(t);
        expect(got?.kind).toBe('binary');
        expect(got?.evidence).toContain('command not found');
    });

    it('feeds the rung, which then outranks the counter rungs', () => {
        const t = path.join(tmp, 'transcript.txt');
        fs.writeFileSync(t, 'gh: authentication failed\n', 'utf8');
        const unavailable = readUnavailableDependency(t);
        // Iterations already over the cap: without the dependency input this is
        // `halt-max-iterations`, an anonymous cap-out. The whole point of the
        // rung is that a nameable blocker wins.
        const over: RunState = {
            started_at: new Date().toISOString(),
            iterations: MAX_ITERATIONS + 5,
            last_turn: -1,
            history: [],
        };
        const caps = {
            maxIterations: MAX_ITERATIONS,
            wallClockMs: WALL_CLOCK_CAP_MS,
            stallWindow: STALL_WINDOW,
        };
        expect(ladder(over, 3, Date.now(), 0, caps, unavailable)).toBe('halt-dependency-unavailable');
        expect(ladder(over, 3, Date.now(), 0, caps, null)).toBe('halt-max-iterations');
    });

    it('fails OPEN on an unreadable transcript — a detector that cannot read must not halt', () => {
        expect(readUnavailableDependency(path.join(tmp, 'does-not-exist.txt'))).toBeNull();
    });

    it('reads only the tail, so a failure the run already recovered from cannot halt it', () => {
        const t = path.join(tmp, 'transcript.txt');
        const stale = 'gh: authentication failed';
        const recovered = Array.from({ length: 400 }, (_, i) => `step ${i} ok`);
        fs.writeFileSync(t, [stale, ...recovered].join('\n'), 'utf8');
        expect(readUnavailableDependency(t)).toBeNull();
    });
});
