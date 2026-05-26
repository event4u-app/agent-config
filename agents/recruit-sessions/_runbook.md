# Recruit session — maintainer runbook

> Phase B Step 1 of `road-to-adoption-proof-and-ci-green.md`.
> Operational playbook for the maintainer who runs the session.
> The recruit-side contract lives in `README.md` (who counts, what
> counts) and `_template.md` (the artefact shape); this file fills
> the gap between "I have a recruit" and "the report is filed".
>
> All five sections are checklists, not narrative. Skip them at your
> peril — the session is recorded; mistakes leave traces.

## 1. Finding a recruit

The maintainer's network is the first channel, not the last. A
single galabau owner who runs offers every week is worth more than
ten LinkedIn cold-DMs. Use the order below; stop at the first
yes.

### Channels per persona

| Persona | Channels (highest-leverage first) |
|---|---|
| **Galabau owner** | (1) Maintainer's own Galabau customers (Galawork is the day job — the network exists). (2) Galabau-trade Slack / Discord / WhatsApp groups in DACH. (3) `r/Gartenbau`, German LinkedIn groups for `Landschaftsarchitektur`. (4) Cold-outreach via a local Galabau-trade publication. |
| **Content creator** | (1) Zürich content-creator scene — the maintainer's coworking neighbours. (2) Indie-creator Discord servers (Notion-shared roster: maintainer's contacts file, populated before outreach). (3) `r/youtubers` German thread; LinkedIn creator-economy hashtags. (4) Cold-DM via Twitter / Bluesky to a creator who shipped a recent short with a visible storyboard. |
| **Consultant** | (1) Maintainer's consultant peers from past gigs. (2) IndieHackers / `r/consulting` (DE / EN). (3) Boutique-consultancy LinkedIn groups (`Strategy Tools`, `Independent Advisors`). (4) Past clients of the maintainer's previous consulting work. |

### Outreach templates

Three templates — pick the one matching the persona, fill the
bracketed slots before sending. Templates stay short (≤ 80 words)
to maximise reply rate.

**Template — galabau owner (DE):**

> Hi [Name], ich baue gerade ein Tool, das Galabauern beim Angebotsschreiben hilft — Stichwort: aus 5 Zeilen Briefing wird ein strukturiertes Angebot, ohne dass du noch eine halbe Stunde dran feilst. Ich suche eine echte Person, die das einmal live in einer 60-Min-Session ausprobiert (bezahlt: 100 €). Du müsstest nichts vorbereiten — eigene Briefe / Vorlagen reichen, ich schau zu, du arbeitest. Macht das Sinn? — [Maintainer]

**Template — content creator (DE / EN):**

> Hi [Name], I'm building a tool for short-form creators that turns a one-line idea into a 4-shot storyboard with character lock — provider-agnostic. Looking for one creator to try it live in a 60-min session (paid: CHF 100). No prep on your side; bring a real script idea you'd want to ship, I observe + take notes. Yes / no? — [Maintainer]

**Template — consultant:**

> Hi [Name], I'm running paid 60-minute usability sessions on a writing tool that turns fuzzy client briefs into structured memos. Looking for one consultant who actually writes briefs / memos / decks weekly. CHF 100 for the hour. Bring a real (anonymisable) brief; I observe, you work. — [Maintainer]

### What an outreach answer looks like

A yes is "yes, when?". A maybe is "interesting, what tool?". A
silent no is silence. Do **not** chase past one follow-up
message; the conversion rate on the second nudge is single-digit
and the time cost is large.

## 2. Scheduling

- **Timezone.** Recruit's, not maintainer's. Send the calendar invite in the recruit's local time.
- **Duration.** 75 minutes blocked, 60 minutes recorded. The first 10 minutes are intro + consent capture; the last 5 are wrap.
- **Recording tool.** Loom, Zoom, or Riverside — whichever the maintainer already has. The choice does not matter as long as it captures: full screen, recruit microphone, system audio (optional).
- **Consent paragraph.** Sent in the calendar invite body, copy-pasted from `_template.md` § Consent. Recruit reads it before the session; verbal "yes" gets captured on the recording at minute zero.
- **Payment.** Pay the recruit **before** the session. CHF 100 / EUR 100 via Twint / PayPal / bank transfer. Pay-after creates an implicit "be nice to the maintainer" pressure that biases the session.

## 3. Day-of pre-flight

