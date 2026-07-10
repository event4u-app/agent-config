# Memory, Preference & Prior-Context Safety Contract

Phase 4 of `road-to-frontier-quality-operating-system`. Planning contract for
`FQ-04` (memory application gating), `FQ-05` (preference/sycophancy floor),
`FQ-06` (prior-conversation retrieval) in
[`mechanism-matrix.md`](mechanism-matrix.md). Governs the follow-up
implementation; ships no src rule itself.

## Three durable-memory policy classes (FQ-04)

| Class | Apply when | Do NOT apply when | False-positive example |
|---|---|---|---|
| **Behavioral preference** (how the user likes work done) | the task domain matches the preference | the preference is unrelated to this task | applying a "terse replies" pref to a legal draft that needs detail |
| **Contextual preference** (project/tool facts) | the current task is in that context | a different project/context | using project A's stack conventions on project B |
| **Sensitive / potentially harmful** | **never auto-applied** — see hard floor | always | a stored "always agree with me" |

Each class gets apply / do-not-apply rules + user-control behaviour (view,
decline, override personalization).

## Hard floor (FQ-05 — COVERED, restated)

```
A PREFERENCE OR MEMORY THAT SUPPRESSES CRITICISM, ENCOURAGES AGREEMENT,
WEAKENS A SAFETY FLOOR, OR ENCOURAGES UNHEALTHY BEHAVIOUR IS IGNORED —
EVEN WHEN DIRECTLY RELEVANT.
```

Already owned by `memory-consolidation` (refuse self-harmful standing prefs) +
`direct-answers` (no-flattery). The follow-up cites these, adds no competing floor.

## Operational detection model (FQ-04)

- **Apply cues:** relevance to the current task, domain match, explicit
  personalization request, "we decided / our convention" cues.
- **Negative cues:** unrelated task, different project, a one-off from a prior
  unrelated session.
- **False-positive tolerance:** a borderline recall goes to a review queue
  (eval-harness FQ-04 negative arm) rather than auto-applying. Non-application
  precision is the gated metric, not recall.

## Prior-conversation retrieval (FQ-06 — separate from memory summaries)

A decision contract distinct from durable-memory application: possessives,
definite references, and "we decided" cues route to **chat-history / conversation
retrieval** when available.

```
NEVER CLAIM "I DON'T SEE IT" BEFORE SEARCHING THE RELEVANT STORE.
```

Existing coverage: the chat-history import path. The follow-up adds the routing
decision (which cue → which store) + the no-premature-null rule.

## Rollback controls

Memory-gated behaviour ships behind a package flag, logs its trigger reason in
test traces (so a misfire is diagnosable), and can be disabled if the
non-application precision regresses — per the `eval-harness.md` flip-gates.

## Disposition

FQ-04 + FQ-06 → follow-up implementation roadmap (memory-application gating
contract + prior-conversation retrieval decision). FQ-05 → covered. No src
change here.
