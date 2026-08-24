/**
 * The agency bound each CLI council member is spawned under — one definition.
 *
 * A council member is a text-in/text-out oracle: it reads a question and returns
 * an opinion. It never edits, never runs a command, never fetches. Every CLI here
 * is an AGENTIC binary that grants tools by default, so an unbounded spawn hands
 * a read-write agent to a role that needs none of it — the over-broad grant
 * `tool-safety` § Least Agency exists to refuse.
 *
 * ## Why this is a module and not five literals in `clients.ts`
 *
 * The flags appeared in two places at once: the `_build_command` of each client,
 * and `cli_least_agency_canary.ts`, which must spawn the SAME argv to prove the
 * bound is honoured. Two copies of a value whose entire purpose is to be
 * verified is a drift waiting to happen — the canary would keep passing against
 * a flag `clients.ts` had stopped sending.
 *
 * ## Every entry is PROBED, and carries the version it was probed against
 *
 * A flag that exists in one release and not the next is a claim with a shelf
 * life. `probed_version` is the string that CLI's own `--version` printed on
 * `probed_on`; a member whose binary could not be resolved carries `null` for
 * both and is an honest null, never a guessed flag.
 *
 * ## `control` is a permissive VALUE, not the absence of `bound`
 *
 * Measured 2026-08-23: with no `--sandbox` in argv at all, codex answers
 * `patch rejected: writing is blocked by read-only sandbox; rejected by user
 * approval settings` — its ambient default is already restrictive. So "omit the
 * bound" is not an unbounded control there, and a canary using one is confounded
 * by a per-machine setting it never recorded. The control is the smallest
 * documented step ABOVE the bound, never the widest.
 */

/** One member's bound, its control counterpart, and the probe behind them. */
export interface AgencyBound {
    /** Council member key (`anthropic`, `openai`, …). */
    readonly member: string;
    /** The binary the transport resolves. */
    readonly binary: string;
    /** The argv fragment that bounds the spawn. Empty = no bound determined. */
    readonly bound: readonly string[];
    /**
     * The permissive counterpart the canary uses as its control. Empty means
     * "omit the bound", which is only correct where the CLI's default genuinely
     * grants the capability — verified per member, never assumed.
     */
    readonly control: readonly string[];
    /** What that CLI's own `--version` printed, or null when the binary is absent. */
    readonly probed_version: string | null;
    /** ISO date of the probe, or null when the binary is absent. */
    readonly probed_on: string | null;
    /** Why this flag and not a sibling — the part a reader cannot re-derive. */
    readonly rationale: string;
}

export const AGENCY_BOUNDS: readonly AgencyBound[] = [
    {
        member: 'anthropic',
        binary: 'claude',
        bound: ['--tools', ''],
        // Omission IS the control here, and it is verified rather than assumed:
        // the control arm created the sentinel on 2026-08-23, so the default
        // genuinely grants the write capability.
        control: [],
        probed_version: '2.1.241 (Claude Code)',
        probed_on: '2026-08-23',
        rationale:
            '`claude` grants its full built-in tool set by default; `""` is the documented "disable all tools" value. ' +
            'Predates this module — added after a live context-window overflow rather than a security pass, which is ' +
            'why the canary exists at all.',
    },
    {
        member: 'openai',
        binary: 'codex',
        bound: ['--sandbox', 'read-only'],
        control: ['--sandbox', 'workspace-write'],
        probed_version: 'codex-cli 0.148.0',
        probed_on: '2026-08-23',
        rationale:
            '`codex exec --help` documents `-s, --sandbox <SANDBOX_MODE>` with `read-only`, `workspace-write`, ' +
            '`danger-full-access`. It sits BESIDE `--skip-git-repo-check`, never instead of it: the trust gate is what ' +
            'makes a worktree usable at all, the sandbox bounds what the session may then do, and before this the argv ' +
            'carried the guard REMOVAL with no counterpart. Control is `workspace-write`, the smallest documented step ' +
            'up — never `danger-full-access`.',
    },
    {
        member: 'gemini',
        binary: 'gemini',
        bound: ['--approval-mode', 'plan'],
        control: ['--approval-mode', 'auto_edit'],
        probed_version: '0.50.0',
        probed_on: '2026-08-23',
        rationale:
            '`gemini --help` lists `plan (read-only mode)`. NOT `--allowed-tools`, which the same help marks ' +
            '`DEPRECATED: Use Policy Engine instead` — pinning to it would bind the council to a surface the vendor is ' +
            'retiring. The siblings move the wrong way: `-y/--yolo` auto-accepts every action, `auto_edit` auto-approves ' +
            'edit tools, which is exactly why `auto_edit` is the control and not the bound.',
    },
    {
        member: 'xai',
        binary: 'grok',
        bound: [],
        control: [],
        probed_version: null,
        probed_on: null,
        rationale:
            'not-probed — binary absent on the probing machine. No flag is guessed: a member whose bound was never ' +
            'determined must not be rendered as bounded.',
    },
    {
        member: 'perplexity',
        binary: 'perplexity',
        bound: [],
        control: [],
        probed_version: null,
        probed_on: null,
        rationale: 'not-probed — binary absent on the probing machine. Same refusal to guess as `xai`.',
    },
];

/** The bound argv fragment for a member, or `[]` when none was determined. */
export function boundFor(member: string): readonly string[] {
    return AGENCY_BOUNDS.find((b) => b.member === member)?.bound ?? [];
}

/**
 * Documented flags that LIFT an agency bound.
 *
 * A bound is only a bound if the argv cannot also carry the flag that removes
 * it, and a presence check on the bound alone passes with both present.
 */
export const AGENCY_BYPASS_FLAGS: readonly string[] = [
    '--dangerously-bypass-approvals-and-sandbox',
    '--dangerously-bypass-hook-trust',
    '--yolo',
    'danger-full-access',
    'workspace-write',
];
