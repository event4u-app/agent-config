# AI-writing pattern catalog

> On-demand detail file for the [`humanizer`](../SKILL.md) skill — loaded
> only during an active humanize pass. Root source: Wikipedia's public
> "Signs of AI writing" guide (WikiProject AI Cleanup); wording and examples
> authored fresh for this suite. The mechanically detectable subset is
> mirrored in `src/scripts/ai_tells_rules.ts`.

Rewrite rule for every pattern: **rewrite, don't delete** — replace the
tell with a plain alternative that keeps the full meaning. If the original
has five paragraphs, the rewrite has five paragraphs.

## Group 1 — Content patterns

**1.1 Significance inflation.** Statements puffing up how something
"marks a pivotal moment", "reflects broader trends", "sets the stage",
"leaves an indelible mark", "plays a crucial role". Fix: state the fact
and, when known, the sourced reason.
- Before: *"The institute's founding marked a pivotal moment in regional
  statistics, reflecting broader movements toward decentralization."*
- After: *"The institute was founded in 1989 to publish regional
  statistics independently of the national office."*

**1.2 Notability name-dropping.** Lists of outlets or follower counts as
proof of importance. Fix: one concrete, dated fact beats a list of logos.
- Before: *"Her work has been cited by leading outlets, and she maintains
  an active social media presence."*
- After: *"In a 2024 interview she argued regulation should target
  outcomes, not methods."*

**1.3 Superficial "-ing" analysis.** Present-participle tails that fake
depth: "…, highlighting the region's heritage", "…, fostering community".
Fix: either the claim has a source (state it) or it goes.

**1.4 Promotional register.** "Nestled", "vibrant", "breathtaking",
"boasts", "rich cultural heritage", "must-visit", "commitment to
excellence". Fix: neutral description with verifiable detail.

**1.5 Weasel attributions.** "Experts argue", "observers have cited",
"industry reports suggest" with no named source. Fix: name the source and
date, or drop the claim.

**1.6 Formulaic challenges/outlook sections.** "Despite these challenges…
continues to thrive", "Future Outlook". Fix: concrete events with dates
instead of templated optimism.

## Group 2 — Language and grammar patterns

**2.1 AI vocabulary.** Post-2023 frequency spikes: delve, tapestry,
landscape (abstract), showcase, testament, pivotal, crucial, vibrant,
intricate, interplay, fostering, garner, enduring, underscore, seamless,
groundbreaking, ever-evolving. One is noise; three in a paragraph is a
signature. Fix: the plain word ("look at", "mix", "field", "show").

**2.2 Copula avoidance.** "Serves as", "stands as", "represents a
shift", "boasts", "features" where "is"/"has" carries the sentence.

**2.3 Negative parallelism.** "It's not just X — it's Y", "not merely a
song, but a statement", tailing fragments ("…, no guessing"). Fix: state
the positive claim as one clause.

