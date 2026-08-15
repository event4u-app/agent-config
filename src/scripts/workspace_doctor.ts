#!/usr/bin/env tsx
/**
 * workspace:doctor — read-only answer to "where am I", with provenance.
 *
 * Phase 3 of `road-to-inbox-harvest-2026-08-c-workspace-identity`. Two reads,
 * one command, and **no action**: the roadmap's Non-goals put worktree deletion
 * out of scope, and its Risk 3 names "the pressure read becomes a disposal path
 * by accident" as the failure to design against. There is therefore no `--fix`,
 * no `--prune`, and no removal plan here — `worktree_cleanup_check.ts` owns
 * that question behind its own approval.
 *
 * 1. **Identity** — the five fields of `workspaceIdentity()` plus the session
 *    facts a location question actually needs: the roadmap claim, foreign live
 *    records, expired-but-unpruned records, and whether this checkout is
 *    contained in the main worktree. Every field prints its provenance, in the
 *    shape `routing:doctor` uses, because a value whose source is invisible is
 *    indistinguishable from a guess.
 *
 * 2. **Worktree pressure** — how large the estate is and how much of it is
 *    merged. The buckets **partition** the registered set, so they sum to the
 *    `git worktree list` total exactly. The live-session count is deliberately
 *    NOT one of them: it overlaps every bucket, and printing it inside the
 *    partition would invite a reader to add it in.
 *
 * Exit code is 0 whenever the command could read the repository. It is a
 * report, not a gate: nothing here has a pass/fail opinion, so a non-zero exit
 * would have to invent one.
 *
 * `--strict` exits 1 when **any** identity field is unresolved. Note what that
 * means in a repo with no `refs/remotes/origin/HEAD` on disk: `prBase` is
 * unresolved *correctly*, so `--strict` is red there by design. It is a probe
 * for "is every field answerable here", not a health check — and this file
 * previously claimed a per-field selection that does not exist.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    type IdentityField,
    type WorkspaceIdentity,
    workspaceIdentity,
} from './_lib/git_common_dir.js';
import { gitEnv } from './_lib/git_env.js';
import {
    read_live_records,
    register_dir,
    type SessionRecord,
} from './_lib/session_register.js';
import { listWorktrees, resolveTrunk } from './worktree_cleanup_check.js';

const IDENTITY_FIELDS = ['repoRoot', 'mainWorktree', 'currentWorktree', 'branch', 'prBase'] as const;
type IdentityFieldName = (typeof IDENTITY_FIELDS)[number];

interface SessionView {
    /** Roadmap slug this session claims, or `null`; `source` says where from. */
    readonly claim: string | null;
    readonly claim_source: string;
    /** Live foreign records, i.e. every live record that is not this session's. */
    readonly live_records: number;
    /** Live records whose `worktree` is this checkout — a real collision. */
    readonly conflicting: number;
    /** Record files on disk that `read_live_records` judged expired. */
    readonly stale: number;
    /** Where the register lives, or why it could not be located. */
    readonly register: string;
}

interface ContainmentView {
    /** Is the current checkout inside the main worktree's directory tree? */
    readonly contained: boolean | null;
    readonly reason: string;
}

interface PressureView {
    readonly trunk: string | null;
    /** Where `trunk` came from — a candidate search, not a recorded default. */
    readonly trunk_provenance: string;
    readonly registered: number;
    /** Same count from a DIFFERENT command; a mismatch is the real signal. */
    readonly independent_registered: number | null;
    /** Branch appears in `for-each-ref --merged <trunk>`. */
    readonly merged: number;
    /** Branch exists and is NOT merged into the trunk. */
    readonly unmerged: number;
    /** No branch to ask about (detached), or the merged probe was unavailable. */
    readonly unclassifiable: number;
    /** Overlaps the three buckets above on purpose; never summed with them. */
    readonly with_live_session: number;
    /** `merged + unmerged + unclassifiable`, printed so the sum is auditable. */
    readonly partition_total: number;
    readonly note: string | null;
}

export interface WorkspaceDoctorReport {
    readonly identity: Record<IdentityFieldName, IdentityField>;
    readonly session: SessionView;
    readonly containment: ContainmentView;
    readonly pressure: PressureView;
}

