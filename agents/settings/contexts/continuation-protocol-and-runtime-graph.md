# Continuation Protocol v1 and the runtime transition graph — recorded, not built

Two asks from the 9.30.0 release reviews that are answered by a record rather
than by a mechanism. Both are here, in a context rather than an ADR, because
neither changes an architectural interface: one confirms a shape that already
ships, and the other defers a build with a named trigger. An ADR number is for a
decision that binds a surface; these bind an expectation.

## 1. Continuation Protocol v1 — one schema with variants IS the answer

**The ask.** Reviews proposed a "Continuation Protocol v1" and asked whether the
continuation surface should be one schema or several. The source file attached
its own negative instruction: *never a fourth format*.

**It already exists, and the question is already answered in the shipped code.**
`src/scripts/_lib/subagent_capsule.ts` carries `CAPSULE_SCHEMA_VERSION = 3`
(`:112`) with an explicit `variant` discriminator (`:114`, validated at `:498`),
and **both** variants validate through that one module — one schema file, one
validator. The header states the rule the version bump follows: a version may
add fields or variants, **never repurpose or remove one**.

**So the decision is: one schema, variant-discriminated — no new format.** A
"v1" document describing a fourth shape would compete with a shipped, versioned,
single-validator schema, which is precisely the second-artefact-to-keep-in-sync
this tree refuses elsewhere. If the continuation surface needs to carry a new
consumer, it earns a `variant` and a version bump under the existing rule.

**What would reopen this:** a continuation consumer that cannot be expressed as
a variant — i.e. one whose required fields contradict an existing variant's
rather than extending them. That is a schema fact, checkable against
`subagent_capsule.ts`, not a matter of taste.

## 2. The runtime transition graph + loop detector — deferred, with a trigger

**The ask.** A canonical runtime transition graph plus a loop detector, on the
concern that block → repair → recycle could cycle.

**Deferred, because the loop that is feared is already bounded.** Two mechanisms,
both verified in the tree:

- The turn-end gate refuses **at most once per turn per key**, and its own
  comment states the cost of losing the marker: *"costs at most one extra
  refusal; failing closed here would cost the session"*
  (`src/scripts/hooks/turn_end_gate_hook.ts`, `markRefusedTurn`). A lost marker
  degrades to one extra refusal, never to a cycle. The bound got MORE load-bearing
  on 2026-08-12, when the gate's settings switch was removed and it became always
  armed: the one-refusal cap is now the only ceiling on a misfire, so it is cited
  by name rather than by a line range that a later edit silently invalidates.
- `session-eol` is `severity: advisory` and `fail_closed: false`
  (`src/scripts/hook_manifest.yaml:501-505`), and hooks cannot inject `/clear` —
  so the recycle action is advisory-carried by construction. A hook that cannot
  force the transition cannot drive a loop through it.

Building a transition graph and a detector against a loop no mechanism can
currently produce would be a mechanism without a matched failure mode — the same
test that cut the per-task-class spend caps.

**Revisit trigger, and it is falsifiable:** a transcript showing a real
`block → repair → recycle → same-block` cycle. One such transcript is the whole
condition; absence of complaints is not evidence, so this trigger is watched by
whoever hits it, not by a background sweep.

## See also

- `src/scripts/_lib/subagent_capsule.ts` — the shipped schema, its version rule,
  and the variant validator.
- `src/scripts/hooks/turn_end_gate_hook.ts`, `src/scripts/hook_manifest.yaml` —
  the two bounds under item 2.
