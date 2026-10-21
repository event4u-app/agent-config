/**
 * Step anatomy — where a closed roadmap step's wall-clock went.
 *
 * The turnaround probe can say how long tool calls blocked; it cannot say how
 * a STEP's hours split between
 * the model, the change itself, verifying it, the ceremony around it and waiting.
 * That split is what decides whether a step is slow because of its work or
 * because of its process, and nothing measured it.
 *
 * THE UNIT. A step closes when the session edits a roadmap file (`ROADMAP_FILE`)
 * and turns a `- [ ]` into `- [x]` / `- [~]` / `- [-]`. The
 * step's interval runs from the previous close in the same session (or the
 * session's first timestamped row) to that edit.
 *
 * THE ATTRIBUTION. Every gap between two consecutive timestamped rows inside the
 * interval goes to exactly one class, chosen by the row that ENDS the gap: an
 * assistant row is model time; a tool result takes the class of the call it
 * answers; a real user request is a wait; a turn-end refusal fed back as a user
 * row is a refusal. So the classes sum to the step total by construction, and the
 * sum check catches a branch that drops time rather than a rounding error.
 *
 * `change` is an approximation, stated: an edit, read or search of any path that
 * is not a record path. The step's own paths are not knowable from a transcript
 * before the step names them, so "not record prose" is the closest observable.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { classifyPaths, type RiskClass } from '../classify_change_risk.js';

export const STEP_CLASSES = ['model', 'change', 'verify', 'ceremony', 'wait', 'refusal', 'unknown'] as const;
export type StepClass = (typeof STEP_CLASSES)[number];

/** A blocking-cause classifier, injected so this module does not import the probe that imports it. */
export type CauseOf = (tool: string, input: unknown) => string;

export interface StepReading {
    session: string;
    roadmap: string;
    step: string;
    /** Milliseconds, integers, so the sum check is exact. */
    totalMs: number;
    ms: Record<StepClass, number>;
    riskClass: RiskClass;
    toolCalls: number;
    toolRequests: number;
}

type Entry = Record<string, unknown>;

const RECORD_PATH = /(^|\/)(agents\/(roadmaps|evidence|decisions|runtime\/council)\/|agents\/roadmaps-|docs\/decisions\/)/;
const ROADMAP_FILE = /(^|\/)agents\/roadmaps\/[^/]+\.md$/;
const CEREMONY_SHELL =
    /\b(council_cli|roadmap:progress|closure_scan|lint_roadmap|check_roadmap|dispatch_r2_reviewer|check_completion_review|generate_owned_digest|gh pr (create|edit|comment|view)|git (commit|add)\b)/;
const VERIFY_SHELL = /\b(eslint|tsc\b|lint_|check_|vitest|jest|pytest|phpunit|npm (run )?test|task (ci|test))/;
const REFUSAL_TEXT = /turn-end-gate: REFUSED|Stop hook feedback/;
const FLIP = /^\s*-\s\[[x~-]\]\s+\*\*(\d+\.\d+[a-z]?)/m;

