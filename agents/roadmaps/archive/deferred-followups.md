# Deferred Follow-Ups

**Source:** Items carried over from completed roadmaps that were blocked or
explicitly deferred. Extracted so the parent roadmaps could move to
`archive/` cleanly.

**Status:** None of these items is currently actionable from inside this
repository. They each depend on an external condition — a skipped decision,
a fresh consumer project, a future ecosystem state, or creative work that is
out of scope for mechanical execution.

## Origin map

| From | Reason deferred |
|---|---|
| [`archive/product-maturity.md`](archive/product-maturity.md) | Blocked on skipped multi-package split, or requires external validation |
| [`archive/readme-and-docs-improvement.md`](archive/readme-and-docs-improvement.md) | Explicitly marked `(future)` or `(deferred — creative)` |

---

## Blocked on skipped multi-package split

The multi-package architecture was moved to [`skipped/multi-package-architecture.md`](skipped/multi-package-architecture.md).
Items that depended on it cannot proceed without a decision reversal.

- [ ] Implement matrix resolution in agent runtime — read `cost_profile`,
  apply the settings matrix, honour overrides.
  **Blocked by:** no separate runtime package exists.
  **Unblock condition:** runtime package is split out, or the matrix is
  implemented inline in the current single-package shape.

---

## Requires external consumer project

These items cannot be validated inside this repository. A fresh consumer
project (new Laravel or Node repo) is the only meaningful test environment.

- [ ] Test the first-5-minutes flow with a fresh project — is the difference
  obvious in 5 minutes? (product-maturity Gap 5)
- [ ] Test: minimal-mode agent vs vanilla agent on the same task — is the
  difference obvious? (product-maturity Gap 6)

**Unblock condition:** a consumer project with an active developer willing
to run the install and report back.

---

## Phase 4b — Installation maturity (future)

All three concepts were parked under Phase 4b of the readme-and-docs
roadmap with the explicit note: "Depends on stable plugin API formats."

### Concept 1: Auto-detection in consumer project

- [ ] Design detection logic for consumer project context
- [ ] Implement `scripts/detect-agent.sh` (runs in consumer project, not here)
- [ ] Implement `scripts/show-install-guide.sh` (context-aware recommendations)
- [ ] Wire into `task install-guide` (optional)

**Unblock condition:** plugin API formats for Augment, Claude Code, and
Copilot CLI are stable enough to detect reliably from outside each tool.

### Concept 2: Install checker

- [ ] Design check logic per tool
- [ ] Implement `scripts/install-check.sh`
- [ ] Wire into `task install-check` (optional)
- [ ] Consider running as a post-install hook

**Unblock condition:** same — stable plugin config formats.

### Concept 3: Centralized plugin definition

- [ ] Investigate whether plugin formats support source/reference paths
- [ ] If yes — create `plugin/agent-config/plugin.json` as canonical definition
- [ ] If no — keep tool-specific manifests, sync via build script

**Unblock condition:** plugin API format support for cross-references.

---

## Creative work (deferred — not mechanical)

These items require design taste and should not be executed autonomously.

- [ ] Add a badge row to the README: CI status, skill count, license, Agent
  Skills standard. Requires badges infrastructure and a visual decision.
- [ ] Add a simple logo or banner image for visual identity. Requires
  creative design work.

**Unblock condition:** explicit request from a maintainer with the design
brief in hand.

---

## What this page is not

- Not a roadmap in the usual sense — no phases, no priority order, no
  success metrics.
- Not a wishlist — only items that were already vetted and approved as
  valuable before being deferred.
- Not an active work queue — nothing here should be worked on
  opportunistically. Each item has a specific unblock condition.

## When an item unblocks

1. Move the unblocked item out of this file.
2. Add it to a new or existing active roadmap with a real phase structure.
3. Cross-reference back to the parent archive entry for historical context.

---

← [Back to README](../../README.md)
