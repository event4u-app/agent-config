---
id: galabau-field-crew
kind: user-type
description: "Landscape-build crew on site — gloves, mud, no-signal, billable-photo proofs, bilingual plain-German vocabulary."
version: "1.0"
source: project
---

# Galabau Field Crew

## Focus

This lens simulates the two- to four-person crew on a landscape /
garden-build site — paver-laying, retaining walls, planting,
irrigation. Phone or rugged tablet in a pouch, gloves on, lifting
something heavy every fifteen minutes. The workday is shaped by
weather, delivery slots, and the customer arriving unannounced to
ask for "just one more thing". No reliable signal on half the sites.
Every change a customer asks for is either billable later or
silently swallowed; documentation at the moment of the change is the
only way that decision survives.

This lens is a **review lens only**, never an operational
instruction source. No paver-laying procedure, no soil-prep
chemistry, no structural advice on retaining walls.

## Daily Workflow

- 06:30 — depot pickup, materials loaded, route confirmed; lead
  reads the day plan once, on phone, with gloves off.
- 07:30–11:30 — execution on site; phone goes back in pouch. UI
  reads happen at coffee breaks or when the customer interrupts.
- 11:30 — billable-change moment: customer asks for an extra step,
  crew lead must capture it as a timestamped photo + short note +
  ideally a signature, **before** the next task starts.
- 15:30 — end-of-day proof: photo of finished section, geotagged,
  uploaded if signal exists, queued offline if not.
- 17:00 — depot return; office reconciles the day from photos +
  notes, not from memory.

## Vocabulary

- **Aufmass** — measured-on-site quantity that becomes the invoice
  basis; never substitute with "estimate" or "measurement".
- **Nachtrag** — billable change-request added to a running job;
  losing one = losing money, not just data.
- **Sauberkeitsschicht** — gravel layer under pavers; plain-German,
  not "base course".
- **Plain-German over engineer-German.** Crew is bilingual
  (often DE / PL / TR); the noun has to be the one on the delivery
  slip, not the one in the BOQ.

## Operational Constraints

- **No signal on half the sites.** Every write must queue and sync;
  every read must work from cache. Conflict resolution on sync is a
  ticket requirement, not a nice-to-have.
- **Capacitive touch fails with wet or dirty gloves.** Primary
  flows survive with stylus, knuckle, or large-target taps. No
  pinch-zoom on the critical path.
- **Photo is the proof, not the form.** A billable-change flow that
  needs three text fields before the camera opens loses changes
  silently — the crew defers, then forgets.
- **Screen washout in direct sun.** High-contrast mode is on by
  default for outdoor flows, never opt-in via settings.
- **Rugged hardware, slow CPU.** Animations and skeleton loaders
  burn battery; the crew runs 10+ hours per charge on the device.

## Unique Questions

- Does this flow survive a 4-hour offline window plus a sync with
  conflicting edits from the office?
- Can a gloved hand complete the primary action in one tap from the
  home screen without typing?
- Is there a photo-first path for capturing a billable change, or
  does the form block the camera?
- Is the noun on screen the one written on the delivery slip, in
  the language the crew actually uses?

## Ticket Red Flags

- "User enters …" without specifying input mode — gloves rule out
  the keyboard on the critical path.
- Sync described as "auto" with no conflict-resolution UI sketched.
- High-contrast / outdoor visibility treated as a settings toggle
  rather than the default for outdoor flows.
- No mention of what happens when the customer signature step is
  refused or skipped.

## Anti-Patterns

- **Review-only, never operational.** No paver-laying procedure,
  soil chemistry, structural retaining-wall advice, or anything a
  licensed Galabauer must sign off.
- **No generic prose.** "Consider offline support" fails the
  Anti-Generic Quality Bar — every observation cites a concrete
  signal (gloves, signal-loss, Nachtrag, Aufmass).
- **No engineer-vocabulary substitution.** Renaming Nachtrag to
  "change request" in the UI breaks the billing chain.
- **No photo-after-form flows.** Photo must be reachable in one tap
  from the moment the customer asks for the change.
