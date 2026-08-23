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
    classify_collisions,
    iso_now,
    read_live_records,
    register_dir,
    safe_stem,
    ttl_is_measured,
    ttl_seconds_for,
    type SessionRecord,
} from './_lib/session_register.js';
import { claim_file, claim_is_stale, claim_read_paths } from './session_register_hook.js';

function usage(): number {
    process.stderr.write(
        [
            'usage:',
            '  agent-config sessions:list [--json] [--branches]',
            '                                           live sessions, plus unmerged branches',
            '                                           held by other worktrees (--branches adds',
            '                                           that axis to the JSON form)',
            '  agent-config sessions:claim <slug> [--paths <a,b,…>]       claim a roadmap for this session',
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
    return other_worktree_branches_detailed(root, spawn).rows;
}

/**
 * Same walk, plus whether the unmerged filter was actually applied.
 *
 * R2 finding 12: when `origin/main` is missing or un-fetched the filter silently
 * drops and every foreign worktree is reported — while the human output still
 * claimed "N unmerged branch(es)". In a tree with 30+ long-merged worktrees that
 * is not a small overstatement, and the reader had no way to see the degradation.
 */
export function other_worktree_branches_detailed(
    root: string,
    spawn: typeof spawnSync = spawnSync,
): { rows: { branch: string; worktree: string }[]; filtered: boolean } {
    let out = '';
    try {
        const r = spawn('git', ['worktree', 'list', '--porcelain'], {
            cwd: root,
            encoding: 'utf-8',
            timeout: GIT_PROBE_TIMEOUT_MS,
        });
        if (r.status !== 0) {
            return { rows: [], filtered: false };
        }
        out = String(r.stdout ?? '');
    } catch {
        return { rows: [], filtered: false };
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
            timeout: GIT_PROBE_TIMEOUT_MS,
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
    return { rows, filtered: unmerged !== null };
}

/**
 * `PATH OVERLAP` lines for this session against every live peer.
 *
 * Kept a separate, separately-labelled line rather than folded into the slug or
 * branch report, because the three collisions call for three different moves: a
 * slug collision means stop, a branch collision means coordinate, a path
 * collision means reorder — take the disjoint steps first if ordering allows,
 * otherwise name it and continue. The register is advisory and never a lock.
 *
 * Pure over the record arrays so the fixture test needs no register on disk.
 */
export function path_overlap_lines(
    others: readonly SessionRecord[],
    here: { branch: string | null; roadmap_slug: string | null; owned_paths?: readonly string[] },
): string[] {
    return classify_collisions(others, here)
        .filter((c) => c.kind === 'path')
        .map(
            (c) =>
                `  PATH OVERLAP  ${c.record.session_id}  ·  ${(c.paths ?? []).length} shared path(s): ` +
                `${(c.paths ?? []).join(', ')}`,
        );
}

function cmd_list(argv: string[], root: string): number {
    const as_json = argv.includes('--json');
    const dir = register_dir(root);
    const records = dir === null ? [] : read_live_records(dir, { prune: true });
    // Two git subprocesses with a 10 s timeout each, so they are not paid on the
    // scripted path that discards them (R2 finding 8).
    const wants_branches = !as_json || argv.includes('--branches');
    const walk = wants_branches
        ? other_worktree_branches_detailed(root)
        : { rows: [], filtered: false };
    const held = walk.rows;
    const filtered = walk.filtered;

    if (as_json) {
        // The record array stays the top-level shape it has always been when
        // `--branches` is absent: a scripted screen pins it, and silently wrapping
        // it in an object would break every existing caller.
        process.stdout.write(
            argv.includes('--branches')
                ? `${JSON.stringify({ sessions: records, other_worktree_branches: held, unmerged_filter_applied: filtered }, null, 2)}\n`
                : `${JSON.stringify(records, null, 2)}\n`,
        );
        return 0;
    }

    // One branch, not two: `write_held_branches([])` returns immediately, so the
    // empty-and-empty case needed no special case of its own (R2 finding 7).
    if (records.length === 0) {
        process.stdout.write('No live sessions registered on this repository.\n');
        write_held_branches(held, filtered);
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
    write_held_branches(held, filtered);
    // The path axis. Silent when this session has declared no owned paths, which
    // is every session that has not run `sessions:claim --paths`.
    const sid = env_session_id();
    const mine = sid === null ? undefined : records.find((r) => r.session_id === sid);
    const overlaps = path_overlap_lines(
        records.filter((r) => r.session_id !== mine?.session_id),
        {
            branch: mine?.branch ?? null,
            roadmap_slug: mine?.roadmap_slug ?? null,
            ...(mine?.owned_paths !== undefined ? { owned_paths: mine.owned_paths } : {}),
        },
    );
    if (overlaps.length > 0) {
        process.stdout.write(`\n${overlaps.join('\n')}\n`);
    }
    process.stdout.write(
        'Advisory only — this register is not a lock, and an idle session\n' +
            'disappears from it after its TTL although its user may return.\n',
    );
    return 0;
}

/** snake_case like every other function here (R2 finding 15). */
function write_held_branches(
    held: readonly { branch: string; worktree: string }[],
    filtered: boolean,
): void {
    if (held.length === 0) {
        return;
    }
    process.stdout.write(
        filtered
            ? `\n${held.length} unmerged branch(es) checked out in another worktree — a claim\n` +
                  'may not have been written yet, so check these before picking work.\n' +
                  'Limit: a branch created seconds ago carries no commits and is therefore\n' +
                  'MERGED into main by definition, so it does not appear here — that first\n' +
                  'minute is what the roadmap-slug axis above covers.\n'
            : `\n${held.length} branch(es) checked out in another worktree. UNFILTERED —\n` +
                  '`git branch --no-merged origin/main` was unavailable (no origin/main, or\n' +
                  'never fetched), so long-merged worktrees are included and this list\n' +
                  'overstates what is live. `git fetch origin` and re-run for the filtered set.\n',
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
 * Ceiling for the two `git` probes here. Named rather than repeated: the value
 * is a contract with the caller (a screen must not hang), and two literals drift.
 */
const GIT_PROBE_TIMEOUT_MS = 10_000;

/** Same filesystem path, symlink-tolerant. `/var` vs `/private/var` on macOS. */
function _same_path(a: string, b: string): boolean {
    try {
        return fs.realpathSync(a) === fs.realpathSync(b);
    } catch {
        return a === b;
    }
}

/**
 * Foreign-worktree branches whose NAME looks like this roadmap.
 *
 * Separated from `claim_conflicts` because it is a **heuristic** and its output is
 * treated differently: a name match warns, it never refuses. R2 finding 4 caught
 * the contradiction — the docstring called it "a reason to look, not a verdict"
 * while a hit produced exit 1 and demanded `--force`.
 *
 * Two guards on the tail, both from that finding. A slug ending in a date
 * (`road-to-inbox-harvest-2026-08`) yielded the tail `2026-08`, which cleared the
 * old `length >= 4` check and matched every branch carrying that string; a tail
 * whose tokens are all digits is therefore rejected. And a `road-to-` prefix
 * stripped from a two-token slug can leave a generic word, so the tail must be at
 * least 8 characters — measured against the real case, `dispatch-safety`.
 */
export function branch_name_hits(
    root: string,
    slug: string,
): { branch: string; worktree: string }[] {
    const tokens = slug.replace(/^road-to-/, '').split('-').filter(Boolean);
    const tail = tokens.slice(-2).join('-');
    if (tail.length < 8 || /^[\d-]+$/.test(tail)) {
        return [];
    }
    // Token-boundary match, not `includes`. The adversarial gate named the exact
    // false positive: `dispatch-safety` is a substring of `redispatch-safety-valve`,
    // which is a different task entirely. A branch name is `-` / `/` / `_`
    // delimited, so requiring a delimiter (or an end) on both sides is the whole
    // fix and it keeps `feat/dispatch-safety-confirmation` matching.
    const bounded = new RegExp(`(^|[/_-])${tail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([/_-]|$)`);
    return other_worktree_branches(root).filter((b) => bounded.test(b.branch));
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
            // Self-exclusion by session id where we have one, and by WORKTREE where
            // we do not (R2 finding 2): on a host that fills the hook envelope but
            // exports no shell variable, `sid` is null, our own record would count
            // as a peer, and re-claiming the same slug would exit 1 citing
            // ourselves — non-idempotent on exactly the graceful-degradation path.
            // Compared through `safe_stem`, because the library normalises ids and a
            // raw comparison fails silently on any id the two spell differently
            // (R2 finding 11).
            if (sid !== null && safe_stem(r.session_id) === safe_stem(sid)) {
                continue;
            }
            if (sid === null && _same_path(r.worktree, root)) {
                continue;
            }
            if (r.roadmap_slug === slug && !claim_is_stale(root, r.roadmap_slug, r.worktree)) {
                out.push({
                    kind: 'session',
                    detail: `${r.platform} session on branch \`${r.branch ?? 'detached'}\` in ${r.worktree}`,
                });
            }
        }
    }
    for (const b of branch_name_hits(root, slug)) {
        out.push({ kind: 'branch', detail: `branch \`${b.branch}\` in ${b.worktree}` });
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
    // The claim lives in the git COMMON dir, so the writer here and the stop-slot
    // reader agree on one tree even when they start from different ones. Before
    // this, the CLI joined against `process.cwd()` (the operator's worktree) and
    // the hook against `--project-dir` (the parent checkout) — in a worktree,
    // two different files, and `run-continuation` silently never engaged. See
    // `claim_dir` in session_register_hook.ts for the full account.
    const target = claim_file(root, sid);
    if (argv.includes('--release')) {
        // Release only what this session could have written. An identified session
        // never writes the legacy file, so unlinking it would delete a PEER's claim
        // in a mixed-host checkout and leave that peer reporting nothing, with no
        // notice to either side (R2 finding 10). An unidentified session shares that
        // file by construction and releasing it is the only release available.
        //
        // Both locations — the shared dir and the pre-fix per-tree path — because
        // a release that clears one and leaves the other readable does not release.
        for (const p of claim_read_paths(root, sid)) {
            if (path.basename(p) !== path.basename(target)) continue;
            try {
                fs.unlinkSync(p);
            } catch {
                /* nothing to release */
            }
        }
        process.stdout.write(
            sid === null
                ? 'Roadmap claim released (shared worktree claim — this host exports no session id).\n'
                : 'Roadmap claim released.\n',
        );
        return 0;
    }
    const paths_idx = argv.indexOf('--paths');
    const paths_arg = paths_idx >= 0 ? (argv[paths_idx + 1] ?? '') : '';
    const owned_paths = paths_arg
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x !== '');
    // The slug is the first bare token that is not the VALUE of --paths; without
    // this the comma list would be read as the slug on `claim --paths a,b road-to-x`.
    const slug = argv.find((a, i) => !a.startsWith('-') && i !== paths_idx + 1);
    if (slug === undefined || slug.trim() === '') {
        return usage();
    }

    const forced = argv.includes('--force');
    const conflicts = forced ? [] : claim_conflicts(root, slug.trim());

    // Split by evidence class, which R2 finding 4 is right to demand: a live peer
    // record carrying this exact slug is a FACT and refuses the write; a branch
    // whose name merely resembles the slug is a HEURISTIC and only warns. A
    // heuristic that forces `--force` trains people to pass `--force`.
    const hard = conflicts.filter((c) => c.kind === 'session');
    const soft = conflicts.filter((c) => c.kind === 'branch');

    if (hard.length > 0) {
        process.stderr.write(
            `sessions:claim: REFUSED — "${slug.trim()}" is already claimed by a live session.\n` +
                hard.map((c) => `  · ${c.detail}\n`).join('') +
                (soft.length > 0 ? soft.map((c) => `  · also, by name: ${c.detail}\n`).join('') : '') +
                '\nA different branch name does not make it a different task. Pick another\n' +
                'roadmap, split this one explicitly with the peer, or re-run with --force\n' +
                'if you have decided to duplicate deliberately.\n' +
                'Advisory, not a lock: two sessions claiming simultaneously still race.\n',
        );
        return 1;
    }

    // A slug naming no open roadmap is a typo or an archived roadmap, and writing
    // it manufactures exactly the stale claim this change teaches every reader to
    // discount (R2 finding 13). The cheapest guard against creating one belongs at
    // the only write site.
    if (!forced && claim_is_stale(root, slug.trim())) {
        process.stderr.write(
            `sessions:claim: REFUSED — no open roadmap named "${slug.trim()}".\n` +
                '  Expected agents/roadmaps/<slug>.md; archive/, later/ and skipped/ do not count.\n' +
                '  Check the spelling, or use --force if the file is genuinely arriving later.\n',
        );
        return 1;
    }

    try {
        write_atomic(
            target,
            `${JSON.stringify(
                {
                    slug: slug.trim(),
                    written_at: iso_now(),
                    session_id: sid,
                    // Absent, not empty, when nothing was declared: the whole
                    // additive guarantee of `owned_paths` rests on the field not
                    // being written at all in the ordinary case.
                    ...(owned_paths.length > 0 ? { paths: owned_paths } : {}),
                },
                null,
                2,
            )}\n`,
        );
    } catch (exc) {
        process.stderr.write(`sessions:claim: could not write the claim — ${String(exc)}\n`);
        return 1; // the claim is the whole point of this verb; a silent no-op would lie
    }
    process.stdout.write(
        `Claimed "${slug.trim()}" for this session. It becomes visible to other\n` +
            (owned_paths.length > 0
                ? `Declared ${owned_paths.length} owned path(s); peers sharing one are labelled PATH OVERLAP.\n`
                : '') +
            'sessions on the next turn, when the heartbeat lifts it into the register.\n' +
            (sid === null
                ? 'NOTE: this host exports no session id, so the claim is scoped to this\n' +
                  'WORKTREE — a second session in the same checkout will overwrite it.\n'
                : '') +
            // The heuristic axis reports here rather than refusing above.
            (soft.length > 0
                ? `WARNING: ${soft.length} branch name(s) in other worktrees resemble this roadmap.\n` +
                  soft.map((c) => `  · ${c.detail}\n`).join('') +
                  '  A name match is a reason to look, not proof — check before you write code.\n'
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
