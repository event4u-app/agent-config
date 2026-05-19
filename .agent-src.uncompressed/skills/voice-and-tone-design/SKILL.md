---
name: voice-and-tone-design
description: "Use when shaping brand voice — voice attributes, tone-by-context matrix, consistency review. Triggers on 'define our voice', 'why does our copy sound different on every surface'."
status: active
tier: senior
source: package
domain: product
context_spine: [product, customer-segment]
recommended_for_user_types: [creator, consultant, gtm]
workspaces:
  - gtm
packs:
  - gtm-marketing
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: true
  removable: true
---

# voice-and-tone-design

## When to use

- A team is producing copy across multiple surfaces and the same segment hears three different brands per quarter — name the voice so the surfaces converge.
- An audience-by-message matrix exists but each audience cell currently reads in a different tone, breaking the recognition signal across the segment.
- A new senior persona (CMO, founder, head-of-content) is asking for a voice-and-tone artefact that downstream writers can defend against.

Do NOT use to copy-edit individual assets (out of scope — that is a
writer's job), draft the message stack (route to
`messaging-architecture`), or pick channel-specific tactics like
subject lines or ad creative formats (channel-agnostic skill).

## Cognition cluster

- **Mental model 13 — Occam's Razor.** The simplest voice the
  segment can recognise across surfaces is the voice that survives
  contact with three writers under deadline. A five-attribute voice
  that no one remembers is brand-theatre. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 13.
- **Mental model 15 — Signal vs. noise.** Voice is the
  identification signal embedded in copy — without distinctiveness
  it is noise that competes with every peer's noise. Cut to the
  three attributes that *only* the segment hears as us. See
  `mental-models.md` § 15.
- **Context-spine — product + customer-segment.** Read **product**
  for the proofs the voice must carry (a voice that promises what
  the product cannot back is fiction); read **customer-segment**
  for the listening-register the audience already lives in. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Inherit the positioning frame and audience matrix

Identify the locked positioning anchors from
[`positioning-strategy`](../positioning-strategy/SKILL.md) and the audience matrix
from [`messaging-architecture`](../messaging-architecture/SKILL.md).
Voice without positioning is style; voice without an audience matrix
is broadcast.

### Step 1: Analyze the inherited voice

Read 6–10 recent assets across the largest surface set the team
ships on. For each, note the *register* (formal · conversational ·
technical · playful) and one *line that sounds like us* (or *like
anyone*). The output is an honest audit: what voice is currently
shipping, not what the team intends to ship.

### Step 2: Pick three voice attributes — and three only

Three attributes, each phrased as *"\<we are\> X, not Y."* The
*not Y* is non-trivial: it names the credible adjacent voice the
team is choosing against, not a strawman. Examples of the shape
(not vocabulary):

- *"Precise, not pedantic."*
- *"Confident, not boastful."*
- *"Concrete, not buzzword."*

A four-attribute voice will collapse to three under deadline; pick
the three now.

### Step 3: Build the tone-by-context matrix

Tone modulates voice; voice is constant. For each context — error
copy, marketing surface, sales follow-up, onboarding, executive
summary, support reply — fill: *what the audience is feeling · what
the surface must do · which voice attribute leads · what tone
amplifier or muter applies.* The matrix is the tool writers
actually reach for; the three attributes are the spine they hang
the tone on.

### Step 4: Validate against the recognition signal

Validate the voice on three checks:

1. **Distinctiveness.** Write the same sentence in three credible
   peer voices. Verify the team's voice is recognisable as distinct
   on first read — not on the second read after explaining the
   attributes.
2. **Proof-coverage.** Confirm the voice does not promise what the
   product (from the spine) cannot back. *"Calm"* without an
   uptime story is fiction. Verify each attribute against a proof.
3. **Survives-deadline.** Hand the artefacts to a writer who was
   not in the room. If the writer cannot reproduce the voice on a
   30-minute draft, the voice is documented for the room, not the
   surface.

### Step 5: Run the consistency review

Re-audit the assets from Step 1 against the locked attributes and
tone matrix. Mark each line *consistent · slipping · contradiction.*
Slipping is a writer-coaching problem; contradiction is a re-write.
The review surfaces the load-bearing surfaces that need a re-pass,
not a punitive list.

### Step 6: Hand back

Hand the artefacts to writers across the surfaces, to
[`editorial-calendar`](../editorial-calendar/SKILL.md) for cadence
mapping, and to [`release-comms`](../release-comms/SKILL.md) for
launch-surface voice review.

## Related Skills

**WHEN to use this**

- The unit of work is the *voice* (three attributes + tone-by-context matrix), not a single line of copy.
- Surfaces are diverging in tone and the segment cannot recognise the brand across them.
- A team needs an artefact that a writer on deadline can actually use.

**WHEN NOT to use this**

- Drafting the message stack (primary message + proofs) — route to [`messaging-architecture`](../messaging-architecture/SKILL.md).
- Cadence and content-debt management — route to [`editorial-calendar`](../editorial-calendar/SKILL.md).
- Copy-editing individual assets — out of scope; that is a writer's craft.
- Launch-wave announcement copy — route to [`release-comms`](../release-comms/SKILL.md).

## When the agent should load this

- "Define our voice — three attributes, no more."
- "Mach uns einen Tone-by-Context matrix, der Schreibern auf Deadline hilft."
- "Why does our copy sound different on every surface?"
- "Run a voice consistency audit on last quarter's assets."
- "Pick the *not-Y* for each voice attribute."

## Output

1. **`voice-attributes.md`** — three attributes in the *"X, not Y"* shape, with the proof-from-spine that backs each.
2. **`tone-by-context.md`** — one row per surface context, with audience feeling, surface job, lead attribute, and tone amplifier / muter.
3. **`consistency-review.md`** — audit of 6–10 recent assets, each line marked consistent · slipping · contradiction, with re-pass list ranked by surface load.

## Gotcha

- A voice that pleases the room is usually below the noise floor — agreement is consensus, not distinctiveness.
- The *not-Y* is the work. *"Confident, not boastful"* is meaningful; *"confident, not weak"* is filler.
- Tone-by-context matrices over-amplify when the surface is high-stakes — a calm voice in error copy is the discipline, not the failure.

## Do NOT

- Do NOT exceed three attributes — the fourth collapses on the first deadline.
- Do NOT prescribe channel-specific tactics or copywriting rules; tactics live with the channel owner.
- Do NOT promise voice attributes the product cannot back — *"effortless"* without an integration story is fiction the support queue will pay for.

## Runnable example

Mid-market HR analytics tool, positioning locked (retention beats acquisition), audience matrix has HR director · CFO · IT-security:

- Voice attributes — *"Precise, not pedantic."* · *"Confident, not boastful."* · *"Concrete, not buzzword."*
- Tone-by-context — *Error copy:* audience scared, lead with *precise*, mute *confident*. *Marketing surface:* audience curious, lead with *concrete*, amplify *confident*. *Onboarding:* audience uncertain, lead with *precise*, amplify warmth modifier.
- Consistency review — 8 of 10 surveyed assets *consistent*; 1 *slipping* (CEO blog leans pedantic); 1 *contradiction* (homepage hero contradicts *not buzzword* with "synergistic"). Re-pass list: homepage hero (load-bearing surface, prioritised).
- Hand-off → writers across surfaces; `release-comms` voice-reviews the GA-wave announcement.
