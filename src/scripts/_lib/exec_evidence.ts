/**
 * `exec:` evidence — the ledger form that re-derives its own claim.
 *
 * The other three evidence forms are existence checks: a file is present, a
 * substring is present, a URL carries a date. None of them can tell a live
 * claim from a stale one. A ledger entry reading "the suite is green" whose
 * pointer resolves to a report nobody regenerated stays `backed` forever.
 *
 * `exec:<command> -> 0` closes that: the command runs again and its exit code
 * carries the verdict. Three properties make it safe enough to run in CI, and
 * all three are the parts that get dropped when this is rebuilt from memory:
 *
 *  1. The allowlist is a set of **argv prefix tuples**, never a regex over a
 *     command string. A regex over shell text is the classic bypass; a tuple
 *     compared against parsed argv has nothing to hide behind.
 *  2. Every argument *after* the matched prefix is re-checked — for shell
 *     metacharacters and for repo escape — including the right-hand side of
 *     `--flag=value`. Without that split, `--rootdir=/etc` clears an allowlist
 *     that only ever looked at the flag name.
 *  3. Execution is `spawnSync` with an argv array and no shell, confined to the
 *     repo root, and gated to CI. Locally the caller reports UNVERIFIED rather
 *     than running anything — see `exec_allowed_here()`.
 *
 * Scope limit, stated rather than discovered later: this form only covers
 * claims whose exit code *is* the verdict. A claim resting on a paid model run,
 * a stochastic benchmark, or a prose contract cannot use it, and is recorded as
 * unfalsifiable-by-machine instead of quietly omitted.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';

/** Marker that opens the fourth evidence form. */
export const EXEC_PREFIX = 'exec:';

/**
 * Allowlisted argv prefixes. Each entry is matched element-by-element against
 * the parsed argv — `["skill_eval_coverage"]` admits
 * `skill_eval_coverage --check` but not `skill_eval_coverage; rm -rf /`,
 * because the latter never parses into that shape.
 *
 * All but one are this repo's own scripts, run through `scripts-run`. That is a
 * deliberately narrower surface than a general test-runner allowlist: these are
 * deterministic, model-free, and already run in CI for other reasons.
 */
export const ALLOWLIST_PREFIXES: readonly (readonly string[])[] = [
    ['skill_eval_coverage'],
    ['domain_soundness_status'],
    ['check_artefact_count_messaging'],
    // `update_counts --check` re-derives every anchored number in the docs and
    // exits non-zero on any disagreement — so its exit code IS the verdict for
    // a published count, not merely evidence that some report exists. Read-only
    // under `--check`; same deterministic, model-free class as its neighbours.
    ['update_counts'],
    ['check_enforcement_coverage'],
    // The denominator half of the same property. `check_enforcement_coverage`
    // PUBLISHES the number; this one refuses a second, hand-written copy of it
    // in a published doc — so its exit code IS the verdict for
    // `claim:enforcement-undeclared-denominator`, not merely evidence that some
    // report exists. Read-only, deterministic, model-free, and already run in
    // CI (`rule-backstops.yml`) for its own reasons.
    ['check_enforcement_denominator'],
    // road-to-source-silence Phase 5.3. The source-confidentiality gate's exit
    // code IS the verdict for `claim:plaintext-source-attribution`: 0 means zero
    // deny-pattern matches in tracked content AND in every tracked path, plus the
    // attribution-shape block count at or below its ratchet baseline. An
    // existence-check pointer would have gone stale the first time somebody added
    // a name. Read-only, deterministic, model-free, and already run in CI for its
    // own reasons — the same class as its neighbours here.
    ['check_no_external_sources'],
    // Compares two COMMITTED files — the skill-activation census record against
    // the sentence `docs/CLAIMS.md` publishes — so its exit code IS the verdict
    // for that claim rather than evidence that some report exists. The census
    // itself is deliberately NOT here: it reads a transcript store under `$HOME`
    // that is absent on a runner, which would make the verdict an artifact of
    // where it ran.
    ['check_skill_activation_claim'],
    ['check_token_regression'],
    ['lint_agent_security'],
    ['measure_lexical_ranking'],
    ['vitest', 'run'],
];

/** Shell metacharacters plus the control bytes used to smuggle a second command. */
const UNSAFE_CHARS = new Set(['&', ';', '|', '>', '<', '`', '$', '\n', '\r', '\0']);

const WINDOWS_ABSOLUTE = /^[A-Za-z]:[\\/]/;

/** Commands that are not repo scripts and must not be routed through scripts-run. */
const NON_SCRIPT_PREFIXES = new Set(['vitest']);

export interface ExecPointer {
    /** The command as written in the ledger, e.g. `skill_eval_coverage --check`. */
    command: string;
    /** The exit code the claim asserts. */
    expected: number;
}

export interface ExecOutcome {
    /** `true` only when the command ran AND matched the asserted exit code. */
    verified: boolean;
    /** `true` when the command ran and disagreed — a real finding, not a skip. */
    mismatch: boolean;
    /** Human-readable verdict for the report. */
    reason: string;
}

/**
 * Parse `exec:<command> -> <code>`. Accepts `->` and the `→` the docs render.
 * Returns null when `raw` is not an exec pointer at all, so callers can fall
 * through to the path/URL forms.
 */
export function parse_exec_pointer(raw: string): ExecPointer | { error: string } | null {
    const ev = raw.trim();
    if (!ev.startsWith(EXEC_PREFIX)) return null;

    const body = ev.slice(EXEC_PREFIX.length).trim();
    const arrow = body.match(/\s*(?:->|→)\s*(\d+)\s*$/);
    if (!arrow) return { error: 'exec pointer missing the `-> <exit-code>` suffix' };

    const command = body.slice(0, arrow.index).trim();
    if (!command) return { error: 'exec pointer has an empty command' };

    return { command, expected: Number(arrow[1]) };
}

