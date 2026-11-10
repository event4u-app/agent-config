<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-11-08 for the ratification of
     branch feat/session-pins-phase-2 (round 4), committed verbatim beside the record. -->

# Ratification review — session pins in the language-mirror hook, and three budget rows

You are reviewing a change to the hook surface of a repository that ships
rules, skills and hooks for AI coding agents. Hooks run around the host's tool
calls and session events. A byte budget caps the hook bundle and the bytes each
hook may inject. Changes to the budget files need an independent review because
an agent must not ratify an increase in its own authority.

Judge the change below on one question: does it expand any authority — can the
new code block, deny, rewrite or inject anything, lower a ceiling, weaken a
gate, or reach the model's context? Answer with exactly one verdict and the
reasons:

- `ratified` — it expands authority, and the expansion is acceptable.
- `confirmed-non-expanding` — it expands no authority.
- `refused` — it expands authority in a way that should not merge, or the
  change does not let you tell.

Name anything in the change that contradicts its own description, and any
defect you find in the implementation: a way text the user did not type could
become a pin, a way a pin could be lost or truncated silently, a way one
session could read another's pins, an unbounded emission, or a failure that is
swallowed.

## What the branch says it does

The user can type `pin: <text>` at the start of a line in their own prompt to
set a constraint for the session, and `unpin: <text>` / `unpin: all` to remove
one. The existing `language-mirror` concern (bound on `user_prompt_submit` on
several hosts, and on `pre_compact` / `post_tool_use` on claude) captures these
lines and stores them per session. After a compaction, its existing pin-lost
marker (set at `pre_compact`, consumed by the next `post_tool_use`) now restores
the pins verbatim together with the language pin, once. The `subagent-constraints`
concern (claude `subagent_start`) hands the parent session's pins to every
subagent.

- Only the human-typed lead of the prompt counts: synthetic turns, host-injected
  regions, `<pasted_content>` blocks, fenced code and everything from the first
  pasted document on are dropped before matching, and the marker must be at
  column zero. Tool output and file content never reach this event.
- Caps: 12 pins, 300 characters each, 4,096 JSON-escaped bytes together. A pin
  over a cap is refused whole and named in a notice; the notice is bounded.
- Kill switch `AGENT_CONFIG_NO_SESSION_PINS=1`.
- The pin module ships as a separate lazily required chunk; a missing chunk is
  reported on the capture turn and costs only the pin restore.
- Budget rows, exactly as the diff sets them: the dispatch-bundle ceiling
  1,585,000 → 1,587,800 B (measured 1,587,177, +3,239 over origin/main's
  1,583,938), a new chunk row for the pin module at 27,000 B (measured
  26,251), the subagent-constraints chunk ceiling 24,500 → 28,500 B (measured
  27,686, +3,843 over main's 23,843), and the `language-mirror` per-concern
  injection row 2,048 → 5,120 B, with a stated exception on the `post_tool_use`
  slot row for the one restore fire per compaction.

The roadmap that asks for this: pins are entered by an explicit user marker
only, never extracted by a model; restore through the existing marker pattern,
no second mechanism; no new always-on bytes.

## Rounds 1 and 2, in one paragraph

Fixed earlier, each with a test shown red when the fix is neutralised:
CommonMark fence pairing; paste removal that never splices a line; a missing
module told apart from a legitimate null; capture under the per-file lock;
invalid or lossy state never overwritten (`parsePins` is lossless: any entry
this module would not have written makes the file `invalid`); activity-based
retention with a per-prompt touch; reported restore failures; the kill switch
checked before any load; the worst pins plus a digest inside the subagent cap.

## Round 3 and what changed

Round 3 (both seats against) found, and this round fixes:

1. A restore dropped by the per-turn budget was lost: the marker is consumed
   before the dispatcher shapes emissions, and drop records carry no session.
   Now a restore leaves a per-session pending marker. The next substantive
   prompt reads the last 4 MiB of the session's own transcript (the host's
   `transcript_path`): if a `hook_additional_context` attachment carrying
   `<session-pins>` follows the last `compact_boundary`, nothing is sent; if
   none does, or the transcript cannot be read, the pins are sent again once,
   saying so. The marker is consumed either way. The host records PostToolUse
   context as such attachments (checked in a live transcript: 11 of them).
2. Nested pastes: the non-greedy regex paired the outer opener with the inner
   close, leaving text inside the outer block. Tags are now paired by depth; an
   unclosed opener drops the rest, a stray close drops everything before it.
   Full-pipeline tests through the hook cover the reported shape.
3. A subagent whose parent's pin file cannot be read now receives a notice
   that pinned constraints exist but could not be read, and to ask before a
   change they might cover — not silence.

Not changed: `pin:` is case-insensitive by design (the guide's examples are
lower case); the `invalid` state does not carry a reason, since every caller
takes the same action on all of them.

## The new module — `src/scripts/_lib/session_pins.ts`

~~~ts
/**
 * Session pins — constraints the user set in a session, restored verbatim after
 * a compaction (road-to-state-and-pins-across-compaction Phase 2).
 *
 * A pin is a line the user typed starting with `pin:` at column zero. Nothing
 * else creates one, and nothing else removes one: the capture reads only the
 * `user_prompt_submit` text, after dropping host-injected regions, pasted
 * blocks, fenced code and everything from the first pasted document on. Tool
 * output and file content never reach that event, so injected content can
 * neither add nor delete a pin. No model decides what is a pin (decision L1).
 *
 * Bounded at {@link MAX_PINS} × {@link MAX_PIN_CHARS}. A pin over either limit
 * is refused and the user is told which one; nothing is truncated.
 */
import fs from 'node:fs';
import path from 'node:path';

