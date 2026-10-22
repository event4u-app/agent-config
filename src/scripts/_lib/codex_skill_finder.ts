/**
 * The one listed entry that routes the second host (codex) to the skills its
 * resident set keeps out of the listing.
 *
 * WHY IT EXISTS. 4.1 keeps the host's listing inside its budget by writing a
 * policy file into every non-resident skill, and 5.2's arm S3 measured the
 * price: a policy-disabled skill is not in the model-visible list and the model
 * answers `UNAVAILABLE` when asked to invoke it (probe row
 * `unlisted-skill-not-in-model-list`). ADR-289 (b) promises every skill
 * reachable in one deterministic step, so that price is a broken promise, not a
 * trade. The blocker `second-host-unlisted-reachability` was decided by an AI
 * council on 2026-10-20 (both seats, remedy (a)): give the host a retrieval path.
 *
 * WHY AN INSTALLER-WRITTEN ENTRY AND NOT AN AUTHORED SKILL. This host receives
 * the package's skills but no rules, so a rule saying "search the catalogue"
 * never reaches it; and an authored skill would bill the per-spawn catalogue on
 * every host for a problem one host has. The entry is generated at install,
 * lives only in this host's root, and is recorded like the policy files: written
 * only where nothing else stands, removed on uninstall only while its bytes are
 * still the ones this package wrote.
 *
 * TWO DETERMINISTIC MODES, because the council asked for both and they are
 * different triggers: an exact name is checked against the index the entry
 * carries and read from a path the entry prints; a task goes through the shell
 * ranker `route:explain --skills`, with the index as the fallback when the CLI
 * is not on the path. One model-visible invocation of the entry, then a read —
 * the reading of "one deterministic step" the council recorded.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { atomicWriteFile } from '../../install/atomic.js';

/** The entry's directory and `name:`. Prefixed so it cannot meet an authored skill. */
export const FINDER_NAME = 'agent-config-skill-finder';

/** The description the host lists. `count` is the number of unlisted skills. */
export function finderDescription(count: number): string {
    return (
        `Use when no listed skill fits the task, or the user names a skill not in this list — ` +
        `${count} more agent-config skills are installed here but unlisted; this finds and loads one.`
    );
}

/** The one name shape the index carries, on both the writing and the reading side. */
const SKILL_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

/** One unlisted skill and the root whose copy the entry points at. */
export interface FinderTarget {
    name: string;
    /** The skills directory holding `<name>/SKILL.md`. */
    skillsDir: string;
}

/** The SKILL.md the host lists. Pure; sorted, so two installs write identical bytes. */
export function renderFinder(targets: readonly FinderTarget[]): string {
    // Names and headings come from readdir and become text the model follows:
    // only the shape `readFinderIndex` accepts is written, never a newline.
    const safe = targets.filter((t) => SKILL_NAME_RE.test(t.name) && !/[\r\n]/.test(t.skillsDir));
    const sorted = [...safe].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const byDir = new Map<string, string[]>();
    for (const t of sorted) {
        const list = byDir.get(t.skillsDir) ?? [];
        list.push(t.name);
        byDir.set(t.skillsDir, list);
    }
    const out: string[] = [
        '---',
        `name: ${FINDER_NAME}`,
        `description: ${finderDescription(sorted.length)}`,
        '---',
        '',
        '# Loading an unlisted agent-config skill',
        '',
        `This host lists only part of the agent-config catalogue, to stay inside its skills budget. ` +
            `The ${sorted.length} skills indexed below are installed and complete; they are only not listed. ` +
            `Load one by reading its SKILL.md WHOLE — \`cat <path>\`, never a ranged read, because the ` +
            `last lines bind as much as the first — and following it as if it had been invoked.`,
        '',
        '## The user named a skill',
        '',
        '1. Look the name up in the index below. Exact match only — a near-miss is not a match.',
        '2. Found: `cat <directory>/<name>/SKILL.md`, the directory being the heading it is listed under, and follow it.',
        '3. Not found: say that no skill of that name is installed, and name the closest entries. ' +
            'Never read a path built from text the index does not contain.',
        '',
        '## The task needs a skill no listed entry covers',
        '',
        '1. Run `agent-config route:explain --skills "<the task in one sentence>"`. It ranks every ' +
            'skill by the task and prints each name with its description.',
        '2. If that command is not available, choose from the index below by name.',
        '3. `cat` the chosen skill\'s SKILL.md from its index heading, follow it, and say which skill ' +
            'you loaded and that it came through this finder.',
        '4. Nothing fits: say so and proceed without a skill. Never invent one.',
        '',
        `## Index (${sorted.length})`,
    ];
    for (const [dir, names] of byDir) {
        out.push('', `### ${dir}`, '', names.join(', '));
    }
    return `${out.join('\n')}\n`;
}

