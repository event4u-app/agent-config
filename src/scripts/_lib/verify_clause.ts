/**
 * The `verify:` clause — one grammar, one parser, two importers.
 *
 * THE DEFECT THIS EXISTS TO NAME. A `verify:` clause names a command and never
 * names what the command must produce. `verify: `cat notes.md`` is a legal,
 * green, fully-conforming step field whose oracle cannot say no: the step gets
 * flipped on a command that was never able to fail. Measured 2026-09-29 across
 * the 22 active roadmaps: 230 clauses, 93 naming a command, and 6 naming an
 * expectation — so 59.6% of clauses cannot even be RUN, and 97.4% state no
 * oracle. The absence is the norm, not an outlier.
 *
 * The denominator moves with archival and is not the finding. An earlier
 * reading the same day over 27 roadmaps gave 264 / 100 / 6; five archived in
 * between, and the count of EXPECTATIONS did not move. That is why the ratio
 * carries and the raw totals do not.
 *
 * Three of those six predate this parser and were written by an author nobody
 * prompted, in `road-to-one-verification-classifier.md`. This grammar therefore
 * DOCUMENTS a form already in use; it does not introduce one. The roadmap that
 * commissioned the work asserted zero, which is why the number here is the
 * measured one and carries its producing command:
 * `./scripts-run src/scripts/roadmap_verify_share`.
 *
 * THE GRAMMAR. The expectation half is OPTIONAL and attaches with the arrow
 * `exec:` evidence already carries — not a new symbol:
 *
 *     verify: `<cmd>` -> 0          the command must exit 0
 *     verify: `<cmd>` -> 2          … or any declared exit code
 *     verify: `<cmd>` -> /regex/    the command's output must match
 *     verify: `<cmd>`               runnable, but the oracle is unstated
 *     verify: <prose>               MANUAL — a human reads it
 *
 * Prose stays legal deliberately. Forbidding it would have silently invalidated
 * the large majority of lines already in the tree, and a grammar change that
 * reds every existing producer gets weakened until it finds nothing. What the
 * three shapes buy instead is that they are TELLABLE APART, which is what lets
 * `closure_scan` report the unfalsifiable share as a number rather than an
 * impression.
 *
 * WHY ONE PARSER. Two importers read this grammar — the run-continuation hook
 * (which names the next step and its verify line) and `closure_scan` (which
 * reports the share that cannot fail). A second copy of the arrow regex is how
 * those two drift, and a drifted grammar fails silently: an expectation simply
 * stops being read and the clause reads as unstated. {@link VERIFY_ARROW_SOURCE}
 * is exported so a duplicate is detectable by a test rather than by a bug
 * report.
 */

/** What a clause says the command must produce. */
export type Expectation =
    | { readonly kind: 'exit'; readonly code: number }
    | { readonly kind: 'regex'; readonly source: string };

export interface VerifyClause {
    /**
     * The command, or `null` for the prose (MANUAL) form. A clause with no
     * command cannot be run by anything, which is precisely what makes it
     * unfalsifiable rather than merely unstated.
     */
    readonly command: string | null;
    /** The `-> 0` / `-> /re/` half, or `null` where the clause carries none. */
    readonly expect: Expectation | null;
    /** The clause body as written, whitespace-normalised. For excerpts. */
    readonly raw: string;
}

/**
 * The expectation half, as a source string.
 *
 * Exported rather than kept private so the "nothing may parse the arrow a
 * second time" test has something to compare against. Two alternatives only:
 * a bare exit code, or a slash-delimited regex. A bare word (`-> green`) is
 * deliberately NOT an expectation — it would read as one while deciding
 * nothing, which is the defect wearing the fix's clothes.
 */
export const VERIFY_ARROW_SOURCE = '(?:->|→)[ \\t]*(\\d+|\\/.+\\/)[ \\t]*$';

/** The arrow alone, anchored at both ends of a clause tail. */
const ARROW_RE = new RegExp(`^${VERIFY_ARROW_SOURCE}`);

/** A clause body split into its command head and its trailing expectation. */
const TAIL_RE = new RegExp(`^(.*?)[ \\t]*${VERIFY_ARROW_SOURCE}`);

/** The annotation form. Machine-readable, so it wins when both are present. */
const HTML_RE = /<!--\s*verify:\s*(.*?)\s*-->/g;

/**
 * The step's LAST match, not its first.
 *
 * A step that DISCUSSES the clause carries the token before the clause that
 * counts — the roadmap introducing this grammar shows `verify: `<cmd>` -> 0`
 * in its own prose, two lines above its own verify line. First-match-wins
 * parsed the illustration and reported its expectation as the step's. The
 * clause is written last by convention, after the prose, so last wins.
 */
function lastMatch(re: RegExp, text: string): RegExpExecArray | null {
    re.lastIndex = 0;
    let found: RegExpExecArray | null = null;
    let m = re.exec(text);
    while (m !== null) {
        found = m;
        if (m.index === re.lastIndex) re.lastIndex += 1;
        m = re.exec(text);
    }
    return found;
}