import {
    atomic_write_json,
    has_stable_session_id,
    owns_session_state,
    prune_stale_session_states,
    session_state_file,
    update_text_under_lock,
} from '../hooks/state_io.js';
import { humanAuthoredLead, isSyntheticPrompt, stripInjectedRegions } from './prompt_shape.js';

export const MAX_PINS = 12;
export const MAX_PIN_CHARS = 300;
/**
 * Bytes the held pins may occupy together, counted as JSON-escaped UTF-8. 12 ASCII pins of 300 fit
 * (3,600 B), so the 12 x 300 promise holds as stated for ASCII text; a set heavy
 * in multi-byte characters reaches this first and the user is told. Without it
 * the restore line could reach ~14 KB, over the host's 10,000-character
 * `additionalContext` line and over the subagent carrier's 9,728-byte reply.
 */
export const MAX_PINS_BYTES = 4096;
export const STATE_DIR = path.join('agents', 'state', 'session-pins');
export const KILL_SWITCH = 'AGENT_CONFIG_NO_SESSION_PINS';

export type Directive = { readonly kind: 'pin'; readonly text: string } | { readonly kind: 'unpin'; readonly text: string };

export interface PinState {
    readonly session_id: string;
    readonly pins: readonly string[];
    readonly updated_at: string;
}

export interface ApplyResult {
    readonly pins: readonly string[];
    readonly added: readonly string[];
    readonly removed: readonly string[];
    readonly duplicate: readonly string[];
    readonly tooLong: readonly string[];
    readonly overCap: readonly string[];
    readonly overBytes: readonly string[];
    readonly notFound: readonly string[];
}

const PIN_LINE = /^pin:[ \t]*(.*)$/i;
const UNPIN_LINE = /^unpin:[ \t]*(.*)$/i;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;

export function pinsDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return (env[KILL_SWITCH] ?? '').trim() === '1';
}

const PASTE_TAG = /<(\/?)pasted_content\b[^>]*>/gi;

/**
 * Drop pasted blocks, pairing tags by depth so a block nested inside another
 * cannot close the outer one early. Each block becomes a line break followed by
 * a control character, never nothing: joining the text on either side could
 * otherwise assemble a `pin:` line nobody typed, and the control character
 * keeps text that continued the paste's own line from starting a line of its
 * own. An opening tag that never closes drops everything from it on; a closing
 * tag with no opener drops everything before it. Both are the safe reading.
 */
function withoutPastes(prompt: string): string {
    let out = '';
    let depth = 0;
    let from = 0;
    for (const m of prompt.matchAll(PASTE_TAG)) {
        const at = m.index ?? 0;
        if (m[1] === '/') {
            if (depth === 0) {
                out = '\n\u0001';
                from = at + m[0].length;
                continue;
            }
            depth--;
            if (depth === 0) {
                out += '\n\u0001';
                from = at + m[0].length;
            }
        } else {
            if (depth === 0) out += prompt.slice(from, at);
            depth++;
        }
    }
    return depth > 0 ? out : out + prompt.slice(from);
}

/**
 * Drop fenced code with CommonMark's pairing: a fence closes only on the same
 * character, at least as long as the opener, with nothing after it. So a ```
 * line inside a ```` block does not reopen capture. An unclosed fence runs to
 * the end — the safe direction.
 */
function withoutFences(text: string): string {
    const kept: string[] = [];
    let open: { char: string; len: number } | null = null;
    for (const line of text.split('\n')) {
        const m = FENCE_OPEN.exec(line.replace(/\r$/, ''));
        if (open === null) {
            if (m !== null && !(m[1]!.startsWith('`') && (m[2] ?? '').includes('`'))) {
                open = { char: m[1]![0]!, len: m[1]!.length };
                continue;
            }
            kept.push(line);
        } else if (m !== null && m[1]![0] === open.char && m[1]!.length >= open.len && (m[2] ?? '').trim() === '') {
            open = null;
        }
    }
    return kept.join('\n');
}

/** The span of a prompt a pin may come from: the human-typed lead, pastes and fences removed. */
export function capturableText(prompt: string): string {
    if (isSyntheticPrompt(prompt)) return '';
    return withoutFences(humanAuthoredLead(stripInjectedRegions(withoutPastes(prompt))));
}

/** Control characters become spaces so a pin is one plain line wherever it is restored. */
function normalise(text: string): string {
    return text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}

/**
 * Bytes the pins occupy inside a JSON string — what the restore line actually
 * carries. Escaping never shrinks a string, so this also bounds the plain-text
 * restore block, which adds only its fixed wrapper and a `- ` per pin.
 */
function bytes(pins: readonly string[]): number {
    return pins.reduce((n, p) => n + Buffer.byteLength(JSON.stringify(p), 'utf8') - 2, 0);
}

/** Every `pin:` / `unpin:` line, in the order typed. Empty bodies are ignored. */
export function extractDirectives(prompt: string): Directive[] {
    const out: Directive[] = [];
    for (const raw of capturableText(prompt).split('\n')) {
        const line = raw.replace(/\r$/, '');
        const pin = PIN_LINE.exec(line);
        if (pin !== null) {
            const text = normalise(pin[1] ?? '');
            if (text !== '') out.push({ kind: 'pin', text });
            continue;
        }
        const unpin = UNPIN_LINE.exec(line);
        if (unpin !== null) {
            const text = normalise(unpin[1] ?? '');
            if (text !== '') out.push({ kind: 'unpin', text });
        }
    }
    return out;
}

