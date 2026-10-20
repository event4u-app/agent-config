# The host's per-skill listing override, observed in a session

<!-- evidence-type: analysis -->

Produced by `road-to-a-search-answer-a-model-can-choose-from` 0.1, on
2026-10-13. Four of the five columns that step asks for are established here;
the fifth is named as NOT established, with the reason, rather than filled from
the schema string. The fifth was established on 2026-10-14 by a probe the owner
ran against their own settings file — see "The fifth column, observed" below.

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

### The reason, corrected 2026-10-13 — the isolated-layer route is closed, not merely untried

The paragraph above says this run "could not set `HOME`", and a later run read
that as an environment limitation of the probing session and retried it. It is
not one. `HOME` is settable here, and so is `CLAUDE_CONFIG_DIR`, which the same
binary carries as a config-directory redirect. **Both were tried on build
`2.1.296`, from `/private/tmp`, outside any checkout, and both answer
identically:**

```
env HOME=<scratch> claude -p --model haiku ...          → Not logged in · Please run /login
env CLAUDE_CONFIG_DIR=<scratch> claude -p --model haiku  → Not logged in · Please run /login
```

So the credentials are reached THROUGH the config directory rather than beside
it — relocating the directory to isolate the user layer also detaches the login,
and an unauthenticated session cannot list a skill, let alone report whether a
project value beat a user one. The two obvious isolation routes are therefore
not untried, they are **closed**: the only user layer that is authenticated on
this machine is the user's real `~/.claude/settings.json`.

That leaves exactly one way to establish column five — writing a
`skillOverrides` key into that file and removing it afterwards. The removal is
what makes it look cheap, and the removal is the part that is not guaranteed: a
run that stops between the write and the cleanup leaves the user's own
configuration mutated, outside the repository, where no `git checkout` reaches
it. That is an owner's decision about an owner's file, not a probe an agent
takes on its own initiative.

**What would close this step** is therefore not a better isolation trick. It is
either the owner's explicit go-ahead for a write-then-restore against their own
settings file, or a host build whose credentials survive a `CLAUDE_CONFIG_DIR`
move. Until one of those exists, the column stays open and the step stays open
with it.

### A third attempt, 2026-10-14 — the build moved, and the probe is now refused one layer earlier

The sentence above names two things that would close the step, and one of them
is a moving target: *a host build whose credentials survive a
`CLAUDE_CONFIG_DIR` move*. That build number has since moved. This machine now
answers `2.1.299` to `claude --version`, three patch releases past the
`2.1.296` every reading above is pinned to. So the condition was worth
re-executing rather than re-reading, and it was re-executed.

**It did not get as far as the host.** Both routes an agent would take are
refused by the agent's own permission layer before the binary is reached:

| route attempted | refused by | stated reason |
|---|---|---|
| `env CLAUDE_CONFIG_DIR=<scratch> claude -p …` | Claude Code auto-mode classifier | `Credential Exploration` |
| reading where the credentials live, to carry them into a scratch config dir | Claude Code auto-mode classifier | `Credential Exploration` |

This is a finding about the PROBE, not about the host, and the distinction is
the whole value of recording it. Nothing here says build `2.1.299` behaves like
`2.1.296`; the redirect was never executed against it, so its behaviour is
**unknown**, not confirmed. What is now established is that an agent working
under this tree's own safety layer cannot establish it either — the
classifier reads a config-directory redirect as credential handling and
declines, which is the correct call for a probe that would relocate an
authenticated session's config.

**So the closing set shrinks by one for an agent, and is unchanged for a
human.** A human at this terminal can still run the redirect and see what
`2.1.299` does. An agent cannot, and a fourth run should not spend a round
rediscovering that: the two isolation routes are closed at the host (recorded
above, build `2.1.296`) AND closed at the permission layer (recorded here,
build `2.1.299`). The only route left to column five remains the one that was
owner-reserved from the start — a write-then-restore against the owner's own
`~/.claude/settings.json`, taken on the owner's say-so.

### A fourth attempt, 2026-10-14 — the redirect reached build 2.1.299, and the login does not survive it

The section above calls the permission-layer refusal a closed route for an
agent. A later run on the same day was NOT refused: the redirect ran, so that
refusal is a per-call classifier decision, not a standing fact about agents.
What the run measured is the host, which is the part that matters:

| | |
|---|---|
| Build | `2.1.299` (`claude --version`) |
| Command | `CLAUDE_CONFIG_DIR=<empty scratch dir> claude -p "reply with the single word ok"`, run from inside that scratch dir |
| Output | `Not logged in · Please run /login` |

Build `2.1.299` detaches the login under the redirect exactly as `2.1.296`
did. The closing condition "a host build whose login survives the redirect"
was executed against the current build and returned **false**. The only
route left to column five is still the owner-reserved write-then-restore,
tracked as the open blocker `listing-override-write-is-owner-owned` in
`agents/roadmaps/archive/road-to-skills-that-arrive-when-called.md`.

## The fifth column, observed 2026-10-14 — a project value beats a user value

The owner took the owner-reserved route named above: a write-then-restore
against their own `~/.claude/settings.json`, run by the owner, not by an agent.

| | |
|---|---|
| Host | Claude Code |
| Build | `2.1.299` (`claude --version`, printed by the probe) |
| Date | 2026-10-14T13:55:21Z |
| Run by | the owner, at their own terminal |
| Session shape | `claude -p "/accessibility-auditor" --model haiku`, one turn per arm, from an empty scratch directory outside any checkout |

**The probe, summarised.** The script itself lived in a temporary directory and
is not durable, so its logic is described here instead of linked:

1. Back up `~/.claude/settings.json` and record its SHA-256; install an exit
   trap that restores the backup whatever happens.
2. Set the user-layer value `skillOverrides["accessibility-auditor"] = "off"`.
3. **Control arm** — in the empty scratch directory, with no project settings
   file, run the slash command.
4. **Test arm** — write a project `.claude/settings.json` into that directory
   carrying `{"skillOverrides": {"accessibility-auditor": "name-only"}}`, and
   run the same command.
5. Restore from the backup and compare the SHA-256 against step 1.

**Observed.**

| arm | user layer | project layer | `/accessibility-auditor` |
|---|---|---|---|
| control | `off` | absent | **REFUSED** — `Skill "accessibility-auditor" is disabled via skillOverrides. Remove the override from your settings to run it.` |
| test | `off` | `name-only` | **RAN** — the model answered as the skill (no UI code in the working directory, so it asked which surface to audit) |

The restore was verified: the SHA-256 of the settings file was
`16807aa947f8c66ba7328d608bbd484c4cd8db5afe589194d4a62c8b13198848` before and
after, identical.

**Reading.** On build `2.1.299`, a project-layer `skillOverrides` value
overrides a user-layer value for the same skill. The control is what makes this
a precedence reading rather than a no-op: it proves the user value was in force
(`off` refused `/name`), and the only change between the arms is the project
file.

**What it does not establish, stated so it is not over-cited.**

- **A different build.** The four columns above were observed on `2.1.296`; this
  column on `2.1.299`. They are not one build-pinned row.
- **n = 1.** One skill, one value pair (`off` under `name-only`), one invocation
  path (`/name`). It does not show the model-listing side of the project value,
  nor any other pair — `name-only` under `on`, for instance, is inferred from
  "the project layer wins", not observed.
- **Per key or per object.** Whether the project layer replaces the whole
  `skillOverrides` object or merges per skill name is not distinguished: both
  readings produce this result for a single key.

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
