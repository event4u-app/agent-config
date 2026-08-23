/**
 * skillRanking — the ONE definition of "how relevant is this skill to this task".
 *
 * WHY IT LIVES HERE. Two callers need the identical answer and were about to
 * grow two implementations of it:
 *
 *   - `src/scripts/skill_tools/score_skill_relevance.ts` — the disk-reading
 *     ranker behind the kernel MCP server's `suggest_skill_for_task` and the
 *     `skill-route` hook.
 *   - `src/cli/mcp/dispatch.ts` — the turnkey stdio server, which must stay a
 *     pure function of its in-memory content tree and therefore cannot call a
 *     module that walks the file system.
 *
 * `road-to-skill-delivery-over-mcp` risk 6 names that fork by name: "two
 * implementations of `suggest_skill_for_task` diverge silently". The fix is to
 * put the formula in one Node-free module both can import, which is what this
 * is. `src/shared/` is the only directory in the tree that both `src/scripts/`
 * and `src/cli/` already import from, and it is required to stay Node-free —
 * exactly the constraint the pure dispatcher needs.
 *
 * THE FORMULA IS UNCHANGED. It is the Python-parity scorer ported in ADR-200,
 * moved rather than rewritten: `score = round(term_overlap * 70 + persona_hit *
 * 30)`, half-to-even, over tokens of the skill's `name + description`. The
 * `score_skill_relevance` CLI's argparse-parity suite is the check that the move
 * changed nothing.
 *
 * THE ONE ADDITION is `triggerTerms`, off by default. Phase 3.1 of the same
 * roadmap indexes `triggers.keyword` / `triggers.phrase` text; it is an opt-in
 * parameter rather than a second function so the two rankers can be measured
 * against each other on one corpus.
 *
 * Pure — no imports, no I/O, no clock.
 */

// re.compile(r"[a-z][a-z0-9]+") — applied to the lowercased text.
const TOKEN_RE = /[a-z][a-z0-9]+/g;

/** Ported verbatim from the Python scorer. Order is irrelevant; membership is not. */
export const STOPWORDS: ReadonlySet<string> = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'of', 'for', 'with', 'to', 'in',
    'on', 'at', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
    'this', 'that', 'these', 'those', 'it', 'its', 'use', 'when', 'even',
    'via', 'via:', 'into', 'onto', 'use:', 'skill', 'skills', 'task', 'tasks',
    'code', 'file', 'files', 'doing', 'make', 'do', 'go', 'get', 'set',
    'not', 'no', 'yes', 'any', 'some', 'all', 'one', 'two', 'new', 'old',
    'user', 'users', 'our', 'your', 'their', 'they', 'we', 'you', 'i', 'me',
]);

/** Mirror Python `len(str)` — count Unicode code points, not UTF-16 units. */
function pyLen(s: string): number {
    let n = 0;
    for (const _ of s) n++;
    return n;
}

/** Mirror Python `round(x)` — half-to-even. Exact for integral ndigits. */
export function roundHalfToEven(x: number): number {
    if (!Number.isFinite(x)) return x;
    const floor = Math.floor(x);
    const frac = x - floor;
    if (frac < 0.5) return floor;
    if (frac > 0.5) return floor + 1;
    return floor % 2 === 0 ? floor : floor + 1;
}

/** Lowercase, extract `[a-z][a-z0-9]+`, drop stopwords and tokens of ≤2 code points. */
export function tokenize(text: string): Set<string> {
    const out = new Set<string>();
    const matches = text.toLowerCase().match(TOKEN_RE) ?? [];
    for (const t of matches) {
        if (!STOPWORDS.has(t) && pyLen(t) > 2) out.add(t);
    }
    return out;
}

/** A skill as the ranker sees it. Deliberately not the body — see `rankSkills`. */
export interface RankableSkill {
    name: string;
    description: string;
    personas?: readonly string[];
    /** `triggers[].keyword` / `triggers[].phrase` text. Indexed only on request. */
    triggerText?: readonly string[];
}

export interface RankOptions {
    /** Phase 3.1: fold `triggerText` into the indexed terms. Default false (keyword-v1). */
    includeTriggers?: boolean;
}

/** The indexed term set for one skill, under the given options. */
export function skillTerms(skill: RankableSkill, opts: RankOptions = {}): Set<string> {
    const parts = [skill.name, skill.description];
    if (opts.includeTriggers && skill.triggerText) parts.push(...skill.triggerText);
    return tokenize(parts.join(' '));
}

/**
 * The score. `taskTerms` is `tokenize(task)`; `terms` is `skillTerms(skill)`.
 *
 * Both are passed in rather than derived here so a caller ranking N skills
 * tokenizes the task once and each skill once, which is what makes this usable
 * on a per-prompt hook path.
 */
export function scoreSkill(
    taskTerms: ReadonlySet<string>,
    skill: RankableSkill,
    terms: ReadonlySet<string>,
): number {
    if (taskTerms.size === 0) return 0;
    let inter = 0;
    for (const t of taskTerms) if (terms.has(t)) inter++;
    const overlap = inter / Math.max(taskTerms.size, 1);
    let personaHit = 0;
    const taskLower = [...taskTerms].join(' ');
    for (const persona of skill.personas ?? []) {
        const slug = String(persona).toLowerCase();
        if (taskLower.includes(slug) || slug.split('-').some((part) => taskTerms.has(part))) {
            personaHit = 1;
            break;
        }
    }
    return roundHalfToEven(overlap * 70 + personaHit * 30);
}

export interface RankedSkill {
    name: string;
    score: number;
    personas: string[];
}

/**
 * Rank an in-memory skill set. Zero scores are dropped; ties break on name, so
 * the result is a total order and two callers with the same input agree.
 */
export function rankSkills(
    task: string,
    skills: readonly RankableSkill[],
    opts: RankOptions = {},
): RankedSkill[] {
    const taskTerms = tokenize(task);
    const rows: RankedSkill[] = [];
    for (const skill of skills) {
        const score = scoreSkill(taskTerms, skill, skillTerms(skill, opts));
        if (score > 0) rows.push({ name: skill.name, score, personas: [...(skill.personas ?? [])] });
    }
    rows.sort((a, b) => (b.score - a.score) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return rows;
}
