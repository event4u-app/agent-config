/**
 * Self-review gate — the package reviewing its own PRs with the exact machinery
 * it sells (`adversarial-review` + `agent-security-review`).
 *
 * road-to-maintainer-bus-factor Phase 1. Ships ADVISORY + INERT-WITHOUT-SECRET:
 *   - `--dry-run` (the PR gate job): no API, no spend, no secret. Assembles and
 *     prints the review plan (which skills, which files, budget estimate) and
 *     validates the harness. Always exit 0.
 *   - live `--advisory` (the secret-gated job): loads the two review skill bodies
 *     as the system prompt, sends the diff to the model, collects structured
 *     findings, classifies them, records a verdict, and posts a PR review. In
 *     advisory mode it NEVER blocks the merge (exit 0) — it records what WOULD
 *     block. If no key is available it is a logged no-op (exit 0), never a failure.
 *
 * On a LARGE or CLAIM-AFFECTING diff the two in-session lenses are not enough —
 * such a diff warrants the full `ai-council` advisor panel. That is a
 * spend-bearing multi-model run, so per blocker `self-review-gate-cost` the gate
 * DETECTS the escalation deterministically (`escalationReasons`) and RECOMMENDS
 * a maintainer `/council:pr` run; it never fires paid council calls itself. The
 * paid council stays governed by the standing spend-authorization discipline at
 * run time.
 *
 * Turning the gate REQUIRED (block-on-verdict) and wiring the API secret + the
 * per-PR budget are the maintainer's acts (blocker `self-review-gate-cost`); this
 * script exposes the `--enforce` path so that flip is a one-flag change, but the
 * shipped workflow runs advisory only.
 *
 * `classifyBlocking` + `gateVerdict` are pure and unit-tested (no API) — mirrors
 * the `check_quality_regression.gateVerdict` pattern.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AnthropicClient, load_anthropic_key } from './ai_council/clients.js';
import { independenceFields } from './_lib/review_independence.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ── Finding model ─────────────────────────────────────────────────────
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type FindingKind = 'security' | 'claim' | 'correctness' | 'style';

export interface Finding {
    severity: Severity;
    kind: FindingKind;
    title: string;
    detail: string;
    file?: string;
}

/**
 * Stable identifier for a finding — sha256 of kind|title|file, 12 hex chars
 * (release-truth Phase 3). The id keys the disposition ledger
 * (`agents/evidence/release-findings/<version>.json`): the 9.14.0 symlink
 * finding merged with no traceable disposition precisely because findings
 * carried no identity that outlived the PR comment.
 */
export function findingId(f: Pick<Finding, 'kind' | 'title' | 'file'>): string {
    return createHash('sha256')
        .update(`${f.kind}|${f.title}|${f.file ?? ''}`)
        .digest('hex')
        .slice(0, 12);
}

/**
 * A finding is merge-blocking iff it is security- or claim-affecting AND at
 * least `high` severity. Style and correctness findings advise; low/medium
 * security findings advise. Council 2026-07-08 (claude-sonnet-4-5 + gpt-4o):
 * a 100 %-blocking gate at solo-maintainer token cost gets ignored or gamed —
 * block ONLY on the narrow security/claim × {critical,high} intersection.
 */
export function classifyBlocking(f: Finding): boolean {
    return (f.kind === 'security' || f.kind === 'claim') && (f.severity === 'critical' || f.severity === 'high');
}

/**
 * Deterministic gate verdict. Mirrors `check_quality_regression.gateVerdict`:
 * exit 2 blocks the merge, exit 0 passes.
 *   - advisory (default shipped mode): always 0; the caller reports the
 *     would-block set without failing the check.
 *   - enforce (maintainer flip): 2 iff any finding is merge-blocking.
 */
export function gateVerdict(findings: readonly Finding[], opts: { enforce: boolean }): 0 | 2 {
    if (!opts.enforce) return 0;
    return findings.some(classifyBlocking) ? 2 : 0;
}

// ── Diff collection ───────────────────────────────────────────────────
/** Generated projections + lockfiles a self-review should not re-read. */
const SKIP_PREFIXES = ['dist/agent-src/', '.augment/', '.claude/', '.cursor/', '.clinerules/'];
const SKIP_EXACT = new Set(['.windsurfrules', 'GEMINI.md', 'package-lock.json']);

export function isReviewablePath(p: string): boolean {
    if (SKIP_EXACT.has(p)) return false;
    return !SKIP_PREFIXES.some((pre) => p.startsWith(pre));
}

