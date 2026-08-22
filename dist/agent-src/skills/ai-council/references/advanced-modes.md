# ai-council — advanced modes

> Mode body of the [`ai-council`](../SKILL.md) skill (router-head retrofit,
> 2026-08-20). Content moved VERBATIM from SKILL.md — load this file when the
> mode table in SKILL.md routes here.

## Multi-round debate (`rounds:N`)

`consult(..., rounds=N)` enables 2-3 round critique loops. Round 1
runs the standard single-round flow. Round 2+ rebuilds the user
prompt as `<original artefact> + <prior round, anonymised>` so each
member can refine, agree, or push back on the previous critique
without seeing which provider produced which point.

The default round count comes from `defaults.min_rounds` in
`~/.event4u/agent-config/settings/.ai-council.yml` (default `2` so members critique each other
at least once before convergence). The host agent does **not** ask
"how many rounds?" when the requested count is `<= min_rounds` —
the settings owner already made that decision. Ask only when a
genuinely complex artefact justifies more depth than the default.

### Deep-reasoning tier (`council_depth: deep`)

Architecture review, refactoring proposals, and bug-diagnosis runs
benefit from an extra critique round. The deep tier is opt-in per
artefact:

1. The consuming **rule, skill, or command** declares
   `council_depth: deep` in its frontmatter. The schema accepts
   **only `deep`** — `standard` is the implicit default and is
   rejected by the linter (every frontmatter byte costs context
   window; see `scripts/schemas/{rule,skill,command}.schema.json`).
   To return an artefact to default depth, **delete the key**.
2. The **host agent** reads that frontmatter when it dispatches the
   council and passes `--depth deep` to `council_cli`. If multiple
   active artefacts disagree, **deep wins** (max policy).
3. The **CLI** floors the round count at
   `max(ai_council.deep_min_rounds, ai_council.min_rounds)` —
   defaults to `3` and `2` respectively. Lowering `deep_min_rounds`
   below `min_rounds` has no effect (defensive max).

The CLI itself has no knowledge of frontmatter; the contract is the
flag. Resolution chain (highest priority first):

```
--rounds N           → explicit, any value (user override)
--depth deep         → max(deep_min_rounds, min_rounds)
(no flag)            → min_rounds (default 2)
```

| Property | Behaviour |
|---|---|
| Default count | `ai_council.min_rounds` (default `2`). Override per-invocation with `rounds:N` (or `--rounds N` to the CLI). |
| Deep floor | `ai_council.deep_min_rounds` (default `3`). Activated by `council_depth: deep` in artefact frontmatter (host translates to `--depth deep`) or explicit `--depth deep` on the CLI. Floored at `min_rounds`. |
| Anonymisation | Provider/model identity is stripped. Reviewers are labelled `Reviewer A / B / C…` in input order. |
| Errored prior responses | Skipped — they reveal nothing useful and can leak provider error formats. |
| Cost budget | Accumulates across rounds. A round-2 call that breaches the cap fires `on_overrun` exactly like a round-1 breach. |
| Daily limit | Same — every billable round-2 call records spend in the rolling 24h ledger. |
| Return value | Final round only. Use `on_round_complete(round_idx, responses)` to capture intermediate rounds for rendering. |

> Iron Law: anonymisation is non-negotiable. If you ever need to
> surface "which model said what" between rounds, that is a different
> feature — debug-only, off by default, never enabled in user-facing
> output. The neutrality contract dies the moment a member learns it
> is talking to Claude vs GPT in round 2.

Pre-call estimate must surface the round count: total = `N × single-round cost`. Render inline:

```
External council call — billable · 2 rounds
Round 1: artefact only
Round 2: artefact + anonymised round 1 critiques

| member             | per-round | × 2     |
|--------------------|----------:|--------:|
| anthropic/sonnet   |   $0.0176 | $0.0352 |
| openai/gpt-4o      |   $0.0121 | $0.0242 |
| **total**          |           | $0.0594 |
```

### Manual-mode parity

The orchestrator drives rounds the same way for `api` and `manual`
transports. One round = one full pass over every enabled member,
top-to-bottom, then `_augment_for_next_round()` folds the
anonymised critiques into the round-N+1 user prompt. For manual
mode this means: emit the round-1 block for member A → user
pastes A's reply → next member B → user pastes B's reply → host
agent consolidates round 1 → emit the round-2 block (now carrying
the anonymised round-1 critiques) for member A → … and so on
until the configured round count is reached. ManualClient's
internal "more feedback" follow-up loop (1 / 2 / 3 menu) is
**inside** a single member's chat thread and is orthogonal to the
orchestrator-level rounds.

### `/council debate` sub-command (progressive disclosure)

