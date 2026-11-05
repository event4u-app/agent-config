# Pre-registration — code-graph benchmark **v3**, third-party subjects

Registered 2026-11-05, **BEFORE the code-graph engine has seen either subject
repository** (`road-to-a-graph-that-wins` step 2.1). Sibling of
`PREREGISTRATION-inrepo-2026-08-28.md`, `PREREGISTRATION-inrepo-v2-2026-08-29.md`
and `PREREGISTRATION-orientation-2026-10-23.md`, never an edit of any of them. Their
documents, corpora, runners and reports stay exactly where they are; nothing here
re-scores them.

**What "before the engine has seen them" means, stated as a checkable claim.** The two
subjects were cloned at their pins into a scratch directory outside this repository
and read with `git`, `grep`, `find` and `sed` only. No `agent-config code-graph` verb,
no `src/scripts/code_graph/*` entry point, no `map`, no `ask`, and no graph build was
run on either clone, and neither clone contains a `graph.json`, a `*.scip` index or an
`agents/map/` tree (checked with `find` at registration). Every input the run will
read is in this directory and bound by SHA-256 below (K2). The 2026-08-28
registration lost four of its inputs; this one has none outside the tree.

## Subjects

| Role | Repository | Pin (fork default branch, fetched 2026-11-05) | Licence | Upstream |
|---|---|---|---|---|
| benchmark subject | `event4u-app/unopim` (branch `3.x`) | `56071226255ff8e0f5dc40dafa72eab0f2751d54` | MIT | `unopim/unopim` |
| benchmark subject | `event4u-app/larasend` (branch `main`) | `da5c06c725f51f537fd8e238e436263665f475d2` | MIT | `savvyagents/larasend` |

Both are named in the roadmap's corpus header with the role **benchmark subject**
(ADR-260 § 5): test subjects, not idea sources. The forks are never edited; a newer
upstream state enters only as a new, registered pin. The runner clones each fork with
`git clone --filter=blob:none` and checks out the pin; suite F checks out each task's
`parent_sha`, all of which are ancestors of these pins.

## The larasend owner deviation

`larasend` falls short of the fitness list's ≥ 200 routes (93 `Route::` calls,
measured 2026-10-23). The owner accepted it on purpose: it is little known, which
lowers the chance that suite F measures recall of training data. Consequence, fixed
here: **suite C is reported per subject and never pooled**, and the class-2
(route-trace) **verdict is computed on `unopim` alone**, the subject that meets the
fitness list. `larasend`'s route-trace result is published beside it and can neither
turn a `unopim` win into a loss nor a `unopim` loss into a win.

## Suites

| Suite | Content | Where | Scored as |
|---|---|---|---|
| **A** regression | The v2 in-repo corpus, **unchanged**, run by the v2 runner | `inrepo-corpus-v2-2026-08-29.yaml` (hash below, identical to the hash v2 registered) | v2's own per-class bars; reported, not part of the v3 verdict |
| **B** precise semantics | Class 1 — a token that collides, a declaration that does not | `corpus-v3-2026-11-05.yaml` | per-class bar |
| **C** application | Class 2 route-trace, class 3 model → table, class 4 tests-for | `corpus-v3-2026-11-05.yaml` | per-class bar, per subject |
| **D** negative control only | Class 5 — a `threats.csv` sink (row 24, SSRF) no accepted path reaches, plus near-miss symbols; the correct answer is empty | `corpus-v3-2026-11-05.yaml` | clean-rate, **no bar** |
| **E** change impact | Class 6 `change-impact` and class 7 `change-impact-xplane` (change in one language, impact in another) | `corpus-v3-2026-11-05.yaml` | per-class bar |
| **F** agentic | 24 tasks: localise-and-fix from issue text, and PR review for missed callers | `suite-f-tasks-v3-2026-11-05.yaml` | F bars below |

Question counts at registration (B–E: 45 questions; truth pending the oracle):

| Class | unopim | larasend | Hop strata (1 / 2 / ≥ 3) |
|---|---|---|---|
| 1 precise-semantics (B) | 6 | 6 | 8 / 2 / 2 |
| 2 route-trace (C) | 3 | 3 | 0 / 1 / 5 |
| 3 model-table (C) | 3 | 3 | 6 / 0 / 0 |
| 4 tests-for (C) | 3 | 2 | 0 / 5 / 0 |
| 5 negative-control (D) | 3 | 3 | 2 / 0 / 4 |
| 6 change-impact (E) | 3 | 3 | 0 / 4 / 2 |
| 7 change-impact-xplane (E) | 2 | 2 | 1 / 3 / 0 |

