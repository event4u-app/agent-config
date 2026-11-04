/**
 * Reasoning effort for a council seat — how much thinking a member spends per
 * answer, separate from which model it runs.
 *
 * Before this module no council path set an effort, so every CLI seat ran at
 * its vendor default. On a subscription seat the default is the expensive end
 * of the dial, and the council asks a member for an opinion, not for a search
 * of every alternative.
 *
 * Resolution, first hit wins: the `--effort` flag of this invocation → the
 * member's `effort:` key → the lens default below. `null` everywhere means the
 * vendor default, which is exactly the pre-module behaviour.
 */

export type Effort = 'low' | 'medium' | 'high';

export const EFFORT_LEVELS: readonly Effort[] = ['low', 'medium', 'high'];

/**
 * Lens defaults. Only the lenses where a second look at alternatives IS the
 * product get `high`; review-shaped lenses get `medium`; the rest `low`.
 */
export const LENS_DEFAULT_EFFORT: Readonly<Record<string, Effort>> = {
    default: 'low',
    prompt: 'low',
    roadmap: 'medium',
    optimize: 'low',
    design: 'medium',
    pr: 'medium',
    diff: 'medium',
    files: 'medium',
    analysis: 'medium',
    debate: 'high',
};

export function isEffort(v: unknown): v is Effort {
    return typeof v === 'string' && (EFFORT_LEVELS as readonly string[]).includes(v);
}

/** Parse a configured value; `null`/absent stays `null`, anything else is an error message. */
export function parseEffort(raw: unknown, where: string): { effort: Effort | null } | { error: string } {
    if (raw === null || raw === undefined) return { effort: null };
    if (isEffort(raw)) return { effort: raw };
    return { error: `${where} must be one of ${EFFORT_LEVELS.join(', ')} (got ${JSON.stringify(raw)}).` };
}

export function resolveEffort(opts: {
    flag?: string | null | undefined;
    member?: string | null | undefined;
    lens?: string | null | undefined;
}): Effort | null {
    if (isEffort(opts.flag)) return opts.flag;
    if (isEffort(opts.member)) return opts.member;
    if (opts.lens !== null && opts.lens !== undefined) return LENS_DEFAULT_EFFORT[opts.lens] ?? null;
    return null;
}

/**
 * True when `version` is on the same `major.minor` line as `probed` and not
 * older. A flag probed on one patch release keeps working across the patch
 * releases after it far more often than not, and an exact-version match
 * silently drops the flag on every CLI update — which is how the light seat
 * launch stopped applying without anyone noticing. A new minor line still
 * needs its own probe.
 */
export function onProbedLine(version: string | null, probed: string): boolean {
    if (version === null) return false;
    const a = /(\d+)\.(\d+)\.(\d+)/.exec(version);
    const b = /(\d+)\.(\d+)\.(\d+)/.exec(probed);
    if (a === null || b === null) return false;
    if (a[1] !== b[1] || a[2] !== b[2]) return false;
    return Number(a[3]) >= Number(b[3]);
}

/** The `claude --effort` flag first seen on this version (`claude --help`, 2026-11-04). */
export const CLAUDE_EFFORT_PROBED_VERSION = '2.1.316 (Claude Code)';

/** argv fragment for an `anthropic` CLI seat; `[]` when unset or the binary predates the flag. */
export function claudeEffortArgs(effort: Effort | null, version: string | null): string[] {
    if (effort === null || !onProbedLine(version, CLAUDE_EFFORT_PROBED_VERSION)) return [];
    return ['--effort', effort];
}

/**
 * argv fragment for an `openai` (codex) CLI seat. `-c` overrides a config key,
 * and codex ignores a key it does not know unless `--strict-config` is set, so
 * this needs no version gate.
 */
export function codexEffortArgs(effort: Effort | null): string[] {
    if (effort === null) return [];
    return ['-c', `model_reasoning_effort="${effort}"`];
}
