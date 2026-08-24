#!/usr/bin/env tsx
/**
 * Suggestion-block capture — a two-slot latch, counts only.
 *
 * ## What it measures and why it exists
 *
 * `command_suggester/render.ts` emits a numbered-options block with exactly one
 * `Recommendation: N — …` line and the as-is option always last. Nothing records
 * whether those blocks are ever *answered*, so no roadmap can cite a selection
 * rate — and the model-carried alternative is measured and dead:
 * `orchestration_record` captured 1 of 369 dispatches. This instrument exists so
 * that figure is not repeated by construction.
 *
 * ## Two slots, not one — and the probe is why
 *
 * `road-to-suggestion-block-capture` planned a single `user_prompt_submit` hook
 * reading the transcript tail. A live probe
 * (`agents/evidence/analysis/suggestion-capture-probe.md`) found something
 * cheaper: **`stop` carries `last_assistant_message` in the payload**, so the
 * "was a block emitted" half needs no file read at all, and the turn-1 blind
 * spot (`transcript_path` present but the file not yet written) does not arise.
 *
 *   stop                → detect the signature in `last_assistant_message`,
 *                         write a latch keyed by `prompt_id`
 *   user_prompt_submit  → CONSUME the latch, classify `prompt`, append one line
 *
 * ## The misclassification guard, which is the whole correctness argument
 *
 * A bare `1` three turns later must never read as a pick. So the latch is
 * **consumed exactly once**: `user_prompt_submit` deletes it after reading, and
 * a prompt arriving with no latch is `other`, never `option_n`. A latch older
 * than `LATCH_TTL_MS` is `stale_block`. An unparseable latch is `stale_block`
 * too — never a guess.
 *
 * ## Privacy is a property of the schema, not of a scrubber
 *
 * `src/config/suggestion-capture.json` registers five fields and **none can hold
 * free text**: a timestamp, a boolean, an options COUNT, and two closed enums.
 * `option_n` records THAT a numbered option was chosen and out of how many —
 * deliberately not WHICH, because the block's option order is content and the
 * capture-rate question does not need it. A type with no field able to carry a
 * prompt cannot leak one; a scrubber can fail.
 *
 * Default-OFF (`hooks.suggestion_capture.enabled: true`). `fail_closed: false`,
 * always exit 0: an instrument must never break a turn it is only observing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { unwrap } from './envelope.js';
import { readHookStdin } from './hook_stdin.js';

const EXIT_ALLOW = 0;
const SETTINGS_FILE = '.agent-settings.yml';
const SINK_REL = path.join('agents', 'runtime', 'state', 'audit', 'suggestion-capture.jsonl');
const LATCH_REL = path.join('agents', 'runtime', 'state', 'suggestion-latch.json');
/** A block older than this cannot be what the current prompt is answering. */
export const LATCH_TTL_MS = 15 * 60 * 1000;

export type Classification = 'option_n' | 'as_is' | 'other' | 'stale_block';
export type EvidenceClass = 'render-signature' | 'latch-consumed' | 'latch-stale' | 'no-latch';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

const isObject = (v: unknown): v is JsonObject =>
    typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: JsonValue | undefined): string => (typeof v === 'string' ? v : '');

/* ── the render signature ──────────────────────────────────────────────────── */

/**
 * Exactly one `Recommendation:`/`Empfehlung:` line, plus at least two numbered
 * options. Both halves are required: a numbered list alone is ordinary prose,
 * and a `Recommendation:` line alone is a sentence.
 *
 * The label is matched in both languages because `user-interaction`'s Iron Law 1
 * makes a wrong-language label a rule violation, not a variant — so a German
 * session's block carries `Empfehlung:` and a single-language matcher would
 * under-count exactly the sessions the mirror rule produces.
 */
export function detectBlock(text: string): { emitted: boolean; optionsCount: number } {
    if (text === '') return { emitted: false, optionsCount: 0 };
    const lines = text.split('\n');
    const recommendation = lines.filter((l) => /^\s*(?:\*\*)?(?:Recommendation|Empfehlung)\s*:/i.test(l)).length;
    const numbered = new Set<string>();
    for (const l of lines) {
        const m = /^\s*(\d{1,2})[.)]\s+\S/.exec(l);
        if (m?.[1] !== undefined) numbered.add(m[1]);
    }
    const emitted = recommendation === 1 && numbered.size >= 2;
    return { emitted, optionsCount: emitted ? numbered.size : 0 };
}

/* ── classification ────────────────────────────────────────────────────────── */

