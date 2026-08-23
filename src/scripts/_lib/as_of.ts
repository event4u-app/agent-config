/**
 * `asOf()` — the one place a gate is allowed to ask what time it is.
 *
 * WHY THIS EXISTS
 * ---------------
 * A gate's verdict should be a function of the tree, not of the hour it ran.
 * Measured on 2026-08-23 (`grep -lE 'Date\.now\(\)|new Date\(\)'
 * src/scripts/check_*.ts src/scripts/lint_*.ts`): **17** gate scripts read the
 * wall clock directly, and no `--as-of` / `AC_AS_OF` surface existed anywhere in
 * `src/scripts/`. The consequence is not theoretical — every one of those
 * verdicts is a staleness or age judgement, so a green on a reviewer's machine
 * on Monday is a different verdict from the same tree on Friday, and neither is
 * reproducible from the commit alone.
 *
 * THE RESOLUTION ORDER
 * --------------------
 * First rung that answers wins:
 *
 * 1. `--as-of <iso>` on argv (also `--as-of=<iso>`) — an explicit pin. This is
 *    what CI passes, and what a reviewer passes to reproduce a CI verdict.
 * 2. `AC_AS_OF` in the environment — the same pin where argv is not reachable
 *    (a gate invoked through a wrapper, a hook, or a task runner).
 * 3. The commit date of the tree under test, when `CI` is set. Committed,
 *    therefore reproducible; and the change under review cannot rewrite it
 *    without changing the commit.
 * 4. The wall clock, with a one-line WARN on stderr naming the run as
 *    non-reproducible. The fallback STAYS so no gate loses its ability to run
 *    outside CI; it just stops being silent about what it did.
 *
 * WHY RUNG 3 IS THE **COMMIT** DATE AND NOT THE MERGE-BASE DATE
 * ------------------------------------------------------------
 * The roadmap that commissioned this seam
 * (`agents/roadmaps/road-to-deterministic-time-in-gates.md`, step 1.1) specifies
 * "the merge-base commit date when running in CI". Implementing that literally
 * would **weaken every gate it touches**, which is why it is not implemented
 * literally and the deviation is recorded here rather than in a commit message
 * nobody reads.
 *
 * The merge-base date is, by construction, `<=` the HEAD commit date: it is
 * where the branch forked from its base. All 17 callers are *age* gates — "this
 * pin is stale", "this one-off has expired", "this review marker is overdue" —
 * so an EARLIER "now" makes every one of them strictly more permissive. Pinning
 * to the merge-base therefore hands a long-lived branch a free extension on
 * every staleness budget in the tree, silently, proportional to the branch's
 * age. That is a gate weakening bought with a determinism improvement, and the
 * determinism improvement does not require it.
 *
 * The HEAD commit date has the same reproducibility property — it is committed,
 * a reviewer can recover it from the commit, and two runs of the same commit
 * agree — while being the *tightest* committed clock available. It is never
 * later than real time and never earlier than the merge-base. So it is what
 * rung 3 reads.
 *
 * WHAT THIS MODULE DELIBERATELY DOES NOT DO
 * -----------------------------------------
 * It does not change a single threshold, message, or exit code. Substituting
 * `asOf()` for `new Date()` is mechanical by design (roadmap step 1.2): a gate
 * that flips its verdict on the substitution has found a real dependency on the
 * hour, which is the defect being fixed, not a regression introduced by it.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/** Which rung of the resolution order answered. */
export type AsOfRung = 'argv' | 'env' | 'commit' | 'wall-clock';

export interface AsOfResolution {
    /** The resolved "now". */
    at: Date;
    /** Which rung produced it. */
    rung: AsOfRung;
    /**
     * `true` when the same tree would resolve the same instant again. Only the
     * wall-clock rung is `false`.
     */
    reproducible: boolean;
}

/** Injection seam — every source the resolver reads, so the self-test can drive it. */
export interface AsOfSources {
    argv?: readonly string[];
    env?: Record<string, string | undefined>;
    /** Committed clock for rung 3. `null` when it cannot be established. */
    commitDate?: () => Date | null;
    /** Rung 4. */
    wallClock?: () => Date;
    /** Where the non-reproducibility WARN goes. */
    warn?: (line: string) => void;
}

/**
 * Thrown when an explicit pin is present but unparseable.
 *
 * A malformed pin is never silently downgraded to the next rung: the caller
 * asked for a specific instant, and quietly substituting a different one is the
 * failure mode this whole module exists to remove.
 */
export class AsOfPinError extends Error {}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** `--as-of <iso>` / `--as-of=<iso>`; `undefined` when the flag is absent. */
function readArgvPin(argv: readonly string[]): string | undefined {
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--as-of') return argv[i + 1] ?? '';
        if (arg.startsWith('--as-of=')) return arg.slice('--as-of='.length);
    }
    return undefined;
}

function parsePin(raw: string, source: string): Date {
    const trimmed = raw.trim();
    const ms = Date.parse(trimmed);
    if (trimmed === '' || Number.isNaN(ms)) {
        throw new AsOfPinError(
            `${source} is not a parseable date: ${JSON.stringify(raw)}. ` +
                'Pass an ISO-8601 instant, e.g. 2026-08-23T00:00:00Z.',
        );
    }
    return new Date(ms);
}

