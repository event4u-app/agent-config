<!-- evidence-type: original-review -->

# Ratification prompt, round 3 — the `session-title` user_prompt_submit concern (verbatim, as sent 2026-11-26)

~~~text
Ratification review, round 3 (the last before the owner decides), of one change touching two files on this repository's ratification watched set: src/scripts/hook_manifest.yaml and its compiled src/scripts/hook_manifest.json.

subject: 95e177dbecf213caff279ed810f8e2bc78e484dcf27e4bad6caea7236cab5c4f

(The digest covers those two gated files at commit 4aaf9d7b09 (unchanged since round 2: the two gated files did not move), computed with ./scripts-run src/scripts/ratification_subject --base-ref origin/main; merge base 9f57fd426e, the current tip of origin/main, merged into the branch.)

Closed verdicts (ADR-268 § 4): ratified (an approved expansion of what an agent may do) · confirmed-non-expanding (no authority expanded, no gate weakened, no enforcing step made non-enforcing) · refused (must not land).

Background, as observed: Claude Code writes an ai-title line into each session transcript once, early, and then re-appends the same value for the rest of the session. Across the eight most recent transcripts of this checkout each carried exactly one distinct ai-title value, repeated between 6 and 452 times. sessions:catalog and the external tool Agent Switch list sessions by that title, so a session keeps the name of its first prompt. The repository owner asked, verbatim: "Können wir dafür sorgen, dass der Name einer Session sich immer weiter verbessert und klarer wird, je mehr Informationen wir haben? Und nur wenn der Nutzer selbst die Session umbenennt, dann ändern wir ihn nicht mehr. Aber so hätten wir in Agent Switch eine Bessere Darstellung der Sessions. Das ganze könenn wir ja so gestalten, dass man es über eine Anweisung ein und ausschalten kann. Per default ist es aber an. Und es ist eine globale einstellung." Offered three ways to phrase the better title (the agent itself on a nudge, a separate small-model call from the hook, a deterministic rule from branch and PR), the owner chose the agent itself. Recorded in agents/evidence/owner-directives/2026-11-26-session-titles-that-sharpen.md and ADR-305.

What the change does: a new concern session-title (src/scripts/hooks/session_title_hook.ts), severity advisory, effect context, fail_closed false, bound on claude user_prompt_submit only, added to the worker role's drop list. On each non-harness prompt it first reads at most the last 64 KiB of the transcript and, if a custom-title line is there, freezes the session and stops; otherwise it increments a per-session counter in <user-global root>/state/session-titles/<id>.json (session id, transcript path, prompt count, last nudge; no prompt text). At prompts 3, 8, 20, 45, 100, 200 and every 200 after, it streams the transcript for title markers; if no custom-title line (the user's /rename) exists, it injects one line asking the agent whether the session goal can now be named more precisely and, if so, to run agent-config session:title --session <id> "<title>" once, at most 60 characters. It never denies, never rewrites the prompt, and returns allow on every error. It is silent when sessions.auto_title is false: a new class-A setting, default true, whitelisted in MERGEABLE_KEYS so a user-global value survives the merge. The CLI writes <session>.agent-title.json beside the transcript (title masked for token-shaped runs, capped at 80 characters, atomic write), refuses with exit 0 when a custom-title exists or the setting is false, and never writes the transcript. sessions:catalog now prefers custom-title, then the sidecar, then ai-title. The body ships as a lazy chunk (48,503 B); the dispatch bundle gains one LAZY_CONCERNS row and measures 1,602,362 B against the unchanged 1,915,000 B backstop. It is admitted in agents/decisions/concern-admissions.jsonl, its +1 concern_count is claimed in a new stub roadmap, and the CLI count budget moves 132 -> 133 in the same change (main reached 132 with deliberation:get and deliberation:set).

Round 1 (prompt agents/evidence/council/session-title-ratification-r1-20261126.question.md) closed refused by both seats, each with a dealbreaker. What each objected to, and what changed:
(a) Both seats: the compiled hook_manifest.json diff removed the deliberation-mode concern and its bindings, unmentioned. Cause: round 1's jq diff compared the branch head against the tip of origin/main, which had moved 19 commits past the branch's merge base and added deliberation-mode there; the branch never removed it. The branch now merges origin/main (merge commit 52a4f435f9), and the jq diff below is against that merge base: it adds session-title and nothing else.
(b) The CLI accepted any --transcript path and could write a sidecar beside an arbitrary file. Now session:title writes only beside an existing file named exactly <session-id>.jsonl (transcriptFor in session_title.ts) and exits 1 otherwise; a test covers both a foreign path and a missing file, and fails when the name check is removed.
(c) The writer did not enforce the 60 characters the nudge asks for. TITLE_MAX is now 60, enforced by sanitizeTitle, with a test.
(d) Renamed sessions kept accumulating state. The concern now records frozen: true the first time it sees a custom-title and from then on reads and writes nothing for that session; the test asserts the counter stops.
(e) The state directory grew without bound. At every nudge the concern removes state files untouched for 60 days (pruneState, at most 500 entries examined), with a test.
(f) The cadence of every 100 prompts past 100 was heavy for long sessions. It is now 3, 8, 20, 45, 100, 200, then every 200.
(g) No success measure or rollback criterion. ADR-305's review_trigger now names both failures and the rollback: most nudged sessions carry no sidecar, or a /rename lands after a refined title in more than one session in five; either one means setting the template default to false and dropping the binding. The stub roadmap carries the two measurements.
(h) Not changed, with the reason: sessions.auto_title: false stops new nudges and writes but leaves sidecars already written visible to readers. They are titles, not instructions, and a /rename still outranks them; this is recorded in ADR-305.

