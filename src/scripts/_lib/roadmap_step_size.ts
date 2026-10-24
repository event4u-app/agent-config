/**
 * A roadmap step is at most `STEP_WORD_CAP` words.
 *
 * A step that has grown into a work package is read whole every time the run
 * reaches it, and its Done note grows into it. The cap counts the checkbox line
 * and its indented continuation lines; HTML comments (a receipt, a skip marker)
 * are excluded, because they are machine annotations, not reading load.
 *
 * Folded into `lint_roadmap_complexity` rather than shipped as a gate of its own,
 * for the reason `roadmap_granularity.ts` states: the gate that already owns the
 * roadmap corpus adds a check without adding a gate. Today's oversized steps are
 * held by `src/config/roadmap-step-size-baseline.json`; the baseline only
 * shrinks — a held step that fits under the cap is reported so its entry can go.
 * `held_words` records each held step's size, so a held step may shrink but never
 * grow: before that ceiling one held step grew to ~3,000 words unchecked.
 *
 * A step citing more than `DECISION_CAP` distinct decision ids (`D1`, `D2`, …)
 * is reported as cut wrong (owner directive 2026-10-24): split it rather than
 * extend it. A warning, never a failure.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const STEP_WORD_CAP = 150;
export const DECISION_CAP = 10;
export const STEP_SIZE_BASELINE_REL = 'src/config/roadmap-step-size-baseline.json';

const STEP_LINE = /^- \[[ x~\-/]\] \*\*(\d+\.\d+[a-z]?)\b/;
const COMMENT = /<!--[\s\S]*?-->/g;
const DECISION_ID = /\bD(\d{1,3})\b/g;

export interface OversizedStep {
    key: string;
    words: number;
}

function countWords(text: string): number {
    const bare = text.replace(COMMENT, ' ').trim();
    return bare === '' ? 0 : bare.split(/\s+/).length;
}

interface StepBody {
    key: string;
    body: string;
}

function stepBodies(file: string, text: string): StepBody[] {
    const out: StepBody[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const m = STEP_LINE.exec(lines[i] as string);
        if (m === null) continue;
        const body = [lines[i] as string];
        // A blank line ends the step only when no indented line follows it: a
        // continuation may hold several paragraphs, and each still counts.
        for (let j = i + 1; j < lines.length; j++) {
            const line = lines[j] as string;
            if (/^\s{2,}\S/.test(line)) body.push(line);
            else if (line.trim() !== '' || !/^\s{2,}\S/.test(lines.slice(j + 1).find((l) => l.trim() !== '') ?? '')) break;
        }
        out.push({ key: `${file}#${m[1]!}`, body: body.join(' ') });
    }
    return out;
}

export function oversizedSteps(file: string, text: string): OversizedStep[] {
    return stepBodies(file, text)
        .map((s) => ({ key: s.key, words: countWords(s.body) }))
        .filter((s) => s.words > STEP_WORD_CAP);
}

export function stepSizeProblems(
    file: string,
    text: string,
    baseline: ReadonlySet<string>,
    ceilings: ReadonlyMap<string, number> = new Map(),
): string[] {
    const out: string[] = [];
    for (const s of oversizedSteps(file, text)) {
        const step = s.key.split('#')[1]!;
        if (!baseline.has(s.key)) {
            out.push(
                `step ${step} is ${String(s.words)} words (cap ${String(STEP_WORD_CAP)}) — ` +
                    'split it, or move evidence to the commit and, for R2/R3, the artefact',
            );
            continue;
        }
        const ceiling = ceilings.get(s.key);
        if (ceiling !== undefined && s.words > ceiling) {
            out.push(
                `held step ${step} grew to ${String(s.words)} words (recorded ${String(ceiling)}) — ` +
                    'a held step may shrink, never grow: split it',
            );
        }
    }
    return out;
}

/** Steps citing more than `DECISION_CAP` distinct decision ids. */
export function decisionCapWarnings(file: string, text: string): string[] {
    const out: string[] = [];
    for (const s of stepBodies(file, text)) {
        const ids = new Set([...s.body.matchAll(DECISION_ID)].map((m) => m[1]));
        if (ids.size > DECISION_CAP) {
            out.push(
                `step ${s.key.split('#')[1]!} cites ${String(ids.size)} decisions (cap ${String(DECISION_CAP)}) — ` +
                    'cut wrong: split it, do not extend it',
            );
        }
    }
    return out;
}

/** Held keys of this file whose step now fits under the cap, or no longer exists. */
export function staleHeld(file: string, text: string, baseline: ReadonlySet<string>): string[] {
    const over = new Set(oversizedSteps(file, text).map((s) => s.key));
    return [...baseline].filter((k) => k.startsWith(`${file}#`) && !over.has(k)).sort();
}

/** Recorded word counts of held steps; a held step without one has no ceiling yet. */
export function loadStepSizeCeilings(root: string): Map<string, number> {
    const p = path.join(root, STEP_SIZE_BASELINE_REL);
    if (!fs.existsSync(p)) return new Map();
    const j = JSON.parse(fs.readFileSync(p, 'utf8')) as { held_words?: Record<string, number> };
    return new Map(Object.entries(j.held_words ?? {}));
}

export function loadStepSizeBaseline(root: string): Set<string> {
    const p = path.join(root, STEP_SIZE_BASELINE_REL);
    if (!fs.existsSync(p)) return new Set();
    const j = JSON.parse(fs.readFileSync(p, 'utf8')) as { held: string[] };
    return new Set(j.held);
}
