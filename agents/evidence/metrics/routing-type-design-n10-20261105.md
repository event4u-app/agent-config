<!-- evidence-type: analysis -->

# `type-design` at ten runs per catalogue, and council round 3, 2026-11-05

**Roadmap:** `road-to-routing-assurance-live-floors-carried` 1.3.
**Protocol:** `agents/evidence/preregistration/routing-type-design-n10-protocol-20261105.md`,
committed before the run. **Rows:** `routing-type-design-n10-20261105.json`.
Host **2.1.316**, `claude-opus-5-5`, case `061-type-design-q5` byte-identical in
both arms, fixture `9663e579`, through the subscription CLI (CLI estimates
1.87 + 2.16 USD).

## Result

| Arm | Catalogue | Fired | Errored |
|---|---|---|---|
| frozen | `1c967b17…` (301 skills) | 10/10 | 0 |
| today | `e0ec68d3…` (303 skills) | 9/10 | 0 |

- **Floor:** today's arm at 9/10 meets 0.90. Per the protocol, `type-design`
  closes for the fixture series.
- **Catalogue effect:** not shown. A two-sided Fisher exact test on 10/10 vs 9/10
  gives p = 1.0. The v1 reading of 0/3 on today's catalogue, and the ablation
  cells at 1/3, are therefore not attributed to the catalogue's composition.
  The one miss has the same trace shape as v1's: it read the SVG and delegated
  the font build to a subagent.

## Council round 3 — `react-shadcn-ui` and `project-analysis-core`

The question: both units score 0/3 because the host does the work itself (a
direct two-file edit, and a direct read of a small repository). No competing
skill takes the prompt. The options were:

- (a) retire both positives as "no skill needed";
- (b) a v2 series with larger prompts;
- (c) leave both units below the floor, as an owner decision;
- (d) another option.

Both seats (anthropic, openai; 2026-11-05) chose **(d)**:

- The run counts show that the skill was bypassed. They do not show that it is
  not needed.
- Before choosing between (a) and (b), define what each skill is expected to
  add, and judge whether the host's direct output meets that.
- Freeze the decision rule before any fresh validation. A retirement then
  remains visibly post hoc relative to the known 0/3.
- (b) alone would substitute a different construct: routing for other tasks
  would not repair these cases.

**What would change it:** an independent output assessment that shows direct
handling is adequate leads to (a). One that shows it falls short, over a valid
broader task population, leads to (b). The run in which the pilot went
through `analysis-skill-router` stays classified as a separate outcome.
