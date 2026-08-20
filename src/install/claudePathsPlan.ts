/**
 * The Claude Code `paths:` emission plan — which globs a rule projects, and which
 * it deliberately does not.
 *
 * Extracted from `condense.ts` on 2026-08-20 (road-to-single-delivery Phase 5).
 * Two reasons, and the second is the one that made it worth doing now.
 *
 * It belongs here on its own merits: this is host-activation-key logic, the same
 * subject as `emit_host_rules_cli.ts` beside it, and `condense.ts` is the
 * orchestrator that calls it rather than the place it lives.
 *
 * And it pays for the phase that moved it. Phase 5.1 removed the path triggers
 * from four package-only rules so they load unconditionally — a change ABOUT
 * this plan — and wiring the delivery partition into `condense.ts` and
 * `install.ts` added lines to two files already past the 1,500-line source
 * ceiling, where `check_source_size_budget` counts every added line as a
 * violation. That gate's own convention is that the total moves down through
 * extraction and never up through a baseline raise, so the extraction is the fix
 * rather than a favour: the plan lands in a module under the ceiling, and the
 * ratchet sees a net improvement instead of a regression.
 *
 * Side-effect-free, no CLI entry, no `process.exit`.
 */

/**
 * Derive host-native activation globs from a rule's `triggers:` frontmatter
 * (road-to-request-scoped-rule-load Phase 2). `file_pattern` triggers map
 * verbatim; `path_prefix` triggers map to `<prefix>**`. Keyword / phrase /
 * command triggers produce no glob — those rules stay
 * description-activated (Cursor Agent-Requested / Windsurf model_decision).
 */
export function derive_trigger_globs(meta: Record<string, unknown>): string[] {
    const triggers = meta['triggers'];
    if (!Array.isArray(triggers)) {
        return [];
    }
    const globs: string[] = [];
    for (const t of triggers) {
        if (t === null || typeof t !== 'object' || Array.isArray(t)) continue;
        const obj = t as Record<string, unknown>;
        if (typeof obj['file_pattern'] === 'string' && obj['file_pattern']) {
            globs.push(obj['file_pattern']);
        } else if (typeof obj['path_prefix'] === 'string' && obj['path_prefix']) {
            const prefix = obj['path_prefix'] as string;
            globs.push(prefix.endsWith('/') ? `${prefix}**` : `${prefix}**`);
        }
    }
    // De-dup, keep declaration order (deterministic output).
    return [...new Set(globs)];
}

/**
 * A brace group the host expands, versus an agent-config placeholder that only
 * LOOKS like one.
 *
 * `path_prefix: "{module_root}/"` in `roadmap-ci-steps-policy` is resolved by
 * this suite from `modules.root_paths`. Emitted verbatim into a host `paths:`
 * list it is a brace group with no comma, which the host expands to the literal
 * string `{module_root}` — a pattern that matches no file. The rule would then
 * reach the model **never** instead of on-demand, and nothing would say so: the
 * probed contract records this exact degradation as silent
 * (`claude-code-rules-dir-contract.md` § constraints).
 *
 * Dropping the pattern is fail-safe in the one direction that matters. A rule
 * left with no pattern at all carries no `paths:` key and loads
 * unconditionally — the status quo, not a regression. A rule carrying a
 * no-op pattern is invisible.
 *
 * The discriminator is the comma, not a placeholder allowlist: `{ts,tsx}` is a
 * real alternation, `{module_root}` cannot be one.
 */
export function _is_unresolved_placeholder(pattern: string): boolean {
    for (const m of pattern.matchAll(/\{([^}]*)\}/g)) {
        if (!(m[1] as string).includes(',')) {
            return true;
        }
    }
    return false;
}

/**
 * `[` opens a bracket expression for the host. An unparseable one makes that
 * pattern match nothing while the rule's other patterns keep working — so a
 * literal `[` in a trigger is escaped rather than trusted.
 */
export function _escape_claude_bracket(pattern: string): string {
    return pattern.replace(/\[/g, '\\[');
}

/**
 * Expanded-pattern cost of one glob: the product of its brace alternations.
 * The host budgets a rule's whole `paths:` list at 1,000 expanded patterns and
 * 4 MiB, and a list over budget is used UNEXPANDED — braces then match
 * literally, i.e. nothing. Counting keeps the emitter under the cliff instead
 * of discovering it as a silent no-op.
 */
export function _expanded_pattern_count(pattern: string): number {
    let n = 1;
    for (const m of pattern.matchAll(/\{([^}]*)\}/g)) {
        n *= (m[1] as string).split(',').length;
    }
    return n;
}

