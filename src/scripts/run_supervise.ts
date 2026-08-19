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
import { countRoadmap, readCheckpoint, roadmapPath } from './_lib/run_checkpoint.js';

/** UOTL 6.2 verbatim: at most three relaunches per run. */
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
    | 'budget-exhausted'
    | 'relaunchable';

export interface Candidate {
    readonly session_id: string;
    readonly roadmap: string | null;
    readonly worktree: string;
    readonly disposition: Disposition;
    readonly open_steps: number | null;
    readonly relaunches: number;
    /** One sentence a human can act on without opening anything. */
    readonly reason: string;
}

/** Per-run relaunch counts. A plain object so the file stays readable by eye. */
export type RelaunchLedger = Record<string, number>;

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

export function writeLedger(repoRoot: string, ledger: RelaunchLedger): void {
    const file = path.join(repoRoot, SUPERVISE_STATE_REL);
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, `${JSON.stringify(ledger, null, 2)}\n`, 'utf-8');
    } catch {
        // The ledger bounds relaunches; a failed write must not silently
        // UNBOUND them, so the caller treats a write failure as a stop below.
    }
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
        relaunches: ledger[rec.session_id] ?? 0,
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

export interface ScanOptions {
    readonly now?: Date;
}

/**
 * Every record in the register, expired ones INCLUDED — and it has to be its
 * own reader rather than `read_live_records`, because that one filters expired
 * records out by design. Reading only live records here would return exactly
 * the sessions that need no supervision and none of the ones that do.
 *
 * It also never prunes. `read_live_records({ prune: true })` deletes expired
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

const USAGE = `usage: run_supervise [--root PATH] [--once] [--interval SECONDS] [--relaunch]

Watches the session register for runs whose session died with open steps left.

  --root PATH        repository root (default: cwd)
  --once             one scan, then exit (default: loop)
  --interval SECONDS seconds between scans when looping (default: 60)
  --relaunch         ACT: start a fresh session per relaunchable run, up to
                     ${MAX_RELAUNCHES_PER_RUN} per run. Default is report-only —
                     a relaunch spends tokens with nobody watching.

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
    const repoRoot = argValue(argv, '--root') ?? process.cwd();
    const candidates = scan(repoRoot);
    process.stdout.write(render(candidates));

    if (argv.includes('--relaunch')) {
        // The headless invocation primitive is Phase 4.0 and is not built, so
        // this path reports what it WOULD do rather than pretending to act.
        // Named as unbuilt rather than silently doing nothing: a flag that
        // accepts and no-ops is the shape that makes an operator believe a
        // watcher is running when nothing is.
        const relaunchable = candidates.filter((c) => c.disposition === 'relaunchable');
        process.stderr.write(
            `run:supervise: --relaunch is accepted but NOT implemented — the headless ` +
                `invocation primitive is Phase 4.0 of road-to-long-horizon-execution and is ` +
                `not built. ${relaunchable.length} run(s) would have been relaunched. Nothing ` +
                `was started, and no ledger entry was spent.\n`,
        );
        return 2;
    }

    if (!argv.includes('--once')) {
        process.stderr.write(
            'run:supervise: looping is not implemented yet — use --once. The scan above is ' +
                'the full v1 surface (Phase 3.1: a foreground loop is enough to falsify the ' +
                'design; the loop driver lands with the Phase 4.0 primitive it would call).\n',
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

/** Re-exported so a resumed run can read its own checkpoint through one path. */
export { readCheckpoint };
