#!/usr/bin/env tsx
/**
 * Evidence-artifact type check (`docs/contracts/evidence-artifact-types.md`).
 *
 * The failure this closes: a review this repo RECEIVED and a findings artifact
 * binding a diff right now are both markdown under `agents/evidence/`, carry no
 * declared kind, and read identically. A reader cannot tell whether a stored
 * artifact still asserts anything — and this repo's own corpus has produced all
 * three observable consequences: a superseded round read as current, a declared
 * skip indistinguishable from a review that found nothing, and an artifact read
 * at a verdict its binding had already moved away from.
 *
 * Two things are checked, and they have different scopes on purpose:
 *
 * 1. **Presence** — changed-files scoped. Every evidence artifact this change
 *    ADDS or MODIFIES must carry the `evidence-type:` marker. The ~330 that
 *    predate the gate are not required to: retro-typing them means classifying
 *    from filename and location, which is the inference § 4 of the contract
 *    forbids, applied at scale. `--all` reports the untyped remainder so the
 *    shrink is observable rather than assumed.
 *
 * 2. **Agreement** — global. A declared type must agree with the body it sits
 *    above, wherever the artifact lives and whenever it was written. A type
 *    nothing cross-checks is a field authors fill in and readers distrust, so
 *    the grammars are reused from `check_completion_review.ts` rather than
 *    re-derived here.
 *
 * Deliberately NOT a baseline file. A `src/config/*-baseline.json` listing the
 * untyped set would be a suppression surface whose entire content is
 * "everything that already exists" — a ratchet that measures nothing, at the
 * cost of an inventory row and a bootstrap flag. The change set is the honest
 * boundary, and it is the one the contract's exit criterion names.
 *
 * An EMPTY change set is a normal pass here (most changes touch no evidence),
 * which is exactly why an UNRESOLVABLE base must not look like one: a base diff
 * that could not run exits 1 rather than reporting a clean zero.
 *
 * Exit codes (contract §6): 0 = pass, 1 = policy violation (including an
 * unresolvable change set), 2 = internal error. `scanned:` is emitted on EVERY
 * exit path, exit 2 included.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { runCountedProbe } from './_lib/counted_probe.js';
import { resolveContentLintScope } from './_lib/release_scope.js';
import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';
import { parseArtifact } from './check_completion_review.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const EVIDENCE_ROOT = 'agents/evidence';
const CONTRACT = 'docs/contracts/evidence-artifact-types.md';

/** The closed set of § 3 type values. */
export const EVIDENCE_TYPES = [
    'original-review',
    'current-binding',
    'honest-null',
    'declared-skip',
    'rebind-event',
] as const;

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export interface TypeMarker {
    type: EvidenceType;
    declared: string;
    line: number;
}

export interface Violation {
    kind: string;
    file: string;
    detail: string;
}

/**
 * The type is captured as `[a-z0-9_-]+`, deliberately WIDER than the five legal
 * values. A value the closed set does not contain must reach the "unknown type"
 * message that names the set — narrowing the class here would send the most
 * plausible typo (`current_binding`, underscore for hyphen) to the generic
 * grammar complaint instead, which does not tell the author what to write.
 */
const MARKER_RE =
    /^<!--\s*evidence-type:\s*v1\s*\|\s*type:\s*([a-z0-9_-]+)\s*\|\s*declared:\s*(\d{4}-\d{2}-\d{2})\s*-->$/;

/** Any line that means to be the marker, so a malformed one fails loudly. */
const MARKER_ATTEMPT_RE = /^<!--.*\bevidence-type\s*:/;

/** § 3 `rebind-event` requires the move to be traceable in the body. */
const REBIND_TRACE_RE = /re-bound\s+at/i;

/**
 * The dispatcher's pre-fill placeholder — the machine-readable "no reviewer has
 * written here yet" state.
 *
 * Load-bearing for the window between dispatch and fill. `current-binding` is
 * stamped at creation (contract § 4) onto a skeleton whose table is empty, and
 * demanding a findings row unconditionally made that skeleton illegal from its
 * first byte — so the pre-push run, CI, and this gate's own corpus test all
 * failed on an artifact the tree is supposed to produce.
 *
 * A never-filled skeleton is NOT double-gated here: `check_completion_review`
 * already refuses a scope whose artifact carries neither a row nor an honest-null
 * line, so an artifact parked in this state fails that gate instead. Repeating
 * the rule here would mean two gates owning one verdict.
 */