Round 2 (prompt agents/evidence/council/session-title-ratification-r2-20261126.question.md) split: anthropic ratified (high, no dealbreaker), openai refused (med, dealbreaker). What openai objected to, and what changed:
(i) The freeze after /rename only happened at a milestone; between milestones the concern still counted. Correct, and the round-2 wording overstated it. Now the concern reads at most the last 64 KiB of the transcript on every prompt (tailHasCustomTitle; Claude Code re-appends custom-title lines as it does ai-title) and freezes on the first prompt after a /rename. Test 'freezes on the first prompt after a /rename between milestones, not at the next milestone' asserts the counter stops at the prompt before; with the tail check disabled it and the older freeze test both fail. The freeze is permanent even if the title is later removed (stated in ADR-305, as anthropic asked).
(ii) The tests were not shown, so their assertions could not be checked. The full test file is now included below, and the more peripheral wiring diffs are described instead (listed under Scope).
(iii) The rollback measurement had no window or sample. The stub roadmap now states it: the first 30 days after the release, Claude sessions with at least one nudge, floor 40 sessions (window extends by 30 days below that); uptake = share with a sidecar; correction = share with a custom-title line timestamped after the sidecar's first updated_at; counted by a one-off script over files already on disk.
(iv) Not changed, with the reason: the CLI does not authenticate its caller. Any local process that can run the CLI can already edit the transcript and the sidecar directly; the CLI bounds what the agent writes (exact <session-id>.jsonl target, 60 characters, refusal after /rename), it is not a security boundary against the local user.
(v) The evaluator-measurements.json anthropic saw as 131: it is regenerated at 133 in this branch, matching the budget.

Measured by the author before this review, on the author's machine: 14 tests in tests/hooks/session_title_hook.test.ts pass; with the setting check replaced by "return true" the off-switch test fails, with the transcript name check removed the path test fails, and with the tail check disabled both freeze tests fail. tsc --noEmit clean. check_settings_classes (120 keys, A=12), check_concern_admissions, check_hook_bundle_composition, check_generator_sync, check_estate_count against origin/main, runtime_dependencies and check_cli_registry_budget_sync pass.

Scope of what is shown, narrowed to fit the council's 51,200-byte bundle ceiling: the diff against merge base 9f57fd426e (the current tip of origin/main), one line of context, of the concern, its library, the CLI, the catalog reader, the settings loader and template, and the manifest source; the three pinned-list test edits with no context; the full new test file; and the gated hook_manifest.json as a key-sorted jq -S diff. Described, not shown: src/cli/registry.ts adds one session:title entry; src/scripts/_dispatch.bash adds the help text, a session:title route to session_title_cli.ts, and session_title_cli to SCRIPT_DELEGATES; src/scripts/_cli/cmd_script.ts adds the precompiled delegate; src/scripts/hook_chunks.mjs and src/scripts/hooks/lazy_concern.ts add the lazy chunk (yaml external); agents/decisions/concern-admissions.jsonl adds the admission row; docs/decisions/ADR-305-session-titles-that-sharpen.md, agents/evidence/owner-directives/2026-11-26-session-titles-that-sharpen.md and agents/roadmaps/stubs/road-to-session-titles-beyond-claude.md as described above; docs/contracts/settings-classes.md one row for sessions.auto_title (A, default true, un-inferrable) and counts A 12 -> 13, total 120 -> 121, un-inferrable 12 -> 13; src/config/evaluator-budgets.json cli_help_command_count 132 -> 133 with one sentence appended to baseline_note; agents/evidence/metrics/evaluator-measurements.json regenerated with 133; dist/install/install.mjs, docs/decisions/INDEX.md and the ADR evidence census regenerated.

diff --git a/src/config/agent-settings.template.yml b/src/config/agent-settings.template.yml
index 3464f0c3ee..b60534b3e6 100644
--- a/src/config/agent-settings.template.yml
+++ b/src/config/agent-settings.template.yml
@@ -1107,2 +1107,13 @@ continuity:
 
+# Session titles that sharpen as the session learns (`session-title` concern,
+# `agent-config session:title`). Claude Code names a session once, from its first
+# prompt; with this on, the agent is asked at a few prompt milestones whether the
+# goal can now be named more precisely, and publishes the better title in a
+# sidecar beside the transcript that Agent Switch and `sessions:catalog` read.
+# A title the user set with /rename is final and is never replaced.
+# A GLOBAL preference — set it once, user-global, and every checkout follows:
+#   agent-config settings:set sessions.auto_title false
+sessions:
+  auto_title: true
+
 # Automatic retro after merged work (ADR-292, docs/contracts/retro-v1.md).
diff --git a/src/scripts/_lib/agent_settings.ts b/src/scripts/_lib/agent_settings.ts
index 99a4964d96..6e839d9c94 100644
--- a/src/scripts/_lib/agent_settings.ts
+++ b/src/scripts/_lib/agent_settings.ts
@@ -308,2 +308,8 @@ export const MERGEABLE_KEYS: readonly string[] = [
     'retro.enabled',
+    // `sessions.auto_title` is a GLOBAL preference by the owner's request of
+    // 2026-11-26: whether session titles keep sharpening is decided once per
+    // developer, and `settings:set` writes it user-global — without this row the
+    // off switch it writes would be discarded at the merge. A project value
+    // still wins.
+    'sessions.auto_title',
 ];
diff --git a/src/scripts/_lib/session_catalog.ts b/src/scripts/_lib/session_catalog.ts
index daed1ad101..5e3840c280 100644
--- a/src/scripts/_lib/session_catalog.ts
+++ b/src/scripts/_lib/session_catalog.ts
@@ -30,2 +30,3 @@ import { claudeHomeInfo, codexHomeInfo } from './provider_home.js';
 import { iso_now, ttl_seconds_for } from './session_register.js';
+import { readRefinedTitle } from './session_title.js';
 import { DEFAULT_EVENT4U_ROOT_RELATIVE, type EnvMap, event4u_root } from './user_global_paths.js';
