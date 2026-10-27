/**
 * The code graph's three review checks (`review_risk.ts` `checks`) as
 * self-review findings, in the shape `review-findings.schema.json` pins and
 * with the typed exhibits #2722 added.
 *
 * ADVISORY, and only advisory: every finding is `low` / `correctness`, which
 * `classifyBlocking` never blocks, and carries `disposition: 'advisory'` until
 * the counterfactual review (roadmap `road-to-a-graph-that-wins` 3.5) shows a
 * review fed these checks beats one without. A check that did not run is a
 * finding of its own, never silence: "no analysis" must not read as "nothing
 * found".
 *
 * Not wired into `self_review_gate.ts` here — that is a gate change and needs
 * its own ratification artifact.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { ReviewCheck } from '../code_graph/review_risk.js';
import type { Finding } from '../self_review_gate.js';
import { MAX_QUOTE_CHARS, type PresenceExhibit } from './finding_exhibits.js';

export type GraphCheckFinding = Finding & { disposition: 'advisory'; source: 'code-graph'; check: ReviewCheck['id'] };

const TITLE: Readonly<Record<ReviewCheck['id'], string>> = {
    'untested-change': 'changed symbol has no test path',
    'missing-co-change': 'usual co-change partner missing from the diff',
    'touched-entry-point': 'diff reaches an entry point or flow',
};

function presenceAt(root: string, witness: string, commit: string): PresenceExhibit | null {
    const m = /^(.+):(\d+)$/.exec(witness);
    if (!m) return null;
    const file = m[1] as string;
    const line = Number(m[2]);
    let text: string | undefined;
    try {
        text = fs.readFileSync(path.join(root, file), 'utf-8').split('\n')[line - 1];
    } catch {
        return null;
    }
    const quote = (text ?? '').trim().slice(0, MAX_QUOTE_CHARS);
    return quote ? { type: 'presence', path: file, line, quote, commit } : null;
}

/** One finding per flagged item, one per check that could not run; a passing check yields none. */
export function graphCheckFindings(checks: readonly ReviewCheck[], root: string, commit: string): GraphCheckFinding[] {
    const out: GraphCheckFinding[] = [];
    for (const c of checks) {
        const base = { severity: 'low', kind: 'correctness', disposition: 'advisory', source: 'code-graph', check: c.id } as const;
        if (c.status === 'unknown') {
            out.push({ ...base, title: `graph check ${c.id} did not run: ${c.reason ?? 'no reason recorded'}`.slice(0, 300), detail: 'No analysis is not a pass.' });
            continue;
        }
        if (c.status !== 'finding') continue;
        for (const i of c.items) {
            if (c.id === 'untested-change' && i.verdict !== 'untested') continue;
            const ex = i.witness ? presenceAt(root, i.witness, commit) : null;
            const loc = i.witness ? /^(.+):(\d+)$/.exec(i.witness) : null;
            out.push({
                ...base,
                title: `${TITLE[c.id]}: ${i.label}`.slice(0, 300),
                detail: (i.edges.length ? `rests on ${i.edges.join('; ')}` : 'no edge reaches it').slice(0, 2000),
                ...(loc ? { file: loc[1] as string, line: Number(loc[2]) } : {}),
                ...(ex ? { exhibits: [ex] } : {}),
            });
        }
    }
    return out;
}
