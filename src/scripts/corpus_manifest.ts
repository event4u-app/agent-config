#!/usr/bin/env tsx
/**
 * `corpus_manifest` — pin the metered-proposer experiment's subject, and check
 * that a fresh checkout reproduces it.
 *
 * Two verbs and no third. `capture` writes the pin from the tree as it stands;
 * `verify` re-captures and reports every difference against a pin on disk.
 * There is deliberately no `update` verb: a pin that can be refreshed in place
 * is a pin that silently follows the tree, which is the property it exists not
 * to have.
 *
 * `verify` exits 3 when the SUBJECT differs and 0 when only the explanatory
 * fields do. That split is the whole point of the exit code — a different
 * runtime version is a fact worth printing and is not a reason to refuse a
 * comparison, while a different subject means the two runs measured different
 * things and no amount of green elsewhere repairs it.
 *
 * Nothing here spends: it reads files and shells out to `git` for the commit.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { partitionActive } from '../install/partitionEligibility.js';
import {
    type CorpusManifest,
    captureManifest,
    diffManifests,
    parseManifest,
    serialiseManifest,
    subjectsEquivalent,
} from './_lib/corpus_manifest.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_USAGE = 2;
/** The subject differs. Distinct from a plain error so a runner can branch. */
export const EXIT_SUBJECT_DIFFERS = 3;

/**
 * The enumeration rule this manifest pins under, as an ID rather than prose.
 *
 * It is part of the digest, so changing the rule changes the subject even when
 * every file hash is unchanged. That is correct: a corpus of the same five
 * files selected by a different rule is a different experiment, and a digest
 * that could not see the difference would let the selection semantics be
 * amended without the pin noticing.
 */
export const ENUMERATION_RULE_ID = 'claude-rules-md-bytesorted-first-N/v1';

const USAGE = `usage: corpus_manifest capture --out FILE [--limit N]
       corpus_manifest verify --manifest FILE

  capture   write the subject pin from the tree as it stands
  verify    re-capture and report every difference against FILE

  --limit N  corpus size, on CAPTURE only; defaults to max_candidates from the
             pre-registered budget, which is the ceiling the run guard aborts
             on. verify re-captures at the size its own manifest pinned, so it
             REFUSES --limit rather than accepting a flag it cannot honour

Exit: 0 ok  ·  1 error  ·  2 usage  ·  3 the SUBJECT differs
`;

/**
 * The corpus size, read from the pre-registered budget rather than defaulted.
 *
 * Hardcoding five here would put a second copy of a pre-registered number in a
 * file nobody would think to check when the budget changed, and the two would
 * disagree in the direction that matters: a manifest pinning more subjects than
 * the run guard admits describes an experiment that cannot be run.
 */
export function defaultLimit(repoRoot: string = REPO_ROOT): number {
    const raw = JSON.parse(
        fs.readFileSync(path.join(repoRoot, 'src', 'config', 'harness-evolution-budget.json'), 'utf-8'),
    ) as { budget?: { max_candidates?: unknown } };
    const n = raw.budget?.max_candidates;
    if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) {
        throw new Error('max_candidates missing or not a positive integer in the pre-registered budget');
    }
    return n;
}

interface Parsed {
    verb?: string;
    out?: string;
    manifest?: string;
    limit?: number;
}

export function parseArgs(argv: readonly string[]): Parsed | string {
    const p: Parsed = {};
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (!a.startsWith('--') && p.verb === undefined) {
            p.verb = a;
            continue;
        }
        const v = argv[i + 1];
        if (v === undefined || v.startsWith('--')) return `${a} requires a value`;
        i += 1;
        if (a === '--out') p.out = v;
        else if (a === '--manifest') p.manifest = v;
        else if (a === '--limit') {
            const n = Number(v);
            if (!Number.isInteger(n) || n <= 0) return '--limit must be a positive integer';
            p.limit = n;
        } else return `unknown option '${a}'`;
    }
    if (p.verb === 'verify' && p.limit !== undefined) {
        return (
            'verify does not take --limit: it re-captures at the size its own manifest pinned, ' +
            'because a re-capture at another corpus size is a comparison against another subject. ' +
            'Accepting the flag and then using the pinned size reported green on a run that had ' +
            'not honoured it'
        );
    }
    return p;
}

