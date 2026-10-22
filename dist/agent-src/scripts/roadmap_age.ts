/**
 * How long each active roadmap has gone without a ticked step, read from git.
 *
 * The dashboard printed percentages and nothing about time, so a file that
 * landed weeks ago with every box open looked the same as one that landed
 * this morning. Two ages per file, both from `git log` and never from a field
 * an author writes: days since the file landed at its current path, and days
 * since the last commit that ticked a step in it — a commit that adds more
 * `[x]` lines than it removes.
 *
 * A file with no ticked step 21 days after landing is listed as a PARK
 * PROPOSAL. It is text: nothing here moves, archives or deletes a file, because
 * parking is a disposition a person makes (`roadmap-progress-sync`). One
 * frontmatter line `renewed: <YYYY-MM-DD> — <reason>` clears the proposal for
 * 21 days from that date.
 *
 * No git, a shallow clone, or a path git does not know → the ages read `—` and
 * no proposal is made; an unknown age is never reported as a stall.
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';

export const STALL_DAYS = 21;

export interface RoadmapAge {
    /** Date the file was added at its current path, `YYYY-MM-DD`, or null. */
    readonly landed: string | null;
    /** Date of the newest commit that ticked a step, or null. */
    readonly last_tick: string | null;
}

const DONE_LINE_RE = /^[ \t]*[-*][ \t]+\[[xX]\][ \t]/;

/**
 * Parse `git log -U0 -p --no-renames --format='@@C %as'` output into ages per
 * repo-relative path. Pure, so the parser is testable without a repository.
 */
export function parse_age_log(log: string): Map<string, RoadmapAge> {
    const landed = new Map<string, string>();
    const ticked = new Map<string, string>();
    let date: string | null = null;
    let file: string | null = null;
    let net = 0;
    const flush = (): void => {
        if (date !== null && file !== null && net > 0 && !ticked.has(file)) {
            ticked.set(file, date);
        }
        net = 0;
    };
    for (const line of log.split('\n')) {
        if (line.startsWith('@@C ')) {
            flush();
            date = line.slice(4).trim();
            file = null;
        } else if (line.startsWith('diff --git ')) {
            flush();
            const m = / b\/(.+)$/.exec(line);
            file = m ? m[1]! : null;
        } else if (line.startsWith('new file mode') && file !== null && date !== null) {
            // newest first: the first add seen is the most recent landing
            if (!landed.has(file)) landed.set(file, date);
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
            if (DONE_LINE_RE.test(line.slice(1))) net++;
        } else if (line.startsWith('-') && !line.startsWith('---')) {
            if (DONE_LINE_RE.test(line.slice(1))) net--;
        }
    }
    flush();
    const out = new Map<string, RoadmapAge>();
    for (const f of new Set([...landed.keys(), ...ticked.keys()])) {
        out.set(f, { landed: landed.get(f) ?? null, last_tick: ticked.get(f) ?? null });
    }
    return out;
}

/** Ages for the given absolute roadmap paths, one `git log` call for all of them. */
export function collect_ages(repo_root: string, roadmap_paths: readonly string[]): Map<string, RoadmapAge> {
    if (roadmap_paths.length === 0) return new Map();
    // A shallow clone reports every file as added in its boundary commit, so its ages are invented.
    const shallow = spawnSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: repo_root, encoding: 'utf-8' });
    if (shallow.status !== 0 || String(shallow.stdout).trim() !== 'false') return new Map();
    const rels = roadmap_paths.map((p) => path.relative(repo_root, p).split(path.sep).join('/'));
    const r = spawnSync('git', ['log', '-U0', '-p', '--no-renames', '--format=@@C %as', '--', ...rels], {
        cwd: repo_root,
        encoding: 'utf-8',
        maxBuffer: 256 * 1024 * 1024,
    });
    if (r.status !== 0 || typeof r.stdout !== 'string') return new Map();
    return parse_age_log(r.stdout);
}

