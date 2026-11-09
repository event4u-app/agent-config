# Freeze an experiment protocol before it runs

You are designing, not running, a two-arm experiment. Everything you need is in
this directory. Write your answer as one file, `PROTOCOL.md`, in this directory
(or, if you cannot write files, print its full content as your reply).

## The claim under test (registered before any code existed)

> A site-type-conditional web-launch audit finds more real launch defects than a
> bare "audit this site before launch" prompt on the same model, without
> flagging a site-type-irrelevant decoy.

Falsification, as registered: (1) the decoy is flagged; (2) recall does not
exceed the comparator arm's; (3) the fixtures cannot be scored against a ground
truth both arms share, in which case the verdict is UNDERPOWERED. A flagged
decoy drops the claim regardless of recall. Scope: three fixtures on one model
is one measurement; it generalises to neither another model nor another defect
set.

## What is in this directory

- `fixtures/` — three static sites: `local-business/`, `saas-app/`, `docs/`.
  A hidden manifest lists the real launch defects seeded in them and one decoy.
  You will never see it, and neither arm will. The manifest is what the arms'
  findings are scored against, after both have run.
- `treatment/` — the audit as it ships: `check_web_launch_readiness.ts`, a
  deterministic command with nine site-type-conditional checks, and its config
  `web-launch-readiness.json`. It was originally planned as a model-loaded skill
  and shipped as a command instead, so you must decide what the treatment arm
  is (for example: the same model given the command's output and asked to
  report launch defects; or the command's findings alone; or something else
  you argue for). State the choice and why it is a fair test of the claim.

## What you must freeze — all seven, concretely

1. The exact bare-prompt text for the comparator arm (verbatim), and the exact
   treatment-arm input (verbatim prompt, or the exact command invocation).
2. Context packaging and ordering: which fixture files each arm receives, in
   what form and order, one call per site or one for all.
3. The model snapshot and sampling settings. Available: `claude-sonnet-5-5`,
   `claude-opus-5-5`, `claude-haiku-5-5` through the Anthropic Messages API
   (some newer models reject an explicit `temperature`; say what to do then).
4. Retry policy and number of runs per arm, and how runs are aggregated.
5. Whether a finding must name the correct page (file) as well as the defect.
6. Semantic-match and partial-credit rules: when a reported finding counts as
   matching a manifest row, how duplicates and over-broad findings count, how
   precision and recall are computed, and what counts as flagging the decoy.
7. Who scores ambiguous outputs, given the scorer will see the manifest: name
   the procedure (for example two blind matchers of different providers with
   disagreement resolution) so the person running this cannot steer it.

Also state, in one short section, the verdict rule that maps the scored numbers
to PROVE / DROP / UNDERPOWERED, consistent with the registered falsification.

Write nothing about what defects you expect the fixtures to contain. Do not try
to find or infer the manifest. Choices should be ones you would make for any
pair of audits, not ones fitted to these sites.
