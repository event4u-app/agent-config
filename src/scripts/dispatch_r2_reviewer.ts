#!/usr/bin/env tsx
/**
 * Gate R2 reviewer dispatcher — deterministic assembler for the fresh-subagent
 * completion review (docs/contracts/plan-review-gates.md §5, verdict #18).
 *
 * The Phase-1 reviewer is a FRESH subagent without the implementation
 * context; its input is never assembled by the implementing agent. This
 * script IS that deterministic dispatcher: it computes the branch diff,
 * extracts the roadmap's Acceptance Criteria block, hashes every input,
 * writes the reviewer input package (`<out-dir>/<slug>.review-input/`) and
 * the findings-artifact skeleton (`<out-dir>/<slug>.findings.md`) carrying
 * the verifiable context manifest. It calls NO LLM itself — the host agent
 * dispatches a fresh subagent (/judge:on-diff machinery) at the package.
 *
 * Modes:
 *   dispatch (default) — assemble package + skeleton.
 *   --verify <findings-file> — re-derive the manifest hashes from the
 *     CURRENT repo state and compare against the recorded inputs.
 *   --verify-current — compute the current review scope, SELECT the artefacts
 *     relevant to it (contract §2.6), and `--verify` each. The selection lives
 *     here rather than in a caller's shell loop on purpose: `agents/evidence/
 *     reviews/` is tracked and accumulates (§2.6), so "verify every
 *     `*.findings.md`" mismatches every foreign artefact by construction and
 *     would red the next gated PR — directory-wide poisoning. Selecting by
 *     grepping the header for `HEAD` is equally wrong (§2.0 proves it matches
 *     nothing), so the only correct selector re-derives the scope hash, which
 *     is exactly what this mode does.
 *
 * This is a dispatcher, not a gate — it emits no `scanned:` line and is not
 * registered in gate-coverage.yml.
 *
 * It also OWNS the review-scope hash (contract §2.1): the single definition of
 * what a completion review is bound to. `check_completion_review` imports it
 * rather than restating it — a divergence between the two would silently
 * re-break the gate.
 *
 * Exit codes: 0 = ok / manifest verified, 1 = policy violation (empty diff,
 * refuse-overwrite, missing manifest, manifest mismatch), 2 = internal error
 * (bad ref, unreadable file, crash).
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// `--verify-current` reuses the validator's §2.6 relevance notion instead of
// restating it (a restated copy is what re-breaks these gates — see the
// single-definition rule for the scope hash below). The resulting import cycle
// (validator → dispatcher for the scope hash, dispatcher → validator for
// relevance) is safe: neither module calls the other at module-evaluation
// time, and each CLI entry guard only fires for its own argv[1].
import { completionReviewDisabled } from './_lib/planning_settings.js';
import { artifactRelevance } from './check_completion_review.js';

export interface ManifestInputs {
    diffSha: string; // provenance only — never compared
    scopeHash: string;
    roadmap: string; // path, or 'none'
    roadmapHash: string; // sha256, or 'none'
    acHash: string; // sha256, or 'none'
    dispatched: string; // ISO YYYY-MM-DDTHH:MM:SSZ
}

export interface ExpectedHashes {
    scope_hash: string;
    roadmap_hash: string;
    ac_hash: string;
}

export interface ParsedManifest {
    diff_sha: string;
    scope_hash: string;
    roadmap: string;
    roadmap_hash: string;
    ac_hash: string;
    dispatched: string;
}

export function sha256(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Review scope — the single source of the R2 binding (contract §2.1)
// ---------------------------------------------------------------------------

/**
 * The review artefacts are excluded from the reviewed scope on purpose.
 *
 * A completion review is bound to the CONTENT it reviewed, never to a commit:
 * §2.5 requires the findings artifact to be committed, and CI only ever sees
 * committed state — so a head-sha binding is unsatisfiable by construction
 * (committing the artifact moves HEAD past the recorded sha, and on
 * `pull_request` the checkout is a synthetic merge commit whose sha no
 * dispatcher could have recorded). Excluding `agents/evidence/reviews` means
 * writing, editing, or committing the findings artifact cannot change the
 * scope hash, and `base...HEAD` yields the same net diff on a branch head and
 * on a merge commit of that branch.
 *
 * `agents/evidence/metrics` is excluded for the SAME reason, not as tidiness:
 * contract §7 mandates appending the R2 outcome event (`r2_review` /
 * `r2_honest_null` / `r2_skip`) to the tracked
 * `agents/evidence/metrics/gate-metrics.jsonl`. Committing that mandated event
 * would otherwise change the scope hash and turn the very artifact that just
 * recorded the review into a `stale-review` block — the self-invalidation class
 * §2.0 exists to eliminate, re-entering through a sibling path. Any future
 * gate-owned evidence path that the gate itself writes belongs in this list.
 */