/** Host-documented budget for one rule's whole `paths:` list. */
export const CLAUDE_PATHS_PATTERN_BUDGET = 1000;

export interface ClaudePathsPlan {
    /** Patterns to emit under `paths:`, in declaration order. */
    globs: string[];
    /** Patterns deliberately not emitted, with the reason a reader can act on. */
    dropped: { pattern: string; reason: 'unresolved-placeholder' | 'over-budget' | 'mixed-triggers' }[];
}

/**
 * Does this rule declare any trigger that is NOT path-shaped?
 *
 * Load-bearing for `_claude_paths_plan` below, because one `triggers:` list
 * means two different things on two hosts. Cursor and Windsurf treat globs as
 * ADDITIVE — a rule with empty globs still reaches the agent through its
 * description (see `_emit_cursor_mdc`'s own comment). Claude Code treats
 * `paths:` as EXCLUSIVE: with it the rule loads on a path match; without it the
 * rule loads unconditionally. The emitter fed both semantics from one list, so
 * a rule that declared keywords *and* one path glob silently became
 * path-gated-only on Claude.
 */
export function _has_non_path_trigger(meta: Record<string, unknown>): boolean {
    const triggers = meta['triggers'];
    if (!Array.isArray(triggers)) return false;
    for (const t of triggers) {
        if (t === null || typeof t !== 'object' || Array.isArray(t)) continue;
        const obj = t as Record<string, unknown>;
        if (typeof obj['keyword'] === 'string' && obj['keyword']) return true;
        if (typeof obj['phrase'] === 'string' && obj['phrase']) return true;
    }
    return false;
}

/**
 * Derive the host's `paths:` list for one rule, with every drop recorded.
 *
 * Kernel / always-apply rules get an EMPTY list on purpose: absent `paths:` is
 * how this host says "load unconditionally", which is exactly what an Iron-Law
 * rule needs. Scoping one would be a correctness regression dressed as a byte
 * saving — and the same contract notes path-scoped rules are not re-injected
 * after `/compact`, so an obligation that must survive compaction cannot be
 * path-scoped at all.
 */
export function _claude_paths_plan(meta: Record<string, unknown>): ClaudePathsPlan {
    const always_apply = Boolean(meta['alwaysApply'] || meta['type'] === 'always');
    if (always_apply) {
        return { globs: [], dropped: [] };
    }
    const globs: string[] = [];
    const dropped: ClaudePathsPlan['dropped'] = [];

    // A rule that ALSO declares keyword / phrase triggers gets no `paths:` at
    // all, and therefore keeps loading unconditionally on Claude Code.
    //
    // Emitting `paths:` here would narrow the rule to a path match and discard
    // every keyword the author wrote, because this host reads the list as the
    // whole gate rather than as one way in. Measured before this guard: 25 of
    // 110 projected rules carried `paths:` and 19 of them also carried keyword
    // triggers — `design-fidelity` lost 21 of them, in exactly the pasted-
    // screenshot and capability-URL handovers its own routing section names as
    // the classes it exists to catch. Nothing in the tree recorded a decision
    // to make that trade, which is why it is treated as a defect.
    //
    // The drop is REPORTED rather than silent, so a rule whose obligation
    // really is path-bound is visible as a candidate for removing its keyword
    // triggers — the narrowing then becomes an authoring decision instead of an
    // emitter side effect. Cursor and Windsurf are untouched: globs are
    // additive there, so the same rule keeps both routes.
    if (_has_non_path_trigger(meta)) {
        for (const raw of derive_trigger_globs(meta)) {
            dropped.push({ pattern: raw, reason: 'mixed-triggers' });
        }
        return { globs, dropped };
    }

    let spent = 0;
    for (const raw of derive_trigger_globs(meta)) {
        if (_is_unresolved_placeholder(raw)) {
            dropped.push({ pattern: raw, reason: 'unresolved-placeholder' });
            continue;
        }
        const cost = _expanded_pattern_count(raw);
        if (spent + cost > CLAUDE_PATHS_PATTERN_BUDGET) {
            dropped.push({ pattern: raw, reason: 'over-budget' });
            continue;
        }
        spent += cost;
        globs.push(_escape_claude_bracket(raw));
    }
    return { globs, dropped };
}
