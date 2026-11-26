---
complexity: lightweight
review_by: 2027-02-28
estate_growth_exempt: "+1 concern_count for session-title (2026-11-26, ADR-305): at prompt milestones it asks the agent whether the session title can be named more precisely and how to publish it, silent once the user renamed the session or `sessions.auto_title` is false. Owner-ordered, recorded in agents/evidence/owner-directives/2026-11-26-session-titles-that-sharpen.md. The two follow-ups below stay a stub."
---

# Stub: session titles beyond Claude Code, and whether the nudge is followed

> **Stub — not active work.** Created 2026-11-26 with ADR-305.

ADR-305 ships refined session titles for Claude Code only: the `session-title`
concern is bound on claude `user_prompt_submit`, and the readers that prefer the
sidecar (`sessions:catalog`, Agent Switch) resolve Claude transcripts. Two things
stay open.

**Other hosts.** Codex sessions appear in `sessions:catalog` with whatever title
the rollout carries, and nothing refines it.

**Trigger.** The owner asks for refined titles on a second host, or Agent Switch
starts listing a host whose sessions carry no usable title.

**Then.** Bind the concern on that host's prompt slot, key the sidecar off that
host's session file, and teach its reader the same precedence.

**Compliance.** Nothing measures whether the agent acts on the nudge; a session
whose agent ignores it keeps the host title. The sidecar's `revision` against the
state file's `last_nudge_prompt` is one measurement; a `custom-title` line
appended after a refined title (the user correcting it) is the other. Neither is
taken yet. ADR-305's rollback criterion reads both: under half of the nudged
sessions with a sidecar, or a correction in more than one session in five.

**Measurement plan.** Window: the first 30 days after the release that ships
ADR-305, on the owner's machine. Population: Claude sessions with at least one
nudge (state file `last_nudge_prompt` > 0), floor 40 sessions; under 40 the
window extends by 30 days, at most twice, so the rates are read no later than 90
days after release, on whatever sample exists then. Uptake: share
of those sessions with a sidecar. Correction: share of sessions with a sidecar
whose transcript carries a `custom-title` line timestamped after the sidecar's
first `updated_at`. Both are counts over files already on disk, so the read is a
one-off script, not a new store.

**Trigger.** A month of real sessions after release, or a report that titles do
not move.

**Then.** Count sessions with a nudge and no sidecar, per host model; if the rate
is high, tighten the nudge wording before considering a different carrier.
