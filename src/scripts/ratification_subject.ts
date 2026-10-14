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
 * Usage: ratification_subject --files <path> [<path> …] [--root DIR] [--rev REV] [--quiet]
 *
 * `--files` takes the change's WHOLE changed-file list, not its gated subset:
 * which of them are gated is the gate's decision, not the caller's, and passing
 * a pre-filtered list is how a caller silently substitutes its own classifier.
 * Ungated paths are ignored, so `git diff --name-only <base>...HEAD` is the
 * intended input.
 *
 * `--rev` names the commit the digest is taken at (default `HEAD`). The content
 * is read from Git objects at that commit, never from the working tree, so the
 * digest is of what is committed — commit first, then print the digest, and
 * name the same commit the reviewers were shown.
 *
 * `--quiet` prints the digest alone; over an empty gated set it also warns on
 * stderr that the digest covers nothing.
 *
 * Exit codes: 0 = digest printed · 1 = refused: the revision does not resolve,
 * git cannot run or read it, or a gated path escapes the tree or is not absent
 * or a regular file in that commit (nothing on stdout) · 2 = usage error.
 */

import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { expectedSubjectFor } from './check_kernel_edit_ratified.js';
import { DEFAULT_REVISION, GatedSubjectRefusal } from './_lib/ratification_subject.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const files: string[] = [];
    let root = REPO;
    let revision = DEFAULT_REVISION;
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
        if (a === '--rev') {
            const value = argv[i + 1];
            if (value === undefined || value.startsWith('--')) {
                process.stderr.write('error: --rev takes a revision\n');
                return 2;
            }
            revision = value;
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
            'usage: ratification_subject --files <path> [<path> …] [--root DIR] [--rev REV] ' +
                '[--quiet]\n' +
                '       pass the whole changed-file list; the gated subset is this gate’s decision\n',
        );
        return 2;
    }

    // ONE call for both halves, so the printed list is the list the digest
    // covers. Every refusal of the subject computation is one class and is
    // caught here as it is in the gate; anything else is a defect in this
    // file and stays a crash.
    let digest: string;
    let gated: readonly string[];
    let commit: string | null;
    try {
        ({ digest, gatedFiles: gated, revision: commit } = expectedSubjectFor(files, root, revision));
    } catch (err) {
        if (!(err instanceof GatedSubjectRefusal)) {
            throw err;
        }
        process.stderr.write(`error: ${err.message}\n`);
        return 1;
    }

    // A digest over an empty list is a well-formed 64 hex characters and says
    // nothing, so a caller who mistyped a path would otherwise copy a
    // confident-looking answer about no files at all. The full output lists
    // the coverage; `--quiet` drops the list, so it says so on stderr instead.
    if (quiet) {
        if (gated.length === 0) {
            process.stderr.write(
                'warning: no gated file in this change — this digest covers nothing, ' +
                    'and no record is owed\n',
            );
        }
        process.stdout.write(`${digest}\n`);
        return 0;
    }

    process.stdout.write(`subject: ${digest}\n`);
    process.stdout.write(
        `revision: ${commit ?? '(none read — nothing in this change is gated)'}\n`,
    );
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
