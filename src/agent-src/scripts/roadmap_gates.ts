#!/usr/bin/env tsx
/**
 * `agent-config gates` — the open decisions that need the user, as actions.
 *
 * The dashboard (`update_roadmap_progress`) already parses every `## Blockers`
 * entry and already counts them per roadmap. What it does not do is separate
 * the blockers the *user* must resolve from the ones the maintainer or an
 * external party owns: the count links into a per-roadmap breakdown, so
 * answering "what do I have to do" means opening every anchor and filtering
 * `Owner:` by hand across the whole file. The fields exist, are CI-enforced by
 * `lint_roadmap_blockers`, and never reach the user in a form they can act on.
 *
 * This command is that missing projection, and nothing more: same parser
 * (`parse_blockers` / `collect`, imported — never re-implemented), filtered by
 * owner, ordered by how much each blocker unblocks, rendered action-first.
 *
 * Deliberately NOT a gate: it exits 0 whether or not decisions are pending.
 * Blocking a pipeline on "the user has an open decision" would turn a
 * visibility aid into a second thing to fight.
 *
 * Invocation (from project root):
 *   ./agent-config gates            # decisions owned by the user
 *   ./agent-config gates --all      # every open blocker, grouped by owner
 *   ./agent-config gates --json     # machine-readable
 */

import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';

import {
    collect,
    blocker_needs_user as needsUser,
    type Blocker,
} from './update_roadmap_progress.js';

const _HERE = fileURLToPath(import.meta.url);

/** Hard wrap for the rendered body — keeps output readable in a narrow pane. */
const WIDTH = 78;

interface Entry {
    blocker: Blocker;
    roadmapRel: string;
    /** Open steps in the roadmap this blocker sits in — the "unblocks" weight. */
    openSteps: number;
}

/**
 * Rejoin wrapped continuation lines into one step each.
 *
 * `parse_blockers` returns `todo` as raw stripped lines, so a step that wraps
 * over three source lines arrives as three entries. A new step starts at an
 * ordered marker (`1.`, `2)`) or a bullet; everything else continues the one
 * before it.
 */
function regroupTodo(todo: readonly string[]): string[] {
    const steps: string[] = [];
    for (const line of todo) {
        const startsStep = /^(\d+[.)]|[-*+])\s/.test(line);
        if (startsStep || steps.length === 0) {
            steps.push(line);
        } else {
            steps[steps.length - 1] = `${steps[steps.length - 1] as string} ${line}`;
        }
    }
    return steps;
}

/** Wrap `text` to `width`, indenting every line after the first by `indent`. */
function wrap(text: string, width: number, indent: string): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return [];
    }
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
        const candidate = cur === '' ? w : `${cur} ${w}`;
        if (candidate.length > width && cur !== '') {
            lines.push(cur);
            cur = w;
        } else {
            cur = candidate;
        }
    }
    if (cur !== '') {
        lines.push(cur);
    }
    return lines.map((l, i) => (i === 0 ? l : indent + l));
}

/**
 * Column width for the label gutter — sized to the longest label in use
 * (`Blocked until:`, 14 chars) plus one separating space, so no value ever
 * runs flush against its own label.
 */
const LABEL_W = 15;

/** A labelled block: `  Label:  value`, wrapped and hanging-indented. */
function field(label: string, value: string): string[] {
    const pad = '  ' + label.padEnd(LABEL_W);
    const indent = ' '.repeat(pad.length);
    const lines = wrap(value, WIDTH - pad.length, indent);
    if (lines.length === 0) {
        return [];
    }
    return [pad + lines[0], ...lines.slice(1)];
}

function collectEntries(roadmapRoot: string): Entry[] {
    const entries: Entry[] = [];
    for (const r of collect(roadmapRoot)) {
        for (const b of r.open_blockers) {
            entries.push({ blocker: b, roadmapRel: r.rel, openSteps: r.open_ });
        }
    }
    // Most-unblocking first; ties broken deterministically so two runs on an
    // unchanged tree print byte-identical output.
    entries.sort(
        (a, b) =>
            b.openSteps - a.openSteps ||
            a.roadmapRel.localeCompare(b.roadmapRel) ||
            a.blocker.id.localeCompare(b.blocker.id),
    );
    return entries;
}

/**
 * The parser's legacy fallback synthesises one blocker per `> Blocked until …`
 * note under the fixed id `legacy`. That id is an implementation detail and
 * says nothing to a reader, and its text is a *condition* ("blocked until X"),
 * not an imperative — so both the heading and the field label are renamed for
 * this one parser-defined case rather than dressed up as a step list.
 */
function isLegacy(b: Blocker): boolean {
    return b.id === 'legacy';
}

