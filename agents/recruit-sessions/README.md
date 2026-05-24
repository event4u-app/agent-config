# Recruit sessions — external adoption proof

> Roadmap home: `agents/roadmaps/road-to-employee-product-and-external-proof.md` Phase 1.
> Input contract for Phases 2 onwards: any phase whose scope is **not** validated by a recruit-session finding gets re-justified or descoped.

## What a recruit session is

A 60-minute screen-shared, recorded session where a recruit — someone not on the maintainer team and with no prior exposure to `@event4u/agent-config` — installs the package and attempts one of three real tasks while the maintainer observes silently. The maintainer does **not** intervene except to unblock total dead-ends (missing prereq, broken provider key) and only after the recruit has been stuck for ≥ 3 minutes.

The session produces three artefacts:

1. **Screen recording** — full session, stored privately (not in-repo). The repo holds the recording link only.
2. **Verbatim quote log** — the moments the recruit narrated their thinking. Quotes drive the friction ranking; paraphrase is not allowed.
3. **Report** — filed at `agents/recruit-sessions/<NN>-<role>.md`, structured per `_template.md` § "Post-session report".

## What counts as a recruit

A valid recruit meets **all four** criteria:

- **Not on the maintainer team** — has never committed to this repo, is not a maintainer at event4u, has never been paid to work on the package.
- **No prior exposure** — has not read the README, the docs, or watched a demo before the session. (Hearing the package name in passing is fine; reading the install guide is not.)
- **Owns the target task in real life** — galabau owner who drafts real offers, content creator who ships real videos, consultant who writes real client memos. Not a developer simulating one.
- **Consented to the recording + redaction policy** — signed the consent paragraph in `_template.md` § "Consent" before the recording starts.

A "friendly developer" who knows the maintainer is **not** a recruit. A user who already installed the package "to try it out last week" is **not** a recruit.

## Three target personas

The roadmap names three personas for the first wave. The order matters: galabau first (highest leverage — the package's home domain), content creator second (the AI-video pipeline is the most differentiated surface), consultant third (the most generalisable non-developer use case).

| Order | Persona | Real-life task | Report file |
|---|---|---|---|
| 1 | Galabau owner / project lead | Draft a customer offer from a one-paragraph brief | `01-galabau-owner.md` |
| 2 | Content creator (indie / small shop) | Produce a 4-shot storyboard for a 30-second social video | `02-content-creator.md` |
| 3 | Consultant (independent or boutique) | Refine a fuzzy client brief into a structured investor memo | `03-consultant.md` |

A fourth and fifth persona (sales rep, finance lead) wait for the consolidation in Step 6 — the top-10 friction ranking tells us which one is the next highest-leverage investment.

## Consent + redaction policy

Recruits handle real customer data, real client briefs, real personal device state. The recording captures all of it. The policy below is the non-negotiable floor; the maintainer is the data controller for every session.

- **Consent paragraph** lives at the top of `_template.md` § "Consent". The recruit reads it aloud on camera before the recording starts; the maintainer confirms verbally. No consent → no session.
- **Real data stays out of the report.** Customer names, project addresses, monetary amounts, personal identifiers, and any third-party identifiable content are redacted before the report lands in-repo. Placeholders: `[CUSTOMER]`, `[ADDRESS]`, `[AMOUNT]`, `[CLIENT-A]`, `[PROJECT-X]`.
- **Verbatim quotes are redacted, not paraphrased.** A quote that names a customer becomes `"…we just lost [CUSTOMER] because…"` — the bracket is the redaction marker; the rest of the sentence stays verbatim.
- **Quasi-identifiers** (project type + city + month, or industry + team size + region) get flagged in the report's `re_identification_risk` frontmatter key. If the combination uniquely identifies a real entity, the maintainer either obtains explicit re-publication consent or removes the quasi-identifier set.
- **The recording stays private.** Only the maintainer and the recruit have access. The repo holds the link, not the file. The recording is deleted 90 days after the session unless the recruit asks for permanent deletion sooner.
- **Right of withdrawal.** The recruit can ask for the report to be retracted (hard-deleted + history rewritten) within 30 days of merge. The maintainer honours this without explanation.

## What a session is **not**

- **Not a UX research interview.** No structured survey, no Likert scale. The recruit attempts a real task; the maintainer observes.
- **Not a demo.** The maintainer does not walk the recruit through the package. The package's own onboarding is what we are measuring.
- **Not a beta-test signup funnel.** Recruits are not converted into ongoing testers in the same session. If they want to keep using the package after, that's a separate conversation.
- **Not a marketing artefact.** The reports are internal product input. Verbatim quotes may be re-used externally only with the recruit's explicit re-publication consent, captured in writing after the report has been written.

## Files in this directory

- `README.md` — this file (what / who / consent).
- `_template.md` — pre-session checklist, interview script, post-session report skeleton. **Copy this** for every session; never edit in place.
- `01-galabau-owner.md` — session 1 report (filed after Phase 1 Step 3 runs).
- `02-content-creator.md` — session 2 report (filed after Phase 1 Step 4 runs).
- `03-consultant.md` — session 3 report (filed after Phase 1 Step 5 runs).
- `_findings.md` — consolidated top-10 friction ranking (filed after Phase 1 Step 6 runs); the input contract for Phases 2+.
