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
 * THE ADDITIONS ARE ALL OFF BY DEFAULT and live in one {@link RankOptions}
 * object: three that widen the indexed TERM SOURCE (trigger prose, the skill's
 * own `## When to use` section, the body's headings) and one that changes the
 * WEIGHTING (inverse document frequency over the catalogue). They are opt-in
 * parameters rather than separate functions so two configurations can be
 * measured against each other on one corpus without becoming two rankers. With
 * every flag off the arithmetic is the ported one, unchanged.
 *
 * Pure — no imports, no I/O, no clock.
 */

/**
 * The token shape. A LETTER followed by letters or digits, in any script.
 *
 * It was `re.compile(r"[a-z][a-z0-9]+")`, ported verbatim from the Python
 * scorer, and that class cannot see a letter outside ASCII. Reproduced on the
 * tree this replaced it in: `Prüfung` indexed as `fung`, `Größe` as nothing at
 * all, `Abhängigkeiten` as the two fragments `abh` and `ngigkeiten`. A prompt
 * written in German was therefore not ranked badly — most of its content words
 * were not ranked at all, because the class split each one at its first umlaut
 * and the pieces fell under the three-code-point floor below.
 *
 * `\p{L}` and `\p{N}` keep the ASCII behaviour byte-identical — the lowercased
 * `a-z` and `0-9` are a subset of both — so this is a widening and not a
 * different tokenizer. It is a CORRECTNESS fix and not a lift claim: the
 * before/after reading over the trigger corpus train slice is attached to the
 * change that made it, in `agents/evidence/analysis/`.
 */
const TOKEN_RE = /[\p{L}][\p{L}\p{N}]+/gu;

/**
 * Ported verbatim from the Python scorer. Order is irrelevant; membership is not.
 *
 * Kept as its own block rather than merged into the union below so that a
 * reader can still see exactly what the parity scorer dropped, which is the
 * thing the CLI parity suite pins.
 */
export const ENGLISH_STOPWORDS: ReadonlySet<string> = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'of', 'for', 'with', 'to', 'in',
    'on', 'at', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
    'this', 'that', 'these', 'those', 'it', 'its', 'use', 'when', 'even',
    'via', 'via:', 'into', 'onto', 'use:', 'skill', 'skills', 'task', 'tasks',
    'code', 'file', 'files', 'doing', 'make', 'do', 'go', 'get', 'set',
    'not', 'no', 'yes', 'any', 'some', 'all', 'one', 'two', 'new', 'old',
    'user', 'users', 'our', 'your', 'their', 'they', 'we', 'you', 'i', 'me',
]);

/**
 * The German block, beside the English one rather than inside it.
 *
 * WHY IT IS NEEDED AT ALL. The score is `|task ∩ skill| / |task|`, so a task
 * term no skill indexes sits in the DENOMINATOR. Before the token class above
 * was widened, a German function word mostly could not survive tokenization in
 * one piece; now it can, and every one that does divides the whole score of
 * every candidate. `das`, `die`, `der`, `und`, `für` carry no routing signal in
 * either language and would otherwise be charged for.
 *
 * WHAT IS IN IT, AND WHAT IS DELIBERATELY NOT. Function words — articles,
 * pronouns, conjunctions, prepositions, auxiliary and modal verbs — plus the
 * direct counterparts of the generic verbs the English block already drops
 * (`use`, `make`, `do`, `get`). Domain nouns are NOT in it: `fehler`, `test`,
 * `datei` and `prüfung` are exactly the words a German prompt routes on, and
 * mirroring the English block's `file` / `code` / `task` entries into German
 * would delete the signal this change exists to recover.
 *
 * Words of three code points or fewer never reach this set — `tokenize` drops
 * them first — so `in`, `am`, `zu`, `es` are listed nowhere and need not be.
 */
