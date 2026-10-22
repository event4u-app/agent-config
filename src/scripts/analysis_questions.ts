/**
 * analysis_questions.ts — routes every question a run raises by the
 * ownership classes of `decision_resolution` (ADR-268 § 10): technical ones to
 * the agent or the council, spend exhaustion to pause-and-report, and only the
 * owner-locked classes to the owner.
 *
 * An owner item that gates an action — a push, a destructive step, a fetch, a
 * Hard-Floor trigger — is asked before that action, alone. Every other owner
 * item waits for one batch at the end, each with a recommendation, while the
 * run continues on everything it does not block.
 */
import { DEFAULT_RESOLUTION_MODES, OWNERSHIP_CLASSES } from './ai_council/ownership_classes.js';

export const GATED_ACTIONS = ['push', 'destructive', 'fetch', 'hard-floor'] as const;
export type GatedAction = (typeof GATED_ACTIONS)[number];

export interface Question {
    id: string;
    text: string;
    ownership: string;
    gates?: GatedAction;
    recommendation?: string;
}

export interface Routed {
    agent: Question[];
    council: Question[];
    pause: Question[];
    preAction: Record<GatedAction, Question[]>;
    endBatch: Array<{ id: string; text: string; recommendation: string }>;
}

export class QuestionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'QuestionError';
    }
}

export function routeQuestions(questions: readonly Question[]): Routed {
    const routed: Routed = {
        agent: [],
        council: [],
        pause: [],
        preAction: { push: [], destructive: [], fetch: [], 'hard-floor': [] },
        endBatch: [],
    };
    for (const q of questions) {
        if (!OWNERSHIP_CLASSES.includes(q.ownership)) {
            throw new QuestionError(`${q.id}: unknown ownership class ${q.ownership}`);
        }
        if (q.ownership === 'spend-exhaustion') {
            routed.pause.push(q);
            continue;
        }
        // A gated action needs this-turn user confirmation whatever the class,
        // so the gate is read before the class can route the item elsewhere.
        if (q.gates !== undefined) {
            routed.preAction[q.gates].push(q);
            continue;
        }
        const mode = DEFAULT_RESOLUTION_MODES[q.ownership];
        if (mode === 'agent') routed.agent.push(q);
        else if (mode === 'council') routed.council.push(q);
        else {
            if (q.recommendation === undefined || q.recommendation.trim() === '') {
                throw new QuestionError(`${q.id}: an owner item in the end batch needs a recommendation`);
            }
            routed.endBatch.push({ id: q.id, text: q.text, recommendation: q.recommendation });
        }
    }
    return routed;
}

/** The one owner question due before `action`, or null when nothing gates it. */
export function nextOwnerAsk(routed: Routed, action: GatedAction): Question | null {
    return routed.preAction[action][0] ?? null;
}