/** `true` for a set, non-falsey `CI` value. GitHub Actions sets `CI=true`. */
function inCi(env: Record<string, string | undefined>): boolean {
    const raw = (env.CI ?? '').trim().toLowerCase();
    return raw !== '' && raw !== '0' && raw !== 'false';
}

/** Commit date of `HEAD` as an ISO instant, or `null` when git cannot answer. */
export function headCommitDate(cwd: string = REPO_ROOT): Date | null {
    const res = spawnSync('git', ['log', '-1', '--format=%cI', 'HEAD'], {
        cwd,
        encoding: 'utf-8',
    });
    if (res.status !== 0) return null;
    const iso = (res.stdout ?? '').trim();
    if (iso === '') return null;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? null : new Date(ms);
}

/**
 * Resolve "now" from the four rungs. Pure with respect to {@link AsOfSources},
 * so the self-test drives every rung without touching the real environment.
 *
 * @throws {AsOfPinError} when an explicit pin is present but unparseable.
 */
export function resolveAsOf(sources: AsOfSources = {}): AsOfResolution {
    const argv = sources.argv ?? process.argv.slice(2);
    const env = sources.env ?? process.env;

    const argvPin = readArgvPin(argv);
    if (argvPin !== undefined) {
        return { at: parsePin(argvPin, '--as-of'), rung: 'argv', reproducible: true };
    }

    const envPin = env.AC_AS_OF;
    if (envPin !== undefined && envPin.trim() !== '') {
        return { at: parsePin(envPin, 'AC_AS_OF'), rung: 'env', reproducible: true };
    }

    if (inCi(env)) {
        const commit = (sources.commitDate ?? headCommitDate)();
        if (commit !== null) {
            return { at: commit, rung: 'commit', reproducible: true };
        }
    }

    const warn = sources.warn ?? ((line: string) => process.stderr.write(line));
    const at = (sources.wallClock ?? (() => new Date()))();
    warn(
        `⚠️  as-of: unpinned run — using the wall clock (${at.toISOString()}); ` +
            'this verdict is not reproducible. Pass --as-of <iso> or set AC_AS_OF to pin it.\n',
    );
    return { at, rung: 'wall-clock', reproducible: false };
}

let cached: AsOfResolution | null = null;

/**
 * The resolution for this process, computed once. Memoised so 17 gate scripts
 * sharing one process cannot disagree about "now", and so the wall-clock WARN
 * is emitted at most once per run.
 */
export function asOfResolution(): AsOfResolution {
    cached ??= resolveAsOf();
    return cached;
}

/**
 * "Now", for a gate. The one sanctioned reader of the wall clock in
 * `src/scripts/`.
 *
 * Returns a fresh `Date` each call so a caller mutating it cannot poison the
 * memoised value.
 */
export function asOf(): Date {
    return new Date(asOfResolution().at.getTime());
}

/** `Date.now()` equivalent, for the arithmetic call sites. */
export function asOfMs(): number {
    return asOfResolution().at.getTime();
}

/**
 * One line a gate prints so a reviewer can see WHICH "now" produced the verdict.
 *
 * Without it, pinning is invisible: a reproducible run and a wall-clock run look
 * identical in CI output, and "reproduce it with --as-of" is advice nobody can
 * act on because the value to pass was never published.
 *
 * @param override an explicit date the gate's own flag supplied (e.g. `--today`),
 *                 which outranks the seam and must be reported as such.
 */
export function asOfBanner(override?: string): string {
    if (override !== undefined) return `as-of: ${override} (source=flag)`;
    const r = asOfResolution();
    return `as-of: ${r.at.toISOString()} (rung=${r.rung}, reproducible=${String(r.reproducible)})`;
}

/** Test seam — drops the memo so a self-test can exercise more than one rung. */
export function _resetAsOfCacheForTests(): void {
    cached = null;
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

function tsxBin(): string {
    return path.join(
        REPO_ROOT,
        'node_modules',
        '.bin',
        process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
    );
}

interface ChildRun {
    status: number;
    stdout: string;
    stderr: string;
}

/** Invoke THIS module's own CLI, so the self-test exercises the shipped path. */
function runSelf(args: readonly string[], env: Record<string, string | undefined>): ChildRun {
    const res = spawnSync(tsxBin(), [fileURLToPath(import.meta.url), ...args], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        env: env as NodeJS.ProcessEnv,
    });
    return {
        status: res.status ?? 1,
        stdout: res.stdout ?? '',
        stderr: res.stderr ?? '',
    };
}

/** Environment with every pin and CI marker cleared, so a case sets only its own. */
function bareEnv(): Record<string, string | undefined> {
    const env: Record<string, string | undefined> = { ...process.env };
    delete env.AC_AS_OF;
    delete env.CI;
    delete env.GITHUB_ACTIONS;
    return env;
}

