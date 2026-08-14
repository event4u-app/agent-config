/**
 * Team-review multi-host fallback dispatch — road-to-team-mode Phase 3.
 *
 * On hosts WITHOUT the official Claude-Code plugin (Cursor, Augment, Copilot,
 * plain terminals), `/team:review` falls back to this script: build a
 * READ-ONLY repo-context bundle (`git status --porcelain`, a size-capped
 * staged+unstaged diff, the tracked-file list), send it through the existing
 * subscription-authed `OpenAICliClient` transport with a review system
 * prompt, and emit the result in the team-review status envelope
 * (`src/skills/subagent-orchestration/schemas/team-review-status.json`).
 *
 * READ-ONLY BY CONSTRUCTION: the only subprocesses this module spawns are
 * read-only `git` queries (`status` / `diff` / `ls-files` / `rev-parse`) and
 * the codex CLI call itself. No code path writes to the repository.
 *
 * Honesty contract (Phase 3 Step 2): every fallback run renders the
 * capability-delta header at the TOP — one synchronous call, diff-bundle
 * instead of live repo access, no background jobs, explicitly worse than the
 * plugin — pointing Claude-Code users back to the Phase 2 plugin path.
 *
 * Governance reuse (Phase 3 Step 3): same `ai_team` config, same
 * `cli_call_budget` openai quota bucket (the gate and the recording both
 * live in `CliClient.ask` — no new counter), same `_AUTH_FAILURE_PATTERNS`
 * classification. `--manual` renders the bundle between `═` rules for
 * paste-into-web usage — no call, no quota.
 *
 * Availability (road-to-always-on-orchestration Phase 1, Step 1.3):
 * `ai_team.enabled` was DELETED. Every dispatch entry point below is
 * fail-closed on TWO facts instead — `emergency.orchestration_halt` (the
 * one audited incident switch over the always-on stack) and
 * `checkCodexAvailability()` (codex CLI + auth presence,
 * `./availability.js`) — never a settings flag. `ai_team.allow_delegate`
 * is unchanged: a second, write-access opt-in that stacks ON TOP of
 * availability in `assert_delegate_allowed`.
 *
 * The review system prompt is derived from the adversarial-review findings
 * shape of an Apache-2.0 upstream — attribution in the repo-root NOTICE file.
 */
import { spawnSync } from 'node:child_process';
import { sanitize_text } from '../_lib/retrieval_sanitize.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    type CouncilResponse,
    load_cli_call_counts,
    OpenAICliClient,
} from '../ai_council/clients.js';
import {
    checkCodexAvailability,
    isOrchestrationHalted,
    ORCHESTRATION_HALT_MESSAGE,
    type TeamAvailability,
} from './availability.js';
import { type AiTeamConfig, load_ai_team_config } from './config.js';

// ── errors ──────────────────────────────────────────────────────────────

/** Raised for any team-dispatch failure that is the caller's to surface. */
export class TeamDispatchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TeamDispatchError';
    }
}

/**
 * Raised when `/team` is unavailable — either `emergency.orchestration_halt`
 * is set, or the codex CLI / auth availability check
 * (`checkCodexAvailability`) failed. `reason` is the one-line message the
 * relevant check produced; callers print it verbatim. There is no more
 * settings flag behind this — see the module docstring.
 */
export class TeamDisabledError extends TeamDispatchError {
    constructor(reason: string) {
        super(reason);
        this.name = 'TeamDisabledError';
    }
}

/**
 * Thrown by `assert_delegate_allowed` when `/team` is available but the
 * second opt-in (`ai_team.allow_delegate`) is not. `/team delegate` is the
 * only wrapper that hands WRITE access to the second model, so it is
 * double-gated; availability alone is never delegate authorization.
 */
export class TeamDelegateDisabledError extends TeamDispatchError {
    constructor() {
        super(
            '`/team delegate` is disabled (`ai_team.allow_delegate: false`, the shipped ' +
                'default). It is the only team-mode wrapper that hands write access to ' +
                'the second model, so it needs its own opt-in: set ' +
                '`ai_team.allow_delegate: true` in `.agent-settings.yml` (once /team ' +
                'itself is available — codex CLI installed and authenticated) — see ' +
                'docs/contracts/ai-team-config.md.',
        );
        this.name = 'TeamDelegateDisabledError';
    }
}