@@ -1208,3 +1209,4 @@ export function build_index(options: BuildOptions = {}): CatalogIndex {
             idle_seconds: idle,
-            title: st.title,
+            // User's own title > the agent's refined one (session_title.ts) > the host's.
+            title: st.title_custom ? st.title : (readRefinedTitle(t.file)?.title ?? st.title),
             roadmap_slug: rec?.roadmap_slug ?? null,
diff --git a/src/scripts/_lib/session_title.ts b/src/scripts/_lib/session_title.ts
new file mode 100644
index 0000000000..f0f04d55df
--- /dev/null
+++ b/src/scripts/_lib/session_title.ts
@@ -0,0 +1,267 @@
+/**
+ * Refined session titles — the shared half of the `session-title` concern and
+ * the `session:title` CLI.
+ *
+ * Claude Code writes its `ai-title` once, early, and then repeats the same value
+ * for the rest of the session, so a title chosen from the first prompt is the
+ * title forever. This module lets the agent replace it as the session's goal
+ * becomes clear, under one invariant: a title the USER set (`/rename`, recorded
+ * as a `custom-title` line) is final, and nothing here ever overrides it.
+ *
+ * Two files, deliberately separate:
+ *
+ * - the SIDECAR beside the transcript (`<session>.agent-title.json`) is the
+ *   published title. It sits next to the `.jsonl` so any reader that already
+ *   resolved a transcript (the session catalog, Agent Switch) finds it without
+ *   knowing this package's paths. The transcript itself is never written to:
+ *   Claude Code keeps re-appending its cached `ai-title`, which would bury an
+ *   appended line within a turn.
+ * - the STATE file under the user-global root counts prompts and maps the
+ *   session id to its transcript, so the CLI needs nothing but the id.
+ *
+ * Privacy: neither file holds prompt or reply text — a title, a counter, a path.
+ */
+import fs from "node:fs";
+import path from "node:path";
+import { write_atomic } from "./fs_atomic.js";
+import { event4u_root } from "./user_global_paths.js";
+
+export const SETTING_KEY = "sessions.auto_title";
+export const SIDECAR_SUFFIX = ".agent-title.json";
+/** The nudge asks for at most 60 characters; the writer enforces the same cap. */
+export const TITLE_MAX = 60;
+
+/**
+ * Prompt counts at which the agent is asked to reconsider the title. Spaced
+ * out because a title should change when the session learned something, not on
+ * a clock: early milestones catch the goal settling, later ones the scope
+ * moving. Past the last entry the cadence repeats every `REPEAT_EVERY` prompts.
+ */
+export const MILESTONES: readonly number[] = [3, 8, 20, 45, 100, 200];
+export const REPEAT_EVERY = 200;
+
+export function isMilestone(prompt: number): boolean {
+  if (MILESTONES.includes(prompt)) return true;
+  const last = MILESTONES[MILESTONES.length - 1] as number;
+  return prompt > last && (prompt - last) % REPEAT_EVERY === 0;
+}
+
+/** A session id as a filename stem; anything else collapses to `_`. */
+export function safeId(sessionId: string): string {
+  return sessionId.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "_").slice(0, 128) || "_";
+}
+
+export function sidecarPath(transcriptPath: string): string {
+  return transcriptPath.replace(/\.jsonl$/, "") + SIDECAR_SUFFIX;
+}
+
+/** Control characters and runaway length stripped; empty → null. */
+export function sanitizeTitle(raw: string): string | null {
+  const t = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
+  if (t === "") return null;
+  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1)}…` : t;
+}
+
+export interface SessionTitleState {
+  session_id: string;
+  transcript_path: string | null;
+  prompts: number;
+  last_nudge_prompt: number;
+  /** Set once a user title was seen; the concern stops reading and writing for this session. */
+  frozen: boolean;
+}
+
+export function stateDir(root: string = event4u_root()): string {
+  return path.join(root, "state", "session-titles");
+}
+
+export function readState(sessionId: string, root?: string): SessionTitleState | null {
+  try {
+    const raw = JSON.parse(fs.readFileSync(path.join(stateDir(root), `${safeId(sessionId)}.json`), "utf8"));
+    if (typeof raw !== "object" || raw === null || raw.session_id !== sessionId) return null;
+    return {
+      session_id: sessionId,
+      transcript_path: typeof raw.transcript_path === "string" ? raw.transcript_path : null,
+      prompts: Number.isInteger(raw.prompts) && raw.prompts >= 0 ? raw.prompts : 0,
+      last_nudge_prompt: Number.isInteger(raw.last_nudge_prompt) ? raw.last_nudge_prompt : 0,
+      frozen: raw.frozen === true,
+    };
+  } catch {
+    return null;
+  }
+}
+
+export function writeState(state: SessionTitleState, root?: string): void {
+  write_atomic(path.join(stateDir(root), `${safeId(state.session_id)}.json`), `${JSON.stringify(state)}\n`);
+}
+
+/** State files untouched this long belong to sessions nobody resumes. */
+export const STATE_TTL_MS = 60 * 24 * 60 * 60 * 1000;
+
+/** Drop state files older than `STATE_TTL_MS`; at most `limit` entries examined. Best-effort. */
+export function pruneState(root?: string, now: number = Date.now(), limit = 500): number {
+  let removed = 0;
+  try {
+    const dir = stateDir(root);
+    for (const name of fs.readdirSync(dir).slice(0, limit)) {
+      if (!name.endsWith(".json")) continue;
+      const file = path.join(dir, name);
+      try {
+        if (now - fs.statSync(file).mtimeMs > STATE_TTL_MS) {
+          fs.rmSync(file, { force: true });
+          removed++;
+        }
+      } catch {
+        // A file that vanished or cannot be read is skipped.
+      }
+    }
+  } catch {
+    // No state directory yet.
+  }
+  return removed;
+}
+
+/**
+ * The transcript a title may be written beside: an existing `<sessionId>.jsonl`.
+ * Binding the file name to the session id keeps the CLI from writing a sidecar
+ * beside an arbitrary path.
+ */
+export function transcriptFor(sessionId: string, transcriptPath: string): string | null {
+  if (path.basename(transcriptPath) !== `${sessionId}.jsonl`) return null;
+  try {
+    return fs.statSync(transcriptPath).isFile() ? transcriptPath : null;
+  } catch {
+    return null;
+  }
+}
+
+export interface RefinedTitle {
+  title: string;
+  updated_at: string;
+  revision: number;
+}
+
+export function readRefinedTitle(transcriptPath: string): RefinedTitle | null {
+  try {
+    const raw = JSON.parse(fs.readFileSync(sidecarPath(transcriptPath), "utf8"));
+    const title = typeof raw?.title === "string" ? sanitizeTitle(raw.title) : null;
+    if (title === null) return null;
+    return {
+      title,
+      updated_at: typeof raw.updated_at === "string" ? raw.updated_at : "",
+      revision: Number.isInteger(raw.revision) ? raw.revision : 1,
+    };
+  } catch {
+    return null;
+  }
+}
+
+export function writeRefinedTitle(transcriptPath: string, sessionId: string, title: string, now: Date = new Date()): RefinedTitle {
+  const prev = readRefinedTitle(transcriptPath);
+  const next: RefinedTitle = { title, updated_at: now.toISOString(), revision: (prev?.revision ?? 0) + 1 };
+  write_atomic(sidecarPath(transcriptPath), `${JSON.stringify({ schema: 1, session_id: sessionId, ...next })}\n`);
+  return next;
+}
+
+export interface HostTitles {
+  /** The user's own title (`/rename`); when set, the session title is frozen. */
+  custom: string | null;
+  /** The host's latest generated title. */
+  ai: string | null;
+}
+
+const CHUNK = 1 << 20;
+const CUSTOM_MARK = '"type":"custom-title"';
+const AI_MARK = '"type":"ai-title"';
+
+function titleFrom(line: string, key: string): string | null {
+  try {
+    const v = JSON.parse(line)?.[key];
+    return typeof v === "string" ? sanitizeTitle(v) : null;
+  } catch {
+    return null;
+  }
+}
+
+/**
+ * The host-side titles in one streaming pass. Only lines carrying a marker are
+ * parsed, so a 20 MB transcript costs a byte scan, not 20 MB of JSON. The last
+ * occurrence of each wins, as it does for the host.
+ */
+export function readHostTitles(transcriptPath: string): HostTitles {
+  const out: HostTitles = { custom: null, ai: null };
+  let fd: number;
+  try {
+    fd = fs.openSync(transcriptPath, "r");
+  } catch {
+    return out;
+  }
+  try {
+    const buf = Buffer.alloc(CHUNK);
+    let carry = "";
+    for (;;) {
+      const n = fs.readSync(fd, buf, 0, CHUNK, null);
+      if (n === 0) break;
+      const text = carry + buf.subarray(0, n).toString("utf8");
+      const lines = text.split("\n");
+      carry = lines.pop() ?? "";
+      for (const line of lines) scanLine(line, out);
+    }
+    if (carry !== "") scanLine(carry, out);
+  } catch {
+    // A transcript that cannot be read leaves whatever was found so far.
+  } finally {
+    fs.closeSync(fd);
+  }
+  return out;
+}
+
+function scanLine(line: string, out: HostTitles): void {
+  if (line.includes(CUSTOM_MARK)) out.custom = titleFrom(line, "customTitle") ?? out.custom;
+  else if (line.includes(AI_MARK)) out.ai = titleFrom(line, "aiTitle") ?? out.ai;
+}
+
+export const TAIL_BYTES = 64 * 1024;
+
+/**
+ * Whether the transcript's last `TAIL_BYTES` carry a user title. Claude Code
+ * re-appends a `custom-title` line as it does `ai-title`, so a /rename shows up
+ * in the tail within a turn; this is the per-prompt check, cheap enough to run on
+ * every prompt, and the full scan at a milestone remains the authority.
+ */
+export function tailHasCustomTitle(transcriptPath: string): boolean {
+  let fd: number;
+  try {
+    fd = fs.openSync(transcriptPath, "r");
+  } catch {
+    return false;
+  }
+  try {
+    const size = fs.fstatSync(fd).size;
+    const len = Math.min(size, TAIL_BYTES);
+    const buf = Buffer.alloc(len);
+    fs.readSync(fd, buf, 0, len, size - len);
+    return buf.toString("utf8").split("\n").some((l) => l.includes(CUSTOM_MARK) && titleFrom(l, "customTitle") !== null);
+  } catch {
+    return false;
+  } finally {
+    fs.closeSync(fd);
+  }
+}
+
+/** The title a reader should show: user's own > refined > host-generated. */
+export function effectiveTitle(transcriptPath: string): { title: string | null; source: "custom" | "refined" | "ai" | null } {
+  const host = readHostTitles(transcriptPath);
+  if (host.custom !== null) return { title: host.custom, source: "custom" };
+  const refined = readRefinedTitle(transcriptPath);
+  if (refined !== null) return { title: refined.title, source: "refined" };
+  return host.ai !== null ? { title: host.ai, source: "ai" } : { title: null, source: null };
+}
+
+/** `false` only when the setting is explicitly off; absent means on. */
+export function autoTitleEnabled(settings: Record<string, unknown>): boolean {
+  const sessions = settings["sessions"];
+  if (typeof sessions !== "object" || sessions === null) return true;
+  const v = (sessions as Record<string, unknown>)["auto_title"];
+  return !(v === false || v === "false" || v === "off");
+}
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 895bcbccce..97bf26ae96 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1129,2 +1129,15 @@ concerns:
     effect: context
+  # Session titles that sharpen as the session learns. Claude Code writes its
+  # `ai-title` once and repeats it; at prompt milestones (3, 8, 20, 45, 100,
+  # 200, then every 200) this asks the agent whether the goal can now be named more
+  # precisely and how to publish it (`agent-config session:title`). Silent
+  # between milestones, after the user renamed the session (a `custom-title`
+  # is final), and when `sessions.auto_title: false` — a global setting, on by
+  # default. Claude only: no other host writes a title this could refine.
+  session-title:
+    script: src/scripts/hooks/session_title_hook.ts
+    args: []
+    fail_closed: false
+    severity: advisory
+    effect: context
   # deliberation.mode (off|offer|auto) for THIS session: one line telling the
@@ -1785,3 +1798,3 @@ roles:
     # exact baseline Phase 0 pre-registers.
-    drop: [delegation-nudge, skill-route, intake-pass, deliberation-mode, end-review-nudge, review-baseline, council-availability, team-review-gate, self-repair, session-eol, interruption-ledger]
+    drop: [delegation-nudge, skill-route, intake-pass, deliberation-mode, end-review-nudge, review-baseline, council-availability, team-review-gate, self-repair, session-eol, interruption-ledger, session-title]
 
@@ -1827,3 +1840,3 @@ platforms:
     stop:             [chat-history, verify-before-complete, team-review-gate, end-review-nudge, obligation-settle, turn-end-gate, self-repair, session-register, session-eol, interruption-ledger, roadmap-progress, design-pass-stop, suggestion-capture, code-graph-refresh, journal-record]
-    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, delegation-nudge, skill-route, git-authorization, session-canary, self-repair, session-register, rule-inject, suggestion-capture, journal-record, quota-notice, intake-pass, deliberation-mode]
+    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, delegation-nudge, skill-route, git-authorization, session-canary, self-repair, session-register, rule-inject, suggestion-capture, journal-record, quota-notice, intake-pass, deliberation-mode, session-title]
     # `rule-inject` was bound here and is not any more
diff --git a/src/scripts/hooks/session_title_hook.ts b/src/scripts/hooks/session_title_hook.ts
new file mode 100644
index 0000000000..580db0fd73
--- /dev/null
+++ b/src/scripts/hooks/session_title_hook.ts
@@ -0,0 +1,143 @@
+/**
+ * session-title — asks the agent, at a few prompt milestones, whether the
+ * session title can now be named more precisely, and how to set it.
+ *
+ * The agent writes the title (`agent-config session:title`); this concern only
+ * counts prompts and decides when to ask. It stays silent once the user renamed
+ * the session — a user-set title is final — and when `sessions.auto_title` is
+ * `false` (a global setting, on by default). Never blocks: every failure path
+ * returns allow.
+ */
+import fs from "node:fs";
+import path from "node:path";
+import { fileURLToPath, pathToFileURL } from "node:url";
+import { readHookStdin } from "./hook_stdin.js";
+import { isSyntheticPrompt } from "../_lib/prompt_shape.js";
+import { load_agent_settings } from "../_lib/agent_settings.js";
+import {
+  autoTitleEnabled,
+  isMilestone,
+  pruneState,
+  readHostTitles,
+  readRefinedTitle,
+  readState,
+  tailHasCustomTitle,
+  writeState,
+  type SessionTitleState,
+} from "../_lib/session_title.js";
+import { EXIT_ALLOW, EXIT_WARN } from "./exit_codes.js";
+
+type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
+type JsonObject = { [k: string]: JsonValue };
+
+function _isObject(v: JsonValue | undefined): v is JsonObject {
+  return typeof v === "object" && v !== null && !Array.isArray(v);
+}
+
+function _str(v: JsonValue | undefined): string | null {
+  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
+}
+
+function _extractPrompt(payload: JsonObject): string {
+  for (const key of ["prompt", "userPrompt", "user_prompt", "message", "text"]) {
+    const v = payload[key];
+    if (typeof v === "string" && v.trim()) return v;
+  }
+  return "";
+}
+
+export function nudgeLine(sessionId: string, prompt: number, current: string | null): string {
+  const now = current === null ? "none yet" : `«${current}»`;
+  return (
+    `<session-title>Prompt ${prompt}: the session title is ${now}. If what you now know names this ` +
+    `session's goal more precisely, run \`agent-config session:title --session ${sessionId} "<title>"\` once ` +
+    `alongside your work — at most 60 characters, in the user's language, naming the deliverable rather than ` +
+    `the activity. Still accurate → do nothing. Do not mention this to the user.</session-title>`
+  );
+}
+
+export interface TickInput {
+  sessionId: string;
+  transcriptPath: string;
+  prompt: string;
+  root?: string;
+}
+
+/** One prompt counted; returns the nudge to inject, or null. */
+export function tick(input: TickInput): string | null {
+  const text = input.prompt.trim();
+  if (text === "" || isSyntheticPrompt(text)) return null;
+  const prev = readState(input.sessionId, input.root);
+  if (prev?.frozen === true) return null;
+  if (tailHasCustomTitle(input.transcriptPath)) {
+    if (prev !== null) writeState({ ...prev, transcript_path: input.transcriptPath, frozen: true }, input.root);
+    else writeState({ session_id: input.sessionId, transcript_path: input.transcriptPath, prompts: 0, last_nudge_prompt: 0, frozen: true }, input.root);
+    return null;
+  }
+  const state: SessionTitleState = {
+    session_id: input.sessionId,
+    transcript_path: input.transcriptPath,
+    prompts: (prev?.prompts ?? 0) + 1,
+    last_nudge_prompt: prev?.last_nudge_prompt ?? 0,
+    frozen: false,
+  };
+  let nudge: string | null = null;
+  if (isMilestone(state.prompts)) {
+    const host = readHostTitles(input.transcriptPath);
+    if (host.custom === null) {
+      nudge = nudgeLine(input.sessionId, state.prompts, readRefinedTitle(input.transcriptPath)?.title ?? host.ai);
+      state.last_nudge_prompt = state.prompts;
+      pruneState(input.root);
+    } else {
+      state.frozen = true;
+    }
+  }
+  writeState(state, input.root);
+  return nudge;
+}
+
+export function main(): number {
+  let envelope: JsonValue = {};
+  try {
+    const raw = readHookStdin();
+    envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
+  } catch {
+    return EXIT_ALLOW;
+  }
+  try {
+    const env: JsonObject = _isObject(envelope) ? envelope : {};
+    const event = env["event"];
+    if (typeof event === "string" && event !== "" && event !== "user_prompt_submit") return EXIT_ALLOW;
+    const payload = _isObject(env["payload"]) ? (env["payload"] as JsonObject) : env;
+    const sessionId = _str(env["session_id"]) ?? _str(payload["session_id"]);
+    const transcriptPath = _str(payload["transcript_path"]);
+    if (sessionId === null || transcriptPath === null) return EXIT_ALLOW;
+    const root = _str(env["workspace_root"]) ?? process.cwd();
+    if (!autoTitleEnabled(load_agent_settings({ cwd: root }) as Record<string, unknown>)) return EXIT_ALLOW;
+    const nudge = tick({ sessionId, transcriptPath, prompt: _extractPrompt(payload) });
+    if (nudge === null) return EXIT_ALLOW;
+    process.stdout.write(
+      `${JSON.stringify({ decision: "warn", reason: "session-title: milestone", additional_context: nudge })}\n`,
+    );
+    return EXIT_WARN;
+  } catch {
+    return EXIT_ALLOW;
+  }
+}
+
+// Bundle-safety: never auto-run when inlined into an esbuild bundle.
+declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
+function _isCliEntry(): boolean {
+  if (typeof __AGENT_CONFIG_BUNDLE__ !== "undefined" && __AGENT_CONFIG_BUNDLE__) return false;
+  if (process.argv[1] === undefined) return false;
+  if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
+  try {
+    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
+  } catch {
+    return false;
+  }
+}
+
+if (_isCliEntry()) {
+  process.exit(main());
+}
diff --git a/src/scripts/session_title_cli.ts b/src/scripts/session_title_cli.ts
new file mode 100644
index 0000000000..7497f547ac
--- /dev/null
+++ b/src/scripts/session_title_cli.ts
@@ -0,0 +1,94 @@
+#!/usr/bin/env node
+/**
+ * `agent-config session:title` — set or show the refined title of a session.
+ *
+ *   session:title --session <id> "<title>"   publish a refined title
+ *   session:title --session <id> --show      print the title a reader would show
+ *
+ * A title the user set with `/rename` is final: setting is refused, with exit 0,
+ * because an agent that follows the `session-title` nudge did nothing wrong.
+ * `sessions.auto_title: false` refuses the same way.
+ */
+import path from 'node:path';
+import process from 'node:process';
+import { fileURLToPath } from 'node:url';
+
+import { load_agent_settings } from './_lib/agent_settings.js';
+import { clean_title } from './_lib/session_catalog.js';
+import {
+    SETTING_KEY,
+    autoTitleEnabled,
+    effectiveTitle,
+    readHostTitles,
+    readState,
+    sanitizeTitle,
+    transcriptFor,
+    writeRefinedTitle,
+} from './_lib/session_title.js';
+
+function usage(): number {
+    process.stderr.write('usage: agent-config session:title --session <id> ("<title>" | --show) [--transcript <path>]\n');
+    return 2;
+}
+
+export interface TitleCliOptions {
+    cwd?: string;
+    root?: string;
+    out?: (line: string) => void;
+    err?: (line: string) => void;
+}
+
+export function cmd_session_title(argv: string[] = process.argv.slice(2), opts: TitleCliOptions = {}): number {
+    const out = opts.out ?? ((l: string) => process.stdout.write(`${l}\n`));
+    const err = opts.err ?? ((l: string) => process.stderr.write(`${l}\n`));
+    let sessionId: string | null = null;
+    let transcript: string | null = null;
+    let show = false;
+    const words: string[] = [];
+    for (let i = 0; i < argv.length; i++) {
+        const a = argv[i] as string;
+        if (a === '--session') sessionId = argv[++i] ?? null;
+        else if (a === '--transcript') transcript = argv[++i] ?? null;
+        else if (a === '--show') show = true;
+        else if (a === '-h' || a === '--help') return usage();
+        else words.push(a);
+    }
+    if (sessionId === null || sessionId.trim() === '') return usage();
+    const candidate = transcript ?? readState(sessionId, opts.root)?.transcript_path ?? null;
+    if (candidate === null) {
+        err(`session:title: no transcript known for session ${sessionId} — pass --transcript <path>`);
+        return 1;
+    }
+    const transcriptPath = transcriptFor(sessionId, candidate);
+    if (transcriptPath === null) {
+        err(`session:title: ${candidate} is not an existing ${sessionId}.jsonl — refusing to write beside it`);
+        return 1;
+    }
+    if (show) {
+        const t = effectiveTitle(transcriptPath);
+        out(t.title === null ? '(untitled)' : `${t.title} [${t.source}]`);
+        return 0;
+    }
+    if (words.length === 0) return usage();
+    const settings = load_agent_settings({ cwd: opts.cwd ?? process.cwd() }) as Record<string, unknown>;
+    if (!autoTitleEnabled(settings)) {
+        out(`session:title: skipped — ${SETTING_KEY} is false`);
+        return 0;
+    }
+    const custom = readHostTitles(transcriptPath).custom;
+    if (custom !== null) {
+        out(`session:title: skipped — the user named this session «${custom}»; that title is final`);
+        return 0;
+    }
+    const title = sanitizeTitle(clean_title(words.join(' ')));
+    if (title === null) return usage();
+    const written = writeRefinedTitle(transcriptPath, sessionId, title);
+    out(`session:title: «${written.title}» (revision ${written.revision})`);
+    return 0;
+}
+
+declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
+const _bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
+if (!_bundled && fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
+    process.exit(cmd_session_title());
+}
diff --git a/tests/lib/agent_settings.test.ts b/tests/lib/agent_settings.test.ts
index fe3fc18661..cceb2ef9d7 100644
--- a/tests/lib/agent_settings.test.ts
+++ b/tests/lib/agent_settings.test.ts
@@ -335,0 +336,3 @@ describe('MERGEABLE_KEYS', () => {
+            // ADR-305: a global preference by the owner's request; `settings:set`
+            // writes it user-global, so the off switch must survive the merge.
+            'sessions.auto_title',
diff --git a/tests/scripts/hook_role_axis.test.ts b/tests/scripts/hook_role_axis.test.ts
index 3ccc75c9b5..3261269acf 100644
--- a/tests/scripts/hook_role_axis.test.ts
+++ b/tests/scripts/hook_role_axis.test.ts
@@ -58,0 +59,2 @@ const WORKER_DROP = [
+    // ADR-305: the title belongs to the user's session, not to a worker slice.
+    'session-title',
diff --git a/tests/scripts/lint_hook_manifest.test.ts b/tests/scripts/lint_hook_manifest.test.ts
index 5035fb82ff..3a0c97e497 100644
--- a/tests/scripts/lint_hook_manifest.test.ts
+++ b/tests/scripts/lint_hook_manifest.test.ts
@@ -384 +384,2 @@ describe("effect: — the census's field (Phase 2.2)", () => {
-    expect(names.length).toBe(77);
+    // and 78 since `session-title` (ADR-305).
+    expect(names.length).toBe(78);

Full file tests/hooks/session_title_hook.test.ts at 4aaf9d7b09:
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin.js';
import { main, tick } from '../../src/scripts/hooks/session_title_hook.js';
import {
    MILESTONES,
    REPEAT_EVERY,
    STATE_TTL_MS,
    TITLE_MAX,
    effectiveTitle,
    pruneState,
    stateDir,
    isMilestone,
    readHostTitles,
    readState,
    sidecarPath,
    writeRefinedTitle,
} from '../../src/scripts/_lib/session_title.js';
import { cmd_session_title } from '../../src/scripts/session_title_cli.js';

let tmp: string;
let root: string;
let transcript: string;
const SID = 'abc-123';

function line(o: Record<string, unknown>): string {
    return `${JSON.stringify(o)}\n`;
}

function transcriptWith(...lines: Record<string, unknown>[]): void {
    fs.writeFileSync(transcript, lines.map(line).join(''));
}

/** Count `n` real prompts, returning every nudge emitted. */
function prompts(n: number): (string | null)[] {
    const out: (string | null)[] = [];
    for (let i = 0; i < n; i++) out.push(tick({ sessionId: SID, transcriptPath: transcript, prompt: `task ${i}`, root }));
    return out;
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'session-title-'));
    root = path.join(tmp, 'event4u');
    vi.stubEnv('EVENT4U_CONFIG_HOME', root);
    transcript = path.join(tmp, 'projects', 'p', `${SID}.jsonl`);
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
    transcriptWith({ type: 'user', cwd: tmp }, { type: 'ai-title', aiTitle: 'Fix stuff', sessionId: SID });
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.unstubAllEnvs();
});

describe('isMilestone', () => {
    it('fires on each listed milestone and then on the repeat cadence, nowhere else', () => {
        const last = MILESTONES[MILESTONES.length - 1] as number;
        const fired = Array.from({ length: last + 3 * REPEAT_EVERY }, (_, i) => i + 1).filter(isMilestone);
        expect(fired).toEqual([...MILESTONES, last + REPEAT_EVERY, last + 2 * REPEAT_EVERY, last + 3 * REPEAT_EVERY]);
    });
});

describe('tick', () => {
    it('nudges only at milestones, naming the current host title and the session id', () => {
        const out = prompts(MILESTONES[1] as number);
        const nudged = out.map((n, i) => (n === null ? null : i + 1)).filter((x) => x !== null);
        expect(nudged).toEqual([MILESTONES[0], MILESTONES[1]]);
        expect(out[(MILESTONES[0] as number) - 1]).toContain('«Fix stuff»');
        expect(out[(MILESTONES[0] as number) - 1]).toContain(`--session ${SID}`);
        expect(readState(SID, root)).toMatchObject({ prompts: MILESTONES[1], transcript_path: transcript });
    });

    it('shows the refined title, not the host one, once the agent set one', () => {
        writeRefinedTitle(transcript, SID, 'Refactor billing export');
        const out = prompts(MILESTONES[0] as number);
        expect(out.at(-1)).toContain('«Refactor billing export»');
    });

    it('stays silent for good once the user renamed the session, and stops counting', () => {
        fs.appendFileSync(transcript, line({ type: 'custom-title', customTitle: 'Mine', sessionId: SID }));
        expect(prompts(MILESTONES[2] as number).every((n) => n === null)).toBe(true);
        expect(readState(SID, root)).toMatchObject({ frozen: true, prompts: 0 });
    });

    it('freezes on the first prompt after a /rename between milestones, not at the next milestone', () => {
        prompts((MILESTONES[0] as number) + 1);
        fs.appendFileSync(transcript, line({ type: 'custom-title', customTitle: 'Mine', sessionId: SID }));
        expect(prompts(1)).toEqual([null]);
        expect(readState(SID, root)).toMatchObject({ frozen: true, prompts: (MILESTONES[0] as number) + 1 });
        expect(prompts(MILESTONES[2] as number).every((n) => n === null)).toBe(true);
        expect(readState(SID, root)?.prompts).toBe((MILESTONES[0] as number) + 1);
    });

    it('prunes state files nobody touched within the TTL, and keeps fresh ones', () => {
        prompts(1);
        const dir = stateDir(root);
        const old = path.join(dir, 'old-session.json');
        fs.writeFileSync(old, '{}');
        const past = (Date.now() - STATE_TTL_MS - 60_000) / 1000;
        fs.utimesSync(old, past, past);
        expect(pruneState(root)).toBe(1);
        expect(fs.existsSync(old)).toBe(false);
        expect(readState(SID, root)).not.toBeNull();
    });

    it('does not count harness turns as prompts', () => {
        for (let i = 0; i < 5; i++) tick({ sessionId: SID, transcriptPath: transcript, prompt: '<task-notification>x', root });
        expect(readState(SID, root)).toBeNull();
    });
});

describe('readHostTitles', () => {
    it('takes the last title of each kind, across read-chunk boundaries', () => {
        const filler = line({ type: 'assistant', text: 'x'.repeat(1024) }).repeat(1500);
        fs.writeFileSync(
            transcript,
            line({ type: 'ai-title', aiTitle: 'Old' }) + filler + line({ type: 'ai-title', aiTitle: 'New' }),
        );
        expect(fs.statSync(transcript).size).toBeGreaterThan(1 << 20);
        expect(readHostTitles(transcript)).toEqual({ custom: null, ai: 'New' });
    });
});

describe('main', () => {
    function run(workspace: string): { rc: number; out: string } {
        let out = '';
        const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
            out += String(chunk);
            return true;
        });
        setHookStdinOverride(
            JSON.stringify({
                event: 'user_prompt_submit',
                session_id: SID,
                workspace_root: workspace,
                payload: { prompt: 'add the export', transcript_path: transcript },
            }),
        );
        try {
            return { rc: main(), out };
        } finally {
            spy.mockRestore();
            clearHookStdinOverride();
        }
    }

    it('emits the nudge at a milestone by default, and nothing when sessions.auto_title is false', () => {
        const on =path.join(tmp, 'on');
        fs.mkdirSync(on);
        const outs = Array.from({ length: MILESTONES[0] as number }, () => run(on));
        expect(outs.at(-1)?.out).toContain('session-title: milestone');
        expect(outs.slice(0, -1).every((r) => r.out === '')).toBe(true);

        const off = path.join(tmp, 'off');
        fs.mkdirSync(off);
        fs.writeFileSync(path.join(off, '.agent-settings.yml'), 'sessions:\n  auto_title: false\n');
        fs.rmSync(path.join(root, 'state'), { recursive: true, force: true });
        const silent = Array.from({ length: MILESTONES[1] as number }, () => run(off));
        expect(silent.every((r) => r.out === '')).toBe(true);
    });
});

