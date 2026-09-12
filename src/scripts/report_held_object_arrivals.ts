#!/usr/bin/env tsx
/**
 * How many distinct consumed-inbox rounds raise a held object's subject.
 *
 * WHY A REPORTER AND NOT A GATE
 * -----------------------------
 * The count belongs on the held object as a human-authored line, so that a
 * number arrives with a reason attached. This script derives the figure and
 * prints it; it writes nothing, and the absence of any write is the contract.
 * A generated counter would be a number nobody chose, and the first time it
 * disagreed with the prose beside it the prose would be believed.
 *
 * THE UNIT IS A ROUND, NEVER A FILE
 * ---------------------------------
 * One round can carry a dozen revisions of the same argument. Counting files
 * turns a single arrival into twelve, which inflates exactly the figure this
 * practice exists to make trustworthy. So the unit is a top-level entry of the
 * consumed-inbox tree: a directory is one round however many files it holds,
 * and a loose file dropped at the top level is a round of one. Both are one
 * arrival of the subject, and the report prints the split so a reader can tell
 * which kind they are looking at.
 *
 * NOT-READABLE IS NOT ZERO
 * ------------------------
 * The consumed-inbox tree is gitignored and machine-local. A clone, a fresh
 * worktree and CI all see no tree at all. Reporting that as "0 arrivals" would
 * publish the strongest possible claim from the weakest possible evidence, so
 * an unreachable tree exits 0 saying no prior rounds are readable, and prints
 * no count at all.
 *
 * WHAT THE NUMBER IS NOT
 * ----------------------
 * It is a floor on recurrence over one machine's store, under one pattern. A
 * narrower pattern reads lower and a broader one sweeps in incidental
 * mentions, which is why the pattern and its provenance are printed beside
 * every figure. Two counters written on different days under different
 * patterns are not comparable, and this script's whole purpose is to make the
 * pattern explicit so the next one can be.
 *
 * Exit: 0 always, except a usage error (2). It gates on nothing.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = path.resolve(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Where a held object lives, relative to a repository root. */
export const HELD_DIRS = ['agents/roadmaps/stubs', 'agents/roadmaps/later'] as const;

/** The consumed-inbox tree, relative to a repository root. */
export const INBOX_REL = 'agents/tmp.old';

/** A held object may declare the pattern its counter was measured under. */
const SUBJECT_MARKER = /<!--\s*arrival-subject:\s*(.+?)\s*-->/;

/** Biggest file the scanner will read. Above it the file is skipped and counted as skipped. */
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export type TreeOrigin =
    | 'flag'
    | 'env'
    | 'repo-root'
    | 'main-checkout'
    | 'project-dir'
    | 'unreadable';

export interface TreeResolution {
    /** Absolute path to the tree, or null when nothing readable was found. */
    dir: string | null;
    /** Which candidate answered — printed so a figure carries its provenance. */
    origin: TreeOrigin;
    /** Every candidate considered, in order, with whether it resolved. */
    tried: ReadonlyArray<{ origin: TreeOrigin; dir: string; readable: boolean }>;
}

function isReadableDir(dir: string): boolean {
    try {
        return fs.statSync(dir).isDirectory();
    } catch {
        return false;
    }
}

/**
 * The main checkout behind a linked git worktree, or null.
 *
 * Read off the filesystem rather than by shelling out. In a linked worktree
 * `.git` is a file whose one line points at `<main>/.git/worktrees/<name>`, so
 * the main root is three levels above it. No subprocess, which matters because
 * an inherited git directory has already broken gates in this tree once.
 */
export function mainCheckoutOf(root: string): string | null {
    const dotGit = path.join(root, '.git');
    let raw: string;
    try {
        if (!fs.statSync(dotGit).isFile()) return null;
        raw = fs.readFileSync(dotGit, 'utf8');
    } catch {
        return null;
    }
    const m = /^gitdir:\s*(.+)$/m.exec(raw);
    if (m === null) return null;
    const gitdir = path.resolve(root, m[1]?.trim() ?? '');
    // <main>/.git/worktrees/<name> -> <main>
    const worktrees = path.dirname(gitdir);
    if (path.basename(worktrees) !== 'worktrees') return null;
    return path.dirname(path.dirname(worktrees));
}

