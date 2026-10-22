// egress-content: session-content uncovered — posts a PR comment through `gh`, not a model provider; the comment is built from model text about an untrusted PR, neutralised and refused by assertOutbound (_lib/outbound_text.ts) before it leaves
/**
 * analysis_pr_review.ts — the read-only verdict of `analyze:pr` (step 5.2,
 * ADR-288 D1, D9).
 *
 * The PR head is read in a throwaway worktree, the analysts and seats propose
 * candidate findings, a model of a different family tries to disprove each,
 * and what survives the confidence threshold is folded and classified against
 * `base..head`. Every remote effect goes through a `PrReviewPort`; the only
 * write it has is a comment, and it runs only on `--comment`.
 *
 * Finding a defect is model work and stays with the door; this module decides
 * what of it is reported, so a clean head reports "no finding above threshold"
 * instead of a padded list.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { assertOutbound, neutraliseForGithub } from './_lib/outbound_text.js';

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;

const OBJECT_ID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export class ReviewError extends Error {}

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface CandidateFinding {
    severity: Severity;
    file: string;
    line: number;
    claim: string;
    evidence: string;
    fix: string;
    /** The proposer's own confidence, 0..1. */
    confidence: number;
    /** A command or input that shows the defect; null when there is none. */
    reproduction: string | null;
    /** A test that fails on the defect; null or absent when there is none. */
    test?: string | null;
    /** Model family of the analyst or seat that proposed it. */
    family: string;
}

export interface DisproveResult {
    refuted: boolean;
    family: string;
    note: string;
}

export interface PrFinding extends CandidateFinding {
    origin: 'introduced' | 'pre-existing';
    disprove_note: string;
}

export interface PrReviewPort {
    /** A detached checkout of `headSha`; returns its path. */
    openWorktree(headSha: string): string;
    removeWorktree(worktree: string): void;
    diff(baseSha: string, headSha: string): string;
    comment(pr: number, body: string): void;
}

export interface PrReviewInput {
    pr: number;
    baseSha: string;
    headSha: string;
    comment: boolean;
    threshold?: number;
}

export interface PrVerdict {
    pr: number;
    baseSha: string;
    headSha: string;
    findings: PrFinding[];
    belowThreshold: number;
    refuted: number;
    duplicates: number;
    /** ADR-288 D9 metric for this door: introduced findings that carry a reproduction or a test. */
    metric: number;
    text: string;
}

function assertObjectId(sha: string, what: string): string {
    if (!OBJECT_ID.test(sha)) throw new ReviewError(`${what} ${JSON.stringify(sha)} is not a full object id`);
    return sha;
}

function diffPath(raw: string): string | null {
    let p = raw.trim();
    if (p === '/dev/null') return null;
    if (p.startsWith('"') && p.endsWith('"')) p = JSON.parse(p) as string;
    return p.replace(/^b\//u, '');
}

/**
 * Head-side line numbers added per file, read from a unified diff. Inside a
 * hunk the header's line counts decide what is content, so an added line whose
 * own text begins with `++ ` is never mistaken for a file header.
 */
export function addedLines(diff: string): Map<string, Set<number>> {
    const out = new Map<string, Set<number>>();
    let file: string | null = null;
    let line = 0;
    let oldLeft = 0;
    let newLeft = 0;
    for (const raw of diff.split('\n')) {
        if (oldLeft > 0 || newLeft > 0) {
            if (raw.startsWith('+')) {
                if (file !== null) {
                    let set = out.get(file);
                    if (set === undefined) {
                        set = new Set();
                        out.set(file, set);
                    }
                    set.add(line);
                }
                line += 1;
                newLeft -= 1;
            } else if (raw.startsWith('-')) {
                oldLeft -= 1;
            } else if (raw.startsWith(' ') || raw === '') {
                line += 1;
                oldLeft -= 1;
                newLeft -= 1;
            }
            continue;
        }
        if (raw.startsWith('+++ ')) {
            file = diffPath(raw.slice(4));
            continue;
        }
        const hunk = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u.exec(raw);
        if (hunk !== null) {
            oldLeft = hunk[1] === undefined ? 1 : Number(hunk[1]);
            line = Number(hunk[2]);
            newLeft = hunk[3] === undefined ? 1 : Number(hunk[3]);
        }
    }
    return out;
}

function dedupeKey(f: CandidateFinding): string {
    return `${f.file}:${f.line}:${f.claim.trim().replace(/\s+/gu, ' ').toLowerCase()}`;
}

export function renderVerdict(v: Omit<PrVerdict, 'text'>, threshold: number): string {
    const head = `analyze:pr #${v.pr} at ${v.headSha.slice(0, 12)} (base ${v.baseSha.slice(0, 12)})`;
    const tally = `refuted ${v.refuted} · below threshold ${v.belowThreshold} · folded duplicates ${v.duplicates}`;
    if (v.findings.length === 0) return `${head}\n\nno finding above threshold (${threshold}) — ${tally}\n`;
    // Every field below is model text about an untrusted PR: inert before it can be posted.
    const t = neutraliseForGithub;
    const rows = v.findings.map(
        (f) =>
            `- **${t(f.severity)}** \`${t(f.file).replace(/`/gu, "'")}:${f.line}\` — ${t(f.claim)}\n` +
            `  - evidence: ${t(f.evidence)}\n` +
            `  - fix: ${t(f.fix)}\n` +
            `  - confidence: ${f.confidence} · ${f.origin === 'introduced' ? 'introduced here' : 'pre-existing'}` +
            (f.reproduction === null ? '' : `\n  - reproduction: ${t(f.reproduction)}`) +
            (f.test === null || f.test === undefined ? '' : `\n  - test: ${t(f.test)}`),
    );
    return `${head}\n\n${rows.join('\n')}\n\n${tally}\n`;
}

