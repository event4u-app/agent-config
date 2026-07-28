#!/usr/bin/env node
/**
 * Personal-context tripwire over TRACKED memory files — invariant 3 of
 * ADR-130 (`subject` axis, road-to-reachable-code-memory Phase 8).
 *
 * Hand-authored first-person / preference vocabulary (DE+EN) that indicates
 * a `subject: user` record leaked into a tracked project artifact. On a hit
 * it HALTS (exit 1) and NEVER rewrites — a human decides.
 *
 * ── Honest-null verdict (pre-registered in the roadmap, applied 2026-07-27):
 * `--history` scanned the FULL git history of agents/memory/** at cut time —
 * see the run record in agents/evidence/reports/spike-reachable-code-memory-s0.md.
 * Per the pre-registration, ZERO fires across the full history means
 * invariant 3 is UNFOUNDED: this script is retained as evidence + an
 * on-demand tool, but it is deliberately NOT wired into CI; invariants 1–2
 * (structural: lint_store_boundary + the memory_signal provenance gate)
 * carry the boundary. A non-zero history result at cut time would have
 * wired it as a vitest gate instead.
 *
 * Exit codes: 0 clean · 1 hits · 2 usage · 3 internal.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Tracked memory surfaces the tripwire watches. */
export const TRACKED_GLOB_ROOT = 'agents/memory';

/**
 * Hand-authored personal-context vocabulary, DE+EN. Deliberately narrow:
 * first-person preference/identity statements — not every "I" (change-log
 * prose like "I/O" or quoted user feedback in an incident record must not
 * trip). Word-boundary anchored; case-insensitive.
 */
export const TRIPWIRE_PATTERNS: readonly RegExp[] = [
    // EN — first-person preference / identity
    /\bI (?:prefer|like|dislike|hate|want|always use|never use)\b/i,
    /\bmy (?:name|email|address|phone|password|birthday|salary)\b/i,
    /\bcall me\b/i,
    // DE — first-person preference / identity (Du-form package: user prose)
    /\bich (?:bevorzuge|mag|hasse|will|möchte|nutze immer|nutze nie)\b/i,
    /\bmein[e]? (?:name|e-?mail|adresse|telefonnummer|passwort|geburtstag|gehalt)\b/i,
    /\bnenn mich\b/i,
];

export interface Hit {
    file: string;
    line: number;
    pattern: string;
    /** commit sha for --history hits; 'worktree' otherwise. */
    ref: string;
}

export function scanText(text: string, file: string, ref: string): Hit[] {
    const hits: Hit[] = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        for (const re of TRIPWIRE_PATTERNS) {
            if (re.test(lines[i]!)) {
                hits.push({ file, line: i + 1, pattern: re.source, ref });
                break;
            }
        }
    }
    return hits;
}

function _git(root: string, args: string[]): string {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Scan the current worktree's tracked memory files. */
export function scanWorktree(root: string): Hit[] {
    const out: Hit[] = [];
    let files: string[];
    try {
        files = _git(root, ['ls-files', TRACKED_GLOB_ROOT]).split('\n').filter(Boolean);
    } catch {
        return out;
    }
    for (const f of files) {
        const p = path.join(root, f);
        if (!fs.existsSync(p)) continue;
        out.push(...scanText(fs.readFileSync(p, 'utf8'), f, 'worktree'));
    }
    return out;
}

/** Scan EVERY historical version of every tracked memory file (all commits). */
export function scanHistory(root: string): { hits: Hit[]; commits: number; blobs: number } {
    const shas = _git(root, ['log', '--all', '--pretty=%H', '--', TRACKED_GLOB_ROOT])
        .split('\n')
        .filter(Boolean);
    const hits: Hit[] = [];
    const seenBlobs = new Set<string>();
    let blobs = 0;
    for (const sha of shas) {
        let listing: string;
        try {
            listing = _git(root, ['ls-tree', '-r', sha, '--', TRACKED_GLOB_ROOT]);
        } catch {
            continue;
        }
        for (const row of listing.split('\n').filter(Boolean)) {
            // <mode> blob <hash>\t<path>
            const m = /^\d+ blob ([0-9a-f]+)\t(.+)$/.exec(row);
            if (!m) continue;
            const [, blob, file] = m;
            if (seenBlobs.has(blob!)) continue;
            seenBlobs.add(blob!);
            blobs++;
            let content: string;
            try {
                content = _git(root, ['cat-file', 'blob', blob!]);
            } catch {
                continue;
            }
            hits.push(...scanText(content, file!, sha.slice(0, 10)));
        }
    }
    return { hits, commits: shas.length, blobs };
}

export function main(argv: string[] = process.argv.slice(2)): number {
    let root = REPO_ROOT;
    let history = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === '--root') root = argv[++i] ?? root;
        else if (a.startsWith('--root=')) root = a.slice('--root='.length);
        else if (a === '--history') history = true;
        else if (a === '-h' || a === '--help') {
            process.stdout.write('usage: lint_memory_tripwire [--root ROOT] [--history]\n');
            return 0;
        } else {
            process.stderr.write(`lint_memory_tripwire: unknown argument ${a}\n`);
            return 2;
        }
    }
    try {
        if (history) {
            const { hits, commits, blobs } = scanHistory(root);
            process.stdout.write(
                `scanned ${commits} commit(s), ${blobs} unique blob(s) under ${TRACKED_GLOB_ROOT}\n`,
            );
            if (hits.length === 0) {
                process.stdout.write('✅  zero tripwire fires across the full history.\n');
                return 0;
            }
            for (const h of hits) {
                process.stdout.write(`  🔴 ${h.ref} ${h.file}:${h.line}  (pattern: ${h.pattern})\n`);
            }
            process.stdout.write(`❌  ${hits.length} fire(s). HALT — never rewrite; a human decides.\n`);
            return 1;
        }
        const hits = scanWorktree(root);
        if (hits.length === 0) {
            process.stdout.write('✅  tripwire clean on tracked memory files.\n');
            return 0;
        }
        for (const h of hits) {
            process.stdout.write(`  🔴 ${h.file}:${h.line}  (pattern: ${h.pattern})\n`);
        }
        process.stdout.write(`❌  ${hits.length} fire(s). HALT — never rewrite; a human decides.\n`);
        return 1;
    } catch (exc) {
        process.stderr.write(`lint_memory_tripwire: internal error: ${String(exc)}\n`);
        return 3;
    }
}

const _isMain = (() => {
    if (process.argv[1] === undefined) return false;
    try {
        return pathToFileURL(fs.realpathSync(path.resolve(process.argv[1]))).href === import.meta.url;
    } catch {
        return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
    }
})();
if (_isMain) {
    process.exit(main());
}