function renderEntry(e: Entry, index: number): string[] {
    const head = `${index} · ${isLegacy(e.blocker) ? 'blocked-until note' : e.blocker.id}`;
    const tail =
        e.openSteps > 0 ? `unblocks: ${e.openSteps} step${e.openSteps !== 1 ? 's' : ''}` : '';
    const dashes = Math.max(3, WIDTH - head.length - tail.length - 6);
    const out: string[] = [
        '',
        `── ${head} ${'─'.repeat(dashes)} ${tail}`.trimEnd(),
        ...field('Roadmap:', e.roadmapRel),
        ...field('Blocks:', e.blocker.blocks),
    ];

    const doLabel = isLegacy(e.blocker) ? 'Blocked until:' : 'Do this:';
    const steps = regroupTodo(e.blocker.todo);
    if (steps.length === 0) {
        out.push(
            ...field(
                doLabel,
                '(no steps recorded — the blocker entry in the roadmap needs a ' +
                    '**What to do:** list)',
            ),
        );
    } else {
        out.push(...field(doLabel, steps[0] as string));
        for (const s of steps.slice(1)) {
            // Steps 2..n have no label of their own — align them under the
            // first step's text, i.e. the same gutter `field()` produces.
            const indent = ' '.repeat(LABEL_W + 2);
            const lines = wrap(s, WIDTH - LABEL_W - 2, indent);
            out.push(...lines.map((l, i) => (i === 0 ? indent + l : l)));
        }
    }
    out.push(...field('Done when:', e.blocker.resolvedWhen));
    return out;
}

function render(entries: readonly Entry[], all: boolean): string {
    const mine = entries.filter((e) => needsUser(e.blocker.owner));
    const others = entries.filter((e) => !needsUser(e.blocker.owner));
    const shown = all ? entries : mine;
    const lines: string[] = [];

    if (mine.length === 0) {
        lines.push(
            others.length === 0
                ? 'No open blockers at all.'
                : `Nothing is waiting on you. ${others.length} open blocker` +
                      `${others.length !== 1 ? 's' : ''} sit with maintainer/external` +
                      `${all ? '' : ' — see --all'}.`,
        );
    } else {
        const head =
            `${mine.length} decision${mine.length !== 1 ? 's' : ''} need${mine.length === 1 ? 's' : ''} you`;
        const rest =
            others.length > 0
                ? ` · ${others.length} more with maintainer/external${all ? '' : ' (--all)'}`
                : '';
        lines.push(head + rest);
    }

    let n = 0;
    for (const e of shown) {
        n += 1;
        lines.push(...renderEntry(e, n));
    }
    if (shown.length > 0) {
        lines.push('');
    }
    return lines.join('\n') + '\n';
}

function renderJson(entries: readonly Entry[], all: boolean): string {
    const pick = all ? entries : entries.filter((e) => needsUser(e.blocker.owner));
    return (
        JSON.stringify(
            {
                needsYou: entries.filter((e) => needsUser(e.blocker.owner)).length,
                other: entries.filter((e) => !needsUser(e.blocker.owner)).length,
                blockers: pick.map((e) => ({
                    id: e.blocker.id,
                    roadmap: e.roadmapRel,
                    owner: e.blocker.owner,
                    needsYou: needsUser(e.blocker.owner),
                    blocks: e.blocker.blocks,
                    unblocksSteps: e.openSteps,
                    todo: regroupTodo(e.blocker.todo),
                    resolvedWhen: e.blocker.resolvedWhen,
                })),
            },
            null,
            2,
        ) + '\n'
    );
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/**
 * Same repo-root resolution as the dashboard: honour the cwd when it holds
 * `agents/roadmaps`, otherwise fall back to the git toplevel (monorepo
 * sub-project support).
 */
function _resolveRepoRoot(start: string): string {
    if (_isDir(path.join(start, 'agents', 'roadmaps'))) {
        return start;
    }
    try {
        const r = spawnSync('git', ['rev-parse', '--show-toplevel'], {
            cwd: start,
            encoding: 'utf-8',
            timeout: 10_000,
        });
        const top = (r.stdout || '').trim();
        if (r.status === 0 && top !== '' && _isDir(path.join(top, 'agents', 'roadmaps'))) {
            return top;
        }
    } catch {
        /* not a git repo / git missing — keep the cwd default */
    }
    return start;
}

function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    const all = args.includes('--all');
    const json = args.includes('--json');

    const repoRoot = _resolveRepoRoot(process.cwd());
    const roadmapRoot = path.join(repoRoot, 'agents', 'roadmaps');
    if (!_isDir(roadmapRoot)) {
        process.stdout.write(
            json ? '{"needsYou":0,"other":0,"blockers":[]}\n' : 'No roadmaps directory — nothing to report.\n',
        );
        return 0;
    }

    const entries = collectEntries(roadmapRoot);
    process.stdout.write(json ? renderJson(entries, all) : render(entries, all));
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvPath = path.resolve(process.argv[1]);
    if (import.meta.url === pathToFileURL(argvPath).href) {
        return true;
    }
    // A symlinked invocation (`.augment/scripts` → `dist/agent-src/scripts`, or
    // macOS /var → /private/var) makes the raw URLs differ: import.meta.url is
    // the resolved real path while argv[1] keeps the symlink. Compare realpaths
    // so the entry guard still fires through the projection.
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(argvPath);
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}

export { main, needsUser, regroupTodo, wrap, collectEntries, render, renderJson };
export type { Entry };