/**
 * Find the consumed-inbox tree, reporting which candidate answered.
 *
 * AN EXPLICIT TREE OVERRIDES; IT DOES NOT COMPETE
 * -----------------------------------------------
 * A tree named on the command line or in the environment is the answer, even
 * when it is unreadable. Treating it as the first of several candidates would
 * mean that naming a path that does not exist silently reads some other tree
 * instead — and on every machine where the real tree exists, that makes the
 * unreadable branch impossible to reach. The one behaviour this reporter most
 * needs to be able to demonstrate would be the one behaviour nobody could
 * exercise, which is how a branch ends up shipping with unknown sensitivity.
 *
 * The implicit chain runs only when neither was given. Its order is this root,
 * then the main checkout behind it, because a worktree carries no tree of its
 * own and the honest answers there are either the main checkout's tree or none
 * at all. The host-provided project directory comes last: it is known to point
 * at the parent checkout even from inside a worktree, which is useful and is
 * also a host's opinion rather than a fact about this repository.
 */
export function resolveTree(opts: {
    root: string;
    flag?: string | undefined;
    env?: NodeJS.ProcessEnv;
}): TreeResolution {
    const env = opts.env ?? process.env;
    const fromEnv = env['AGENT_CONFIG_INBOX_TREE'];
    const explicit: { origin: TreeOrigin; dir: string } | null =
        opts.flag !== undefined && opts.flag !== ''
            ? { origin: 'flag', dir: path.resolve(opts.root, opts.flag) }
            : fromEnv !== undefined && fromEnv !== ''
              ? { origin: 'env', dir: path.resolve(opts.root, fromEnv) }
              : null;
    if (explicit !== null) {
        const readable = isReadableDir(explicit.dir);
        const tried = [{ ...explicit, readable }];
        return readable
            ? { dir: explicit.dir, origin: explicit.origin, tried }
            : { dir: null, origin: 'unreadable', tried };
    }

    const candidates: Array<{ origin: TreeOrigin; dir: string }> = [];
    candidates.push({ origin: 'repo-root', dir: path.join(opts.root, INBOX_REL) });
    const main = mainCheckoutOf(opts.root);
    if (main !== null && path.resolve(main) !== path.resolve(opts.root)) {
        candidates.push({ origin: 'main-checkout', dir: path.join(main, INBOX_REL) });
    }
    const projectDir = env['CLAUDE_PROJECT_DIR'];
    if (projectDir !== undefined && projectDir !== '') {
        candidates.push({ origin: 'project-dir', dir: path.join(projectDir, INBOX_REL) });
    }

    const tried = candidates.map((c) => ({ ...c, readable: isReadableDir(c.dir) }));
    const hit = tried.find((c) => c.readable);
    return hit === undefined
        ? { dir: null, origin: 'unreadable', tried }
        : { dir: hit.dir, origin: hit.origin, tried };
}

export interface RoundMatch {
    /** Top-level entry name — the round's codename. */
    name: string;
    /** `dir` = a round directory. `file` = a loose drop at the top level. */
    kind: 'dir' | 'file';
}

export interface RoundCount {
    matches: RoundMatch[];
    /** Top-level entries examined — the denominator the count was taken over. */
    examined: number;
    /** Files the scanner could not read, so a low count is never silently a clean one. */
    unreadable: number;
    /** Files skipped for size. */
    oversized: number;
}

function fileRaises(file: string, re: RegExp, tally: { unreadable: number; oversized: number }): boolean {
    let size: number;
    try {
        const st = fs.statSync(file);
        if (!st.isFile()) return false;
        size = st.size;
    } catch {
        tally.unreadable += 1;
        return false;
    }
    if (size > MAX_FILE_BYTES) {
        tally.oversized += 1;
        return false;
    }
    try {
        return re.test(fs.readFileSync(file, 'utf8'));
    } catch {
        tally.unreadable += 1;
        return false;
    }
}

function dirRaises(dir: string, re: RegExp, tally: { unreadable: number; oversized: number }): boolean {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        tally.unreadable += 1;
        return false;
    }
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isSymbolicLink()) continue;
        if (e.isDirectory()) {
            if (dirRaises(full, re, tally)) return true;
        } else if (e.isFile()) {
            if (fileRaises(full, re, tally)) return true;
        }
    }
    return false;
}

