/**
 * Why each rule of the egress table runs in linear time on any input — the
 * argument the PR #2366 council review required per rule, reviewed with the
 * pattern it explains.
 *
 * Kept beside the table rather than in it because no runtime path reads it:
 * the table ships inside the egress engine chunk, and these sentences are
 * prose for a reviewer. `egress_rules.test.ts` refuses a row without an entry
 * and an entry without a row, so the contract is as binding as the field was.
 */
const PREFIX_RUN =
    'Starts only where the literal prefix occurs; the single class after it either reaches its minimum and consumes the whole run (the global scan resumes past it) or fails within the minimum, so each character is read a bounded number of times.';
const FIXED_RUN =
    'Fixed-length class after a literal prefix: every attempt reads at most the prefix plus the fixed count.';

export const LINEARITY: Readonly<Record<string, string>> = {
    'anthropic-api-key': PREFIX_RUN,
    'anthropic-project-key': PREFIX_RUN,
    'aws-access-key': FIXED_RUN,
    'google-api-key': FIXED_RUN,
    'github-pat': FIXED_RUN,
    'github-fine-grained-pat': PREFIX_RUN,
    'openai-api-key': PREFIX_RUN,
    'google-oauth-token': PREFIX_RUN,
    'github-app-token': PREFIX_RUN,
    'xai-api-key': PREFIX_RUN,
    'perplexity-api-key': PREFIX_RUN,
    'groq-api-key': PREFIX_RUN,
    'jwt':
        'One attempt per base64url run: the lookbehind admits a start only at the run boundary, and the lookahead-plus-backreference consumes the run up to its first eyJ atomically, so the engine never retries a later eyJ in the same run. That loses nothing: every eyJ in one run reaches the same run end, so the first one, which has the most characters after it, matches whenever any later one would. An attempt spans at most three dot-separated runs, so each character is read a bounded number of times.',
    'stripe-secret-key': PREFIX_RUN,
    'slack-token': PREFIX_RUN,
    'pem-private-key':
        'Starts only at the literal header; the label class excludes the dash, so label runs of different headers are disjoint, and backtracking over one run tries the fixed 16-character suffix at each position: linear with a constant factor of 16.',
    'db-connection-uri':
        'One attempt per scheme-character run: the lookbehind admits a start only at the run boundary, and the lookahead-plus-backreference consumes the run up to its first word-boundary letter atomically. Every such start in one run reaches the same :// at the same run end, so the first one matches whenever any later one would, and nothing the unbounded scheme matched is lost. The userinfo classes exclude : and /, so each userinfo run is read by one attempt per side.',
    'generic-assignment':
        'Starts only at a keyword; the whitespace runs end at the first non-space; the three value alternatives are anchored at the same position, a quoted one ends at its own quote or the line end and the bare one at the first quote or space, so none can backtrack into another; a match moves the global scan past the value, so no character is read by more than one successful attempt and a failed attempt stops within the line after the whitespace.',
};