/**
 * Split a command into argv without invoking a shell. Deliberately minimal: no
 * quote handling, no expansion, no substitution. Anything that would *need*
 * those is rejected by `args_are_safe` anyway, so supporting them would only
 * widen the surface.
 */
export function split_argv(command: string): string[] {
    return command.split(/\s+/).filter((t) => t.length > 0);
}

/** Does argv start with an allowlisted prefix? */
export function command_is_allowlisted(argv: string[]): boolean {
    return ALLOWLIST_PREFIXES.some(
        (prefix) => argv.length >= prefix.length && prefix.every((tok, i) => argv[i] === tok),
    );
}

/** Would this argument reach outside the repo? */
function targets_outside_repo(candidate: string): boolean {
    if (candidate.startsWith('/')) return true;
    if (WINDOWS_ABSOLUTE.test(candidate)) return true;
    if (candidate === '..' || candidate.startsWith('../')) return true;
    return candidate.includes('/../');
}

/**
 * Re-check every argument after the allowlisted prefix.
 *
 * The `--flag=value` split is the part worth keeping: an allowlist that only
 * inspects the token as written treats `--rootdir=/etc` as a flag and lets the
 * path through. Here the right-hand side is extracted and checked on its own.
 */
export function args_are_safe(argv: string[]): boolean {
    for (const arg of argv.slice(1)) {
        for (const ch of arg) {
            if (UNSAFE_CHARS.has(ch)) return false;
        }
        const eq = arg.indexOf('=');
        const candidate = arg.startsWith('-') && eq !== -1 ? arg.slice(eq + 1) : arg;
        if (candidate && targets_outside_repo(candidate)) return false;
    }
    return true;
}

/**
 * Static validation — everything checkable without running anything.
 *
 * Split out from `run_exec_evidence` on purpose: a malformed or non-allowlisted
 * command is a defect in the *ledger*, so it must fail on a laptop too. Only
 * the re-execution half is environment-dependent. Returns null when the pointer
 * is well-formed and admissible, else the reason.
 */
export function exec_static_error(pointer: ExecPointer): string | null {
    const argv = split_argv(pointer.command);
    if (argv.length === 0) return 'exec pointer has an empty command';
    if (!command_is_allowlisted(argv)) {
        return `exec command \`${pointer.command}\` is not in the deterministic allowlist`;
    }
    if (!args_are_safe(argv)) {
        return `exec command \`${pointer.command}\` carries a suspicious argument`;
    }
    return null;
}

/**
 * May this environment execute evidence commands?
 *
 * CI only. A consumer's checkout never re-runs a claim's command — the upstream
 * package's ledger is not the consumer's business, and "runs in the repository
 * root with full filesystem access" is a property to confine, not to trust.
 */
export function exec_allowed_here(env: NodeJS.ProcessEnv = process.env): boolean {
    if (env.AGENT_CONFIG_EXEC_EVIDENCE === '1') return true; // maintainer opt-in, one run
    return env.CI === 'true' || env.CI === '1';
}

/** Build the real argv: repo scripts go through `scripts-run`, others run directly. */
function resolve_runner(argv: string[], repo: string): { file: string; args: string[] } {
    const head = argv[0] as string;
    if (NON_SCRIPT_PREFIXES.has(head)) {
        return { file: path.join(repo, 'node_modules', '.bin', head), args: argv.slice(1) };
    }
    return {
        file: path.join(repo, 'scripts-run'),
        args: [`src/scripts/${head}`, ...argv.slice(1)],
    };
}

/**
 * Run an allowlisted evidence command and compare its exit code to the claim.
 *
 * Never throws: every failure path returns an `ExecOutcome` so one bad pointer
 * cannot take down the whole ledger check. `mismatch` distinguishes "ran and
 * disagreed" (a finding) from "could not run" (a skip) — collapsing those two
 * is how a verifier turns into a rubber stamp.
 */
export function run_exec_evidence(pointer: ExecPointer, repo: string, timeoutMs = 300_000): ExecOutcome {
    const argv = split_argv(pointer.command);

    if (argv.length === 0) {
        return { verified: false, mismatch: false, reason: 'UNVERIFIED: empty command' };
    }
    if (!command_is_allowlisted(argv)) {
        return {
            verified: false,
            mismatch: false,
            reason: `UNVERIFIED: \`${pointer.command}\` is not in the deterministic allowlist`,
        };
    }
    if (!args_are_safe(argv)) {
        return {
            verified: false,
            mismatch: false,
            reason: `UNVERIFIED: \`${pointer.command}\` carries a suspicious argument`,
        };
    }

    const { file, args } = resolve_runner(argv, repo);
    const result = spawnSync(file, args, {
        cwd: repo,
        encoding: 'utf-8',
        timeout: timeoutMs,
        shell: false,
    });

    if (result.error) {
        return {
            verified: false,
            mismatch: false,
            reason: `UNVERIFIED: could not execute \`${pointer.command}\` (${result.error.message})`,
        };
    }
    if (result.status === null) {
        return {
            verified: false,
            mismatch: false,
            reason: `UNVERIFIED: \`${pointer.command}\` was killed (timeout or signal)`,
        };
    }
    if (result.status !== pointer.expected) {
        return {
            verified: false,
            mismatch: true,
            reason: `evidence mismatch — claim asserts exit ${pointer.expected}, \`${pointer.command}\` exited ${result.status}`,
        };
    }
    return {
        verified: true,
        mismatch: false,
        reason: `verified \`${pointer.command}\` (exit ${result.status})`,
    };
}
