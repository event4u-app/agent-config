<!-- evidence-type: analysis -->

# Pre-registration — the prompt series v2 for `react-shadcn-ui` and `project-analysis-core`

**Roadmap:** `road-to-routing-assurance-live-floors-carried` 1.3.
**Written:** 2026-11-08, committed before any case of this series runs. Results
land in later commits.
**Author:** a session that did not author
`routing-direct-output-assessment-protocol-20261108.md` or its result, and did
not see any run's output text. It read the assessment's summary and the v1
records only.
**Why it exists:** `agents/evidence/metrics/routing-direct-output-assessment-20261108.md`
— disposition (b) for both units: the direct output falls short of what each
skill states, so the positives stay and a v2 prompt series is owed, with its
contract frozen before its first run.

## The series

| Unit | Case (`<rank>-<skill>-<id>`) | Fixture (`internal/bench/trigger-fixtures/`) | sha256[0:8] | query sha256[0:12] | Extra tools |
|---|---|---|---|---|---|
| `react-shadcn-ui` | `0334-react-shadcn-ui-rsu-v2-add` | `react-shadcn-ui/rsu-v2-add/scaffold.sh` (new) | `d90aec2a` | `d51402828931` | Edit, Write |
| `react-shadcn-ui` | `0333-react-shadcn-ui-rsu-v2-compose` | `react-shadcn-ui/rsu-v2-compose/scaffold.sh` (byte-identical to `rsu-v2-add`) | `d90aec2a` | `aa8476c3a4ad` | Edit, Write |
| `react-shadcn-ui` | `0327-react-shadcn-ui-rsu-v2-polish` | `react-shadcn-ui/rsu-v2-polish/scaffold.sh` (byte-identical to `rsu-v2-add`) | `d90aec2a` | `24a007c13cb4` | Edit, Write |
| `project-analysis-core` | `0742-project-analysis-core-pac-v2-onboard` | `project-analysis-core/pac-v2-onboard/scaffold.sh` (byte-identical to v1 `q1`) | `059d2030` | `2c589d3c633e` | — |
| `project-analysis-core` | `0739-project-analysis-core-pac-v2-versions` | `project-analysis-core/pac-v2-versions/scaffold.sh` (byte-identical to v1 `q1`) | `059d2030` | `4238ca27f075` | — |

The `react-shadcn-ui` fixture is a small Vite + React 19 + Tailwind 4 app with a
`components.json`, an `src/index.css` carrying the CSS-variable tokens, four
generated primitives (`button`, `input`, `label`, `card`), a settings page whose
destructive button deletes on click, an admin members page rendering a plain
list, and a pricing section with uneven card padding, a badge coloured for light
mode only, and raw `<button>`s with `outline-none`. It names no skill and no task.
The `project-analysis-core` fixture is v1's 20-file monorepo, unchanged.

### The prompts, verbatim

Each is a new case in its unit's `src/skills/<unit>/evals/triggers.json`,
`trigger: true`, `class: exemplar`. No existing case was edited or removed.

- `rsu-v2-add` — Deleting a workspace on the settings page happens on a single click right now. Add a confirmation dialog in front of it that matches the rest of our UI.
- `rsu-v2-compose` — The admin members page is still a bare list. Turn it into a proper table with name, email, a role badge, and a per-row menu with "Change role" and "Remove", built the same way as the rest of the app's components.
- `rsu-v2-polish` — Design review on the pricing section came back: the three cards have uneven padding, the "Most popular" label is unreadable in dark mode, and the plan buttons show no focus state when you tab through them. Please fix those.
- `pac-v2-onboard` — I'm taking over this repository next week and nobody who built it is still around. Before I change anything, give me the lay of the land: what it's built with, how the parts fit together, and what happens from the moment a request comes in.
- `pac-v2-versions` — Our security review needs to know exactly which versions of the runtime, the frameworks and the main libraries this project runs on, and how a request travels through it. Work it out from the repo and flag anything you couldn't pin down.

## Frozen

- **Selection.** `compile_trigger_evals --baseline-plan --units 999 --per-unit 10
  --only react-shadcn-ui,project-analysis-core --fixtures internal/bench/trigger-fixtures`,
  then every case directory under `evals/` except the five named above is
  deleted before the run. At `--per-unit 10` both units contribute every
  positive, so the five carry the rank prefixes in the table; a different
  prefix at run time means the corpus moved and the run does not start. The
  per-unit-1 selection the baseline and canary use is unchanged by these
  additions: it still yields `066-react-shadcn-ui-rsu-e2` and
  `147-project-analysis-core-q1` (checked when this file was written).
- **Instrument:** `claude plugin eval --scaffold`, model `claude-opus-5-5`,
  `--runs 3`, `--ablation none`, `--no-publish`, `--trust-plugin`,
  `--keep-temp`, `max_turns: 10`, through the subscription CLI. Two invocations
  on the same plugin: `--tag skill:react-shadcn-ui` with the operator grant
  `--allow-tools Edit Write` (v1 found the case-level declaration alone does not
  grant them), and `--tag skill:project-analysis-core` with no grant. The
  artefact names the host version.
- **Allowed tools:** Read, Glob, Grep, Skill for every case; Edit and Write in
  addition for the three `react-shadcn-ui` cases, through their `fixture.json`
  and the operator grant. Nothing else.