/**
 * The as-is escape hatch, matched by intent rather than by an exact string:
 * `command-suggestion-policy` requires it present and last but fixes no wording,
 * so a literal matcher would silently classify every as-is pick as `other`.
 */
const AS_IS_RE = /\b(as[- ]is|as is|unver(?:ä|ae)ndert|so lassen|wie es ist|keep it|leave it|no change)\b/i;

export function classify(prompt: string, optionsCount: number): Classification {
    const t = prompt.trim();
    if (t === '') return 'other';
    if (AS_IS_RE.test(t)) return 'as_is';
    // A bare number, or a number with trailing punctuation — the shape a pick
    // actually takes. `1. do the thing` is NOT a pick: it is an instruction that
    // happens to start with a digit, and counting it would inflate the rate.
    const bare = /^(\d{1,2})\s*[.)]?\s*$/.exec(t);
    if (bare?.[1] !== undefined) {
        const n = Number(bare[1]);
        // Out-of-range is `other`: a "7" against a 3-option block is answering
        // something else, and recording it as a pick would corrupt the metric
        // the whole instrument exists to produce.
        if (n >= 1 && (optionsCount === 0 || n <= optionsCount)) return 'option_n';
    }
    return 'other';
}

/* ── settings, latch, sink ─────────────────────────────────────────────────── */

/** `hooks.suggestion_capture.enabled: true` — the same mini-parse siblings use. */
export function enabled(root: string): boolean {
    let raw: string;
    try {
        raw = fs.readFileSync(path.join(root, SETTINGS_FILE), 'utf8');
    } catch {
        return false;
    }
    let inHooks = false;
    let inSection = false;
    for (const line of raw.split('\n')) {
        if (/^hooks:\s*$/.test(line)) {
            inHooks = true;
            inSection = false;
            continue;
        }
        if (/^\S/.test(line)) {
            inHooks = false;
            inSection = false;
            continue;
        }
        if (!inHooks) continue;
        if (/^\s{2}suggestion_capture:\s*$/.test(line)) {
            inSection = true;
            continue;
        }
        if (/^\s{2}\S/.test(line)) {
            inSection = false;
            continue;
        }
        if (inSection && /^\s{4}enabled:\s*true\s*$/.test(line)) return true;
    }
    return false;
}

export interface Latch {
    readonly prompt_id: string;
    readonly options_count: number;
    readonly at: number;
}

export function writeLatch(root: string, latch: Latch): void {
    const p = path.join(root, LATCH_REL);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, `${JSON.stringify(latch)}\n`, 'utf8');
}

/** Read AND delete. Consume-once is the misclassification guard, not a detail. */
export function consumeLatch(root: string): Latch | null {
    const p = path.join(root, LATCH_REL);
    let raw: string;
    try {
        raw = fs.readFileSync(p, 'utf8');
    } catch {
        return null;
    }
    try {
        fs.rmSync(p, { force: true });
    } catch {
        /* a latch we cannot delete is still consumed for this turn */
    }
    try {
        const v = JSON.parse(raw) as unknown;
        if (!isObject(v)) return null;
        const at = v['at'];
        const oc = v['options_count'];
        const pid = v['prompt_id'];
        if (typeof at !== 'number' || typeof oc !== 'number' || typeof pid !== 'string') return null;
        return { prompt_id: pid, options_count: oc, at };
    } catch {
        return null; // unparseable → stale_block, never a guess
    }
}

export interface Record_ {
    readonly ts: string;
    readonly block_emitted: boolean;
    readonly options_count: number;
    readonly evidence_class: EvidenceClass;
    readonly turn_classification: Classification;
}

/** The exact key set `src/config/suggestion-capture.json` registers. */
export const RECORD_KEYS: readonly string[] = [
    'ts',
    'block_emitted',
    'options_count',
    'evidence_class',
    'turn_classification',
];

export function appendRecord(root: string, rec: Record_, now: Date): void {
    const p = path.join(root, SINK_REL);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const line = {
        ts: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        block_emitted: rec.block_emitted,
        options_count: rec.options_count,
        evidence_class: rec.evidence_class,
        turn_classification: rec.turn_classification,
    };
    fs.appendFileSync(p, `${JSON.stringify(line)}\n`, 'utf8');
}

/* ── the two slots ─────────────────────────────────────────────────────────── */

