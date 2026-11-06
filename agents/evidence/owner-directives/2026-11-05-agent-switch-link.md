<!-- evidence-type: analysis -->

# Owner directive 2026-11-05 — a link with agent-switch, no automatic switch

Recorded from the owner's answers in the session that produced this roadmap.

First ask (translated): when a session nears its plan limit, AC should let work
continue on another profile or provider, so that nobody using AC and
agent-switch runs into the limit; plan it in a roadmap and merge it.

An AI council (2026-11-05, anthropic/claude-sonnet-4-5 + openai/codex-default,
both seats answered, $0 subscription) was asked whether the unattended-spawn
refusal of `road-to-long-horizon-execution` 4.0 permits an automatic,
combined-only continuation. Both members: not in that form; approve an advisory
limits read; defer cross-provider and free-model automation.

Owner's answer (verbatim, German):

> Ok, der automatische wechsel ist nicht so gut. Also sollen AC & AS den User
> informieren und den wechsel anfordern. Sobald es in einem von beiden erlaubt
> und bestimmt wurde, ist es für beide ok. Sie müssen sich also austauschen.
> Dieser austausch kann über die commands, etc. passieren, aber AS soll auch
> einen MCP erhalten, mit dem man sich verbinden kann. […] AC sollte sich leicht
> und ohne komplikationen immer mit AS automatisch verbinden können. […] Und
> diese automatische Verbindung sollte man in den Settings von AS deaktivieren
> können (zur sicherheit. default ist aber on).

And earlier: AC should always be able to query limits from agent-switch and use
them in council, court, arena "um auslastungen und anfragen besser zu verteilen".

What this authorises, and nothing more:

- One new roadmap, `road-to-a-link-with-agent-switch`, parked in `later/` until
  the WIP cap allows it or the owner promotes it citing this record.
- AC reads agent-switch limits and raises / relays switch requests; the user
  decides; agent-switch alone executes. AC never moves, rebinds or starts a
  session, and the unattended-spawn refusal stays untouched.
- No hard dependency: every path degrades to today's behaviour when
  agent-switch, its MCP server, or its link setting is absent or off.
