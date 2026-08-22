/**
 * run_supervise — the out-of-process watcher for runs whose session died.
 *
 * road-to-long-horizon-execution Phase 3.1 (sequencing UOTL Phase 6.2).
 *
 * ## The defect
 *
 * A session dies with its terminal. Nothing anywhere has the job of noticing
 * that a claimed run stopped moving, so a roadmap 40 % done and a roadmap
 * finished look identical from outside the dead session.
 *
 * ## What this is, and what it deliberately is not
 *
 * A FOREGROUND loop, not a daemon. The roadmap says so, and the reason is
 * falsifiability: a design that has never been watched running is not a
 * design that has been tested, and a v1 daemon hides its own behaviour behind
 * a log file. A foreground loop can be read while it works.
 *
 * **It never merges.** The reference design this borrows the loop shape from
 * also auto-merges ready worktrees; that borrowing is REJECTED, by name, in
 * the roadmap's harvest section. Merge stays human and conversational. This
 * process may report, and — only with `--relaunch` — start a fresh session.
 * It may never merge, push, or close anything.
 *
 * **It reports by default.** Relaunching spawns a coding agent that spends
 * tokens without a human watching, so the acting path is behind an explicit
 * flag rather than behind a default that a stray invocation trips.
 *
 * ## Liveness, and an honest departure from the borrowed design
 *
 * The reference resumes crashed sessions by PID liveness. This register has
 * no PID field — liveness here is the heartbeat (`last_seen`) against a
 * per-platform TTL, which is what the register actually maintains. That is a
 * WEAKER signal in one specific way and it is stated rather than papered
 * over: a session killed seconds ago still reads live until its TTL expires,
 * so this watcher is late by up to one TTL rather than immediate. It is also
 * STRONGER in another: a wedged session that still holds its PID reads dead
 * here once it stops beating, and reads alive to a PID check forever.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { is_expired, register_dir, type SessionRecord } from './_lib/session_register.js';
import {
    countRoadmap,
    latestCheckpointFor,
    readCheckpoint,
    readHead,
    roadmapPath,
} from './_lib/run_checkpoint.js';
import { readBudget } from './_lib/unattended_guard.js';
import { findQuotaParked, type QuotaParkedMarker } from './_lib/quota_parked.js';
import {
    LIVE_SPAWN_REFUSAL,
    planResume,
    renderResumePlans,
    type ResumePlan,
} from './_lib/headless_invocation.js';

/**
 * UOTL 6.2 verbatim: at most three relaunches per run — and "run" means the
 * roadmap across every session that worked it, not one session id. See
 * {@link RelaunchLedger}.
 */
export const MAX_RELAUNCHES_PER_RUN = 3;

/** The emergency stop. Same switch the orchestration layer already honours. */
export const HALT_ENV = 'AGENT_CONFIG_ORCHESTRATION_HALT';

export const SUPERVISE_STATE_REL = path.join(
    'agents',
    'runtime',
    'state',
    'supervise-relaunches.json',
);

export type Disposition =
    | 'alive'
    | 'no-roadmap'
    | 'roadmap-unreadable'
    | 'complete'
    | 'quota-parked'
    | 'budget-exhausted'
    | 'relaunchable';

export interface Candidate {
    readonly session_id: string;
    readonly roadmap: string | null;
    readonly worktree: string;
    /**
     * Host platform, carried through from the register record.
     *
     * Needed by `--print-relaunch`: the resume command's shape is a property of
     * the HOST the dead session ran on, and only the record knows which that
     * was. Guessing the current process's host would build a `claude` command
     * for a run that died under `codex`.
     */
    readonly platform: string;
    readonly disposition: Disposition;
    readonly open_steps: number | null;
    readonly relaunches: number;
    /** One sentence a human can act on without opening anything. */
    readonly reason: string;
}