function changedFiles(baseRef: string, cwd: string = REPO_ROOT): string[] {
    // `-c core.quotePath=false`: by default git renders a non-ASCII path as an
    // escaped, QUOTED string (`"gr\303\274e.ts"`), which then matches no
    // pathspec when fed back to `git diff`. The file was silently skipped by
    // `perFileDiffs` AND counted as reviewed by the coverage arithmetic — an
    // unreviewed file reported as read, which is the failure this whole change
    // exists to prevent.
    const r = spawnSync('git', ['-c', 'core.quotePath=false', 'diff', '--name-only', `${baseRef}...HEAD`], {
        cwd,
        encoding: 'utf8',
    });
    if (r.status !== 0) {
        throw new Error(`git diff failed: ${(r.stderr ?? '').toString().slice(0, 300)}`);
    }
    return (r.stdout ?? '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter(isReviewablePath);
}

function diffText(baseRef: string, files: string[], cwd: string = REPO_ROOT): string {
    if (files.length === 0) return '';
    const r = spawnSync('git', ['diff', `${baseRef}...HEAD`, '--', ...files], {
        cwd,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
    });
    return (r.stdout ?? '').toString();
}

/**
 * The diff split per file, so it can be packed into budgeted requests.
 *
 * One `git diff` per file rather than splitting the combined output, because
 * packing needs a SIZE PER FILE before any text is assembled — a combined diff
 * gives one blob and its per-file sizes only by re-deriving path boundaries
 * from the text.
 *
 * The rationale this replaces claimed the combined form "breaks that parse
 * silently" on separator-bearing paths. That was a straw man: the pre-change
 * code never parsed the combined diff at all, it sent it whole.
 *
 * It is not free either. Each three-dot diff re-resolves the merge base at
 * ~93 ms, so a 316-file span costs ~30 s. That is paid ONCE now — `buildPlan`
 * stores the partition and `main` reuses it, where it used to recompute and
 * pay twice.
 */
function perFileDiffs(baseRef: string, files: readonly string[], cwd: string = REPO_ROOT): FileDiff[] {
    const out: FileDiff[] = [];
    for (const path of files) {
        const diff = diffText(baseRef, [path], cwd);
        if (diff !== '') out.push({ path, diff });
    }
    return out;
}

/** Sum of added+deleted lines across `files` (binary files count 0). */
function changedLineCount(baseRef: string, files: string[], cwd: string = REPO_ROOT): number {
    if (files.length === 0) return 0;
    const r = spawnSync('git', ['diff', '--numstat', `${baseRef}...HEAD`, '--', ...files], {
        cwd,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
    });
    let total = 0;
    for (const line of (r.stdout ?? '').toString().split('\n')) {
        const m = /^(\d+)\t(\d+)\t/.exec(line); // added \t deleted \t path ("-" for binary)
        if (m) total += Number(m[1]) + Number(m[2]);
    }
    return total;
}

// ── Release-PR detection (road-to-feedback-9.2.0-followups Phase 3) ────
//
// Moved to `_lib/release_scope.ts` so the release-aware content checks reuse
// this detector instead of re-deriving it (road-to-release-shape-honesty
// Phase 1). Imported for local use AND re-exported — a bare `export … from`
// would not bind the names in this module's scope. Public surface unchanged.
import {
    detectReleaseVersionFromGit,
    pickPreviousTag,
} from './_lib/release_scope.js';

export {
    detectReleaseVersion,
    detectReleaseVersionFromGit,
    pickPreviousTag,
} from './_lib/release_scope.js';

function listGitTags(cwd: string): string[] {
    const r = spawnSync('git', ['tag'], { cwd, encoding: 'utf8' });
    return (r.stdout ?? '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
}

/** Impure wrapper: lists tags via git, then picks the previous one. */
export function resolvePreviousTagFromGit(version: string, cwd: string = REPO_ROOT): string | null {
    return pickPreviousTag(version, listGitTags(cwd));
}

// ── Escalation classifier (large / claim-affecting → full ai-council) ──
/**
 * A large or claim-affecting diff warrants the FULL `ai-council` (advisor
 * panel), not just the two in-session lenses — but that is a spend-bearing,
 * multi-model run. Per blocker `self-review-gate-cost` the paid council stays
 * governed by the standing spend-authorization discipline AT RUN TIME: the gate
 * DETECTS the escalation deterministically here and RECOMMENDS a maintainer
 * `/council:pr` run; it never fires paid council calls by surprise in CI.
 */
export const LARGE_DIFF_LINES = 400;
/** The claim ledger + proof surfaces `check_claims` binds to. */
const CLAIM_SURFACES = new Set(['docs/CLAIMS.md', 'docs/proof.md', 'docs/comparison.yaml']);

export function escalationReasons(files: readonly string[], changedLines: number): string[] {
    const reasons: string[] = [];
    if (changedLines >= LARGE_DIFF_LINES) {
        reasons.push(`large diff (${changedLines} changed lines ≥ ${LARGE_DIFF_LINES})`);
    }
    const claimHits = files.filter((f) => CLAIM_SURFACES.has(f) || f === 'README.md');
    if (claimHits.length > 0) {
        reasons.push(`claim-affecting surface touched (${claimHits.join(', ')})`);
    }
    return reasons;
}

// ── Review skill bodies (the system prompt) ───────────────────────────
const REVIEW_SKILLS = ['adversarial-review', 'agent-security-review'] as const;

function loadSkillBody(name: string): string {
    const p = path.join(REPO_ROOT, 'src', 'skills', name, 'SKILL.md');
    return readFileSync(p, 'utf8');
}

/** Info about a detected release PR — see docs/design/release-pr-review-mode.md. */
export interface ReleaseInfo {
    version: string;
    previousTag: string;
    /** Files touched by the packaging diff (baseRef...HEAD) — for context only. */
    packagingFiles: string[];
}

/**
 * Release-mode note appended to the system prompt so the model analyzes the
 * feature range instead of reporting release features as "not in the diff"
 * (the PR #957 false-advisory shape — see docs/design/release-pr-review-mode.md).
 */
function releaseNoteText(release: ReleaseInfo, baseRef: string): string {
    const fileList = release.packagingFiles.length > 0 ? release.packagingFiles.join(', ') : '(none)';
    return (
        `\n\nRelease PR for ${release.version}: analysis range is ${release.previousTag}...HEAD ` +
        `(the full release commit range). The packaging diff vs ${baseRef} touches: ${fileList}. ` +
        "Do NOT report a feature as 'not in the diff' when it is present in the release range."
    );
}

function buildSystemPrompt(release?: ReleaseInfo, baseRef?: string): string {
    const bodies = REVIEW_SKILLS.map((s) => `# Skill: ${s}\n\n${loadSkillBody(s)}`).join('\n\n---\n\n');
    const base = [
        'You are the self-review gate for an AI-agent governance package. Apply the',
        'two skills below to the supplied PR diff. Return ONLY a JSON object of the',
        'shape {"findings":[{"severity":"critical|high|medium|low",',
        '"kind":"security|claim|correctness|style","title":"...","detail":"...",',
        '"file":"optional/path"}]}. Use kind="claim" for an unbacked headline number',
        'or a proof/CLAIMS-affecting statement, kind="security" for an auth/tenant/',
        'secret/egress/injection gap. No prose outside the JSON.',
        '',
        bodies,
    ].join('\n');
    return release && baseRef ? base + releaseNoteText(release, baseRef) : base;
}

// Prompt budget and partitioning.
//
// Measured across FOUR consecutive releases: the live call returned
// `HTTP 400 prompt is too long` every time and the gate reviewed nothing. The
// release path sets `analysisBase` to the previous tag, so the whole release
// span goes into one request. ALL FOUR recorded a figure against the 200000
// cap — 235472 (14.17.0), 413191 (14.18.0), 450336 (14.19.0), 260998
// (14.20.0). The smallest exceeds the cap by 17.7 %.
//
// Corrected here: an earlier version of this comment said three releases
// recorded a figure and put the smallest at 30 % over. Both were wrong, and the
// omitted measurement was the one NEAREST the cap — the reading that most
// constrains the budget below. The conclusion is unchanged and does not depend
// on the error: every span observed exceeds the cap, so this is structural and
// waiting for smaller releases is not a fix.
//
// `promptChars` was already computed and only REPORTED. Nothing consulted it
// before spending the call.
//
// What this deliberately does NOT do is truncate. A silently shortened diff
// produces findings about a fragment while reading as a review of the whole
// change, which is a false green — the failure mode this repository's
// honest-null discipline exists to prevent. Instead the diff is partitioned per
// FILE, each chunk is reviewed, findings are merged, and whatever did not fit
// is NAMED as unreviewed.

/**
 * Chars per token the budget assumes, and the measurement behind it.
 *
 * A proxy, not a measurement of the real thing: the cap is enforced by the
 * provider's tokenizer, which this repository cannot run — `js-tiktoken` is a
 * DIFFERENT tokenizer, so agreeing with it would prove nothing.
 *
 * The ratio is DERIVED from the four failures, dividing measured diff chars by
 * the token count the API itself reported:
 *
 *   14.19.0…14.20.0    817,805 chars / 260,998 tokens  =  3.13
 *   14.18.0…14.19.0  1,432,333 chars / 450,336 tokens  =  3.18
 *
 * An earlier version of this constant used 3.0 and called it "deliberately
 * pessimistic". It was not: against a measured 3.13 that is 4 % of margin, and
 * the ratio is strongly content-dependent — cl100k over this repo's own diffs
 * reads ~3.9 for `src/`, ~4.1 for `agents/` prose and ~2.75 for a lockfile,
 * a 1.5x spread. Dense JSON, CSV and YAML paths are not excluded from the
 * review scope, so a chunk of them tokenizes far worse than the average the
 * two spans above describe. 2.4 covers the lockfile-shaped end with the same
 * ~22 % gap those spans show between cl100k and the provider's count.
 *
 * A call that still overflows a chunk built under this budget falsifies this
 * number, not the partitioning — and the failure is graceful either way: the
 * chunk is reported unreviewed and the run continues.
 */
export const BUDGET_CHARS_PER_TOKEN = 2.4;

/**
 * Input budget for one request, in characters.
 *
 * 180000 rather than the full 200000 cap because the system prompt rides along
 * with EVERY request and is not part of the chunk: the two review skill bodies
 * are ~14000 chars, and in release mode `releaseNoteText` joins the entire
 * packaging file list into it — ~12600 chars at 316 files. Both are charged per
 * chunk, so the reservation has to cover them at the same pessimistic ratio.
 */
export const PROMPT_BUDGET_CHARS = Math.floor(180_000 * BUDGET_CHARS_PER_TOKEN);

/**
 * Cost ceiling, in requests per run.
 *
 * The gate is advisory and single-maintainer-funded, so an unbounded chunk
 * count would turn one failed call into an arbitrary bill. A span that needs
 * more is reviewed up to the ceiling and the remainder reported unreviewed — a
 * partial review that says so, never a silent one.
 *
 * SIX, and the number moved for a measured reason rather than for comfort. It
 * was four while the budget assumed 3.0 chars/token. Correcting that assumption
 * to the measured 2.4 shrank each request, so the same span needs more of them:
 * the live 14.19.0...HEAD span went to FIVE requests at the corrected budget and
 * reported 82 files unreviewed. Buying tokenizer safety with coverage is not a
 * trade this gate should make silently, so the ceiling absorbs it with one
 * request of headroom above the largest span measured.
 *
 * The cost is real and is the reason this is a constant rather than unbounded:
 * six requests of up to ~180000 input tokens is the worst case per run, and
 * `--dry-run` prints the count before anything is spent.
 */
export const MAX_REVIEW_CHUNKS = 6;

/** How many unreviewed paths `--dry-run` names before collapsing to a count. */
export const DRY_RUN_UNREVIEWED_SAMPLE = 5;

export interface FileDiff {
    path: string;
    diff: string;
}

export interface DiffChunk {
    /** Concatenated diff text for one request. */
    text: string;
    /** The files this chunk carries — so coverage counts what was READ. */
    files: string[];
}

export interface DiffPartition {
    chunks: DiffChunk[];
    /** Files no chunk carries, with the reason — rendered into the review. */
    unreviewed: { path: string; reason: string }[];
}

/**
 * Pack per-file diffs into as few chunks as fit the budget.
 *
 * Deterministic: input order is preserved and the fill is greedy, so the same
 * span always partitions the same way and a finding's chunk is reproducible.
 *
 * A single file larger than the whole budget is NOT split. A diff cut at an
 * arbitrary byte offset produces half a hunk, and a reviewer reading half a
 * hunk reports on code that does not exist — worse than not reading it, because
 * the finding looks authoritative. Such a file is reported unreviewed instead.
 */
export function partitionDiff(
    files: readonly FileDiff[],
    budgetChars: number = PROMPT_BUDGET_CHARS,
    maxChunks: number = MAX_REVIEW_CHUNKS,
): DiffPartition {
    const ceiling = Math.max(0, maxChunks);
    const chunks: DiffChunk[] = [];
    const unreviewed: { path: string; reason: string }[] = [];
    let current: DiffChunk = { text: '', files: [] };

    for (const f of files) {
        if (f.diff.length > budgetChars) {
            unreviewed.push({
                path: f.path,
                reason:
                    `single-file diff of ${String(f.diff.length)} chars exceeds the ` +
                    `${String(budgetChars)}-char request budget; not split, because a diff cut ` +
                    'mid-hunk yields findings about code that does not exist',
            });
            continue;
        }
        if (current.text !== '' && current.text.length + f.diff.length > budgetChars) {
            chunks.push(current);
            current = { text: '', files: [] };
        }
        current.text += f.diff;
        current.files.push(f.path);
    }
    if (current.text !== '') chunks.push(current);

    if (chunks.length > ceiling) {
        // Every dropped chunk names its own files. The first version packed to
        // opaque strings and reported ONE aggregate entry for all of them, which
        // made the coverage subtraction downstream count every dropped file as
        // reviewed — 59 of 60 for a run that read 4. That was not an inherent
        // limit of the problem, as its comment claimed; it was a consequence of
        // throwing the file list away here.
        const total = chunks.length;
        for (const dropped of chunks.slice(ceiling)) {
            for (const path of dropped.files) {
                unreviewed.push({
                    path,
                    reason:
                        `the span needs ${String(total)} requests at this budget and the ` +
                        `per-run ceiling is ${String(ceiling)}; this file's chunk was not sent`,
                });
            }
        }
        chunks.length = ceiling;
    }
    return { chunks, unreviewed };
}

// ── Plan (dry-run) ────────────────────────────────────────────────────
export interface ReviewPlan {
    skills: string[];
    files: string[];
    /**
     * The partition the live run will send, computed ONCE.
     *
     * `main` used to call `partitionDiff(perFileDiffs(...))` again over the same
     * span. Measured: `git diff <base>...HEAD -- <one file>` costs ~93 ms
     * because every three-dot form re-resolves the merge base, so 316 files
     * meant ~632 spawns and about a minute of wall clock per live run, half of
     * it thrown away.
     */
    partition: DiffPartition;
    /** Model calls the live run will make — one per budgeted chunk. */
    requests: number;
    /** Files no request will carry, with the reason. */
    unreviewed: { path: string; reason: string }[];
    promptChars: number;
    note: string;
    escalation: string[];
    /** The base actually analyzed for `files`/diff: `baseRef`, or `release.previousTag`. */
    analysisBase: string;
    /** Present iff a release PR was detected — see docs/design/release-pr-review-mode.md. */
    release?: ReleaseInfo;
}

export function buildPlan(baseRef: string, cwd: string = REPO_ROOT): ReviewPlan {
    const packagingFiles = changedFiles(baseRef, cwd);
    const releaseVersion = detectReleaseVersionFromGit(baseRef, cwd);

    let release: ReleaseInfo | undefined;
    let analysisBase = baseRef;
    if (releaseVersion) {
        const previousTag = resolvePreviousTagFromGit(releaseVersion, cwd);
        if (previousTag) {
            release = { version: releaseVersion, previousTag, packagingFiles };
            analysisBase = previousTag;
        } else {
            process.stdout.write(
                `::notice::self-review-gate — release ${releaseVersion} detected but no previous tag ` +
                    `found; falling back to the normal base (${baseRef}).\n`,
            );
        }
    }

    const files = analysisBase === baseRef ? packagingFiles : changedFiles(analysisBase, cwd);
    const diff = diffText(analysisBase, files, cwd);
    const escalation = escalationReasons(files, changedLineCount(analysisBase, files, cwd));
    const systemPrompt = buildSystemPrompt(release, baseRef);
    // The same partition the live path will use, so `--dry-run` previews the
    // REQUEST COUNT rather than only a token estimate. This gate spends money
    // per request, and a plan that reports "~N tokens" without saying how many
    // calls that becomes hides the number the maintainer is deciding about.
    const partition = partitionDiff(perFileDiffs(analysisBase, files, cwd));
    return {
        partition,
        requests: partition.chunks.length,
        unreviewed: partition.unreviewed,
        skills: [...REVIEW_SKILLS],
        files,
        analysisBase,
        ...(release ? { release } : {}),
        promptChars: systemPrompt.length + diff.length,
        escalation,
        note:
            files.length === 0
                ? 'No reviewable (non-generated) files changed — the live review would no-op.'
                : `${files.length} reviewable file(s); live review would send ~${Math.ceil(
                      (systemPrompt.length * Math.max(1, partition.chunks.length) + diff.length) /
                          BUDGET_CHARS_PER_TOKEN,
                  )} input tokens across ${partition.chunks.length} request(s)` +
                  (partition.unreviewed.length > 0
                      ? `, leaving ${partition.unreviewed.length} path(s) UNREVIEWED.`
                      : '.'),
    };
}

// ── Live review ───────────────────────────────────────────────────────
function parseFindings(text: string): Finding[] {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
        return [];
    }
    const arr = (parsed as { findings?: unknown })?.findings;
    if (!Array.isArray(arr)) return [];
    const sev = new Set<Severity>(['critical', 'high', 'medium', 'low']);
    const kind = new Set<FindingKind>(['security', 'claim', 'correctness', 'style']);
    return arr
        .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
        .filter((f) => sev.has(f.severity as Severity) && kind.has(f.kind as FindingKind))
        .map((f) => ({
            severity: f.severity as Severity,
            kind: f.kind as FindingKind,
            title: String(f.title ?? '').slice(0, 300),
            detail: String(f.detail ?? '').slice(0, 2000),
            ...(typeof f.file === 'string' ? { file: f.file } : {}),
        }));
}

/**
 * Collapse findings that two chunks both reported.
 *
 * Chunks are disjoint by file, so a duplicate means the same defect was
 * described from two files' diffs — a shared helper and one of its callers, for
 * instance. `findingId` is sha256(kind|title|file), already the identity the
 * ledger and the rendered table use, so deduplicating on it keeps the id in the
 * comment matching the id in the artifact. First occurrence wins, which keeps
 * the order deterministic for a given partition.
 */
export function dedupeFindings(findings: readonly Finding[]): Finding[] {
    const seen = new Set<string>();
    const out: Finding[] = [];
    for (const f of findings) {
        const id = findingId(f);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(f);
    }
    return out;
}

/** Advisory escalation banner, appended when a diff warrants full ai-council. */
function escalationBlock(reasons: readonly string[]): string {
    if (reasons.length === 0) return '';
    return (
        `\n\n🔺 **Escalation warranted** — ${reasons.join('; ')}. The two in-session ` +
        'lenses above are a floor; a maintainer should run the full `ai-council` ' +
        '(`/council:pr`) on this diff. That is a spend-bearing, run-time-authorized ' +
        'act (blocker `self-review-gate-cost`) — this gate recommends it, never ' +
        'fires paid council calls itself.'
    );
}

/**
 * What the review did NOT read, stated in the comment itself.
 *
 * Without this line a chunked review is indistinguishable from a whole-span
 * one, which is the false green the partitioning exists to avoid — the reader
 * of the PR comment is the person who has to know the coverage, and they never
 * see the workflow log.
 */
export function coverageBlock(coverage?: ReviewCoverage): string {
    if (!coverage) return '';
    const parts = [
        `\n\n**Coverage.** ${String(coverage.chunks)} request(s) over ` +
            `${String(coverage.filesReviewed)} of ${String(coverage.filesTotal)} changed file(s).`,
    ];
    if (coverage.unreviewed.length > 0) {
        parts.push(
            ` **NOT reviewed (${String(coverage.unreviewed.length)}):**\n` +
                coverage.unreviewed.map((u) => `- \`${u.path}\` — ${u.reason}`).join('\n') +
                // Blank line, not a single newline: GFM treats one newline after
                // a list item as lazy continuation, so the sentence rendered
                // INSIDE the last bullet instead of standing on its own. The
                // `toContain` assertion passed either way, which is why the
                // reviewer had to render it to see it.
                '\n\nFindings above cover the reviewed part only; absence of a finding for an ' +
                'unreviewed path is not evidence about that path.',
        );
    }
    return parts.join('');
}

export interface ReviewCoverage {
    chunks: number;
    /** Files carried by chunks whose call RETURNED. */
    filesReviewed: number;
    /** Files the span changed, so the reader sees the fraction, not a bare count. */
    filesTotal: number;
    unreviewed: { path: string; reason: string }[];
}

export function renderReview(findings: Finding[], enforce: boolean, escalation: readonly string[] = [], coverage?: ReviewCoverage): string {
    const banner =
        '> HUMAN REVIEW REQUIRED — dogfooded AI adversarial-review + security gate. ' +
        'Findings are decision support, not a guarantee; detection is probabilistic. ' +
        'This is a floor, **not** independent human review.';
    const esc = escalationBlock(escalation);
    const cov = coverageBlock(coverage);
    if (findings.length === 0) {
        return `${banner}\n\n✅ Self-review gate: no findings.${cov}${esc}`;
    }
    const blocking = findings.filter(classifyBlocking);
    // Each row carries an explicit (Blocking)/(Advisory) marker so a
    // critical-but-non-blocking finding (e.g. critical × correctness) can never
    // read as inconsistent with the narrow `blocking.length` verdict count.
    const rows = findings
        .map((f) => {
            const marker = classifyBlocking(f) ? 'Blocking' : 'Advisory';
            return `| ${findingId(f)} | ${f.severity} (${marker}) | ${f.kind} | ${f.file ?? '—'} | ${f.title} |`;
        })
        .join('\n');
    const verdictLine = blocking.length
        ? enforce
            ? `❌ ${blocking.length} merge-blocking finding(s) (security/claim × high+).`
            : `⚠️ ${blocking.length} finding(s) WOULD block merge under an enforced gate (advisory now).`
        : '✅ No merge-blocking findings (style/correctness advise only).';
    // Three reviewers in the 2026-09 round searched the commit log for a finding
    // id's first eight characters, found nothing, and reported "no fix found". A
    // 12-hex id looks exactly like a short SHA, so the rendered comment now says
    // what it is and where its disposition lives. This is the only place a reader
    // of the comment can learn it without opening the source.
    const idNote =
        '\n\n`id` above is a FINDING id — the first 12 hex of sha256(kind|title|file), '
        + '**not a commit SHA**. Searching the git log for it finds nothing, by design. '
        + 'Its disposition is recorded in `agents/evidence/release-findings/<version>.json`.';
    // Machine-readable block (release-truth Phase 3): invisible in the rendered
    // comment; `check_finding_dispositions --pr` reads it as the TRIGGER that
    // demands committed dispositions. The comment is transport, never the
    // record — the record is `agents/evidence/release-findings/<version>.json`.
    const machine = `\n\n<!-- release-findings-json: ${JSON.stringify(
        findings.map((f) => ({ finding_id: findingId(f), severity: f.severity, kind: f.kind, title: f.title, file: f.file ?? null })),
    )} -->`;
    return `${banner}\n\n${verdictLine}\n\n| id | severity | kind | file | finding |\n|---|---|---|---|---|\n${rows}${idNote}${cov}${esc}${machine}`;
}

function postReview(body: string): void {
    const pr = process.env.PR_NUMBER;
    if (!pr) {
        process.stdout.write('::notice::self-review-gate — no PR_NUMBER; printing review instead of posting.\n');
        process.stdout.write(body + '\n');
        return;
    }
    const r = spawnSync('gh', ['pr', 'comment', pr, '--body', body], { cwd: REPO_ROOT, encoding: 'utf8' });
    if (r.status !== 0) {
        process.stdout.write(`::warning::self-review-gate — gh pr comment failed: ${(r.stderr ?? '').toString().slice(0, 300)}\n`);
        process.stdout.write(body + '\n');
    }
}

function resolveKey(): string | null {
    const env = process.env.ANTHROPIC_API_KEY;
    if (env && env.trim()) return env.trim();
    try {
        return load_anthropic_key();
    } catch {
        return null;
    }
}

// ── CLI ───────────────────────────────────────────────────────────────
export function main(argv: string[]): 0 | 2 {
    const dryRun = argv.includes('--dry-run');
    const enforce = argv.includes('--enforce');
    const baseIdx = argv.indexOf('--base');
    const baseRef = (baseIdx >= 0 ? argv[baseIdx + 1] : undefined) ?? 'origin/main';

    const plan = buildPlan(baseRef);

    if (dryRun) {
        process.stdout.write(
            `self-review-gate (dry-run — no spend, advisory):\n` +
                `  skills: ${plan.skills.join(', ')}\n` +
                (plan.release
                    ? `  mode:   release (${plan.release.version}; feature range ${plan.release.previousTag}...HEAD; ` +
                      `packaging diff ${plan.release.packagingFiles.length} file(s))\n`
                    : '') +
                `  files:  ${plan.files.length}\n` +
                `  calls:  ${plan.requests} (budget ${String(PROMPT_BUDGET_CHARS)} chars/request, ` +
                `ceiling ${String(MAX_REVIEW_CHUNKS)})\n` +
                (plan.unreviewed.length > 0
                    ? `  UNREVIEWED (${String(plan.unreviewed.length)}): ` +
                      // Capped: a real run reported 82 paths, and 82 paths on one
                      // line is not a report anybody reads. The count is the
                      // decision-relevant number; the names are a sample.
                      `${plan.unreviewed
                          .slice(0, DRY_RUN_UNREVIEWED_SAMPLE)
                          .map((u) => u.path)
                          .join(', ')}` +
                      (plan.unreviewed.length > DRY_RUN_UNREVIEWED_SAMPLE
                          ? ` … +${String(plan.unreviewed.length - DRY_RUN_UNREVIEWED_SAMPLE)} more`
                          : '') +
                      '\n' +
                      // The reason was computed and never printed, so the
                      // operator saw what WOULD be sent and never what the span
                      // needs.
                      `      reason: ${plan.unreviewed[0]?.reason ?? 'unknown'}\n`
                    : '') +
                // At the ceiling nothing is lost YET, and the next slightly
                // larger span loses its remainder silently apart from the
                // coverage line. Saying so while it is still a warning is the
                // only cheap moment: the alternative is reading it in a
                // published review's coverage block.
                // Gated on the ceiling ALONE. The first version also required
                // `unreviewed.length === 0`, which silenced the warning in the
                // states nearest to loss: once a span has one over-budget file
                // the two facts are independent, and conflating them hid the
                // warning exactly when it mattered.
                (plan.requests >= MAX_REVIEW_CHUNKS
                    ? `  ⚠️  at the per-run ceiling (${String(MAX_REVIEW_CHUNKS)}) — a larger span ` +
                      'loses its remainder\n'
                    : '') +
                `  ${plan.note}\n` +
                (plan.escalation.length
                    ? `  escalation: ${plan.escalation.join('; ')} → recommend /council:pr (run-time authorized)\n`
                    : `  escalation: none (diff is small and not claim-affecting)\n`),
        );
        return 0;
    }

    if (plan.files.length === 0) {
        process.stdout.write('::notice::self-review-gate — no reviewable files changed; skipping.\n');
        return 0;
    }

    const key = resolveKey();
    if (!key) {
        // Explicit NEUTRAL state — never a bare green that reads as "reviewed".
        process.stdout.write(
            '::warning::self-review-gate NEUTRAL — no ANTHROPIC_API_KEY configured, NOTHING was reviewed. ' +
                'Set the repo secret to enable the live dogfooded review.\n',
        );
        const summary = process.env.GITHUB_STEP_SUMMARY;
        if (summary) {
            appendFileSync(
                summary,
                '### Self-review gate: NEUTRAL\n\nNo `ANTHROPIC_API_KEY` secret — nothing was reviewed. This is not a pass.\n',
            );
        }
        return 0;
    }

    // Belt-and-suspenders: the WHOLE live path is wrapped so that ANYTHING going
    // wrong — no API credit / balance (HTTP 402), rate-limit (429), network error,
    // a client-ctor throw, a parse failure — resolves to a NEUTRAL exit 0, never a
    // red CI. A missing key or no-credit must never become a merge blocker; the
    // gate is advisory by design. (Only an --enforce run with real blocking
    // findings returns 2 — an error is not a finding.)
    try {
        const client = new AnthropicClient({ api_key: key });
        const systemPrompt = buildSystemPrompt(plan.release, baseRef);
        const partition = plan.partition;

        if (partition.chunks.length === 0) {
            // Reviewing nothing while saying nothing is the state four releases
            // were already in, so this reports NEUTRAL with the reason. The
            // reason is DERIVED rather than asserted: the first version said
            // "every changed file exceeds the per-request budget", which is one
            // of several ways to get here and was simply wrong for the others
            // (an empty per-file diff, for instance).
            const why =
                partition.unreviewed.length > 0
                    ? `${String(partition.unreviewed.length)} path(s) could not be placed in a ` +
                      `request: ${partition.unreviewed[0]?.reason ?? 'unknown'}`
                    : 'no file produced a diff to review';
            process.stdout.write(
                `::warning::self-review-gate NEUTRAL — ${why}; nothing was reviewed, not a ` +
                    'blocker.\n',
            );
            return 0;
        }

        // One request per chunk, findings merged. A chunk that fails does NOT
        // discard the chunks that succeeded: four releases produced no review at
        // all because one failure was the whole review, and a partial review
        // that names its coverage is worth more than another honest null.
        const findings: Finding[] = [];
        const unreviewed = [...partition.unreviewed];
        let reviewedChunks = 0;
        let filesRead = 0;
        for (const [i, chunk] of partition.chunks.entries()) {
            const resp = client.ask(systemPrompt, chunk.text, 4096);
            if (resp.error) {
                process.stdout.write(
                    `::warning::self-review-gate — chunk ${String(i + 1)}/` +
                        `${String(partition.chunks.length)} did not complete (${resp.error}); ` +
                        'continuing with the remaining chunks.\n',
                );
                // The chunk's OWN files, not a synthetic entry: a failed chunk
                // used to be recorded as one unnamed row while the coverage
                // count still credited all its files as read.
                for (const path of chunk.files) {
                    unreviewed.push({
                        path,
                        reason: `the model call for this file's chunk did not complete: ${resp.error}`,
                    });
                }
                continue;
            }
            reviewedChunks += 1;
            filesRead += chunk.files.length;
            findings.push(...parseFindings(resp.text));
        }

        if (reviewedChunks === 0) {
            process.stdout.write(
                '::warning::self-review-gate NEUTRAL — no chunk completed, nothing was reviewed, ' +
                    'not a blocker.\n',
            );
            return 0;
        }

        // Counted from the chunks that actually returned, never derived by
        // subtracting rows from the file total. The subtraction was wrong in
        // both of this change's own new states: one aggregate row for N dropped
        // chunks credited N-1 unread files as read, and per-chunk failures were
        // appended AFTER the number was computed.
        const coverage: ReviewCoverage = {
            chunks: reviewedChunks,
            filesReviewed: filesRead,
            filesTotal: plan.files.length,
            unreviewed,
        };
        const outIdx = argv.indexOf('--findings-out');
        if (outIdx >= 0 && argv[outIdx + 1]) {
            // Durable ingestion input for the disposition ledger (release-truth
            // Phase 3): `check_finding_dispositions --ingest <this file>`.
            // The independence fields are set HERE, at write time, from the
            // actual reviewer set — which for this gate is one Anthropic client,
            // so the artifact declares itself single-member and provisional. It
            // previously said nothing, and silence read as acceptance.
            writeFileSync(
                argv[outIdx + 1]!,
                JSON.stringify(
                    {
                        schema_version: 1,
                        ...independenceFields(['anthropic']),
                        coverage,
                        findings: dedupeFindings(findings).map((f) => ({
                            finding_id: findingId(f),
                            ...f,
                        })),
                    },
                    null,
                    2,
                ) + '\n',
            );
        }
        const body = renderReview(dedupeFindings(findings), enforce, plan.escalation, coverage);
        postReview(body);

        const code = gateVerdict(dedupeFindings(findings), { enforce });
        if (code === 2) {
            process.stdout.write('::error::self-review-gate — merge-blocking findings under enforce mode.\n');
        }
        return code;
    } catch (e) {
        process.stdout.write(
            `::warning::self-review-gate NEUTRAL — unexpected error (${e instanceof Error ? e.message : String(e)}); ` +
                'nothing was reviewed, not a blocker.\n',
        );
        return 0;
    }
}

if (existsSync(process.argv[1] ?? '') && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main(process.argv.slice(2)));
}
