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
/** Verbs that forbid READING. A `Read` deny also covers edits and writes. */
const READ_VERBS = ['read', 'open', 'view', 'cat', 'print', 'dump'];
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
];
/** Verbs that forbid EXECUTING. */
const RUN_VERBS = ['run', 'execute', 'invoke', 'call'];
function actionOf(bullet) {
    const words = new Set(bullet.toLowerCase().match(/[a-z]+/g) ?? []);
    // Run first: "never run `x`" is decided by the verb alone, while a read or
    // edit verb still has to clear the path-shape test below.
    if (RUN_VERBS.some((v) => words.has(v)))
        return 'run';
    if (READ_VERBS.some((v) => words.has(v)))
        return 'read';
    if (EDIT_VERBS.some((v) => words.has(v)))
        return 'edit';
    return null;
}
/** The backticked spans of a bullet, in order. */
function backticked(bullet) {
    const out = [];
    const re = /`([^`]+)`/g;
    let m = re.exec(bullet);
    while (m !== null) {
        const inner = m[1].trim();
        if (inner.length > 0)
            out.push(inner);
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
function looksLikePath(token) {
    if (/\s/.test(token))
        return false;
    return token.includes('/') || token.startsWith('.') || /\.[A-Za-z0-9]+$/.test(token);
}
const PROSE = (bullet, reason) => ({
    bullet,
    kind: 'prose',
    token: null,
    action: null,
    reason,
});
/** Strip a leading markdown list marker, if present. */
function stripMarker(line) {
    return line.replace(/^\s*[-*+]\s+/, '').trim();
}
export function classifyNoGo(raw) {
    const bullet = stripMarker(raw);
    if (bullet.length === 0)
        return PROSE(bullet, 'empty bullet');
    const tokens = backticked(bullet);
    if (tokens.length === 0) {
        return PROSE(bullet, 'names no path and no command in backticks');
    }
    if (tokens.length > 1) {
        return PROSE(bullet, `${String(tokens.length)} backticked tokens — the subject is ambiguous, so no row is built`);
    }
    const token = tokens[0];
    const action = actionOf(bullet);
    if (action === null) {
        return PROSE(bullet, 'names no action verb, so what must not happen to it is unstated');
    }
    if (action === 'run') {
        return {
            bullet,
            kind: 'command',
            token,
            action,
            reason: 'a run verb over a backticked command',
        };
    }
    if (!looksLikePath(token)) {
        return PROSE(bullet, `a ${action} verb over \`${token}\`, which has no path shape — no rule is built`);
    }
    return {
        bullet,
        kind: 'path',
        token,
        action,
        reason: action === 'read'
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
export function classifyNoGos(section) {
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
export function extractNoGosSection(body) {
    const out = [];
    let fence = null;
    let inside = false;
    for (const raw of body.split('\n')) {
        const line = raw.trimEnd();
        const open = /^\s*(```+|~~~+)/.exec(line);
        if (open !== null) {
            const marker = open[1];
            if (fence === null)
                fence = marker[0];
            else if (marker.startsWith(fence))
                fence = null;
            continue;
        }
        if (fence !== null)
            continue;
        const h = /^##[ \t]+(.+?)[ \t]*#*$/.exec(line);
        if (h !== null) {
            inside = NO_GOS_HEADINGS.has(h[1].trim().toLowerCase());
            continue;
        }
        if (inside)
            out.push(line);
    }
    return out.join('\n');
}
//# sourceMappingURL=noGoRules.js.map