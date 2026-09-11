/**
 * Detector E — `pending-decision`: a question asked inside a turn and dropped
 * before that turn ended.
 *
 * THE FIXTURE IS THE MEASURED FAILURE, not an invented shape. One user turn,
 * two assistant entries: the first carries three numbered options and a
 * recommendation line, the second handles a stop-hook nudge and demotes the open
 * question to a subordinate clause. No user message sits between them.
 *
 * The near-miss is the half that decides whether the detector is usable, so it
 * is tested in three directions rather than one:
 *
 *   1. a GENUINE user prompt between the two assistant entries — answered, silent;
 *   2. a SYNTHETIC user-role entry between them (a task notification, a
 *      `<system-reminder>`) — not an answer, still refuses;
 *   3. a TOOL-ONLY assistant entry between them — the ordinary shape of every
 *      working turn, and the one that would make this detector fire everywhere
 *      if `assistantTurnTexts` collected text-free entries.
 *
 * Case 3 is the whole false-positive surface. `_messageText` returns null for a
 * tool-only entry, so the collector never sees it; asserting that here rather
 * than trusting the reading is the difference between a tested claim and a
 * comment.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import {
    detectDroppedDecision,
    readTranscriptTail,
} from '../../src/scripts/hooks/turn_end_gate_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const HOOK = path.join(REPO_ROOT, 'src', 'scripts', 'hooks', 'turn_end_gate_hook.ts');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
const SESSION_ID = 'sess-pending-decision';

const tmp_dirs: string[] = [];
afterAll(() => {
    for (const d of tmp_dirs) {
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* a temp dir that will not delete is not a test failure */
        }
    }
});

/** The reply that asks. Three options plus the single recommendation line. */
const ASKED = [
    'Zwei Wege sind moeglich, und die Wahl ist Deine:',
    '',
    '1. Den Detektor sofort scharf schalten',
    '2. Erst eine Woche im Advisory-Modus messen',
    '3. Gar nicht bauen',
    '',
    '**Empfehlung: 2** — die Fehlerrate ist noch unbekannt.',
].join('\n');

/** The reply that drops it. Handles the nudge, demotes the question to a clause. */
const DROPPED = [
    'Der Reviewer laeuft jetzt ueber den Diff.',
    '',
    'Die offene Frage bleibt davon unberuehrt und liegt bei Dir.',
].join('\n');

/** A reply that carries the block forward — the corrected behaviour. */
const RE_PRESENTED = [
    'Der Reviewer ist durch, keine Findings.',
    '',
    '1. Den Detektor sofort scharf schalten',
    '2. Erst eine Woche im Advisory-Modus messen',
    '3. Gar nicht bauen',
    '',
    '**Empfehlung: 2** — unveraendert.',
].join('\n');

type Entry =
    | { role: 'user'; text: string }
    | { role: 'assistant'; text: string }
    | { role: 'assistant-tool'; name: string };

function writeTranscript(home: string, entries: readonly Entry[], tag: string): string {
    const file = path.join(home, `transcript-${tag}.jsonl`);
    const lines = entries.map((e) => {
        if (e.role === 'user') {
            return JSON.stringify({ type: 'user', message: { content: e.text } });
        }
        if (e.role === 'assistant') {
            return JSON.stringify({
                type: 'assistant',
                message: { content: [{ type: 'text', text: e.text }] },
            });
        }
        return JSON.stringify({
            type: 'assistant',
            message: { content: [{ type: 'tool_use', name: e.name, input: {} }] },
        });
    });
    fs.writeFileSync(file, lines.join('\n') + '\n');
    return file;
}

function makeHome(): string {
    const home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pending-decision-home-')));
    tmp_dirs.push(home);
    return home;
}

function tailOf(entries: readonly Entry[], tag: string): string[] {
    const home = makeHome();
    const file = writeTranscript(home, entries, tag);
    return readTranscriptTail(file, { homeDir: home }).assistantTurnTexts;
}

// ---------------------------------------------------------------------------
// The detector, as a pure function
// ---------------------------------------------------------------------------