/** Per-run relaunch counts. A plain object so the file stays readable by eye. */
/**
 * Relaunch counts, keyed by ROADMAP SLUG — never by session id.
 *
 * R2 round 2, finding 9. The cap is documented as "at most three relaunches
 * per RUN", and a run spans generations by definition: relaunching produces a
 * NEW session id, so a session-keyed ledger handed every generation a fresh
 * budget of three and the cap could never bind. The roadmap is what identifies
 * a run across its generations — the same key `latestCheckpointFor` uses, and
 * for the same reason.
 *
 * Total over the relaunchable set: a record with no roadmap slug is classified
 * `no-roadmap` before the cap is consulted, so there is no relaunchable run
 * this key cannot name.
 *
 * THE COUNTER IS CLEARED WHEN THE ROADMAP COMPLETES, and that half is what
 * makes the key correct rather than merely different. R2 round 3, finding 6:
 * a roadmap-keyed counter with no reset swaps a cap that never binds for one
 * that never releases — three deaths in March would refuse a relaunch in
 * September for a run that has nothing to do with them. "Per run" needs both
 * a key that spans a run's generations AND a boundary where one run ends, and
 * `disposition: complete` is that boundary: zero open steps means the work the
 * counter was counting attempts at is done.
 *
 * `clearCompleted` is the writer. It is called from `digest`, which is a
 * read-report — so the clear is stated where it happens rather than hidden in
 * a getter, and a caller that only classifies never mutates.
 */
export type RelaunchLedger = Record<string, number>;

/**
 * Drop the counters of every roadmap whose run is complete.
 *
 * Returns a NEW ledger; the caller decides whether to persist it. Separating
 * the decision from the write keeps `classify` pure — it is called from a
 * digest, from tests, and (one day) from the spawn, and only one of those
 * should be writing state.
 */
export function clearCompleted(
    ledger: RelaunchLedger,
    candidates: readonly Candidate[],
): RelaunchLedger {
    const done = new Set(
        candidates.filter((c) => c.disposition === 'complete' && c.roadmap !== null).map((c) => c.roadmap as string),
    );
    const out: RelaunchLedger = {};
    for (const [k, v] of Object.entries(ledger)) {
        if (!done.has(k)) out[k] = v;
    }
    return out;
}

export function readLedger(repoRoot: string): RelaunchLedger {
    try {
        const parsed: unknown = JSON.parse(
            fs.readFileSync(path.join(repoRoot, SUPERVISE_STATE_REL), 'utf-8'),
        );
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        const out: RelaunchLedger = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v;
        }
        return out;
    } catch {
        return {};
    }
}

/**
 * Persist the relaunch ledger. THROWS on a failed write — never swallows.
 *
 * The swallow this replaces carried a comment asserting "there is NO CALLER …
 * `writeLedger` is a writer waiting for one", and that was **false in the same
 * file**: `digest` calls it at the `released > 0` branch below. The comment
 * described the tree as it stood before R2 round 3 added the release, and the
 * two comments then contradicted each other about the same function fourteen
 * lines apart.
 *
 * The consequence was not cosmetic. A silently-failed write leaves the counter
 * high while the digest has already printed `relaunch budget reset`, so the
 * operator reads a release that did not happen — and the counter that "never
 * releases" is precisely the failure R2 round 3 introduced `clearCompleted` to
 * fix. Throwing hands the caller the choice; the caller below reports what
 * actually happened rather than what it intended.
 */
