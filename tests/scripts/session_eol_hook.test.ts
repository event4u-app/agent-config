/**
 * session-eol hook — record-only instrument, no advisory
 * (road-to-token-economy-recycling 1.1 / 3.2 / 4.2, and the retirement of the
 * advisory in road-to-continuity-writer-activation step 3.2).
 *
 * Properties pinned:
 *   - recording is incremental and silent (exit 0, no stdout) below threshold;
 *   - AND silent past it: the recycle advisory and its missing-envelope
 *     counter-check are retired, so this hook has no warn path left. The
 *     fixtures that used to assert each line now assert its absence, on the
 *     exact inputs that produced it;
 *   - the threshold-crossing stamp still lands on the first Stop past the
 *     threshold, because the run-checkpoint writer gates on that edge;
 *   - absent threshold config = recording continues, threshold lane disabled;
 *   - an unreadable transcript is silence, never a block (fail-open);
 *   - the Phase 4.2 read surface carries counts only.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    main,
    readState,
    readThresholdTokens,
    stateFile,
    CONTEXT_FILL_REL,
    THRESHOLD_OVERRIDE_ENV,
    unconsumedRecordLines,
} from '../../src/scripts/hooks/session_eol_hook.js';
import { recycle_envelope_rel } from '../../src/scripts/_lib/recycle_envelope_paths.js';
import { readCheckpoint } from '../../src/scripts/_lib/run_checkpoint.js';
import { eolSessionKey } from '../../src/scripts/_lib/session_eol.js';
import { roadmap_claim_rel } from '../../src/scripts/session_register_hook.js';
import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin.js';

let workspace: string;
let home: string;
let transcript: string;
let priorHome: string | undefined;

function assistantLine(input: number, cacheRead: number): string {
    return (
        JSON.stringify({
            type: 'assistant',
            isSidechain: false,
            timestamp: '2026-08-10T10:00:00.000Z',
            message: {
                role: 'assistant',
                usage: {
                    input_tokens: input,
                    cache_read_input_tokens: cacheRead,
                    cache_creation_input_tokens: 0,
                    output_tokens: 10,
                },
            },
        }) + '\n'
    );
}

const USER_LINE = JSON.stringify({ type: 'user', message: { role: 'user', content: 'go' } }) + '\n';

function envelopeJson(sessionId: string): string {
    return JSON.stringify({
        schema_version: 1,
        platform: 'claude',
        event: 'stop',
        native_event: 'Stop',
        workspace_root: workspace,
        session_id: sessionId,
        payload: { transcript_path: transcript },
        settings: {},
    });
}

function writeThreshold(tokens: number): void {
    process.env[THRESHOLD_OVERRIDE_ENV] = String(tokens);
}

/**
 * Put a pending recycle envelope in the workspace.
 *
 * Kept after the counter-check's retirement because the retirement fixtures
 * need its inputs: the stale-envelope case is the one that used to produce a
 * warn line, so asserting silence on it is what proves the line is gone rather
 * than merely unreached. Default `written_at` is now — this session's.
 */
function writeEnvelope(
    writtenAt: string = new Date().toISOString(),
    sessionId: string | null = 'session-a',
): void {
    // Phase 2.1: the record is keyed by session, so the fixture writes where
    // the session under test would write. The default matches `runMain`'s
    // default id — a fixture at the shared legacy path would be a peer
    // session's record, which is exactly what the counter-check must not count.
    const target = path.join(workspace, recycle_envelope_rel(sessionId));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify({ written_at: writtenAt }));
}

/** The state file this suite's session writes: keyed by the hashed session id. */
function stateOf(sessionId = 'session-a'): ReturnType<typeof readState> {
    return readState(stateFile(workspace, eolSessionKey(sessionId)));
}

function runMain(sessionId = 'session-a'): { rc: number; out: string } {
    setHookStdinOverride(envelopeJson(sessionId));
    let out = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        out += String(chunk);
        return true;
    });
    try {
        const rc = main() ?? 0;
        return { rc, out };
    } finally {
        spy.mockRestore();
        clearHookStdinOverride();
    }
}

beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'session-eol-ws-'));
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'session-eol-home-'));
    // isSafeTranscriptPath requires the transcript to resolve under
    // os.homedir(), which reads $HOME on POSIX — fake it for the fixture
    // (same approach as end_review_nudge_hook.test.ts, in-process).
    priorHome = process.env['HOME'];
    process.env['HOME'] = home;
    transcript = path.join(home, 'projects', 'p', 't.jsonl');
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
});

afterEach(() => {
    if (priorHome === undefined) delete process.env['HOME'];
    else process.env['HOME'] = priorHome;
    delete process.env[THRESHOLD_OVERRIDE_ENV];
    vi.restoreAllMocks();
});

