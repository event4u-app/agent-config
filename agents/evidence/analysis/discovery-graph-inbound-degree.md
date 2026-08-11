# Zero-inbound traversal — the first run, classified

> Step 3.2 of `road-to-inbox-harvest-2026-08-b-estate-lifecycle`: *"Classify
> every first-run hit before anything is wired … then decide whether the report
> is worth publishing at all."*
>
> **Decision: not published as a list.** The traversal is correct; the edge set
> it traverses cannot answer the question yet. What follows is the measurement
> that settles it, and the defect it surfaced in two already-shipped commands.

Measured 2026-08-11 against `origin/main` @ `91bee9f7e`, over
`dist/discovery/discovery-manifest.json` built in the same worktree.

## The first run

```
$ npx tsx src/scripts/discovery_graph.ts build --manifest dist/discovery/discovery-manifest.json
discovery_graph.ts: graph — 759 nodes, 1624 edges
  supersedes: 20
  routes_to: 109
  references_adr: 0
  member_of_pack: 607
  member_of_workspace: 888
scanned: 759

$ npx tsx src/scripts/discovery_graph.ts orphans --manifest …
zero-inbound artefacts (595 of 759 nodes)
```

The 595 bucket by root:

| Root | Hits | Total in tree |
|---|---:|---:|
| `src/skills` | 289 | 289 |
| `src/domains` | 188 | — |
| `src/rules` | 116 | 116 |
| `src/subagents` | 1 | — |
| `src/agent-src` | 1 | — |

**Every skill and every rule is a hit.** A report whose hit rate is 100 % of two
whole artefact classes is not reporting on the estate; it is reporting on
itself.

## Why — the targets are names, the nodes are paths

`buildGraph` adds each artefact under its repo-relative path (`idOf` = `a.path`)
and adds each edge target verbatim from the structured field. Those fields carry
**logical names**:

```
routes_to targets: 109 | resolve to an artefact path: 0
  sample: analyze-postmortem, analyze-premortem, analyze-decision, …
replaces  targets:  10 | resolve to an artefact path: 0
  sample: quality-fix, e2e-heal, commit, commit:in-chunks, …
```

0 of 119. So every EXTRACTED edge terminates on a **phantom node** that exists
only as an edge target and never as an artefact, and no artefact ever receives
an inbound EXTRACTED edge. The 595 is arithmetic, not evidence.

`references_adr: 0` is the same defect seen from the other side: the pass tests
its targets against a `docs/decisions/ADR-*` path regex, and a target that is a
bare logical name can never match it. The pass has produced zero edges for as
long as the field has carried names.

## What this costs beyond the report

`affected` and `explain` are shipped subcommands that traverse this edge set.
With targets unresolved, `affected <rule>` cannot reach the skill that rule
routes to — the hop exists, but it lands on a phantom rather than on the skill's
own node, so the skill's own edges never continue the walk. The graph
under-reports reachability for all 109 `routes_to` and 10 `replaces` relations.

`build_discovery_manifest.ts` already carries a `resolve_logical` seam for
exactly this name→path direction, so the fix has a home. It is **not made
here**: changing how a shipped traversal resolves its targets is a behaviour
change to `affected`/`explain`, a different subject from this roadmap's
report-only phases, and it deserves its own diff and its own review.

## The disposition

1. `inboundZero` ships and is unit-tested — the traversal itself is right, and
   it is the piece that is genuinely additive.
2. The `orphans` subcommand **names the degraded state and prints no list**
   while `dangling_targets > 0`. The count comes from the graph's own `stats`,
   so the refusal is derived from the same run, not from this document.
3. The list becomes meaningful the moment targets resolve. Nothing here needs to
   be revisited to make that true — the guard clears itself.

Publishing the 595 would have been a report that looks like evidence, on a
question (`what does nothing point at?`) where a wrong answer invites deletion.
The roadmap's own risk register ranks that #2. This is that mitigation firing.