export const GERMAN_STOPWORDS: ReadonlySet<string> = new Set([
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem',
    'einer', 'eines', 'und', 'oder', 'aber', 'sondern', 'denn', 'also',
    'für', 'mit', 'von', 'vom', 'zum', 'zur', 'auf', 'aus', 'bei', 'beim',
    'nach', 'über', 'unter', 'durch', 'ohne', 'gegen', 'zwischen', 'vor',
    'ist', 'sind', 'war', 'waren', 'bin', 'bist', 'sein', 'seine', 'seiner',
    'wird', 'werden', 'wurde', 'wurden', 'worden',
    'hat', 'habe', 'haben', 'hatte', 'hatten',
    'kann', 'kannst', 'können', 'könnte', 'soll', 'sollte', 'sollen',
    'muss', 'müssen', 'darf', 'dürfen', 'will', 'wollen', 'möchte',
    'wie', 'was', 'wer', 'wen', 'wem', 'wann', 'warum', 'wieso', 'weshalb',
    'wenn', 'dass', 'weil', 'damit', 'ob',
    'dies', 'diese', 'dieser', 'dieses', 'diesem', 'diesen',
    'nicht', 'kein', 'keine', 'keinen', 'keiner', 'nichts',
    'alle', 'allen', 'alles', 'auch', 'noch', 'nur', 'schon', 'sehr', 'mehr',
    'hier', 'dort', 'jetzt', 'dann', 'immer', 'wieder',
    'ich', 'mir', 'mich', 'dir', 'dich', 'sie', 'ihr', 'ihre', 'ihren',
    'wir', 'uns', 'euch', 'man', 'ihm', 'ihn', 'mein', 'meine', 'dein',
    'bitte', 'mal', 'etwas', 'eigentlich', 'einfach',
    // The counterparts of the English block's generic verbs. `mach` survives
    // the three-code-point floor, so it is listed; `tu` does not and is not.
    'mach', 'machen', 'macht', 'nutze', 'nutzen', 'verwende', 'verwenden',
    'bekomme', 'bekommen', 'setze', 'setzen',
]);