describe('session:title CLI', () => {
    function cli(...argv: string[]): { rc: number; out: string[] } {
        const out: string[] = [];
        const rc = cmd_session_title(argv, { cwd: tmp, root, out: (l) => out.push(l), err: (l) => out.push(l) });
        return { rc, out };
    }

    it('publishes a refined title the readers prefer over the host title, revision by revision', () => {
        prompts(1);
        expect(cli('--session', SID, 'Billing', 'export').rc).toBe(0);
        expect(cli('--session', SID, 'Billing CSV export').out[0]).toContain('revision 2');
        expect(JSON.parse(fs.readFileSync(sidecarPath(transcript), 'utf8'))).toMatchObject({ title: 'Billing CSV export', revision: 2 });
        expect(effectiveTitle(transcript)).toEqual({ title: 'Billing CSV export', source: 'refined' });
    });

    it('never overrides a title the user set', () => {
        prompts(1);
        fs.appendFileSync(transcript, line({ type: 'custom-title', customTitle: 'Mine' }));
        const r = cli('--session', SID, 'Something else');
        expect(r.rc).toBe(0);
        expect(r.out[0]).toContain('final');
        expect(fs.existsSync(sidecarPath(transcript))).toBe(false);
        expect(effectiveTitle(transcript)).toEqual({ title: 'Mine', source: 'custom' });
    });

    it('caps a title at the length the nudge asks for', () => {
        prompts(1);
        cli('--session', SID, 'x'.repeat(200));
        const t = JSON.parse(fs.readFileSync(sidecarPath(transcript), 'utf8')).title as string;
        expect(t.length).toBe(TITLE_MAX);
    });

    it('refuses to write beside a file that is not this session\'s transcript', () => {
        const other = path.join(tmp, 'elsewhere.jsonl');
        fs.writeFileSync(other, '');
        expect(cli('--session', SID, '--transcript', other, 'Hijack').rc).toBe(1);
        expect(fs.existsSync(sidecarPath(other))).toBe(false);
        expect(cli('--session', SID, '--transcript', path.join(tmp, `${SID}.jsonl`), 'Missing').rc).toBe(1);
    });

    it('fails with a hint when the session is unknown, and rejects a missing title', () => {
        expect(cli('--session', 'nope', 'x').rc).toBe(1);
        prompts(1);
        expect(cli('--session', SID).rc).toBe(2);
    });
});

