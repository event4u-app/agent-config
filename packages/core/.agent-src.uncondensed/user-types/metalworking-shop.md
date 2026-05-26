---
id: metalworking-shop
kind: user-type
description: "Shop-floor metalworking team — job travelers, material certs, machine-time gates, PPE/noise constraints on UI."
version: "1.0"
source: project
---

# Metalworking Shop

## Focus

This lens simulates a small-to-mid metalworking shop — laser-cut,
press-brake, weld, finish. Two surfaces: shop-floor tablets bolted
near the machines (loud, dirty, gloves) and an office desktop where
quoting, scheduling, and material-cert tracking happen. The shop
runs on **job travelers** (route cards) — one per job that follows
the work through every station, gets stamped, and ends in the
shipping bay. Material certificates (heat numbers, mill certs) must
trace from incoming bar stock through to the customer; losing the
chain breaks the audit and can void the order.

This lens is a **review lens only**, never an operational
instruction source. No welding-procedure spec, no electrical
guidance, no structural-engineering advice. Trade execution stays
with the certified welder, the EHS officer, and the engineer.

## Daily Workflow

- 06:00 — shift starts, lead reviews the day's travelers at the
  office desktop; priority shifts get printed and pinned at the
  station.
- 07:00–15:30 — execution per station; each station scans the
  traveler QR or punches the job number on the tablet to start /
  pause / complete time on that step.
- Material check-in — incoming bar stock is photographed with the
  mill cert; heat number bound to the lot at the moment of
  receipt, not later from memory.
- Safety sign-off — process steps requiring PPE or a second-person
  check (overhead crane, confined-space weld) cannot start until
  the sign-off is recorded on the tablet.
- 15:30 — end-of-shift, lead reconciles open travelers, flags any
  step where the material-cert chain is broken.

## Vocabulary

- **Job traveler / route card** — the single canonical record that
  moves with the part; never substitute with "ticket" or "task".
- **Heat number / mill cert** — material identity; lose the link
  and the part is unsellable to a regulated customer.
- **Sign-off** — recorded, named, timestamped; "approved" without
  a name fails audit.
- **Setup vs run time** — booked separately on the machine; merging
  them destroys costing accuracy.

## Operational Constraints

- **Shop-floor tablet bolted at the station.** Two-arm reach,
  gloves on, noise > 85 dB → no voice input, large tap targets,
  high contrast on by default.
- **PPE prevents fine touch.** Welding gloves + safety glasses;
  drop-down pickers with > 6 options are a fail mode.
- **Machine-time is money.** A flow that adds 30 seconds per
  job-step start, run 200 times/day, costs the shop one machine-
  hour per shift.
- **Material-cert chain is regulatory.** Every step that touches
  material must capture or carry the heat-number link; breaking it
  silently is the worst failure mode.
- **Two-surface split.** Office desktop has Excel-grade density;
  shop tablet has one-action-per-screen. The same flow cannot
  share a layout.

## Unique Questions

- Does this flow carry the heat-number / material-cert link from
  receipt to ship, with no manual re-entry step that can drop it?
- Can a gloved welder complete the station start / pause / end in
  one tap each, without picking from a long drop-down?
- Is the safety-sign-off step a hard prerequisite enforced by the
  system, or a soft reminder a tired operator can dismiss?
- Does the layout adapt between bolted-tablet (shop) and desktop
  (office), or is one surface compromised to match the other?

## Ticket Red Flags

- "User selects job from dropdown" — long list, gloves, no QR
  alternative.
- Material-cert mentioned only at receipt, not propagated through
  the route.
- Setup time and run time collapsed into a single "time on job"
  field.
- Safety sign-off treated as optional metadata rather than a gate.
- One layout described for both surfaces without saying which.

## Anti-Patterns

- **Review-only, never operational.** No welding procedure (WPS),
  no electrical work, no PPE selection guidance, no structural or
  fatigue-engineering advice — those require certified humans.
- **No generic prose.** "Consider shop-floor usability" fails the
  Anti-Generic Quality Bar — every observation cites traveler,
  heat number, sign-off, machine-time, or PPE.
- **No collapsing setup-and-run time.** Costing depends on the
  split; merging it for "UI simplicity" destroys the model.
- **No silent loss of material-cert link.** A flow that lets the
  chain break without an audit signal is rejected.
