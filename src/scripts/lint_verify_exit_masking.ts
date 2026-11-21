#!/usr/bin/env tsx
/**
 * No claimed verification may read an exit code that is not the verifier's.
 *
 * A roadmap `verify:` clause and a `docs/CLAIMS.md` `exec:` pointer both say
 * "this command's exit code is the verdict". Written as `task ci | tail -3` or
 * `task test; echo done`, the exit code is `tail`'s or `echo`'s, so the clause
 * passes whatever the verifier did, which is a false green nobody can see in
 * the clause's own output.
 *
 * It parses nothing itself. Step blocks come from `closure_scan`'s `units()`,
 * the clause from `parseVerifyClause`, the pointer from `parse_exec_pointer`,
 * and the masking verdict from `exitMasking` — the same predicate the run
 * classifier reads, so the lint and the classifier cannot disagree about what
 * masks.
 *
 * Corpus: the top-level roadmaps, the parked `later/` and `stubs/` ones, and
 * the claims ledger. Archived roadmaps are excluded: their clauses are spent
 * and nothing re-runs them.
 *
 * Usage:
 *   ./scripts-run src/scripts/lint_verify_exit_masking [--root DIR] [--quiet]
 *
 * Exit codes: 0 clean · 1 a masked command · 2 usage error or dead scope.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { units } from './closure_scan.js';
import { parse_exec_pointer } from './_lib/exec_evidence.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';
import { exitMasking, type ExitMasking } from './_lib/exit_masking.js';
import { parseVerifyClause } from './_lib/verify_clause.js';

const _HERE = fileURLToPath(import.meta.url);
const _PROG = 'lint_verify_exit_masking';
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Roadmap directories read, relative to the root; one level each. */
const ROADMAP_DIRS: readonly string[] = [
    path.join('agents', 'roadmaps'),
    path.join('agents', 'roadmaps', 'later'),
    path.join('agents', 'roadmaps', 'stubs'),
];

const CLAIMS_REL = path.join('docs', 'CLAIMS.md');

export interface MaskingFinding {
    readonly file: string;
    readonly line: number;
    readonly command: string;
    readonly masking: ExitMasking;
}

/** Masked `verify:` clauses in one roadmap's text. */
export function roadmapFindings(file: string, text: string): MaskingFinding[] {
    const out: MaskingFinding[] = [];
    for (const unit of units(text.split('\n'))) {
        const clause = parseVerifyClause(unit.blockText);
        if (clause === null || clause.command === null) continue;
        const masking = exitMasking(clause.command);
        if (masking === null) continue;
        const offset = unit.blockText.split('\n').findIndex((l) => l.includes(clause.command as string));
        out.push({ file, line: unit.line + Math.max(offset, 0), command: clause.command, masking });
    }
    return out;
}

/** Masked `exec:` pointers in a claims ledger, read off `- evidence:` lines as `check_claims` does. */
export function claimsFindings(file: string, text: string): MaskingFinding[] {
    const out: MaskingFinding[] = [];
    text.split('\n').forEach((line, idx) => {
        const field = /^-\s+evidence:\s*(.*)$/.exec(line);
        if (field === null) return;
        const pointer = parse_exec_pointer(field[1] ?? '');
        if (pointer === null || 'error' in pointer) return;
        const masking = exitMasking(pointer.command);
        if (masking === null) return;
        out.push({ file, line: idx + 1, command: pointer.command, masking });
    });
    return out;
}

function roadmapFiles(root: string): string[] {
    const files: string[] = [];
    for (const dir of ROADMAP_DIRS) {
        const abs = path.join(root, dir);
        if (!fs.existsSync(abs)) continue;
        for (const name of fs.readdirSync(abs).sort()) {
            if (name.endsWith('.md')) files.push(path.join(abs, name));
        }
    }
    return files;
}

/** Every finding under a root laid out like this repository. */
export function scanRoot(root: string): MaskingFinding[] {
    return scan(root).findings;
}

function scan(root: string): { files: number; findings: MaskingFinding[] } {
    const findings: MaskingFinding[] = [];
    const roadmaps = roadmapFiles(root);
    for (const file of roadmaps) {
        findings.push(...roadmapFindings(path.relative(root, file), fs.readFileSync(file, 'utf8')));
    }
    const claims = path.join(root, CLAIMS_REL);
    let files = roadmaps.length;
    if (fs.existsSync(claims)) {
        files += 1;
        findings.push(...claimsFindings(CLAIMS_REL, fs.readFileSync(claims, 'utf8')));
    }
    return { files, findings };
}

const REPAIR: Record<ExitMasking, string> = {
    pipe: 'the exit code is the filter\'s — put `set -o pipefail;` in front, or drop the pipe and use the runner\'s own filter flag',
    trailing: 'the exit code is the trailing command\'s — chain with `&&`, or drop the trailing command',
};

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let root = REPO_ROOT;
    let quiet = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--root') {
            const next = argv[i + 1];
            if (next === undefined) {
                process.stderr.write(`${_PROG}: --root needs a path\n`);
                return 2;
            }
            root = path.resolve(next);
            i += 1;
        } else if (a === '--quiet') {
            quiet = true;
        } else {
            process.stderr.write(`usage: ${_PROG} [--root DIR] [--quiet]\n`);
            return 2;
        }
    }

    let result: { files: number; findings: MaskingFinding[] };
    try {
        result = scan(root);
        reportScanned({
            gate: _PROG,
            scanned: result.files,
            units: 'roadmap and claims files',
            roots: [path.join(root, 'agents', 'roadmaps'), path.join(root, CLAIMS_REL)],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return 2;
        }
        throw err;
    }

    if (result.findings.length > 0) {
        process.stderr.write(`❌  ${_PROG}: ${String(result.findings.length)} masked command(s)\n`);
        for (const f of result.findings) {
            process.stderr.write(`   ${f.file}:${String(f.line)} — \`${f.command}\`: ${REPAIR[f.masking]}\n`);
        }
        return 1;
    }
    if (!quiet) {
        process.stdout.write(`✅  ${_PROG}: ${String(result.files)} file(s) scanned, 0 masked commands\n`);
    }
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

if (_isCliEntry()) {
    process.exitCode = main();
}
