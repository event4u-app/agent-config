# Docs voice

> Maintainer reference: how user-facing copy sounds. Applies to the README,
> the docs site outside its Reference and Maintainers sections, the CLI's
> user-facing help text, `package.json` and `.github/about.yml`. What the copy
> says lives in [`message-house.md`](message-house.md); this page governs the
> words and the sentences.

## Who the reader is

Someone who has an AI coding tool, has not decided to install this, and will
leave at the first sentence that sounds like our internal notes. Every word
below exists in this repository for a reason; most of those reasons belong to
maintainers, not to that reader.

## Words user copy avoids

| Avoid | Write instead | Why |
|---|---|---|
| governed, governance | "checked", "follows your rules", or say what is checked | Abstract; promises control without naming it. |
| projection, projected | "written into each tool's own format", "installed for Cursor" | Build-system term. |
| kernel | "the always-on rules" | Internal tier name. |
| tier-1, tier-2, router (as a noun the reader must know) | "rules that load when a task needs them" | Internal routing vocabulary. |
| Iron Law | "rule", "hard rule" | House term; reads as dogma. |
| wedge | name the thing: "`production-validator`, a read-only checker" | Go-to-market slang. |
| judges | "reviewers", "focused review passes" | Internal name for review subagents. |
| council, AI council | "a second opinion from other AI models" | Internal name; implies a body the reader cannot see. |
| ADR-NNN, "per ADR-…" | the decision in plain words; link the ADR only in Reference | A number tells a newcomer nothing. |
| pack, capability pack | "a set of skills for <role or domain>" | Internal grouping; acceptable after it has been introduced once with that gloss. |
| preset | "how cautious the agent is" (fast, balanced, strict) | Internal config axis. |
| carrier, concern, hook slot | "a check that runs when <event>"; "hook" only on Claude Code pages | Hook-plumbing vocabulary. |
| contract, manifest, harness, soak, drift, gate, lint | the plain action: "the check", "the list", "fails the build" | The README jargon watchlist below. |
| host | "AI coding tool", or the tool's name | Our word, not the reader's. |
| enforce, guarantee (off Claude Code) | "asks the agent to", "instructs" | Blocking exists only on Claude Code; anything stronger elsewhere is false. |
| any count without a claim marker | the number with `<!-- claim:ID -->`, or no number | `docs/CLAIMS.md`; unmarked numbers drift. |

## Enforced lists — what the build checks

These are the lists the README is held to by CI. The voice guide is stricter
than the checks; the checks are the floor.

**Jargon watchlist** — `src/scripts/lint_readme_jargon.ts` (`WATCHLIST`, line
29). At most 3 whole-word, case-insensitive hits in README lines 1–120, after
code fences, HTML comments and URLs are stripped:

`kernel` · `contract` · `iron law` · `projection` · `manifest` · `lint` ·
`ADR` · `soak` · `drift` · `gate` · `harness`

**Stock phrases** — `src/scripts/readme_linter.ts` (`GENERIC_BOILERPLATE`, line
75). Rejected anywhere in the README:

`modern and scalable` · `powerful and flexible` · `simple and intuitive` ·
`blazing fast` · `next-gen` / `next generation` · `world-class` ·
`cutting-edge` · `seamless(ly) integrat…` · `robust and reliable` ·
`lightweight yet powerful`

**No serial comma** — `src/scripts/lint_readme_serial_comma.ts`
(`SERIAL_COMMA`, line 31). The pattern is any comma followed by `and` or `or`
in README prose (tables, code and comments excluded). It is broader than the
list rule: "it stops, and you decide" fails too. Rewrite as two sentences or
drop the comma.

**One-liner identity** — `src/scripts/lint_positioning.ts`. The H1 tail after
the dash appears in the `package.json` and `.github/about.yml` descriptions;
each description is at most 200 characters.

**Claims** — `src/scripts/check_claims.ts`. A `<!-- claim:ID -->` marker in the
README or `docs/` must resolve to a `status: backed` ledger entry with
resolvable evidence.

## Sentence rules

1. **One-sentence lead.** Every page and every section opens with one sentence
   that says what the reader gets. No preamble, no history.
2. **Code first.** When the answer is a command, the command comes before the
   explanation, in a fenced block the reader can copy.
3. **No serial comma in the README.** "skills, rules and commands". Other
   pages follow the same style for consistency.
4. **Second person, present tense.** "You run `init`", not "the user may
   invoke".
5. **Say the limit in the same sentence as the capability.** "Blocks on Claude
   Code; instructions elsewhere" — never the capability on one page and the
   limit on another.
6. **Numbers only with a source.** A claim marker or a link to the
   `docs/benchmark.md` section it is read from.
7. **Copy the canonical sentences verbatim.** The one-liner, the install-scope
   sentence and the before/after block in `message-house.md` are pasted, never
   rewritten.
8. **No invented output.** Scenarios are narrated. Terminal output is real
   output from a real run, or it is not shown.

## Where jargon is allowed

- **Reference** pages on the docs site (CLI reference, settings reference,
  contracts) and `docs/contracts/` — exact terms are the point there; gloss a
  term on first use.
- **Maintainers** pages (`docs/maintainers/`, the site's Maintainers group),
  `docs/decisions/` and `AGENTS.md` / `CLAUDE.md`.
- **Linking out** from user copy to those pages is fine; the link text stays
  plain ("how the rules load", not "rule-router contract").