describe('recording (Phase 1.1)', () => {
    it('accumulates counters incrementally across stops, silently', () => {
        fs.writeFileSync(transcript, USER_LINE + assistantLine(1_000, 50_000));
        const first = runMain();
        expect(first.rc).toBe(0);
        expect(first.out).toBe('');

        fs.appendFileSync(transcript, USER_LINE + assistantLine(2_000, 80_000));
        const second = runMain();
        expect(second.rc).toBe(0);

        const stateKeys = fs.readdirSync(path.join(workspace, 'agents', 'runtime', 'state', 'session-eol'));
        const jsonKeys = stateKeys.filter((f) => f.endsWith('.json'));
        expect(jsonKeys).toHaveLength(1);
        const state = readState(
            stateFile(workspace, (jsonKeys[0] as string).replace(/\.json$/, '')),
        );
        expect(state.counters.turns).toBe(2);
        expect(state.counters.assistant_records).toBe(2);
        expect(state.counters.final_context_tokens).toBe(82_000);
        expect(state.advisory_fired_at).toBeNull();
    });

    it('writes the machine-readable fill surface (Phase 4.2), counts only', () => {
        fs.writeFileSync(transcript, assistantLine(500, 500));
        writeThreshold(100_000);
        runMain();
        const fill = JSON.parse(
            fs.readFileSync(path.join(workspace, CONTEXT_FILL_REL), 'utf-8'),
        ) as Record<string, unknown>;
        expect(fill['final_context_tokens']).toBe(1_000);
        expect(fill['recycle_threshold_tokens']).toBe(100_000);
        expect(fill['past_threshold']).toBe(false);
        expect(Object.keys(fill).sort()).toEqual([
            'final_context_tokens',
            'past_threshold',
            'recycle_threshold_tokens',
            'schema_version',
            'updated_at',
        ]);
    });

    it('is silent and harmless when the transcript is missing or unsafe', () => {
        const r = runMain(); // transcript file never written
        expect(r.rc).toBe(0);
        expect(r.out).toBe('');
    });
});

// ── step 3.2: the advisory and its counter-check are RETIRED ──────────
//
// Both emitters told a human to run `agent-config session:recycle` before
// `/clear`. `writeContinuityRecord` now writes the record itself, armed by
// default (AI council 2026-09-10, 2 seats, convergent, under the owner's
// written delegation), so the advice is an instruction to do by hand what the
// concern already did.
//
// These cases are the previous suite's fixtures with their assertions
// inverted, deliberately. A fresh "asserts nothing is emitted" test would pass
// against a hook that simply never reached the threshold; running the ORIGINAL
// inputs — long session past threshold, second Stop with no envelope, stale
// envelope from an uncleared session, peer session's record — is what makes the
// silence evidence.

describe('retired recycle advisory (step 3.2)', () => {
    it('is silent past the threshold on a long session, where it used to warn', () => {
        writeThreshold(100_000);
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        const first = runMain();
        expect(first.rc).toBe(0);
        expect(first.out).toBe('');
    });

    it('still stamps the threshold-crossing edge the checkpoint writer gates on', () => {
        writeThreshold(100_000);
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        runMain();
        // The field keeps its old name; what it marks is the crossing, not a
        // line anybody saw. Without this the retirement would have quietly
        // taken the run checkpoint with it.
        expect(stateOf().advisory_fired_at).not.toBeNull();
    });

    it('emits nothing naming the command on any Stop after the crossing', () => {
        writeThreshold(100_000);
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        expect(runMain().out).toBe('');
        // The Stop that used to carry the missing-envelope counter-check: the
        // stamp is set and no envelope exists, which was exactly its trigger.
        fs.appendFileSync(transcript, assistantLine(6_000, 130_000));
        const second = runMain();
        expect(second.rc).toBe(0);
        expect(second.out).toBe('');
        fs.appendFileSync(transcript, assistantLine(7_000, 140_000));
        expect(runMain()).toEqual({ rc: 0, out: '' });
    });

    it('never writes the counter-check stamp any more, on its own trigger', () => {
        writeThreshold(100_000);
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        runMain();
        fs.appendFileSync(transcript, assistantLine(6_000, 130_000));
        runMain();
        // `session_eol_report.ts` still READS this field for state written
        // before the retirement; nothing writes it now, and that is the
        // difference between preserving history and producing more of it.
        expect(stateOf().missing_envelope_warned_at ?? null).toBeNull();
    });

    it('a stale envelope from an uncleared session produces no line either', () => {
        writeThreshold(100_000);
        writeEnvelope('2020-01-01T00:00:00.000Z');
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        expect(runMain()).toEqual({ rc: 0, out: '' });
        fs.appendFileSync(transcript, assistantLine(6_000, 130_000));
        expect(runMain()).toEqual({ rc: 0, out: '' });
    });

    it("a peer session's record produces no line either", () => {
        writeThreshold(100_000);
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        expect(runMain()).toEqual({ rc: 0, out: '' });
        writeEnvelope(new Date().toISOString(), 'some-other-session');
        fs.appendFileSync(transcript, assistantLine(6_000, 130_000));
        expect(runMain()).toEqual({ rc: 0, out: '' });
    });

    it('never fires on a short session — unchanged', () => {
        writeThreshold(100_000);
        fs.writeFileSync(transcript, assistantLine(1_000, 2_000));
        expect(runMain()).toEqual({ rc: 0, out: '' });
    });
});

