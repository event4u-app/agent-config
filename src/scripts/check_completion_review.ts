#!/usr/bin/env tsx
/**
 * Gate R2 — completion-review validator (deterministic).
 *
 * Implements exactly the findings-artifact grammar in
 * `docs/contracts/plan-review-gates.md` §2 (header marker, findings table,
 * honest-null grammar, skip-declaration grammar, findings-before-fixes
 * ancestry) and the exit-code contract in §6. A divergence from that file is
 * a validator bug, never a contract reinterpretation.
 *
 * What it checks, given the current branch state (`--repo`, `--base`):
 *   - a completion-review artifact (`*.findings.md` under `--artifact-dir`)
 *     exists for the current HEAD sha, OR a valid skip declaration covers it;
 *   - every finding row is terminal (`fixed` / `accepted-risk` / `deferred`)
 *     with the required Reason/Ref content;
 *   - severity rows are sorted descending (critical > high > medium > low);
 *   - findings-before-fixes ancestry: the commit that FIRST added the
 *     artifact is an ancestor of every referenced fix commit (§2.5 — the
 *     first-add commit is what counts, so backdating is detected too).
 *
 * The §5 context-manifest HTML comment is TOLERATED in the header but not
 * validated here — hash re-derivation is a separate CI step.
 *
 * Exit codes (contract §6): 0 = pass, 1 = policy violation,
 * 2 = internal error (missing base ref, git failure — the CALLER applies
 * degraded advisory mode). With `--advisory` (Stage-A window, §2) violations
 * are reported as warnings and the exit is ALWAYS 0.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned } from './_lib/scan_scope.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Violation {
    kind: string;
    file: string | null;
    detail: string;
}

export interface Marker {
    reviewed: string;
    diffSha: string;
    reviewer: string;
}

export interface HonestNull {
    sha: string;
    reviewed: string;
}

export interface SkipDeclaration {
    reason: string;
    sha: string; // full/abbreviated sha or the literal 'none'
    declared: string;
}

export interface FindingRow {
    index: string;
    severity: string;
    fileLine: string;
    finding: string;
    status: string;
    reasonRef: string;
    line: number;
}

export interface ParsedArtifact {
    marker: Marker | null;
    /** A `completion-review:` comment exists but does not match the §2.1 grammar. */
    markerMalformed: boolean;
    honestNull: HonestNull | null;
    skip: SkipDeclaration | null;
    rows: FindingRow[];
    /** Lines that start like honest-null / skip but miss the exact grammar. */
    malformedLines: string[];
}

// ---------------------------------------------------------------------------
// Pure grammar functions (exported for unit tests)
// ---------------------------------------------------------------------------

const CODE_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'mjs', 'cjs', 'py', 'php', 'go', 'rs', 'sh']);

export const SEVERITY_RANK: Readonly<Record<string, number>> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
};

const VALID_STATUSES = new Set(['open', 'fixed', 'accepted-risk', 'deferred']);

/**
 * Contract §2.4 code-path classification. `agents/**` never counts as code
 * (the artifact itself lives there); `src/scripts/**` always does; everything
 * else is decided by extension.
 */
