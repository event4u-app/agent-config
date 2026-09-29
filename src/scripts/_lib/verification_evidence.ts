/**
 * Verification evidence — what a run RECORD says, never what a command SAYS.
 *
 * The defect this module exists to close: the turn-end gate's detector C asks
 * whether a verification command appeared in the transcript after the last
 * edit, and answers that by matching the command TEXT against a regex. `echo
 * test` matches it — the word `test` is in the pattern — so a turn can change
 * production code, echo a word, and end. Nothing in the estate read whether the
 * command ran, what it exited with, or whether it discovered a single test.
 *
 * So the unit here is a RECORD, not a string: a command, an exit code, and the
 * tails of what it printed. The classifier is pure — no fs, no spawn, no clock,
 * no process state — because its verdict is quoted into a refusal and a refusal
 * that depends on the machine it ran on cannot be reproduced by the person it
 * refused.
 *
 * WHY `INVALID_RUN` CARRIES A REASON AND NOT A BOOLEAN.
 * Two of the reasons say the INSTRUMENT failed (`exit_code_unavailable`,
 * `unreadable_record`) and five say the RUN failed. Only the second kind may
 * ever refuse a turn: a host that omits an exit code has told us nothing about
 * the operator's work, and refusing on it would punish the turn for the
 * recorder's gap. `INSTRUMENT_GAP_REASONS` below is that split, exported so the
 * consumer reads the distinction rather than re-deriving it from a comment.
 *
 * WHY EXIT 0 WITH NO PARSABLE SUMMARY IS A PASS.
 * `tsc --noEmit`, `eslint` and `phpstan` print nothing on success — silence is
 * the Unix convention for it. A classifier demanding a test summary would
 * reclassify the most common green signal in this repository as invalid, and
 * would refuse every consumer whose runner this module has never heard of.
 * Exit 0 from a command the verification set admits IS the machine-readable
 * signal; the parsers below only ever make the verdict SHARPER (a summary
 * reporting failures overrides a zero exit, and a summary reporting zero tests
 * overrides it too).
 */

import { isVerificationCommand } from './verification_command.js';


export type InvalidRunReason =
    | 'zero_tests_discovered'
    | 'nonzero_exit_without_test_failure'
    | 'fixture_or_load_failure'
    | 'unreadable_record'
    | 'not_a_verification_command'
    | 'exit_code_unavailable'
    | 'timeout_or_killed';

export type VerificationVerdict =
    | { readonly kind: 'PASS_EVIDENCE_OK' }
    | { readonly kind: 'FAIL_EVIDENCE' }
    | { readonly kind: 'INVALID_RUN'; readonly reason: InvalidRunReason };

/**
 * One observed run of one command.
 *
 * `exit_code: null` is a real and distinct value from `0`: it means the host
 * did not surface one, which is a fact about the host. Conflating it with
 * success is the single most dangerous shortcut available here, so the type
 * makes it impossible to write by accident.
 */
export interface RunRecord {
    readonly command: string;
    readonly exit_code: number | null;
    readonly stdout_tail?: string;
    readonly stderr_tail?: string;
    readonly runner?: string;
    /** The host reported the call interrupted — a kill, never a verdict on the work. */
    readonly interrupted?: boolean;
    /** How the recorder obtained `exit_code`. Advisory; nothing branches on it. */
    readonly exit_source?: 'field' | 'error_prefix' | 'response_shape' | null;
}

/**
 * Reasons that describe a gap in the INSTRUMENT rather than a failure of the run.
 *
 * A consumer deciding whether to refuse reads this set; it never decides from
 * the reason string directly. Risk 1 of the parent roadmap is exactly this:
 * "a passing run classifies INVALID_RUN" when the parser has not met the
 * consumer's runner, and the mitigation is that an instrument gap is logged as
 * a finding and never refused on.
 */
export const INSTRUMENT_GAP_REASONS: ReadonlySet<InvalidRunReason> = new Set<InvalidRunReason>([
    'exit_code_unavailable',
    'unreadable_record',
]);

/** Whether this verdict leaves the turn unrefusable — a pass, or a gap in the instrument. */
export function isInstrumentGap(verdict: VerificationVerdict): boolean {
    return verdict.kind === 'INVALID_RUN' && INSTRUMENT_GAP_REASONS.has(verdict.reason);
}

