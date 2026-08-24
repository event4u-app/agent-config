---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-24
relates: []
# relates: `agent-config roadmap:context --roadmap linkedin-channel-semantics
# --relates` was run at HEAD b15b63d38 -- scanned 753 roadmap files, 326 remote
# branches, 0 PRs; `sibling roadmaps on the same topic: (none)`. Empty is the
# probe's answer, not an unrun probe.
estate_growth_exempt: "Measured +0 at landing (draft; the open blocker is likewise uncounted while draft). Pre-declared for the flip to ready, which charges +1 active_roadmaps and +1 open_blockers -- the latter has allowance none, so it needs this claim. The blocker is pre-existing: two council rejections this roadmap names for the first time rather than obligations it creates. Both defects were re-derived at HEAD b15b63d38 and neither is covered by any of the twelve active roadmaps, all of which are infrastructure or governance. Four of the source artifact's five anchors were dropped as refuted or already-shipped."
---
# Road to channel contract and profile drift — two defects that survived a LinkedIn ask

> **Source:** `agents/tmp.old/linkedin.txt` (2026-08-24). The artifact proposed a
> five-command LinkedIn cluster on five named defects. Four did not survive
> re-derivation at HEAD `b15b63d38` and are recorded in § Dropped. Two did, and
> neither is about LinkedIn — which is why this roadmap is not the one that was
> asked for.

## Goal

The drafting-channel contract is machine-readable and inside its stability
window, and `brand-audit` either covers personal-profile surfaces or records
that it deliberately does not. Finished means: the channel enum has a schema a
validator reads, `write-engine.md` carries a stability state that is true today,
the three drafting surfaces that accept `--channel` agree with it, and the
profile-surface gap in `brand-audit` has a verdict.

## Context — measured 2026-08-24 at HEAD `b15b63d38`

| # | Defect | Evidence |
|---|---|---|
| **D1** | **The drafting-channel contract is out of its own stability window.** `docs/contracts/write-engine.md` frontmatter reads `stability: beta` / `keep-beta-until: 2026-08-13` — expired eleven days ago. Three shipped commands dereference it. | `sed -n '1,4p' docs/contracts/write-engine.md` |
| **D2** | **The channel enum is prose, not data.** `write-engine.md:61-62` fixes `Enum: linkedin-post \| tweet \| blog \| freeform`, `:71-77` gives per-channel word counts and cadence rules. No schema, no validator, no lint — so a fourth command could advertise `--channel` and honour none of it, and nothing would object. Note the enum value is `linkedin-post`, not `linkedin`. | the contract lines; no `channel` entry under `src/scripts/schemas/` for the write engine |
| **D3** | **The blast radius is three surfaces, not one.** `--channel` is advertised by `src/domains/gtm-marketing/post-as/me/command.md:10`, `post-as/ghostwriter/command.md:10` and `ghostwriter/write/command.md:9`. Per [`minimal-safe-diff`](../../src/rules/minimal-safe-diff.md) the repair site is the shared contract, not the three call sites. | `grep -rl -- '--channel' src/domains/gtm-marketing/` |
| **D4** | **`brand-audit` has no personal-profile surface.** `SKILL.md:30` enumerates touchpoints as *"web, decks, docs, ads, copy"* and step 2 as *"site, app, decks, marketing, docs"*. A person's public profile — headline, About, Experience, Featured — is a brand touchpoint that drifts from the same tokens and voice profile, and the skill's three drift buckets would apply to it unchanged. It is absent from both lists. | `src/skills/brand-audit/SKILL.md:25-42` |
| **D5** | **A second, schema-backed channel registry already exists.** `src/config/reach-channels.yml` with `src/scripts/schemas/reach-channels.schema.json` (github, youtube, rss, hackernews, reddit, twitter). Any new channel data file must either extend this or state why it is a separate concern — the source artifact proposed `src/agent-src/channels/linkedin.yaml` without noticing it. | both files exist | <!-- ref-ignore --> <!-- a path the source artifact proposed; it does not exist and this roadmap argues against creating it -->

## Dropped — four of the source's five anchors

Recorded rather than deleted, because two of them would have produced work that
made the tree worse:

