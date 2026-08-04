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
 *     exists for the current REVIEW-SCOPE HASH, OR a valid skip declaration
 *     covers it;
 *   - the artifact carries a §5 context manifest (a relevant artifact without
 *     one is unverifiable → `missing-manifest`);
 *   - every finding row is terminal (`fixed` / `accepted-risk` / `deferred`)
 *     with the required Reason/Ref content;
 *   - every table-shaped row parses into the six §2.2 cells (`malformed-row`) —
 *     a short row is never silently dropped, or an `open` finding would pass;
 *   - severity rows are sorted descending (critical > high > medium > low);
 *   - findings-before-fixes ancestry: the commit that FIRST added the
 *     artifact is an ancestor of every referenced fix commit (§2.5 — the
 *     first-add commit is what counts, so backdating is detected too).
 *
 * The review binds to the review-SCOPE HASH, never to a commit sha. That
 * definition is owned by `dispatch_r2_reviewer.ts` and imported here so the
 * dispatcher and the validator can never diverge. Manifest hash
 * re-derivation stays a separate step (`dispatch_r2_reviewer --verify`).
 *
 * Settings escape hatch: `planning.completion_review: false` in the repo's
 * `.agent-settings.yml` skips the gate (note + `scanned: 0` + exit 0), exactly
 * as `planning.risk_review: false` skips Gate R1.
 *
 * Exit codes (contract §6): 0 = pass, 1 = policy violation (including a DEAD
 * SCAN SCOPE — a gate that read nothing has not passed), 2 = internal error
 * (missing base ref, git failure — the CALLER applies degraded advisory
 * mode). With `--advisory` (Stage-A window, §2) violations are reported as
 * warnings and the exit is ALWAYS 0.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { gitEnv } from './_lib/git_env.js';
import { splitMarkdownRow } from './_lib/md_table.js';
import { completionReviewDisabled } from './_lib/planning_settings.js';
import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';
import {
    computeReviewScope,
    deriveSlug,
    parseManifest,
    reviewScopeNameOnlyArgs,
    sanitizeSlug,
    type ParsedManifest,
} from './dispatch_r2_reviewer.js';

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
    /** The review-scope hash the review is bound to (§2.1) — 64 hex chars. */
    scope: string;
    /** Branch-head sha at review time. Provenance only, NEVER compared. */
    diffSha: string;
    reviewer: string;
}

export interface HonestNull {
    scope: string;
    reviewed: string;
}

export interface SkipDeclaration {
    reason: string;
    scope: string; // 64-hex scope hash or the literal 'none' (empty scope only)
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
    /**
     * Table-shaped lines that do not parse into the six §2.2 cells.
     *
     * Kept separate from {@link malformedLines} so the violation can be reported
     * as `malformed-row`, matching Gate R1's `malformed_row` naming for the same
     * defect class.
     */
    malformedRows: string[];
    /** The §5 context manifest, when present and parseable. */
    manifest: ParsedManifest | null;
}

// ---------------------------------------------------------------------------
// Pure grammar functions (exported for unit tests)
// ---------------------------------------------------------------------------

// Contract §2.4. Deliberately broad: the suite installs into consumer repos of
// every stack, and a stack whose extension is missing here would classify a
// code-bearing completion as "no code surface" and accept a skip declaration.
const CODE_EXTENSIONS = new Set([
    // JS / TS
    'ts',
    'tsx',
    'js',
    'jsx',
    'mjs',
    'cjs',
    'mts',
    'cts',
    'vue',
    'svelte',
    // Python / Ruby / PHP / Perl
    'py',
    'pyi',
    'rb',
    'rake',
    'php',
    'pl',
    'pm',
    // JVM / .NET
    'java',
    'kt',
    'kts',
    'scala',
    'groovy',
    'cs',
    'fs',
    // Native
    'c',
    'h',
    'cc',
    'cpp',
    'cxx',
    'hpp',
    'hh',
    'm',
    'mm',
    'swift',
    'go',
    'rs',
    'zig',
    // Shell / scripting
    'sh',
    'bash',
    'zsh',
    'fish',
    'ps1',
    'lua',
    // Data / templates that carry executable behaviour
    'sql',
    'ex',
    'exs',
    'erl',
    'dart',
    'r',
]);

/**
 * Template extensions whose *inner* extension decides. `foo.blade.php` is
 * already caught by `php`; `foo.html.twig` / `foo.j2` are not, so they are
 * listed as whole suffixes.
 */