/**
 * Executables that cannot verify anything, whatever words follow them.
 *
 * A BLOCK list and not an allow list, and the direction is the whole argument.
 * `not_a_verification_command` is a REFUSING reason: a command wrongly landing
 * in it refuses honest work, which is the failure that teaches an operator to
 * switch the gate off. An allow list would put every runner this module has
 * never met — `bash scripts/test.sh`, `./run-tests.sh`, a consumer's in-house
 * wrapper — into that refusing bucket on day one. So the rejection is narrow:
 * only executables that demonstrably assert nothing are named, and everything
 * unknown is given the benefit of its exit code.
 *
 * `git` is here because `git log`, `git show` and `git diff` read history; the
 * one git subcommand anybody could call verification is `git bisect run`, which
 * verifies by invoking a different command that gets its own record.
 */
const NON_VERIFYING_EXECUTABLES: ReadonlySet<string> = new Set([
    ':', 'awk', 'basename', 'cat', 'cd', 'chmod', 'cp', 'curl', 'cut', 'date', 'dirname',
    'echo', 'exit', 'export', 'false', 'find', 'git', 'grep', 'head', 'less', 'ln', 'ls',
    'mkdir', 'more', 'mv', 'open', 'printf', 'pwd', 'realpath', 'rg', 'rm', 'sed', 'sleep',
    'sort', 'source', 'tail', 'tee', 'touch', 'tr', 'true', 'type', 'uniq', 'wc', 'wget',
    'which', 'yes',
]);

/** Wrappers that prefix a real command without being one. */
const COMMAND_PREFIXES: ReadonlySet<string> = new Set([
    'bunx', 'command', 'env', 'exec', 'nice', 'nohup', 'npx', 'sudo', 'time',
]);

/** The executable a single command segment actually runs, lower-cased and unpathed. */
function leadingExecutable(segment: string): string | null {
    for (const raw of segment.trim().split(/\s+/)) {
        if (raw === '') continue;
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(raw)) continue; // FOO=bar prefix
        const base = (raw.split('/').pop() ?? raw).replace(/\.exe$/i, '').toLowerCase();
        if (base === '') continue;
        if (COMMAND_PREFIXES.has(base)) continue;
        return base;
    }
    return null;
}

/**
 * Whether any segment of this command line could have verified something.
 *
 * The selector in `verification_command.ts` answers "is this worth recording",
 * and it matches `echo test` because the word `test` is in its pattern. That is
 * the defect the record path exists to close, so this cannot delegate to it
 * alone: a segment whose executable cannot assert anything is skipped BEFORE
 * the selector is consulted, and only the surviving segments may qualify.
 */
function canVerify(command: string): boolean {
    for (const segment of command.split(/&&|\|\||[;|\n]/)) {
        if (segment.trim() === '') continue;
        const exe = leadingExecutable(segment);
        if (exe !== null && NON_VERIFYING_EXECUTABLES.has(exe)) continue;
        if (isVerificationCommand(segment)) return true;
    }
    return false;
}

/**
 * Exit codes a shell reports for a process the kernel killed.
 *
 * 128 + SIGKILL(9) and 128 + SIGTERM(15). A test runner the CI timeout reaped
 * printed whatever it had got through; its partial output can easily contain a
 * passing summary for the files it reached, which is why a kill is checked
 * BEFORE the summary is trusted and never after.
 */
const KILLED_EXIT_CODES: ReadonlySet<number> = new Set([137, 143]);

/**
 * Output shapes that mean the suite never ran, as distinct from running clean.
 *
 * Deliberately separate from `isVacuousOutput` in the recorder: that one asks
 * whether a whole output blob proves nothing, line by line, and answers `false`
 * for empty output. This one asks whether a specific "the loader died" marker
 * is present anywhere, which is a different question with a different default.
 */
const LOAD_FAILURE_PATTERNS: readonly RegExp[] = [
    /\bfailed to load\b/i,
    /\berror(?:s)? collecting\b/i,
    /\bcollection error\b/i,
    /\bcannot find module\b/i,
    /\bmodule not found\b/i,
    /\bunable to load\b/i,
    /\btransform failed\b/i,
    /\bconftest\.py\b.*\berror\b/i,
    /\bcould not open input file\b/i,
    /\bfatal error\b/i,
];

/** A parsed test summary. `total === null` means the runner did not state one. */
interface Summary {
    readonly passed: number;
    readonly failed: number;
    readonly total: number | null;
}

function _num(m: RegExpMatchArray | null): number {
    return m?.[1] === undefined ? 0 : Number(m[1]);
}