export function isCodePath(p: string): boolean {
    const norm = p.replace(/\\/g, '/').replace(/^\.\//, '');
    if (norm === 'agents' || norm.startsWith('agents/')) {
        return false;
    }
    if (norm.startsWith('src/scripts/')) {
        return true;
    }
    const base = norm.slice(norm.lastIndexOf('/') + 1);
    const dot = base.lastIndexOf('.');
    if (dot <= 0) {
        return false;
    }
    return CODE_EXTENSIONS.has(base.slice(dot + 1).toLowerCase());
}

const MARKER_RE =
    /^<!--\s*completion-review:\s*v1\s*\|\s*reviewed:\s*(\d{4}-\d{2}-\d{2})\s*\|\s*diff:\s*([0-9a-fA-F]{7,40})\s*\|\s*reviewer:\s*(\S(?:[^|>]*[^|>\s])?)\s*-->$/;

export function parseMarkerLine(line: string): Marker | null {
    const m = MARKER_RE.exec(line.trim());
    if (!m) {
        return null;
    }
    return {
        reviewed: m[1] as string,
        diffSha: (m[2] as string).toLowerCase(),
        reviewer: (m[3] as string).trim(),
    };
}

const HONEST_NULL_RE = /^\*\*Honest-null:\*\* 0 findings, diff ([0-9a-fA-F]{7,40}), reviewed (\d{4}-\d{2}-\d{2})$/;

export function parseHonestNull(line: string): HonestNull | null {
    const m = HONEST_NULL_RE.exec(line.trim());
    if (!m) {
        return null;
    }
    return { sha: (m[1] as string).toLowerCase(), reviewed: m[2] as string };
}

const SKIP_RE =
    /^\*\*Skipped:\*\* no code surface for this completion — (.+), diff ([0-9a-fA-F]{7,40}|none), declared (\d{4}-\d{2}-\d{2})$/;

export function parseSkipDeclaration(line: string): SkipDeclaration | null {
    const m = SKIP_RE.exec(line.trim());
    if (!m) {
        return null;
    }
    const reason = (m[1] as string).trim();
    if (reason === '') {
        return null;
    }
    return { reason, sha: (m[2] as string).toLowerCase(), declared: m[3] as string };
}

/** First 7-40 char hex token in a Reason/Ref cell — the commit-ish, if any. */
export function extractFixRef(reasonRef: string): string | null {
    const m = /\b[0-9a-f]{7,40}\b/i.exec(reasonRef);
    return m ? (m[0] as string).toLowerCase() : null;
}

/** Full-or-abbreviated sha match against the current HEAD sha. */
export function shaMatches(token: string, headSha: string): boolean {
    const t = token.toLowerCase();
    const h = headSha.toLowerCase();
    return t === h || (t.length >= 7 && h.startsWith(t));
}

function splitTableRow(line: string): string[] {
    let inner = line.trim();
    inner = inner.slice(1); // leading |
    if (inner.endsWith('|')) {
        inner = inner.slice(0, -1);
    }
    return inner.split('|').map((c) => c.trim());
}

const FENCE_RE = /^\s*```/;

export function parseArtifact(text: string): ParsedArtifact {
    const out: ParsedArtifact = {
        marker: null,
        markerMalformed: false,
        honestNull: null,
        skip: null,
        rows: [],
        malformedLines: [],
    };
    const lines = text.split(/\r?\n/);
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i] as string;
        const lineno = i + 1;
        if (FENCE_RE.test(raw)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) {
            continue;
        }
        const trimmed = raw.trim();
        if (out.marker === null && trimmed.includes('completion-review:')) {
            const marker = parseMarkerLine(trimmed);
            if (marker) {
                out.marker = marker;
            } else {
                out.markerMalformed = true;
            }
            continue;
        }
        if (trimmed.startsWith('**Honest-null:**')) {
            const hn = parseHonestNull(trimmed);
            if (hn) {
                out.honestNull ??= hn;
            } else {
                out.malformedLines.push(`line ${lineno}: honest-null line does not match the exact §2.3 grammar`);
            }
            continue;
        }
        if (trimmed.startsWith('**Skipped:**')) {
            const skip = parseSkipDeclaration(trimmed);
            if (skip) {
                out.skip ??= skip;
            } else {
                out.malformedLines.push(`line ${lineno}: skip declaration does not match the exact §2.4 grammar`);
            }
            continue;
        }
        if (trimmed.startsWith('|')) {
            const cells = splitTableRow(trimmed);
            if (cells.every((c) => /^[-: ]*$/.test(c))) {
                continue; // separator row
            }
            const first = (cells[0] ?? '').toLowerCase();
            const second = (cells[1] ?? '').toLowerCase();
            if (first === '#' || second === 'severity') {
                continue; // header row
            }
            if (cells.length >= 6) {
                out.rows.push({
                    index: cells[0] ?? '',
                    severity: (cells[1] ?? '').toLowerCase(),
                    fileLine: cells[2] ?? '',
                    finding: cells[3] ?? '',
                    status: (cells[4] ?? '').toLowerCase(),
                    reasonRef: cells[5] ?? '',
                    line: lineno,
                });
            }
        }
    }
    return out;
}

/** Row-level checks: bad-value, severity-order, open/deferred/accepted-risk gates. */
export function validateFindingRows(rows: readonly FindingRow[]): Array<{ kind: string; detail: string }> {
    const out: Array<{ kind: string; detail: string }> = [];
    let prevRank: number | null = null;
    let orderReported = false;
    for (const row of rows) {
        const rank = SEVERITY_RANK[row.severity];
        if (rank === undefined) {
            out.push({
                kind: 'bad-value',
                detail: `row ${row.index} (line ${row.line}): unknown severity '${row.severity}' — expected critical|high|medium|low`,
            });
        }
        if (!VALID_STATUSES.has(row.status)) {
            out.push({
                kind: 'bad-value',
                detail: `row ${row.index} (line ${row.line}): unknown status '${row.status}' — expected open|fixed|accepted-risk|deferred`,
            });
        }
        if (rank !== undefined) {
            if (prevRank !== null && rank > prevRank && !orderReported) {
                out.push({
                    kind: 'severity-order',
                    detail:
                        `row ${row.index} (line ${row.line}): severity '${row.severity}' outranks an earlier row — ` +
                        'rows must be sorted descending (critical > high > medium > low)',
                });
                orderReported = true;
            }
            prevRank = rank;
        }
        if (row.status === 'open') {
            out.push({
                kind: 'open-finding',
                detail: `row ${row.index} (line ${row.line}): finding is still 'open' — every finding must reach a terminal status`,
            });
        } else if (row.status === 'deferred' && row.reasonRef.trim() === '') {
            out.push({
                kind: 'deferred-without-ref',
                detail: `row ${row.index} (line ${row.line}): 'deferred' without a ticket/issue/roadmap ref in Reason/Ref`,
            });
        } else if (row.status === 'accepted-risk' && row.reasonRef.trim() === '') {
            out.push({
                kind: 'accepted-risk-without-reason',
                detail: `row ${row.index} (line ${row.line}): 'accepted-risk' without a reason in Reason/Ref`,
            });
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Git plumbing
// ---------------------------------------------------------------------------

class InternalError extends Error {}

interface GitResult {
    ok: boolean;
    stdout: string;
    status: number;
}

function gitTry(repo: string, args: readonly string[]): GitResult {
    try {
        const stdout = execFileSync('git', args as string[], {
            cwd: repo,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        return { ok: true, stdout, status: 0 };
    } catch (exc) {
        const status = (exc as { status?: unknown }).status;
        return { ok: false, stdout: '', status: typeof status === 'number' ? status : -1 };
    }
}

function gitOut(repo: string, args: readonly string[]): string {
    const r = gitTry(repo, args);
    if (!r.ok) {
        throw new InternalError(`git ${args.join(' ')} failed (exit ${r.status}) in ${repo}`);
    }
    return r.stdout;
}

// ---------------------------------------------------------------------------
// Gate evaluation
// ---------------------------------------------------------------------------

interface ArtifactFile {
    file: string; // absolute path
    art: ParsedArtifact;
}

interface EvalInput {
    repo: string;
    head: string;
    changed: readonly string[];
    artifacts: readonly ArtifactFile[];
    artifactDirLabel: string;
}

function evaluate(input: EvalInput): Violation[] {
    const { repo, head, changed, artifacts } = input;
    const violations: Violation[] = [];
    const codePaths = changed.filter(isCodePath);

    for (const { file, art } of artifacts) {
        if (art.markerMalformed) {
            violations.push({
                kind: 'bad-marker',
                file,
                detail:
                    'completion-review header marker malformed — expected ' +
                    '`<!-- completion-review: v1 | reviewed: YYYY-MM-DD | diff: <sha> | reviewer: <id> -->`',
            });
        }
        for (const detail of art.malformedLines) {
            violations.push({ kind: 'bad-value', file, detail });
        }
    }

    const relevantSkips = artifacts.filter(
        ({ art }) => art.skip !== null && (art.skip.sha === 'none' || shaMatches(art.skip.sha, head)),
    );
    const relevantFindings = artifacts.filter(
        ({ art }) => art.skip === null && art.marker !== null && shaMatches(art.marker.diffSha, head),
    );

    for (const { file } of relevantSkips) {
        if (codePaths.length > 0) {
            violations.push({
                kind: 'skip-on-code-diff',
                file,
                detail:
                    `skip declaration present but the diff touches ${codePaths.length} code path(s) ` +
                    `(e.g. ${codePaths.slice(0, 3).join(', ')}) — a code diff requires a findings artifact`,
            });
        }
    }

    for (const { file, art } of relevantFindings) {
        if (art.honestNull !== null) {
            if (!shaMatches(art.honestNull.sha, head)) {
                violations.push({
                    kind: 'stale-review',
                    file,
                    detail: `honest-null declares diff ${art.honestNull.sha} but current HEAD is ${head}`,
                });
            }
            continue;
        }
        if (art.rows.length === 0) {
            violations.push({
                kind: 'bad-value',
                file,
                detail: 'artifact has neither a findings table nor an honest-null / skip declaration line',
            });
            continue;
        }
        for (const v of validateFindingRows(art.rows)) {
            violations.push({ ...v, file });
        }
        violations.push(...checkFindingsBeforeFixes(repo, file, art.rows));
    }

    if (relevantSkips.length === 0 && relevantFindings.length === 0) {
        const parseable = artifacts.filter(
            ({ art }) => art.marker !== null || art.honestNull !== null || art.skip !== null,
        );
        const anyBadMarker = artifacts.some(({ art }) => art.markerMalformed);
        if (parseable.length > 0) {
            const shas = parseable.map(
                ({ art }) => art.marker?.diffSha ?? art.skip?.sha ?? art.honestNull?.sha ?? '?',
            );
            violations.push({
                kind: 'stale-review',
                file: (parseable[0] as ArtifactFile).file,
                detail:
                    `no artifact matches current HEAD ${head} — found artifact(s) for diff sha(s): ` +
                    `${shas.join(', ')}. A push after review forces re-review (contract §2.1).`,
            });
        } else if (!anyBadMarker) {
            violations.push({
                kind: 'missing-artifact',
                file: null,
                detail:
                    `no completion-review artifact for HEAD ${head} under ${input.artifactDirLabel} ` +
                    `and no valid skip declaration (diff has ${codePaths.length} code path(s) of ` +
                    `${changed.length} changed file(s))`,
            });
        }
    }

    return violations;
}

/** Contract §2.5 — the artifact's FIRST-add commit must precede every fix commit. */
function checkFindingsBeforeFixes(repo: string, artifactAbs: string, rows: readonly FindingRow[]): Violation[] {
    const violations: Violation[] = [];
    const fixedRows = rows.filter((r) => r.status === 'fixed');
    if (fixedRows.length === 0) {
        return violations;
    }

    const rel = path.relative(repo, artifactAbs);
    // Earliest add commit: `git log --diff-filter=A` lists newest-first, so the
    // LAST line is the first commit that ever added the file (backdating via a
    // later amend does not move it).
    const logRes = gitTry(repo, ['log', '--diff-filter=A', '--format=%H', '--', rel]);
    const addLines = logRes.stdout
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    const addSha = addLines.length > 0 ? (addLines[addLines.length - 1] as string) : null;

    let notCommittedReported = false;
    for (const row of fixedRows) {
        const token = extractFixRef(row.reasonRef);
        if (token === null) {
            violations.push({
                kind: 'unresolvable-fix-ref',
                file: artifactAbs,
                detail: `row ${row.index} (line ${row.line}): 'fixed' without a commit ref in Reason/Ref`,
            });
            continue;
        }
        const resolved = gitTry(repo, ['rev-parse', '--verify', '--quiet', `${token}^{commit}`]);
        if (!resolved.ok) {
            violations.push({
                kind: 'unresolvable-fix-ref',
                file: artifactAbs,
                detail: `row ${row.index} (line ${row.line}): fix ref '${token}' does not resolve to a commit`,
            });
            continue;
        }
        const fixSha = resolved.stdout.trim();
        if (addSha === null) {
            if (!notCommittedReported) {
                violations.push({
                    kind: 'artifact-not-committed',
                    file: artifactAbs,
                    detail:
                        'artifact is untracked/uncommitted but marks findings fixed with commit refs — ' +
                        'commit the findings artifact BEFORE the fix commits (contract §2.5)',
                });
                notCommittedReported = true;
            }
            continue;
        }
        const ancestry = gitTry(repo, ['merge-base', '--is-ancestor', addSha, fixSha]);
        if (ancestry.ok) {
            continue;
        }
        if (ancestry.status === 1) {
            violations.push({
                kind: 'fix-before-artifact',
                file: artifactAbs,
                detail:
                    `row ${row.index} (line ${row.line}): fix commit ${fixSha.slice(0, 12)} predates the ` +
                    `artifact's first-add commit ${addSha.slice(0, 12)} — findings must be committed before fixes ` +
                    '(contract §2.5; the first-add commit is what counts, so backdating is detected)',
            });
        } else {
            throw new InternalError(
                `git merge-base --is-ancestor ${addSha} ${fixSha} failed (exit ${ancestry.status})`,
            );
        }
    }
    return violations;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface Args {
    base: string;
    advisory: boolean;
    format: 'text' | 'json';
    quiet: boolean;
    artifactDir: string;
    repo: string;
}

