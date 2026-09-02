---
stability: beta
keep-beta-until: 2026-09-04
---

# Plan review gates — machine-checked grammars (v1)

**Purpose.** Single source of every machine-checked grammar in the plan
governance layer: Gate R1 (plan-risk review), Gate R2 (completion review),
and the Gate C→R1 handoff state. The validators
([`lint_plan_risk_register.ts`](../../src/scripts/lint_plan_risk_register.ts),
[`check_completion_review.ts`](../../src/scripts/check_completion_review.ts))
implement exactly what this file defines; a divergence is a validator bug,
never a contract reinterpretation.

**Scope.** Marker + table grammars, honest-null and skip-declaration line
grammars, the substantial-change heuristic, the R2 context-manifest schema,
the C→R1 handoff state schema, the metrics event floor, and the validator
exit-code contract. Agent-side procedure lives in
[`plan-confidence-gate`](../../src/agent-src/contexts/execution/plan-confidence-gate.md)
(Gate C) and the gated surfaces. Settings keys:
`planning.challenge_on_create` / `planning.risk_review` /
`planning.completion_review` in
[`agent-settings.template.yml`](../../src/config/agent-settings.template.yml)
(missing key = `true`).

**Host boundary.** Hook-capable hosts get the pre-push layer;
instruction-file-only hosts (e.g. Copilot) rely on the agent-side authoring
step plus CI as the authoritative gate. CI is authoritative on every host;
the pre-push hook is defence-in-depth, the agent-side step is advisory.

## 1. Gate R1 — Risk Register grammar (`risk-review: v1`)

A **ready** plan file under a roadmaps directory MUST contain a
`## Risk Register` section. Two frontmatter statuses exempt it, and the
validator reports each under its own name so its output never names a state it
did not act on:

| `status:` | Reported as | Exempt because |
|---|---|---|
| `draft` | `draft-exempt` | not yet a plan — the exemption lifts when it flips to ready |
| `carrier` | `carrier-exempt` | not a plan at all — it holds obligations deferred out of an archived parent, each with an unmet resumption trigger, so a plan risk register for it would be manufactured rather than reported |