export function days_between(from: string, to: Date): number {
    const t = Date.parse(`${from}T00:00:00Z`);
    if (Number.isNaN(t)) return NaN;
    const today = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
    return Math.floor((today - t) / 86_400_000);
}

const RENEWED_RE = /^renewed:[ \t]*['"]?(\d{4}-\d{2}-\d{2})[ \t]*(?:—|–|-{1,2})[ \t]*(\S[^\n]*?)['"]?[ \t]*$/m;

/** The renewal date in a frontmatter block, when it carries a reason. */
export function renewal_date(frontmatter: string): string | null {
    const m = RENEWED_RE.exec(frontmatter);
    return m ? m[1]! : null;
}

/** Is this file a park proposal today? Unknown ages never are. */
export function is_park_proposal(age: RoadmapAge | undefined, frontmatter: string, now: Date): boolean {
    if (!age || age.landed === null) return false;
    const since_landing = days_between(age.landed, now);
    if (!(since_landing >= STALL_DAYS)) return false;
    if (age.last_tick !== null && age.last_tick >= age.landed) return false;
    const renewed = renewal_date(frontmatter);
    const since_renewal = renewed === null ? NaN : days_between(renewed, now);
    // A renewal dated in the future would clear the proposal forever, so it renews nothing.
    if (since_renewal >= 0 && since_renewal < STALL_DAYS) return false;
    return true;
}

export interface AgeRow {
    readonly rel: string;
    readonly frontmatter: string;
    readonly age: RoadmapAge | undefined;
}

/** The dashboard section: two ages per file, then the park proposals. */
export function render_age_section(rows: readonly AgeRow[], now: Date): string {
    if (rows.length === 0) return '';
    const cell = (d: string | null): string => (d === null ? '—' : String(days_between(d, now)));
    const lines: string[] = [];
    lines.push('## Age\n');
    lines.push(
        'Days since each active roadmap landed at its path and since its last ticked step, ' +
            'read from `git log` (`—` = unknown, or never ticked).\n',
    );
    lines.push('| Roadmap | Days since landing | Days since last tick |');
    lines.push('|---|---:|---:|');
    for (const r of rows) {
        lines.push(`| [${r.rel}](roadmaps/${r.rel}) | ${cell(r.age?.landed ?? null)} | ${cell(r.age?.last_tick ?? null)} |`);
    }
    lines.push('');
    const proposals = rows.filter((r) => is_park_proposal(r.age, r.frontmatter, now));
    if (proposals.length > 0) {
        lines.push('## Park proposals\n');
        lines.push(
            `No ticked step ${String(STALL_DAYS)}+ days after landing. A proposal, never an action: ` +
                'park it, or keep it and add `renewed: <YYYY-MM-DD> — <reason>` to its frontmatter, ' +
                `which clears the proposal for ${String(STALL_DAYS)} days.\n`,
        );
        for (const r of proposals) {
            lines.push(`- [${r.rel}](roadmaps/${r.rel}) — landed ${r.age?.landed ?? '?'}`);
        }
        lines.push('');
    }
    return lines.join('\n') + '\n';
}

/**
 * The dashboard without its `## Age` and `## Park proposals` blocks. Ages are
 * relative to today, so `--check` compares this view: a committed dashboard
 * must not go stale at midnight with no commit.
 */
export function strip_age_section(text: string): string {
    // Only lines render_age_section writes are skipped, so anything else beside the block still counts.
    const AGE_LINE = /^(## Age|## Park proposals|Days since each |No ticked step |\| Roadmap \||\|---\||\| \[|- \[|$)/;
    const out: string[] = [];
    let skipping = false;
    for (const line of text.split('\n')) {
        if (line === '## Age' || line === '## Park proposals') skipping = true;
        else if (skipping && !AGE_LINE.test(line)) skipping = false;
        if (!skipping) out.push(line);
    }
    return out.join('\n');
}