**2.4 Rule-of-three padding.** Forced triplets ("innovation, inspiration,
and insights"). Fix: keep the items that carry information; two or four
honest items beat three decorative ones.

**2.5 Synonym cycling.** The protagonist / the main character / the
central figure / the hero for the same referent. Fix: repeat the noun or
use a pronoun.

**2.6 False ranges.** "From the Big Bang to dark matter, from stars to
galaxies" where the endpoints are not on a scale. Fix: list the topics.

**2.7 Subjectless fragments / hidden actors.** "No configuration needed.
Results are preserved automatically." Fix: restore the actor when it adds
clarity ("You don't need a config file; the system saves results").

## Group 3 — Style patterns

**3.1 Em/en-dash density.** The single most reliable mechanical tell in
AI copy. House rule: **density cap, not zero** — keep at or under ~2 per
500 words (CP1 parity with `docs/guidelines/design-antipatterns.md`).
Replace surplus dashes with a period, comma, colon, or parentheses.
Spaced double hyphens (` -- `) always go. A captured voice fingerprint
that genuinely writes in dashes wins over this rule.

**3.2 Mechanical boldface.** Bolding every key term. Fix: bold nothing or
the one thing the reader must not miss.

**3.3 Bold-header vertical lists.** `- **Speed:** faster.` stacks. Fix:
prose, or a list whose items are real sentences.

**3.4 Title Case Headings.** Fix: sentence case.

**3.5 Emoji decoration.** Emoji-prefixed headings and bullets. Fix:
remove; emoji only where the voice fingerprint explicitly allows them.

**3.6 Curly quotes.** Only meaningful in clusters — editors auto-curl.
Normalize to straight quotes in plain-markdown deliverables.

**3.7 Fragmented headers.** A heading followed by a one-liner that
restates the heading. Fix: cut the warm-up line.

**3.8 Staccato drama / manufactured punchlines.** Runs of short
declarative fragments engineered for quotability. One short sentence
lands a point; four in a row is a tell.

**3.9 Aphorism formulas.** "X is the currency of Y", "X becomes a trap",
"X is not a tool but a mirror". Fix: the concrete claim the formula
gestures at.

## Group 4 — Communication patterns

**4.1 Chat artifacts.** "I hope this helps", "Let me know if…", "Would
you like me to…", "Here is an overview of…". Chatbot correspondence
pasted as content — always remove.

**4.2 Knowledge-cutoff disclaimers.** "As of my last update…", "While
specific details are limited…". Fix: state what is known with its source,
or state plainly what is not documented.

**4.3 Speculative gap-filling.** "She likely grew up…", "maintains a low
profile" as filler for missing facts. Fix: say what isn't known or cut
the sentence — never dress a guess as fact.

**4.4 Sycophancy.** "Great question!", "You're absolutely right". Chat
register; never belongs in a deliverable.

## Group 5 — Filler and hedging

**5.1 Filler phrases.** "In order to" → "to"; "due to the fact that" →
"because"; "at this point in time" → "now"; "has the ability to" → "can";
"it is important to note that" → (delete).

**5.2 Hedge stacks.** "Could potentially possibly" → "may". One hedge per
claim, chosen deliberately.

**5.3 Generic upbeat endings.** "The future looks bright", "exciting
times ahead", "a step in the right direction". Fix: end on the concrete
next fact, or just end.

**5.4 Signposting.** "Let's dive in", "here's what you need to know",
"without further ado". Fix: do the thing instead of announcing it.

**5.5 Authority tropes.** "The real question is", "at its core", "what
really matters". Fix: make the point without the throat-clearing.

**5.6 Fake-candid openers.** "Honestly?", "Look,", "Here's the thing" as
theatrical pauses before an ordinary claim. A person being honest just
says the thing.

## What NOT to flag (false-positive guards)

Not reliable indicators on their own — leave these alone:

- **Perfect grammar and consistent polish.** Professionals exist.
- **Formal or academic vocabulary in general.** The tell is the specific
  word list in 2.1, not all elevated diction.
- **A single em dash, a lone "however", curly quotes by themselves.**
  Editors and word processors produce all three.
- **One short emphatic sentence.** Humans land points too.
- **Mixed registers.** Often a person, not a bot.
- **Unsourced claims.** Most human web writing is unsourced.
- **Quoted text, titles, proper names, and discussed-not-used phrases.**
  Never rewrite secondhand text ([`content-quoting-floor`](../../../src/rules/content-quoting-floor.md)).

Decide on **clusters**: two or more distinct pattern groups co-occurring.
Below that, say "no reliable tells found" and stop.

## Signs of human writing (preserve, never edit away)

- Specific, hard-to-fabricate detail (a real address, a weird quote).
- Mixed feelings and unresolved tension ("mostly good, still bothers me").
- Era-bound slang and dated references.
- Genuine asides, parentheticals, self-corrections.
- Sentence-length variety — real writing alternates short and long.

## German subset (language: de)

Mechanical mirror lives in `TELL_RULES_DE` (`ai_tells_rules.ts`):

- **Füllphrasen:** "es ist wichtig zu beachten", "im heutigen digitalen
  Zeitalter", "in der heutigen schnelllebigen Welt", "es sei darauf
  hingewiesen".
- **Konnektoren-Stapel:** "zudem", "darüber hinaus", "des Weiteren" in
  sequence — one connector per paragraph, chosen for meaning.
- **Bedeutungs-Inflation:** "spielt eine entscheidende Rolle", "markiert
  einen Wendepunkt", "unterstreicht die Bedeutung", "ein Meilenstein",
  "nahtlos".
- **Negativ-Parallelismus:** "nicht nur X, sondern auch Y" as a reflex.
- **Gedankenstrich density** follows the same ~2 per 500 words cap.
