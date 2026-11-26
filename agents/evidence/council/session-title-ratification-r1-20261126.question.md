<!-- evidence-type: original-review -->

# Ratification prompt, round 1 — the `session-title` user_prompt_submit concern (verbatim, as sent 2026-11-26)

~~~text
Ratification review, round 1, of one change touching two files on this repository's ratification watched set: src/scripts/hook_manifest.yaml and its compiled src/scripts/hook_manifest.json.

subject: cd3eca2c01df0360e4f9949228862d0cf2f18863885cb16f932e8dd7429cdf31

(The digest covers those two gated files at commit 3644d9b413, computed with ./scripts-run src/scripts/ratification_subject --base-ref origin/main; merge base 3c75931f13.)

Closed verdicts (ADR-268 § 4): ratified (an approved expansion of what an agent may do) · confirmed-non-expanding (no authority expanded, no gate weakened, no enforcing step made non-enforcing) · refused (must not land).

Background, as observed: Claude Code writes an ai-title line into each session transcript once, early, and then re-appends the same value for the rest of the session. Across the eight most recent transcripts of this checkout each carried exactly one distinct ai-title value, repeated between 6 and 452 times. sessions:catalog and the external tool Agent Switch list sessions by that title, so a session keeps the name of its first prompt. The repository owner asked, verbatim: "Können wir dafür sorgen, dass der Name einer Session sich immer weiter verbessert und klarer wird, je mehr Informationen wir haben? Und nur wenn der Nutzer selbst die Session umbenennt, dann ändern wir ihn nicht mehr. Aber so hätten wir in Agent Switch eine Bessere Darstellung der Sessions. Das ganze könenn wir ja so gestalten, dass man es über eine Anweisung ein und ausschalten kann. Per default ist es aber an. Und es ist eine globale einstellung." Offered three ways to phrase the better title (the agent itself on a nudge, a separate small-model call from the hook, a deterministic rule from branch and PR), the owner chose the agent itself. Recorded in agents/evidence/owner-directives/2026-11-26-session-titles-that-sharpen.md and ADR-305.

What the change does: a new concern session-title (src/scripts/hooks/session_title_hook.ts), severity advisory, effect context, fail_closed false, bound on claude user_prompt_submit only, added to the worker role's drop list. On each non-harness prompt it increments a per-session counter in <user-global root>/state/session-titles/<id>.json (session id, transcript path, prompt count, last nudge; no prompt text). At prompts 3, 8, 20, 45, 100 and every 100 after, it streams the transcript for title markers; if no custom-title line (the user's /rename) exists, it injects one line asking the agent whether the session goal can now be named more precisely and, if so, to run agent-config session:title --session <id> "<title>" once, at most 60 characters. It never denies, never rewrites the prompt, and returns allow on every error. It is silent when sessions.auto_title is false: a new class-A setting, default true, whitelisted in MERGEABLE_KEYS so a user-global value survives the merge. The CLI writes <session>.agent-title.json beside the transcript (title masked for token-shaped runs, capped at 80 characters, atomic write), refuses with exit 0 when a custom-title exists or the setting is false, and never writes the transcript. sessions:catalog now prefers custom-title, then the sidecar, then ai-title. The body ships as a lazy chunk (46,766 B); the dispatch bundle gains one LAZY_CONCERNS row and measures 1,602,250 B against the unchanged 1,915,000 B backstop. It is admitted in agents/decisions/concern-admissions.jsonl, its +1 concern_count is claimed in a new stub roadmap, and the CLI count budget moves 130 -> 131 in the same change.

Measured by the author before this review, on the author's machine: 10 tests in tests/hooks/session_title_hook.test.ts pass; with the setting check replaced by "return true" the off-switch test fails (1 of 10). tsc --noEmit clean. check_settings_classes (120 keys, A=12), check_concern_admissions, check_hook_bundle_composition, check_generator_sync, check_estate_count against origin/main, runtime_dependencies and check_cli_registry_budget_sync pass.

