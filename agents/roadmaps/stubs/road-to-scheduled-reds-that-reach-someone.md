---
complexity: lightweight
review_by: 2026-12-14
---

# Stub: road to scheduled reds that reach someone

> **Stub — not active work.** Opened as the disposition for a defect seen while
> closing `road-to-re-establishing-four-drifted-vendor-pages` and wider than that
> change. A line in a pull-request body is not a disposition, which is why this
> file exists.

## What was observed

The Host Docs Digest Watch failed on `main` on 2026-10-05 and 2026-10-12 and
nobody acted. The drift was found only because an unrelated task ran the same
checker locally. GitHub mails a scheduled failure to whoever last edited the
cron line and to nobody else, so the red had no route to anyone who would act:
a process gap, not a reading gap. The AI council (2026-10-14, anthropic + openai,
CLI, two rounds) agreed on that and on the fix for that one job, which shipped in
the same change: a scheduled red opens or comments on one issue under a fixed
title.

The same gap is open on the other scheduled workflows. On 2026-10-14, 14 files
under `.github/workflows/` carry `schedule:`; none but the digest watch writes
anything when it fails, and none grants `issues: write`. An active roadmap is
moving more calendar-dependent gates onto scheduled callers, so the set grows.

## What closing it needs

1. Classify each scheduled workflow: does its red need a human or an agent to
   act, or is it informational? The council named this as the first step — a
   docs-drift red and a security-scan red are not the same weight.
2. One shared route for the ones that need action, rather than a copy of the
   digest watch's step in each file.
3. A reader: something an agent or the maintainer reads at the start of a
   session that lists open routing issues. An issue nobody reads is the same
   silence in a different interface.
4. Acknowledgement and stale-issue semantics, so a route does not become a pile.

## Not decided here

Who triages a routed issue. The digest watch's issue has no assignee because
naming one is the maintainer's decision, not an automation's.
