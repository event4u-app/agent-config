# Media Policy — Style

## Iron Law

```
A LIVING ARTIST'S OR STUDIO'S DISTINCTIVE STYLE IS A POLICY DECISION,
NOT A PROMPT KEYWORD. CONSULT BEFORE EMITTING "IN THE STYLE OF X".
```

"Style" here means a distinctive, recognisable visual or cinematic signature attached to a living artist, a working studio, or a copyrighted franchise (e.g., a named animator's silhouette work, a studio's signature lighting, a franchise's character design language). Generic stylistic descriptors ("anime", "watercolour", "noir lighting") are out of scope.

## Triggers

The agent consults this policy when any of the following fires:

- A prompt to `/video:*`, `character-consistency`, `scene-expander`, `pixar-storyteller`, or `video-director` contains *"in the style of [NAMED ARTIST]"*, *"like a [STUDIO] film"*, *"[FRANCHISE]-style"*, or analogous attribution.
- A character sheet, blueprint, or motion prompt copies a named artist's signature element (silhouette mannerism, recurring visual motif, trademark colour palette).
- The user references a copyrighted franchise as the *primary* visual reference, not as a one-of-many influence.

## Allowed

- Generic stylistic descriptors that do not name a person or studio: *"watercolour"*, *"film noir"*, *"60s sci-fi pulp"*, *"hand-drawn 2D"*.
- Naming a long-deceased artist (public domain, jurisdiction-dependent) as one influence among several. The agent still surfaces this file when the prompt makes the named influence the *primary* reference.
- Naming a living artist as **one** of multiple influences when the output is clearly transformative (parody, commentary, education). Surface this file; ask one clarifying question if the intent is unclear.

## Forbidden

- Producing output whose *primary* identifying signature is a named living artist's or working studio's distinctive style without licensing evidence cited in the prompt.
- Copying a copyrighted franchise's character designs or world-building elements verbatim (e.g., generating *"a Pixar-style movie about [TOPIC]"* where the deliverable is intended as a substitute for or competitor to the named studio's work).
- Stripping the named-style attribution from a prompt to evade this policy ("just emulate the look without saying their name") — same Iron Law, same refusal path.

## Refusal path

When the trigger fires without licensing or transformative-intent evidence:

1. Refuse to render.
2. Surface this file path (`agents/settings/policies/media/style.md`).
3. Emit **one** clarifying question (per [`ask-when-uncertain`](../../../.augment/rules/ask-when-uncertain.md)) — typically: *"Is the named-artist / studio reference one influence among several, or the primary visual signature? If primary, do you have a licensing agreement or a transformative-intent rationale (parody, commentary) on file?"*
4. Record refusal and question in the session transcript.

## Required when licensing is cited

The prompt must include one of:

- *"Licensed under [AGREEMENT] dated YYYY-MM-DD"*
- *"Transformative-intent rationale: [PARODY / COMMENTARY / EDUCATION] — [JURISDICTION]"*
- *"Public-domain — [ARTIST] died [YEAR > public-domain threshold for jurisdiction]"*

## Enforcement model

LLM-readable decision framework. The agent consults; the human decides; the session transcript is the audit log. See [`README.md § Enforcement model`](README.md).

## See also

- [`likeness.md`](likeness.md) — when the "style" is actually a real person's likeness.
- [`brand-impersonation.md`](brand-impersonation.md) — when the style is owned by a brand rather than an individual.
- [`public-figures.md`](public-figures.md) — when the named artist is also a public figure.
- [`disclosure.md`](disclosure.md) — when style-influence is allowed, what attribution the output carries.
