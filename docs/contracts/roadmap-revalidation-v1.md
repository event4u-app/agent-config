# Roadmap revalidation — v1

A roadmap is written against one tree and executed against another. This
contract fixes how the gap is measured, when it is measured, and who acts on
what the measurement finds. Owner: `road-to-a-plan-that-stays-true`.

## The pin

Every roadmap carries `tree_pin: <short-sha>` in its frontmatter — the commit it
was last verified against. `new_roadmap` writes it at authoring. The reader
(`readPin` in `src/scripts/_lib/roadmap_revalidation.ts`) also accepts, in this
order, the two older forms: `drafted-against: <sha>` and a context line
`read at \`main@<sha>\``. A roadmap with none of the three is `unpinned`. No mass
migration: an older roadmap gains `tree_pin:` the first time it is revalidated
with `--advance`.

## The one primitive

```bash
agent-config roadmap:context --revalidate <slug|path> [--json] [--advance]
```

No other verb. It reads the pin, every cited path in the roadmap
(`` `path` ``, `` `path:N` ``, `` `path:N-M` ``), and the `## Decisions` table.

**Cheap path first.** Pin equal to HEAD, or none of the cited files changed since
the pin, is `fresh` without reading a single line range.

### Vocabulary — nothing beyond these

| Level | Values |
|---|---|
| per cited path | `unchanged` · `drifted` (the file changed since the pin) · `missing` (the file is gone) · `beyond-end` (a cited line is past the end of the file) |
| per roadmap | `fresh` · `drifted` · `broken` (at least one `missing` or `beyond-end`) · `unpinned` |
| per re-verified statement | the intake labels `still-true` · `already-fixed` · `never-true` · `unverifiable` |
| per decision question | `holds` · `holds-changed` · `falls` |

## What a verdict means

```
DRIFT IS A PROMPT TO RE-VERIFY, NEVER A VERDICT OF FALSITY.
REVALIDATION NEVER BLOCKS. THE VERDICT IS CONTEXT FOR THE AGENT.
THE SCRIPT REPORTS. THE AGENT VERIFIES AND CORRECTS. NO SCRIPT REWRITES A ROADMAP.
```

On `drifted` the agent re-reads each drifted citation, labels the statement that
rests on it, and corrects it in place — a moved line number is fixed, a changed
fact is rewritten with `corrected-from-reproduction`. A step whose premise is now
`already-fixed` or `never-true` does not run: it is rewritten or deferred with a
reason. `--advance` then moves `tree_pin` to HEAD and writes a
`revalidated: <sha> <date>` line. `--advance` refuses on `broken`: a missing file
must be resolved, not advanced past.

The `revalidated:` line is the record. No evidence file is written per run.

## `revisit if` cells

A `## Decisions` row's `revisit if` cell is evaluated only in two closed forms,
`test -f <path>` and `test -e <path>`. Any other command is `unverifiable` and is
**never executed** — a roadmap's text is untrusted input to a script. A prose
cell is `unverifiable` once a path cited in its row has drifted.

## When it runs — bound to carriers that already run

| Moment | Carrier |
|---|---|
| emit | `analysis_validate` refuses an emitted roadmap without a readable pin |
| execution start | each `roadmap_drain_queue` entry carries `freshness`; the process-full lane brief revalidates on `drifted`/`broken` before the first mutation |
| phase boundary / resume | the context refresh in `roadmap-process-loop-set.md` runs `--revalidate` when the fingerprint differs |
| closure | the close procedure runs `--revalidate` before archiving |

## The council — only where a decision moved

A `## Decisions` row whose evidence or `revisit if` cell cites a drifted or
missing path yields one council question: the row, its evidence, the diff of its
drifted paths since the pin, and the answer set `holds | holds-changed | falls`.
A drifted path cited only by a step yields no question; numbers moving never do.
The question uses the existing prompt mode.

```
A DEGRADED COUNCIL — ONE SEAT, OR SEATS THAT SPLIT — IS NEVER CONSENT.
```

A degraded answer on a technical row is recorded `provisional`; on an
owner-reserved row it becomes an `agents/owner-questions.md` entry carrying the
partial vote. A clear answer is recorded as a `## Decisions` row with
`resolved by: council:<date>`, dissent kept separately.

## Planned skills

A step may carry an indented `uses: <skill>[, <skill>]` line and a
`waived: <skill> — <reason>` line, with the reason from the closed set
`not-applicable-scope | superseded-by:<skill> | unavailable-on-host |
already-satisfied`. `skill_plan_usage` reads them against session transcripts:
`applied` only from a `Skill` tool call or a read of that skill's `SKILL.md`,
never from prose. Rules are `not-observable` in this read-out.
