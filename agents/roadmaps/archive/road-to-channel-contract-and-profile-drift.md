---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-24
relates: []
# relates: `agent-config roadmap:context --roadmap linkedin-channel-semantics
# --relates` was run at HEAD b15b63d38 -- scanned 753 roadmap files, 326 remote
# branches, 0 PRs; `sibling roadmaps on the same topic: (none)`. Empty is the
# probe's answer, not an unrun probe.
estate_growth_exempt: "Charges +0 on the COUNT half (status-scoped; the open blocker is likewise uncounted while draft) and +1 on one-in-one-out, which is file-based. On the flip to ready it additionally charges +1 open_blockers, whose allowance is none, so this claim carries that too. The blocker is pre-existing: two council rejections this roadmap names for the first time rather than obligations it creates. Both defects were re-derived at HEAD b15b63d38 and neither is covered by any of the twelve active roadmaps. Four of the source artifact five anchors were dropped as refuted or already-shipped."
estate_offset_exempt: "No archive move is available in this change. Net direction is favourable: a five-command cluster proposal and a second whole roadmap were both dropped, leaving one lightweight file carrying the two anchors that survived re-derivation."
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

- **Status:** resolved 2026-08-25 — **via the second branch: no step in this
  roadmap ingests a profile.** AI council 2/2 (inlined convergence:
  `anthropic/claude-sonnet-4-5` + `openai/codex-default`, 3 rounds, blind
  chairman, quorum concluded 2/2, $0.045 actual) under the maintainer's standing
  delegation for the autonomous drain run.

  **Neither prior rejection was lifted, reopened, or re-argued**, and that is the
  point of taking this branch: the resolution condition offers *"or no step in
  this roadmap ingests a profile"*, and 2.1's out-of-scope decision satisfies it
  without touching the rejected mechanism at all.

  **The mechanism-match argument the blocker asked for was made, and it came out
  insufficient rather than favourable.** Both seats granted that a paste-or-file
  input performs no fetch and is therefore genuinely a different mechanism from
  the two network rejections. What they refused is the inference that a different
  mechanism clears the lock, because the reopen condition has a second half — *"a
  'what counts as a public profile field' privacy floor"* — which governs
  **handling**, not acquisition, and so applies however the data arrives. That
  half does not exist. Recording the argument as *made and rejected* is what the
  blocker's own `What to do` demanded (*"that argument has to be made and
  recorded, not assumed"*).

  **Revisit-if:** a written, testable field-level privacy floor exists
  distinguishing brand-surface profile fields from PII-adjacent ones — then
  user-supplied inputs may be included; fetched inputs need that floor **and** a
  host-agent fetch contract, i.e. both halves of the original condition.
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

