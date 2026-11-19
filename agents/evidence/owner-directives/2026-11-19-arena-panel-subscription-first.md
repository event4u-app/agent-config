<!-- evidence-type: analysis -->

# Owner directive — 2026-11-19: arena, panel, subscription first

Recorded from one owner session (four owner turns). Condensed, owner's words
translated; the decisions are the owner's, the wording is the recorder's.

## D1 — `/arena` is the bracket defined on 2026-10-31

"Build the arena command the way we defined it back then." The definition is
`road-to-a-loss-that-can-be-appealed` (archived): 10 lines by default, up to 100
only for owner-reserved or explicitly "extremely important" questions, an
eliminated idea may come back at most twice. Its kill list rejected a
*standalone arena skill*; `/arena` is the visible entry onto the same engine
(`src/scripts/bracket/`), not a second mechanism.

## D2 — readmission is voted, staged (option "B staged")

Owner: an eliminated idea should be "voted back in". AI council 2026-11-19
(anthropic + openai, quorum 2/2, CLI subscription transport, $0.0000) found the
transition owner-reserved (AC-9 lock in `tests/scripts/ai_council/jury_aggregate.test.ts`,
the honest-null clause of `free-jury-judge-agreement`, ADR-257) and recommended,
unanimously, the staged form. The owner chose it:

- the appeal card is decided by a vote of **paid seats only** (≥ 2 families);
  free seats do not vote until both free-jury claims are measured and ADR-257
  is amended;
- a split, an inconsistent juror or a missing qualifying seat leaves the
  elimination standing, records why, and spends no card — never a silent
  fall-back to a single seat;
- first a **shadow** phase: the jury votes on real runs but the single paid card
  seat still decides; criteria pre-registered before the first run; the vote
  becomes binding, and AC-9 opens for exactly this consumer, only when they pass.

## D3 — the improvised "arena" becomes `/panel`

What the owner has used as "arena" since 2026-11 is not the bracket: it is an
improvised workflow of N independent judges. Two shapes ran (2026-11-17):

- **decide** — each decision point judged by 4 fixed lenses independently,
  structured votes (choice, reason, risk, reversal condition, plan gaps,
  owner-only, confidence), one synthesis that tallies (consensus at 3 of 4,
  else `no_consensus`), keeps dissent and adds no preference of its own;
- **review** — N reviewers with distinct angles produce findings with
  line + quote; jurors check pairs of reviewers against the source text and
  reject what they cannot verify; one merger dedupes, re-checks, ranks.

"Panel fits." Name chosen by the recorder, confirmed by the owner.

## D4 — subscriptions first, metered APIs only as the exception

"AC should only use paid seats/subscriptions. The APIs only when we have no paid
seats, or the user says or configures it explicitly. In general I want to avoid
these costs. Also for me. Having the keys is fine, but the API should not simply
be used. I have enough accounts I can use. Like most people."

Consequence for the tree: a key that resolves is **not** consent to spend.
The cli→api mid-flight fallback, which today fires automatically for
`binary_missing` / `auth_rejected` / `cli_unsupported` / `model_unservable`
whenever a key resolves, becomes opt-in.

## D5 — spread across agent-switch profiles

"With agent-switch we have even more options: several logged-in profiles, and
we can and should distribute over them." Owned by
`road-to-a-link-with-agent-switch` Phase 5 (5.1 council seats, 5.3 bracket);
arena and panel route into that, they do not re-implement account choice.

## D6 — what a missing or broken subscription seat means

Asked the same day (Codex review finding 8: at resolution, an installed CLI
without a detected login silently took the API when a key existed). Owner:
"1 yes, 2 yes, 3 yes, if there is no stored user decision". Read as one rule:

1. **No subscription CLI installed** for a family — no subscription seat: the
   API may serve, as before.
2. **Subscription CLI installed but broken or not logged in**, at start or
   mid-run: the seat is a subscription seat. `fallback.api_on_cli_loss: true` →
   metered retry; `false` → the seat is lost. A seat configured `mode: api`
   stays allowed.
3. **Nothing stored** → ask: the seat is parked and the run asks once; a yes is
   the run-scoped billing grant and is not persisted.