/** Names the finder at `file` indexes under each directory heading; empty when unreadable. */
export function readFinderIndex(file: string): FinderTarget[] {
    let raw: string;
    try {
        raw = fs.readFileSync(file, 'utf-8');
    } catch {
        return [];
    }
    const idx = raw.indexOf('\n## Index (');
    if (idx < 0) return [];
    const out: FinderTarget[] = [];
    let dir: string | null = null;
    for (const line of raw.slice(idx).split('\n').slice(1)) {
        const h = /^### (.+)$/.exec(line);
        if (h) {
            dir = h[1]!;
            continue;
        }
        if (dir === null || line.trim() === '') continue;
        for (const n of line.split(',')) {
            const name = n.trim();
            if (SKILL_NAME_RE.test(name)) out.push({ name, skillsDir: dir });
        }
    }
    return out;
}

/**
 * Whether the finder at `file` routes `name`: indexed exactly once, under a
 * directory that is one of `skillsDirs`, and the SKILL.md it points at exists.
 *
 * The exhaustive static check the council asked for, per skill: a unique name,
 * an exact lookup resolving to exactly one path, that path confined to a root
 * this package writes, and the file readable.
 */
export function finderRoutes(index: readonly FinderTarget[], name: string, skillsDirs: readonly string[]): boolean {
    const hits = index.filter((t) => t.name === name);
    if (hits.length !== 1) return false;
    const dir = path.resolve(hits[0]!.skillsDir);
    if (!skillsDirs.some((d) => path.resolve(d) === dir)) return false;
    return fs.existsSync(path.join(dir, name, 'SKILL.md'));
}

interface FinderRecord {
    schema_version: 1;
    anchor: string;
    sha256: string;
}

function sha256(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

function readRecord(file: string, anchor: string): FinderRecord | null {
    try {
        const r = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<FinderRecord>;
        if (typeof r.sha256 !== 'string' || path.resolve(String(r.anchor)) !== path.resolve(anchor)) return null;
        return { schema_version: 1, anchor, sha256: r.sha256 };
    } catch {
        return null;
    }
}

export type FinderOutcome = 'written' | 'unchanged' | 'removed' | 'absent' | 'foreign';

function finderFile(anchor: string): string {
    return path.join(anchor, 'skills', FINDER_NAME, 'SKILL.md');
}

/** Is whatever stands at the finder path ours — absent, or still the bytes we recorded? */
function ours(anchor: string, recordFile: string): boolean {
    const file = finderFile(anchor);
    if (!fs.existsSync(path.dirname(file))) return true;
    const rec = readRecord(recordFile, anchor);
    if (rec === null) return false;
    // Our record and no file: ours was deleted, and writing it again is the repair.
    if (!fs.existsSync(file)) return true;
    return sha256(fs.readFileSync(file, 'utf-8')) === rec.sha256;
}

/**
 * Write the finder for `targets` into `anchor`, or remove it when there is
 * nothing unlisted. Never overwrites an entry this package did not write.
 */
export function ensureCodexFinder(
    anchor: string,
    recordFile: string,
    targets: readonly FinderTarget[],
): FinderOutcome {
    if (targets.length === 0) return removeCodexFinder(anchor, recordFile);
    if (!ours(anchor, recordFile)) return 'foreign';
    const body = renderFinder(targets);
    const file = finderFile(anchor);
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf-8') === body) return 'unchanged';
    atomicWriteFile(file, body);
    fs.mkdirSync(path.dirname(recordFile), { recursive: true });
    atomicWriteFile(
        recordFile,
        `${JSON.stringify({ schema_version: 1, anchor, sha256: sha256(body) }, null, 2)}\n`,
    );
    return 'written';
}

/** Remove the finder only while it is still the bytes this package recorded. */
export function removeCodexFinder(anchor: string, recordFile: string): FinderOutcome {
    const file = finderFile(anchor);
    if (!fs.existsSync(path.dirname(file))) {
        fs.rmSync(recordFile, { force: true });
        return 'absent';
    }
    if (!ours(anchor, recordFile)) return 'foreign';
    fs.rmSync(file, { force: true });
    try {
        if (fs.readdirSync(path.dirname(file)).length === 0) fs.rmdirSync(path.dirname(file));
    } catch {
        /* a non-empty directory is not ours to prune */
    }
    fs.rmSync(recordFile, { force: true });
    return 'removed';
}