/** Apply directives to a pin list. Pure; refusals are reported, never silently dropped. */
export function applyDirectives(current: readonly string[], directives: readonly Directive[]): ApplyResult {
    const pins = [...current];
    const added: string[] = [];
    const removed: string[] = [];
    const duplicate: string[] = [];
    const tooLong: string[] = [];
    const overCap: string[] = [];
    const overBytes: string[] = [];
    const notFound: string[] = [];
    for (const d of directives) {
        if (d.kind === 'unpin') {
            if (d.text.toLowerCase() === 'all') {
                removed.push(...pins.splice(0, pins.length));
                continue;
            }
            const i = pins.indexOf(d.text);
            if (i === -1) notFound.push(d.text);
            else removed.push(...pins.splice(i, 1));
            continue;
        }
        if ([...d.text].length > MAX_PIN_CHARS) tooLong.push(d.text);
        else if (pins.includes(d.text)) duplicate.push(d.text);
        else if (pins.length >= MAX_PINS) overCap.push(d.text);
        else if (bytes([...pins, d.text]) > MAX_PINS_BYTES) overBytes.push(d.text);
        else {
            pins.push(d.text);
            added.push(d.text);
        }
    }
    return { pins, added, removed, duplicate, tooLong, overCap, overBytes, notFound };
}

function preview(text: string): string {
    const chars = [...text];
    return chars.length > 40 ? `${chars.slice(0, 40).join('')}…` : text;
}

/** Entries named per list in a notice; the rest are counted, so a long prompt cannot grow it. */
export const NOTICE_LIST_MAX = 3;

function named(items: readonly string[]): string {
    const shown = items.slice(0, NOTICE_LIST_MAX).map((t) => `"${preview(t)}"`);
    const rest = items.length - shown.length;
    return rest > 0 ? `${shown.join(', ')} and ${rest} more` : shown.join(', ');
}

/** What the user and the model are told on the turn a directive arrives. Bounded by construction. */
export function captureNotice(r: ApplyResult): string {
    const lines: string[] = [`Session pins: ${r.pins.length}/${MAX_PINS} held.`];
    if (r.added.length > 0) lines.push(`Pinned: ${named(r.added)}.`);
    if (r.removed.length > 0) lines.push(`Unpinned: ${named(r.removed)}.`);
    if (r.duplicate.length > 0) lines.push(`Already pinned: ${named(r.duplicate)}.`);
    if (r.notFound.length > 0) lines.push(`No such pin to remove: ${named(r.notFound)}.`);
    if (r.tooLong.length > 0) {
        lines.push(`NOT pinned, over ${MAX_PIN_CHARS} characters: ${named(r.tooLong)}. Shorten and pin again.`);
    }
    if (r.overCap.length > 0) {
        lines.push(`NOT pinned, ${MAX_PINS} pins already held: ${named(r.overCap)}. Remove one with \`unpin: <text>\` first.`);
    }
    if (r.overBytes.length > 0) {
        lines.push(`NOT pinned, the held pins would exceed ${MAX_PINS_BYTES} bytes together: ${named(r.overBytes)}. Remove or shorten a pin first.`);
    }
    if (r.tooLong.length + r.overCap.length + r.overBytes.length > 0) {
        lines.push('Tell the user, in their language, which pins were refused and why.');
    }
    return lines.join('\n');
}

/** The verbatim restore block, or '' when there is nothing to restore. */
export function restoreText(pins: readonly string[]): string {
    if (pins.length === 0) return '';
    return [
        '<session-pins>',
        'Constraints the user pinned earlier in this session, restored verbatim after compaction. They still apply:',
        ...pins.map((p) => `- ${p}`),
        '</session-pins>',
    ].join('\n');
}

export function statePath(consumer_root: string, session_id: string): string {
    return path.join(consumer_root, session_state_file(STATE_DIR, session_id));
}

/** What a pin file holds: nothing yet, this session's pins, or something that must not be overwritten. */
export type PinRead = { readonly state: 'absent' | 'ok'; readonly pins: string[] } | { readonly state: 'invalid'; readonly pins: [] };

/**
 * Parse a pin file's text. Absent is an empty set; a file that does not parse,
 * belongs to another session or has no pin list is `invalid` — never read as
 * empty, because the next capture would then overwrite whatever it held.
 */
export function parsePins(raw: string | null, session_id: string): PinRead {
    if (raw === null) return { state: 'absent', pins: [] };
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { state: 'invalid', pins: [] };
    }
    const list = (parsed as { pins?: unknown } | null)?.pins;
    if (!owns_session_state(parsed, session_id) || !Array.isArray(list)) return { state: 'invalid', pins: [] };
    // Lossless or nothing: a list this module would not have written — a
    // non-string, an empty or control-character entry, one over a cap — is
    // `invalid` as a whole, so the next capture cannot persist a filtered copy.
    const kept: string[] = [];
    for (const p of list) {
        if (typeof p !== 'string' || p === '' || normalise(p) !== p || [...p].length > MAX_PIN_CHARS) {
            return { state: 'invalid', pins: [] };
        }
        kept.push(p);
    }
    if (kept.length > MAX_PINS || bytes(kept) > MAX_PINS_BYTES || new Set(kept).size !== kept.length) {
        return { state: 'invalid', pins: [] };
    }
    return { state: 'ok', pins: kept };
}

function readRaw(file: string): string | null {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
    }
}

/**
 * The pins a subagent should carry: the list, or `null` when a pin file exists
 * but cannot be read whole as this session's — which the caller reports
 * rather than treating as "no pins".
 */
export function pinsForSubagent(consumer_root: string, session_id: string): string[] | null {
    if (!has_stable_session_id(session_id)) return [];
    try {
        const read = parsePins(readRaw(statePath(consumer_root, session_id)), session_id);
        return read.state === 'invalid' ? null : read.pins;
    } catch {
        return null;
    }
}

