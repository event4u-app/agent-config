#!/usr/bin/env node
/**
 * Self-repair hook — turns an observed agent defect into a queued, fixable
 * record without the user having to file anything.
 *
 * Three slots, one record shape:
 *
 *   - `user_prompt_submit` — the user states the agent worked wrongly. Opens a
 *     `user-reported` record and injects the open-queue line so the agent picks
 *     the work up in the same turn.
 *   - `stop` — the finished turn is run past the deterministic detectors. A hit
 *     opens a `self-detected` record. Nothing is injected here: a reminder that
 *     fires after the reply cannot shape it, and the queue line at the next
 *     prompt reaches the same agent one turn later at a fraction of the tokens.
 *   - every other slot — clean no-op.
 *
 * ADVISORY BY CONSTRUCTION (`fail_closed: false`, always exit 0). Blocking a
 * turn-end on a heuristic is the failure mode the enforcement-projection and
 * recursive-verification nulls both warn about; this hook records, it does not
 * gate. The one outward step (push + PR, or an issue) stays behind the
 * `non-destructive-by-default` Hard Floor and lives in `self_repair_cli.ts`.
 *
 * Honest scope: the detector set is small and deterministic on purpose. It
 * covers the two defect classes the conformance audits actually measured, plus
 * the user-report path. It does NOT "check all rules were followed" — most
 * obligations are model-carried and unobservable from a transcript, and a
 * detector that guessed at them would manufacture defects and flood the queue.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    type DefectFinding,
    detectUserReport,
    runDetectors,
    type TurnSnapshot,
} from './_lib/self_repair.js';
import { openRecords, upsertFinding } from './_lib/self_repair_store.js';
import { readHookStdin } from './hooks/hook_stdin.js';
import { emitDefectShadow } from './hooks/telemetry_self_repair.js';

const EXIT_ALLOW = 0;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: JsonValue | undefined): string {
    return typeof v === 'string' ? v : '';
}

function workspaceRoot(env: JsonObject): string {
    const v = env['workspace_root'];
    return typeof v === 'string' && v ? v : process.cwd();
}

/**
 * Last assistant reply + the tool commands of the turn, read from the host's
 * JSONL transcript. Absent or unreadable transcript → an empty snapshot, which
 * every detector declines.
 */
export function readTurn(transcriptPath: string, pinned: 'de' | 'en' | null): TurnSnapshot {
    const empty: TurnSnapshot = { prompt: '', reply: '', toolCommands: [], pinnedLanguage: pinned };
    if (!transcriptPath) {
        return empty;
    }
    let lines: string[];
    try {
        lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');
    } catch {
        return empty;
    }
    let reply = '';
    let prompt = '';
    const toolCommands: string[] = [];
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) {
            continue;
        }
        let obj: unknown;
        try {
            obj = JSON.parse(line);
        } catch {
            continue;
        }
        if (!isObject(obj)) {
            continue;
        }
        const msg = obj['message'];
        if (!isObject(msg)) {
            continue;
        }
        const content = msg['content'];
        if (obj['type'] === 'user' && typeof content === 'string') {
            prompt = content;
        }
        if (obj['type'] !== 'assistant') {
            continue;
        }
        if (typeof content === 'string') {
            reply = content;
            continue;
        }
        if (!Array.isArray(content)) {
            continue;
        }
        const parts: string[] = [];
        for (const blk of content) {
            if (!isObject(blk)) {
                continue;
            }
            if (blk['type'] === 'text' && typeof blk['text'] === 'string') {
                parts.push(blk['text']);
            }
            if (blk['type'] === 'tool_use') {
                const input = blk['input'];
                const name = str(blk['name']);
                const cmd = isObject(input) ? str(input['command']) : '';
                toolCommands.push(`${name} ${cmd}`.trim());
            }
        }
        if (parts.length > 0) {
            reply = parts.join('\n');
        }
    }
    return { prompt, reply, toolCommands, pinnedLanguage: pinned };
}

