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

import { DEFAULT_SUGGEST_LIMIT } from '../../shared/skillRanking.js';
// TYPE-only, so the `tools.ts` <-> this cycle is erased at runtime: the
// allowlist spreads the entry below in, and the entry names the shape the
// allowlist declares. A value import either way would be a real cycle.
import type { BuiltinTool } from './tools.js';

/**
 * `suggest_skill_for_task` — the recovery path for a truncated catalogue.
 *
 * Promoted from a discovery stub because the defect it answers is measured, not
 * hypothetical: on the one host that publishes its own truncation, a default
 * install had 402 entries dropped from the model-visible skills list — the
 * host's own count against its own denominator, not a subtraction over ours.
 * An agent
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
        typeof limitRaw === 'number' && Number.isFinite(limitRaw)
            ? Math.floor(limitRaw)
            : DEFAULT_SUGGEST_LIMIT;

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

    const { rankDetailed } = await import('../skill_tools/score_skill_relevance.js');
    const { rows, descriptions } = rankDetailed(task, roots);
    return {
        status: 'ok',
        // `skills_root` kept verbatim (a consumer may read it); `skills_roots` is
        // the additive truth about what was actually ranked.
        skills_root: roots[0] as string,
        skills_roots: roots,
        // `description` rides with the row because a NAME is not a choosing
        // criterion. A caller handed five names either guesses or opens five
        // bodies; handed five descriptions it reads the one text each skill
        // wrote as its routing criteria — including the handoff clauses that
        // say when NOT to use it, which only act on a reader. Each is capped at
        // 200 characters by `skill.schema.json`, so the envelope grows by a
        // bounded amount per row and no body is returned at any depth.
        suggestions: rows
            .slice(0, Math.max(1, limit))
            .map(([name, score, personas]) => ({
                skill: name,
                score,
                personas,
                description: descriptions.get(name) ?? '',
            })),
    };
}

/**
 * The allowlist ENTRY, declared here rather than in `tools.ts`.
 *
 * Same argument the handler was extracted on, applied to its metadata. `tools.ts`
 * sits far past the 1,500-line ceiling `check_source_size_budget` enforces as a
 * shrink-only ratchet, so every line there costs one unit of excess and the gate
 * names re-pinning the baseline a defect rather than a fix. Describing this tool
 * properly — what a row now carries, and why the default depth is 8 — cost six
 * lines there and reddened the ratchet; moving the whole entry across returns
 * thirty-seven and puts the prose in the file that already owns the behaviour it
 * describes.
 */
export const SUGGEST_SKILL_TOOL: BuiltinTool = {
    name: 'suggest_skill_for_task',
    side_effect: 'ro',
    description:
        'Match a free-form task description to the most relevant skills, ' +
        'ranked by a deterministic keyword scorer over SKILL.md ' +
        'frontmatter. Use when a skill you need is not in the catalogue ' +
        'the host delivered — a measured host dropped 402 entries from ' +
        'its model-visible list — so asking by name is impossible while ' +
        'asking by task is not. ' +
        "Each row carries the skill's own description — its routing " +
        'criteria, including any clause pointing elsewhere. Choose by ' +
        'reading the rows, then open at most two bodies with read_skill. ' +
        'Read-only: no shell, no writes, no bodies — names, scores, ' +
        'personas and descriptions only.',
    input_schema: {
        type: 'object',
        required: ['task'],
        properties: {
            task: {
                type: 'string',
                description: 'Free-form description of the task to match skills against.',
            },
            limit: {
                type: 'integer',
                minimum: 1,
                default: DEFAULT_SUGGEST_LIMIT,
                description:
                    `Maximum number of skills to return. Defaults to ${String(DEFAULT_SUGGEST_LIMIT)}, ` +
                    'a pre-registered recall depth rather than a round number.',
            },
        },
        additionalProperties: false,
    },
    handler: suggestSkillForTask,
};
