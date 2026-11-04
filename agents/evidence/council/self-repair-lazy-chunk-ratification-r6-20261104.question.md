<!-- evidence-type: analysis -->

# Ratification review — moving the `self-repair` hook concern into a lazy chunk — round 6

Output contract, read first: end your answer with exactly one line `STANCE: <verdict> | CONFIDENCE: <high|medium|low> | DEALBREAKER: <yes|no>`, verdict one of `ratified`, `confirmed-non-expanding`, `refused`, `non-convergent`. Only that line is read.

You are an independent reviewer for a change in the `event4u/agent-config` repository. One file in it, `src/config/hook-bundle-budget.json`, is on the ratification gate's list as a hook-plumbing source, so the change needs a provider-diverse verdict under ADR-268 § 4.

subject: 5a7474292f0a2bdbc97e677ee0fdbd58e43013a2c27d8333a70765697a92038f

(The digest covers the gated file at the current branch head; the gated file is unchanged since round 3.)

## What is being ratified

The gated change is the move of the `self-repair` concern from the inlined dispatch bundle into a lazy chunk, with one 64,000 B chunk ceiling (`max_bytes` unchanged). Rounds 1–4 reviewed it; the cumulative diff is in round 4's prompt (`agents/evidence/council/self-repair-lazy-chunk-ratification-r4-20261104.question.md`).

The two delivery fixes reported in round 5 are in `src/scripts/self_repair_hook.ts`, which is not a gated file. They are described here because round 5 asked whether they restore or expand behaviour.

## Round 5 and the evidence it asked for

Round 5: one seat `non-convergent` (no dealbreaker), asking for evidence that both defects pre-exist on `origin/main`; the other gave findings without a verdict line, naming the same question and the dispatcher-triggered fallback gap.

Lines read with `git show origin/main:<path>` at `01a746417d`:

- `src/scripts/self_repair_hook.ts:194` — `const prompt = str(env['prompt'] ?? env['user_prompt'] ?? env['text']);`
- `src/scripts/self_repair_hook.ts:200` — `const tp = str(env['transcript_path'] ?? env['transcriptPath']);`
- `src/scripts/self_repair_hook.ts:237-239` — `decision: 'allow',` … `context: buildQueueLine(`
- `src/scripts/hooks/dispatch_hook.ts:1374` — the `context` key is forwarded under `args.event === "session_start" &&` only.
- `src/rules/self-repair-loop.md:38` — "`<self-repair-queue>` is injected at prompt time while records are open."

So on `origin/main` the concern reads the host prompt from the top level while the dispatcher nests it under `payload`, and emits its queue line in a key the dispatcher drops on `user_prompt_submit`; the rule documents the injection the code never delivered. The fixes read `payload` (falling back to the top level) and emit `additional_context` under the warn code 2, the shape `session-register` and `intake-pass` already use on that slot. The concern's binding, `fail_closed: false`, `severity: advisory` and write target (`agents/runtime/self-repair/`) are unchanged; it can still never return the block code.

Coverage, unchanged from round 5: a dispatcher test against the built bundle and digested chunk (record written, queue line delivered; red before the fix), loader-vs-spawn record equality, and the nested-payload read. Not covered: a dispatcher-triggered fallback after deleting the built chunk; the loader's `null` on a missing, malformed or undigested chunk is covered generically.

## The question

Is the move authority-expanding, and does the change land? Findings briefly, then the STANCE line.