`/council debate <artefact> [--rounds N] [--continue-as-debate <session>]`
runs an **interactive** multi-round critique with a confirmation gate
between every round so the user can stop the spend at any point.

| Property | Behaviour |
|---|---|
| Round flow | Same orchestrator as `rounds:N` (`run_debate()`), but each round prints its responses then pauses on a y/n prompt before launching the next round. |
| Cost gate | After every round the CLI prints `Spent so far: $X · Next round: ~$Y · Cap: $Z`. `n` exits cleanly with partial results; `y` continues. |
| Hard cap | If the projected next-round cost would breach `max_total_usd`, `run_debate()` raises `DebateCapExceeded` and the CLI exits with the partial transcript. No silent overrun. |
| `--continue-as-debate` | Seeds round 1 from an existing `/council default` (or analysis lens) session. No round-1 API calls are billed; round 2+ run normally. Member list must match. |
| Session files | One file per round under `agents/runtime/council/sessions/<slug>/debate-round-NN.md`. |
| Anonymisation | Identical to `rounds:N`. The continue-as-debate path also anonymises the seeded round-1 responses when building the round-2 prompt. |

Use this when the artefact is genuinely contentious and the user
wants to control depth interactively. For a fire-and-forget
multi-round run, prefer `consult(..., rounds=N)` or `--rounds N` on
`/council default`.


## Karpathy peer-review (opt-in)