- [x] **1.1 Give `write-engine.md` a stability state that is true today.**
      Promote out of beta, extend the window with a reason, or record it as
      expired-and-unmaintained. All three are real answers; the current state —
      a lapsed date nobody noticed while three commands depend on the file — is
      not one of them.
      verify: `keep-beta-until` is in the future or absent, and if absent
      `stability` is not `beta`.

      **DONE 2026-08-25 — `stability: beta` kept, `keep-beta-until` extended to
      `2026-09-24`.** AI council 2/2 under the maintainer's standing delegation.
      Both seats ruled out the other two branches on evidence rather than taste:
      **promotion** has no review to rest on, and **expired-and-unmaintained**
      contradicts six live consumers (the roadmap said three — it counted
      commands; the sixth is `src/skills/humanizer/SKILL.md`).

      **The date is 2026-09-24, not 2026-09-25.** One seat proposed a 30-day
      window and wrote the wrong date; the other did the arithmetic. 2026-08-25
      + 30 days = 2026-09-24, and it sits inside the gate's own
      `today + 90` ceiling (2026-11-23).

      **Recorded as an administrative holding period, NOT approval**, and the
      contract's own status note says so at length, because a fresher number
      reads as a review that did not happen. The window ends in one of three
      states — promoted, continued with cited evidence, or superseded with the
      six consumers migrated. **Another unevidenced extension is not an
      acceptable outcome**; both seats named this run granting itself an
      extension as the risk, and the short window plus that named end-condition
      is the agreed protection.

      **This file is one of 86, and that is tracked elsewhere rather than
      duplicated here.** Measured across `docs/contracts/` on 2026-08-25: 86 of
      121 `stability: beta` contracts carry a lapsed `keep-beta-until`, 35 carry
      a future one, none lack the marker — and
      `src/scripts/check_beta_review_markers.ts:144-158` compares the date only
      against `today + 90` and errors when it is too far in the **future**, so a
      past date passes and the gate prints
      `✅ All beta contracts carry a valid review marker`. Reported as a count
      per [`downstream-changes`](../../src/rules/downstream-changes.md)
      § Defect-pattern search.

      **`agents/roadmaps/archive/road-to-contract-review-deadlines.md` already owns the
      population and the gate defect** — its D1 is the same 86, its D3 the same
      inverted comparison, and its **D6 names this very file** as one of two
      already-filed one-off instances. So no new follow-up roadmap was created,
      which is the one place this change departs from a seat's literal
      instruction: one seat asked for a new roadmap named
      `review-lapsed-beta-contracts` to be authored. It would have duplicated
      an existing active roadmap. (Named without a path on purpose — the file
      does not exist, and writing a resolvable path to a file this change
      deliberately did not create is what `check_references` caught on the
      first run of this gate battery.) The other seat's sequencing
      argument is adopted instead, and it matches that roadmap's own Phase 0
      title (*disposition before enforcement*): landing the floor check now,
      while 85 other files violate it, *"merely exchanges a false-green gate for
      an immediately unusable red one"*.

- [x] **1.2 Extract the channel enum and the per-channel defaults into a validated data file.**
      Extend `src/config/reach-channels.yml` and its schema, or create a sibling
      with a one-line reason why drafting channels and reach channels are
      separate concerns. D5 makes the collision a decision, not an oversight.
      verify: the four enum values and the four length defaults are read from
      the data file by a test, and a fifth value invented in a fixture fails the
      schema.

      **DONE 2026-08-25 — a SIBLING, `src/config/drafting-channels.yml`, not an
      extension of `reach-channels.yml`.** The step allows either with a stated
      reason; the reason is taken from the other file's own header rather than
      from preference. `reach-channels.yml` says of itself: *"Not a routing
      table, not a recommendation, not an agent-facing surface"*, and records
      that its Phase-0 benchmark returned `band: stop` so **no** channel in it is
      routed or agent-facing. A drafting channel is an output shape for prose
      (length, cadence, hashtag permission); a reach channel is an external
      retrieval backend with an install string, a health probe and a lifecycle.
      They share the word and no field. Merging them would produce one schema
      whose every field is optional for half its rows — this roadmap's Risk
      Register row 2 exactly.

      Shipped: the data file, `src/scripts/schemas/drafting-channels.schema.json`
      (Draft-07 subset only — no `$ref`, no `patternProperties`, because
      `validate_frontmatter.ts` supports none of them and a schema using them
      would silently not be checked), two negative fixtures, and
      `tests/scripts/drafting_channels_schema.test.ts` — **16 tests, all
      passing.**

      **Four load-bearing assertions were sabotage-proved rather than assumed
      sensitive**, since a test never seen red has unknown sensitivity:
      widening the schema enum to admit `mastodon-post` → 1 failed; widening it
      to admit `linkedin` → 1 failed; changing `linkedin-post`'s
      `length_default` to 190 in the registry only → the contract-agreement test
      failed, naming the disagreement; adding `mastodon-post` to a command
      surface's `--channel=<…>` list → the surface test failed. Restored → 16
      passed.

      **The registry is tested against `write-engine.md`, not merely against
      itself.** That third layer is the one that earns its keep: the contract is
      the human-facing statement of the same four values and four defaults, and
      a data file that silently disagreed with it would be worse than none.

