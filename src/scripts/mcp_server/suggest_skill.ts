/**
 * The `suggest_skill_for_task` MCP handler, extracted from `tools.ts`.
 *
 * `tools.ts` sits ~580 lines past the 1,500-line ceiling `check_source_size_budget`
 * enforces as a shrink-only ratchet, so every line there costs one unit of excess
 * and the gate names re-pinning the baseline a defect rather than a fix. Adding a
 * `skills_roots` field to this handler's answer cost four; extracting the handler
 * pays that back many times over and puts it in a file where its prose is free.
 *
 * Cohesive on its own terms too: this is the one handler in the allowlist that
 * owns a ranking policy rather than reading a file, and it is the only consumer
 * of the skill-catalogue resolver on the server side.
 */

/**
 * `suggest_skill_for_task` — the recovery path for a truncated catalogue.
 *
 * Promoted from a discovery stub because the defect it answers is measured, not
 * hypothetical: on the one host that publishes its own truncation, a default
 * install had 402 entries dropped from the model-visible skills list — the
 * host's own count against its own denominator, not a subtraction over ours
 * (`agents/evidence/analysis/scoped-projection-host-delivery.md`). An agent
 * that cannot see a skill also cannot ask for it by name, so the only reachable
 * question is "what fits this task" — which is what the deterministic ranker
 * answers, over the TREE rather than over the host's catalogue.
 *
 * Read-only and shell-free by construction: it reads SKILL.md frontmatter and
 * returns names, scores and declared personas. No skill BODY is returned — the
 * caller opens what it picked, so a wrong rank costs one read rather than a
 * context payload.
 */
export async function suggestSkillForTask(
    args: Record<string, unknown>,
    consumerRoot: string,
): Promise<Record<string, unknown>> {
    const task = typeof args['task'] === 'string' ? args['task'] : '';
    if (task.trim() === '') {
        return { status: 'error', error: 'task must be a non-empty string', suggestions: [] };
    }
    // `limit`, not `top` — the stub published `limit` and a consumer may have
    // read that contract already. Renaming it on promotion would break a
    // caller for cosmetic reasons.
    const limitRaw = args['limit'];
    const limit =
        typeof limitRaw === 'number' && Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 5;

    const catalogue = await import('../_lib/skill_catalogue.js');
    // EVERY readable root — see `resolveSkillCatalogueRoots` on why not the first.
    const roots = catalogue.resolveSkillCatalogueRoots(consumerRoot);
    if (roots.length === 0) {
        // A missing catalogue is UNKNOWN, never "no skill fits this task". The
        // second reads as a ranked answer and would be a confident empty list —
        // the same zero-from-silence failure `capture_skill_catalogue` refuses.
        return {
            status: 'no_catalogue',
            searched: [...catalogue.DEFAULT_CATALOGUE_ROOTS],
            consumer_root: consumerRoot,
            suggestions: [],
        };
    }

    const { rank } = await import('../skill_tools/score_skill_relevance.js');
    const rows = rank(task, roots).slice(0, Math.max(1, limit));
    return {
        status: 'ok',
        // `skills_root` kept verbatim (a consumer may read it); `skills_roots` is
        // the additive truth about what was actually ranked.
        skills_root: roots[0] as string,
        skills_roots: roots,
        suggestions: rows.map(([name, score, personas]) => ({ skill: name, score, personas })),
    };
}
