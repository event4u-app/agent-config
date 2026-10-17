<!-- evidence-type: analysis -->
# Detector C by edited-path class — 2026-10-17

Step 4.2 of `road-to-agent-throughput-recovery`. Detector C (`verification`)
is the largest class in the turn-end refusal store: **182 of 307** refusals,
2026-08-12..2026-10-16 (`probe_turnaround`'s refusal section, read at the main
checkout). A refusal record carries no path, so the split below is taken where
the paths are: a transcript replay of the shipped detector.

## How it was read

```
./scripts-run src/scripts/measure_turn_end_gate --store ~/.claude/projects/<main checkout slug> --limit 30 --show-fires
```

30 sessions, 590 turns, 134 turns that edited a file. `measure_turn_end_gate`
replays `detectUnverifiedEdit` on the transcript path (no run-state record), so
every row is a turn the gate's transcript path would refuse — an upper bound on
refusals, not a list of refusals that happened. `editPathClass` puts each fire
in exactly one class: `docs-md` when every edited path is `agents/**` or
`docs/**` markdown, `code` when none is, `mixed` when both occur, `unknown`
when no path was recorded. The four rows sum to the fires.

## Split

| class | fires | share |
|---|---|---|
| docs-md | 15 | 20.5 % |
| code | 42 | 57.5 % |
| mixed | 16 | 21.9 % |
| unknown | 0 | 0.0 % |
| **total** | **73** | 100 % |

## Reading

- A docs-only exemption would remove at most **15 of 73** replayed C fires
  (20.5 %). `mixed` turns edited code too and stay in scope under any docs
  exemption. Whether the 15 were wrong refusals is not decided here: a markdown
  edit under `agents/` can still carry a gate (roadmap shape, evidence type,
  language), so a docs-md fire is a candidate false positive, not a measured
  one. The count goes to 4.4's demotion contract; no exemption is proposed here.
- The `code` class is the majority. Those are the refusals the detector exists
  for, and nothing here argues they misfire.
- The window includes the drain's orchestrating session (`9cc9825f`, rows
  1–7: 1 code, 5 mixed, 1 docs-md), which was still running when read;
  without it the split is 14 / 41 / 11 of 66.

## Every sampled fire

Session is the transcript file's first eight characters; turn is the
per-session ordinal.

| # | session | turn | edited-path class |
|---|---|---|---|
| 1 | `9cc9825f` | 5 | code |
| 2 | `9cc9825f` | 8 | mixed |
| 3 | `9cc9825f` | 9 | mixed |
| 4 | `9cc9825f` | 12 | mixed |
| 5 | `9cc9825f` | 13 | docs-md |
| 6 | `9cc9825f` | 14 | mixed |
| 7 | `9cc9825f` | 21 | mixed |
| 8 | `4ab274a5` | 1 | code |
| 9 | `4ab274a5` | 2 | docs-md |
| 10 | `a670a1b7` | 1 | code |
| 11 | `a670a1b7` | 3 | code |
| 12 | `6ea9dba3` | 1 | docs-md |
| 13 | `6ea9dba3` | 17 | code |
| 14 | `6ea9dba3` | 23 | code |
| 15 | `6ea9dba3` | 27 | mixed |
| 16 | `dbc2e8b1` | 2 | code |
| 17 | `dbc2e8b1` | 12 | code |
| 18 | `dbc2e8b1` | 53 | code |
| 19 | `dbc2e8b1` | 70 | code |
| 20 | `dbc2e8b1` | 97 | code |
| 21 | `0cb10022` | 5 | docs-md |
| 22 | `0cb10022` | 7 | docs-md |
| 23 | `f3c5c62b` | 1 | code |
| 24 | `b8500215` | 3 | docs-md |
| 25 | `a0b1788e` | 3 | mixed |
| 26 | `a0b1788e` | 4 | code |
| 27 | `d144bbe6` | 1 | mixed |
| 28 | `01fdd537` | 1 | code |
| 29 | `01fdd537` | 6 | mixed |
| 30 | `01fdd537` | 10 | code |
| 31 | `01fdd537` | 13 | code |
| 32 | `01fdd537` | 19 | code |
| 33 | `01fdd537` | 21 | code |
| 34 | `01fdd537` | 28 | code |
| 35 | `0fe2e6d6` | 2 | code |
| 36 | `0fe2e6d6` | 4 | code |
| 37 | `4d0cb74a` | 1 | code |
| 38 | `4d0cb74a` | 3 | code |
| 39 | `4d0cb74a` | 5 | code |
| 40 | `4d0cb74a` | 6 | code |
| 41 | `4d0cb74a` | 7 | code |
| 42 | `4d0cb74a` | 9 | code |
| 43 | `4d0cb74a` | 14 | code |
| 44 | `4d0cb74a` | 32 | code |
| 45 | `f484d60d` | 14 | docs-md |
| 46 | `f484d60d` | 21 | mixed |
| 47 | `f484d60d` | 24 | docs-md |
| 48 | `414ef243` | 2 | mixed |
| 49 | `414ef243` | 4 | code |
| 50 | `414ef243` | 5 | code |
| 51 | `414ef243` | 8 | code |
| 52 | `414ef243` | 9 | code |
| 53 | `414ef243` | 10 | code |
| 54 | `414ef243` | 11 | code |
| 55 | `414ef243` | 12 | code |
| 56 | `414ef243` | 13 | code |
| 57 | `414ef243` | 20 | code |
| 58 | `43d1efd2` | 6 | docs-md |
| 59 | `43d1efd2` | 8 | mixed |
| 60 | `43d1efd2` | 28 | docs-md |
| 61 | `43d1efd2` | 31 | code |
| 62 | `43d1efd2` | 44 | code |
| 63 | `43d1efd2` | 46 | code |
| 64 | `43d1efd2` | 61 | code |
| 65 | `b037b94a` | 1 | mixed |
| 66 | `b037b94a` | 3 | mixed |
| 67 | `b037b94a` | 5 | mixed |
| 68 | `b037b94a` | 7 | mixed |
| 69 | `3da0c55b` | 40 | docs-md |
| 70 | `12f68244` | 1 | docs-md |
| 71 | `12f68244` | 8 | docs-md |
| 72 | `12f68244` | 11 | docs-md |
| 73 | `807294b2` | 10 | docs-md |