/**
 * One real capture over the real tree.
 *
 * This is the one caller for which the process globals `partitionActive` reads
 * — the host layer under the running user's home, and the install lockfile —
 * ARE this run's own host, so it is the one caller that passes the predicate.
 * Everywhere else the field stays `null` rather than recording some other
 * machine's state under this tree's name.
 */
function capture(limit: number): CorpusManifest {
    return captureManifest({
        repoRoot: REPO_ROOT,
        userHome: process.env['HOME'] ?? os.homedir(),
        limit,
        enumerationRule: ENUMERATION_RULE_ID,
        partitionActive,
    });
}

export function main(argv?: string[]): number {
    const args = argv ?? process.argv.slice(2);
    if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        process.stdout.write(USAGE);
        return args.length === 0 ? EXIT_USAGE : EXIT_OK;
    }
    const parsed = parseArgs(args);
    if (typeof parsed === 'string') {
        process.stderr.write(`corpus_manifest: error: ${parsed}\n${USAGE}`);
        return EXIT_USAGE;
    }

    if (parsed.verb === 'capture') {
        if (parsed.out === undefined) {
            process.stderr.write(`corpus_manifest: error: capture requires --out FILE\n${USAGE}`);
            return EXIT_USAGE;
        }
        let m: CorpusManifest;
        try {
            m = capture(parsed.limit ?? defaultLimit());
        } catch (e) {
            process.stderr.write(`corpus_manifest: capture refused — ${(e as Error).message}\n`);
            return EXIT_ERROR;
        }
        fs.mkdirSync(path.dirname(path.resolve(parsed.out)), { recursive: true });
        fs.writeFileSync(parsed.out, serialiseManifest(m), 'utf-8');
        process.stdout.write(
            `corpus_manifest: wrote ${parsed.out} · subject_digest=${m.subject_digest.slice(0, 16)} · ` +
                `${String(m.included.length)} subject(s) · ${String(m.produced.length)} produced · ` +
                `${String(m.user_scope.filter((t) => t.byte_identical).length)} byte-identical ` +
                `twin(s), ${String(m.user_scope.filter((t) => t.causes_skip).length)} of them ` +
                `causing a skip under ${String(m.generator_config['projection.scope_dedup'])}\n`,
        );
        if (m.tree_dirty) {
            process.stdout.write(
                'corpus_manifest: WARNING the working tree is dirty, so the recorded commit does not ' +
                    'describe the bytes that were hashed\n',
            );
        }
        return EXIT_OK;
    }

    if (parsed.verb === 'verify') {
        if (parsed.manifest === undefined) {
            process.stderr.write(`corpus_manifest: error: verify requires --manifest FILE\n${USAGE}`);
            return EXIT_USAGE;
        }
        let expected: CorpusManifest;
        let actual: CorpusManifest;
        try {
            expected = parseManifest(JSON.parse(fs.readFileSync(parsed.manifest, 'utf-8')));
            actual = capture(expected.included.length);
        } catch (e) {
            process.stderr.write(`corpus_manifest: verify refused — ${(e as Error).message}\n`);
            return EXIT_ERROR;
        }
        const diffs = diffManifests(expected, actual);
        for (const d of diffs) {
            process.stdout.write(`corpus_manifest: DIFF ${d.field}: expected ${d.expected}, got ${d.actual}\n`);
        }
        if (subjectsEquivalent(expected, actual)) {
            process.stdout.write(
                `corpus_manifest: SUBJECT EQUIVALENT · ${String(actual.included.length)} subject(s) · ` +
                `digest=${actual.subject_digest.slice(0, 16)}` +
                    (diffs.length > 0 ? ` · ${String(diffs.length)} explanatory difference(s) above\n` : '\n'),
            );
            return EXIT_OK;
        }
        process.stdout.write(
            'corpus_manifest: SUBJECT DIFFERS — a comparison captured against this manifest is not ' +
                'comparable to one captured here\n',
        );
        return EXIT_SUBJECT_DIFFERS;
    }

    process.stderr.write(`corpus_manifest: error: unknown verb ${JSON.stringify(parsed.verb)}\n${USAGE}`);
    return EXIT_USAGE;
}

function _isCliEntry(): boolean {
    try {
        if (process.argv[1] === undefined) return false;
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
