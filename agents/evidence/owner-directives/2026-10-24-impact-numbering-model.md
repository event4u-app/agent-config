<!-- evidence-type: analysis -->

# Owner directive — the Consumer-Impact trailer binds the version bump

| Field | Value |
|---|---|
| Ordered by | the repository owner, in their own session prompt |
| Date | 2026-10-24 |
| Scope | `road-to-a-release-that-says-whether-it-needs-you` blocker `impact-numbering-model`, option (a) |
| Source of the order | the owner's answer to the numbered question on that blocker, put to them in the orchestrating session of the 2026-10-24 roadmap drain and relayed to the executing lane in its brief |
| Grants by itself | the transition named below, nothing else |

## The instruction, verbatim

> 1

## What it answers

The question offered option (a) — the trailer plus the impact-driven bump rule —
as its first option. The owner chose it **with a migration exception**, as the
orchestrating session recorded the answer:

1. The `Consumer-Impact` trailer **binds** the version bump; it is no longer
   advisory, experimental metadata. A release is a major when a commit in it
   declares `action`, or when it touches a surface the versioning policy lists
   as major.
2. A settings key removed with an **automatic migration** is **not** a major.
   `CONTRIBUTING.md`'s major row (line 331 when the question was put) is amended
   to say so.

## What it does not grant

- Nothing about AC-4 of the same roadmap (the `ask` vs `action` wording for an
  unmet `engines.node`); that criterion stays with the owner.
- No change to how an update is installed or asked about; the classifier stays
  read-only.
- The two implementation choices ADR-300 records — a breaking commit with no
  valid trailer stays a major, and the settings-key exception applies only when
  the span's strongest declared impact is `automatic` — are the agent's reading
  of the order, made conservative on purpose, and are named there so they can
  be reopened without reopening the order itself.