- [x] **1.3 Bind the three drafting surfaces to the data file.**
      verify: `grep -rl -- '--channel' src/domains/gtm-marketing/` returns the
      same three files, and a test asserts each accepts exactly the schema's
      values — `linkedin-post`, never `linkedin`.

      **DONE 2026-08-25.** The grep returns the same three files and a test
      pins that list, so a fourth surface appearing is a visible failure rather
      than a silent gap: `ghostwriter/write/command.md`, `post-as/me/command.md`,
      `post-as/ghostwriter/command.md`.

      **What "bind" means for a markdown command surface, stated because it is
      not a code import.** These files are agent-facing prose with no runtime to
      inject values into, so the binding is two-sided: each of the two files
      carrying the enumeration now points at
      `src/config/drafting-channels.yml` as the source of truth and says to edit
      it and `write-engine.md` together, and the test makes any divergence fail.
      The third file carries only examples and no enumeration, so the
      subset assertion passes over an empty set there — recorded rather than
      left to look like coverage it is not.

      The short form is pinned separately from an invented platform, per the
      step's own wording: `--channel=linkedin` is asserted absent from every
      surface, because it is the plausible typo rather than a plausible
      platform.

## Phase 2 — the profile-surface gap

- [x] **2.1 Decide whether personal-profile surfaces are in `brand-audit`'s scope.**
      In scope means one touchpoint row in the two enumerations and nothing
      else — the three drift buckets, the visibility × frequency ranking and the
      completeness check all apply unchanged. Out of scope means the skill says
      so, so the next reader does not re-derive the gap.
      verify: `src/skills/brand-audit/SKILL.md` either lists the surface in both
      enumerations, or carries one sentence naming it as deliberately excluded.

      **DONE 2026-08-25 — OUT OF SCOPE.** AI council 2/2 under the maintainer's
      standing delegation. One sentence, in the skill, as the step requires.

      **The mechanism-match argument was made and it is NOT sufficient.** A
      pasted or user-supplied file genuinely is a different mechanism from the
      rejected network fetch, so the two prior rejections do not directly
      prohibit it — both seats granted that. What they refused is the conclusion:
      the reopen condition has a **second** half, *"a 'what counts as a public
      profile field' privacy floor"*, and that half is about **handling**, not
      retrieval. It therefore applies however the data arrives, and it does not
      exist.

      **The missing artefact is specifically a field-level classification**, and
      naming it that way is what makes this decidable later. A profile's About
      text carries brand messaging and employment history in one field; an X bio
      carries voice and location; a GitHub org profile carries a description and
      contributor names. Without a written split between brand-surface and
      PII-adjacent fields, the skill cannot distinguish them and **no test can
      assert that it did** — which is the operational reason this is a floor
      rather than a style preference.

      **One seat's longer draft was not used.** It proposed a full paragraph
      distinguishing company from personal profiles; the other seat objected
      that the step asks for one sentence and that separating company from
      personal is precisely the judgement the missing taxonomy would supply. The
      shorter sentence covers both and is the one that shipped.

      This takes the blocker's **second** resolution branch — *no step in this
      roadmap ingests a profile* — so the blocker is resolved without lifting,
      reopening, or re-arguing either prior rejection.

- [-] **2.2 If in scope, state the input path and honour the blocker.**
      Paste or a user-supplied file. No fetch, no scrape, no host-delegated
      network — those are the rejected mechanism, and the blocker above governs.
      verify: the skill names its input path, and `grep -rniE 'fetch|scrape|http'`
      over the changed lines returns nothing.

      **NOT APPLICABLE 2026-08-25 — the step is conditional and its condition is
      false.** 2.1 decided out-of-scope, so there is no input path to state.
      Marked `[-]` rather than `[x]`: nothing was built, and checking it would
      claim otherwise.

      **The grep is reported anyway, with its honest reading.** Over the changed
      lines in `brand-audit/SKILL.md` it returns four hits — `fetched`,
      `fetch`, `fetched`, `fetch contract` — every one inside the exclusion
      prose, which says the surface is excluded *"regardless of whether their
      content is fetched, pasted, or supplied as a file"* and names the
      host-agent fetch contract as a future precondition. The clause exists to
      catch an ingest path; describing an exclusion is the opposite of one. Said
      out loud because a future reader running the grep will see the hits and
      deserves the reason rather than a silent pass.

