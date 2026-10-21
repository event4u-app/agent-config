#!/usr/bin/env tsx
/**
 * ratification_record — print a ratification record rendered from a council
 * session record and the committed prompt it answered, instead of a typed one.
 *
 * Usage: ratification_record --session <council-json> --files <path> [<path> …]
 *        --proposed-by <id> --implemented-by <id> --summary <text>
 *        [--declared] [--rev REV] [--effective-after merge|ISO]
 *
 * `--files` is the change's whole changed-file list. By default the subject is
 * the gate's own `expectedSubjectFor` over it, so the record answers for what
 * `check_kernel_edit_ratified` will recompute. `--declared` takes instead the
 * digest over EVERY listed file that `proposal:check` binds a package
 * proposal's review to. The record is printed to stdout; the caller commits it.
 * What it can and cannot establish is in `_lib/ratification_record_writer.ts`.
 *
 * Exit codes: 0 = record printed · 1 = refused (provenance, digest or shape) ·
 * 2 = usage error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { expectedSubjectFor } from './check_kernel_edit_ratified.js';
import { proposalSubjectOf } from './check_proposal.js';
import { readRequiredProviders } from './_lib/ratification_artifact.js';
import { RatificationWriteRefused, renderRecord } from './_lib/ratification_record_writer.js';
import { DEFAULT_REVISION, GatedSubjectRefusal, resolveRevision } from './_lib/ratification_subject.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function main(argv: readonly string[] = process.argv.slice(2), root: string = REPO): number {
    const values = new Map<string, string>();
    const files: string[] = [];
    let declared = false;
    let collecting = false;
    const valued = new Set(['--session', '--proposed-by', '--implemented-by', '--summary', '--rev', '--effective-after']);
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] ?? '';
        if (valued.has(a)) {
            const v = argv[i + 1];
            if (v === undefined || v.startsWith('--')) {
                process.stderr.write(`error: ${a} takes a value\n`);
                return 2;
            }
            values.set(a, v);
            i += 1;
            collecting = false;
        } else if (a === '--files') {
            collecting = true;
        } else if (a === '--declared') {
            declared = true;
            collecting = false;
        } else if (collecting && !a.startsWith('--')) {
            files.push(a);
        } else {
            process.stderr.write(`error: unknown argument ${a}\n`);
            return 2;
        }
    }
    for (const required of ['--session', '--proposed-by', '--implemented-by', '--summary']) {
        if (!values.has(required)) {
            process.stderr.write(`error: ${required} is required\n`);
            return 2;
        }
    }
    if (files.length === 0) {
        process.stderr.write('error: --files needs at least one path\n');
        return 2;
    }
    try {
        const commit = resolveRevision(root, values.get('--rev') ?? DEFAULT_REVISION);
        const subject = declared
            ? proposalSubjectOf(root, files, commit)
            : expectedSubjectFor(files, root, commit).digest;
        const session: unknown = JSON.parse(fs.readFileSync(values.get('--session') as string, 'utf8'));
        let policy: string | null = null;
        try {
            policy = fs.readFileSync(path.join(REPO, 'src/config/ratification-policy.json'), 'utf8');
        } catch {
            policy = null;
        }
        const required = readRequiredProviders(policy);
        if (required === null) {
            process.stderr.write('❌  the ratification policy is missing or unparseable\n');
            return 1;
        }
        const text = renderRecord(
            {
                session,
                root,
                commit,
                subject,
                proposed_by: values.get('--proposed-by') as string,
                implemented_by: values.get('--implemented-by') as string,
                effective_after: values.get('--effective-after'),
                summary: values.get('--summary') as string,
            },
            required,
        );
        process.stdout.write(text);
        return 0;
    } catch (err) {
        if (err instanceof RatificationWriteRefused || err instanceof GatedSubjectRefusal || err instanceof SyntaxError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return 1;
        }
        throw err;
    }
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const here = fileURLToPath(import.meta.url);
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(here) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
