---
complexity: lightweight
status: ready
tree_pin: 58d43073b7
execution:
  mode: phase-checkpoints
review_by: 2026-12-15
estate_growth_exempt: "+1 active_roadmaps, owner-directed 2026-10-29 (\"ziehe die 3 von later in den normalen ordner\"): promoted from later/ with its two siblings of round inbox-2026-10-bi once OQ-32..OQ-35 were answered; this takes the active estate from 5 to 8, over the WIP cap of 5, by the owner's explicit instruction."
estate_offset_exempt: "Promoted from later/ on owner instruction, agents/evidence/owner-directives/2026-10-29-promote-memory-roadmaps.md (2026-10-29); no active roadmap is archived to offset it. Owner search at 58d43073b7 (grep -rlF for persistence-claim, TurnSnapshot, CLAUDE.local.md, detectAgentsMdShadow over agents/roadmaps, later, stubs) returned nothing."
relates:
  - slug: road-to-a-correction-that-is-heard
    relation: extends
    note: "Needs its subject capture (1.3) for the subject-count index."
---
# Road to a "noted" that is a write

> **Source:** `agents/tmp.old/inbox-2026-10-bi/` (topic T1, supplied plan v3).
> **Arrivals:** 1 — `inbox-2026-10-bi` (2026-10-29).

## Goal

When the agent says "noted" or "from now on", a write to a carrier the next
session reads has happened in the same turn, and a repeated correction about
one subject is counted across differently worded complaints. Not started at the
pin because the detector needs the write paths the turn snapshot does not carry
(`self_repair_hook.ts` records Edit/Write as a bare tool name).

## Phase 1 — The turn snapshot knows what was written

- [x] **1.1 Write paths in the turn snapshot.** Append `file_path` / <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/source-registry.json -->
      `notebook_path` for Edit, Write, MultiEdit and NotebookEdit; measure the
      hook-bundle bytes first (tight headroom).
      verify: a transcript fixture with a Write yields `"Write <path>"`.
- [~] **1.3 Read the host's auto-memory as a recurrence source.** Read-only, <!-- deferred-resolution: carried-to=road-to-a-noted-that-is-a-write-carried -->
      no consent prompt (owner answer OQ-33, 2026-10-29): a correction the host
      already recorded under `~/.claude/projects/*/memory` counts as an earlier
      arrival. Never write there; give `host-memory` in
      `src/config/source-registry.json` its reader.
      verify: `npx vitest run tests/scripts/host_memory_reader.test.ts` -> 0 — with a
      fixture memory dir read and a test that no write reaches it.
      **Carried, 2026-11-04.** Blocker: the ratification of this branch's
      `hook-bundle-budget.json` change did not converge — the OpenAI seat named
      the reader's read boundary (every project's memory, not only the current
      one) as its last open point over nine rounds. Options: (1) narrow the
      reader and re-review, (2) push without ratification, (3) carry the step.
      Verdict: (3), AI council on the owner's delegation ("entscheide im ai
      council"), anthropic seat in two runs: the boundary deserves its own design
      and threat-model pass rather than line edits under review pressure.
      Dissent: none recorded — the OpenAI seat failed both runs (`exit_1`, CLI
      transport), so quorum came from one seat. Destination:
      `agents/roadmaps/road-to-a-noted-that-is-a-write-carried.md` step 1.1.
      Closes when that step lands with its read boundary decided.
- [x] **1.2 Subject-count index.** A derived `_subject-index.json` beside the <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/source-registry.json -->
      target index in `self_repair_store.ts`.
      verify: three records with different fingerprints and one subject count 3.
      Before it counts, close the two precision gaps the 2026-10-29 council
      review named: a first-person question ("how many times should I retry?")
      still fires the detector, and the subject is the first backticked token
      anywhere and is kept on merge — add must-not-fire rows and a test with
      an unrelated backtick and a conflicting subject across merges.

## Phase 2 — "Noted" without a write is a defect

- [x] **2.1 `persistence-claim` defect class.** Reply-opening claim <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/source-registry.json -->
      (`notiert|gemerkt|für immer|ab jetzt|noted|I'll remember|from now on`) with
      no written path matching a carrier (`AGENTS.md`, `CLAUDE*.md`,
      `.editorconfig`, formatter configs, `.claude/rules/`, memory dirs);
      advisory, stop slot; issue-template dropdown updated.
      verify: corpus with fire, near-miss and must-not-fire rows ("noted, see the
      PR" plus a Write to `.editorconfig` stays silent).
- [x] **2.2 Shadow detector.** Pure `detectAgentsMdShadow(root)` flags a <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/agents_md_shadow.ts -->
      `CLAUDE.md` / `.claude/CLAUDE.md` / `CLAUDE.local.md` that neither imports
      nor symlinks a non-empty `AGENTS.md`; surfaced by `/agents audit`.
      verify: five temp-dir layouts.
- [x] **2.3 Carrier-rung classifier.** Pure `conventionRung(sentence)` → <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/convention_rung.ts -->
      config | check | prose, unclassifiable = prose; classifies only, writes
      nothing.
      verify: a 30-sentence DE/EN corpus where a too-strong rung is the failing
      direction.
      production entry: src/scripts/convention_propose.ts (run by `/agents:audit`, src/domains/meta/agents/audit/command.md)

## Phase 3 — Proposing the config change (OQ-32)

- [x] **3.1 Propose the convention as a project diff, outside self-repair.** <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/convention_rung.ts -->
      AI council decision OQ-32 (2026-10-29, 2/2, option b): the self-repair
      Iron Law stays unchanged; a convention that keeps not arriving goes
      through a separate proposal-only path that emits a diff the user sees and
      accepts, never a silent write and never from the self-repair loop.
      verify: a fixture where the proposal is emitted and no file changes
      without the accept.
      production entry: src/scripts/convention_propose.ts (run by `/agents:audit`, src/domains/meta/agents/audit/command.md)

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-29 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The claim detector fires on harmless prose | implementation | "Noted" in a summary of a written change reads as a hollow promise | Must-not-fire rows for a claim beside a matching write; advisory only | Phase 2 — "Noted" without a write is a defect |

## Acceptance Criteria

- [x] AC-1 — A "noted" reply with no carrier write is queued as a defect; one
      with a matching write is not.
- [x] AC-2 — Three differently worded corrections about one subject read as
      three arrivals of that subject.