export const REVIEW_SCOPE_EXCLUDES: readonly string[] = [
    ':(exclude,top)agents/evidence/reviews',
    ':(exclude,top)agents/evidence/metrics',
];

/** Back-compat single-pathspec alias (the reviews exclusion). */
export const REVIEW_SCOPE_EXCLUDE = REVIEW_SCOPE_EXCLUDES[0] as string;

/** `git diff` argv for the review scope (patch body). */
export function reviewScopeDiffArgs(base: string): string[] {
    return ['diff', `${base}...HEAD`, '--', ':/', ...REVIEW_SCOPE_EXCLUDES];
}

/** `git diff --name-only` argv for the review scope (changed-file list). */
export function reviewScopeNameOnlyArgs(base: string): string[] {
    return ['diff', '--name-only', `${base}...HEAD`, '--', ':/', ...REVIEW_SCOPE_EXCLUDES];
}

/**
 * The artefact directory MUST live under an excluded path (§2.0).
 *
 * The exclusion list is static while the artefact location is a CLI parameter
 * (`--out-dir` / `--artifact-dir`). A directory outside the exclusions puts the
 * findings artifact back inside the reviewed scope, so committing it — which
 * §2.5 requires — invalidates the review it records. That failure is silent, so
 * it is refused loudly here instead: a policy violation, not a warning.
 *
 * Returns an error message, or `null` when the directory is safe.
 */
export function scopeExclusionViolation(artifactDirRel: string): string | null {
    const norm = artifactDirRel.split(path.sep).join('/').replace(/^\.\//, '').replace(/\/+$/, '');
    if (path.isAbsolute(norm)) {
        return (
            `❌  --out-dir / --artifact-dir must be repo-relative, got absolute '${artifactDirRel}'.\n` +
            '    The review scope excludes repo-relative pathspecs only (contract §2.0).\n'
        );
    }
    const roots = REVIEW_SCOPE_EXCLUDES.map((s) => s.replace(/^:\(exclude,top\)/, ''));
    const covered = roots.some((r) => norm === r || norm.startsWith(`${r}/`));
    if (covered) {
        return null;
    }
    return (
        `❌  artefact directory '${artifactDirRel}' is not excluded from the review scope.\n` +
        `    Committing a findings artifact there would change the scope hash and invalidate\n` +
        `    the review it records (contract §2.0). Excluded roots: ${roots.join(', ')}.\n`
    );
}

/** A review scope with no reviewable content — the only state `scope none` covers. */
export function isEmptyScope(scopeDiffText: string): boolean {
    return scopeDiffText.trim() === '';
}

export type GitRunner = (args: readonly string[]) => string;

export interface ReviewScope {
    /** The review-scope diff body handed to the reviewer. */
    diffText: string;
    /** sha256 of `diffText` — the token the review binds to. */
    hash: string;
    /** Nothing reviewable in scope — the only state a `scope none` skip covers. */
    empty: boolean;
}

/**
 * Resolve the review scope in ONE git call. Both the dispatcher and the
 * validator go through this function, injecting their own git wrapper (they
 * differ only in error handling), so the definition of "what a review is bound
 * to" exists exactly once.
 */
export function computeReviewScope(runGit: GitRunner, base: string): ReviewScope {
    const diffText = runGit(reviewScopeDiffArgs(base));
    return { diffText, hash: sha256(diffText), empty: isEmptyScope(diffText) };
}

/** Manifest comment block — exactly the contract §5 shape. */
export function deriveManifest(inputs: ManifestInputs): string {
    return [
        '<!-- context-manifest: v1',
        'inputs:',
        `  diff_sha: ${inputs.diffSha}`,
        `  scope_hash: ${inputs.scopeHash}`,
        `  roadmap: ${inputs.roadmap}`,
        `  roadmap_hash: ${inputs.roadmapHash}`,
        `  ac_hash: ${inputs.acHash}`,
        'excluded: [session-history, agents/runtime, implementation-context]',
        'tools: [git-diff-branch-scoped, file-read-branch-paths]',
        `dispatched: ${inputs.dispatched}`,
        '-->',
    ].join('\n');
}

/**
 * Pure hash derivation — CI re-derivation imports this to verify a submitted
 * artifact's manifest. `null` roadmap/AC text means "not provided" → 'none'.
 * `scopeDiffText` is the REVIEW-SCOPE diff body (see {@link reviewScopeDiffArgs}),
 * never the raw `base...HEAD` diff — the raw diff includes the findings artifact
 * itself and is therefore unverifiable once that artifact is committed.
 */
export function expectedHashes(args: {
    scopeDiffText: string;
    roadmapText?: string | null;
    acText?: string | null;
}): ExpectedHashes {
    return {
        scope_hash: sha256(args.scopeDiffText),
        roadmap_hash: args.roadmapText == null ? 'none' : sha256(args.roadmapText),
        ac_hash: args.acText == null ? 'none' : sha256(args.acText),
    };
}

/**
 * Extract the `## Acceptance Criteria` section — from that heading (inclusive)
 * to the next `## ` heading or EOF. No section → empty string.
 */
export function extractAcceptanceCriteria(roadmapText: string): string {
    const lines = roadmapText.split('\n');
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
        if (/^## Acceptance Criteria\s*$/.test(lines[i] as string)) {
            start = i;
            break;
        }
    }
    if (start === -1) return '';
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
        if (/^## /.test(lines[i] as string)) {
            end = i;
            break;
        }
    }
    return lines.slice(start, end).join('\n');
}