/**
 * The backticked form, plus at most ONE token of expectation after it.
 *
 * The label is an ALTERNATION with a lookahead, not two independent optional
 * backticks. The inherited form — ``` `?verify:`? ``` — let the parser skip the
 * trailing backtick and use the LABEL's closing backtick to open the command,
 * so ``` `verify:` stays legal … verify: `cmd` ``` captured the whole
 * intervening sentence as the command. Nothing failed: a garbage command is
 * still a string, and the hook printed it into a continuation message as the
 * step's proof. The alternation alone did not fix it — the bare branch could
 * start one character later and borrow the same backtick — so the bare branch
 * carries `(?!`)`: a label followed by a backtick is the delimited form, which
 * branch one already owns.
 *
 * The tail is capped at a single non-space token on purpose. Readers hand this
 * parser a whole step BLOCK, joined and whitespace-normalised, so "the rest of
 * the line" is really "the rest of the step" — and a step that continues after
 * its verify clause would then push the expectation away from the end anchor
 * and lose it silently. The cost is that a regex expectation may not contain a
 * space; `/[1-9]/` and `/unfalsifiable-verify/` are the shapes in use, and a
 * space-bearing expectation loses its arrow loudly (it parses as no
 * expectation) rather than half-matching.
 */
const BACKTICKED_RE = /(?:`verify:`|verify:(?!`))\s*`([^`]+)`[ \t]*((?:->|→)[ \t]*\S+)?/g;

/** Prose after the label, to end of line. The MANUAL form. */
const PROSE_RE = /(?:`verify:`|verify:(?!`))[ \t]*([^\n]*)/g;

/** Build an expectation from the already-isolated arrow value. */
function fromValue(value: string): Expectation | null {
    if (/^\d+$/.test(value)) return { kind: 'exit', code: Number(value) };
    const re = /^\/(.+)\/$/.exec(value);
    if (re === null) return null;
    const source = re[1] as string;
    // An expectation that cannot compile is not an oracle — it is a crash
    // waiting for the first reader that tries to apply it.
    try {
        new RegExp(source);
    } catch {
        return null;
    }
    return { kind: 'regex', source };
}

/**
 * Parse an expectation from a clause tail such as `-> 0` or `-> /re/`.
 *
 * @returns `null` when the tail carries no arrow, or carries one whose value is
 * neither an exit code nor a slash-delimited regex.
 */
export function parseExpectation(tail: string): Expectation | null {
    const m = ARROW_RE.exec(tail.trim());
    return m === null ? null : fromValue(m[1] as string);
}

/** Split a command-bearing body into its command and its expectation. */
function splitBody(body: string): { command: string; expect: Expectation | null } {
    const m = TAIL_RE.exec(body);
    if (m === null) return { command: body.trim(), expect: null };
    const expect = fromValue(m[2] as string);
    // An arrow whose value decides nothing leaves the whole body as the
    // command, rather than silently truncating it at a `->` that was prose.
    return expect === null ? { command: body.trim(), expect: null } : { command: (m[1] as string).trim(), expect };
}

/**
 * Parse the `verify:` clause carried by `stepText`.
 *
 * @param stepText one step block — the line plus its continuation lines, which
 * is where the tree conventionally writes the clause.
 * @returns the clause, or `null` when the text carries no `verify:` token.
 */
export function parseVerifyClause(stepText: string): VerifyClause | null {
    const html = lastMatch(HTML_RE, stepText);
    if (html !== null) {
        const body = (html[1] as string).trim();
        if (body === '') return null;
        const { command, expect } = splitBody(body);
        return { command: command === '' ? null : command, expect, raw: body };
    }

    const backticked = lastMatch(BACKTICKED_RE, stepText);
    if (backticked !== null) {
        const command = (backticked[1] as string).trim();
        if (command !== '') {
            const tail = (backticked[2] ?? '').trim();
            return { command, expect: parseExpectation(tail), raw: `\`${command}\`${tail === '' ? '' : ` ${tail}`}` };
        }
    }

    const prose = lastMatch(PROSE_RE, stepText);
    if (prose === null) return null;
    const body = (prose[1] as string).trim();
    if (body === '') return null;
    return { command: null, expect: null, raw: body.replace(/\s+/g, ' ') };
}

/**
 * The clause's command half only — `null` where the clause is prose or absent.
 *
 * The narrowing the run-continuation hook wants: it renders a command for the
 * next step, and a prose clause is not one. Kept here rather than at the call
 * site so the hook imports a decision rather than re-deriving it.
 */
export function commandBearing(stepText: string): VerifyClause | null {
    const clause = parseVerifyClause(stepText);
    if (clause === null || clause.command === null) return null;
    return clause;
}

/** Render an expectation back to its written form, for messages and evidence. */
export function formatExpectation(expect: Expectation): string {
    return expect.kind === 'exit' ? `-> ${String(expect.code)}` : `-> /${expect.source}/`;
}