describe('detectDroppedDecision', () => {
    it('fires when an earlier reply in the turn asked and the closing one does not', () => {
        const f = detectDroppedDecision([ASKED, DROPPED]);
        expect(f).not.toBeNull();
        expect(f!.detector).toBe('pending-decision');
        // The evidence carries the option NUMBERS and the span, never the option
        // text — a refusal reaches the transcript and an options block can carry
        // anything the reply carried.
        expect(f!.evidence).toContain('1/2/3');
        expect(f!.evidence).not.toContain('Advisory');
    });

    it('is silent when the closing reply carries the block forward', () => {
        expect(detectDroppedDecision([ASKED, RE_PRESENTED])).toBeNull();
    });

    it('is silent on a single-reply turn, however the reply is shaped', () => {
        expect(detectDroppedDecision([ASKED])).toBeNull();
        expect(detectDroppedDecision([DROPPED])).toBeNull();
        expect(detectDroppedDecision([])).toBeNull();
    });

    it('is silent when no reply in the turn ever asked', () => {
        expect(detectDroppedDecision([DROPPED, DROPPED])).toBeNull();
    });

    it('reaches back past intervening replies, not only to the one before', () => {
        const f = detectDroppedDecision([ASKED, 'Kurzer Zwischenstand.', DROPPED]);
        expect(f).not.toBeNull();
        expect(f!.detector).toBe('pending-decision');
    });

    it('is silent on a numbered list carrying NO recommendation line', () => {
        // The finding that nearly shipped. `find_option_blocks` calls any run of
        // two or more numbered lines a block, so a plan, a findings list or an
        // ordinary enumeration looked exactly like an ask. Replayed over this
        // repository's own 592 assistant turns, the block-only detector fired 29
        // times and 8 of those blocks had no recommendation line anywhere near
        // them — false positives in a detector that can REFUSE a turn.
        const plan = [
            'Plan:',
            '',
            '1. Read the failing test',
            '2. Fix the parser',
            '3. Re-run the suite',
        ].join('\n');
        expect(detectDroppedDecision([plan, 'Done. All 41 tests pass.'])).toBeNull();
    });

    it('fires on the ask and ignores the narrative list in the same reply', () => {
        // Both shapes in one text, which is the ordinary case: the detector must
        // key on the block that carries the recommendation, not on the last one.
        const mixed = [
            'Was ich geaendert habe:',
            '',
            '1. den Parser',
            '2. den Test',
            '',
            'Und eine Entscheidung liegt bei Dir:',
            '',
            '1. Sofort mergen',
            '2. Erst messen',
            '',
            '**Empfehlung: 2**',
        ].join('\n');
        const f = detectDroppedDecision([mixed, DROPPED]);
        expect(f).not.toBeNull();
        expect(f!.evidence).toContain('1/2');
    });

    it('accepts either language label, since Iron Law 1 accepts both', () => {
        const en = ['1. ship it', '2. measure first', '', 'Recommendation: 2'].join('\n');
        expect(detectDroppedDecision([en, DROPPED])).not.toBeNull();
    });

    it('does not read a fenced example block as a live ask', () => {
        // `find_option_blocks` masks fences, and detector E inherits that rather
        // than re-deciding it. A skill body quoting an options block is
        // illustration, not a question put to anyone.
        const fenced = ['Beispiel:', '', '```', '1. eins', '2. zwei', '```'].join('\n');
        expect(detectDroppedDecision([fenced, DROPPED])).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// `assistantTurnTexts` — the turn boundary, and what does NOT enter it
// ---------------------------------------------------------------------------

describe('readTranscriptTail collects the turn assistant texts', () => {
    it('keeps both assistant replies of one user turn, in order', () => {
        const texts = tailOf(
            [
                { role: 'user', text: 'Bau den Detektor.' },
                { role: 'assistant', text: ASKED },
                { role: 'assistant', text: DROPPED },
            ],
            'two-replies',
        );
        expect(texts).toEqual([ASKED, DROPPED]);
        expect(detectDroppedDecision(texts)).not.toBeNull();
    });

    it('NEAR-MISS 1: a genuine user prompt resets the turn, so nothing fires', () => {
        const texts = tailOf(
            [
                { role: 'user', text: 'Bau den Detektor.' },
                { role: 'assistant', text: ASKED },
                { role: 'user', text: '2' },
                { role: 'assistant', text: DROPPED },
            ],
            'answered',
        );
        expect(texts).toEqual([DROPPED]);
        expect(detectDroppedDecision(texts)).toBeNull();
    });

    it('NEAR-MISS 2: a synthetic user-role entry is not an answer', () => {
        // A task notification and a `<system-reminder>` both occupy the user role
        // without being anything the user said. If either reset the turn, the
        // detector would be silent in precisely the hook-nudge case that produced
        // it — the continuation is what injects them.
        const texts = tailOf(
            [
                { role: 'user', text: 'Bau den Detektor.' },
                { role: 'assistant', text: ASKED },
                { role: 'user', text: '<system-reminder>\nBackground task finished.\n</system-reminder>' },
                { role: 'assistant', text: DROPPED },
            ],
            'synthetic',
        );
        expect(texts).toEqual([ASKED, DROPPED]);
        expect(detectDroppedDecision(texts)).not.toBeNull();
    });

    it('NEAR-MISS 3: a tool-only assistant entry contributes no element', () => {
        // The ordinary shape of a working turn. If this produced an element,
        // every turn that asks and then runs one command would look like a drop.
        const texts = tailOf(
            [
                { role: 'user', text: 'Lies die Datei.' },
                { role: 'assistant', text: 'Ich schaue nach.' },
                { role: 'assistant-tool', name: 'Read' },
                { role: 'assistant', text: 'Steht alles drin.' },
            ],
            'tool-only',
        );
        expect(texts).toEqual(['Ich schaue nach.', 'Steht alles drin.']);
        expect(detectDroppedDecision(texts)).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Through the real process — the refusal, and the open-dispatch case
// ---------------------------------------------------------------------------

function makeWorkspace(): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pending-decision-ws-')));
    tmp_dirs.push(dir);
    return dir;
}

/** One open subagent-ledger record, so `dispatchOpen` is genuinely true. */
function plantOpenDispatch(dir: string): void {
    const openDir = path.join(dir, 'agents', 'runtime', 'state', 'subagent-ledger', 'open');
    fs.mkdirSync(openDir, { recursive: true });
    fs.writeFileSync(
        path.join(openDir, 'aaaaaaaaaaaa.json'),
        JSON.stringify({
            ref: 'aaaaaaaaaaaa',
            agent_type: 'Explore',
            started_at: new Date().toISOString(),
            parent_ref: null,
            depth: 1,
            depth_basis: 'assumed-root',
            session_id: null,
        }),
        'utf8',
    );
}

function runHook(cwd: string, transcriptPath: string, home: string, extra: object = {}) {
    const stdin = JSON.stringify({
        schema_version: 1,
        platform: 'claude',
        event: 'stop',
        native_event: 'Stop',
        session_id: SESSION_ID,
        workspace_root: cwd,
        payload: { transcript_path: transcriptPath, ...extra },
        settings: {},
    });
    const r = spawnSync(TSX, [HOOK], {
        encoding: 'utf8',
        cwd,
        input: stdin,
        env: {
            ...process.env,
            HOME: home,
            USERPROFILE: home,
            EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
        },
    });
    return { status: r.status ?? -1, stderr: r.stderr ?? '' };
}

describe('the gate refuses a turn that dropped its own question', () => {
    it('refuses, and names the block that went missing', () => {
        const dir = makeWorkspace();
        const home = makeHome();
        const t = writeTranscript(
            home,
            [
                { role: 'user', text: 'Bau den Detektor.' },
                { role: 'assistant', text: ASKED },
                { role: 'assistant', text: DROPPED },
            ],
            'e2e-drop',
        );
        const r = runHook(dir, t, home);
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('pending-decision');
        expect(r.stderr).toContain('1/2/3');
        expect(r.stderr).toContain('re-present the options block');
    });

    it('still refuses with a subagent dispatch REALLY open — E is unconditional', () => {
        // A and D are excused by an open dispatch; E must not be. The dispatch IS
        // the continuation that drops the decision, so excusing it here would
        // silence the detector in its own founding case.
        //
        // The ledger is PLANTED rather than assumed. This test first asserted the
        // claim against an empty workspace, where `openRecordStats` reads zero and
        // `dispatchOpen` is false — so a regression wrapping E in
        // `dispatchOpen ? null : …` would have passed it. A review caught that the
        // test named the property it did not exercise.
        const dir = makeWorkspace();
        const home = makeHome();
        plantOpenDispatch(dir);
        const t = writeTranscript(
            home,
            [
                { role: 'user', text: 'Bau den Detektor.' },
                { role: 'assistant', text: ASKED },
                { role: 'assistant', text: 'Der Reviewer ist durch, keine Findings.' },
            ],
            'e2e-clean-drop',
        );
        const r = runHook(dir, t, home, { stop_hook_active: false });
        expect(r.status).toBe(1);
        expect(r.stderr).toContain('pending-decision');
    });

    it('lets the turn end when the block was carried forward', () => {
        const dir = makeWorkspace();
        const home = makeHome();
        const t = writeTranscript(
            home,
            [
                { role: 'user', text: 'Bau den Detektor.' },
                { role: 'assistant', text: ASKED },
                { role: 'assistant', text: RE_PRESENTED },
            ],
            'e2e-carried',
        );
        expect(runHook(dir, t, home).status).toBe(0);
    });
});