function _git(cwd: string, args: readonly string[]): string | null {
    try {
        return execFileSync('git', [...args], {
            cwd,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 15_000,
            // cwd decides, never an inherited GIT_DIR (hook environments).
            env: gitEnv(),
        }).trim();
    } catch {
        return null;
    }
}

/**
 * Independent count of registered worktrees, parsed from the **plain**
 * `git worktree list` rather than the porcelain form `listWorktrees` reads.
 *
 * This exists so the partition assertion below is falsifiable. Comparing
 * `merged + unmerged + unclassifiable` against `rows.length` — where the
 * buckets are incremented once per row — is a tautology that holds by
 * construction and cannot detect a dropped entry. Two different commands with
 * two different output formats can disagree; that disagreement is the signal.
 */
export function independentRegisteredCount(repoPath: string): number | null {
    const out = _git(repoPath, ['worktree', 'list']);
    if (out === null) return null;
    return out.split('\n').filter((l) => l.trim() !== '').length;
}

/**
 * Short branch names merged into `trunk`, in **one** subprocess.
 *
 * Replaces one `merge-base --is-ancestor` spawn per registered worktree —
 * measured at 307 spawns and 15.2 s wall for a read-only report. It also
 * removes a silent misclassification: `_git` returns `null` on any failure
 * (bad ref, timeout, git absent), and mapping that onto "not an ancestor"
 * reported a failed probe as `unmerged`. Here a failed call is `null` and the
 * caller sends every row to `unclassifiable` instead of guessing a side.
 */
function mergedBranches(repoPath: string, trunk: string): Set<string> | null {
    const out = _git(repoPath, ['for-each-ref', '--merged', trunk, '--format=%(refname:short)', 'refs/heads/']);
    if (out === null) return null;
    return new Set(out.split('\n').map((l) => l.trim()).filter((l) => l !== ''));
}

function realpathOrSelf(p: string): string {
    try {
        return fs.realpathSync(p);
    } catch {
        return p;
    }
}

/**
 * Is `child` inside `parent`?
 *
 * Both sides are realpath-normalised first, and the comparison is
 * separator-anchored: a plain `startsWith` would report `/a/repo-backup` as
 * contained in `/a/repo`.
 */
export function isContained(parent: string, child: string): boolean {
    const p = realpathOrSelf(parent);
    const c = realpathOrSelf(child);
    if (p === c) return false; // the main worktree is not "inside" itself
    return c.startsWith(p.endsWith(path.sep) ? p : p + path.sep);
}

function collectSession(identity: WorkspaceIdentity, sessionId: string | null): SessionView {
    const main = identity.mainWorktree;
    const here = identity.currentWorktree;
    if (!main.resolved) {
        return {
            claim: null,
            claim_source: 'unavailable — no main worktree to anchor the register on',
            live_records: 0,
            conflicting: 0,
            stale: 0,
            register: `unresolvable: ${main.reason}`,
        };
    }
    const dir = register_dir(main.value);
    if (dir === null) {
        return {
            claim: null,
            claim_source: 'unavailable — register_dir declined to resolve',
            live_records: 0,
            conflicting: 0,
            stale: 0,
            register: 'unresolvable',
        };
    }

    // `read_live_records` filters expired ones out; the difference against the
    // files on disk is the stale count. Never prune here — this is a report.
    const live = read_live_records(dir);
    let onDisk = 0;
    try {
        onDisk = fs.readdirSync(dir).filter((n) => n.endsWith('.json')).length;
    } catch {
        onDisk = 0;
    }

    const mine = sessionId === null ? null : live.find((r) => r.session_id === sessionId) ?? null;
    const foreign: SessionRecord[] = live.filter((r) => r.session_id !== sessionId);
    const hereValue = here.resolved ? realpathOrSelf(here.value) : null;
    const conflicting =
        hereValue === null ? 0 : foreign.filter((r) => realpathOrSelf(r.worktree) === hereValue).length;

    let claim: string | null = null;
    let claimSource: string;
    if (mine?.roadmap_slug != null && mine.roadmap_slug !== '') {
        claim = mine.roadmap_slug;
        claimSource = 'this session\'s register record';
    } else if (sessionId === null) {
        claimSource = 'no session id in the environment — the host exports none, or this is not an agent session';
    } else {
        claimSource = 'no claim in this session\'s record (none picked, or the heartbeat has not lifted it yet)';
    }

    return {
        claim,
        claim_source: claimSource,
        live_records: foreign.length,
        conflicting,
        stale: Math.max(0, onDisk - live.length),
        register: dir,
    };
}

