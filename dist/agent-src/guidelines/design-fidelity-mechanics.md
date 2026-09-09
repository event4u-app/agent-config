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

Owned-asset paths, the third-party delivery decision this repository pins to
self-hosting ([`ADR-205`](../decisions/ADR-205-webfont-delivery-ownership.md)),
the real-imagery-as-proof floor, the iconography floor and the
no-unrequested-filler clause — each with its `daf-*` fixture:
[`design-asset-discipline`](design-asset-discipline.md).

## Artefact maturity — the second axis

The Iron Law and both discriminator clauses stay in
[`design-fidelity`](../../src/rules/design-fidelity.md) § Two axes; this is the table.

| The artefact declares | The spec is | The spec is NOT |
|---|---|---|
| low fidelity — greyscale, box-and-line, placeholder copy | layout · element set · hierarchy · states shown | grays · placeholder text · borders · exact spacing |
| finished — colour, real copy, real assets | everything visible (the 1:1 floor, unchanged) | — |

Grounded in [`wireframe`](../../src/skills/wireframe/SKILL.md) § Gotchas. The near-miss
class is pinned in `ROUTING_MATRIX`, its rationale beside the assertions in
`design_fidelity_routing.test.ts`.

## Routing mechanics

Migrated out of `design-fidelity.md` on 2026-09-09 under the council verdict on
`blocker: rule-body-cap` — a semantic migration that frees rule-body lines for
the operative pointers the same verdict requires, not an arbitrary line cut. The
rule keeps the obligations; this holds the reasoning behind them.

### The withdrawn builder-URL trigger

A page built in Lovable / v0 / bolt and handed over as a share link is a
finished spec, and `design-fidelity` does not route it. The obvious trigger was
tried and **withdrawn**: matching is plain lower-cased substring containment, so
`https://v0.dev/` also fires on `https://v0.dev/docs`, on a pricing page, and on
a changelog link — it would treat every mention of the tool's own site as a spec
handover. That is exactly the `claude.ai` failure the capability-URL trigger
exists to avoid, and by the rule's own standard it is worse than the gap it
closes. The alternatives are a bare-host keyword (broader still) or guessing
each vendor's share-path segment, and a trigger built on a guessed path is not
evidence.

**What closes it:** a verified share-path segment per vendor, or a
handover-word co-occurrence the matcher cannot express today. Until then the
class needs one word in the prompt, like any other unlisted filename.
`near-bare-host-mention` in `ROUTING_MATRIX` pins the bare-host direction silent
so a future attempt cannot reintroduce the broad form unnoticed.

### The trigger set, class by class

Phrase-heavy on the German side and on `artifact` deliberately: a bare
`artifact` keyword fires on *"the CI build artifact is 40 MB"*, which is CI
vocabulary and not a handover. `ROUTING_MATRIX` pins both halves — every class
that must route, and every near-miss that must stay silent (fixture
`daf-port-trigger-de`).

Each shipped class carries its own near-miss row, and the pairing is the
contract rather than a courtesy:

| Class | Its near-miss row | The direction that row tests |
|---|---|---|
| `phrase: claude.site/artifacts` | `near-claude-ai-chat-link` | a bare `claude.ai` chat link is a conversation reference, not a spec |
| `path_prefix: .claude/design-system/` | `near-generic-design-system-dir` | a bare `design-system/` is a normal source folder in a large fraction of frontend repos |
| `file_pattern: *.dc.html` | `near-plain-html-open-file`, `near-dc-in-a-filename` | an ordinary `.html` file in the tree; a filename that merely contains the letters |
| the withdrawn builder URL | `near-bare-host-mention` | left behind on purpose, so the broad form stays pinned silent |

### Write the near-miss row first — and test the right direction

Extending the trigger set without adding a near-miss row is how an over-broad
trigger lands. The stronger half of the contract is *which* near-miss:

