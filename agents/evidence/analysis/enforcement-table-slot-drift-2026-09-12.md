<!-- evidence-type: analysis -->
# Enforcement table vs per-slot lowering values — measured 2026-09-12

The published enforcement matrix in `docs/enforcement-by-host.md` states, per
**host**, whether a deny is honoured. The file the runtime resolver actually
reads, `src/scripts/hooks/host_lowering.yaml`, records a blocking value per
**(host, surface, slot)**. Those are different shapes, and until this run
nothing had compared them. This is the measurement.

**Pinned to `9e85c0bf3a1e163b0b6db48ebee8e2b7f37867a2`.** Every count and every
line number below is read at that revision. A mismatch count is a property of
two files at a revision, not of the repository.

**Reporter:** `src/scripts/report_enforcement_drift.ts`. Read-only and offline:
it opens two files for reading, prints, and exits. `grep -nE
'writeFile|mkdir|appendFile'` over it matches nothing, and
`tests/scripts/report_enforcement_drift.test.ts` asserts the same property over
the source so it cannot be reintroduced silently.

## The comparison rule, stated before the count

The published cell is host-level and binary. The configuration is per slot. A
host-level cell therefore has to summarise a column of slot values, and there
are two defensible readings of what it summarises. **They do not return the
same number**, so the rule is named here and is a flag on the reporter rather
than a hidden constant.

| Rule | A published "deny honoured" is accurate when | A published "not honoured" is accurate when |
|---|---|---|
| `strict` (used for the headline) | **every** lowerable slot under that host carries a block exit | every one carries none |
| `lenient` | **at least one** lowerable slot carries a block exit | every one carries none |

**Strict was chosen, and the reason is the failure mode the table is read
into.** An unqualified host-level "the only host that refuses on a deny" is
reconstructed by a reader as "a guard bound on this host is honoured". A guard
bound to a non-blocking slot on that same host runs and is ignored. The lenient
rule cannot distinguish those two states — it scores a host with one blocking
slot out of nine exactly as it scores a host with nine out of nine — so
adopting it would make the drift invisible by construction rather than absent.

**Both counts are printed on every run**, so the dependency is visible rather
than asserted: `--rule lenient` re-derives the other reading from the same data.

**Two things are deliberately NOT counted as mismatches.** A published row for
a host the lowering configuration does not model has no second value to compare
against, so it is reported as not-compared — a missing row is silence, not a
contradiction. And the bound-slot-count column counts **declared** bindings from
`src/scripts/hook_manifest.yaml`, while the lowering file records what an
install can emit; those are two senses the published document itself keeps
apart, so a difference there is reported as advisory context with no effect on
the count.

## The finding

**1 mismatch, under the strict rule, on 2026-09-12.** Eight of the nine
published rows were comparable; seven of those eight agree with the slot values
under them. The single disagreement is the row carrying the enforcement claim.

```
- Claude Code (plugin) [claude]
    published claims honoured, configuration says 3 of 9 lowerable slots block
    blocking:     stop, user_prompt_submit, pre_tool_use
    NOT blocking: session_start, session_end, post_tool_use, pre_compact, subagent_start, subagent_stop
```

Under the lenient rule the count is **0**. The two rules disagree on exactly
this row, which is the empirical form of the argument above: whether the
published table is accurate today depends entirely on which reading of a binary
host cell one takes, and that choice had never been written down.

### The per-host readings in full

| Published row | Published deny cell | Derived from the configuration | Agrees (strict) |
|---|---|---|---|
| Claude Code (plugin) | `✅ the only host that refuses on a deny` | 3 of 9 lowerable slots block | **no** |
| Cowork | `❌ trampoline discards dispatcher output, exit 0` | no lowerable slots | yes |
| Augment | `❌ bound, verdict not honoured` | 0 of 5 lowerable slots block | yes |
| Cursor | `❌ no pre_tool_use binding` | 0 of 5 lowerable slots block | yes |
| Cline | `❌ no pre_tool_use binding` | 0 of 5 lowerable slots block | yes |
| Gemini | `❌ no pre_tool_use binding` | 0 of 5 lowerable slots block | yes |
| Windsurf | `❌ no tool-lifecycle surface at all` | 0 of 3 lowerable slots block | yes |
| Copilot | `— fallback_only, nothing bound` | no lowerable slots | yes |
| Codex | `— no platform key in hook_manifest.yaml` | no row in the lowering configuration | not compared |

### Advisory, not counted

Cowork publishes 8 lifecycle slots bound and has 0 lowerable slots. This is the
declared-versus-lowerable axis difference, and the published document already
records it in prose as an internal disagreement between two files in this
repository. It is printed by the reporter and excluded from the count, because
counting it would be comparing two different questions.

## The roadmap's own claim about the lowering file — confirmed

`agents/roadmaps/road-to-an-enforcement-table-nobody-hand-maintains.md` asserts
three things about `src/scripts/hooks/host_lowering.yaml`, verified here rather
than inherited:

| Claim | Verdict | Evidence at the pinned revision |
|---|---|---|
| exactly three non-null blocking values | **confirmed** | `grep -n 'block_exit' host_lowering.yaml \| grep -v null` returns three lines: 66, 67, 68 |
| all under one host | **confirmed** | all three sit inside the `claude:` block, which opens at line 45 and ends at line 72; the next host key, `augment:`, is line 74 |
| the slot carrying the content scanner is not among them | **confirmed** | the content scanner is the `injection-scan` concern (`src/scripts/hook_manifest.yaml:153`), bound only on `post_tool_use` (lines 1319, 1350, 1396, 1420, 1435, 1471); `claude`'s `post_tool_use` row is `host_lowering.yaml:69` and reads `block_exit: null` |

The three non-null values are `stop` (line 66), `user_prompt_submit` (line 67)
and `pre_tool_use` (line 68), each `block_exit: 2`.

**One thing the roadmap did not say, and that the run adds.** The blocking
values the resolver uses are gated on the row's verification currency: a host
whose `verified` block is absent or expired cannot carry a blocking binding
whatever its slot literals say. Claude's block carries `expires: 2027-09-06`
(line 62), so it is live today and the literal and effective values coincide.
Every other host in the file carries `verified: null`, and every one of their
slot literals is already `null`, so nothing is being disarmed by that gate
today. The reporter prints literal and effective side by side so that a future
expiry shows up as a visible difference rather than as a value that quietly
became `null`.

## What this measurement does not establish

- **Nothing about what a host is capable of.** Every value read here describes
  what this package has established and what an install emits. A `null` is
  "nobody established anything", never "the host cannot enforce" — the lowering
  file's own header says so and this artifact does not widen it.
- **Nothing about Codex.** The published row is sourced from
  `src/scripts/hook_manifest.yaml`, which the reporter does not read. It is
  reported as not-compared for that reason.
- **Nothing about whether the published prose is wrong.** The mismatch is in a
  table cell. The paragraphs around it, including the ones that already
  distinguish declared from lowerable, were not evaluated.
- **Nothing durable.** Both inputs are hand-edited files. Re-run the reporter
  rather than citing this count.

## How to re-derive

```
./scripts-run src/scripts/report_enforcement_drift
./scripts-run src/scripts/report_enforcement_drift --rule lenient
```