Scope of what is shown, narrowed to fit the council's 51,200-byte bundle ceiling: the diff against the merge base, one line of context, of every source file the change touches; the gated hook_manifest.json as a key-sorted jq -S diff of base against head; the concern-admissions row and the three pinned-list test edits with no context. Not shown, and what each changes: tests/hooks/session_title_hook.test.ts (new, 10 tests, names below); docs/decisions/ADR-305-session-titles-that-sharpen.md (new, records the decision above and the three rejected alternatives); agents/evidence/owner-directives/2026-11-26-session-titles-that-sharpen.md (new, the verbatim directive quoted above); agents/roadmaps/stubs/road-to-session-titles-beyond-claude.md (new stub: other hosts and a compliance measurement stay open; carries the estate_growth_exempt line for +1 concern_count); docs/contracts/settings-classes.md (one table row for sessions.auto_title, class A, default true, disposition un-inferrable; counts A 11 -> 12, total 119 -> 120, un-inferrable 12 -> 13; one dated history paragraph); src/scripts/_dispatch.bash beyond the hunks shown also adds session_title_cli to the one-line SCRIPT_DELEGATES list; src/config/evaluator-budgets.json changes only budgets.cli_help_command_count: max and last_measured 130 -> 131, last_measured_at -> 2026-11-26, one sentence appended to baseline_note; agents/evidence/metrics/evaluator-measurements.json regenerated with cli_help_command_count 131 by record_evaluator_measurements.mjs; dist/install/install.mjs, docs/decisions/INDEX.md and the ADR evidence census regenerated.

Test names in tests/hooks/session_title_hook.test.ts: isMilestone · fires on each listed milestone and then on the repeat cadence, nowhere else · tick · nudges only at milestones, naming the current host title and the session id · shows the refined title, not the host one, once the agent set one · stays silent for good once the user renamed the session, but keeps counting · does not count harness turns as prompts · readHostTitles · takes the last title of each kind, across read-chunk boundaries · main · emits the nudge at a milestone by default, and nothing when sessions.auto_title is false · session:title CLI · publishes a refined title the readers prefer over the host title, revision by revision · never overrides a title the user set · fails with a hint when the session is unknown, and rejects a missing title

