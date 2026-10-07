/**
 * touched_file_quality — run the project's OWN quality commands, in shadow,
 * over the files a turn actually edited.
 *
 * loss_class: ephemeral-lossy
 *
 * The one place this module shortens content is `advisoryLine`, whose 200-byte
 * cap (roadmap 2.2) trims a summary it synthesised itself from `QualityRun[]`.
 * The trimmed tail is not stored anywhere and is not meant to be: the runs are
 * in-memory for one invocation, the line goes to stderr, and the verdict it
 * summarises is reproduced by re-running the same resolver command. A recovery
 * locator would promise a retrieval nothing performs.
 *
 * `road-to-touched-files-that-pass-their-own-tools` Phase 1. The project already
 * computes a per-stack quality list — `resolve_toolchain().quality` in
 * `src/agent-src/templates/scripts/work_engine/stack/runner.ts` — and nothing at
 * stop calls it. This module is the caller. It owns no list of its own: D2 of the
 * roadmap pins the resolver as the single authority, because a second list is a
 * second authority that drifts from the first in silence.
 *
 * WHAT THIS IS NOT. It is not verification. A command recorded here never reaches
 * `_lib/verification_command.ts`, never raises `verifications_this_turn`, and
 * never sets `verified_this_turn` — `eslint` exits 0 over a clean file set, and a
 * zero exit that reached the completion gate would mean a turn could claim "I
 * verified" by having edited nothing interesting. The producer writes
 * `quality_runs[]`; the classifier reads `verification_runs[]`. Two arrays, two
 * readers, no overlap — pinned by a negative fixture rather than by this comment.
 *
 * FOUR RULES, AND EACH ONE EXISTS BECAUSE THE NAIVE VERSION IS HARMFUL.
 *
 * 1. A command runs only if the resolver listed it. Nothing is synthesised.
 * 2. A command that WRITES runs only in its check form, or not at all. The
 *    resolver emits `vendor/bin/pint`, which rewrites the consumer's source; a
 *    shadow pass that reformats the tree it is observing is not a shadow pass.
 *    Where a check flag is known (`--test`) it is used; where it is not, the row
 *    is `skipped: mutating` and the command is never spawned.
 * 3. A command with no file-scoped form is `skipped: unscoped`. `tsc --noEmit`
 *    cannot take a file list without discarding `tsconfig.json`, and running it
 *    project-wide at every stop makes stop the slowest hook in the chain. The
 *    resolver carries no cost field, so nothing here guesses that an unknown
 *    command is cheap: an unrecognised command is `unscoped` and is not run.
 * 4. ENOENT or exit 127 is `skipped: absent`, counted apart from verdicts.
 *    Detection upstream is by manifest (`typescript` in `devDependencies`), not
 *    by presence on PATH, so "the tool is not installed" must never read as a red.
 *
 * Output per command: the command, its exit code, and the first 20 lines of its
 * combined output. Bounded on purpose — this lands in a per-session state file
 * that another hook reads on every turn.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Lines of combined output retained per command. */
export const OUTPUT_HEAD_LINES = 20;

/** Default per-command wall-clock bound, milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Why a command was not executed.
 *
 * `no_files` is the fourth reason and is not in the roadmap's prose list, which
 * named three. It is needed and it is honest: running `eslint` over a turn that
 * touched only `.php` files produces a verdict about nothing. 2.1 counts
 * `skipped:*` separately from verdicts, and the glob is what makes a fourth
 * reason additive rather than a contract change.
 */
export type SkipReason = 'mutating' | 'unscoped' | 'absent' | 'no_files';

/** One resolver command, classified into a runnable form or a skip reason. */
export interface QualityPlan {
    /** The resolver's command string, verbatim — the provenance of this row. */
    readonly source_command: string;
    /** argv actually spawned, or `null` when the row is skipped. */
    readonly argv: readonly string[] | null;
    /** The touched files passed to it. */
    readonly files: readonly string[];
    readonly skipped: SkipReason | null;
}