- **Catalogue:** `dist/agent-src/skills/` at the commit carrying this file;
  `catalogue_sha256` `828f2e07…` when this file was written. The artefact names
  the hash it ran on, and a different hash is reported as a deviation.
- **Run count:** 3 runs per case — 9 for `react-shadcn-ui`, 6 for
  `project-analysis-core`, 15 in all. No retries; an errored run is UNKNOWN, is
  not replaced, and leaves its unit's denominator.
- **Pass rule, unchanged from v1 and the baseline grader:** a run passes when
  it called `Skill` with the unit's own name (the compiled `tool_used` grader,
  `[":]<unit>"`).
- **Indirect dispatch:** counts only as that same observation. A router skill
  that then calls `Skill` with the unit's name in the same run passes; a router
  that names, recommends or does not dispatch to the unit does not; a subagent
  and a direct answer do not.
- **Baseline source per unit:** the unit's row in `routing-baseline-20261027.json`
  and its registered floor in `docs/contracts/routing-assurance-floors.json`
  (`baseline_recall` 1, floor 0.90, for both units). No v2 case has a baseline
  row of its own; the classification is unit-level, pooled over the unit's v2
  cases.
- **Floor:** 0.90 on the pooled recall, which at these counts means 9/9 and
  6/6 — every case 3/3. Classified by `compile_trigger_evals --classify`
  against `routing-baseline-20261027.json` and the floors file. The report also
  gives each case's own count.

## After the run

- A unit that passes closes for 1.3 on this series. A unit below records the
  trace shape of each miss (what it invoked, whether it asked for material,
  whether it edited or answered directly) as its reason.
- No prompt or fixture is edited in response to a result; a changed prompt or
  fixture is a v3 and needs a new contract.
- These rows become the v2 series' own baseline for later canaries. v1 and the
  unfixtured series stay as recorded; none replaces another.

## Choices

- **Three prompts for `react-shadcn-ui`, two for `project-analysis-core`.**
  One prompt per lane the skill names for itself: `react-shadcn-ui`'s
  description and When-to-use name apply, review and polish, which in a user's
  words are adding a primitive that is not there yet (`rsu-v2-add`), composing a
  screen from primitives (`rsu-v2-compose`) and acting on design-review findings
  (`rsu-v2-polish`). `project-analysis-core` names discovery of an unknown
  codebase and resolving versions plus the execution flow; one prompt each.
  Rejected: a single prompt per unit, which is what left v1 unable to say
  whether a miss belonged to the unit or to one phrasing.
- **The restyle lane is not repeated.** v1's `rsu-e2` measured it and stays in
  the corpus and the record. Repeating it would re-measure a known 0/3; the
  three v2 lanes are the ones not yet measured. This is a coverage choice, and
  it has a side the reader should see: the add lane involves an installer the
  skill gates, which may make routing likelier. It is included because it is
  the skill's first-named job, not because of that.
- **No skill name, no library name in the prompts.** None says "shadcn",
  "components.json" or "components/ui"; the workspace carries the detection
  signals the skill itself lists (`components.json`, a folder of generated
  primitives). Rejected: naming shadcn as several existing exemplars do — it is
  most of the skill's name. The `project-analysis-core` prompts avoid
  "analyze", "architecture" and "discover", the skill's own vocabulary, and say
  what a new owner or a security reviewer would ask for.
- **Two coincidences with the assessment's criteria, disclosed.** The polish
  prompt asks for a focus state (the assessment's R5) and the versions prompt
  asks to flag what could not be pinned down (its P8). Both are in because the
  request is ordinary without them — a review that missed keyboard focus would
  be an odd review, and a security reviewer asking for versions wants to know
  which are certain. The series measures routing, not output quality, and
  neither line names or describes the skill.
- **A new fixture for `react-shadcn-ui`; v1's left as it is.** The prompts refer
  to a settings page, a members page and a pricing section, and v1's fixture
  (`d4061c2f`, two files) has none of them nor a `components.json`. v1's
  contract makes a changed fixture a new version, so v1's is untouched and the
  three v2 cases share one new script. Rejected: three different workspaces,
  which would add a second variable between the three prompts.
- **`project-analysis-core` keeps v1's fixture byte-for-byte.** The prompt is
  the variable this series owns. Rejected: a larger repository — v1 sized the
  fixture before any run and forbade resizing it after, and v1's runs found it
  small enough to read directly; growing it now would tune the workspace toward
  routing.
- **Pass rule, floor and run count kept from v1.** No reason to change them was
  found, and changing them would make v2 incomparable with v1. Three runs per
  case cannot separate 2/3 from 3/3 noise, which the floor makes moot here: any
  miss fails the unit.
- **No German prompt.** The corpus already has one per unit; language is not
  this series' variable.
- **Case ids were chosen by name, then checked.** Adding positives can move the
  per-unit-1 selection the baseline and canary read; the check above shows it
  did not, so no id was renamed for ranking.
- **The projected `dist/agent-src/skills/<unit>/evals/triggers.json` was
  regenerated** with `task sync`, which changed those two files and nothing
  else. The catalogue hash reads `SKILL.md` only, so it is unaffected.
