/**
 * Reading a Claude JSONL transcript tail, for the turn-end gate's detectors.
 *
 * Extracted from `hooks/turn_end_gate_hook.ts` for the reason its own detector
 * E carries one line above its import: `_lib` is where this prose costs no
 * ratchet debt. The gate reached 1,593 lines against a 1,500-line source
 * budget when the shadow read landed, and `check_source_size_budget` only
 * turns one way — so the choice was to extract or to delete comments that
 * record why the reader is shaped as it is. This module is the extraction.
 *
 * Nothing about the behaviour moves: every function below is byte-identical to
 * the version that lived in the gate, and the gate re-exports all three public
 * names so no importer changes. The two guards this reader depends on stay
 * where they are — `isSafeTranscriptPath` is the security-relevant
 * home-confinement predicate and `isSyntheticPrompt` is the ordinal filter, and
 * relocating either as a side effect of a size budget is exactly the drive-by
 * this tree's diff discipline forbids.
 */
import * as fs from 'node:fs';

import { isSyntheticPrompt } from '../language_mirror_hook.js';
import { isSafeTranscriptPath } from '../hooks/end_review_nudge_hook.js';

/**
 * One tool call the assistant made, reduced to what a detector can reason
 * about: the tool's name, the shell command when it is a shell call, and the
 * target path when it is a file write.
 *
 * Nothing else is kept. A tool input can hold a whole file body, and this
 * struct is what a refusal quotes back — so it is shaped to be INCAPABLE of
 * carrying one, the same PII-exclusion-by-construction discipline
 * `domain-safety-pii` § Surface 2 asks for in a log line.
 */
export interface ToolCall {
    name: string;
    /** `Bash` only — the command line, so "did anything verify" is answerable. */
    command?: string;
    /** Edit/Write only — the file the turn changed, used as the evidence span. */
    path?: string;
}

export interface TranscriptTail {
    lastAssistant: string;
    /**
     * Every assistant text of the CURRENT turn, in order — reset at each genuine
     * user prompt exactly like `toolCalls`, and for the same reason: a question
     * asked three turns ago was answered, a question asked earlier in THIS turn
     * was not. Detector E reads it; the other four read `lastAssistant`, which is
     * always the last element when this is non-empty.
     *
     * A tool-only assistant entry contributes NOTHING here. `_messageText`
     * returns null for it and the collector skips it, so the ordinary shape of a
     * working turn — prose, tool call, prose — produces two elements and not
     * three. That is the whole false-positive surface of detector E, and it is
     * closed here rather than in the detector.
     */
    assistantTurnTexts: string[];
    /**
     * How many GENUINE user prompts the transcript carries — harness-injected
     * user-role entries excluded via `isSyntheticPrompt`. This is the turn's
     * identity; see `alreadyRefusedTurn` for why the prompt's text is not.
     */
    turnOrdinal: number;
    /**
     * The tool calls of the CURRENT turn, in order — reset at every genuine user
     * prompt, so a verification from three turns ago cannot vouch for an edit
     * made now. `_messageText` keeps only `type === 'text'` blocks, which is why
     * this needed its own extraction rather than a reading of `lastAssistant`:
     * tool activity is not in the prose at all.
     */
    toolCalls: ToolCall[];
}

/**
 * The last assistant text, plus the turn ordinal, from a Claude JSONL
 * transcript. Mirrors `chat_history._extract_claude_transcript_response` for
 * the assistant half.
 *
 * `isSyntheticPrompt` is applied to every user-role entry — the same filter
 * `language_mirror_hook` uses, and for the same reason it was added there
 * (round-5 § 6.5): a background-task notification and a `<system-reminder>`
 * both occupy the user role without being chat messages. Counting them would
 * move the turn ordinal mid-turn, which is R2 finding 3.
 */