/** Decide what a prompt turn should record. Pure, so the tests drive it directly. */
export function classifyTurn(
    prompt: string,
    latch: Latch | null,
    nowMs: number,
): { record: boolean; evidence_class: EvidenceClass; turn_classification: Classification; options_count: number } {
    if (latch === null) {
        // No block preceded this turn. Recording every ordinary turn would make
        // the sink a prompt log with the volume of one, so nothing is written.
        return { record: false, evidence_class: 'no-latch', turn_classification: 'other', options_count: 0 };
    }
    if (nowMs - latch.at > LATCH_TTL_MS) {
        return {
            record: true,
            evidence_class: 'latch-stale',
            turn_classification: 'stale_block',
            options_count: latch.options_count,
        };
    }
    return {
        record: true,
        evidence_class: 'latch-consumed',
        turn_classification: classify(prompt, latch.options_count),
        options_count: latch.options_count,
    };
}

/**
 * Canonical event name, from either invocation shape.
 *
 * The dispatcher supplies `envelope.event` (`stop`, `user_prompt_submit`); a
 * direct/legacy invocation carries only the host's own `hook_event_name`
 * (`Stop`, `UserPromptSubmit`). Reading just the second one is how the first
 * version of this concern became a silent no-op under the dispatcher: it ran,
 * matched nothing, and exited 0 — indistinguishable from a disabled hook.
 */
export function eventOf(envelope: JsonObject, payload: JsonObject): string {
    const canonical = str(envelope['event'] as JsonValue | undefined);
    const native = str(
        (envelope['native_event'] ?? payload['hook_event_name']) as JsonValue | undefined,
    );
    const raw = (canonical !== '' ? canonical : native).toLowerCase();
    if (raw === 'stop') return 'stop';
    if (raw === 'userpromptsubmit' || raw === 'user_prompt_submit') return 'user_prompt_submit';
    return raw;
}

/**
 * The dispatcher calls every in-process concern as `main(argv)` — see
 * `_run_concern_inproc` in `hooks/dispatch_hook.ts`, and the `ConcernMain`
 * signature in `hooks/concern_registry.ts`.
 *
 * This used to be `main(now: Date = new Date())`, and the mismatch made the
 * concern a SILENT NO-OP on every live dispatch: argv arrived where a Date was
 * expected, `now.getTime()` threw `TypeError: now.getTime is not a function`,
 * and the outer catch — "an instrument never breaks the turn it observes" —
 * swallowed it and returned EXIT_ALLOW. The dispatcher recorded exit 0 and no
 * output, which is indistinguishable from a disabled hook. Three earlier
 * isolation attempts read that silence as a `--project-dir` problem; it was
 * this.
 *
 * The clock stays injectable because the TTL and the timestamp need to be
 * driven from a test, but it is now the SECOND parameter, where the dispatcher
 * cannot land on it.
 */
export function main(_argv: readonly string[] = [], now: Date = new Date()): number {
    let envelope: JsonObject;
    let payload: JsonObject;
    try {
        [envelope, payload] = unwrap(readHookStdin(), 'claude');
    } catch {
        return EXIT_ALLOW;
    }

    // `workspace_root` is the dispatcher's; `cwd` is the host payload's. Both
    // are read because the concern must work under either invocation.
    const root =
        str(envelope['workspace_root'] as JsonValue | undefined) ||
        str(payload['cwd'] as JsonValue | undefined) ||
        str(envelope['project_root'] as JsonValue | undefined) ||
        '.';
    if (!enabled(root)) return EXIT_ALLOW;

    const event = eventOf(envelope, payload);
    try {
        if (event === 'stop') {
            const { emitted, optionsCount } = detectBlock(
                str(payload['last_assistant_message'] as JsonValue | undefined),
            );
            if (emitted) {
                writeLatch(root, {
                    prompt_id: str(payload['prompt_id'] as JsonValue | undefined),
                    options_count: optionsCount,
                    at: now.getTime(),
                });
            }
            return EXIT_ALLOW;
        }
        if (event === 'user_prompt_submit') {
            const latch = consumeLatch(root);
            const v = classifyTurn(str(payload['prompt'] as JsonValue | undefined), latch, now.getTime());
            if (v.record) {
                appendRecord(
                    root,
                    {
                        ts: '',
                        block_emitted: true,
                        options_count: v.options_count,
                        evidence_class: v.evidence_class,
                        turn_classification: v.turn_classification,
                    },
                    now,
                );
            }
            return EXIT_ALLOW;
        }
    } catch {
        return EXIT_ALLOW; // an instrument never breaks the turn it observes
    }
    return EXIT_ALLOW;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (isCliEntry()) process.exit(main());

export { SINK_REL, LATCH_REL };