/**
 * vitest: `Tests  3 failed | 812 passed (815)`; jest: `Tests: 1 failed, 2 passed, 3 total`.
 *
 * One parser for both because both put the counts on a line whose label is
 * `Tests`, and splitting them would mean two places to keep a count regex
 * correct. The separators differ (`|` vs `,`) and neither parser cares.
 */
function parseVitestOrJest(text: string): Summary | null {
    const line = /^[ \t]*Tests:?[ \t]+(.+)$/m.exec(text);
    if (line?.[1] === undefined) return null;
    const body = line[1];
    const failed = _num(/(\d+)\s+failed/i.exec(body));
    const passed = _num(/(\d+)\s+passed/i.exec(body));
    const totalMatch = /\((\d+)\)\s*$/.exec(body.trim()) ?? /(\d+)\s+total/i.exec(body);
    const total = totalMatch?.[1] === undefined ? null : Number(totalMatch[1]);
    return { passed, failed, total };
}

/**
 * pytest's `-q` tail: `3 passed, 1 failed in 0.12s`, or `no tests ran in 0.01s`.
 *
 * `error` is counted as a failure rather than as its own axis: a collection
 * error and an assertion failure are the same answer to "did this run prove the
 * change works", and the separate `fixture_or_load_failure` reason already
 * carries the case where the distinction matters.
 */
function parsePytest(text: string): Summary | null {
    if (/\bno tests ran\b/i.test(text)) return { passed: 0, failed: 0, total: 0 };
    const line = /^[= ]*((?:\d+\s+(?:passed|failed|error|errors|skipped|xfailed|xpassed|deselected)[,\s]*)+)(?:in\s+[\d.]+s)?[= ]*$/im.exec(
        text,
    );
    if (line?.[1] === undefined) return null;
    const body = line[1];
    const passed = _num(/(\d+)\s+passed/i.exec(body));
    const failed =
        _num(/(\d+)\s+failed/i.exec(body)) + _num(/(\d+)\s+errors?\b/i.exec(body));
    const skipped = _num(/(\d+)\s+skipped/i.exec(body));
    return { passed, failed, total: passed + failed + skipped };
}

/**
 * phpunit (`OK (15 tests, 30 assertions)`, `Tests: 15, Assertions: 30, Failures: 1.`)
 * and pest (`Tests:    2 failed, 10 passed (24 assertions)`).
 *
 * Pest's line is handled by `parseVitestOrJest` above — it wears the same
 * `Tests:` label with `failed`/`passed` words — so only the two phpunit shapes
 * need their own reading here.
 */