**The row must test the direction the NEW trigger opens, not a direction that
was already closed.** The withdrawn class is the worked example. Its first
near-miss row tested a protocol-less mention — silent *before* the change, and
therefore incapable of catching the over-broadness the change introduced. The
row that would have caught it is `near-builder-host-non-handover-url`, a
documentation URL on the same host, and it exists only because a review asked
for it after the trigger had already shipped.

Applied on the next trigger to land: `*.dc.html` (the Claude Design canvas
artboard, which `*design.html` cannot match because it compiles to
`^(?:.*design\.html)$`) shipped with `near-plain-html-open-file` and
`near-dc-in-a-filename` written **before** it, both testing the direction it
opens — an ordinary `.html` file in the tree, and a filename that merely
contains the letters. Both were confirmed red-then-green against the real
matcher rather than asserted.

## Tolerance — why the mechanism ships and the number does not

`design-fidelity`'s `strict` mode says EVERY visible deviation needs explicit
confirmation. The owner directive that motivated
`road-to-design-intent-conformance` asks for an unprompted approximation within
a tolerance. Read literally, those contradict — and the contradiction is real
rather than a wording problem: `grep -cE 'reconcil|tolerance|approximat|nearest'`
over the rule and this guideline returned 0 / 0 before this section existed.

**The re-frame, and its condition.** A value inside a configured tolerance stops
being an unconfirmed deviation and becomes a **reported reconciliation**: the
project's token is written, and the distance from the artifact's own value is
reported on the row. Everything outside the tolerance stays confirmation-bound,
and structure — layout, control types, component set, ordering, breakpoints —
is never in scope at any setting, because it is not a value question.

**The condition is load-bearing, not a hedge.** `design.approximation` ships
`enabled: false` with `tolerance.color` and `tolerance.length` both `null`, so
in a default install the paragraph above describes nothing that happens: every
deviation stays confirmation-bound exactly as before, and no consumer default
moved. `hard-floor` disables the mechanism outright, so the strictest mode
cannot be loosened by configuring a tolerance under it.

**Why no threshold ships**, decided by the AI council on 2026-09-09 (anthropic +
openai, 2/2), and worth re-reading before adding one: *a number in a config
file, even flagged unmeasured, shapes behaviour and creates path dependency.*
Zero of seven design-to-code benchmarks in the evidence set score token
conformance, so a shipped threshold would be a guess wearing a default's
authority. Two proposals were examined and rejected on their merits rather than
on caution — `±5 per RGB channel`, because RGB channel distance is not
perceptually uniform and "likely imperceptible" does not follow from it; and
`max(1px, 2%)`, because it grows steadily more permissive at large dimensions
with no evidence that this is wanted. GitHub Primer's ±1px spacing widening is
the one real measurement available and is recorded as an externally observed
**candidate**, not adopted.

**The metric IS fixed, and that is the half that could be settled.** Colour
distance is OKLab ΔEOK, length distance is absolute CSS pixels
(`src/scripts/_lib/design_tolerance.ts`). Fixing the method mattered before
fixing any number: RGB Euclidean, ΔE LAB, CIEDE2000 and OKLab/ΔEOK give
different numbers for the same pair, so a threshold quoted without its metric
is not a threshold.

**The distance is reported on every row regardless.** Preserved values carry it
too. That is what makes the deferred half decidable: a window over rows that
report distances yields a distribution, where a window over rows reporting only
"kept" or "changed" yields nothing to read a threshold off.

## Artifact versus brand

Both `design-fidelity` and `brand-source-of-truth` point here rather than
carrying this arbitration themselves, and the pointers are **operative**: apply
this section before reconciling a value, not as a reference to consult if
curious. Two standing rules cannot each hold half of an arbitration between
them — a consumer receives one of them without the other, because
`design-fidelity` ships in `engineering-base` and `brand-source-of-truth` in
`brand` — so the split has to be somewhere both can reach.

**Values reconcile onto the brand token, with the distance reported.** Colour,
type and spacing are the axes where the field converges, unanimously and at
error severity, across the design systems surveyed. Where a registered brand
token exists, it wins, and the artifact's own value is not silently absorbed:
the distance between the two is reported on the same row, so what changed is
visible before it is cumulative.

