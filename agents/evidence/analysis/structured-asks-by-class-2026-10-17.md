<!-- evidence-type: analysis -->
# Structured asks by class — 2026-10-17

Step 5.1 of `road-to-agent-throughput-recovery`: count violations of
`no-cheap-questions`, not asks, and count how often the recommended option is
the one taken.

## Corpus

The same window `probe_turnaround` reads: the 10 most recently modified
sessions of the main checkout's transcript store, measuring session excluded,
read 2026-10-17. **266 turn ends, 86 structured asks** (numbered options plus a
recommendation line, `classifyTurnEnd`). Each ask was paired with the next
genuine user-role entry (`userText`, `isInjectedBody` — the probe's own filters).

## First split: who answered

| reply after the ask | asks |
|---|---|
| a background-task notification, a stop-hook message or a subagent message | 54 |
| the owner | 32 |
| **total** | **86** |

The 54 are not new questions. Each is a decision already put to the owner and
re-presented because the agent ran again before the owner answered — the
behaviour `user-interaction` Iron Law 3 prescribes on every wake. In one
session a single retroactive-approval question was re-presented eight times
(asks 75–82) and a host-config question fourteen times (asks 43–56). **Most of
the ask count is re-presentation volume, not question volume.**

## Second split: the 32 owner-answered asks, three ways

Criteria, fixed before classifying. *Owner-reserved*: the owner-reserved set of
`decision-revisit-gate` (purpose, public or compatibility commitment, lowering a
floor, irreversible, spend above a threshold, governance self-amendment) plus
the Hard Floor (merge, push, deploy, acting on a file outside the repository),
the owner's own content, a retroactive approval of an agent action, and any
roadmap disposition that drops an item (`roadmap-progress-sync` preservation
test). *Cheap*: a `no-cheap-questions` violation — a continuation prompt under a
mandate (Iron Law 4), pure sequencing or format, or one dominant option.
*Council-decidable*: everything else — a reversible technical choice inside the
envelope.

| class | asks | recommended option taken |
|---|---|---|
| owner-reserved | 19 | 15 |
| council-decidable | 12 | 10 |
| cheap | 1 | 0 |
| **total** | **32** | **25** |

Read by one agent from the options text and the reply; a second reader may move
single rows between owner-reserved and council-decidable. Two rows (85, 86) are
shown in the class the owner named in words, not the class the criteria gave;
the criteria tally is beside it below, so neither reading is hidden.

| # | session | class | basis | recommended taken |
|---|---|---|---|---|
| 2 | `4ab274a5` | owner-reserved | distribution goal of the package (purpose, public commitment) | yes |
| 3 | `4ab274a5` | owner-reserved | estate cap, which roadmaps reach the estate | no — owner rejected all options |
| 4 | `4ab274a5` | owner-reserved | push a PR now | yes, with "try the council first" for the bundled questions |
| 5 | `a670a1b7` | owner-reserved | spelling of the owner's own string | no |
| 6 | `6ea9dba3` | owner-reserved | close a phase as an unmeasured null (drops an item) | yes |
| 7 | `6ea9dba3` | owner-reserved | separate PR, bundled PR, or no push | yes |
| 8 | `6ea9dba3` | council-decidable | approve or reject an ADR addendum adding one config line | yes |
| 9 | `6ea9dba3` | council-decidable | a timeout: host default or one hour | yes |
| 10 | `6ea9dba3` | council-decidable | keep measuring, reopen, or narrow a precompilation | yes |
| 11 | `6ea9dba3` | council-decidable | how the plugin gets its dispatcher | no — owner: "try the council first" |
| 12 | `6ea9dba3` | council-decidable | the same question after the council | yes |
| 15 | `6ea9dba3` | owner-reserved | revert commits that attributed a decision to the owner | yes |
| 16 | `6ea9dba3` | owner-reserved | raise a paid-replay ceiling (spend) | yes |
| 18 | `6ea9dba3` | owner-reserved | land a step or have the owner bypass branch protection | yes |
| 21 | `6ea9dba3` | council-decidable | a taxonomy reassignment in a finding | yes |
| 28 | `dbc2e8b1` | owner-reserved | merge with a red check, or force-push a reword | yes |
| 29 | `dbc2e8b1` | owner-reserved | merge a pre-registered revert | no — owner took option 3 |
| 31 | `dbc2e8b1` | owner-reserved | raise a paid-replay ceiling (spend) | yes |
| 40 | `dbc2e8b1` | owner-reserved | semver policy for removing a settings key (compatibility) | yes |
| 41 | `dbc2e8b1` | council-decidable | fix review findings in a 4th round, approve directly, or park | yes |
| 42 | `dbc2e8b1` | owner-reserved | the package writing a host override into the user's config | yes |
| 57 | `dbc2e8b1` | owner-reserved | the agent editing a file outside the repository | yes |
| 58 | `dbc2e8b1` | council-decidable | correct a sentence or migrate frontmatter | yes |
| 66 | `dbc2e8b1` | council-decidable | wait for a quota reset or review in the council now | yes |
| 69 | `dbc2e8b1` | owner-reserved | replan, close as null, or park a roadmap (drop option) | yes |
| 71 | `dbc2e8b1` | owner-reserved | owner reviews and merges a PR | no — owner took option 2 |
| 74 | `dbc2e8b1` | council-decidable | scope of a two-stage watch | yes |
| 82 | `dbc2e8b1` | owner-reserved | retroactive approval of a PR merged without the owner | yes |
| 83 | `2d77e486` | owner-reserved | new branch, cherry-pick, push, open PR | yes |
| 84 | `6da9a8d7` | cheap | a command's own sub-command menu, no trade-off | no — owner wrote about something else |
| 85 | `63f314f3` | council-decidable | whether a retro reads transcripts by default | yes |
| 86 | `63f314f3` | council-decidable | how self-repair reports leave a consumer project | no — owner: "these were all council-suitable; why did you ask me?" |

Asks 85 and 86 are owner-reserved under the criteria fixed above (a privacy
default, an egress route): **by the criteria, 21 / 10 / 1**. The owner's reply
to 86 called that session's questions council-suitable, so the table shows them
council-decidable: **by the owner's words, 19 / 12 / 1**. The two tallies
disagree on exactly these rows, and the disagreement says the criteria
over-reserve; neither changes the cheap count.

## Reading

- **The cheap class is 1 of 32.** `no-cheap-questions` violations, as that rule
  defines them, are not where the asks are; step 5.2's precondition ("the cheap
  class holds most ask minutes") does not hold.
- **The recommendation was taken 25 of 32 times (78 %).** The draft's assertion
  that the recommended option is nearly always taken holds in direction, not as
  "always": 7 replies took another option, rejected all, or redirected.
- **12 of 32 owner-answered asks were council-decidable**, and the owner said so
  in words for two of them. That is the class a fix would target, under
  `ai-council`'s council-first rule, not under `no-cheap-questions`.
- **54 of 86 structured asks are re-presentations** triggered by background
  wakes. Each costs a turn end, not an owner decision.
