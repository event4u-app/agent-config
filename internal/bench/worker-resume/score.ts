/** Scoring for the worker-resume bench: exact match after trimming whitespace. */
import type { CitationTask } from './tasks.js';

export interface TaskScore {
    id: string;
    pass: boolean;
}

export function scoreSession(tasks: readonly CitationTask[], answers: readonly (string | undefined)[]): TaskScore[] {
    return tasks.map((t, i) => ({ id: t.id, pass: typeof answers[i] === 'string' && answers[i]!.trim() === t.expected.trim() }));
}

export function parseOrchestratorAnswers(result: string): string[] | null {
    // The last parseable `{...}` that starts at a `{` and ends at the final `}`.
    const end = result.lastIndexOf('}');
    for (let i = result.lastIndexOf('{', end); i >= 0; i = result.lastIndexOf('{', i - 1)) {
        try {
            const o = JSON.parse(result.slice(i, end + 1)) as { answers?: unknown };
            if (Array.isArray(o.answers)) return o.answers.map((a) => (typeof a === 'string' ? a : String(a)));
        } catch {
            // Not an object boundary; keep walking back.
        }
        if (i === 0) break;
    }
    return null;
}