**Structure is the artifact's, and is never adjusted to suit a token.** Layout,
control types, component set, ordering, breakpoints and behaviour are not value
questions at all, and no brand token is evidence about any of them. A structural
deviation stays what `design-fidelity`'s Iron Law says it is: a proposal needing
explicit confirmation.

**A conflict is surfaced, never merged.** Where the artifact and the brand
genuinely disagree on something that is not resolvable by the two rules above —
an artifact whose type scale contradicts the brand's, say — the agent surfaces
both readings as a numbered choice and builds neither until the human picks.
Averaging them produces a third design nobody approved.

**Where no brand exists**, there is nothing to reconcile onto: the artifact's
values are the values, and `brand-source-of-truth`'s own "when NOT to fire"
already says so. The reconciliation above is a rule about *two* sources, not a
licence to normalise one.

**What this section does NOT decide** is whether an in-tolerance value may be
reconciled *without asking*. That needs a tolerance to exist and a default to be
chosen, and both are recorded as open decisions rather than answered here —
`design.tolerance.*` ships empty and the approximation ships disabled.

## Icons on a provided artifact

`icon-consistency` owns the icon axis and, until 2026-09-09, carried **zero**
occurrences of `artifact` / `artefact` / `provided` — so no surface in the
package handled a handed-over artifact's icons at all. Its "ad-hoc inline SVGs
alongside a chosen set" clause is exactly the shape a faithful port produces,
which made a port read as a violation of the rule it was obeying.

**The fix is a new rung, not a re-ordering.** Rung 1 of the iconography ladder
is the project's brand token, and the artifact does **not** outrank it. What the
carve-out changes is which findings are violations, not which source wins.

**The obligation that survives is traceability, not conformity.** An
artifact-sourced icon is legitimate when it traces to the artifact and that
provenance is stated. An inline `<svg>` that traces to neither the adopted icon
set nor a named artifact is untraceable, and still fires.

**A swap is still a deviation.** Replacing the artifact's icon with the
project's nearest equivalent is a substitution of a control the artifact
specified, so it needs the same explicit confirmation as any other deviation
under `design-fidelity`'s Iron Law. The carve-out permits keeping the
artifact's icon; it never permits changing it silently.

**What is deliberately NOT here:** an assertion that an artifact's icons are
*reconcilable* onto the project's set by default. `tailwind-engineer` carried
that claim in the opposite direction — icons "stay 1:1 with the artifact", with
no citation — and it was deleted rather than inverted. The contrary evidence and
the two conditions that would reverse the silence are recorded in
`road-to-design-intent-conformance` § The icon evidence.

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

## Value-level provenance — the finer grain beside the flag

The block above is finding-level and stays the default: `artifact_covered` is a
boolean on a **finding**, and every consumer of it — `partition_artifact_covered`
and the ceiling check it feeds — is unchanged by this section.

What a per-finding boolean cannot answer is *"where did this `16px` come from"*.
The flag says a finding is answered by the artifact; it does not say which value
carried the expectation, so two rows that disagree about the same element look
identical to a reviewer.

`src/scripts/schemas/fidelity-measurement-sheet.schema.json` adds that grain and
nothing else: each measurement row carries `expectation_source` — a `kind`
ordered by authority (`provided_artifact` › `design_token` › `brand_token` ›
`house_heuristic` › `agent_inference`) plus a `ref` naming the token, `file:line`
or artefact anchor. `agent_inference` is the row a reviewer filters for.

Two boundaries, because this is an addition and not a replacement:

- **The coarse flag stays the default channel.** A row's optional
  `expectation_source.artifact_covered` mirrors the flag for one value; it never
  substitutes for setting the flag on the finding, and no gate reads it.
- **The ordering above is a mirror, not a second source of truth.** Precedence
  is decided in the block above; a `kind` that disagreed with it would be a
  defect in the schema, not a competing chain.

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
