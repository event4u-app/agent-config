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
 * Not wired into `self_review_gate.ts`: an AI-council review (five rounds,
 * 2026-11-06) refused every placement on the gate's required path. The checks
 * are reported by a separate, non-required job instead — `graph_checks_report.ts`.
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

/** One line of `file` (1-based), or undefined when it cannot be read. */
export type LineReader = (file: string, line: number) => string | undefined;

/** The working tree. A caller quoting a commit passes a reader over that commit's blobs instead. */
export function workingTreeReader(root: string): LineReader {
    return (file, line) => {
        try {
            return fs.readFileSync(path.join(root, file), 'utf-8').split('\n')[line - 1];
        } catch {
            return undefined;
        }
    };
}

function presenceAt(read: LineReader, witness: string, commit: string): PresenceExhibit | null {
    const m = /^(.+):(\d+)$/.exec(witness);
    if (!m) return null;
    const file = m[1] as string;
    const line = Number(m[2]);
    const quote = (read(file, line) ?? '').trim().slice(0, MAX_QUOTE_CHARS);
    return quote ? { type: 'presence', path: file, line, quote, commit } : null;
}

/** One finding per flagged item, one per check that could not run; a passing check yields none. */
export function graphCheckFindings(checks: readonly ReviewCheck[], root: string, commit: string, read: LineReader = workingTreeReader(root)): GraphCheckFinding[] {
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
            const ex = i.witness ? presenceAt(read, i.witness, commit) : null;
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
