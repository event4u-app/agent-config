<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-11-09 for the ratification of
     branch feat/session-pins-phase-2 (round 48), committed verbatim beside the record. -->

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

A line the user types starting `pin: <text>` (column zero, outside fences,
pastes and injected regions) sets a session constraint; `unpin: <text>` /
`unpin: all` removes. `language-mirror` captures on `user_prompt_submit`,
stores per session, and after a compaction restores the stored pins once
(tool call or first prompt, whichever comes first) plus one restatement on the
next prompt; `subagent-constraints` hands them to every subagent.
Caps 12 × 300 characters, 4,096 escaped bytes; refusals named, never
truncated. Scope beyond pins, stated here because it is easy to miss: the
existing LANGUAGE restore changes too, with or without pins and with the pin
kill switch set — its pin-lost marker is taken by an atomic rename before the
restore runs, and a marker that cannot be taken is reported and not acted on
(`main` removed it silently and re-fired on every tool call if removal kept
failing). Kill switch `AGENT_CONFIG_NO_SESSION_PINS=1`. The pin module is a
lazy chunk.

Budget rows, exactly as the diff sets them: dispatch bundle 1,585,000 →
1,594,300 B (measured 1,593,935, +9,997 over origin/main); new pin chunk row
34,200 B (measured 33,166); subagent-constraints chunk 24,500 → 28,500 B
(measured 27,964); `language-mirror` injection row 2,048 → 6,144 B (worst
computed line 5,879 B), with a stated exception on the `post_tool_use` slot
row for the one restore fire per compaction.

## Rounds 1–46

Fixed earlier with mutation-checked tests; visible in the module below.
Round 43 led to the simplified restore protocol (claim recovery, its ledger and
the prompt fallback counter removed; at most three pin lines per compaction,
regression test "the whole bound"). Rounds 44–46: openers on a directive line
whose closer stands later refuse the directive; a linear attributed-opener
check; no restore in replay; the pin-lost marker taken by an atomic rename; an
unreadable restore record is acted on by nothing; a record whose `seen` is
over its window or holds non-stamps is invalid.

## Round 47 and what changed

1. **One admission rule for every stamp.** `admitStamp` in
   `_lib/session_pins_record.ts` (the module the reader lives in) trims a stamp
   and reads one over `STAMP_MAX_CHARS` (200) as unknown (''), with a stderr
   line. It is applied at every point a stamp enters: the chunk's boundary read
   (`readBoundary`, used by `followUp`), the tool-call restore's marker stamp
   (`restoreFor`, before the transition and its own decision), and the bundle's
   boundary read that decides whether the prompt path loads the chunk. An
   unknown stamp opens nothing on the prompt path and is never written into
   `seen`; on the tool path it counts as open, as before. So no stamp the
   reader would refuse can reach the record.
   Tests: (a) a settled compaction followed by a 201-character boundary — four
   prompts, plus a direct `followUp` call each time, emit no pin line, and the
   record stays valid after each; (b) a 201-character marker stamp is restored
   as unknown, never written into `seen`, and the owed restatement still
   arrives; (c) a 20-step mixed sequence of compactions, oversized and empty
   boundaries, tool calls and prompts leaves a valid record after every step.
   All seen red first; (a) is mutation-checked against removing the chunk's
   admission alone (the direct `followUp` call catches it).
2. **Duplicate stamps.** A `seen` holding one stamp twice is invalid. Writers
   never write one (a stamp is appended only when absent).
3. **Pin-chunk headroom** restored to about 3 % as its derivation states:
   34,200 B for 33,166 B measured.
4. **Not changed:** stderr for an unreadable record repeats per prompt (no
   model-context emission; a sentinel suppressing it could also suppress
   recovery); a `pre_compact` writer-side length check (the stamp is generated
   in-process, ~45 characters; every reader now admits it).

## Delivery boundary — the evidence, kept from earlier rounds

Delivery is bounded best-effort, not exactly-once: the bound counts emitted
attempts, not lines the user is guaranteed to see.

*(a)* In production `language-mirror` runs in-process inside the dispatcher,
which captures `process.stdout.write` synchronously
(`src/scripts/hooks/dispatch_hook.ts`, `_run_concern_inproc`).

*(b)* The dispatcher's own write is followed by `process.exit(main(...))`.
Measured (darwin, Node v26.7.0), writing N bytes to a pipe and exiting at
once: 10,000 B and 60,000 B arrive whole; 200,000 B → 65,536 received. One
hook line here is bounded by the 6,144 B row.

*(c)* A hook or dispatcher dying after the record committed loses that line;
pins are restated by the next prompt, the language pin by the existing
distance trigger. A process dying after taking the marker and before
recording loses the tool-call restore; the prompt path still opens the
compaction from the boundary file.

## The new module — `src/scripts/_lib/session_pins.ts`

~~~ts
/**
 * Session pins — constraints the user set in a session, restored verbatim after
 * a compaction (road-to-state-and-pins-across-compaction Phase 2).
 *
 * A pin is a line starting with `pin:` at column zero in the human-authored
 * part of a `user_prompt_submit` text; `unpin:` removes one. No model decides
 * what is a pin (decision L1). Tool output and file content never reach that
 * event. What the event does carry besides the user's words — host-injected
 * regions, pastes, subagent messages — is excluded by recognising its framing:
 * fenced code, pasted blocks, own-line host regions, and everything from the
 * first line that contains anything tag-like or reads as a pasted document.
 * That is an inference from framing, not authentication: the guarantee is that
 * text in a recognised host framing can neither add nor delete a pin.
 *
 * Bounded at {@link MAX_PINS} × {@link MAX_PIN_CHARS}. A pin over either limit
 * is refused and the user is told which one; nothing is truncated.
 */
import fs from 'node:fs';
import path from 'node:path';

import {
    has_stable_session_id,
    is_replay_mode,
    owns_session_state,
    prune_stale_session_states,
    session_state_file,
    update_text_under_lock,
} from '../hooks/state_io.js';
import { humanAuthoredLead, isSyntheticPrompt } from './prompt_shape.js';
import { admitStamp, presentButUnread, readRestoreRecord, SEEN_MAX } from './session_pins_record.js';

export const MAX_PINS = 12;
export const MAX_PIN_CHARS = 300;
/**
 * Bytes the held pins may occupy together, counted as JSON-escaped UTF-8. 12 pins of 300
 * plain ASCII characters fit (3,600 B), so the 12 x 300 promise holds as stated for
 * text that needs no escaping; quotes and backslashes count two bytes each and
 * non-ASCII characters two to four, so a set heavy in either reaches this first
 * and the user is told. Without it
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

// `[\s\S]*`, not `.*`: `.` stops at \r, U+2028 and U+2029, which would drop the
// rest of the line without a refusal. `normalise` turns them into spaces.
const PIN_LINE = /^pin:[ \t]*([\s\S]*)$/i;
const UNPIN_LINE = /^unpin:[ \t]*([\s\S]*)$/i;
/**
 * Markup inside a directive's own text that only a host envelope produces: a
 * closing tag, or an opener carrying attributes. `Array<string>` is neither.
 * Such a line is not applied — typed and injected text cannot be told apart on
 * it — and is counted, so the turn says so.
 */
function inlineEnvelope(line: string): boolean {
    if (/<\/[A-Za-z]/.test(line)) return true;
    // `<name`, whitespace, then `=` before the next `>`: read from where the next
    // `=` and `>` stand (one right-to-left pass), so a line of unclosed openers
    // stays linear instead of rescanning its tail once per opener.
    const nextEq: number[] = new Array<number>(line.length + 1);
    const nextGt: number[] = new Array<number>(line.length + 1);
    nextEq[line.length] = Infinity;
    nextGt[line.length] = Infinity;
    for (let i = line.length - 1; i >= 0; i--) {
        nextEq[i] = line[i] === '=' ? i : (nextEq[i + 1] as number);
        nextGt[i] = line[i] === '>' ? i : (nextGt[i + 1] as number);
    }
    for (const m of line.matchAll(/<[A-Za-z][\w:-]*(?=\s)/g)) {
        const after = (m.index ?? 0) + m[0].length;
        if ((nextEq[after] as number) < (nextGt[after] as number)) return true;
    }
    return false;
}
/**
 * An opener (`<system-reminder>`, `<agent-message >`, or `<agent-message` whose
 * attributes start on the next line) on a directive line whose closer stands
 * on a later line is an envelope too: the host began a region mid-line. Read
 * from where each closer name last occurs, one pass over the prompt, so the
 * check stays linear; a bare opener nothing closes later (`<b>`) stays text.
 */
const BARE_OPENER = /<([A-Za-z][\w:-]*)(?=[\s>]|$)/g;
const CLOSER = /<\/([A-Za-z][\w:-]*)/g;

function lastCloserAt(prompt: string): Map<string, number> {
    const last = new Map<string, number>();
    for (const m of prompt.matchAll(CLOSER)) last.set((m[1] ?? '').toLowerCase(), m.index ?? 0);
    return last;
}

/** Lines (by index) whose directive text carries host framing; `lines` are the prompt's own. */
function envelopedLines(prompt: string, lines: readonly string[]): boolean[] {
    if (!lines.some(isDirectiveLine)) return lines.map(() => false);
    const closers = lastCloserAt(prompt);
    let offset = 0;
    return lines.map((line) => {
        const end = offset + line.length;
        offset = end + 1;
        if (!isDirectiveLine(line)) return false;
        if (inlineEnvelope(line)) return true;
        for (const m of line.matchAll(BARE_OPENER)) {
            if ((closers.get((m[1] ?? '').toLowerCase()) ?? -1) > end) return true;
        }
        return false;
    });
}
const PASTE_NAME = /^<(\/?)pasted_content(?=[\s>\/])/i;
// A line that is `<name`, anything, and a final `>`: no attribute grammar to
// get wrong, so a quoted `>` inside an attribute cannot hide an opener.
const REGION_LINE = /^\s*<(\/?)([A-Za-z][\w-]*)(?:\s.*)?>\s*$/;

export function pinsDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return (env[KILL_SWITCH] ?? '').trim() === '1';
}

/**
 * Character spans of pasted blocks in the original text, tags paired by depth.
 * An opener that never closes runs to the end; a closer with no opener covers
 * everything before it. Both are the safe reading.
 */
function pasteSpans(text: string): Array<readonly [number, number]> {
    const spans: Array<readonly [number, number]> = [];
    let depth = 0;
    let start = 0;
    let gt = -1;
    // Forward-only: each `<` is looked at once and the next `>` is found once
    // per stretch, so malformed openers with no `>` cost linear time.
    for (let lt = text.indexOf('<'); lt !== -1; lt = text.indexOf('<', lt + 1)) {
        if (gt < lt) gt = text.indexOf('>', lt);
        if (gt === -1) break;
        const m = PASTE_NAME.exec(text.slice(lt, Math.min(gt + 1, lt + 32)));
        if (m === null) continue;
        const end = gt + 1;
        if (m[1] === '/') {
            if (depth === 0) spans.push([0, end]);
            else if (--depth === 0) spans.push([start, end]);
        } else if (depth++ === 0) {
            start = lt;
        }
        lt = gt;
    }
    if (depth > 0) spans.push([start, text.length]);
    return spans;
}

/**
 * Lines inside fenced code, delimiters included, with CommonMark pairing: a
 * fence closes only on the same character, at least as long as the opener,
 * followed by nothing but spaces and tabs. An unclosed fence runs to the end.
 */
/**
 * A fence delimiter, read by a prefix scan rather than a regex: up to three
 * spaces, then a run of three or more backticks or tildes, then the rest. A
 * regex with a greedy run followed by `(.*)` backtracks quadratically when the
 * rest holds a line terminator `.` does not match; this cannot.
 */
function fenceOf(line: string): { readonly char: string; readonly len: number; readonly rest: string } | null {
    let i = 0;
    while (i < 3 && line[i] === ' ') i++;
    const char = line[i];
    if (char !== '`' && char !== '~') return null;
    let j = i;
    while (line[j] === char) j++;
    return j - i >= 3 ? { char, len: j - i, rest: line.slice(j) } : null;
}

function fencedLines(lines: readonly string[]): boolean[] {
    const out = lines.map(() => false);
    let open: { char: string; len: number } | null = null;
    lines.forEach((raw, i) => {
        const f = fenceOf(raw.replace(/\r$/, ''));
        if (open === null) {
            if (f !== null && !(f.char === '`' && f.rest.includes('`'))) {
                open = { char: f.char, len: f.len };
                out[i] = true;
            }
        } else {
            out[i] = true;
            if (f !== null && f.char === open.char && f.len >= open.len && /^[ \t]*$/.test(f.rest)) open = null;
        }
    });
    return out;
}

/**
 * Lines inside host-injected regions: a line that is nothing but an opening tag
 * (bare or with attributes, e.g. `<agent-message from="worker">`) opens one, a
 * line that is nothing but its closing tag closes it. One pass with a stack per
 * tag name, so every opener gets its own span independently — nesting and
 * overlap of different names cannot hide one another — and an opener that never
 * closes covers everything after it. Linear in the number of lines.
 */
function regionLines(lines: readonly string[]): boolean[] {
    const marks = new Array<number>(lines.length + 1).fill(0);
    const open = new Map<string, number[]>();
    lines.forEach((line, i) => {
        const m = REGION_LINE.exec(line);
        if (m === null) return;
        // An element that closes on its own line (`<b>x</b>`, `<br/>`) opens nothing.
        // Only a closer that ENDS the line counts: one inside an attribute value
        // (`note="</agent-message>"`) must not make an opener look self-contained.
        if (m[1] !== '/' && (line.trimEnd().toLowerCase().endsWith(`</${m[2]!.toLowerCase()}>`) || /\/>\s*$/.test(line))) return;
        const stack = open.get(m[2]!) ?? [];
        if (m[1] === '/') {
            const from = stack.pop();
            if (from !== undefined) {
                marks[from]! += 1;
                marks[i + 1]! -= 1;
            }
        } else {
            stack.push(i);
            open.set(m[2]!, stack);
        }
    });
    for (const stack of open.values()) {
        for (const from of stack) {
            marks[from]! += 1;
            marks[lines.length]! -= 1;
        }
    }
    let depth = 0;
    return lines.map((_, i) => (depth += marks[i]!) > 0);
}

/**
 * The span of a prompt a pin may come from. Every exclusion — fenced code,
 * pasted blocks, injected regions — is computed on the ORIGINAL text, and a
 * line is eligible only if it overlaps none of them and lies before the first
 * pasted document (`humanAuthoredLead`). Nothing is removed before anything else
 * is recognised, so no filter can delete another's delimiters and let text out,
 * whatever the order or overlap of the wrappers. Excluded lines come back empty.
 */
