# The host's per-skill listing override, observed in a session

<!-- evidence-type: analysis -->

Produced by `road-to-a-search-answer-a-model-can-choose-from` 0.1, on
2026-10-13. Four of the five columns that step asks for are established here;
the fifth is named as NOT established, with the reason, rather than filled from
the schema string.

## What was pinned

| | |
|---|---|
| Host | Claude Code |
| Build | `2.1.296` (`claude --version`) |
| Binary | `/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe` |
| Date | 2026-10-13 |
| Session shape | `claude -p --settings <scratch json> --model haiku`, one turn per probe |

The override values were supplied through `--settings <file>` — an additional
settings layer the host accepts on the command line — rather than by writing a
settings file into a scratch `HOME`. This run could not set `HOME`, so the
layer the values arrived on is the CLI one and not the user one. That is the
whole reason column five below is open.

## The schema, read statically from the same build

`strings` over the binary returns this description verbatim, 22 occurrences of
the key in total:

> Per-skill listing overrides keyed by skill name. "name-only" lists the skill
> without its description; "user-invocable-only" hides it from the model but
> keeps /name; "off" hides it from both. Absent = on.

A schema string says what a value is MEANT to do. The table below is what a
session did.

## Observed, per value

Each cell is one probe. `listed` and `description` were read out of the Skill
tool's available-skills listing by asking the model to report on named entries;
`model invocation` was a Skill-tool call on the name; `/name` was the slash
command in print mode.

| value | listed to the model | description shown | model invocation by name | `/name` |
|---|---|---|---|---|
| absent (= `on`) | **yes** | **yes** | yes | yes |
| `name-only` | **yes** | **no** | **RAN** | **ran** |
| `user-invocable-only` | **no** | no | **REFUSED** | **ran** |
| `off` | **no** | no | not listed | **REFUSED** |

The two refusals are the host's own wording, captured verbatim:

- `user-invocable-only`, model invocation —
  `Skill agent-status is disabled for model invocation in skillOverrides settings`
- `off`, slash command —
  `Skill "accessibility-auditor" is disabled via skillOverrides. Remove the override from your settings to run it.`

Every observed cell agrees with the schema string. Nothing contradicts it.

## The column this run did NOT establish

**A project value overriding the user value.** The user layer
(`~/.claude/settings.json`) on this machine carries no `skillOverrides` key at
all, so there is no user value for a project value to override. Establishing it
would mean writing one into the user's own settings file, outside the
repository and not undone by a `git checkout` — this run declined to do that.

So the precedence question stays open, and the schema does not answer it: it
describes what each VALUE means, never which LAYER wins. Anyone citing this
artifact for a precedence claim is citing something that is not in it.

## A second observation, taken on the way

Asked to count its own listing, the baseline session reported **497 skill
entries, 92 of them carrying a description** — 19 %, on this install, on this
build, on 2026-10-13. That is a fresh reading of the same truncation
`src/scripts/_lib/host_listing_model.ts` models from upstream prose, and it is
the first in this tree taken against build 2.1.296.

It also constrained the probe itself, which is why it is recorded rather than
noted. The first two skills chosen — `check-current-md` and `explain-run` —
came back `listed=yes, description=no` at BASELINE, with no override set at
all: the budget had already dropped their descriptions, so `name-only` would
have been indistinguishable from the default on those entries. The probe moved
to three skills that do carry a description at baseline.

**One number, one install, one session.** It is not a rate, it does not
generalise to another machine, and the fill order that decides WHICH 92 survive
was not measured here.

## Offered to

`agents/roadmaps/later/road-to-host-catalogue-contract.md`, which is parked on
a catalogue observation against a named host build. This is one such
observation. It does not answer that file's projection-rule question, and it is
not offered as if it did.
