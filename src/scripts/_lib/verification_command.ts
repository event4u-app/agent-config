/**
 * The verification-command selector — one predicate, two importers.
 *
 * It first moved here byte-identical out of `hooks/turn_end_gate_hook.ts` so
 * that `_lib/verification_evidence.ts` could read it without importing a hook
 * that imports the evidence module straight back. That cycle resolves at
 * runtime today and breaks the day either side grows a module-level constant
 * reading the other, which is a failure nobody would trace to an import line.
 *
 * The hook re-exports the name, so every existing consumer — including both
 * pinning test files — addresses it at the path it always did.
 *
 * WHY IT STOPPED BEING A REGEX (2026-09-30).
 * The tree carried TWO expressions answering "did this command verify
 * anything", and they disagreed in both directions:
 *
 * - `_VERIFY_RE` here matched a verification token **anywhere on the line**, so
 *   `ls tests`, `cat build.log`, `git checkout main`, `mkdir build` and
 *   `git commit -m "fix ci"` all cleared detector C — the exact case this
 *   header claimed to reject. Measured at the pin: all six returned `true`.
 * - `_VERIFICATION_RE` in `before_complete_hook.ts` was head-anchored to a
 *   fixed vendor list and refused `npx vitest run`, `tsc --noEmit` and every
 *   `./scripts-run src/scripts/lint_*` — commands this project runs constantly.
 *   Measured at the pin: all three returned `false`.
 *
 * Both accepted `npm test || true`, where the shell discards the failure.
 *
 * The audited allowlist passed the whole time the first defect was live,
 * because not one of its seven negatives put a verify token in an ARGUMENT
 * position. A word-boundary regex cannot express "the head of the segment",
 * which is the property that actually distinguishes `npm test` from `ls tests`,
 * so the predicate is now structural: split on shell separators, drop a
 * segment whose failure the shell discards, and classify each remaining
 * segment on its HEAD.
 *
 * THE LISTS ARE STILL DELIBERATELY NARROW.
 * A positive list. The alternative — treating any `Bash` call as verification —
 * was rejected because `ls` would then clear an unverified edit, which is the
 * failure mode `verify-before-complete` names ("relying on partial
 * verification"). The cost of narrowness is a MISSED detection when a project
 * verifies by some command not listed here, and that is the safe direction for
 * a gate that can refuse a turn: a false negative costs one unguarded turn, a
 * false positive teaches the user to switch the gate off.
 *
 * AUDITED 2026-08-17, re-seeded 2026-09-30 from the union of both lists minus
 * every row that only ever matched on an argument. The table of every command
 * with its verdict is `turn_end_verify_allowlist.test.ts`; the two directions
 * of the old disagreement are `verification_command_anchoring.test.ts`.
 *
 * Deliberate NON-additions, kept because Risk 2 of the originating roadmap is
 * that every addition is a way to satisfy the gate without verifying anything:
 *
 *   · `npm run prepack` — a lifecycle hook whose content is per-project. Here
 *     it validates; elsewhere it copies files.
 *   · `task sync` / `task generate-tools` / `agent-config roadmap:progress` —
 *     GENERATORS. They rewrite the tree; they check nothing.
 *   · `agent-config gates --all` — enumerates gates, runs none.
 *   · `rector` — a refactoring tool. Its dry run prints a diff; it asserts
 *     nothing. It appears in `_VERIFICATION_RE`'s list and is dropped from the
 *     union on the strength of the audited `false` row, which carries a reason
 *     where the other list carried only a name.
 *   · `./scripts-run src/scripts/rule_activation_census` — a census writes a
 *     report; it asserts nothing. This is why the `scripts-run` rule keys on
 *     the `check_` / `lint_` prefix rather than on the runner.
 *
 * `psalm` IS carried, unlike the pre-2026-09-30 note here which argued it out
 * for want of a local user: it was in `_VERIFICATION_RE` all along, so the
 * union rule admits it and dropping it would be a narrowing this change did not
 * set out to make.
 *
 * WHAT THIS SELECTOR STILL CANNOT DO: it reads the command TEXT, so
 * `vitest run` matches whether or not it passed. Deciding whether a run proved
 * anything is `verification_evidence.ts`, which reads the exit code and the
 * summary the command printed. This selector decides only what is WORTH
 * recording and classifying.
 */

/** Binaries that verify when they are the head of a segment. */
const VERIFY_BINARIES: ReadonlySet<string> = new Set([
    'vitest',
    'jest',
    'pytest',
    'phpunit',
    'pest',
    'tsc',
    'eslint',
    'ruff',
    'mypy',
    'pyright',
    'clippy',
    'phpstan',
    'psalm',
    'ecs',
]);