describe('threshold lane configuration (Phase 3.2)', () => {
    it('threshold lane is disabled by the 0-override while recording continues (emergency off)', () => {
        writeThreshold(0);
        fs.writeFileSync(transcript, assistantLine(5_000, 900_000));
        const r = runMain();
        expect(r.rc).toBe(0);
        expect(r.out).toBe('');
        expect(readThresholdTokens()).toBeNull();
        // recording continued
        expect(fs.existsSync(path.join(workspace, 'agents', 'runtime', 'state', 'session-eol'))).toBe(true);
    });

    it('without an override, the committed constant is the threshold (one source)', () => {
        expect(readThresholdTokens()).toBe(800_000);
    });

    it('the 0-override also stops the threshold-crossing stamp, so the checkpoint lane is off', () => {
        // The injection-budget tests that stood here are gone with the two
        // builders they measured. What replaces them is the property the
        // override still has to carry: switching the lane off must stop the
        // stamp too, or the run-checkpoint writer keeps firing after the
        // emergency switch.
        writeThreshold(0);
        fs.writeFileSync(transcript, assistantLine(5_000, 900_000));
        runMain();
        expect(stateOf().advisory_fired_at).toBeNull();
    });
});

describe('slot + replay guards', () => {
    it('ignores non-stop events', () => {
        setHookStdinOverride(
            JSON.stringify({
                schema_version: 1,
                platform: 'claude',
                event: 'session_start',
                payload: {},
            }),
        );
        expect(main() ?? 0).toBe(0);
        clearHookStdinOverride();
    });

    it('is a no-op under AGENT_CONFIG_REPLAY=1', () => {
        writeThreshold(10);
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        process.env['AGENT_CONFIG_REPLAY'] = '1';
        try {
            const r = runMain();
            expect(r.rc).toBe(0);
            expect(r.out).toBe('');
            expect(fs.existsSync(path.join(workspace, 'agents', 'runtime', 'state', 'session-eol'))).toBe(
                false,
            );
        } finally {
            delete process.env['AGENT_CONFIG_REPLAY'];
        }
    });
});

// ── UOTL Phase 6.1 — the deterministic checkpoint ───────────────────────────
//
// A human writing a summary cannot help a session that has no context left to
// write one with. The checkpoint is DERIVED from the roadmap on disk, so a dying
// session produces it correctly regardless, and a resumed run can re-verify
// every field rather than trusting a record (Phase 3.2).
//
// The gate is "inside a running contract" — the same `sessions:claim` carrier
// `run-continuation` uses, and no second one invented. Outside a contract this
// stays silent: a checkpoint for a conversational session names work nobody is
// executing.