const UNFILLED_RE = /<!--\s*reviewer fills the table/i;

export interface ScanResult {
    marker: TypeMarker | null;
    /** Lines that look like the marker but do not match the exact grammar. */
    malformed: string[];
    /** More than one well-formed marker — no rule says which wins. */
    duplicateLines: number[];
}

/**
 * Find the `evidence-type:` marker.
 *
 * Fenced regions are NOT skipped, and that is deliberate: this grammar is
 * quoted in the contract and in tests, so a fence-aware reader would have to
 * decide whether a quoted example counts. The marker is an HTML comment on its
 * own line at column 0; a documentation example is indented or inside a fence
 * with surrounding prose, and the callers that matter (real artifacts) put it
 * below the title. A quoted marker in an artifact is a real ambiguity for a
 * human reader too, so failing on it is the correct direction.
 */
export function scanTypeMarker(text: string): ScanResult {
    const out: ScanResult = { marker: null, malformed: [], duplicateLines: [] };
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const raw = (lines[i] as string).trim();
        if (!MARKER_ATTEMPT_RE.test(raw)) {
            continue;
        }
        const m = MARKER_RE.exec(raw);
        if (m === null) {
            out.malformed.push(
                `line ${String(i + 1)}: does not match the exact §2 grammar ` +
                    '(`<!-- evidence-type: v1 | type: <type> | declared: YYYY-MM-DD -->`)',
            );
            continue;
        }
        const value = m[1] as string;
        if (!(EVIDENCE_TYPES as readonly string[]).includes(value)) {
            out.malformed.push(
                `line ${String(i + 1)}: unknown type \`${value}\` — expected one of ${EVIDENCE_TYPES.join(', ')}`,
            );
            continue;
        }
        if (out.marker !== null) {
            out.duplicateLines.push(i + 1);
            continue;
        }
        out.marker = { type: value as EvidenceType, declared: m[2] as string, line: i + 1 };
    }
    return out;
}

/**
 * § 4 agreement: does the declared type match the body it sits above?
 *
 * Reuses the exported parsers of `check_completion_review.ts` so the
 * `completion-review:` marker, the §2.3 honest-null line and the §2.4 skip
 * declaration are recognised by exactly one implementation.
 */