After the final deliberation round, an optional **anonymous peer-review
pass** lets each member critique the *other* members' responses for
blind spots before synthesis. Inspired by Andrej Karpathy's "ask the
strongest models to review each other anonymously" pattern; see his
[talks / threads on inter-model critique](https://karpathy.ai/) and the
internal verdict in
`agents/runtime/council/sessions/2026-05-14-ai-council-redesign/round-2.md`
(R2 split: one approve-as-flag, one reject-as-default → opt-in only).

Pipeline order when every feature is active:

```
deliberation rounds → peer-review → consensus-scoring → synthesis
```

Activation — two equivalent paths:

* CLI: `--peer-review` on `council:estimate` or `council:run`.
* Config: `ai_council.peer_review.enabled: true` in
  `~/.event4u/agent-config/settings/.ai-council.yml`. Default is `false`.

Mechanics:

1. The final deliberation round's outputs are anonymised into
   `Response-A`, `Response-B`, … in stable input order. Provider /
   model identity is stripped (Iron-Law neutrality holds); empty or
   errored deliberation responses are skipped.
2. Each member receives an N−1 view (its own response filtered out)
   plus the Karpathy prompt: *strongest response*, *weakest blind
   spot*, *what did everyone miss*, *refinement*.
3. The N critiques flow back into synthesis through a
   "Peer-Review-Surfaced Blind Spots" addendum on the lens template.
4. **Advisor preserve-persona (R4 Q3, hard-coded):** when the
   deliberation was an advisor-mode run (Phase 6), anonymisation
   strips provider identity but **preserves the advisor persona
   label**. Peer-review renders as `Response A (Contrarian)`, never
   `Response A (Anthropic Opus)`. Plain-member runs strip identity
   entirely.

Cost — adds exactly N billable calls (one per member) at the same
per-call cost as a deliberation call. The `council:estimate` table
surfaces the delta as a `+peer-review: +N calls (~+$X)` row.

Needs ≥ 2 distinct deliberation outputs; below that the round is a
no-op and nothing extra is billed. Self-review is structurally
impossible — a member never sees its own response.

## Thinking-style advisors (replace-mode)

Phase 6 introduces five **advisor personas** that the council can adopt
in *replace-mode*: an enabled advisor substitutes its bound member's
plain call with the same provider running the advisor's persona prompt.
Total call count stays the same as a plain run — only the system prompt
swaps. Five advisors mirror an external advisor set, each a substantial
persona file (not a tagline):

| Advisor | Default bound member | Focus |
|---|---|---|
| **Contrarian** | `anthropic` | strongest counterargument, hidden assumptions |
| **First-Principles** | `anthropic` | strip metaphor, derive from physics / math / cost |
| **Expansionist** | `openai` | adjacent opportunities, second-order effects |
| **Outsider** | `openai` | naive-but-sharp questions, beginner's-mind probes |
| **Executor** | `anthropic` | what ships this quarter, what blocks delivery |

Activation — edit `~/.event4u/agent-config/settings/.ai-council.yml` and flip the advisor's
`enabled: true`. Optional `model: <name>` overrides the bound member's
default model. Validation rule: an advisor referencing a disabled
member fails closed at config load — never silently skipped.

```yaml
advisors:
  contrarian:
    enabled: true        # ← swap anthropic's plain call for contrarian
    member: anthropic
    # model: claude-opus-4   # optional pin
```

`council:estimate` surfaces every active swap on a dedicated line above
the cost table:

```
council:estimate · mode=prompt · members=2 (billable=2)
  advisor: Contrarian on anthropic via claude-sonnet-4-5
anthropic/claude-sonnet-4-5: ~991 in + 256 out  =  $0.0068
openai/gpt-4o: ~208 in + 256 out  =  $0.0031
```

Cost-bounded guarantee — replace-mode never adds calls. The advisor
persona prompt is larger than a plain prompt (~1k extra input tokens
per swap), so the per-call estimate widens slightly. Output tokens and
call count are unaffected.

Peer-review interaction — when peer-review fires on an advisor-mode
run, anonymisation **preserves the advisor persona label** while
stripping provider identity: `Response A (Contrarian)` instead of bare
`Response A`. See §Karpathy peer-review point 4 for the contract.

One-per-provider invariant — two enabled advisors targeting the same
member is a config error (replace-mode runs exactly one advisor per
provider; the call plan never doubles up by accident).

## Decision-replay artefact (Phase 9, audit trail)

Every session that runs consensus scoring drops a
`decision-replay.md` next to the saved `responses.json`. Pure
projection of the consensus block plus the final-round per-member
texts — **no extra model calls, no extra spend**. Surfaces, per top
finding: verdict band (Strong/Moderate/Weak), evidence-quality bucket
(H/M/L), agree/dissent split, and one key argument per member.

Two render modes:

* **Full** (default) — per-member arguments attributed to
  `provider:model`. Reasoning is traceable, vendor identity is
  visible.
* **Redacted** — verdict + evidence-quality + counts only. Use for
  surfaces where attributing reasoning to a specific model would leak
  vendor-preference signal.

Toggles (config, see `ai-council-config § Decision-replay artefact`):

* `ai_council.decision_replay.enabled` — master switch (default
  `true`).
* `ai_council.decision_replay.include_member_arguments` — flip to
  `false` for redacted-by-default.
* `ai_council.lenses.<lens>.decision_replay.*` — per-lens override
  beats the global block.

CLI:

* Written automatically by `council run` whenever the lens triggers
  consensus scoring.
* `council replay <responses.json>` re-renders from a saved session;
  `--redact-member-arguments` / `--include-member-arguments` flip the
  view independent of config. Useful for sharing a redacted variant
  of an already-paid run.

## Lightweight-QA fast-path (Phase 11)

Low-impact questions classified by Phase 10's impact router can route
to a restricted fast-path instead of the full debate loop. The
trade-off is explicit: **1 round · ≤2 members · $0.05/answer · 2500
tokens**. No advisors, no peer-review, no consensus scoring — the goal
is a quick answer with a transparency marker, not a deliberation.

### Iron Law

`high_impact` and `user_required` **never** route to the fast-path,
regardless of config. Schema validation rejects the override. The
fast-path only activates when:

1. `ai_council.enabled: true` AND
2. `decision_resolution.low_impact.mode: council` AND
3. At least one member has `participate_low_impact: true` (default
   `false` — explicit opt-in per member).

Default route for `low_impact` is **`agent`** — nothing reaches the
council without an explicit two-knob opt-in (flip the class to
`council` *and* mark at least one member `participate_low_impact: true`).
See [`ai-council-config § Low-impact council opt-in`](../../../../../docs/contracts/ai-council-config.md#low-impact-council-opt-in)
for the worked YAML example, validation behaviour, and unavailable-marker
contract.

### Output marker (always surfaced)

* **Resolved** — `> Resolved via low-impact council (anthropic): <one-line answer>`
* **Split** — `> Low-impact council split — escalating to user (anthropic: X / openai: Y):`
* **Aborted** — `> Low-impact council aborted (token cap) — escalating to user:`

The marker is mandatory: the agent never silently substitutes a
fast-path verdict for its own answer.

### Session artefact

Every fast-path attempt appends one line to
`agents/runtime/council/sessions/<date>-<slug>/low-impact-resolutions.md`:

```
2025-05-14T10:00:00Z | resolved | members=2/2 | members(anthropic, openai) cost=$0.0034 | Q=Service vs Repository for this read path?
```

Append-only, one line per resolution. The parser tolerates free-form
section headers around the canonical lines, so the artefact may grow
human notes without breaking aggregation.

### `council replay --low-impact-stats`

Re-projection of the session log into a summary block:

```
$ council replay agents/runtime/council/sessions/2025-05-14-foo/responses.json --low-impact-stats
# Low-impact fast-path · session summary

- attempts: 4
- status: aborted=1 · resolved=2 · split=1
- members: anthropic=4 · openai=3
- total cost: $0.0096
```

No model calls — pure parse of the markdown log. Returns 0 when the
session had no fast-path entries (a clean session is not an error).