/** Prefixes that delegate to the real command; dropped before classifying. */
const DELEGATING_HEADS: ReadonlySet<string> = new Set([
    'npx',
    'bunx',
    'sudo',
    'time',
    'command',
]);

/** Path prefixes a binary is commonly reached through. */
const PATH_PREFIXES: readonly string[] = [
    './',
    'vendor/bin/',
    '.venv/bin/',
    'node_modules/.bin/',
    'bin/',
];

/** A script or subcommand name that names a check rather than a build step. */
const VERIFY_WORD = /(^|[-_:])(test|tests|check|checks|lint|typecheck|tsc|qa|preflight|smoke|validate)([-_:]|$)/i;

/** `npm run build` verifies here; `task build` is not in the audited surface. */
const NPM_SCRIPT_WORD = /(^|[-_:])(test|tests|check|checks|lint|typecheck|tsc|build)([-_:]|$)/i;

/** Segment separators, and whether a failure before them survives. */
interface Segment {
    readonly words: readonly string[];
    /** The separator that FOLLOWS this segment, or null at the end. */
    readonly nextSep: '&&' | '||' | ';' | '|' | null;
    /** The head word of the segment that follows, lowercased. */
    readonly nextHead: string | null;
}

/** Strip an unquoted trailing `#` comment. */
function stripComment(command: string): string {
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < command.length; i += 1) {
        const ch = command[i];
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        else if (ch === '"' && !inSingle) inDouble = !inDouble;
        else if (ch === '#' && !inSingle && !inDouble && (i === 0 || /\s/.test(command[i - 1] ?? ''))) {
            return command.slice(0, i);
        }
    }
    return command;
}

/** Split into segments, remembering the separator that follows each. */
function splitSegments(command: string): Segment[] {
    const raw: Array<{ text: string; sep: Segment['nextSep'] }> = [];
    let buf = '';
    let inSingle = false;
    let inDouble = false;
    for (let i = 0; i < command.length; i += 1) {
        const ch = command[i] as string;
        const two = command.slice(i, i + 2);
        if (ch === "'" && !inDouble) {
            inSingle = !inSingle;
            buf += ch;
            continue;
        }
        if (ch === '"' && !inSingle) {
            inDouble = !inDouble;
            buf += ch;
            continue;
        }
        if (!inSingle && !inDouble) {
            if (two === '&&' || two === '||') {
                raw.push({ text: buf, sep: two as '&&' | '||' });
                buf = '';
                i += 1;
                continue;
            }
            if (ch === ';' || ch === '|') {
                raw.push({ text: buf, sep: ch as ';' | '|' });
                buf = '';
                continue;
            }
        }
        buf += ch;
    }
    raw.push({ text: buf, sep: null });

    return raw.map((entry, idx) => {
        const next = raw[idx + 1];
        const nextWords = next ? words(next.text) : [];
        return {
            words: words(entry.text),
            nextSep: entry.sep,
            nextHead: (nextWords[0] ?? null)?.toLowerCase() ?? null,
        };
    });
}

/** Tokenise a segment, dropping leading `VAR=value` assignments. */
function words(text: string): string[] {
    const tokens = text.trim().split(/\s+/).filter((w) => w.length > 0);
    let i = 0;
    while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i] as string)) i += 1;
    return tokens.slice(i);
}

/** Strip a path prefix from a binary name. */
function bareName(word: string): string {
    let w = word;
    for (const prefix of PATH_PREFIXES) {
        if (w.startsWith(prefix)) {
            w = w.slice(prefix.length);
            break;
        }
    }
    const slash = w.lastIndexOf('/');
    return (slash >= 0 ? w.slice(slash + 1) : w).toLowerCase();
}

/**
 * Does the shell discard this segment's failure?
 *
 * `cmd || true`, `cmd || :` and `cmd ; true` all leave the caller with exit 0
 * whatever `cmd` did, so a verification there proves nothing about the tree.
 * Deliberately narrow: `cmd || exit 1` propagates the failure and still counts.
 */
function failureIsDiscarded(seg: Segment): boolean {
    if (seg.nextSep === '||') return seg.nextHead === 'true' || seg.nextHead === ':';
    if (seg.nextSep === ';') return seg.nextHead === 'true' || seg.nextHead === ':';
    return false;
}

