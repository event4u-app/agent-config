# Design Fidelity — Mechanics

> Surgical-edit discipline, asset & imagery floor, and the failure-mode catalog for the `design-fidelity` rule

_Origin: migrated from `src/rules/design-fidelity.md` per the P4 pattern of `road-to-kernel-and-router.md`. The Iron Law, the `design.fidelity_mode` strictness table, and the fire/not-fire scope stay in the rule; this file carries the illustrative depth._

## Data-basis ladder

```
WHENEVER SOURCE IS REACHABLE, THE SOURCE IS THE DATA BASIS.
A SCREENSHOT IS VALIDATION, NEVER THE INPUT YOU BUILD FROM,
WHILE ANY HIGHER RUNG IS REACHABLE.
```

Four rungs, highest first. Take the highest one you can reach; a lower rung is
a fallback you name, not a preference you exercise.

| # | Rung | What it is | When it is the right rung |
|---|---|---|---|
| 1 | **Provided source files** | The artifact itself — an archive, an attached `design.html`, a token sidecar, a repo the user pointed at | Whenever the user handed something over. Read it *before* the first write. |
| 2 | **Source read through any channel** | The same code reached indirectly — a repository read, or DOM / stylesheets / scripts pulled through the user's own connected browser tools | The artifact is live rather than attached (a URL, a staging page, a preview build) |
| 3 | **Structured snapshot** | An accessibility tree or equivalent structured dump — text, roles, hierarchy, no pixels | Source is genuinely unreachable, but structure is not |
| 4 | **Screenshot** | Rendered pixels | Nothing above is reachable, **or** the thing being checked only exists once rendered |

**What rung 4 is legitimately for**, and this is not a grudging exception:
visual validation after building, layout collisions, contrast as actually
rendered, and content that only exists dynamically. The failure this ladder
names is not *using* a screenshot — it is using one **as the data basis while
rung 1 or 2 was sitting right there**, which is how a port ends up with the
right colours and none of the behaviour.

**The ladder governs where data comes from, never whether defects may be
fixed.** Reading the source and improving it is allowed and often correct;
reading the source is what makes an improvement a decision rather than a guess.

Two consequences worth stating because they are the ones agents get backwards:

- **A rendered HTML file is still a code artifact.** Opening it in a browser
  does not demote it to rung 4; the file is still rung 1. What the browser adds
  is validation, not input.
- **Degrading is honest, silence is not.** When you build from rung 3 or 4, say
  which rung you used and why the higher ones were unreachable. An unscoped
  "matches the design" over a screenshot-derived build is a verdict without
  evidence (`design-review` § verdict scoping).

Regression witness: `daf-source-over-screenshot`.

## URL / live-page handover — extraction into files, before the first UI write

```
A HANDOVER THAT ARRIVES AS A URL IS STILL RUNG 2, NOT RUNG 4.
EXTRACT THROUGH THE USER'S CONNECTED BROWSER TOOLS INTO FILES
BEFORE ANY UI WRITE. A SCREENSHOT TAKEN DURING EXTRACTION
CARRIES QA DUTY ONLY — IT IS NEVER THE THING YOU BUILD FROM.
```

A published artifact link, a builder's share link, a staging or `localhost`
page: rung 2 above is reachable, so rung 4 is not the fallback it looks like.
Extraction lands in the existing `design-system.json` contract under the
`.claude/design-system/` prefix the rule already routes on — no new artifact
shape — and the offline `/design-system:import` adapter consumes it. The package
ships the contract, the adapter and the instructions; it ships no crawler,
Playwright runtime or font-bundler.

Where the extraction goes, what consumes it, the retrieval order that keeps the
source alive across sessions, the producer sentence, and the honest coverage
gap: [`design-handover-extraction`](design-handover-extraction.md).

## Adopt the code — re-derivation is a deviation

Where the artifact's own markup, CSS, or JS is stack-compatible, **adapting that
code is the default**. Writing an equivalent from scratch is a **deviation** and
carries the same obligation as a swapped control: surface it, get confirmation,
do not just do it.

Stack translation is not re-derivation. Porting the artifact's structure into
Blade, JSX or a template language translates *that* structure — it does not
license a new one. If your output's element tree cannot be walked next to the
artifact's, you re-derived.

Why this needs saying at all: the visible half of a port (colours, type,
spacing) is what a reviewer checks, and it survives a from-scratch rewrite. The
half that does not survive is the behaviour — event handlers, keyframes, ARIA
wiring, focus order — and its absence is invisible in a screenshot comparison.
"HTML not adopted, worse markup written from scratch, missing JavaScript" is one
failure, not three.

### The scope line — where `code-provenance` ends and this begins

```
A USER-SUPPLIED DESIGN ARTIFACT IS THE USER'S OWN MATERIAL, NOT THIRD-PARTY
EXTERNAL CODE. ADOPTING IT IS NOT A BORROW.
THIRD-PARTY CODE THAT MERELY ARRIVES THROUGH A HANDOVER STAYS UNDER
`code-provenance` IN FULL.
```