export function capturableText(prompt: string): string {
    if (isSyntheticPrompt(prompt)) return '';
    const lines = prompt.split('\n');
    const pastes = pasteSpans(prompt);
    const fenced = fencedLines(lines);
    const regions = regionLines(lines);
    // Characters covered by a paste, as a prefix sum: one pass, so a line's
    // overlap with any paste is a constant-time lookup.
    const cover = new Array<number>(prompt.length + 1).fill(0);
    for (const [a, b] of pastes) {
        cover[a]! += 1;
        cover[b]! -= 1;
    }
    const covered = new Array<number>(prompt.length + 1).fill(0);
    for (let k = 0, depth = 0; k < prompt.length; k++) {
        depth += cover[k]!;
        covered[k + 1] = covered[k]! + (depth > 0 ? 1 : 0);
    }
    const insidePaste = (k: number): boolean => covered[k + 1]! - covered[k]! > 0;
    let offset = 0;
    const pasted = lines.map((line) => {
        const start = offset;
        const end = start + line.length;
        offset = end + 1;
        return start === end ? start < prompt.length && insidePaste(start) : covered[end]! - covered[start]! > 0;
    });
    const masked = lines.map((line, i) => (fenced[i] || regions[i] || pasted[i] ? '' : line));
    // The lead ends at the first line that CONTAINS something tag-like — `<`
    // then a letter, `/`, `!` or `?`, at any column — and is not inside a closed
    // host region or a paste, judged on the original text (a fenced line counts
    // too), or at the first remaining line that reads as a pasted document. No
    // tag grammar has to be right: a multi-line, malformed or mid-line envelope
    // opener still contains `<name`, so nothing after it can be a pin. The cost
    // is that prose such as `Array<string>` also ends the lead; pins typed
    // before it still count.
    const tagStart = lines.findIndex((line, i) => !regions[i] && !pasted[i] && /<[A-Za-z/!?]/.test(line));
    // A directive's own text may contain `<` (`pin: keep Array<string>`): that
    // line still counts, and the lead ends after it, so anything an opener on it
    // could start is still excluded.
    const tagEnd =
        tagStart !== -1 && masked[tagStart] !== '' && isDirectiveLine(masked[tagStart]!) ? tagStart + 1 : tagStart;
    const docHead = masked.findIndex((line) => line !== '' && humanAuthoredLead(line) === '');
    const ends = [tagEnd, docHead].filter((k) => k !== -1);
    const cutoff = ends.length === 0 ? -1 : Math.min(...ends);
    return (cutoff === -1 ? masked : masked.slice(0, cutoff)).join('\n');
}

/**
 * Control characters become spaces so a pin is one plain line wherever it is
 * restored: a newline inside a pin would otherwise start a line of its own in
 * the restore block, read as a separate instruction.
 */
function normalise(text: string): string {
    // Lone surrogates become U+FFFD: they would serialise as six-byte escapes,
    // past the four bytes per character every bound here is derived from.
    return text
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD')
        .replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]/g, ' ')
        .trim();
}

/**
 * Bytes the pins occupy inside a JSON string — what the restore line actually
 * carries. Escaping never shrinks a string, so this also bounds the plain-text
 * restore block, which adds only its fixed wrapper and a `- ` per pin.
 */
function bytes(pins: readonly string[]): number {
    return pins.reduce((n, p) => n + Buffer.byteLength(JSON.stringify(p), 'utf8') - 2, 0);
}

function isDirectiveLine(line: string): boolean {
    const l = line.replace(/\r$/, '');
    return PIN_LINE.test(l) || UNPIN_LINE.test(l);
}

/**
 * `pin:` / `unpin:` lines at column zero that capture did NOT read because of
 * where they stand — after a code block, a paste, a tag-like line or a heading,
 * where typed and injected text cannot be told apart. Counted so the turn can
 * say so: a directive that vanishes without a word is the failure the caps'
 * refusals exist to prevent.
 */
export function ignoredDirectiveCount(prompt: string): number {
    // A prompt read as synthetic as a whole captures nothing; its directive lines
    // are still counted, so a typed line after a host prefix is not lost silently.
    if (isSyntheticPrompt(prompt)) return prompt.split('\n').filter((line) => isDirectiveLine(line)).length;
    const eligible = capturableText(prompt).split('\n');
    const lines = prompt.split('\n');
    const enveloped = envelopedLines(prompt, lines);
    return lines.filter((line, i) => isDirectiveLine(line) && (eligible[i] !== line || enveloped[i])).length;
}