export function checkAgreement(rel: string, text: string, marker: TypeMarker): Violation[] {
    const out: Violation[] = [];
    const art = parseArtifact(text);
    const has = {
        binding: art.marker !== null,
        rows: art.rows.length > 0,
        null: art.honestNull !== null,
        skip: art.skip !== null,
        rebind: REBIND_TRACE_RE.test(text),
        unfilled: UNFILLED_RE.test(text),
    };
    const push = (detail: string): void => {
        out.push({ kind: `agreement:${marker.type}`, file: rel, detail });
    };

    switch (marker.type) {
        case 'original-review':
            if (has.binding) {
                push(
                    'declared `original-review` but carries a `completion-review:` marker. An input does ' +
                        'not bind a scope — either the type is wrong, or this artifact is a binding and ' +
                        'must say so.',
                );
            }
            // Forbidding only the binding marker left the sharpest hole in the
            // set: a skip body legitimately carries NO `completion-review:`
            // marker, so a skip mistyped `original-review` passed silently —
            // which is exactly the skip-vs-saw-nothing conflation § 3 calls the
            // most consequential ambiguity in the corpus.
            if (has.skip) {
                push('declared `original-review` but carries a §2.4 skip declaration — declare `declared-skip`.');
            }
            if (has.null) {
                push('declared `original-review` but carries a §2.3 honest-null line — declare `honest-null`.');
            }
            break;
        case 'current-binding':
            if (!has.binding) {
                push('declared `current-binding` but carries no `completion-review:` marker to bind a scope.');
            }
            if (!has.rows && !has.unfilled) {
                push(
                    'declared `current-binding` but carries no findings row and no pre-fill placeholder. A ' +
                        'review that RAN and found nothing is `honest-null`; the distinction is the evidence ' +
                        'that looking happened.',
                );
            }
            if (has.null) {
                push('declared `current-binding` but carries an honest-null line — declare `honest-null`.');
            }
            if (has.skip) {
                push('declared `current-binding` but carries a skip declaration — declare `declared-skip`.');
            }
            break;
        case 'honest-null':
            if (!has.binding) {
                push('declared `honest-null` but carries no `completion-review:` marker — a null still binds a scope.');
            }
            if (!has.null) {
                push('declared `honest-null` but carries no §2.3 honest-null line.');
            }
            if (has.rows) {
                push('declared `honest-null` but carries findings rows — a null asserts there were none.');
            }
            if (has.skip) {
                push('declared `honest-null` but carries a skip declaration. A skip means nobody looked; a ' +
                    'null means somebody looked and saw nothing. Conflating them is the ambiguity this ' +
                    'contract exists to remove.');
            }
            break;
        case 'declared-skip':
            if (!has.skip) {
                push('declared `declared-skip` but carries no §2.4 skip declaration.');
            }
            if (has.rows) {
                push('declared `declared-skip` but carries findings rows — a skip asserts nobody looked.');
            }
            if (has.null) {
                push('declared `declared-skip` but carries an honest-null line — declare one or the other.');
            }
            break;
        case 'rebind-event':
            if (!has.binding) {
                push('declared `rebind-event` but carries no `completion-review:` marker — a re-bind still binds.');
            }
            if (!has.rebind) {
                push(
                    'declared `rebind-event` but the move is not traceable in the body. §3 requires a ' +
                        '`re-bound at` trace, so a reader can see WHERE the binding moved to.',
                );
            }
            if (has.skip) {
                push('declared `rebind-event` but carries a skip declaration.');
            }
            break;
    }
    return out;
}

/**
 * Is this path an evidence artifact this gate governs?
 *
 * A `*.review-input/` directory is excluded, and the exclusion is structural
 * rather than a convenience: `dispatch_r2_reviewer.ts` writes a reviewer prompt,
 * a roadmap snapshot and an acceptance-criteria copy in there. Those are the
 * reviewer's INPUTS — they assert nothing about the tree and bind no scope, so
 * none of the five types describes them and demanding one would be a marker
 * added to satisfy a gate. Without this the presence half fired on the
 * dispatcher's own package, which made every future R2 dispatch trip the gate
 * that shipped in the same change.
 */
export function isEvidenceArtifact(rel: string): boolean {
    const norm = rel.replace(/\\/g, '/');
    if (!norm.startsWith(`${EVIDENCE_ROOT}/`) || !norm.endsWith('.md')) {
        return false;
    }
    return !norm.split('/').some((seg) => seg.endsWith('.review-input'));
}

export interface ChangedScope {
    files: string[];
    reason: string;
    /** False when the base-span diff itself could not run — never a clean zero. */
    baseDiffOk: boolean;
}

/**
 * Evidence artifacts added or modified against the resolved base.
 *
 * Union of the base span and the worktree, not a first-hit chain: a branch can
 * carry a committed artifact AND an uncommitted edit to another, and taking only
 * the first non-empty diff would silently drop one of them.
 */
export function gatherChangedArtifacts(repo: string, since?: string | null): ChangedScope {
    const scope = resolveContentLintScope({ cwd: repo, since: since ?? null });
    const commands: string[][] = [
        ['git', 'diff', '--name-only', `${scope.base}...HEAD`],
        ['git', 'diff', '--name-only', '--cached', 'HEAD'],
        ['git', 'diff', '--name-only', 'HEAD'],
        ['git', 'ls-files', '--others', '--exclude-standard'],
    ];
    const seen = new Set<string>();
    let baseDiffOk = false;
    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i] as string[];
        const result = runCountedProbe(cmd[0] as string, cmd.slice(1), { cwd: repo });
        if (i === 0) {
            baseDiffOk = result.ok;
        }
        if (!result.ok) {
            continue;
        }
        for (const raw of result.stdout.split(/\r?\n/)) {
            const rel = raw.trim().replace(/\\/g, '/');
            if (rel === '' || !isEvidenceArtifact(rel)) {
                continue;
            }
            // A deleted artifact has nothing to type.
            if (!fs.existsSync(path.resolve(repo, rel))) {
                continue;
            }
            seen.add(rel);
        }
    }
    return { files: [...seen].sort(), reason: scope.reason, baseDiffOk };
}

