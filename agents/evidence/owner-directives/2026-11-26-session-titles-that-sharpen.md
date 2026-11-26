<!-- evidence-type: analysis -->

# Owner directive — session titles that sharpen as the session learns

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat |
| Date | 2026-11-26 |
| Scope | a `session-title` concern, the `session:title` CLI, and the global setting `sessions.auto_title` (default `true`) |
| Grants by itself | the feature and its default. It lowers no test, CI gate or Hard-Floor obligation |

**Context.** Agent Switch lists sessions by their host title. Claude Code writes
its `ai-title` once and then repeats the same value: across the eight most recent
transcripts of this checkout, each carried exactly one distinct `ai-title` value,
repeated between 6 and 452 times. A session named from its first prompt keeps that
name however far the work moves.

Owner, verbatim:

> Könenn wir dafür sorgen, dass der Name einer Session sich immer weiter verbessert und klarer wird, je mehr Informationen wir haben? Und nur wenn der Nutzer selbst die Session umbenennt, dann ändern wir ihn nicht mehr. Aber so hätten wir in Agent Switch eine Bessere Darstellung der Sessions. Das ganze könenn wir ja so gestalten, dass man es über eine Anweisung ein und ausschalten kann. Per default ist es aber an. Und es ist eine globale einstellung. <!-- md-language-check: ignore -->

Asked who should phrase the better title — the agent itself on a milestone nudge,
a separate small-model call, or a deterministic rule from branch and PR — the
owner chose **the agent itself**.
