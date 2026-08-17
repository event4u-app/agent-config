/**
 * interruption_ledger — road-to-user-out-of-the-loop Phase 0 Step 1.
 *
 * CAPTURE ONLY. Every `stop`, classifies whether the turn that just ended put a
 * synchronous contact to the user, and appends one line to
 * `agents/runtime/state/interruptions.jsonl`. It never emits context, never
 * warns, and always returns 0 — the whole point of Phase 0 is a window that no
 * mechanism reacted to, so a ledger that could change a run would corrupt the
 * baseline it exists to measure.
 *
 * WHY THIS EXISTS. The roadmap's Goal names two axes — synchronous contacts per
 * delivered roadmap, and wall-clock to open PR — and pre-registers both as
 * claims. Neither is derivable today: nothing in the tree records that a turn
 * ended by asking the user something. `check_enforcement_coverage` counts
 * carriers, `gate-metrics.jsonl` counts gate verdicts, and the conformance suite
 * scores reply SHAPE without ever asking whether the reply stopped the run.
 *
 * REUSE, NOT REIMPLEMENTATION. Reply-shape detection is `turn_end_gate_hook`'s,
 * imported rather than copied: `readTranscriptTail` for the last assistant text,
 * `finalParagraph` for the closing paragraph, and its `HANDBACK` list for the
 * yields-without-asking shape. That file is the measured corpus's detector and
 * has an R2 history behind each regex; a second copy here would drift from it
 * silently and the drift would land in the baseline, not in a test.
 *
 * WHAT COUNTS AS A CONTACT, and why it is three classes rather than two. A
 * question mark is the obvious one. It is not the only one: `scope-control`
 * requires a hand-back — "das entscheidest Du", "your call" — which ends the
 * turn and waits for the user just as hard as a question does, with no `?`
 * anywhere. Counting only questions would report the package's own preferred
 * hand-back shape as zero contacts, which is precisely the metric-that-flatters-
 * the-design failure the roadmap's Risk 6 names.
 *
 *   ask       — the closing paragraph ends in a question mark.
 *   handback  — no question, but the closing paragraph yields the decision.
 *   none      — the turn ended without putting anything to the user.
 *
 * `class` refines an `ask` by the shape the user has to answer in:
 * `numbered-options` when the reply carries a numbered block (the
 * `user-interaction` shape — one decision point, cheap to answer), or
 * `open-question` when it does not (free text, the expensive shape). The split
 * exists because the two are not equal contacts and the report separates them.
 *
 * DEDUPE is on the turn ordinal, the same identity `turn_end_gate_hook` derives
 * and for the same reason: a host may fire `stop` more than once for one turn,
 * and a per-turn ledger that double-counts inflates exactly the number the
 * baseline is pre-registered on.
 *
 * The roadmap slug comes from this session's own claim file — the one
 * `agent-config sessions:claim` writes — so a contact is attributable to a
 * delivered roadmap without this hook knowing anything about roadmaps. No claim
 * means `roadmap: null`, which is a real and common state (any session that is
 * not a roadmap run) and never a reason to skip the line.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { derive_session_tag } from '../chat_history.js';
import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
import { readHookStdin } from './hook_stdin.js';
import { HANDBACK, finalParagraph, readTranscriptTail } from './turn_end_gate_hook.js';

const EXIT_OK = 0;

/** Same cap the turn-end gate reads its tail under. */
const TRANSCRIPT_READ_MAX_BYTES = 2 * 1024 * 1024;

export const LEDGER_RELPATH = path.join('agents', 'runtime', 'state', 'interruptions.jsonl');

export type ContactKind = 'ask' | 'handback' | 'none';
export type ContactClass = 'numbered-options' | 'open-question' | 'handback' | 'none';

export interface InterruptionRecord {
    run_id: string;
    turn: number;
    kind: ContactKind;
    class: ContactClass;
    roadmap: string | null;
    at: string;
}

/**
 * A numbered-options block: two or more numbered lines. One numbered line is an
 * ordinary enumeration inside prose and is not a decision surface — requiring
 * two is what keeps "1. read the file" from reading as an ask.
 */
export function hasNumberedOptions(reply: string): boolean {
    let count = 0;
    for (const line of reply.split('\n')) {
        if (/^[ \t]{0,3}\d+[.)]\s+\S/.test(line)) count += 1;
        if (count >= 2) return true;
    }
    return false;
}

/**
 * Classify the reply. The question test is `turn_end_gate_hook`'s exactly — a
 * question that ENDS the paragraph, never `includes('?')`, because a rhetorical
 * or quoted question mid-reply is not a contact and counting it would inflate
 * the baseline in the direction that makes the roadmap look successful later.
 */