/** One executed (or deliberately skipped) quality command. */
export interface QualityRun {
    /** The command as run, or the resolver's command when skipped. */
    readonly command: string;
    readonly source_command: string;
    /** `null` when the row was skipped — never `0`, which is a real verdict. */
    readonly exit_code: number | null;
    readonly output_head: readonly string[];
    readonly skipped: SkipReason | null;
    readonly files: readonly string[];
    /**
     * Matched files the tool reported it declined to look at. A run where EVERY
     * matched file is listed here and the tool exited 0 is a verdict about
     * nothing, so `exit_code` is `null` for it — the readings page § 5(a) found
     * that row recorded `0, skipped: null`, the exact shape of a pass. A field
     * rather than a fifth `SkipReason` (D2): a partly-ignored run keeps its real
     * exit code, and a skip reason cannot sit beside a verdict.
     */
    readonly ignored_files: readonly string[];
    /**
     * Type-check commands the resolver emitted that produced no verdict on this
     * turn — unscoped, absent or mutating. Identical on every record of the turn,
     * so ANY single row says that a `0` beside it was a lint verdict and not a
     * type verdict (§ 5(b): `tsc --noEmit` is unscoped on every stop).
     */
    readonly typecheck_not_run: readonly string[];
    readonly at: string;
}

/**
 * How one resolver command is turned into a file-scoped, non-writing form.
 *
 * Keyed on the exact string the resolver emits. Keying on the whole command
 * rather than on a parsed head is deliberate: the key IS the resolver's output,
 * so a resolver change that this table has not seen falls through to `unscoped`
 * and is not run, instead of being half-recognised and run in a form nobody
 * chose.
 */
interface ToolSpec {
    /** argv prefix; the touched files are appended. */
    readonly argv: readonly string[];
    /** Extensions this tool reads. Empty means "any file". */
    readonly extensions: readonly string[];
    /**
     * The resolver's own command writes files, and `argv` above is its check
     * form. Recorded so a reader can see that the executed command differs from
     * the resolver's by exactly the flag that makes it read-only.
     */
    readonly check_form: boolean;
    /**
     * A line the tool prints, exit 0, for an input its own config ignores. Per
     * row because the wording is the tool's (D1); a row without one reads no
     * output as an ignore, which keeps the pre-existing behaviour rather than
     * guessing at a message the tool might print.
     */
    readonly ignored_signal?: RegExp;
}

/**
 * ESLint 9's stylish report for an ignored input: the absolute path on its own
 * line, then this indented warning. Pinned verbatim by the ignored-file fixture.
 */
const ESLINT_IGNORED = /^\s+\d+:\d+\s+warning\s+File ignored because of a matching ignore pattern\b/;

const JS_EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'] as const;

/**
 * The scoped forms, one row per resolver command that HAS one.
 *
 * Everything the resolver can emit that is absent here — `npx tsc --noEmit`,
 * `go vet ./...`, `cargo clippy` — is absent because it has no per-file form,
 * and absence is what produces `skipped: unscoped`.
 */
const SCOPED_FORMS: ReadonlyMap<string, ToolSpec> = new Map<string, ToolSpec>([
    [
        'npx eslint .',
        {
            argv: ['npx', 'eslint'],
            extensions: JS_EXTENSIONS,
            check_form: false,
            ignored_signal: ESLINT_IGNORED,
        },
    ],
    [
        'vendor/bin/phpstan analyse',
        { argv: ['vendor/bin/phpstan', 'analyse'], extensions: ['.php'], check_form: false },
    ],
    // `vendor/bin/pint` REWRITES source. `--test` is its check form: same tool,
    // same rules, reports instead of writing. Risk 3 of the roadmap is that this
    // module reformats the consumer's tree; this row plus the fixture that proves
    // no file changed is the mitigation.
    [
        'vendor/bin/pint',
        { argv: ['vendor/bin/pint', '--test'], extensions: ['.php'], check_form: true },
    ],
    ['ruff check', { argv: ['ruff', 'check'], extensions: ['.py'], check_form: false }],
    ['mypy .', { argv: ['mypy'], extensions: ['.py'], check_form: false }],
]);

