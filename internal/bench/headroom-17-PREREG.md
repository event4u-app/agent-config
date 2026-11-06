# Pre-registration — does a second agent earn its spawn where every arm fails?

Step 1.7 of `road-to-proof-where-the-owner-sees-it`. Written and committed
before the first paid call, on 2026-11-06. Nothing below changes after the run
starts. A deviation is reported as a deviation, never folded in.

## Question

On tasks where every single-agent configuration measured so far fails the hidden
verifier, does a second, harness-driven step lift capability over a single agent
given the same extra compute?

## Tasks

Corpus `internal/bench/corpora/ab-headroom-17.yaml` (`--corpus headroom17`):

| Cluster | Task | Why it is here |
|---|---|---|
| headroom | `capH-debug-08`, `hdrH-done-01`, `hdrL-multistep-01` | 0/5 capability for every arm on Sonnet 4.6, 2026-11-05 (`vanilla-b` 1/5 on `capH-debug-08`) |
| hold-out | `hdhB-boundary-01`, `hdhI-invalidation-01`, `hdhS-sentinel-01` | new, same edge-case class: boundary value, invalidation, sentinel value |

The hold-out was written with its reference patch and passed
`check_bench_task_validity --gate` before this file was committed. For each
hold-out task the pristine fixture fails the hidden verifier, the obvious
one-site fix turns the visible test green and still fails it, and the reference
passes. Seal:

```
sha256( (find fixtures-v2/<id> verifiers-v2/<id> -type f; echo oracle-v2/<id>.patch) | LC_ALL=C sort | xargs shasum -a 256 )
hdhB-boundary-01      1d08dc39d6d8f44aa243f1babdbfe0b5f84978a5aac61404f95b3d179e106116
hdhI-invalidation-01  cd4ece4c92a8e1087698e8604f842bcdf8524b1b8abdeaacb478f38c7e88d39f
hdhS-sentinel-01      c92967da5c04770155810606bc3b3f39bc2876a22105f15b27fc0569f4c35713
```

(run in `internal/bench/ab/`).

## Arms

Host `claude-sonnet-4-6`, container isolation, base profile `package` (D4). Every
step is a separate host call driven by the harness (`src/scripts/_lib/bench_headroom_arms.ts`).

| Arm | What runs | Role in the analysis |
|---|---|---|
| `h17-a` | one author call, `--effort medium` | control, descriptive only |
| `h17-b` | one author call, `--effort high` | the same-cost comparator |
| `h17-c` | tester call (writes `tests/edge.generated.test.mjs` from the requirement, source edits undone), harness runs it, then the author call with the tests named; all `--effort medium` | treatment |
| `h17-d` | author call, slim reviewer on diff + requirement (the 3.2a arm), and when it reports findings one revision call by the author; author calls `--effort medium` | treatment |

The tester and reviewer prompts are neutral (`evaluator-independence`): they ask
for tests or defects and state no expected outcome. They are fixed in
`bench_headroom_arms.ts` at the commit that carries this file.

## Endpoints

**Primary.** Hidden-verifier capability pass, paired by (task, seed): C vs B and D
vs B, one-sided exact sign test on discordant pairs, Holm over the two
(α = 0.05 family). Reported for all six tasks and separately per cluster. A
ladder rung is proposed only if C or D beats B on the headroom cluster **and** on
the hold-out **and** holds the false-positive bar below.

**Safety.**

- Arm D false-positive rate: findings on an attempt that already passed the
  hidden verifier, divided by all findings, pooled over all tasks. Ceiling
  **25 %** (D4). An unparseable reviewer answer counts as zero findings and is
  reported separately.
- Arm C false-positive rate: runs whose generated test file fails on the
  pristine fixture with the reference patch applied, divided by runs with a
  generated file. Ceiling **25 %**.
- Unneeded changed lines: lines changed beyond the reference patch, per arm,
  reported descriptively.

**Cost.** Priced cost per run (all steps summed), p50 and p95 per arm. Net value
per arm against B: `p_catch · D − C_extra − r_FP · C_FP` with `D` = 10 × arm A's
p50 run cost and `C_FP` = 1 × that cost (D4).

A budget stop counts as a fail on capability.

## Size and budget

6 tasks × 11 seeds = 66 pairs per comparison. With B at the floor (share of
discordant pairs favouring the treatment ≈ 1), `bench_ab_power` gives 80 % power
at α = 0.025 (the first Holm step) for a discordance of about 0.15, i.e. a
treatment that passes in roughly one pair in seven where B does not. A smaller
lift is not detectable at this size, and a null is reported as "not detected at
this size", never as "no effect".

Expected spend about $120–130; sweep cap `--max-usd 150`, per-call budget as the
2026-11-05 Sonnet sweep. Released by the owner on 2026-11-06.

## What is not decided by this run

Pair/driver-navigator, a PO agent and an expert huddle stay parked. A positive
result proposes a shadow `would_choose` beside the judgment ladder, never a second
classifier and never a default change.

## Amendment 1 — arm D dropped before any paid call (2026-11-06)

The gate for arm D failed: in `road-to-token-economy-dispatch-followup` 3.2a
the slim reviewer flagged 2 of 3 correct controls against the full reviewer's 1
(`agents/evidence/analysis/slim-reviewer-verdict-comparison-2026-11-06.md`).
The owner chose to run A, B and C only. Changes, all made before the first
paid call:

- `h17-d` does not run. The D false-positive ceiling and the D endpoint are void
  for this run; D stays open in the roadmap until a reviewer passes 3.2a.
- The primary analysis is one comparison, C vs B, one-sided exact sign test at
  α = 0.05. With 66 pairs that gives 80 % power at a discordance of about 0.12
  when B sits at the floor.
- Expected spend about $85; sweep cap `--max-usd 110`, per-call budget $1 as on
  2026-11-05.

Tasks, seal, arms A–C, the C false-positive ceiling and the cost definitions
are unchanged.
