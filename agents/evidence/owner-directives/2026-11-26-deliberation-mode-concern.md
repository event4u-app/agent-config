<!-- evidence-type: analysis -->

# Owner directive — the `deliberation-mode` concern, and the estate growth it costs

| Field | Value |
|---|---|
| Ordered by | the repository owner (Matze), in chat, relayed by the coordinating session |
| Date | 2026-11-26 |
| Scope | the `deliberation-mode` hook concern (concern count 76 → 77) added by `road-to-deliberation-offers-and-run-names` |
| Grants by itself | that this one concern may grow the `concern_count` estate axis. It lowers no test, CI gate or Hard-Floor obligation, grants no preamble-payload exception, and does not ratify the hook-manifest edit — that still needs its own ratification record |

**Context.** The feature lets the owner choose, globally or per chat, whether the
agent offers `/council`, `/arena` or `/panel` on a real decision (`offer`), runs
the fitting one (`auto`), or neither (`off`). Agent Switch sets the per-chat
value through `agent-config deliberation:set --session <id>`. The per-session
value is a fact no rule text can know, so it reaches the agent only through a
per-prompt hook concern. Options were put to the owner; he chose option 2 —
keep the concern as built, make the rule trigger-loaded, authorise the estate
growth. Owner, verbatim:

> 2, mach so <!-- md-language-check: ignore -->

Translated: "2, do it that way."

The reason he authorised, as relayed: owner-authorised 2026-11-26 (Matze): the
deliberation-mode concern delivers the per-session council/arena/panel mode on
every prompt; without it Agent Switch's per-chat toggle cannot reach the agent.

## Second ruling, same day — what `auto` means

Council round 1 on the hook-manifest change refused `auto` (2/2) as an
unmeasured widening of what the agent may do on its own. The owner ruled on the
meaning of the mode, verbatim:

> Nein, ich WILL, dass wenn ich aktiv auf Auto stelle (das ist wie das normale Auto bei Claude, Codex und co), dass der Agent Dinge automatisch macht. Und wenn ich sage, er soll seine Fragen (wie soll er was machen) automatisch beantworten, dann soll er das tun !!! PUNKT. - Was er nicht soll, ist automatisch mergen oder deployen. Aber Fragen wie etwas umgesetzt werden soll, darf er in diesem Fall automatisch entscheiden. <!-- md-language-check: ignore -->

Translated: "No — I WANT the agent to do things automatically when I actively
switch to auto (that is like the normal auto in Claude, Codex and the like). And
when I say it should answer its questions (how it should do something)
automatically, then it should do that!!! Full stop. — What it must not do is
merge or deploy automatically. But questions about how something should be
implemented it may decide automatically in that case."

Taken as: `auto` is opt-in only, never a default (`offer` stayed the default at that point; the third ruling below makes it `off`);
in `auto` the agent runs the fitting council, arena or panel and answers its own
implementation questions, naming each decision; every action on the
`non-destructive-by-default` Hard Floor — merge, deploy, push, release or tag,
production data or infra, bulk deletion, irreversible external actions — still
asks, as do owner-reserved transitions.

## Third ruling, same day — off by default

After round 2 split, the owner chose to land the change himself and ruled on
the default, verbatim:

> 2 - und ich möchte, dass die regel per default off ist. Nur wenn der nutzer es verlangt wird es für die session aktiviert oder eben global. <!-- md-language-check: ignore -->

Translated: "2 — and I want the rule to be off by default. Only when the user
asks is it switched on for the session, or globally."

Taken as: `deliberation.mode` ships `off`; the agent switches it on only when the
user asks, for the session unless the user says globally.

## What it authorises

1. **`concern_count` 76 → 77** for `deliberation-mode`, claimed through
   `estate_growth_exempt` on `road-to-deliberation-offers-and-run-names`.
2. **`auto` with the meaning above**, bounded by the Hard Floor, and `off` as
   the default.
3. **Nothing else.** The preamble-payload ratchet and the ratification of the
   `hook_manifest` edit are decided on their own paths.