/** The union both blocks are read through. One membership test, two sources. */
export const STOPWORDS: ReadonlySet<string> = new Set([
    ...ENGLISH_STOPWORDS,
    ...GERMAN_STOPWORDS,
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

/** Lowercase, extract `[\p{L}][\p{L}\p{N}]+`, drop stopwords and tokens of ≤2 code points. */
export function tokenize(text: string): Set<string> {
    const out = new Set<string>();
    const matches = text.toLowerCase().match(TOKEN_RE) ?? [];
    for (const t of matches) {
        if (!STOPWORDS.has(t) && pyLen(t) > 2) out.add(t);
    }
    return out;
}

/**
 * Which `triggers[]` keys carry INDEXABLE PROSE.
 *
 * `file_pattern`, `path_prefix` and `command` are match *mechanisms*, not text a
 * prompt is compared against: folding a glob in would put tokens like `blade` and
 * `php` on every skill that merely watches a path. `reason` documents the trigger
 * for a human and is not part of what it matches. The policy lives here because
 * two different readers apply it to two different input shapes — parsed YAML
 * objects in `src/cli/mcp/content.ts`, flat `key: "value"` lines in the
 * frontmatter reader of `score_skill_relevance.ts` — and only the DECISION is
 * shared, not the parsing.
 */
export const INDEXED_TRIGGER_KEYS: readonly string[] = ['keyword', 'phrase'];

/**
 * Trigger prose out of flat `key: "value"` frontmatter lines.
 *
 * The stdlib-only frontmatter reader in `score_skill_relevance.ts` flattens
 *   triggers:
 *     - phrase: "authorization check"
 * to the single string `phrase: "authorization check"`, so this takes that shape
 * rather than an object. Anything whose key is not indexable is dropped.
 */
export function triggerTextFromFlatLines(lines: readonly string[]): string[] {
    const out: string[] = [];
    for (const line of lines) {
        const m = /^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/.exec(String(line).trim());
        if (!m) continue;
        if (!INDEXED_TRIGGER_KEYS.includes(m[1]!)) continue;
        const value = m[2]!.trim().replace(/^["']|["']$/g, '');
        if (value) out.push(value);
    }
    return out;
}

/**
 * How many ranked rows `suggest_skill_for_task` returns when the caller names
 * no limit — on BOTH servers, which is why it lives in the module both import.
 *
 * It was 5. The number is now pre-registered rather than chosen: the bar, fixed
 * before the measurement was read, was "the smallest depth whose recall gain
 * over 5 exceeds 5 points on the train slice of the trigger corpus", with 5
 * staying and the step closing as an honest null if no depth cleared it.
 *
 * The committed run selects 8. Over 487 positives, recall@5 is 0.620 and
 * recall@8 is 0.686 — a gain of 6.6 points, the only candidate depth whose
 * gain clears the bar at the smallest depth (10 adds 2.7 more, 20 another 6.5,
 * neither of them the SMALLEST qualifying depth). The same bar selects 8 after
 * the tokenizer widening too (+6.2 points), so the choice does not depend on
 * which tokenizer was in the tree when it was read.
 *
 * `agents/evidence/metrics/skill-ranker-recall-at-depth.json` is the run.
 * Three more rows per call is the cost; each carries a description capped at
 * 200 characters, so the ceiling it buys is bounded and paid only when the
 * tool is actually called.
 */
export const DEFAULT_SUGGEST_LIMIT = 8;

/** A skill as the ranker sees it. Deliberately not the body — see `rankSkills`. */
export interface RankableSkill {
    name: string;
    description: string;
    personas?: readonly string[];
    /** `triggers[].keyword` / `triggers[].phrase` text. Indexed only on request. */
    triggerText?: readonly string[];
    /** The skill's own `## When to use` prose. Indexed only on request. */
    whenToUseText?: string;
    /** The skill body's `##` / `###` heading lines. Indexed only on request. */
    headingText?: readonly string[];
}

/**
 * The candidate signals, each off by default and each measurable alone.
 *
 * `road-to-a-ranker-that-routes` 2.2 requires exactly this shape: one flag per
 * signal, default off, so a configuration is a named set of flags and two
 * readings of "the ranker" are never two different rankers under one name. With
 * every flag off the score is byte-identical to the Python-parity scorer, which
 * is what the CLI parity suite pins.
 */
export interface RankOptions {
    /** Fold `triggerText` into the indexed terms. Default false (keyword-v1). */
    includeTriggers?: boolean;
    /** Fold the skill's own `## When to use` prose into the indexed terms. */
    includeWhenToUse?: boolean;
    /** Fold the body's section headings into the indexed terms. */
    includeHeadings?: boolean;
    /**
     * Weight each matched term by its inverse document frequency over the
     * catalogue, instead of counting every term alike.
     *
     * Needs {@link TermStats}. Setting it WITHOUT one throws, rather than
     * quietly taking the unweighted branch: a weighting that falls back to
     * unweighted on a missing input produces a baseline number under a
     * configuration's name, which is the one failure the whole flag table
     * exists to prevent.
     */
    idfWeighting?: boolean;
    /**
     * Order equal INTEGER scores by the unrounded score before the name.
     *
     * Changes no score — `scoreSkill` still returns the rounded integer — only
     * the order inside a block of equal integers, which is otherwise decided by
     * the alphabet (`road-to-a-ranker-whose-ties-break-on-signal` D4). Off, the
     * comparator is the Python-parity `(-score, name)` one, unchanged.
     */
    tieBreakUnrounded?: boolean;
}

/** The indexed term set for one skill, under the given options. */
export function skillTerms(skill: RankableSkill, opts: RankOptions = {}): Set<string> {
    const parts = [skill.name, skill.description];
    if (opts.includeTriggers && skill.triggerText) parts.push(...skill.triggerText);
    if (opts.includeWhenToUse && skill.whenToUseText) parts.push(skill.whenToUseText);
    if (opts.includeHeadings && skill.headingText) parts.push(...skill.headingText);
    return tokenize(parts.join(' '));
}

/** True when `opts` turns on at least one term source beyond name + description. */
export function widensTermSource(opts: RankOptions): boolean {
    return Boolean(opts.includeTriggers || opts.includeWhenToUse || opts.includeHeadings);
}

/**
 * How many indexed skills carry each term, and how many skills there are.
 *
 * Derived from the catalogue under the SAME options the ranking uses — a
 * document frequency computed over one term source and applied to another
 * would weight terms by how rare they are somewhere they were never read.
 */
export interface TermStats {
    df: ReadonlyMap<string, number>;
    skills: number;
}

/**
 * @param termSets the per-skill term sets, in the same order as `skills`.
 *   Required rather than derived, so the catalogue is tokenized ONCE per call
 *   instead of once here and again at the scoring loop. Tokenizing ~300 skills
 *   twice per prompt is invisible next to re-reading them from disk, which is
 *   exactly why it would have stayed invisible.
 */
export function buildTermStats(
    skills: readonly RankableSkill[],
    termSets: readonly ReadonlySet<string>[],
): TermStats {
    const df = new Map<string, number>();
    for (const terms of termSets) {
        for (const t of terms) df.set(t, (df.get(t) ?? 0) + 1);
    }
    return { df, skills: skills.length };
}

/**
 * The weight one matched term carries.
 *
 * `ln(1 + skills / (1 + df))`, the smoothed textbook form: a term on every
 * skill tends to zero, a term on one skill carries the most. Unknown terms are
 * treated as df 0 — a task term no skill indexes cannot be matched anyway, so
 * its weight only affects the denominator, where counting it fully is right:
 * failing to cover a rare term should cost more than failing to cover a common
 * one.
 */
export function idf(term: string, stats: TermStats): number {
    return Math.log(1 + stats.skills / (1 + (stats.df.get(term) ?? 0)));
}

/**
 * The score. `taskTerms` is `tokenize(task)`; `terms` is `skillTerms(skill)`.
 *
 * Both are passed in rather than derived here so a caller ranking N skills
 * tokenizes the task once and each skill once, which is what makes this usable
 * on a per-prompt hook path. `opts` and `stats` are optional and, with them
 * absent or every flag off, the arithmetic is exactly the Python-parity one.
 */
export function scoreSkill(
    taskTerms: ReadonlySet<string>,
    skill: RankableSkill,
    terms: ReadonlySet<string>,
    opts: RankOptions = {},
    stats?: TermStats,
): number {
    return roundHalfToEven(rawSkillScore(taskTerms, skill, terms, opts, stats));
}

/**
 * The score before `roundHalfToEven` — what {@link scoreSkill} rounds. Exposed
 * only so `tieBreakUnrounded` can order a block of equal integers by it.
 */
export function rawSkillScore(
    taskTerms: ReadonlySet<string>,
    skill: RankableSkill,
    terms: ReadonlySet<string>,
    opts: RankOptions = {},
    stats?: TermStats,
): number {
    if (opts.idfWeighting && !stats) {
        throw new Error(
            'scoreSkill: idfWeighting is set but no TermStats was passed — scoring unweighted here ' +
                'would publish a baseline number under the idf label. Build stats with buildTermStats.',
        );
    }
    if (taskTerms.size === 0) return 0;
    let overlap: number;
    if (opts.idfWeighting && stats) {
        let hit = 0;
        let total = 0;
        for (const t of taskTerms) {
            const w = idf(t, stats);
            total += w;
            if (terms.has(t)) hit += w;
        }
        overlap = total > 0 ? hit / total : 0;
    } else {
        let inter = 0;
        for (const t of taskTerms) if (terms.has(t)) inter++;
        overlap = inter / Math.max(taskTerms.size, 1);
    }
    let personaHit = 0;
    const taskLower = [...taskTerms].join(' ');
    for (const persona of skill.personas ?? []) {
        const slug = String(persona).toLowerCase();
        if (taskLower.includes(slug) || slug.split('-').some((part) => taskTerms.has(part))) {
            personaHit = 1;
            break;
        }
    }
    return overlap * 70 + personaHit * 30;
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
    const termSets = skills.map((s) => skillTerms(s, opts));
    const stats = opts.idfWeighting ? buildTermStats(skills, termSets) : undefined;
    const rows: RankedSkill[] = [];
    const raw = new Map<string, number>();
    for (let i = 0; i < skills.length; i += 1) {
        const skill = skills[i] as RankableSkill;
        const unrounded = rawSkillScore(taskTerms, skill, termSets[i] as ReadonlySet<string>, opts, stats);
        const score = roundHalfToEven(unrounded);
        if (score > 0) {
            rows.push({ name: skill.name, score, personas: [...(skill.personas ?? [])] });
            raw.set(skill.name, unrounded);
        }
    }
    rows.sort((a, b) => compareRanked(a.name, a.score, b.name, b.score, opts, raw));
    return rows;
}

/**
 * The ranking order: score descending, then — only under `tieBreakUnrounded` —
 * the unrounded score descending, then the name. One comparator for both
 * rankers, so the flag cannot mean two orders in two places.
 */
export function compareRanked(
    aName: string,
    aScore: number,
    bName: string,
    bScore: number,
    opts: RankOptions,
    raw: ReadonlyMap<string, number>,
): number {
    if (bScore !== aScore) return bScore - aScore;
    if (opts.tieBreakUnrounded) {
        const d = (raw.get(bName) ?? 0) - (raw.get(aName) ?? 0);
        if (d !== 0) return d;
    }
    return aName < bName ? -1 : aName > bName ? 1 : 0;
}