function selfTest(write: (chunk: string) => unknown): number {
    const commit = headCommitDate();
    let failed = 0;
    let checks = 0;

    const expect = (name: string, ok: boolean, detail: string): void => {
        checks += 1;
        if (ok) {
            write(`✅  ${name}\n`);
        } else {
            write(`❌  ${name}: ${detail}\n`);
            failed += 1;
        }
    };

    // Rung 1 — argv.
    const argvRun = runSelf(['--print', '--as-of', '2026-01-02T03:04:05Z'], bareEnv());
    expect(
        'rung 1 (argv) — an explicit --as-of wins',
        argvRun.status === 0 &&
            argvRun.stdout.includes('rung=argv') &&
            argvRun.stdout.includes('at=2026-01-02T03:04:05.000Z'),
        `exit ${String(argvRun.status)}, stdout ${JSON.stringify(argvRun.stdout)}`,
    );

    // Rung 1 — argv beats env, so a pin the caller typed is never shadowed.
    const precedence = runSelf(['--print', '--as-of=2026-01-02T03:04:05Z'], {
        ...bareEnv(),
        AC_AS_OF: '2020-01-01T00:00:00Z',
    });
    expect(
        'rung 1 precedence — --as-of= overrides AC_AS_OF',
        precedence.status === 0 &&
            precedence.stdout.includes('rung=argv') &&
            precedence.stdout.includes('at=2026-01-02T03:04:05.000Z'),
        `exit ${String(precedence.status)}, stdout ${JSON.stringify(precedence.stdout)}`,
    );

    // Rung 2 — env.
    const envRun = runSelf(['--print'], { ...bareEnv(), AC_AS_OF: '2025-06-07T08:09:10Z' });
    expect(
        'rung 2 (env) — AC_AS_OF answers when argv is silent',
        envRun.status === 0 &&
            envRun.stdout.includes('rung=env') &&
            envRun.stdout.includes('at=2025-06-07T08:09:10.000Z'),
        `exit ${String(envRun.status)}, stdout ${JSON.stringify(envRun.stdout)}`,
    );

    // Rung 3 — the committed clock, under CI.
    const ciRun = runSelf(['--print'], { ...bareEnv(), CI: 'true' });
    expect(
        'rung 3 (commit) — CI pins to the tree under test',
        ciRun.status === 0 &&
            ciRun.stdout.includes('rung=commit') &&
            commit !== null &&
            ciRun.stdout.includes(`at=${commit.toISOString()}`),
        `exit ${String(ciRun.status)}, stdout ${JSON.stringify(ciRun.stdout)}, ` +
            `HEAD date ${commit === null ? 'UNAVAILABLE' : commit.toISOString()}`,
    );

    // Rung 4 — the wall clock, and it must say so.
    const wallRun = runSelf(['--print'], bareEnv());
    expect(
        'rung 4 (wall-clock) — unpinned runs resolve and WARN once',
        wallRun.status === 0 &&
            wallRun.stdout.includes('rung=wall-clock') &&
            wallRun.stdout.includes('reproducible=false') &&
            wallRun.stderr.includes('not reproducible'),
        `exit ${String(wallRun.status)}, stdout ${JSON.stringify(wallRun.stdout)}, ` +
            `stderr ${JSON.stringify(wallRun.stderr)}`,
    );

    // A malformed pin is a rejection, never a silent downgrade.
    const badArgv = runSelf(['--print', '--as-of', 'not-a-date'], bareEnv());
    expect(
        'malformed --as-of is rejected, not downgraded',
        badArgv.status !== 0 && badArgv.stderr.includes('not a parseable date'),
        `exit ${String(badArgv.status)}, stderr ${JSON.stringify(badArgv.stderr)}`,
    );

    const badEnv = runSelf(['--print'], { ...bareEnv(), AC_AS_OF: '2026-13-45' });
    expect(
        'malformed AC_AS_OF is rejected, not downgraded',
        badEnv.status !== 0 && badEnv.stderr.includes('not a parseable date'),
        `exit ${String(badEnv.status)}, stderr ${JSON.stringify(badEnv.stderr)}`,
    );

    // A truncated suite must fail rather than print success — deleting cases is
    // otherwise the cheapest route to a green self-test.
    const FLOOR = 7;
    if (checks < FLOOR) {
        write(
            `❌  as_of --self-test: ${String(checks)} case(s) is below the declared ` +
                `floor of ${String(FLOOR)}.\n`,
        );
        return 1;
    }

    write(
        `\nas_of --self-test: ${String(checks - failed)}/${String(checks)} case(s) behaved ` +
            `(floor ${String(FLOOR)})\n`,
    );
    return failed > 0 ? 1 : 0;
}

function main(argv: readonly string[]): number {
    if (argv.includes('--self-test')) {
        return selfTest((chunk) => process.stdout.write(chunk));
    }
    let res: AsOfResolution;
    try {
        res = resolveAsOf({ argv });
    } catch (e) {
        if (e instanceof AsOfPinError) {
            process.stderr.write(`❌  as-of: ${e.message}\n`);
            return 2;
        }
        throw e;
    }
    process.stdout.write(
        `rung=${res.rung} at=${res.at.toISOString()} reproducible=${String(res.reproducible)}\n`,
    );
    return 0;
}

function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}