export function writeLedger(repoRoot: string, ledger: RelaunchLedger): void {
    const file = path.join(repoRoot, SUPERVISE_STATE_REL);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(ledger, null, 2)}\n`, 'utf-8');
}

/**
 * Classify one register record.
 *
 * Order matters and is the whole logic: a live session is never a candidate
 * however far behind it is, and a finished roadmap is never a candidate
 * however dead its session is. Only the intersection — dead session, real
 * remaining work, budget left — is relaunchable.
 */
export function classify(
    repoRoot: string,
    rec: SessionRecord,
    ledger: RelaunchLedger,
    now: Date,
): Candidate {
    const base = {
        session_id: rec.session_id,
        roadmap: rec.roadmap_slug,
        worktree: rec.worktree,
        platform: rec.platform,
        relaunches: ledger[rec.roadmap_slug ?? ''] ?? 0,
    };
    if (!is_expired(rec, now)) {
        return { ...base, disposition: 'alive', open_steps: null, reason: 'session is still beating' };
    }
    if (rec.roadmap_slug === null || rec.roadmap_slug === '') {
        return {
            ...base,
            disposition: 'no-roadmap',
            open_steps: null,
            reason: 'session died holding no roadmap claim — nothing to resume',
        };
    }
    let text: string;
    try {
        text = fs.readFileSync(roadmapPath(repoRoot, rec.roadmap_slug), 'utf-8');
    } catch {
        return {
            ...base,
            disposition: 'roadmap-unreadable',
            open_steps: null,
            reason: `claimed roadmap '${rec.roadmap_slug}' no longer reads — likely archived; the claim is stale, not the work`,
        };
    }
    const counts = countRoadmap(text);
    if (counts.open === 0) {
        return {
            ...base,
            disposition: 'complete',
            open_steps: 0,
            reason: 'no open steps remain — the run finished, the session just never said so',
        };
    }
    // Before the relaunch cap, and the order is load-bearing in one direction
    // only: a parked run that has also spent its relaunches should still read
    // as parked, because "waiting for a reset" is the cause and "spent three
    // relaunches" is a consequence of it. Reported the other way round, an
    // operator sees a run that failed repeatedly rather than one that keeps
    // meeting the same wall.
    const parked = findQuotaParked(repoRoot, rec.session_id);
    if (parked !== null) {
        return {
            ...base,
            disposition: 'quota-parked',
            open_steps: counts.open,
            reason: quotaParkedReason(parked, counts.open),
        };
    }
    if (base.relaunches >= MAX_RELAUNCHES_PER_RUN) {
        return {
            ...base,
            disposition: 'budget-exhausted',
            open_steps: counts.open,
            reason:
                `${base.relaunches} relaunches already spent (cap ${MAX_RELAUNCHES_PER_RUN}) — ` +
                `a run that dies this often has a problem a fourth session will not fix`,
        };
    }
    return {
        ...base,
        disposition: 'relaunchable',
        open_steps: counts.open,
        reason: `${counts.open} open step(s) remain and the session is gone`,
    };
}

/**
 * The one sentence a human acts on for a parked run.
 *
 * It states the reset time is unknown rather than omitting it, and rather than
 * guessing an interval. There is no reset-time parser and there will not be one
 * until a verified error string exists to pin a fixture against — see
 * `later/road-to-billing-cliff-detection.md`. An omitted unknown reads as "no
 * wait needed"; a guessed interval reads as a fact.
 */
export function quotaParkedReason(m: QuotaParkedMarker, open: number): string {
    return (
        `plan quota exhausted on ${m.providers.join(', ')} since ${m.parked_at} — ` +
        `${open} open step(s) remain; the run is waiting, not broken. ` +
        `Reset time unknown (no parser: no verified error string yet).`
    );
}

export interface ScanOptions {
    readonly now?: Date;
}

/**
 * Every record in the register, expired ones INCLUDED — and it has to be its
 * own reader rather than `read_live_records`, because that one filters expired
 * records out by design. Reading only live records here would return exactly
 * the sessions that need no supervision and none of the ones that do.
 *
 * It also never prunes, and since R2 round 4 finding 5 it no longer has to
 * hope the other readers do not. `read_live_records({ prune: true })` holds an
 * expired record for `PRUNE_GRACE_MS` (24 h, derived from this digest's daily
 * cadence) before unlinking it, so the two routine read paths that DO prune —
 * `sessions:list` and the session-start hook, which fires on every start —
 * can no longer delete this watcher's entire input between one morning and the
 * next.
 *
 * `read_live_records({ prune: true })` deletes expired
 * records as it walks; deleting the evidence a watcher exists to act on would
 * make the first scan the last one that could see anything.
 */
export function readAllRecords(dir: string): SessionRecord[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.json'));
    } catch {
        return [];
    }
    const out: SessionRecord[] = [];
    for (const name of names) {
        try {
            const parsed: unknown = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8'));
            if (
                parsed !== null &&
                typeof parsed === 'object' &&
                !Array.isArray(parsed) &&
                typeof (parsed as Record<string, unknown>)['session_id'] === 'string' &&
                typeof (parsed as Record<string, unknown>)['last_seen'] === 'string'
            ) {
                out.push(parsed as SessionRecord);
            }
        } catch {
            // An unparseable file carries no evidence of a run; skipping it is
            // the same call `read_live_records` makes, minus the deletion.
        }
    }
    return out.sort((a, b) => a.session_id.localeCompare(b.session_id));
}

export function scan(repoRoot: string, opts: ScanOptions = {}): Candidate[] {
    const dir = register_dir(repoRoot);
    if (dir === null) return [];
    const now = opts.now ?? new Date();
    const ledger = readLedger(repoRoot);
    return readAllRecords(dir).map((rec) => classify(repoRoot, rec, ledger, now));
}

/**
 * Build one resume plan per relaunchable candidate.
 *
 * Only `relaunchable` ones: an alive session needs no resume, a complete
 * roadmap has nothing left, and a cap-exhausted run is refused before a
 * command is worth printing. Printing a command for those would hand the
 * operator a line that undoes the classification the scan just made.
 */
export function resumePlans(
    repoRoot: string,
    candidates: readonly Candidate[],
    now: Date,
): ResumePlan[] {
    const out: ResumePlan[] = [];
    for (const c of candidates) {
        if (c.disposition !== 'relaunchable' || c.roadmap === null) continue;
        out.push(
            planResume(
                repoRoot,
                {
                    roadmapSlug: c.roadmap,
                    worktree: c.worktree,
                    platform: c.platform,
                    // A worktree whose head cannot be read yields the literal
                    // `unknown`, which then rides into the dedup key. That is
                    // deliberate: an unreadable head must not collide with a
                    // real commit's key, and it is visible in the output rather
                    // than silently absent.
                    head: readHead(c.worktree) ?? 'unknown',
                },
                now,
            ),
        );
    }
    return out;
}

export function render(candidates: readonly Candidate[]): string {
    if (candidates.length === 0) {
        return 'run:supervise — no sessions registered for this workspace.\n';
    }
    const lines: string[] = [];
    for (const c of candidates) {
        const tag = c.disposition.toUpperCase().padEnd(18);
        const road = c.roadmap ?? '-';
        lines.push(`  ${tag} ${c.session_id}  roadmap=${road}  ${c.reason}`);
    }
    const n = candidates.filter((c) => c.disposition === 'relaunchable').length;
    lines.push('');
    lines.push(
        n === 0
            ? 'run:supervise — nothing to relaunch.'
            : `run:supervise — ${n} run(s) relaunchable. This process NEVER merges, pushes, or ` +
              `closes anything; --relaunch only starts a fresh session.`,
    );
    return `${lines.join('\n')}\n`;
}

/**
 * The morning digest (UOTL 7.2) — what happened while nobody was watching.
 *
 * The point of the phrasing in UOTL is "instead of permission prompts": an
 * unattended lane that interrupts is not unattended, so the reporting has to
 * be something a human reads once, on their own schedule.
 *
 * It reports only state that ALREADY EXISTS on disk — dead runs, memos
 * written, budget consumed. No scheduling, no cron entry, no spawn. A digest
 * over an empty tree is the honest output of a lane that has not run yet, and
 * is much better than a scheduler that schedules something nothing can
 * execute.
 */
export function digest(repoRoot: string, candidates: readonly Candidate[], now: Date): string {
    const lines = [`run:supervise digest · ${now.toISOString().slice(0, 10)}`, ''];

    // The one write this read-report performs, and it is stated here rather
    // than buried: a completed roadmap's relaunch counter is released, so the
    // "three per run" cap bounds a run instead of a roadmap's lifetime
    // (R2 round 3, finding 6).
    //
    // The report follows the WRITE and the DELTA, not the intent. It used to
    // push "relaunch budget reset" unconditionally after a `writeLedger` that
    // swallowed its own failure, so a digest could tell the operator a
    // release had happened while the counter still stood — the direction that
    // matters, because a stale-high counter refuses the next relaunch and the
    // digest had just said it would not. Round 1 fixed the write half and
    // left the count reading off the candidate set; both halves are needed,
    // and a read-report that writes when nothing changed is the smaller half
    // of the same mistake.
    const before = readLedger(repoRoot);
    const cleared = clearCompleted(before, candidates);
    // The count is the LEDGER DELTA, never the candidate set.
    //
    // R2 round 2, finding 7, and it is the same defect one level up from the
    // one round 1 fixed. Counting completed candidates reports a release for a
    // roadmap that never had a counter — and with no relaunch mechanism
    // shipping, the ledger is always empty, so EVERY such line was false. It
    // also made a read-report write `{}` to disk on its first run.
    const released = Object.keys(before).length - Object.keys(cleared).length;
    if (released > 0) {
        try {
            writeLedger(repoRoot, cleared);
            lines.push(`  released:  ${released} completed roadmap(s) — relaunch budget reset`);
        } catch (err) {
            lines.push(
                `  released:  NOT RESET — ${released} completed roadmap(s) still hold their ` +
                    `counter (ledger write failed: ${err instanceof Error ? err.message : String(err)})`,
            );
        }
    }

    const dead = candidates.filter((c) => c.disposition !== 'alive');
    const relaunchable = candidates.filter((c) => c.disposition === 'relaunchable');
    const quotaParked = candidates.filter((c) => c.disposition === 'quota-parked');
    lines.push(
        `  sessions: ${candidates.length} registered · ${candidates.length - dead.length} alive · ` +
            `${relaunchable.length} relaunchable` +
            (quotaParked.length > 0 ? ` · ${quotaParked.length} quota-parked` : ''),
    );
    // Named on its own line, not folded into the relaunchable count, because
    // the two call for opposite responses: a relaunchable run wants a session,
    // a parked one wants time. Suppressed at zero so the ordinary digest does
    // not carry a line about a state nothing is in.
    for (const c of quotaParked) {
        lines.push(
            `  parked:   ${c.roadmap ?? '-'} — ${c.reason}`,
        );
    }

    const budget = readBudget(repoRoot, now);
    lines.push(
        budget.max_usd <= 0 && budget.max_tokens <= 0
            ? '  budget:   unattended runs DISABLED (no ceiling configured)'
            : `  budget:   $${budget.spent_usd}/${budget.max_usd} · ` +
              `${budget.spent_tokens}/${budget.max_tokens} tokens · window ${budget.window_opened}`,
    );

    const memoRoot = path.join(repoRoot, 'agents', 'runtime', 'state', 'decisions');
    let memoCount = 0;
    let memoRuns = 0;
    let entries: string[] = [];
    try {
        entries = fs.readdirSync(memoRoot);
    } catch {
        // no memos yet — reported as zero below, which is a real answer
    }
    for (const run of entries) {
        // The try is INSIDE the loop. R2 review, finding 6: with it outside,
        // one non-directory entry under decisions/ — a .DS_Store, a stray
        // note — threw ENOTDIR, aborted the whole walk and reported whatever
        // partial count had been reached, which is 0 when the bad entry sorts
        // first. `interruption_report.readMemoCounts` walks the same tree with
        // the try inside, so the two disagreed on identical data.
        try {
            const files = fs
                .readdirSync(path.join(memoRoot, run))
                .filter((n) => /^\d{3}\.md$/.test(n));
            if (files.length > 0) {
                memoRuns += 1;
                memoCount += files.length;
            }
        } catch {
            // a file where a directory was expected — not a run
        }
    }
    lines.push(`  decisions: ${memoCount} memo(s) across ${memoRuns} run(s)`);

    if (relaunchable.length > 0) {
        lines.push('');
        lines.push('  needs attention:');
        for (const c of relaunchable) {
            lines.push(`    ${c.session_id}  roadmap=${c.roadmap ?? '-'}  ${c.reason}`);
        }
    }
    lines.push('');
    lines.push('  This digest reports state; it schedules nothing and starts nothing.');
    return `${lines.join('\n')}\n`;
}

const USAGE = `usage: run_supervise [--root PATH] [--once] [--digest] [--interval SECONDS]
                    [--print-relaunch] [--relaunch]