- [x] **2.3 Carry the two portable ideas from the dropped roadmap, as constraints rather than machinery.**
      Any platform-specific guidance carries a source tier and a review date, and
      no engagement metric is stated as fact. Both are one sentence each in the
      skill; neither is a registry.
      verify: the added guidance carries a date and a tier, and a grep for
      unsourced numeric claims over the changed lines returns nothing.

      **DONE 2026-08-25.** Both constraints ship as one section in
      `src/skills/brand-audit/SKILL.md` — *"Two constraints on platform-specific
      guidance"* — and both are constraints on what the skill may assert, not a
      registry, exactly as the step demands.

      The tier vocabulary is named (`platform-doc` / `observed` / `inferred`)
      rather than left implicit, and the section states the alternative to
      tiering: take the number from the platform's own current spec at audit
      time instead of writing it down. **A grep for numeric claims over the
      changed lines returns nothing** — the constraints deliberately state no
      ratio, no character limit and no engagement figure, because writing one
      down would be the very defect they forbid.

      The same discipline was applied where a number would actually have been
      tempting: `brand-asset-generation`'s new platform-cover text (3.1) says to
      take the required dimensions from the platform's own current spec at
      generation time and to ask rather than guess, and states no aspect ratio.

## Phase 3 — the eval over-promise

- [x] **3.1 Reconcile `brand-asset-generation`'s LinkedIn eval trigger with its skill body.**
      `src/skills/brand-asset-generation/evals/triggers.json:6` has *"Make a
      LinkedIn cover image using our brand typography and voice"* in
      `should_trigger`, while `SKILL.md` never mentions LinkedIn. Either the body
      names the surface class or the fixture generalises to one the body claims.
      Deliberately not a prune: the fixture may be correct and the body thin.
      verify: the trigger phrase's subject appears in `SKILL.md`, or the fixture
      is reworded to a class the body already covers, and the eval still passes.

      **DONE 2026-08-25 — the BODY names the surface class; the fixture is
      untouched.** The step said explicitly this is not a prune and that the
      fixture may be correct while the body is thin, and that is what the
      evidence showed: the body already claimed *"target channel (web, print,
      social platform)"* while its asset-type enumeration stopped at banner /
      social card / header image / CIP element. A platform cover is a real asset
      class it was silently not claiming.

      `SKILL.md` now names **platform profile or cover images (a LinkedIn cover,
      an X header, a YouTube channel art)** in § When to use and in Procedure
      step 1, so the trigger phrase's subject appears in the body.
      `check_trigger_evals` reports **90 trigger set(s) fresh + valid**.

      **The generalisation carries the one constraint that makes it safe.** A
      platform cover is a dimension constraint, not a new pipeline, and it is the
      case where guessing the number is the whole failure: a wrong aspect ratio
      is cropped by the platform, so the brand marks land outside the visible
      area and the asset is unusable rather than merely off-brand. The body
      therefore says to take the dimensions from the platform's own current spec
      at generation time — never from memory, never from a number written into
      the skill — and to ask if the spec cannot be established. That is 2.3's
      source-tier constraint applied at the point where it bites.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 2 grows a profile-ingest path and walks into the council rejection | product | The natural next step after "audit a profile" is "fetch the profile", which is exactly the mechanism two unanimous rejections cover. | The blocker is filed with both rejections and both re-open conditions quoted; 2.2 fixes the input path to paste-or-file and verifies it with a grep over the changed lines; 2.1 admits "out of scope" as a complete answer. | Phase 2 — the profile-surface gap |
| 2 | A second channel registry lands beside the existing one | implementation | `reach-channels.yml` is already schema-backed; a `drafting-channels` file created without deciding the relation produces two truths for one word. | 1.2 requires either extension or a written reason, and D5 records the collision in the context so the decision cannot be skipped silently. | Phase 1 — the channel contract |
| 3 | Promoting the contract out of beta ratifies an interface nobody reviewed | product | 1.1's cheapest branch is "promote", and promotion turns a beta contract into a stable one by default rather than by review. | 1.1 lists three equally acceptable outcomes including "record it expired", so promotion has to be chosen against the alternatives rather than fallen into. | Phase 1 — the channel contract |
| 4 | The roadmap is read as the LinkedIn cluster that was asked for | product | The source requested a five-command cluster; this file builds none of it, and a later reader may treat it as a first phase of that. | § Dropped states which four anchors died and why; the title and Goal name the two surviving defects and no cluster; no step creates a command. | Phase 1 — the channel contract |

