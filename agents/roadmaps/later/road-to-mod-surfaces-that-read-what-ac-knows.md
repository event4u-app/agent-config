---
complexity: lightweight
status: later
review_by: 2026-11-24
entry_condition:
  what: "road-to-a-mod-that-decides-nothing-new has shipped its read-only module, and a slot among the five active roadmaps is free (owner WIP limit, 2026-10-24)"
  when: "after that roadmap archives"
  who: owner
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Parked remainder of the same round as road-to-a-mod-that-decides-nothing-new; same owner search (no roadmap owns Claude Code mods). Written straight into later/, so it adds no active roadmap; it grows the later axis by one."
estate_growth_exempt: "+1 later roadmap: the parked remainder of inbox-2026-10-av. The owner asked why the five parent mods were dropped; their content is kept here instead of in an archive or a decline line, so it cannot be lost."
relates:
  - slug: road-to-a-mod-that-decides-nothing-new
    relation: depends
    note: "Every surface here reads through the module that roadmap ships."
depends:
  - road-to-a-mod-that-decides-nothing-new
---
# Road to mod surfaces that read what AC knows

> **Source:** `agents/tmp.old/inbox-2026-10-av/` — the remainder of the master plan
> after `road-to-a-mod-that-decides-nothing-new` took the first module. Kept here
> because the owner asked, in the source transcript, why the five proposed AC mods
> were dropped; the answer there was that only the packaging was dropped. This file
> is where their content lives.

## Goal

The one AC module grows surfaces for the state AC already measures, and AC can
preview and witness destructive or overridden actions — with every decision still
made in the dispatcher for all hosts, and every surface also reachable as text on
hosts without mods.

## Where the five parent functions live

| Parent function | Lands in |
|---|---|
| Safety guard | Phase 2 (blast preview as a dispatcher concern) and Phase 3 (sensor, opt-in holder) |
| Context intelligence | shipped fill status line; Phase 1.2 cold-cache hint, 1.1 quota counters |
| Learning guard | Phase 4.1 queue counter over the correction detector |
| Replay and explain | README claim corrected in the first roadmap; a viewer only after the journal is on by default |
| Mission control | Phase 1.4, as a pane of the same module, once a shared fleet state file exists |

## Phase 1 — More surfaces, all readers

- [ ] **1.1 Quota counters.** Show the limit and cost counters once a dispatcher
      component writes them to a state file with `schema_version`. No hard limits,
      no stopping.
      verify: harness test file present → shown, absent → silent.
- [ ] **1.2 Cold-cache hint.** A deterministic `user_prompt_submit` concern for hosts
      with a known cache TTL: when the last turn is older than the TTL, say the cache
      is probably cold and show the estimated context size as approximate. No prompt
      drop, no model call. Measure its bundle bytes first — the hook bundle has
      almost no headroom.
      verify: fixture with an old last-turn timestamp prints the hint; a fresh one
      prints nothing; bundle-size gate green.
- [ ] **1.3 Subagent pane.** A pane reading the existing subagent ledger: runs,
      duration, status. Spawn briefings are not enriched (ADR-285).
      verify: harness UI test mounts the pane on terminal and desktop surfaces.
- [ ] **1.4 Mission-control pane.** One pane over all live sessions, only after a
      shared state file that every session writes exists; a module sees only its
      own session.
      verify: two fixture session records render as two rows.
- [ ] **1.5 Receipt line.** One session-start line on Claude only when a
      verdict-capable mod is installed. Measure bundle bytes first.
      verify: fixture with a verdict-capable mod prints the line; none prints nothing.

## Phase 2 — Blast preview as a dispatcher concern

- [ ] **2.1 Concern `blast-preview`.** `pre_tool_use`, Bash matcher, destructive
      classes (recursive `rm`, `git reset --hard`, `git clean`, `git checkout -- .`,
      force push, migrations). Scope is computed read-only (`git status --porcelain`,
      `git diff --shortstat`, target path count) through `hardenedSpawnEnv()`;
      repository code is never run. Shell parsing is best-effort, so the preview says
      "at least", never "exactly".
      verify: a fixture corpus covering hits, non-hits and known parser gaps
      (`bash -c`, `eval`, `xargs rm`, `find -delete`, base64, aliases) — gaps are
      asserted as expected-incomplete, not as passes; measured p95 against the
      `pre_tool_use` latency budget in the PR.