Without this line the two rules contradict each other on the same act:
[`code-provenance`](../../src/rules/code-provenance.md) opens with `NEVER ADOPT
EXTERNAL CODE VERBATIM` and routes any conscious borrow through a licence check
plus a ledger entry, while the duty above says adapt the artifact's code.
Whichever the agent followed, it would be violating a rule, and no gate can
arbitrate between two Iron Laws.

The resolution weakens neither, and it is not new: it is the carve-out
[`content-quoting-floor`](../../src/rules/content-quoting-floor.md) already
makes for user-owned text — *"content the user wrote, pasted, or explicitly
authorized for verbatim use is not an external source"*. A design artifact the
user hands over is that same category, in markup.

**What stays under `code-provenance` in full**, so the carve-out cannot be read
as a hole:

- A vendored component, a licensed template, or a third-party library that
  happens to be *inside* the handover. Arriving through a design handover
  changes nothing about its licence.
- Code the artifact itself borrowed from somewhere identifiable.
- Anything you reach for *beyond* the artifact while implementing it.

The discriminator is authorship, not delivery: did the user hand you their own
material, or did they hand you a container with someone else's material in it?

Regression witness: `daf-rederive-is-deviation`.

## Surgical visual edits

A request to change one visual thing — a colour, a label, a single element — is
a **targeted edit**, not a redesign licence. Apply the same
`minimal-safe-diff` discipline to design work that backend edits have
always owed.

- **Change only the semantic target.** Preserve the surrounding layout,
  spacing, typography, dimensions, content, animation, and interaction states.
  Do not rewrite the component, reflow the section, or "modernise" neighbours
  while you are in there. (fixtures: `daf-edit-preservation`, `daf-unwanted-variations`.)
- **A broader redesign needs an explicit trigger.** Only phrases like *"new
  direction"*, *"from scratch"*, *"make it feel premium"*, *"rework the flow"*,
  or *"give me variations / options"* license a from-scratch rework. Absent such
  a phrase, a "fix / change / update the X" request is surgical — when unsure
  which, ask (`ask-when-uncertain`). (fixture: `daf-redesign-trigger`.)
- **Preserve stable anchors.** Where the host exposes DOM/comment metadata, keep
  comment anchors and screen labels intact so the edit stays locatable. Where
  the host has no such surface, preserve stable semantic anchors already present
  in source comments / `data-*` attributes — never strip them, and do not invent
  new ones.

## Asset & imagery discipline

Visual artifacts carry **real assets or honest placeholders — never fabricated
brand evidence**. The design-surface instance of the no-invented-facts floor.

- **Copy owned assets through the project's accepted path.** Reference or copy
  project-owned assets (logos, icons, fonts, images) via the target project's
  asset directory/pipeline — never hotlink a design-system's internal URL, never
  bulk-copy a huge source folder. (fixtures: `daf-missing-asset`, `daf-external-asset-url`.)
- **Third-party asset delivery is self-hosted by default — this section owns that
  decision.** An asset whose delivery path crosses a third party (a webfont from
  a font CDN, an icon set from a CDN, a hosted stylesheet) transmits the
  **visitor's IP address** to that third party on every page view. Deliver it
  through the target project's own route instead — the framework's font/asset
  primitive, a bundled package, or a locally-served file. A third-party hotlink
  is emitted **only** on an explicit consumer opt-in, and the opt-in is stated
  with what it transmits — never chosen silently because it is the shorter line.
  A discovery URL is not a delivery URL: keeping a font's browse/share link as
  *where to find it* is fine. Ownership: this bullet is the single owner of the
  third-party delivery decision ([`ADR-205`](../decisions/ADR-205-webfont-delivery-ownership.md));
  emitters (`typography-system`, UI-apply directives, brand-asset paths) are
  consumers and point here rather than restating it. (fixture:
  `daf-webfont-delivery`.)
- **Real imagery where inspection matters.** On visual pages/decks, use actual
  product / place / object / state imagery where the image IS the proof (a
  product screenshot, a real dashboard state). Decorative atmosphere is not proof
  — never pass a stock-like or invented image off as the real product. An
  invented product screenshot is fabricated evidence. (fixture: `daf-invented-screenshot`.)
- **Icons follow the iconography floor** — no emoji-as-icon in serious UI, no
  hand-rolled icon when a set exists; see the `iconography` skill § Iconography floor.
- **Ask before adding material — no unrequested filler.** Never generate copy,
  placeholder sections, or decorative blocks the user did not ask for to "complete"
  a design. Brief silent on a region → surface the gap (`ask-when-uncertain`)
  or leave an honest placeholder; never invent filler to fill space.

## Artefact maturity — the second axis

The Iron Law and both discriminator clauses stay in
[`design-fidelity`](../../src/rules/design-fidelity.md) § Two axes; this is the table.

