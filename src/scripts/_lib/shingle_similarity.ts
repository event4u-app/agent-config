/**
 * Entity-neutralized shingle-overlap primitive — the anti-reskin engine behind
 * `lint_originality.ts`.
 *
 * Deterministic, no embeddings, no network. This is a DIFFERENT primitive from
 * `text_similarity.ts` (token-set Jaccard, dedup) and `audit_skill_overlap.ts`
 * (keyword-cosine, advisory) — both of which a find-replace re-skin
 * ("Laravel" → "Symfony", "Vietnam" → "Korea") can defeat, because the swapped
 * proper nouns shift the token/keyword vectors enough to drop the score.
 *
 * The defence is two-fold:
 *   1. NEUTRALIZE entities — replace framework / vendor / language / region /
 *      currency proper nouns with a single placeholder BEFORE comparison, so a
 *      find-replace re-skin collapses to the original text.
 *   2. SHINGLE — compare k-word shingles (default k = 8), not a bag of tokens,
 *      so re-skins that only swap scattered nouns still share long verbatim
 *      runs, and unrelated files that happen to share vocabulary do not.
 *
 * Overlap is CONTAINMENT (`|a∩b| / min(|a|,|b|)`), not Jaccard: a small file
 * copied verbatim into a large padded one must still score high — the exact
 * shape of an embedded re-skin.
 *
 * Deliberately does NOT touch `text_similarity.ts` or `memory_signal.ts`
 * (byte-faithful parity contracts). This module is a new, additional layer.
 */

/**
 * Proper-noun families that a find-replace re-skin swaps. Neutralized to a
 * single placeholder so the swap does not move the score. Word-boundary
 * matched, case-insensitive. **Extend via PR, never inline at a call site** —
 * the list is the calibration surface, and a scattered entity list drifts.
 *
 * Seed the list from OUR corpus (the frameworks / vendors / regions the suite
 * actually names), not from any external source.
 */
export const ENTITY_TERMS: readonly string[] = [
    // Frameworks / libraries
    'laravel', 'symfony', 'react', 'vue', 'preact', 'angular', 'svelte', 'nextjs',
    'next', 'nuxt', 'livewire', 'flux', 'inertia', 'blade', 'tailwind', 'eloquent',
    'doctrine', 'pest', 'phpunit', 'vitest', 'jest', 'playwright', 'express',
    'fastify', 'django', 'flask', 'rails', 'spring',
    // Languages
    'php', 'typescript', 'javascript', 'python', 'ruby', 'golang', 'rust', 'java',
    'kotlin', 'swift', 'csharp', 'elixir',
    // Vendors / platforms / services
    'aws', 'gcp', 'azure', 'hetzner', 'cloudflare', 'vercel', 'netlify', 'stripe',
    'paddle', 'paypal', 'github', 'gitlab', 'bitbucket', 'linear', 'jira',
    'confluence', 'slack', 'sentry', 'datadog', 'grafana', 'prometheus', 'redis',
    'postgres', 'postgresql', 'mysql', 'mariadb', 'sqlite', 'mongodb', 'kafka',
    'rabbitmq', 'terraform', 'terragrunt', 'kubernetes', 'docker', 'ansible',
    'openai', 'anthropic', 'gemini', 'claude',
    // Cloud regions / locales that re-skins swap
    'us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1',
    // Currency codes / symbols
    'usd', 'eur', 'gbp', 'chf', 'jpy',
];

const _ENTITY_RE = new RegExp(
    `\\b(?:${ENTITY_TERMS.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'gi',
);

/** Placeholder every entity family collapses to. Distinct token so it shingles. */
export const ENTITY_PLACEHOLDER = 'entterm';

/** Word token — mirrors the upstream re-skin gate's word regex so a calibrated
 * threshold ports across corpora. Digits, `+ . # _ -` kept (e.g. `c#`, `9.3.0`). */
const _WORD_RE = /[a-z0-9][a-z0-9+.#_-]*/g;

/**
 * Lowercase, strip frontmatter + markdown syntax, then replace entity proper
 * nouns with `ENTITY_PLACEHOLDER`. `extra` is an optional caller-supplied regex
 * (global) of additional terms to neutralize for one call (e.g. a corpus-
 * specific product name); it never mutates the shared list.
 */
export function neutralizeEntities(text: string, extra?: RegExp): string {
    let t = text;
    // Leading YAML frontmatter.
    t = t.replace(/^---\n[\s\S]*?\n---\n?/, '');
    // Fenced code blocks (``` or ~~~).
    t = t.replace(/^([`~]{3,}).*$[\s\S]*?^\1[ \t]*$/gm, ' ');
    // HTML comments.
    t = t.replace(/<!--[\s\S]*?-->/g, ' ');
    // Inline code spans.
    t = t.replace(/`[^`]*`/g, ' ');
    // Links / images: keep the visible label, drop the target.
    t = t.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
    t = t.toLowerCase();
    // Heading / emphasis / list / blockquote / table punctuation → spaces, so
    // the same prose scores identically regardless of markdown decoration.
    t = t.replace(/[#*_>|~]+/g, ' ');
    if (extra) {
        t = t.replace(extra, ENTITY_PLACEHOLDER);
    }
    t = t.replace(_ENTITY_RE, ENTITY_PLACEHOLDER);
    return t;
}

/** Ordered word tokens of the neutralized text (no set — shingles need order). */
export function words(text: string): string[] {
    return text.match(_WORD_RE) ?? [];
}

/**
 * Word-level k-shingles over the neutralized token stream. A file with fewer
 * than `k` tokens yields the empty set (guarded downstream → score 0, never
 * NaN). Shingles join on a single space so they are comparable across files.
 */
export function shingles(text: string, k = 8): Set<string> {
    const toks = words(neutralizeEntities(text));
    const out = new Set<string>();
    if (toks.length < k) {
        return out;
    }
    for (let i = 0; i + k <= toks.length; i++) {
        out.add(toks.slice(i, i + k).join(' '));
    }
    return out;
}

/**
 * Containment overlap in percent: `100 * |a∩b| / min(|a|,|b|)`.
 *
 * Containment (not Jaccard) so a small file copied verbatim into a large padded
 * one still scores high. Two empty shingle sets → 0 (a file too short to
 * shingle carries no originality signal — never flag it). One empty → 0.
 */
export function overlapPercent(a: Set<string>, b: Set<string>): number {
    const min = Math.min(a.size, b.size);
    if (min === 0) {
        return 0;
    }
    const [small, large] = a.size <= b.size ? [a, b] : [b, a];
    let shared = 0;
    for (const s of small) {
        if (large.has(s)) {
            shared++;
        }
    }
    return (100 * shared) / min;
}

/** Convenience: shingle both texts and score. */
export function shingleOverlap(a: string, b: string, k = 8): number {
    return overlapPercent(shingles(a, k), shingles(b, k));
}