Run `bash scripts/recruit_preflight.sh` 30 minutes before the
session. It checks five things:

1. **Provider keys.** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` present in env (or the session task uses `AIV_DRYRUN=true`).
2. **No in-progress experiments.** `~/.augment/` is clean. No half-finished workspace state that could confuse the recruit.
3. **`agents/recruit-sessions/` writable.** The maintainer can save the report at the end without surprise.
4. **`task ci` green at HEAD.** Yesterday's regression doesn't poison the install path the recruit hits today.
5. **Screen recording armed.** Tool open, test clip captured.

Script exits non-zero on any check failure — the session pushes.

### Maintainer-side mental pre-flight

- **Phone on Do-Not-Disturb.** Notifications during the recording leak into the recording.
- **Browser tabs.** Close everything except the session call, the screen-recording app, and a blank doc for live notes.
- **The brief.** A single page, written ahead of time, that the recruit reads at minute 5. No "let me think of one on the spot".

## 4. During-session script

The maintainer's job is **observe, not coach**. The recruit is
working; the maintainer is taking timestamps.

### Timing

| Minute | What happens |
|---|---|
| 0-2 | Verbal consent capture on the recording. |
| 2-5 | Maintainer reads the brief aloud; recruit asks any clarification. |
| 5-50 | Recruit attempts the task. Maintainer takes timestamps of friction moments. |
| 50-55 | Backup plan if the recruit hit a dead-end. Surface the "what would success-with-asterisk look like" pre-written option. |
| 55-65 | Interview script (8 questions from `_template.md`). |
| 65-75 | Wrap, payment confirmation, retraction-window reminder. |

### Escape hatches

The maintainer intervenes **only** when:

- The recruit has been stuck on the same screen for ≥ 3 minutes
  AND a prereq is missing (broken provider key, network outage,
  missing binary). Not "I can't figure out the next prompt".
- The recruit asks a clarifying question that the brief itself
  should have answered.
- The recording is broken or audio is gone — pause, fix, restart
  recording, note the gap in the report.

Otherwise — observe. Silence is data.

## 5. Post-session

Within 24 hours of the session:

1. **Redaction pass.** Copy `_template.md` → `<NN>-<role>.md`. Fill out the verbatim-quote log, friction inventory, and report skeleton. Every customer name, address, project number, monetary amount, third-party identifier, and personal name — redacted to `[REDACTED-CUSTOMER]` / `[REDACTED-ADDRESS]` / `[REDACTED-AMOUNT]`. The recording link is private (not in repo); only the link host carries the recording.
2. **Re-identification check.** Read the report twice — once for content, once for re-identification risk. Three or more quasi-identifiers in the same report (location + industry + customer-segment + project-size) need bucketing. See `domain-safety-pii` rule.
3. **Friction ranking.** From the verbatim quotes, extract the friction list. Rank by frequency × severity. Top 5 friction items land in the report; the rest stay in the working notes.
4. **Retraction-window communication.** Send the recruit a copy of the redacted report 48 hours after the session, with a single sentence: *"You can ask me to retract this within 30 days, no questions asked. After 30 days the report is final."*
5. **Findings update.** Once three reports land, consolidate into `_findings.md` per Phase B Step 6. Until then, individual reports live standalone.

## Failure modes — what goes wrong

- **The recruit watched a maintainer demo before the session.** They are no longer a recruit. Reschedule with a fresh recruit, OR file the report flagged as `pre-exposed: true` and exclude its quotes from the findings ranking.
- **The recording failed mid-session.** Capture the maintainer's live notes; treat the session as a low-confidence input; ship the report flagged `recording_lost: true`.
- **The recruit asks for the recording.** Honour the request — send the file (privately), then immediately delete the maintainer's copy. The repo link gets removed.
- **The recruit declines to pay-after.** They are not declining to participate; pay-before sidesteps this entirely.
- **The maintainer forgot to ask for verbal consent on tape.** Stop the session. Re-capture consent. If the recruit has already started typing, restart from minute zero — non-negotiable.

## See also

- [`README.md`](README.md) — recruit definition + persona order + consent floor.
- [`_template.md`](_template.md) — report skeleton + interview script + frontmatter contract.
- [`scripts/recruit_preflight.sh`](../../scripts/recruit_preflight.sh) — day-of automation.
- `domain-safety-pii` rule — redaction floor for verbatim quotes.