function parsePhpunit(text: string): Summary | null {
    if (/\bno tests executed\b/i.test(text)) return { passed: 0, failed: 0, total: 0 };
    const ok = /\bOK\s*\((\d+)\s+tests?/i.exec(text);
    if (ok?.[1] !== undefined) {
        const n = Number(ok[1]);
        return { passed: n, failed: 0, total: n };
    }
    const counted = /^[ \t]*Tests:\s*(\d+),\s*Assertions:\s*\d+(.*)$/m.exec(text);
    if (counted?.[1] === undefined) return null;
    const total = Number(counted[1]);
    const rest = counted[2] ?? '';
    const failed =
        _num(/Failures:\s*(\d+)/i.exec(rest)) +
        _num(/Errors:\s*(\d+)/i.exec(rest)) +
        _num(/Risky:\s*(\d+)/i.exec(rest));
    return { passed: Math.max(total - failed, 0), failed, total };
}

/**
 * TAP: a `1..N` plan with `ok` / `not ok` lines, or a `# fail N` trailer.
 *
 * The plan is authoritative for the total because a truncated stream can carry
 * fewer result lines than it promised — and a stream that promised five results
 * and delivered two is not a clean run, which the total/seen mismatch below
 * lets the caller see as a non-pass.
 */
function parseTap(text: string): Summary | null {
    const plan = /^1\.\.(\d+)\s*$/m.exec(text);
    const okLines = text.match(/^ok\b/gim)?.length ?? 0;
    const notOkLines = text.match(/^not ok\b/gim)?.length ?? 0;
    const trailerFail = /^#\s*fail\s+(\d+)\s*$/im.exec(text);
    if (plan?.[1] === undefined && okLines === 0 && notOkLines === 0) return null;
    const total = plan?.[1] === undefined ? okLines + notOkLines : Number(plan[1]);
    const failed = trailerFail?.[1] === undefined ? notOkLines : Number(trailerFail[1]);
    return { passed: okLines, failed, total };
}

/**
 * Every parser, tried in turn; the first that recognises the text wins.
 *
 * Order matters only between phpunit and vitest/jest, and only because pest
 * writes a `Tests:` line that the vitest parser reads correctly — so phpunit's
 * stricter `Tests: <n>, Assertions:` shape is tried first and declines when the
 * line is pest's.
 */
export function parseSummary(text: string): Summary | null {
    return parsePhpunit(text) ?? parseVitestOrJest(text) ?? parsePytest(text) ?? parseTap(text);
}

function output(record: RunRecord): string {
    return `${record.stdout_tail ?? ''}\n${record.stderr_tail ?? ''}`;
}

/**
 * Classify one run record.
 *
 * The order of the checks IS the policy and is not interchangeable:
 *
 *   1. an unreadable record says nothing about the run;
 *   2. a command that cannot verify anything is never evidence, whatever it
 *      exited with — this is the `echo test` case the regex path admits;
 *   3. a missing exit code is the host's gap, reported as one;
 *   4. a killed process is checked BEFORE its output, because partial output
 *      from a reaped runner can carry a passing summary for the files it
 *      reached;
 *   5. a load failure is checked before the summary, because a suite that never
 *      loaded can still print a summary of the zero tests it ran;
 *   6. the summary then sharpens or overrides the exit code;
 *   7. and only then does a bare exit code decide.
 */
export function classifyRun(record: unknown): VerificationVerdict {
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
        return { kind: 'INVALID_RUN', reason: 'unreadable_record' };
    }
    const r = record as Partial<RunRecord>;
    if (typeof r.command !== 'string' || r.command.trim() === '') {
        return { kind: 'INVALID_RUN', reason: 'unreadable_record' };
    }
    if (!canVerify(r.command)) {
        return { kind: 'INVALID_RUN', reason: 'not_a_verification_command' };
    }
    if (
        r.exit_code !== null
        && r.exit_code !== undefined
        && (typeof r.exit_code !== 'number' || !Number.isFinite(r.exit_code))
    ) {
        return { kind: 'INVALID_RUN', reason: 'unreadable_record' };
    }

    const text = output(r as RunRecord);
    const summary = parseSummary(text);

    // A KILL is read before anything the process printed: a reaped runner's
    // partial output can carry a passing summary for the files it reached. A
    // summary that reports FAILURES still wins, because those failures happened.
    if (r.interrupted === true || (typeof r.exit_code === 'number' && KILLED_EXIT_CODES.has(r.exit_code))) {
        if (summary !== null && summary.failed > 0) return { kind: 'FAIL_EVIDENCE' };
        return { kind: 'INVALID_RUN', reason: 'timeout_or_killed' };
    }

    // A RUN THAT PRINTED ITS OWN FAILURES IS A FAILURE, exit code or not. This
    // sits above the missing-exit-code gap deliberately, and the order was the
    // other way round until an independent review measured what it cost: on
    // Claude Code the success shape carries no exit field at all, so a failing
    // run whose summary said `2 failed` classified `exit_code_unavailable`,
    // became an instrument gap, and ended the turn normally. The evidence of
    // failure was in the record, was parseable, and was thrown away. A host's
    // silence about an exit status tells us nothing about the operator's work;
    // a runner's own failure count tells us plenty.
    if (summary !== null && summary.failed > 0) return { kind: 'FAIL_EVIDENCE' };

    if (r.exit_code === null || r.exit_code === undefined) {
        return { kind: 'INVALID_RUN', reason: 'exit_code_unavailable' };
    }

    // A LOAD FAILURE, and only where it is not contradicted by a clean summary.
    // The patterns are broad on purpose — `fatal error`, `cannot find module` —
    // and a passing run that merely PRINTS one is common: vitest echoes a
    // `stderr |` block verbatim, so any test exercising an error path can carry
    // the words. Checking this above a summary reporting passes refused honest
    // work, which is the expensive direction for a gate that can block a turn.
    // The case the original ordering was defending — "a suite that never loaded
    // can still print a summary of the zero tests it ran" — is already covered
    // by `zero_tests_discovered` below, and by the `passed === 0` clause here.
    if (
        (summary === null || summary.passed === 0)
        && LOAD_FAILURE_PATTERNS.some((re) => re.test(text))
    ) {
        return { kind: 'INVALID_RUN', reason: 'fixture_or_load_failure' };
    }

    if (summary !== null) {
        if (summary.failed > 0) return { kind: 'FAIL_EVIDENCE' };
        if (summary.total === 0 || (summary.total === null && summary.passed === 0)) {
            return { kind: 'INVALID_RUN', reason: 'zero_tests_discovered' };
        }
        if (summary.total !== null && summary.total > 0 && summary.passed === 0) {
            return { kind: 'INVALID_RUN', reason: 'zero_tests_discovered' };
        }
        if (r.exit_code !== 0) {
            return { kind: 'INVALID_RUN', reason: 'nonzero_exit_without_test_failure' };
        }
        return { kind: 'PASS_EVIDENCE_OK' };
    }

    if (r.exit_code !== 0) {
        return { kind: 'INVALID_RUN', reason: 'nonzero_exit_without_test_failure' };
    }
    return { kind: 'PASS_EVIDENCE_OK' };
}