/**
 * Resolver commands known to write files for which NO check form is known.
 *
 * Empty today — every mutating command the resolver emits (`vendor/bin/pint`)
 * has one, and it is in `SCOPED_FORMS` above. The map exists so that the day a
 * writing command without a `--check` lands, the answer is a row here
 * (`skipped: mutating`, never spawned) rather than a judgement call at the call
 * site. A mutating command that fell through to `unscoped` would be recorded
 * under the wrong reason and counted in the wrong bucket by 2.1.
 */
const MUTATING_WITHOUT_CHECK_FORM: ReadonlySet<string> = new Set<string>([]);

/**
 * Resolver commands with no file-scoped form, unscoped ON PURPOSE (rule 3).
 *
 * Named so the parity test can tell a deliberate absence from `SCOPED_FORMS`
 * apart from a resolver command nobody classified: every command the resolver
 * emits is a scoped key, a mutating key, or on this list — or a test is red.
 */
export const UNSCOPED_ON_PURPOSE: readonly string[] = [
    'npx tsc --noEmit',
    'go vet ./...',
    'cargo clippy',
];

/** The keys of `SCOPED_FORMS`, for the parity test. */
export const SCOPED_FORM_COMMANDS: readonly string[] = [...SCOPED_FORMS.keys()];

/** The keys of `MUTATING_WITHOUT_CHECK_FORM`, for the parity test. */
export const MUTATING_COMMANDS: readonly string[] = [...MUTATING_WITHOUT_CHECK_FORM];

/**
 * Resolver commands whose verdict is a type verdict. `go vet` and `cargo clippy`
 * both compile the package, so a type error stops them; ESLint, ruff and pint do
 * not type-check, which is the whole of § 5(b).
 */
export const TYPE_CHECK_COMMANDS: ReadonlySet<string> = new Set<string>([
    'npx tsc --noEmit',
    'vendor/bin/phpstan analyse',
    'mypy .',
    'go vet ./...',
    'cargo clippy',
]);

function extensionOf(file: string): string {
    const base = path.basename(file);
    const dot = base.lastIndexOf('.');
    return dot <= 0 ? '' : base.slice(dot).toLowerCase();
}

/**
 * Classify the resolver's list against the turn's touched files. PURE.
 *
 * Separated from execution so the four rules above are testable without
 * spawning anything, and so a reader can see the whole policy in one return
 * value before any process starts.
 */
export function planQualityRuns(
    commands: readonly string[],
    files: readonly string[],
): QualityPlan[] {
    return commands.map((source_command): QualityPlan => {
        if (MUTATING_WITHOUT_CHECK_FORM.has(source_command)) {
            return { source_command, argv: null, files: [], skipped: 'mutating' };
        }
        const spec = SCOPED_FORMS.get(source_command);
        if (spec === undefined) {
            return { source_command, argv: null, files: [], skipped: 'unscoped' };
        }
        const matched =
            spec.extensions.length === 0
                ? [...files]
                : files.filter((f) => spec.extensions.includes(extensionOf(f)));
        if (matched.length === 0) {
            return { source_command, argv: null, files: [], skipped: 'no_files' };
        }
        return { source_command, argv: [...spec.argv, ...matched], files: matched, skipped: null };
    });
}

/** `argv` rendered for the record. Not re-parsed — display and audit only. */
export function renderCommand(argv: readonly string[]): string {
    return argv.join(' ');
}

function headLines(text: string, limit: number): string[] {
    if (text === '') return [];
    return text
        .split(/\r\n|\r|\n/)
        .filter((line, i, all) => !(line === '' && i === all.length - 1))
        .slice(0, limit);
}

