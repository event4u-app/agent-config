/**
 * analysis_pr_target.ts — which PR `analyze:pr` reads (step 5.1, ADR-288 D1).
 *
 * Order: the argument (number, `#number` or PR URL), else the current branch's
 * open PR, else the one PR the conversation already named, else one question.
 * Zero or several candidates at the deciding rung ask for the link once; a
 * named PR that is not open asks rather than falling through to a guess.
 * Base and head SHAs are pinned at resolution.
 */
import { execFileSync } from 'node:child_process';

export interface PrInfo {
    number: number;
    baseSha: string;
    headSha: string;
    state: 'OPEN' | 'CLOSED' | 'MERGED';
}

export interface PrLookup {
    byNumber(n: number): PrInfo | null;
    /** Open PR numbers whose head is `branch`. */
    openForBranch(branch: string): number[];
}

export type PrTarget =
    | { kind: 'resolved'; via: 'argument' | 'branch' | 'conversation'; pr: number; baseSha: string; headSha: string }
    | { kind: 'ask'; question: string; candidates: number[] };

const URL_RE = /\/pull\/(\d+)(?:[/?#]|$)/;

/** A PR number from `42`, `#42` or a `…/pull/42` URL; null for anything else. */
export function parsePrRef(ref: string): number | null {
    const s = ref.trim();
    const m = /^#?(\d+)$/.exec(s) ?? URL_RE.exec(s);
    return m === null ? null : Number(m[1]);
}

function mentioned(conversation: readonly string[]): number[] {
    const out = new Set<number>();
    for (const turn of conversation) {
        for (const m of turn.matchAll(/(?:\/pull\/|#)(\d+)\b/g)) out.add(Number(m[1]));
    }
    return [...out];
}

function ask(candidates: number[]): PrTarget {
    const which = candidates.length === 0 ? 'No open PR was found' : `Several PRs fit (${candidates.map((n) => `#${n}`).join(', ')})`;
    return { kind: 'ask', question: `${which} — which PR should be analysed? Paste its link or number.`, candidates };
}

function resolved(via: 'argument' | 'branch' | 'conversation', info: PrInfo | null, candidates: number[]): PrTarget {
    if (info === null || info.state !== 'OPEN') return ask(candidates);
    return { kind: 'resolved', via, pr: info.number, baseSha: info.baseSha, headSha: info.headSha };
}

export function resolvePrTarget(
    input: { argument: string | null; branch: string | null; conversation: readonly string[] },
    lookup: PrLookup,
): PrTarget {
    if (input.argument !== null) {
        const n = parsePrRef(input.argument);
        return n === null ? ask([]) : resolved('argument', lookup.byNumber(n), []);
    }
    if (input.branch !== null) {
        const open = lookup.openForBranch(input.branch);
        if (open.length > 1) return ask(open);
        if (open.length === 1) return resolved('branch', lookup.byNumber(open[0] as number), open);
    }
    const named = mentioned(input.conversation);
    if (named.length === 1) return resolved('conversation', lookup.byNumber(named[0] as number), named);
    return ask(named);
}

/** The gh-backed lookup a door uses; read-only. */
export function ghPrLookup(cwd: string): PrLookup {
    const gh = (args: string[]): string => execFileSync('gh', args, { cwd, encoding: 'utf8' }).trim();
    return {
        byNumber: (n) => {
            try {
                const j = JSON.parse(gh(['pr', 'view', String(n), '--json', 'number,baseRefOid,headRefOid,state'])) as {
                    number: number;
                    baseRefOid: string;
                    headRefOid: string;
                    state: PrInfo['state'];
                };
                return { number: j.number, baseSha: j.baseRefOid, headSha: j.headRefOid, state: j.state };
            } catch {
                return null;
            }
        },
        openForBranch: (branch) =>
            (JSON.parse(gh(['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number'])) as Array<{ number: number }>).map(
                (r) => r.number,
            ),
    };
}