/**
 * Count distinct rounds whose contents match `re`.
 *
 * A round stops being examined the moment one of its files matches: the
 * question is whether the round raised the subject, not how loudly.
 */
export function countRounds(tree: string, re: RegExp): RoundCount {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(tree, { withFileTypes: true });
    } catch {
        return { matches: [], examined: 0, unreadable: 1, oversized: 0 };
    }
    const tally = { unreadable: 0, oversized: 0 };
    const matches: RoundMatch[] = [];
    let examined = 0;
    for (const e of entries.slice().sort((a, b) => a.name.localeCompare(b.name))) {
        if (e.name.startsWith('.')) continue;
        if (e.isSymbolicLink()) continue;
        const full = path.join(tree, e.name);
        if (e.isDirectory()) {
            examined += 1;
            if (dirRaises(full, re, tally)) matches.push({ name: e.name, kind: 'dir' });
        } else if (e.isFile()) {
            examined += 1;
            if (fileRaises(full, re, tally)) matches.push({ name: e.name, kind: 'file' });
        }
    }
    return { matches, examined, unreadable: tally.unreadable, oversized: tally.oversized };
}

export interface HeldObject {
    /** Repo-relative path. */
    rel: string;
    /** File stem. */
    slug: string;
    /** Declared subject pattern, when the object carries one. */
    declared: string | null;
}

/** Locate a held object by path or by slug. */
export function findHeldObject(root: string, ref: string): HeldObject | null {
    const direct = path.isAbsolute(ref) ? ref : path.join(root, ref);
    const candidates = [direct];
    const bare = path.basename(ref).replace(/\.md$/, '');
    for (const d of HELD_DIRS) candidates.push(path.join(root, d, `${bare}.md`));
    for (const c of candidates) {
        let text: string;
        try {
            if (!fs.statSync(c).isFile()) continue;
            text = fs.readFileSync(c, 'utf8');
        } catch {
            continue;
        }
        const m = SUBJECT_MARKER.exec(text);
        return {
            rel: path.relative(root, c),
            slug: path.basename(c).replace(/\.md$/, ''),
            declared: m === null ? null : (m[1] ?? null),
        };
    }
    return null;
}

/**
 * A pattern derived from a slug, used only when the object declares none.
 *
 * Deliberately weak, and printed as such. The recorded counters in this tree
 * were taken under hand-written subject patterns, and a slug is a filename
 * rather than a subject — so this reads as a hard floor and usually as zero.
 * It exists so the tool answers for any object rather than refusing, and the
 * output says which kind of pattern produced the figure.
 */
export function slugPattern(slug: string): string {
    return slug.replace(/^road-to-/, '').replace(/-/g, '[-_ .]');
}

type PatternOrigin = 'flag' | 'declared' | 'slug';

function buildPattern(
    obj: HeldObject | null,
    flag: string | undefined,
): { source: string; origin: PatternOrigin } {
    if (flag !== undefined && flag !== '') return { source: flag, origin: 'flag' };
    if (obj !== null && obj.declared !== null) return { source: obj.declared, origin: 'declared' };
    if (obj !== null) return { source: slugPattern(obj.slug), origin: 'slug' };
    return { source: '', origin: 'slug' };
}

const PATTERN_NOTE: Record<PatternOrigin, string> = {
    flag: 'given on the command line',
    declared: 'declared on the object itself',
    slug: 'derived from the slug — a hard floor, and usually the wrong question; pass --pattern',
};

const ORIGIN_NOTE: Record<TreeOrigin, string> = {
    flag: '--tree',
    env: 'AGENT_CONFIG_INBOX_TREE',
    'repo-root': 'this repository root',
    'main-checkout': "the main checkout behind this worktree",
    'project-dir': 'CLAUDE_PROJECT_DIR',
    unreadable: 'nothing',
};

export interface ReportResult {
    exit: number;
    text: string;
}

