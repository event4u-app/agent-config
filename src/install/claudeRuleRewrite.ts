/**
 * Rewrite installed Claude Code rule files into host form, in place.
 *
 * ## The gap this closes
 *
 * `condense.ts::_emit_claude_rule` shapes a rule for Claude Code — it emits
 * `paths:` and nothing else, because `paths:` is the one activation key the
 * probed contract records this host as reading. It runs on the MAINTAINER
 * projection path only. The installer's deploy loop copies
 * `dist/agent-src/rules/` verbatim into the host anchor
 * (`_copy_dir_dereferencing_symlinks`, `install.ts`), so an installed
 * `~/.claude/rules/` receives the SOURCE form: agent-config's own frontmatter
 * vocabulary (`type`, `tier`, `triggers`, …), none of which this host reads.
 *
 * Measured on a real install, 2026-08-30, before this module existed:
 *
 * ```
 * files 104 · declaring paths: 0
 * ⚠️  diverges from the source verdict (4 scoped)
 * ```
 *
 * The consequence is not cosmetic. On Claude Code `paths:` is EXCLUSIVE — with
 * it a rule loads on a path match, without it the rule loads unconditionally —
 * so three rules the emitter classifies path-only arrived in every session
 * instead of on file contact.
 *
 * ## Why it lives here and not in `condense.ts`
 *
 * Same reasoning `claudePathsPlan.ts` beside it records: this is
 * host-activation-key logic on the INSTALL side, and `condense.ts` is a
 * multi-thousand-line orchestrator already past the source-size ceiling. Both
 * of this module's inputs are already installer-side — `_claude_paths_plan`
 * from `claudePathsPlan.ts` and `parseFrontmatter` from `ruleInScope.ts` — so
 * nothing here reaches back into the projection graph, and the installer bundle
 * gains no dependency on it.
 *
 * The two emitters are held together by a test rather than by a shared call:
 * `tests/install/claude_rule_rewrite.test.ts` asserts, over every rule in
 * `src/rules/`, that this module's plan is byte-identical to the one
 * `condense.ts` emits. A divergence fails there rather than silently shipping
 * two different activation surfaces to the same host.
 *
 * Side-effect-free apart from the writes it is asked to make. No CLI entry, no
 * `process.exit`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { _claude_paths_plan } from './claudePathsPlan.js';
import { parseFrontmatter } from './ruleInScope.js';

export interface ClaudeRuleRewriteResult {
    /** Files read and rewritten. */
    rewritten: number;
    /** Basenames (without `.md`) that received a `paths:` block. */
    scoped: string[];
    /**
     * Patterns the plan deliberately dropped, per file — surfaced rather than
     * swallowed, because a dropped pattern silently widens a rule's activation
     * from path-gated to unconditional.
     */
    dropped: { rule: string; pattern: string; reason: string }[];
}

/**
 * Rewrite, then render the two operator-facing lines the installer prints.
 *
 * The reporting lives here rather than at the call site for the reason
 * `claudePathsPlan.ts` records for itself: `install.ts` is thousands of lines
 * past `check_source_size_budget`'s ceiling, where every added line counts as a
 * violation, and that gate's convention is that the total moves down through
 * extraction and never up through a baseline raise. So the caller gets one call
 * and a list of strings.
 */