/** Every evidence artifact in the tree, for `--all`. */
export function gatherAllArtifacts(repo: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (exc) {
            // An unreadable subtree is silent UNDER-measurement: the population
            // shrinks, `min_scanned` may still clear, and the published remainder
            // understates. The absent-root case is handled by assertScanned in
            // main(); anything else is a real error and must surface.
            const code = (exc as NodeJS.ErrnoException).code;
            if (code === 'ENOENT') return;
            throw new Error(`cannot read ${dir}: ${exc instanceof Error ? exc.message : String(exc)}`);
        }
        for (const e of entries) {
            const abs = path.join(dir, e.name);
            if (e.isSymbolicLink()) continue;
            if (e.isDirectory()) walk(abs);
            else if (e.isFile()) {
                // The SAME predicate the changed-files half uses. Walking every
                // `.md` instead let the review-input packages into the `--all`
                // population, so the two modes disagreed about what an artifact
                // is and the published remainder was inflated by files the other
                // mode had just been taught to exclude.
                const rel = path.relative(repo, abs).replace(/\\/g, '/');
                if (isEvidenceArtifact(rel)) out.push(rel);
            }
        }
    };
    walk(path.resolve(repo, EVIDENCE_ROOT));
    return out.sort();
}

/** A value-taking flag given no value. Refuses rather than falling back. */
class ArgError extends Error {}

export interface Report {
    violations: Violation[];
    scanned: number;
    typed: number;
    /** Carries NO marker at all. */
    untyped: number;
    /** Carries a marker that does not parse — typed WRONGLY, not never typed. */
    malformed: number;
}

/**
 * `requireMarker` separates the two scopes: presence is demanded only of the
 * change set, agreement of everything that declares a type.
 */
export function checkFiles(repo: string, files: readonly string[], requireMarker: boolean): Report {
    const violations: Violation[] = [];
    let typed = 0;
    let untyped = 0;
    let malformed = 0;
    for (const rel of files) {
        const text = fs.readFileSync(path.resolve(repo, rel), 'utf-8');
        const scan = scanTypeMarker(text);
        for (const m of scan.malformed) {
            violations.push({ kind: 'malformed-marker', file: rel, detail: m });
        }
        for (const line of scan.duplicateLines) {
            violations.push({
                kind: 'duplicate-marker',
                file: rel,
                detail:
                    `line ${String(line)}: a second well-formed marker. §2 allows exactly one — a reader ` +
                    'has no rule for which wins, and neither does this gate.',
            });
        }
        if (scan.marker === null) {
            // A file carrying a marker that does not PARSE was typed wrongly, not
            // never typed. Folding it into `untyped` made the published remainder
            // conflate the two, so a corpus getting worse (markers appearing and
            // failing) and one getting better (markers landing) moved the same
            // number in the same direction.
            if (scan.malformed.length > 0) malformed += 1;
            else untyped += 1;
            if (requireMarker && scan.malformed.length === 0) {
                violations.push({
                    kind: 'missing-marker',
                    file: rel,
                    detail:
                        'no `evidence-type:` marker. This artifact is added or modified by this change, so ' +
                        `it must declare what it is — see ${CONTRACT} §2. Set the type at creation; do not ` +
                        'leave it for a later reader to infer from the filename.',
                });
            }
            continue;
        }
        typed += 1;
        violations.push(...checkAgreement(rel, text, scan.marker));
    }
    return { violations, scanned: files.length, typed, untyped, malformed };
}

