---
session_number: NN
role: galabau-owner | content-creator | consultant | other
session_date: YYYY-MM-DD
recording_link: "<private link — not the file>"
re_identification_risk: low | medium | high
top_friction_ids: []
---

# Recruit session NN — <role>

> Template. **Copy this file** to `agents/recruit-sessions/<NN>-<role>.md` before the session. Never edit `_template.md` in place during a session.

## Consent

> Read this paragraph aloud to the recruit on camera before the recording starts. Confirm verbally that they accept each clause. Do not start the actual session until consent is captured.

You are about to attempt a real task using `@event4u/agent-config`. This session is being screen-recorded with your audio. The recording stays private — only I (the maintainer running this session) and you will have access to it. The repo will only hold a link, not the file. The recording is deleted 90 days after the session, or sooner if you ask. I will write a report based on what we see, but every real-world name, address, monetary amount, personal identifier, and any third-party identifiable content gets redacted before the report becomes public. Verbatim quotes from you may appear in the report — also redacted. You can ask me to retract the report within 30 days of publication, no questions asked. Do you accept these terms? (Wait for verbal "yes" on the recording.)

## Pre-session checklist

> Run this checklist 24 hours before the session. Anything not green pushes the session.

- [ ] **Recruit confirmed** — meets all four criteria from `README.md` § "What counts as a recruit"; calendar block accepted.
- [ ] **Machine clean** — recruit is using their normal day-to-day laptop. No pre-installed `@event4u/agent-config`, no maintainer-prepared shortcuts.
- [ ] **Provider keys** — recruit either has their own provider keys (Claude, OpenAI, Veo, …) or the session task uses `AIV_DRYRUN=true` / dry-run defaults. Maintainer never shares their own keys.
- [ ] **Screen recording armed** — full screen + microphone + system audio. Test a 30-second clip the day before.
- [ ] **Task brief ready** — the one-paragraph brief that defines the target task, written from a real customer / client / project the recruit knows.
- [ ] **Backup plan ready** — if the recruit hits a total dead-end at minute 50, what does success-with-asterisk look like? Capture this before the session, not during.
- [ ] **Stopwatch** — separate from screen recording. Time-to-first-value (TTFV) is one of the headline metrics in the report.

## Interview script (8 questions, after the task attempt)

> Ask these in order, after the recruit has either completed the task, given up, or hit the 60-minute mark. Record verbatim. Do **not** lead the recruit; their wording matters more than a clean phrasing.

1. **What did you expect would happen when you started?** (Captures the mental model the package failed or matched.)
2. **Where did you get stuck?** (First friction point — usually the highest-leverage signal.)
3. **What did you expect to find that wasn't there?** (Surfaces missing surface area: a command, a doc page, a button.)
4. **What surprised you — positive or negative?** (Anchors the report's "unexpected wins" + "unexpected blockers" sections.)
5. **At what point would you have given up if I wasn't in the room?** (The give-up minute is the honest TTFV ceiling.)
6. **What would make you recommend this to someone else in your role?** (Sets the recommendation threshold.)
7. **What would make you uninstall it tomorrow?** (Sets the retention floor.)
8. **What would you pay for this — month one, month twelve?** (Not a pricing study; a willingness-to-keep signal.)

## Post-session report skeleton

> Fill in within 48 hours of the session. Redact before commit. Sign off with the recruit (e-mail or signal); their sign-off goes in the audit trail outside the repo.

### Headline metrics

| | |
|---|---|
| Time-to-first-value | NN minutes (or "did not reach") |
| Task completion | completed · completed-with-asterisk · gave-up |
| Maintainer interventions | NN (count + one-line reason each) |
| Recruit emotional arc | one sentence describing the dominant emotion at minute 0, 20, 40, 60 |

### Verbatim quotes (redacted, never paraphrased)

> Top 5–8 quotes. Each one is timestamped against the recording and tagged with the friction or insight it captures.

- `[mm:ss]` "…" — friction `friction-NNN` (cross-reference to the friction list below)
- `[mm:ss]` "…" — friction `friction-NNN`
- `[mm:ss]` "…" — insight `insight-NNN`

### Friction inventory

> Every place the recruit slowed, stopped, backtracked, or said "wait, what?". Numbered, each one filed at the right severity. Severity is the recruit's, not the maintainer's.

- `friction-001` — **Severity:** blocker · annoyance · cosmetic. **Where:** screen / command / doc page. **What happened:** one paragraph. **Quote anchor:** `[mm:ss]`. **Proposed roadmap home:** Phase N Step N (or "new TODO" if none fits).
- `friction-002` — …

### Three concrete TODOs, ranked

> The three highest-leverage changes the session names. Rank by how many other friction points each TODO defuses. Each one resolves to a roadmap phase or a new TODO.

1. **TODO:** one sentence. **Defuses:** friction-NNN, friction-NNN. **Owner:** roadmap phase N / new ticket.
2. **TODO:** …
3. **TODO:** …

### Unexpected wins

> Where the package surprised the recruit positively. Same shape as friction but tagged `insight-NNN` and not ranked — these inform messaging, not the roadmap.

### Recruit sign-off

- [ ] Report draft sent to recruit on YYYY-MM-DD.
- [ ] Recruit returned redaction requests on YYYY-MM-DD: <none | list>.
- [ ] Recruit signed off on the final redacted version on YYYY-MM-DD.

> **Reminder:** retraction window is 30 days from this sign-off. After that, the report is part of the input contract for Phases 2+ and is treated as stable.