| Source claim | Verdict |
|---|---|
| *"`/post-as:me` advertises `--channel`, but no channel definition exists; the flag degrades to a free-text hint"* | **never-true, and it was the artifact's load-bearing claim.** The definition is at `write-engine.md:61-77`, and `post-as/me/command.md:75,77` links to it explicitly. The real weakness is narrower and is D1/D2 above. A Phase 1 built on the original reading would have added a channel model beside one that already exists. |
| *"`humanizer`'s eval triggers name LinkedIn — the skill over-promises; prune them"* | **inverted.** `src/skills/humanizer/evals/triggers.json:13` is a **negative** fixture — `"trigger": false`, with the note that a LinkedIn post routes to `/ghostwriter:write` because humanizer runs inside its step 4b. Pruning it would delete a correct negative-routing test. |
| *"make the humanizer a mandatory post-pass"* | **already shipped.** `write-engine.md` § 4b runs it inside the write path, with `--raw` to opt out. |
| *"`content_creator` is cited in `getting-started-by-role.md`"* | **partially true.** The profile and the README row exist; that document keys its section on the human word *"Creator"* and never contains the string `content_creator`. Too thin to plan against. |

The artifact also contained a second, larger roadmap proposing a
`professional-presence` domain. It is dropped whole: its actual text is not in
the file (the download link is a dead sandbox path — what is present is its
narration of itself), it names eight external repositories including one that
this repository's own denylist already blocks, and it proposes a root domain
duplicating the shipped GTM wing without checking whether that wing exists. Two
of its ideas are portable and are folded into Phase 2 below rather than carried
as estate: expiring platform-evidence with a source tier and a review date, and
a zero-fabrication floor on published metrics.

## Blockers

### blocker: linkedin-profile-ingest-council-reject

- **Status:** open
- **Owner:** maintainer
- **Blocks:** any step that ingests a profile — Phase 2 only if it grows an
  ingest path; Phase 1 is unaffected.
- **What it is:** `agents/roadmaps/archive/step-3-agent-user-persona.md`
  records **two** unanimous council rejections in this area, not one. `:15`
  and `:53` cancel `/agents user linkedin` — *"host-agent-fetch model delegates
  network without solving determinism, privacy-field-floor, or test-surface"* —
  with the re-open condition stated verbatim: *"Re-evaluate only after a written
  host-agent fetch contract and a 'what counts as a public profile field'
  privacy floor exist."* `:108` separately lists *"Package-level HTTP calls to
  LinkedIn / Facebook / Instagram / Reddit / TikTok / Slack"* under **"Rejected
  directions (do not re-open without new evidence)"**.
- **Recommendation:** take Phase 2's out-of-scope branch unless the maintainer
  wants the profile surface. It is one sentence in `brand-audit`, it clears the
  lock by not touching the mechanism at all, and it leaves the gap recorded for
  whoever meets it next. The in-scope branch is defensible but needs the
  mechanism-mismatch argument written down first.
- **If you do nothing:** Phase 1 ships unaffected and Phase 2 stalls with two
  steps that cannot be started. The gap stays undocumented, so the next reader
  re-derives it from scratch — which is exactly what happened this time, since
  the source artifact rediscovered a `brand-audit` gap without finding either
  council rejection.
- **What to do:** mechanism-match first, per
  [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md). Both
  rejections are about **network fetch**. A paste-or-file input path performs no
  fetch and is plausibly a different mechanism — but that argument has to be
  made and recorded, not assumed, and the privacy-floor half of the first
  condition (*what counts as a public profile field*) is about handling the data
  and applies whatever way it arrives. Neither condition is met today.
- **Resolved when:** either the mechanism-mismatch argument is recorded against
  both rejections and the privacy floor exists, or no step in this roadmap
  ingests a profile.

## Phase 1 — the channel contract

- [ ] **1.1 Give `write-engine.md` a stability state that is true today.**
      Promote out of beta, extend the window with a reason, or record it as
      expired-and-unmaintained. All three are real answers; the current state —
      a lapsed date nobody noticed while three commands depend on the file — is
      not one of them.
      verify: `keep-beta-until` is in the future or absent, and if absent
      `stability` is not `beta`.

- [ ] **1.2 Extract the channel enum and the per-channel defaults into a validated data file.**
      Extend `src/config/reach-channels.yml` and its schema, or create a sibling
      with a one-line reason why drafting channels and reach channels are
      separate concerns. D5 makes the collision a decision, not an oversight.
      verify: the four enum values and the four length defaults are read from
      the data file by a test, and a fifth value invented in a fixture fails the
      schema.

