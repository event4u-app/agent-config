<!-- evidence-type: analysis -->

# Owner directive — fixes carried to the merge, and worktrees removed after it

| Field | Value |
|---|---|
| Ordered by | the repository owner, in their own chat with an external assistant, handed over as inbox round `inbox-2026-10-v` |
| Date | 2026-10-21 |
| Scope | `road-to-security-fixes-carried-to-the-merge`; `road-to-worktrees-that-leave-after-the-merge` D1 |
| Source of the order | the owner's second turn of the round's transcript, quoted below; the execution order is the owner's `/roadmap:process-full` invocation of 2026-10-21 |
| Grants by itself | the two outcomes named below, nothing else |

## The instruction, verbatim

> Wichtig ist, den User nicht nur darauf hinzuweisen, sondern aktiv beim beheben/patchen zu unterstützen. Entweder in dem Branch/PR oder über einen Workingtree und extra PR/Release. So dass die Lücken schnellst- und bestmöglich behoben werden. <!-- md-language-check: ignore -->
>
> Und genau so wichtig (das gilt aber allgemein), am ende soll der workingtree aufgeräumt werden. Spätestens nach dem merge. Ich hatte aktuell 250 veraltete Trees. DAs sollte regelmäßig geprüft und aufgeräumt werden, wenn es geht automatisch. <!-- md-language-check: ignore -->

## What it answers

1. A security finding is carried to a fix, in the current branch/PR or in its own
   worktree with its own PR and release — not only reported.
2. A worktree is cleaned up at the latest after its merge, checked regularly,
   automatically **where possible**.

## What it does not grant

- It does not make deletion unconditional. "Where possible" is read with the
  safety conditions the same transcript states: active sessions, unsaved changes
  and unintegrated commits are protected.
- It does not set `worktrees.cleanup` for anyone. The council round of
  2026-10-21 (`agents/evidence/council/advisories-worktree-run-design-20261021.md`)
  held 2/2 that the default is `notify` and `auto` is the user's to switch on;
  the owner's directive is what makes `auto` exist, not what turns it on.
- It does not grant merge, tag, publish or deploy.