/**
 * The runner a command names, or `other`.
 *
 * Advisory only — nothing in `classifyRun` branches on it. It exists so a
 * finding can say which parser was in play when a verdict is disputed, which is
 * the difference between "the classifier is wrong" and "the classifier has
 * never met this runner".
 */
export function runnerOf(command: string): string {
    for (const [name, re] of [
        ['vitest', /\bvitest\b/i],
        ['jest', /\bjest\b/i],
        ['pytest', /\bpytest\b/i],
        ['phpunit', /\bphpunit\b/i],
        ['pest', /\bpest\b/i],
        ['go', /\bgo\s+test\b/i],
        ['cargo', /\bcargo\s+test\b/i],
    ] as const) {
        if (re.test(command)) return name;
    }
    return 'other';
}

/**
 * One turn's recorded runs, as the recorder left them.
 *
 * `edits_this_turn` is the recorder's OWN total, not a count taken from a
 * transcript. Both numbers in the placement comparison below therefore come
 * from the same counter in the same file, so the comparison cannot be thrown
 * off by a transcript reader and the recorder disagreeing about what an edit is.
 */
export interface TurnRunState {
    readonly runs: readonly unknown[];
    readonly edits_this_turn: number;
}

/**
 * What the records say about the turn, and whether they may be refused on.
 *
 * Three fields rather than a boolean because the three answers are genuinely
 * different: a pass allows, a failure refuses, and a gap in the INSTRUMENT
 * allows while saying so. Collapsing the third into either of the others is
 * Risk 1 of the plan realised — "a passing run classifies INVALID_RUN" and the
 * turn is refused for the recorder's shortcoming.
 */
export interface RecordReading {
    /** A `PASS_EVIDENCE_OK` record placed after the turn's last edit. */
    readonly passed: boolean;
    /** A `FAIL_EVIDENCE` record placed after the turn's last edit. */
    readonly failed: boolean;
    /** Nothing judgeable, and the reason is the recorder's — never refuse on this. */
    readonly instrumentGap: boolean;
    /** Every non-passing verdict in the window, for the finding text. Advisory. */
    readonly reasons: readonly InvalidRunReason[];
}

/**
 * Where in the turn's edit sequence a record sits, or `null` when unplaceable.
 *
 * `after_edits` is the recorder's edit counter as it stood when the command ran.
 * A record carrying no number cannot be placed at all, and an unplaceable record
 * is treated below as an instrument gap rather than as either evidence — which
 * is the direction that under-refuses.
 */
function placeRecord(raw: unknown): number | null {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const v = (raw as Record<string, unknown>)['after_edits'];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    return v;
}

/**
 * Read the turn's records for evidence that its LAST edit was verified.
 *
 * A record qualifies only when `after_edits >= edits_this_turn` — nothing was
 * edited after the command ran. That is the same freshness clause the transcript
 * path applies by scanning only after the last edit, and keeping it is the
 * difference between this being a stricter reading of the same rule and being a
 * different, weaker rule wearing the same name.
 */
export function readRunEvidence(state: TurnRunState): RecordReading {
    const reasons: InvalidRunReason[] = [];
    let passed = false;
    let failed = false;
    let gap = false;

    for (const raw of state.runs) {
        const placed = placeRecord(raw);
        if (placed === null) {
            gap = true;
            reasons.push('unreadable_record');
            continue;
        }
        if (placed < state.edits_this_turn) continue; // an edit followed this run
        const verdict = classifyRun(raw);
        if (verdict.kind === 'PASS_EVIDENCE_OK') {
            passed = true;
            continue;
        }
        if (verdict.kind === 'FAIL_EVIDENCE') {
            failed = true;
            continue;
        }
        reasons.push(verdict.reason);
        if (isInstrumentGap(verdict)) gap = true;
    }

    // A pass or a failure is a reading of the RUN, and either one settles the
    // question; the gap only matters when nothing judgeable was found at all.
    return { passed, failed, instrumentGap: gap && !passed && !failed, reasons };
}

