#!/usr/bin/env tsx
/**
 * The runnable share of `verify:` clauses, per roadmap.
 *
 * A `verify:` clause names a command and never names what the command must
 * produce, so a step can be flipped on a command that cannot fail. Two numbers
 * say how bad that is, and neither had a producing command before this script:
 * how many clauses name a COMMAND at all (the runnable share), and how many
 * name an EXPECTATION (the falsifiable share).
 *
 * THIS IS A READER, NOT A GATE. It exits 0 on every corpus, including one where
 * both shares are zero. That is a property of the reader, not a description of
 * the tree: measured 2026-09-29, the tree carried 230 clauses, 93 naming a
 * command and 6 naming an expectation — neither share is zero, and the
 * commissioning roadmap's claim that the second one was is the first thing this
 * script refuted. A ratchet needs a false-positive rate and two readings a
 * quarter apart; it has neither, and a gate that reds all but a handful of
 * roadmaps at once gets weakened until it finds nothing. What it buys instead
 * is that the NEXT reading is a delta rather than a re-derivation.
 *
 * THE UNIT, stated because the figure is meaningless without it. One unit is
 * one STEP BLOCK (`- [ ]`, `- [x]`, `- [~]`, `- [-]`, plus its continuation
 * lines) that carries a `verify:` clause. Not one line: a clause wraps, and a
 * line count would double-count a wrapped clause and count prose that merely
 * mentions the token. Step blocks come from `closure_scan`'s own `units()`, so
 * the two instruments agree on what a step is; that also inherits its
 * exclusions — fenced code, and the `## Decisions` / `## Blockers` /
 * `## Kill register` / `## Risk Register` discharge sections, where a mention
 * of `verify:` is commentary rather than a step's oracle.
 *
 * Closed steps are counted. A `[x]` flipped on a clause that could not fail is
 * the defect in its completed form, and excluding them would report the
 * backlog as smaller every time someone closed one.
 *
 * CLI:
 *   ./scripts-run src/scripts/roadmap_verify_share
 *   ./scripts-run src/scripts/roadmap_verify_share --json
 *   ./scripts-run src/scripts/roadmap_verify_share --root <dir> [--recursive]
 *
 * Exit codes: 0 always, except 2 for bad argv or a dead scan root.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { units } from './closure_scan.js';
import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';
import { parseVerifyClause } from './_lib/verify_clause.js';

const _HERE = fileURLToPath(import.meta.url);
const _PROG = 'roadmap_verify_share';
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_ROOT = 'agents/roadmaps';

export interface FileShare {
    readonly file: string;
    /** Step blocks carrying a `verify:` clause. */
    readonly clauses: number;
    /** Of those, the ones naming a command — the runnable share. */
    readonly withCommand: number;
    /** Of those, the ones naming an expectation — the falsifiable share. */
    readonly withExpectation: number;
}

export interface ShareReport {
    readonly root: string;
    readonly files: number;
    readonly clauses: number;
    readonly withCommand: number;
    readonly withExpectation: number;
    readonly perFile: readonly FileShare[];
}

/** Count the clauses in one roadmap's text. */
export function shareOf(file: string, text: string): FileShare {
    let clauses = 0;
    let withCommand = 0;
    let withExpectation = 0;
    for (const u of units(text.split('\n'))) {
        if (!u.hasVerify) continue;
        const clause = parseVerifyClause(u.blockText);
        if (clause === null) continue;
        clauses += 1;
        if (clause.command !== null) withCommand += 1;
        if (clause.expect !== null) withExpectation += 1;
    }
    return { file, clauses, withCommand, withExpectation };
}

function markdownFiles(root: string, recursive: boolean): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (recursive) walk(full);
                continue;
            }
            if (e.name.endsWith('.md')) out.push(full);
        }
    };
    walk(root);
    return out.sort();
}

export function report(rootAbs: string, rootLabel: string, recursive: boolean): ShareReport {
    const files = markdownFiles(rootAbs, recursive);
    // A root that resolved to nothing is blindness, not cleanliness: the share
    // would read as a clean 0/0 and the reader would believe it.
    assertScanned({ gate: _PROG, scanned: files.length, units: 'roadmap(s)', roots: [rootLabel] });
    const perFile = files
        .map((f) => shareOf(path.relative(REPO_ROOT, f), fs.readFileSync(f, 'utf-8')))
        .filter((s) => s.clauses > 0);
    return {
        root: rootLabel,
        files: files.length,
        clauses: perFile.reduce((n, s) => n + s.clauses, 0),
        withCommand: perFile.reduce((n, s) => n + s.withCommand, 0),
        withExpectation: perFile.reduce((n, s) => n + s.withExpectation, 0),
        perFile,
    };
}

function pct(n: number, of: number): string {
    return of === 0 ? 'n/a' : `${((n / of) * 100).toFixed(1)}%`;
}

export function render(r: ShareReport): string {
    const lines: string[] = [];
    lines.push(`root: ${r.root}`);
    lines.push(`roadmaps scanned: ${String(r.files)}`);
    lines.push(`verify clauses: ${String(r.clauses)}`);
    lines.push(`  naming a command:     ${String(r.withCommand)} (${pct(r.withCommand, r.clauses)})`);
    lines.push(`  naming an expectation: ${String(r.withExpectation)} (${pct(r.withExpectation, r.clauses)})`);
    lines.push('');
    lines.push('| roadmap | clauses | command | expectation |');
    lines.push('|---|---:|---:|---:|');
    for (const s of r.perFile) {
        lines.push(
            `| \`${path.basename(s.file)}\` | ${String(s.clauses)} | ${String(s.withCommand)} | ${String(s.withExpectation)} |`,
        );
    }
    return lines.join('\n') + '\n';
}

function _usage(): string {
    return (
        `usage: ${_PROG} [-h] [--json] [--root <dir>] [--recursive]\n\n` +
        `Report the runnable and falsifiable share of \`verify:\` clauses. Gates nothing.\n`
    );
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let json = false;
    let recursive = false;
    let root = DEFAULT_ROOT;
    for (let i = 0; i < args.length; i += 1) {
        const a = args[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(_usage());
            return 0;
        } else if (a === '--json') json = true;
        else if (a === '--recursive') recursive = true;
        else if (a === '--root') {
            const next = args[i + 1];
            if (next === undefined) {
                process.stderr.write(`${_usage()}${_PROG}: error: --root needs a directory\n`);
                return 2;
            }
            root = next;
            i += 1;
        } else {
            process.stderr.write(`${_usage()}${_PROG}: error: unrecognized arguments: ${a}\n`);
            return 2;
        }
    }

    const rootAbs = path.isAbsolute(root) ? root : path.join(REPO_ROOT, root);
    let r: ShareReport;
    try {
        r = report(rootAbs, root, recursive);
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`${e.message}\n`);
            return 2;
        }
        throw e;
    }

    process.stdout.write(json ? JSON.stringify(r, null, 2) + '\n' : render(r));
    return 0;
}

function _isCliEntry(): boolean {
    if (!process.argv[1]) return false;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exitCode = main();
}
