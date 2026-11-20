<!-- evidence-type: analysis -->

# Ratification review — hook bundle ceiling raise for the session catalog — round 4

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list (hook-plumbing configuration), so the change needs a two-provider verdict under ADR-268 § 4: an agent may change that file but may not ratify its own change.

subject: 389b4aeb37267bd89194f4fd557680cb9349f4983ddd4aa2ee53ae8ed6f15377

(The digest covers `src/config/hook-bundle-budget.json` at commit `7baba85c33`, computed with `./scripts-run src/scripts/ratification_subject`.)

## Rounds 1–3

Prompts committed as `…-r1/-r2/-r3-20261120.question.md` beside this one. Every round accepted the budget arithmetic; rounds 1–3 refused on the feature. Round 3's blockers and their fixes (commit `7baba85c33`, each with a regression test):

- **Transcript containment by lexical prefix; no check when the profile dir is unset; substring name match; identity compared against a fresh lstat (both seats).** `valid_transcript` now `realpath`s both the transcript and the profile root before the containment check, uses the host default root (`~/.claude`, `~/.codex`) when the env override is unset and refuses every other host, requires the file name to be exactly `<id>.jsonl` or `…-<id>.jsonl`, and returns the inode/device it validated; `ingest_transcript` opens with `O_NOFOLLOW` and reads nothing unless `fstat` of the descriptor matches THAT inode/device. Tests: symlinked parent escaping the profile, name merely containing the id, unresolvable profile, descriptor/validation mismatch.
- **Stale-lock takeover of a slow live holder; reclaim and unlock races (one seat).** Locks are files created with `wx` holding `<pid> <token>`. A lock is taken over only when its owner pid is gone (`kill(pid, 0)` → `ESRCH`), with a 10-minute bound against pid reuse — never because a live holder is slow. The reclaimer renames the dead lock aside, verifies it moved the content it judged dead, and if a peer had already replaced it, links the moved lock back (`link` refuses to overwrite) and backs off. `unlock` removes the lock only while it still holds its own token; since a live owner is never reclaimed, nothing can take the lock between that check and the removal. Tests: dead-owner lock reclaimed, live lock respected.
- **End event lost when the record lock stays busy; final publish skipped when the publisher is past its last dirty check (one seat).** A `session_end` that cannot take the record lock in 2 s writes an end marker that the publisher applies at once and the next record writer folds in; `stop`, start and end publishes wait up to 1 s for the publish lock, so a writer that touched `.dirty` after the holder's last check publishes itself once the holder releases. Test: end recorded through the marker while the lock is held.
- **Records keyed by id only (one seat).** Records are keyed `<host>--<id>`; ids that are not `^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$` are refused at the input boundary. Test: same id under two hosts stays apart. Hosts issue UUIDs; uniqueness per host is the stated assumption in the contract doc.
- **Titles may carry conversation-derived text (one seat, privacy).** Kept by owner decision: the owner explicitly asked for the catalog to show what each session is doing. Only the host's own generated title (or one the user set) is stored, capped at 120 characters with token-shaped runs masked; it lives only in owner-only files (`0600`) in the user's home and is never transmitted.

## The budget file change now

- New chunk row `src/scripts/_lib/session_catalog.ts`, `max_bytes: 45700` (measured 41,486 B, +10 %).
- Dispatch ceiling 1,595,100 → 1,595,500 (measured 1,595,393 B against 1,595,089 B on `origin/main` 2eef08c00b: +304 B, the call site only).

```diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 5b405df712..4063b1ff90 100644
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
+            "why_it_could_not_be_avoided": "The base sat 11 B under the ceiling, so any call site crossed it. The catalog body itself (41,486 B) already lives in its own chunk with its own ceiling, the envelope parsing was moved into that chunk, and the `sessions:catalog` CLI was split out of `sessions_cli.ts` because that module is in the dispatch graph; what remains is the call. The ceiling moves by the delta rounded up to the next 100 B, with no growth queued.",
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
+            "max_bytes": 45700,
+            "registered_at": "2026-11-20",
+            "derivation": "Measured 41,486 bytes on 2026-11-20 (the machine-wide session catalog: envelope reading, transcript binding to the session and profile with a descriptor identity check, pid-and-token locks reclaimed only from dead owners, end markers, title masking, per-session record update, incremental transcript ingest, index publication and Markdown rendering, plus the register and agent-switch profile helpers it imports). The ceiling is that reading plus about 10 %, rounded, the margin of the quota_notice and self_repair rows, with no growth queued. WHY IT IS A CHUNK: inlined, it took the dispatch bundle about 13 KB over its 1,595,100 B ceiling (measured with APFS-cloned node_modules against 1,595,089 B on origin/main 2eef08c00b); the 2026-10-18 council doctrine moves new hook work into a chunk instead of raising that ceiling. Loaded by `session-register` on its four lifecycle slots through `hooks/lazy_load.ts`; a missing or mis-digested chunk costs the catalog entry, never the register."
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
 * Layout — one writer per record, one serialised publisher for the index:
 *
 * - `<event4u_root>/runtime/session-catalog/<stem>.json` — one record per
 *   session, written only by hooks of that session, under a per-session lock
 *   directory so two overlapping hook processes of ONE session cannot both
 *   advance the transcript offset (AI council 2026-11-20: the register's
 *   "one writer" argument does not cover a session racing itself).
 * - `<event4u_root>/sessions.json` — the CANONICAL index for external readers
 *   (agent-switch and the CLI). Rebuilt from the record directory.
 * - `<event4u_root>/SESSIONS.md` — the same rows rendered for a human. Derived
 *   from the same in-memory snapshot as the JSON, never parsed back.
 *
 * Publishing is serialised by a lock directory plus a dirty marker: every
 * writer touches the marker after its record lands, the lock holder re-scans
 * while the marker reappears. Two publishers never run at once, so the index
 * can never be replaced by an OLDER scan (council: atomic rename alone does not
 * prevent out-of-order publication).
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
import { current_branch, git_common_dir } from './git_common_dir.js';
import { type SessionProfile, iso_now, safe_stem, session_profile, ttl_seconds_for } from './session_register.js';
import { DEFAULT_EVENT4U_ROOT_RELATIVE, type EnvMap } from './user_global_paths.js';

export const CATALOG_SCHEMA_VERSION = 1;

/** A session heard from within this window is `active`. */
export const ACTIVE_WINDOW_SECONDS = 15 * 60;

/** Records whose last activity is older than this are pruned at publish time. */
export const RETENTION_DAYS = 30;

/** Upper bound on transcript bytes read per hook call (normal heartbeat). */
export const INGEST_CAP_BYTES = 8 * 1024 * 1024;

/** Upper bound on the final catch-up read at `session_end`. */
export const INGEST_CAP_BYTES_FINAL = 16 * 1024 * 1024;

/** Message ids remembered for usage de-duplication. */
const RECENT_ID_WINDOW = 256;

/** Tools whose file argument means the session changed that checkout (reads do not count). */
const WRITE_TOOLS: ReadonlySet<string> = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

const MAX_REPOS = 50;
const MAX_BRANCHES_PER_REPO = 20;
const MAX_MODELS = 10;

/** Upper bound on any lock's life, against a recycled owner pid. */
const LOCK_STALE_MS = 10 * 60_000;

/** How long `session_end` waits for a heartbeat of the same session to finish. */
const END_LOCK_WAIT_MS = 2_000;

/** How long a forced publish waits for the publish lock. */
const PUBLISH_WAIT_MS = 1_000;

/** Heartbeat renders closer together than this are deferred to the dirty marker. */
export const PUBLISH_THROTTLE_MS = 15_000;

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

function origin_url(common_dir: string): string | null {
    try {
        const raw = fs.readFileSync(path.join(common_dir, 'config'), 'utf-8');
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
// Locks
// ---------------------------------------------------------------------------

/**
 * Cross-process lock as a file created with `wx`, holding `<pid> <token>`.
 *
 * A lock is reclaimed only when its owner process is gone (or, against pid
 * reuse, older than LOCK_STALE_MS), never because a live holder is slow. The
 * reclaimer moves the dead lock aside with an atomic rename and checks that it
 * moved the lock it judged dead; if a peer had already replaced it, the moved
 * lock is linked back (`link` refuses to overwrite) before backing off.
 */
function try_lock(lock: string, wait_ms = 0): string | null {
    const deadline = Date.now() + wait_ms;
    for (;;) {
        const token = try_lock_once(lock);
        if (token !== null) return token;
        if (Date.now() >= deadline) return null;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
}

function lock_owner_alive(body: string, mtime_ms: number): boolean {
    const pid = Number(body.split(' ')[0]);
    if (Date.now() - mtime_ms > LOCK_STALE_MS) return false;
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return (e as NodeJS.ErrnoException).code === 'EPERM';
    }
}

function try_lock_once(lock: string): string | null {
    const token = `${process.pid} ${Date.now()}-${Math.random().toString(36).slice(2)}`;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            fs.writeFileSync(lock, token, { flag: 'wx', mode: 0o600 });
            return token;
        } catch {
            try {
                const seen = fs.readFileSync(lock, 'utf-8');
                if (lock_owner_alive(seen, fs.statSync(lock).mtimeMs)) return null;
                const aside = `${lock}.dead-${process.pid}-${Math.random().toString(36).slice(2)}`;
                fs.renameSync(lock, aside);
                if (fs.readFileSync(aside, 'utf-8') !== seen) {
                    try {
                        fs.linkSync(aside, lock);
                    } catch {
                        /* a third process holds it now; the moved lock's owner will find its lock gone */
                    }
                    fs.rmSync(aside, { force: true });
                    return null;
                }
                fs.rmSync(aside, { force: true });
            } catch {
                return null;
            }
        }
    }
    return null;
}

/** Remove the lock only while it is still ours — never a successor's. */
function unlock(lock: string, token: string): void {
    try {
        if (fs.readFileSync(lock, 'utf-8') !== token) return;
        fs.rmSync(lock, { force: true });
    } catch {
        /* a lock that cannot be removed is reclaimed once its owner is gone */
    }
}

/** Records are keyed by host and id: two hosts may use the same id space. */
export function record_stem(host: string, session_id: string): string {
    return safe_stem(`${host.trim().toLowerCase()}--${session_id}`);
}

function record_lock(dir: string, stem: string): string {
    return path.join(dir, `.${stem}.lock`);
}

function end_marker(dir: string, stem: string): string {
    return path.join(dir, `.${stem}.ended`);
}

function write_private(file: string, data: string): void {
    write_atomic(file, data);
    try {
        fs.chmodSync(file, 0o600);
    } catch {
        /* best effort on filesystems without POSIX modes */
    }
}

function ensure_private_dir(dir: string): void {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

// ---------------------------------------------------------------------------
// Record read / write
// ---------------------------------------------------------------------------

function is_entry(v: unknown): v is CatalogEntry {
    if (typeof v !== 'object' || v === null) return false;
    const o = v as Record<string, unknown>;
    return typeof o['session_id'] === 'string' && typeof o['last_seen'] === 'string';
}

export function read_entry(dir: string, session_id: string, host = 'claude'): CatalogEntry | null {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(path.join(dir, `${record_stem(host, session_id)}.json`), 'utf-8'));
        return is_entry(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export function read_all_entries(dir: string): CatalogEntry[] {
    return read_all_entry_files(dir).map((x) => x.entry);
}

function read_all_entry_files(dir: string): { file: string; entry: CatalogEntry }[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir).filter((n) => n.endsWith('.json'));
    } catch {
        return [];
    }
    const out: { file: string; entry: CatalogEntry }[] = [];
    for (const n of names) {
        try {
            const parsed: unknown = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf-8'));
            if (is_entry(parsed)) out.push({ file: path.join(dir, n), entry: parsed });
        } catch {
            /* a half-written or foreign file is skipped, never fatal */
        }
    }
    return out;
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
        const common = git_common_dir(root);
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
    const branch = current_branch(root);
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
    file: string,
    cap_bytes: number,
    now_iso: string,
    cache: Map<string, string | null>,
    expect: { ino: number; dev: number } | null = null,
): void {
    let fd: number | null = null;
    try {
        const size = fs.statSync(file).size;
        const cur: CatalogIngest = entry._ingest ?? { offset: 0, recent_ids: [] };
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
        // O_NOFOLLOW + identity check: the file opened is the file validated.
        fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
        const opened = fs.fstatSync(fd);
        const want = expect ?? fs.lstatSync(file);
        if (!opened.isFile() || opened.ino !== want.ino || opened.dev !== want.dev) return;
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
    } finally {
        if (fd !== null) {
            try {
                fs.closeSync(fd);
            } catch {
                /* ignore */
            }
        }
    }
}

/**
 * The host-supplied transcript path is untrusted input: only a regular
 * `.jsonl` file is read, never a symlink, a device or a directory.
 */
interface CheckedTranscript {
    path: string;
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
 * The host-supplied transcript path is untrusted input. Accepted only when,
 * after resolving every symlink, it is a regular `.jsonl` file named for this
 * session and inside this session's profile root. The inode/device seen here
 * are what the opened descriptor must match.
 */
function valid_transcript(p: string | null, session_id: string, root: string | null): CheckedTranscript | null {
    if (p === null || root === null) return null;
    try {
        const real = fs.realpathSync(path.resolve(p));
        const real_root = fs.realpathSync(root);
        if (!real.startsWith(`${real_root}${path.sep}`)) return null;
        if (!transcript_name_matches(path.basename(real), session_id)) return null;
        const st = fs.lstatSync(real);
        return st.isFile() ? { path: real, ino: st.ino, dev: st.dev } : null;
    } catch {
        return null;
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

/**
 * Fold one hook event into this session's catalog record, then publish the
 * index (throttled on heartbeats, forced on start and end). Never throws.
 */
export function catalog_update(
    ev: CatalogEvent,
    env: NodeJS.ProcessEnv = process.env,
): CatalogEntry | null {
    const now = ev.now ?? new Date();
    const now_iso = iso_now(now);
    let entry: CatalogEntry | null = null;
    // Input boundary: the id becomes a file name and a resume argument.
    if (!SESSION_ID_RE.test(ev.session_id)) return null;
    try {
        const dir = catalog_dir(env);
        ensure_private_dir(dir);
        const stem = record_stem(ev.platform, ev.session_id);
        const lock = record_lock(dir, stem);
        const ending = ev.event === 'session_end';
        // A heartbeat may skip; the end mark must not be lost to a still-running `stop`.
        const token = try_lock(lock, ending ? END_LOCK_WAIT_MS : 0);
        if (token === null) {
            if (ending) {
                // Last resort: a marker the next writer or publisher applies.
                write_private(end_marker(dir, stem), now_iso);
                publish_index({ env, now, force: true });
            }
            return null;
        }
        try {
            entry = read_entry(dir, ev.session_id, ev.platform) ?? fresh_entry(ev, now_iso);
            try {
                const marked = fs.readFileSync(end_marker(dir, stem), 'utf-8').trim();
                if (entry.ended_at === null && ms(marked) !== null) entry.ended_at = marked;
                fs.unlinkSync(end_marker(dir, stem));
            } catch {
                /* no marker */
            }
            entry.schema_version = CATALOG_SCHEMA_VERSION;
            entry.host = ev.platform || entry.host;
            entry.last_seen = now_iso;
            // Only a real start or a new prompt reopens an ended session (a resume);
            // a late `stop` racing the end must not.
            if (ending) entry.ended_at = now_iso;
            else if (ev.event === 'session_start' || ev.event === 'user_prompt_submit') entry.ended_at = null;
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

            const checked = valid_transcript(str(ev.transcript_path), ev.session_id, profile_root(entry.host, entry.config_dir));
            if (checked !== null) {
                const transcript = checked.path;
                if (entry.transcript_path !== transcript) {
                    // A different file: the old cursor and totals describe the old one.
                    delete entry._ingest;
                    entry.usage = null;
                }
                entry.transcript_path = transcript;
                ingest_transcript(
                    entry,
                    entry.transcript_path,
                    ending ? INGEST_CAP_BYTES_FINAL : INGEST_CAP_BYTES,
                    now_iso,
                    cache,
                    checked,
                );
            }
            entry.entrypoint = entry.entrypoint ?? str(env['CLAUDE_CODE_ENTRYPOINT']);
            entry.surface = surface_from_entrypoint(entry.entrypoint, str(ev.surface) ?? entry.surface);
            entry.repos.sort((a, b) => (ms(b.last_seen) ?? 0) - (ms(a.last_seen) ?? 0));
            entry.resume = build_resume(entry);

            write_private(path.join(dir, `${stem}.json`), `${JSON.stringify(entry, null, 2)}\n`);
        } finally {
            unlock(lock, token);
        }
        // `stop` is the last event before a quiet period, so it always publishes;
        // only the prompt-time heartbeat is throttled.
        const force = ev.event !== 'user_prompt_submit';
        publish_index({ env, now, force, wait_ms: force ? PUBLISH_WAIT_MS : 0 });
    } catch {
        /* fail open */
    }
    return entry;
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
// Publish — sessions.json (canonical) + SESSIONS.md (derived)
// ---------------------------------------------------------------------------

export interface PublishOptions {
    env?: NodeJS.ProcessEnv;
    now?: Date;
    /** Ignore the heartbeat throttle. */
    force?: boolean;
    /** Prune records past the retention window. Default true. */
    prune?: boolean;
    /** How long a forced publish waits for a running publisher. */
    wait_ms?: number;
}

/**
 * Delete an expired record under its session's lock, after re-reading it: a
 * heartbeat that refreshed the record since the scan keeps it.
 */
function prune_record(dir: string, file: string, cutoff: number): void {
    const lock = record_lock(dir, path.basename(file, '.json'));
    const token = try_lock(lock);
    if (token === null) return;
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (is_entry(parsed) && (ms(parsed.last_seen) ?? 0) >= cutoff) return;
        fs.unlinkSync(file);
    } catch {
        /* already gone */
    } finally {
        unlock(lock, token);
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
    for (const { file, entry: e } of read_all_entry_files(dir)) {
        const seen = ms(e.last_seen) ?? 0;
        if (seen < cutoff) {
            if (prune) prune_record(dir, file, cutoff);
            continue;
        }
        const stem = path.basename(file, '.json');
        if (e.ended_at === null) {
            try {
                const marked = fs.readFileSync(end_marker(dir, stem), 'utf-8').trim();
                if (ms(marked) !== null) e.ended_at = marked;
            } catch {
                /* no marker */
            }
        }
        const { _ingest, _title_source, ...pub } = e;
        void _ingest;
        void _title_source;
        rows.push({
            ...pub,
            status: derive_status(e, now),
            idle_seconds: Math.max(0, Math.round((now.getTime() - seen) / 1000)),
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
 * Rebuild `sessions.json` + `SESSIONS.md`, serialised across processes.
 * Returns true when this call published (or the work was already covered).
 */
export function publish_index(options: PublishOptions = {}): boolean {
    const env = options.env ?? process.env;
    try {
        const dir = catalog_dir(env);
        ensure_private_dir(dir);
        const dirty = path.join(dir, '.dirty');
        fs.writeFileSync(dirty, '', { mode: 0o600 });
        const json_path = index_json_path(env);
        if (options.force !== true) {
            try {
                const age = (options.now ?? new Date()).getTime() - fs.statSync(json_path).mtimeMs;
                if (age >= 0 && age < PUBLISH_THROTTLE_MS) return true; // marker stays for the next publisher
            } catch {
                /* no index yet → publish */
            }
        }
        const lock = path.join(dir, '.publish.lock');
        // A forced publish waits briefly: the holder may already be past its last
        // dirty check, and the final state of a turn must not wait for a later event.
        const token = try_lock(lock, options.wait_ms ?? 0);
        if (token === null) return true; // the holder re-scans while `.dirty` exists
        try {
            for (let pass = 0; pass < 3; pass++) {
                try {
                    fs.unlinkSync(dirty);
                } catch {
                    /* already consumed */
                }
                const index = build_index({ ...options, env });
                write_private(json_path, `${JSON.stringify(index, null, 2)}\n`);
                write_private(index_md_path(env), render_markdown(index));
                if (!fs.existsSync(dirty)) break;
            }
        } finally {
            unlock(lock, token);
        }
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

function cell(s: string | null | undefined): string {
    return (s ?? '—').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim() || '—';
}

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
                `${fmt_tokens(r.context_tokens)} | \`${r.session_id}\` |`,
        );
    }
    lines.push('', '## Details', '');
    for (const r of index.sessions.slice(0, detail_rows)) {
        lines.push(`### ${cell(r.title ?? r.session_id)}`, '');
        lines.push(`- **Session:** \`${r.session_id}\` · ${r.status} · last seen ${r.last_seen} · started ${r.started_at}` +
            (r.ended_at !== null ? ` · ended ${r.ended_at}` : ''));
        lines.push(`- **Host:** ${r.host}${r.host_version !== null ? ` ${r.host_version}` : ''} · surface ${r.surface}` +
            ` · provider ${r.provider ?? '—'} · profile ${profile_label(r.profile)}`);
        lines.push(`- **Model:** ${r.model ?? '—'}${r.models.length > 1 ? ` (also: ${r.models.filter((m) => m !== r.model).join(', ')})` : ''}`);
        if (r.usage !== null) {
            lines.push(`- **Tokens:** ${fmt_tokens(r.usage.total_tokens)} total · in ${fmt_tokens(r.usage.input_tokens)} · ` +
                `out ${fmt_tokens(r.usage.output_tokens)} · cache read ${fmt_tokens(r.usage.cache_read_input_tokens)} · ` +
                `cache write ${fmt_tokens(r.usage.cache_creation_input_tokens)} · ${r.usage.assistant_messages} replies · ` +
                `context ${fmt_tokens(r.context_tokens)}`);
        }
        lines.push(`- **Started in:** \`${r.start_cwd ?? '—'}\``);
        if (r.roadmap_slug !== null) lines.push(`- **Roadmap:** ${r.roadmap_slug}`);
        for (const repo of r.repos) {
            lines.push(`- **Repo** ${repo_label(repo)}${repo.remote !== null ? ` (${repo.remote})` : ''}: \`${repo.root}\` — branches ${repo.branches.map((b) => `\`${b}\``).join(', ') || '—'}`);
        }
        const resume = resume_line(r);
        if (resume !== null) lines.push(`- **Resume:** \`${resume}\``);
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
- skips the update while another process of the same session holds its lock
- never stores prompt text
- lets session_end wait for a heartbeat that still holds the lock
- does not count a checkout the session only read
- refuses a transcript that is a symlink, not .jsonl, another session's, or outside the profile
- refuses a transcript reached through a symlinked parent that leaves the profile
- refuses a transcript whose name only contains the id, and a host profile it cannot resolve
- reads nothing when the opened file is not the validated one
- reclaims a lock whose owner process is gone, and keeps a live one
- records the end through a marker when the record lock stays busy
- keeps two hosts with the same id apart
- does not let a late stop reopen an ended session, but a new prompt does
- never puts shell syntax from a session id into a resume line
- masks token-shaped runs in titles and strips query credentials from remotes
- resets the cursor when the transcript path changes
- is written by the session-register hook on start and kept, ended, after session_end
- writes sessions.json and SESSIONS.md newest first, owner-only, with derived status
- prunes records past the retention window
- defers to the lock holder and leaves the dirty marker for it
- derives status from age and the host TTL
- maps entrypoints to surfaces and strips userinfo
- renders a copy-paste resume line with quoting
- prints JSON filtered by status

## Question

Is the budget change correctly derived, and does the change expand any authority or still contain a defect that should block it? Give your reasons, then end with exactly one line

`STANCE: <verdict> | CONFIDENCE: <high|medium|low> | DEALBREAKER: <yes|no>`

where `<verdict>` is one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`.
