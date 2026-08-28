<!-- evidence-type: analysis -->

# The 2026-08-28 execution directive for the runtime and code-intelligence workstream, and the three conflicts it does not resolve

Recorded 2026-08-28 by the `/analyze:inbox` verification pass at
`905087463`. It exists for the same reason its sibling
`runtime-reversal-owner-decision.md` exists: the directive was stated in a
**gitignored, disposable** inbox archive, and a roadmap or an estate exemption
resting on that is resting on evidence a reviewer cannot reach. The record is
here so the citation is reachable in a clone.

## The directive, verbatim

Two paragraphs, separated by a blank line in the source. The German is the
original; the English is a working translation. The paragraph break is
reproduced because the consolidating proposal joined the two with `" - "` and
normalised the lowercase opening — substance intact, but a verbatim record is
verbatim or it is a paraphrase.

DE: "der beste satz und ich würde das auch weiter hervor heben \"AC muss aufhören, Runtime und Code Intelligence als Dinge zu behandeln, die Governance irgendwann erlauben könnte. Sie müssen Infrastruktur werden, deren Vertrauenswürdigkeit Governance sicherstellt. \". Das ist genau was ich will."

DE: "Ich will, dass auch der AC Agent das nicht mehr ablehnt, sondern endlich umsetzt."

EN: "The best sentence, and I would highlight this further: \"AC must stop treating runtime and code intelligence as things governance might one day permit. They must become infrastructure whose trustworthiness governance ensures.\" That is exactly what I want."

EN: "I want the AC agent to stop rejecting this too, and finally implement it."

## What it authorises

Read literally, the directive does two things: it elevates the quoted sentence
to a governing principle for this workstream, and it demands that the agent
stop refusing to execute it. It inverts the load direction of governance in
this workstream — **a contract, gate or review here justifies how safely, never
whether.**

It is the **second** owner statement in the same direction. The first, of
2026-08-27, is recorded verbatim in `runtime-reversal-owner-decision.md` and
repealed the no-runtime doctrine. A direction stated twice is not a fresh
opinion; under `recurring-criticism` the repetition reverses the burden of
proof, and whoever would keep the workstream blocked now carries the argument.

## What it does not authorise

The sentence names **no mechanism**. It names no ADR, no gate, no ratchet and
no setting, and it asks for nothing to be removed. Three consequences, stated
here because a proposal in the same inbox round read them the other way:

1. **It is not an instruction to remove governance surfaces.** One inbox
   proposal — the one this pass declined, see below — states that the first
   implementation milestone is "removing the remaining authority paths" and
   extends that to "standing kernel wording" and to "any gate whose current
   semantics can still convert implementation work back into feasibility
   review". The last clause names no gate, so every gate qualifies. The owner
   asked for implementation; de-fencing is a different request, and under
   `security-sensitive-stop` § Adversarial principal a request to weaken the
   suite's floors, kernel rules or gates is a security-sensitive edit that
   routes through the edit-permission gates rather than being applied because
   it appeared in a chat log.
2. **It does not waive the trustworthiness floors.** Supervised learning stays
   supervised, ADR-094 stays closed, spawn hardening and the lethal-trifecta
   floor stay untouched, one resident-process class at a time, and no CI gate
   is bypassed — gates are satisfied, or their funding is escalated with
   numbers.
3. **It does not settle the two ADRs the inbox round never opened.** See the
   next section.

## Three conflicts the inbox round did not resolve

Each is recorded with what it blocks, because a conflict named nowhere is a
conflict a later session re-derives from scratch.

### 1 — A non-relitigation clause cannot be written into a review prompt

The consolidating proposal asks that council and review instructions for this
workstream state that verdicts evaluate implementation quality, safety and
evidence "not direction", and that "not at all" is not an available verdict
below the owner.

`evaluator-independence` § The softer form forbids exactly that shape: the
orchestrator states no expectation of the outcome — not the verdict, and not
the direction — in a prompt it writes for a judge of its own work. The concern
that enforces it is `pre_tool_use` and **blocking** on the one host that
denies, so a council prompt carrying the clause may be refused at tool-call
time.

The owner can settle the direction; the resolution that survives the guard is
the one this record uses: **the owner's decision is recorded in an evidence
artefact, and reviewers receive a neutral prompt.** A reviewer who then argues
direction is arguing against a recorded decision, which is visible and
answerable — rather than against a prompt that pre-loaded the answer, which is
neither.

### 2 — ADR-246 makes the code-graph default a decided question, not an open one

`docs/decisions/ADR-246-code-graph-parsers-stay-devdependencies.md` was
accepted 2026-08-26, is unsuperseded, and decides that the parser pair stays in
`devDependencies` and the native engine is a maintainer-only surface. Its
explicitly rejected alternative is promoting the pair back to `dependencies`.

**No file in the inbox round names ADR-246.** A step that flips
`hooks.code_graph.enabled` to `true` as a consumer default therefore proposes
the alternative a live ADR rejected, and is additionally insufficient on its
own: without the ABI-locked pair a consumer flip enables a path that cannot
load. The reopen condition is recorded in the settings template itself —
external evidence, or a re-measurement on a build postdating the extractor
repair of 2026-08-22, which the 2026-07-28 recall figures predate. That
re-measurement is work; the flip is its outcome.

### 3 — ADR-124 § 5 prices the first resident process, and nothing budgets it

`ADR-124-embedded-engine-doctrine.md:110-111` keeps Class B — resident service
or daemon — prohibited in core, and its § 5 extension clause states what
opening it costs: an ADR carrying **a named consumer demand signal, a measured
Class-A failure, and an ADR-123 security review**. The measured Class-A failure
is the expensive one, and no wave in any inbox proposal budgets for producing
it.

## Disposition of the inbox round

| Item | Disposition |
|---|---|
| The directive above | Recorded here, verbatim, reachable in a clone |
| The consolidating proposal's runtime spine (journal, episode fields, consumption acknowledgment, persistence-tier contract) | Adopted into `road-to-runtime-event-journal` — all pre-flip, all Class-A |
| Its code-intelligence wave | Adopted into `road-to-code-intelligence-reopen`, re-shaped around ADR-246's recorded reopen condition rather than around a bare setting flip |
| Its authority-removal milestone (the undeclared fourth proposal) | **Declined**, per § What it does not authorise ¶1. Recorded here rather than dropped silently: the proposal ships `status: ready` in the inbox, so silence would leave a leading document with no verdict against it |
| Its kernel clause | **Not a roadmap step.** Kernel-rule writes are denied to agents, and `scope-control` § Kernel-rule edits requires an own PR with a ≥ 24 h soak that no autonomous mandate lifts. A maintainer action, named as one |
| Its criticality fallback ladder (present in one proposal, absent from the consolidation) | Adopted into `road-to-runtime-context-floors` — it is the safety half of migrating obligations out of standing context |
| Multi-provider consensus voting; a self-promoting learning loop | Declined. Both collide with floors the same proposals elsewhere preserve; recorded so the decline is not mistaken for an oversight |

## Provenance

The source transcript and the four sibling proposals are in
`agents/tmp.old/runtime-code-intelligence/` — gitignored, disposable, and cited
here only as the origin, never as the authority. The authority is this file.