/** Classify one segment on its head. */
function segmentVerifies(rawWords: readonly string[]): boolean {
    const w = rawWords.filter((x) => x.length > 0);
    let idx = 0;
    // Peel delegating prefixes: `npx vitest run`, `sudo make test`.
    while (idx < w.length && DELEGATING_HEADS.has(bareName(w[idx] as string))) idx += 1;
    if (idx >= w.length) return false;

    const head = bareName(w[idx] as string);
    const rest = w.slice(idx + 1).map((x) => x.toLowerCase());
    const arg1 = rest[0] ?? '';

    if (VERIFY_BINARIES.has(head)) return true;

    switch (head) {
        case 'npm':
        case 'pnpm':
        case 'yarn':
        case 'bun': {
            // `pnpm dlx vitest` delegates; `npm run test:ts` names a script.
            if (arg1 === 'dlx' || arg1 === 'exec') return segmentVerifies(rest.slice(1));
            const script = arg1 === 'run' ? (rest[1] ?? '') : arg1;
            return NPM_SCRIPT_WORD.test(script);
        }
        case 'task':
            return VERIFY_WORD.test(arg1) || /^ci([-_:]|$)/i.test(arg1);
        case 'cargo':
            return arg1 === 'test' || arg1 === 'check' || arg1 === 'clippy';
        case 'go':
            return arg1 === 'test' || arg1 === 'vet';
        case 'make':
            return VERIFY_WORD.test(arg1) || /^ci([-_:]|$)/i.test(arg1);
        case 'composer':
            return VERIFY_WORD.test(arg1) || arg1 === 'phpstan';
        case 'php':
            return arg1 === 'artisan' && (rest[1] ?? '') === 'test';
        case 'artisan':
            return arg1 === 'test';
        case 'python':
        case 'python3':
            return arg1 === '-m' && VERIFY_BINARIES.has(rest[1] ?? '');
        case 'node':
        case 'deno':
            // `node --test` is a runner selected by a FLAG, not by a
            // subcommand, so head-anchoring alone would refuse it. Caught by
            // `verification_evidence.test.ts` when this predicate narrowed:
            // the old token-anywhere regex accepted it by accident and neither
            // explicit list named it, so the union seeding missed it too.
            return rest.some((a) => a === 'test' || a.startsWith('--test'));
        case 'scripts-run': {
            // `./scripts-run src/scripts/lint_x` verifies; `…/rule_activation_census`
            // writes a report and asserts nothing, which is why this keys on the
            // script's own prefix rather than on the runner.
            const script = bareName(arg1);
            return /^(check|lint|verify|validate)[-_]/.test(script);
        }
        default:
            return false;
    }
}

/**
 * True when the command runs something that asserts the tree still holds.
 *
 * Classified per shell segment on the segment's HEAD, so a verification token
 * appearing as an argument — `ls tests`, `git commit -m "fix ci"` — never
 * counts, and a chained `task sync && task ci` counts on its second segment.
 */
export function isVerificationCommand(command: string): boolean {
    if (!command) return false;
    const segments = splitSegments(stripComment(command));
    return segments.some((seg) => !failureIsDiscarded(seg) && segmentVerifies(seg.words));
}

/**
 * The RECORDER's net — deliberately wider than the predicate above, and not a
 * leftover of the two-regex era it replaces.
 *
 * The two answer different questions. `isVerificationCommand` answers *did
 * this verify*, and a false positive there clears an unverified edit, so it is
 * head-anchored and narrow. This one answers *is this worth writing down for
 * `classifyRun` to judge*, and there the costly error is the opposite: a
 * recorder that filtered `echo test` out would leave the turn-end gate unable
 * to tell "the turn ran a non-verification command" from "the turn ran
 * nothing at all", and `not_a_verification_command` is a verdict the gate
 * needs to SEE rather than infer from silence.
 *
 * That is why unifying the two call sites into one predicate was tried and
 * rejected on 2026-09-30: it is not two spellings of one idea, it is two
 * questions with opposite error costs. What was wrong before was that each
 * question had its own private regex in its own file and the two also
 * disagreed about the FIRST question. Both now live here, and only this one
 * matches on a token anywhere in the line.
 */
const _WIDE_CANDIDATE_RE =
    /\b(test|tests|vitest|jest|pytest|phpunit|pest|tsc|eslint|ruff|mypy|pyright|clippy|phpstan|typecheck|lint[-_:a-z]*|build|ci|preflight|smoke[-_:a-z]*|check[-_:a-z]*|validate[-_:a-z]*)\b|\b(task|npm|pnpm|yarn|composer|cargo|go|make|php artisan|bun)\s+(run\s+)?\S*(test|check|lint|build|ci|typecheck)/i;

export function mightBeVerification(command: string): boolean {
    return _WIDE_CANDIDATE_RE.test(command);
}
