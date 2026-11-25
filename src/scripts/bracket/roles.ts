/**
 * The match briefs — attack, defend, judge — rendered by the driver so every
 * orchestrator sends the same words. A brief the orchestrator improvises per
 * run is a judge whose question changes between matches.
 *
 * Blindness is structural: every role reads match-local copies named A and B
 * (`original-a.md`, `revised-b.md`, …), never `lines/<id>.md`, so no brief and
 * no file a judge opens carries a line id; only a line's own angle reaches its
 * attacker and defender, and both are told to keep it out of what they write.
 */
import { RUBRIC, type Criterion, type Seat } from './engine.js';
import { renderAngle, type Angle } from './deck.js';

export interface Side {
    readonly angle: Angle | string | null;
}

export interface MatchBriefInput {
    readonly task: string;
    readonly match: string;
    readonly round: number;
    readonly a: Side;
    readonly b: Side;
    /** Absolute match directory `<run>/matches/<match>`, holding `original-a.md` / `original-b.md`. */
    readonly dir: string;
    readonly seat: Seat;
}

export type MatchBriefs = Record<'attack-a' | 'attack-b' | 'defend-a' | 'defend-b' | 'judge', string>;

/** Anchors keep the scale honest: a 7 has to mean something. */
export const RUBRIC_ANCHORS: Record<Criterion, string> = {
    correctness: '10 nothing wrong after you checked it yourself · 7 slips that do not change the outcome · 4 a real error the user would hit · 0–2 wrong at the core or harmful if used',
    requirements: '10 every stated requirement met in full · 7 all touched, one thin · 4 a stated requirement missing · 0–2 answers a different question',
    robustness: '10 every attack fixed or correctly rebutted, nothing new broken · 7 one MINOR attack standing · 4 a MAJOR standing, or a fix that broke something · 0–2 a FATAL standing',
    clarity: '10 the shape shows how to use it, no padding · 7 some padding or one confusing part · 4 the reader has to dig · 0–2 hard to follow',
    efficiency: '10 no surface, steps or cost beyond what the task needs · 7 one avoidable addition · 4 clearly more than needed · 0–2 the overhead outweighs the result',
};

const TASK = (task: string): string => `=== TASK (identical for every line) ===\n${task}\n=== END OF TASK ===`;

function lens(angle: Angle | string | null): string {
    if (angle === null) return '';
    return `Your approach is the lens you work through:\n${typeof angle === 'string' ? `- ${angle}` : renderAngle(angle)}\n`;
}

/** Placeholders, not values: a judge that copies the skeleton unfilled is refused by `collect`. */
export function verdictSkeleton(seat: Seat): string {
    const blank = Object.fromEntries(Object.keys(RUBRIC).map((k) => [k, '<0-10>']));
    const fatal = '<none|upheld|rebutted>';
    return JSON.stringify({ a: blank, b: blank, fatal: { a: fatal, b: fatal }, pick: '<a|b>', seat });
}

const BLIND = 'Write nothing that names a line id, an approach, the bracket or the round — a judge reads this file.';

function attack(i: MatchBriefInput, me: 'a' | 'b'): string {
    const self = me === 'a' ? i.a : i.b;
    const other = me === 'a' ? 'b' : 'a';
    return `You attack your opponent's solution in match ${i.match}, round ${i.round}. Only one of the two goes through.

${TASK(i.task)}

${lens(self.angle)}
Opponent's solution: ${i.dir}/original-${other}.md
Your own, for comparison only: ${i.dir}/original-${me}.md — attack theirs on its merits against the task, not for differing from yours.

Find the real problems:
- WRONG: factual or logic errors, bugs, false claims.
- MISSING: a requirement the task states that it skips or half-meets — quote the requirement.
- BREAKS: a concrete input or scenario where it fails — give the exact counterexample.
- VAGUE: a place where the user would have to guess to act on it.

Every attack is specific and checkable: point at the part, say what is wrong and why. No praise, no summary, no style remarks unless they block use, no requirements the task does not state. At most 7, strongest first; label each FATAL (wrong or unusable for the task), MAJOR or MINOR.

Write only ${i.dir}/attacks-on-${other}.md, one block per attack. ${BLIND}
ATTACK 1 [FATAL|MAJOR|MINOR] <title>
Where: <quote or location>
Problem: <what is wrong, with the counterexample or the missed requirement>

Then reply with one line: ATTACKED <number of attacks> (<number FATAL> fatal)
`;
}