/** ISO-8601 to seconds, matching the record's other timestamps. */
function now(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

export interface RunOptions {
    readonly root: string;
    readonly commands: readonly string[];
    readonly files: readonly string[];
    readonly timeout_ms?: number;
    /** Injected in tests so the table's behaviour is observable without a toolchain. */
    readonly spawn?: (
        argv: readonly string[],
        cwd: string,
        timeout_ms: number,
    ) => { status: number | null; output: string; enoent: boolean };
}

function defaultSpawn(
    argv: readonly string[],
    cwd: string,
    timeout_ms: number,
): { status: number | null; output: string; enoent: boolean } {
    const [head, ...rest] = argv;
    if (head === undefined) return { status: null, output: '', enoent: true };
    const res = spawnSync(head, rest, {
        cwd,
        timeout: timeout_ms,
        encoding: 'utf-8',
        // No shell. The argv comes from a committed table, and a shell would
        // make a file path with a space into an injection surface.
        shell: false,
        maxBuffer: 4 * 1024 * 1024,
    });
    const enoent =
        res.error !== undefined &&
        (res.error as NodeJS.ErrnoException).code === 'ENOENT';
    const output = `${res.stdout ?? ''}${res.stderr ?? ''}`;
    return { status: res.status, output, enoent };
}

/**
 * Execute the plan and return one record per resolver command.
 *
 * Never throws. A spawn that fails for any reason becomes a row, because a
 * shadow pass that can take the stop hook down with it is worse than no shadow
 * pass at all.
 */
export function runTouchedFileQuality(opts: RunOptions): QualityRun[] {
    const timeout_ms = opts.timeout_ms ?? DEFAULT_TIMEOUT_MS;
    const spawn = opts.spawn ?? defaultSpawn;
    const out: Omit<QualityRun, 'typecheck_not_run'>[] = [];
    for (const plan of planQualityRuns(opts.commands, opts.files)) {
        if (plan.argv === null) {
            out.push({
                command: plan.source_command,
                source_command: plan.source_command,
                exit_code: null,
                output_head: [],
                skipped: plan.skipped,
                files: [],
                ignored_files: [],
                at: now(),
            });
            continue;
        }
        let status: number | null = null;
        let output = '';
        let enoent = false;
        try {
            const res = spawn(plan.argv, opts.root, timeout_ms);
            status = res.status;
            output = res.output;
            enoent = res.enoent;
        } catch {
            enoent = true;
        }
        // Exit 127 is the shell's "command not found" and reaches us when the
        // tool is a wrapper script whose own dependency is missing. Same meaning
        // as ENOENT for this module's purposes, and the same bucket in 2.1.
        const absent = enoent || status === 127;
        const signal = SCOPED_FORMS.get(plan.source_command)?.ignored_signal;
        const ignored =
            absent || signal === undefined ? [] : ignoredFiles(output, signal, plan.files);
        // Every matched file ignored AND exit 0: the tool looked at nothing, so
        // there is no verdict to record. A non-zero exit over the same set stays,
        // because a red the tool raised (a config crash, say) is real.
        const nothingLooked = ignored.length === plan.files.length && status === 0;
        out.push({
            command: renderCommand(plan.argv),
            source_command: plan.source_command,
            exit_code: absent || nothingLooked ? null : status,
            output_head: absent ? [] : headLines(output, OUTPUT_HEAD_LINES),
            skipped: absent ? 'absent' : null,
            files: plan.files,
            ignored_files: ignored,
            at: now(),
        });
    }
    // `no_files` is excluded: no file the type checker reads was touched, so
    // there was nothing on this turn for it to have caught.
    const typecheck_not_run = out
        .filter(
            (r) =>
                TYPE_CHECK_COMMANDS.has(r.source_command) &&
                r.exit_code === null &&
                r.skipped !== 'no_files' &&
                r.skipped !== null,
        )
        .map((r) => r.source_command);
    return out.map((r) => ({ ...r, typecheck_not_run: [...typecheck_not_run] }));
}

/**
 * The matched files the tool's output reports as ignored.
 *
 * The stylish report names the file on an unindented line and the warning on
 * the indented lines under it, so a signal line is attributed to the last path
 * line above it. A signal that cannot be attributed is attributed to the one
 * matched file only when there is exactly one; otherwise it is dropped, so an
 * unreadable report keeps today's behaviour instead of inventing an ignore.
 */
export function ignoredFiles(
    output: string,
    signal: RegExp,
    files: readonly string[],
): string[] {
    const reported: string[] = [];
    let unattributed = false;
    let current: string | null = null;
    for (const line of output.split(/\r\n|\r|\n/)) {
        if (signal.test(line)) {
            if (current === null) unattributed = true;
            else reported.push(normalizePath(current));
            continue;
        }
        if (line !== '' && !/^\s/.test(line)) current = line.trim();
    }
    const hit = files.filter((f) => {
        const want = normalizePath(f);
        return reported.some((r) => r === want || r.endsWith(`/${want}`));
    });
    if (hit.length === 0 && unattributed && files.length === 1) return [...files];
    return hit;
}

/**
 * The single advisory line `warn` mode emits — command, first file, verdict.
 *
 * `null` when nothing failed. Capped at 200 bytes by the roadmap's 2.2, and the
 * cap is enforced on the UTF-8 byte length rather than on `String.length`, which
 * counts code units and would let a path with non-ASCII characters through at
 * nearly twice the budget.
 */
export const WARN_LINE_MAX_BYTES = 200;

export function advisoryLine(runs: readonly QualityRun[]): string | null {
    const ignored = [...new Set(runs.flatMap((r) => r.ignored_files))];
    const ignoredPart =
        ignored.length === 0
            ? ''
            : `ignored ${ignored[0] ?? ''}${ignored.length > 1 ? ` (+${String(ignored.length - 1)} more)` : ''}`;
    const failed = runs.find((r) => r.skipped === null && r.exit_code !== null && r.exit_code !== 0);
    if (failed === undefined) {
        // Nothing failed. Silence is right when every file was looked at; when a
        // file was ignored, silence would read as clean, so say what was not seen.
        if (ignored.length === 0) return null;
        return truncateToBytes(
            `touched-file quality: no verdict, ${ignoredPart}`,
            WARN_LINE_MAX_BYTES,
        );
    }
    const file = failed.files[0] ?? '(no file)';
    const more = failed.files.length > 1 ? ` (+${String(failed.files.length - 1)} more)` : '';
    const tail = ignoredPart === '' ? '' : `; ${ignoredPart}`;
    const line = `touched-file quality: ${failed.source_command} exited ${String(failed.exit_code)} on ${file}${more}${tail}`;
    return truncateToBytes(line, WARN_LINE_MAX_BYTES);
}

/** Cut `text` so its UTF-8 encoding is at most `max` bytes, never mid-character. */
export function truncateToBytes(text: string, max: number): string {
    const buf = Buffer.from(text, 'utf-8');
    if (buf.length <= max) return text;
    let end = max;
    // Back off into the start of a character: continuation bytes are 10xxxxxx.
    while (end > 0 && (buf[end] ?? 0) >= 0x80 && (buf[end] ?? 0) < 0xc0) end -= 1;
    return buf.subarray(0, end).toString('utf-8');
}

// ---------------------------------------------------------------------------
// Which files the turn touched
// ---------------------------------------------------------------------------

/** Where the touched-path set came from, recorded beside the runs. */
export type FileSource = 'minimal-safe-diff∩worktree' | 'none';

export interface TouchedFiles {
    readonly files: readonly string[];
    readonly source: FileSource;
}

/**
 * The turn's touched files, intersected with what the working tree says changed.
 *
 * RISK 4 OF THE ROADMAP, AND THE REASON THIS IS NOT JUST A READ.
 * `agents/state/minimal-safe-diff.json` is ONE FILE PER PROJECT ROOT, not per
 * session — and under this repository's worktree workflow `CLAUDE_PROJECT_DIR`
 * resolves to the parent checkout, so concurrent runs share it. Reading it
 * straight would let a neighbouring session's edits become this session's
 * quality target.
 *
 * Two independent narrowings, and both are needed:
 *
 *  - OWNERSHIP. A state file whose `session_id` is not this session's is
 *    refused outright, which is the same stance `owns_session_state` takes on
 *    the verification record.
 *  - THE WORKING TREE. A path is kept only if git still reports it as changed.
 *    A path the recorder saw but the tree has since reverted is not a quality
 *    target, and an edit from a different checkout is not in THIS tree's status.
 *
 * An absent, foreign or unreadable recorder state yields `none` and NO files,
 * which makes the shadow pass a no-op. The alternative — falling back to the
 * whole working tree — is exactly the cross-session leak this is guarding, so
 * the degradation is toward measuring nothing rather than toward measuring
 * somebody else's work.
 */
export function touchedFilesAtStop(
    root: string,
    session_id: string,
    gitStatus: (root: string) => readonly string[] = defaultGitStatus,
): TouchedFiles {
    let recorded: string[];
    try {
        const raw = fs.readFileSync(
            path.join(root, 'agents', 'state', 'minimal-safe-diff.json'),
            'utf-8',
        );
        const decoded: unknown = JSON.parse(raw);
        if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) {
            return { files: [], source: 'none' };
        }
        const state = decoded as Record<string, unknown>;
        if (state['session_id'] !== session_id || session_id === '') {
            return { files: [], source: 'none' };
        }
        const touched = state['files_touched_this_turn'];
        if (!Array.isArray(touched)) return { files: [], source: 'none' };
        recorded = touched.filter((x): x is string => typeof x === 'string');
    } catch {
        return { files: [], source: 'none' };
    }

    const changed = new Set(gitStatus(root));
    const files = recorded.filter((f) => changed.has(normalizePath(f)));
    return { files, source: 'minimal-safe-diff∩worktree' };
}

