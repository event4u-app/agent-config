/**
 * Intent-conditioned verb selection (Phase 9 D3, road-to-reachable-code-memory)
 * — a PURE regex table, no model call. `suggestVerb` maps a natural-language
 * structure question to the `code_graph` subcommand most likely to answer it:
 *
 *   affected — "who calls / uses / references this", "what would break",
 *              "blast radius" — a reverse (who-depends-on-it) lookup.
 *   path     — "how does X reach/connect to Y", "is A reachable from B",
 *              "trace the route between A and B" — connectivity between
 *              two named seeds.
 *   explain  — "overview", "what's around X", "the neighbourhood of X",
 *              "walk me through X" — a broader 2-hop neighbourhood, not a
 *              single direct-relations answer.
 *   query    — the default: a seed's own direct (1-hop) relations.
 *
 * Order matters — first pattern class to match wins: affected → path →
 * explain → query. Ship gate (pre-registered in
 * `tests/fixtures/code-graph-intent/queries.json`, written BEFORE this file):
 * `suggestVerb` must beat the always-`query` baseline's correct-verb rate
 * over that 30-query set, or this module stays unwired (evidence only, per
 * the D3 evidence note in `agents/evidence/reports/`).
 */

export type Verb = 'query' | 'affected' | 'path' | 'explain';

const AFFECTED_RE =
    /\b(who\s+(calls?|uses?|else|references?)|where\s+(is|are|'s)?\s*.*\bused\b|impact(s|ed|ing)?|blast\s+radius|break(s|ing)?|would\s+break|caller(s)?|referenc(e|es|ed|ing)|touch(es|ed)?)\b/i;

const PATH_RE =
    /\b(reach(able|es|ing)?|connect(s|ed|ion|ing)?|\btrace\b|\broute\b|\bpath\b|shortest)\b/i;

const EXPLAIN_RE =
    /\b(overview|explain(s|ed|ing)?|\baround\b|surround(ing|s)?|\bcontext\b|big\s+picture|neighbo[u]?rhood|walk\s+me\s+through|summar(y|ize|ise))\b/i;

/**
 * Suggest the `code_graph` verb a free-text structure question most likely
 * needs. Deterministic, side-effect-free, no network, no model call.
 */
export function suggestVerb(question: string): Verb {
    const q = question.trim();
    if (AFFECTED_RE.test(q)) return 'affected';
    if (PATH_RE.test(q)) return 'path';
    if (EXPLAIN_RE.test(q)) return 'explain';
    return 'query';
}
