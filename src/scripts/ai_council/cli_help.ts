/**
 * Sub-help rendering for the council CLI.
 *
 * Lives here rather than in `council_cli.ts` for a measured reason: that file
 * sits ~2,500 lines above the 1,500-line source ceiling, and
 * `check_source_size_budget` is a shrink-only ratchet — every line added there
 * is a new violation, so a 45-line help renderer reds the build. Extraction is
 * the documented response; raising the baseline is not.
 *
 * WHAT IT FIXES. `council run --help` printed `usage: agent-config council run
 * [-h] ...` and no flag list at all. Measured 2026-08-20: a first council run
 * cost six calls, two of them spent discovering `--confirm` and `--output` by
 * grepping the CLI source. The information was available at runtime all along —
 * the parser's own spec table carries it — it simply was not printed.
 *
 * Rendered from those specs rather than hand-listed on purpose: a hand-written
 * flag list is a second source of truth that drifts the first time a flag is
 * added.
 */

/** The shape `council_cli`'s spec table exposes, narrowed to what help needs. */
export interface HelpSpec {
    readonly positionals: readonly string[];
    readonly opts: readonly { readonly flag: string; readonly takesValue: boolean; readonly choices?: readonly string[] | null }[];
    readonly requiredOpts: readonly string[];
}

/**
 * `usageLine` first (its exact text is asserted elsewhere and must not move),
 * then positionals, then every flag with its value shape and a `[required]`
 * marker where the parser demands one.
 */
export function renderSubHelp(_cmd: string, usageLine: string, spec: HelpSpec): string {
    const lines: string[] = [usageLine.trimEnd()];
    if (spec.positionals.length > 0) {
        lines.push('', 'positional arguments:');
        for (const p of spec.positionals) {
            lines.push(`  ${p}`);
        }
    }
    if (spec.opts.length > 0) {
        lines.push('', 'options:');
        const required = new Set(spec.requiredOpts);
        for (const o of spec.opts) {
            const value = o.takesValue
                ? o.choices && o.choices.length > 0
                    ? ` {${o.choices.join(',')}}`
                    : ' VALUE'
                : '';
            lines.push(`  ${o.flag}${value}${required.has(o.flag) ? '   [required]' : ''}`);
        }
    }
    lines.push('');
    return lines.join('\n');
}