diff --git a/src/cli/registry.ts b/src/cli/registry.ts
index f1538a3b09..624ffcce0b 100644
--- a/src/cli/registry.ts
+++ b/src/cli/registry.ts
@@ -88,2 +88,3 @@ export const REGISTRY: readonly CommandEntry[] = [
     { name: 'sessions:catalog', disposition: 'delegate', synopsis: 'Every Claude Code and Codex session on this machine, newest first, with profile, model, repos/branches, tokens and resume command; refreshes sessions.json + SESSIONS.md; --json, --all, --status, --live.' },
+    { name: 'session:title', disposition: 'delegate', synopsis: 'Set (or --show) the refined title of a session; a title the user set with /rename is never overridden.' },
     { name: 'sessions:claim', disposition: 'delegate', synopsis: 'Claim a roadmap for this session so other sessions skip it; --release clears it.' },
diff --git a/src/config/agent-settings.template.yml b/src/config/agent-settings.template.yml
index 3a20847a30..22010fc9fc 100644
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
diff --git a/src/scripts/_cli/cmd_script.ts b/src/scripts/_cli/cmd_script.ts
index 7099b2e4db..fe3c769796 100644
--- a/src/scripts/_cli/cmd_script.ts
+++ b/src/scripts/_cli/cmd_script.ts
@@ -114,2 +114,3 @@ export const DELEGATES: Readonly<Record<string, Delegate>> = {
     sessions_cli: d(async (a) => (await import('../sessions_cli.js')).main(a), true),
+    session_title_cli: d(async (a) => (await import('../session_title_cli.js')).cmd_session_title(a), true),
     workspace_doctor: d(async (a) => (await import('../workspace_doctor.js')).main(a), true),
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
index 0000000000..ebfda3164a
--- /dev/null
+++ b/src/scripts/_lib/session_title.ts
@@ -0,0 +1,195 @@
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
+export const TITLE_MAX = 80;
+
+/**
+ * Prompt counts at which the agent is asked to reconsider the title. Spaced
+ * out because a title should change when the session learned something, not on
+ * a clock: early milestones catch the goal settling, later ones the scope
+ * moving. Past the last entry the cadence repeats every `REPEAT_EVERY` prompts.
+ */
+export const MILESTONES: readonly number[] = [3, 8, 20, 45, 100];
+export const REPEAT_EVERY = 100;
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
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index 489ae07d60..7ab6adfbb7 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -120,2 +120,9 @@ export const HOOK_CHUNKS = Object.freeze([
     }),
+    // `session-title` on claude `user_prompt_submit`. `yaml` external for the
+    // reason given at `chat_history`: the concern reads `sessions.auto_title`.
+    Object.freeze({
+        entry: 'src/scripts/hooks/session_title_hook.ts',
+        outfile: 'dist/hooks/session_title.chunk.cjs',
+        external: Object.freeze(['yaml']),
+    }),
     // `arena-route` on claude `pre_tool_use`, Workflow calls only; reads no YAML.
diff --git a/src/scripts/hook_manifest.yaml b/src/scripts/hook_manifest.yaml
index 263b2b7805..5b613ec0c3 100644
--- a/src/scripts/hook_manifest.yaml
+++ b/src/scripts/hook_manifest.yaml
@@ -1129,2 +1129,15 @@ concerns:
     effect: context
+  # Session titles that sharpen as the session learns. Claude Code writes its
+  # `ai-title` once and repeats it; at prompt milestones (3, 8, 20, 45, 100,
+  # then every 100) this asks the agent whether the goal can now be named more
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
   # road-to-trigger-delivered-rule-bodies Phase 1 — the DELIVERY twin of
@@ -1763,3 +1776,3 @@ roles:
     # exact baseline Phase 0 pre-registers.
-    drop: [delegation-nudge, skill-route, intake-pass, end-review-nudge, review-baseline, council-availability, team-review-gate, self-repair, session-eol, interruption-ledger]
+    drop: [delegation-nudge, skill-route, intake-pass, end-review-nudge, review-baseline, council-availability, team-review-gate, self-repair, session-eol, interruption-ledger, session-title]
 
@@ -1805,3 +1818,3 @@ platforms:
     stop:             [chat-history, verify-before-complete, team-review-gate, end-review-nudge, obligation-settle, turn-end-gate, self-repair, session-register, session-eol, interruption-ledger, roadmap-progress, design-pass-stop, suggestion-capture, code-graph-refresh, journal-record]
-    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, delegation-nudge, skill-route, git-authorization, session-canary, self-repair, session-register, rule-inject, suggestion-capture, journal-record, quota-notice, intake-pass]
+    user_prompt_submit: [chat-history, verify-before-complete, minimal-safe-diff, language-mirror, delegation-nudge, skill-route, git-authorization, session-canary, self-repair, session-register, rule-inject, suggestion-capture, journal-record, quota-notice, intake-pass, session-title]
     # `rule-inject` was bound here and is not any more
diff --git a/src/scripts/hooks/lazy_concern.ts b/src/scripts/hooks/lazy_concern.ts
index 5ec1a78ea1..03f2ce78ec 100644
--- a/src/scripts/hooks/lazy_concern.ts
+++ b/src/scripts/hooks/lazy_concern.ts
@@ -71,2 +71,3 @@ export const LAZY_CONCERNS: Readonly<Record<string, { readonly chunk: string; re
     'src/scripts/hooks/intake_pass_hook.ts': lazy('intake_pass.chunk.cjs', 'intake_pass_hook'),
+    'src/scripts/hooks/session_title_hook.ts': lazy('session_title.chunk.cjs', 'session_title_hook'),
     'src/scripts/hooks/arena_route_hook.ts': lazy('arena_route.chunk.cjs', 'arena_route_hook'),
diff --git a/src/scripts/hooks/session_title_hook.ts b/src/scripts/hooks/session_title_hook.ts
new file mode 100644
index 0000000000..64b2485568
--- /dev/null
+++ b/src/scripts/hooks/session_title_hook.ts
@@ -0,0 +1,131 @@
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
+  readHostTitles,
+  readRefinedTitle,
+  readState,
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
+  const state: SessionTitleState = {
+    session_id: input.sessionId,
+    transcript_path: input.transcriptPath,
+    prompts: (prev?.prompts ?? 0) + 1,
+    last_nudge_prompt: prev?.last_nudge_prompt ?? 0,
+  };
+  let nudge: string | null = null;
+  if (isMilestone(state.prompts)) {
+    const host = readHostTitles(input.transcriptPath);
+    if (host.custom === null) {
+      nudge = nudgeLine(input.sessionId, state.prompts, readRefinedTitle(input.transcriptPath)?.title ?? host.ai);
+      state.last_nudge_prompt = state.prompts;
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
index 0000000000..232d93d650
--- /dev/null
+++ b/src/scripts/session_title_cli.ts
@@ -0,0 +1,88 @@
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
+    const transcriptPath = transcript ?? readState(sessionId, opts.root)?.transcript_path ?? null;
+    if (transcriptPath === null) {
+        err(`session:title: no transcript known for session ${sessionId} — pass --transcript <path>`);
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
diff --git a/agents/decisions/concern-admissions.jsonl b/agents/decisions/concern-admissions.jsonl
index 885dd27fcd..c9919e40f4 100644
--- a/agents/decisions/concern-admissions.jsonl
+++ b/agents/decisions/concern-admissions.jsonl
@@ -29,0 +30 @@
+{"concern": "session-title", "decision": "admitted", "admitted_at": "2026-11-26", "slot": "user_prompt_submit on claude only; dropped for worker sessions. No concern refreshed a session title: Claude Code writes its ai-title once and repeats it (one distinct value across each of the eight most recent transcripts of this checkout, repeated 6 to 452 times), so a session keeps the name of its first prompt in sessions:catalog and Agent Switch.", "binding_hosts": "claude (1) — the one host that writes a title this could refine and whose transcript the readers resolve. Whether the slot is live on the host actually running is `agent-config hooks:status`.", "behaviour_where_deny_ignored": "Not applicable: `severity: advisory`, `effect: context`, `fail_closed: false`; it never denies and never rewrites the prompt. Silent between milestones (prompts 3, 8, 20, 45, 100, then every 100), on harness turns, once the user renamed the session (a custom-title line is final), and when `sessions.auto_title` is false. Where it does not run, the host title stays, which is the behaviour before this concern.", "why_not_extend": "session-register keys a repository-scoped register and runs on session_start/stop, not on a prompt count; intake-pass and skill-route fire on task-prompt shape, not on milestones, and folding a title line into either would tie its off switch to theirs. A separate lazy concern keeps the settings read off every other prompt's parse and behind the global setting.", "per_event_budget_impact": "Lazy chunk, 46,766 B measured; the dispatch bundle carries one LAZY_CONCERNS row and measures 1,602,250 B against the unchanged 1,915,000 B backstop. Per prompt: one settings load, one ≤ 1 KB state read and write under the user-global state directory; at a milestone one streaming byte scan of the transcript for title markers and about 420 B of context.", "reason": "Owner directive 2026-11-26 (agents/evidence/owner-directives/2026-11-26-session-titles-that-sharpen.md, ADR-305): titles sharpen as the session learns, the agent phrases them, a /rename title is final, global switch on by default."}
diff --git a/tests/lib/agent_settings.test.ts b/tests/lib/agent_settings.test.ts
index fe3fc18661..cceb2ef9d7 100644
--- a/tests/lib/agent_settings.test.ts
+++ b/tests/lib/agent_settings.test.ts
@@ -335,0 +336,3 @@ describe('MERGEABLE_KEYS', () => {
+            // ADR-305: a global preference by the owner's request; `settings:set`
+            // writes it user-global, so the off switch must survive the merge.
+            'sessions.auto_title',
diff --git a/tests/scripts/hook_role_axis.test.ts b/tests/scripts/hook_role_axis.test.ts
index 376f5831f8..6bab20cb00 100644
--- a/tests/scripts/hook_role_axis.test.ts
+++ b/tests/scripts/hook_role_axis.test.ts
@@ -56,0 +57,2 @@ const WORKER_DROP = [
+    // ADR-305: the title belongs to the user's session, not to a worker slice.
+    'session-title',
diff --git a/tests/scripts/lint_hook_manifest.test.ts b/tests/scripts/lint_hook_manifest.test.ts
index 54f7ce2773..8c180ca618 100644
--- a/tests/scripts/lint_hook_manifest.test.ts
+++ b/tests/scripts/lint_hook_manifest.test.ts
@@ -383 +383,2 @@ describe("effect: — the census's field (Phase 2.2)", () => {
-    expect(names.length).toBe(76);
+    // and 77 since `session-title` (ADR-305).
+    expect(names.length).toBe(77);
diff --git a/src/scripts/_dispatch.bash b/src/scripts/_dispatch.bash
index 627d1e76fa..824c40d6b8 100755
--- a/src/scripts/_dispatch.bash
+++ b/src/scripts/_dispatch.bash
@@ -267 +267,4 @@ Tier 2 — maintenance / internal (hooks, MCP, memory, telemetry):
-  session:recycle            Validate + write the main-session recycle envelope (--verify validates only)
+  session:title              Set the refined title of a session: --session <id> "<title>",
+                             or --show. A /rename title is final and never overridden.
+                             Off globally: settings:set sessions.auto_title false
+  session:recycle           Validate + write the main-session recycle envelope (--verify validates only)
@@ -637 +640 @@ cli_delegate_bundle() {
@@ -917,0 +921,4 @@ cmd_sessions_catalog() {
+cmd_session_title() {
+  exec_ts "$PACKAGE_ROOT/src/scripts/session_title_cli.ts" "$@"
+}
+
@@ -1824,0 +1832 @@ main() {
+    session:title)           cmd_session_title "$@" ;;

jq -S diff of src/scripts/hook_manifest.json, base against head:
2,3c2,3
<   "body_fingerprint": "837675674723d6852f605622bfd545ef9574c3242510e4d60081389cf4385cdc:23591",
<   "fingerprint": "f4a050958d1afd52e3f1d8847a63783fe6a79677335923ea924138f6b9d2f240:124189",
---
>   "body_fingerprint": "ca7e70f1ca7daf2e6d27bde298b4812946b53b53e6f6b147c638a8efc6e80e7e:23495",
>   "fingerprint": "2a42de0b3a2dbcf07bd412df0e2b98f553917f9b5f5b953ee0f7085115f3992f:123452",
165,171d164
<         "severity": "advisory"
<       },
<       "deliberation-mode": {
<         "args": [],
<         "effect": "context",
<         "fail_closed": false,
<         "script": "src/scripts/hooks/deliberation_mode_hook.ts",
564a558,564
>         "severity": "advisory"
>       },
>       "session-title": {
>         "args": [],
>         "effect": "context",
>         "fail_closed": false,
>         "script": "src/scripts/hooks/session_title_hook.ts",
1013c1013
<           "deliberation-mode"
---
>           "session-title"
1077,1078c1077
<           "intake-pass",
<           "deliberation-mode"
---
>           "intake-pass"
1172,1173c1171
<           "intake-pass",
<           "deliberation-mode"
---
>           "intake-pass"
1237,1238c1235
<           "intake-pass",
<           "deliberation-mode"
---
>           "intake-pass"
1302,1303c1299
<           "intake-pass",
<           "deliberation-mode"
---
>           "intake-pass"
1332d1327
<           "deliberation-mode",
1339c1334,1335
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
