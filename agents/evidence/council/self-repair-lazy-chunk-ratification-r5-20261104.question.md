<!-- evidence-type: analysis -->

# Ratification review — moving the `self-repair` hook concern into a lazy chunk — round 5

Output contract, read first: end your answer with exactly one line `STANCE: <verdict> | CONFIDENCE: <high|medium|low> | DEALBREAKER: <yes|no>`, verdict one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`. That line is the only verdict the gate reads; APPROVE / REQUEST_CHANGES wording is not read, and an answer without the line is recorded as no verdict.

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list as a hook-plumbing source, so the change needs a provider-diverse verdict under ADR-268 § 4: an agent may change such a file but may not ratify its own change.

subject: 5a7474292f0a2bdbc97e677ee0fdbd58e43013a2c27d8333a70765697a92038f

(The digest covers the gated file at commit `5f54e84843`; the gated file is unchanged since rounds 3 and 4.)

## The change under review

The `self-repair` hook concern is moved out of the statically inlined dispatch bundle into a lazy chunk (`concern_registry.ts` row → `LAZY_CONCERNS`, a `hook_chunks.mjs` entry with `yaml` external, one 64,000 B chunk ceiling in `hook-bundle-budget.json`; `max_bytes` unchanged). The full cumulative diff was in round 4 (`agents/evidence/council/self-repair-lazy-chunk-ratification-r4-20261104.question.md`).

## Round 4 and what changed since

Round 4: one seat `confirmed-non-expanding` (high). The other asked for an integration test that loads the built, digested chunk from the package layout through the dispatcher.

That test was written and, run against the freshly built `dist/hooks/` (`npm run build:hooks`), it failed. Not because of the move: it exposed two defects in the concern itself, present on `origin/main` too.

1. The dispatcher nests the host's payload under `payload`; the concern read `prompt` and `transcript_path` from the top level only, so through the dispatcher none of its detectors ever saw a prompt or a transcript.
2. Its queue line was emitted as `context` with decision `allow`. The dispatcher forwards `context` on `session_start` only; on `user_prompt_submit` it forwards `additional_context` from a concern exiting with the advisory warn code (2), which is how `intake-pass` and `session-register` deliver theirs.

Commit `5f54e84843` fixes both in `src/scripts/self_repair_hook.ts` (not a gated file) and updates the `self-repair-loop` rule's sentence on exit codes (0, or 2 when it carries the queue line; never the block code).

`tests/hooks/self_repair_lazy_paths.test.ts` now:

- runs `node dist/hooks/dispatch.js --platform claude --event user_prompt_submit …` against the built bundle and digested chunk with a complaint prompt, and asserts exit 0, one record in the project's store, and `<self-repair-queue>` in the host-facing output (red before `5f54e84843`, green after; skipped only when `dist/hooks` is not built);
- asserts the in-process loader path and the spawned script write identical records (exit 2 on both now);
- asserts the nested-`payload` read.

Still not covered: a fallback triggered by the dispatcher itself after removing the built chunk. The loader returning `null` for a missing, malformed or undigested chunk, which is what sends the dispatcher to the spawn path, is covered generically by `tests/hooks/lazy_concern_fallback.test.ts`.

## The question

Is the move authority-expanding, and does the change as it now stands land? Findings briefly, then the STANCE line.