function collectContainment(identity: WorkspaceIdentity): ContainmentView {
    const main = identity.mainWorktree;
    const here = identity.currentWorktree;
    if (!main.resolved) return { contained: null, reason: `main worktree unresolved: ${main.reason}` };
    if (!here.resolved) return { contained: null, reason: `current worktree unresolved: ${here.reason}` };
    if (realpathOrSelf(main.value) === realpathOrSelf(here.value)) {
        // `null`, not `false`: the question does not apply, and rendering it as
        // the word "outside" beside the reason "this IS the main worktree" was
        // a self-contradicting line.
        return { contained: null, reason: 'this IS the main worktree — containment does not apply' };
    }
    const contained = isContained(main.value, here.value);
    return {
        contained,
        reason: contained
            ? 'this checkout lives inside the main worktree'
            : 'this checkout lives outside the main worktree — a sibling or unrelated directory',
    };
}

function collectPressure(identity: WorkspaceIdentity, live: SessionRecord[]): PressureView {
    const main = identity.mainWorktree;
    if (!main.resolved) {
        return {
            trunk: null,
            trunk_provenance: 'not attempted — no main worktree to resolve from',
            registered: 0,
            independent_registered: null,
            merged: 0,
            unmerged: 0,
            unclassifiable: 0,
            with_live_session: 0,
            partition_total: 0,
            note: `no main worktree to enumerate from: ${main.reason}`,
        };
    }
    // Both helpers are the EXPORTED ones from worktree_cleanup_check. Re-deriving
    // them here would have been a fourth `worktree list --porcelain` parser and a
    // second `resolveTrunk` beside the two this roadmap's own census counts — the
    // duplication the whole change exists to remove.
    const rows = listWorktrees(main.value);
    // `resolveTrunk` returns the literal 'HEAD' when no trunk candidate resolves.
    const trunkRef = resolveTrunk(main.value);
    const trunk = trunkRef === 'HEAD' ? null : trunkRef;
    const merged_set = trunk === null ? null : mergedBranches(main.value, trunk);
    const livePaths = new Set(live.map((r) => realpathOrSelf(r.worktree)));

    let merged = 0;
    let unmerged = 0;
    let unclassifiable = 0;
    let withLive = 0;
    for (const row of rows) {
        if (livePaths.has(realpathOrSelf(row.path))) withLive += 1;
        if (row.branch === null || merged_set === null) {
            unclassifiable += 1;
        } else if (merged_set.has(row.branch)) {
            merged += 1;
        } else {
            unmerged += 1;
        }
    }

    const independent = independentRegisteredCount(main.value);
    const notes: string[] = [];
    if (trunk === null) {
        notes.push(
            'no trunk ref resolved — every entry is unclassifiable rather than assumed merged',
        );
    } else if (merged_set === null) {
        notes.push(
            `the merged-branch probe against ${trunk} failed — every entry is unclassifiable rather than assumed unmerged`,
        );
    }
    if (independent !== null && independent !== rows.length) {
        notes.push(
            `COUNT DISAGREEMENT: the porcelain parse sees ${rows.length}, the plain listing ${independent}`,
        );
    }

    return {
        trunk,
        trunk_provenance:
            trunk === null
                ? 'unresolved — no candidate ref verified'
                : 'candidate-ref search (first of origin/main, origin/master, main, master that resolves) — NOT a recorded remote default, which is what identity.prBase reports',
        registered: rows.length,
        independent_registered: independent,
        merged,
        unmerged,
        unclassifiable,
        with_live_session: withLive,
        partition_total: merged + unmerged + unclassifiable,
        note: notes.length === 0 ? null : notes.join(' · '),
    };
}