Languages: PHP 38 questions, TypeScript 3, Vue 1, JavaScript 3; class 7 crosses
PHP → Vue (`larasend`) and JS → Blade (`unopim`). Suite F: 24 tasks, 11 `larasend`
(9 localise-and-fix, 2 review) and 13 `unopim` (9 localise-and-fix, 4 review).

**Six scored classes**: 1, 2, 3, 4, 6, 7. Class 5 is a clean-rate and suite A is a
regression check; neither counts toward the null path below.

## Truth (step 2.2)

- **Oracle arm.** TypeScript and Vue `<script>` blocks: `tsserver` / `scip-typescript`
  references. PHP: Psalm `--find-references-to`, or a PHP language server's references
  request where Psalm cannot resolve a symbol. Truth is taken at **symbol level** and
  projected to files for scoring; hop strata 1 / 2 / ≥ 3 are re-derived from the oracle's
  own relation chain, and where they disagree with the corpus author's estimate the
  oracle's stratum is reported along with the disagreement count. Route, Blade-directive
  and Inertia-page relations that no reference engine emits (class 2 hops into route
  files, class 7) are established by the human checker reading the files the oracle
  points at, and are marked `truth_via: human` per item.
- **The oracle is never an arm and never a provider (K1).** It lives only under
  `internal/bench/`, its index is produced by an indexer the maintainer installs, never
  fetched at runtime (ADR-259); without one the oracle step exits naming the missing
  indexer, and no question is scored.
- **Truth is never derived from the graph under test.** A recall of 1.0 against
  graph-derived truth is circular.
- **20 % human check, drawn now.** Within each class, questions are ordered by
  `sha256("<id>:20261105")` ascending and the first `ceil(0.2 × n)` are checked by a
  human against the source. Seed `20261105`. The draw, computed at registration:
  class 1 `uo-b-05`, `ls-b-06`, `uo-b-02` · class 2 `uo-c-route-02`, `ls-c-route-02` ·
  class 3 `ls-c-model-02`, `ls-c-model-01` · class 4 `uo-c-tests-03` · class 5
  `uo-d-03`, `ls-d-03` · class 6 `ls-e-01`, `uo-e-02` · class 7 `ls-e-x-01`
  (13 of 45). A disagreement between human and oracle is resolved for that item by the
  human reading, and the disagreement rate is published.
- **Second truth source** (amendment of 2026-10-27): for suite F and for step 3.5, the
  files the real upstream fix commit touched (`fix_files`, and for review tasks
  `held_out`). Tests are never localisation targets; generated build output is excluded
  from every root and every truth set.
- **Class 5.** An item whose oracle answer is non-empty is **VOID**: removed from the
  clean-rate and listed by id. It is never turned into a positive question after the fact.

## The owner deviation for the check (2026-11-05)

Fixed after the oracle run and **before any check verdict existed**. The owner declined
to perform the human check above and delegated it. Every place this registration says
"human" for the check — the 20 % sample, the `truth_via: human` items, the completion of
items the oracle answered only in part — is carried out instead by:

1. **A reader** — a Claude session with the subject checkout, reading source only (no
   graph, no index), answering each question at file level with `path:line` evidence,
   judging every oracle file, and naming plausible candidates it excluded.
2. **Two judges** — the two providers the AI council is configured with, Anthropic
   (`claude -p`) and OpenAI (`codex exec`, reasoning `medium`), called directly in an
   empty directory with no repository to read. They are not called through
   `council run` because every council lens wraps the answer in a critique template,
   and a per-file ruling cannot be read out of one. Each judge is given the question,
   every candidate file, and the source lines around each citation extracted
   mechanically from the checkout, and rules `IN`, `OUT` or `UNSURE` per file.
3. **The rule.** A file is in the truth when at least two of the three say `IN`
   (`UNSURE` is not `IN`). A file a judge names as missing enters only when both judges
   rule it `IN` in a second round that shows its source lines. An item's verdict is
   `agree` when the result equals the oracle's set and `corrected` otherwise.

What this costs, stated before the data: the check is no longer independent of language
models, and the reader and one judge share a provider. No arm is a language model, so
the truth is still not derived from anything under test. The truth file names the
checker (`human_check.checked_by: council`), the runner prints it beside every result,
and the oracle-versus-check disagreement rate is published as registered. The prompts,
the reader answers and both judges' raw rulings are committed beside the truth file.

### Check v2 — hardened, fixed before its first verdict (2026-11-05)

