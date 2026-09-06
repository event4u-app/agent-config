/**
 * Evidence artifacts declare what kind of evidence they are
 * (road-to-release-review-p0 Phase 2).
 *
 * The contract is `docs/contracts/evidence-artifact-types.md`; this is its
 * check. Read that document first — in particular its scope section, because
 * the single most important property of this linter is what it deliberately
 * does NOT do.
 *
 * **It is forward-looking, and there is no baseline file.** Measured by
 * `--all` at the time of writing: 332 tracked markdown artifacts under
 * `agents/evidence/`, 188 already resolving a type and 144 not.
 * `check_completion_review` already refused to make one marker field required
 * on the stated ground that it "would have been a migration event for the
 * whole evidence corpus", and that reasoning is adopted rather than
 * overturned. So the gate fires only on files ADDED relative to a base ref. A
 * ratchet baseline was the obvious alternative and was rejected: it would mean
 * committing a 144-entry suppression list, and a new baseline file in this
 * repo trips two suppression gates of its own — paying a governance cost to
 * enforce a rule the scope decision says should not be enforced retroactively.
 *
 * **Not registered in `gate-coverage.yml`, and the reason is the manifest's
 * own.** A diff-scoped gate legitimately scans 0 on most runs, so it can carry
 * no honest `min_scanned` floor, and `min_scanned: 0` is precisely the
 * false-count shape that file rejects. `check_rule_projection_integrity` is
 * the worked precedent: NOT registered, with the reason, ledger half
 * discharged. This gate follows it — it adopts `_lib/gate_ledger.ts` below, so
 * `check_gate_completeness` counts it as an adopter rather than a gap.
 *
 * **A declaration is read wherever the author already wrote one.** Three of
 * the five types are pre-existing line grammars owned by
 * `check_completion_review.ts`, and this linter imports those parsers rather
 * than re-implementing them. Re-declaring an artifact that already carries
 * `<!-- completion-review: v1 … -->` under a second `evidence-type:` marker
 * would be the ambiguity the contract exists to remove.
 *
 * Modes:
 *   --new-only <base-ref>   gate: fail on an ADDED artifact with no type
 *   --all                   report: corpus census, always exit 0
 *   --quiet                 verdict line only
 *
 * Exit 0 = clean (or report mode). Exit 1 = an added artifact carries no
 * resolvable type. Exit 2 = the linter could not run (bad ref, no git).
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger } from './_lib/gate_ledger.js';
import { resolveBaseRef } from './_lib/ratchet_base_ref.js';
import { reportScanned } from './_lib/scan_scope.js';
import { parseHonestNull, parseMarkerLine, parseSkipDeclaration } from './check_completion_review.js';

export const EVIDENCE_ROOT = path.join('agents', 'evidence');

/** The types the contract defines. Anything else is an error, not a warning. */
export const EVIDENCE_TYPES = [
    'original-review',
    'current-binding',
    'declared-skip',
    'honest-null',
    'analysis',
    'feel',
] as const;

/**
 * The closed method vocabulary a `feel` artifact must name.
 *
 * Closed on purpose. An evidence class nothing can emit is a vocabulary entry,
 * not a control, and the cheapest way to satisfy a perceptual floor is to write
 * the word "feel" and move on. Requiring one of four named methods makes the
 * claim falsifiable: each says how the motion was actually looked at.
 */
export const FEEL_METHODS = ['slow-motion', 'frame-step', 'device', 'next-day'] as const;
export type FeelMethod = (typeof FEEL_METHODS)[number];

const FEEL_LINE_RE = new RegExp(
    String.raw`^\*\*Feel:\*\*\s+(${FEEL_METHODS.join('|')})\s+[\u2014-]\s+(\S.*)$`,
);

/** The method and outcome a `feel` line declares, or `null` when it declares neither. */
export function parseFeelLine(line: string): { method: FeelMethod; outcome: string } | null {
    const m = FEEL_LINE_RE.exec(line.trim());
    if (m === null) return null;
    return { method: m[1] as FeelMethod, outcome: (m[2] ?? '').trim() };
}

export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

/** The explicit marker, for the two types with no pre-existing grammar. */
const TYPE_MARKER_RE = /^<!--\s*evidence-type:\s*([a-z-]+)\s*-->$/;

/** How many leading lines are scanned for the marker. A type belongs at the top. */
const MARKER_SCAN_LINES = 40;

export interface TypeResolution {
    readonly type: EvidenceType | null;
    /** Which declaration produced it — named so a reader can check the claim. */
    readonly via: 'marker' | 'completion-review' | 'honest-null' | 'skip' | 'review-input-path' | null;
    /** Set when a marker was present but named something outside the set. */
    readonly invalidMarker: string | null;
}

/**
 * Resolve one artifact's declared type.
 *
 * Order matters and encodes the contract: the pre-existing grammars are
 * checked FIRST, so an artifact that already declares itself through
 * `check_completion_review`'s vocabulary is never asked for a second marker.
 * The path rule is last and is the contract's one acknowledged exception.
 */
