/**
 * Score eligible commands against a user message + recent context.
 *
 * TypeScript twin of `src/scripts/command_suggester/match.py`
 * (ADR-096 py2ts).
 *
 * Deterministic, no ML, no third-party deps. Two signals combine into
 * a 0.0–1.0 score:
 *
 *  - Description match — strongest single signal.
 *    - Long phrase substring (≥ 10 chars) → 0.65.
 *    - Short phrase substring (6–9 chars) → 0.4.
 *    - Otherwise content-word overlap (≥ 4-char tokens, stop-words
 *      stripped) scaled to 0.4.
 *  - Context match — supporting evidence.
 *    - Structural pattern (ticket key, file path, glob) co-occurring
 *      in the message → 0.5.
 *    - Otherwise content-word overlap scaled to 0.3.
 *
 * Total `score = min(1.0, description_score + context_score)`. A long
 * phrase hit alone clears the default 0.6 floor; structural patterns
 * alone do not (anti-noise) — they need a description signal too.
 * A `Match.has_structural_bonus` flag lets the ranker know when a
 * short, otherwise-ambiguous prompt is actually specific (ticket
 * keys, paths) so it can override vague-input suppression.
 */

import { pyRound } from '../_lib/value_ladder.js';
import { sanitize_context, sanitize_message } from './sanitize.js';
import { CommandSpec, Match } from './types.js';

const _TICKET_RE = /[A-Z][A-Z0-9]+-\d+/;
// Global variant for `findall`-style iteration where needed.
const _WORD_RE = /[A-Za-z][A-Za-z0-9_-]{3,}/g;
const _PATH_RE = /[A-Za-z0-9_./-]+\/[A-Za-z0-9_.*-]+/g;
const _STOPWORDS: ReadonlySet<string> = new Set([
    'this', 'that', 'with', 'from', 'have', 'what', 'when', 'they',
    'them', 'into', 'would', 'could', 'should', 'about', 'there',
    'these', 'those', 'their', 'your', 'mine', 'ours', 'yours',
    'show', 'tell', 'make', 'want', 'need', 'like', 'just', 'some',
    'many', 'more', 'most', 'less', 'than', 'then', 'also', 'very',
]);

/**
 * Mirror of Python `_tokens` — lowercase content words ≥ 4 chars,
 * stop-words stripped, deduplicated (a `set`).
 */
function _tokens(text: string): Set<string> {
    const out = new Set<string>();
    const matches = (text || '').match(_WORD_RE) ?? [];
    for (const w of matches) {
        const lw = w.toLowerCase();
        if (!_STOPWORDS.has(lw)) {
            out.add(lw);
        }
    }
    return out;
}

/**
 * Sorted lexicographic minimum of a token set — mirrors Python
 * `sorted(common)[0]`. Python sorts strings by Unicode code point;
 * JS default Array.sort on strings is UTF-16 code-unit order, which
 * matches for the ASCII identifiers this matcher produces.
 */
function _sortedFirst(tokens: Set<string>): string {
    let best: string | null = null;
    for (const t of tokens) {
        if (best === null || t < best) {
            best = t;
        }
    }
    return best ?? '';
}

function _phrases(trigger_description: string): string[] {
    const out: string[] = [];
    for (const p of (trigger_description || '').split(',')) {
        const trimmed = p.trim().toLowerCase();
        if (p.trim()) {
            out.push(trimmed);
        }
    }
    return out;
}

/**
 * Return the longest phrase that occurs as a substring, else null.
 *
 * Falls back to a hyphen-normalized hay so e.g. `"create pr"` still
 * matches `"create-pr"` in a path or branch reference.
 *
 * Python sorts the phrases by length descending (stable) then returns
 * the first ≥ 6-char phrase that is a substring. A stable
 * length-descending sort preserves the original relative order of
 * equal-length phrases.
 */
function _phrase_substring_hit(phrases: string[], hay: string): string | null {
    const best: string | null = null;
    const hay_norm = hay.replace(/-/g, ' ');
    // Stable sort, key=len descending. JS sort is not guaranteed stable
    // pre-ES2019 but is stable in modern V8; index tie-break makes it
    // explicit to mirror Python's stable `sorted`.
    const indexed = phrases.map((p, i) => ({ p, i }));
    indexed.sort((a, b) => {
        if (b.p.length !== a.p.length) {
            return b.p.length - a.p.length;
        }
        return a.i - b.i;
    });
    for (const { p } of indexed) {
        if (p.length < 6) {
            continue;
        }
        if (hay.includes(p) || hay_norm.includes(p)) {
            return p;
        }
    }
    return best;
}

/**
 * Heavy-signal patterns that score context fully (0.5).
 *
 * Ticket keys (`ABC-123`) and file paths in the spec's
 * `trigger_context` only count when they actually appear in the
 * message — `trigger_context` advertises which signals matter,
 * the message provides them.
 */