The owner asked for the check above to be hardened before any arm is scored against
it. No arm has been scored against any truth yet. Check v2 replaces the result of the
check above; that result stays committed as a record (`check-v3-2026-11-05/`), and the
oracle-versus-v1-versus-v2 differences are published. What changes:

1. **One provider, one voice.** The reader stays the Anthropic reader above (its
   answers are reused unchanged). The judges become OpenAI (`codex exec`, reasoning
   `medium`) and Google (`agy`, `gemini-3.8-flash-medium`). No judge shares a provider
   with the reader, and every file in the truth carries at least two providers' `IN`.
2. **Blind judges.** A judge sees the question and, per candidate file, its path and the
   source lines extracted from the checkout. It does not see who proposed a file
   (reader, oracle, or neither), the reader's notes or conclusions, or the oracle's
   status. Candidates are listed in a hashed order, not grouped by source.
3. **Calibration, blind.** The 7 items the oracle answered completely and that are not
   in the sample run through the same prompt, unmarked, each with its oracle files plus
   up to three decoys: tracked files that contain the probe token but are not oracle
   references. Judge precision and recall against that gold are published. Calibration
   items never change the truth.
4. **Class 3 is derived, not judged.** For model-table questions, the table is the
   model's `$table` property or, without one, Laravel's convention (snake case, plural);
   the answer is the model file plus every migration that creates, alters, renames or
   drops that table via `Schema::` or a raw `ALTER TABLE` / `CREATE TABLE`. A migration
   that only writes rows is not included. The 2-of-3 rule still runs on class 3 and
   its disagreement with the derivation is published.
5. **The rule is unchanged** for every other item: a file is in the truth when two of
   the three say `IN`; a file a judge names as missing enters only on both judges' `IN`
   in a second round. Cohen's kappa between the two judges is published.

## Arms (step 2.3)

**A–E** (no fused arm, K4):

1. **grep, two-probe.** `git grep` over the subject's tracked files minus the excluded
   paths. A symbol probe is a word-boundary search; the answer is the union over every
   probe token the question carries (`probe` and, for path questions, `probe_to`). A
   route probe given as `METHOD /uri` is searched fixed-string for every static URI
   segment (segments without braces); a route probe given as a name is searched
   fixed-string as written. Exit 1 is an empty answer; exit > 1 aborts the run.
2. **native.** The engine built once per subject at its pin, then one mechanical verb
   map, fixed here: class 1 → `affected` + `query` (v2's map, relevance filter per probe
   token); classes 2 and 5 path items → `path <probe> <probe_to>`; class 3 → `query`;
   class 4 → `tests-for`; classes 6 and 7 → `impact`; class 5 symbol items → `affected`
   + `query`. Every returned relation is the answer for `path`; endpoints contribute a
   file only when their pre-`#` segment carries a file extension and is not a `symbol:`
   placeholder (v2's rule). Any non-zero exit aborts the run.
3. **foreign `graph.json`.** A third-party code-graph export of each subject at its pin,
   produced on the maintainer's machine and recorded without the tool's name, read by a
   reader under `internal/bench/` that maps its relation and confidence names onto the
   engine's. When no such export exists at run time the arm is reported **ABSENT** —
   never imputed, never replaced by another tool.

`declared_in` fields are read by the oracle and the human checker only; no arm receives
them.

**F**: **floor** — the agent with read, search, edit and test tools; **floor + native
tools** — the same agent plus the engine's verbs. Same model, same effort setting, same
prompt apart from one tool-scope sentence, a fresh session per task and arm, and the
same token and wall-clock caps per task. Neither prompt states an expected outcome.

## Bars (step 2.4), fixed now

**A–E, per scored class:** the native arm **WINS** the class iff its mean recall is at
least **+10 percentage points** above the grep arm's AND its mean precision is no more
than **5 percentage points** below the grep arm's. Otherwise `TIE` (recall within
10 pp, precision floor met) or `NULL` (precision floor failed). The foreign arm is
scored against the grep arm by the same rule and reported; it does not enter the null
path. Alongside, and with **no bar**, a **calibration diagnostic** per arm that labels
confidence: each returned item's predicted class (the arm's confidence label) against
gold, and the **overconfidence rate** — the share of items carrying the arm's highest
confidence label that are not in the truth set.

