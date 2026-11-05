/**
 * Read-only reader for the host's own auto-memory, as a recurrence source for
 * the self-repair subject index (`SUBJECT_INDEX_FILE` in `self_repair_store`).
 *
 * A correction the host already recorded as `type: feedback` is an earlier
 * arrival of that subject. The read is permitted without a consent prompt
 * (owner answer OQ-33); its boundary was decided by the AI council on
 * 2026-11-04: the CURRENT project's memory directory only. Another project's
 * memory may describe an unrelated codebase or client, and a worktree's own
 * directory is a different host context — neither is enumerated.
 *
 * Never writes, renames or touches anything under the host directory. Fails
 * closed: a missing directory, a directory that is a symlink, a symlinked entry,
 * an oversized file or an unreadable one contributes nothing.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { DEFAULT_PROJECTS_ROOT, projectStoreDir } from './cc_transcript.js';

/** Per-file cap; a file above it is skipped whole, never truncated mid-frontmatter. */
export const HOST_MEMORY_MAX_BYTES = 64 * 1024;
/** Per-scan cap on files read, so a huge directory cannot stall a hook. */
export const HOST_MEMORY_MAX_FILES = 500;

/** The host's index file — pointers to memories, not a memory itself. */
const INDEX_FILE = 'MEMORY.md';

export interface HostFeedback {
    file: string;
    text: string;
}

/** The current project's host memory directory — the only one this reader opens. */
export function hostMemoryDir(root: string, projectsRoot: string = DEFAULT_PROJECTS_ROOT): string {
    return path.join(projectStoreDir(root, projectsRoot), 'memory');
}

function feedbackType(text: string): boolean {
    const fm = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
    // Matches both a top-level `type:` and the nested `metadata:\n  type:` shape.
    return fm !== null && /^\s*type:\s*["']?feedback["']?\s*$/m.test(fm[1] ?? '');
}

/** The `type: feedback` memories in `dir`, in name order. */
export function readHostFeedback(dir: string): HostFeedback[] {
    let entries: fs.Dirent[];
    try {
        if (!fs.lstatSync(dir).isDirectory()) return [];
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const names = entries
        .filter((e) => e.isFile() && e.name.endsWith('.md') && e.name !== INDEX_FILE)
        .map((e) => e.name)
        .sort()
        .slice(0, HOST_MEMORY_MAX_FILES);
    const out: HostFeedback[] = [];
    for (const name of names) {
        const file = path.join(dir, name);
        try {
            const st = fs.lstatSync(file);
            if (!st.isFile() || st.size > HOST_MEMORY_MAX_BYTES) continue;
            const text = fs.readFileSync(file, 'utf-8');
            if (feedbackType(text)) out.push({ file, text });
        } catch {
            // unreadable entry: contributes nothing
        }
    }
    return out;
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Per known subject, the number of feedback memories naming it as a whole word.
 * Subjects absent from `subjects` are never created from memory content.
 */
export function hostMemoryArrivals(subjects: readonly string[], feedback: readonly HostFeedback[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const subject of subjects) {
        const re = new RegExp(`(?<![\\p{L}\\p{N}_-])${escapeRegExp(subject)}(?![\\p{L}\\p{N}_-])`, 'iu');
        const n = feedback.filter((f) => re.test(f.text)).length;
        if (n > 0) out[subject] = n;
    }
    return out;
}