export function classifyReply(reply: string): { kind: ContactKind; class: ContactClass } {
    const tail = finalParagraph(reply);
    if (!tail) return { kind: 'none', class: 'none' };

    if (/\?["'’)\]]*\s*$/.test(tail)) {
        return {
            kind: 'ask',
            class: hasNumberedOptions(reply) ? 'numbered-options' : 'open-question',
        };
    }
    if (HANDBACK.some((re) => re.test(tail))) return { kind: 'handback', class: 'handback' };
    return { kind: 'none', class: 'none' };
}

/** The roadmap this session claimed, or null. Never throws. */
export function readClaimedRoadmap(workspaceRoot: string, sessionId: string): string | null {
    if (!sessionId) return null;
    try {
        const file = path.join(
            workspaceRoot,
            'agents',
            'runtime',
            'state',
            `roadmap-claim-${sessionId}.json`,
        );
        const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (parsed === null || typeof parsed !== 'object') return null;
        const slug = (parsed as Record<string, unknown>)['slug'];
        return typeof slug === 'string' && slug.length > 0 ? slug : null;
    } catch {
        return null;
    }
}

/**
 * True when this run has already recorded this turn. Reads only the tail of the
 * ledger: the duplicate a repeated `stop` produces is always the most recent
 * line, so scanning the whole file would cost more on every turn to catch
 * nothing extra.
 */
export function alreadyRecorded(ledgerPath: string, runId: string, turn: number): boolean {
    let raw: string;
    try {
        raw = fs.readFileSync(ledgerPath, 'utf8');
    } catch {
        return false;
    }
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    for (const line of lines.slice(-20)) {
        try {
            const rec: unknown = JSON.parse(line);
            if (rec === null || typeof rec !== 'object') continue;
            const r = rec as Record<string, unknown>;
            if (r['run_id'] === runId && r['turn'] === turn) return true;
        } catch {
            // A corrupt line is not a reason to skip the write.
        }
    }
    return false;
}

function str(v: JsonValue | undefined): string {
    return typeof v === 'string' ? v : '';
}

export function main(): number {
    let envelope: JsonObject;
    let payload: JsonObject;
    try {
        [envelope, payload] = unwrap(readHookStdin(), 'claude');
    } catch {
        return EXIT_OK;
    }

    const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined) || process.cwd();
    const transcriptPath = str(
        (payload['transcript_path'] ?? payload['transcriptPath']) as JsonValue | undefined,
    );
    if (!transcriptPath) return EXIT_OK;

    let lastAssistant = '';
    let turnOrdinal = 0;
    try {
        const tail = readTranscriptTail(transcriptPath, { maxBytes: TRANSCRIPT_READ_MAX_BYTES });
        lastAssistant = tail.lastAssistant;
        turnOrdinal = tail.turnOrdinal;
    } catch {
        return EXIT_OK;
    }
    if (!lastAssistant) return EXIT_OK;

    const sessionId =
        str(payload['session_id'] as JsonValue | undefined) ||
        str(envelope['session_id'] as JsonValue | undefined);
    // `derive_session_tag`, NOT the turn-end gate's `deriveSessionKey`. Both
    // hash the session id, and only this one produces the tag `chat_history`
    // already writes as `s`. The wall-clock axis is a join between this ledger
    // and those timestamps, so a 32-char key from the other derivation would
    // have made the roadmap's second pre-registered claim underivable — while
    // looking correct in every test that never crossed the two files.
    const runId = sessionId ? derive_session_tag(sessionId) : 'unknown';

    const ledgerPath = path.join(workspaceRoot, LEDGER_RELPATH);
    if (alreadyRecorded(ledgerPath, runId, turnOrdinal)) return EXIT_OK;

    const verdict = classifyReply(lastAssistant);
    const record: InterruptionRecord = {
        run_id: runId,
        turn: turnOrdinal,
        kind: verdict.kind,
        class: verdict.class,
        roadmap: readClaimedRoadmap(workspaceRoot, sessionId),
        at: new Date().toISOString(),
    };

    try {
        fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
        fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`, 'utf8');
    } catch {
        // A ledger that cannot be written is a lost measurement, never a
        // reason to affect the turn. Phase 0 is advisory by construction.
    }
    return EXIT_OK;
}

/**
 * The concern runs in-process via `CONCERN_REGISTRY`, but the manifest's
 * `script:` path is also the SPAWN FALLBACK — and without this guard that path
 * imports the module, calls nothing, and exits 0. A silent no-op on a
 * capture-only concern is invisible by construction: the ledger simply stays
 * empty and the baseline reads as "no contacts". Caught by running the hook
 * against a real envelope rather than by any unit test, which is why the probe
 * is worth the two minutes.
 */
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
