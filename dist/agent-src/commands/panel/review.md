---
model_tier: high
name: panel-review
pack: engineering-base
visibility: internal
cluster: panel
sub: review
skills: [subagent-orchestration]
description: Let angle reviewers hunt findings in one artifact, jurors verify each against the source and reject the unverifiable, one merger dedupes and ranks
argument-hint: "[file(s) to review] [--reviewers N] [--angles file]"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via /panel or its explicit name; spend-bearing fan-out."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /panel review

## Instructions

### 1. Prepare the material

Put the artifact under review in a run folder as **line-numbered** text files,
plus `task.md`: the goal, the frame, and every decision the author made on
purpose (a deliberate choice is a finding only if the text implements it wrongly
or with a nameable risk). Reviewers read only these files.

### 2. Choose the angles

Default 16 reviewers, each with one **distinct angle**: the parties affected
(each side's advocate), the governing rules or standards, internal consistency
(references, numbering, defined terms), each major section by a specialist, edge
cases computed by hand, and one first-time reader without domain training. Fewer
angles for a small artifact; never two reviewers with the same angle.

### 3. Reviewers, in parallel

Each returns at most 6 findings, strongest first:

```json
{ "findings": [ {
  "document": "<file>", "line": "<n or range>", "location": "<section>",
  "quote": "verbatim, at most 25 words",
  "severity": "FATAL | MAJOR | MINOR",
  "problem": "at most 60 words",
  "basis": "a rule the reviewer knows for certain, or 'assessment'",
  "proposal": "concrete new wording or change, at most 70 words"
} ] }
```

FATAL = does the opposite of what is intended or contradicts itself; MAJOR = real
risk or gap; MINOR = vagueness. Reviewers are told a juror will check every
finding against the text and that unfounded findings count against them —
three proven findings beat six suspected ones; an empty list is allowed.

### 4. Jurors verify, in parallel

Pair reviewers with different angles; one juror per pair, seeing the findings
but not the angles. An odd reviewer count gives the last juror a group of three —
no reviewer's findings reach the merger unverified. Per finding the juror:

1. looks up the line — quote absent or not saying what is claimed → **reject**;
2. reads the surrounding text and references — another passage defuses it → **reject**;
3. it only wants a deliberate decision from `task.md` changed, with no text
   error or nameable risk → **reject**;
4. otherwise **confirms**, sets severity itself, restates the problem in its own
   words, checks the proposal for knock-on errors, and classifies it as text
   error, risk, or decision the owner must make;
5. the same point from both reviewers → confirmed once, both named.

In doubt, reject. The juror names which reviewer carried more confirmed weight.

### 5. Merger — one agent

Merge confirmed findings on the same location and problem (count how many
reviewers raised each independently), re-check each against the text once more
and drop what does not hold, record contradictory jurors as conflicts and pick
one version, then rank: FATAL/MAJOR text errors, risks, owner decisions, MINOR.
The merger invents no new findings.

### 6. Report

The ranked list (rank, location, severity, kind, problem, change, raised-by),
the conflicts, and the counts (findings raised, confirmed, rejected). Owner
decisions go to the user as **one** numbered-options question. Edit the artifact
only on the user's word.