/** This session's pins for a restore. Anything but a valid file of this session reads as none. */
export function loadPins(consumer_root: string, session_id: string): string[] {
    if (!has_stable_session_id(session_id)) return [];
    try {
        return parsePins(readRaw(statePath(consumer_root, session_id)), session_id).pins;
    } catch {
        return [];
    }
}

export function savePins(consumer_root: string, session_id: string, pins: readonly string[], now: string): void {
    const state: PinState = { session_id, pins: [...pins], updated_at: now };
    atomic_write_json(statePath(consumer_root, session_id), state);
}

/**
 * The `user_prompt_submit` half: apply this prompt's directives and return the
 * capture notice, or null when the prompt carries none. Read, apply and write
 * run under one lock on the file, so two overlapping prompts cannot drop each
 * other's change. A file that cannot be read as this session's pins is left
 * untouched and reported — the user must not believe a pin is held that is not,
 * nor lose the ones they had to a silent overwrite.
 */
export function capture(consumer_root: string, session_id: string, prompt: string, now: string): string | null {
    const directives = extractDirectives(prompt);
    if (directives.length === 0) return null;
    if (!has_stable_session_id(session_id)) {
        return 'Session pins: NOT stored — this host sent no session id, so a pin could not be restored. Tell the user.';
    }
    let notice: string | null = null;
    let invalid = false;
    const outcome = update_text_under_lock(statePath(consumer_root, session_id), (raw) => {
        const read = parsePins(raw, session_id);
        if (read.state === 'invalid') {
            invalid = true;
            return null;
        }
        const result = applyDirectives(read.pins, directives);
        notice = captureNotice(result);
        const state: PinState = { session_id, pins: [...result.pins], updated_at: now };
        return `${JSON.stringify(state, null, 2)}\n`;
    });
    if (invalid) {
        return (
            'Session pins: NOT changed — the pin file for this session is unreadable or not this session\'s, ' +
            `so it was left as it is (${STATE_DIR}). Tell the user.`
        );
    }
    if (outcome !== 'written' || notice === null) {
        return 'Session pins: NOT stored, the state write failed or the file was busy. Tell the user.';
    }
    return notice;
}

/**
 * Days a session may be inactive before its pins are removed. A pin file is
 * written only when a pin changes, so its own age says nothing about whether
 * the session is still running; the age read here is the newer of the pin file
 * and the session's `language-mirror` state, which the hook rewrites on every
 * tool call while a language is pinned. Both are keyed on the same digest of the session id. 30 days is a
 * convention, not a measurement.
 */
export const PIN_RETENTION_DAYS = 30;
const LANGUAGE_STATE_DIR = path.join('agents', 'state', 'language-mirror');

export function sessionActivityMs(consumer_root: string, pinFile: string): number {
    const own = fs.statSync(pinFile).mtimeMs;
    try {
        const peer = fs.statSync(path.join(consumer_root, LANGUAGE_STATE_DIR, path.basename(pinFile))).mtimeMs;
        return Math.max(own, peer);
    } catch {
        return own;
    }
}

export function pruneStalePins(consumer_root: string, now_ms: number): number {
    return prune_stale_session_states(path.join(consumer_root, STATE_DIR), now_ms, PIN_RETENTION_DAYS, (target) =>
        sessionActivityMs(consumer_root, target),
    );
}

/** The capture for the hook: kill switch, capture, then housekeeping. */
export function captureFor(consumer_root: string, session_id: string, prompt: string, env: NodeJS.ProcessEnv): string | null {
    if (pinsDisabled(env)) return null;
    const notice = capture(consumer_root, session_id, prompt, new Date().toISOString());
    if (notice !== null) {
        try {
            pruneStalePins(consumer_root, Date.now());
        } catch {
            // Housekeeping only; a failed prune leaves an old file, never a wrong pin.
        }
    }
    return notice;
}

/**
 * The restore for the hook: the block, '' when switched off or nothing is
 * pinned, or a notice when a pin file exists but cannot be read as this
 * session's — the marker is already consumed, so a silent '' would lose the
 * pins for this compaction without anyone knowing. A block also leaves a
 * pending marker that the next prompt settles (`followUp`), because the
 * dispatcher may still drop the line under the per-turn budget.
 */
export function restoreFor(consumer_root: string, session_id: string, env: NodeJS.ProcessEnv): string {
    if (pinsDisabled(env) || !has_stable_session_id(session_id)) return '';
    let read: PinRead;
    try {
        read = parsePins(readRaw(statePath(consumer_root, session_id)), session_id);
    } catch {
        read = { state: 'invalid', pins: [] };
    }
    if (read.state === 'invalid') return RESTORE_FAILED;
    const block = restoreText(read.pins);
    if (block !== '') {
        try {
            atomic_write_json(pendingPath(consumer_root, session_id), { session_id, at: new Date().toISOString() });
        } catch {
            // Without the marker the follow-up cannot run; the restore itself is unaffected.
        }
    }
    return block;
}

export function pendingPath(consumer_root: string, session_id: string): string {
    return statePath(consumer_root, session_id).replace(/\.json$/, '.pending');
}

/** Bytes of the transcript's tail read to find the last compaction. */
export const TRANSCRIPT_TAIL_BYTES = 4 * 1024 * 1024;

/**
 * Did a restore block reach the context after the transcript's last
 * compaction? `null` when it cannot be told — no transcript, unreadable, or no
 * boundary in the tail read.
 */
