/**
 * The reserved-name sweep over flat Claude Code command files.
 *
 * A flat command whose slug shadows a Claude Code built-in never ships on the
 * claude-code anchor — the suite complements the host, it does not overlay its
 * built-ins. The sweep that enforces this used to delete EVERY builtin-named
 * `.md` in the anchor's `commands/` directory, including one another agent
 * package or the consumer had put there. The consumer's own `/review` command
 * disappeared at install time with no message, because the sweep's only
 * question was the filename.
 *
 * The question it asks now is ownership: a file is removed when this package
 * wrote it — the current deploy's own written set, or a path a previous
 * install recorded in the installed-tools manifest. Anything else is FOREIGN:
 * it stays on disk and is reported, so the consumer learns that a built-in
 * name is shadowed by someone and can decide, rather than finding their file
 * gone.
 *
 * Both halves of the sweep's original purpose survive: ours never ships under
 * a reserved name, and the suite still never overlays a built-in with its own
 * file. What it no longer does is enforce that on a file that is not its own.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ReservedSweepResult {
    /** Slugs of OUR files removed because the name is a host built-in. */
    reserved: string[];
    /** Slugs left in place because nothing proves this package wrote them. */
    foreign: string[];
}

/**
 * Remove our builtin-named flat commands from `commandsDir`; keep foreign ones.
 *
 * Both ownership sets are anchor-relative, exactly as the deploy inventory
 * records them. `currentFiles` is this deploy's written set — the live half,
 * and the only one that exists on a first install. `recordedFiles` is what a
 * previous deploy recorded under the same anchor, so a builtin-named file of
 * ours left behind by an older version is still reaped rather than becoming
 * permanently unprovable. A removed entry is dropped from `currentFiles` so
 * the inventory record stays consistent with the tree, exactly as before.
 */
export function sweepReservedNames(
    commandsDir: string,
    currentFiles: Set<string>,
    isBuiltinName: (slug: string) => boolean,
    recordedFiles: ReadonlySet<string>,
): ReservedSweepResult {
    const reserved: string[] = [];
    const foreign: string[] = [];
    let entries: string[] = [];
    try {
        entries = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'));
    } catch {
        return { reserved, foreign };
    }
    for (const fname of entries.sort()) {
        const slug = fname.slice(0, -'.md'.length);
        if (!isBuiltinName(slug)) continue;
        const rel = `commands/${fname}`;
        const ours = currentFiles.has(rel) || recordedFiles.has(rel);
        if (!ours) {
            foreign.push(slug);
            continue;
        }
        fs.rmSync(path.join(commandsDir, fname), { force: true });
        currentFiles.delete(rel);
        reserved.push(slug);
    }
    return { reserved, foreign };
}