/**
 * The queue line injected at prompt time when records are waiting.
 *
 * `occurrences` is the newest record's own repeat counter, and it is in the line
 * because the store has always counted while the model never saw the number: a
 * recurring defect increments one record instead of adding a queue entry, so
 * `count` stays flat and the recurrence is invisible. Above 1 it is the only
 * deterministic "this came back" signal an agent gets, which is what makes
 * `decision-revisit-gate` § Recurrence executable rather than aspirational.
 * Omitted at 1 — a first sighting has nothing to say.
 */
export function buildQueueLine(count: number, newest: string, occurrences = 1): string {
    const repeat =
        occurrences > 1
            ? ` The newest record has recurred ${occurrences} time(s): the earlier ` +
              `disposition did not hold, so per decision-revisit-gate § Recurrence ` +
              `reopen it and name which assumption broke — resolve on evidence, ` +
              `never on the repetition count.`
            : '';
    return (
        `<self-repair-queue>${count} open agent-config defect record(s) ` +
        `(newest: ${newest}).${repeat} These are defects in the AGENT CONFIG, not in this ` +
        `project. Per the self-repair rule: analyse the newest record, author the ` +
        `fix against agent-config, and prepare the release — the outward step ` +
        `(push + PR, or an issue) still needs the user's word this turn. ` +
        `Records: agents/runtime/self-repair/</self-repair-queue>`
    );
}

function pinnedLanguage(env: JsonObject): 'de' | 'en' | null {
    const v = str(env['reply_language'] ?? env['language']).toLowerCase();
    if (v.startsWith('de')) {
        return 'de';
    }
    if (v.startsWith('en')) {
        return 'en';
    }
    return null;
}

export function main(): number {
    let env: JsonObject = {};
    try {
        const raw = readHookStdin();
        const parsed: unknown = raw.trim() ? JSON.parse(raw) : {};
        env = isObject(parsed) ? parsed : {};
    } catch {
        // malformed stdin — never block, just no-op below
    }

    const slot = str(env['event']) || 'session_start';
    if (slot !== 'user_prompt_submit' && slot !== 'stop') {
        return EXIT_ALLOW;
    }

    const root = workspaceRoot(env);
    const now = new Date().toISOString();
    const findings: DefectFinding[] = [];

    if (slot === 'user_prompt_submit') {
        const prompt = str(env['prompt'] ?? env['user_prompt'] ?? env['text']);
        const f = detectUserReport(prompt);
        if (f !== null) {
            findings.push(f);
        }
    } else {
        const tp = str(env['transcript_path'] ?? env['transcriptPath']);
        findings.push(...runDetectors(readTurn(tp, pinnedLanguage(env))));
    }

    for (const f of findings) {
        try {
            const rec = upsertFinding(root, f, now);
            // The Class-A shadow (road-to-org-telemetry Phase 5, step 5.1).
            // Structural fields only — the record type has no member able to
            // hold `f.evidence` or `f.suggested_surface`, which are the
            // Class-B payload and ship only on per-case approval. Inert unless
            // the org pack activated telemetry; a refused record (`null` from
            // the creation cap) emits nothing, because there is no queued
            // defect to shadow.
            if (rec !== null) {
                emitDefectShadow(root, rec, env);
            }
        } catch {
            // an unwritable store must never cost the user their turn
        }
    }

    // Injection happens at prompt time only — see the header note on `stop`.
    if (slot !== 'user_prompt_submit') {
        return EXIT_ALLOW;
    }
    let open: ReturnType<typeof openRecords>;
    try {
        open = openRecords(root);
    } catch {
        return EXIT_ALLOW;
    }
    if (open.length === 0) {
        return EXIT_ALLOW;
    }
    process.stdout.write(
        `${JSON.stringify({
            decision: 'allow',
            reason: `self-repair: ${open.length} open record(s)`,
            context: buildQueueLine(
                open.length,
                open[0]!.defect_class,
                open[0]!.occurrences,
            ),
        })}\n`,
    );
    return EXIT_ALLOW;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exit(main());
}