/** Read-only by default: the port's `comment` runs only when `input.comment` is set. */
export function reviewPr(
    input: PrReviewInput,
    port: PrReviewPort,
    analyse: (worktree: string, diff: string) => CandidateFinding[],
    disprove: (finding: CandidateFinding) => DisproveResult,
): PrVerdict {
    const baseSha = assertObjectId(input.baseSha, 'base SHA');
    const headSha = assertObjectId(input.headSha, 'head SHA');
    const threshold = input.threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    const worktree = port.openWorktree(headSha);
    let candidates: CandidateFinding[];
    let diff: string;
    try {
        diff = port.diff(baseSha, headSha);
        candidates = analyse(worktree, diff);
    } finally {
        port.removeWorktree(worktree);
    }
    const added = addedLines(diff);
    let belowThreshold = 0;
    let refuted = 0;
    let duplicates = 0;
    const kept = new Map<string, PrFinding>();
    for (const f of candidates) {
        if (f.confidence < threshold) {
            belowThreshold += 1;
            continue;
        }
        const d = disprove(f);
        if (d.family === f.family) {
            throw new ReviewError(`disprove pass for ${f.file}:${f.line} ran on the proposer's own family (${f.family})`);
        }
        if (d.refuted) {
            refuted += 1;
            continue;
        }
        const key = dedupeKey(f);
        const prior = kept.get(key);
        if (prior !== undefined) {
            duplicates += 1;
            if (prior.confidence >= f.confidence) continue;
        }
        const origin = added.get(f.file)?.has(f.line) === true ? 'introduced' : 'pre-existing';
        kept.set(key, { ...f, origin, disprove_note: d.note });
    }
    const findings = [...kept.values()];
    const shown = (v: string | null | undefined): boolean => typeof v === 'string' && v.trim() !== '';
    const metric = findings.filter((f) => f.origin === 'introduced' && (shown(f.reproduction) || shown(f.test))).length;
    const base = { pr: input.pr, baseSha, headSha, findings, belowThreshold, refuted, duplicates, metric };
    const text = renderVerdict(base, threshold);
    if (input.comment) {
        assertOutbound(text, `analyze:pr comment on #${input.pr}`);
        port.comment(input.pr, text);
    }
    return { ...base, text };
}

/** The git + gh port a door uses. Its one write is `gh pr comment`, reached only through `--comment`. */
export function gitGhReviewPort(cwd: string): PrReviewPort {
    const run = (bin: string, args: string[]): string => execFileSync(bin, args, { cwd, encoding: 'utf8', stdio: 'pipe' });
    return {
        openWorktree: (headSha) => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-pr-'));
            run('git', ['worktree', 'add', '--detach', dir, assertObjectId(headSha, 'head SHA')]);
            return dir;
        },
        removeWorktree: (worktree) => {
            run('git', ['worktree', 'remove', '--force', worktree]);
        },
        diff: (baseSha, headSha) =>
            // Three dots: from the merge base, so commits the base gained later are never the PR's.
            run('git', ['diff', '--no-color', '--no-ext-diff', `${assertObjectId(baseSha, 'base SHA')}...${assertObjectId(headSha, 'head SHA')}`]),
        comment: (pr, body) => {
            const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-pr-body-')), 'body.md');
            fs.writeFileSync(file, body);
            run('gh', ['pr', 'comment', String(pr), '--body-file', file]);
        },
    };
}
