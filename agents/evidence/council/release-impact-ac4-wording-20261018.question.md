<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-18, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence). Not edited after the run. -->

# Does acceptance criterion AC-4 of `road-to-a-release-that-says-whether-it-needs-you` hold, and in what wording?

Repository: `event4u/agent-config`, an npm package. The roadmap builds a pure
function `classifyUpdate(input) → {action, reasons}` with `action ∈ {auto, ask,
notify, none, action}`. Nothing installs on the verdict in this roadmap.

## Authority

The repository owner delegated open decisions to this council on 2026-10-16
("ask the council things like this, not me") and 2026-10-18 ("try to resolve the
open decisions in the AI council").

## The criterion as written

> **AC-4** Over a ≥ 40-case matrix, `classifyUpdate` returns `ask` for every
> input whose `engines.node` is unsatisfied, and `auto` for **no** input carrying
> an unknown, a missing provenance or a project pin.

## The same roadmap's step 4.2 (already landed)

> CI, non-interactive, a source checkout, or `AGENT_CONFIG_NO_UPDATE_CHECK=1` →
> `none`, mirroring the four suppressions already in the update check. [...]
> Uncertainty of any kind → never `auto`.

## What landed, and what a prior council changed

- A 57-case matrix (`tests/lib/classify_update.test.ts`). It asserts: no `auto`
  verdict for any input carrying an uncertainty (unknown, missing provenance,
  project pin among them); and `action` for every input with an unsatisfied
  `engines.node` unless the check is suppressed or there is no newer candidate.
- The merge-danger council on the PR that landed it (#2421) changed the engines
  verdict from `ask` to a fifth value, `action`, on the reasoning that `ask` means
  "install on approval", and a candidate this machine cannot run must not be
  installable that way. The roadmap records that amendment under step 4.2.
- So the code returns `action`, not `ask`, for unmet engines; and for a CI or
  opted-out input it returns `none` even when engines are unmet, because 4.2
  requires the suppressions. Read literally, AC-4's first half contradicts both
  4.2 and the earlier council amendment; its second half holds as written.

## The question

Pick one:

- **(1)** Amend AC-4's text to the form the code and tests assert — "returns
  `action` (never `ask`, never `auto`) for every non-suppressed input with a
  newer candidate whose `engines.node` is unsatisfied, and `auto` for no input
  carrying an unknown, a missing provenance or a project pin" — and close it as
  met, recording this decision beside it.
- **(2)** Keep AC-4 as written and open; change the code or the tests instead
  (say how).
- **(3)** Leave AC-4 open for the repository owner.
- **(other)**.

Answer with the option, the reason, and any condition you attach.
