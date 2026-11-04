<!-- evidence-type: analysis -->

# Ratification review — moving the `self-repair` hook concern into a lazy chunk — round 7

Output contract, read first: end your answer with exactly one line `STANCE: <verdict> | CONFIDENCE: <high|medium|low> | DEALBREAKER: <yes|no>`, verdict one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`. Only that line is read; a closing APPROVE or REQUEST_CHANGES is not a verdict the gate can read.

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file, `src/config/hook-bundle-budget.json`, is on the ratification gate's list as a hook-plumbing source, so the change needs a provider-diverse verdict under ADR-268 § 4.

subject: 5a7474292f0a2bdbc97e677ee0fdbd58e43013a2c27d8333a70765697a92038f

(Unchanged since round 3. The change: the `self-repair` concern moved from the inlined dispatch bundle into a lazy chunk, one 64,000 B chunk ceiling, `max_bytes` unchanged; cumulative diff in `agents/evidence/council/self-repair-lazy-chunk-ratification-r4-20261104.question.md`, pre-existing-defect evidence in `…-r6-20261104.question.md`.)

## Round 6 and what changed since

Round 6: one seat `confirmed-non-expanding` (high); the other gave no verdict line and asked for one thing, "a dispatcher-level missing-chunk regression test proving fallback produces the expected record and queue context exactly once".

Added in `tests/hooks/self_repair_lazy_paths.test.ts`: the test copies the built `dist/hooks/` into a temporary package layout without `self_repair.chunk.cjs` (and its digest), links `src/` and `node_modules/`, runs `node <pkg>/dist/hooks/dispatch.js --platform claude --event user_prompt_submit …` with a complaint prompt, and asserts exit 0, exactly one record with `occurrences: 1`, and exactly one `<self-repair-queue>` in the host-facing output. It passes against a fresh `npm run build:hooks`.

Coverage now: the built dispatcher with the digested chunk (record + queue line); the built dispatcher with the chunk missing (spawn fallback, exactly once); loader-vs-spawn record equality; the nested-`payload` read.

## The question

Is the move authority-expanding, and does the change land? Findings briefly, then the STANCE line.
