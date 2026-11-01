<!-- evidence-type: analysis -->

# Owner directive — the project map keeps itself current without an explicit opt-in

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat |
| Date | 2026-11-01 |
| Scope | the `code-graph-refresh` concern and the auto-refresh opt-in (`feat/map-always-fresh`) |
| Grants by itself | that a local `code-graph build` or `map` outside CI may turn auto-refresh on for that working tree, and that the concern may also run on `stop`, throttled; nothing else — no push, no commit on the developer's behalf |

The owner's words, verbatim, after seeing a project map 20 commits behind:

> "warum ist die map so veraltet? Ich will, dass alles was wir wissen sich immer wieder automatisch aktualisiert, wenn wir an einem projekt arbeiten. AC soll permanent lernen udn sich und die arbeit an projekten verbessern." <!-- md-language-check: ignore -->

("Why is the map so out of date? I want everything we know to update itself
automatically, again and again, while we work on a project. AC should learn
permanently and improve itself and the work on projects.")

And, on the follow-up design:

> "ich nicht will, dass die map immer komplett gebaut werden muss. incrementelle updates gehen schneller als komplette." <!-- md-language-check: ignore -->

("I don't want the map to have to be rebuilt completely every time;
incremental updates are faster than complete ones.")

What this record does NOT establish: it is written by the agent that
implements the change, so it is the owner's words as relayed, not a platform
event. The ratification round that reviews the change decides whether it
suffices as the policy acknowledgment for consent-by-use.
