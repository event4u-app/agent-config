# Codex catalogue truncation — what the second host actually settled

Phase 3 of `road-to-skill-catalogue-budget`. Measured 2026-08-15 on one
machine, against `codex exec --json --skip-git-repo-check`. Every number below
came out of the host's own JSON channel or out of a file count; nothing here is
arithmetic over an assumption.

## 1. The corpus now holds two hosts, and they truncate differently

`agents/evidence/metrics/skill-catalogue.jsonl`:

| host | mode | source | observed | figures |
|---|---|---|---|---|
| claude | `per-entry` | self-report | 2026-08-12 | 336 entries, 16 bare, verdict `no-selector` |
| codex | `budget-strip-and-drop` | host-event | 2026-08-15 | 497 projected, host dropped 393 |

`capture_skill_catalogue --limits` reports these **per host** and states that
the modes differ. That is the load-bearing output: a pooled verdict would carry
claude's `no-selector` across a host that has no per-entry selector to find,
which is Risk 1 of the roadmap that asked for the field.

**The parent's blocker is not discharged by this.** It asks for ≥ 20
observations across ≥ 2 hosts. The host axis is now satisfied and the volume
axis is not — 2 of 20. What changed is that the codex half can now fill without
a human transcribing anything.

## 2. The double-count reading is REFUTED, from host output

The parent roadmap recorded an inference: 698 dropped ≈ 2 × (298 skills + 200
commands), which would mean hosts list each command twice under two naming
schemes. It was explicitly flagged as not-to-build-on. Two controlled probes
settle it.

**Probe A — commands. Delta 0.** Added 60 command files, measured, removed them.

| condition | dropped (3 runs) |
|---|---|
| baseline | 401, 393, 393 |
| +60 commands, nested `commands/_probe/*.md` | 393, 393, 393 |
| +60 commands, flat `commands/*.md` | 393, 393 |

The dropped count does not move with the command set **at all**, at either
nesting depth. Commands do not contribute to this number once, let alone twice.

**Probe B — skills. Delta ≈ 1:1.** Added 60 skill directories, each with one
`SKILL.md`, measured, removed them.

| condition | dropped |
|---|---|
| baseline | 393 |
| +60 skills | 446, 446 |

Δ = **+53** against +60 added. Run-to-run noise on an identical prompt is 393
–401 (spread 8), so +53 is consistent with 1:1 within noise and **decisively
inconsistent with 2:1**, which would have predicted +120.

**Verdict: the 698 double-count reading does not reproduce.** Nothing in the
tree should cite it. What the dropped count tracks is the skill set, roughly
one for one.

## 3. The host's denominator is NOT this tool's projection

This is the finding that corrected the instrument rather than confirming it.

- `~/.codex/skills` — 298 directories, 297 carrying `SKILL.md`, but **710
  `.md` files** in total (each skill ships reference documents beside it).
- `~/.codex/commands` — 200 `.md` files across 101 directories.
- `capture_skill_catalogue --volume ~/.codex` reports 497 artefacts and 55,114
  bytes of declared description. The byte figure was cross-checked against an
  independent count of the same tree and matches exactly.

The host reported dropping 393 while being offered 497 by this tool's count —
and adding 60 to the command half of that 497 moved the host's number by zero.
So the two figures do not share a denominator, and `entries_total −
dropped_count` is **not** a delivered count.

It was, until this phase. `buildHostEventRecord` derived `survived` by exactly
that subtraction and published it as `bare_count`; `knownHostLimits` published
it again as `deliveredEntries`; the deploy warning printed it to the operator
as *"delivered only 96 of 497"*. Every one of those was a confident number
describing neither host. They are gone: a record now carries the host's dropped
count and this tool's projection, each labelled with whose number it is, and
nothing subtracts them.

**What the host counts is still unknown.** 393 exceeds the 297 skills carrying
a `SKILL.md`, and the reference `.md` files are the obvious candidate at 710 —
but that is inference of exactly the kind probe A just refuted elsewhere, so it
is recorded as open, not as a finding.

## 4. Does codex discharge the parent's "selector is estate size" branch?

The parent's Phase 2 Step 2 is conditional: *"If the selector is estate size —
project a workspace-scoped skill subset at install."*

**On codex: yes, for that host.** The host names its own mechanism — *"Exceeded
skills context **budget**"* — and probe B shows the drop scaling with the
number of skills projected. A smaller projected set is directly fewer dropped
entries on this host. The conditional fires.

**Across hosts: no, and the distinction matters.** claude's observation returned
`no-selector` under a per-entry mechanism, and probe A shows the two hosts do
not even count the same artefacts. Codex's evidence is evidence about codex.
Reading it as "the selector is estate size" in general would be the pooled
verdict this phase exists to prevent.

**Consequence for the parent, stated so its author does not have to re-derive
it:** the branch is dischargeable per host, not globally, and a workspace-scoped
projection is justified on codex today. Whether to *ship* that as a default is
the user-owned `scoped-default-decision` blocker in Phase 4 and is untouched
here.

## 5. Unresolved, recorded as such

- **What the host's catalogue denominator is.** 393 > 297 skills; 710 `.md`
  files under `skills/` is a candidate and nothing tested it.
- **Why the count varies 393–401 across identical runs.** An 8-entry spread on
  a fixed prompt and a fixed tree. Any future threshold read off this number
  needs a margin wider than that, and the delta probes above were sized for it.
- **The parent's ≥ 20-observation bar.** 2 of 20. The codex path is now
  automatable, which is what the blocker said was missing; filling it is a
  matter of running the capture, not of building anything.

## Reproducing

```bash
# projection half, byte-accurate
agent-config exec capture_skill_catalogue --volume ~/.codex --host codex

# observation half, straight off the host's own channel
codex exec --json --skip-git-repo-check "reply with exactly: OK" \
  | agent-config exec capture_skill_catalogue \
      --host-event - --host codex --host-root ~/.codex

# per-host verdicts and every measured truncation
agent-config exec capture_skill_catalogue --limits
```
