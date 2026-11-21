<!-- evidence-type: analysis -->

# How to land a hook-bundle raise whose ratification has not converged in 23 rounds

## Situation

Branch `feat/done-claims-with-read-exit-codes` (repository `event4u/agent-config`) implements roadmap `road-to-done-claims-with-read-exit-codes`. It changes the turn-end hook in three ways, all shipped in the hook dispatch bundle that every hook event loads:

1. **Exit-code masking classifier** (`_lib/verification_command.ts`, `_lib/verification_evidence.ts`): a run whose recorded exit code is 0 but whose command line can end with 0 while the verifier failed (`tsc | tail`, `task ci; echo done`) is classified `exit_masked`, an instrument-gap reason that never refuses a turn. A nonzero recorded code keeps its origin/main verdict. Plus an `rtk` wrapper peel so wrapped verifiers are recognised.
2. **Detector G** (`_lib/coverage_claim.ts`, ~6.9 KB): records (never refuses) `partial_ratio` and `unlisted_surface` findings into per-session counters, for a later arming decision.
3. **Live-surface reader** (`_lib/live_surfaces.ts`, ~6.4 KB): derives runnable surfaces (npm scripts, tauri windows, playwright baseURL, compose ports, Taskfile tasks) from repo files, used only by detector G.

The bundle grows about 27.5 KB; the ceiling in `src/config/hook-bundle-budget.json` must rise. That file is on the ratification gate's watched list (ADR-268 § 4): the raise needs a two-provider verdict, both seats `ratified`. The record-only status of every new reason was decided by a council on 2026-11-21 (D5-D7).

## The ratification history

23 rounds so far, each on a fresh neutral prompt carrying the full code. The anthropic seat ratified in every round but round 12. The openai seat refused every round, each time on new findings — 2-3 per round — every one fixed with a regression test seen red first. Three times a whole class was dropped instead of patched (D8: no reading of an echoed status; D9: masking replaces only a recorded 0, so no refusal can be demoted; D10: no status handed on by `exit "${PIPESTATUS[k]}"`, pipefail off after any other `set`/`shopt` naming it).

Findings by area across rounds 13-23, approximately: detector G and the surface reader (URL crediting, webServer attribution, compose/tauri parsing, bounded reads, comment handling, Not-verified spans, credit for commands that cannot run, edit/command ordering) about 60 %; the masking classifier (shell reachability, pipefail, PIPESTATUS, skipped fallbacks) about 35 %; shared completion-trigger logic about 5 %. Round 23's three findings: a pipeline with a verifier whose known `false`/`true` member is ignored when crediting later commands; detector G credits a start command run before the edit; one malformed compose port entry can throw and drop all surface findings. In several rounds the openai seat also wrote that the classifier (which can change evidence) and the record-only telemetry (detector G plus reader) would be easier to evaluate as separate reviews.

The raise_log entry already names a conditional chunk, loaded only when the completion trigger matches, as the move that takes detector G and the reader (~13.3 KB) off every other hook event's parse; it was deferred because detector D shares the completion trigger with G's module and the split needs its own loader, digest check, chunk ceiling and schema pin.

## Options

A. **Continue the same loop**: fix round 23's findings, run round 24 on the full scope, repeat until both seats ratify.

B. **Split the PR**: land the masking classifier and `rtk` peel first (smaller raise, ratified on that scope alone), and move detector G plus the surface reader to a follow-up branch with its own raise and ratification. The roadmap's Phase 3/4 checkboxes would be reopened or carried to a follow-up roadmap.

C. **Same PR, telemetry out of the dispatch bundle**: move detector G and the reader into a conditional chunk (with its own ceiling) in this PR, so the dispatch-bundle raise covers only the classifier and the shared trigger; the chunk's ceiling is a new entry in the same gated file, so it is still ratified, but the main raise shrinks.

D. **Another option** you consider better.

## Question

Which option should this branch take, and why? Name the risks of the option you pick, what it costs against the roadmap's delivered scope, and what would make you change the answer. If you pick A, say what would make the loop end.

The LAST line of your reply must be exactly this shape, in plain text, nothing after it:

STANCE: <A|B|C|D> | CONFIDENCE: <high|med|low> | DEALBREAKER: <yes|no>
