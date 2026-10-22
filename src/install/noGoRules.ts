/**
 * A consumer no-go bullet, sorted into `path`, `command` or `prose`, and
 * rendered as the deny rule it would become.
 *
 * `road-to-a-project-contract-written-down` step 2.1. `/agents:init` asks the
 * consumer for no-gos and writes them into their own `AGENTS.md`. A sentence
 * there binds every turn and the agent may still read past it. This is what
 * turns the two kinds that CAN be enforced into rows the host refuses on, and
 * what refuses to turn the third kind into anything at all.
 *
 * ```
 * A BULLET THE FUNCTION CANNOT CLASSIFY IS `prose`, NEVER A GUESSED ROW.
 * A ROW ON A VAGUE SENTENCE BLOCKS LEGITIMATE WORK AND CANNOT SAY WHY.
 * ```
 *
 * Pure: it reads a string and returns a verdict. Nothing here opens a settings
 * file — the consent prompt and the append are step 2.2's.
 *
 * WHAT MAKES A VERDICT. Two independent signals must agree, and either one
 * missing is `prose`:
 *
 *   1. ONE backticked token. The consumer guide's own `## No-gos` shape puts
 *      the path or the command in backticks. Zero means the bullet names
 *      neither; two or more means the subject is ambiguous, and picking one
 *      would be the guess this module exists to refuse.
 *   2. An action verb from a closed vocabulary. The token's SHAPE says what it
 *      is; only the verb says what must not happen to it. "`vendor/` is
 *      generated" carries a path and no action, and choosing `Edit` over `Read`
 *      on its behalf would widen or narrow a rule nobody wrote.
 */

/** What a bullet turned out to be. */
export type NoGoKind = 'path' | 'command' | 'prose';

/**
 * What the bullet forbids DOING — host-neutral, and the whole output of this
 * module beside the token.
 *
 * `null` on a prose verdict. The split between this and the host's spelling is
 * the council's convergent requirement of 2026-10-13 (anthropic + openai, 2/2):
 * a classifier that resolves a host row at run time is not a pure classifier,
 * and a renderer that re-derives the semantics is a second place for them to
 * drift. The classifier never learns which host it is running for.
 */
export type NoGoAction = 'read' | 'edit' | 'run';

export interface NoGoClassification {
    /** The bullet as written, list marker stripped and trimmed. */
    readonly bullet: string;
    readonly kind: NoGoKind;
    /** The one backticked token the verdict rests on; `null` for prose. */
    readonly token: string | null;
    /** What must not happen to it; `null` for prose. */
    readonly action: NoGoAction | null;
    /** Why the verdict is what it is — shown beside the row at consent time. */
    readonly reason: string;
}

/** Verbs that forbid READING. A `Read` deny also covers edits and writes. */
const READ_VERBS = ['read', 'open', 'view', 'cat', 'print', 'dump'] as const;

/** Verbs that forbid CHANGING. `Edit` is the only path rule the host checks. */
const EDIT_VERBS = [
    'edit',
    'modify',
    'change',
    'write',
    'touch',
    'delete',
    'remove',
    'rename',
    'commit',
    'overwrite',
    'regenerate',
] as const;

/** Verbs that forbid EXECUTING. */
const RUN_VERBS = ['run', 'execute', 'invoke', 'call'] as const;

/**
 * Words that make a bullet a PROHIBITION rather than a description.
 *
 * Required, and that is the correction a review forced: a verb scan alone
 * accepts "``npm run build`` is the only sanctioned build command" and renders
 * a deny row over the command the bullet PRESCRIBES. A no-go section is not the
 * only place a backticked command appears in a sentence with a verb near it.
 */
const NEGATIONS = [
    'never',
    'not',
    'no',
    "don't",
    'dont',
    'avoid',
    'forbidden',
    'prohibited',
] as const;

/**
 * Text that ends the clause the prohibition governs.
 *
 * The second half of the same correction. "Never run migrations in production
 * - use `php artisan migrate --pretend` instead" negates, carries a run verb,
 * and carries a backticked command — and the command is the ESCAPE HATCH the
 * bullet recommends. A separator between the verb and the token means the token
 * belongs to a different clause, so the verdict is prose.
 */