export function readTranscriptTail(
    transcriptPath: string,
    opts: { homeDir?: string; maxBytes?: number } = {},
): TranscriptTail {
    const empty: TranscriptTail = {
        lastAssistant: '',
        turnOrdinal: 0,
        toolCalls: [],
        assistantTurnTexts: [],
    };
    if (!transcriptPath || !isSafeTranscriptPath(transcriptPath, opts)) return empty;
    let lines: string[];
    try {
        // R2 finding 12: `maxBytes` was accepted in the options type and never
        // used, so the declared cap was decoration. It is enforced here as well
        // as inside `isSafeTranscriptPath`, because this is the read it bounds.
        // The whole file still has to be walked — the turn ordinal is a count
        // over all entries, not something a tail can answer — so the cap is the
        // guard, not an optimisation.
        if (opts.maxBytes !== undefined && fs.statSync(transcriptPath).size > opts.maxBytes) {
            return empty;
        }
        lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');
    } catch {
        return empty;
    }
    let lastAssistant = '';
    let turnOrdinal = 0;
    let toolCalls: ToolCall[] = [];
    let assistantTurnTexts: string[] = [];
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        let obj: unknown;
        try {
            obj = JSON.parse(line);
        } catch {
            continue;
        }
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) continue;
        const entry = obj as Record<string, unknown>;
        // Sidechain entries are a SUBAGENT's conversation recorded in the same
        // JSONL. A subagent prompt is a genuine-looking user-role text entry
        // appended mid-turn, so counting it moves the ordinal within the turn —
        // finding 3's failure class in a new shape (R2 round 2, finding 3).
        if (entry['isSidechain'] === true) continue;
        const role = entry['type'];
        if (role !== 'assistant' && role !== 'user') continue;
        const msg = entry['message'];
        if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) continue;
        const content = (msg as Record<string, unknown>)['content'];
        // Tool calls are read BEFORE the text guard: an assistant entry that is
        // only a tool_use block has no text at all, so `continue`-ing on a null
        // text would drop exactly the entries this detector exists to see.
        if (role === 'assistant') {
            toolCalls.push(...extractToolCalls(content));
        }
        const text = _messageText(content);
        if (text === null) continue;
        if (role === 'assistant') {
            lastAssistant = text;
            assistantTurnTexts.push(text);
        } else if (!isSyntheticPrompt(text)) {
            turnOrdinal += 1;
            // A genuine user prompt starts a new turn, so the previous turn's
            // tool activity stops counting. Without this reset, a verification
            // run three turns ago would vouch for an edit made now — the
            // "fresh" in edit-without-FRESH-verification is this line.
            toolCalls = [];
            // Same boundary, same reason, for detector E: an options block the
            // user has since replied to is answered, not dropped. Resetting on
            // the identical line is what makes "in the SAME user turn" true of
            // the array rather than merely intended.
            assistantTurnTexts = [];
        }
    }
    return {
        lastAssistant: lastAssistant.trim(),
        turnOrdinal,
        toolCalls,
        assistantTurnTexts,
    };
}

/**
 * Extract this entry's tool calls, keeping only name, shell command and target
 * path. A tool input can hold a whole file body; nothing but those three fields
 * is carried forward.
 *
 * Exported because `measure_turn_end_gate` scores detectors C and E over a real
 * transcript corpus and therefore has to rebuild the same `ToolCall[]` the gate
 * sees. A second extractor there would be a second dialect of "what the turn
 * did", and the measurement would then be of that dialect rather than of the
 * shipped gate — the exact population-parity defect that script's own header
 * documents twice.
 */
export function extractToolCalls(content: unknown): ToolCall[] {
    if (!Array.isArray(content)) return [];
    const out: ToolCall[] = [];
    for (const blk of content) {
        if (typeof blk !== 'object' || blk === null || Array.isArray(blk)) continue;
        const b = blk as Record<string, unknown>;
        if (b['type'] !== 'tool_use') continue;
        const name = b['name'];
        if (typeof name !== 'string') continue;
        const input = b['input'];
        const call: ToolCall = { name };
        if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
            const inp = input as Record<string, unknown>;
            const cmd = inp['command'];
            if (typeof cmd === 'string') call.command = cmd;
            const p = inp['file_path'] ?? inp['path'] ?? inp['notebook_path'];
            if (typeof p === 'string') call.path = p;
        }
        out.push(call);
    }
    return out;
}

function _messageText(content: unknown): string | null {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return null;
    const parts: string[] = [];
    for (const blk of content) {
        if (typeof blk !== 'object' || blk === null || Array.isArray(blk)) continue;
        const b = blk as Record<string, unknown>;
        if (b['type'] !== 'text') continue;
        const t = b['text'];
        if (typeof t === 'string') parts.push(t);
    }
    return parts.length > 0 ? parts.join('\n') : null;
}