function _structural_bonus(spec: CommandSpec, message: string): string | null {
    const ctx_lower = (spec.trigger_context || '').toLowerCase();
    const msg_lower = message.toLowerCase();
    if (
        ctx_lower.includes('ticket') ||
        ctx_lower.includes('proj-') ||
        ctx_lower.includes('[a-z]+-[0-9]+')
    ) {
        const m = _TICKET_RE.exec(message);
        if (m) {
            return m[0];
        }
    }
    const paths = (spec.trigger_context || '').match(_PATH_RE) ?? [];
    for (const path of paths) {
        if (msg_lower.includes(path.toLowerCase())) {
            return path;
        }
    }
    return null;
}

function _description_score(
    spec: CommandSpec,
    message: string,
    ctx_text: string,
): [number, string] {
    const phrases = _phrases(spec.trigger_description);
    const hay = (`${message} \n ${ctx_text}`).toLowerCase();
    const hit = _phrase_substring_hit(phrases, hay);
    if (hit) {
        // Long phrase substring is the strongest signal — clears the
        // default 0.6 floor on its own. Short phrases need context.
        return [hit.length >= 10 ? 0.65 : 0.4, hit];
    }
    const spec_tokens = _tokens(spec.trigger_description);
    if (spec_tokens.size === 0) {
        return [0.0, ''];
    }
    const msg_tokens = _union(_tokens(message), _tokens(ctx_text));
    const common = _intersect(spec_tokens, msg_tokens);
    if (common.size === 0) {
        return [0.0, ''];
    }
    const score = 0.4 * (common.size / spec_tokens.size);
    return [score, _sortedFirst(common)];
}

/** Returns [score, evidence, has_structural_bonus]. */
function _context_score(
    spec: CommandSpec,
    message: string,
    ctx_text: string,
): [number, string, boolean] {
    const bonus = _structural_bonus(spec, message);
    if (bonus) {
        return [0.5, bonus, true];
    }
    const spec_tokens = _tokens(spec.trigger_context);
    if (spec_tokens.size === 0) {
        return [0.0, '', false];
    }
    const msg_tokens = _union(_tokens(message), _tokens(ctx_text));
    const common = _intersect(spec_tokens, msg_tokens);
    if (common.size === 0) {
        return [0.0, '', false];
    }
    const score = 0.3 * (common.size / spec_tokens.size);
    return [score, _sortedFirst(common), false];
}

function _union(a: Set<string>, b: Set<string>): Set<string> {
    const out = new Set(a);
    for (const x of b) {
        out.add(x);
    }
    return out;
}

function _intersect(a: Set<string>, b: Set<string>): Set<string> {
    const out = new Set<string>();
    for (const x of a) {
        if (b.has(x)) {
            out.add(x);
        }
    }
    return out;
}

/**
 * Return scored matches sorted by descending score (ties stable on
 * command name).
 *
 * Eligible commands only; ineligible ones are silently skipped. The
 * caller is responsible for ranking, cooldown, and rendering.
 *
 * `sanitize` (default `true`) strips fenced/inline code and previous
 * suggestion-block echoes from both the message and the last 2 turns
 * of context. The flag is exposed for tests that exercise the raw
 * scoring path; runtime callers should leave it on.
 */
export function match(
    message: string,
    context: Iterable<string> = [],
    commands: Iterable<CommandSpec> = [],
    options: { sanitize?: boolean } = {},
): Match[] {
    const sanitize = options.sanitize ?? true;
    let msg = message;
    let cleaned_ctx: string[];
    if (sanitize) {
        msg = sanitize_message(message);
        cleaned_ctx = sanitize_context(context);
    } else {
        cleaned_ctx = [...context];
    }
    // last 2 turns max
    const ctx_text = cleaned_ctx.slice(-2).join('\n');
    const matches: Match[] = [];
    for (const spec of commands) {
        if (!spec.eligible) {
            continue;
        }
        const [d_score, d_evidence] = _description_score(spec, msg, ctx_text);
        const [c_score, c_evidence, structural] = _context_score(spec, msg, ctx_text);
        const score = pyRound(Math.min(1.0, d_score + c_score), 4);
        if (score <= 0) {
            continue;
        }
        let kind: string;
        let evidence: string;
        if (d_score > 0 && c_score > 0) {
            kind = 'both';
            evidence = d_evidence.length >= c_evidence.length ? d_evidence : c_evidence;
        } else if (d_score > 0) {
            kind = 'description';
            evidence = d_evidence;
        } else {
            kind = 'context';
            evidence = c_evidence;
        }
        matches.push(new Match({
            command: spec.name,
            score,
            matched_trigger: kind,
            evidence,
            has_structural_bonus: structural,
        }));
    }
    // Python: matches.sort(key=lambda m: (-m.score, m.command))
    matches.sort((a, b) => {
        if (a.score !== b.score) {
            return b.score - a.score;
        }
        if (a.command < b.command) {
            return -1;
        }
        if (a.command > b.command) {
            return 1;
        }
        return 0;
    });
    return matches;
}