jq -S diff of src/scripts/hook_manifest.json, merge base against head:
2,3c2,3
<   "body_fingerprint": "837675674723d6852f605622bfd545ef9574c3242510e4d60081389cf4385cdc:23591",
<   "fingerprint": "f4a050958d1afd52e3f1d8847a63783fe6a79677335923ea924138f6b9d2f240:124189",
---
>   "body_fingerprint": "32d1a8228480598507056bbf0239788a3ca261b846b7db9caf08a862570781c4:23763",
>   "fingerprint": "a52ff7f10b65a1becdcdd0f8c21baf0e7ba21f2e75984add941407e01ee8fd36:124911",
566a567,573
>       "session-title": {
>         "args": [],
>         "effect": "context",
>         "fail_closed": false,
>         "script": "src/scripts/hooks/session_title_hook.ts",
>         "severity": "advisory"
>       },
1013c1020,1021
<           "deliberation-mode"
---
>           "deliberation-mode",
>           "session-title"
1339c1347,1348
<           "interruption-ledger"
---
>           "interruption-ledger",
>           "session-title"

Answer each of these, one at a time, keyed by number:
1. What behaviour changes, including what follows from it that the diff does not state?
2. Which authority or safety boundary becomes wider or narrower, and in which direction?
3. Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?
4. Is another host or projection left as a way around the control this change touches?
5. Can it be undone, and how — by whom, with what authority, and against which revision?
6. What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?
7. Would a smaller change do, and what does the larger one buy that the smaller one does not?
8. What does it add to standing instruction weight that every later session pays?
9. Could untrusted content steer the path this change opens, and what bounds it if so?

Close with exactly one line, as the last line of your reply, in plain text: no markdown, no bold, no bullet, all three fields on that one line, separated by " | ", in this shape:
STANCE: <ratified|confirmed-non-expanding|refused> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>
~~~