const USAGE =
    'usage: check_completion_review [-h] [--base REF] [--advisory] [--format {text,json}] ' +
    '[--quiet] [--artifact-dir DIR] [--repo DIR]\n';

function parseArgs(argv: readonly string[]): Args {
    const args: Args = {
        base: 'origin/main',
        advisory: false,
        format: 'text',
        quiet: false,
        artifactDir: 'agents/evidence/reviews',
        repo: '.',
    };
    const takeValue = (argvArr: readonly string[], i: number, name: string): string => {
        const v = argvArr[i];
        if (v === undefined) {
            process.stderr.write(`check_completion_review: error: argument ${name}: expected one value\n`);
            process.exit(2);
        }
        return v;
    };
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] as string;
        if (arg === '--base') {
            args.base = takeValue(argv, ++i, '--base');
        } else if (arg.startsWith('--base=')) {
            args.base = arg.slice('--base='.length);
        } else if (arg === '--advisory') {
            args.advisory = true;
        } else if (arg === '--quiet') {
            args.quiet = true;
        } else if (arg === '--artifact-dir') {
            args.artifactDir = takeValue(argv, ++i, '--artifact-dir');
        } else if (arg.startsWith('--artifact-dir=')) {
            args.artifactDir = arg.slice('--artifact-dir='.length);
        } else if (arg === '--repo') {
            args.repo = takeValue(argv, ++i, '--repo');
        } else if (arg.startsWith('--repo=')) {
            args.repo = arg.slice('--repo='.length);
        } else if (arg === '--format' || arg.startsWith('--format=')) {
            const v = arg === '--format' ? takeValue(argv, ++i, '--format') : arg.slice('--format='.length);
            if (v !== 'text' && v !== 'json') {
                process.stderr.write(
                    `check_completion_review: error: argument --format: invalid choice: '${v}' (choose from 'text', 'json')\n`,
                );
                process.exit(2);
            }
            args.format = v;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(USAGE);
            process.exit(0);
        } else {
            process.stderr.write(`check_completion_review: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        }
        i++;
    }
    return args;
}

function report(args: Args, violations: readonly Violation[], passNote: string | null): number {
    if (args.format === 'json') {
        process.stdout.write(JSON.stringify(violations, null, 2) + '\n');
    } else if (violations.length === 0) {
        if (!args.quiet) {
            process.stdout.write(passNote ?? '✅  Completion review clean.\n');
        }
    } else {
        const head = args.advisory
            ? `⚠️  ${violations.length} completion-review violation(s) (advisory — not blocking):\n\n`
            : `❌  ${violations.length} completion-review violation(s):\n\n`;
        process.stdout.write(head);
        const prefix = args.advisory ? '⚠️ (advisory) ' : '';
        for (const v of violations) {
            process.stdout.write(`  ${prefix}${v.kind}${v.file !== null ? ` — ${v.file}` : ''}\n`);
            process.stdout.write(`    │ ${v.detail}\n`);
        }
    }
    if (violations.length === 0) {
        return 0;
    }
    return args.advisory ? 0 : 1;
}

function run(args: Args): number {
    const repo = path.resolve(args.repo);

    const baseCheck = gitTry(repo, ['rev-parse', '--verify', '--quiet', `${args.base}^{commit}`]);
    if (!baseCheck.ok) {
        throw new InternalError(`base ref '${args.base}' not found in ${repo}`);
    }
    const head = gitOut(repo, ['rev-parse', 'HEAD']).trim().toLowerCase();
    const changed = gitOut(repo, ['diff', '--name-only', `${args.base}...HEAD`])
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

    const artifactDirAbs = path.isAbsolute(args.artifactDir) ? args.artifactDir : path.join(repo, args.artifactDir);
    let artifactPaths: string[] = [];
    try {
        if (fs.statSync(artifactDirAbs).isDirectory()) {
            artifactPaths = fs
                .readdirSync(artifactDirAbs)
                .filter((n) => n.endsWith('.findings.md'))
                .sort()
                .map((n) => path.join(artifactDirAbs, n));
        }
    } catch {
        // Missing artifact dir = zero artifacts; the diff evaluation itself
        // still counts, so the gate never reports a dead scope silently.
    }

    // Gate-coverage contract: `scanned:` is emitted BEFORE the pass/fail
    // branch (coverage and verdict are different questions). N counts the
    // artifacts inspected + 1 for the current-diff evaluation, so N >= 1
    // whenever the gate evaluates at all.
    const scanned = artifactPaths.length + 1;
    process.stdout.write(`scanned: ${scanned}\n`);
    assertScanned({
        gate: 'check_completion_review',
        scanned,
        units: 'review artefact(s) + diff evaluation',
        roots: ['agents/evidence/reviews'],
    });

    if (changed.length === 0) {
        return report(args, [], `✅  No changes vs ${args.base} — nothing to review.\n`);
    }

    const artifacts: ArtifactFile[] = artifactPaths.map((file) => {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf-8');
        } catch (exc) {
            throw new InternalError(`unreadable artifact ${file}: ${exc instanceof Error ? exc.message : String(exc)}`);
        }
        return { file, art: parseArtifact(text) };
    });

    const violations = evaluate({
        repo,
        head,
        changed,
        artifacts,
        artifactDirLabel: args.artifactDir,
    });
    if (violations.length === 0) {
        return report(
            args,
            violations,
            `✅  Completion review clean (${artifactPaths.length} artefact(s), ${changed.length} changed file(s) vs ${args.base}).\n`,
        );
    }
    return report(args, violations, null);
}

export function main(argv?: readonly string[]): number {
    const args = parseArgs(argv ?? process.argv.slice(2));
    try {
        return run(args);
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  Internal error: ${msg}\n`);
        return 2;
    }
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
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // compare realpaths so the entry guard still fires.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv1;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`❌  Internal error: ${msg}\n`);
        process.exit(2);
    }
}