/** Test seams for the two availability facts (`assert_delegate_allowed`, `run_team_review`). */
export interface TeamAvailabilityOverrides {
    /** Default: `checkCodexAvailability()` — the real, cached, zero-spend probe. */
    availability?: TeamAvailability;
    /** Default: `isOrchestrationHalted(undefined, cwd)` — reads the real settings cascade. */
    halted?: boolean;
}

/**
 * Deterministic mirror of the `/team delegate` double gate: throws
 * `TeamDisabledError` when halted or `/team` is unavailable, then
 * `TeamDelegateDisabledError` unless `ai_team.allow_delegate`. The command
 * doc's prose gates instruct the agent; this guard is the machine-checkable
 * contract (`--delegate-gate` CLI mode) tests pin against.
 */
export function assert_delegate_allowed(
    config?: AiTeamConfig,
    cwd?: string | null,
    overrides: TeamAvailabilityOverrides = {},
): void {
    const cfg = config ?? load_ai_team_config({ cwd: cwd ?? null });
    const halted = overrides.halted ?? isOrchestrationHalted(undefined, cwd ?? null);
    if (halted) {
        throw new TeamDisabledError(ORCHESTRATION_HALT_MESSAGE);
    }
    const availability = overrides.availability ?? checkCodexAvailability(cwd ?? undefined);
    if (!availability.available) {
        throw new TeamDisabledError(availability.reason ?? 'codex CLI not available.');
    }
    if (!cfg.allow_delegate) {
        throw new TeamDelegateDisabledError();
    }
}

// ── repo-context bundle (READ-ONLY) ─────────────────────────────────────

/**
 * Combined staged+unstaged diff cap, in characters. Chars (not bytes/lines)
 * because the cap protects the model-context budget and chars/4 is the
 * established token estimate in this tree (`pricing.estimate_input_tokens`).
 */
export const DIFF_BUNDLE_MAX_CHARS = 120_000;

/** Truncation marker appended when the diff is cut — names how much was cut. */
export function truncation_marker(cut_chars: number, cap: number): string {
    return (
        `\n[... TRUNCATED: ${cut_chars} characters of diff cut at the ` +
        `${cap}-char bundle cap — the reviewer saw a partial diff ...]`
    );
}

/** Injectable git runner: argv (without the leading `git`) → stdout. */
export type GitRunner = (args: readonly string[]) => string;

/** Allowlisted read-only git subcommands — the read-only-by-construction proof. */
const _READ_ONLY_GIT_SUBCOMMANDS: ReadonlySet<string> = new Set([
    'status',
    'diff',
    'ls-files',
    'rev-parse',
]);