export function resolveEvidenceType(relPath: string, contents: string): TypeResolution {
    // BOTH scans share one window. They did not: the grammar scan walked the
    // whole file while the marker scan stopped at 40 lines, so a quoted
    // `completion-review` line deep in a prose artifact silently overrode an
    // explicit `evidence-type:` marker its author had written at the top
    // (R2 finding 8). A declaration belongs near the top of the file either
    // way, and one window makes the precedence readable instead of positional.
    const lines = contents.split('\n').slice(0, MARKER_SCAN_LINES);

    for (const raw of lines) {
        const line = raw.trim();
        if (line === '') {
            continue;
        }
        if (parseMarkerLine(line) !== null) {
            return { type: 'current-binding', via: 'completion-review', invalidMarker: null };
        }
        if (parseHonestNull(line) !== null) {
            return { type: 'honest-null', via: 'honest-null', invalidMarker: null };
        }
        if (parseSkipDeclaration(line) !== null) {
            return { type: 'declared-skip', via: 'skip', invalidMarker: null };
        }
    }

    for (const raw of lines) {
        const m = TYPE_MARKER_RE.exec(raw.trim());
        if (m === null) {
            continue;
        }
        const value = m[1] as string;
        if ((EVIDENCE_TYPES as readonly string[]).includes(value)) {
            return { type: value as EvidenceType, via: 'marker', invalidMarker: null };
        }
        // A misspelled type reads as untyped to every consumer, which is the
        // state the contract exists to end — so it is louder than absence,
        // not quieter.
        return { type: null, via: null, invalidMarker: value };
    }

    // The contract's single filename-derived case. Safe because the directory
    // is written by `dispatch_r2_reviewer.ts` and by nothing else, so the path
    // IS the declaration rather than a heuristic about one.
    // Split on `/`, never `path.sep`. Every caller feeds paths from
    // `git diff --name-only` / `git ls-files`, and git emits `/`-separated
    // paths on every platform — so on Windows `path.sep` (`\`) made the whole
    // path one segment and this branch could never match (R2 finding 10).
    // `\` is accepted too so a hand-built Windows path still resolves.
    if (relPath.split(/[/\\]/).some((seg) => seg.endsWith('.review-input'))) {
        return { type: 'original-review', via: 'review-input-path', invalidMarker: null };
    }

    return { type: null, via: null, invalidMarker: null };
}

function _git(root: string, args: readonly string[]): string {
    return execFileSync('git', [...args], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Markdown files ADDED under `agents/evidence/` relative to `baseRef`. */
export function addedEvidenceFiles(root: string, baseRef: string): string[] {
    const out = _git(root, [
        'diff',
        '--name-only',
        '--diff-filter=A',
        `${baseRef}...HEAD`,
        '--',
        `${EVIDENCE_ROOT}/`,
    ]);
    return out
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s !== '' && s.endsWith('.md'));
}

/** Every markdown artifact in the corpus, for the census mode. */
export function allEvidenceFiles(root: string): string[] {
    const out = _git(root, ['ls-files', '--', `${EVIDENCE_ROOT}/`]);
    return out
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s !== '' && s.endsWith('.md'));
}

export interface Finding {
    readonly file: string;
    readonly reason: string;
}

export function checkFiles(root: string, files: readonly string[], ledger?: GateLedger): Finding[] {
    const findings: Finding[] = [];
    ledger?.plan([...files]);
    for (const rel of files) {
        let contents: string;
        try {
            contents = fs.readFileSync(path.join(root, rel), 'utf8');
        } catch {
            // A file listed by git but unreadable on disk is not this
            // linter's finding to report — a deleted-then-re-added path in a
            // dirty tree hits this and is somebody else's gate.
            ledger?.outOfScope(rel, 'no_applicable_files');
            continue;
        }
        const res = resolveEvidenceType(rel, contents);
        if (res.invalidMarker !== null) {
            ledger?.fail(rel, `invalid evidence-type: ${res.invalidMarker}`);
            findings.push({
                file: rel,
                reason:
                    `evidence-type: ${res.invalidMarker} is not one of ` +
                    `${EVIDENCE_TYPES.join(' | ')}`,
            });
            continue;
        }
        // Risk 5 of road-to-one-motion-authority: the floor is the METHOD
        // token, not the word. An outcome of `unbacked` is legal — a
        // perceptual check that found nothing is still a check that ran — but
        // an absent line is not, and neither is a method outside the four.
        if (res.type === 'feel') {
            const declared = contents
                .split('\n')
                .slice(0, MARKER_SCAN_LINES)
                .some((l) => parseFeelLine(l) !== null);
            if (!declared) {
                ledger?.fail(rel, 'feel artifact with no method line');
                findings.push({
                    file: rel,
                    reason:
                        'declares `evidence-type: feel` but carries no `**Feel:** <method> — <outcome>` '
                        + `line naming one of ${FEEL_METHODS.join(' | ')}. An outcome of \`unbacked\` is legal; `
                        + 'an absent method is not',
                });
                continue;
            }
        }
        if (res.type === null) {
            ledger?.fail(rel, 'no evidence type declared');
            findings.push({
                file: rel,
                reason:
                    'no evidence type declared — add `<!-- evidence-type: analysis -->` ' +
                    '(or the type that fits) per docs/contracts/evidence-artifact-types.md',
            });
            continue;
        }
        ledger?.complete(rel);
    }
    return findings;
}