const CODE_SUFFIXES = ['.blade.php', '.html.twig', '.twig', '.j2', '.erb', '.hbs'];

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
    const base = norm.slice(norm.lastIndexOf('/') + 1).toLowerCase();
    if (CODE_SUFFIXES.some((s) => base.endsWith(s))) {
        return true;
    }
    const dot = base.lastIndexOf('.');
    if (dot <= 0) {
        return false;
    }
    return CODE_EXTENSIONS.has(base.slice(dot + 1));
}

const MARKER_RE =
    /^<!--\s*completion-review:\s*v1\s*\|\s*reviewed:\s*(\d{4}-\d{2}-\d{2})\s*\|\s*scope:\s*([0-9a-fA-F]{64})\s*\|\s*diff:\s*([0-9a-fA-F]{7,40})\s*\|\s*reviewer:\s*(\S(?:[^|>]*[^|>\s])?)\s*-->$/;

export function parseMarkerLine(line: string): Marker | null {
    const m = MARKER_RE.exec(line.trim());
    if (!m) {
        return null;
    }
    return {
        reviewed: m[1] as string,
        scope: (m[2] as string).toLowerCase(),
        diffSha: (m[3] as string).toLowerCase(),
        reviewer: (m[4] as string).trim(),
    };
}

const HONEST_NULL_RE = /^\*\*Honest-null:\*\* 0 findings, scope ([0-9a-fA-F]{64}), reviewed (\d{4}-\d{2}-\d{2})$/;

export function parseHonestNull(line: string): HonestNull | null {
    const m = HONEST_NULL_RE.exec(line.trim());
    if (!m) {
        return null;
    }
    return { scope: (m[1] as string).toLowerCase(), reviewed: m[2] as string };
}

const SKIP_RE =
    /^\*\*Skipped:\*\* no code surface for this completion — (.+), scope ([0-9a-fA-F]{64}|none), declared (\d{4}-\d{2}-\d{2})$/;

export function parseSkipDeclaration(line: string): SkipDeclaration | null {
    const m = SKIP_RE.exec(line.trim());
    if (!m) {
        return null;
    }
    const reason = (m[1] as string).trim();
    if (reason === '') {
        return null;
    }
    return { reason, scope: (m[2] as string).toLowerCase(), declared: m[3] as string };
}

/** First 7-40 char hex token in a Reason/Ref cell — the commit-ish, if any. */
export function extractFixRef(reasonRef: string): string | null {
    const m = /\b[0-9a-f]{7,40}\b/i.exec(reasonRef);
    return m ? (m[0] as string).toLowerCase() : null;
}

/**
 * Does a leftover artifact in the reviews directory belong to THIS branch?
 *
 * Only own artifacts may produce violations. Without this, one malformed
 * legacy artifact in the tracked reviews directory would block every
 * subsequent PR (directory-wide poisoning). Containment is allowed in both
 * directions so a roadmap-slug artifact (`road-to-x.findings.md`) still
 * counts as own on branch `feat/road-to-x`; a 4-char floor keeps a stub like
 * `feat` from matching everything.
 */
export function isOwnArtifactSlug(artifactSlug: string, branchSlug: string): boolean {
    const a = artifactSlug.toLowerCase();
    const b = branchSlug.toLowerCase();
    if (a === '' || b === '') {
        return false;
    }
    if (a === b) {
        return true;
    }
    const shorter = a.length <= b.length ? a : b;
    if (shorter.length < 4) {
        return false;
    }
    return a.includes(b) || b.includes(a);
}