`carrier` was added on 2026-09-02, when that status shipped, and this table is
where it becomes contract rather than validator behaviour: the validator had
been exempting it against a § 1 that named only `draft`, which this file's own
header defines as a validator bug. The category reason is the one that also
exempts a carrier from `check_roadmap_trackable`'s `## Phase` requirement, and
the exemption is not free — `lint_carrier_integrity` requires every live
carrier to be named by some archived parent's `deferred-resolution:
carried-to=` annotation, so the status cannot be worn to collect exclusions.

**Enforced corpus — narrower than the obligation (R2 round-3 finding 9).**
The validator's corpus is the **top level of `agents/roadmaps/` only**.
Three plan surfaces carry the § 1 obligation and are **not** machine-checked:

| Surface | Status |
|---|---|
| `agents/roadmaps/*.md` (top level) | **enforced** — pre-push + CI |
| `{module_root}/*/agents/roadmaps/*.md` (module-scoped, `templates/roadmaps.md`) | obligation stated, **not enforced** |
| feature docs from `/feature:plan` (outside any roadmaps dir) | obligation stated, **not enforced** |
| `archive/`, `skipped/`, `later/`, `stubs/` | deliberately out of scope |

The dead-scan-scope assertion cannot surface this gap, because the configured
root does resolve — the corpus is simply narrower than the rule. Widening it
means enumerating module roots via `enumerate_modules()` and deciding what a
"plan" is outside a roadmaps directory; that is a scope decision, not an
oversight, and it is left open rather than silently claimed. Read the
acceptance criterion "a ready plan without a valid Risk Register fails
pre-push and CI" as scoped to the enforced row above.

**Grandfather clause (council 2026-08-04, anthropic/claude-sonnet-4-5 +
openai/gpt-4o, convergent).** Gate activation date: **2026-08-04** — this
line is the committed source of the constant the validator carries
(`RISK_REGISTER_GATE_ACTIVATION`). A ready roadmap without a register is
**exempt** while its content has had no *substantial* change (§ 3) since
the activation date, measured against the file's last committed version
**strictly before** the activation date (a file first committed on or after
the date has no baseline and is never exempt). Any later substantial change
lifts the exemption for that file permanently. Exempted files are reported as `grandfathered`,
never silently skipped. Rationale: no retro-noise on ~14 pre-existing
active roadmaps, no bulk agent-written pro-forma registers (the Risk-4
gate-fatigue failure), and the exemption self-expires as files churn.

**Why strictly-before, not on-or-before.** Commit dates are day-granular
(`git log --format=%cs`). With an inclusive bound, a substantial change
committed *on* the activation day becomes its own baseline and grandfathers
itself — the exemption would cover exactly the change the gate exists to
catch. The strict bound is fail-closed: a plan whose only history is the
activation day carries a register like any new plan.

**Residual (accepted, § 1.1 staleness only).** The same day-granularity makes
a same-day pair (substantial change + `reviewed:` date on one day)
indistinguishable from "reviewed after the change". The staleness check
resolves that ambiguity in favour of passing, because a reviewer *claiming*
review on day D plausibly reviewed after the day's edit — and the strict
bound cannot be used here without making "changed and reviewed today"
unsatisfiable. The cost is bounded: the claim is still recorded and
auditable in the marker.

### 1.1 Marker line

The first non-blank line after the `## Risk Register` heading MUST be:

```
<!-- risk-review: v1 | reviewed: YYYY-MM-DD | reviewer: <agent-id|human> -->
```

- `reviewed:` — ISO date. **Staleness rule:** the date may not be older
  than the date of the last *substantial* change to the plan (§ 3). Stale
  = fail. Staleness is decided against **committed** history (the newest
  commit dated `<= reviewed:`), so while the plan file carries *uncommitted*
  modifications the check is **skipped**: the current content has no committed
  baseline yet, and comparing it against the previous commit reports a register
  written the same minute as stale. The committed case is unchanged — a
  committed substantial change with an older `reviewed:` date still fails.
- `reviewer:` — free identifier (`claude/host`, `human`, `gpt-4o`, …);
  non-empty.

### 1.2 Table rules

```markdown
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1    | ...  | product \| implementation | ... | ... | Phase 2 Step 3 |
```

- Header row exactly these six columns, in this order.
- `Rank` strictly ascending integers starting at 1 (most → least risky).
- `Risk type` ∈ {`product`, `implementation`}.
- `Mitigation` non-empty on every row.
- `Anchored under` non-empty on every row and MUST reference a
  phase/step/section heading that exists **in the same document**
  (substring match against the document's headings and `**Step N:**`
  bullets). Dangling reference = fail.

### 1.3 Honest-null grammar (exact)

An empty register is valid **only** as exactly this shape (marker line per
§ 1.1, then one line):

```markdown
## Risk Register
<!-- risk-review: v1 | reviewed: YYYY-MM-DD | reviewer: <id> -->
**Honest-null:** no material product or implementation risks identified because: <reason>.
```

- The line MUST start `**Honest-null:**` and MUST contain `because:`
  followed by a non-empty reason.
- A missing `## Risk Register` section is NOT an empty section: missing =
  fail. An empty section, or a prose-only section ("no risks here")
  without the exact honest-null line = fail.

## 2. Gate R2 — findings artifact grammar (`completion-review: v1`)

Trigger events: (1) a roadmap reaching `count_open == 0` in a session,
(2) PR creation. One artifact covers both when the review scope hash matches.
Artifact location: `agents/evidence/reviews/<branch-or-roadmap-slug>.findings.md`
(tracked — `agents/evidence/` owns "everything evidential" per the
[`agents-layout`](agents-layout.md) directory table; a new top-level
`agents/reviews/` would need a layout-contract edit for no gain).

### 2.0 The review scope — what a review is bound to

```
scope_hash = sha256( git -c core.quotePath=true \
    -c core.attributesFile=/dev/null diff \
    --no-ext-diff --no-textconv --no-color \
    --diff-algorithm=myers --indent-heuristic \
    --unified=3 --inter-hunk-context=0 \
    --src-prefix=a/ --dst-prefix=b/ --no-relative \
    --no-renames --full-index --abbrev=40 \
    --submodule=short --ignore-submodules=none -O/dev/null \
    <base>...HEAD -- :/ \
    ':(exclude,top)agents/evidence/reviews' \
    ':(exclude,top)agents/evidence/metrics' )
```

**The flag set is part of the definition, not a robustness nit.** The hash is the
single cross-machine binding — a local dispatch records it, CI re-derives it
(§ 5) — so anything that changes the diff **bytes** for identical content
produces a blocking `manifest mismatch (stale review)` that no content change
explains. Each flag neutralises one local git config knob at its git default:
`diff.external` (`--no-ext-diff`), textconv attributes (`--no-textconv`),
`color.diff` / `color.ui` and with them `diff.wsErrorHighlight` /
`diff.colorMoved` (`--no-color`), `diff.algorithm`, `diff.indentHeuristic`,
`diff.context`, `diff.interHunkContext`, `diff.noprefix` +
`diff.mnemonicPrefix` (explicit prefixes), `diff.relative`, `diff.renames` /
`diff.renameLimit` / `diff.copies` (`--no-renames`), `core.abbrev` / `diff.abbrev`
(`--full-index` pins the `index <old>..<new>` line, `--abbrev=40` any other
abbreviated oid), `diff.submodule`, `diff.ignoreSubmodules`, `diff.orderFile`
(`-O/dev/null`, its documented canceller) and the two knobs no flag expresses:
`core.quotePath` and `core.attributesFile`. The latter is a **separate layer from
`--no-textconv`**, which suppresses a `textconv` filter only: a `-diff` (or
`binary`) attribute replaces the entire patch body with `Binary files a/x and
b/x differ`, so one developer's user-global `*.ts -diff` entry would record a
different scope hash for identical content. Rename detection is **off** rather
than pinned to a threshold:
it is a similarity heuristic whose outcome also depends on `diff.renameLimit`
and on how many files the diff touches, so even a fixed `--find-renames=<n>`
can flip a rename into an add/delete pair as a branch grows — with it off the
hash depends on content alone. The changed-file list
(`--name-only`) is pinned the same way (`--no-ext-diff --no-color --no-relative
--no-renames -O/dev/null` + `core.quotePath` + `core.attributesFile`), because it
feeds the § 2.4 code-path classification. Dropping a flag silently changes
**every** recorded scope hash; the flag lists live in one place
([`REVIEW_SCOPE_DIFF_FLAGS` / `REVIEW_SCOPE_NAME_ONLY_FLAGS` /
`REVIEW_SCOPE_GIT_CONFIG`](../../src/scripts/dispatch_r2_reviewer.ts)).

**Residual — what "every knob" does not cover.** The pin reaches the *user*
attributes layer, not every attributes layer, and the gap is named rather than
left inside the claim. A **tracked** `.gitattributes` is part of the reviewed
content and is therefore byte-identical on every checkout — not a cross-machine
variable at all. `$GIT_DIR/info/attributes` **is** one: per-clone, untracked, and
with no command-line override, so it stays un-neutralised; the same holds for the
system-wide `etc/gitattributes`, which only the `GIT_ATTR_NOSYSTEM` environment
variable disables. A `-diff` entry in either of those two files on one machine
and not another still produces a `stale-review` mismatch that no content change
explains. That is an accepted residual of this definition, not a covered case.

A completion review binds to the **content it reviewed**, never to a commit.
Two facts make a head-sha binding unsatisfiable, so it is forbidden:

1. § 2.5 requires the findings artifact to be **committed**, and CI can only
   see committed state — committing it moves `HEAD` past any sha the reviewer
   could have recorded.
2. On `pull_request`, `actions/checkout` checks out a **synthetic merge
   commit**, so `git rev-parse HEAD` in CI never equals a branch-head sha.

The pathspec exclusions are what make the binding stable: writing, editing, or
committing anything the gate itself produces cannot change the hash. Both
excluded paths are gate-owned outputs —
`agents/evidence/reviews` (the findings artefacts, § 2.1) and
`agents/evidence/metrics` (the outcome events § 7 **mandates** appending). A
gate-owned output left inside the scope re-creates the self-invalidation this
section exists to eliminate: the commit that records the review would
invalidate it. Any future gate-owned evidence path joins this list.

**Merge-commit invariance — and its one precondition.** `base...HEAD` is
`merge-base(base, HEAD)..HEAD`, so it yields the same net diff on a branch head
and on a merge commit of that branch: the hash is identical on both checkouts
**as long as the recorded base is the same merge-base the review used.** If the
base branch advances in a file the branch also touches, the local hash
(fork-point at review time) and CI's (`pull_request.base.sha`) legitimately
differ, and CI reports `stale-review`. That is the intended behaviour, not a
defect — the reviewed content genuinely changed — and the resolution is a
re-review after merging the base in, exactly as for any other content change.

**Single definition.** The scope hash is computed by exactly one exported
function (`computeReviewScope` in
[`dispatch_r2_reviewer.ts`](../../src/scripts/dispatch_r2_reviewer.ts)), which
[`check_completion_review.ts`](../../src/scripts/check_completion_review.ts)
imports. A second, restated copy would silently re-break the gate the moment
the two drifted, so a copy is a contract violation, not a style preference.

**CI selection rule.** A CI step that picks which artefacts to verify MUST
re-derive the scope hash — it must never select by grepping the header for the
current `HEAD` sha, which per (1) and (2) matches nothing. It must equally never
"simply verify every artefact": § 2.6 makes the reviews directory tracked and
accumulating, so every artefact from a previous branch records a different
`scope_hash` and mismatches **by construction** — a verify-everything loop reds
the next gated PR and can only be un-stuck by editing an unrelated branch's
artefact, which is exactly the directory-wide poisoning § 2.6 forbids. The
selection therefore lives inside the single-source script, not in a caller's
shell loop: `dispatch_r2_reviewer --verify-current` computes the current scope,
selects the artefacts relevant to it (reusing the validator's § 2.6 relevance
notion), verifies each, and exits `0` when none is relevant — whether an
artefact was *required* is `check_completion_review`'s question, not the
re-derivation step's. A bare § 2.4 skip declaration is not selected: it carries
no reviewer dispatch and per § 5 needs no manifest.

**Advisory window (Stage A, verdict #20):** until the enforced-mode
threshold is committed to `CLAIMS.md` (after the 10-PR advisory
baseline), the CI wiring invokes the validator with `--advisory`:
violations are reported as warnings and the exit code is `0`. The
enforced-mode switch is the removal of that flag — nothing else changes.

### 2.1 Header

```markdown
# Findings: <id>
<!-- completion-review: v1 | reviewed: YYYY-MM-DD | scope: <64-hex scope_hash> | diff: <sha> | reviewer: <fresh-subagent-id> -->
```

- `scope:` — the § 2.0 review-scope hash, 64 lowercase hex chars. **Stale
  rule:** artifact `scope:` ≠ current `scope_hash` → stale review → block
  (a change to the reviewed content forces re-review). This is the **only**
  field staleness is decided on. Because a fix commit changes the scope, a fix
  pass **re-binds this field in the same artefact, in place** — that is the
  normal path (§ 2.5), not the superseding rename of § 2.7.
- `diff:` — the branch-head SHA at review time. **Provenance only; never
  compared.** It exists so an auditor can locate the reviewed head; a
  validator that compares it re-introduces the unsatisfiable binding § 2.0
  forbids.
- `reviewer:` — the fresh reviewer context id written by the dispatcher
  (§ 5), never the implementing session.

Two OPTIONAL trailing fields, in this order, both added 2026-08-06:

```markdown
<!-- completion-review: v1 | reviewed: … | scope: … | diff: … | reviewer: … | author: <impl-session-id> | prompt_hash: <64-hex> -->
```

- `author:` — the implementing session. It exists so that "`reviewer:` … never
  the implementing session" above stops being a convention with nothing to check
  it against: when `author:` is present and equals `reviewer:` the gate emits
  **`author-is-reviewer`**. Comparison is case-insensitive and trimmed, and
  deliberately no smarter — a gate that guessed two different ids were "really"
  the same principal would start blocking legitimate reviews.
- `prompt_hash:` — sha256 of the reviewer prompt the dispatcher built, written by
  the dispatcher (§ 5). It addresses the residual at § 5 ("the prompt channel"):
  the dispatcher fixes the reviewer's inputs but not the instructions around
  them. It does **not** close that residual — the same host that authors a
  steered prompt could hash the steered text — and it is not claimed to. What it
  buys is an attributable record where there was none, so the never-edited round
  records (§ 2.7) can be checked against the prompt that produced them.

Both are optional because the four `v1` fields are already carried by every
committed artefact under `agents/evidence/reviews/`, and § 2.7 forbids editing a
round record in place: a required field would have been a migration event for the
whole evidence corpus. Absent → no check, byte-identical behaviour to before.
Field ORDER is fixed (`author` before `prompt_hash`); a reordered marker is
`bad-marker`, and a `prompt_hash` shorter than 64 hex is not a hash.

The first four fields are mandatory: a `v1` marker missing `scope:` is malformed
(`bad-marker`), not tolerated — and so is a review-bearing artefact carrying **no
header marker at all** (an artefact of manifest plus honest-null line is not
"nothing to validate"; it is a missing mandatory header, `bad-marker`). `v1` is
unreleased, so there is no backward-compatibility path for the earlier sha-bound
grammar — an artefact carrying it is re-dispatched, not migrated in place.

Because relevance (§ 2.6) ORs the header, honest-null and skip scopes, the header
comparison is what actually decides staleness: an artefact whose header still
points at an older scope while its honest-null line or manifest carries the
current one is relevant **and** stale (`stale-review`).

### 2.2 Findings table

```markdown
| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | critical | src/x.ts:42 | ... | open | |
```

- `Severity` ∈ {`critical`, `high`, `medium`, `low`}, rows sorted
  descending by severity (ties keep authoring order).
- Initial status of every finding: `open`.
- Terminal statuses (Phase-2 fix pass): exactly one of
  - `fixed` — `Reason/Ref` MUST carry a commit ref;
  - `accepted-risk` — `Reason/Ref` MUST carry a reason and who accepts;
  - `deferred` — `Reason/Ref` MUST carry a ticket/issue/roadmap ref.
- Gate rules: any `open` finding → block · `deferred` without ref →
  block · `accepted-risk` without reason → block.
- A findings table and a § 2.4 skip declaration in the same artefact are
  **contradictory** → `bad-value` block. The skip never suppresses the table:
  its rows are validated regardless, so appending a skip line cannot hide
  `open` findings.
- **Malformed row rule:** a table-shaped line (starts with `|`, is neither the
  header nor the separator) that does not parse into **exactly the six cells
  above** is a violation → `malformed-row` block. It is never a row to skip:
  omitting the trailing empty `Reason/Ref` cell is the likeliest authoring slip
  (the template ends in exactly that empty cell), and a dropped row is an
  unreviewed finding that passes — one well-formed row keeps the table
  non-empty, so the "neither table nor honest-null" fallback stays silent too.
  Cells split on **unescaped** `|` only, so `\|` inside a cell is content, not a
  column boundary. Same defect class, same name as Gate R1's `malformed_row`
  (§ 1.2).
- **Fence rule:** a fenced region is skipped as illustrative content **only when
  it is a properly-closed pair whose OPENING fence carries an info string**
  (```` ```markdown ````, closed CommonMark-style by a bare fence of at least as
  many backticks). A **bare** ``` never delimits a region: it is a **stray** →
  `unbalanced-fence` block, the lines around it are parsed as ordinary content,
  and every stray line is named in the one violation. A labelled opener with no
  bare fence after it anywhere in the artefact is a stray too, and skips nothing.

  **Fences do NOT govern row liveness.** The paragraph above describes where
  fences still apply — the § 2.1 marker, the § 2.3 honest-null line and the
  § 2.4 skip declaration, all of which a fenced illustration may legitimately
  quote. **Findings rows are exempt from it entirely** (council 2026-08-04,
  convergent): a findings-shaped row is **live wherever it appears**, fenced or
  not, and only its own Status cell can make it illustrative.

  The asymmetry is deliberate and is the whole safety argument. Hiding a
  *marker* or an *honest-null* line fails **closed** — the artefact then looks
  absent or incomplete and the gate blocks. Hiding a *row* fails **open**: the
  finding silently ceases to exist. So the one line type whose concealment is
  dangerous is the one line type fences may not conceal.

  This replaces the fence-pairing approach, which failed open four times: a
  single `inFence` toggle; positional pairing that mis-paired; the
  labelled-opener rule; and finally a stray bare fence closing a labelled
  opener anywhere later in the file, which hid a live `open` row while
  consuming the opener so no `unbalanced-fence` fired. Each attempt was a
  correct-looking patch of the previous arithmetic. Row liveness no longer
  depends on that arithmetic at all.
  Why a deliberate label is the discriminator: fenced regions exist for exactly
  one purpose — keeping the illustrative `| # | Severity | …` template above from
  being read as a live finding — and every counting-based rule tried before it
  failed open. First a single `inFence` toggle made every line after an odd
  ```-count invisible; then positional pairing detected parity but never
  *mis*-pairing, so two unpaired inner openers paired with **each other** and
  swallowed every line between them while the unterminated-fence report stayed
  silent. Each time, one earlier well-formed row kept the table non-empty, so the
  "neither table nor honest-null" fallback also stayed quiet and an unreviewed
  `open` row PASSED — the same fail-open as a dropped malformed row. An info
  string cannot be produced by accident, so hiding a row now takes the authoring
  act that means "this is an illustration". Note that following
  [`markdown-safe-codeblocks`](../../src/rules/markdown-safe-codeblocks.md) —
  wrap fence-bearing content in an outer `~~~` fence — is what produces those
  unpaired inner ``` fences; the outer `~~~` is not a fence to this grammar.

- **Row liveness — the `example` status (the only illustrative marker).** A
  findings-shaped line (starts with `|`, is neither the separator nor the header
  row) is a **candidate row** wherever it appears. It is illustrative **iff its
  Status cell is exactly `example`**; otherwise it is live. Deterministic
  consequences, no other case:

  | Shape | Verdict |
  |---|---|
  | Status `example` | illustrative — not a finding, never validated, never counted |
  | Status ∈ {`open`, `fixed`, `accepted-risk`, `deferred`} | live — validated per § 2.2 |
  | Status is any other token | **live and blocking** (`bad-value`) — an unrecognised status is never silently ignored |
  | cell count ≠ 6 | **blocking** (`malformed-row`), fenced or not |

  The unknown-token rule is the load-bearing half: it is what makes a typo'd or
  invented marker fail **closed**. A grammar in which an unrecognised status made
  a row disappear would reintroduce the same fail-open through a new door.

- **No `v2` discriminator, and why.** The council recommended version-marker
  migration (`completion-review: v1` → `v2`) on the assumption that many
  artefacts quote the template inside fences and would newly block. That
  assumption was **measured and is false**: across every review artefact in
  `agents/evidence/reviews/`, the count of findings-shaped rows inside fenced
  regions is **zero**, and the skeleton `dispatch_r2_reviewer` generates carries
  **no** example row at all — only the header, the separator and an HTML comment.
  The behaviour change therefore affects no existing artefact, and a version
  discriminator would be machinery guarding an empty set.

  **Trigger to revisit:** if an artefact is ever authored that must keep a
  findings-shaped row hidden by a fence rather than marked `example`, introduce
  `v2` then. Recorded so the omission is a decision with a condition, not an
  oversight.

### 2.3 Honest-null grammar (exact)

"0 findings" is valid **only** as exactly this line in place of the table:

```markdown
**Honest-null:** 0 findings, scope <64-hex scope_hash>, reviewed YYYY-MM-DD
```

The scope hash MUST equal the header's `scope:` value; a disagreement between
the two is a stale review → block.

### 2.4 Skip-declaration grammar (exact)

R2 reviews a **code diff surface**. When there is none (plan-only change,
prose/docs-only deliverable, out-of-repo session, analysis-only session),
the gate records an explicit skip **instead of** a findings artifact —
same file location, this exact body line:

```markdown
**Skipped:** no code surface for this completion — <reason>, scope <64-hex scope_hash|none>, declared YYYY-MM-DD
```

- A missing artifact is never a valid skip; the declaration is.
- `scope none` is valid **only when the § 2.0 review scope is genuinely
  empty**. A `scope none` declaration does **not** satisfy the gate for a
  non-empty scope — otherwise one committed skip would satisfy every later
  diff forever, and "a change to the reviewed content forces re-review" would
  be unenforceable.
- The validator REJECTS a skip declaration when the diff does touch code
  paths. Code paths = `src/scripts/**`, any file whose extension is in the
  validator's `CODE_EXTENSIONS` set — deliberately covering the consumer
  stacks the suite installs into, not just this repo's TypeScript
  (`ts tsx js jsx mjs cjs mts cts vue svelte`, `py pyi rb rake php pl pm`,
  `java kt kts scala groovy cs fs`, `c h cc cpp cxx hpp hh m mm swift go rs
  zig`, `sh bash zsh fish ps1 lua`, `sql ex exs erl dart r`) — and any file
  ending in a template suffix (`.blade.php .html.twig .twig .j2 .erb .hbs`).
  Markdown, YAML/JSON config-only and `agents/**` changes do not count as
  code for this guard (`agents/**` never does, whatever its extension).
  An omitted extension is a real hole: it reclassifies code-bearing work as
  "no code surface" and accepts a skip for it, so the set errs broad.

### 2.5 Findings-before-fixes (anti-silent-fixing)

The findings artifact MUST be committed before the first fix commit:

- **Ancestry check:** the commit that first adds the findings artifact
  must be an ancestor of (or equal to) every commit that marks a finding
  `fixed`. Fix commits that predate the artifact → block.
- **Backdating:** an artifact amended/rewritten to postdate fixes is
  detected via commit ancestry (the artifact's first-add commit is what
  counts, not its latest edit) → block.
- **Re-binding in place is expected, not a violation.** A fix pass changes the
  review scope (§ 2.0), so § 2.1 forces the binding artefact's `scope:` to be
  re-bound; the artefact is edited in place and re-committed, and its first-add
  commit deliberately does not move. § 2.7's rename is the archival step for a
  round that is already **closed and superseded** — it is not an edit ban on the
  live artefact.
- Enforcement point: pre-push hook + CI, dual layer, **CI
  authoritative**; the agent-side check is advisory (warns, never blocks
  local work).

**What the check proves — and what it does not (the limit of § 2.5).** The
resolved commit is the earliest add of the artefact's **path**
(`git log --diff-filter=A -- <path>`, last line), so the check proves exactly
one thing: *the review file existed at that path before the fixes of its FIRST
round.* It does **not** prove per-round ordering, for two independent reasons:

1. re-binding the same `<slug>.findings.md` in place across rounds leaves the
   first-add commit at round 1's add; and
2. the path resolution ignores file identity — after a § 2.7 rename the path is
   re-added, and the earliest add of that path is still round 1's.

Consequence, stated plainly: a round-*N* `fixed` row may cite a commit that
predates round *N*'s own review and still pass. Per-round ordering is
agent-carried convention (dispatch the round, commit its artefact, then fix),
the same stance § 2.7 takes for terminal-before-rename. What § 2.5 does hold
against is the case it was built for: fixing silently and writing the review
afterwards, on a branch whose review file did not exist yet.

### 2.6 Artefact relevance — no directory-wide poisoning

`agents/evidence/reviews/` is **tracked and accumulates**: artefacts from every
past branch stay there. Only two classes of artefact may produce a violation:

1. **Relevant** — the artefact claims the current § 2.0 scope (via `scope:`,
   the honest-null line, or a scope-matching skip).
2. **Own** — the artefact's filename slug matches the current branch slug
   (equal, or either containing the other with a ≥ 4-char floor, so
   `road-to-x.findings.md` counts on branch `feat/road-to-x` while a 2-3 char
   stub cannot match everything).

A foreign or legacy artefact is **ignored**. Without this rule one malformed
leftover in the directory would raise `bad-marker` on every subsequent PR in
enforced mode — a gate that can only be un-stuck by editing an unrelated
branch's artefact. Exactly one root-cause violation is emitted per situation:
an own artefact with a malformed marker reports `bad-marker` and does **not**
additionally report `missing-artifact`.

### 2.7 Superseded rounds — naming, so the glob and the reader agree

The gate's corpus is `*.findings.md`. A round that is **closed and superseded**
— every finding terminal, its scope dead because the next round's review will
bind the new content — is **renamed out of that glob**; the convention is
`<slug>.round<N>-review.md`. The rename is an **archival step at the end of a
round, never an edit ban on the live artefact**:

- **Within a round, the binding artefact is re-bound in place.** The fix pass
  changes the review scope (§ 2.0), so `<slug>.findings.md` is edited — new
  `scope:`, rows flipped to terminal — and re-committed. § 2.1 requires exactly
  that (`scope:` must equal the CURRENT scope), § 2.5 names it as expected, and
  the validator's own pass fixture exercises it. Renaming instead of re-binding
  here would leave the shipping content with no review at all →
  `missing-artifact`.
- **`<slug>.findings.md`** — exactly one per branch: the **binding** review of
  the content as it ships. This is what the gate reads.
- **`<slug>.round<N>-review.md`** — superseded rounds, kept as the audit trail
  that explains why the fixes exist. Outside the glob **on purpose**: each is
  bound to a scope that no longer exists, so leaving them in the corpus would
  mean permanent `stale-review` noise.

State this because the shapes are indistinguishable otherwise: a directory
holding only `round<N>-review.md` files means "no review of the current
content" and the gate correctly reports `missing-artifact` — it does not mean
the glob is broken.

**Terminal-before-rename — enforced by `check_review_dispositions`.** Every
finding in a superseded round must already be terminal before it is renamed;
the rename records the review, it never retires an open finding. Renaming moves
the file out of the `*.findings.md` glob, so § 2.2's "any `open` row → block" no
longer sees it — an artifact renamed while still holding an `open` row escapes
Gate R2 entirely.

This was carried as `enforced_by: none` and it failed in exactly the predicted
way: five findings in `postmerge-blindpass-review.md` sat recorded as `open` for
a day after two of them were fixed, in this repo's own corpus, with the diff
reviewed. "A human reading the diff catches it" turned out to be the thing that
did not happen. `check_review_dispositions` now reads the archived records and
blocks a non-terminal or unreferenced row.

**Why this does not re-introduce the § 2.6 coupling.** The earlier objection —
that walking renamed rounds re-creates directory-wide poisoning — assumed the
check would bind those rounds to the current review scope, which is what made
directory-wide selection toxic: one branch's artefact reds another branch's PR.
This check never reads `scope:` and never compares an archived record to the
current diff. It asserts one scope-free property — *a closed round records
closed findings* — so an unrelated branch's archived record cannot red this
branch, and § 2.6's selection rule for R2 is untouched.

**What it deliberately does not check.** Reference *shape*. The first draft
resolved a `fixed` ref via `rev-parse` and a `deferred` ref via a path probe;
measured against the real corpus it produced eight blocks, every one a
pre-existing record whose reference is prose describing the change or a carrier
named by bare slug — none of them the failure this gate exists to catch. Archived
records are frozen, so a shape rule cannot be satisfied retroactively without
editing them, and a gate whose only output is unfixable blocks is the gate that
gets switched off. The rule is therefore: terminal status, non-empty
Reason/Ref. Revisit when an unresolvable reference actually hides a disposition
on a record written after this gate shipped — that record is fixable at source,
and the trade-off changes.

## 3. Substantial-change heuristic (R1 trigger)

A plan diff is **substantial** when at least one of:

1. a phase/milestone heading (`## Phase …`, `## Milestone …`) is added,
   removed, or renamed;
2. deliverable checkbox lines (`- [ ]` / `- [x]` / `- [~]` / `- [-]`) are
   added or removed (count change, not state change);
3. content inside the `## Acceptance criteria` section changes. The heading is
   matched **case-insensitively and without an end anchor**, the same way § 4's
   dispatcher reads it — one shared predicate, `src/scripts/_lib/ac_heading.ts`.
   Corrected 2026-08-20: the R1 validator carried its own case-sensitive,
   end-anchored copy, so for 8 of the 32 ready roadmaps it hashed the empty
   string and no acceptance-criteria edit could read as substantial. The gate
   still exited 0 throughout, which is why a third copy of one regex is recorded
   here as a contract fact rather than left to each call site.

**Never substantial:** checkbox state flips (`[ ]`→`[x]` etc.), typo /
prose-only edits outside the blocks above, dashboard regen, archival
moves. FP/FN fixtures for this heuristic are part of the validator test
suite and act as its regression contract.

## 4. C→R1 handoff state schema

Written by the Gate C flow only, at
`agents/runtime/state/gate-c-<plan-slug>.json` (gitignored, local-only):

```json
{
  "plan_slug": "csv-export-events-dashboard",
  "plan_hash": "<sha256 of the pitch/plan draft the interview converged on>",
  "timestamp": "2026-08-04T09:30:00Z",
  "resolved_branches": [{ "q": "<question>", "a": "<resolved answer>" }],
  "transcript_ref": {
    "path": "agents/runtime/state/gate-c-<plan-slug>.transcript.md",
    "content_hash": "<sha256 of the transcript file>"
  }
}
```

- `transcript_ref` is **mandatory** — path + content hash of the interview
  transcript artifact, so a forged state file requires a forged transcript.
- Freshness: R1 consumes the state only when present, `plan_hash` matches
  the current draft, and the session is the same one that wrote it;
  otherwise R1 runs fresh. No TTL — session-bound by design.
- **Write-path rule:** only the Gate C flow writes
  `agents/runtime/state/gate-c-*.json`.

### 4.1 Enforcement of § 4 — `enforced_by: none` (stated, not implied)

```
EVERY OBLIGATION IN § 4 IS AGENT-CARRIED. NO VALIDATOR READS THE HANDOFF
STATE, THE TRANSCRIPT, OR THE WRITE-PATH GLOB. DO NOT READ § 4 AS A GATE.
```

This is the one section of this contract that describes a convention rather
than a mechanism, so it says so in its own words:

- `lint_plan_risk_register` contains **no** reference to `gate-c-*`,
  `transcript_ref`, or `plan_hash`. "R1 checks existence + hash match"
  describes what the **agent** does when it consumes the state during the
  authoring flow — not a machine check. An earlier draft of this contract
  (and verdict #19 in the archived roadmap) asserted the validator performed
  it; that was an overstatement, corrected here — R2 round-3 finding 4.
- The write-path rule has **no** lint and no hook entry. It binds the agent;
  a human reading the diff is what catches a violation.
- The state file is gitignored (`/agents/runtime/`), so none of it is visible
  to CI at all. A CI-facing check would mean moving the state into the
  tracked tree — a different design decision, not made here.

**Threat model (verdict #19), restated against what actually ships:** the
convention defends against *silent agent shortcuts* — an agent that skips the
interview and claims resolved branches leaves a missing or mismatched
transcript a human can spot. It does **not** defend against the local human,
who holds a legitimate settings escape hatch
(`planning.challenge_on_create: false`) anyway, so forgery gains nothing that
cannot be done openly. Detectability over prevention, by design.
Cryptographic tamper-proofing is refused: a secret stored in a local repo is
not a secret. Since detection is human-only here, § 4 is honestly
`enforced_by: none` — the same stance `security-sensitive-stop` and
`untrusted-input-defense` take for obligations only the model can carry.

## 5. R2 context manifest — verification, not self-attestation

The Phase-1 reviewer is a **fresh subagent without the implementation
context** (blind-review pattern). The artifact header carries a context
manifest so isolation is checkable:

```markdown
<!-- context-manifest: v1
inputs:
  diff_sha: <sha — provenance only, never compared>
  scope_hash: <64-hex § 2.0 review-scope hash — compared>
  roadmap: <path>
  roadmap_hash: <sha256>
  ac_hash: <sha256 of the extracted acceptance criteria, or `none` when there are none>
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: YYYY-MM-DDTHH:MM:SSZ
-->
```

- **The manifest is MANDATORY.** A findings artefact that carries a review
  (marker, table, or honest-null) and no parseable manifest is a **policy
  violation** — `missing-manifest` in the validator, exit `1` in
  `dispatch_r2_reviewer --verify`. It is explicitly **not** an internal
  error: exit `2` means warn-and-allow per § 6, so treating an absent
  manifest that way would let anyone bypass the whole verification layer by
  simply deleting the block, defeating "verification, not self-attestation".
  Exit `2` in `--verify` is reserved for genuine internal failures (the file
  is missing or unreadable, git fails). A bare § 2.4 skip declaration
  carries no reviewer dispatch and needs no manifest.
- **Acceptance criteria are read in BOTH authored forms, and a failed extraction
  is said out loud.** The dispatcher extracts either a `## Acceptance criteria`
  section — heading form, case-insensitive and tolerant of trailing qualifier text
  such as `(per phase)`, 23 of the 44 active roadmaps as of 2026-08-18 — or inline
  `- **AC-n:**` bullets declared per phase (7 of 44), at any indent and with
  either bullet marker, including their loose-list continuation paragraphs. The
  heading form wins if a file ever carries both. The remaining 14 roadmaps declare
  no criteria in either form.

  When the extraction comes back empty, `ac_hash` is **`none`** and the reviewer's
  prompt says that no criteria could be **extracted** — naming both possible
  causes, a roadmap that declares none and a roadmap that declares them in an
  unrecognised shape, because the dispatcher cannot distinguish them. It must not
  assert the first: an affirmative "this roadmap declares no criteria" is strictly
  worse than silence, since silence invites the reviewer to look and a false
  assertion forecloses it.

  One predicate decides "are there criteria" for both the manifest and the prompt
  (`hasAcceptanceCriteria`, whitespace-only counts as absent). Encoding it twice
  is how the manifest and the prompt come to disagree about the same fact.

  This is a repair, not a refinement. The extractor previously matched the heading
  only, so an inline-only roadmap produced an empty extraction that was then
  hashed: `ac_hash` recorded `e3b0c442…b855`, the SHA-256 of the empty string,
  which looks like a real hash in the manifest and re-derives identically on
  `--verify-current` — so this gate **confirmed a criteria set that was never
  there**, while the reviewer was handed a 0-byte `acceptance-criteria.md` under a
  prompt saying the criteria had been extracted. The R2 reviewer is the
  independent check on AC conformance, so the effect was to blind that check while
  the artefact read as though it had run.

  **Historical artefacts are deliberately left alone, for two independent
  reasons — and only the second covers every entry point.** 17 committed findings
  files carry the empty-string `ac_hash`; only the few whose roadmap declares
  criteria in a now-recognised form were ever the defect. First, `--verify-current`
  selects by review scope and re-derives the *current* PR's artefact alone, so a
  corpus of foreign artefacts is never re-derived at all. Second — and this is the
  reason that also holds for the single-artefact `--verify <path>`, which has no
  such selection — a foreign artefact already diverges on `scope_hash`, so it
  never reaches the `ac_hash` comparison on a semantics change. Do not read the
  first reason as the whole guarantee: a caller that walks the committed corpus
  with `--verify` inherits the semantics change and is protected only by the
  second.

  An artefact dispatched before this change whose roadmap does carry criteria in a
  newly recognised form will mismatch on its next re-derivation and needs a
  re-bind (a hand-edit of `ac_hash`), exactly like any other moved input.
- **Compared set:** `scope_hash`, `roadmap_hash`, `ac_hash`. `diff_sha` is
  provenance and is never compared, for the § 2.0 reasons. The manifest's
  `scope_hash` must also agree with the header's `scope:`; a disagreement is
  `manifest-header-mismatch` in the validator → block. (Staleness itself is the
  header-vs-current comparison of § 2.1, so agreement is all this adds.)
- **Dispatcher-writes-manifest rule (verdict #18):** the reviewer input is
  never assembled by the implementing agent. The deterministic dispatcher
  ([`dispatch_r2_reviewer.ts`](../../src/scripts/dispatch_r2_reviewer.ts))
  constructs the reviewer context itself (the § 2.0 review-scope diff via
  git, roadmap file, extracted AC), computes the `inputs` hashes, and writes
  the manifest. CI re-derives the expected hashes from the current repo state
  and blocks on mismatch — and because the derivation is scope-excluded, that
  re-derivation still succeeds after the artefact has been committed.
- **The reviewer receives the review-scope diff**, not the raw
  `base...HEAD` diff: the reviewer must not be handed its own findings
  skeleton to review, and `diff.patch` must hash to the recorded
  `scope_hash`.
- **Tool allowlist for the reviewer context:** branch-scoped `git diff` +
  reads of branch-touched files only; no `git log` beyond the branch, no
  repo-wide grep, no reads of `agents/runtime/` or session artifacts.
- **Residual (`accepted-risk`), with NO detection floor:** host-level context
  injection outside the dispatcher (a host that prepends extra context to the
  subagent) is not preventable — and not *detectable* — from inside the repo.
  An earlier draft named "the adversarial-leak E2E in the R2 acceptance suite"
  as the detection floor; no such test exists and none can, because the leak
  would happen in the host's prompt assembly, which no in-repo test observes.
  The claim is withdrawn rather than satisfied by a test that only greps the
  prompt text (R2 round-4 finding 3). What IS mechanical: the dispatcher builds
  the reviewer input, and CI re-derives the manifest hashes — so a reviewer fed
  a *different* diff or roadmap is caught. A reviewer fed the correct inputs
  PLUS extra context is not.
- **Residual (`accepted-risk`) — no proof of review EXECUTION.** The dispatcher
  proves *input construction*; nothing proves a reviewer ever consumed that
  input. A process can run the dispatcher (so every manifest hash verifies),
  then write the honest-null line itself, and the artefact is indistinguishable
  from one a reviewer produced. Repo-side enforcement is not available: the
  reviewer is a host-dispatched subagent whose invocation leaves no trace the
  repo can read. **Detection floor:** the audit trail — round records are
  committed and never edited in place (§ 2.7), so a later review of the *same*
  scope hash that reports findings contradicts an earlier honest-null on the
  record, permanently and in public.
- **Residual (`accepted-risk`) — the prompt channel, and it is the dangerous
  one.** The host authors the reviewer's prompt. The dispatcher fixes the
  *inputs*; it does not constrain the *instructions* wrapped around them, so a
  host that tells the reviewer what to expect can steer the verdict while every
  mechanical check passes. **A hash-verified artefact is therefore not evidence
  of an unbiased review** — only evidence that the reviewer was handed the right
  diff. What the host owes the gate: a prompt carrying **no** prior-round
  outcomes, **no** statement of the expected result, and **no** narrowing to
  files the requester selected.

  **Correction 2026-08-12 — "no in-repo check can read the prompt" was false,
  and this residual understated what is collectable.** The dispatcher writes the
  prompt verbatim to `<slug>.review-input/prompt.md` (§ 3), and 19 of those
  files are tracked. A check can read them, and a scan of all 19 found **0**
  carrying a pre-loaded verdict but **2 whose `prompt_hash` does not re-derive
  from the committed text** — one caused by the archival sweep rewriting a path
  inside a frozen record (cause fixed 2026-08-11), one dated after that fix and
  still unexplained. `prompt_hash` is written and parsed but compared to
  nothing; `--verify` re-derives `scope_hash`, `roadmap_hash` and `ac_hash`
  only, and the dispatcher docstring claiming otherwise is wrong.

  So the detection floor is **higher than this section claimed and lower than a
  solution**. Two things are mechanically collectable — that the committed
  prompt is the one the verdict was bound to, and that it carries no pre-loaded
  verdict by the same predicate `evidence-independence` uses. Neither closes the
  residual, and the cheapest bypass is **omission, not substitution**: not
  committing the package at all drops the round out of the checkable set with no
  finding and no signal — **11 of the 19** artefacts measured already look
  exactly like that, so the bypassed state is the historical norm and
  indistinguishable from it. Beyond that, the host that authors the prompt also
  writes the file, so substitution stays undetectable, and against the four
  steering clauses case zero records the predicate matches exactly **one**. The
  residual stays `accepted-risk`; what changes is that it is no longer
  *uninstrumented*. Requiring the package to be committed is the next step and is
  a migration decision, not a check.

  **Shipped 2026-08-13 — `check_review_prompt_binding` collects both.** It runs
  corpus-wide (a committed prompt and its recorded hash are both immutable, so a
  break is branch-independent, unlike the scope-relative checks in § 2.6) and is
  registered in `gate-coverage.yml` with a `scanned:` floor and a `--self-test`.
  Two statements above are now historical rather than current: the dispatcher
  docstring has been corrected, and `prompt_hash` is no longer compared to
  nothing. Both are left standing rather than edited away — the false claim and
  its refutation staying on the record is the property that surfaced this at all.

  Two records remain broken and are **recorded, not repaired**, in
  `src/config/review-prompt-binding-baseline.json`. The reason is evidentiary,
  not permissional: for the sweep-corrupted record the declared hash was produced
  by the original text, so rewriting either side would fabricate a binding that
  never held or erase the evidence the sweep reached inside a committed round;
  for the unexplained one, neither side can be established as correct, so making
  them agree would assert a binding nobody has evidence for. **Not** because
  § 2.7 forbids the edit — an earlier revision of this paragraph said that and
  was wrong: § 2.7 scopes its freeze to superseded `round<N>-review.md` records
  and states the rename is "never an edit ban on the live artefact".

  Each entry pins BOTH the declared and the actual hash, so a later repair and a
  further corruption are equally visible. The exemption covers the hash only — a
  pre-loaded verdict is never suppressed silently.

**Case zero (2026-08-04).** A commit shipped a "binding R2 honest-null"
declaring 0 findings for one scope. A real reviewer *was* dispatched and did
return `NO-FINDINGS` — but its prompt stated that the previous two rounds were
clean, that "NO-FINDINGS is expected and welcome", that "a padded list is worse
than none", and narrowed the review to four requester-chosen changes. A later
unsteered round on the **identical** scope found **seven** defects, several of
them direct consequences of that same change: a doc comment contradicting the
code it documented, a duplicated settings reader, an incomplete extension set.
Execution happened, the manifest verified, and the artefact was still false —
which is why the prompt channel is named as its own residual instead of being
folded into the context-injection one above. The correction was restored on top
rather than rewritten into history, so the false claim and its refutation both
remain on the record; that audit trail is the only reason it surfaced.

## 6. Validator exit-code contract

Both validators (and every future gate in this family) obey:

| Exit | Meaning | Caller behaviour (hook + CI) |
|------|---------|------------------------------|
| `0`  | pass | proceed |
| `1`  | policy violation | **block** |
| `2`  | internal error (crash / timeout / parse failure) | **degraded advisory mode** — log a warning, allow the operation |

A broken gate must never block its own fix. Only policy violations block.
Both validators emit the machine-readable `scanned: <N>` line and are
registered in [`gate-coverage.yml`](../../src/config/gate-coverage.yml). The
`scanned:` line is emitted on **every** exit path, exit `2` included: the
coverage guard reads that number, so an unresolvable base ref must still print a
count before it fails. The settings escape hatches
(`planning.risk_review: false`, `planning.completion_review: false`) print
`scanned: 0` with an explicit skip note — a configured skip, never a silent one.

**A dead scan scope is a policy violation (exit `1`), never an internal
error.** This is the one exception to the exit-2 rule, and it is deliberate: a
gate that read nothing has not passed, so mapping `DeadScopeError` to `2` —
which every caller warns-and-allows — would silently degrade the gate to
advisory the moment its corpus root was renamed. That is the ADR-051 class the
assertion exists to catch. In the validator it surfaces as the
`dead-scan-scope` violation kind, so `--advisory` downgrades it like any other
policy violation rather than bypassing the report.

**Honest note on the `min_scanned` floor.** For `check_completion_review`,
`scanned` = artefacts inspected + 1 for the diff evaluation, and that `+1` is
counted only when the artefact root resolves. The floor therefore guards
nothing on the happy path (any resolving root yields N ≥ 1); **the dead-scope
assertion is what has teeth — once the gate runs in enforced mode.** Its trigger
is precise: the root does not resolve on disk *while being a tracked tree* in the
base ref or `HEAD` — a moved or renamed root. An absent-and-never-tracked root (a
repo with no review corpus yet) is a legitimate empty corpus and still blocks
through the actionable `missing-artifact` violation instead.

**During the Stage-A advisory window, neither has teeth.** The registered argv
carries `--advisory`, and that downgrades *every* violation kind —
`dead-scan-scope` included — to a warning with exit `0`. So for the duration of
that window the gate's coverage entry attests only that the gate **ran**: there
is no blocking path and no trippable floor, which is exactly why the entry says
so in its own note. Both become live when Stage B removes the flag; nothing else
changes at that switch.

## 7. Metrics floor (Phase 7 consumers)

Events append to the tracked JSONL `agents/evidence/metrics/gate-metrics.jsonl`
(the layout table's `evidence/metrics/` sub-dir; a new top-level
`agents/metrics/` would need a layout-contract edit) —
PII-free by construction: ids + counters only, each event carries the PR
id / branch hash so concurrent branches merge without conflict. Event
names: `gate_c_bypass`, `gate_c_interview`, `gate_c_direct`,
`r1_register_written`, `r2_review`, `r2_skip`, `r2_honest_null`,
`gate_latency`, `gate_internal_error`. The measurement protocol and thresholds
are pre-registered in [`CLAIMS.md`](../CLAIMS.md) (two-stage: protocol before
any data, enforced threshold derived from the 10-PR advisory baseline —
verdict #20).

### 7.0 `gate_internal_error` — the exit-2 rate alarm

```
EXIT 2 IS WARN-AND-ALLOW AT EVERY CALL SITE. A GATE THAT CRASHES OFTEN
IS THEREFORE OFF, AND NOTHING SAYS SO. COUNT IT.
```

Exit 2 exists so a broken gate cannot block its own fix (§ 6) — a deliberate
fail-open. The cost is that **every** future validator bug degrades the gate to
advisory *silently*: the operation proceeds, the warning scrolls past, and the
gate reads as satisfied. Three of this family's shipping blockers travelled that
route (a missing `maxBuffer` → `ENOBUFS`, a depth-1 checkout leaving `--base`
unresolvable, a dead scan scope). The dead-scope carve-out re-routed one
instance to exit 1; the *class* remains, and this branch even widened it by
adding a `scanned:`-on-throw path that returns 2.

So the class gets a counter rather than another per-instance patch:

- **Event:** `gate_internal_error`, one per observed exit 2, carrying the gate
  id and the invoking surface. Producer is the agent, per § 7.1 — the
  validators still never write.
- **Alarm (protocol-level, registers in Stage A):** `gate_internal_error` on
  **≥ 10 % of a gate's runs over 20 consecutive runs → audit that gate.** This
  is a *sanity* alarm about the shape of the data, not a derived success
  threshold, so it may be fixed before any baseline exists — the same standing
  the `honest_null_rate ≥ 90 %` alarm already has. A gate above the line is
  reported as de-facto-off; it is not auto-promoted to blocking, because
  flipping a crashing gate to exit 1 is precisely what § 6 forbids.
- **Coverage boundary, stated because a partial counter reads as a census:**
  this observes the **agent-side and pre-push** path only. A CI-only exit 2 is
  *not* captured — § 7.1's producer rule bars the validator from appending, and
  the CI runner has no agent to do it. So the counter is a **floor, not a
  census**: it can prove a gate crashes, never prove one does not. What would
  close the gap is the same `--emit-metrics`-to-gitignored-staging design § 7.1
  names for the other events, plus a promotion step; not built here.
Quarterly `r1_mitigation_hit_rate` annotation:
[`annotate_r1_outcomes.ts`](../../src/scripts/annotate_r1_outcomes.ts).

### 7.1 Who writes these events — agent-side, and NOT the validators

```
THE VALIDATORS NEVER APPEND A METRIC EVENT. A CI GATE THAT WROTE INTO A
TRACKED FILE WOULD DIRTY THE TREE AND RED THE CONSISTENCY CHECK.
THE PRODUCER IS THE AGENT, AT THE SURFACES — COUNTING IS AGENT-CARRIED.
```

R2 round-3 finding 5 caught this contract claiming a metric floor with no
producer: the only writer in the tree is `annotate_r1_outcomes.ts`, and it
emits `r1_mitigation_outcome` only. The honest resolution is not to make the
validators write — they run in CI, and `agents/evidence/metrics/` is
**tracked**, so an appending gate would dirty the working tree and fail the
byte-exactness check in the same job. Instead:

- **Producer:** the agent, at the moment the gate fires, from the surfaces
  that own the flow — `plan-confidence-gate` (`gate_c_*`), `roadmap-writing`
  / `/roadmap:create` / `/feature:*` (`r1_register_written`),
  `roadmap-management` step 0 and `/create-pr` § 1d (`r2_review`,
  `r2_skip`, `r2_honest_null`, `gate_latency`).
- **Consequence for Stage B, stated plainly:** the advisory window closes on
  a count of agent-appended `r2_review` events. If the agent does not append
  them, the window does not close and R2 stays advisory — a *visible* stall
  (the JSONL simply stays short), not a silent pass. The follow-up roadmap's
  flip-to-ready trigger reads that file, so the stall is inspectable with
  `wc -l`.
- **What would make this machine-enforced** is a different design: an
  `--emit-metrics` flag used only on the local/agent path, writing to a
  gitignored staging file that a human promotes. Not built here; recorded so
  the next reader does not mistake the convention for a mechanism.

## Cross-references

- [`plan-confidence-gate`](../../src/agent-src/contexts/execution/plan-confidence-gate.md) — Gate C agent-side procedure.
- [`lint_plan_risk_register.ts`](../../src/scripts/lint_plan_risk_register.ts) · [`check_completion_review.ts`](../../src/scripts/check_completion_review.ts) — the validators.
- [`dispatch_r2_reviewer.ts`](../../src/scripts/dispatch_r2_reviewer.ts) — R2 reviewer dispatcher.
- [`gate-coverage.yml`](../../src/config/gate-coverage.yml) — `scanned:` / `min_scanned` registration.
- [`templates/roadmaps.md`](../../src/agent-src/templates/roadmaps.md) — authoring rule pointing here.