/** Every `pin:` / `unpin:` line, in the order typed. Empty bodies are ignored. */
export function extractDirectives(prompt: string): Directive[] {
    const out: Directive[] = [];
    const enveloped = envelopedLines(prompt, prompt.split('\n'));
    for (const [i, raw] of capturableText(prompt).split('\n').entries()) {
        const line = raw.replace(/\r$/, '');
        if (enveloped[i] === true) continue;
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

/** Code points a brief notice shows of a refused pin. */
const BRIEF_PREVIEW = 20;

function preview(text: string, max = 40): string {
    const chars = [...text];
    return chars.length > max ? `${chars.slice(0, max).join('')}…` : text;
}

/** Entries named per list in a notice; the rest are counted, so a long prompt cannot grow it. */
export const NOTICE_LIST_MAX = 3;

function named(items: readonly string[]): string {
    const shown = items.slice(0, NOTICE_LIST_MAX).map((t) => `"${preview(t)}"`);
    const rest = items.length - shown.length;
    return rest > 0 ? `${shown.join(', ')} and ${rest} more` : shown.join(', ');
}

/** What the user and the model are told on the turn a directive arrives. Bounded by construction. */
export function captureNotice(r: ApplyResult, brief = false): string {
    const lines: string[] = [`Session pins: ${r.pins.length}/${MAX_PINS} held.`];
    // Brief when a restatement follows in the same line: it lists the held set,
    // so only what was refused still needs naming, and the line stays bounded.
    if (!brief) {
        if (r.added.length > 0) lines.push(`Pinned: ${named(r.added)}.`);
        if (r.removed.length > 0) lines.push(`Unpinned: ${named(r.removed)}.`);
        if (r.duplicate.length > 0) lines.push(`Already pinned: ${named(r.duplicate)}.`);
        if (r.notFound.length > 0) lines.push(`No such pin to remove: ${named(r.notFound)}.`);
    }
    if (brief) {
        const counts = [
            r.tooLong.length > 0 ? `${r.tooLong.length} over ${MAX_PIN_CHARS} characters` : '',
            r.overCap.length > 0 ? `${r.overCap.length} over the ${MAX_PINS}-pin cap` : '',
            r.overBytes.length > 0 ? `${r.overBytes.length} over ${MAX_PINS_BYTES} bytes together` : '',
        ].filter((c) => c !== '');
        if (counts.length > 0) {
            const refused = [...r.tooLong, ...r.overCap, ...r.overBytes];
            const shown = refused.slice(0, NOTICE_LIST_MAX).map((t) => `"${preview(t, BRIEF_PREVIEW)}"`);
            const rest = refused.length - shown.length;
            lines.push(`NOT pinned: ${counts.join(', ')} — ${shown.join(', ')}${rest > 0 ? ` and ${rest} more` : ''}.`);
        }
    } else {
        if (r.tooLong.length > 0) {
            lines.push(`NOT pinned, over ${MAX_PIN_CHARS} characters: ${named(r.tooLong)}. Shorten and pin again.`);
        }
        if (r.overCap.length > 0) {
            lines.push(`NOT pinned, ${MAX_PINS} pins already held: ${named(r.overCap)}. Remove one with \`unpin: <text>\` first.`);
        }
        if (r.overBytes.length > 0) {
            lines.push(`NOT pinned, the held pins would exceed ${MAX_PINS_BYTES} bytes together: ${named(r.overBytes)}. Remove or shorten a pin first.`);
        }
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
    // `invalid` as a whole. Filtering it instead would let the next capture
    // persist the shorter list and silently drop the entries it skipped.
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

/** True when `file` exists (or cannot even be checked) — so a `null` read was a failure, not absence. */
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


/** A direct write for callers that set the whole list — the test suite's seam. Capture never uses it. */
export function savePins(consumer_root: string, session_id: string, pins: readonly string[], now: string): void {
    const state: PinState = { session_id, pins: [...pins], updated_at: now };
    const outcome = update_text_under_lock(statePath(consumer_root, session_id), () => `${JSON.stringify(state, null, 2)}\n`, {
        strict: true,
    });
    if (outcome !== 'written') throw new Error(`session-pins: write ${outcome}`);
}

/**
 * The `user_prompt_submit` half: apply this prompt's directives and return the
 * capture notice, or null when the prompt carries none. Read, apply and write
 * run under one lock on the file, so two overlapping prompts cannot drop each
 * other's change. A file that cannot be read as this session's pins is left
 * untouched and reported — the user must not believe a pin is held that is not,
 * nor lose the ones they had to a silent overwrite.
 */
export function capture(consumer_root: string, session_id: string, prompt: string, now: string, brief = false): string | null {
    const ignored = ignoredDirectiveCount(prompt);
    const ignoredLine =
        ignored === 0
            ? ''
            : isSyntheticPrompt(prompt)
              ? `Session pins: ${ignored} pin:/unpin: line(s) in this host-generated prompt were NOT applied — only a prompt the user ` +
                'typed can set a pin. If the user meant them, tell them to type them in a message of their own.'
              : `Session pins: ${ignored} pin:/unpin: line(s) in this prompt were NOT applied — they come after a code block, a paste, ` +
                'a tag-like line or a heading, or carry markup inside them, where injected text cannot be told apart. Tell the user to ' +
                'type them on a line of their own before such content.';
    const directives = extractDirectives(prompt);
    if (directives.length === 0) return ignoredLine === '' ? null : ignoredLine;
    const notice = captureDirectives(consumer_root, session_id, directives, now, brief);
    return ignoredLine === '' ? notice : `${notice}\n${ignoredLine}`;
}

function captureDirectives(
    consumer_root: string,
    session_id: string,
    directives: readonly Directive[],
    now: string,
    brief: boolean,
): string {
    if (!has_stable_session_id(session_id)) {
        return 'Session pins: NOT stored — this host sent no session id, so a pin could not be restored. Tell the user.';
    }
    let notice: string | null = null;
    let invalid = false;
    const file = statePath(consumer_root, session_id);
    const outcome = update_text_under_lock(file, (raw) => {
        // The shared locked reader passes `null` for an unreadable file as well
        // as for an absent one; only a file that is really absent may start
        // empty, so anything else is checked here, inside the lock.
        const read = raw === null && presentButUnread(file) ? ({ state: 'invalid', pins: [] } as PinRead) : parsePins(raw, session_id);
        if (read.state === 'invalid') {
            invalid = true;
            return null;
        }
        const result = applyDirectives(read.pins, directives);
        notice = captureNotice(result, brief);
        const state: PinState = { session_id, pins: [...result.pins], updated_at: now };
        return `${JSON.stringify(state, null, 2)}\n`;
    }, { strict: true });
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
    let own: number;
    try {
        own = fs.statSync(pinFile).mtimeMs;
    } catch {
        // Cannot tell how old it is: treat it as active rather than prune on a guess.
        return Date.now();
    }
    try {
        const peer = fs.statSync(path.join(consumer_root, LANGUAGE_STATE_DIR, path.basename(pinFile))).mtimeMs;
        return Math.max(own, peer);
    } catch {
        return own;
    }
}

/** A prune runs on a capture, at most once a day per checkout; a stamp file's mtime says when the last one ran. */
export const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function pruneStalePins(consumer_root: string, now_ms: number): number {
    const stamp = path.join(consumer_root, STATE_DIR, '.last-prune');
    try {
        if (now_ms - fs.statSync(stamp).mtimeMs < PRUNE_INTERVAL_MS) return 0;
    } catch (err) {
        // No stamp yet: prune now. Any other failure: do not prune on a guess, and say so.
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            process.stderr.write(`session-pins: retention prune skipped, its stamp is unreadable (${String(err).slice(0, 120)})\n`);
            return 0;
        }
    }
    try {
        fs.mkdirSync(path.dirname(stamp), { recursive: true });
        fs.writeFileSync(stamp, '');
    } catch {
        // A stamp that cannot be written only means the next capture prunes again.
    }
    const dir = path.join(consumer_root, STATE_DIR);
    // A companion `.json` (the restore record) lives as long as its session's
    // pin file is active; on its own mtime alone it would go while the session
    // still compacts, and a forgotten stamp could reopen an old compaction.
    let removed = prune_stale_session_states(dir, now_ms, PIN_RETENTION_DAYS, (target) => {
        const own = sessionActivityMs(consumer_root, target);
        const digest = /^([0-9a-f]{32})\.(?!json$)/.exec(path.basename(target))?.[1];
        const pinFile = digest === undefined ? '' : path.join(dir, `${digest}.json`);
        return pinFile !== '' && fs.existsSync(pinFile) ? Math.max(own, sessionActivityMs(consumer_root, pinFile)) : own;
    });
    // The boundary and lock sentinels are not `.json`, so the
    // pass above leaves them; each goes once its session's pin file is gone and
    // it is itself past retention.
    const cutoff = now_ms - PIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let names: string[] = [];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return removed;
    }
    for (const name of names) {
        const digest = /^([0-9a-f]{32})\./.exec(name)?.[1];
        if (digest === undefined || name === `${digest}.json` || fs.existsSync(path.join(dir, `${digest}.json`))) continue;
        const file = path.join(dir, name);
        try {
            if (fs.statSync(file).mtimeMs < cutoff) {
                fs.rmSync(file, { force: true });
                removed += 1;
            }
        } catch {
            // Housekeeping only.
        }
    }
    return removed;
}

/** The capture for the hook: kill switch, capture, then housekeeping. */
export function captureFor(
    consumer_root: string,
    session_id: string,
    prompt: string,
    env: NodeJS.ProcessEnv,
    brief = false,
): string | null {
    // A replayed event never changes live state, and must not claim it tried.
    if (pinsDisabled(env) || is_replay_mode()) return null;
    const notice = capture(consumer_root, session_id, prompt, new Date().toISOString(), brief);
    if (notice !== null) {
        try {
            pruneStalePins(consumer_root, Date.now());
        } catch (err) {
            // Housekeeping only; a failed prune leaves an old file, never a wrong pin.
            process.stderr.write(`session-pins: retention prune failed (${String(err).slice(0, 120)})\n`);
        }
    }
    return notice;
}

/**
 * Restore state of one session, one record, changed only under the per-file
 * lock: was the latest opened compaction's restore delivered, is one
 * restatement still owed to a prompt, and which compaction stamps have been
 * acknowledged (the most recent {@link SEEN_MAX} — the guarantees below hold
 * within that window).
 *
 * `pre_compact` writes one unique stamp to two places, each with its own
 * atomic write (the pair is not atomic, and the protocol does not need it to
 * be): `language-mirror`'s pin-lost marker, which the tool-call restore reads
 * before clearing it, and `.boundary`, which the prompt path reads. This module
 * deletes neither. An event's stamp opens a compaction only if it has never
 * been acknowledged — a set, not a single value, so a stale or older stamp
 * (a paused prompt, or `.boundary` still holding the previous stamp after its
 * write failed) can neither reopen its compaction nor displace a newer one. No
 * clock, no ordering. A second tool restore with the same stamp finds it
 * acknowledged; an unreadable or empty boundary is unknown, not open.
 */
interface RestoreState {
    readonly session_id: string;
    readonly delivered: boolean;
    readonly pending: boolean;
    readonly seen: readonly string[];
}

export { SEEN_MAX };

export function restorePath(consumer_root: string, session_id: string): string {
    return statePath(consumer_root, session_id).replace(/\.json$/, '.restore.json');
}

export function boundaryPath(consumer_root: string, session_id: string): string {
    return statePath(consumer_root, session_id).replace(/\.json$/, '.boundary');
}

type Decision = 'deliver' | 'restate' | 'none';
type Open = { readonly delivered: boolean; readonly pending: boolean };

/** The boundary's stamp, or '' when absent, empty or unreadable — shared reading with the bundle. */
function readBoundary(file: string): string {
    try {
        return admitStamp(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            process.stderr.write(`session-pins: compaction boundary unreadable (${String(err).slice(0, 120)})\n`);
        }
        return '';
    }
}

/**
 * Apply one event to the record under the lock and return what to emit:
 * `null` when the lock could not be had or the record exists but cannot be
 * read, otherwise the decision and the pin
 * block read INSIDE the transaction, so what is acknowledged is the snapshot
 * that is sent. A capture committing in parallel (another file, another lock)
 * may change the pins after that read; the restore then shows the earlier
 * state and the capture's own notice shows the change.
 * An unreadable pin file is handled like any block: its failure notice is what
 * gets delivered and recorded, so it is said at most as often as the pins are.
 *
 * `stamp` names the compaction the event belongs to ('' when it names none).
 * A stamp never acknowledged opens the compaction fresh and joins the set in
 * the same write. An unparseable record, or one of another
 * session, counts as open: a duplicate is the cheaper failure than a loss.
 */
function transition(
    consumer_root: string,
    session_id: string,
    stamp: string,
    decide: (current: Open | null) => { next: Open | null; decision: Decision },
): { decision: Decision; block: string } | null {
    let decision: Decision = 'none';
    let block = '';
    let unreadable = false;
    const file = restorePath(consumer_root, session_id);
    const outcome = update_text_under_lock(file, (raw) => {
        // A record that exists but cannot be read is not an absent one: read as
        // absent, its acknowledged stamps would vanish and a settled compaction
        // would reopen. Nothing is decided or written; the caller reports it.
        if (raw === null && presentButUnread(file)) {
            unreadable = true;
            return null;
        }
        block = currentBlock(consumer_root, session_id);
        const read = readRestoreRecord(raw, session_id);
        const invalid = read === 'invalid';
        const stored: RestoreState | null = read === null || read === 'invalid' ? null : { session_id, ...read };
        const seen = stored?.seen ?? [];
        // Opening needs a compaction signal: a broken record never injects pins
        // on its own, it only stops a stamp from counting as acknowledged.
        const opens = stamp !== '' && (invalid || !seen.includes(stamp));
        const step = decide(opens ? { delivered: false, pending: false } : stored);
        decision = step.decision;
        if (step.next === null) return null;
        const acknowledged = opens && stamp !== '' ? [...seen, stamp].slice(-SEEN_MAX) : seen;
        const next: RestoreState = { session_id, ...step.next, seen: acknowledged };
        return `${JSON.stringify(next)}\n`;
    }, { strict: true });
    if (unreadable) process.stderr.write('session-pins: restore record unreadable; nothing restored or recorded from it\n');
    return outcome === 'failed' || unreadable ? null : { decision, block };
}

const LOCK_FAILED_NOTE = '(Restore state unlocked: this may repeat once.)';

/**
 * The restore for the hook (`post_tool_use` after a compaction), with the stamp
 * `language-mirror` read from the pin-lost marker it has already removed: the
 * block, '' when switched off, nothing is pinned, or this compaction was already
 * delivered (by a prompt, or by an earlier tool call with the same stamp), or
 * `RESTORE_FAILED`. An unknown stamp ('') counts as open. Delivering also owes
 * the next prompt one restatement, in case the dispatcher drops this line.
 *
 * A record that cannot be locked still delivers, unrecorded and with a note:
 * the marker is gone, so this cannot repeat, and the prompt path may then
 * deliver and restate once more. That is the whole bound — at most three pin
 * lines per compaction (this one, a prompt delivery, one restatement).
 */
export function restoreFor(consumer_root: string, session_id: string, env: NodeJS.ProcessEnv, rawStamp = ''): string {
    // A replay keeps the marker and cannot write the record, so without this the
    // unrecorded branch below would emit on every replayed call.
    if (pinsDisabled(env) || is_replay_mode() || !has_stable_session_id(session_id)) return '';
    const stamp = admitStamp(rawStamp);
    const r = transition(consumer_root, session_id, stamp, (cur) =>
        cur !== null && cur.delivered && stamp !== ''
            ? { next: null, decision: 'none' }
            : { next: { delivered: true, pending: true }, decision: 'deliver' },
    );
    if (r === null) {
        const block = currentBlock(consumer_root, session_id);
        return block === '' || block === RESTORE_FAILED ? block : `${block}\n${LOCK_FAILED_NOTE}`;
    }
    return r.decision === 'none' ? '' : r.block;
}

/** The current restore block, '' with nothing pinned, or `RESTORE_FAILED`. */
function currentBlock(consumer_root: string, session_id: string): string {
    let read: PinRead;
    try {
        read = parsePins(readRaw(statePath(consumer_root, session_id)), session_id);
    } catch {
        return RESTORE_FAILED;
    }
    return read.state === 'invalid' ? RESTORE_FAILED : restoreText(read.pins);
}

/**
 * The `user_prompt_submit` side, in one transaction: an open compaction (a
 * boundary stamp not yet acknowledged, or an undelivered record) is delivered by this prompt
 * and still owes one restatement — the record commits before the host has the
 * line, and a process that dies in between must not settle a delivery nobody
 * saw, so a duplicate is the price; a delivered one that still owes a
 * restatement is restated once. A record that cannot be locked emits nothing
 * here (stderr only), so every line this path emits is a recorded one.
 *
 * It runs AFTER this prompt's capture, so it states the set the user now holds
 * and a pin removed in this prompt is never restated.
 */
export function followUp(consumer_root: string, session_id: string, env: NodeJS.ProcessEnv): string {
    if (pinsDisabled(env) || is_replay_mode() || !has_stable_session_id(session_id)) return '';
    const stamp = readBoundary(boundaryPath(consumer_root, session_id));
    const r = transition(consumer_root, session_id, stamp, (cur) => {
        if (cur !== null && !cur.delivered) return { next: { ...cur, delivered: true, pending: true }, decision: 'deliver' };
        if (cur !== null && cur.pending) return { next: { ...cur, pending: false }, decision: 'restate' };
        return { next: null, decision: 'none' };
    });
    // Only a committed transition emits here: an unrecorded line could repeat
    // on every prompt. The tool-call restore carries its own unrecorded line.
    if (r === null) {
        process.stderr.write('session-pins: restore record not lockable; the pins are not restated on this prompt\n');
        return '';
    }
    if (r.decision === 'none' || r.block === '') return '';
    if (r.block === RESTORE_FAILED) return RESTORE_FAILED;
    return `Restated after the last compaction, in case the restore did not arrive:\n${r.block}`;
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

## The new shared reader — `src/scripts/_lib/session_pins_record.ts`

~~~ts
/**
 * The session-pin restore record, read the same way everywhere: by the eager
 * `language-mirror` precheck (which decides whether to load the pin chunk at
 * all) and by the chunk's own locked transition. One reader, so the two cannot
 * drift apart — the bundle reaches this small module, not the chunk.
 */
import fs from 'node:fs';

import { owns_session_state } from '../hooks/state_io.js';

export interface RestoreRecord {
    readonly delivered: boolean;
    readonly pending: boolean;
    readonly seen: readonly string[];
}

/**
 * Acknowledged stamps kept. The guarantee is narrowed to this window: a stamp
 * older than the session's last 512 acknowledged compactions is forgotten and
 * could reopen once. A stamp is about 45 bytes, so the record stays under
 * 25 KB; a paused event outliving 512 compactions is not a realistic case.
 */
export const SEEN_MAX = 512;
/** A stamp is about 45 characters; anything far longer was not written by `pre_compact`. */
export const STAMP_MAX_CHARS = 200;

/**
 * The one admission rule for a compaction stamp read from the boundary or the
 * pin-lost marker, applied before any transition opens or acknowledges it: an
 * oversized stamp is unknown (''), never recorded — the reader below would
 * refuse the record it ended up in, and the compaction would reopen forever.
 */
export function admitStamp(raw: string): string {
    const stamp = raw.trim();
    if (stamp.length <= STAMP_MAX_CHARS) return stamp;
    process.stderr.write(`session-pins: compaction stamp over ${STAMP_MAX_CHARS} characters ignored\n`);
    return '';
}

/**
 * The record, `null` when there is none, `'invalid'` when it cannot be accepted
 * as this session's — including a `seen` list over the window or holding
 * anything but stamps, which is refused whole rather than filtered into
 * apparent validity.
 */
export function readRestoreRecord(raw: string | null, session_id: string): RestoreRecord | null | 'invalid' {
    if (raw === null) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<RestoreRecord> & { session_id?: unknown };
        if (!owns_session_state(parsed, session_id) || typeof parsed.delivered !== 'boolean') return 'invalid';
        // Written as a boolean or not at all; anything else is corruption, not `false`.
        if (parsed.pending !== undefined && typeof parsed.pending !== 'boolean') return 'invalid';
        const seen: unknown = parsed.seen;
        if (
            seen !== undefined &&
            (!Array.isArray(seen) ||
                seen.length > SEEN_MAX ||
                !seen.every((x) => typeof x === 'string' && x.length <= STAMP_MAX_CHARS) ||
                new Set(seen).size !== seen.length)
        ) {
            return 'invalid';
        }
        return {
            delivered: parsed.delivered,
            pending: parsed.pending === true,
            seen: parsed.seen ?? [],
        };
    } catch {
        return 'invalid';
    }
}

/** Does this record, with this boundary stamp ('' when none), leave a delivery or restatement open? */
export function restoreOwed(record: RestoreRecord | null | 'invalid', stamp: string): boolean {
    if (record === 'invalid') return true;
    const opens = stamp !== '' && !(record?.seen ?? []).includes(stamp);
    return opens || (record !== null && (!record.delivered || record.pending));
}

/** Exists, but could not be read: never the same as absent. */
export function presentButUnread(file: string): boolean {
    try {
        fs.lstatSync(file);
        return true;
    } catch (err) {
        return (err as NodeJS.ErrnoException).code !== 'ENOENT';
    }
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
import * as fs from 'node:fs';
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
    } catch (err) {
        process.stderr.write(`session-pins: chunk path not resolvable (${String(err).slice(0, 120)})\n`);
        return null;
    }
    const api = loadChunkExport<() => SessionPins>(selfUrl, specifier, 'sessionPins', bundled);
    if (api === null) {
        // The shared loader returns null for an absent chunk and for one it would not run
        // (integrity mismatch, load error); only the second is a defect, so only it is said.
        if (fs.existsSync(specifier)) process.stderr.write(`session-pins: chunk present but not loadable (${specifier})\n`);
        return null;
    }
    try {
        return api();
    } catch (err) {
        process.stderr.write(`session-pins: chunk initialisation failed (${String(err).slice(0, 120)})\n`);
        return null;
    }
}
~~~

## The complete diff of the existing files (one line of context)

~~~diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 7bc9321439..84c0d11f2c 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -6,3 +6,3 @@
     "review_by": "2027-10-01",
-    "max_bytes": 1585000,
+    "max_bytes": 1594300,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
@@ -232,2 +232,21 @@
             "what_would_have_caught_it": "Nothing earlier: the growth is the contract stub builder the installed layer and the promotion share."
+        },
+        {
+            "date": "2026-11-08",
+            "from": 1585000,
+            "to": 1594300,
+            "by": "agent, feat/session-pins-phase-2 (road-to-state-and-pins-across-compaction 2.1-2.2)",
+            "what_was_added": "Session pins in `language-mirror`: the `pin:` prompt test, the kill-switch check before any load, the pin-file existence check that turns a missing chunk after a compaction into a reported failure, the per-prompt and per-tool-call mtime touch that keeps an active session's pins out of retention, the read of the restore record and the boundary stamp that turns the prompt path on only for an open compaction or an owed restatement (the record reader shared with the chunk in `_lib/session_pins_record.ts`), one unique stamp per compaction written to the pin-lost marker and the compaction boundary, the marker taken by an atomic rename before the restore so a compaction gets at most one tool-call restore and a newer marker written meanwhile survives (a marker that cannot be taken is reported and not acted on), guarded calls into the chunk with loader, initialisation and runtime failures reported on stderr, directives in a host-generated prompt reported instead of dropped, the combined language-plus-pins restore in `_reEmitAfterCompaction`, and `hooks/session_pins_loader.ts` (+9,997 B: 1,583,938 B on origin/main to 1,593,935 B, both measured with `build:hooks` on APFS-cloned node_modules).",
+            "why_it_could_not_be_avoided": "Room was made first: the pin module itself (capture, caps, state, restore text) ships as its own chunk, so the bundle carries only the guards that must run before the chunk is loaded, and the eager record reader that decides whether to load it at all. The restore protocol is the simple one — one tool-call restore per marker, one prompt delivery and one restatement per compaction, best-effort — after an earlier draft with claim recovery, a recovery ledger and a fallback counter (about 7.8 KB more) was dropped by the owner as complexity the best-effort contract does not need.",
+            "what_would_have_caught_it": "Nothing earlier: the base headroom (1,062 B) was smaller than the loader and the restore branch together. Sized to the first measurement of this design (1,592,840 B) plus 660 bytes of headroom; then raised to the measurement after the round-44 to 46 review fixes (marker taken by rename, a host-generated prompt with no loadable module or a failing one reported, a restore record whose stamp list is over its window or holds anything but stamps refused as invalid) plus 636 bytes of headroom, of which the round-47 shared stamp admission (an oversized compaction stamp read as unknown, never recorded) took 271 B, the same order as the 540-byte margin of the 2026-11-04 design-pass raise above (the strict-lock option in `hooks/state_io.ts` is part of the measurement)."
+        },
+        {
+            "date": "2026-11-08",
+            "chunk": "src/scripts/hooks/subagent_constraints_hook.ts",
+            "from": 24500,
+            "to": 28500,
+            "by": "agent, feat/session-pins-phase-2 (road-to-state-and-pins-across-compaction 2.2)",
+            "what_was_added": "The parent session's pins handed to every subagent: `subagentPinsText` and the read of the pin file through `_lib/session_pins.ts` (+4,010 B: 23,843 B on origin/main to 27,853 B), including the notice a subagent gets when the pin file cannot be read.",
+            "why_it_could_not_be_avoided": "A subagent starts without the conversation its pins were typed in, and roadmap 2.2 names this carrier. The chunk imports the same reader the capture writes with, so the two cannot disagree about the file; loading the pin chunk from inside another CJS chunk has no `import.meta.url` to resolve it from.",
+            "what_would_have_caught_it": "Nothing earlier: the growth is the feature. Sized to the measurement plus about 3 %."
         }
