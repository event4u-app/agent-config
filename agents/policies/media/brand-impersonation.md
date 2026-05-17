# Media Policy — Brand Impersonation

## Iron Law

```
DO NOT GENERATE OUTPUT THAT IMITATES A KNOWN BRAND, BROADCASTER,
JOURNALISM OUTLET, OR REGULATED-INDUSTRY VISUAL IDENTITY WITHOUT
A CITED USE-RIGHT OR A CLEAR PARODY / COMMENTARY DISCLOSURE.
```

"Brand impersonation" means producing video, image, or voice that copies the visual or auditory identity of a recognised brand — logo, trade dress, chyron / ticker layout, mascot, signature jingle, signature presenter voice — such that a reasonable viewer could mistake the output for an authentic communication from that brand.

## Triggers

The agent consults this policy when any of the following fires:

- A `/video:*` or `character-consistency` prompt names a brand, broadcaster, news outlet, regulated-industry company (bank, insurer, pharmacy, healthcare provider, government agency) as the visual identity to render.
- The prompt requests imitation of a journalism / broadcast brand's visual language (chyron, ticker, logo, mascot, signature transition).
- The prompt references a brand's mascot, spokes-character, or signature presenter (overlap with [`likeness.md`](likeness.md) and [`voice-cloning.md`](voice-cloning.md) when the spokes-character is a real person).
- The prompt requests output that will plausibly be re-shared in contexts where viewers expect authentic brand communication (advertising, customer support, internal comms simulation).

## Required when use-right or intent is cited

The prompt must include one of:

- *"Brand-use agreement signed by [BRAND] on YYYY-MM-DD"*
- *"Internal brand-asset use — [BRAND] employee — for [INTERNAL_USE] only"* (limited to genuinely internal contexts; the agent flags load-bearing internal-use claims)
- *"Parody / commentary — transformative intent — [JURISDICTION]"* — limited to genuinely transformative satire with an on-output parody disclosure (see [`disclosure.md`](disclosure.md))
- *"Journalism / education reporting on [BRAND] — fair use — [JURISDICTION]"*

## Forbidden

- Producing fake news / fake broadcast content that imitates a known journalism brand (chyron, logo, signature presenter) without an on-output parody disclosure that is **non-removable** ([`disclosure.md`](disclosure.md) Iron Law applies).
- Producing fake customer-support communications imitating a regulated-industry brand (bank, insurer, healthcare provider, government agency) — refuse even with cited use-right; these are fraud-adjacent surfaces and require human review.
- Producing fake advertising that places a brand behind a product, position, or endorsement the brand has not actually backed — refuse without exception when the audience is the public.
- Mascot rendering for a copyrighted brand without licensing (see [`style.md`](style.md) when the brand's signature is also a named-artist style).

## Allowed

- Generic-genre output ("a startup explainer in news-style format") that does **not** copy a specific recognised brand's identity.
- Brand-owned use: the prompt author is acting on behalf of the brand and cites the brand-use agreement.
- Genuinely transformative parody / commentary with the [`disclosure.md`](disclosure.md) Iron Law disclosure in place.

## Refusal path

When use-right / intent is missing or ambiguous:

1. Refuse to render.
2. Surface this file path (`agents/policies/media/brand-impersonation.md`).
3. Emit **one** clarifying question (per [`ask-when-uncertain`](../../../.augment/rules/ask-when-uncertain.md)) — typically: *"This prompt imitates [BRAND]'s visual / auditory identity. Do you have a brand-use agreement, internal-use scope, or a transformative-intent rationale (parody / commentary) on file?"*
4. Record refusal, surfaced policy files, and the answer in the session transcript.

## Enforcement model

LLM-readable decision framework. The agent consults this file; the human in the session is the decision point; the session transcript is the audit log. See [`README.md § Enforcement model`](README.md).

## See also

- [`likeness.md`](likeness.md) — when the brand's identity is carried by a named spokes-person.
- [`voice-cloning.md`](voice-cloning.md) — when the brand's identity is carried by a signature presenter voice.
- [`style.md`](style.md) — when the brand's visual signature is the work of a named living artist or studio.
- [`disclosure.md`](disclosure.md) — the mandatory disclosure that applies to all parody / commentary output.
- [`transparency.md`](transparency.md) — provenance metadata for fact-checking and re-share contexts.