function splitTableRow(line: string): string[] {
    return splitMarkdownRow(line);
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
        malformedRows: [],
        manifest: parseManifest(text),
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
        // Marker candidates must LOOK like the §2.1 HTML comment: prose that
        // merely mentions the grammar (`the \`completion-review:\` marker …`,
        // or a reviewer note quoting it in backticks — real artefacts in this
        // repo contain exactly that) is not a candidate at all. And a candidate
        // that fails to parse is only malformed until a valid marker turns up
        // later: without that, one quoted grammar line above the header
        // permanently poisoned the artefact with a spurious `bad-marker`.
        if (out.marker === null && trimmed.startsWith('<!--') && trimmed.includes('completion-review:')) {
            const marker = parseMarkerLine(trimmed);
            if (marker) {
                out.marker = marker;
                out.markerMalformed = false;
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
            } else {
                // A short row is NOT "not a findings row": dropping it silently
                // let an `open` finding pass whenever one well-formed row kept
                // `rows.length > 0` (so the neither-table-nor-honest-null
                // fallback stayed quiet too). Omitting the trailing empty
                // `Reason/Ref` cell is the likeliest authoring slip, since the
                // §2.2 template ends in exactly that empty cell. Gate R1 already
                // reports this class — same name, `malformed_row`.
                out.malformedRows.push(
                    `line ${lineno}: findings row has ${String(cells.length)} cell(s), expected 6 ` +
                        '(`| # | Severity | File:Line | Finding | Status | Reason/Ref |` — the trailing ' +
                        'Reason/Ref cell is required even when empty)',
                );
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

/**
 * The review-scope diff is read through this runner, and Node's default
 * `maxBuffer` is 1 MiB — a branch whose scope diff exceeds that throws ENOBUFS,
 * which surfaces as exit 2 and makes every caller warn-and-allow. Gate R2 would
 * then silently self-disable on exactly the large PRs that most need it. The
 * dispatcher already reads the identical diff with this ceiling; the shared
 * scope definition is only as strong as the weakest injected git runner.
 */
export const GIT_MAX_BUFFER = 256 * 1024 * 1024;

function gitTry(repo: string, args: readonly string[]): GitResult {
    try {
        const stdout = execFileSync('git', args as string[], {
            cwd: repo,
            encoding: 'utf8',
            maxBuffer: GIT_MAX_BUFFER,
            stdio: ['ignore', 'pipe', 'pipe'],
            // cwd decides, never an inherited GIT_DIR (hook environments).
            env: gitEnv(),
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
    /** `<slug>.findings.md` → `<slug>`, sanitized. */
    slug: string;
    /** This branch's artifact (see {@link isOwnArtifactSlug}). */
    own: boolean;
}

interface EvalInput {
    repo: string;
    head: string;
    /** sha256 of the review-scope diff — what the review binds to (§2.1). */
    scopeHash: string;
    /** The review scope is empty — the only state a `scope none` skip covers. */
    scopeEmpty: boolean;
    changed: readonly string[];
    artifacts: readonly ArtifactFile[];
    artifactDirLabel: string;
}

/** Does this artifact claim the CURRENT review scope? */
function claimsScope(art: ParsedArtifact, scopeHash: string, scopeEmpty: boolean): boolean {
    if (art.marker !== null && art.marker.scope === scopeHash) {
        return true;
    }
    if (art.honestNull !== null && art.honestNull.scope === scopeHash) {
        return true;
    }
    if (art.skip !== null) {
        // `scope none` is valid ONLY for a genuinely empty review scope.
        // Without that condition one committed `scope none` skip would satisfy
        // the gate for every later diff, forever.
        return art.skip.scope === 'none' ? scopeEmpty : art.skip.scope === scopeHash;
    }
    return false;
}

/**
 * Does the artifact carry a review (header marker, findings table, or
 * honest-null line)? §5 makes a context manifest mandatory for one; a bare §2.4
 * skip declaration carries no reviewer dispatch and needs none.
 */
function artifactCarriesReview(art: ParsedArtifact): boolean {
    return art.marker !== null || art.rows.length > 0 || art.honestNull !== null;
}

export interface ArtifactRelevance {
    /** Claims the CURRENT review scope — §2.6 relevance. */
    relevant: boolean;
    /** Carries a review, so §5 requires a manifest that can be re-derived. */
    carriesReview: boolean;
}

/**
 * The §2.6 relevance notion, exported so a CI re-derivation step can SELECT the
 * artefacts to verify instead of verifying the whole accumulating directory
 * (`dispatch_r2_reviewer --verify-current`). Restating the notion there is what
 * would silently re-break the gate, so it lives here once.
 */
export function artifactRelevance(text: string, scopeHash: string, scopeEmpty: boolean): ArtifactRelevance {
    const art = parseArtifact(text);
    return {
        relevant: claimsScope(art, scopeHash, scopeEmpty),
        carriesReview: artifactCarriesReview(art),
    };
}

function evaluate(input: EvalInput): Violation[] {
    const { repo, head, scopeHash, scopeEmpty, changed, artifacts } = input;
    const violations: Violation[] = [];
    const codePaths = changed.filter(isCodePath);

    const relevant = artifacts.filter(({ art }) => claimsScope(art, scopeHash, scopeEmpty));
    const relevantFiles = new Set(relevant.map(({ file }) => file));

    // Grammar violations are reported ONLY for artifacts that are this
    // branch's (own slug) or that claim the current scope. A foreign or
    // legacy artifact sitting in the tracked reviews directory must not be
    // able to block an unrelated PR — that is directory-wide poisoning.
    for (const { file, art, own } of artifacts) {
        if (!own && !relevantFiles.has(file)) {
            continue;
        }
        if (art.markerMalformed) {
            violations.push({
                kind: 'bad-marker',
                file,
                detail:
                    'completion-review header marker malformed — expected ' +
                    '`<!-- completion-review: v1 | reviewed: YYYY-MM-DD | scope: <64-hex scope hash> | ' +
                    'diff: <sha> | reviewer: <id> -->`',
            });
        }
        for (const detail of art.malformedLines) {
            violations.push({ kind: 'bad-value', file, detail });
        }
        // §2.2: a table-shaped line that does not carry the six cells is a
        // violation, never a row to skip — an invisible row is an unreviewed
        // finding that passes.
        for (const detail of art.malformedRows) {
            violations.push({ kind: 'malformed-row', file, detail });
        }
    }

    for (const { file, art } of relevant) {
        const carriesReview = artifactCarriesReview(art);

        // A skip and a findings table cannot both hold. Reported, and the
        // table is still validated — a skip line must never suppress rows.
        if (art.skip !== null && art.rows.length > 0) {
            violations.push({
                kind: 'bad-value',
                file,
                detail:
                    'contradictory artifact: a `**Skipped:**` declaration and a findings table are both ' +
                    'present — a completion is either skip-eligible (no code surface) or reviewed, never both',
            });
        }

        if (art.skip !== null && codePaths.length > 0) {
            violations.push({
                kind: 'skip-on-code-diff',
                file,
                detail:
                    `skip declaration present but the diff touches ${codePaths.length} code path(s) ` +
                    `(e.g. ${codePaths.slice(0, 3).join(', ')}) — a code diff requires a findings artifact`,
            });
        }

        // §2.1: every header field is mandatory. A review-bearing artifact with
        // NO parseable header marker at all is malformed — not "no marker,
        // therefore nothing to check". A marker-SHAPED line that failed to
        // parse is already reported above, so this reports once (§2.6).
        if (carriesReview && art.marker === null && !art.markerMalformed) {
            violations.push({
                kind: 'bad-marker',
                file,
                detail:
                    'findings artifact carries a review but no `completion-review: v1` header marker — the §2.1 ' +
                    'header is mandatory: `<!-- completion-review: v1 | reviewed: YYYY-MM-DD | ' +
                    'scope: <64-hex scope hash> | diff: <sha> | reviewer: <id> -->`',
            });
        }

        // §2.1: the header `scope:` is the ONLY field staleness is decided on.
        // Relevance ORs header / honest-null / skip, so without this an artifact
        // whose header still points at an older scope, while its honest-null
        // line or manifest carries the current one, was relevant AND stale — and
        // passed both gates.
        if (art.marker !== null && art.marker.scope !== scopeHash) {
            violations.push({
                kind: 'stale-review',
                file,
                detail:
                    `header declares scope ${art.marker.scope} but the current review scope is ${scopeHash} — ` +
                    'the header `scope:` is the only field staleness is decided on (contract §2.1)',
            });
        }

        // §5: the manifest is verification, not self-attestation — an artifact
        // without one is unverifiable, so its absence is a policy violation
        // rather than something to tolerate. A bare skip declaration carries
        // no reviewer dispatch and needs none. When both are present the
        // manifest's `scope_hash` MUST agree with the header's `scope:` (§5);
        // staleness itself is the header check above, so agreement is all that
        // is left to verify here.
        if (carriesReview && art.manifest === null) {
            violations.push({
                kind: 'missing-manifest',
                file,
                detail:
                    'findings artifact carries no parseable `context-manifest: v1` block — the §5 manifest ' +
                    'is mandatory (verification, not self-attestation); re-dispatch via dispatch_r2_reviewer',
            });
        } else if (art.manifest !== null && art.marker !== null && art.manifest.scope_hash !== art.marker.scope) {
            violations.push({
                kind: 'manifest-header-mismatch',
                file,
                detail:
                    `manifest records scope_hash ${art.manifest.scope_hash} but the header declares scope ` +
                    `${art.marker.scope} — the two must agree (contract §5); re-dispatch via dispatch_r2_reviewer`,
            });
        }

        if (art.honestNull !== null && art.marker !== null && art.honestNull.scope !== scopeHash) {
            violations.push({
                kind: 'stale-review',
                file,
                detail: `honest-null declares scope ${art.honestNull.scope} but the current review scope is ${scopeHash}`,
            });
        }

        if (art.rows.length > 0) {
            for (const v of validateFindingRows(art.rows)) {
                violations.push({ ...v, file });
            }
            violations.push(...checkFindingsBeforeFixes(repo, file, art.rows));
        } else if (art.honestNull === null && art.skip === null) {
            violations.push({
                kind: 'bad-value',
                file,
                detail: 'artifact has neither a findings table nor an honest-null / skip declaration line',
            });
        }
    }

    if (relevant.length === 0) {
        const ownArtifacts = artifacts.filter(({ own }) => own);
        const ownParseable = ownArtifacts.filter(
            ({ art }) => art.marker !== null || art.honestNull !== null || art.skip !== null,
        );
        const anyOwnBadMarker = ownArtifacts.some(({ art }) => art.markerMalformed);
        if (ownParseable.length > 0) {
            const scopes = ownParseable.map(
                ({ art }) => art.marker?.scope ?? art.skip?.scope ?? art.honestNull?.scope ?? '?',
            );
            violations.push({
                kind: 'stale-review',
                file: (ownParseable[0] as ArtifactFile).file,
                detail:
                    `no artifact matches the current review scope ${scopeHash} (head ${head}) — found ` +
                    `artifact(s) for scope(s): ${scopes.join(', ')}. A change to the reviewed content forces ` +
                    're-review (contract §2.1).',
            });
        } else if (!anyOwnBadMarker) {
            violations.push({
                kind: 'missing-artifact',
                file: null,
                detail:
                    `no completion-review artifact for review scope ${scopeHash} (head ${head}) under ` +
                    `${input.artifactDirLabel} and no valid skip declaration (diff has ${codePaths.length} ` +
                    `code path(s) of ${changed.length} changed file(s))`,
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

    // `/`-normalized: a raw Windows separator is not a valid git pathspec, and
    // an empty result here reads as `artifact-not-committed` on a properly
    // committed artifact.
    const rel = path.relative(repo, artifactAbs).split(path.sep).join('/');
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

/**
 * `planning.completion_review === false` in `<dir>/.agent-settings.yml` disables
 * Gate R2. Parsing mirrors Gate R1's `riskReviewDisabled` exactly (same file,
 * same fail-open-on-unreadable/unparseable behaviour, same strict `=== false`
 * test) so a missing key or a missing file leaves the gate ACTIVE.
 *
 * Re-exported from `_lib/planning_settings.ts`: the dispatcher's `--verify`
 * layer must honour the same hatch, and it cannot import from this module
 * (this module imports the scope hash from it).
 */
export { completionReviewDisabled };

/** Is `rel` a tracked directory in `ref`? Absolute paths are never tracked. */
function isTrackedTree(repo: string, ref: string, rel: string): boolean {
    if (path.isAbsolute(rel)) {
        return false;
    }
    return gitTry(repo, ['ls-tree', '-d', '--name-only', ref, '--', rel]).stdout.trim() !== '';
}

/**
 * When is an unresolvable artefact root NOT a dead scope?
 *
 * The dead-scope assertion exists to catch a MOVED root (the ADR-051 class:
 * fourteen gates kept scanning a path a migration had renamed, and reported
 * green). Two states are legitimately empty instead:
 *   - the review scope is empty — there is nothing to review at all;
 *   - the root is absent AND was never tracked — a repo with no review corpus
 *     yet. That state still blocks, via the actionable `missing-artifact`.
 *
 * A root that IS tracked but no longer resolves on disk is the real defect and
 * gets no exemption.
 *
 * @returns the `allowEmpty` option to spread, or `null` to let it throw.
 */
function deadScopeExemption(
    repo: string,
    args: Args,
    state: { scopeEmpty: boolean; artifactRootResolved: boolean },
): { allowEmpty: string } | null {
    if (state.scopeEmpty) {
        return { allowEmpty: 'review scope is empty — no reviewable diff vs base' };
    }
    if (state.artifactRootResolved) {
        return null; // scanned >= 1 anyway; the assertion will not fire
    }
    const tracked =
        isTrackedTree(repo, args.base, args.artifactDir) || isTrackedTree(repo, 'HEAD', args.artifactDir);
    if (tracked) {
        return null; // tracked root that no longer resolves → dead scope
    }
    return {
        allowEmpty: `artefact root '${args.artifactDir}' is absent and untracked — no review corpus in this repo yet`,
    };
}

function run(args: Args): number {
    const repo = path.resolve(args.repo);

    // Settings escape hatch (contract § Scope): `planning.completion_review:
    // false` disables Gate R2 — documented in the settings template, the Zod
    // schema and the /create-pr surface, so it has to actually work. Mirrors
    // Gate R1's `riskReviewDisabled`, including the explicit `scanned: 0`:
    // the zero-scan is a configured skip, not a dead scope.
    if (completionReviewDisabled(repo)) {
        process.stdout.write('⚠️  planning.completion_review=false — Gate R2 skipped (settings escape hatch)\n');
        process.stdout.write('scanned: 0\n');
        return 0;
    }

    // The artefact inventory needs no git, so it is resolved FIRST: the
    // gate-coverage guard parses `scanned:` and must get a number on EVERY exit
    // path, including the exit-2 internal-error one below (an unresolvable base
    // ref used to exit 2 emitting no count at all).
    const artifactDirAbs = path.isAbsolute(args.artifactDir) ? args.artifactDir : path.join(repo, args.artifactDir);
    let artifactRootResolved = false;
    let artifactPaths: string[] = [];
    try {
        if (fs.statSync(artifactDirAbs).isDirectory()) {
            artifactRootResolved = true;
            artifactPaths = fs
                .readdirSync(artifactDirAbs)
                .filter((n) => n.endsWith('.findings.md'))
                .sort()
                .map((n) => path.join(artifactDirAbs, n));
        }
    } catch {
        // Root missing → handled by the dead-scope check below, never silently.
    }

    // Gate-coverage contract: `scanned:` is emitted BEFORE the pass/fail branch
    // (coverage and verdict are different questions). N counts the artefacts
    // inspected plus 1 for the diff evaluation — and that +1 is counted ONLY
    // when the artefact root actually resolves, so a moved/renamed root drops
    // N to 0 instead of hiding behind a floor that cannot fail.
    const scanned = artifactPaths.length + (artifactRootResolved ? 1 : 0);
    process.stdout.write(`scanned: ${scanned}\n`);

    const baseCheck = gitTry(repo, ['rev-parse', '--verify', '--quiet', `${args.base}^{commit}`]);
    if (!baseCheck.ok) {
        throw new InternalError(`base ref '${args.base}' not found in ${repo}`);
    }
    const head = gitOut(repo, ['rev-parse', 'HEAD']).trim().toLowerCase();
    // The REVIEW SCOPE excludes the review artefacts themselves, so committing
    // the findings artifact (§2.5) cannot invalidate the review it records.
    const scope = computeReviewScope((a) => gitOut(repo, a), args.base);
    const scopeHash = scope.hash;
    const scopeEmpty = scope.empty;
    const changed = gitOut(repo, reviewScopeNameOnlyArgs(args.base))
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    const branchSlug = deriveSlug((a) => gitOut(repo, a));

    try {
        assertScanned({
            gate: 'check_completion_review',
            scanned,
            units: 'review artefact(s) + diff evaluation',
            roots: [args.artifactDir],
            ...(deadScopeExemption(repo, args, { scopeEmpty, artifactRootResolved }) ?? {}),
        });
    } catch (exc) {
        if (!(exc instanceof DeadScopeError)) {
            throw exc;
        }
        // Contract §6 carve-out: a dead scan scope is a POLICY violation, not
        // an internal error. Mapping it to exit 2 would make every caller
        // warn-and-allow, silently degrading the gate to advisory the moment
        // the artefact root moves.
        return report(
            args,
            [
                {
                    kind: 'dead-scan-scope',
                    file: null,
                    detail:
                        `${exc.message} (artefact root '${args.artifactDir}' does not resolve under ${repo}; ` +
                        'create it or repoint --artifact-dir — a gate that read nothing has not passed)',
                },
            ],
            null,
        );
    }

    if (scopeEmpty) {
        return report(args, [], `✅  No reviewable changes vs ${args.base} — nothing to review.\n`);
    }

    const artifacts: ArtifactFile[] = artifactPaths.map((file) => {
        let text: string;
        try {
            text = fs.readFileSync(file, 'utf-8');
        } catch (exc) {
            throw new InternalError(`unreadable artifact ${file}: ${exc instanceof Error ? exc.message : String(exc)}`);
        }
        const slug = sanitizeSlug(path.basename(file).replace(/\.findings\.md$/, ''));
        return { file, art: parseArtifact(text), slug, own: isOwnArtifactSlug(slug, branchSlug) };
    });

    const violations = evaluate({
        repo,
        head,
        scopeHash,
        scopeEmpty,
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