/** Parse the context-manifest comment block out of a findings artifact. */
export function parseManifest(text: string): ParsedManifest | null {
    const re = new RegExp(
        '<!-- context-manifest: v1\\n' +
            'inputs:\\n' +
            '  diff_sha: (.+)\\n' +
            '  scope_hash: (.+)\\n' +
            '  roadmap: (.+)\\n' +
            '  roadmap_hash: (.+)\\n' +
            '  ac_hash: (.+)\\n' +
            'excluded: \\[session-history, agents/runtime, implementation-context\\]\\n' +
            'tools: \\[git-diff-branch-scoped, file-read-branch-paths\\]\\n' +
            'dispatched: (.+)\\n' +
            '-->',
    );
    const m = re.exec(text);
    if (!m) return null;
    return {
        diff_sha: m[1] as string,
        scope_hash: m[2] as string,
        roadmap: m[3] as string,
        roadmap_hash: m[4] as string,
        ac_hash: m[5] as string,
        dispatched: m[6] as string,
    };
}

export function sanitizeSlug(raw: string): string {
    const s = raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return s || 'review';
}

function git(repo: string, ...args: string[]): string {
    return execFileSync('git', args, {
        cwd: repo,
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
}

/**
 * CI-provided head-branch names, most specific first. `GITHUB_HEAD_REF` is set
 * only on `pull_request` and IS the head branch; `GITHUB_REF_NAME` covers
 * `push`.
 */
const CI_BRANCH_ENV_KEYS = ['GITHUB_HEAD_REF', 'GITHUB_REF_NAME'] as const;

/**
 * Branch-derived artifact slug. Shared with `check_completion_review`, which
 * uses it to decide whether a leftover artifact in the reviews directory is
 * THIS branch's (and may therefore produce violations) or a foreign one.
 *
 * The CI environment is consulted FIRST because on a `pull_request` checkout
 * `HEAD` is a detached synthetic merge commit: `rev-parse --abbrev-ref HEAD`
 * yields `HEAD`, the slug degrades to `detached-<sha>`, and no artefact can
 * ever be "own" — which inverts contract §2.6 on the layer the contract calls
 * authoritative (an own malformed artefact would be reported as
 * `missing-artifact` instead of the root-cause `bad-marker`, and `stale-review`
 * would never fire in CI). A `HEAD` / `detached-*` env value carries no branch
 * identity either and is ignored.
 */
export function deriveSlug(runGit: GitRunner, env: NodeJS.ProcessEnv = process.env): string {
    for (const key of CI_BRANCH_ENV_KEYS) {
        const value = (env[key] ?? '').trim();
        if (value !== '' && value !== 'HEAD' && !/^detached-/i.test(value)) {
            return sanitizeSlug(value);
        }
    }
    const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    if (branch === '' || branch === 'HEAD') {
        const short = runGit(['rev-parse', '--short', 'HEAD']).trim();
        return sanitizeSlug(`detached-${short}`);
    }
    return sanitizeSlug(branch);
}

function deriveSlugFromBranch(repo: string): string {
    return deriveSlug((a) => git(repo, ...a));
}

/** ISO timestamp at seconds precision (YYYY-MM-DDTHH:MM:SSZ). */
function isoSeconds(d: Date): string {
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function reviewerPrompt(args: {
    slug: string;
    headSha: string;
    scopeHash: string;
    roadmapGiven: boolean;
    changedFiles: readonly string[];
}): string {
    const roadmapLine = args.roadmapGiven
        ? '- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)'
        : '- roadmap under review: none (`acceptance-criteria.md` is empty)';
    return [
        `# R2 completion review — ${args.slug}`,
        '',
        'You are a FRESH reviewer subagent. You have no implementation context and',
        'you must not acquire any (blind-review pattern, plan-review-gates.md §5).',
        '',
        '## Review mode',
        '',
        'Senior-engineer review of the branch diff. Search grid — hunt for:',
        '',
        '- errors',
        '- inconsistent logic',
        '- inefficiencies',
        '- bug-producing patterns',
        '',
        '## Rules',
        '',
        '- Review only — write no code, fix nothing.',
        '- Tool allowlist (contract §5): branch-scoped `git diff` + reads of',
        '  branch-touched files only; no `git log` beyond the branch, no repo-wide',
        '  grep, no reads of `agents/runtime/` or session artifacts.',
        '',
        '## Inputs',
        '',
        `- diff: \`diff.patch\` — the review scope (branch head ${args.headSha}, review`,
        `  artefacts excluded), scope hash \`${args.scopeHash}\``,
        roadmapLine,
        '',
        'Changed files:',
        '',
        ...args.changedFiles.map((f) => `- ${f}`),
        '',
        '## Output format (contract §2.2)',
        '',
        `Fill the findings table in \`${args.slug}.findings.md\`:`,
        '',
        '```markdown',
        '| # | Severity | File:Line | Finding | Status | Reason/Ref |',
        '|---|----------|-----------|---------|--------|------------|',
        '| 1 | critical | src/x.ts:42 | ... | open | |',
        '```',
        '',
        '- Severity ∈ {`critical`, `high`, `medium`, `low`}, rows sorted descending',
        '  by severity (ties keep authoring order).',
        '- Initial status of every finding: `open`.',
        '- 0 findings → replace the table with exactly this honest-null line',
        '  (contract §2.3):',
        '',
        '```markdown',
        `**Honest-null:** 0 findings, scope ${args.scopeHash}, reviewed <YYYY-MM-DD>`,
        '```',
        '',
    ].join('\n');
}

function findingsSkeleton(args: {
    slug: string;
    headSha: string;
    scopeHash: string;
    reviewedDate: string;
    manifest: string;
}): string {
    return [
        `# Findings: ${args.slug}`,
        `<!-- completion-review: v1 | reviewed: ${args.reviewedDate} | scope: ${args.scopeHash} | diff: ${args.headSha} | reviewer: r2-fresh-subagent-${args.slug} -->`,
        '',
        args.manifest,
        '',
        '| # | Severity | File:Line | Finding | Status | Reason/Ref |',
        '|---|----------|-----------|---------|--------|------------|',
        '<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 -->',
        '',
    ].join('\n');
}

interface Args {
    base: string;
    roadmap: string | null;
    slug: string | null;
    outDir: string;
    repo: string;
    printPrompt: boolean;
    format: 'text' | 'json';
    force: boolean;
    now: string | null;
    verify: string | null;
    verifyCurrent: boolean;
    /** `--verify-current` scan root; falls back to `--out-dir`. */
    artifactDir: string | null;
}

function parse_args(argv: readonly string[]): Args {
    const args: Args = {
        base: 'origin/main',
        roadmap: null,
        slug: null,
        outDir: 'agents/evidence/reviews',
        repo: '.',
        printPrompt: false,
        format: 'text',
        force: false,
        now: null,
        verify: null,
        verifyCurrent: false,
        artifactDir: null,
    };
    const takeValue = (flag: string, v: string | undefined): string => {
        if (v === undefined) {
            process.stderr.write(`dispatch_r2_reviewer: error: argument ${flag}: expected a value\n`);
            process.exit(2);
        }
        return v;
    };
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] as string;
        if (arg === '--base') {
            args.base = takeValue(arg, argv[++i]);
        } else if (arg === '--roadmap') {
            args.roadmap = takeValue(arg, argv[++i]);
        } else if (arg === '--slug') {
            args.slug = takeValue(arg, argv[++i]);
        } else if (arg === '--out-dir') {
            args.outDir = takeValue(arg, argv[++i]);
        } else if (arg === '--repo') {
            args.repo = takeValue(arg, argv[++i]);
        } else if (arg === '--now') {
            args.now = takeValue(arg, argv[++i]);
        } else if (arg === '--verify') {
            args.verify = takeValue(arg, argv[++i]);
        } else if (arg === '--verify-current') {
            args.verifyCurrent = true;
        } else if (arg === '--artifact-dir') {
            args.artifactDir = takeValue(arg, argv[++i]);
        } else if (arg === '--print-prompt') {
            args.printPrompt = true;
        } else if (arg === '--force') {
            args.force = true;
        } else if (arg === '--format') {
            const v = takeValue(arg, argv[++i]);
            if (v !== 'text' && v !== 'json') {
                process.stderr.write(
                    `dispatch_r2_reviewer: error: argument --format: invalid choice: '${v}' (choose from 'text', 'json')\n`,
                );
                process.exit(2);
            }
            args.format = v;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: dispatch_r2_reviewer [-h] [--base REF] [--roadmap PATH] [--slug SLUG]\n' +
                    '                            [--out-dir PATH] [--repo PATH] [--print-prompt]\n' +
                    '                            [--format {text,json}] [--force] [--now ISO]\n' +
                    '                            [--verify FINDINGS_FILE]\n' +
                    '                            [--verify-current [--artifact-dir DIR]]\n',
            );
            process.exit(0);
        } else {
            process.stderr.write(`dispatch_r2_reviewer: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        }
        i++;
    }
    return args;
}

function resolveNow(nowArg: string | null): Date {
    if (nowArg === null) return new Date();
    const d = new Date(nowArg);
    if (Number.isNaN(d.getTime())) {
        throw new Error(`--now: invalid ISO timestamp '${nowArg}'`);
    }
    return d;
}

function runVerify(args: Args, findingsPath: string = args.verify as string): number {
    if (completionReviewDisabled(args.repo)) {
        process.stdout.write('⚠️  planning.completion_review=false — R2 manifest verification skipped (settings escape hatch)\n');
        return 0;
    }
    if (!fs.existsSync(findingsPath)) {
        process.stderr.write(`❌  Internal error: findings file not found: ${findingsPath}\n`);
        return 2;
    }
    const manifest = parseManifest(fs.readFileSync(findingsPath, 'utf-8'));
    if (manifest === null) {
        // POLICY, not internal error (contract §5): a manifest is mandatory —
        // "verification, not self-attestation". Exiting 2 here would let every
        // caller warn-and-allow, so omitting the manifest would bypass the
        // whole verification layer.
        process.stderr.write(
            `❌  Policy violation: no context-manifest block found in ${findingsPath} — ` +
                'the §5 manifest is mandatory; a findings artifact without one is unverifiable.\n',
        );
        return 1;
    }

    const scopeDiffText = computeReviewScope((a) => git(args.repo, ...a), args.base).diffText;
    let roadmapText: string | null = null;
    let acText: string | null = null;
    let roadmapMissing = false;
    if (manifest.roadmap !== 'none') {
        const roadmapPath = path.resolve(args.repo, manifest.roadmap);
        if (fs.existsSync(roadmapPath)) {
            roadmapText = fs.readFileSync(roadmapPath, 'utf-8');
            acText = extractAcceptanceCriteria(roadmapText);
        } else {
            roadmapMissing = true;
        }
    }
    const expected = expectedHashes({ scopeDiffText, roadmapText, acText });

    const diverged: string[] = [];
    const check = (name: string, recorded: string, actual: string): void => {
        if (recorded !== actual) {
            diverged.push(name);
            process.stderr.write(`  ${name}: recorded ${recorded} ≠ current ${actual}\n`);
        }
    };
    // `diff_sha` is provenance only and is NEVER compared: committing the
    // artifact (§2.5) and CI's synthetic merge-commit checkout both move HEAD
    // off the recorded sha. Content is what binds.
    check('scope_hash', manifest.scope_hash, expected.scope_hash);
    if (roadmapMissing) {
        diverged.push('roadmap_hash');
        process.stderr.write(`  roadmap_hash: recorded ${manifest.roadmap_hash} but roadmap file ${manifest.roadmap} is missing\n`);
    } else {
        check('roadmap_hash', manifest.roadmap_hash, expected.roadmap_hash);
        check('ac_hash', manifest.ac_hash, expected.ac_hash);
    }

    if (diverged.length) {
        process.stderr.write(`❌  manifest mismatch (stale review): ${diverged.join(', ')} diverged\n`);
        return 1;
    }
    process.stdout.write('✅ manifest verified\n');
    return 0;
}

/**
 * `--verify-current`: re-derive the manifest of every artefact RELEVANT to the
 * current review scope.
 *
 * Selection is the whole point of the mode (see the header note). Three
 * deliberate behaviours:
 *
 *   - **Foreign artefacts are never verified.** `agents/evidence/reviews/` is
 *     tracked and accumulates (§2.6), and every past branch's artefact records
 *     a different `scope_hash`, so a verify-everything loop reds by
 *     construction and can only be un-stuck by editing an unrelated branch's
 *     artefact.
 *   - **No relevant artefact → exit 0.** Whether an artefact is *required* is
 *     `check_completion_review`'s question (it reports `missing-artifact` /
 *     `dead-scan-scope`); a re-derivation step has nothing to re-derive and
 *     must not double-report it.
 *   - **A bare §2.4 skip declaration is not verified.** It carries no reviewer
 *     dispatch and per §5 needs no manifest, so running the manifest check on
 *     it would report a policy violation the contract explicitly excludes.
 */
function runVerifyCurrent(args: Args): number {
    if (completionReviewDisabled(args.repo)) {
        process.stdout.write('⚠️  planning.completion_review=false — R2 manifest re-derivation skipped (settings escape hatch)\n');
        return 0;
    }
    const artifactDirRel = args.artifactDir ?? args.outDir;
    const excludeViolation = scopeExclusionViolation(artifactDirRel);
    if (excludeViolation !== null) {
        process.stderr.write(excludeViolation);
        return 1;
    }
    const dirAbs = path.resolve(args.repo, artifactDirRel);
    const scope = computeReviewScope((a) => git(args.repo, ...a), args.base);

    let names: string[] = [];
    try {
        names = fs
            .readdirSync(dirAbs)
            .filter((n) => n.endsWith('.findings.md'))
            .sort();
    } catch {
        // Absent root — a repo with no review corpus yet. Coverage (including a
        // MOVED root) is check_completion_review's dead-scope assertion, not
        // this step's; re-deriving nothing is exit 0.
        names = [];
    }

    const selected: string[] = [];
    for (const name of names) {
        const abs = path.join(dirAbs, name);
        let text: string;
        try {
            text = fs.readFileSync(abs, 'utf-8');
        } catch (exc) {
            process.stderr.write(
                `❌  Internal error: unreadable artefact ${abs}: ${exc instanceof Error ? exc.message : String(exc)}\n`,
            );
            return 2;
        }
        const rel = artifactRelevance(text, scope.hash, scope.empty);
        if (rel.relevant && rel.carriesReview) {
            selected.push(abs);
        }
    }

    if (selected.length === 0) {
        process.stdout.write(
            `✅ no review-bearing artefact claims the current review scope ${scope.hash} — nothing to re-derive.\n`,
        );
        return 0;
    }

    let mismatched = 0;
    for (const abs of selected) {
        process.stdout.write(`— ${path.relative(path.resolve(args.repo), abs)}\n`);
        const rc = runVerify(args, abs);
        if (rc === 2) {
            return 2;
        }
        if (rc !== 0) {
            mismatched += 1;
        }
    }
    if (mismatched > 0) {
        process.stderr.write(
            `❌  ${mismatched} of ${selected.length} relevant artefact(s) failed manifest re-derivation\n`,
        );
        return 1;
    }
    process.stdout.write(`✅ ${selected.length} relevant artefact(s) verified against the current scope\n`);
    return 0;
}

function runDispatch(args: Args): number {
    const now = resolveNow(args.now);
    const dispatched = isoSeconds(now);
    const reviewedDate = dispatched.slice(0, 10);

    const headSha = git(args.repo, 'rev-parse', 'HEAD').trim();
    const scope = computeReviewScope((a) => git(args.repo, ...a), args.base);
    const scopeDiffText = scope.diffText;
    if (scope.empty) {
        process.stderr.write(`❌  Empty diff (${args.base}...HEAD) — nothing to review.\n`);
        return 1;
    }
    const changedFiles = git(args.repo, ...reviewScopeNameOnlyArgs(args.base))
        .split('\n')
        .filter((l) => l.trim() !== '');

    const slug = args.slug !== null ? sanitizeSlug(args.slug) : deriveSlugFromBranch(args.repo);

    let roadmapText: string | null = null;
    let acText: string | null = null;
    if (args.roadmap !== null) {
        roadmapText = fs.readFileSync(path.resolve(args.repo, args.roadmap), 'utf-8');
        acText = extractAcceptanceCriteria(roadmapText);
    }
    const hashes = expectedHashes({ scopeDiffText, roadmapText, acText });

    const outDirViolation = scopeExclusionViolation(args.outDir);
    if (outDirViolation !== null) {
        process.stderr.write(outDirViolation);
        return 1;
    }

    const outDirAbs = path.resolve(args.repo, args.outDir);
    const inputDirAbs = path.join(outDirAbs, `${slug}.review-input`);
    const findingsAbs = path.join(outDirAbs, `${slug}.findings.md`);
    if (fs.existsSync(findingsAbs) && !args.force) {
        process.stderr.write(`❌  Refusing to overwrite existing findings artifact: ${findingsAbs} (use --force)\n`);
        return 1;
    }

    const promptText = reviewerPrompt({
        slug,
        headSha,
        scopeHash: hashes.scope_hash,
        roadmapGiven: roadmapText !== null,
        changedFiles,
    });
    const manifest = deriveManifest({
        diffSha: headSha,
        scopeHash: hashes.scope_hash,
        roadmap: args.roadmap ?? 'none',
        roadmapHash: hashes.roadmap_hash,
        acHash: hashes.ac_hash,
        dispatched,
    });
    const skeleton = findingsSkeleton({ slug, headSha, scopeHash: hashes.scope_hash, reviewedDate, manifest });

    fs.mkdirSync(inputDirAbs, { recursive: true });
    fs.writeFileSync(path.join(inputDirAbs, 'diff.patch'), scopeDiffText, 'utf-8');
    if (roadmapText !== null) {
        fs.writeFileSync(path.join(inputDirAbs, 'roadmap.md'), roadmapText, 'utf-8');
    }
    fs.writeFileSync(path.join(inputDirAbs, 'acceptance-criteria.md'), acText ?? '', 'utf-8');
    fs.writeFileSync(path.join(inputDirAbs, 'prompt.md'), promptText, 'utf-8');
    fs.writeFileSync(findingsAbs, skeleton, 'utf-8');

    const inputDirRel = path.join(args.outDir, `${slug}.review-input`);
    const findingsRel = path.join(args.outDir, `${slug}.findings.md`);
    const files = {
        input_dir: inputDirRel,
        diff: path.join(inputDirRel, 'diff.patch'),
        roadmap: roadmapText !== null ? path.join(inputDirRel, 'roadmap.md') : null,
        acceptance_criteria: path.join(inputDirRel, 'acceptance-criteria.md'),
        prompt: path.join(inputDirRel, 'prompt.md'),
        findings: findingsRel,
    };

    if (args.format === 'json') {
        process.stdout.write(JSON.stringify({ slug, head_sha: headSha, hashes, files }, null, 2) + '\n');
    } else if (args.printPrompt) {
        process.stdout.write(promptText);
        process.stdout.write('\n---\n');
        process.stdout.write(`input package: ${inputDirRel}\n`);
        process.stdout.write(`findings skeleton: ${findingsRel}\n`);
    } else {
        process.stdout.write(
            `✅  R2 reviewer package prepared for '${slug}' (head ${headSha}, scope ${hashes.scope_hash}).\n`,
        );
        process.stdout.write(`  input package:     ${inputDirRel}\n`);
        process.stdout.write(`  findings skeleton: ${findingsRel}\n`);
        process.stdout.write('  Dispatch a FRESH subagent at the input package (never the implementing session).\n');
    }
    return 0;
}

export function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    if (args.verifyCurrent) {
        return runVerifyCurrent(args);
    }
    if (args.verify !== null) {
        return runVerify(args);
    }
    return runDispatch(args);
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
    // Symlinked invocation (installed projection, macOS /var → /private/var)
    // makes the raw URLs differ; compare realpaths so the guard still fires.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
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