function _argValue(flag: string): string | null {
    const i = process.argv.indexOf(flag);
    if (i === -1) {
        return null;
    }
    const v = process.argv[i + 1];
    return v === undefined || v.startsWith('--') ? null : v;
}

export function main(): number {
    const quiet = process.argv.includes('--quiet');
    const root = process.cwd();
    const out = (s: string): void => {
        if (!quiet) {
            process.stdout.write(`${s}\n`);
        }
    };

    if (process.argv.includes('--all')) {
        let files: string[];
        try {
            files = allEvidenceFiles(root);
        } catch (exc) {
            process.stdout.write(`lint_evidence_artifacts: cannot list ${EVIDENCE_ROOT} — ${String(exc)}\n`);
            return 2;
        }
        const ledger = new GateLedger('lint_evidence_artifacts');
        const findings = checkFiles(root, files, ledger);
        ledger.report();
        // Census mode reads the whole corpus, so a zero here IS blindness —
        // no `allowEmpty`, deliberately. The gate mode below is the opposite
        // case and says so on its own line.
        reportScanned({
            gate: 'lint_evidence_artifacts --all',
            scanned: files.length,
            units: 'evidence artifacts',
            roots: [EVIDENCE_ROOT],
        });
        const typed = files.length - findings.length;
        out(`lint_evidence_artifacts — census over ${String(files.length)} artifact(s)`);
        out(`  typed    ${String(typed)}`);
        out(`  untyped  ${String(findings.length)}`);
        // Report mode, never a gate: the pre-existing untyped corpus is a
        // deliberate scope exclusion, so publishing the number is the point
        // and failing on it would contradict the contract.
        process.stdout.write(
            `lint_evidence_artifacts: census — ${String(typed)} typed, ${String(findings.length)} untyped (report only)\n`,
        );
        return 0;
    }

    // A bare invocation IS the gate, resolving its own base. Requiring an
    // explicit ref would have made the roadmap's own `verify:` annotation exit
    // 2 on a usage error, and a check whose default invocation is a usage
    // error is a check nobody runs. `--new-only <ref>` stays as the override.
    //
    // `resolveBaseRef` rather than a hardcoded `origin/main`: `actions/checkout`
    // performs a shallow PR-merge fetch, so a PR build frequently has no
    // `origin/main` remote-tracking ref at all. That ladder already handles it
    // and is the repo's one answer to this question.
    const baseRef = _argValue('--new-only') ?? resolveBaseRef(root);
    if (baseRef === null) {
        // Fail rather than compare against an assumed-empty base — the same
        // default `resolveBaseRef`'s own docstring names. An unresolvable base
        // would otherwise make every artifact look un-added and the gate would
        // pass by scanning nothing.
        process.stdout.write(
            'lint_evidence_artifacts: no base ref resolved — pass --new-only <ref>, ' +
                'set RATCHET_BASE_REF, or run --all for the census\n',
        );
        return 2;
    }

    let files: string[];
    try {
        files = addedEvidenceFiles(root, baseRef);
    } catch (exc) {
        process.stdout.write(`lint_evidence_artifacts: cannot diff against ${baseRef} — ${String(exc)}\n`);
        return 2;
    }

    const ledger = new GateLedger('lint_evidence_artifacts');
    const findings = checkFiles(root, files, ledger);
    ledger.report();
    // A run that scans nothing exits green, and SAYS SO — silent green over an
    // empty set is how a gate stops measuring anything without anyone
    // noticing. The `allowEmpty` reason is `EMPTY_VALID` rather than
    // `OPTIONAL_INPUT`: this gate measures a DIFF, not a corpus, so "no
    // evidence artifact was added on this branch" genuinely is the success
    // state and stays true even if `agents/evidence/` were deleted entirely.
    reportScanned({
        gate: 'lint_evidence_artifacts',
        scanned: files.length,
        units: 'added evidence artifacts',
        roots: [EVIDENCE_ROOT],
        allowEmpty:
            'EMPTY_VALID: the scope is the set of artifacts ADDED since the base ref; ' +
            'a branch that adds none has nothing to type, and zero is the pass.',
    });
    if (files.length === 0) {
        process.stdout.write(
            `lint_evidence_artifacts: ✅ no evidence artifact added since ${baseRef} — nothing to check\n`,
        );
        return 0;
    }
    out(`lint_evidence_artifacts — ${String(files.length)} added artifact(s) since ${baseRef}`);
    if (findings.length === 0) {
        process.stdout.write(
            `lint_evidence_artifacts: ✅ all ${String(files.length)} added artifact(s) declare a type\n`,
        );
        return 0;
    }
    process.stdout.write(`lint_evidence_artifacts: ❌ ${String(findings.length)} untyped artifact(s)\n`);
    for (const f of findings) {
        process.stdout.write(`  ${f.file}\n    ${f.reason}\n`);
    }
    return 1;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}
