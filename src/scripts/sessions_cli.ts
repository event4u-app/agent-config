#!/usr/bin/env node
/**
 * `agent-config sessions:list` / `sessions:claim` — the shell surface of the
 * shared session register.
 *
 * The register is written by a hook (`session_register_hook.ts`) and read by two
 * very different consumers: another hook, which imports the library directly,
 * and a **command markdown** — `/roadmap:next` — which is prose the model
 * follows and can only reach a script through a shell call. This file is that
 * call.
 *
 * Giving the command a real verb instead of asking the model to read and parse
 * JSON files matters for honesty, not convenience: the *screen* stays
 * model-carried either way (nothing forces the model to run it), but what the
 * screen does once invoked becomes deterministic and testable rather than a
 * re-derivation each time.
 *
 * ## Subcommands
 *
 * - `list [--json] [--branches]` — live sessions on this repo, plus the branches
 *   checked out in OTHER worktrees. Human table by default; `--json` emits the
 *   raw records for a scripted screen, and `--branches` adds the second axis to
 *   the JSON (the human output always shows it). Exits 0 with an empty result
 *   when there is no register — its absence is the normal pre-first-session
 *   state, never an error.
 * - `claim <slug>` — record that THIS SESSION has taken a roadmap. Writes the
 *   bridge file the next heartbeat lifts into the register, keyed on the host
 *   session id where one exists.
 * - `claim --release` — clear the claim.
 *
 * ## Why two axes and not one
 *
 * The slug axis needs a claim to have been written, and writing it is
 * model-carried. The branch axis needs nothing: a worktree checkout is on disk
 * from the first minute. Measured twice, the duplication was caught by the branch
 * axis (`git branch`'s `+` marker) and missed entirely by the register, so
 * reporting only the register is reporting the half that can be silent.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { write_atomic } from './_lib/fs_atomic.js';
import {
    iso_now,
    read_live_records,
    register_dir,
    ttl_is_measured,
    ttl_seconds_for,
} from './_lib/session_register.js';
import {
    ROADMAP_CLAIM_REL,
    claim_is_stale,
    roadmap_claim_rel,
} from './session_register_hook.js';

function usage(): number {
    process.stderr.write(
        [
            'usage:',
            '  agent-config sessions:list [--json]      live sessions on this repository',
            '  agent-config sessions:claim <slug>       claim a roadmap for this session',
            '  agent-config sessions:claim <slug> --force   claim it even though a peer holds it',
            '  agent-config sessions:claim --release    drop this session\'s roadmap claim',
            '',
        ].join('\n'),
    );
    return 2;
}

/**
 * Branches checked out in ANOTHER worktree — the second axis, and the one that
 * does not depend on a claim having been written.
 *
 * `git branch` marks these with a `+` prefix, and that prefix is what actually
 * caught the duplication both times it happened, from a memory note rather than
 * from any command. It is reported here because the register alone cannot see it:
 * a session that never ran `sessions:claim` is invisible to the slug axis while
 * its branch is already on disk, so a claim-only screen has a blind spot exactly
 * where the first minutes of a duplicate live.
 *
 * `git worktree list --porcelain` is preferred over parsing `git branch` output:
 * the `+` marker is presentation and the porcelain form is a contract.
 */