describe('deterministic checkpoint (UOTL Phase 6.1)', () => {
    const SLUG = 'road-to-eol-fixture';

    function claimRoadmap(sessionId: string, lines: string[]): void {
        const roadmaps = path.join(workspace, 'agents', 'roadmaps');
        fs.mkdirSync(roadmaps, { recursive: true });
        fs.writeFileSync(path.join(roadmaps, `${SLUG}.md`), `${lines.join('\n')}\n`, 'utf-8');
        const claim = path.join(workspace, roadmap_claim_rel(sessionId));
        fs.mkdirSync(path.dirname(claim), { recursive: true });
        fs.writeFileSync(claim, JSON.stringify({ slug: SLUG, session_id: sessionId }), 'utf-8');
    }

    it('writes a derived checkpoint on the threshold crossing inside a contract', () => {
        writeThreshold(10);
        claimRoadmap('session-a', ['- [x] done', '- [ ] the next one', '- [~] parked']);
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        expect(runMain().rc).toBe(0);

        const cp = readCheckpoint(workspace, eolSessionKey('session-a'));
        expect(cp).not.toBeNull();
        expect(cp).toMatchObject({
            roadmap: SLUG,
            open_steps: 1,
            done_steps: 1,
            parked_steps: 1,
            next_step: 'the next one',
        });
    });

    it('writes NOTHING without a claim — a checkpoint outside a contract names nobody work', () => {
        writeThreshold(10);
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        expect(runMain().rc).toBe(0);
        expect(readCheckpoint(workspace, eolSessionKey('session-a'))).toBeNull();
    });

    it('writes nothing below the threshold — the checkpoint rides the crossing', () => {
        writeThreshold(1_000_000);
        claimRoadmap('session-a', ['- [ ] open']);
        fs.writeFileSync(transcript, assistantLine(5_000, 1_000));
        expect(runMain().rc).toBe(0);
        expect(readCheckpoint(workspace, eolSessionKey('session-a'))).toBeNull();
    });

    it('a claim naming an unreadable roadmap writes nothing rather than a guessed checkpoint', () => {
        writeThreshold(10);
        const claim = path.join(workspace, roadmap_claim_rel('session-a'));
        fs.mkdirSync(path.dirname(claim), { recursive: true });
        fs.writeFileSync(claim, JSON.stringify({ slug: 'gone', session_id: 'session-a' }), 'utf-8');
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        expect(runMain().rc).toBe(0);
        expect(readCheckpoint(workspace, eolSessionKey('session-a'))).toBeNull();
    });

    it('a failed checkpoint does not take the rest of the Stop path with it', () => {
        // Best-effort by construction: a checkpoint is a recovery aid, and a
        // recovery aid that can fail a Stop is a liability. Before step 3.2
        // this case asserted the advisory still fired; with no warn path left,
        // the observable is that the Stop still completes and still records.
        writeThreshold(10);
        const claim = path.join(workspace, roadmap_claim_rel('session-a'));
        fs.mkdirSync(path.dirname(claim), { recursive: true });
        fs.writeFileSync(claim, JSON.stringify({ slug: 'gone', session_id: 'session-a' }), 'utf-8');
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        const r = runMain();
        expect(r).toEqual({ rc: 0, out: '' });
        expect(stateOf().advisory_fired_at).not.toBeNull();
    });
});

/**
 * The detection layer this defect did not have.
 *
 * Twelve unconsumed envelopes accumulated across the estate over roughly a
 * month; the producer reported success, the consumer reported `absent`, and
 * nothing compared the two. The silent case is tested first and deliberately:
 * an advisory that fires on a healthy workspace trains the reader to skip it,
 * and then the one time it matters it is skipped too.
 */
describe('unconsumedRecordLines', () => {
    function ws(): string {
        const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'eol-unconsumed-')));
        fs.mkdirSync(path.join(root, 'agents', 'runtime', 'state'), { recursive: true });
        return root;
    }

    function record(root: string, sessionId: string, ageHours: number, nextTask?: string): string {
        const target = path.join(root, recycle_envelope_rel(sessionId));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(
            target,
            JSON.stringify({
                written_at: new Date(Date.now() - ageHours * 3_600_000).toISOString(),
                ...(nextTask === undefined ? {} : { next_task: nextTask }),
            }),
        );
        return target;
    }

    it('says NOTHING about a workspace with no records', () => {
        expect(unconsumedRecordLines(ws())).toEqual([]);
    });

    it('says NOTHING about a fresh record — that is a pending resume, not a defect', () => {
        const root = ws();
        record(root, 'sess-fresh', 2);
        expect(unconsumedRecordLines(root)).toEqual([]);
    });

    it('reports an old record by path, age and next_task', () => {
        const root = ws();
        record(root, 'sess-old', 100, 'finish the ratchet claim');
        const lines = unconsumedRecordLines(root);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('recycle-envelope-sess-old.json');
        expect(lines[0]).toContain('100h');
        expect(lines[0]).toContain('finish the ratchet claim');
    });

    it('reports a record with no next_task without inventing one', () => {
        const root = ws();
        record(root, 'sess-bare', 100);
        expect(unconsumedRecordLines(root)[0]).toContain('(no next_task)');
    });

    it('ignores an unparseable or undated record rather than guessing its age', () => {
        const root = ws();
        const target = path.join(root, recycle_envelope_rel('sess-broken'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, 'not json at all');
        fs.writeFileSync(path.join(root, recycle_envelope_rel('sess-undated')), JSON.stringify({ task: 'x' }));
        expect(unconsumedRecordLines(root)).toEqual([]);
    });

    it('reports each old record separately', () => {
        const root = ws();
        record(root, 'sess-a', 100, 'a');
        record(root, 'sess-b', 200, 'b');
        record(root, 'sess-fresh', 1, 'fresh');
        expect(unconsumedRecordLines(root)).toHaveLength(2);
    });
});