| The artefact declares | The spec is | The spec is NOT |
|---|---|---|
| low fidelity — greyscale, box-and-line, placeholder copy | layout · element set · hierarchy · states shown | greys · placeholder text · borders · exact spacing |
| finished — colour, real copy, real assets | everything visible (the 1:1 floor, unchanged) | — |

Grounded in [`wireframe`](../../src/skills/wireframe/SKILL.md) § Gotchas. The near-miss
class is pinned in `ROUTING_MATRIX`, its rationale beside the assertions in
`design_fidelity_routing.test.ts`.

## Provided-artifact precedence

```
PROVIDED ARTIFACT  >  ANTI-SLOP  >  HOUSE TASTE
                   >  ANY GENERATIVE DESIGN-SYSTEM TOOLING, FIRST- OR THIRD-PARTY.
THE EXEMPTION COVERS ONLY DECISIONS THE ARTIFACT ACTUALLY COVERS.
IT NEVER COVERS GENERATIVE WORK IN THE SAME RUN.
```

The anti-slop catalog exists to stop an agent's *first impulse* from becoming
the design. A handed-over artifact is not a first impulse — it is a decision
the user already made. Applied to a port, the catalog inverts: it argues the
agent out of the spec it was told to reproduce.

Concretely, a faithful port of a cream/terracotta artifact trips
`slop-c5-cream-palette`, and the artifact's own copy trips
`slop-cp1-em-dash`. Both findings are **correct about the pattern and wrong
about the action**. On a port they are cited as *"matches provided spec"* and
nothing acts on them.

**Scope — three things this does NOT license:**

1. **Decisions the artifact does not cover.** A port usually needs states the
   source never showed (loading, error, empty). Those are generative, and the
   full anti-slop scan applies to them. "The artifact was cream" does not
   exempt an invented empty state from L1 or V1.
2. **Silence.** An artifact-covered finding stays in the review output with its
   rule id, marked informational. Suppressing it outright would hide from the
   user that their spec carries a known tell — which they may want to know
   before shipping it.
3. **Registered brand tokens.** A supplied artifact outranks house taste, not
   the consumer's own brand (`brand-source-of-truth`). Artifact-vs-brand
   conflicts are surfaced, never merged.

### The precedence chain's fourth member, and why it is not obvious

A generative design-system
skill — this suite's own or a third party's installed beside it — can carry an
instruction of the shape *"always generate a design system first"*. On a
greenfield brief that is right. On a **port** it is the same error the anti-slop
catalog makes: it argues the agent out of a decision the user already made, and
it does so from a step that runs *before* the artifact is even read, so nothing
downstream ever gets the chance to override it. A generative step's output may
inform decisions the artifact leaves open — states it never showed, a breakpoint
it never specified — and nothing more. It never re-opens a decision the artifact
carries.

This is a precedence clause, not a ban: the generative tooling stays correct
where it was already correct. What it loses is the authority to run *instead of*
reading a supplied artifact.

**The mechanical half.** A review finding carries `artifact_covered: true`, and
the polish gate drops those from the round-driving set *before* the ceiling
check, so a port cannot burn its two rounds on findings it was never allowed to
act on (`directives/ui/polish.ts`, `partition_artifact_covered`). Marking rather
than deleting is deliberate: the finding stays visible, only its authority to
force a round is removed. The burden sits with whoever sets the flag — an
unmarked finding is treated as actionable, so the default failure direction is
"we asked" rather than "we silently kept it".

Regression witness: `daf-slop-vs-provided`.

## Failure modes

- Swapping the prototype's font / typeface because another "reads better".
- Replacing a specified control (slider, stepper, chip) with a different control.
- Dropping or adding an element the prototype shows ("+", a send→stop toggle, a warning chip).
- Restructuring layout or moving sections "because the flow is better".
- Treating an internal "honesty gate" or "stub" concern as licence to redesign the UI.
- Re-running a redesign after the user already said "match the prototype".

## How to surface a deviation — do NOT execute it

Name what the spec shows, what you would change, and why — as a numbered option
per `user-interaction`. The user picks. Honesty about **behaviour** (a control
not yet wired) never licenses changing the **design**: a faithful visual plus a
labelled "not wired yet" note beats an invented redesign.

## Fixtures

Behavioral baseline: the `daf-*` fixtures named above (edit preservation,
unwanted variations, redesign trigger, missing asset, external asset URL,
invented screenshot), plus the port family this guideline governs —
`daf-source-over-screenshot` (data basis), `daf-adhoc-port-coverage` (loss
reporting outside the engine), `daf-rederive-is-deviation` (adopt the code),
and `daf-handoff-bundle`, the bundle shape where a token sidecar makes
"honoured the contract" and "eyeballed the CSS" produce different artefacts.

## See also

- `design-fidelity` (rule) — Iron Law + `design.fidelity_mode` strictness table.
- `brand-source-of-truth` / `brand-consistency` — same precedence shape, for registered brand tokens.
- [`design-modes.md`](design-modes.md) — brand vs product register discriminator.
