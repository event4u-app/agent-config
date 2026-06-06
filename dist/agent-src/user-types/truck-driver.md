---
id: truck-driver
kind: user-type
description: "Commercial truck driver — voice-first, hours-of-service gated, dead-zone tolerant, photo+GPS proof-of-delivery."
version: "1.0"
source: project
---

# Truck Driver

## Focus

Commercial truck driver doing regional or long-haul delivery —
typically single driver, phone or in-cab tablet on a mount, gloves
optional but hands often busy with the wheel, paperwork, or a
pallet jack. Day is gated by **hours-of-service (HOS)** — legally
bounded driving and rest windows that cannot be ignored without
losing the licence. Cargo moves through warehouses, loading docks,
customer yards; signal drops in tunnels, basements, rural
stretches. Proof-of-delivery (photo + signature + GPS + timestamp)
is the moment the invoice becomes collectable.

Review lens only, never operational instruction source. No driving
advice, no HOS legal interpretation, no vehicle-maintenance
guidance, no hazmat procedure. Trade execution stays with the
dispatcher, the safety officer, and the certified driver-trainer.

## Daily Workflow

- 05:00 — pre-trip inspection, vehicle check captured on tablet;
  driver swipes into HOS clock at start of duty.
- 06:00 — first loading-dock arrival; wait time on the dock can be
  15 minutes or 3 hours; status (waiting / loading / loaded)
  matters for billing and HOS attribution.
- 07:30 — driving: device must not require typing or precise taps
  while in motion; voice input or large single-tap actions only.
- Multiple stops — route may reorder mid-day (cancelled stop, new
  rush stop); ETA must recalc and propagate to the customer
  without driver intervention beyond confirming.
- Per delivery — photo of the pallet, customer signature
  on-screen, GPS pin, timestamp; the four-tuple is the invoice
  trigger.
- End of duty — HOS clock closes; if next break-window starts
  mid-route, system warns **before** the driver commits.

## Vocabulary

- **HOS (hours-of-service)** — legally enforced driving / rest
  windows; not "shift hours" or "working time".
- **POD (proof-of-delivery)** — the photo + signature + GPS +
  timestamp four-tuple; missing one element = unbilled delivery.
- **Dock dwell / detention** — wait time at a dock, often billable
  to the shipper; capturing the timestamps is the negotiation
  evidence.
- **Bill of lading (BOL)** — paper or electronic; the legal cargo
  manifest, not a "shipment summary".

## Operational Constraints

- **Driving-while-using is prohibited.** No typing flow on the
  critical path while in motion; voice or large single-tap only.
  Anything else risks the licence and the company.
- **HOS is hard law.** A UI that lets the driver accept a stop
  that would breach the remaining break-window is rejected — the
  system warns first, dispatcher reroutes.
- **Dead zones are routine.** Tunnels, basements, rural roads;
  every write queues, every read works from cache, and POD
  uploads sync with photo intact when signal returns.
- **One-handed operation.** Other hand on the wheel, paperwork,
  or pallet jack; bottom-thumb-reachable primary actions, no
  precision drag.
- **Cold / wet / glare.** Outdoor docks in winter; gloves on,
  screen wet, sun directly on the display — same outdoor-default
  high-contrast as the field-crew lens.

## Unique Questions

- Does the primary flow work hands-busy at a loading dock, with
  voice or one large tap, and not collapse if the connection
  drops mid-step?
- Does the POD step capture photo + signature + GPS + timestamp
  in a single offline-resilient action, or are they four separate
  forms that can each drop?
- Does the system block or warn before the driver accepts a stop
  that would breach the remaining HOS break-window?
- Is dock-dwell time captured automatically from arrival to
  loaded, or does it rely on the driver remembering to tap?

## Ticket Red Flags

- "Driver enters …" with text input on the in-motion path.
- POD described as a single field rather than a four-element
  bundle (photo + signature + GPS + timestamp).
- HOS treated as informational ("show remaining hours") rather
  than a constraint on what stops can be accepted.
- Sync described as online-only; no queue + retry sketched for
  dead-zone delivery.
- Dock-dwell capture left to manual tap with no arrival-trigger
  fallback.

## Anti-Patterns

- **Review-only, never operational.** No driving advice, no HOS
  legal interpretation, no vehicle-maintenance procedure, no
  hazmat-handling guidance. Those need certified humans.
- **No generic prose.** "Consider mobile usability" fails the
  Anti-Generic Quality Bar — every observation cites HOS, POD,
  dock-dwell, dead-zone, or hands-busy.
- **No in-motion typing on the critical path.** A flow needing
  the driver to type while driving is rejected outright.
- **No partial POD acceptance.** Missing any element of the
  four-tuple = unbilled; the flow must hold the action open
  until all four are captured or explicitly waived by dispatch.
