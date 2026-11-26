---
complexity: structural
status: done
owner: maintainer
review_by: 2026-12-31
estate_growth_exempt: "+1 concern_count (deliberation-mode). owner-authorised 2026-11-26 (Matze): the deliberation-mode concern delivers the per-session council/arena/panel mode on every prompt; without it Agent Switch's per-chat toggle cannot reach the agent. The owner's decision, recorded in agents/evidence/owner-directives/2026-11-26-deliberation-mode-concern.md."
relates:
  - slug: road-to-a-link-with-agent-switch
    relation: extends
    note: "Agent Switch reads deliberation:get/set --json and the bracket name.json this roadmap adds."
---
# Road to deliberation offers and run names

> **Source:** owner request 2026-11-26, relayed by the coordinating Agent Switch
> session; the estate growth is the owner's decision,
> `agents/evidence/owner-directives/2026-11-26-deliberation-mode-concern.md`.

## Goal

A question that carries a real decision gets `/council`, `/arena` or `/panel`
offered, run, or neither, per `deliberation.mode` — set globally or per chat —
and an arena run carries a human name and a one-line decision Agent Switch shows.

## Acceptance criteria

- **AC-1** `deliberation.mode` (A, default `off`, switched on only when the user asks) is writable by
  `settings:set` and `deliberation:set`; a per-session override wins over it.
- **AC-2** `deliberation:get --json` names the mode and its source
  (`session` | `global` | `default`); a traversal session id is refused.
- **AC-3** The `deliberation-mode` concern injects one line per qualifying
  prompt in `offer` and `auto`, and is silent in `off`. In `auto` the agent
  answers its own implementation questions; every Hard-Floor action still asks.
- **AC-4** `bracket name` writes `name.json` in the v1 shape, keeps a field the
  user set unless `--force`, and records the champion with a decision.

## Phase 1 — Deliberation mode

- [x] **1.1** Setting `deliberation.mode` in the template, schema and class
      contract; `deliberation:get|set` with the per-session override under the
      user-global `state/deliberation/`.
- [x] **1.2** `deliberation-mode` concern on `user_prompt_submit`, admitted in
      `agents/decisions/concern-admissions.jsonl`.
- [x] **1.3** Command `/deliberation` and `ai-council` § deliberation mode; no
      rule file, so the per-spawn preamble does not grow.

## Phase 2 — Run names

- [x] **2.1** `bracket name --text|--decision` writing `name.json`; the engine
      never reads it.
- [x] **2.2** `/judge bracket` and `/arena` name the run after `init` and record
      the decision at `done`.
