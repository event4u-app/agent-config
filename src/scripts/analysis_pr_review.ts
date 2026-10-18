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
    /** A command, input or test that shows the defect; null when there is none. */
    reproduction: string | null;
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

/** Head-side line numbers added per file, read from a unified diff. */
export function addedLines(diff: string): Map<string, Set<number>> {
    const out = new Map<string, Set<number>>();
    let file: string | null = null;
    let line = 0;
    for (const raw of diff.split('\n')) {
        if (raw.startsWith('+++ ')) {
            const target = raw.slice(4).trim();
            file = target === '/dev/null' ? null : target.replace(/^b\//u, '');
            continue;
        }
        if (raw.startsWith('--- ')) continue;
        const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/u.exec(raw);
        if (hunk !== null) {
            line = Number(hunk[1]);
            continue;
        }
        if (file === null || line === 0) continue;
        if (raw.startsWith('+')) {
            let set = out.get(file);
            if (set === undefined) {
                set = new Set();
                out.set(file, set);
            }
            set.add(line);
            line += 1;
        } else if (raw.startsWith(' ')) {
            line += 1;
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
    const rows = v.findings.map(
        (f) =>
            `- **${f.severity}** \`${f.file}:${f.line}\` — ${f.claim}\n` +
            `  - evidence: ${f.evidence}\n` +
            `  - fix: ${f.fix}\n` +
            `  - confidence: ${f.confidence} · ${f.origin === 'introduced' ? 'introduced here' : 'pre-existing'}` +
            (f.reproduction === null ? '' : `\n  - reproduction: ${f.reproduction}`),
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
    const metric = findings.filter((f) => f.origin === 'introduced' && f.reproduction !== null && f.reproduction.trim() !== '').length;
    const base = { pr: input.pr, baseSha, headSha, findings, belowThreshold, refuted, duplicates, metric };
    const text = renderVerdict(base, threshold);
    if (input.comment) port.comment(input.pr, text);
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
            run('git', ['diff', '--no-color', '--no-ext-diff', `${assertObjectId(baseSha, 'base SHA')}..${assertObjectId(headSha, 'head SHA')}`]),
        comment: (pr, body) => {
            const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-pr-body-')), 'body.md');
            fs.writeFileSync(file, body);
            run('gh', ['pr', 'comment', String(pr), '--body-file', file]);
        },
    };
}
