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
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AnthropicClient, load_anthropic_key } from './ai_council/clients.js';

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
    const r = spawnSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
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
/**
 * A release PR is detected from its own packaging diff (baseRef...HEAD,
 * scoped to CHANGELOG.md + package.json): an added changelog heading and an
 * added package.json version bump, agreeing on the same version. Pure over
 * the patch text — no git call — so it is unit-testable with synthetic
 * patches. See docs/design/release-pr-review-mode.md.
 */
export function detectReleaseVersion(patchText: string): string | null {
    const addedLines = patchText
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
        .map((l) => l.slice(1));

    let changelogVersion: string | null = null;
    let packageVersion: string | null = null;
    for (const line of addedLines) {
        const changelogMatch = /^##\s*\[(\d+\.\d+\.\d+)\]/.exec(line);
        if (changelogMatch) changelogVersion = changelogMatch[1] ?? null;
        const packageMatch = /^\s*"version"\s*:\s*"(\d+\.\d+\.\d+)"/.exec(line);
        if (packageMatch) packageVersion = packageMatch[1] ?? null;
    }
    if (changelogVersion && packageVersion && changelogVersion === packageVersion) {
        return changelogVersion;
    }
    return null;
}

function releaseDetectionPatch(baseRef: string, cwd: string): string {
    const r = spawnSync('git', ['diff', `${baseRef}...HEAD`, '--', 'CHANGELOG.md', 'package.json'], {
        cwd,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
    });
    return (r.stdout ?? '').toString();
}

/** Impure wrapper: collects the packaging patch via git, then detects. */
export function detectReleaseVersionFromGit(baseRef: string, cwd: string = REPO_ROOT): string | null {
    return detectReleaseVersion(releaseDetectionPatch(baseRef, cwd));
}

/** `major.minor.patch`, tolerating an optional `v` prefix; null if not semver-shaped. */
function parseSemver(raw: string): [number, number, number] | null {
    const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(raw.trim());
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function semverLessThan(a: [number, number, number], b: [number, number, number]): boolean {
    const [aMajor, aMinor, aPatch] = a;
    const [bMajor, bMinor, bPatch] = b;
    if (aMajor !== bMajor) return aMajor < bMajor;
    if (aMinor !== bMinor) return aMinor < bMinor;
    return aPatch < bPatch;
}

/**
 * Highest semver-shaped tag strictly below `version`, or null if none. Pure
 * over the supplied tag list — no git call. Non-semver tags (branch-backup
 * names etc.) are ignored rather than throwing.
 */
export function pickPreviousTag(version: string, tags: readonly string[]): string | null {
    const target = parseSemver(version);
    if (!target) return null;
    let best: { raw: string; parsed: [number, number, number] } | null = null;
    for (const raw of tags) {
        const parsed = parseSemver(raw);
        if (!parsed) continue;
        if (!semverLessThan(parsed, target)) continue;
        if (!best || semverLessThan(best.parsed, parsed)) best = { raw, parsed };
    }
    return best ? best.raw : null;
}

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

// ── Plan (dry-run) ────────────────────────────────────────────────────
export interface ReviewPlan {
    skills: string[];
    files: string[];
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
    return {
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
                      (systemPrompt.length + diff.length) / 4,
                  )} input tokens.`,
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

export function renderReview(findings: Finding[], enforce: boolean, escalation: readonly string[] = []): string {
    const banner =
        '> HUMAN REVIEW REQUIRED — dogfooded AI adversarial-review + security gate. ' +
        'Findings are decision support, not a guarantee; detection is probabilistic. ' +
        'This is a floor, **not** independent human review.';
    const esc = escalationBlock(escalation);
    if (findings.length === 0) {
        return `${banner}\n\n✅ Self-review gate: no findings.${esc}`;
    }
    const blocking = findings.filter(classifyBlocking);
    // Each row carries an explicit (Blocking)/(Advisory) marker so a
    // critical-but-non-blocking finding (e.g. critical × correctness) can never
    // read as inconsistent with the narrow `blocking.length` verdict count.
    const rows = findings
        .map((f) => {
            const marker = classifyBlocking(f) ? 'Blocking' : 'Advisory';
            return `| ${f.severity} (${marker}) | ${f.kind} | ${f.file ?? '—'} | ${f.title} |`;
        })
        .join('\n');
    const verdictLine = blocking.length
        ? enforce
            ? `❌ ${blocking.length} merge-blocking finding(s) (security/claim × high+).`
            : `⚠️ ${blocking.length} finding(s) WOULD block merge under an enforced gate (advisory now).`
        : '✅ No merge-blocking findings (style/correctness advise only).';
    return `${banner}\n\n${verdictLine}\n\n| severity | kind | file | finding |\n|---|---|---|---|\n${rows}${esc}`;
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
        const resp = client.ask(buildSystemPrompt(plan.release, baseRef), diffText(plan.analysisBase, plan.files), 4096);
        if (resp.error) {
            process.stdout.write(
                `::warning::self-review-gate NEUTRAL — model call did not complete (${resp.error}); ` +
                    'nothing was reviewed, not a blocker.\n',
            );
            return 0; // no credit / transport / API error → never blocks the merge
        }
        const findings = parseFindings(resp.text);
        const body = renderReview(findings, enforce, plan.escalation);
        postReview(body);

        const code = gateVerdict(findings, { enforce });
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
