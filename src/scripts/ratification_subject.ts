#!/usr/bin/env tsx
/**
 * ratification_subject — print the `subject:` digest a ratification record must
 * carry to answer for a given change.
 *
 * The record's six original fields say WHO reviewed and never WHAT, so a gated
 * file edited after its review still landed under that review's record. The
 * `subject` digest is what closes that, and it has to be the SAME digest the
 * gate recomputes — which is why this prints it by calling
 * `check_kernel_edit_ratified.expectedSubjectFor` rather than by re-deriving a
 * second reading of which files are gated. A writer with its own list would
 * disagree with the gate exactly on the changes that widen the gated set, which
 * are the changes a record most needs to be right about.
 *
 * Usage: ratification_subject --files <path> [<path> …] [--root DIR]
 *
 * `--files` takes the change's WHOLE changed-file list, not its gated subset:
 * which of them are gated is the gate's decision, not the caller's, and passing
 * a pre-filtered list is how a caller silently substitutes its own classifier.
 * Ungated paths are ignored, so `git diff --name-only <base>...HEAD` is the
 * intended input.
 *
 * Exit codes: 0 = digest printed · 2 = usage error.
 */

import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { expectedSubjectFor } from './check_kernel_edit_ratified.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const files: string[] = [];
    let root = REPO;
    let collecting = false;
    let quiet = false;

    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] ?? '';
        if (a === '--files') {
            collecting = true;
            continue;
        }
        if (a === '--root') {
            // A missing value used to resolve `.` silently. For a command whose
            // output is copied into a governance record, "it quietly used the
            // current directory" is the wrong failure: the digest would be
            // taken over a tree the caller never named.
            const value = argv[i + 1];
            if (value === undefined || value.startsWith('--')) {
                process.stderr.write('error: --root takes a directory\n');
                return 2;
            }
            root = path.resolve(value);
            i += 1;
            collecting = false;
            continue;
        }
        if (a === '--quiet') {
            quiet = true;
            collecting = false;
            continue;
        }
        if (a.startsWith('--')) {
            process.stderr.write(`error: unknown argument ${a}\n`);
            return 2;
        }
        if (!collecting) {
            process.stderr.write(`error: stray argument ${a} — paths follow --files\n`);
            return 2;
        }
        files.push(a);
    }

    if (files.length === 0) {
        process.stderr.write(
            'usage: ratification_subject --files <path> [<path> …] [--root DIR]\n' +
                '       pass the whole changed-file list; the gated subset is this gate’s decision\n',
        );
        return 2;
    }

    // ONE call for both halves. A 2026-10-13 council review found this
    // function printing `gatedFilesOf(files)` — a second classification, with a
    // different `derived` input — beside a digest classified by the gate. The
    // list exists so nobody copies a confident-looking digest over no files;
    // a list that can disagree with its own digest emits exactly that false
    // reassurance instead of preventing it.
    const { digest, gatedFiles: gated } = expectedSubjectFor(files, root);

    if (quiet) {
        process.stdout.write(`${digest}\n`);
        return 0;
    }

    // The gated list is printed with the digest on purpose: a digest over an
    // empty list is a well-formed 64 hex characters and says nothing, so a
    // caller who mistyped a path would otherwise copy a confident-looking
    // answer about no files at all.
    process.stdout.write(`subject: ${digest}\n`);
    process.stdout.write(`\ngated files covered (${String(gated.length)}):\n`);
    if (gated.length === 0) {
        process.stdout.write(
            '  (none — nothing in this change is gated, so no record is owed)\n',
        );
    }
    for (const g of gated) {
        process.stdout.write(`  · ${g}\n`);
    }
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main());
}
