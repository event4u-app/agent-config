/**
 * Introducing-commit candidates (roadmap H.4). For a fix commit, the last
 * change of each line it removed or rewrote, read by `git blame` on the fix's
 * parent: whitespace ignored, renames and copies followed, and a commit whose
 * diff is format-only is skipped by re-blaming past it.
 *
 * Always candidates with a method and line witnesses — never facts, and never
 * ranked by author. A declared `Fixes: <sha>` wins over blame; a suspect
 * commit the tracker imported is reported beside them as its own signal.
 */
import { classifyFix } from './fix_kinds.js';

type Git = (args: readonly string[]) => string;

export interface InducerWitness {
    file: string;
    /** the line in the fix's parent */
    line: number;
}

export interface InducerCandidate {
    sha: string;
    method: 'declared' | 'blame';
    witnesses: InducerWitness[];
}

export interface InducerResult {
    fix: string;
    candidates: InducerCandidate[];
    /** a commit the tracker suspects, kept apart from local evidence */
    tracker_suspect: string | null;
    /** commits skipped because their change was format-only */
    skipped_format_only: string[];
}

const MAX_SKIP_ROUNDS = 5;

/** Old-side line ranges the fix removed or rewrote, per old path. */
export function changedOldLines(diff: string): Array<{ file: string; start: number; end: number }> {
    const out: Array<{ file: string; start: number; end: number }> = [];
    let file: string | null = null;
    for (const line of diff.split('\n')) {
        const from = /^--- (?:a\/(.*)|\/dev\/null)$/.exec(line);
        if (from) {
            file = from[1] ?? null;
            continue;
        }
        const h = /^@@ -(\d+)(?:,(\d+))? \+/.exec(line);
        if (h && file !== null) {
            const start = Number(h[1]);
            const len = h[2] === undefined ? 1 : Number(h[2]);
            if (len > 0) out.push({ file, start, end: start + len - 1 });
        }
    }
    return out;
}

/** Commits that touch this file only in whitespace and blank lines. */
function isFormatOnly(git: Git, sha: string): boolean {
    try {
        const diff = git(['diff', '-w', '--ignore-blank-lines', '-U0', '--no-color', `${sha}^`, sha]);
        return !/^[+-](?![+-]{2} )/m.test(diff);
    } catch {
        return false;
    }
}

function blameLines(git: Git, parent: string, file: string, start: number, end: number, ignore: readonly string[]): Array<{ sha: string; line: number }> {
    let out: string;
    try {
        out = git(['blame', '-w', '-M', '-C', '--porcelain', ...ignore.flatMap((r) => ['--ignore-rev', r]), `-L${start},${end}`, parent, '--', file]);
    } catch {
        return [];
    }
    const lines: Array<{ sha: string; line: number }> = [];
    for (const m of out.matchAll(/^([0-9a-f]{40}) \d+ (\d+)/gm)) lines.push({ sha: m[1] as string, line: Number(m[2]) });
    return lines;
}

export function inducersOf(git: Git, fix: string, opts: { trackerSuspect?: string | null; ticketKeys?: readonly string[] | null; trackerKeys?: readonly string[] } = {}): InducerResult {
    const full = git(['rev-parse', fix]).trim();
    const message = git(['log', '-1', '--format=%s%x00%b', full]);
    const [subject = '', body = ''] = message.split('\0');
    const facts = classifyFix(subject, body, { ticketKeys: opts.ticketKeys ?? null, trackerKeys: opts.trackerKeys ?? [] });
    const suspect = opts.trackerSuspect ?? null;
    if (facts.fixes_shas.length > 0) {
        const declared = facts.fixes_shas.map((s) => {
            try {
                return git(['rev-parse', '--verify', `${s}^{commit}`]).trim();
            } catch {
                return s;
            }
        });
        return { fix: full, candidates: declared.map((sha) => ({ sha, method: 'declared', witnesses: [] })), tracker_suspect: suspect, skipped_format_only: [] };
    }
    const parent = `${full}^`;
    const ranges = changedOldLines(git(['diff', '-U0', '-M', '--no-color', parent, full]));
    const ignore: string[] = [];
    let blamed: Array<{ sha: string; line: number; file: string }> = [];
    for (let round = 0; round <= MAX_SKIP_ROUNDS; round++) {
        blamed = ranges.flatMap((r) => blameLines(git, parent, r.file, r.start, r.end, ignore).map((b) => ({ ...b, file: r.file })));
        const fresh = [...new Set(blamed.map((b) => b.sha))].filter((s) => !ignore.includes(s) && isFormatOnly(git, s));
        if (fresh.length === 0) break;
        ignore.push(...fresh);
    }
    const by = new Map<string, InducerWitness[]>();
    for (const b of blamed) {
        if (ignore.includes(b.sha)) continue;
        const list = by.get(b.sha) ?? [];
        list.push({ file: b.file, line: b.line });
        by.set(b.sha, list);
    }
    const candidates: InducerCandidate[] = [...by.entries()]
        .map(([sha, witnesses]) => ({ sha, method: 'blame' as const, witnesses }))
        .sort((a, b) => b.witnesses.length - a.witnesses.length || (a.sha < b.sha ? -1 : 1));
    return { fix: full, candidates, tracker_suspect: suspect, skipped_format_only: ignore };
}