export function collectReport(start: string, sessionId: string | null): WorkspaceDoctorReport {
    const identity = workspaceIdentity(start);
    const session = collectSession(identity, sessionId);
    const main = identity.mainWorktree;
    const dir = main.resolved ? register_dir(main.value) : null;
    const live = dir === null ? [] : read_live_records(dir);
    return {
        identity: {
            repoRoot: identity.repoRoot,
            mainWorktree: identity.mainWorktree,
            currentWorktree: identity.currentWorktree,
            branch: identity.branch,
            prBase: identity.prBase,
        },
        session,
        containment: collectContainment(identity),
        pressure: collectPressure(identity, live),
    };
}

function renderField(name: string, f: IdentityField): string {
    const marker = f.resolved ? '✅' : '⚠️';
    const body = f.resolved ? `${f.value}   [${f.provenance}]` : `UNRESOLVED — ${f.reason}`;
    return `  ${marker} ${name.padEnd(16)} ${body}`;
}

export function render(report: WorkspaceDoctorReport): string {
    const lines: string[] = [];
    lines.push('workspace:doctor · read-only · no disposal path by design');
    lines.push('');
    lines.push('Identity (every field with its provenance):');
    for (const name of IDENTITY_FIELDS) {
        lines.push(renderField(name, report.identity[name]));
    }
    lines.push('');

    const s = report.session;
    lines.push('Session:');
    lines.push(`  claim: ${s.claim ?? 'none'}   [${s.claim_source}]`);
    lines.push(`  register: ${s.register}`);
    lines.push(
        `  foreign live records: ${s.live_records} · conflicting on THIS checkout: ${s.conflicting} · expired-not-pruned: ${s.stale}`,
    );
    lines.push(
        '  advisory, never a lock — two sessions can claim in the same millisecond, and an idle session leaves the register while its user returns',
    );
    lines.push('');

    const c = report.containment;
    lines.push(`Path containment: ${c.contained === null ? 'n/a' : c.contained ? 'inside' : 'outside'} — ${c.reason}`);
    lines.push('');

    const p = report.pressure;
    lines.push(`Worktree pressure (trunk = ${p.trunk ?? 'unresolved'}):`);
    lines.push(`  trunk provenance: ${p.trunk_provenance}`);
    lines.push(`  registered: ${p.registered}`);
    lines.push(`    merged into trunk:        ${p.merged}`);
    lines.push(`    carrying unmerged commits:${String(p.unmerged).padStart(4)}`);
    lines.push(`    unclassifiable:           ${String(p.unclassifiable).padStart(4)}   (detached, or no merged probe)`);
    const independentOk = p.independent_registered === null || p.independent_registered === p.registered;
    lines.push(
        `    ── partition sums to ${p.partition_total} of ${p.registered}` +
            `, cross-checked against an independent count of ${p.independent_registered ?? 'n/a'}` +
            `${p.partition_total === p.registered && independentOk ? ' ✅' : ' ❌ MISMATCH'}`,
    );
    lines.push(
        `  with a live session record: ${p.with_live_session}   (overlaps the buckets above — not part of the partition)`,
    );
    if (p.note !== null) lines.push(`  note: ${p.note}`);
    lines.push('');
    lines.push('Disposal is out of scope here (roadmap Non-goals; Risk 3). `worktree:cleanup` owns it, behind its own approval.');
    return lines.join('\n');
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    let start = process.cwd();
    let json = false;
    let strict = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--from' && argv[i + 1] !== undefined) {
            start = path.resolve(String(argv[(i += 1)]));
        } else if (a === '--json') {
            json = true;
        } else if (a === '--strict') {
            strict = true;
        } else if (a === '--help' || a === '-h') {
            process.stdout.write(
                'workspace:doctor [--from <dir>] [--json] [--strict]\n' +
                    '  Read-only workspace identity + worktree pressure report.\n' +
                    '  --strict exits 1 when any identity field is unresolved.\n',
            );
            return 0;
        }
    }

    const sessionId = process.env['CLAUDE_CODE_SESSION_ID'] ?? process.env['AGENT_SESSION_ID'] ?? null;
    const report = collectReport(start, sessionId);
    process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : `${render(report)}\n`);

    if (strict) {
        const unresolved = IDENTITY_FIELDS.filter((n) => !report.identity[n].resolved);
        if (unresolved.length > 0) {
            process.stderr.write(`unresolved identity field(s): ${unresolved.join(', ')}\n`);
            return 1;
        }
    }
    return 0;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv1;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