**F, primary:** **solved per 100k tokens, floor + native ≥ 1.25 × floor.** Also
published: solved per minute and the **escaped-regression rate** (tests green at
`parent_sha` and red on the agent's tree, per task). A localise-and-fix task is solved
when the tests the upstream fix added or changed pass on the agent's tree; a review task
is solved when the agent's named files equal `held_out`, scored by set comparison with
no LLM judge.

**F gate:** suite F is scored only if `dispatch-event-capture-reliability` measures
**≥ 95 %** on the run's own audit stream. Below that, suite F is reported **GATED** —
neither a pass nor a null.

**Amendment of 2026-10-27, applied:** token cost is measured against a grep-and-read
agent (the floor arm), never against reading the whole corpus. The headline is **sum
over sum** — Σ solved ÷ Σ tokens across tasks, never a mean of per-task ratios. Every
figure is reported **per question class and per language**, with at least one
non-TypeScript language (PHP carries 38 of 45 questions and most of suite F).

## Null path, stated now

If **fewer than 4 of the 6 scored classes** (1, 2, 3, 4, 6, 7) **WIN**, the graph-first
wording stays withheld and the `code-intelligence` skill names the classes that did not
win. Suite F's result is published either way and does not substitute for a class win.

## No renegotiation

No bar, class assignment, verb map, sampling seed, exclusion rule or question moves
after this document is committed. A question found malformed during the oracle run is
**VOID** and listed with its reason — it is never rewritten, replaced or re-probed.
Results are published in both directions; a null is a complete success of this
registration. Any change of input after commit changes a hash below and voids the run;
a corrected experiment is a new, dated registration, never a repaired continuation.

## Kill register, as it binds here

K1 the oracle is never an arm or provider · K2 every input is in this directory and
hashed · K3 suite F review tasks and step 3.5 are scored by set comparison, no LLM judge
· K4 no fused arm on A–E · K5 every language scored here has a fixture and a class (PHP,
TypeScript, Vue, JavaScript, Blade via the directive scan) · K6, K7, K8 are untouched by
a measurement.

## Honest limits, stated before the data

- **Small n.** 4–12 questions per class and 3 route-trace questions per subject. This
  can show a large difference and cannot show a small one; a TIE is the expected verdict
  for anything below the +10 pp bar.
- **Author bias toward grep.** The corpus author found every question by reading source
  with grep. Questions whose answer grep cannot even locate are under-represented, which
  favours the grep arm. Stated, not corrected.
- **Language skew.** PHP dominates; the TS/Vue/JS cells hold 7 questions and are
  descriptive, not verdict-bearing.
- **The F gate may not open.** The last reading of `dispatch-event-capture-reliability`
  was 85.7 % (`docs/CLAIMS.md`, 2026-08-30), below the 95 % gate. If the run-time reading
  is still below it, suite F is GATED.
- **Contamination.** Suite F's fixes date from July–October 2026; recall of them from
  training data cannot be excluded. Both F arms share the exposure.
- **Generated code is absent.** `larasend`'s Wayfinder route helpers are gitignored and
  are not at the pin; no arm runs code generation, so cross-plane links through them are
  out of reach for every arm alike.
- **Hop strata are estimates** until the oracle re-derives them.
- **One author.** The questions, `basis` lines, D-reasons and F paraphrases were
  written by one agent session without an independent check; the 20 % human sample and
  the oracle are the independent legs.
- **Suite F executes subject code** (the upstream tests). That runs in the runner's
  sandbox at run time; registration executed nothing from either clone.

## Hashes (SHA-256, `shasum -a 256`)

Registered inputs — any edit after commit voids the run:

```
e89a68cc998ea94a3fcd11556cd1398085b2a9ab1e994e444490ac07fba813dc  internal/bench/code-graph/corpus-v3-2026-11-05.yaml
0404c200fcaf6caa411c37a8c68901f370582d72b3e06ba1326af4fe470c0c9d  internal/bench/code-graph/suite-f-tasks-v3-2026-11-05.yaml
719885107aae85f1031314b822ee5d8e1dfc4e0d1d784a644b6a98862307f00b  internal/bench/code-graph/inrepo-corpus-v2-2026-08-29.yaml
2730bfbd9d0bc19b1f19290cacc4f37b3261b9200199fb69eb311652aed1d606  internal/bench/code-graph/PREREGISTRATION-inrepo-v2-2026-08-29.md
9c836af05639b12bab65b7e31d9fdf6b425acb3a4758ac73e8d603e54dc20189  internal/bench/code-graph/run_bench_inrepo_v2.ts
2b3a6ccf73b7715ff1c0086505d51675df7b612075de230a623b1639561917a7  src/skills/threat-modeling/data/threats.csv
```

The suite A corpus hash equals the one v2 registered, so suite A is v2 unchanged. The
v3 runner and the oracle runner do not exist yet; they are committed **before** the first
run and bind themselves to the hashes above, refusing on mismatch, as the v2 runner does.
