<!-- evidence-type: analysis -->

# Ratification review — hook bundle ceiling raise for the session catalog — round 10

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list (hook-plumbing configuration), so the change needs a two-provider verdict under ADR-268 § 4: an agent may change that file but may not ratify its own change.

subject: 6326ab9030e233353bb1d6f41176dd1a0bd17210eb24884d6ca4c4bf9b5d3e9a

(The digest covers `src/config/hook-bundle-budget.json` at commit `50019e01e9`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Rounds 1–9 and the design change since

Prompts `…-r1` to `…-r9-20261120.question.md` beside this one. Every round accepted the budget arithmetic. Rounds 5–9 each found a new race in one place: hooks of many sessions concurrently rewriting the shared overview files `sessions.json` / `SESSIONS.md` (regression by a delayed publisher, wedge after prune, malformed-index handling, tombstone interaction). Round 9's remaining findings were both there.

**The owner decided to remove that part instead of patching it a sixth time** (commit `50019e01e9`): the hook now ONLY maintains the per-session versioned records. The overview files are written exclusively by the user-invoked `agent-config sessions:catalog`, which rebuilds both from the records (and prunes expired records) on every call and prints the result. The throttle, re-scan loop, deadline, regression guard and published-index comparison are deleted. External readers (agent-switch) call the CLI. A hook-level test asserts the hook leaves no overview file behind.

Round 9's other point — the end-of-session read could repeat per CAS attempt — is bounded: ingest is incremental from the record's cursor, so a retry re-reads only bytes the winner had not consumed; with the overview gone, a hook does no directory-wide work at all.

What remains in the hook, unchanged from rounds 6–9 and not disputed there: lock-free versioned records (exclusive `link` of a fully written `0600` temp; superseded versions become empty tombstones aged out after 30 minutes; new versions allocated above every name in use), lifecycle changes only from an event not older than the record, open-then-verify transcript reads (`O_NOFOLLOW | O_NONBLOCK`, regular file, realpath'd twice, inside the profile root, named for the session, same inode as the descriptor, cursor bound to inode/device), non-blocking size-capped git metadata reads with a `.git` pointer followed only into a real `<common>/worktrees/<name>` entry that points back, shape-normalised records with a rebuilt resume line, owner-only files, no network. Titles stay by owner decision.

Measured with 301 retained sessions and a 5 MB transcript: a hook's first ingest at `session_start` about 92 ms, a later `stop` about 10 ms; the CLI rebuild about 26 ms.

## The budget file change now

- New chunk row `src/scripts/_lib/session_catalog.ts`, `max_bytes: 46800` (measured 42,579 B, +10 %).
- Dispatch ceiling 1,595,100 → 1,595,500 (measured 1,595,393 B against 1,595,089 B on `origin/main` 2eef08c00b: +304 B, the call site only).

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 5b405df712..e4a746f4ea 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -4,7 +4,7 @@
     "registered_at": "2026-10-01",
     "owner": "maintainer",
     "review_by": "2027-10-01",
-    "max_bytes": 1595100,
+    "max_bytes": 1595500,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
     "shrink_only": true,
     "shrink_only_note": "A RAISE needs a recorded reason in `raise_log` below naming what was added and why it could not be avoided. Enforced since road-to-a-ratification-fence-that-follows-its-imports 3.2: the gate reads `max_bytes` at the base revision, and a working value above it fails unless `raise_log` gained an entry whose `to` equals the new value. A lowering needs no entry. This file is also on the ratification gate's watched set, so a raise carries a record as well as a log entry.",
@@ -268,6 +268,15 @@
             "what_was_added": "The inline terminal-pane region strip in `_lib/prompt_shape.ts` (`TERMINAL_PANE_REGION` and its one `replace` call in `stripInjectedRegions`), which keeps the app-written `<bash-input>`/`<bash-stdout>`/`<bash-stderr>` echo out of the language score. Measured 1,595,013 B with the change against 1,594,895 B on origin/main 417e7b56df (both readings by this gate through the CI mirror): +118 B.",
             "why_it_could_not_be_avoided": "The base sat 5 B under the 1,594,900 ceiling, so any byte added to the language-mirror path crossed it. The addition is one regex literal and one call; no smaller form keeps the three tag names closed-region-only. The ceiling moves by 200 B, the delta rounded up, with no growth queued.",
             "what_would_have_caught_it": "Nothing missed it: the gate fired on the first mirror run of the change, as it is meant to."
+        },
+        {
+            "date": "2026-11-20",
+            "from": 1595100,
+            "to": 1595500,
+            "by": "agent, feat/global-session-catalog",
+            "what_was_added": "The `session-register` call into the new `session_catalog` lazy chunk: one `loadChunkExport` call with its four arguments, the end-of-session flag and the claimed-slug read, invoked after the register's own work on each lifecycle slot. Measured 1,595,393 B with the change against 1,595,089 B on origin/main 2eef08c00b (both readings by this gate with APFS-cloned node_modules): +304 B.",
+            "why_it_could_not_be_avoided": "The base sat 11 B under the ceiling, so any call site crossed it. The catalog body itself (42,579 B) already lives in its own chunk with its own ceiling, the envelope parsing was moved into that chunk, and the `sessions:catalog` CLI was split out of `sessions_cli.ts` because that module is in the dispatch graph; what remains is the call. The ceiling moves by the delta rounded up to the next 100 B, with no growth queued.",
+            "what_would_have_caught_it": "Nothing missed it: the gate fired on the first local run of the change."
         }
     ],
     "chunks": [
@@ -373,6 +382,12 @@
             "registered_at": "2026-11-04",
             "derivation": "Measured 55,991 bytes on 2026-11-04 for the roadmap agents/roadmaps/archive/road-to-a-noted-that-is-a-write.md. The chunk holds the self-repair concern, its four detectors including persistence-claim, the record store with the target and subject indexes, and the Class-A telemetry shadow (emitDefectShadow: a structural-fields-only copy of a queued record for the org telemetry pack, inert unless that pack activated telemetry); `yaml` is external, resolved from the installed package as for the chat_history, update_notice and star_ask chunks. The ceiling is that reading plus about 10 %, rounded, the same margin as the quota_notice and intake_pass rows. The margin approves no planned code: a later addition to the chunk is measured and reviewed on its own change. WHY IT WAS MOVED: the dispatch bundle sat 14 bytes under its 1,582,000 ceiling at origin/main b53718de2 (measured 1,581,986 B by this gate with APFS-cloned node_modules), and the roadmap's detector work had to land somewhere. The concern built alone was 51,156 bytes before the work; moving it out, as the 2026-10-18 council chose for this situation, took the dispatch bundle to 1,557,293 B (-24,693 B, the rest being modules other concerns still import) instead of raising the dispatch ceiling. Bound on `user_prompt_submit` and `stop`; the bundle carries only its LAZY_CONCERNS row. A missing or mis-digested chunk falls back to spawning the same script, which is slower; tests/hooks/self_repair_lazy_paths.test.ts pins that the loader path and the spawn fallback write the same record, and that the built dispatcher falls back to the spawn exactly once with the chunk missing. On either path a failure of the concern does not reject the hook event (`fail_closed: false`, unchanged by this move); the dispatcher still writes that run's exit code to agents/runtime/state/.dispatcher/<session>/self-repair.json, which is where a failing concern is visible."
         },