export function report(argv: readonly string[], root: string): ReportResult {
    const out: string[] = [];
    const arg = (name: string): string | undefined => {
        const i = argv.indexOf(name);
        return i === -1 ? undefined : argv[i + 1];
    };
    const positional = argv.filter((a, i) => !a.startsWith('--') && !String(argv[i - 1] ?? '').startsWith('--'));
    const ref = positional[0];
    if (ref === undefined) {
        return { exit: 2, text: 'usage: report_held_object_arrivals <held-object> [--pattern RE] [--tree DIR] [--root DIR] [--ignore-case] [--list]\n' };
    }

    const obj = findHeldObject(root, ref);
    if (obj === null) {
        out.push(`held object not found: ${ref}`);
        out.push(`  looked in: ${HELD_DIRS.join(', ')}`);
        return { exit: 2, text: `${out.join('\n')}\n` };
    }

    const { source, origin: patternOrigin } = buildPattern(obj, arg('--pattern'));
    // Case-sensitive by default, so the tool reproduces a plain `grep -rl`.
    // Every recorded counter in this tree was taken that way, and a figure
    // that quietly reads two rounds higher than the line it is checking is
    // worse than no figure: it looks like drift in the store rather than a
    // difference in the question asked.
    const fold = argv.includes('--ignore-case') || argv.includes('-i');
    let re: RegExp;
    try {
        re = new RegExp(source, fold ? 'i' : '');
    } catch (e) {
        return { exit: 2, text: `bad --pattern: ${String(e)}\n` };
    }

    const tree = resolveTree({ root, flag: arg('--tree') });

    out.push(`object:  ${obj.rel}`);
    out.push(`pattern: /${source}/${fold ? 'i' : ''}  (${PATTERN_NOTE[patternOrigin]})`);

    if (tree.dir === null) {
        out.push('tree:    unreadable');
        for (const t of tree.tried) out.push(`  · ${t.origin}: ${t.dir} — absent`);
        out.push('');
        out.push('no prior rounds readable — the consumed-inbox tree is gitignored and');
        out.push('machine-local, so this environment cannot see it. This is NOT a count of');
        out.push('zero arrivals: no reading was taken. Point --tree at the tree, or run');
        out.push('where it lives.');
        return { exit: 0, text: `${out.join('\n')}\n` };
    }

    const counted = countRounds(tree.dir, re);
    const dirs = counted.matches.filter((m) => m.kind === 'dir').length;
    const files = counted.matches.length - dirs;
    out.push(`tree:    ${tree.dir}  (via ${ORIGIN_NOTE[tree.origin]})`);
    out.push('');
    out.push(
        `arrivals: ${String(counted.matches.length)} distinct round(s) of ${String(counted.examined)} examined` +
            ` — ${String(dirs)} round director(ies), ${String(files)} loose drop(s)`,
    );
    if (counted.unreadable > 0) out.push(`  note: ${String(counted.unreadable)} path(s) unreadable — the count is a floor`);
    if (counted.oversized > 0) out.push(`  note: ${String(counted.oversized)} file(s) skipped for size`);
    out.push('');
    out.push('The figure is a floor on recurrence over one machine\'s store under one');
    out.push('pattern. Write it onto the object by hand, with this pattern and this');
    out.push('denominator beside it, so the next reader can tell a measured count from a');
    out.push('remembered one.');
    if (argv.includes('--list') || counted.matches.length <= 40) {
        out.push('');
        out.push('rounds:');
        for (const m of counted.matches) out.push(`  · ${m.name}${m.kind === 'file' ? ' (loose drop)' : ''}`);
    }
    return { exit: 0, text: `${out.join('\n')}\n` };
}

export function main(argv: readonly string[]): number {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(
            'usage: report_held_object_arrivals <held-object> [--pattern RE] [--tree DIR] [--root DIR] [--list]\n\n' +
                '  <held-object>  a path, or a bare slug resolved under the held-object directories\n' +
                '  --pattern RE   the subject pattern; overrides any the object declares\n' +
                '  --tree DIR     the consumed-inbox tree; otherwise resolved and reported\n' +
                '  --ignore-case  fold case; the default is a case-sensitive grep\n' +
                '  --list         list every matched round even when there are many\n',
        );
        return 0;
    }
    const i = argv.indexOf('--root');
    const root = i === -1 ? REPO_ROOT : (argv[i + 1] ?? REPO_ROOT);
    const res = report(argv, root);
    process.stdout.write(res.text);
    return res.exit;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