function isObj(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function ms(iso: unknown): number | null {
    if (typeof iso !== 'string') return null;
    const t = Date.parse(iso);
    return Number.isNaN(t) ? null : t;
}

function emptyMs(): Record<StepClass, number> {
    return Object.fromEntries(STEP_CLASSES.map((c) => [c, 0])) as Record<StepClass, number>;
}

function filePathOf(input: unknown): string | null {
    if (!isObj(input)) return null;
    for (const k of ['file_path', 'path', 'notebook_path']) {
        if (typeof input[k] === 'string') return input[k] as string;
    }
    return null;
}

/** One class per tool call. Blocking causes decide waits and verification; paths decide ceremony. */
export function classifyCall(tool: string, input: unknown, causeOf: CauseOf): StepClass {
    const fp = filePathOf(input);
    if (fp !== null) return RECORD_PATH.test(fp) ? 'ceremony' : 'change';
    if (tool === 'Bash' && isObj(input) && typeof input['command'] === 'string') {
        const cmd = input['command'];
        if (CEREMONY_SHELL.test(cmd)) return 'ceremony';
        const cause = causeOf(tool, input);
        if (cause === 'test' || cause === 'build' || VERIFY_SHELL.test(cmd)) return 'verify';
        if (['ci-wait', 'sleep-poll', 'network', 'user-wait'].includes(cause)) return 'wait';
        return 'change';
    }
    const cause = causeOf(tool, input);
    if (['ci-wait', 'sleep-poll', 'network', 'user-wait', 'subagent-wait'].includes(cause)) return 'wait';
    if (tool === 'Grep' || tool === 'Glob') return 'change';
    return 'unknown';
}

/** The step id a roadmap edit closes, or null when the edit flips no checkbox. */
export function closedStep(tool: string, input: unknown): { roadmap: string; step: string } | null {
    if ((tool !== 'Edit' && tool !== 'MultiEdit') || !isObj(input)) return null;
    const fp = filePathOf(input);
    if (fp === null || !ROADMAP_FILE.test(fp)) return null;
    const edits = tool === 'MultiEdit' && Array.isArray(input['edits']) ? input['edits'] : [input];
    for (const e of edits) {
        if (!isObj(e) || typeof e['new_string'] !== 'string' || typeof e['old_string'] !== 'string') continue;
        const m = FLIP.exec(e['new_string']);
        if (m !== null && new RegExp(`-\\s\\[ \\]\\s+\\*\\*${m[1]!.replace('.', '\\.')}`).test(e['old_string'])) {
            return { roadmap: path.basename(fp, '.md'), step: m[1]! };
        }
    }
    return null;
}

function userRowClass(e: Entry, pending: Map<string, StepClass>): StepClass {
    const msg = e['message'];
    if (isObj(msg) && Array.isArray(msg['content'])) {
        for (const b of msg['content']) {
            if (isObj(b) && b['type'] === 'tool_result') {
                const cls = pending.get(String(b['tool_use_id'] ?? ''));
                if (cls !== undefined) return cls;
            }
        }
        const text = msg['content']
            .map((b) => (isObj(b) && typeof b['text'] === 'string' ? b['text'] : ''))
            .join(' ');
        if (REFUSAL_TEXT.test(text)) return 'refusal';
        if (text.trim() !== '') return 'wait';
    }
    if (isObj(msg) && typeof msg['content'] === 'string') {
        return REFUSAL_TEXT.test(msg['content']) ? 'refusal' : 'wait';
    }
    return 'unknown';
}

/** Every closed step in one transcript file. */
export function readSteps(file: string, causeOf: CauseOf): StepReading[] {
    const out: StepReading[] = [];
    const pending = new Map<string, StepClass>();
    let acc = emptyMs();
    let startAt: number | null = null;
    let lastAt: number | null = null;
    let paths = new Set<string>();
    let calls = 0;
    let requests = new Set<string>();
    const session = path.basename(file, '.jsonl');

    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let e: Entry;
        try {
            e = JSON.parse(line) as Entry;
        } catch {
            continue;
        }
        // Only the conversation's own rows end a gap. Queue operations, system
        // notes and pr links carry timestamps too, and letting them anchor a gap
        // split a CI wait into a waited half and an unattributable half.
        if (e['isSidechain'] === true || (e['type'] !== 'user' && e['type'] !== 'assistant')) continue;
        const at = ms(e['timestamp']);
        if (at === null) continue;
        if (startAt === null) startAt = at;

        const isAssistant = e['type'] === 'assistant';
        if (lastAt !== null) {
            const cls: StepClass = isAssistant ? 'model' : userRowClass(e, pending);
            acc[cls] += at - lastAt;
        }
        lastAt = at;
        if (!isAssistant) continue;

        const msg = e['message'];
        if (!isObj(msg) || !Array.isArray(msg['content'])) continue;
        const cwd = typeof e['cwd'] === 'string' ? e['cwd'] : '';
        for (const b of msg['content']) {
            if (!isObj(b) || b['type'] !== 'tool_use') continue;
            const tool = String(b['name'] ?? '');
            pending.set(String(b['id'] ?? ''), classifyCall(tool, b['input'], causeOf));
            calls += 1;
            if (typeof e['requestId'] === 'string') requests.add(e['requestId']);
            const fp = filePathOf(b['input']);
            if (fp !== null && (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit')) {
                paths.add(cwd !== '' && path.isAbsolute(fp) ? path.relative(cwd, fp) : fp);
            }
            const closed = closedStep(tool, b['input']);
            if (closed !== null) {
                out.push({
                    session,
                    roadmap: closed.roadmap,
                    step: closed.step,
                    totalMs: at - startAt,
                    ms: acc,
                    riskClass: classifyPaths([...paths].filter((p) => !ROADMAP_FILE.test(p))).cls,
                    toolCalls: calls,
                    toolRequests: requests.size,
                });
                acc = emptyMs();
                startAt = at;
                paths = new Set();
                calls = 0;
                requests = new Set();
            }
        }
    }
    return out;
}

/** Null when the classes sum to the step total, else the mismatch. */
export function stepSumError(r: StepReading): string | null {
    const sum = STEP_CLASSES.reduce((a, c) => a + r.ms[c], 0);
    return sum === r.totalMs ? null : `${r.roadmap} ${r.step}: classes sum to ${String(sum)} ms, total is ${String(r.totalMs)} ms`;
}

function quantile(xs: readonly number[], q: number): number {
    if (xs.length === 0) return 0;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] as number;
}

export interface StepAnatomySummary {
    steps: number;
    /** Per class: p50 / p90 seconds per step, and the share of all step time. */
    byClass: Record<StepClass, { p50: number; p90: number; share: number }>;
    /** Per change class: steps, p50 / p90 minutes per step, and mean tool-call batch size. */
    byRisk: Record<RiskClass, { steps: number; p50Min: number; p90Min: number; meanBatch: number }>;
    sumErrors: string[];
}

export function summariseSteps(readings: readonly StepReading[]): StepAnatomySummary {
    const total = readings.reduce((a, r) => a + r.totalMs, 0);
    const round = (x: number, p = 2): number => Math.round(x * 10 ** p) / 10 ** p;
    const byClass = Object.fromEntries(
        STEP_CLASSES.map((c) => {
            const xs = readings.map((r) => r.ms[c] / 1000);
            const share = total === 0 ? 0 : readings.reduce((a, r) => a + r.ms[c], 0) / total;
            return [c, { p50: round(quantile(xs, 0.5), 1), p90: round(quantile(xs, 0.9), 1), share: round(share, 4) }];
        }),
    ) as StepAnatomySummary['byClass'];
    const byRisk = Object.fromEntries(
        (['R0', 'R1', 'R2', 'R3'] as const).map((k) => {
            const rs = readings.filter((r) => r.riskClass === k);
            const mins = rs.map((r) => r.totalMs / 60_000);
            const calls = rs.reduce((a, r) => a + r.toolCalls, 0);
            const reqs = rs.reduce((a, r) => a + r.toolRequests, 0);
            return [k, { steps: rs.length, p50Min: round(quantile(mins, 0.5), 1), p90Min: round(quantile(mins, 0.9), 1), meanBatch: reqs === 0 ? 0 : round(calls / reqs) }];
        }),
    ) as StepAnatomySummary['byRisk'];
    const sumErrors = readings.map(stepSumError).filter((x): x is string => x !== null);
    return { steps: readings.length, byClass, byRisk, sumErrors };
}
