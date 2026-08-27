---
stability: beta
keep-beta-until: 2026-10-25
roadmap_ref: road-to-adoption-proof-and-ci-green.md
---

# Adoption Signal Floor

> **Status** · v0 / beta · 2026-05-26. Phase D Step 1 of
> the `road-to-adoption-proof-and-ci-green` roadmap (archived).
> Defines the privacy-floor for adoption-signal collection — what
> the package may measure, what it may NOT, and the opt-in gate
> consumer-side telemetry would need to clear before it could ship.
>
> **Beta review, 2026-08-27 — extended to 2026-10-25, and the date is derived
> rather than chosen.** The Iron Law and both closed lists are settled and
> unhedged; what keeps this contract in beta is one live bet it holds itself.
> **What has to happen before promotion:** § Extraction demand gate opened its
> window when the probe page landed on `main` (2026-07-20), and that window
> closes **2026-10-18**. Neither of its two branches — floor met, floor missed —
> has been recorded as a decision anywhere under `docs/decisions/`. The new date
> is a week after the window closes, so the next review has an outcome to read
> instead of the same open bet.
>
> One thing found and **not** fixed here, stated rather than left silent: the
> collector's own store, `agents/runtime/metrics/adoption-snapshots.jsonl`, does
> not exist on this tree. That is a separate question — whether the cron has ever
> written — and it is not what gates promotion.

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
collector (`src/scripts/adoption_snapshot.ts`) pulls them into a single
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

## Extraction demand gate — lint_originality standalone probe

Added 2026-07-20 (road-to-originality-gate-and-contributor-funnel Phase 3,
council 2026-07-20: extraction is demand-gated; the floor IS the demand gate,
applied post-probe). Uses **allowed public signals only** — inbound GitHub
issues/PRs and their authors; no consumer telemetry, consistent with the Iron
Law above.

| Field | Value |
|---|---|
| **Probe surface** | [`docs/anti-reskin-gate.md`](../anti-reskin-gate.md) — run-from-clone recipe + signal instructions |
| **Signal definition** | A distinct external (non-maintainer) GitHub account opening an issue titled `anti-reskin gate: standalone request`, or referencing `lint_originality` in an inbound issue/PR about their own catalog |
| **Floor** | ≥ 3 distinct external signals |
| **Window** | 90 days from the probe page landing on `main` |
| **Floor met** | Extract `lint_originality` as a standalone zero-config npx package (`--changed` mode, no repo coupling, regression suite included); npm publish remains a maintainer decision (name, scope, moment) |
| **Floor missed** | Extraction **cancelled** — recorded via decision-record; not relitigated without new evidence |

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

- [`src/scripts/adoption_snapshot.ts`](../../src/scripts/adoption_snapshot.ts)
  — the collector for the four public signals.
- `domain-safety-pii` rule — the redaction floor any future opt-in
  telemetry would inherit.
- `data-handling-judgment` skill — the regulatory read for any
  cross-border data flow.
- [`registry-submissions.md`](../distribution/registry-submissions.md)
  § Adoption-tracking signal — how the snapshot trend interacts
  with the registry-row status counters.
