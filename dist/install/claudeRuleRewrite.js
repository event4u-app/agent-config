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
/**
 * Frontmatter keys the rewrite must carry across, and why each one.
 *
 * `_inject_package_tag` (install.ts) writes these during the copy that runs
 * immediately BEFORE this rewrite. `reap_tagged_orphans` then matches on the
 * literal `package:` line — its own docblock calls itself "the only path with
 * ownership proof independent of inventory history" — and doctor's stale-orphan
 * check reads the same tag.
 *
 * A rewrite that rebuilt each file from the activation plan alone therefore
 * DELETED the reaper's only evidence: zero files under the host anchor would
 * carry the tag, the marker-based reaper would be dead for that subtree, and
 * doctor would report `ok` there permanently. Found by the completion review of
 * 2026-08-30, with a fixture: a tagged orphan was reaped before the rewrite and
 * invisible after it.
 *
 * So the host form is activation keys PLUS these, and the two concerns are kept
 * apart on purpose — {@link renderClaudeRule} stays activation-only so it can go
 * on being compared byte-for-byte against the projection emitter, which never
 * sees an install-time tag.
 */
export const PRESERVED_KEYS = ['package', 'source_path'];
/**
 * Splice the ownership keys of `original` into the activation-only `rendered`.
 *
 * Raw lines are carried across verbatim rather than re-serialised, so a quoted
 * or unusually-spaced value cannot drift on the way through — the reaper matches
 * a literal.
 */
export function _withPreservedKeys(rendered, original) {
    const keep = [];
    if (original.startsWith('---')) {
        const end = original.indexOf('\n---', 3);
        if (end !== -1) {
            for (const line of original.slice(3, end).split('\n')) {
                if (PRESERVED_KEYS.some((k) => line.startsWith(`${k}:`)))
                    keep.push(line);
            }
        }
    }
    if (keep.length === 0)
        return rendered;
    if (rendered.startsWith('---\n')) {
        const end = rendered.indexOf('\n---', 3);
        if (end !== -1) {
            return rendered.slice(0, end) + '\n' + keep.join('\n') + rendered.slice(end);
        }
    }
    // No activation block: the rule loads unconditionally and still needs its
    // tag, so it gets a frontmatter block holding ONLY the ownership keys.
    return ['---', ...keep, '---', '', rendered].join('\n');
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
export function rewriteAndReport(rulesDir, quiet, info, warn, wrappers) {
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
            info(`  claude-code: ${wrappers.wrapped.length} visible flat command(s) projected as ` +
                'skill wrappers (Claude Code flat-command discovery workaround)');
        }
        if (wrappers.reserved.length > 0) {
            info(`  claude-code: ${wrappers.reserved.length} flat command(s) withheld — name is a ` +
                `Claude Code built-in (${wrappers.reserved.join(', ')}); nested /cluster:sub ` +
                'commands remain available');
        }
    }
    if (result.rewritten > 0 && !quiet) {
        info(`  claude-code: ${result.rewritten} rule(s) rewritten to host form; ` +
            `${result.scoped.length} path-scoped (${result.scoped.join(', ') || 'none'})`);
    }
    // NOT one line per dropped pattern. Every mixed-trigger rule drops every
    // pattern it has, by design and permanently, so the per-pattern loop emitted
    // 19 stderr lines on every single install — unactionable by any consumer,
    // surviving --quiet because `warn` writes unconditionally. This repository
    // has already recorded its verdict on exactly that pattern elsewhere in the
    // emitter. One counted line under --quiet's own guard; the detail stays in
    // the returned struct for a caller that wants it.
    if (result.dropped.length > 0 && !quiet) {
        const rules = [...new Set(result.dropped.map((d) => d.rule))];
        info(`  claude-code: ${rules.length} rule(s) keep unconditional activation ` +
            '(mixed path + keyword triggers; `paths:` is exclusive on this host)');
    }
    for (const f of result.failed) {
        warn(`  claude-code: ${f.rule}: could not write host form — ${f.reason}`);
    }
    return result;
}
/** Python `str.rstrip()` with no args — mirrors `condense.ts::_pyRstrip`. */
function pyRstrip(s) {
    return s.replace(/\s+$/u, '');
}
/** Mirrors `condense.ts::_yaml_scalar`. */
function yamlScalar(value) {
    return JSON.stringify(value);
}
/**
 * Render one rule's host form from its source text.
 *
 * Exported for the equivalence test. A rule with no path-shaped trigger gets
 * NO frontmatter at all rather than an empty block the host would ignore —
 * keys that do nothing are bytes in every session's standing context.
 */
export function renderClaudeRule(sourceText) {
    const [meta, body] = parseFrontmatter(sourceText);
    const plan = _claude_paths_plan(meta);
    const lines = [];
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
export function rewriteClaudeRules(rulesDir) {
    const result = { rewritten: 0, scoped: [], dropped: [], failed: [] };
    let entries;
    try {
        entries = fs.readdirSync(rulesDir);
    }
    catch {
        return result;
    }
    for (const name of entries.filter((n) => n.endsWith('.md')).sort()) {
        const full = path.join(rulesDir, name);
        let stat;
        try {
            stat = fs.lstatSync(full);
        }
        catch {
            continue;
        }
        // A symlink here is the legacy raw-md farm, not an installed copy.
        // Rewriting through it would write into the projection source.
        if (!stat.isFile() || stat.isSymbolicLink())
            continue;
        let text;
        try {
            text = fs.readFileSync(full, 'utf-8');
        }
        catch {
            continue;
        }
        const [meta] = parseFrontmatter(text);
        // Already host form: `paths:` present and no source vocabulary left.
        if (meta['paths'] !== undefined && meta['triggers'] === undefined)
            continue;
        const rendered = renderClaudeRule(text);
        const withOwnership = _withPreservedKeys(rendered.text, text);
        if (withOwnership !== text) {
            try {
                fs.writeFileSync(full, withOwnership, 'utf-8');
            }
            catch (e) {
                // A single unwritable rule — a root-owned file left by an
                // earlier `sudo` install — must not abort the whole install and
                // skip every remaining tool, the inventory record, the lockfile
                // correction and the fingerprint stamp. Report and continue.
                result.failed.push({
                    rule: name.slice(0, -3),
                    reason: e instanceof Error ? e.message : String(e),
                });
                continue;
            }
            result.rewritten += 1;
        }
        const stem = name.slice(0, -3);
        if (rendered.globs.length > 0)
            result.scoped.push(stem);
        for (const d of rendered.dropped) {
            result.dropped.push({ rule: stem, pattern: d.pattern, reason: d.reason });
        }
    }
    return result;
}
//# sourceMappingURL=claudeRuleRewrite.js.map