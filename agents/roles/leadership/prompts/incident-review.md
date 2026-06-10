---
name: incident-review
intent: "Turn raw incident notes into a blameless postmortem — timeline, root cause, contributing factors, and owned corrective actions."
inputs:
  - name: incident_notes
    required: true
    shape: "free-text — what happened, in whatever order it was captured (chat logs, war-room notes, timestamps)"
  - name: severity
    required: false
    shape: "string — the severity label your team uses, e.g. 'SEV-2' / 'major' / 'minor'"
  - name: timeline_raw
    required: false
    shape: "free-text — separate raw timestamps if not already in the notes"
output_shape: "Markdown — H2 sections (Summary / Timeline / Impact / Root cause / Contributing factors / What went well / Corrective actions / Open questions), ≤ 700 words. Corrective actions as a table (Action / Owner / Due / Type)."
skill_hint: decision-record
---

You are writing a **blameless** incident review (postmortem). The goal is a
review the team can act on, not a search for who to blame — name systems and
gaps, never people. This is **retrospective**: what already happened, not a
forward risk forecast (that is `risk-analysis-memo`) and not live-ticket
escalation triage (that is support's `escalation-risk-analysis`).

Produce, in order:

1. **Summary.** One line: what broke, when, and the headline impact.
2. **Timeline.** Detection → mitigation → resolution, with timestamps. Mark the
   three key moments: when it started, when it was *detected*, when it was
   *resolved* — the gap between start and detection is usually the real lesson.
3. **Impact.** Who and what was affected, for how long, at what severity. Use
   numbers where the notes give them; write "(not captured)" where they do not —
   never invent a figure.
4. **Root cause.** The single underlying cause, stated as a system/process gap.
   If the notes do not establish it, say so and list the candidate causes
   instead of asserting one.
5. **Contributing factors.** What made it possible or made it worse (missing
   alert, stale runbook, single owner, no rollback path). Blameless — factors,
   not fault.
6. **What went well.** At least one thing — fast detection, a clean rollback, a
   good handoff. Postmortems that only list failures stop getting written.
7. **Corrective actions.** A table — **Action / Owner / Due / Type** — where Type
   is `prevent` (stops recurrence), `detect` (catches it faster next time), or
   `mitigate` (reduces blast radius). Every action has a named owner or it is
   not an action.
8. **Open questions.** What the notes do not yet answer and who should close it.

Never assign blame to an individual. Never assert a root cause the notes do not
support. Never leave a corrective action without an owner.

**Incident notes**

{{incident_notes}}

**Severity**

{{severity}}

**Raw timeline (if separate)**

{{timeline_raw}}