@@ -253,2 +272,8 @@
         },
+        {
+            "entry": "src/scripts/_lib/session_pins.ts",
+            "max_bytes": 34200,
+            "registered_at": "2026-11-08",
+            "derivation": "Measured 33,166 bytes on 2026-11-09 (capture under a strict file lock that never replaces an unreadable file, eligibility computed in linear time from fence, paste and injected-region spans of the original text (attributed envelopes included, opener recognition with no attribute grammar, a lead that ends at the first line containing anything tag-like, a forward-only paste-tag scanner, fences read by a prefix scan, directives that were not applied counted and reported, a directive line carrying a closing tag, an attributed opener or a bare opener closed on a later line refused, checked in linear time), lone surrogates normalised, caps, lossless per-session state that is never overwritten when it cannot be read whole, a reported restore failure, no restore or restatement in a replay, the once-per-compaction delivery and restatement coordinated across prompt and tool order with one restore record per session changed only under the per-file lock, each delivery adding the compaction's stamp to a set of acknowledged stamps in that lock (the most recent 512), a record that exists but cannot be read left untouched and acted on by nothing, one admission rule for every compaction stamp so an oversized one is unknown and never recorded, pins read inside that transaction, the tool-call restore keyed on its own stamp, a once-a-day retention prune that keeps a live session's restore record by its pin file's activity and removes a gone session's boundary and lock files, the subagent reader, activity-based retention, restore text, and the parts of `_lib/prompt_shape` and `hooks/state_io` they import). The ceiling is that reading plus about 3 %, rounded, with no growth queued. Loaded by `language-mirror` through `hooks/session_pins_loader.ts` on a prompt carrying a `pin:` or `unpin:` line, on a prompt that owes a delivery or restatement, and on the one tool call after a compaction; a missing chunk is reported on the capture turn and on the tool-call restore, and costs the pin restore, never the language restore or the dispatch."
+        },
         {
@@ -285,3 +310,3 @@
             "entry": "src/scripts/hooks/subagent_constraints_hook.ts",
-            "max_bytes": 24500,
+            "max_bytes": 28500,
             "registered_at": "2026-10-24",
diff --git a/src/config/hook-token-budget.json b/src/config/hook-token-budget.json
index 7a40295422..79bc308bfd 100644
--- a/src/config/hook-token-budget.json
+++ b/src/config/hook-token-budget.json
@@ -16,4 +16,4 @@
   "session-canary_reason": "full canary contract once at session_start; the per-turn beat is one line",
-  "language-mirror": 2048,
-  "language-mirror_reason": "the measured 626-wrong-turn failure class justifies a full-paragraph pin per turn",
+  "language-mirror": 6144,
+  "language-mirror_reason": "the measured 626-wrong-turn failure class justifies a full-paragraph pin per turn (at most 771 B per reply line, measured). RAISED 2048 -> 6144 on 2026-11-08 by road-to-state-and-pins-across-compaction 2.1-2.3: the same concern now carries the user's session pins, on four kinds of fire only — the turn a prompt carries a `pin:`/`unpin:` line (language pin plus a capture notice naming at most 3 entries per list, 40 characters each), the one tool call after a compaction (language pin plus the pins verbatim), the first prompt after a compaction (the pins delivered before the tool-call restore when the prompt comes first, which then carries the language pin only, or restated after it in case the dispatcher dropped it under the per-turn budget — with any capture notice of that prompt cut to counts and at most 3 short previews of refused pins), and, when that first prompt delivered, the prompt after it (one restatement, because the delivery is recorded before the line reaches the host). BOUND, for one compaction under any failure that leaves the restore record intact: at most three pin lines — the tool-call restore (taken once: its marker is removed before it runs, and a marker that cannot be removed is not acted on), one prompt delivery and one prompt restatement, the last two each recorded under the restore record's lock before they are emitted. A prompt whose record cannot be locked, or whose pin module cannot be loaded, emits nothing (stderr says why), so no unrecorded line can repeat; a record that exists but cannot be read is the same case (nothing decided, nothing written, nothing emitted on a prompt). The one exception: a record that is CORRUPTED (unparseable, another session's, or over its own limits) loses its acknowledgements, so a compaction whose boundary is still present opens once more and is overwritten with a valid record — one more delivery and restatement per corruption, never a loop. Only the tool-call restore may emit unrecorded, with a one-line note, and it cannot repeat. Delivery is best-effort, not exactly-once: a hook or dispatcher that dies after the record committed loses that line, and the backstops are the owed restatement (pins) and the distance re-emit (language). Every other turn is unchanged. The bound is by construction: pins are capped at 12 x 300 characters and 4,096 JSON-escaped bytes together (`MAX_PINS_BYTES` in `_lib/session_pins.ts`). Worst shapes computed from the caps before the restore protocol was simplified on 2026-11-09, each an upper bound now: 5,879 B (capture plus restatement with a lock-failure note this prompt path no longer emits), the row leaving 265 B above it; 5,054 B (tool-call restore, plus the one-line lock-failure note where the record cannot be locked), 4,778 B (capture notice with every list full of 4-byte characters); `tests/scripts/session_pins.test.ts` asserts a combined line against this row. All stay under the host's 10,000-character additionalContext line.",
   "council-availability": 1536,
@@ -51,2 +51,3 @@
   "post_tool_use": 2048,
+  "post_tool_use_reason": "Per ordinary fire. ONE named exception, stated rather than hidden: the single tool call after a compaction carries the `language-mirror` restore (language pin plus session pins, at most about 5,090 B, see that row), once per compaction event; its marker is removed before the restore runs, so it never fires twice for one compaction — the same restore role session_start plays for the rule layer. The bench replays fixtures with no pin state, so it cannot see that fire; `tests/hooks/session_pins_dispatch.test.ts` checks it instead, driving the heaviest admissible restore through the real dispatcher and asserting the host line against the `language-mirror` row and that the next tool call is silent; the runtime per-turn aggregate in `hooks/injection_budget.ts` still applies to it: beside a full prompt slot and a second post_tool_use concern at its cap the restore is kept, and only a turn that has already spent the per-turn ceiling drops it. A dropped restore is not lost: the next prompt after the restore restates the pins once, at the start of a fresh turn, from the set the user holds after that prompt's own directives. That restatement rides `user_prompt_submit`, inside the `language-mirror` row above.",
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
diff --git a/src/scripts/hooks/state_io.ts b/src/scripts/hooks/state_io.ts
index 537a2bae97..e926e7e1cc 100644
--- a/src/scripts/hooks/state_io.ts
+++ b/src/scripts/hooks/state_io.ts
@@ -405,3 +405,3 @@ function _acquire_lock(
   lock_path: string,
-  options: { blocking?: boolean } = {},
+  options: { blocking?: boolean; strict?: boolean } = {},
 ): number | null {
@@ -433,3 +433,5 @@ function _acquire_lock(
         // mode here is a lost guard, and the alternative is a lost write.
-        return fd;
+        // `strict` callers (session pins) prefer the reported failure: a write
+        // without exclusion can silently drop a user's constraint.
+        return options.strict === true ? give_up() : fd;
       }
@@ -1046,3 +1048,3 @@ export function update_text_under_lock(
   transform: (loaded: string | null) => string | null,
-  options: { blocking?: boolean } = {},
+  options: { blocking?: boolean; strict?: boolean } = {},
 ): LockedUpdateResult {
@@ -1069,3 +1071,3 @@ export function update_text_under_lock(
   try {
-    fd = _acquire_lock(lock_path, { blocking: options.blocking ?? true });
+    fd = _acquire_lock(lock_path, { blocking: options.blocking ?? true, strict: options.strict === true });
   } catch {
diff --git a/src/scripts/hooks/subagent_constraints_hook.ts b/src/scripts/hooks/subagent_constraints_hook.ts
index 228fff782d..5fee4169ff 100644
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
@@ -511,4 +516,36 @@ export function digestFor(envelope: unknown, env: NodeJS.ProcessEnv = process.en
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
+    const room = EMISSION_MAX_BYTES - escBytes(pins + separator);
+    if (room > 0) return pins + separator + instructionDigest(projectDir, room, configDir);
+    // Unreachable under today's caps (a test holds the margin); said rather than silent if a cap moves.
+    process.stderr.write('subagent-constraints: session pins filled the reply; the instruction digest was left out\n');
+    return pins;
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
index bcd7f20679..b429f67311 100644
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
@@ -90,2 +96,8 @@ import {
 } from "./_lib/prompt_shape.js";
+import { loadSessionPins } from "./hooks/session_pins_loader.js";
+import { admitStamp, readRestoreRecord, restoreOwed } from "./_lib/session_pins_record.js";
+import type { SessionPins } from "./_lib/session_pins.js";
+
+/** How the pin module is reached; injectable because a test runner cannot `require` the TS source. */
+export type PinsLoader = () => SessionPins | null;
 
@@ -636,3 +648,3 @@ function _migrateLegacyMarker(consumer_root: string): void {
 
-export function _setPinLost(consumer_root: string, session_id: string): void {
+export function _setPinLost(consumer_root: string, session_id: string, stamp: string = new Date().toISOString()): void {
   if (is_replay_mode()) return;
@@ -640,3 +652,3 @@ export function _setPinLost(consumer_root: string, session_id: string): void {
   try {
-    atomic_write_text(path.join(consumer_root, pinLostMarker(session_id)), new Date().toISOString());
+    atomic_write_text(path.join(consumer_root, pinLostMarker(session_id)), stamp);
   } catch (err) {
@@ -663,16 +675,46 @@ export function _pinLost(consumer_root: string, session_id: string): boolean {
 
-function _clearPinLost(consumer_root: string, session_id: string): void {
-  // R2 round 2, finding 8: the replay guard covered only the WRITE. A replayed
-  // `post_tool_use` therefore deleted a live marker it was forbidden to create,
-  // and the real session lost the single re-emit this whole mechanism exists to
-  // deliver — replay destroying live state while blocked from writing it, which
-  // is worse than either direction alone.
-  if (is_replay_mode()) return;
+/**
+ * Consume this session's pin-lost marker and return the stamp it carried ('' when
+ * unreadable), or null when there is none or it cannot be taken. Taken BEFORE
+ * the restore runs, so a compaction gets at most one tool-call restore: a marker
+ * that cannot be taken is reported and not acted on, never re-fired on every
+ * tool call. A process that dies after this point loses its tool-call restore;
+ * the prompt path's own boundary covers the pins, and the language pin's
+ * distance re-emit covers the language. Best-effort, bounded — not exactly-once.
+ *
+ * R2 round 2, finding 8: a replayed `post_tool_use` must not delete a live
+ * marker it is forbidden to create, so replay reads and never removes.
+ */
+function _takePinLost(consumer_root: string, session_id: string): string | null {
+  const marker = path.join(consumer_root, pinLostMarker(session_id));
+  const readStamp = (file: string): string | null => {
+    try {
+      return fs.readFileSync(file, "utf8").trim();
+    } catch (err) {
+      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
+      process.stderr.write(`language-mirror: compaction stamp unreadable (${_errText(err)})\n`);
+      return "";
+    }
+  };
+  if (is_replay_mode()) return readStamp(marker);
+  // Taken by an atomic rename onto one fixed per-session name, so this call owns
+  // exactly the marker that was there: a `pre_compact` writing while it runs
+  // (outside this lock) creates a new marker it never touches. A process dying
+  // before the cleanup below leaves that one file, which the next take replaces.
+  const taken = `${marker}.taken`;
   try {
-    fs.rmSync(path.join(consumer_root, pinLostMarker(session_id)), { force: true });
-  } catch {
-    // If it cannot be cleared the next tool call re-emits once more. One
-    // duplicate line is the failure mode; a loop is not, because the marker
-    // is only ever SET by a compaction event.
+    fs.renameSync(marker, taken);
+  } catch (err) {
+    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
+      process.stderr.write(`language-mirror: pin-lost marker not removable (${_errText(err)}) — no restore for it\n`);
+    }
+    return null;
+  }
+  const stamp = readStamp(taken) ?? "";
+  try {
+    fs.rmSync(taken, { force: true });
+  } catch (err) {
+    process.stderr.write(`language-mirror: taken marker not cleaned up (${_errText(err)})\n`);
   }
+  return stamp;
 }
@@ -688,2 +730,4 @@ export function _reEmitAfterCompaction(
   write_json: StateWriter = atomic_write_json,
+  env: NodeJS.ProcessEnv = process.env,
+  load_pins: PinsLoader = loadSessionPins,
 ): number {
@@ -700,11 +744,27 @@ export function _reEmitAfterCompaction(
   // cannot both advance past the same counter value nor both emit at the
-  // threshold.
-  return _withToolWriteLock(consumer_root, session_id, EXIT_ALLOW, () => {    const previous = _loadState(path.join(consumer_root, statePathFor(session_id)));
+  // threshold — and cannot both take the marker.
+  return _withToolWriteLock(consumer_root, session_id, EXIT_ALLOW, () => {
+    const stamp = _takePinLost(consumer_root, session_id);
+    return stamp === null ? EXIT_ALLOW : restoreTaken(stamp);
+  });
+
+  function restoreTaken(takenStamp: string): number {
+    const previous = _loadState(path.join(consumer_root, statePathFor(session_id)));
     const language = previous.language as Verdict | undefined;
     const source: PinSource = previous.source === "system-locale" ? "system-locale" : "prompt";
-    // Clear FIRST: if the write below throws, the marker must not survive to
-    // re-fire on every subsequent tool call — that is the shape § 6.2 refuses.
-    _clearPinLost(consumer_root, session_id);
-    if (language !== "de" && language !== "en") {
-      return EXIT_ALLOW;
+    // Session pins ride the same marker (road-to-state-and-pins-across-compaction
+    // 2.2): one restore per compaction event, no second mechanism. They are
+    // owned by their own per-session file, so they restore even when no
+    // language is pinned. Loaded only when this session has a pin file; a
+    // missing module is then a failed restore the user is told about, never an
+    // empty one.
+    let pins = "";
+    if (!pinsOff(env) && mayHavePins(consumer_root, session_id)) {
+      const unavailable = "Session pins: could NOT be restored after this compaction — the pin module could not be loaded. Tell the user.";
+      try {
+        pins = safeLoad(load_pins)?.restoreFor(consumer_root, session_id, env, takenStamp) ?? unavailable;
+      } catch (err) {
+        process.stderr.write(`session-pins: restore failed (${_errText(err)})\n`);
+        pins = "Session pins: could NOT be restored after this compaction — the pin module failed. Tell the user.";
+      }
     }
@@ -712,5 +772,4 @@ export function _reEmitAfterCompaction(
     // `nextState`, for the same shared-state reason.
-    if (!_ownsPin(previous, session_id)) {
-      return EXIT_ALLOW;
-    }
+    let restoreLanguage =
+      (language === "de" || language === "en") && _ownsPin(previous, session_id);
     // The pin is about to be fresh in context again, so the distance counter
@@ -723,6 +782,10 @@ export function _reEmitAfterCompaction(
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
@@ -730,4 +793,6 @@ export function _reEmitAfterCompaction(
         decision: "warn",
-        reason: noticeText(language, source),
-        additional_context: pinText(language, source),
+        reason: restoreLanguage ? noticeText(lang, source) : "Session pins restored after compaction.",
+        additional_context: [restoreLanguage ? pinText(lang, source) : "", pins]
+          .filter((part) => part !== "")
+          .join("\n\n"),
       })}\n`,
@@ -735,3 +800,3 @@ export function _reEmitAfterCompaction(
     return EXIT_WARN;
-  });
+  }
 }
@@ -1043,5 +1108,7 @@ export function _onToolUse(
   write_json: StateWriter = atomic_write_json,
+  env: NodeJS.ProcessEnv = process.env,
+  load_pins: PinsLoader = loadSessionPins,
 ): number {
   if (_pinLost(consumer_root, session_id)) {
-    return _reEmitAfterCompaction(consumer_root, session_id, write_json);
+    return _reEmitAfterCompaction(consumer_root, session_id, write_json, env, load_pins);
   }
@@ -1050,5 +1117,37 @@ export function _onToolUse(
 
+/**
+ * A prompt that could carry a pin directive. Checked here, in the bundle, so
+ * the pin chunk is loaded for such prompts only; the chunk decides which lines
+ * count, and a missing chunk is said, never swallowed.
+ */
+const PIN_DIRECTIVE = /^(?:un)?pin:/im;
+/**
+ * A loader that throws is a missing module, never a crashed hook. A chunk that
+ * lacks part of the API (a version skew) throws at its call site instead, and
+ * every call site below is guarded and treats that the same way.
+ */
+const safeLoad = (load: PinsLoader): SessionPins | null => {
+  try {
+    return load();
+  } catch (err) {
+    process.stderr.write(`session-pins: pin module not loadable (${_errText(err)})\n`);
+    return null;
+  }
+};
+const PINS_DIR = path.join("agents", "state", "session-pins");
+const pinsOff = (env: NodeJS.ProcessEnv): boolean => (env["AGENT_CONFIG_NO_SESSION_PINS"] ?? "").trim() === "1";
+const pinFile = (root: string, sid: string): string => path.join(root, session_state_file(PINS_DIR, sid));
+/** Only a definite `ENOENT` means "no pins"; any other failure is uncertain and goes to the module, which reports it. */
+const mayHavePins = (root: string, sid: string): boolean => {
+  try {
+    fs.lstatSync(pinFile(root, sid));
+    return true;
+  } catch (err) {
+    return (err as NodeJS.ErrnoException).code !== "ENOENT";
+  }
+};
+
 export function run(
   stdin_text: string,
-  options: { consumer_root: string; env?: NodeJS.ProcessEnv; write_json?: StateWriter },
+  options: { consumer_root: string; env?: NodeJS.ProcessEnv; write_json?: StateWriter; load_pins?: PinsLoader },
 ): number {
@@ -1084,3 +1183,17 @@ export function run(
   if (event === "pre_compact") {
-    _setPinLost(options.consumer_root, _sessionId(envelope));
+    // One unique stamp names this compaction, written to the pin-lost marker
+    // (read by the tool-call restore) and, for session pins, to the boundary
+    // (read by the prompt path) — two separate writes, each reported when it
+    // fails. Either one that lands is enough to restore the pins; when both
+    // fail, the compaction is not restored and stderr says so twice.
+    const sid = _sessionId(envelope);
+    const stamp = `${new Date().toISOString()} ${process.pid} ${Math.random()}`;
+    _setPinLost(options.consumer_root, sid, stamp);
+    if (hasStableSessionId(sid) && !is_replay_mode() && !pinsOff(options.env ?? process.env) && mayHavePins(options.consumer_root, sid)) {
+      try {
+        atomic_write_text(`${pinFile(options.consumer_root, sid).slice(0, -5)}.boundary`, stamp);
+      } catch (err) {
+        process.stderr.write(`session-pins: compaction boundary not written (${_errText(err)})\n`);
+      }
+    }
     return EXIT_ALLOW;
@@ -1088,3 +1201,24 @@ export function run(
   if (event === "post_tool_use") {
-    return _onToolUse(options.consumer_root, _sessionId(envelope), options.write_json);
+    // Tool calls are activity too: a session running tools without prompts and
+    // with no language pinned would otherwise age its pins out of retention.
+    const tsid = _sessionId(envelope);
+    if (hasStableSessionId(tsid) && !is_replay_mode() && !pinsOff(options.env ?? process.env)) {
+      try {
+        const now = new Date();
+        fs.utimesSync(pinFile(options.consumer_root, tsid), now, now);
+      } catch (err) {
+        // No pin file is the normal case; anything else would let retention
+        // prune a tool-only session's pins, so it is said.
+        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
+          process.stderr.write(`session-pins: activity touch failed (${_errText(err)})\n`);
+        }
+      }
+    }
+    return _onToolUse(
+      options.consumer_root,
+      _sessionId(envelope),
+      options.write_json,
+      options.env ?? process.env,
+      options.load_pins ?? loadSessionPins,
+    );
   }
@@ -1099,2 +1233,22 @@ export function run(
   if (isSyntheticPrompt(prompt)) {
+    // Its pin lines are never applied, but they are not dropped without a word.
+    const sid = typeof envelope["session_id"] === "string" ? envelope["session_id"] : "";
+    const env = options.env ?? process.env;
+    if (hasStableSessionId(sid) && !pinsOff(env) && PIN_DIRECTIVE.test(prompt)) {
+      let notice: string | null = null;
+      try {
+        const mod = safeLoad(options.load_pins ?? loadSessionPins);
+        notice =
+          mod === null
+            ? "Session pins: the pin module could not be loaded; pin:/unpin: lines in a host-generated prompt are NOT applied either way. Tell the user."
+            : mod.captureFor(options.consumer_root, sid, prompt, env);
+      } catch (err) {
+        process.stderr.write(`session-pins: capture failed (${_errText(err)})\n`);
+        notice = "Session pins: the pin module failed; pin:/unpin: lines in a host-generated prompt are NOT applied either way. Tell the user.";
+      }
+      if (notice !== null) {
+        process.stdout.write(`${JSON.stringify({ decision: "warn", reason: "Session pins not applied.", additional_context: notice })}\n`);
+        return EXIT_WARN;
+      }
+    }
     return EXIT_ALLOW;
@@ -1156,5 +1310,103 @@ export function run(
 
+  // Session pins (road-to-state-and-pins-across-compaction 2.1): captured from
+  // this prompt's `pin:` lines only. The notice is emitted on the turn a
+  // directive arrives and never otherwise — no standing bytes.
+  // A missing module is told apart from a prompt whose `pin:` lines were all
+  // excluded (fenced, pasted) or switched off: only the first is a failure.
+  const env = options.env ?? process.env;
+  const pinModule = PIN_DIRECTIVE.test(prompt) && !pinsOff(env) ? safeLoad(options.load_pins ?? loadSessionPins) : undefined;
+  // A compaction since the last prompt leaves a pending marker: this prompt
+  // restates the pins (`followUp`), after its own capture so a pin removed now
+  // is never restated.
+  const base = stateful ? pinFile(options.consumer_root, session_id).slice(0, -5) : "";
+  // Only an open compaction (undelivered) or an owed restatement turns this
+  // on — a record whose debt is paid must not keep loading the module.
+  let owed = false;
+  let boundaryStamp = "";
+  if (stateful && !pinsOff(env)) {
+    // The same reader the chunk's transition uses, so the two cannot disagree.
+    let record: ReturnType<typeof readRestoreRecord> = null;
+    try {
+      record = readRestoreRecord(fs.readFileSync(`${base}.restore.json`, "utf8"), session_id);
+    } catch (err) {
+      // Absent is nothing owed; unreadable is handed to the module.
+      record = (err as NodeJS.ErrnoException).code === "ENOENT" ? null : "invalid";
+    }
+    try {
+      boundaryStamp = admitStamp(fs.readFileSync(`${base}.boundary`, "utf8"));
+    } catch (err) {
+      // Absent or unreadable: nothing for the prompt path to open — the
+      // tool-call restore carries its own stamp — but unreadable is said.
+      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
+        process.stderr.write(`session-pins: compaction boundary unreadable (${_errText(err)}); the tool-call restore covers it\n`);
+      }
+    }
+    owed = restoreOwed(record, boundaryStamp);
+  }
+  const restatePending = stateful && !pinsOff(env) && owed;
+  // Every substantive prompt marks the pins as belonging to a live session, so
+  // retention measures activity even when no language is pinned.
+  if (stateful && !is_replay_mode() && !pinsOff(env)) {
+    try {
+      const now = new Date();
+      fs.utimesSync(pinFile(options.consumer_root, session_id), now, now);
+    } catch (err) {
+      // No pin file is the normal case; anything else would let retention
+      // prune an active session's pins, so it is said.
+      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
+        process.stderr.write(`session-pins: activity touch failed (${_errText(err)})\n`);
+      }
+    }
+  }
+  const pinNotice =
+    pinModule === undefined
+      ? null
+      : pinModule === null
+        ? "Session pins: the pin module could not be loaded, so any pin: or unpin: line in this prompt was NOT applied. Tell the user."
+        : (() => {
+            try {
+              return pinModule.captureFor(options.consumer_root, session_id, prompt, env, restatePending);
+            } catch (err) {
+              process.stderr.write(`session-pins: capture failed (${_errText(err)})\n`);
+              return "Session pins: the pin module failed, so any pin: or unpin: line in this prompt was NOT applied. Tell the user.";
+            }
+          })();
+  let pinFollowUp = "";
+  if (restatePending) {
+    const mod = pinModule ?? safeLoad(options.load_pins ?? loadSessionPins);
+    const restated = (() => {
+      try {
+        return mod?.followUp(options.consumer_root, session_id, env);
+      } catch (err) {
+        // A module that loaded and then threw is a defect, not a missing file: say which.
+        process.stderr.write(`session-pins: restatement failed (${_errText(err)})\n`);
+        return undefined;
+      }
+    })();
+    if (restated !== undefined) {
+      pinFollowUp = restated;
+    } else {
+      // The chunk could not run. Said on stderr only: nothing records this
+      // prompt, so a context line here would repeat on every prompt. The
+      // tool-call restore of the compaction tells the user instead.
+      process.stderr.write("session-pins: the pins could not be restated after the last compaction (module unavailable)\n");
+    }
+  }
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

## Helpers the change relies on

### `hooks/state_io.ts` (after this change)

~~~ts
function _acquire_lock(
  lock_path: string,
  options: { blocking?: boolean; strict?: boolean } = {},
): number | null {
  const blocking = options.blocking ?? true;
  // Open (and keep) the sentinel lock file with O_CREAT | O_RDWR — never
  // truncated, just an fd, exactly like the Python fcntl path. The file
  // stays on disk alongside the target after release.
  const fd = fs.openSync(lock_path, "a", 0o644);
  const held = lock_path + ".held";
  const give_up = (): null => {
    try {
      fs.closeSync(fd);
    } catch {
      /* ignore */
    }
    return null;
  };
  const start = Date.now();
  for (;;) {
    try {
      const heldFd = fs.openSync(held, "wx", 0o644);
      fs.closeSync(heldFd);
      return fd;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
        // Unexpected error (a read-only mount, a vanished parent) — proceed
        // without the companion guard rather than wedge the never-block hook
        // contract. Pre-existing behaviour, deliberately retained: the failure
        // mode here is a lost guard, and the alternative is a lost write.
        // `strict` callers (session pins) prefer the reported failure: a write
        // without exclusion can silently drop a user's constraint.
        return options.strict === true ? give_up() : fd;
      }
      // EEXIST: somebody holds it. Decide from the COMPANION, never from how
      // long we have waited.
      let age_ms: number;
      try {
        age_ms = Date.now() - fs.statSync(held).mtimeMs;
      } catch {
        // Vanished between the open and the stat — the holder just released.
        // Retry at once: this is real progress, not a spin.
        continue;
      }
      if (age_ms >= LOCK_STALE_MS) {
        // A genuine staleness check: the companion itself has been untouched
        // for longer than any live critical section here can last. Removing it
        // is progress, so the immediate retry is bounded.
        try {
          fs.rmSync(held, { force: true });
        } catch {
          /* a peer reclaimed it first — the retry below sees the new one */
        }
        continue;
      }
      // A LIVE peer holds it.
      if (!blocking) {
        return give_up();
      }
      if (Date.now() - start > LOCK_ACQUIRE_DEADLINE_MS) {
        // Waited long enough. Report failure — never evict a fresh companion,
        // which is exactly the eviction that made two impatient callers destroy
        // each other's exclusion.
        return give_up();
      }
      _sleep(LOCK_SPIN_SLEEP_MS);
    }
  }
}

/**
 * Read a TEXT file, transform it, and write it back — the WHOLE sequence under
 * one lock.
 *
 * The text sibling of {@link update_json_under_lock}, added for P3 of
 * `b-stop-async-split-prerequisites` (council 2026-08-20, option (a),
 * "P3 before anything else"). The concrete case is
 * `agents/runtime/state/dispatch-issues.jsonl`, which had NO lock and NO
 * tmp+rename: `log_dispatch_issue` read the whole capped log, appended a line,
 * and `writeFileSync`'d the target directly.
 *
 * That is corruption-capable rather than merely lossy, and the distinction is
 * why this needed its own primitive instead of a comment. `writeFileSync`
 * truncates and then writes, so a concurrent reader can observe a half-written
 * log and a concurrent writer can interleave into one — and the file is written
 * precisely when something has ALREADY gone wrong, so the evidence destroyed is
 * the evidence of the failure being reported. Two concurrent dispatchers in one
 * workspace is a supported configuration (two platforms installed side by side),
 * and a host that runs tool calls in parallel produces it without any second
 * platform at all.
 *
 * `transform` receives the file's content as read INSIDE the lock — `null` when
 * the file does not exist, so a caller can tell "absent" from "empty" — and
 * returns what to write. Returning `null` writes nothing and still counts as
 * success.
 *
 * Returns `written` / `skipped` / `failed`, the same three-state contract
 * `update_json_under_lock` carries since `bcbb0380b` — a boolean could not tell
 * a deliberate decline from a failure, and every member of the union is a truthy
 * string, so `if (!result)` is a silent no-op rather than a compile error. Under
 * `AGENT_CONFIG_REPLAY=1` this reports `failed` without touching the tree.
 */
export function update_text_under_lock(
  target: string,
  transform: (loaded: string | null) => string | null,
  options: { blocking?: boolean; strict?: boolean } = {},
): LockedUpdateResult {
  if (is_replay_mode()) return "failed";
  const targetPath = path.resolve(target);
  const state_dir = path.dirname(targetPath);
  try {
    fs.mkdirSync(state_dir, { recursive: true });
  } catch {
    return "failed";
  }
  // FILE-keyed, matching `update_json_under_lock` rather than
  // `_atomic_write_text`. Converged onto the sibling deliberately after
  // `bcbb0380b` landed the measured argument: a read-modify-write needs mutual
  // exclusion against writers of THIS file and nothing else, and the shared
  // directory lock was measured paying the full cost of exclusion for writes
  // that require none (8 workers: slowest 138-267 ms shared vs 83-95 ms
  // unshared). This function was written against the directory-keyed primitive
  // one commit earlier; leaving it there would have made
  // `dispatch-issues.jsonl` serialise against every unrelated
  // `atomic_write_text` in the state dir.
  const lock_path = _target_lock_path(targetPath);
  let fd: number | null;
  try {
    fd = _acquire_lock(lock_path, { blocking: options.blocking ?? true, strict: options.strict === true });
  } catch {
    return "failed";
  }
  // FAIL CLOSED, for the same reason the JSON sibling does: an append without
  // exclusion is the truncating write this function exists to prevent.
  if (fd === null) return "failed";
  try {
    let loaded: string | null = null;
    try {
      loaded = fs.readFileSync(targetPath, "utf-8");
    } catch {
      // Absent or unreadable. `null` lets the transform distinguish the two
      // from an empty file, which matters for an append-only log: an
      // unreadable existing log must not be silently replaced by one line.
    }
    const next = transform(loaded);
    if (next === null) return "skipped"; // deliberate no-write, not a failure
    _publish_text_locked(targetPath, next);
    return "written";
  } catch {
    return "failed";
  } finally {
    _release_lock(fd, lock_path);
  }
}

/**
 * Does a loaded session-state object belong to `session_id`?
 *
 * THE DIGEST PATH IS NOT THE WHOLE GUARANTEE, which is the correction this
 * function exists to carry. `session_state_file` says callers "keep an in-file
 * `session_id` as a cheap integrity check" — and a cross-model review
 * (2026-08-20, both seats, blocking) found the two `turn-end-gate` readers
 * consuming state without ever making that check, so the sentence described a
 * discipline no consumer followed. A file that arrives at the wrong digest path
 * by a copy, a restore, a hand-edit, or a buggy writer was accepted whole; the
 * sharp case is a foreign `ci_last: {settled: true}`, which vouches for a CI run
 * this session never made and lets a premature completion claim through a
 * BLOCKING gate.
 *
 * EXACT match, and an absent owner is foreign. There is no compatibility window
 * to honour: the digest layout has never shipped for either concern, so no
 * deployed version ever wrote an ownerless hashed file — a permissive branch
 * would be dead code that weakens the guarantee its own doc comment states.
 * (The language hook's `_ownsPin` learned this in its round 3 and now delegates
 * here.)
 */
export function owns_session_state(state: unknown, session_id: string): boolean {
  if (typeof state !== "object" || state === null || Array.isArray(state)) return false;
  return (state as Record<string, unknown>)["session_id"] === session_id;
}
~~~

### `_lib/prompt_shape.ts`

~~~ts
const DOCUMENT_HEAD = /^\s*(#{1,6}\s|-{3,}\s*$|={3,}\s*$|<[A-Za-z][\w-]*>\s*$)/;

/**
 * Is this "prompt" a harness-generated turn rather than something a human typed?
 *
 * MEASURED, IN THE LANGUAGE HOOK'S OWN AUDIT (round 5, 2026-08-07). The state
 * file read mid-session:
 *
 *   { "language": "en", "source": "prompt", "prompt_chars": 6627,
 *     "de_markers": 0, "en_markers": 63 }
 *
 * No human wrote those 6,627 characters. They were a background-task completion
 * notification, injected as a user turn, which `user_prompt_submit` sees and the
 * hook classified as the trigger — flipping a German session to `en` for every
 * later turn, and recording `source: "prompt"`, a false provenance claim.
 *
 * The markers are structural, not linguistic: the harness stamps these turns
 * with fixed envelope tags. Matching prose would misfire on a human quoting a
 * notification; matching the tags cannot, because a human typing
 * `<task-notification>` is quoting, and a quote does not open at character zero.
 *
 * Deliberately conservative: an unrecognised synthetic shape falls through and
 * is treated as a chat message. Under-filtering keeps prior behaviour;
 * over-filtering would silently stop pinning real prompts, which is worse.
 * Measured across 1 540 user-role entries: 509 open at character zero with a
 * marker, and in 0 of them does human text survive wrapper removal.
 *
 * `<agent-message` added 2026-10-03, by the same under-filtering it warns
 * about: a subagent hand-back reaches this slot as `<agent-message from="…">`,
 * and 12 of the 153 hook-sourced user records in this project's capture open
 * with it. It pinned a German session to `en`, after which the turn-end gate
 * refused each German reply — a reply language derived from a frame nobody
 * typed. Its literal stops before the `>` because the element carries an
 * attribute; the anchor at character zero is unchanged.
 *
 * **The fourth shape has NO envelope tag, and it is the exception this file's
 * own "structural, not linguistic" rule has to name rather than quietly break.**
 * The host resumes a rate-limited session with a plain sentence —
 * `Your claude.ai usage limit has reset. Continue the task you were working
 * on…` — carrying no element, no bracket and no stamp. 5 of the 153
 * hook-sourced user records in this project's capture open with it. Measured
 * 2026-10-03: it pinned a German session to `en` with `prompt_chars: 148`,
 * which is that sentence's exact length, and every German reply for the rest
 * of the run was then refused by the turn-end gate as wrong-language.
 *
 * Matching prose is what the paragraph above warns against, so what makes this
 * one admissible is stated rather than assumed: it is a FIXED host string, not
 * a linguistic pattern, and the character-zero anchor does the same work a tag
 * would — a human asking *why did I get "Your claude.ai usage limit has
 * reset"* does not open with it. A test pins that direction. If the host ever
 * reworded the sentence this guard would silently stop matching, which is the
 * honest failure mode: it under-filters back to today's behaviour rather than
 * misfiring on a real turn.
 *
 * It is deliberately NOT added to `machine_wake.ts`. There the same
 * misclassification retains an authorization instead of mis-pinning a reply,
 * and a prose match is too weak a warrant for that consequence — see the
 * asymmetry note below, which this is the first real test of.
 *
 * **A SECOND VOCABULARY ANSWERS THIS SAME QUESTION AND THE TWO HAVE DRIFTED.**
 * `_lib/machine_wake.ts`'s `humanTypedThisTurn` guards per-turn STATE on this
 * slot (the git-authorization ledger, the suggestion latch) while this one
 * guards the language pin. As of this change both know `<task-notification>`,
 * `<system-reminder>` and `<agent-message`; only this one knows
 * `[SYSTEM NOTIFICATION`, `<local-command-caveat>` and the host's framed
 * agent-message delivery (`AGENT_MESSAGE_FRAME`). That asymmetry is NOT
 * obviously a defect and was deliberately left: mistaking a real turn for a
 * machine one costs a mis-pinned reply here and a RETAINED AUTHORIZATION
 * there, so the two sides do not want the same error budget — and
 * `<local-command-caveat>` in particular precedes a real typed prompt. Unify
 * them only with that asymmetry answered, never as tidying.
 */
export function isSyntheticPrompt(prompt: string): boolean {
  const head = prompt.trimStart().slice(0, 400);
  return (
    head.startsWith("[SYSTEM NOTIFICATION - NOT USER INPUT]") ||
    head.startsWith("<task-notification>") ||
    head.startsWith("<system-reminder>") ||
    head.startsWith("<local-command-caveat>") ||
    head.startsWith("<agent-message") ||
    head.startsWith("Your claude.ai usage limit has reset") ||
    /^\[SYSTEM NOTIFICATION\b/.test(head) ||
    AGENT_MESSAGE_FRAME.test(head)
  );
}

/**
 * The part of a prompt a human plausibly typed: everything before the first
 * pasted document begins.
 *
 * Callers pass text that has already had output-shaped pastes removed. Returning
 * the LEAD rather than a filtered whole is deliberate — a paste can be
 * interleaved, and reassembling the human fragments would invent a text nobody
 * wrote. The lead is the one span whose authorship is not in question.
 */
export function humanAuthoredLead(text: string): string {
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    if (DOCUMENT_HEAD.test(line)) {
      break;
    }
    kept.push(line);
  }
  return kept.join("\n");
}
~~~

### `hooks/svg_rules_loader.ts`

~~~ts
/**
 * Require the function `name` from a conditional chunk, or null. Shared so a
 * second chunk loader adds no copy of this logic to the dispatch bundle.
 */
export function loadChunkExport<T>(selfUrl: string, specifier: string, name: string, bundled: boolean): T | null {
    try {
        // The chunk runs inside the dispatch process, so it gets the bundle's
        // own integrity check: a mismatch with its sidecar is not executed.
        // No sidecar is `unverifiable` and allowed, as for `dispatch.js`.
        if (bundled && verifyBundle(specifier).state === 'mismatch') return null;
        const fn = (createRequire(selfUrl)(specifier) as Record<string, unknown>)[name];
        return typeof fn === 'function' ? (fn as T) : null;
    } catch {
        return null;
    }
}
~~~

## Dispatcher-level test — `tests/hooks/session_pins_dispatch.test.ts`

~~~ts
// Session pins through the real dispatcher (`dispatch_hook.ts`), not the
// concern in isolation: every concern the manifest binds on these claude events
// runs beside `language-mirror`, and the dispatcher's own emission shaping
// (`shapeEmissions`, the per-turn budget) decides what reaches the host line.
// The council asked for this in rounds 4, 8 and 10 of the ratification.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { boundaryPath, restorePath } from '../../src/scripts/_lib/session_pins.js';
import { turnSpendPath } from '../../src/scripts/hooks/injection_budget.js';

let project: string;

beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'pins-dispatch-'));
    spawnSync('git', ['init', '-q'], { cwd: project });
});

afterEach(() => {
    fs.rmSync(project, { recursive: true, force: true });
});

/** One host event through the dispatcher; the host-facing context line it printed. */
function dispatch(event: string, nativeEvent: string, payload: Record<string, unknown>): string {
    const tsx = path.resolve('node_modules/.bin/tsx');
    const r = spawnSync(
        tsx,
        [
            path.resolve('src/scripts/hooks/dispatch_hook.ts'),
            '--platform',
            'claude',
            '--event',
            event,
            '--native-event',
            nativeEvent,
            '--project-dir',
            project,
        ],
        {
            input: JSON.stringify({ session_id: 'dispatch-s', hook_event_name: nativeEvent, cwd: project, ...payload }),
            env: { ...process.env, CLAUDE_PROJECT_DIR: project, AGENT_CONFIG_REPLAY: '', LANG: 'C' },
            encoding: 'utf8',
            timeout: 60_000,
        },
    );
    // A crashed or timed-out dispatcher must fail the test, not satisfy a negative assertion.
    expect(r.error).toBeUndefined();
    expect(r.signal).toBeNull();
    expect(r.status).toBe(0);
    const line = (r.stdout ?? '').trim().split('\n').pop() ?? '';
    if (line === '') return '';
    const parsed = JSON.parse(line) as { hookSpecificOutput?: { additionalContext?: string } };
    return parsed.hookSpecificOutput?.additionalContext ?? '';
}

describe('session pins through the dispatcher', () => {
    it('capture, compaction, tool-call restore and one restatement reach the host line, in that order', () => {
        const pins = Array.from({ length: 12 }, (_, i) => `pin: ${`rule ${i} `.padEnd(300, 'x')}`).join('\n');
        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: pins })).toContain('Session pins: 12/12 held.');

        expect(dispatch('pre_compact', 'PreCompact', { trigger: 'auto' })).not.toContain('<session-pins>');

        const restore = dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} });
        expect(restore).toContain('<session-pins>');
        expect(restore).toContain(`- ${'rule 11 '.padEnd(300, 'x')}`);

        const restated = dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' });
        expect(restated).toContain('Restated after the last compaction');

        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' })).not.toContain('<session-pins>');
    }, 240_000);

    it('prompt before tool call: the prompt carries the pins and the tool restore does not repeat them', () => {
        dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'pin: never push to main' });
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' })).toContain('- never push to main');
        expect(dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} })).not.toContain(
            '<session-pins>',
        );
    }, 240_000);

    it('failure injection: a tool restore dropped by the real per-turn budget is restated by the next prompt', () => {
        dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'pin: never push to main' });
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        // The turn has already spent the ceiling: the dispatcher's own counter, read before shaping.
        const ceiling = (JSON.parse(fs.readFileSync('src/config/hook-token-budget.json', 'utf8')) as {
            per_turn_aggregate_bytes: { ceiling_bytes: number };
        }).per_turn_aggregate_bytes.ceiling_bytes;
        const spend = turnSpendPath(project, 'dispatch-s');
        fs.mkdirSync(path.dirname(spend), { recursive: true });
        fs.writeFileSync(spend, JSON.stringify({ session: 'dispatch-s', bytes: ceiling }));
        const dropped = dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} });
        expect(dropped).not.toContain('<session-pins>');
        const restated = dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' });
        expect(restated).toContain('Restated after the last compaction');
        expect(restated).toContain('- never push to main');
    }, 240_000);

    it('failure injection: an unreadable boundary still restores through the tool call', () => {
        dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'pin: never push to main' });
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        const b = boundaryPath(project, 'dispatch-s');
        fs.rmSync(b);
        fs.mkdirSync(b);
        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' })).not.toContain('<session-pins>');
        expect(dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} })).toContain(
            '- never push to main',
        );
    }, 240_000);

    it('failure injection: a held restore-record lock still delivers, saying so', () => {
        dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'pin: never push to main' });
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        const companion = `${restorePath(project, 'dispatch-s')}.lock.held`;
        fs.mkdirSync(path.dirname(companion), { recursive: true });
        fs.writeFileSync(companion, '');
        const line = dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} });
        fs.rmSync(companion, { force: true });
        expect(line).toContain('- never push to main');
        expect(line).toContain('unlocked');
    }, 240_000);

    it('failure injection: a prompt-first restore is not dropped even when the previous turn spent the whole ceiling', () => {
        dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'pin: never push to main' });
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        const ceiling = (JSON.parse(fs.readFileSync('src/config/hook-token-budget.json', 'utf8')) as {
            per_turn_aggregate_bytes: { ceiling_bytes: number };
        }).per_turn_aggregate_bytes.ceiling_bytes;
        const spend = turnSpendPath(project, 'dispatch-s');
        fs.mkdirSync(path.dirname(spend), { recursive: true });
        fs.writeFileSync(spend, JSON.stringify({ session: 'dispatch-s', bytes: ceiling }));
        // A prompt starts a new turn, so the dispatcher resets the counter before shaping.
        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' })).toContain('- never push to main');
    }, 240_000);

    it('the post_tool_use exception, executable: the heaviest admissible restore through the dispatcher fits the language-mirror row, once', () => {
        const row = (JSON.parse(fs.readFileSync('src/config/hook-token-budget.json', 'utf8')) as {
            per_concern_caps_bytes: Record<string, number>;
        }).per_concern_caps_bytes['language-mirror'] as number;
        // Quote-heavy pins reach the escaped-byte cap; a system-locale language pin is the longest.
        // Twelve distinct pins, one letter plus 170 quotes each, two of them with 171:
        // exactly the 4,096 escaped-byte cap — the heaviest set capture admits.
        const texts = Array.from({ length: 12 }, (_, i) => `${'abcdefghijkl'[i]}${'"'.repeat(i < 2 ? 171 : 170)}`);
        expect(texts.reduce((n, t) => n + Buffer.byteLength(JSON.stringify(t)) - 2, 0)).toBe(4_096);
        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: texts.map((t) => `pin: ${t}`).join('\n') })).toContain(
            'Session pins: 12/12 held.',
        );
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        const line = dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} });
        expect(line).toContain('<session-pins>');
        for (const t of texts) expect(line).toContain(`- ${t}`);
        expect(Buffer.byteLength(JSON.stringify({ additional_context: line }))).toBeLessThanOrEqual(row);
        expect(dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} })).not.toContain(
            '<session-pins>',
        );
    }, 240_000);
});
~~~

## Unit tests — `tests/scripts/session_pins.test.ts` (228, all green)

- 2.1 capture — only an explicit line-start marker in the typed prompt captures `pin:` lines in order and ignores everything else
- 2.1 capture — only an explicit line-start marker in the typed prompt does not capture a pin from indented
- 2.1 capture — only an explicit line-start marker in the typed prompt does not capture a pin from mid-line
- 2.1 capture — only an explicit line-start marker in the typed prompt does not capture a pin from fenced code
- 2.1 capture — only an explicit line-start marker in the typed prompt does not capture a pin from pasted block
- 2.1 capture — only an explicit line-start marker in the typed prompt does not capture a pin from after a pasted document
- 2.1 capture — only an explicit line-start marker in the typed prompt does not capture a pin from host-injected region
- 2.1 capture — only an explicit line-start marker in the typed prompt does not capture a pin from empty body
- 2.1 capture — only an explicit line-start marker in the typed prompt a synthetic turn (task notification, system reminder) carries no capturable text
- 2.1 capture — only an explicit line-start marker in the typed prompt control characters cannot smuggle a second line into a pin
- 2.1 capture — only an explicit line-start marker in the typed prompt the hook stores a pin from a typed prompt and tells the turn
- 2.1 capture — only an explicit line-start marker in the typed prompt a prompt without a directive emits no pin notice — no standing bytes
- 2.1 capture — only an explicit line-start marker in the typed prompt `unpin:` removes one pin, `unpin: all` removes every pin
- 2.1 capture — only an explicit line-start marker in the typed prompt a synthetic prompt cannot remove a pin either
- 2.1 capture — only an explicit line-start marker in the typed prompt the kill switch stores nothing
- 2.1 capture — only an explicit line-start marker in the typed prompt pins are per session — one session never reads another one’s
- 2.2 restore — one re-emit after compaction, verbatim re-emits the pins verbatim on the first tool call after pre_compact, then goes quiet
- 2.2 restore — one re-emit after compaction, verbatim restores the language pin and the session pins together in one line
- 2.2 restore — one re-emit after compaction, verbatim restores pins although no language is pinned
- 2.2 restore — one re-emit after compaction, verbatim no pins and no language: the marker is consumed silently
- 2.2 restore — one re-emit after compaction, verbatim a post_tool_use without a compaction never re-emits pins
- 2.2 restore — one re-emit after compaction, verbatim the kill switch suppresses the restore
- 2.2 restore — one re-emit after compaction, verbatim a subagent receives the parent session’s pins
- 2.2 restore — one re-emit after compaction, verbatim a subagent of a session without pins gets nothing from this path
- 2.3 caps — overflow is refused and reported, never truncated refuses the 13th pin and says so
- 2.3 caps — overflow is refused and reported, never truncated a prompt with a hundred refused pins still produces a bounded notice
- 2.3 caps — overflow is refused and reported, never truncated refuses a pin over 300 characters whole, never a prefix of it
- 2.3 caps — overflow is refused and reported, never truncated admits exactly 300 characters, counted as characters not bytes
- 2.3 caps — overflow is refused and reported, never truncated 12 ASCII pins of 300 characters all fit the byte bound
- 2.3 caps — overflow is refused and reported, never truncated refuses a pin that would take the set over 4096 bytes, and says so
- 2.3 caps — overflow is refused and reported, never truncated the byte bound counts JSON escaping, so quote-heavy pins cannot double the restore line
- 2.3 caps — overflow is refused and reported, never truncated a duplicate pin is reported, not stored twice
- 2.3 caps — overflow is refused and reported, never truncated a hand-edited file over a cap reads as no pins, and is never rewritten as a filtered copy
- 2.3 caps — overflow is refused and reported, never truncated the worst admitted restore stays under the host 10,000-character line
- the chunk boundary a prompt with a directive and no loadable module tells the turn the pin was not stored
- the chunk boundary a prompt without a directive never loads the module
- the chunk boundary a missing module after a compaction costs the pins, never the language restore
- the chunk boundary bundled: an absent, a throwing or an export-less chunk loads as null
- the chunk boundary bundled: a chunk that is present but unusable is said on stderr; an absent one is not
- the chunk boundary a loader that throws is reported on stderr and costs the pins, never the turn
- the chunk boundary bundled, the module is the sibling chunk; from source, the _lib module
- council round 1 findings — regressions a ``` line inside a ```` block does not reopen capture; the text after the real close does count
- council round 1 findings — regressions a ~~~ line does not close a ``` fence, and a fence with an info string does not close one
- council round 1 findings — regressions an unclosed fence hides everything after it
- council round 1 findings — regressions removing a pasted block cannot splice its neighbours into a directive
- council round 1 findings — regressions a pin typed on its own line after a paste still counts
- council round 1 findings — regressions an unclosed pasted block hides everything after it
- council round 1 findings — regressions a prompt whose pin lines were all excluded is told they were not applied, never the module-failure one
- council round 1 findings — regressions a pin file holding malformed JSON is left untouched and the turn is told
- council round 1 findings — regressions a pin file holding another session’s file is left untouched and the turn is told
- council round 1 findings — regressions a pin file holding no pin list is left untouched and the turn is told
- council round 1 findings — regressions a pin file holding a non-string entry beside a valid one is left untouched and the turn is told
- council round 1 findings — regressions a pin file holding an oversized entry beside a valid one is left untouched and the turn is told
- council round 1 findings — regressions a pin file holding a control character in an entry is left untouched and the turn is told
- council round 1 findings — regressions a pin file holding a duplicate entry is left untouched and the turn is told
- council round 1 findings — regressions overlapping captures in separate processes lose no pin
- council round 1 findings — regressions retention follows session activity, not the age of the pin file
- the restore under the runtime per-turn budget survives beside every other post_tool_use concern at its slot cap, after a full prompt slot
- the restore under the runtime per-turn budget is dropped — and the drop recorded — only when the turn has already spent the ceiling
- council round 2 findings — regressions an invalid pin file after a compaction is reported, not restored as empty
- council round 2 findings — regressions a missing module after a compaction is reported when the session has pins, silent when it has none
- council round 2 findings — regressions with pins switched off, a missing module produces no notice and is never loaded
- council round 2 findings — regressions a prompt keeps the pins of a session with no language pin alive
- council round 2 findings — regressions the worst admitted pins plus the digest stay inside the subagent reply cap
- council round 3 findings — regressions a paste nested inside a paste cannot close the outer one early
- council round 3 findings — regressions a nested paste whose outer block never closes hides everything after it
- council round 3 findings — regressions a stray closing tag after a complete paste drops what came before it too
- council round 3 findings — regressions a closing paste tag with no opener drops everything before it
- council round 3 findings — regressions the full pipeline through the hook keeps a nested-paste directive out of the store
- the first prompt after a compaction restates the pins once restates them on the next prompt, then never again for that compaction
- the first prompt after a compaction restates the pins once `unpin: all` in that prompt is applied first, so nothing is restated
- the first prompt after a compaction restates the pins once a pin removed in that prompt is not restated; the rest are
- the first prompt after a compaction restates the pins once an unreadable pin file at that prompt is reported, not silently skipped
- the first prompt after a compaction restates the pins once a pin file that cannot even be opened at that prompt is reported too
- the first prompt after a compaction restates the pins once a missing module at that prompt is said on stderr only; the tool restore already told the user
- the first prompt after a compaction restates the pins once capture and restatement on one prompt stay inside the language-mirror row
- council round 3 — a subagent is told when the pins cannot be read an unreadable pin file gives the subagent a notice, not silence
- council round 5 — one transition per compaction, whichever event comes first prompt before tool call: the prompt delivers, the tool restore carries the language only, the next prompt restates once
- council round 5 — one transition per compaction, whichever event comes first tool call before prompt: restore, then one restatement, then silence
- council round 5 — one transition per compaction, whichever event comes first a restore record that cannot be written is never acted on by a prompt, so nothing repeats on every prompt
- council round 5 — one transition per compaction, whichever event comes first two settlements of one marker restate once
- council round 5 — one transition per compaction, whichever event comes first the subagent reply cap leaves at least 4 KB for the digest beside the largest admissible pin block
- council round 6 — restore state belongs to one compaction a restatement from compaction A cannot suppress the restore of compaction B
- council round 6 — restore state belongs to one compaction prompt first: consecutive prompts before any tool call deliver, restate once, then stay silent
- council round 6 — restore state belongs to one compaction simultaneous prompt-first settlements deliver once and restate once
- council round 6 — restore state belongs to one compaction retention prunes at most once a day
- council round 7 — fences keep their typed boundaries; one delivery per compaction a paste after a fence line cannot turn it into a closing fence
- council round 7 — fences keep their typed boundaries; one delivery per compaction through the hook, that shape neither adds a pin nor removes the held ones
- council round 7 — fences keep their typed boundaries; one delivery per compaction a prompt delivering while the tool restore runs: the tool does not repeat it, the next prompt restates once
- council round 7 — fences keep their typed boundaries; one delivery per compaction tool first then prompt: the tool restores and the prompt restates once — two, never three
- council round 7 — fences keep their typed boundaries; one delivery per compaction a delivery marker left from an earlier compaction (failed reset) is replaced, not obeyed
- council round 7 — fences keep their typed boundaries; one delivery per compaction a restore record that cannot be locked is said in the restore line itself
- council round 8 — one transaction per event over one restore record every interleaving of one compaction delivers at most twice and the first prompt never misses
- council round 8 — one transaction per event over one restore record a restatement owed by an older compaction is dropped when a newer one is delivered by a prompt
- council round 8 — one transaction per event over one restore record concurrent tool calls and prompts after one compaction, as separate hook processes: one delivery and one restatement at most, never none
- council round 9/10 — generations, paid debts, and the lock-failure bound a boundary written while a delivery holds the record survives it and opens the next compaction
- council round 9/10 — generations, paid debts, and the lock-failure bound a compaction opened while a restatement is owed replaces the debt with its own delivery
- council round 9/10 — generations, paid debts, and the lock-failure bound a lock failure on the owed restatement emits nothing and says so; the next prompt restates once
- council round 9/10 — generations, paid debts, and the lock-failure bound the whole bound: a tool restore that cannot lock the record, then the prompts — three pin lines, never four
- council round 9/10 — generations, paid debts, and the lock-failure bound once the debt is paid, later prompts do not load the module
- council round 11 — the compaction boundary needs neither the lock nor the chunk a missing chunk at pre_compact still opens the compaction for the later restore
- council round 11 — the compaction boundary needs neither the lock nor the chunk after a settled compaction, the first prompt of the next one delivers before any tool call
- council round 11 — the compaction boundary needs neither the lock nor the chunk with no record at all, a boundary still makes the first prompt deliver
- council round 11 — the compaction boundary needs neither the lock nor the chunk the record is never removed outside its lock: a held lock at pre_compact leaves it, and the boundary still opens the compaction
- council round 12 — acknowledge the boundary, then remove it a write that fails after the transaction read the boundary leaves the boundary, so the compaction stays open
- council round 12 — acknowledge the boundary, then remove it an acknowledged boundary stays in place and does not reopen the compaction
- council round 12 — acknowledge the boundary, then remove it a newer boundary written during a delivery is never removed by its cleanup
- council round 12 — acknowledge the boundary, then remove it after a compaction, a restore record that is unparseable counts as unsettled, not as settled
- council round 12 — acknowledge the boundary, then remove it after a compaction, a restore record that is another session counts as unsettled, not as settled
- council round 12 — acknowledge the boundary, then remove it without a compaction, a broken restore record injects nothing
- council round 13 — nothing deletes the boundary an unreadable pin file is delivered as its failure notice and recorded; the owed restatement carries the pins once they read
- council round 13 — nothing deletes the boundary an unreadable boundary opens the compaction but is never acknowledged
- council round 13 — nothing deletes the boundary a new boundary replaces the old one and opens the next compaction
- council round 13 — nothing deletes the boundary with pins switched off, pre_compact writes no boundary and a prompt touches nothing
- council round 13 — nothing deletes the boundary a prompt-first delivery is the first fire of a turn: the runtime per-turn budget cannot drop it
- council round 14 — failed boundary writes, empty and unreadable boundaries a boundary that cannot be written still restores the next compaction (previous one delivered by tool)
- council round 14 — failed boundary writes, empty and unreadable boundaries a boundary that cannot be written still restores the next compaction (previous one delivered by prompt)
- council round 14 — failed boundary writes, empty and unreadable boundaries an empty boundary is unknown to the bundle and the module alike: the prompt waits, the tool restore delivers
- council round 14 — failed boundary writes, empty and unreadable boundaries an unreadable boundary never makes prompts deliver; the tool restore of that compaction does, once
- council round 15 — the tool restore carries its own stamp a second tool restore with the same stamp delivers nothing — the record, not a race, prevents the duplicate
- council round 15 — the tool restore carries its own stamp prompt-first A, then B before any tool call with B's boundary write failing: B is still restored
- council round 15 — an absent or empty boundary opens nothing on the prompt path the module: with the boundary gone, a settled record owes the prompt nothing
- council round 15 — an absent or empty boundary opens nothing on the prompt path the bundle: an empty boundary after a settled compaction does not even load the module
- council round 16 — acknowledgements never move backward sequential: B restored after its boundary write failed, then a prompt reads the old stamp A — A is not reopened, B's restatement is paid once
- council round 16 — acknowledgements never move backward interleaved: a paused prompt holding an older acknowledged stamp delivers nothing and keeps the newer acknowledgement
- council round 16 — acknowledgements never move backward the bundle does not even load the module for an older acknowledged stamp
- council round 17 — fence closers, the acknowledgement window, isolated writes a closer followed by a non-breaking space does not close the fence: neither pin nor unpin inside applies
- council round 17 — fence closers, the acknowledgement window, isolated writes a closer followed only by spaces and tabs does close the fence
- council round 17 — fence closers, the acknowledgement window, isolated writes a stamp stays acknowledged across 512 later compactions, and the window is what the code says
- council round 17 — fence closers, the acknowledgement window, isolated writes a pin-lost marker that cannot be written does not stop the boundary write
- council round 18 — tool calls keep pins alive a tool call refreshes the pin file of a session with no language pinned
- council round 19 — replay, prune and loader failures a replayed prompt neither stores a pin nor claims it tried
- council round 19 — replay, prune and loader failures a prune stamp that cannot be read does not trigger a prune
- council round 19 — replay, prune and loader failures a loader that throws is a missing module, never a crashed hook
- council round 20 — helper contracts tightened where capture relies on them an unreadable pin file is never replaced by a capture
- council round 20 — helper contracts tightened where capture relies on them a nested same-name injected region cannot expose a pin or an unpin
- council round 21 — fence membership first, well-formed text, strict exclusion a stray closing paste tag inside a fence cannot break the fence and let pin or unpin out
- council round 21 — fence membership first, well-formed text, strict exclusion fence membership is read from the text as typed: a region inside a fence stays hidden, a line after the fence counts
- council round 21 — fence membership first, well-formed text, strict exclusion a lone surrogate becomes U+FFFD, so no stored or previewed character serialises past four bytes
- council round 21 — fence membership first, well-formed text, strict exclusion every notice category full of four-byte characters stays inside the language-mirror row
- council round 21 — fence membership first, well-formed text, strict exclusion when the lock guard cannot be created, a capture reports failure instead of writing without exclusion
- council round 22 — exclusions are spans of the original text; failed restores keep a retry a paste spanning fences cannot release a directive, whatever the order of the wrappers
- council round 22 — exclusions are spans of the original text; failed restores keep a retry a paste spanning fences with unpin cannot release a directive, whatever the order of the wrappers
- council round 22 — exclusions are spans of the original text; failed restores keep a retry a region spanning fences cannot release a directive, whatever the order of the wrappers
- council round 22 — exclusions are spans of the original text; failed restores keep a retry a fence spanning a paste cannot release a directive, whatever the order of the wrappers
- the shipped chunk built with the shipping options and loaded through the bundled path, it captures and restores
- host regions are removed, not a reason to drop what the user typed after them a pin typed after a host-injected region is captured
- council round 23 — attributed envelopes, independent region spans, linear work, uncertain paths an attributed agent message in a composite prompt cannot create or delete a pin
- council round 23 — attributed envelopes, independent region spans, linear work, uncertain paths an attributed region nested in another cannot create or delete a pin
- council round 23 — attributed envelopes, independent region spans, linear work, uncertain paths an unclosed region opener inside a fence cannot create or delete a pin
- council round 23 — attributed envelopes, independent region spans, linear work, uncertain paths overlapping regions of different names cannot create or delete a pin
- council round 23 — attributed envelopes, independent region spans, linear work, uncertain paths capture stays linear on an adversarial prompt of unmatched tags and pastes
- council round 23 — attributed envelopes, independent region spans, linear work, uncertain paths a pin directory that cannot be checked is not treated as "no pins": the tool restore reports instead of staying silent
- council round 24 — quoted attributes, settled restores, malformed paste tags a quoted > inside an attribute cannot hide an envelope opener
- council round 24 — quoted attributes, settled restores, malformed paste tags a closer quoted inside an attribute cannot hide an envelope opener
- council round 24 — quoted attributes, settled restores, malformed paste tags malformed paste openers with no closing > parse in linear time
- council round 25 — multi-line envelopes, the marker claim, API skew a multi-line envelope opener cannot add or delete a pin
- council round 25 — multi-line envelopes, the marker claim, API skew an opener with an unclosed attribute cannot add or delete a pin
- council round 25 — multi-line envelopes, the marker claim, API skew an envelope that starts inside a fence cannot add or delete a pin
- council round 25 — multi-line envelopes, the marker claim, API skew a pin typed before any tag-like line still counts
- council round 25 — multi-line envelopes, the marker claim, API skew a chunk missing part of the API, or throwing, is a missing module that keeps the retry
- council round 26 — mid-line openers, claim cleanup a mid-line envelope opener stops unpin: all from applying
- council round 26 — mid-line openers, claim cleanup a mid-line envelope opener stops pin: from applying
- council round 26 — mid-line openers, claim cleanup a claim file that cannot be removed does not stop the restore
- council round 27 — separators inside a directive line a pin containing U+2028 is captured whole, the separator as a space
- council round 27 — separators inside a directive line a pin containing U+2029 is captured whole, the separator as a space
- council round 27 — separators inside a directive line a pin containing a carriage return is captured whole, the separator as a space
- council round 27 — separators inside a directive line unpin with a separator matches the stored, normalised pin
- council round 27 — separators inside a directive line retention never prunes a pin file whose age cannot be read
- council round 28 — fence recognition in linear time a long delimiter run followed by a line terminator . does not match parses fast
- council round 28 — fence recognition in linear time the prefix scan reads fences exactly as before
- council round 29 — no directive vanishes without a word a pin whose own text contains < is captured, and the lead still ends after it
- council round 29 — no directive vanishes without a word an opener on a directive line is not applied, still excludes everything after it, and is reported
- council round 29 — no directive vanishes without a word a directive carrying an inline envelope is not applied and is counted
- council round 29 — no directive vanishes without a word a directive carrying a closing tag is not applied and is counted
- council round 29 — no directive vanishes without a word a directive carrying an attributed opener is not applied and is counted
- council round 29 — no directive vanishes without a word a pin line whose bare opener is closed on a later line is not applied, and is counted
- council round 29 — no directive vanishes without a word a unpin line whose bare opener is closed on a later line is not applied, and is counted
- council round 29 — no directive vanishes without a word a pin, closer in another case line whose bare opener is closed on a later line is not applied, and is counted
- council round 29 — no directive vanishes without a word through the hook, such a line neither adds a pin nor removes one, and its contents never reach a subagent
- council round 29 — no directive vanishes without a word a bare opener with no later closer stays a pin: an earlier closer does not count
- council round 29 — no directive vanishes without a word markup that no envelope produces stays a pin: Array<string>, <br/>, a < b
- council round 29 — no directive vanishes without a word directives in a host-generated prompt are not applied, and the turn says so
- council round 29 — no directive vanishes without a word a directive after a heading is not applied, and the turn says so
- council round 29 — no directive vanishes without a word a directive after a tag-like line is not applied, and the turn says so
- council round 29 — no directive vanishes without a word a directive inside a paste is not applied, and the turn says so
- council round 29 — no directive vanishes without a word applied and not-applied directives in one prompt are both reported
- the shared restore-record reader absent → owed is null
- the shared restore-record reader settled, no new stamp → owed is {"session_id":"s1","delivered":true,"pending":false,"seen":["A"]}
- the shared restore-record reader settled, new stamp → owed is {"session_id":"s1","delivered":true,"pending":false,"seen":["A"]}
- the shared restore-record reader debt owed → owed is {"session_id":"s1","delivered":true,"pending":true,"seen":["A"]}
- the shared restore-record reader undelivered → owed is {"session_id":"s1","delivered":false,"pending":false,"seen":["A"]}
- the shared restore-record reader foreign → owed is {"session_id":"x","delivered":true,"pending":false,"seen":[]}
- the shared restore-record reader non-boolean delivered → owed is {"session_id":"s1","delivered":"yes","seen":[]}
- the shared restore-record reader non-boolean pending → owed is {"session_id":"s1","delivered":true,"pending":"yes","seen":["A"]}
- the shared restore-record reader no pending field → owed is {"session_id":"s1","delivered":true,"seen":["A"]}
- the shared restore-record reader unparseable → owed is { broken
- the shared restore-record reader a non-boolean pending is read as corruption, not as false
- the shared restore-record reader a capture admits exactly the 4,096-byte cap and refuses one escaped byte more
- council round 30 — no commit before the line is out a tool restore that throws records nothing, so the next prompt still delivers the pins
- council round 30 — no commit before the line is out a prompt whose line never reached the host after the record committed is restated by the next prompt
- council round 35 — bounds that hold for the lifetime of what can spend them a retention stamp that cannot be read skips the prune and says so
- council round 35 — bounds that hold for the lifetime of what can spend them a missing chunk on the restatement path adds nothing to the context, on any prompt, and says so on stderr
- council round 35 — bounds that hold for the lifetime of what can spend them a throwing chunk on the restatement path adds nothing to the context, on any prompt, and says so on stderr
- council round 35 — bounds that hold for the lifetime of what can spend them a module that loads and then throws is reported as a failure on stderr, not as a missing file
- council round 35 — bounds that hold for the lifetime of what can spend them a capture that throws at runtime puts its error on stderr and says "failed", not "could not be loaded"
- council round 35 — bounds that hold for the lifetime of what can spend them a tool restore that throws at runtime puts its error on stderr and says "failed", not "could not be loaded"
- council round 35 — bounds that hold for the lifetime of what can spend them retention keeps a live session's restore record however old, and removes a gone session's
- council round 35 — bounds that hold for the lifetime of what can spend them retention also removes a gone session's boundary and lock sentinel, and keeps a live session's
- council round 44 — replay, the language restore, linear envelope checks replayed tool calls after a compaction restore no pins, however often they run
- council round 44 — replay, the language restore, linear envelope checks a pin-lost marker that cannot be taken is reported and not acted on, on any tool call
- council round 44 — replay, the language restore, linear envelope checks with pins switched off, the language restore fires once per compaction and the next tool call is silent
- council round 44 — replay, the language restore, linear envelope checks a directive line of unclosed spaced openers is checked in linear time
- council round 45 — openers split across lines, synthetic prompts, the marker handoff an opener whose attributes start on the next line on a directive line is not applied, and is counted
- council round 45 — openers split across lines, synthetic prompts, the marker handoff an opener with a space before > on a directive line is not applied, and is counted
- council round 45 — openers split across lines, synthetic prompts, the marker handoff an unpin opener at the end of the line on a directive line is not applied, and is counted
- council round 45 — openers split across lines, synthetic prompts, the marker handoff a host-generated prompt with directives and no loadable module tells the turn they were not applied
- council round 45 — openers split across lines, synthetic prompts, the marker handoff a marker written by a newer compaction while a tool restore takes the older one survives it
- council round 46 — an unreadable or oversized record, a throwing synthetic capture a settled compaction whose restore record becomes unreadable is not reopened, on any prompt
- council round 46 — an unreadable or oversized record, a throwing synthetic capture a restore record with more stamps than the window is invalid, not filtered into validity
- council round 46 — an unreadable or oversized record, a throwing synthetic capture a restore record with an oversized stamp is invalid, not filtered into validity
- council round 46 — an unreadable or oversized record, a throwing synthetic capture a restore record with a non-string stamp is invalid, not filtered into validity
- council round 46 — an unreadable or oversized record, a throwing synthetic capture a host-generated prompt with directives and a throwing capture still tells the turn they were not applied
- council round 46 — an unreadable or oversized record, a throwing synthetic capture a host-generated prompt with directives and an incomplete API still tells the turn they were not applied
- council round 47 — one admission rule for every stamp an oversized boundary stamp opens nothing, writes no invalid record, and does not loop
- council round 47 — one admission rule for every stamp an oversized marker stamp is restored as unknown and never written into the record
- council round 47 — one admission rule for every stamp a record with a duplicated stamp is invalid
- council round 47 — one admission rule for every stamp every record a long mixed sequence writes passes the shared reader