function _default_run_git(cwd: string): GitRunner {
    return (args: readonly string[]): string => {
        const r = spawnSync('git', [...args], { cwd, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
        if (r.error) {
            throw new TeamDispatchError(`git ${args[0] ?? ''} failed: ${r.error.message}`);
        }
        if (r.status !== 0) {
            throw new TeamDispatchError(
                `git ${args[0] ?? ''} exited ${r.status}: ${(r.stderr ?? '').slice(0, 500)}`,
            );
        }
        return r.stdout ?? '';
    };
}

/** Wrap a runner so any non-allowlisted subcommand is a hard error. */
function _guard_read_only(run: GitRunner): GitRunner {
    return (args: readonly string[]): string => {
        const sub = args[0] ?? '';
        if (!_READ_ONLY_GIT_SUBCOMMANDS.has(sub)) {
            throw new TeamDispatchError(
                `refusing non-read-only git subcommand \`${sub}\` — ` +
                    'team_dispatch is read-only by construction.',
            );
        }
        return run(args);
    };
}

/** The repo-context bundle sent to the reviewer. */
export interface RepoContextBundle {
    /** `git rev-parse HEAD` at bundle time — becomes `reviewed_ref`. */
    readonly head_ref: string;
    /** `git status --porcelain` output. */
    readonly status: string;
    /** Combined staged+unstaged diff, possibly truncated (marker appended). */
    readonly diff: string;
    readonly diff_truncated: boolean;
    /** Characters cut from the combined diff (0 when not truncated). */
    readonly diff_cut_chars: number;
    /** Tracked-file list (`git ls-files`). */
    readonly files: readonly string[];
}

export interface BuildBundleOptions {
    cwd?: string;
    run_git?: GitRunner;
    /** Override the diff cap (tests exercise the boundary). */
    max_diff_chars?: number;
}

/**
 * Build the READ-ONLY repo-context bundle.
 *
 * The combined diff is `staged` (`git diff --cached`) then `unstaged`
 * (`git diff`), section-labelled. When the combined text exceeds the cap it
 * is cut at exactly `max_diff_chars` characters and the truncation marker
 * (naming the cut size) is appended — the bundle never silently loses data.
 */
export function build_repo_context_bundle(opts: BuildBundleOptions = {}): RepoContextBundle {
    const cap = opts.max_diff_chars ?? DIFF_BUNDLE_MAX_CHARS;
    const run = _guard_read_only(opts.run_git ?? _default_run_git(opts.cwd ?? process.cwd()));

    const head_ref = run(['rev-parse', 'HEAD']).trim();
    const status = run(['status', '--porcelain']).trimEnd();
    const staged = run(['diff', '--cached']).trimEnd();
    const unstaged = run(['diff']).trimEnd();
    const files = run(['ls-files'])
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    const combined =
        `### staged diff (git diff --cached)\n${staged || '(empty)'}\n\n` +
        `### unstaged diff (git diff)\n${unstaged || '(empty)'}`;

    let diff = combined;
    let diff_truncated = false;
    let diff_cut_chars = 0;
    if (combined.length > cap) {
        diff_cut_chars = combined.length - cap;
        diff = combined.slice(0, cap) + truncation_marker(diff_cut_chars, cap);
        diff_truncated = true;
    }

    return { head_ref, status, diff, diff_truncated, diff_cut_chars, files };
}

// ── capability-delta header (Phase 3 Step 2 — honesty contract) ─────────

/**
 * Rendered at the TOP of every fallback run (call AND manual modes).
 * Never soften this: the fallback is deliberately described as worse than
 * the plugin so nobody mistakes bundle-review for live-repo review.
 */
export function render_capability_delta_header(): string {
    return [
        '⚠️  team:review — multi-host FALLBACK (reduced capability)',
        'This is the diff-bundle fallback, not the official Claude Code plugin:',
        '  • ONE synchronous model call — no background jobs, no broker, no build→review→fix loop',
        '  • the reviewer sees a size-capped diff bundle, NOT the live repository',
        '  • findings are advisory; nothing here writes to the repo',
        'On Claude Code, use the plugin path instead — it is strictly more capable:',
        '  agent-config doctor --check team',
    ].join('\n');
}

// ── review system prompt ────────────────────────────────────────────────

/**
 * Review system prompt — findings shape derived from an Apache-2.0 upstream
 * adversarial-review skill (attribution: repo-root NOTICE). The JSON contract
 * mirrors `team-review-status.json` so parsing is a projection, not a guess.
 */
export const TEAM_REVIEW_SYSTEM_PROMPT = [
    'You are an adversarial senior code reviewer on a two-model team: another',
    'model wrote the changes; your ONLY job is to find what it got wrong.',
    'Assume the diff is flawed. Hunt for: logic errors, race conditions,',
    'missing edge/empty/error cases, security smells (injection, authz gaps,',
    'secrets), silent behavior changes, broken callers the diff forgot, and',
    'over-engineering where a simpler change would do.',
    '',
    'You receive a READ-ONLY repo-context bundle: `git status --porcelain`,',
    'a size-capped combined staged+unstaged diff (a truncation marker names',
    'anything cut), and the tracked-file list. You cannot run commands or',
    'read files beyond the bundle — when a judgment needs unseen context,',
    'say so via status NEEDS_CONTEXT instead of guessing.',
    '',
    'Respond with a SINGLE JSON object and nothing else (no prose, no code',
    'fence) in exactly this shape:',
    '{',
    '  "status": "DONE" | "DONE_WITH_CONCERNS" | "NEEDS_CONTEXT",',
    '  "summary": "<one or two sentences>",',
    '  "findings": [',
    '    {',
    '      "severity": "critical" | "major" | "minor" | "info",',
    '      "evidence": "<what is wrong, citing the exact hunk/line from the diff>",',
    '      "suggested_fix": "<concrete, minimal fix>",',
    '      "location": "<file[:line] when known>"',
    '    }',
    '  ]',
    '}',
    '',
    'Rules: every finding cites evidence from the bundle — never invent code',
    'that is not in the diff. No findings above "info" → status DONE with an',
    'empty findings array. Any "critical"/"major"/"minor" finding → status',
    'DONE_WITH_CONCERNS. Missing context blocks a judgment → NEEDS_CONTEXT',
    'and put the single blocking question in "summary".',
].join('\n');

/** Render the user prompt from the bundle. */
export function render_review_user_prompt(bundle: RepoContextBundle): string {
    return [
        `## Repo-context bundle (read-only snapshot at HEAD ${bundle.head_ref})`,
        '',
        '### git status --porcelain',
        bundle.status || '(clean)',
        '',
        bundle.diff,
        '',
        `### tracked files (${bundle.files.length})`,
        bundle.files.join('\n'),
    ].join('\n');
}

// ── manual mode (council precedent: paste block between ═ rules) ────────

/**
 * Render the bundle + system prompt between `═` rules for paste-into-web
 * usage — mirrors the council's `ManualClient._render_block`. No model call,
 * no quota touch.
 */
export function render_manual_block(bundle: RepoContextBundle): string {
    const bar = '═'.repeat(67);
    const head =
        `${bar}\n` +
        'Team review — manual mode\n' +
        'Paste this block into your LLM web UI · the reply is the review.\n' +
        `${bar}`;
    const body = `${TEAM_REVIEW_SYSTEM_PROMPT}\n\n---\n\n${render_review_user_prompt(bundle)}`;
    const tail = `${bar}\nEnd of paste block — no call was made, no quota was spent.\n${bar}`;
    return `${head}\n\n${body}\n\n${tail}`;
}

// ── team-review envelope ────────────────────────────────────────────────
// Wire format: src/skills/subagent-orchestration/schemas/team-review-status.json
// (extends the subagent-status.json frame).

export type TeamReviewStatus = 'DONE' | 'DONE_WITH_CONCERNS' | 'NEEDS_CONTEXT' | 'BLOCKED';

export type FindingSeverity = 'critical' | 'major' | 'minor' | 'info';

export interface TeamReviewFinding {
    readonly severity: FindingSeverity;
    readonly evidence: string;
    readonly suggested_fix: string;
    readonly location?: string;
}

export interface TeamReviewQuota {
    /** Today's openai-bucket call count AFTER this run. */
    readonly used: number;
    /** `ai_team.max_calls_per_day` — the team-side ceiling on the shared bucket. */
    readonly ceiling: number;
}

export interface TeamReviewEnvelope {
    status: TeamReviewStatus;
    findings: TeamReviewFinding[];
    /** HEAD sha the bundle was built from. */
    reviewed_ref: string;
    model: string;
    quota: TeamReviewQuota;
    summary?: string;
    /** Verbatim model output when findings could not be parsed — NEVER dropped. */
    raw?: string;
    /** Required when status = NEEDS_CONTEXT. */
    blocking_question?: string;
    /** Required when status = BLOCKED. */
    blocking_reason?: string;
}

const _VALID_SEVERITIES: ReadonlySet<string> = new Set(['critical', 'major', 'minor', 'info']);
const _MODEL_STATUSES: ReadonlySet<string> = new Set(['DONE', 'DONE_WITH_CONCERNS', 'NEEDS_CONTEXT']);

/** Best-effort parse result: parsed findings, or the raw-preserving fallback. */
export interface ParsedReview {
    readonly parsed: boolean;
    readonly status: TeamReviewStatus;
    readonly findings: TeamReviewFinding[];
    readonly summary: string;
    /** Populated (verbatim model text) only when `parsed` is false. */
    readonly raw?: string;
}

function _strip_code_fence(text: string): string {
    const t = text.trim();
    const m = /^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/.exec(t);
    return m !== null && m[1] !== undefined ? m[1] : t;
}

/**
 * Parse the model output into findings — best-effort, never throwing.
 *
 * Unparseable output (not JSON, wrong shape, no salvageable findings) →
 * `parsed: false` with the verbatim text in `raw`; the caller maps that to
 * status DONE_WITH_CONCERNS so a malformed review is loud, never dropped.
 * Findings with an unknown severity are kept, clamped to `info`.
 */
export function parse_review_findings(text: string): ParsedReview {
    const fallback: ParsedReview = {
        parsed: false,
        status: 'DONE_WITH_CONCERNS',
        findings: [],
        summary: 'model output was not parseable as the team-review JSON contract; raw text preserved (sanitized, length-capped).',
        // Sanitize floor on the inbound inter-agent channel: this is another
        // model's text about to be emitted into the host agent's context, the
        // same class as a retrieved corpus body. Applied per emitted FIELD, not
        // to the whole payload — `sanitize_text` caps at `MAX_FIELD_CHARS`, and
        // capping the payload before `JSON.parse` would corrupt a long-but-valid
        // review. See `agents/evidence/reports/sanitize-floor-wiring.md` § S0.0b.
        raw: sanitize_text(text),
    };
    let data: unknown;
    try {
        data = JSON.parse(_strip_code_fence(text));
    } catch {
        return fallback;
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        return fallback;
    }
    const obj = data as Record<string, unknown>;
    const raw_findings = obj['findings'];
    if (!Array.isArray(raw_findings)) {
        return fallback;
    }
    const findings: TeamReviewFinding[] = [];
    for (const entry of raw_findings) {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
            return fallback; // a non-object finding poisons trust in the whole parse
        }
        const f = entry as Record<string, unknown>;
        const evidence = f['evidence'];
        const suggested_fix = f['suggested_fix'];
        if (typeof evidence !== 'string' || evidence.trim() === '') {
            return fallback;
        }
        if (typeof suggested_fix !== 'string' || suggested_fix.trim() === '') {
            return fallback;
        }
        const raw_sev = typeof f['severity'] === 'string' ? (f['severity'] as string) : 'info';
        const severity = (_VALID_SEVERITIES.has(raw_sev) ? raw_sev : 'info') as FindingSeverity;
        // Sanitize every emitted string field (see the fallback above for why
        // this is per-field rather than payload-wide). Validation ran on the
        // raw value so a field that is only whitespace-after-sanitize still
        // fails the same way it did before.
        const finding: TeamReviewFinding = {
            severity,
            evidence: sanitize_text(evidence),
            suggested_fix: sanitize_text(suggested_fix),
            ...(typeof f['location'] === 'string' && f['location'].trim() !== ''
                ? { location: sanitize_text(f['location'] as string) }
                : {}),
        };
        findings.push(finding);
    }
    const model_status = typeof obj['status'] === 'string' ? (obj['status'] as string) : '';
    let status: TeamReviewStatus;
    if (_MODEL_STATUSES.has(model_status)) {
        status = model_status as TeamReviewStatus;
    } else {
        // Derive from findings when the model skipped/garbled the status.
        status = findings.length > 0 ? 'DONE_WITH_CONCERNS' : 'DONE';
    }
    // Consistency floor: findings present can never report a bare DONE.
    if (status === 'DONE' && findings.length > 0) {
        status = 'DONE_WITH_CONCERNS';
    }
    const summary =
        typeof obj['summary'] === 'string' && obj['summary'].trim() !== ''
            ? sanitize_text(obj['summary'] as string)
            : findings.length > 0
              ? `${findings.length} finding(s) from cross-model review.`
              : 'no findings above info from cross-model review.';
    return { parsed: true, status, findings, summary };
}

// ── transport (reuses OpenAICliClient — quota + auth machinery intact) ──

/**
 * Named OpenAICliClient subclass for the team-review dispatch path.
 *
 * It used to carry an override that stripped `--model` back out of the argv
 * whenever `ai_team.model` was `'auto'`, because the base client pinned a model
 * unconditionally. Since 2026-08-15 the base client honours the same sentinel
 * itself (`_isAutoModel`, and `DEFAULT_OPENAI_CLI_MODEL` is now `'auto'`), so
 * that override was a provable no-op — the flag it removed was no longer being
 * added. Deleting it is this change's own cleanup, not a drive-by: leaving a
 * splice whose comment claims the base "passes `--model`" would be a stale
 * description of behaviour this diff changed.
 *
 * The class stays because it is the named transport for this path — quota gate,
 * call recording into the shared `counts.openai` bucket, and stderr
 * classification via `_AUTH_FAILURE_PATTERNS` are all inherited unchanged, and
 * a distinct type is what lets a reader tell a team dispatch from a council one.
 */
export class TeamReviewCliClient extends OpenAICliClient {}

// ── dispatch ────────────────────────────────────────────────────────────

/** Result of a fallback run — manual render or a call with its envelope. */
export interface TeamReviewRunResult {
    readonly mode: 'manual' | 'call';
    /** The capability-delta header that was rendered at the top. */
    readonly header: string;
    readonly bundle: RepoContextBundle;
    /** Present in manual mode: the paste block between `═` rules. */
    readonly manual_block?: string;
    /** Present in call mode: the team-review status envelope. */
    readonly envelope?: TeamReviewEnvelope;
}

export interface RunTeamReviewOptions {
    /** Pre-built config (test seam); default: `load_ai_team_config({ cwd })`. */
    config?: AiTeamConfig;
    cwd?: string;
    /** `--manual`: render the paste block, make no call, spend no quota. */
    manual?: boolean;
    /** Client factory (test seam); default builds a `TeamReviewCliClient`. */
    make_client?: (config: AiTeamConfig) => TeamReviewCliClient;
    run_git?: GitRunner;
    max_diff_chars?: number;
    /** Quota state path override (test seam) — default shared cli-calls.json. */
    cli_calls_path?: string | null;
    /** Sink for user-facing output; default `process.stdout`. */
    out?: (line: string) => void;
    /** Test seam: override the availability check (default: the real, cached probe). */
    availability?: TeamAvailability;
    /** Test seam: override the halted flag (default: read from the settings cascade). */
    halted?: boolean;
}

function _quota_snapshot(config: AiTeamConfig, cli_calls_path: string | null): TeamReviewQuota {
    const counts = load_cli_call_counts(cli_calls_path);
    return { used: counts['openai'] ?? 0, ceiling: config.max_calls_per_day };
}

function _envelope_from_response(
    response: CouncilResponse,
    bundle: RepoContextBundle,
    quota: TeamReviewQuota,
): TeamReviewEnvelope {
    const base = {
        reviewed_ref: bundle.head_ref,
        model: response.model,
        quota,
    };
    if (response.error !== null && response.error !== undefined && response.error !== '') {
        let blocking_reason: string;
        if (response.error === 'auth_expired') {
            blocking_reason =
                'codex CLI auth failed (auth_expired) — run `codex login`, then retry. ' +
                'No review was produced.';
        } else if (response.error === 'cli_quota_exhausted') {
            blocking_reason =
                `daily cli-call quota exhausted for the shared openai bucket ` +
                `(${quota.used}/${quota.ceiling}) — resets at UTC midnight. No review was produced.`;
        } else {
            blocking_reason = `codex CLI transport failed: ${response.error}. No review was produced.`;
        }
        return { ...base, status: 'BLOCKED', findings: [], blocking_reason };
    }
    const parsed = parse_review_findings(response.text);
    const envelope: TeamReviewEnvelope = {
        ...base,
        status: parsed.status,
        findings: parsed.findings,
        summary: parsed.summary,
    };
    if (!parsed.parsed) {
        envelope.raw = parsed.raw ?? response.text;
    }
    if (parsed.status === 'NEEDS_CONTEXT') {
        // Contract: the prompt tells the model to put its single blocking
        // question in `summary`; the envelope schema requires it here.
        envelope.blocking_question = parsed.summary;
    }
    return envelope;
}

/**
 * Run the multi-host team-review fallback.
 *
 * Order of operations is the contract: (1) fail-closed availability gate —
 * halted, then codex CLI/auth — (2) capability-delta header at the top,
 * (3) read-only bundle, (4) manual render OR one synchronous `codex exec`
 * call through the shared quota/auth machinery, (5) envelope emission.
 * Throws `TeamDisabledError` when halted or unavailable — never a silent
 * no-op.
 */
export function run_team_review(opts: RunTeamReviewOptions = {}): TeamReviewRunResult {
    const config = opts.config ?? load_ai_team_config({ cwd: opts.cwd ?? null });
    const halted = opts.halted ?? isOrchestrationHalted(undefined, opts.cwd ?? null);
    if (halted) {
        throw new TeamDisabledError(ORCHESTRATION_HALT_MESSAGE);
    }
    const availability = opts.availability ?? checkCodexAvailability(opts.cwd ?? undefined);
    if (!availability.available) {
        throw new TeamDisabledError(availability.reason ?? 'codex CLI not available.');
    }
    const out = opts.out ?? ((line: string): void => void process.stdout.write(`${line}\n`));

    // Honesty contract: header FIRST, before any other output, in every mode.
    const header = render_capability_delta_header();
    out(header);

    const bundle_opts: BuildBundleOptions = {};
    if (opts.cwd !== undefined) {
        bundle_opts.cwd = opts.cwd;
    }
    if (opts.run_git !== undefined) {
        bundle_opts.run_git = opts.run_git;
    }
    if (opts.max_diff_chars !== undefined) {
        bundle_opts.max_diff_chars = opts.max_diff_chars;
    }
    const bundle = build_repo_context_bundle(bundle_opts);

    if (opts.manual === true) {
        const manual_block = render_manual_block(bundle);
        out(manual_block);
        return { mode: 'manual', header, bundle, manual_block };
    }

    const cli_calls_path = opts.cli_calls_path ?? null;
    const client =
        opts.make_client !== undefined
            ? opts.make_client(config)
            : new TeamReviewCliClient({
                  model: config.model,
                  max_calls_per_day: config.max_calls_per_day,
                  cli_calls_path,
              });

    const response = client.ask(TEAM_REVIEW_SYSTEM_PROMPT, render_review_user_prompt(bundle));
    const quota = _quota_snapshot(config, cli_calls_path);
    const envelope = _envelope_from_response(response, bundle, quota);
    out(JSON.stringify(envelope, null, 2));
    return { mode: 'call', header, bundle, envelope };
}

// ── CLI entry ───────────────────────────────────────────────────────────

function _main(argv: string[]): number {
    if (argv.includes('--delegate-gate')) {
        try {
            assert_delegate_allowed();
            return 0;
        } catch (exc) {
            if (exc instanceof TeamDispatchError) {
                process.stderr.write(`${exc.message}\n`);
                return 2;
            }
            throw exc;
        }
    }
    const manual = argv.includes('--manual');
    try {
        const result = run_team_review({ manual });
        if (result.mode === 'call' && result.envelope?.status === 'BLOCKED') {
            return 1;
        }
        return 0;
    } catch (exc) {
        if (exc instanceof TeamDispatchError) {
            process.stderr.write(`${exc.message}\n`);
            return 2;
        }
        throw exc;
    }
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // Symlinked invocations (installed projections, macOS /var → /private/var)
    // make the raw URLs differ — compare realpaths (same guard as airgap.ts).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(_main(process.argv.slice(2)));
}