export function restoreDelivered(transcriptPath: string): boolean | null {
    let text: string;
    try {
        const fd = fs.openSync(transcriptPath, 'r');
        try {
            const size = fs.fstatSync(fd).size;
            const len = Math.min(size, TRANSCRIPT_TAIL_BYTES);
            const buf = Buffer.alloc(len);
            fs.readSync(fd, buf, 0, len, size - len);
            text = buf.toString('utf8');
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return null;
    }
    const boundary = text.lastIndexOf('"compact_boundary"');
    if (boundary === -1) return null;
    for (const line of text.slice(boundary).split('\n')) {
        if (line.includes('"hook_additional_context"') && line.includes('<session-pins>')) return true;
    }
    return false;
}

/**
 * The `user_prompt_submit` settlement of a pending restore: '' when the
 * transcript shows the block arrived, the block again when it shows it did not
 * or cannot be read — a duplicate is the cheaper failure than a lost pin. The
 * marker is consumed either way, so this runs at most once per compaction.
 */
export function followUp(consumer_root: string, session_id: string, transcriptPath: string, env: NodeJS.ProcessEnv): string {
    const pending = pendingPath(consumer_root, session_id);
    if (!fs.existsSync(pending)) return '';
    try {
        fs.rmSync(pending, { force: true });
    } catch {
        return '';
    }
    if (pinsDisabled(env)) return '';
    if (transcriptPath !== '' && restoreDelivered(transcriptPath) === true) return '';
    const read = parsePins(readRaw(statePath(consumer_root, session_id)), session_id);
    if (read.state === 'invalid') return RESTORE_FAILED;
    const block = restoreText(read.pins);
    return block === '' ? '' : `The pin restore after the last compaction did not reach this context; sent again.\n${block}`;
}

export const RESTORE_FAILED =
    'Session pins: could NOT be restored after this compaction — the pin file is unreadable or not this ' +
    "session's. Tell the user, and ask them to restate the constraints they pinned.";

/**
 * The surface `language-mirror` loads from the chunk. A function because the
 * shared chunk loader accepts a function export only.
 */
export function sessionPins(): SessionPins {
    return { captureFor, restoreFor, followUp };
}
export interface SessionPins {
    readonly captureFor: typeof captureFor;
    readonly restoreFor: typeof restoreFor;
    readonly followUp: typeof followUp;
}
~~~

## The new loader — `src/scripts/hooks/session_pins_loader.ts`

~~~ts
/**
 * Loads session pins (`_lib/session_pins.ts`) for `language-mirror` — the
 * conditional-chunk pattern of `svg_rules_loader.ts`, whose header carries the
 * reasons. The capture and the restore run on a `pin:` prompt and after a
 * compaction only, so the dispatch bundle every event loads carries this loader
 * and not the module. Null instead of a throw: a missing chunk costs the pins,
 * which the caller reports, and never the dispatch.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SessionPins } from '../_lib/session_pins.js';
import { isBundled, loadChunkExport } from './svg_rules_loader.js';

export const SESSION_PINS_CHUNK = 'session_pins.chunk.cjs';

export function sessionPinsSpecifier(selfUrl: string, bundled: boolean): string {
    const self = fileURLToPath(selfUrl);
    const dir = path.dirname(self);
    if (bundled) return path.join(dir, SESSION_PINS_CHUNK);
    return path.join(dir, '..', '_lib', `session_pins${self.endsWith('.ts') ? '.ts' : '.js'}`);
}

export function loadSessionPins(selfUrl: string = import.meta.url, bundled: boolean = isBundled()): SessionPins | null {
    let specifier: string;
    try {
        specifier = sessionPinsSpecifier(selfUrl, bundled);
    } catch {
        return null;
    }
    const api = loadChunkExport<() => SessionPins>(selfUrl, specifier, 'sessionPins', bundled);
    try {
        return api === null ? null : api();
    } catch {
        return null;
    }
}
~~~

## The diff of the existing files (one line of context)

~~~diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 7bc9321439..f100969d99 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -6,3 +6,3 @@
     "review_by": "2027-10-01",
-    "max_bytes": 1585000,
+    "max_bytes": 1587800,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
@@ -232,2 +232,21 @@
             "what_would_have_caught_it": "Nothing earlier: the growth is the contract stub builder the installed layer and the promotion share."
+        },
+        {
+            "date": "2026-11-08",
+            "from": 1585000,
+            "to": 1587800,
+            "by": "agent, feat/session-pins-phase-2 (road-to-state-and-pins-across-compaction 2.1-2.2)",
+            "what_was_added": "Session pins in `language-mirror`: the `pin:` prompt test, the kill-switch check before any load, the pin-file existence check that turns a missing chunk after a compaction into a reported failure, the per-prompt mtime touch that keeps an active session's pins out of retention, the pending-restore check that settles a budget-dropped restore on the next prompt, the call into the pin chunk on capture and after a compaction, the combined language-plus-pins restore in `_reEmitAfterCompaction`, and `hooks/session_pins_loader.ts` (+3,239 B: 1,583,938 B on origin/main to 1,587,177 B, both measured with `build:hooks` on APFS-cloned node_modules).",
+            "why_it_could_not_be_avoided": "Room was made first: the pin module itself (capture, caps, state, restore text) ships as its own chunk, which took the first measurement from +7,211 B to +3,239 B. What stays in the bundle is the part that must run on every prompt and every post-compaction tool call of the eager `language-mirror` concern: the directive test, the loader and the restore branch. Roadmap 2.2 requires the language-mirror marker path, so a lazy concern of its own was not an option.",
+            "what_would_have_caught_it": "Nothing earlier: the base headroom (1,062 B) was smaller than the loader and the restore branch together. Sized to the measurement plus 623 bytes of headroom."
+        },
+        {
+            "date": "2026-11-08",
+            "chunk": "src/scripts/hooks/subagent_constraints_hook.ts",
+            "from": 24500,
+            "to": 28500,
+            "by": "agent, feat/session-pins-phase-2 (road-to-state-and-pins-across-compaction 2.2)",
+            "what_was_added": "The parent session's pins handed to every subagent: `subagentPinsText` and the read of the pin file through `_lib/session_pins.ts` (+3,843 B: 23,843 B on origin/main to 27,686 B), including the notice a subagent gets when the pin file cannot be read.",
+            "why_it_could_not_be_avoided": "A subagent starts without the conversation its pins were typed in, and roadmap 2.2 names this carrier. The chunk imports the same reader the capture writes with, so the two cannot disagree about the file; loading the pin chunk from inside another CJS chunk has no `import.meta.url` to resolve it from.",
+            "what_would_have_caught_it": "Nothing earlier: the growth is the feature. Sized to the measurement plus about 3 %."
         }
@@ -253,2 +272,8 @@
         },
+        {
+            "entry": "src/scripts/_lib/session_pins.ts",
+            "max_bytes": 27000,
+            "registered_at": "2026-11-08",
+            "derivation": "Measured 26,251 bytes on 2026-11-08 (capture under a file lock, depth-paired paste removal, caps, lossless per-session state that is never overwritten when it cannot be read whole, a reported restore failure, the pending-restore settlement read from the session transcript's last 4 MiB, the subagent reader, activity-based retention, restore text, and the parts of `_lib/prompt_shape` and `hooks/state_io` they import). The ceiling is that reading plus about 3 %, rounded, with no growth queued. Loaded by `language-mirror` through `hooks/session_pins_loader.ts` on a prompt carrying a `pin:` or `unpin:` line and on the one tool call after a compaction; a missing chunk is reported on the capture turn and costs the pin restore, never the language restore or the dispatch."
+        },
         {
@@ -285,3 +310,3 @@
             "entry": "src/scripts/hooks/subagent_constraints_hook.ts",
-            "max_bytes": 24500,
+            "max_bytes": 28500,
             "registered_at": "2026-10-24",
diff --git a/src/config/hook-token-budget.json b/src/config/hook-token-budget.json
index 7a40295422..f2b3bbb50d 100644
--- a/src/config/hook-token-budget.json
+++ b/src/config/hook-token-budget.json
@@ -16,4 +16,4 @@
   "session-canary_reason": "full canary contract once at session_start; the per-turn beat is one line",
-  "language-mirror": 2048,
-  "language-mirror_reason": "the measured 626-wrong-turn failure class justifies a full-paragraph pin per turn",
+  "language-mirror": 5120,
+  "language-mirror_reason": "the measured 626-wrong-turn failure class justifies a full-paragraph pin per turn (at most 771 B per reply line, measured). RAISED 2048 -> 5120 on 2026-11-08 by road-to-state-and-pins-across-compaction 2.1-2.3: the same concern now carries the user's session pins, and only on two fires — the turn a prompt carries a `pin:`/`unpin:` line (the language pin plus a capture notice that names at most 3 entries per list, 40 characters each, and counts the rest) and the one tool call after a compaction (the language pin plus the pins verbatim). Every other turn is unchanged. The bound is by construction, not by sampling: pins are capped at 12 x 300 characters and 4,096 JSON-escaped bytes together (`MAX_PINS_BYTES` in `_lib/session_pins.ts`), so a restore line is at most 771 + 4,096 + the block's fixed wrapper and per-pin prefixes, about 5,090 B; the worst shapes measured were 4,562 B (restore) and 4,778 B (capture notice with every list full of 4-byte characters). Both stay under the host's 10,000-character additionalContext line.",
   "council-availability": 1536,
@@ -51,2 +51,3 @@
   "post_tool_use": 2048,
+  "post_tool_use_reason": "Per ordinary fire. ONE named exception, stated rather than hidden: the single tool call after a compaction carries the `language-mirror` restore (language pin plus session pins, at most about 5,090 B, see that row), once per compaction event — the same restore role session_start plays for the rule layer. The bench replays fixtures with no pin state, so it cannot see that fire; the runtime per-turn aggregate in `hooks/injection_budget.ts` still applies to it: beside a full prompt slot and a second post_tool_use concern at its cap the restore is kept, and only a turn that has already spent the per-turn ceiling drops it. A dropped restore is not lost: it leaves a pending marker, and the next prompt reads the session's transcript tail and sends the pins again, once, when no restore followed the last compaction or the transcript cannot be read (cases in `tests/scripts/session_pins.test.ts`). That re-send rides `user_prompt_submit`, inside the `language-mirror` row above.",
   "stop": 2048,
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index abc137a56e..904b33fbbe 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -35,2 +35,5 @@ export const HOOK_CHUNKS = Object.freeze([
     }),
+    // Required by `language-mirror` on a `pin:` prompt and after a compaction
+    // alone (`session_pins_loader.ts`).
+    Object.freeze({ entry: 'src/scripts/_lib/session_pins.ts', outfile: 'dist/hooks/session_pins.chunk.cjs' }),
     // Required by `design-pass` on a UI write alone (`design_consistency_loader.ts`).
diff --git a/src/scripts/hooks/subagent_constraints_hook.ts b/src/scripts/hooks/subagent_constraints_hook.ts
index 228fff782d..39b07f9a9e 100644
--- a/src/scripts/hooks/subagent_constraints_hook.ts
+++ b/src/scripts/hooks/subagent_constraints_hook.ts
@@ -35,2 +35,6 @@
  *
+ * Every subagent, whatever its definition, also receives the parent session's
+ * pins (`_lib/session_pins.ts`) ahead of the digest; a session without pins
+ * changes nothing here.
+ *
  * Ships in its own chunk (decision A9), `yaml` external like `chat_history`'s:
@@ -46,2 +50,3 @@ import { parse as parseYaml } from 'yaml';
 import { lawSections, ruleBody } from '../_lib/rule_law_section.js';
+import { pinsDisabled, pinsForSubagent } from '../_lib/session_pins.js';
 import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
@@ -511,4 +516,32 @@ export function digestFor(envelope: unknown, env: NodeJS.ProcessEnv = process.en
     const configDir = env['CLAUDE_CONFIG_DIR'] || path.join(os.homedir(), '.claude');
-    if (!definitionSkipsInstructions(projectDir, agentType, configDir)) return null;
-    return instructionDigest(projectDir, EMISSION_MAX_BYTES, configDir);
+    const sessionId = str(envelope, 'session_id') ?? str(payload, 'session_id');
+    const pins = pinsDisabled(env) || sessionId === null ? '' : subagentPinsText(pinsForSubagent(projectDir, sessionId));
+    if (!definitionSkipsInstructions(projectDir, agentType, configDir)) return pins === '' ? null : pins;
+    if (pins === '') return instructionDigest(projectDir, EMISSION_MAX_BYTES, configDir);
+    // Pins go first: they are the user's own words for this session, and the
+    // 12 x 300 cap keeps them far under the line ceiling, so the digest keeps
+    // the rest of the room.
+    const separator = '\n\n';
+    return pins + separator + instructionDigest(projectDir, EMISSION_MAX_BYTES - escBytes(pins + separator), configDir);
+}
+
+/**
+ * The parent session's pins, handed to every subagent it starts
+ * (road-to-state-and-pins-across-compaction 2.2) — a subagent starts without
+ * the conversation the pins were typed in, whatever its definition says.
+ */
+export function subagentPinsText(pins: readonly string[] | null): string {
+    if (pins === null) {
+        return (
+            "<session-pins>\nThe session that started you has pinned constraints, but they could not be read. " +
+            'Before any change the user might have constrained, say so and ask.\n</session-pins>'
+        );
+    }
+    if (pins.length === 0) return '';
+    return [
+        '<session-pins>',
+        'Constraints the user pinned in the session that started you. They apply to your work too:',
+        ...pins.map((p) => `- ${p}`),
+        '</session-pins>',
+    ].join('\n');
 }
diff --git a/src/scripts/language_mirror_hook.ts b/src/scripts/language_mirror_hook.ts
index bcd7f20679..413edd931c 100644
--- a/src/scripts/language_mirror_hook.ts
+++ b/src/scripts/language_mirror_hook.ts
@@ -68,2 +68,8 @@
  *
+ * SESSION PINS ride the same marker (road-to-state-and-pins-across-compaction
+ * Phase 2): a prompt line starting `pin:` is captured on this event, and the one
+ * `post_tool_use` after a compaction restores the pins with the language pin.
+ * The pin module ships as its own chunk (`hooks/session_pins_loader.ts`); its
+ * header carries the capture rules and the caps.
+ *
  * Never blocks (`fail_closed: false`, `severity: advisory`). Exit 0 always.
@@ -90,2 +96,7 @@ import {
 } from "./_lib/prompt_shape.js";
+import { loadSessionPins } from "./hooks/session_pins_loader.js";
+import type { SessionPins } from "./_lib/session_pins.js";
+
+/** How the pin module is reached; injectable because a test runner cannot `require` the TS source. */
+export type PinsLoader = () => SessionPins | null;
 
@@ -688,2 +699,4 @@ export function _reEmitAfterCompaction(
   write_json: StateWriter = atomic_write_json,
+  env: NodeJS.ProcessEnv = process.env,
+  load_pins: PinsLoader = loadSessionPins,
 ): number {
@@ -701,3 +714,4 @@ export function _reEmitAfterCompaction(
   // threshold.
-  return _withToolWriteLock(consumer_root, session_id, EXIT_ALLOW, () => {    const previous = _loadState(path.join(consumer_root, statePathFor(session_id)));
+  return _withToolWriteLock(consumer_root, session_id, EXIT_ALLOW, () => {
+    const previous = _loadState(path.join(consumer_root, statePathFor(session_id)));
     const language = previous.language as Verdict | undefined;
@@ -707,10 +721,17 @@ export function _reEmitAfterCompaction(
     _clearPinLost(consumer_root, session_id);
-    if (language !== "de" && language !== "en") {
-      return EXIT_ALLOW;
-    }
+    // Session pins ride the same marker (road-to-state-and-pins-across-compaction
+    // 2.2): one restore per compaction event, no second mechanism. They are
+    // owned by their own per-session file, so they restore even when no
+    // language is pinned.
+    // Loaded only when this session has a pin file; a missing module is then a
+    // failed restore the user is told about, never an empty one.
+    const pins =
+      pinsOff(env) || !fs.existsSync(pinFile(consumer_root, session_id))
+        ? ""
+        : (load_pins()?.restoreFor(consumer_root, session_id, env) ??
+          "Session pins: could NOT be restored after this compaction — the pin module could not be loaded. Tell the user.");
     // A foreign session's pin is not this session's to restore — same reading as
     // `nextState`, for the same shared-state reason.
-    if (!_ownsPin(previous, session_id)) {
-      return EXIT_ALLOW;
-    }
+    let restoreLanguage =
+      (language === "de" || language === "en") && _ownsPin(previous, session_id);
     // The pin is about to be fresh in context again, so the distance counter
@@ -723,6 +744,10 @@ export function _reEmitAfterCompaction(
     // the "compaction wins" invariant this file documents. Same fail-closed policy
-    // as the distance path: no durable reset, no emit.
-    if (!_resetDistance(consumer_root, previous, session_id, write_json)) {
+    // as the distance path: no durable reset, no language emit.
+    if (restoreLanguage && !_resetDistance(consumer_root, previous, session_id, write_json)) {
+      restoreLanguage = false;
+    }
+    if (!restoreLanguage && pins === "") {
       return EXIT_ALLOW;
     }
+    const lang = language as Exclude<Verdict, "und">;
     process.stdout.write(
@@ -730,4 +755,6 @@ export function _reEmitAfterCompaction(
         decision: "warn",
-        reason: noticeText(language, source),
-        additional_context: pinText(language, source),
+        reason: restoreLanguage ? noticeText(lang, source) : "Session pins restored after compaction.",
+        additional_context: [restoreLanguage ? pinText(lang, source) : "", pins]
+          .filter((part) => part !== "")
+          .join("\n\n"),
       })}\n`,
@@ -1043,5 +1070,7 @@ export function _onToolUse(
   write_json: StateWriter = atomic_write_json,
+  env: NodeJS.ProcessEnv = process.env,
+  load_pins: PinsLoader = loadSessionPins,
 ): number {
   if (_pinLost(consumer_root, session_id)) {
-    return _reEmitAfterCompaction(consumer_root, session_id, write_json);
+    return _reEmitAfterCompaction(consumer_root, session_id, write_json, env, load_pins);
   }
@@ -1050,5 +1079,15 @@ export function _onToolUse(
 
+/**
+ * A prompt that could carry a pin directive. Checked here, in the bundle, so
+ * the pin chunk is loaded for such prompts only; the chunk decides which lines
+ * count, and a missing chunk is said, never swallowed.
+ */
+const PIN_DIRECTIVE = /^(?:un)?pin:/im;
+const PINS_DIR = path.join("agents", "state", "session-pins");
+const pinsOff = (env: NodeJS.ProcessEnv): boolean => (env["AGENT_CONFIG_NO_SESSION_PINS"] ?? "").trim() === "1";
+const pinFile = (root: string, sid: string): string => path.join(root, session_state_file(PINS_DIR, sid));
+
 export function run(
   stdin_text: string,
-  options: { consumer_root: string; env?: NodeJS.ProcessEnv; write_json?: StateWriter },
+  options: { consumer_root: string; env?: NodeJS.ProcessEnv; write_json?: StateWriter; load_pins?: PinsLoader },
 ): number {
@@ -1088,3 +1127,9 @@ export function run(
   if (event === "post_tool_use") {
-    return _onToolUse(options.consumer_root, _sessionId(envelope), options.write_json);
+    return _onToolUse(
+      options.consumer_root,
+      _sessionId(envelope),
+      options.write_json,
+      options.env ?? process.env,
+      options.load_pins ?? loadSessionPins,
+    );
   }
@@ -1156,5 +1201,53 @@ export function run(
 
+  // Session pins (road-to-state-and-pins-across-compaction 2.1): captured from
+  // this prompt's `pin:` lines only. The notice is emitted on the turn a
+  // directive arrives and never otherwise — no standing bytes.
+  // A missing module is told apart from a prompt whose `pin:` lines were all
+  // excluded (fenced, pasted) or switched off: only the first is a failure.
+  const env = options.env ?? process.env;
+  const pinModule = PIN_DIRECTIVE.test(prompt) && !pinsOff(env) ? (options.load_pins ?? loadSessionPins)() : undefined;
+  // A restore that may have been dropped under the per-turn budget is settled
+  // on the next prompt, from the session's own transcript (`followUp`).
+  let pinFollowUp = "";
+  if (stateful && !pinsOff(env) && fs.existsSync(`${pinFile(options.consumer_root, session_id).slice(0, -5)}.pending`)) {
+    const transcript = typeof payload["transcript_path"] === "string" ? payload["transcript_path"] : "";
+    try {
+      pinFollowUp = (options.load_pins ?? loadSessionPins)()?.followUp(options.consumer_root, session_id, transcript, env) ?? "";
+    } catch {
+      pinFollowUp = "";
+    }
+  }
+  // Every substantive prompt marks the pins as belonging to a live session, so
+  // retention measures activity even when no language is pinned.
+  if (stateful && !is_replay_mode()) {
+    try {
+      const now = new Date();
+      fs.utimesSync(pinFile(options.consumer_root, session_id), now, now);
+    } catch {
+      // No pin file — nothing to keep alive.
+    }
+  }
+  const pinNotice =
+    pinModule === undefined
+      ? null
+      : pinModule === null
+        ? "Session pins: NOT stored, the pin module could not be loaded. Tell the user."
+        : pinModule.captureFor(options.consumer_root, session_id, prompt, env);
+  const pinText_ = [pinNotice ?? "", pinFollowUp].filter((t) => t !== "").join("\n\n");
+  const pinOut = pinText_ === "" ? null : pinText_;
+
   if (effective === "de" || effective === "en") {
+    const context = pinText(effective, effectiveSource);
+    process.stdout.write(
+      `${JSON.stringify({
+        decision: "warn",
+        reason: noticeText(effective, effectiveSource),
+        additional_context: pinOut === null ? context : `${context}\n\n${pinOut}`,
+      })}\n`,
+    );
+    return EXIT_WARN;
+  }
+  if (pinOut !== null) {
     process.stdout.write(
-      `${JSON.stringify({ decision: "warn", reason: noticeText(effective, effectiveSource), additional_context: pinText(effective, effectiveSource) })}\n`,
+      `${JSON.stringify({ decision: "warn", reason: "Session pins updated.", additional_context: pinOut })}\n`,
     );
~~~

## Tests

`tests/scripts/session_pins.test.ts`, 72 tests, all green; names omitted to fit
the prompt cap. Every fix above was neutralised once and the suite went red.
