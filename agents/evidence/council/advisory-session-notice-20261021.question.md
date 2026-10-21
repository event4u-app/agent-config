<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-21 (round 2) for the advisory session notice, committed verbatim beside its verdict. Not edited after the run. -->

# Council question — may a read-only advisory notice ride the existing session_start handler now?

Repository: event4u/agent-config. Context: a council round earlier today
(2026-10-21, 2/2) chose that advisory data is refreshed only from the CLI
(`agent-config audit:deps refresh`) and an opt-in CI schedule, and that the
session start reads the cache file only. Both seats then asked for an explicit,
narrow approval of the session notice itself before it ships, because an open
blocker (`concerns-refused-as-authority-expansion`, opened 2026-10-20 for an
update-notice concern) asked for three things of any session_start surface:
(b) declare an authority expansion as such, (c) keep notices read-only,
(d) gate any action on a user-owned setting, not a rollout switch.

What is proposed. No new hook concern and no hook_manifest change. Inside the
existing `session_start` handler of `session_register_hook.ts`, after the
retro probe and the worktree pass, one call to `sessionNotice(root)` from
`src/scripts/_lib/advisory_notice.ts`. That module:
- imports only `node:fs`, `node:path`, the settings loader, `git_common_dir`,
  and TYPE-only imports from the advisory modules — no fetch, no child process,
  no network code is reachable from the hook bundle;
- returns null when `advisories.mode` is `off` (class C, `consent`, default
  `notify`), when no cache exists (a cache exists only after someone ran the
  CLI refresh — so an install that never ran it sees nothing new), or when
  this notice was already shown today;
- otherwise returns at most: one line per T0/T1 finding the last refresh chose
  to announce (weekly budget of three interruptions), one digest count line,
  one line per source silent for 3+ days, and one "data is N days old — run
  `agent-config audit:deps refresh`" line when the cache is older than 24 h;
- each finding line is built from IDs, versions, enums, file:line — never
  fetched prose — and ends in an OFFER: "fix now: /audit deps fix <id> (here or
  in its own worktree), or later". It performs nothing;
- writes exactly one file: a "shown today" stamp beside the cache in the git
  common directory.

The diff:

```diff
diff --git a/src/scripts/session_register_hook.ts b/src/scripts/session_register_hook.ts
index 300a6a301..fe871a84a 100644
--- a/src/scripts/session_register_hook.ts
+++ b/src/scripts/session_register_hook.ts
@@ -75,6 +75,7 @@ import { readHookStdin } from './hooks/hook_stdin.js';
 import { probeRanToday, stampProbeRun } from './hooks/probe_throttle.js';
 import { retroDailyProbe } from './retro_sweep.js';
 import { dailyCleanup } from './worktree_cleanup_check.js';
+import { sessionNotice } from './_lib/advisory_notice.js';
 
 /** The `probe_throttle` stamp of the retro's daily probe. */
 const RETRO_PROBE_STAMP = 'retro-sweep';
@@ -950,13 +951,22 @@ export function main(): number {
                         ranToday: (r) => probeRanToday(r, WORKTREE_PROBE_STAMP),
                         stamp: (r) => stampProbeRun(r, WORKTREE_PROBE_STAMP),
                     })?.line ?? null;
+                // The advisory notice (advisories roadmap 4.2): read-only — one
+                // cache file read, one "shown today" stamp written, no network
+                // and no action. `advisories.mode: off` silences it.
+                let advisories: string | null = null;
+                try {
+                    advisories = sessionNotice(root);
+                } catch {
+                    advisories = null;
+                }
                 const foreign = foreign_sessions_block(root, session_id, new Date());
-                const block = [foreign, retro, worktrees].filter((b): b is string => b !== null).join('\n\n');
+                const block = [foreign, retro, worktrees, advisories].filter((b): b is string => b !== null).join('\n\n');
                 if (block !== '') {
                     process.stdout.write(
                         JSON.stringify({
                             decision: 'allow',
-                            reason: foreign !== null ? 'live foreign sessions on this repository' : retro !== null ? 'retro queue' : 'worktree cleanup',
+                            reason: foreign !== null ? 'live foreign sessions on this repository' : retro !== null ? 'retro queue' : worktrees !== null ? 'worktree cleanup' : 'advisories',
                             context: block,
                         }) + '\n',
                     );
```

Questions — one letter and one or two sentences each.

Q1. Is this notice an authority expansion under F2(b)?
  (a) No: it reads one local file and prints; it starts nothing and writes only
      its own display stamp. It meets (c) by construction and (d) via
      `advisories.mode`.
  (b) Yes, and it must be declared as one before it ships.
Q2. May it ship now, riding the existing handler, without waiting for the open
    blocker's round on the update-notice concerns?
  (a) Yes — the blocker concerns concerns that may initiate actions; this one
      cannot, and approving it here is the explicit narrow approval asked for.
  (b) No — it waits for that round.
Q3. The "data is N days old — run `agent-config audit:deps refresh`" line
    invites the agent to run a command that sends public package names to
    api.osv.dev (disclosed in the settings template, governed by
    `advisories.egress`). Acceptable as a read-only suggestion?
  (a) Yes. (b) Only when the user has run a refresh at least once in this
      project (which is already the case: no cache, no line). (c) No.
Q4. Anything unsafe in the diff or the description? Name it with file:line.

End with a final verdict from exactly one of: `ratified`,
`confirmed-non-expanding`, `refused`, `non-convergent`.