Watches the session register for runs whose session died with open steps left.

  --root PATH        repository root (default: cwd)
  --once             one scan, then exit. REQUIRED today: looping is not
                     implemented, so omitting this exits 2 with that message.
  --digest           the morning report instead of the per-session list:
                     dead runs, decision memos written, budget consumed.
                     Reports state; schedules nothing, starts nothing.
  --interval SECONDS accepted and IGNORED. It used to say "reserved for the
                     loop driver that lands with the Phase 4.0 primitive";
                     that primitive is a published refusal now, so nothing is
                     scheduled to land and the flag has no future caller.
                     Listed rather than hidden so it is not silently dropped,
                     and marked rather than documented with a default (an
                     earlier round: it advertised "default: 60" and was read
                     by nothing, so an operator following this help got exit 2
                     and no watcher).
  --print-relaunch   PRINT the exact command that resumes each relaunchable
                     run, plus what an unattended lane would decide about the
                     same run. Starts no SESSION and spends nothing; it does
                     run one \`git remote -v\` per plan, which is the guard's
                     production-remote precondition. The command is for a
                     human to paste; the unattended verdict never gates what
                     a human may run.
  --relaunch         REFUSED. Starting a session unattended is a published
                     refusal (road-to-long-horizon-execution 4.0, AI council
                     2026-08-19), not an unbuilt feature — the flag exits 2
                     naming the decision and its reopen condition. The
                     ${MAX_RELAUNCHES_PER_RUN}-per-run cap and its ledger stay
                     in place for the day the refusal is reopened.

Never merges, never pushes, never closes a PR. Set
${HALT_ENV}=1 to stop the watcher.
`;

