<!-- evidence-type: analysis -->

# Direct output against each skill's stated value, 2026-11-08

**Roadmap:** `road-to-routing-assurance-live-floors-carried` 1.3.
**Protocol:** `agents/evidence/preregistration/routing-direct-output-assessment-protocol-20261108.md`,
committed before any run. **Rows, prompts and judgements:**
`routing-direct-output-assessment-20261108.json`. Host **2.1.316**,
`claude-opus-5-5`, catalogue `501c9dbd…`, through the subscription CLI (CLI
estimates 2.59 + 2.99 USD). No run errored.

## Result

| Unit | Arm | Skill called | Run scores (anthropic seat) | Median |
|---|---|---|---|---|
| `react-shadcn-ui` | direct | 0/5 | 0.75 · 0.625 · 0.75 · 0.75 · 0.75 | **0.75** |
| `react-shadcn-ui` | reference | 5/5 | 1.0 × 5 | **1.0** |
| `project-analysis-core` | direct | 1/5 | 0.8 · 0.8 · 0.8 · 0.8 · 1.0 (the one that called the skill) | **0.8** |
| `project-analysis-core` | reference | 5/5 | 1.0 × 5 | **1.0** |

**Disposition, both units: (b) a v2 prompt series.** Under the frozen rule, (a)
needs a direct median of at least 0.80 and a reference lead of at most 0.10.
`react-shadcn-ui` fails both conditions. `project-analysis-core` reaches 0.80
but trails by 0.20. The consensus rule counts a cell as met only when both seats
score it met, so a second seat can lower these medians but never raise them.
The disposition therefore holds whatever the missing cells would have been.

What the direct output misses is what the skill states:

- **`react-shadcn-ui`:** all five direct runs put `text-white` in the default
  variant (R1, R2). One also dropped the focus-visible ring (R5). No reference
  run did either; they kept the foreground on a token, and one added a
  `--neutral-0` token for it.
- **`project-analysis-core`:** all four direct runs that did not call the skill
  stated versions without noticing the missing lock file (P3) and gave no
  uncertainty list (P8). The direct run that did call the skill, and every
  reference run, did both.

The host's direct handling is therefore not adequate against these two skills'
stated value. The 0/3 routing reading remains a real gap, not a construct
artefact, and retiring the positives is ruled out.

## Deviations, disclosed

1. **Judge rounds.** The first `react-shadcn-ui` session ran the council's
   default two rounds. Its record holds only the second, deliberative round, so
   no per-seat table survived. No verdict was read from it. The judging ran
   again with `--rounds 1` and an unchanged prompt; both sessions are in the
   JSON.
2. **Split session.** The `project-analysis-core` question exceeded the
   council's 51 200-byte ceiling. It ran as two sessions, O1–O5 and O6–O10, with
   the same header and instruction.
3. **One seat returned no table.** In all three single-round sessions, the
   openai seat critiqued the scoring packet instead of filling the table. Its
   prose does confirm the decisive cells: `text-white` in the five direct
   `react-shadcn-ui` outputs, and O4's missing focus treatment. The
   reliability check (seat disagreement above 25 %) cannot be computed. The
   rule above makes the disposition independent of that seat's cells, and (b)
   is the outcome that keeps the positives, so nothing is dropped on it.
4. **Blinding was partial for `project-analysis-core`.** The pre-registered
   redaction removes skill names only. Six of ten outputs (the five reference
   runs and the direct run that called the skill) still describe the skill's
   helper scripts, so a judge could infer their arm. `react-shadcn-ui` outputs
   carry no such trace.

## What 1.3 needs next

A v2 prompt series for both units, per the protocol: prompts written by a
session that did not author this assessment, to a contract frozen before its
first run. The instrument gap behind deviation 3 also needs fixing before the
next judged round: a seat that answers in findings format cannot fill a scoring
table.