+        {
+            "entry": "src/scripts/_lib/session_catalog.ts",
+            "max_bytes": 46800,
+            "registered_at": "2026-11-20",
+            "derivation": "Measured 42,579 bytes on 2026-11-20 (the machine-wide session catalog: envelope reading, transcript binding to the session and profile with a descriptor identity check, lock-free versioned records with exclusive-create compare-and-swap, tombstoned superseded versions, open-then-verify transcript reads, non-blocking git metadata reads bounded to real worktree pointers, Markdown escaping, title masking, per-session record update, incremental transcript ingest, index building and Markdown rendering (the overview files are written by the CLI only, never by the hook), plus the register and agent-switch profile helpers it imports). The ceiling is that reading plus about 10 %, rounded, the margin of the quota_notice and self_repair rows, with no growth queued. WHY IT IS A CHUNK: inlined, it took the dispatch bundle about 13 KB over its 1,595,100 B ceiling (measured with APFS-cloned node_modules against 1,595,089 B on origin/main 2eef08c00b); the 2026-10-18 council doctrine moves new hook work into a chunk instead of raising that ceiling. Loaded by `session-register` on its four lifecycle slots through `hooks/lazy_load.ts`; a missing or mis-digested chunk costs the catalog entry, never the register."
+        },
         {
             "entry": "src/scripts/_lib/reference_duty.ts",
             "max_bytes": 22000,
```

## Hook integration diff

```diff
diff --git a/src/scripts/session_register_hook.ts b/src/scripts/session_register_hook.ts
index c68b4f4c11..374f172573 100644
--- a/src/scripts/session_register_hook.ts
+++ b/src/scripts/session_register_hook.ts
@@ -70,6 +70,8 @@ import {
     ttl_seconds_for,
     write_record,
 } from './_lib/session_register.js';
+import type { catalog_hook_event } from './_lib/session_catalog.js';
+import { loadChunkExport } from './hooks/lazy_load.js';
 import { pr_watch_block } from './_lib/session_pr_watch.js';
 import { pruneAgedRefusalState, readSessionCounts } from './_lib/turn_end_refusals.js';
 import { readHookStdin } from './hooks/hook_stdin.js';
@@ -856,7 +858,19 @@ export function main(): number {
             return 0;
         }
 
-        if (event === 'session_end' || (event === 'stop' && stop_means_session_end(platform))) {
+        const ends = event === 'session_end' || (event === 'stop' && stop_means_session_end(platform));
+        // The machine-wide catalog keeps what the register forgets on session end.
+        // A lazy chunk: a missing one costs the catalog entry, never the register.
+        // At the end the claim file is already gone; the record keeps its slug.
+        const catalog = (): void =>
+            loadChunkExport<typeof catalog_hook_event>(
+                'session_catalog.chunk.cjs',
+                './_lib/session_catalog',
+                'catalog_hook_event',
+                import.meta.url,
+            )?.(envelope, root, ends, ends ? undefined : read_claimed_slug(root, session_id));
+
+        if (ends) {
             const dir = register_dir(root);
             if (dir !== null) delete_record(dir, session_id);
             // 1.4 — the global mirror dies with the session on the same beat.
@@ -891,11 +905,15 @@ export function main(): number {
                     /* absent or unwritable — a leftover claim expires with its record */
                 }
             }
+            // After the register's own clean-up, so a slow catalog write can never
+            // leave the live record or the claim behind.
+            catalog();
             return 0;
         }
 
         if (event === 'session_start' || event === 'user_prompt_submit' || event === 'stop') {
             touch(root, session_id, platform, new Date());
+            catalog();
             if (event === 'session_start') {
                 // One warning per session, at registration — not per beat.
                 if (!ttl_is_measured(platform)) {
```

## Feature source — `src/scripts/_lib/session_catalog.ts`

```ts
/**
 * Machine-wide session catalog — every agent session started on this machine,
 * newest activity first, with what is needed to find it again and resume it.
 *
 * Why a second store beside the session register:
 *
 * `_lib/session_register.ts` answers "who is live right now" and is built to
 * forget: a record is deleted on `session_end` and pruned after its TTL, which
 * is exactly right for a collision check and exactly wrong for "which session
 * did I start yesterday in repo X, under which profile, and how do I resume
 * it". The catalog keeps the history the register throws away, and enriches it
 * with what only the host transcript knows (model, token usage, context size,
 * the host's own session title).
 *
 * Layout — lock-free, by construction rather than by a lock protocol:
 *
 * - `runtime/session-catalog/<host>--<id>.v<N>.json` — versioned records. A
 *   writer reads the newest version N and creates N+1 with an exclusive
 *   `link` of a fully written temp file, so for every version exactly one
 *   writer wins and no reader sees a partial file. A loser re-reads and
 *   retries from the winner's state, which is what keeps two overlapping hook
 *   processes of one session from double-counting the transcript. No lock
 *   means no stale-lock recovery, the step every lock protocol got wrong.
 * - `sessions.json` / `SESSIONS.md` — the overview, written only by the CLI
 *   (`agent-config sessions:catalog`), never by a hook. Many sessions' hooks
 *   writing one shared derived file is a concurrency problem with no cheap
 *   complete answer; a user-invoked command rebuilding it from the records
 *   has none.
 *
 * Status is derived, never trusted from disk:
 *
 * The index stores raw timestamps and a status computed at `generated_at`.
 * A reader that cares about freshness recomputes it with `derive_status` — a
 * saved `active` outlives its threshold the moment nobody writes.
 *
 * Privacy:
 *
 * No prompt text is stored. The title is the host's own generated title (or a
 * user-set one), the remote URL has its userinfo stripped, and the resume env
 * carries only the profile directory variables (`CLAUDE_CONFIG_DIR`,
 * `CODEX_HOME`). Files are created owner-only (0600 / 0700).
 *
 * Failure is always open:
 *
 * Every exported function swallows its errors. A session that cannot write the
 * catalog still starts and works; it is merely missing from the list.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { write_atomic } from './fs_atomic.js';
import { type SessionProfile, iso_now, safe_stem, session_profile, ttl_seconds_for } from './session_register.js';
import { DEFAULT_EVENT4U_ROOT_RELATIVE, type EnvMap } from './user_global_paths.js';

export const CATALOG_SCHEMA_VERSION = 1;

/** A session heard from within this window is `active`. */
export const ACTIVE_WINDOW_SECONDS = 15 * 60;

/** Records whose last activity is older than this are pruned at publish time. */
export const RETENTION_DAYS = 30;

/** Upper bound on transcript bytes read per hook call (normal heartbeat). */
export const INGEST_CAP_BYTES = 8 * 1024 * 1024;

/** Chunk size of the final catch-up read at `session_end`. */
export const INGEST_CAP_BYTES_FINAL = 16 * 1024 * 1024;

/** Chunks the final read may take: 64 MB in all, the most a session end waits for. */
const FINAL_INGEST_CHUNKS = 4;

/** Message ids remembered for usage de-duplication. */
const RECENT_ID_WINDOW = 256;

/** Tools whose file argument means the session changed that checkout (reads do not count). */
const WRITE_TOOLS: ReadonlySet<string> = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

const MAX_REPOS = 50;
const MAX_BRANCHES_PER_REPO = 20;
const MAX_MODELS = 10;

/** How long a superseded version's name stays occupied — longer than any host's hook timeout. */
const TOMBSTONE_TTL_MS = 30 * 60_000;

/** Compare-and-swap attempts per update; an end event tries harder. */
const CAS_ATTEMPTS = 5;
const CAS_ATTEMPTS_END = 25;

export type CatalogStatus = 'active' | 'idle' | 'stale' | 'ended';

export interface CatalogRepo {
    /** Absolute checkout root (a linked worktree is its own entry). */
    root: string;
    /** Project name — from the origin URL, else the checkout's basename. */
    name: string;
    /** `origin` URL with any userinfo removed, or null. */
    remote: string | null;
    /** True for a linked worktree (its `.git` is a pointer file). */
    linked_worktree: boolean;
    /** Every branch seen for this checkout, oldest first. */
    branches: string[];
    last_branch: string | null;
    first_seen: string;
    last_seen: string;
}

export interface CatalogUsage {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
    /** Sum of the four counters above. */
    total_tokens: number;
    /** De-duplicated assistant messages that carried usage. */
    assistant_messages: number;
}

export interface CatalogResume {
    /** Directory the resume command must run in (the host keys history by it). */
    cwd: string | null;
    /** Executable and arguments, unquoted — what a program should spawn. */
    argv: string[];
    /** `argv` rendered for a shell, every argument quoted where needed. */
    command: string;
    /** Only profile-directory variables; never anything else from the env. */
    env: Record<string, string>;
}

/** Internal transcript-ingest cursor. Stripped from the published index. */
export interface CatalogIngest {
    offset: number;
    recent_ids: string[];
    /** Identity of the file the offset belongs to. */
    ino?: number;
    dev?: number;
}

export interface CatalogEntry {
    schema_version: number;
    session_id: string;
    /** Agent host (claude, codex, augment, cursor, …). */
    host: string;
    /** Model vendor (anthropic, openai, google, …) or the profile provider. */
    provider: string | null;
    /** cli · desktop · ide · sdk · cloud · unknown. */
    surface: string;
    /** Raw host entrypoint string when the host reports one. */
    entrypoint: string | null;
    host_version: string | null;
    profile: SessionProfile | null;
    /** Host config dir the session runs under (`CLAUDE_CONFIG_DIR` / `CODEX_HOME`). */
    config_dir: string | null;
    /** Last model seen. */
    model: string | null;
    models: string[];
    /** Directory the session was started in. Never overwritten. */
    start_cwd: string | null;
    /** Most recent working directory. */
    cwd: string | null;
    started_at: string;
    last_seen: string;
    ended_at: string | null;
    title: string | null;
    roadmap_slug: string | null;
    repos: CatalogRepo[];
    usage: CatalogUsage | null;
    /** Tokens in the prompt of the latest assistant message — the live context size. */
    context_tokens: number | null;
    transcript_path: string | null;
    resume: CatalogResume | null;
    _ingest?: CatalogIngest;
    /** Internal: set when the title was chosen by the user. Stripped on publish. */
    _title_source?: 'custom';
}

/** One row of the published index: the entry plus its derived status. */
export type PublishedEntry = Omit<CatalogEntry, '_ingest' | '_title_source'> & {
    status: CatalogStatus;
    idle_seconds: number;
    /** Version of the record this row was built from; a publisher never replaces a higher one. */
    record_version: number;
};

export interface CatalogIndex {
    schema_version: number;
    generated_at: string;
    catalog_dir: string;
    active_window_seconds: number;
    retention_days: number;
    counts: Record<CatalogStatus | 'total', number>;
    sessions: PublishedEntry[];
}

export interface CatalogEvent {
    session_id: string;
    platform: string;
    event: string;
    /** Envelope surface (ide/cli/cloud/unknown). */
    surface?: string | null;
    /** The session's checkout root as resolved by the register. */
    checkout?: string | null;
    /** Raw `payload.cwd`. */
    cwd?: string | null;
    transcript_path?: string | null;
    model?: string | null;
    roadmap_slug?: string | null;
    profile?: SessionProfile | null;
    now?: Date;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** Override for the catalog root; tests and unusual layouts only. */
export const CATALOG_HOME_ENV = 'AGENT_CONFIG_SESSION_CATALOG_HOME';

/**
 * The catalog root deliberately ignores `EVENT4U_CONFIG_HOME`: agent-switch
 * sets that per profile, and a per-profile catalog would defeat the one list
 * across every profile this exists to provide.
 */
export function catalog_root(env?: EnvMap | null): string {
    const override = (env ?? process.env)[CATALOG_HOME_ENV];
    if (typeof override === 'string' && override.trim() !== '') return path.resolve(override.trim());
    return path.join(os.homedir(), DEFAULT_EVENT4U_ROOT_RELATIVE);
}

export function catalog_dir(env?: EnvMap | null): string {
    return path.join(catalog_root(env), 'runtime', 'session-catalog');
}

export function index_json_path(env?: EnvMap | null): string {
    return path.join(catalog_root(env), 'sessions.json');
}

export function index_md_path(env?: EnvMap | null): string {
    return path.join(catalog_root(env), 'SESSIONS.md');
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const VENDOR_BY_HOST: Readonly<Record<string, string>> = Object.freeze({
    claude: 'anthropic',
    codex: 'openai',
    gemini: 'google',
    augment: 'augment',
    cursor: 'cursor',
    windsurf: 'windsurf',
    cline: 'cline',
    copilot: 'github',
});

/** Vendor for a host, preferring an explicit profile provider mapping. */
export function provider_for(host: string, profile: SessionProfile | null): string | null {
    const key = (profile?.provider ?? host).trim().toLowerCase();
    return VENDOR_BY_HOST[key] ?? VENDOR_BY_HOST[host.trim().toLowerCase()] ?? null;
}

/** Map a host entrypoint (Claude Code `entrypoint`) to the surface vocabulary. */
export function surface_from_entrypoint(entrypoint: string | null, fallback: string | null): string {
    const e = (entrypoint ?? '').trim().toLowerCase();
    if (e === 'cli') return 'cli';
    if (e.includes('desktop')) return 'desktop';
    if (e.includes('vscode') || e.includes('jetbrains') || e.includes('ide')) return 'ide';
    if (e.startsWith('sdk')) return 'sdk';
    if (e.includes('remote') || e.includes('web') || e.includes('cloud')) return 'cloud';
    const f = (fallback ?? '').trim().toLowerCase();
    return f === '' ? 'unknown' : f;
}

/** Remove `user[:pass]@`, the query and the fragment from a URL-shaped remote. */
export function strip_userinfo(url: string): string {
    return url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@\s]*@/i, '$1').replace(/[?#].*$/, '');
}

const TITLE_MAX = 120;

/**
 * Titles are host-generated summaries of the conversation, so they are capped
 * and any token-shaped run (long mixed alphanumerics, known key prefixes) is
 * masked before it is persisted.
 */
export function clean_title(t: string): string {
    const masked = t
        .replace(/\b(?:sk|pk|rk|ghp|gho|ghs|ghu|github_pat|xox[abprs]|AKIA|AIza|glpat)[-_A-Za-z0-9]{6,}/g, '[redacted]')
        .replace(/[A-Za-z0-9+/_=-]{20,}/g, (m) => (/[0-9]/.test(m) && /[A-Za-z]/.test(m) ? '[redacted]' : m))
        .replace(/\s+/g, ' ')
        .trim();
    return masked.length > TITLE_MAX ? `${masked.slice(0, TITLE_MAX - 1)}…` : masked;
}

/**
 * Read a small metadata file without ever blocking: non-blocking open, the
 * descriptor must be a regular file, and the size is capped. Paths here come
 * from transcript-supplied directories, so a FIFO or a device must not stall
 * the hook.
 */
function read_small(file: string, max = 64 * 1024): string | null {
    let fd: number | null = null;
    try {
        fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK ?? 0) | (fs.constants.O_NOFOLLOW ?? 0));
        const st = fs.fstatSync(fd);
        if (!st.isFile() || st.size > max) return null;
        const buf = Buffer.alloc(st.size);
        const n = fs.readSync(fd, buf, 0, st.size, 0);
        return buf.subarray(0, n).toString('utf-8');
    } catch {
        return null;
    } finally {
        if (fd !== null) fs.closeSync(fd);
    }
}

/**
 * The checkout's git dir and common dir, following a `.git` pointer file only
 * into the shape git itself creates for a linked worktree,
 * `<common>/worktrees/<name>`, and only when that worktree entry points back
 * at this checkout. Any other pointer is not followed, so a checkout cannot
 * steer metadata reads to arbitrary files.
 */
function safe_git_dirs(root: string): { git_dir: string; common_dir: string } | null {
    const dot = path.join(root, '.git');
    try {
        const st = fs.lstatSync(dot);
        if (st.isDirectory()) return { git_dir: dot, common_dir: dot };
        if (!st.isFile()) return null;
        const m = (read_small(dot) ?? '').match(/^gitdir:\s*(.+)\s*$/m);
        if (m === null) return null;
        const gd = fs.realpathSync(path.resolve(root, m[1]!.trim()));
        if (path.basename(path.dirname(gd)) !== 'worktrees') return null;
        const back = read_small(path.join(gd, 'gitdir'));
        if (back === null || fs.realpathSync(path.dirname(back.trim())) !== fs.realpathSync(root)) return null;
        // The common dir must itself be a git directory, not any folder that
        // happens to contain a `worktrees/` child.
        const common = path.dirname(path.dirname(gd));
        if (read_small(path.join(common, 'HEAD')) === null || !fs.lstatSync(path.join(common, 'objects')).isDirectory()) return null;
        return { git_dir: gd, common_dir: common };
    } catch {
        return null;
    }
}

function safe_common_dir(root: string): string | null {
    return safe_git_dirs(root)?.common_dir ?? null;
}

function safe_branch(root: string): string | null {
    const gd = safe_git_dirs(root)?.git_dir ?? null;
    const head = gd === null ? null : read_small(path.join(gd, 'HEAD'));
    const m = (head ?? '').trim().match(/^ref:\s*refs\/heads\/(.+)$/);
    return m === null ? null : m[1]!.trim();
}

function origin_url(common_dir: string): string | null {
    try {
        const raw = read_small(path.join(common_dir, 'config'));
        if (raw === null) return null;
        const m = raw.match(/\[remote "origin"\][^[]*?\n\s*url\s*=\s*(\S+)/);
        return m === null ? null : strip_userinfo(m[1]!.trim());
    } catch {
        return null;
    }
}

function project_name(remote: string | null, root: string): string {
    if (remote !== null) {
        const tail = remote.replace(/\/+$/, '').split(/[/:]/).pop() ?? '';
        const name = tail.replace(/\.git$/, '');
        if (name !== '') return name;
    }
    return path.basename(root);
}

/** Nearest existing directory at or above `p`. */
function existing_dir(p: string): string | null {
    let dir = p;
    for (let i = 0; i < 128; i++) {
        try {
            if (fs.statSync(dir).isDirectory()) return dir;
        } catch {
            /* keep walking */
        }
        const up = path.dirname(dir);
        if (up === dir) return null;
        dir = up;
    }
    return null;
}

/** Nearest enclosing checkout root (a `.git` dir or file), memoised per call. */
function checkout_root(p: string, cache: Map<string, string | null>): string | null {
    const start = existing_dir(p);
    if (start === null) return null;
    if (cache.has(start)) return cache.get(start) ?? null;
    let dir = start;
    let found: string | null = null;
    for (let i = 0; i < 128; i++) {
        if (fs.existsSync(path.join(dir, '.git'))) {
            found = dir;
            break;
        }
        const up = path.dirname(dir);
        if (up === dir) break;
        dir = up;
    }
    cache.set(start, found);
    return found;
}

function is_linked(root: string): boolean {
    try {
        return !fs.statSync(path.join(root, '.git')).isDirectory();
    } catch {
        return false;
    }
}

function ms(stamp: string | null | undefined): number | null {
    if (typeof stamp !== 'string' || stamp === '') return null;
    const v = Date.parse(stamp);
    return Number.isFinite(v) ? v : null;
}

function iso_from(v: unknown): string | null {
    const t = typeof v === 'string' ? Date.parse(v) : NaN;
    return Number.isFinite(t) ? iso_now(new Date(t)) : null;
}

function str(v: unknown): string | null {
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function num(v: unknown): number {
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

/** Derived status of an entry at `now`. */
export function derive_status(entry: Pick<CatalogEntry, 'ended_at' | 'last_seen' | 'host'>, now: Date = new Date()): CatalogStatus {
    if (entry.ended_at !== null && entry.ended_at !== undefined) return 'ended';
    const seen = ms(entry.last_seen);
    if (seen === null) return 'stale';
    const age_s = (now.getTime() - seen) / 1000;
    if (age_s <= ACTIVE_WINDOW_SECONDS) return 'active';
    if (age_s <= ttl_seconds_for(entry.host)) return 'idle';
    return 'stale';
}

// ---------------------------------------------------------------------------
// Versioned record store
// ---------------------------------------------------------------------------

/** Records are keyed by host and id: two hosts may use the same id space. */
export function record_stem(host: string, session_id: string): string {
    return safe_stem(`${host.trim().toLowerCase()}--${session_id}`);
}

const VERSION_FILE_RE = /^(.+)\.v(\d{1,15})\.json$/;

function ensure_private_dir(dir: string): void {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

/** Atomic replace; the temp file is created 0600, so the target never exists wider. */
function write_private(file: string, data: string): void {
    write_atomic(file, data);
}

/**
 * Create `file` with `data` only if it does not exist yet. The content is
 * written to a 0600 temp first and published with `link`, which refuses an
 * existing target — so creation is exclusive and never visible half-written.
 */
function create_exclusive(file: string, data: string): boolean {
    const tmp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
    try {
        fs.writeFileSync(tmp, data, { flag: 'wx', mode: 0o600 });
        fs.linkSync(tmp, file);
        return true;
    } catch {
        return false;
    } finally {
        fs.rmSync(tmp, { force: true });
    }
}

const STRING_FIELDS = ['host', 'surface', 'started_at'] as const;

/** Shape-check a parsed record and fill what an older or damaged writer left out. */
function normalize_entry(v: unknown): CatalogEntry | null {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    if (typeof o['session_id'] !== 'string' || typeof o['last_seen'] !== 'string') return null;
    if (ms(o['last_seen'] as string) === null) return null;
    for (const k of STRING_FIELDS) if (typeof o[k] !== 'string') o[k] = k === 'started_at' ? o['last_seen'] : 'unknown';
    for (const k of ['models', 'repos'] as const) if (!Array.isArray(o[k])) o[k] = [];
    o['repos'] = (o['repos'] as unknown[]).filter(
        (r) => typeof r === 'object' && r !== null && typeof (r as CatalogRepo).root === 'string' && Array.isArray((r as CatalogRepo).branches),
    );
    o['models'] = (o['models'] as unknown[]).filter((m) => typeof m === 'string');
    for (const k of ['provider', 'entrypoint', 'host_version', 'config_dir', 'model', 'start_cwd', 'cwd', 'ended_at', 'title', 'roadmap_slug', 'transcript_path'] as const) {
        if (typeof o[k] !== 'string') o[k] = null;
    }
    const prof = o['profile'] as Record<string, unknown> | null;
    o['profile'] =
        prof !== null && typeof prof === 'object' && typeof prof['provider'] === 'string' && typeof prof['name'] === 'string'
            ? { provider: prof['provider'], name: prof['name'], via: prof['via'] === 'env' ? 'env' : 'agent-switch' }
            : null;
    const u = o['usage'] as Record<string, unknown> | null;
    const keys = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens', 'total_tokens', 'assistant_messages'];
    o['usage'] =
        u !== null && typeof u === 'object' && keys.every((k) => Number.isSafeInteger(u[k]) && (u[k] as number) >= 0)
            ? Object.fromEntries(keys.map((k) => [k, u[k]]))
            : null;
    if (!Number.isSafeInteger(o['context_tokens'])) o['context_tokens'] = null;
    for (const r of o['repos'] as Record<string, unknown>[]) {
        r['branches'] = (r['branches'] as unknown[]).filter((b) => typeof b === 'string');
        for (const k of ['name', 'first_seen', 'last_seen'] as const) if (typeof r[k] !== 'string') r[k] = '';
        for (const k of ['remote', 'last_branch'] as const) if (typeof r[k] !== 'string') r[k] = null;
        r['linked_worktree'] = r['linked_worktree'] === true;
    }
    const entry = o as unknown as CatalogEntry;
    // Never trusted from disk: the resume line is derived from validated fields.
    entry.resume = build_resume(entry);
    return entry;
}

interface StoredRecord {
    stem: string;
    version: number;
    file: string;
    entry: CatalogEntry;
}

/** Version files per stem, newest first. */
function list_versions(dir: string): Map<string, { version: number; file: string }[]> {
    const out = new Map<string, { version: number; file: string }[]>();
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return out;
    }
    for (const n of names) {
        const m = VERSION_FILE_RE.exec(n);
        if (m === null) continue;
        const list = out.get(m[1]!) ?? [];
        list.push({ version: Number(m[2]), file: path.join(dir, n) });
        out.set(m[1]!, list);
    }
    for (const list of out.values()) list.sort((a, b) => b.version - a.version);
    return out;
}

/** The newest readable version of one record (a version being cleaned up is skipped). */
function read_latest(dir: string, stem: string, versions?: { version: number; file: string }[]): StoredRecord | null {
    // A listing taken before a newer version superseded ours can name only
    // tombstones by the time we read; one fresh listing resolves that.
    for (let pass = 0; pass < 2; pass++) {
        const list = pass === 0 && versions !== undefined ? versions : (list_versions(dir).get(stem) ?? []);
        for (const v of list) {
            try {
                const entry = normalize_entry(JSON.parse(fs.readFileSync(v.file, 'utf-8')));
                if (entry !== null) return { stem, version: v.version, file: v.file, entry };
            } catch {
                /* a tombstone or a removed file: try the next older version */
            }
        }
    }
    return null;
}

/**
 * Superseded versions become empty tombstones instead of disappearing, so a
 * stalled writer that read an old version can never `link` into a freed name
 * and win a version readers no longer look at. A tombstone is removed only
 * once it is older than any hook can run (TOMBSTONE_TTL_MS, above the hosts'
 * hook timeouts), when no writer from that era can still be alive.
 */
function remove_older(dir: string, stem: string, below: number): void {
    const now = Date.now();
    for (const v of list_versions(dir).get(stem) ?? []) {
        if (v.version >= below) continue;
        try {
            const st = fs.statSync(v.file);
            if (st.size === 0) {
                if (now - st.mtimeMs > TOMBSTONE_TTL_MS) fs.rmSync(v.file, { force: true });
                continue;
            }
            write_private(v.file, '');
        } catch {
            /* already handled by a peer */
        }
    }
}

export function read_entry(dir: string, session_id: string, host = 'claude'): CatalogEntry | null {
    return read_latest(dir, record_stem(host, session_id))?.entry ?? null;
}

function read_all_records(dir: string): StoredRecord[] {
    const out: StoredRecord[] = [];
    for (const [stem, versions] of list_versions(dir)) {
        const rec = read_latest(dir, stem, versions);
        if (rec !== null) out.push(rec);
    }
    return out;
}

export function read_all_entries(dir: string): CatalogEntry[] {
    return read_all_records(dir).map((r) => r.entry);
}

function fresh_entry(ev: CatalogEvent, now_iso: string): CatalogEntry {
    return {
        schema_version: CATALOG_SCHEMA_VERSION,
        session_id: ev.session_id,
        host: ev.platform,
        provider: null,
        surface: 'unknown',
        entrypoint: null,
        host_version: null,
        profile: null,
        config_dir: null,
        model: null,
        models: [],
        start_cwd: null,
        cwd: null,
        started_at: now_iso,
        last_seen: now_iso,
        ended_at: null,
        title: null,
        roadmap_slug: null,
        repos: [],
        usage: null,
        context_tokens: null,
        transcript_path: null,
        resume: null,
    };
}

/**
 * Branch is read from the checkout's HEAD at observation time. A host's own
 * per-line branch field is not used: measured on Claude Code, it keeps the
 * branch of the start directory after the session moves into a worktree.
 */
function note_repo(entry: CatalogEntry, p: string, seen_iso: string, cache: Map<string, string | null>): void {
    const now_iso = seen_iso;
    const root = checkout_root(p, cache);
    if (root === null) return;
    let repo = entry.repos.find((r) => r.root === root);
    if (repo === undefined) {
        if (entry.repos.length >= MAX_REPOS) return;
        const common = safe_common_dir(root);
        const remote = common === null ? null : origin_url(common);
        repo = {
            root,
            name: project_name(remote, root),
            remote,
            linked_worktree: is_linked(root),
            branches: [],
            last_branch: null,
            first_seen: now_iso,
            last_seen: now_iso,
        };
        entry.repos.push(repo);
    }
    const branch = safe_branch(root);
    if (branch !== null) {
        if (!repo.branches.includes(branch)) {
            repo.branches.push(branch);
            if (repo.branches.length > MAX_BRANCHES_PER_REPO) repo.branches.shift();
        }
        repo.last_branch = branch;
    }
    if ((ms(now_iso) ?? 0) >= (ms(repo.last_seen) ?? 0)) repo.last_seen = now_iso;
}

function note_model(entry: CatalogEntry, model: string | null): void {
    if (model === null || model.startsWith('<')) return;
    entry.model = model;
    if (!entry.models.includes(model)) {
        entry.models.push(model);
        if (entry.models.length > MAX_MODELS) entry.models.shift();
    }
}

function empty_usage(): CatalogUsage {
    return {
        input_tokens: 0,
        output_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        total_tokens: 0,
        assistant_messages: 0,
    };
}

/**
 * Read the transcript tail appended since the last call and fold it into the
 * entry. Only complete lines are consumed; a partial last line waits for the
 * next call. Usage is de-duplicated by `message.id` because a host may write
 * one line per content block, each repeating the same usage object.
 *
 * A read failure before parsing leaves the cursor where it was, so a later
 * call retries the same bytes; the per-line loop itself does not throw.
 */
export function ingest_transcript(
    entry: CatalogEntry,
    opened: OpenedTranscript,
    cap_bytes: number,
    now_iso: string,
    cache: Map<string, string | null>,
): void {
    const fd = opened.fd;
    try {
        const size = opened.size;
        let cur: CatalogIngest = entry._ingest ?? { offset: 0, recent_ids: [] };
        if (cur.ino !== undefined && (cur.ino !== opened.ino || cur.dev !== opened.dev)) {
            // Same path, different file: the old totals describe a file that is gone.
            cur = { offset: 0, recent_ids: [] };
            entry.usage = null;
        }
        cur.ino = opened.ino;
        cur.dev = opened.dev;
        if (size < cur.offset) {
            // Truncated or replaced: the old totals describe a file that no longer exists.
            cur.offset = 0;
            cur.recent_ids = [];
            entry.usage = null;
        }
        if (size === cur.offset) {
            entry._ingest = cur;
            return;
        }
        const len = Math.min(size - cur.offset, cap_bytes);
        const buf = Buffer.alloc(len);
        const read = fs.readSync(fd, buf, 0, len, cur.offset);
        const last_nl = buf.lastIndexOf(0x0a, read - 1);
        if (last_nl < 0) {
            // One line longer than the cap cannot be parsed in pieces; skip it
            // rather than stall the cursor forever.
            if (read === cap_bytes) cur.offset += read;
            entry._ingest = cur;
            return;
        }
        const text = buf.subarray(0, last_nl + 1).toString('utf-8');
        // The transcript's first working directory is where the host keys the
        // session's history, so it is the start path a resume must use — the
        // hook's cwd may already be a worktree the session moved into.
        let first_cwd_pending = cur.offset === 0;
        cur.offset += last_nl + 1;
        const seen = new Set(cur.recent_ids);
        const usage = entry.usage ?? empty_usage();
        let custom_title: string | null = null;
        let ai_title: string | null = null;
        for (const line of text.split('\n')) {
            if (line === '' || line[0] !== '{') continue;
            let o: Record<string, unknown>;
            try {
                o = JSON.parse(line) as Record<string, unknown>;
            } catch {
                continue;
            }
            const type = str(o['type']);
            if (type === 'custom-title') custom_title = str(o['customTitle']) ?? custom_title;
            if (type === 'ai-title') ai_title = str(o['aiTitle']) ?? ai_title;
            if (type === 'summary' && entry.title === null && ai_title === null) {
                ai_title = str(o['summary']);
            }
            const ep = str(o['entrypoint']);
            if (ep !== null) entry.entrypoint = ep;
            const ver = str(o['version']);
            if (ver !== null) entry.host_version = ver;
            const line_seen = iso_from(o['timestamp']) ?? now_iso;
            const line_cwd = str(o['cwd']);
            if (line_cwd !== null) {
                entry.cwd = line_cwd;
                if (first_cwd_pending || entry.start_cwd === null) entry.start_cwd = line_cwd;
                first_cwd_pending = false;
                note_repo(entry, line_cwd, line_seen, cache);
            }
            if (type !== 'assistant') continue;
            const msg = o['message'];
            if (typeof msg !== 'object' || msg === null) continue;
            const m = msg as Record<string, unknown>;
            note_model(entry, str(m['model']));
            const content = m['content'];
            if (Array.isArray(content)) {
                for (const block of content) {
                    if (typeof block !== 'object' || block === null) continue;
                    const b = block as Record<string, unknown>;
                    if (b['type'] !== 'tool_use' || !WRITE_TOOLS.has(String(b['name']))) continue;
                    const input = b['input'];
                    if (typeof input !== 'object' || input === null) continue;
                    const inp = input as Record<string, unknown>;
                    for (const key of ['file_path', 'notebook_path']) {
                        const fp = str(inp[key]);
                        if (fp === null) continue;
                        const abs = path.isAbsolute(fp) ? fp : line_cwd !== null ? path.resolve(line_cwd, fp) : null;
                        if (abs !== null) note_repo(entry, abs, line_seen, cache);
                    }
                }
            }
            const u = m['usage'];
            if (typeof u !== 'object' || u === null) continue;
            const id = str(m['id']);
            if (id !== null) {
                if (seen.has(id)) continue;
                seen.add(id);
                cur.recent_ids.push(id);
            }
            const us = u as Record<string, unknown>;
            const input_t = num(us['input_tokens']);
            const output_t = num(us['output_tokens']);
            const cache_r = num(us['cache_read_input_tokens']);
            const cache_c = num(us['cache_creation_input_tokens']);
            usage.input_tokens += input_t;
            usage.output_tokens += output_t;
            usage.cache_read_input_tokens += cache_r;
            usage.cache_creation_input_tokens += cache_c;
            usage.total_tokens += input_t + output_t + cache_r + cache_c;
            usage.assistant_messages += 1;
            if (o['isSidechain'] !== true) entry.context_tokens = input_t + cache_r + cache_c;
        }
        if (cur.recent_ids.length > RECENT_ID_WINDOW) {
            cur.recent_ids = cur.recent_ids.slice(-RECENT_ID_WINDOW);
        }
        if (usage.assistant_messages > 0) entry.usage = usage;
        if (custom_title !== null) entry.title = clean_title(custom_title);
        else if (ai_title !== null && (entry.title === null || entry._title_source !== 'custom')) entry.title = clean_title(ai_title);
        if (custom_title !== null) entry._title_source = 'custom';
        entry._ingest = cur;
    } catch {
        /* unreadable transcript: keep what we had, retry next call */
    }
}

/**
 * The host-supplied transcript path is untrusted input: only a regular
 * `.jsonl` file is read, never a symlink, a device or a directory.
 */
export interface OpenedTranscript {
    fd: number;
    path: string;
    size: number;
    ino: number;
    dev: number;
}

/** The host's profile root, from the env override or the host default; null for hosts not read. */
function profile_root(host: string, config_dir: string | null): string | null {
    const h = host.toLowerCase();
    if (config_dir !== null) return config_dir;
    if (h === 'claude') return path.join(os.homedir(), '.claude');
    if (h === 'codex') return path.join(os.homedir(), '.codex');
    return null;
}

function transcript_name_matches(base: string, session_id: string): boolean {
    return base === `${session_id}.jsonl` || base.endsWith(`-${session_id}.jsonl`);
}

/**
 * Open the host-supplied transcript, then prove what was opened. The open
 * cannot block (`O_NONBLOCK`, so a FIFO is harmless) or follow a final
 * symlink (`O_NOFOLLOW`); the descriptor must be a regular file; and the
 * file currently at the fully resolved path — inside this session's profile
 * root and named for this session — must be that same inode. Binding the
 * check to the descriptor leaves no window between validation and read.
 */
export function open_transcript(p: string | null, session_id: string, root: string | null): OpenedTranscript | null {
    if (p === null || root === null) return null;
    let fd: number | null = null;
    try {
        const abs = path.resolve(p);
        if (path.extname(abs) !== '.jsonl') return null;
        fd = fs.openSync(abs, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
        const st = fs.fstatSync(fd);
        const real = fs.realpathSync(abs);
        const real_root = fs.realpathSync(root);
        const at = fs.lstatSync(real);
        if (
            st.isFile() &&
            real.startsWith(`${real_root}${path.sep}`) &&
            transcript_name_matches(path.basename(real), session_id) &&
            at.ino === st.ino &&
            at.dev === st.dev &&
            // Resolved twice: a directory swapped between the two lookups changes one of them.
            fs.realpathSync(abs) === real
        ) {
            const opened = { fd, path: real, size: st.size, ino: st.ino, dev: st.dev };
            fd = null;
            return opened;
        }
        return null;
    } catch {
        return null;
    } finally {
        if (fd !== null) fs.closeSync(fd);
    }
}

/** Resume instruction for hosts whose CLI can resume by id; null elsewhere. */
export function build_resume(entry: CatalogEntry): CatalogResume | null {
    // The id comes from the host envelope; anything but a plain id gets no
    // resume line rather than a quoted one a user might still mistrust.
    if (!SESSION_ID_RE.test(entry.session_id)) return null;
    const host = entry.host.toLowerCase();
    const env: Record<string, string> = {};
    let argv: string[];
    if (host === 'claude') {
        if (entry.config_dir !== null) env['CLAUDE_CONFIG_DIR'] = entry.config_dir;
        argv = ['claude', '--resume', entry.session_id];
    } else if (host === 'codex') {
        if (entry.config_dir !== null) env['CODEX_HOME'] = entry.config_dir;
        argv = ['codex', 'resume', entry.session_id];
    } else {
        return null;
    }
    return { cwd: entry.start_cwd, argv, command: argv.map(shell_quote).join(' '), env };
}

const SESSION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;

function config_dir_for(host: string, env: NodeJS.ProcessEnv): string | null {
    const key = host === 'codex' ? 'CODEX_HOME' : host === 'claude' ? 'CLAUDE_CONFIG_DIR' : null;
    if (key === null) return null;
    const raw = str(env[key]);
    return raw === null ? null : path.resolve(raw);
}

// ---------------------------------------------------------------------------
// Update — called from the session-register hook
// ---------------------------------------------------------------------------

/** Apply one event to a record (pure apart from git and transcript reads). */
function apply_event(
    entry: CatalogEntry,
    ev: CatalogEvent,
    env: NodeJS.ProcessEnv,
    now_iso: string,
): void {
    const ending = ev.event === 'session_end';
    const at = ms(now_iso) ?? 0;
    const newest = at >= (ms(entry.last_seen) ?? 0);
    entry.schema_version = CATALOG_SCHEMA_VERSION;
    entry.host = ev.platform || entry.host;
    // An event that lost a race retries against newer state. Lifecycle changes
    // apply only from an event not older than everything already recorded, so
    // neither a delayed end closes a newer resume nor a delayed prompt reopens
    // a newer end; a late `stop` never reopens anything.
    if (newest) {
        entry.last_seen = now_iso;
        if (ending) entry.ended_at = now_iso;
        else if (ev.event === 'session_start' || ev.event === 'user_prompt_submit') entry.ended_at = null;
    }
    if (ev.profile !== undefined && ev.profile !== null) entry.profile = ev.profile;
    entry.config_dir = config_dir_for(entry.host, env) ?? entry.config_dir;
    entry.provider = provider_for(entry.host, entry.profile);
    if (ev.roadmap_slug !== undefined) entry.roadmap_slug = ev.roadmap_slug ?? null;
    note_model(entry, str(ev.model));

    const cache = new Map<string, string | null>();
    const cwd = str(ev.cwd) ?? str(ev.checkout);
    if (cwd !== null) {
        entry.cwd = cwd;
        if (entry.start_cwd === null) entry.start_cwd = cwd;
        note_repo(entry, cwd, now_iso, cache);
    }
    const checkout = str(ev.checkout);
    if (checkout !== null && checkout !== cwd) note_repo(entry, checkout, now_iso, cache);

    const opened = open_transcript(str(ev.transcript_path), ev.session_id, profile_root(entry.host, entry.config_dir));
    if (opened !== null) {
        try {
            if (entry.transcript_path !== opened.path) {
                // A different file: the old cursor and totals describe the old one.
                delete entry._ingest;
                entry.usage = null;
            }
            entry.transcript_path = opened.path;
            // At the end there is no later event to catch up, so the backlog is
            // read in chunks until done or the final bound is spent.
            const chunks = ending ? FINAL_INGEST_CHUNKS : 1;
            for (let i = 0; i < chunks; i++) {
                const before = entry._ingest?.offset ?? 0;
                ingest_transcript(entry, opened, ending ? INGEST_CAP_BYTES_FINAL : INGEST_CAP_BYTES, now_iso, cache);
                if ((entry._ingest?.offset ?? 0) === before || (entry._ingest?.offset ?? 0) >= opened.size) break;
            }
        } finally {
            fs.closeSync(opened.fd);
        }
    }
    entry.entrypoint = entry.entrypoint ?? str(env['CLAUDE_CODE_ENTRYPOINT']);
    entry.surface = surface_from_entrypoint(entry.entrypoint, str(ev.surface) ?? entry.surface);
    entry.repos.sort((a, b) => (ms(b.last_seen) ?? 0) - (ms(a.last_seen) ?? 0));
    entry.resume = build_resume(entry);
}

/**
 * Fold one hook event into this session's catalog record. Never throws.
 *
 * Compare-and-swap over versions: read the newest version N, apply the event,
 * create N+1 exclusively. A writer that loses the version re-reads the
 * winner's record and applies its event on top, so concurrent hook processes
 * of one session never double-count and an end event is never dropped (it
 * retries longer than a heartbeat).
 */
export function catalog_update(
    ev: CatalogEvent,
    env: NodeJS.ProcessEnv = process.env,
): CatalogEntry | null {
    const now = ev.now ?? new Date();
    const now_iso = iso_now(now);
    // Input boundary: the id becomes a file name and a resume argument.
    if (!SESSION_ID_RE.test(ev.session_id)) return null;
    try {
        const dir = catalog_dir(env);
        ensure_private_dir(dir);
        const stem = record_stem(ev.platform, ev.session_id);
        const attempts = ev.event === 'session_end' ? CAS_ATTEMPTS_END : CAS_ATTEMPTS;
        for (let attempt = 0; attempt < attempts; attempt++) {
            const versions = list_versions(dir).get(stem) ?? [];
            const current = read_latest(dir, stem, versions);
            const entry = current?.entry ?? fresh_entry(ev, now_iso);
            apply_event(entry, ev, env, now_iso);
            // Above every name in use, tombstones included: a record whose live
            // version was pruned still moves forward instead of colliding.
            const version = (versions[0]?.version ?? 0) + 1;
            const file = path.join(dir, `${stem}.v${version}.json`);
            if (!create_exclusive(file, `${JSON.stringify(entry, null, 2)}\n`)) continue;
            remove_older(dir, stem, version);
            return entry;
        }
    } catch {
        /* fail open */
    }
    return null;
}

/**
 * Hook-side entry: reads the raw dispatcher envelope here, inside the lazy
 * chunk, so the dispatch bundle carries only the call.
 */
export function catalog_hook_event(
    envelope: Record<string, unknown>,
    checkout: string,
    ends: boolean,
    roadmap_slug: string | null | undefined,
): void {
    const raw = envelope['payload'];
    const payload = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    catalog_update({
        session_id: String(envelope['session_id'] ?? '').trim(),
        platform: String(envelope['platform'] ?? 'generic').trim().toLowerCase(),
        event: ends ? 'session_end' : String(envelope['event'] ?? ''),
        surface: str(envelope['surface']),
        checkout,
        cwd: str(payload['cwd']),
        transcript_path: str(payload['transcript_path']),
        model: str(payload['model']),
        ...(roadmap_slug === undefined ? {} : { roadmap_slug }),
        profile: session_profile(),
    });
}

// ---------------------------------------------------------------------------
// Publish — sessions.json + SESSIONS.md
// ---------------------------------------------------------------------------

export interface PublishOptions {
    env?: NodeJS.ProcessEnv;
    now?: Date;
    /** Prune records past the retention window. Default true. */
    prune?: boolean;
}

/**
 * Delete an expired record's version files, each re-read first: a version a
 * concurrent heartbeat just wrote is fresh and survives.
 */
function prune_record(dir: string, stem: string, cutoff: number): void {
    for (const v of list_versions(dir).get(stem) ?? []) {
        try {
            const raw = fs.readFileSync(v.file, 'utf-8');
            if (raw === '') {
                if (Date.now() - fs.statSync(v.file).mtimeMs > TOMBSTONE_TTL_MS) fs.rmSync(v.file, { force: true });
                continue;
            }
            const entry = normalize_entry(JSON.parse(raw));
            if (entry !== null && (ms(entry.last_seen) ?? 0) >= cutoff) continue;
            fs.rmSync(v.file, { force: true });
        } catch {
            /* already gone */
        }
    }
}

/** Build the index snapshot from the record directory (pure apart from reads + prune). */
export function build_index(options: PublishOptions = {}): CatalogIndex {
    const env = options.env ?? process.env;
    const now = options.now ?? new Date();
    const dir = catalog_dir(env);
    const prune = options.prune !== false;
    const cutoff = now.getTime() - RETENTION_DAYS * 86_400_000;
    const rows: PublishedEntry[] = [];
    for (const { stem, version, entry: e } of read_all_records(dir)) {
        const seen = ms(e.last_seen) ?? 0;
        if (seen < cutoff) {
            if (prune) prune_record(dir, stem, cutoff);
            continue;
        }
        const { _ingest, _title_source, ...pub } = e;
        void _ingest;
        void _title_source;
        rows.push({
            ...pub,
            status: derive_status(e, now),
            idle_seconds: Math.max(0, Math.round((now.getTime() - seen) / 1000)),
            record_version: version,
        });
    }
    rows.sort((a, b) => (ms(b.last_seen) ?? 0) - (ms(a.last_seen) ?? 0));
    const counts: CatalogIndex['counts'] = { active: 0, idle: 0, stale: 0, ended: 0, total: rows.length };
    for (const r of rows) counts[r.status] += 1;
    return {
        schema_version: CATALOG_SCHEMA_VERSION,
        generated_at: iso_now(now),
        catalog_dir: dir,
        active_window_seconds: ACTIVE_WINDOW_SECONDS,
        retention_days: RETENTION_DAYS,
        counts,
        sessions: rows,
    };
}

/**
 * Rebuild `sessions.json` + `SESSIONS.md` from the records. Called by the CLI
 * only; the Markdown view is written first and the JSON index last.
 */
export function publish_index(options: PublishOptions = {}): boolean {
    const env = options.env ?? process.env;
    try {
        ensure_private_dir(catalog_dir(env));
        const index = build_index({ ...options, env });
        write_private(index_md_path(env), render_markdown(index));
        write_private(index_json_path(env), `${JSON.stringify(index, null, 2)}\n`);
        return true;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function fmt_tokens(n: number | null | undefined): string {
    if (n === null || n === undefined || n <= 0) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
    return String(n);
}

export function fmt_age(seconds: number): string {
    if (seconds < 60) return 'now';
    if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
    if (seconds < 86_400) return `${Math.round(seconds / 3600)} h`;
    return `${Math.round(seconds / 86_400)} d`;
}

/** Text that cannot open Markdown structure: every inline-syntax character escaped, one line. */
export function md_text(s: string | null | undefined): string {
    const t = (s ?? '—').replace(/\s+/g, ' ').trim();
    return t === '' ? '—' : t.replace(/[\\`*_[\]{}()<>#+!|~-]/g, (c) => `\\${c}`);
}

/** An inline code span whose fence is longer than any backtick run inside. */
export function md_code(s: string | null | undefined): string {
    const t = (s ?? '—').replace(/\s+/g, ' ');
    const longest = Math.max(0, ...(t.match(/`+/g) ?? []).map((m) => m.length));
    const fence = '`'.repeat(longest + 1);
    return `${fence} ${t} ${fence}`;
}

const cell = md_text;

function repo_summary(r: PublishedEntry, max = 3): string {
    if (r.repos.length === 0) return '—';
    const parts = r.repos.slice(0, max).map(repo_label);
    if (r.repos.length > max) parts.push(`+${r.repos.length - max}`);
    return parts.join(', ');
}

/** `name@branch`, with the worktree directory named when it is a linked worktree. */
export function repo_label(x: CatalogRepo): string {
    const wt = x.linked_worktree ? ` [${path.basename(x.root)}]` : '';
    return `${x.name}${wt}@${x.last_branch ?? '?'}`;
}

function profile_label(p: SessionProfile | null): string {
    return p === null ? '—' : `${p.provider}/${p.name}`;
}

function shell_quote(s: string): string {
    return /^[A-Za-z0-9_./:@%+=-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

export function resume_line(r: Pick<PublishedEntry, 'resume'>): string | null {
    if (r.resume === null) return null;
    const env = Object.entries(r.resume.env)
        .map(([k, v]) => `${k}=${shell_quote(v)} `)
        .join('');
    const cd = r.resume.cwd === null ? '' : `cd ${shell_quote(r.resume.cwd)} && `;
    return `${cd}${env}${r.resume.command}`;
}

/** Human view. Never parsed back — `sessions.json` is the contract. */
export function render_markdown(index: CatalogIndex, detail_rows = 25): string {
    const c = index.counts;
    const lines: string[] = [
        '# Agent sessions',
        '',
        `> Generated ${index.generated_at} by agent-config — do not edit; rebuilt on every session event.`,
        `> Canonical machine-readable form: \`sessions.json\` (schema v${index.schema_version}). ` +
            `${c.total} sessions · ${c.active} active · ${c.idle} idle · ${c.stale} stale · ${c.ended} ended ` +
            `(last ${index.retention_days} days).`,
        '',
        '| Status | Last seen | Host · surface | Profile | Model | Title | Repos @ branch | Tokens | Context | Session |',
        '|---|---|---|---|---|---|---|---|---|---|',
    ];
    for (const r of index.sessions) {
        lines.push(
            `| ${r.status} | ${fmt_age(r.idle_seconds)} | ${cell(`${r.host} · ${r.surface}`)} | ${cell(profile_label(r.profile))} | ` +
                `${cell(r.model)} | ${cell(r.title)} | ${cell(repo_summary(r))} | ${fmt_tokens(r.usage?.total_tokens)} | ` +
                `${fmt_tokens(r.context_tokens)} | ${md_code(r.session_id)} |`,
        );
    }
    lines.push('', '## Details', '');
    for (const r of index.sessions.slice(0, detail_rows)) {
        lines.push(`### ${cell(r.title ?? r.session_id)}`, '');
        lines.push(`- **Session:** ${md_code(r.session_id)} · ${r.status} · last seen ${md_text(r.last_seen)} · started ${md_text(r.started_at)}` +
            (r.ended_at !== null ? ` · ended ${md_text(r.ended_at)}` : ''));
        lines.push(`- **Host:** ${md_text(r.host)}${r.host_version !== null ? ` ${md_text(r.host_version)}` : ''} · surface ${md_text(r.surface)}` +
            ` · provider ${md_text(r.provider)} · profile ${md_text(profile_label(r.profile))}`);
        lines.push(`- **Model:** ${md_text(r.model)}${r.models.length > 1 ? ` (also: ${md_text(r.models.filter((m) => m !== r.model).join(', '))})` : ''}`);
        if (r.usage !== null) {
            lines.push(`- **Tokens:** ${fmt_tokens(r.usage.total_tokens)} total · in ${fmt_tokens(r.usage.input_tokens)} · ` +
                `out ${fmt_tokens(r.usage.output_tokens)} · cache read ${fmt_tokens(r.usage.cache_read_input_tokens)} · ` +
                `cache write ${fmt_tokens(r.usage.cache_creation_input_tokens)} · ${r.usage.assistant_messages} replies · ` +
                `context ${fmt_tokens(r.context_tokens)}`);
        }
        lines.push(`- **Started in:** ${md_code(r.start_cwd)}`);
        if (r.roadmap_slug !== null) lines.push(`- **Roadmap:** ${md_text(r.roadmap_slug)}`);
        for (const repo of r.repos) {
            lines.push(`- **Repo** ${md_text(repo_label(repo))}${repo.remote !== null ? ` (${md_code(repo.remote)})` : ''}: ${md_code(repo.root)} — branches ${repo.branches.map((b) => md_code(b)).join(', ') || '—'}`);
        }
        const resume = resume_line(r);
        if (resume !== null) lines.push(`- **Resume:** ${md_code(resume)}`);
        lines.push('');
    }
    if (index.sessions.length > detail_rows) {
        lines.push(`_${index.sessions.length - detail_rows} older sessions: see \`sessions.json\` or \`agent-config sessions:catalog --all\`._`, '');
    }
    return lines.join('\n');
}
```

## Tests (`tests/scripts/session_catalog.test.ts`, all green; `session_register` suite green)

- keeps the session after session_end, marked ended, instead of deleting it
- records start path, repo, remote without credentials, branch and resume command
- collects every branch a checkout was on, oldest first
- ingests the transcript incrementally and de-duplicates usage by message id
- attributes repos edited through tool calls, including a second repository
- takes the start path from the transcript and labels a linked worktree with its own branch
- starts over when the transcript shrinks instead of keeping stale totals
- fails open on an unreadable transcript and a host without resume support
- never stores prompt text
- does not count a checkout the session only read
- refuses a transcript that is a symlink, not .jsonl, another session's, or outside the profile
- refuses a transcript reached through a symlinked parent that leaves the profile
- refuses a transcript whose name only contains the id, and a host profile it cannot resolve
- never double-counts when several hook processes of one session race
- opens a FIFO named like a transcript without blocking and reads nothing
- survives a damaged record and escapes Markdown-sensitive text
- turns superseded versions into tombstones so a version name is never reused
- does not block on a FIFO where git metadata should be
- rebuilds the resume line from validated fields instead of trusting a stored one
- resumes a session whose live version was pruned
- does not let an older prompt that lost the race reopen a later end
- follows a .git pointer only into a real linked-worktree entry
- restarts the totals when the transcript is replaced at the same path
- does not let a delayed end close a newer resume
- refuses a forged worktree-shaped pointer whose common dir is not a git dir
- replaces a published index that is valid JSON but malformed
- keeps two hosts with the same id apart
- does not let a late stop reopen an ended session, but a new prompt does
- never puts shell syntax from a session id into a resume line
- masks token-shaped runs in titles and strips query credentials from remotes
- resets the cursor when the transcript path changes
- is written by the session-register hook on start and kept, ended, after session_end
- writes sessions.json and SESSIONS.md newest first, owner-only, with derived status
- prunes records past the retention window
- derives status from age and the host TTL
- maps entrypoints to surfaces and strips userinfo
- renders a copy-paste resume line with quoting
- prints JSON filtered by status

## Question

Is the budget change correctly derived, and does the change expand any authority or still contain a defect that should block it? Give your reasons, then end with exactly one line

`STANCE: <verdict> | CONFIDENCE: <high|medium|low> | DEALBREAKER: <yes|no>`

where `<verdict>` is one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`.
