---
stability: beta
keep-beta-until: 2026-08-26
roadmap_ref: road-to-adoption-proof-and-ci-green.md
---

# Adoption Signal Floor

> **Status** · v0 / beta · 2026-05-26. Phase D Step 1 of
> [`road-to-adoption-proof-and-ci-green.md`](../../agents/roadmaps/road-to-adoption-proof-and-ci-green.md).
> Defines the privacy-floor for adoption-signal collection — what
> the package may measure, what it may NOT, and the opt-in gate
> consumer-side telemetry would need to clear before it could ship.

## The Iron Law

```
LOCAL-ONLY BY DEFAULT. NO CONSUMER TELEMETRY. NO PER-USER DATA.
NO CROSS-PROJECT CORRELATION. ANY SIGNAL THAT LEAVES A CONSUMER
MACHINE IS EXPLICITLY OPT-IN, NEVER ON BY DEFAULT.
```

The package's adoption story is told through **public surfaces only**
— npm registry counters, GitHub public-API metrics, registry-listing
status. The consumer's machine stays opaque to the maintainer unless
the consumer opts in explicitly and the contract names the opt-in
gate.

## Allowed signals — public sources only

All four signals below come from public APIs and require no
consumer-side instrumentation. The roadmap's Phase D Step 2
collector (`scripts/adoption_snapshot.py`) pulls them into a single
weekly snapshot.

| Signal | Source | Refresh cadence | Privacy posture |
|---|---|---|---|
| **npm install count** | npm registry API (`https://api.npmjs.org/downloads/`) | Daily granularity; we snapshot weekly. | Public. Aggregated across all installs; no IP / user identification possible from this surface. |
| **npm version distribution** | npm registry API (`https://registry.npmjs.org/@event4u%2Fagent-config`) | Per-publish; we snapshot the latest version on each cron. | Public. Reveals which versions are still being pulled, not who pulls them. |
| **GitHub stars / forks** | GitHub REST API (`/repos/event4u-app/agent-config`) | Snapshot-on-demand. | Public. GitHub already exposes the count on the repo page. |
| **Topic-search rank** | GitHub search API (`/search/repositories?q=topic:agent-skills` and `topic:cinematic-ai-video`) | Snapshot-on-demand. | Public. Surfaces where the package lands in topic-based discovery. |

The collector stores one dated JSONL row per cron run at
`agents/runtime/metrics/adoption-snapshots.jsonl`. The file is
local-only — it never leaves the consumer's CI runner; the project
publishes only the rolled-up `adoption-report.md` (see Phase D
Step 3).

## Disallowed signals — never collected, never on-by-default

The four classes below would violate the Iron Law. They are listed
explicitly so the boundary is unambiguous:

1. **Consumer-side telemetry.** Any signal that originates on a
   consumer's machine — CLI invocation count, error rates,
   feature-use counters, prompt token counts, install-success-on-OS
   metrics — is **forbidden** without an explicit opt-in flag
   the consumer sets per-install.
2. **Per-user data.** Even aggregated, the package does not collect
   anything that can identify an individual (email, IP, machine
   fingerprint, hostname). The aggregate-only carve-out does not
   apply to anything narrower than country-level.
3. **Cross-project correlation.** Two consumer projects that both
   install the package must never be linkable through any signal
   the package emits. (npm install counts are aggregated by npm
   itself; the package does not retain or correlate them.)
4. **Outbound network from the package runtime.** No `fetch()`,
   no `requests.post()`, no `httpx.post()` to a maintainer-side
   endpoint. The package's `0` outbound calls posture is a feature.

## Opt-in gate — what consumer-side telemetry would need

Should a future phase want to add consumer-side telemetry (for
example, anonymous error reporting), each of the four gates below
must clear before the code lands:

| Gate | Requirement |
|---|---|
| **Explicit opt-in flag** | A consumer-side environment variable or `.agent-settings.yml` field defaulting to `false`. Never on at install time. |
| **Per-event consent UX** | The first time the flag flips, the agent / CLI prints a one-screen explanation of what is collected and a y/N confirmation prompt. |
| **Local-first storage** | Every emitted event must land on disk first (so the consumer can read it before it leaves); upload is a separate later step. |
| **Maintainer-controlled receiver** | The receiving endpoint is maintainer-owned, documented in `docs/contracts/`, and reviewed by `domain-safety-pii` + `data-handling-judgment` before any code points at it. |

Until all four gates are written and reviewed, consumer-side
telemetry is **forbidden** even as a discussion item in roadmaps.

## Re-audit cadence

Re-audit on each of:

- A new adoption signal (proposed for the collector).
- A consumer asks for a feature that would require knowing how they
  use the package — the answer is "we don't collect that; here is
  how the existing public signals approximate it".
- Quarterly check against the Phase D Step 4 trend snapshot — if
  the existing four signals stop tracking adoption faithfully, the
  question is "add a new public signal" never "add consumer
  telemetry".

## See also

- [`scripts/adoption_snapshot.py`](../../src/scripts/adoption_snapshot.py)
  — the collector for the four public signals.
- `domain-safety-pii` rule — the redaction floor any future opt-in
  telemetry would inherit.
- `data-handling-judgment` skill — the regulatory read for any
  cross-border data flow.
- [`registry-submissions.md`](../distribution/registry-submissions.md)
  § Adoption-tracking signal — how the snapshot trend interacts
  with the registry-row status counters.