export function rewriteAndReport(
    rulesDir: string,
    quiet: boolean,
    info: (m: string) => void,
    warn: (m: string) => void,
    wrappers?: { wrapped: readonly string[]; reserved: readonly string[] },
): ClaudeRuleRewriteResult {
    const result = rewriteClaudeRules(rulesDir);
    // The flat-command wrapper report rides along rather than sitting at the
    // call site: `install.ts` is thousands of lines past
    // `check_source_size_budget`'s ceiling, and this module is the one place
    // that already owns claude-code post-copy reporting. Moving it here is the
    // reduction that pays for this feature's own lines — that gate's stated
    // convention is that the total falls through extraction and never rises
    // through a baseline edit. Messages are byte-identical to the originals.
    if (wrappers && !quiet) {
        if (wrappers.wrapped.length > 0) {
            info(
                `  claude-code: ${wrappers.wrapped.length} visible flat command(s) projected as ` +
                    'skill wrappers (Claude Code flat-command discovery workaround)',
            );
        }
        if (wrappers.reserved.length > 0) {
            info(
                `  claude-code: ${wrappers.reserved.length} flat command(s) withheld — name is a ` +
                    `Claude Code built-in (${wrappers.reserved.join(', ')}); nested /cluster:sub ` +
                    'commands remain available',
            );
        }
    }
    if (result.rewritten > 0 && !quiet) {
        info(
            `  claude-code: ${result.rewritten} rule(s) rewritten to host form; ` +
                `${result.scoped.length} path-scoped (${result.scoped.join(', ') || 'none'})`,
        );
    }
    for (const d of result.dropped) {
        warn(
            `  claude-code: ${d.rule}: dropped \`paths:\` pattern ` +
                `${JSON.stringify(d.pattern)} (${d.reason})`,
        );
    }
    return result;
}

/** Python `str.rstrip()` with no args — mirrors `condense.ts::_pyRstrip`. */
function pyRstrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

/** Mirrors `condense.ts::_yaml_scalar`. */
function yamlScalar(value: string): string {
    return JSON.stringify(value);
}

/**
 * Render one rule's host form from its source text.
 *
 * Exported for the equivalence test. A rule with no path-shaped trigger gets
 * NO frontmatter at all rather than an empty block the host would ignore —
 * keys that do nothing are bytes in every session's standing context.
 */
export function renderClaudeRule(sourceText: string): {
    text: string;
    globs: string[];
    dropped: { pattern: string; reason: string }[];
} {
    const [meta, body] = parseFrontmatter(sourceText);
    const plan = _claude_paths_plan(meta);
    const lines: string[] = [];
    if (plan.globs.length > 0) {
        lines.push('---', 'paths:');
        for (const g of plan.globs) {
            lines.push(`  - ${yamlScalar(g)}`);
        }
        lines.push('---', '');
    }
    lines.push(pyRstrip(body) + '\n');
    return { text: lines.join('\n'), globs: plan.globs, dropped: plan.dropped };
}

/**
 * Rewrite every `*.md` directly under `rulesDir` into Claude host form.
 *
 * Idempotent: a file already in host form parses to `{paths: [...]}`, which
 * carries no `triggers:` key, so `_claude_paths_plan` returns no globs and the
 * rewrite would DROP the block. That is why the already-rewritten case is
 * detected and skipped rather than re-run — re-running is the silent-widening
 * failure this module exists to fix, applied to its own output.
 *
 * Returns counts rather than printing. The caller owns the reporting surface.
 */
export function rewriteClaudeRules(rulesDir: string): ClaudeRuleRewriteResult {
    const result: ClaudeRuleRewriteResult = { rewritten: 0, scoped: [], dropped: [] };
    let entries: string[];
    try {
        entries = fs.readdirSync(rulesDir);
    } catch {
        return result;
    }
    for (const name of entries.filter((n) => n.endsWith('.md')).sort()) {
        const full = path.join(rulesDir, name);
        let stat: fs.Stats;
        try {
            stat = fs.lstatSync(full);
        } catch {
            continue;
        }
        // A symlink here is the legacy raw-md farm, not an installed copy.
        // Rewriting through it would write into the projection source.
        if (!stat.isFile() || stat.isSymbolicLink()) continue;

        let text: string;
        try {
            text = fs.readFileSync(full, 'utf-8');
        } catch {
            continue;
        }
        const [meta] = parseFrontmatter(text);
        // Already host form: `paths:` present and no source vocabulary left.
        if (meta['paths'] !== undefined && meta['triggers'] === undefined) continue;

        const rendered = renderClaudeRule(text);
        if (rendered.text !== text) {
            fs.writeFileSync(full, rendered.text, 'utf-8');
            result.rewritten += 1;
        }
        const stem = name.slice(0, -3);
        if (rendered.globs.length > 0) result.scoped.push(stem);
        for (const d of rendered.dropped) {
            result.dropped.push({ rule: stem, pattern: d.pattern, reason: d.reason });
        }
    }
    return result;
}