/**
 * `--self-test`: prove the CLI still discriminates, not just that the functions do.
 *
 * The fixtures are the three ambiguities the contract exists to remove — an
 * input that binds, a skip conflated with a null, and a re-bind whose move is
 * untraceable — plus a corpus that agrees with itself, so a suite that only ever
 * rejects would be visible as one that discriminates nothing.
 */
function selfTest(): number {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-type-selftest-'));
    const marker = (t: string): string => `<!-- evidence-type: v1 | type: ${t} | declared: 2026-08-17 -->`;
    const scope = 'a'.repeat(64);
    const binding =
        `<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: ${scope} | diff: abc1234 | reviewer: r2 -->`;

    const build = (name: string, artifact: string): string => {
        const dir = fs.mkdtempSync(path.join(root, 'corpus-'));
        const reports = path.join(dir, EVIDENCE_ROOT, 'reports');
        fs.mkdirSync(reports, { recursive: true });
        fs.writeFileSync(path.join(reports, `${name}.md`), artifact, 'utf-8');
        return dir;
    };
    const invoke = (corpus: string): number =>
        runGateCli(REPO_ROOT, 'src/scripts/lint_evidence_artifacts.ts', ['--repo', corpus, '--all', '--quiet'], corpus);

    const cases: SelfTestCase[] = [
        {
            name: 'an input that declares itself an input is accepted',
            expect: 'accept',
            run: () => invoke(build('ok', `# r\n${marker('original-review')}\n\nprose\n`)),
        },
        {
            name: 'an input that binds a scope is rejected — that IS the ambiguity',
            expect: 'reject',
            run: () => invoke(build('binds', `# r\n${binding}\n${marker('original-review')}\n\nprose\n`)),
        },
        {
            name: 'a null carrying a skip declaration is rejected — nobody-looked is not saw-nothing',
            expect: 'reject',
            run: () =>
                invoke(
                    build(
                        'conflated',
                        `# r\n${binding}\n${marker('honest-null')}\n\n` +
                            `**Honest-null:** 0 findings, scope ${scope}, reviewed 2026-08-17\n` +
                            '**Skipped:** no code surface for this completion — docs, scope none, declared 2026-08-17\n',
                    ),
                ),
        },
        {
            name: 'a re-bind whose move is untraceable is rejected',
            expect: 'reject',
            run: () =>
                invoke(
                    build(
                        'untraceable',
                        `# r\n${binding}\n${marker('rebind-event')}\n\n` +
                            '| # | Severity | File:Line | Finding | Status | Reason/Ref |\n' +
                            '|---|---|---|---|---|---|\n' +
                            '| 1 | low | src/x.ts:1 | nit | open |  |\n',
                    ),
                ),
        },
    ];

    try {
        return runSelfTest({ gate: 'lint_evidence_artifacts', cases, minCases: 4, minRejectCases: 3 });
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
}

function usage(): void {
    process.stdout.write(
        'usage: lint_evidence_artifacts [--repo PATH] [--all] [--since REF] [--quiet]\n' +
            '  default: changed-files scoped — every evidence artifact this change adds or\n' +
            '           modifies must declare its type.\n' +
            '  --all:   scan the whole evidence root; reports the untyped remainder and still\n' +
            '           fails a typed artifact that disagrees with its body.\n',
    );
}

export function main(argv?: readonly string[]): number {
    const args = argv ?? process.argv.slice(2);
    if (args.includes('--self-test')) {
        return selfTest();
    }
    let repo = process.cwd();
    let all = false;
    let quiet = false;
    let since: string | null = null;
    // A value-taking flag with no value must REFUSE, not fall back. `--since`
    // with a missing value silently reverted to the default scope — the exact
    // silent-wrong-scope failure the unknown-argument branch below exists to
    // prevent, reached through a different door.
    const value = (flag: string, i: number): string => {
        const v = args[i];
        if (v === undefined || v.startsWith('--')) {
            throw new ArgError(`${flag} requires a value`);
        }
        return v;
    };
    for (let i = 0; i < args.length; i++) {
        const a = args[i] as string;
        try {
            if (a === '--repo') repo = value(a, ++i);
            else if (a === '--since') since = value(a, ++i);
            else if (a === '--all') all = true;
            else if (a === '--quiet') quiet = true;
            else if (a === '-h' || a === '--help') {
                usage();
                process.stdout.write('scanned: 0\n');
                return 0;
            } else {
                throw new ArgError(`unknown argument \`${a}\``);
            }
            continue;
        } catch (exc) {
            if (!(exc instanceof ArgError)) throw exc;
            process.stderr.write(`❌  lint_evidence_artifacts: ${exc.message}\n`);
            usage();
            process.stdout.write('scanned: 0\n');
            return 1;
        }
    }
    const ledger = new GateLedger('lint_evidence_artifacts');
    let report: Report;
    let files: string[];
    let scopeLine: string;

    try {
        if (all) {
            files = gatherAllArtifacts(repo);
            try {
                assertScanned({
                    gate: 'lint_evidence_artifacts',
                    scanned: files.length,
                    units: 'evidence artifact(s)',
                    roots: [EVIDENCE_ROOT],
                });
            } catch (exc) {
                // A dead scan scope is a POLICY violation, never an internal
                // error: exit 2 is warn-and-allow at every call site, so a moved
                // evidence root would degrade this gate to advisory.
                process.stdout.write('scanned: 0\n');
                process.stderr.write(`❌  ${exc instanceof DeadScopeError ? exc.message : String(exc)}\n`);
                return 1;
            }
            scopeLine = `scope: whole evidence root (${EVIDENCE_ROOT})`;
        } else {
            const scope = gatherChangedArtifacts(repo, since);
            if (!scope.baseDiffOk) {
                // An unresolvable base is indistinguishable from "nothing
                // changed" once it degrades to zero, and this gate's normal pass
                // IS zero — so it must refuse instead of reporting green.
                process.stdout.write('scanned: 0\n');
                process.stderr.write(
                    '❌  lint_evidence_artifacts: the base-span diff did not run, so an empty change set ' +
                        'cannot be distinguished from an unresolvable one. ' +
                        `Resolved ${scope.reason}. Pin a base with --since <ref>.\n`,
                );
                return 1;
            }
            files = scope.files;
            scopeLine = `scope: changed files (${scope.reason})`;
        }
        ledger.plan(files);
        report = checkFiles(repo, files, !all);
        for (const rel of files) {
            const bad = report.violations.filter((v) => v.file === rel);
            if (bad.length > 0) ledger.fail(rel, `${String(bad.length)} type violation(s)`);
            else ledger.complete(rel);
        }
    } catch (exc) {
        process.stdout.write('scanned: 0\n');
        process.stderr.write(
            `❌  lint_evidence_artifacts: internal error: ${exc instanceof Error ? exc.message : String(exc)}\n`,
        );
        return 2;
    }

    if (report.violations.length > 0) {
        process.stdout.write(`❌  ${String(report.violations.length)} evidence-type violation(s):\n\n`);
        for (const v of report.violations) {
            process.stdout.write(`  ${v.kind} — ${v.file}\n    │ ${v.detail}\n`);
        }
        process.stdout.write(`\n  contract: ${CONTRACT}\n`);
    } else if (!quiet) {
        if (report.scanned === 0) {
            process.stdout.write('✅  No evidence artifact added or modified by this change (verified empty).\n');
        } else {
            process.stdout.write(
                `✅  ${String(report.typed)} typed evidence artifact(s) agree with their bodies ` +
                    `(${String(report.scanned)} scanned).\n`,
            );
        }
    }
    if (all) {
        // Published on every --all run so the untyped remainder shrinks
        // observably instead of being assumed to.
        process.stdout.write(
            `  untyped remainder: ${String(report.untyped)} of ${String(report.scanned)} ` +
                'pre-existing artifact(s) carry no type marker (not required; see §6); ' +
                `${String(report.malformed)} carry one that does not parse.\n`,
        );
    }
    process.stdout.write(`${scopeLine}\n`);
    ledger.report();
    process.stdout.write(`scanned: ${String(report.scanned)}\n`);
    return report.violations.length > 0 ? 1 : 0;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href || process.argv[1] === _HERE;
}
if (_isCliEntry()) {
    process.exit(main());
}
