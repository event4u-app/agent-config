<!-- evidence-type: analysis -->

# Ratification review — moving the `self-repair` hook concern into a lazy chunk — round 3

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list as a hook-plumbing source, so the change needs a provider-diverse verdict under ADR-268 § 4: an agent may change such a file but may not ratify its own change.

subject: 5a7474292f0a2bdbc97e677ee0fdbd58e43013a2c27d8333a70765697a92038f

(The digest covers the gated file at commit `058435fb62`, computed with `./scripts-run src/scripts/ratification_subject`.)

## The change under review

The `self-repair` hook concern (bound on `user_prompt_submit` and `stop`, `fail_closed: false`) is removed from the statically inlined dispatch bundle and built as a lazy chunk: its registry row moves from `concern_registry.ts` to `LAZY_CONCERNS` in `lazy_concern.ts`, `hook_chunks.mjs` gains its chunk entry (`yaml` external), and `hook-bundle-budget.json` gains one chunk ceiling of 64,000 B over a measured 58,114 B. The dispatch ceiling `max_bytes` is unchanged; the dispatch bundle measured 1,581,986 B before and 1,557,293 B after (ceiling 1,582,000 B). A missing or mis-digested chunk makes the dispatcher spawn the concern's script instead.

Round 1 reviewed the full diff (`agents/evidence/council/self-repair-lazy-chunk-ratification-20261104.question.md`); round 2 reviewed a derivation-wording revision (`…-r2-20261104.question.md`).

## Rounds 1–2 and what changed since

- Round 1, both seats: `confirmed-non-expanding`, no dealbreaker; findings on the derivation's wording (an over-strong fallback claim, the `yaml` resolution, the margin's rationale), fixed in `3503b4bfa5`.
- Round 2: one seat `confirmed-non-expanding` (high); the other approved in prose without the required closing line, and named one remaining wording issue: "the concern never blocks either way" conflates failure policy with execution behaviour, suggesting "concern failures do not reject the hook event".

Commit `058435fb62` changes only that clause of the derivation string. It now ends:

> …the generic fallback tests cover the routing, not a concern-specific equivalence of the records, and on either path a failure of the concern does not reject the hook event (`fail_closed: false`).

No code and no number changed.

## The question

Does the change as it now stands land, and is it authority-expanding? Give your findings briefly. Your answer MUST end with exactly one line in this form — the verdict is read mechanically from it and an answer without it is recorded as no verdict. Choose from `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`:

STANCE: <verdict> | CONFIDENCE: <high|medium|low> | DEALBREAKER: <yes|no>
