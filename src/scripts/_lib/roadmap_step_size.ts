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
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const STEP_WORD_CAP = 150;
export const STEP_SIZE_BASELINE_REL = 'src/config/roadmap-step-size-baseline.json';

const STEP_LINE = /^- \[[ x~\-/]\] \*\*(\d+\.\d+[a-z]?)\b/;
const COMMENT = /<!--[\s\S]*?-->/g;

export interface OversizedStep {
    key: string;
    words: number;
}

function countWords(text: string): number {
    const bare = text.replace(COMMENT, ' ').trim();
    return bare === '' ? 0 : bare.split(/\s+/).length;
}

export function oversizedSteps(file: string, text: string): OversizedStep[] {
    const out: OversizedStep[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const m = STEP_LINE.exec(lines[i] as string);
        if (m === null) continue;
        const body = [lines[i] as string];
        for (let j = i + 1; j < lines.length && /^\s{2,}\S/.test(lines[j] as string); j++) body.push(lines[j] as string);
        const words = countWords(body.join(' '));
        if (words > STEP_WORD_CAP) out.push({ key: `${file}#${m[1]!}`, words });
    }
    return out;
}

export function stepSizeProblems(file: string, text: string, baseline: ReadonlySet<string>): string[] {
    return oversizedSteps(file, text)
        .filter((s) => !baseline.has(s.key))
        .map(
            (s) =>
                `step ${s.key.split('#')[1]!} is ${String(s.words)} words (cap ${String(STEP_WORD_CAP)}) — ` +
                'split it, or move evidence to the commit and, for R2/R3, the artefact',
        );
}

export function loadStepSizeBaseline(root: string): Set<string> {
    const p = path.join(root, STEP_SIZE_BASELINE_REL);
    if (!fs.existsSync(p)) return new Set();
    const j = JSON.parse(fs.readFileSync(p, 'utf8')) as { held: string[] };
    return new Set(j.held);
}