- [ ] **1.3 Bind the three drafting surfaces to the data file.**
      verify: `grep -rl -- '--channel' src/domains/gtm-marketing/` returns the
      same three files, and a test asserts each accepts exactly the schema's
      values — `linkedin-post`, never `linkedin`.

## Phase 2 — the profile-surface gap

- [ ] **2.1 Decide whether personal-profile surfaces are in `brand-audit`'s scope.**
      In scope means one touchpoint row in the two enumerations and nothing
      else — the three drift buckets, the visibility × frequency ranking and the
      completeness check all apply unchanged. Out of scope means the skill says
      so, so the next reader does not re-derive the gap.
      verify: `src/skills/brand-audit/SKILL.md` either lists the surface in both
      enumerations, or carries one sentence naming it as deliberately excluded.

- [ ] **2.2 If in scope, state the input path and honour the blocker.**
      Paste or a user-supplied file. No fetch, no scrape, no host-delegated
      network — those are the rejected mechanism, and the blocker above governs.
      verify: the skill names its input path, and `grep -rniE 'fetch|scrape|http'`
      over the changed lines returns nothing.

- [ ] **2.3 Carry the two portable ideas from the dropped roadmap, as constraints rather than machinery.**
      Any platform-specific guidance carries a source tier and a review date, and
      no engagement metric is stated as fact. Both are one sentence each in the
      skill; neither is a registry.
      verify: the added guidance carries a date and a tier, and a grep for
      unsourced numeric claims over the changed lines returns nothing.

## Phase 3 — the eval over-promise

- [ ] **3.1 Reconcile `brand-asset-generation`'s LinkedIn eval trigger with its skill body.**
      `src/skills/brand-asset-generation/evals/triggers.json:6` has *"Make a
      LinkedIn cover image using our brand typography and voice"* in
      `should_trigger`, while `SKILL.md` never mentions LinkedIn. Either the body
      names the surface class or the fixture generalises to one the body claims.
      Deliberately not a prune: the fixture may be correct and the body thin.
      verify: the trigger phrase's subject appears in `SKILL.md`, or the fixture
      is reworded to a class the body already covers, and the eval still passes.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 2 grows a profile-ingest path and walks into the council rejection | product | The natural next step after "audit a profile" is "fetch the profile", which is exactly the mechanism two unanimous rejections cover. | The blocker is filed with both rejections and both re-open conditions quoted; 2.2 fixes the input path to paste-or-file and verifies it with a grep over the changed lines; 2.1 admits "out of scope" as a complete answer. | Phase 2 — the profile-surface gap |
| 2 | A second channel registry lands beside the existing one | implementation | `reach-channels.yml` is already schema-backed; a `drafting-channels` file created without deciding the relation produces two truths for one word. | 1.2 requires either extension or a written reason, and D5 records the collision in the context so the decision cannot be skipped silently. | Phase 1 — the channel contract |
| 3 | Promoting the contract out of beta ratifies an interface nobody reviewed | product | 1.1's cheapest branch is "promote", and promotion turns a beta contract into a stable one by default rather than by review. | 1.1 lists three equally acceptable outcomes including "record it expired", so promotion has to be chosen against the alternatives rather than fallen into. | Phase 1 — the channel contract |
| 4 | The roadmap is read as the LinkedIn cluster that was asked for | product | The source requested a five-command cluster; this file builds none of it, and a later reader may treat it as a first phase of that. | § Dropped states which four anchors died and why; the title and Goal name the two surviving defects and no cluster; no step creates a command. | Phase 1 — the channel contract |

## Acceptance Criteria

- [ ] **AC-1** — `write-engine.md` carries a stability state that is true on the day it is read, with no lapsed date.
- [ ] **AC-2** — the channel enum and per-channel defaults are read from a schema-validated file by a test, and an invented fifth value fails that schema.
- [ ] **AC-3** — all three `--channel` surfaces accept exactly the schema's values, proven by a test, with `linkedin-post` as the value and `linkedin` rejected.
- [ ] **AC-4** — the relation between drafting channels and `reach-channels.yml` is recorded, whichever way it went.
- [ ] **AC-5** — `brand-audit` either lists personal-profile surfaces as a touchpoint or names them as deliberately excluded; no third state.
- [ ] **AC-6** — no step in this roadmap introduced a fetch, a scrape or a host-delegated network call, and the blocker is either resolved or still open with nothing depending on it.
- [ ] **AC-7** — `brand-asset-generation`'s LinkedIn trigger and its skill body agree, and the eval passes.