- [ ] **2.2 When it asks.** Only for the destructive list; everything else is an info
      line and no question. Over the latency budget → "scope unknown (time limit)",
      never a block.
      verify: a reversible command produces no question in the fixture run.
- [ ] **2.3 Band.** The module renders the preview from its state file; other hosts
      see the question's reason text.
      verify: harness band test.

## Phase 3 — Witness and holder, opt-in

- [ ] **3.1 Live-session probes the harness cannot make.** On a real 2.1.310+
      session, managed and unmanaged: do AC's settings PreToolUse hooks run before or
      after a user mod's `tool.check`; does the host's skip line appear when a mod
      skips a settings hook; real hook latency of the read-only module. (Whether a
      marketplace path behind `runtime/current` is kept literal was measured on
      2026-10-25: it is.)
      verify: protocol with host version, arm and command under `agents/evidence/analysis/`.
- [ ] **3.2 Sensor.** `tool.check` reads `next.trace`; when the final verdict differs
      from the dispatcher's, write one audit line (which mod, tier, from → to) and a
      toast. Version gate: a missing or reshaped `next.trace` reads `unknown`. It sees
      only mods beneath it, and says so.
      verify: harness matrix (flip and short-circuit in prepend, append, user tiers).
- [ ] **3.3 Holder, unmanaged accounts only, opt-in.** With AC in the user's
      `prependPlugins`, AC runs first and holds an existing dispatcher `deny`. It is a
      guarding hook, so it registers `.catch` answering `{ decision: 'deny' }` — but
      only for calls the dispatcher itself denied; everything else fails open. Never
      suggest a block where the host cannot block.
      verify: harness test with a downstream `allow`; 3.1 confirms it on a live arm.
- [ ] **3.4 Init registration.** The literal-path precondition is met (measured
      2026-10-25). `init` asks once whether to register the local marketplace; note
      that registration also writes the user-global marketplace list.
      verify: init test with a fixture home.

## Phase 4 — Learning and second opinion, through neighbours

- [ ] **4.1 Learning-queue counter.** Show the number of open correction proposals
      once a deterministic correction detector exists; acceptance runs through
      `learning-to-rule-or-skill`. Nothing writes rules or `CLAUDE.md`.
      verify: harness test over a fixture queue file.
- [ ] **4.2 Risk-aware review nudge.** `end_review_nudge_hook.ts` also reads the change
      risk class as a display attribute: a high class nudges below the line threshold.
      Nudge stays nudge.
      verify: fixture with a small high-risk diff gets the nudge.
- [ ] **4.3 Measure the host's built-in second-opinion mod** against the council path
      on cost and finding rate with the paired-verdict tool. Nothing is built.
      verify: measurement report under `agents/evidence/analysis/`.

## Not built

File tree port (prompt-context injection, process spawns; the code map exists) ·
terminal browser (foreign binary) · skins (no governance value) · keep-warm by
default (spends quota unattended; reopen on a measured net saving) · code copied
from third-party mods (source-confidentiality; licence).

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A surface becomes a decision | product | The holder or the preview grows its own policy beside the dispatcher | Holder repeats only dispatcher denies; preview asks only on the destructive list | Phase 3 — Witness and holder, opt-in |
| 2 | `next.trace` changes shape | implementation | The sensor reads a host contract that is absent from the web docs | Version gate to `unknown`, never a guess | Phase 3 — Witness and holder, opt-in |

## Acceptance Criteria

- [ ] AC-1 — Every surface shipped here has a text equivalent on a host without mods.
- [ ] AC-2 — No module hook outside the holder can change a verdict, and the holder
      changes only verdicts the dispatcher already denied.