## Acceptance Criteria

- [x] **AC-1** — `write-engine.md` carries a stability state that is true on the day it is read, with no lapsed date.
      **Met.** `stability: beta`, `keep-beta-until: 2026-09-24` — in the future
      as of 2026-08-25 and inside the gate's `today + 90` ceiling. The state is
      *true* rather than merely non-lapsed: the file says in its own status note
      that this is an administrative holding period and not approval.
- [x] **AC-2** — the channel enum and per-channel defaults are read from a schema-validated file by a test, and an invented fifth value fails that schema.
      **Met** by `tests/scripts/drafting_channels_schema.test.ts` over
      `src/config/drafting-channels.yml` — 16 tests. The fifth-value case is
      `tests/fixtures/drafting-channels/fifth-channel.yml` and the assertion
      pins the JSON path AND the schema rule (`enum` at `$.channels[0].id`), not
      merely a non-zero finding count. Sabotage-proved: widening the schema enum
      to admit it turns the test red.
- [x] **AC-3** — all three `--channel` surfaces accept exactly the schema's values, proven by a test, with `linkedin-post` as the value and `linkedin` rejected.
      **Met.** The test pins the three-file list, asserts every
      `--channel=<…>` enumeration is exactly the registry's value set, and
      asserts `--channel=linkedin` appears in none of them. The short form has
      its own negative fixture as well, separately from the invented-platform
      one, because it is the plausible typo rather than a plausible platform.
      One honest note: the third surface carries examples and no enumeration, so
      the subset assertion there passes over an empty set — recorded so it is
      not mistaken for coverage.
- [x] **AC-4** — the relation between drafting channels and `reach-channels.yml` is recorded, whichever way it went.
      **Met — recorded as SEPARATE CONCERNS, in three places** so a future
      reader meets it wherever they arrive: the data file's header, the schema's
      `$comment`, and step 1.2 above. The reason is taken from
      `reach-channels.yml`'s own text (*"not a routing table, not a
      recommendation, not an agent-facing surface"*, plus its `band: stop`
      benchmark verdict) rather than from preference, and it names the concrete
      cost of merging: one schema whose every field is optional for half its
      rows.
- [x] **AC-5** — `brand-audit` either lists personal-profile surfaces as a touchpoint or names them as deliberately excluded; no third state.
      **Met — named as deliberately excluded**, in one sentence in Procedure
      step 2, with the missing artefact identified as a field-level privacy
      classification and a `revisit-if` stating what would include them. AI
      council 2/2. No third state: the skill does not leave the surface
      unmentioned.
- [x] **AC-6** — no step in this roadmap introduced a fetch, a scrape or a host-delegated network call, and the blocker is either resolved or still open with nothing depending on it.
      **Met on both halves, and measured rather than asserted.** Grepping the
      added lines of every changed `.ts` / `.yml` / `.json` file for
      `fetch(`, `axios`, `https?://`, `net.`, `XMLHttpRequest`, `WebSocket`,
      `spawnSync(.curl`, `execSync` returns exactly **two** hits, both in
      `drafting-channels.schema.json`: the `$schema` draft identifier and the
      `$id`. Neither is dereferenced by anything — the validator is the local
      Draft-07 subset in `validate_frontmatter.ts` — and both match
      `reach-channels.schema.json`'s existing convention verbatim. Stated
      instead of filtered out, because a grep with a silent exclusion list
      proves nothing.

      The blocker is **resolved** via its second branch, and nothing depends on
      it: 2.2, the only step that could have, is `[-]` because its condition is
      false.
- [x] **AC-7** — `brand-asset-generation`'s LinkedIn trigger and its skill body agree, and the eval passes.
      **Met.** The body names platform profile/cover images with a LinkedIn
      cover as the first example, so the trigger phrase's subject is in
      `SKILL.md`; the fixture was left untouched, which is the branch the step
      preferred. `check_trigger_evals` → **90 trigger set(s) fresh + valid**.