function argValue(argv: string[], flag: string): string | null {
    const i = argv.indexOf(flag);
    if (i === -1 || i + 1 >= argv.length) return null;
    return argv[i + 1] ?? null;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(USAGE);
        return 0;
    }
    if (String(process.env[HALT_ENV] ?? '').trim() !== '') {
        process.stdout.write(`run:supervise — ${HALT_ENV} is set; watcher does not start.\n`);
        return 0;
    }
    // Report-shape flags are mutually exclusive, and a silent precedence is
    // the wrong way to say so (R2 round 2, finding 10): `--digest
    // --print-relaunch` used to print the digest and drop the plans without a
    // word, and `--print-relaunch --relaunch` returned 0 without ever emitting
    // the refusal — success as the exit code of the one flag whose entire
    // purpose is to refuse.
    const shapes = ['--digest', '--print-relaunch', '--relaunch'].filter((f) => argv.includes(f));
    if (shapes.length > 1) {
        process.stderr.write(
            `run:supervise: ${shapes.join(' and ')} are mutually exclusive — each is a ` +
                `different report, and one silently winning would hide the other. Pick one.\n`,
        );
        return 2;
    }

    const repoRoot = argValue(argv, '--root') ?? process.cwd();
    const now = new Date();
    const candidates = scan(repoRoot, { now });
    if (argv.includes('--digest')) {
        process.stdout.write(digest(repoRoot, candidates, now));
        return 0;
    }
    process.stdout.write(render(candidates));

    if (argv.includes('--print-relaunch')) {
        process.stdout.write(renderResumePlans(resumePlans(repoRoot, candidates, now)));
        return 0;
    }

    if (argv.includes('--relaunch')) {
        // A REFUSAL, not a pending implementation. The previous wording —
        // "accepted but NOT implemented … is Phase 4.0 … and is not built" —
        // is the sentence that makes an operator wait for a release nobody is
        // preparing, which is D-5's indefinite-pending shape reproduced inside
        // the roadmap that names it. The decision and its reopen condition are
        // in `LIVE_SPAWN_REFUSAL`.
        process.stderr.write(`${LIVE_SPAWN_REFUSAL}\n`);
        return 2;
    }

    if (!argv.includes('--once')) {
        process.stderr.write(
            'run:supervise: looping is not implemented — use --once. The scan above is the ' +
                'full surface (Phase 3.1: a foreground loop is enough to falsify the design). ' +
                'The loop driver was tied to the Phase 4.0 spawn, which is a published refusal, ' +
                'so it is not pending — there is nothing to wait for.\n',
        );
        return 2;
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return (
            fs.realpathSync(fileURLToPath(import.meta.url)) ===
            fs.realpathSync(path.resolve(process.argv[1]))
        );
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}

/**
 * Re-exported so a resumed run reaches its checkpoint through one path.
 *
 * `latestCheckpointFor` is the one a RELAUNCHED session can actually use: it
 * keys on the roadmap slug, which such a session holds by definition, whereas
 * `readCheckpoint` keys on the run id derived from the session that died.
 * R2 review, finding 7 — the checkpoint was write-only until this existed.
 */
export { latestCheckpointFor, readCheckpoint };
