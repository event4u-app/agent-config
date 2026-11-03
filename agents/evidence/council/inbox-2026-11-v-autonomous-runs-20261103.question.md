<!-- evidence-type: analysis -->

# Five design decisions for autonomous roadmap runs

You are an independent reviewer for the `event4u/agent-config` repository, a governed
suite of rules, skills and commands for AI coding agents. It ships three roadmap
execution commands: `/roadmap:process-step` (one step), `/roadmap:process-phase` (one
phase) and `/roadmap:process-full` (the whole roadmap). The repository owner has
reported, on three separate occasions (2026-10-19, 2026-10-22, 2026-11-03), that runs of
these commands stop before the end, ask questions mid-run, or leave open steps behind.
The owner's own words (2026-10-22): the commands are started precisely so the owner is
not interrupted; every run should try to reach the end the command names, and resolve a
blocker rather than stop on it. The owner also asked why `process-full` and
`process-step` work badly when both should work "just as autonomously".

Answer each question independently. For each: pick one option (or propose a better
one), give the reason, name the main risk, and say whether the choice is reversible.

## Facts from the current tree

- `process-full` operates under ADR-237: "the invocation IS the confirmation". There is
  no acceptance round and no contract screen under `process-full`.
- `roadmap-execution-contract.md` § 2a/§ 2b define two run-level fields declared on
  that contract screen: `late_artifacts` (`halt` default | `auto-research`, capped at
  three discoveries) and `deferred_policy` (`wait` default | `spawn-follow-up-draft` |
  `cancel-with-memo`). A two-seat council chose these defaults on 2026-08-20, with the
  reasoning that "the aggressive path becomes a thing a run declares rather than a thing
  it inherits". That decision predates the removal of the screen under `process-full`.
- The same contract says the classes `high_impact` and `user_required` "never become
  rows" of the run-start decision sheet; "they escalate during the run, at the moment
  they fire". `process-full` itself says "No mid-run approval requests. Only a
  spend-ceiling crossing or an EXCLUDED-list action reaches the owner." A repository
  rule says `high_impact` and `user_required` decisions always reach the user.
- A stop-time continuation mechanism existed (a hook that refused to end a turn while a
  roadmap run had work left). A council set a dated kill criterion: withdraw it unless a
  qualifying run (a roadmap with ≥ 3 phases, run to a PR from a worktree) was recorded by
  2026-10-11. None was. It was withdrawn on 2026-10-13 and its ladder removed on
  2026-10-14. Its event ledger held 183 rows; the `roadmap` field was empty on every
  one, i.e. the mechanism never knew which roadmap a run was working on. A per-session
  roadmap claim command (`sessions:claim <slug>`) is now mandatory before a run's first
  edit. The withdrawal commit states it did not test the merits of the decision.
- `process-step` and `process-phase` keep a confirmation round and "no auto-commit";
  `process-step` ignores the roadmap's `execution.mode`.
- `process-full` has an Iron Law "ONE ROADMAP, ONE PR". The owner repeatedly asks for
  "all roadmaps from PR #N, one PR" and writes long hand-made prompts to get it.

## Q1 — Run-level defaults under `process-full`

Under `process-full`, which no longer has a screen on which `late_artifacts` /
`deferred_policy` can be declared:

- (a) keep `halt` / `wait` as the inherited values;
- (b) `process-full` uses `auto-research` (cap 3 unchanged) and `spawn-follow-up-draft`
  as its own defaults; other commands keep `halt` / `wait`;
- (c) keep `halt` / `wait`, but let invocation flags declare the other values.

## Q2 — Mechanical hold at turn end

- (a) rebuild a stop-time refusal now: the run writes a scope record at claim time
  (roadmap, open runnable steps); the turn-end gate refuses to end the turn while
  runnable steps remain and no typed halt record (one of the five halt codes) exists;
  a hard cap on consecutive refusals; hosts without a stop hook fall back to prose;
- (b) build only the scope record now (so the next observation window can see which
  roadmap a run worked on) and keep the refusal behind the existing open owner item;
- (c) do neither.

## Q3 — `high_impact` / `user_required` under `process-full`

- (a) the run triages at start into runnable / time-gated / owner; owner-class questions
  are asked once, at the start, in one block; answers supplied in the invocation become
  dated owner rows without asking; anything that arises later is listed in the PR body
  and the run continues with other work;
- (b) keep escalation at the moment they fire (mid-run);
- (c) another shape.

## Q4 — `process-step` and `process-phase`

- (a) same grant model as `process-full` (the invocation grants the run's branch,
  chunked commits, push to that branch only, PR-open; no confirmation round) — the only
  difference is scope, and `process-step` stops after one step but never asks;
- (b) drop the confirmation round but keep commits behind an explicit permission;
- (c) keep the current behaviour.

## Q5 — Several roadmaps, one PR

- (a) add `--roadmaps a,b,c` and `--from-pr <N>` to `process-full`; the set is
  processed in dependency order and delivered as one PR, with the Iron Law reworded to
  "one invocation, one PR";
- (b) keep one PR per roadmap; the owner composes invocations;
- (c) another shape.
