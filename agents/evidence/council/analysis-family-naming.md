<!-- evidence-type: analysis -->

# The foreign-source door is `analyze:reference`

AI council, 2026-10-18. anthropic + openai, 2/2 present before and after the
run, blind peer review, `$0.00` (both seats subscription-authed). The prompt is
committed verbatim beside this file as `analysis-family-naming.question.md`.
Raw response: `agents/runtime/council/responses/analysis-family-naming.json`
(local, gitignored). For `road-to-an-analysis-family-that-deepens-itself`,
step 1.1.

## Verdict — converged, on a fourth option

Both seats, independently and again in peer review, chose a name outside the
three offered:

- **`analyze:reference` is the door.** It names the input's *role* — reference
  material the current project is improved against — covers every input kind
  (repository, local path, archive, URL, article), and continues the existing
  alias `analyze:reference-repo`. openai: *"the current project is the subject
  being improved; the foreign item is reference material."*
- **Among the offered options both would take (a) `analyze:source`**, and both
  name the same counter-argument against it: in developer tooling "source"
  reads as source code, and it does not say the material is foreign.
- **(b) `analyze:harvest` is rejected.** anthropic calls the collision with the
  existing harvester (`analyze:roadmap-repos`, which feeds this command)
  structural; openai softens it to "the strongest reason not to choose it",
  not a disqualification. Both agree the downstream stage must not carry the
  collection stage's name.
- **(c) keep `analyze:repo` is rejected by both**: a door that accepts
  archives and articles under `repo` misstates its signature.

## Decision recorded

`analyze:reference`, with `analyze:repo`, `analyze-repo`,
`analyze:reference-repo` and `analyze-reference-repo` kept as `replaces:`
aliases. Reversible-internal: the aliases keep every old invocation working,
and a later rename is one frontmatter edit. `analyze:roadmap-repos` keeps its
name and is documented as the discovery stage in front of this door.

## Dissent and residue

- The peer review asked whether one polymorphic door over five input kinds is
  sound, rather than only how to name it. Not answered here: the adapters of
  steps 4.2 and 4.2b already split the input kinds below one `SourceRef`, so
  the door stays one surface over typed adapters.
- One peer reviewer conditioned the choice on the door's visibility in a
  first-run path. The door is `visibility: internal` (fact 4 of the prompt),
  so discoverability by a novice is not the deciding axis; continuity with the
  alias is.