/**
 * The test files a command names, or the empty string when it names none.
 *
 * The key groups records so that a red and a green about the SAME target can be
 * paired. A command with no explicit target — `npx vitest run`, `task test` —
 * gets the empty key, which is its own group: a whole-suite red followed by a
 * whole-suite green is a legitimate red-then-green, and pairing it with a
 * single-file run would claim a sequence nobody observed.
 *
 * Sorted and joined so argument ORDER cannot split one target set into two
 * groups.
 */
export function testTargetKey(command: string): string {
    const targets = new Set<string>();
    for (const token of command.split(/\s+/)) {
        const bare = token.replace(/^['"]|['"]$/g, '');
        if (/[./]\w*(?:test|spec)\w*\.[a-z]+$/i.test(bare) || /(?:Test|Spec)\.php$/.test(bare)) {
            targets.add(bare);
        }
    }
    return [...targets].sort().join('|');
}

/**
 * Whether the turn's records show a red run turning green over the same target.
 *
 * WHY THIS IS EVIDENCE AND A NEW TEST FILE ALONE IS NOT. Detector F's escape
 * hatch is "a test file was touched somewhere in the turn", which a file
 * containing `it('works', () => expect(true).toBe(true))` satisfies. A test
 * never seen red has unknown sensitivity: it may assert nothing the change
 * could break. A red-then-green pair over one target is the cheapest observable
 * proof that the assertion discriminates — it failed, the code changed, it
 * passed.
 *
 * ORDER COMES FROM THE ARRAY, not from a timestamp. The recorder appends, so
 * index order IS run order, and it survives a host whose clock is coarse or
 * whose records share a second. Only records at or after the turn's edit total
 * count for the GREEN half, for the same freshness reason `readRunEvidence`
 * applies; the RED half is deliberately unbounded, because a red necessarily
 * predates the edit that fixed it.
 */
export function hasRedThenGreen(state: TurnRunState): boolean {
    let reddenedAnywhere = false;
    const reddened = new Set<string>();
    for (let i = 0; i < state.runs.length; i += 1) {
        const raw = state.runs[i];
        const verdict = classifyRun(raw);
        const key = testTargetKey(
            typeof raw === 'object' && raw !== null && !Array.isArray(raw)
                ? String((raw as Record<string, unknown>)['command'] ?? '')
                : '',
        );
        if (RED_VERDICTS(verdict)) {
            reddened.add(key);
            reddenedAnywhere = true;
            continue;
        }
        if (verdict.kind !== 'PASS_EVIDENCE_OK') continue;
        const placed = placeRecord(raw);
        if (placed === null || placed < state.edits_this_turn) continue;
        // A WHOLE-SUITE green (the empty key) settles any reddened target: it is
        // strictly stronger evidence than a single-file green, and "red on the
        // file, then the whole suite" is the common honest sequence. A targeted
        // green still only settles its own target.
        if (key === '' ? reddenedAnywhere : reddened.has(key)) return true;
    }
    return false;
}

/**
 * Which verdicts count as the RED half of a red-then-green pair.
 *
 * Deliberately wider than `FAIL_EVIDENCE`, and the canonical TDD first red is
 * why: a new test importing a module that does not exist yet prints `Cannot
 * find module`, which classifies `fixture_or_load_failure`. Requiring a parsed
 * failure COUNT for the red half would refuse exactly the discipline this
 * detector exists to encourage — including the shape of work that introduced
 * this module.
 *
 * The red half needs to show the target NOT PASSING, which is a weaker bar than
 * showing how many assertions failed. The green half carries the placement and
 * freshness checks, so the pair is still anchored to the turn's last edit.
 * `exit_code_unavailable` and `unreadable_record` are excluded: those say the
 * instrument failed, not that the target did.
 */
function RED_VERDICTS(verdict: VerificationVerdict): boolean {
    if (verdict.kind === 'FAIL_EVIDENCE') return true;
    if (verdict.kind !== 'INVALID_RUN') return false;
    return (
        verdict.reason === 'fixture_or_load_failure'
        || verdict.reason === 'nonzero_exit_without_test_failure'
        || verdict.reason === 'zero_tests_discovered'
    );
}
