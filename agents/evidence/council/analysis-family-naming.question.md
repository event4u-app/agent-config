<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# What should the command that analyses a foreign source be called?

You are deciding one naming question for a repository that ships rules, skills
and slash commands for AI coding agents. Answer on the evidence below. Name the
option you choose, the strongest argument against it, and anything the options
miss. Do not summarise the evidence back.

## Background

A family of four commands is being built under one `analyze` cluster. One of
them takes something foreign — another repository, a local path, an archive, a
URL or an article — analyses it against the project the command runs in, and
lands roadmaps that improve that project. Today a narrower version of it exists
as `analyze:repo` (alias `analyze:reference-repo`), which only accepts a
repository and only improves this package. The owner asked for a better name
than `analyze:repo`, "welcome but not required". The other three doors are
`analyze:inbox`, `analyze:and-optimize` and `analyze:pr`.

Facts from the tree:

1. `analyze:roadmap-repos` already exists. Its own text calls it "the thin
   harvester in front of `analyze-repo`": it walks roadmaps for reference
   repository URLs, writes `agents/.harvest-local/manifest.jsonl`, and
   dispatches each into the command being named here. A script is called
   `harvest_reference_tokens`; a ledger `provenance/harvests.jsonl` records
   ideas taken from outside sources.
2. No command, script or document uses `analyze:source` today.
3. The old names `analyze:repo` and `analyze:reference-repo` stay resolvable as
   `replaces:` aliases whatever is chosen. The rename is reversible.
4. Sub-commands of this cluster are `visibility: internal`, so the name is not
   gated by the controlled command-verb list.
5. The inputs will include local paths and archives, not only repositories.

## Options

- **(a) `analyze:source`** — names the input kind generically.
- **(b) `analyze:harvest`** — matches the tree's harvest vocabulary
  (`harvest_reference_tokens`, `provenance/harvests.jsonl`).
- **(c) keep `analyze:repo`** — no rename; the inputs widen under the old name.

## What to answer

1. Which option, and why.
2. The strongest argument against your choice.
3. Whether fact 1 (the existing harvester feeding this command) is a collision
   that disqualifies (b), or a naming relationship that supports it.
4. Anything the options miss.
