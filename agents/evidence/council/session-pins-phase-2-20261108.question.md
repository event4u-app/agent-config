<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-11-08 for the ratification of
     branch feat/session-pins-phase-2, committed verbatim beside the record. -->

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
- Budget rows: the dispatch-bundle ceiling 1,585,000 → 1,586,500 B (+1,933 B
  measured), a new chunk row for the pin module (20,300 B; measured 19,643), the
  subagent-constraints chunk ceiling 24,500 → 27,600 B (measured 26,732), and
  the `language-mirror` per-concern injection row 2,048 → 5,120 B, with a stated
  exception on the `post_tool_use` slot row for the one restore fire per
  compaction.

The roadmap that asks for this: pins are entered by an explicit user marker
only, never extracted by a model; restore through the existing marker pattern,
no second mechanism; no new always-on bytes.

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
const FENCE = /^\s*(```|~~~)/;
const PASTED = /<pasted_content\b[^>]*>[\s\S]*?<\/pasted_content>/gi;

export function pinsDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return (env[KILL_SWITCH] ?? '').trim() === '1';
}

/** The span of a prompt a pin may come from: the human-typed lead, pastes and fences removed. */
export function capturableText(prompt: string): string {
    if (isSyntheticPrompt(prompt)) return '';
    const lead = humanAuthoredLead(stripInjectedRegions(prompt.replace(PASTED, '')));
    const kept: string[] = [];
    let inFence = false;
    for (const line of lead.split('\n')) {
        if (FENCE.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (!inFence) kept.push(line);
    }
    return kept.join('\n');
}

/** Control characters become spaces so a pin is one plain line wherever it is restored. */
function normalise(text: string): string {
    return text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}

/** Bytes the pins occupy inside a JSON string — what the restore line actually carries. */
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

/** This session's pins; a foreign, unreadable or malformed file reads as none. */
export function loadPins(consumer_root: string, session_id: string): string[] {
    if (!has_stable_session_id(session_id)) return [];
    try {
        const parsed = JSON.parse(fs.readFileSync(statePath(consumer_root, session_id), 'utf8')) as unknown;
        if (!owns_session_state(parsed, session_id)) return [];
        const pins = (parsed as { pins?: unknown }).pins;
        if (!Array.isArray(pins)) return [];
        // The file is re-bounded on read: a hand-edited or foreign-version file
        // must not carry more into a restore than capture would have admitted.
        const kept: string[] = [];
        for (const p of pins) {
            if (typeof p !== 'string' || p === '' || [...p].length > MAX_PIN_CHARS) continue;
            if (kept.length >= MAX_PINS || bytes([...kept, p]) > MAX_PINS_BYTES) break;
            kept.push(normalise(p));
        }
        return kept;
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
 * capture notice, or null when the prompt carries none. A failed write is
 * reported in the notice — the user must not believe a pin is held that is not.
 */
export function capture(consumer_root: string, session_id: string, prompt: string, now: string): string | null {
    const directives = extractDirectives(prompt);
    if (directives.length === 0) return null;
    if (!has_stable_session_id(session_id)) {
        return 'Session pins: NOT stored — this host sent no session id, so a pin could not be restored. Tell the user.';
    }
    const result = applyDirectives(loadPins(consumer_root, session_id), directives);
    try {
        savePins(consumer_root, session_id, result.pins, now);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `Session pins: NOT stored, the state write failed (${msg.slice(0, 120)}). Tell the user.`;
    }
    return captureNotice(result);
}

/**
 * Days an untouched pin file survives. Longer than language-mirror's 7 because a
 * pin file is written only when a pin changes, so a long session that set its
 * pins once would otherwise lose them while still running. A convention, not a
 * measurement.
 */
export const PIN_RETENTION_DAYS = 30;

export function pruneStalePins(consumer_root: string, now_ms: number): number {
    return prune_stale_session_states(path.join(consumer_root, STATE_DIR), now_ms, PIN_RETENTION_DAYS);
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

/** The restore block for the hook, or '' when switched off or nothing is pinned. */
export function restoreFor(consumer_root: string, session_id: string, env: NodeJS.ProcessEnv): string {
    return pinsDisabled(env) ? '' : restoreText(loadPins(consumer_root, session_id));
}

/**
 * The surface `language-mirror` loads from the chunk. A function because the
 * shared chunk loader accepts a function export only.
 */
export function sessionPins(): SessionPins {
    return { captureFor, restoreFor };
}
export interface SessionPins {
    readonly captureFor: typeof captureFor;
    readonly restoreFor: typeof restoreFor;
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

## The diff of the existing files

~~~diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 7bc9321439..42a7181ee5 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1585000,
+    "max_bytes": 1586500,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -230,6 +230,25 @@
             "what_was_added": "The thin pass now writes the startup-contract stub form: `thin_entry_with_contract`, the installed stub shape and `shortDescription` in thin_rules (+1,960 B), the rule-bodies index and pointer resolution in installThinLayer (+1,369 B), `startupContract` in rule_law_section (+729 B), and the contract-bearing exclusion in layerPromotion (+248 B) — 60,848 B against 56,542 B on main, attributed per input with the chunk's own esbuild options.",
             "why_it_could_not_be_avoided": "The session-start promotion must write the same contract stubs the installer writes, so it imports the one stub builder; a second, smaller builder would let the promoted layer and the installed layer disagree about what a stub carries.",
             "what_would_have_caught_it": "Nothing earlier: the growth is the contract stub builder the installed layer and the promotion share."
+        },
+        {
+            "date": "2026-11-08",
+            "from": 1585000,
+            "to": 1586500,
+            "by": "agent, feat/session-pins-phase-2 (road-to-state-and-pins-across-compaction 2.1-2.2)",
+            "what_was_added": "Session pins in `language-mirror`: the `pin:` prompt test, the call into the pin chunk on capture and after a compaction, the combined language-plus-pins restore in `_reEmitAfterCompaction`, and `hooks/session_pins_loader.ts` (+1,933 B: 1,583,938 B on origin/main to 1,585,871 B, both measured with `build:hooks` on APFS-cloned node_modules).",
+            "why_it_could_not_be_avoided": "Room was made first: the pin module itself (capture, caps, state, restore text) ships as its own chunk, which took the first measurement from +7,211 B to +1,933 B. What stays in the bundle is the part that must run on every prompt and every post-compaction tool call of the eager `language-mirror` concern: the directive test, the loader and the restore branch. Roadmap 2.2 requires the language-mirror marker path, so a lazy concern of its own was not an option.",
+            "what_would_have_caught_it": "Nothing earlier: the base headroom (1,062 B) was smaller than the loader and the restore branch together. Sized to the measurement plus 629 bytes of headroom."
+        },
+        {
+            "date": "2026-11-08",
+            "chunk": "src/scripts/hooks/subagent_constraints_hook.ts",
+            "from": 24500,
+            "to": 27600,
+            "by": "agent, feat/session-pins-phase-2 (road-to-state-and-pins-across-compaction 2.2)",
+            "what_was_added": "The parent session's pins handed to every subagent: `subagentPinsText` and the read of the pin file through `_lib/session_pins.ts` (+2,889 B: 23,843 B on origin/main to 26,732 B).",
+            "why_it_could_not_be_avoided": "A subagent starts without the conversation its pins were typed in, and roadmap 2.2 names this carrier. The chunk imports the same reader the capture writes with, so the two cannot disagree about the file; loading the pin chunk from inside another CJS chunk has no `import.meta.url` to resolve it from.",
+            "what_would_have_caught_it": "Nothing earlier: the growth is the feature. Sized to the measurement plus about 3 %."
         }
     ],
     "chunks": [
@@ -251,6 +270,12 @@
             "registered_at": "2026-10-27",
             "derivation": "Measured 51,457 bytes on 2026-11-04, after origin/main (b53718de25) added the shadow-only sibling-gap rule over render rows to the same linter module (+6,185 B, carried whole for the reason below), so RAISED from 47,000 to 53,000 (about 3 % over this reading). Measured 45,272 bytes on 2026-11-03: the consistency check `design-pass` runs on a UI write (the `ui:audit` computation, the control-role parser, the two consistency rules, the shadow recorder with the per-finding record ratification round 8 asked for, the uncommitted-primitive stamp of rounds 5 and 6, the shadow report's evidence check, row validation and empty-window verdict of rounds 11 to 14, which share the module, the file families that bind a canonical to the file kinds that define it, read from live module-level code with re-exports and imported bindings excluded (rounds 14 to 17), and the primitive-file list that keeps a newly dirty feature file from forcing a recompute; 36,545 B before those rounds). RAISED from 43,000 (39,896 B plus about 8 %) to 45,000, then to 47,000 (about 4 % over this reading) when the definition reader of round 17 passed 45,000, because: the chunk carries the linter module whole, its CLI included, since the module's own entry point keeps `main` reachable. Splitting the rules from the CLI would take that back out and is left for a later change. No growth is queued: no further consistency rule is planned, and the box-metrics rule already ships in it. Required on a UI write alone, so no other dispatch parses it; the bundle carries only its loader and two call sites, the 2026-10-27 raise of `max_bytes`. A missing or mis-digested chunk costs the consistency finding, never the event (`design_consistency_loader.ts`)."
         },
+        {
+            "entry": "src/scripts/_lib/session_pins.ts",
+            "max_bytes": 20300,
+            "registered_at": "2026-11-08",
+            "derivation": "Measured 19,643 bytes on 2026-11-08 (capture, caps, per-session state, restore text, and the parts of `_lib/prompt_shape` and `hooks/state_io` they import). The ceiling is that reading plus about 3 %, rounded, with no growth queued. Loaded by `language-mirror` through `hooks/session_pins_loader.ts` on a prompt carrying a `pin:` or `unpin:` line and on the one tool call after a compaction; a missing chunk is reported on the capture turn and costs the pin restore, never the language restore or the dispatch."
+        },
         {
             "entry": "src/scripts/chat_history.ts",
             "max_bytes": 232000,
@@ -283,7 +308,7 @@
         },
         {
             "entry": "src/scripts/hooks/subagent_constraints_hook.ts",
-            "max_bytes": 24500,
+            "max_bytes": 27600,
             "registered_at": "2026-10-24",
             "derivation": "Measured 23,843 bytes on 2026-10-24 (the concern with the user layer of road-to-a-cold-start-paid-once D16, the shared `_lib/rule_law_section` law-extent reader, and the hook stdin reader; `yaml` external as for `chat_history`). The ceiling is that reading plus about 3 %, rounded, with no growth queued; the 2026-10-24 raise from 12,500 is the matching `raise_log` entry. road-to-a-tick-the-shipped-path-earns 2.4 under decision A9 (council, 2026-10-23): the constraint carrier ships as a lazy chunk with its own ceiling, and the dispatch ceiling is not raised. Its LAZY_CONCERNS row measured +159 bytes in the dispatch bundle (1,553,363 to 1,553,522 B, same gate run on the base and with the row), under the existing 1,554,000 ceiling, so no loader stub raise was needed. Bound on claude `subagent_start` alone; a missing chunk falls back to the spawn path and costs latency, never the digest."
         },
diff --git a/src/config/hook-token-budget.json b/src/config/hook-token-budget.json
index 7a40295422..e87a71de2a 100644
--- a/src/config/hook-token-budget.json
+++ b/src/config/hook-token-budget.json
@@ -14,8 +14,8 @@
   "handoff-context_reason": "consume-once handoff injection, deleted after delivery — the one legitimately large one-shot",
   "session-canary": 2048,
   "session-canary_reason": "full canary contract once at session_start; the per-turn beat is one line",
-  "language-mirror": 2048,
-  "language-mirror_reason": "the measured 626-wrong-turn failure class justifies a full-paragraph pin per turn",
+  "language-mirror": 5120,
+  "language-mirror_reason": "the measured 626-wrong-turn failure class justifies a full-paragraph pin per turn (at most 771 B per reply line, measured). RAISED 2048 -> 5120 on 2026-11-08 by road-to-state-and-pins-across-compaction 2.1-2.3: the same concern now carries the user's session pins, and only on two fires — the turn a prompt carries a `pin:`/`unpin:` line (the language pin plus a capture notice that names at most 3 entries per list, 40 characters each, and counts the rest) and the one tool call after a compaction (the language pin plus the pins verbatim). Every other turn is unchanged. The bound is by construction, not by sampling: pins are capped at 12 x 300 characters and 4,096 JSON-escaped bytes together (`MAX_PINS_BYTES` in `_lib/session_pins.ts`), so a restore line is at most 771 + 4,096 + the block's fixed wrapper and per-pin prefixes, about 5,090 B; the worst shapes measured were 4,562 B (restore) and 4,778 B (capture notice with every list full of 4-byte characters). Both stay under the host's 10,000-character additionalContext line.",
   "council-availability": 1536,
   "council-availability_reason": "session_start availability block incl. resolved path + member list",
   "session-register": 2048,
@@ -49,6 +49,7 @@
   "user_prompt_submit_reason": "RAISED 4096 -> 16384 on 2026-09-07 by road-to-delivery-for-every-host 3.2, under owner ruling E2, which assigns this move to the run that flipped the rule layer to its delivery form (then a settings key, removed by road-to-a-setup-that-decides-itself 4.4) and is the activation charge the `rule-inject` row below defers to it. THE NUMBER IS MEASURED, NOT CHOSEN: 16,384 is the p90 gate-open fire size of the delivery concern over the frozen `tests/eval/routing-matrix` corpus rounded UP to 512 bytes, exactly as E2 specifies. Distribution over 318 gate-open fires: p50 6,674 B, p90 16,188 B, max 20,406 B. Reproduce it from `_lib/rule_injection.ts::matchTierRules` + `selectForInjection` at `hooks/rule_inject_hook.ts::CAP_BYTES` over that corpus. NOT config weakening, and the guard agrees by its own classification: `hooks/block_config_weakening.ts:96-98` classifies `*-budget.json` as `advisory`, so its decide() path returns `warn` and never a block — treat that warning as expected and documented. `pre_tool_use` is deliberately NOT raised alongside it: the concern's binding on that slot was REMOVED in the same change, so nothing new emits there and its 2,048 stands.",
   "pre_tool_use": 2048,
   "post_tool_use": 2048,
+  "post_tool_use_reason": "Per ordinary fire. ONE named exception, stated rather than hidden: the single tool call after a compaction carries the `language-mirror` restore (language pin plus session pins, at most about 5,090 B, see that row), once per compaction event — the same restore role session_start plays for the rule layer. The bench replays fixtures with no pin state, so it cannot see that fire; the runtime per-turn aggregate in `hooks/injection_budget.ts` still applies to it.",
   "stop": 2048,
   "session_end": 1024,
   "pre_compact": 2048,
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index abc137a56e..904b33fbbe 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -33,6 +33,9 @@ export const HOOK_CHUNKS = Object.freeze([
         outfile: 'dist/hooks/reference_duty.chunk.cjs',
         external: Object.freeze(['yaml']),
     }),
+    // Required by `language-mirror` on a `pin:` prompt and after a compaction
+    // alone (`session_pins_loader.ts`).
+    Object.freeze({ entry: 'src/scripts/_lib/session_pins.ts', outfile: 'dist/hooks/session_pins.chunk.cjs' }),
     // Required by `design-pass` on a UI write alone (`design_consistency_loader.ts`).
     Object.freeze({
         entry: 'src/scripts/_lib/design_consistency_pass.ts',
diff --git a/src/scripts/hooks/subagent_constraints_hook.ts b/src/scripts/hooks/subagent_constraints_hook.ts
index 228fff782d..a963269a43 100644
--- a/src/scripts/hooks/subagent_constraints_hook.ts
+++ b/src/scripts/hooks/subagent_constraints_hook.ts
@@ -33,6 +33,10 @@
  * definition that stops skipping stops receiving the digest. A type that is not
  * a plain id (a plugin's `plugin:agent`, a path) is not looked up.
  *
+ * Every subagent, whatever its definition, also receives the parent session's
+ * pins (`_lib/session_pins.ts`) ahead of the digest; a session without pins
+ * changes nothing here.
+ *
  * Ships in its own chunk (decision A9), `yaml` external like `chat_history`'s:
  * the dispatch bundle carries only its `LAZY_CONCERNS` row. Kill switch: `AGENT_CONFIG_SUBAGENT_CONSTRAINTS=off`.
  */
@@ -44,6 +48,7 @@ import { fileURLToPath, pathToFileURL } from 'node:url';
 import { parse as parseYaml } from 'yaml';
 
 import { lawSections, ruleBody } from '../_lib/rule_law_section.js';
+import { loadPins, pinsDisabled } from '../_lib/session_pins.js';
 import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
 import { readHookStdin } from './hook_stdin.js';
 
@@ -509,8 +514,30 @@ export function digestFor(envelope: unknown, env: NodeJS.ProcessEnv = process.en
     const projectDir =
         str(envelope, 'workspace_root', 'project_root') ?? str(payload, 'cwd') ?? env['CLAUDE_PROJECT_DIR'] ?? process.cwd();
     const configDir = env['CLAUDE_CONFIG_DIR'] || path.join(os.homedir(), '.claude');
-    if (!definitionSkipsInstructions(projectDir, agentType, configDir)) return null;
-    return instructionDigest(projectDir, EMISSION_MAX_BYTES, configDir);
+    const sessionId = str(envelope, 'session_id') ?? str(payload, 'session_id');
+    const pins = pinsDisabled(env) || sessionId === null ? '' : subagentPinsText(loadPins(projectDir, sessionId));
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
+export function subagentPinsText(pins: readonly string[]): string {
+    if (pins.length === 0) return '';
+    return [
+        '<session-pins>',
+        'Constraints the user pinned in the session that started you. They apply to your work too:',
+        ...pins.map((p) => `- ${p}`),
+        '</session-pins>',
+    ].join('\n');
 }
 
 export function main(): number {
diff --git a/src/scripts/language_mirror_hook.ts b/src/scripts/language_mirror_hook.ts
index bcd7f20679..a98b3ccb07 100644
--- a/src/scripts/language_mirror_hook.ts
+++ b/src/scripts/language_mirror_hook.ts
@@ -66,6 +66,12 @@
  * `fr_FR` to English because the classifier has no French would pin a language
  * the user never wrote, which is worse than carrying no pin.
  *
+ * SESSION PINS ride the same marker (road-to-state-and-pins-across-compaction
+ * Phase 2): a prompt line starting `pin:` is captured on this event, and the one
+ * `post_tool_use` after a compaction restores the pins with the language pin.
+ * The pin module ships as its own chunk (`hooks/session_pins_loader.ts`); its
+ * header carries the capture rules and the caps.
+ *
  * Never blocks (`fail_closed: false`, `severity: advisory`). Exit 0 always.
  */
 import fs from "node:fs";
@@ -88,6 +94,11 @@ import {
   isSyntheticPrompt,
   stripInjectedRegions,
 } from "./_lib/prompt_shape.js";
+import { loadSessionPins } from "./hooks/session_pins_loader.js";
+import type { SessionPins } from "./_lib/session_pins.js";
+
+/** How the pin module is reached; injectable because a test runner cannot `require` the TS source. */
+export type PinsLoader = () => SessionPins | null;
 
 const EXIT_ALLOW = 0;
 // Severity is taken from the EXIT CODE, not from the `decision` field in the
@@ -686,6 +697,8 @@ export function _reEmitAfterCompaction(
   consumer_root: string,
   session_id: string,
   write_json: StateWriter = atomic_write_json,
+  env: NodeJS.ProcessEnv = process.env,
+  load_pins: PinsLoader = loadSessionPins,
 ): number {
   if (!hasStableSessionId(session_id)) {
     return EXIT_ALLOW; // BLOCKER 2 — nothing was persisted, so nothing to restore.
@@ -699,20 +712,22 @@ export function _reEmitAfterCompaction(
   // decides and writes inside the lock, so two overlapping post_tool_use calls
   // cannot both advance past the same counter value nor both emit at the
   // threshold.
-  return _withToolWriteLock(consumer_root, session_id, EXIT_ALLOW, () => {    const previous = _loadState(path.join(consumer_root, statePathFor(session_id)));
+  return _withToolWriteLock(consumer_root, session_id, EXIT_ALLOW, () => {
+    const previous = _loadState(path.join(consumer_root, statePathFor(session_id)));
     const language = previous.language as Verdict | undefined;
     const source: PinSource = previous.source === "system-locale" ? "system-locale" : "prompt";
     // Clear FIRST: if the write below throws, the marker must not survive to
     // re-fire on every subsequent tool call — that is the shape § 6.2 refuses.
     _clearPinLost(consumer_root, session_id);
-    if (language !== "de" && language !== "en") {
-      return EXIT_ALLOW;
-    }
+    // Session pins ride the same marker (road-to-state-and-pins-across-compaction
+    // 2.2): one restore per compaction event, no second mechanism. They are
+    // owned by their own per-session file, so they restore even when no
+    // language is pinned.
+    const pins = load_pins()?.restoreFor(consumer_root, session_id, env) ?? "";
     // A foreign session's pin is not this session's to restore — same reading as
     // `nextState`, for the same shared-state reason.
-    if (!_ownsPin(previous, session_id)) {
-      return EXIT_ALLOW;
-    }
+    let restoreLanguage =
+      (language === "de" || language === "en") && _ownsPin(previous, session_id);
     // The pin is about to be fresh in context again, so the distance counter
     // starts over. Without this the two re-emit triggers would drift apart and
     // a post-compaction session could re-state the pin twice in a row.
@@ -721,15 +736,21 @@ export function _reEmitAfterCompaction(
     // A reset that does not land leaves the counter at 149, so the next successful
     // tool-hook write reaches 150 and emits a SECOND reminder — which contradicts
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
       `${JSON.stringify({
         decision: "warn",
-        reason: noticeText(language, source),
-        additional_context: pinText(language, source),
+        reason: restoreLanguage ? noticeText(lang, source) : "Session pins restored after compaction.",
+        additional_context: [restoreLanguage ? pinText(lang, source) : "", pins]
+          .filter((part) => part !== "")
+          .join("\n\n"),
       })}\n`,
     );
     return EXIT_WARN;
@@ -1041,16 +1062,25 @@ export function _onToolUse(
   consumer_root: string,
   session_id: string,
   write_json: StateWriter = atomic_write_json,
+  env: NodeJS.ProcessEnv = process.env,
+  load_pins: PinsLoader = loadSessionPins,
 ): number {
   if (_pinLost(consumer_root, session_id)) {
-    return _reEmitAfterCompaction(consumer_root, session_id, write_json);
+    return _reEmitAfterCompaction(consumer_root, session_id, write_json, env, load_pins);
   }
   return _reEmitAfterDistance(consumer_root, session_id, write_json);
 }
 
+/**
+ * A prompt that could carry a pin directive. Checked here, in the bundle, so
+ * the pin chunk is loaded for such prompts only; the chunk decides which lines
+ * count, and a missing chunk is said, never swallowed.
+ */
+const PIN_DIRECTIVE = /^(?:un)?pin:/im;
+
 export function run(
   stdin_text: string,
-  options: { consumer_root: string; env?: NodeJS.ProcessEnv; write_json?: StateWriter },
+  options: { consumer_root: string; env?: NodeJS.ProcessEnv; write_json?: StateWriter; load_pins?: PinsLoader },
 ): number {
   let envelope: JsonObject = {};
   if (stdin_text.trim()) {
@@ -1086,7 +1116,13 @@ export function run(
     return EXIT_ALLOW;
   }
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
 
   const prompt = _extractPrompt(payload);
@@ -1154,9 +1190,28 @@ export function run(
     }
   }
 
+  // Session pins (road-to-state-and-pins-across-compaction 2.1): captured from
+  // this prompt's `pin:` lines only. The notice is emitted on the turn a
+  // directive arrives and never otherwise — no standing bytes.
+  const pinNotice = PIN_DIRECTIVE.test(prompt)
+    ? ((options.load_pins ?? loadSessionPins)()?.captureFor(options.consumer_root, session_id, prompt, options.env ?? process.env) ??
+      "Session pins: NOT stored, the pin module could not be loaded. Tell the user.")
+    : null;
+
   if (effective === "de" || effective === "en") {
+    const context = pinText(effective, effectiveSource);
+    process.stdout.write(
+      `${JSON.stringify({
+        decision: "warn",
+        reason: noticeText(effective, effectiveSource),
+        additional_context: pinNotice === null ? context : `${context}\n\n${pinNotice}`,
+      })}\n`,
+    );
+    return EXIT_WARN;
+  }
+  if (pinNotice !== null) {
     process.stdout.write(
-      `${JSON.stringify({ decision: "warn", reason: noticeText(effective, effectiveSource), additional_context: pinText(effective, effectiveSource) })}\n`,
+      `${JSON.stringify({ decision: "warn", reason: "Session pins updated.", additional_context: pinNotice })}\n`,
     );
     return EXIT_WARN;
   }
~~~

## Tests (names only; `tests/scripts/session_pins.test.ts`, 39 tests, all green)

Each guard below was also neutralised once and the suite went red
(mutation check): the pasted-block strip, the fence skip, the synthetic-turn
check, the control-character normalisation, the kill switch, the ownership
check on read, the 12-pin cap, the byte cap, the restore call in the hook, and
the subagent path.

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
- 2.3 caps — overflow is refused and reported, never truncated a hand-edited file is re-bounded on read
- 2.3 caps — overflow is refused and reported, never truncated the worst admitted restore stays under the host 10,000-character line
- the chunk boundary a prompt with a directive and no loadable module tells the turn the pin was not stored
- the chunk boundary a prompt without a directive never loads the module
- the chunk boundary a missing module after a compaction costs the pins, never the language restore
- the chunk boundary bundled: an absent, a throwing or an export-less chunk loads as null
- the chunk boundary bundled, the module is the sibling chunk; from source, the _lib module
