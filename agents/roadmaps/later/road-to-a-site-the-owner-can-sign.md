---
complexity: lightweight
status: later
tree_pin: af5ab4dc22
review_by: 2027-01-31
estate_growth_exempt: "+1 later_roadmaps, round inbox-2026-11-g topic T2. Parked, not active: the WIP cap of 5 is already exceeded and the operator's execution request in that invocation covered the third-party/legal-page topic it shares a witness with; the witness slice ships in road-to-a-page-that-says-what-it-loads."
estate_offset_exempt: "Owner search at af5ab4dc22 (grep -rlF for src/missions/website, owner-promise, site_origin_probe, Faktensatz over agents/roadmaps/*.md, later, stubs) returned nothing; no existing roadmap owns an ordered website mission."
entry_condition:
  what: "road-to-a-page-that-says-what-it-loads archived (its rows are the mission's check phase)"
  when: "when an active roadmap closes and this is pulled"
  who: owner
---
# Road to a site the owner can sign

> **Source:** `agents/tmp.old/inbox-2026-11-g/` (topic T2 — transcript + two supplied plans).
> **Arrivals:** 1 — `inbox-2026-11-g` (2026-11-02).

## Goal

A user who says "build me a website" gets AC's existing blocks in a fixed,
inspectable order (brand → research → copy → direction → build → check → live
→ re-measure), every factual promise on the page traces to an owner input, and
the check phase runs a reviewer that did not build the page. No new skill and
no new verb: a mission in the existing container.

## Verified at the pin

| # | Reading | Evidence |
|---|---|---|
| D1 | No path orders the website blocks | `src/flows/`: 0 hits for website / landing page |
| D5 | Nothing separates an owner-supplied promise from an agent-filled one ("Antwort in 24 h", "kostenlos und unverbindlich") | `ai_tells_rules.ts` has no promise class |
| D6 | DE form defects (mixed du/Sie, `ae/oe/ue`, mixed quotes) unchecked | no row in `web-launch-readiness.json` |
| D10 | Contact-form backend has no honeypot, header-injection or origin-check rows; rate limiting appears only per account | `src/skills/form-handler/SKILL.md:70` |

## Phase 1 — Facts with provenance

- [ ] **1.1 Tell class "promise on the owner's behalf"** in `ai_tells_rules.ts`,
      DE and EN (response times, "free and non-binding", durations).
      verify: a fixture paragraph with three promises yields three tells; an
      owner-quoted line yields none.
- [ ] **1.2 Deterministic DE form check**: mixed address forms, transliterated
      umlauts, mixed quote styles in one page.
      verify: fixture with each defect flagged; a clean page silent.

## Phase 2 — Mission `website`

- [ ] **2.1 `src/missions/website/mission.yaml`** binding existing skills per
      phase; acceptance only on owner decisions (name, facts, direction, go-live).
      verify: the mission loader lists eight phases, each naming an existing skill.
- [ ] **2.2 Blind check package**: the check phase starts a fresh reviewer with
      the build output and the brief, not the build transcript.
      verify: the spawn brief carries no build-session turn.
- [ ] **2.3 Live steps** (deploy, DNS, a real test enquiry) only on this-turn
      owner confirmation.
      verify: the mission step is marked Hard-Floor.

## Phase 3 — Forms and re-measurement

- [ ] **3.1 Form floor rows** in `form-handler`: honeypot, header injection,
      origin check, per-source rate limit; contact forms default to a privacy
      notice, not a consent checkbox.
      verify: the skill names all four rows.
- [ ] **3.2 Scheduled re-measurement** with the frozen research query set after
      go-live.
      verify: the mission's last phase writes the query set and a due date.

## Decisions

| # | Question | Resolution |
|---|---|---|
| E1 | Does 2.3 deploy anything? | No. It builds the mission step and its Hard-Floor marker; every real deploy, DNS change or test enquiry stays a this-turn owner confirmation at run time, per `non-destructive-by-default`. Nothing to ask now. |

## Kill register

| # | Killed | Why |
|---|---|---|
| K1 | Copying the source repo's text or code | No licence file; ideas only. |
| K2 | Affiliate links in agent output | Recommendations name vendor URLs. |
| K3 | `llms.txt` / `FAQPage` as ranking promises | No measured effect. |
| K4 | Lighthouse score as a binary row | Gradient, excluded by the config. |
| K5 | New `build-*` / `create-*` verb | Forbidden prefixes. |

## Risk Register

| # | Risk | Mitigation |
|---|---|---|
| R1 | Mission becomes a parallel system | Every phase binds an existing skill; 2.1 verify enforces it. |
| R2 | Live step runs autonomously | Hard-Floor marker, 2.3. |

## Acceptance Criteria

- [ ] Promise tells and DE form check pass their fixtures.
- [ ] Mission lists eight phases over existing skills, blind reviewer, live steps gated.