function defend(i: MatchBriefInput, me: 'a' | 'b'): string {
    const self = me === 'a' ? i.a : i.b;
    return `Your solution in match ${i.match}, round ${i.round} was attacked. Defend it and revise it.

${TASK(i.task)}

${lens(self.angle)}
Your solution: ${i.dir}/original-${me}.md
The attacks: ${i.dir}/attacks-on-${me}.md (missing, empty or NO OUTPUT means you were not attacked)

1. Take every attack in turn. CONCEDE and fix it if it is right; REBUT it only with evidence from the task, your solution or a check you ran. A rebuttal that only insists counts as a concession — conceding a real flaw and fixing it scores better than defending it.
2. Write the complete revised solution, standalone: the judge reads only that file. Keep your approach; do not start over and do not copy the opponent.

Write only these two files. ${BLIND}
- ${i.dir}/defence-${me}.md — one line per attack: ATTACK n: CONCEDE|REBUT. <one to three lines>
- ${i.dir}/revised-${me}.md — the revised solution

Then reply with one line: DEFENDED conceded <n> rebutted <n>
`;
}

function judge(i: MatchBriefInput): string {
    const rubric = (Object.keys(RUBRIC) as Criterion[]).map((k) => `- ${k} (weight ${RUBRIC[k]}): ${RUBRIC_ANCHORS[k]}`).join('\n');
    return `You judge match ${i.match}, round ${i.round}. Two solutions to the same task each attacked the other, then defended and revised. You score both; a script decides the winner from your scores.

${TASK(i.task)}

Solution A — revised: ${i.dir}/revised-a.md · attacks it took: ${i.dir}/attacks-on-a.md · its defence: ${i.dir}/defence-a.md · project checks: ${i.dir}/checks-a.txt
Solution B — revised: ${i.dir}/revised-b.md · attacks it took: ${i.dir}/attacks-on-b.md · its defence: ${i.dir}/defence-b.md · project checks: ${i.dir}/checks-b.txt
(Each revised file starts as a copy of the original, so an undefended solution is judged as first written. A missing attacks, defence or checks file means nothing was raised, or no check ran.)

Rubric — score every criterion 0–10 against its anchors; use the whole scale, a 7 is not a polite default:
${rubric}

1. Read both revised solutions in full before scoring either.
2. For each attack, check the revised solution yourself: fixed, correctly rebutted, or standing. A defence that says "fixed" is not proof.
3. Look for flaws the attackers missed.
4. fatal: "upheld" only for a flaw you verified that makes the solution wrong or unusable — a failing project check is one. "rebutted" when a FATAL was raised and correctly answered. Otherwise "none".
5. Do not reward length, confidence or self-description ("this robust solution"). You do not know how either solution was produced; do not guess.
6. pick is the one you would hand to the user. The script overrules a pick that contradicts the points and says so.

Write only ${i.dir}/verdict.json — this shape, seat unchanged, every <placeholder> replaced by its value (scores as numbers 0–10):
${verdictSkeleton(i.seat)}

Then reply with one line: PICK <a|b>
`;
}

export function matchBriefs(i: MatchBriefInput): MatchBriefs {
    return {
        'attack-a': attack(i, 'a'),
        'attack-b': attack(i, 'b'),
        'defend-a': defend(i, 'a'),
        'defend-b': defend(i, 'b'),
        judge: judge(i),
    };
}