export function other_worktree_branches(
    root: string,
    spawn: typeof spawnSync = spawnSync,
): { branch: string; worktree: string }[] {
    let out = '';
    try {
        const r = spawn('git', ['worktree', 'list', '--porcelain'], {
            cwd: root,
            encoding: 'utf-8',
            timeout: 10_000,
        });
        if (r.status !== 0) {
            return [];
        }
        out = String(r.stdout ?? '');
    } catch {
        return [];
    }
    // Unmerged branches only, in ONE extra git call. Without this filter the
    // list is every worktree the repo ever had — 30+ here, all long merged — and
    // a list that is mostly noise is a list nobody reads, which is the failure
    // mode a false-positive-prone warning always ends in.
    let unmerged: Set<string> | null = null;
    try {
        const r = spawn('git', ['branch', '--no-merged', 'origin/main', '--format=%(refname:short)'], {
            cwd: root,
            encoding: 'utf-8',
            timeout: 10_000,
        });
        if (r.status === 0) {
            unmerged = new Set(
                String(r.stdout ?? '')
                    .split('\n')
                    .map((s) => s.trim())
                    .filter((s) => s !== ''),
            );
        }
    } catch {
        unmerged = null; // no filter available — report everything rather than nothing
    }

    const rows: { branch: string; worktree: string }[] = [];
    let wt: string | null = null;
    for (const raw of out.split('\n')) {
        const line = raw.trim();
        if (line.startsWith('worktree ')) {
            wt = line.slice('worktree '.length).trim();
        } else if (line.startsWith('branch ') && wt !== null) {
            const ref = line.slice('branch '.length).trim();
            const branch = ref.replace(/^refs\/heads\//, '');
            // The caller's own worktree is not a foreign checkout. Compared by
            // realpath because /var vs /private/var on macOS would otherwise make
            // every session report itself as a collision.
            let same = false;
            try {
                same = fs.realpathSync(wt) === fs.realpathSync(root);
            } catch {
                same = wt === root;
            }
            if (!same && (unmerged === null || unmerged.has(branch))) {
                rows.push({ branch, worktree: wt });
            }
        }
    }
    rows.sort((a, b) => a.branch.localeCompare(b.branch) || a.worktree.localeCompare(b.worktree));
    return rows;
}

function cmd_list(argv: string[], root: string): number {
    const as_json = argv.includes('--json');
    const dir = register_dir(root);
    const records = dir === null ? [] : read_live_records(dir, { prune: true });
    const held = other_worktree_branches(root);

    if (as_json) {
        // The record array stays the top-level shape it has always been when
        // `--branches` is absent: a scripted screen pins it, and silently wrapping
        // it in an object would break every existing caller.
        process.stdout.write(
            argv.includes('--branches')
                ? `${JSON.stringify({ sessions: records, otherWorktreeBranches: held }, null, 2)}\n`
                : `${JSON.stringify(records, null, 2)}\n`,
        );
        return 0;
    }

    if (records.length === 0 && held.length === 0) {
        process.stdout.write('No live sessions registered on this repository.\n');
        return 0;
    }
    if (records.length === 0) {
        process.stdout.write('No live sessions registered on this repository.\n');
        writeHeldBranches(held);
        return 0;
    }

    const now = Date.now();
    process.stdout.write(`${records.length} live session(s) on this repository:\n\n`);
    for (const r of records) {
        const age_min = Math.max(0, Math.round((now - Date.parse(r.last_seen)) / 60000));
        const ttl_h = Math.round(ttl_seconds_for(r.platform) / 3600);
        const ttl_note = ttl_is_measured(r.platform) ? `${ttl_h}h` : `${ttl_h}h (unmeasured host)`;
        // A slug naming no open roadmap is labelled rather than printed straight.
        // Measured: four live records all carried one already-archived slug, and a
        // screening session read that as "taken" about work that had shipped.
        const roadmap =
            r.roadmap_slug === null
                ? '(none claimed)'
                : claim_is_stale(root, r.roadmap_slug)
                  ? `${r.roadmap_slug}  ← STALE, no such open roadmap; treat as no claim`
                  : r.roadmap_slug;
        process.stdout.write(
            [
                `  ${r.session_id}`,
                `    host:     ${r.platform}  ·  TTL ${ttl_note}`,
                `    branch:   ${r.branch ?? '(detached)'}`,
                `    roadmap:  ${roadmap}`,
                `    worktree: ${r.worktree}`,
                `    seen:     ${age_min} min ago`,
                '',
            ].join('\n'),
        );
    }
    writeHeldBranches(held);
    process.stdout.write(
        'Advisory only — this register is not a lock, and an idle session\n' +
            'disappears from it after its TTL although its user may return.\n',
    );
    return 0;
}

function writeHeldBranches(held: readonly { branch: string; worktree: string }[]): void {
    if (held.length === 0) {
        return;
    }
    process.stdout.write(
        `\n${held.length} unmerged branch(es) checked out in another worktree — a claim\n` +
            'may not have been written yet, so check these before picking work.\n' +
            'Limit: a branch created seconds ago carries no commits and is therefore\n' +
            'MERGED into main by definition, so it does not appear here — that first\n' +
            'minute is what the roadmap-slug axis above covers.\n',
    );
    for (const h of held) {
        process.stdout.write(`  ${h.branch}\n    ${h.worktree}\n`);
    }
}

/**
 * This session's id, from the host environment, or `null`.
 *
 * The CLI has no envelope, so the environment is the only channel — and it is a
 * real one: Claude Code exports `CLAUDE_CODE_SESSION_ID` into every shell it
 * spawns (probed 2026-08-12). A host that exports nothing degrades to the legacy
 * per-worktree claim rather than losing the claim, and `sessions:claim` says so
 * on that path instead of implying a per-session guarantee it cannot give.
 */
export function env_session_id(env: NodeJS.ProcessEnv = process.env): string | null {
    // The package's own variable is checked FIRST — an override that loses to the
    // host variable is not an override. Caught by a test that set it and still got
    // the ambient Claude Code id back, which is also the shape a second host or a
    // debugging run would hit.
    for (const key of ['AGENT_CONFIG_SESSION_ID', 'CLAUDE_CODE_SESSION_ID']) {
        const v = String(env[key] ?? '').trim();
        if (v !== '') {
            return v;
        }
    }
    return null;
}

/**
 * Who else is already on this slug — checked BEFORE the claim is written.
 *
 * This is the only point in the flow where the check can work, and finding that
 * out was the load-bearing part of the repair. The register's context block is
 * emitted on `session_start` **only**, and at session start this session's own
 * slug is `null` by construction, because the roadmap is picked later. A
 * roadmap-collision warning in that renderer can therefore never fire on the
 * session doing the picking: the warning window sat entirely before the decision.
 *
 * `sessions:claim` is the decision. It runs in the foreground, its output reaches
 * the model directly, and it needs no hook slot and no heartbeat delay.
 *
 * Two sources, because either can be silent alone: a live register record with
 * the same slug, and an unmerged branch in another worktree whose NAME contains
 * the slug's distinctive tail (a peer that never claimed). The name match is a
 * heuristic and says so — it is a reason to look, not a verdict.
 */
export function claim_conflicts(
    root: string,
    slug: string,
): { kind: 'session' | 'branch'; detail: string }[] {
    const out: { kind: 'session' | 'branch'; detail: string }[] = [];
    const dir = register_dir(root);
    const sid = env_session_id();
    if (dir !== null) {
        for (const r of read_live_records(dir, { prune: false })) {
            if (sid !== null && r.session_id === sid) {
                continue;
            }
            if (r.roadmap_slug === slug && !claim_is_stale(root, r.roadmap_slug)) {
                out.push({
                    kind: 'session',
                    detail: `${r.platform} session on branch \`${r.branch ?? 'detached'}\` in ${r.worktree}`,
                });
            }
        }
    }
    // `road-to-inbox-harvest-2026-08-b-dispatch-safety` → `dispatch-safety`, which
    // is what a branch name actually carries. Matching the whole slug would find
    // nothing: neither colliding branch in either measured incident contained it.
    const tail = slug.replace(/^road-to-/, '').split('-').slice(-2).join('-');
    if (tail.length >= 4) {
        for (const b of other_worktree_branches(root)) {
            if (b.branch.includes(tail)) {
                out.push({ kind: 'branch', detail: `branch \`${b.branch}\` in ${b.worktree}` });
            }
        }
    }
    // Deduplicated by rendered detail. Several records can describe the same
    // peer — observed live: three sessions in one checkout all carrying one slug,
    // which is the per-worktree claim defect this change also fixes. Three
    // identical lines read as three peers and inflate the finding.
    const seen = new Set<string>();
    return out.filter((c) => {
        const key = `${c.kind}\t${c.detail}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function cmd_claim(argv: string[], root: string): number {
    const sid = env_session_id();
    const target = path.join(root, roadmap_claim_rel(sid));
    if (argv.includes('--release')) {
        // Release BOTH paths: a claim written before this session could identify
        // itself lives in the legacy file, and releasing only the new one would
        // leave a claim behind that the heartbeat still reports.
        for (const p of new Set([target, path.join(root, ROADMAP_CLAIM_REL)])) {
            try {
                fs.unlinkSync(p);
            } catch {
                /* nothing to release */
            }
        }
        process.stdout.write('Roadmap claim released.\n');
        return 0;
    }
    const slug = argv.find((a) => !a.startsWith('-'));
    if (slug === undefined || slug.trim() === '') {
        return usage();
    }

    // Refuse to WRITE a claim a peer already holds, and exit non-zero. This is a
    // consistency check on this session's own write, NOT a lock: two sessions can
    // still claim in the same millisecond, and the register's own contract forbids
    // building exclusion on it. What it does buy is that the second session to
    // arrive cannot record a false "I am doing this" and cannot miss the notice —
    // which is exactly what happened twice, both times ending in a discarded PR.
    const conflicts = argv.includes('--force') ? [] : claim_conflicts(root, slug.trim());
    if (conflicts.length > 0) {
        process.stderr.write(
            `sessions:claim: REFUSED — "${slug.trim()}" is already being worked on.\n` +
                conflicts.map((c) => `  · ${c.kind}: ${c.detail}\n`).join('') +
                '\nA different branch name does not make it a different task. Pick another\n' +
                'roadmap, split this one explicitly with the peer, or re-run with --force\n' +
                'if you have decided to duplicate deliberately.\n' +
                'Advisory, not a lock: two sessions claiming simultaneously still race.\n',
        );
        return 1;
    }

    try {
        write_atomic(
            target,
            `${JSON.stringify({ slug: slug.trim(), written_at: iso_now(), session_id: sid }, null, 2)}\n`,
        );
    } catch (exc) {
        process.stderr.write(`sessions:claim: could not write the claim — ${String(exc)}\n`);
        return 1; // the claim is the whole point of this verb; a silent no-op would lie
    }
    process.stdout.write(
        `Claimed "${slug.trim()}" for this session. It becomes visible to other\n` +
            'sessions on the next turn, when the heartbeat lifts it into the register.\n' +
            (sid === null
                ? 'NOTE: this host exports no session id, so the claim is scoped to this\n' +
                  'WORKTREE — a second session in the same checkout will overwrite it.\n'
                : ''),
    );
    return 0;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const root = process.cwd();
    const sub = argv[0] ?? '';
    const rest = argv.slice(1);
    if (sub === 'list') return cmd_list(rest, root);
    if (sub === 'claim') return cmd_claim(rest, root);
    return usage();
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
if (!_bundled && fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main());
}
