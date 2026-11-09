# Freeze record — web-launch-readiness benchmark, 2026-11-09

Resolves the condition of `b-benchmark-independent-execution`
(`agents/roadmaps/later/road-to-web-launch-readiness-benchmark.md`): the seven
protocol items are frozen in writing, in a commit that precedes any arm's
execution.

## Who froze it, and what it could see

- **Freezer:** an OpenAI session (`codex exec`, gpt-6.1-sol), started fresh in
  an isolated directory outside this repository.
- **Given:** `FREEZER-BRIEF-2026-11-09.md` (beside this file), the three
  fixture sites (`docs/`, `local-business/`, `saas-app/` copied from
  `tests/fixtures/web-launch-benchmark/`), and the shipped
  `check_web_launch_readiness.ts` with its config.
- **Withheld:** `GROUND-TRUTH.md`, the fixture tests, this roadmap, and
  `docs/CLAIMS.md`. The brief gives the claim sentence and the registered
  falsification, and does not say which condition is the decoy.
- **Exposure check:** every command the session ran is in its log. It read
  `BRIEF.md` and the two treatment files, never opened a fixture file, and ran
  one `ls -la ..` outside its directory, which lists file names in the
  orchestrator's scratch directory; none of them is the manifest.

## The one revision, before any arm ran

The first protocol (`PROTOCOL-2026-11-09.v1-before-item7.md`) assigned three
human reviewers from a roster. No such roster exists, and that version's own
rule would have made the experiment UNDERPOWERED before it ran. The
orchestrator told the same freezer session that only model seats of two
providers are available, and asked it to revise Section 7 alone. The diff
between the two files touches Section 7 only.

## The orchestrator

The session that commissioned the freeze and will run the arms did not author
the checks, the fixtures, the ground truth or the roadmap's protocol section,
and has not read `GROUND-TRUTH.md`. It does know which condition is the decoy,
because `docs/CLAIMS.md` names it publicly. Under the frozen protocol the
orchestrator chooses nothing: prompts, packaging, order, model, settings,
retries and scoring are all fixed above, and scoring is done by three model
seats, never by the runner.

## Frozen artefact

`PROTOCOL-2026-11-09.md`, SHA-256
`aa675ae0d5013802aa6213a4fd42c3df115a6e35600cbbfcaae4f52b01baa51a`.

Scoring seats, fixed before generation per Section 7:

- reviewer A: Anthropic, `claude` CLI, `claude-sonnet-5-5`, provider-default sampling
- reviewer B: OpenAI, `codex exec`, `gpt-6.1-sol`, provider-default sampling
- adjudicator: OpenAI, a separate fresh `codex exec` session, `gpt-6.1-sol`
- each seat scores in a fresh session with no tools beyond reading the files it is handed