/** Repo-relative, forward slashes, no leading `./` — the shape git prints. */
export function normalizePath(p: string): string {
    return p.replace(/\\/g, '/').replace(/^\.\//, '');
}

function defaultGitStatus(root: string): string[] {
    const res = spawnSync('git', ['status', '--porcelain', '-z'], {
        cwd: root,
        encoding: 'utf-8',
        timeout: 10_000,
        shell: false,
        maxBuffer: 4 * 1024 * 1024,
    });
    if (res.status !== 0 || typeof res.stdout !== 'string') return [];
    return parsePorcelainZ(res.stdout);
}

/**
 * Paths out of `git status --porcelain -z`.
 *
 * `-z` rather than the line-oriented form: without it git QUOTES a path holding
 * a space or a non-ASCII byte, and the quoted form never matches a recorded
 * path, so the intersection would silently drop exactly the files most likely
 * to be mis-handled downstream. A rename entry carries two NUL-separated paths
 * (`R  <new>\0<old>`); the new path is the one that exists to be checked.
 */
export function parsePorcelainZ(stdout: string): string[] {
    const out: string[] = [];
    const parts = stdout.split('\0');
    for (let i = 0; i < parts.length; i += 1) {
        const entry = parts[i];
        if (entry === undefined || entry.length < 4) continue;
        const status = entry.slice(0, 2);
        out.push(normalizePath(entry.slice(3)));
        // Rename / copy: the NEXT NUL-separated field is the ORIGIN path, which
        // is consumed here so it is not read as a status entry of its own.
        if (status.startsWith('R') || status.startsWith('C')) i += 1;
    }
    return out;
}
