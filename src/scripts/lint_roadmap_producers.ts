#!/usr/bin/env tsx
/**
 * Every roadmap producer ends in closure — mechanically, not by convention.
 *
 * A command that produces a plan and hands it back with open decisions in it
 * has moved those decisions into execution, where meeting one costs a run.
 * The entrance list used to be hard-coded in three command bodies, so the
 * other six producers were simply not in it and nothing said so.
 *
 * The declaration is now the command's own: `produces_roadmap: true` in the
 * frontmatter. This gate reds a command that declares it and does not end in
 * the closure pass, which is the half a hard-coded list could never check.
 *
 * What counts as ending in closure: the body references the closure pass by
 * one of its two names — the `/challenge-me closure` sub-command, or the
 * `closure_scan` detector it runs. Deliberately a reference check rather than
 * a prose check: prose drifts, and a gate that guesses at intent from wording
 * is the detector that gets weakened until it finds nothing.
 *
 * Exit codes: 0 clean · 1 violations · 2 internal error / bad argv.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const _PROG = 'lint_roadmap_producers';

/** The frontmatter declaration a producer carries. */
export const DECLARATION_RE = /^produces_roadmap:\s*true\s*$/m;

/** Either name of the closure pass discharges the obligation. */
export const CLOSURE_REFS: readonly RegExp[] = [
    /\/challenge-me\s+closure/,
    /challenge-me\/closure/,
    /\bclosure_scan\b/,
];

export interface Violation {
    readonly file: string;
    readonly reason: string;
}

function _frontmatter(text: string): string {
    if (!text.startsWith('---')) return '';
    const end = text.indexOf('\n---', 3);
    return end < 0 ? '' : text.slice(0, end);
}

export function declaresProducer(text: string): boolean {
    return DECLARATION_RE.test(_frontmatter(text));
}

export function endsInClosure(text: string): boolean {
    return CLOSURE_REFS.some((re) => re.test(text));
}

export function checkFile(rel: string, text: string): Violation[] {
    if (!declaresProducer(text)) return [];
    if (endsInClosure(text)) return [];
    return [
        {
            file: rel,
            reason:
                'declares `produces_roadmap: true` and does not end in the closure pass — ' +
                'a producer hands back an execution contract, not a plan with open decisions ' +
                'in it. Reference `/challenge-me closure` (or the `closure_scan` detector) ' +
                'as the command’s last step.',
        },
    ];
}

function _walk(dir: string, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) _walk(full, out);
        else if (e.isFile() && e.name === 'command.md') out.push(full);
    }
}

export function listCommands(root: string): string[] {
    const out: string[] = [];
    _walk(root, out);
    return out;
}

function _repoRoot(): string {
    return path.resolve(path.dirname(_HERE), '..', '..');
}

function _usage(): string {
    return (
        `usage: ${_PROG} [-h] [--quiet] [--json] [--self-test]\n\n` +
        `Every command declaring \`produces_roadmap: true\` ends in the closure pass.\n`
    );
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    let quiet = false;
    let json = false;
    let selfTest = false;
    const unknown: string[] = [];
    for (const a of args) {
        if (a === '-h' || a === '--help') {
            process.stdout.write(_usage());
            return 0;
        } else if (a === '--quiet') quiet = true;
        else if (a === '--json') json = true;
        else if (a === '--self-test') selfTest = true;
        else unknown.push(a);
    }
    if (unknown.length) {
        process.stderr.write(`${_usage()}${_PROG}: error: unrecognized arguments: ${unknown.join(' ')}\n`);
        return 2;
    }
    if (selfTest) return _selfTest();

    const repo = _repoRoot();
    const root = path.join(repo, 'src', 'domains');
    const files = listCommands(root);
    const producers = files.filter((f) => declaresProducer(fs.readFileSync(f, 'utf-8')));

    try {
        // The corpus is the DECLARED producers, not every command: a tree where
        // nobody declares the key is a tree where the declaration was lost, and
        // that is exactly the silent-disarm this assertion exists to catch.
        assertScanned({
            gate: _PROG,
            scanned: producers.length,
            units: 'roadmap producer(s)',
            roots: ['src/domains'],
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`❌  ${e.message}\n`);
            return 2;
        }
        throw e;
    }

    const violations: Violation[] = [];
    for (const f of producers) {
        violations.push(...checkFile(path.relative(repo, f), fs.readFileSync(f, 'utf-8')));
    }

    if (json) {
        process.stdout.write(JSON.stringify(violations, null, 2) + '\n');
        return violations.length ? 1 : 0;
    }
    if (violations.length) {
        process.stderr.write(`❌  ${_PROG}: ${violations.length} producer(s) do not end in closure\n`);
        for (const v of violations) process.stderr.write(`   ${v.file} — ${v.reason}\n`);
        return 1;
    }
    if (!quiet) {
        process.stdout.write(
            `✅  ${_PROG}: ${producers.length} roadmap producer(s), all ending in closure\n`,
        );
    }
    return 0;
}

/** Both directions in-process: a producer without closure reds, one with it does not. */
function _selfTest(): number {
    const withClosure = '---\nname: x\nproduces_roadmap: true\n---\n\nRun `/challenge-me closure`.\n';
    const without = '---\nname: x\nproduces_roadmap: true\n---\n\nHand the plan back.\n';
    const notAProducer = '---\nname: x\n---\n\nHand the plan back.\n';
    const failures: string[] = [];
    if (checkFile('a.md', without).length === 0) failures.push('a producer without closure did not red');
    if (checkFile('b.md', withClosure).length !== 0) failures.push('a producer with closure red');
    if (checkFile('c.md', notAProducer).length !== 0) failures.push('a non-producer was judged');
    if (failures.length) {
        for (const f of failures) process.stderr.write(`❌  ${_PROG} --self-test: ${f}\n`);
        return 1;
    }
    process.stdout.write(`✅  ${_PROG} --self-test: both directions hold\n`);
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
