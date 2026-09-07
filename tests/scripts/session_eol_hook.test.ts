/**
 * session-eol hook — record-only instrument + once-per-session recycle
 * advisory (road-to-token-economy-recycling 1.1 / 3.2 / 4.2).
 *
 * Properties pinned:
 *   - recording is incremental and silent (exit 0, no stdout) below threshold;
 *   - the advisory fires ONCE past threshold on a long session, never on a
 *     short one, and never a second time (F2);
 *   - absent threshold config = recording continues, advisory lane disabled;
 *   - an unreadable transcript is silence, never a block (fail-open);
 *   - the Phase 4.2 read surface carries counts only.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    buildAdvisoryLine,
    buildMissingEnvelopeLine,
    main,
    readState,
    readThresholdTokens,
    stateFile,
    CONTEXT_FILL_REL,
    THRESHOLD_OVERRIDE_ENV,
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
 * `written_at` matters: the counter-check compares it against the advisory
 * stamp, so a fixture written with a past date is how a stale envelope from an
 * uncleared session is expressed. Default is now — this session's.
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

describe('recycle advisory (Phase 3.2)', () => {
    it('fires once past threshold on a long session — and never twice', () => {
        writeThreshold(100_000);
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        const first = runMain();
        expect(first.rc).toBe(2);
        const parsed = JSON.parse(first.out) as Record<string, string>;
        expect(parsed['decision']).toBe('warn');
        expect(parsed['additional_context']).toContain('session:recycle');

        // The operator acts on the advisory. Written AFTER it fired, which is
        // both the real sequence and what the freshness check requires — an
        // envelope predating the advisory belongs to an earlier session.
        writeEnvelope();
        fs.appendFileSync(transcript, assistantLine(6_000, 130_000));
        const second = runMain();
        expect(second.rc).toBe(0);
        expect(second.out).toBe('');
    });

    // Sensitivity arm for the Phase-2.1 keying. Without it the previous test
    // would pass against a checker that still read the shared legacy path: the
    // fixture is absent there too. This one writes a record belonging to a
    // DIFFERENT session and asserts the warning still fires — a peer's record
    // is not proof that this session wrote one.
    it('a peer session record does not silence the counter-check', () => {
        writeThreshold(100_000);
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        expect(runMain().rc).toBe(2);

        writeEnvelope(new Date().toISOString(), 'some-other-session');
        fs.appendFileSync(transcript, assistantLine(6_000, 130_000));
        const second = runMain();
        expect(second.rc).toBe(2);
        expect(JSON.parse(second.out)['reason']).toContain('no envelope written');
    });

    it('names the absolute path as the proof to wait for, not a bare /clear', () => {
        writeThreshold(100_000);
        writeEnvelope();
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        const parsed = JSON.parse(runMain().out) as Record<string, string>;
        const line = parsed['additional_context'] as string;
        expect(line).toContain('absolute path');
        // The instruction that destroys the session must carry its condition.
        expect(line).toContain('/clear only after');
    });

    it('never fires on a short session', () => {
        writeThreshold(100_000);
        fs.writeFileSync(transcript, assistantLine(1_000, 2_000));
        const r = runMain();
        expect(r.rc).toBe(0);
        expect(r.out).toBe('');
    });
});

describe('missing-envelope counter-check', () => {
    it('warns once on the Stop after the advisory when no envelope was written', () => {
        writeThreshold(100_000);
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        expect(runMain().rc).toBe(2); // the advisory itself

        fs.appendFileSync(transcript, assistantLine(6_000, 130_000));
        const second = runMain();
        expect(second.rc).toBe(2);
        const parsed = JSON.parse(second.out) as Record<string, string>;
        expect(parsed['reason']).toContain('no envelope written');
        expect(parsed['additional_context']).toContain(path.join(workspace, recycle_envelope_rel('session-a')));
        expect(parsed['additional_context']).toContain('/clear now starts the successor from nothing');

        // …and never again: one reminder is a net, one per Stop is a nag.
        fs.appendFileSync(transcript, assistantLine(7_000, 140_000));
        const third = runMain();
        expect(third.rc).toBe(0);
        expect(third.out).toBe('');
    });

    it('stays silent when the envelope arrived between the two stops', () => {
        writeThreshold(100_000);
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        expect(runMain().rc).toBe(2);

        writeEnvelope(); // the operator ran the command
        fs.appendFileSync(transcript, assistantLine(6_000, 130_000));
        const second = runMain();
        expect(second.rc).toBe(0);
        expect(second.out).toBe('');
    });

    it('never fires when the advisory never fired', () => {
        writeThreshold(100_000);
        // Below threshold: no advisory, so a missing envelope means nothing —
        // most sessions never recycle at all.
        fs.writeFileSync(transcript, assistantLine(1_000, 2_000));
        expect(runMain()).toEqual({ rc: 0, out: '' });
        fs.appendFileSync(transcript, assistantLine(1_000, 3_000));
        expect(runMain()).toEqual({ rc: 0, out: '' });
    });

    it('the 0-override silences BOTH warn paths, not just the advisory', () => {
        // The advisory fires under a live threshold…
        writeThreshold(100_000);
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        expect(runMain().rc).toBe(2);

        // …then the emergency switch goes in. The counter-check would
        // otherwise fire next Stop: the stamp is set and no envelope exists.
        writeThreshold(0);
        fs.appendFileSync(transcript, assistantLine(6_000, 130_000));
        const after = runMain();
        expect(after.rc).toBe(0);
        expect(after.out).toBe('');
    });

    it('ignores a stale envelope from a session that never cleared', () => {
        writeThreshold(100_000);
        // Written BEFORE the advisory fires — the consumer moves an envelope
        // aside at session_start, so one still sitting here is another
        // session's, and /clear would resume from its state.
        writeEnvelope('2020-01-01T00:00:00.000Z');
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        expect(runMain().rc).toBe(2); // the advisory

        fs.appendFileSync(transcript, assistantLine(6_000, 130_000));
        const second = runMain();
        expect(second.rc).toBe(2);
        expect(JSON.parse(second.out)['reason']).toContain('no envelope written');
    });

    it('keeps the counter-check line to one line under the injection budget', () => {
        // Same budget as its sibling, and this line embeds an unbounded
        // absolute path — deep worktree roots are where it would blow.
        const line = buildMissingEnvelopeLine('/'.padEnd(200, 'x'));
        expect(line).not.toContain('\n');
        expect(Buffer.byteLength(line, 'utf-8')).toBeLessThan(512);
    });
});

describe('advisory lane configuration (Phase 3.2)', () => {
    it('advisory lane is disabled by the 0-override while recording continues (emergency off)', () => {
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

    it('keeps the advisory to one line under the injection budget', () => {
        const line = buildAdvisoryLine(812_345, 800_000);
        expect(line).not.toContain('\n');
        expect(Buffer.byteLength(line, 'utf-8')).toBeLessThan(512);
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
// The advisory alone cannot help a session that has no context left to write a
// summary with. The checkpoint is DERIVED from the roadmap on disk, so a dying
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

    it('writes a derived checkpoint when the advisory fires inside a contract', () => {
        writeThreshold(10);
        claimRoadmap('session-a', ['- [x] done', '- [ ] the next one', '- [~] parked']);
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        expect(runMain().rc).toBe(2);

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
        expect(runMain().rc).toBe(2); // the advisory still fires
        expect(readCheckpoint(workspace, eolSessionKey('session-a'))).toBeNull();
    });

    it('writes nothing below the threshold — the checkpoint rides the advisory', () => {
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
        expect(runMain().rc).toBe(2);
        expect(readCheckpoint(workspace, eolSessionKey('session-a'))).toBeNull();
    });

    it('the advisory still fires when the checkpoint cannot be built', () => {
        // Best-effort by construction: a checkpoint is a recovery aid, and a
        // recovery aid that can suppress the advisory is a liability.
        writeThreshold(10);
        const claim = path.join(workspace, roadmap_claim_rel('session-a'));
        fs.mkdirSync(path.dirname(claim), { recursive: true });
        fs.writeFileSync(claim, JSON.stringify({ slug: 'gone', session_id: 'session-a' }), 'utf-8');
        fs.writeFileSync(transcript, assistantLine(5_000, 120_000));
        const r = runMain();
        expect(r.rc).toBe(2);
        expect(r.out).toContain('warn');
    });
});