const CLAUSE_BREAK =
    /(?:^|\s)[-–—](?:\s|$)|[;:,()]|\b(?:instead|use|using|prefer|except|unless|but|rather|need|needs|needed|necessary|required|optional|if|when|while|without|before|after|until|other than)\b/i;

/**
 * Words between the negation and the verb that INVERT what the negation does.
 *
 * The structural half of the fix, because a word list alone has now failed
 * three times. "Don't forget to run `npm ci`" negates the OMISSION of the
 * action, so the sentence prescribes exactly what a deny row would forbid.
 * The shape is always the same — a negation, a verb of omission or
 * hesitation, an infinitive marker, then the real verb — and `to` is the part
 * that gives it away: a prohibition reads "never run X", never "never
 * <something> to run X".
 *
 * So: an infinitive `to` between the negation and the action verb means the
 * action is the OBJECT of some other verb rather than the thing forbidden.
 * That catches `forget`, `hesitate`, `fail`, `neglect` and every sibling
 * nobody has thought of yet, which a fourth word list would not.
 */
const INVERTS_THE_NEGATION = /\bto\b/i;

/** Backticked spans replaced by spaces, so a verb INSIDE the token is not read as the bullet's verb. */
function maskTokens(bullet: string): string {
    return bullet.replace(/`[^`]+`/g, (m) => ' '.repeat(m.length));
}

/** First index at which any whole word in `words` occurs, or -1. */
function firstWordIndex(haystack: string, words: readonly string[]): number {
    let best = -1;
    for (const w of words) {
        const m = new RegExp(`\\b${w}\\b`, 'i').exec(haystack);
        if (m !== null && (best === -1 || m.index < best)) best = m.index;
    }
    return best;
}

interface VerbHit {
    readonly action: NoGoAction;
    readonly start: number;
    readonly end: number;
}

/** The first action verb at or after `from`, or `null`. */
function verbAfter(masked: string, from: number): VerbHit | null {
    const groups: readonly (readonly [NoGoAction, readonly string[]])[] = [
        ['run', RUN_VERBS],
        ['read', READ_VERBS],
        ['edit', EDIT_VERBS],
    ];
    let best: VerbHit | null = null;
    for (const [action, verbs] of groups) {
        for (const v of verbs) {
            const re = new RegExp(`\\b${v.replace("'", "'?")}\\b`, 'gi');
            let m = re.exec(masked);
            while (m !== null) {
                if (m.index >= from && (best === null || m.index < best.start)) {
                    best = { action, start: m.index, end: m.index + m[0].length };
                }
                m = re.exec(masked);
            }
        }
    }
    return best;
}

/** The backticked spans of a bullet, in order. */
function backticked(bullet: string): string[] {
    const out: string[] = [];
    const re = /`([^`]+)`/g;
    let m = re.exec(bullet);
    while (m !== null) {
        const inner = (m[1] as string).trim();
        if (inner.length > 0) out.push(inner);
        m = re.exec(bullet);
    }
    return out;
}

/**
 * Does `token` look like a filesystem path?
 *
 * A path separator, a leading dot, or a file extension. A bare word is NOT a
 * path: `migrations` alone could be a directory or a command, and the guide's
 * own example writes the trailing slash.
 */
/**
 * File extensions a single-dot token is accepted on.
 *
 * A closed list, because neither open rule works. `/\.[A-Za-z0-9]+$/` accepted
 * `users.id`, `app.debug` and `v2.1`; the replacement that excluded
 * all-lowercase single-dot tokens refused `package.json`, `main.go` and
 * `index.js` — a consumer's most likely first no-go — while still accepting
 * `Users.id` and `my_table.id`. Both were measured; the list is what
 * distinguishes the two classes.
 *
 * It is NOT exhaustive, and an earlier version of this comment said it
 * distinguished them "without guessing either way", which overstated it.
 * `Dockerfile`, `Makefile`, `terraform.tfvars`, `build.gradle`, `app.vue` and
 * a long tail of real extensions fall to prose. The direction is the safe one
 * — no row is built and a reason is printed — and a consumer who means a path
 * can always write the trailing slash or a `/`, which both bypass this list.
 */
const FILE_EXTENSIONS = new Set([
    'cjs', 'conf', 'css', 'csv', 'env', 'go', 'html', 'ini', 'java', 'js', 'json', 'jsx',
    'kt', 'lock', 'log', 'md', 'mjs', 'php', 'pem', 'py', 'rb', 'rs', 'scss', 'sh', 'sql',
    'sqlite', 'svg', 'toml', 'ts', 'tsx', 'txt', 'xml', 'yaml', 'yml',
]);

function looksLikePath(token: string): boolean {
    if (/\s/.test(token)) return false;
    if (token.includes('/')) return true;
    if (token.startsWith('.')) return true;
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return false;
    return FILE_EXTENSIONS.has(token.slice(dot + 1).toLowerCase());
}

/**
 * Characters that make a path token mean something other than it reads.
 *
 * `!` is a gitignore NEGATION on the host: a deny row starting with it carves
 * paths OUT of the deny rules listed before it, so a no-go bullet would weaken
 * a consumer's existing list while being shown as a deny row. `[`, `]` and `?`
 * are gitignore character classes, and the host does not escape a rule you
 * wrote yourself — `reports/[2024]/**` matches `reports/2/`, never the
 * directory the consumer named.
 *
 * A single leading `/` joins them, and the page carries a warning box about it:
 * a pattern with one leading slash "isn't an absolute path. The single leading
 * slash anchors at the settings source, not the filesystem root" — the page's
 * own example of the mistake is elided here because a home-shaped literal in a
 * published file is what `check_bundle_path_leakage` exists to refuse. A
 * consumer who writes `` `/etc/passwd` `` means the absolute path, and the row
 * would guard `<working directory>/etc/passwd` — a path that does not exist.
 *
 * `*` is deliberately NOT here: a consumer who writes `src/generated/**` means
 * that glob, and the guide teaches the trailing slash for everything else.
 */
const UNSAFE_PATH_CHARS = /^!|^\/(?!\/)|[[\]?]/;

const PROSE = (bullet: string, reason: string): NoGoClassification => ({
    bullet,
    kind: 'prose',
    token: null,
    action: null,
    reason,
});

/** Strip a leading markdown list marker, if present. */
function stripMarker(line: string): string {
    return line.replace(/^\s*[-*+]\s+/, '').trim();
}

export function classifyNoGo(raw: string): NoGoClassification {
    const bullet = stripMarker(raw);
    if (bullet.length === 0) return PROSE(bullet, 'empty bullet');

    const tokens = backticked(bullet);
    if (tokens.length === 0) {
        return PROSE(bullet, 'names no path and no command in backticks');
    }
    if (tokens.length > 1) {
        return PROSE(
            bullet,
            `${String(tokens.length)} backticked tokens — the subject is ambiguous, so no row is built`,
        );
    }

    const token = tokens[0] as string;
    const masked = maskTokens(bullet);
    const tokenAt = bullet.indexOf(`\`${token}\``);

    const negAt = firstWordIndex(masked, NEGATIONS);
    if (negAt === -1) {
        return PROSE(
            bullet,
            'states no prohibition, so the backticked token may be what the bullet recommends',
        );
    }
    const verb = verbAfter(masked, negAt);
    if (verb === null) {
        return PROSE(bullet, 'names no action verb, so what must not happen to it is unstated');
    }
    // The negation must govern the VERB too, not merely appear earlier in the
    // line. Without this, "If no cache exists, run `npm run build`" and "There
    // is no need to run `npm install`" both denied the command they permit —
    // round 1's finding narrowed rather than closed, measured by round 2.
    const negToVerb = masked.slice(negAt, verb.start);
    if (CLAUSE_BREAK.test(negToVerb)) {
        return PROSE(
            bullet,
            'the prohibition and the action verb sit in different clauses, so the bullet may ' +
                'be permitting rather than forbidding',
        );
    }
    if (INVERTS_THE_NEGATION.test(negToVerb)) {
        return PROSE(
            bullet,
            'the action is the object of another verb rather than the thing forbidden — ' +
                '"do not forget to X" asks for X, it does not forbid it',
        );
    }
    if (verb.start > tokenAt) {
        return PROSE(bullet, 'the action verb comes after the token, so the two may not be related');
    }
    const between = bullet.slice(verb.end, tokenAt);
    if (CLAUSE_BREAK.test(between)) {
        return PROSE(
            bullet,
            `\`${token}\` sits in a different clause from the prohibition — it may be the ` +
                'alternative the bullet recommends, so no rule is built',
        );
    }

    if (verb.action === 'run') {
        return {
            bullet,
            kind: 'command',
            token,
            action: verb.action,
            reason: 'a negated run verb over a backticked command',
        };
    }
    const action = verb.action;

    if (!looksLikePath(token)) {
        return PROSE(
            bullet,
            `a ${action} verb over \`${token}\`, which has no path shape — no rule is built`,
        );
    }
    if (UNSAFE_PATH_CHARS.test(token)) {
        return PROSE(
            bullet,
            `\`${token}\` carries a gitignore metacharacter (\`!\`, \`[\`, \`]\` or \`?\`) that the ` +
                'host does not escape, so a rule built from it would guard something else',
        );
    }

    return {
        bullet,
        kind: 'path',
        token,
        action,
        reason:
            action === 'read'
                ? 'a read verb over a backticked path'
                : 'an edit verb over a backticked path',
    };
}

/**
 * Every bullet of a `## No-gos` section, in file order.
 *
 * Non-bullet lines — the heading, blanks, a sentence between bullets — are not
 * no-gos and are skipped rather than classified as prose: a prose verdict is a
 * statement about a bullet somebody wrote, and a heading is not one.
 */
export function classifyNoGos(section: string): readonly NoGoClassification[] {
    return section
        .split('\n')
        .filter((line) => /^\s*[-*+]\s+\S/.test(line))
        .map((line) => classifyNoGo(line));
}

/** The `##` heading spellings a no-gos section is written under. */
const NO_GOS_HEADINGS = new Set(['no-gos', 'no-gos (never do this)']);

/**
 * The body of a consumer `AGENTS.md`'s `## No-gos` section, or `''`.
 *
 * Skips fenced blocks for the reason `report_project_contract` does, and it is
 * the same load-bearing reason rather than a shared habit: the consumer guide
 * ships this exact heading INSIDE a ```markdown fence as copy-in material, so a
 * reader without the skip would classify the guide's own example bullets and
 * offer to deny `migrations/` in a repository that never asked.
 */
export function extractNoGosSection(body: string): string {
    const out: string[] = [];
    /** The open fence's marker character AND its length. */
    let fence: { char: string; len: number } | null = null;
    let inside = false;
    const lines = body.split('\n');
    for (let n = 0; n < lines.length; n += 1) {
        const line = (lines[n] as string).trimEnd();
        const open = /^\s*(`{3,}|~{3,})/.exec(line);
        if (open !== null) {
            const marker = open[1] as string;
            const char = marker[0] as string;
            if (fence === null) {
                fence = { char, len: marker.length };
                continue;
            }
            // A fence closes only on the SAME character and at least its own
            // length. Tracking the character alone let a ````-delimited block
            // close on its first inner ``` line, so the rest of a guide's
            // copy-in example was read as the consumer's own rules.
            if (char === fence.char && marker.length >= fence.len) fence = null;
            continue;
        }
        if (fence !== null) continue;
        // A setext underline turns the PREVIOUS line into a heading, which
        // closes the section the same way an ATX heading does — but ONLY when
        // that previous line is a paragraph. After a blank line or a list
        // item, CommonMark makes `---` a thematic break, and the first version
        // of this branch treated every one of them as a heading: it popped the
        // preceding bullet and closed the section, so a `---` separator before
        // the next heading silently ate bullets. Silently is the word that
        // matters — a dropped bullet produces no row AND no reason line, so
        // the consent screen never mentions it.
        const prev = out.length > 0 ? (out[out.length - 1] as string) : '';
        const prevIsParagraph = prev.trim().length > 0 && !/^\s*[-*+>#]|^\s*\d+[.)]/.test(prev);
        if (/^(?:=+|-{2,})\s*$/.test(line) && inside && prevIsParagraph) {
            out.pop();
            inside = false;
            continue;
        }
        // ANY heading level closes the section; only a level-two one with a
        // matching title opens it. Matching `##` alone let a following `#
        // Appendix` leave the section open, so every bullet of every later
        // top-level section was classified as a no-go.
        const h = /^(#{1,6})[ \t]+(.+?)[ \t]*#*$/.exec(line);
        if (h !== null) {
            const level2 = (h[1] as string).length === 2;
            inside = level2 && NO_GOS_HEADINGS.has((h[2] as string).trim().toLowerCase());
            continue;
        }
        if (inside) out.push(line);
    }
    return out.join('\n');
}
