---
complexity: lightweight
review_by: 2026-09-19
---

# Stub: road to the org telemetry sink

> **Stub — not active work.** Transferred out of
> [`road-to-org-telemetry.md`](../road-to-org-telemetry.md) Phase 2 on
> 2026-08-20 under blocker `sink-choice`, by the drain-run disposition
> framework
> [`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md)
> (disposition **B** — outcome `transferred`). Council 2026-08-20, quorum 2/2:
> *"The preferred choice is a private repository, but creating it is an
> external action."*
>
> Nothing here was rejected on merit and nothing is half-shipped. Everything in
> this repository that does not need a sink to exist was executed in the same
> run — the transport, its two deferred measurements, the report's second
> source, and the Class-A/Class-B split. What is left is one act only: someone
> with org-admin rights creating a store.

## The council's preference, recorded — and why it is recorded HERE

**Preferred architecture: a private repository used as an append-only store.**
The roadmap's own recommendation and the council agree, for the reasons the
blocker gives: the volume is small, the write path is an existing authenticated
primitive rather than new infrastructure to operate, and the Phase 6 clustering
runs offline over the file set.

The preference is written down so the decision does not have to be re-derived.
It is written down **in the stub and not in the parent roadmap** because those
are two different claims. "A private repository is the right shape" is a design
opinion the council may hold. "The sink exists" is a fact about the world that
only an org-admin act can make true, and the parent roadmap may not record it
as decided-and-done. Framework rule 3 is categorical on exactly this:
repository creation takes `B`, never `D`.

**This act IS a Hard-Floor action in its own right.** The README's drain-run
section already carries the qualification and it applies here in full: being
exempt from the org-mode promotion gates does not exempt the act. Creating a
repository, and later pointing an install's `endpoint` at it, are
externally-visible acts that need their own this-turn approval under
`non-destructive-by-default` when a human performs them. An agent may not
perform them at all.

## Transferred work — quoted as it stood

**Original resolved-when criterion, verbatim** (from the `sink-choice` blocker
at the transfer commit):

> **Resolved when:** the sink and its location are named, and the identifier
> exists in the org pack rather than in this repository.

**Complete list of steps moved.** Four items, and nothing beyond them —
everything else in Phases 2 through 6 either shipped in this run or moved to
the enablement stub.

| Origin | Item, verbatim |
|---|---|
| Phase 2, step 3 | "Stand up the sink as a minimal append-only ingest with no read API in this phase." |
| Phase 2, exit criteria | "records written on a second machine appear in the sink, and an endpoint outage is invisible to the session." — the first half only; the second half is asserted in this run against a loopback blackhole. |
| Phase 5, step 3 | "Transport and store Class-B text as quoted, typed data, never concatenated into a downstream prompt as instruction." — the **store** half only. The repository-side half landed: `self_repair_class_b.ts` types the case, serialises it as one JSON object, and `assertNeverInterpolated` refuses a prompt-shaped use. There is nowhere to store it. |
| Phase 6, step 1 | "Cluster sink-side on artefact and failure class, with a threshold of at least three distinct sessions aligned to the existing constant. At threshold, generate one deduplicated issue carrying Class-A statistics in the header and approved Class-B examples quoted as data blocks." |

## Re-entry producer and detection probe

Promotion is not "when someone builds it".

| Field | Value |
|---|---|
| **Producer** | The **org repository administrator** — the person holding admin rights on the `event4u-app` organisation. Named by role because that is the authority the act requires; no automation in this repository can perform it, and no other role can. |
| **Detection probe** | A private, package-CI-inaccessible repository identifier resolves AND appears in org-pack settings. Concretely: `gh repo view <identifier> --json visibility,isPrivate` returns `private`, the identifier is present as `telemetry.remote.endpoint` (or its org-pack equivalent) in the user-global settings layer, and this repository's CI cannot read it. |
| **Measured at transfer (2026-08-20)** | **FAIL, on every clause.** No identifier is named anywhere in the tree; `telemetry.remote` ships key names and no values by design, so `read_remote_settings` resolves `active: false` and `missing: endpoint, org_id, salt`. The report's own second-source section renders "does not exist" for `agents/runtime/metrics/telemetry-class-a.jsonl`. |

## Monitoring, review and rollback — the standing-egress fields

A telemetry sink is a **standing egress**: once an endpoint is configured, data
leaves machines on a schedule with no further human act. A drain-run transfer
that left one with no named owner and no off-switch would be worse than not
building it, and the council's dissenting seat asked for exactly these fields
(*"who operates it? SLA? monitoring?"* — recorded in the disposition document
as a pushback the framework's output format had no slot for). They are answered
here rather than left to the day the sink appears.

| Field | Value |
|---|---|
| **Monitoring owner** | The **org repository administrator** who creates the sink owns its health, as a condition of creating it. This stub may not be promoted with the field unfilled: an unowned egress is a refusal condition, not a documentation gap. |
| **What "health" means** | Three readable facts: the spool on a representative install is draining (it is not growing across sessions), the sink's record count is rising, and the newest record is less than 48 h old. All three are readable from the sink's own file set — no dashboard is required or intended. |
| **Review date** | **2026-11-20** (90 days after transfer), whether or not the sink exists by then. Two questions at review: is the sink still wanted, and has the local-only posture turned out to be sufficient. A review that finds nobody has missed the sink is a legitimate outcome and should retire this stub rather than re-date it a second time. |
| **Rollback trigger** | ANY of: (a) a record reaching the sink that carries project content, a path, or an identifier — one instance, no threshold; (b) the monitoring owner becoming unavailable with no named successor; (c) the data-protection outcome in the enablement stub coming back negative or conditional in a way the shipped field list does not satisfy; (d) a spool observed growing unbounded on any install. |
| **Rollback procedure** | Two steps, in this order, and the first alone is sufficient to stop the egress. **1.** Remove `endpoint` from the org pack (or set `enabled: false`). `read_remote_settings` then resolves `active: false`, at which point every writer performs zero file operations and the flush concern short-circuits before it stats the spool — no code change, no release, effective on the next session. **2.** If the sink itself must go, delete the private repository; the local logs on each install remain and are bounded by the retention policy. The parent roadmap's Phase 2 rollback line already states the weaker version of step 1 ("disable the flush flag; emission continues locally and nothing is lost"). |
| **Why the off-switch is credible** | It is not a promise about a future flag. `active` requires `enabled` AND `endpoint` AND `org_id` AND `salt`, none of which has a default, and `tests/hooks/telemetry_flush_hook.test.ts` asserts the inactive path across five not-opted-in shapes, including no settings file at all. Removing one field is a verified stop, not an intended one. |

## What does NOT apply to this stub

The **Promotion criteria (shared)** in [`README.md`](README.md) — recruited
customer, funded security audit, maintainer ADR lifting a Hard-Floor item —
govern the six org-mode stubs. They do not govern this one, which is a
drain-run transfer of already-agreed internal work. Its gate is the probe
above and the monitoring owner being filled in.

That exemption is from the **promotion gates**, not from the Hard Floor. See
the Hard-Floor paragraph at the top of this file; the two are separate and this
stub is exempt from only one of them.
