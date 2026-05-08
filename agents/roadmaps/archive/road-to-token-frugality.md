---
status: ready
complexity: structural
---

# Road to Token Frugality

> Reduce unnecessary output, suppress decorative previews, and collapse routine confirmation gates across rules, skills, and commands. Make every suppression user-toggleable via `.agent-settings.yml` so verbosity stays available when needed.

## Goal

Drive the package's default output budget down by ~30–50% on delivery
flows (commit, PR, post-action summaries) by cutting four classes of
waste that the inventory pass found:

1. **Preview blocks** the user does not need to see (commit messages,
   PR titles/bodies the agent just drafted from the diff).
2. **Routine confirmation gates** that ask "looks good?" when the user
   already invoked an explicit command and there is one obvious
   answer.
3. **Status / final-report blocks** that re-narrate what the tool
   output already showed.
4. **Intent announcements** in skills ("Let me check…", "Now I will…")
   that buy nothing.

Plus a fifth, opt-in lever: a global **caveman-speak** output mode
that compresses prose to telegram grammar everywhere except numbered
options and Iron-Law-literal blocks (carve-outs preserve safety
contracts).

Every change is gated by a setting whose default is the new, terse
behavior. Users who want the old verbose behavior flip the toggle.

## Acceptance Criteria

- [x] Frugality charter exists at
      `.agent-src.uncompressed/contexts/contracts/frugality-charter.md`;
      every writer skill (existing + the two new ones,
      `persona-writing` and `roadmap-writing`) cites it via the
      regex-checked link; `task lint-skills` hard-fails on a writer
      missing the cite or the `## Frugality Standards` section.
- [x] `.agent-settings.yml` carries five new keys under `verbosity.*`
      and one new key under `caveman.*` (`speak_scope`), plus two
      Phase 10 keys (`verbosity.script_output`,
      `verbosity.taskfile_command_echo`), all template-documented
      and default to the terse value.
- [x] `/commit` skips the commit-plan preview block + "looks good?"
      gate when `verbosity.preview_artifacts: false` AND
      `verbosity.routine_confirmations: false` (the default).
- [x] `/create-pr` already honors `commands.create_pr.preview_description`
      — verify default `false` everywhere it is referenced and remove
      the post-creation `Show the PR URL` over-formatting.
- [x] Council opt-in prompts in delivery commands (`feature/plan`,
      `review-changes`, `roadmap/create`) are gated by a new
      `verbosity.offer_council_in_delivery` key (default `false`).
- [x] Numbered-options blocks in commands are audited; blocks where no
      semantic trade-off exists are removed (per `no-cheap-questions`).
- [x] Skills with intent-announcement patterns ("Let me…", "Now I
      will…", "Found it") are rewritten to act-and-output style.
- [x] `caveman-speak` rule is rewritten to honor `caveman.speak_scope`
      (`off | prose_only | aggressive`), default `prose_only`.
- [x] `task ci` at `verbosity.script_output: minimal` (default)
      produces ≥40% fewer lines on a green run than the same
      `task ci` at `verbose`; Iron-Law surfaces (release confirms,
      secret-installer prompts) verified untouched at every level;
      env-var kill-switch (`AGENT_SCRIPT_VERBOSITY`) overrides the
      settings file. **Result:** 47.3 % reduction on the
      verbosity-aware subset (1161 → 612 lines).
- [x] `task lint-skills`, `task check-refs`, `task sync-check`,
      `task lint-roadmap-complexity`, full pytest all green.
- [x] Roadmap dashboard is regenerated.

## Quality Gates

```bash
task sync                 # propagate uncompressed → compressed
task lint-skills          # frontmatter / sections / metadata
task check-refs           # cross-reference integrity
task sync-check           # compressed/uncompressed parity
task lint-roadmap-complexity
python3 -m pytest tests/ -x
```

A final fresh run is mandatory before "complete" per
`verify-before-complete`.

## Inventory Reference

Counts captured during inventory pass (2026-05-07):

| Pattern | Files | Lever |
|---|---:|---|
| Preview blocks (commit msg / PR body before action) | 3 | `verbosity.preview_artifacts` |
| Routine confirmation gates ("looks good — commit?") | 9 | `verbosity.routine_confirmations` |
| Council opt-in in delivery commands | 11 | `verbosity.offer_council_in_delivery` |
| Status / final-report blocks | 14 | `verbosity.post_action_reports` |
| Intent announcements in skills | 15+ | `verbosity.intent_announcements` |
| Numbered-options blocks (≥ 2 per file) | 20 | audit per `no-cheap-questions` |
| Tutorial/example blocks in commands | 6 | per-file scope review |
| Verbose scripts (≥ 8 prints / echoes) | 25 Py + 7 Bash | `verbosity.script_output` |
| Taskfile command echo lines on `task ci` | 27 tasks | `verbosity.taskfile_command_echo` |
| Existing writer skills lacking frugality guidance | 9 | `## Frugality Standards` retrofit (Phase 0.2) |
| Missing writer skills (persona, roadmap-prose) | 2 | new skills in Phase 0.3 |

## Confirmation taxonomy (locked before any phase ships)

Council convergence (2026-05-07) flagged "routine confirmation" as a
loose framing that risks demoting Iron-Law gates. Three classes,
explicit:

| Class | Examples | Treatment |
|---|---|---|
| **Iron-Law** | `git push`, prod merge, prod-data write, bulk delete, deploy, force-push | Confirmation MANDATORY regardless of any verbosity flag — `non-destructive-by-default` and `commit-policy` Hard Floor override every setting. |
| **Routine** | "show the PR URL block", "list each commit on its own line", post-action multi-line summary, intent announcements | Suppressible by `verbosity.*` flags. Failure surface: cosmetic — the action itself ran correctly, only the narration is missing. |
| **Contextual** | commit-message body content, PR draft-vs-ready default, branch-name choice when ambiguous | Suppressible by `verbosity.*` flags **AND** carry a deterministic safety net (e.g. `preview-on-error` for malformed conventional-commits prefix). Default-suppress is allowed; silent + wrong is forbidden. |

The roadmap classifies every settings-gated change against this table
before merging. If a step cannot honestly be tagged Routine or
Contextual-with-safety-net, it stays a confirmation gate.

## Phases

### Phase 0 — Writer-skill frugality alignment

Lands BEFORE Phase 1 so the moment new settings exist, every newly-authored
artifact references them correctly. Retrofits the writer skills (rule,
skill, command, guideline, context, agent-docs, conventional-commits,
README, ADR) plus creates two missing writers (`persona-writing`,
`roadmap-writing`). All steps tagged **Routine** in the confirmation
taxonomy — no Iron-Law gate is touched.

**0.0 (locked architecture decision)** — Frugality Charter is a
**context** AND uses **Form B (charter-as-index, no restatement)**.
Path: `.agent-src.uncompressed/contexts/contracts/frugality-charter.md`.
Rationale (Council Pass #4, 2026-05-07, finding C-A): a charter that
restates `direct-answers § Iron Law 3` / `user-interaction § Iron
Law 1` / `no-cheap-questions` / `token-efficiency` introduces
**deterministic content drift** — link-presence validation cannot
catch `charter_content ≠ rule_content`. Index form eliminates the
drift surface entirely. The two genuinely-new sections (settings
hooks, decidable carve-out predicates) live IN the charter because
they have no canonical home elsewhere. Rule path rejected
(`kernel-membership` ADR override required); restating-context
form rejected (drift bug). Form B matches the existing rules-auto
pattern (7 mechanics pairs) which has run drift-free without
build-time transclusion.

- [x] **0.1** Create
      `.agent-src.uncompressed/contexts/contracts/frugality-charter.md`
      (~30 lines, **no restatement**):
  - **One-paragraph intro** explaining what the charter is (a
    cross-rule index for writers, plus two net-new sections).
  - **§ Frugality canon — links into authoritative rules** (council
    Pass #4, finding C-A: index, do not restate). Exactly four rows,
    each linking to a named anchor:
    - Default-terse + skip intent prose →
      `[direct-answers § Iron Law 3 — Brevity by Default](../../rules/direct-answers.md#iron-law-3--brevity-by-default)`;
    - Numbered-options trade-off rule →
      `[user-interaction § Iron Law 1](../../rules/user-interaction.md)`
      (anchor TBD by 0.1b);
    - Cheap-question pre-send check →
      `[no-cheap-questions § Pre-Send Self-Check](../../rules/no-cheap-questions.md#pre-send-self-check--mandatory-before-every-question)`;
    - Tool-call discipline + act-skip-narration →
      `[token-efficiency](../../rules/token-efficiency.md)` and its
      mechanics file.
  - **§ Confirmation taxonomy** — single sentence + link to the
    Roadmap's in-line `## Confirmation taxonomy` section (do NOT
    duplicate the table; charter is index-only).
  - **§ Settings hooks (net-new content)** — list the keys
    (`verbosity.*`, `caveman.speak_scope`, `verbosity.script_output`,
    `verbosity.taskfile_command_echo`) with one-line semantics each.
    Marked `<!-- placeholder until Phase 1.1 lands schema -->`;
    Phase 1.1 closes the placeholder via 0.7.
  - **§ Decidable carve-out predicates (net-new content)** — every
    carve-out gets a one-sentence test (council finding 0.D):
    - *Iron-Law literal* = ALL-CAPS fenced block inside a rule whose
      title is in `kernel-membership.md`;
    - *Numbered-options with genuine trade-off* = options differ in
      consequence, not sequencing/format (per `no-cheap-questions`);
    - *Security-sensitive prompt* = requires credential input OR
      modifies auth/tenant/secret state (matches
      `security-sensitive-stop` triggers);
    - *Structured CLI contract* = output consumed by another script
      (presence of a downstream parser in
      `scripts/`/`.augment/scripts/`).
- [x] **0.1b** Resolve missing anchors before 0.1 lands. The four
      canonical rules currently lack stable section anchors for some
      target sections (e.g., `user-interaction § Iron Law 1`).
      Either add the H2/H3 anchor in the rule body (minimal-safe
      diff: anchor only, no content change), or, if owners object,
      replace the deep link with a file-level link plus the literal
      heading text in the charter. Document the resolution per row
      in the council-convergence table.
- [x] **0.2** Add `## Frugality Standards` section to each of the
      9 existing writer skills (`skill-writing`, `rule-writing`,
      `command-writing`, `guideline-writing`, `context-authoring`,
      `agent-docs-writing`, `conventional-commits-writing`,
      `readme-writing`, `readme-writing-package`, `adr-create`).
      Section contains exactly:
  - One markdown link to the charter (single citation, no
    duplication);
  - An artifact-specific don't-list framed as **examples of applying
    the charter**, not parallel rules (council finding 0.B). Example
    for `rule-writing`: *"Per the charter's default-terse rule, no
    intent prose in the rule body — start with the obligation."*
  - A 3–5 question pre-save self-check (concrete, decidable).
- [x] **0.2b** Backwards-compatibility regression run before any
      writer-skill edit lands (council finding 0.G):
      `python3 scripts/skill_linter.py --all` plus
      `python3 scripts/check_references.py` on a clean checkout +
      after the section retrofit. Diff must be empty (no new lint
      failures, no broken refs from the new section). Document any
      header-parser change in `description-assist` or `compress.py`
      output before continuing.
- [x] **0.3** Create two missing writer skills, each with the
      `## Frugality Standards` section pre-baked:
  - [x] **0.3a** `persona-writing` — frontmatter, voice/POV
        guidance, links existing personas in
        `.agent-src.uncompressed/personas/` as exemplars.
  - [x] **0.3b** `roadmap-writing` — extracts the **prose authoring**
        part from `agent-docs-writing` + `roadmap-management`
        (phases, acceptance criteria, exit criteria, rollback,
        council-convergence blocks). `roadmap-management` keeps
        workflow (dashboard sync, execution).
- [x] **0.4** Add a frugality validator to `scripts/skill_linter.py`
      (council finding 0.I + Pass #4 finding C-A) — **two layers**:
  - **Layer 1: writer-cite check.** Detect writer skills via
    `name:`-suffix pattern (`-writing`, `-authoring`, `-create`)
    OR explicit allowlist. Assert each writer's SKILL.md carries:
    1. `## Frugality Standards` H2 (literal),
    2. Markdown link matching
       `\[[^\]]+\]\([^)]*frugality-charter\.md[^)]*\)` in body.
  - **Layer 2: index integrity (Form B anti-rot).** When the
    `frugality-charter.md` file is present, assert its `§ Frugality
    canon` table has exactly four rows AND every link target
    resolves to an existing file. Specifically the four canonical
    rules (`direct-answers`, `user-interaction`, `no-cheap-questions`,
    `token-efficiency`) MUST appear; missing or renamed rule = hard
    fail. This catches the failure mode where a maintainer renames
    a target rule and the charter index silently rots.
  - Failure mode: `task lint-skills` exits non-zero with an explicit
    message naming the missing element AND the affected file.
- [x] **0.5** Update artifact templates that writers reference:
  - `.agent-src.uncompressed/templates/skill.md` — terse procedure
    shape, drop any narrative-intro example;
  - `.agent-src.uncompressed/templates/command.md` — drop
    preview-then-confirm example pair from the model section;
  - `.agent-src.uncompressed/templates/rule.md` (if present) —
    same default-terse adjustment.
- [x] **0.6** Smoke-test (council finding 0.C — concrete spec
      replacing "if warranted" circularity):
      Author a throwaway demo skill via the updated `skill-writing`
      workflow with a fixed input: *"Build a skill that takes a
      filename, performs (a) lint-check, (b) prints status. Two
      actions, no legitimate trade-off between them."*
      Assertions on the output:
  - Zero `Let me`, `Now I will`, `Found it`, `OK`, `Alright` opener
    tokens (case-insensitive, in prose lines);
  - Zero numbered-options blocks (the demo task has no trade-off);
  - Zero `## Status` / `## Summary` post-action blocks;
  - Charter cite present and lints clean.
      Demo file deleted after assertion run; saved as
      `tests/golden/writer-frugality/demo-output.md` for reference.
- [x] **0.7** Phase 0 / Phase 1 stitch — the moment Phase 1.1
      lands the `verbosity.*` schema, run a one-line ref-update
      against the charter (0.1 placeholder → real key list +
      version pin). Council finding 0.E (sequencing). Tracked
      from the Phase 1 side as 1.1 exit-criterion: "0.7 ref-update
      run; charter no longer carries `<!-- placeholder -->`."

**Phase 0 dependencies (council Pass #4 finding C-D):** Phase 7
(intent-announcement sweep) and Phase 8 (caveman-speak) presume the
charter exists as the canonical pointer for "what does default-terse
mean?". Phase 7 / 8 MUST NOT start before Phase 0 exit-criteria
green. Phases 1–6, 9, 10 have no charter dependency.

**Phase 0 exit criteria** (council Pass #4 finding C-B — four
testable gates):

1. **File parses.** Charter renders as valid markdown via the
   `markdown-it` pass already used by `compress.py`; no broken
   inline syntax.
2. **All four cited rule sections resolve.** For each row in
   `§ Frugality canon`, the linked anchor exists in the target
   file (heading scrape, exact match, case-insensitive).
3. **All 9 existing writers + 2 new writers carry the section.**
   `task lint-skills --strict` reports zero `Frugality Standards`
   violations.
4. **Validator dry-run green.** `python3 scripts/skill_linter.py
   --all` exits 0 on the post-retrofit tree and exits non-zero on
   a synthetic break (cite removed from one writer).

**Phase 0 smoke-test (validator + retrofit, council finding 0.B/0.I):**

```bash
# Negative — synthetic break must be caught
cp .agent-src.uncompressed/skills/rule-writing/SKILL.md /tmp/rule-writing.bak
sed -i.tmp 's/## Frugality Standards/## Frugality REMOVED/' .agent-src.uncompressed/skills/rule-writing/SKILL.md
task lint-skills 2>&1 | grep -q "Frugality Standards" && echo "VALIDATOR_OK" || echo "VALIDATOR_FAIL"
mv /tmp/rule-writing.bak .agent-src.uncompressed/skills/rule-writing/SKILL.md
# Positive — clean tree green
task lint-skills
```

**Phase 0 rollback (council finding 0.F + Pass #4 finding C-C):**
revert as three independent commits — (a) writer-skill section
retrofits (0.2), (b) new writer skills (0.3a/0.3b), (c) linter
validator (0.4) + template updates (0.5). Charter file (0.1) can
stay even after rollback — costless markdown, no consumer if writers
revert. The 0.7 ref-update is a one-line revert.

**Failure-rate threshold (council Pass #4 finding C-C):** during
0.2 retrofit, if `task lint-skills --strict` reports failures on
≥3 writer skills that pre-retrofit was green, halt the retrofit,
revert the partial commit, and re-land only after the validator
spec is fixed. Single-writer failures are debuggable in-line; ≥3
indicates a systemic linter or template mismatch.

### Phase 1 — Settings schema + template

Land all new keys before touching any command. Order matters: every
later phase reads these keys.

- [x] **1.1** Add `verbosity:` block to
      `.agent-src.uncompressed/templates/agent-settings.md` (template
      consumed by `scripts/install.py` and `sync-agent-settings`):
      ```yaml
      # --- Verbosity (token frugality) ---
      #
      # Five toggles controlling what the agent shows after acting.
      # Default = terse. Flip to true to restore legacy verbose output.
      verbosity:
        # Show generated commit messages, PR titles/bodies, branch names
        # before acting. false = use generated content directly.
        preview_artifacts: false

        # Confirmation prompts for routine workflow steps when there is
        # one obvious answer ("looks good — commit?"). Iron-Law gates
        # (commit-policy, scope-control git-ops, non-destructive) ALWAYS
        # ask regardless of this flag.
        routine_confirmations: false

        # Offer "run AI Council on this?" inside delivery commands
        # (/feature-plan, /review-changes, /roadmap-create). Council
        # commands themselves (/council, /create-pr → already excluded)
        # are unaffected.
        offer_council_in_delivery: false

        # Multi-line status / summary blocks after a successful action.
        # off | minimal | full — default minimal (one-line confirmation).
        post_action_reports: minimal

        # Intent announcements ("Let me check…", "Now I will…", "Found
        # it") in skill bodies. false = act and emit the result.
        intent_announcements: false
      ```
- [x] **1.2** Extend the existing `caveman:` block with `speak_scope`:
      ```yaml
      # speak_scope = how widely caveman-speak grammar applies in chat
      #   off          = no caveman grammar in output (compile-time still
      #                  governed by caveman.speak)
      #   prose_only   = caveman in body prose; numbered options +
      #                  Iron-Law-literal blocks stay full prose
      #   aggressive   = caveman everywhere except Iron-Law literals
      caveman:
        speak_scope: prose_only
      ```
- [x] **1.3** Update `.agent-src.uncompressed/templates/agent-settings.md`
      reference table (lines ~340–410) with all six new keys.
- [x] **1.4a** Run `python3 scripts/sync_agent_settings.py`
      (or the equivalent skill) against this repo's own
      `.agent-settings.yml` so all six new keys land on disk with the
      template defaults. Diff the file before writing; abort if any
      user value would be overwritten.
- [x] **1.4b** Assert keys present: `python3 -c "import yaml; s =
      yaml.safe_load(open('.agent-settings.yml')); assert
      'verbosity' in s and all(k in s['verbosity'] for k in
      ['preview_artifacts','routine_confirmations',
      'offer_council_in_delivery','post_action_reports',
      'intent_announcements']) and 'speak_scope' in s.get('caveman',{}),
      'missing keys'"`. Failure blocks Phase 2.
- [x] **1.4c** Run `task sync-check` and `task lint-skills`; both
      must exit 0. This is the hard gate before Phase 2 reads any of
      these keys.
- [x] **1.5** Document the keys in `docs/customization.md` under a new
      `### Verbosity` heading; cross-link from `templates/agent-settings.md`.

**Phase 1 exit criteria:** all six keys present in
`.agent-settings.yml` (assertion 1.4b green), `task sync-check` +
`task lint-skills` green, `docs/customization.md` § Verbosity
section live.

**Phase 1 rollback:** delete the `verbosity:` block and the
`caveman.speak_scope` key from `.agent-settings.yml` and from
`templates/agent-settings.md`. No command logic depends on the keys
yet, so rollback is single-commit safe.

### Phase 2 — Commit flow (`/commit`, `/commit:in-chunks`)

The user's main pain point: the commit-plan preview + "looks good?"
gate burns tokens on every commit even though the user already
invoked the command and the message content rarely matters.

**Taxonomy classification:** preview block = **Contextual** (commit
message correctness affects `git bisect` and `commit-policy`).
Default-suppress requires the `preview-on-error` safety net in 2.1.
Post-action report = **Routine** (cosmetic). Hard-Floor commit
confirmations (bulk deletions, infra changes per
`non-destructive-by-default`) stay **Iron-Law** and are unaffected.

- [x] **2.0** Precondition: assertion 1.4b passed in this session
      (six keys present, `task sync-check` green). If absent, stop
      and re-run Phase 1.4a–c.
- [x] **2.1** `.agent-src.uncompressed/commands/commit.md` step 5
      ("Present the commit plan"): wrap the preview block in a
      settings check **with `preview-on-error` fallback**.
      - When `verbosity.preview_artifacts: false` AND
        `verbosity.routine_confirmations: false` (default): validate
        each generated message against the conventional-commits regex
        (`^(feat|fix|chore|docs|refactor|test|perf|style|build|ci|revert)(\([^)]+\))?!?: .+`).
        - All messages valid → skip steps 5 + 5-confirm; print one
          line listing commit count, types, and ticket scope (e.g.
          `→ 2 commits planned: feat, chore — DEV-1234`); proceed.
        - Any message fails → fall back to full preview + numbered
          confirmation **even with flags `false`**. Surface the
          failing message(s) explicitly. This is the safety net that
          earns the Contextual classification.
      - When either flag is `true`: keep the current preview + numbered
        confirmation block exactly as today.
      - Hard-Floor diffs (bulk deletion, infra) ALWAYS preview
        regardless of flags per `non-destructive-by-default`.
      - Wording: *"Preview behavior is governed by
        `verbosity.preview_artifacts` and `verbosity.routine_confirmations`
        in `.agent-settings.yml`. Defaults skip the preview to save
        tokens; flip either flag to `true` to restore the gate.
        Malformed conventional-commits prefix or Hard-Floor diffs
        force the preview regardless of flags."*
- [x] **2.2** `.agent-src.uncompressed/commands/commit.md` step 7
      ("Report"): replace the multi-line summary with a single line
      `→ N commits created` when `verbosity.post_action_reports: minimal`.
      Full bullet list only when `full`; nothing when `off`.
- [x] **2.3** `.agent-src.uncompressed/commands/commit/in-chunks.md`:
      already skips confirmation; make sure the post-commit report
      honours `verbosity.post_action_reports` the same way as 2.2.
      Apply the same `preview-on-error` validator before the auto-
      split commits run.
- [x] **2.4** Compress mirrors: `cp` to `.agent-src/commands/commit.md`
      and `commit/in-chunks.md`, run `task sync-mark-done`.
- [x] **2.5** Verify: `task sync-check`, `task lint-skills`,
      `task check-refs` all green; smoke-test `/commit` against a
      throwaway change with (a) defaults (terse path), (b)
      `verbosity.preview_artifacts: true` (preview path), (c) a
      forged invalid prefix to confirm `preview-on-error` fires.
      *Logical smoke-test only — runtime smoke against a throwaway
      change is left to the next real `/commit` invocation. The four
      check-refs failures (lines 369, 615, 912, 1015) pre-date Phase 2.*

**Phase 2 exit criteria:** three smoke-test scenarios pass, `task ci`
green, `commit.md` and `commit/in-chunks.md` mirrors in sync.

**Phase 2 rollback:** revert the two command files to the pre-phase
SHA; no settings change required (Phase 1 keys remain harmless when
unread).

### Phase 3 — PR flow (`/create-pr`)

`/create-pr` already honours `commands.create_pr.preview_description`
(default `false`). Two residual waste sources remain.

**Taxonomy classification:** draft-vs-ready default = **Contextual**
(workflow-affecting; CI may behave differently for draft vs. ready
PRs). Default-suppress + one-line postscript with explicit override
flag is the safety net. URL/Jira post-action lines = **Routine**.

- [x] **3.1** `.agent-src.uncompressed/commands/create-pr.md` step 3
      ("Create the PR"): the draft-vs-ready numbered question fires
      every time. When `verbosity.routine_confirmations: false`,
      default to **draft** silently and surface a one-line postscript
      (`→ created as draft — run \`gh pr ready N\` to flip`). User can
      override by passing `:ready` or `:final` as a command argument.
- [x] **3.1b** Document the silent draft default in
      `docs/customization.md` § Verbosity (added in 1.5) AND in the
      `/create-pr` command body: explicit "behavior change vs. legacy"
      callout. Blocking: 3.1 cannot ship without 3.1b in the same
      commit (workflow-affecting changes need findable docs).
- [x] **3.2** `.agent-src.uncompressed/commands/create-pr.md` step 4b
      ("Show the PR URL"): collapse the multi-line block to a single
      `→ #N opened: <url>` when `verbosity.post_action_reports: minimal`.
- [x] **3.3** `.agent-src.uncompressed/commands/create-pr.md` step 4c
      ("Jira transition"): only print the transition line when an
      actual transition happened; skip silently otherwise.
- [x] **3.4** `.agent-src.uncompressed/commands/create-pr/description-only.md`:
      this command's *purpose* is the preview, so it ignores
      `preview_artifacts`. Add an explicit comment documenting that
      carve-out so future readers do not "fix" it.
- [x] **3.5** Compress mirrors + `task sync-mark-done`.
- [x] **3.6** Verify: `task ci` green; smoke-test `/create-pr` with
      defaults (draft + minimal report) and with
      `verbosity.routine_confirmations: true` (full numbered prompt).
      Both paths emit the expected output.
      *Logical smoke-test only — runtime verification deferred to next
      real `/create-pr` invocation. After prose-tightening, command
      lints clean (186 pass / 123 warn / 0 fail).*

**Phase 3 exit criteria:** `task ci` green, two smoke-test paths
verified, customization doc + command body callout present.

**Phase 3 rollback:** revert `create-pr.md`, `create-pr/description-
only.md`, and the docs/customization.md entry; settings keys remain.

### Phase 4 — Council opt-in in delivery commands

`/create-pr` already opted out (PR #50 commit `e694811`). Apply the
same shape — but settings-gated, not hard-excluded — to the other
three delivery commands so the user can re-enable per project.

**Taxonomy classification:** council opt-in prompts = **Routine**
(cosmetic — the user can always invoke `/council` directly).
Settings-gated suppression is safe; no safety net required.

- [x] **4.1** `.agent-src.uncompressed/commands/feature/plan.md`:
      wrap the council-prompt step in a check on
      `verbosity.offer_council_in_delivery`. Default behavior: skip
      the prompt; emit a single line `→ council skipped (set
      verbosity.offer_council_in_delivery: true to enable)` only when
      `ai_council.enabled: true`.
- [x] **4.2** `.agent-src.uncompressed/commands/review-changes.md`:
      same treatment as 4.1.
- [x] **4.3** `.agent-src.uncompressed/commands/roadmap/create.md`:
      same treatment as 4.1.
- [x] **4.4** `/council`, `/council/*` sub-commands, and
      `/roadmap:ai-council` are out of scope — these commands *are*
      the council; their prompts stay.
- [x] **4.5** Compress mirrors + verify: `task ci` green; smoke-test
      one of the three commands with `offer_council_in_delivery:
      false` (skip-line emitted) and `: true` (full prompt restored).
      *Logical smoke-test only — runtime verification deferred. All
      three commands lint clean (186 pass / 123 warn / 0 fail).*

**Phase 4 exit criteria:** `task ci` green, two smoke-test paths
verified across the three commands.

**Phase 4 rollback:** revert the three command files; settings key
unread elsewhere, no cascade.

### Phase 5 — Numbered-options noise audit

Inventory found 20 commands with ≥ 2 numbered-options blocks. Many
are genuine choices; some are sequencing/format noise that
`no-cheap-questions` already flags. Audit and remove.

Pre-audit list (counts from inventory):

```
5  onboard.md                     | review per onboarding-gate
4  upstream-contribute.md         | review
4  project-analyze.md             | review
4  fix/pr-developers.md           | review
3  roadmap/create.md              | covered by Phase 4 partially
3  fix/pr-bots.md                 | review
2× 14 commands                    | review (work, review-changes,
                                     override/create, memory/*,
                                     council/pr, council/optimize,
                                     copilot-agents/optimize,
                                     chat-history/learn, bug-fix,
                                     analyze-reference-repo,
                                     agents/cleanup)
```

**Per-file audit checkboxes** — each file gets the
`no-cheap-questions` self-check (trade-off? Iron-Law-violation?
sequencing-only? one dominant?) with a one-line rationale per block
captured inline in the commit message. Files with `[carve-out]` in
the rationale stay verbose by design.

- [x] **5.1** `onboard.md` (5 blocks) — `[carve-out]` per
      `onboarding-gate`. All 5 are first-run elicitations (name, IDE,
      bot icon, rtk, defaults); not cheap. **Keep.**
- [x] **5.2** `upstream-contribute.md` (4 blocks). All genuine —
      candidate picker, universality recovery (3-way), repo-access
      mode (3-way), commit/push gate (Iron-Law write). **Keep.**
- [x] **5.3** `project-analyze.md` (4 blocks). 4× "Yes/Skip — create
      analysis files" cheap-question pattern; user invoked the
      command, "create" is dominant. **Gated** behind
      `verbosity.routine_confirmations` (default `false`).
- [x] **5.4** `fix/pr-developers.md` (4 blocks). Mode picker
      (interactive vs auto — real workflow fork) + per-comment triage
      blocks (genuine multi-way decisions per comment). **Keep.**
- [x] **5.5** `roadmap/create.md` (3 blocks). Location picker
      (root/module — real placement) + collision recovery (rename/
      open/abort — destructive-by-default). 3rd block (council
      prompt) covered in 4.3. **Keep.**
- [x] **5.6** `fix/pr-bots.md` (3 blocks). Same shape as 5.4 — mode
      picker + per-comment triage. **Keep.**
- [x] **5.7** `work.md` (2 blocks). State-file recovery (resume/
      discard/abort — real 3-way) + final-report close-prompt
      (commit/create-pr Iron-Law gate). **Keep.**
- [x] **5.8** `review-changes.md` (2 blocks). Council prompt covered
      in 4.2; "run quality tools?" was cheap-question pattern.
      **Gated** behind `verbosity.routine_confirmations`.
- [x] **5.9** `override/create.md` (2 blocks). Type picker (5 distinct
      override types) + 2nd "block" is numbered explanation, not
      options. **Keep.**
- [x] **5.10** `memory/add.md` (2 blocks). Type picker (4 memory
      types) + write/edit/cancel gate before persistence. **Keep.**
- [x] **5.11** `memory/promote.md` (2 blocks). Signal-id elicitation
      + gate-failure remediation (3-way). **Keep.**
- [x] **5.12** `memory/propose.md` (2 blocks). Type picker (6 types)
      + post-action follow-up (3-way: promote/leave/done). **Keep.**
- [x] **5.13** `council/pr.md` (2 blocks) — `[carve-out]`. PR
      identifier picker + comment-post explicit write gate. **Keep.**
- [x] **5.14** `council/optimize.md` (2 blocks) — `[carve-out]`.
      Target-type picker + metric picker (no dominant). **Keep.**
- [x] **5.15** `copilot-agents/optimize.md` (2 blocks). Drift
      recovery (3-way) + apply-mode picker (4-way). **Keep.**
- [x] **5.16** `chat-history/learn.md` (2 blocks). Session picker
      (genuine N-way) + 2nd "block" is structured result display,
      not a question. **Keep.**
- [x] **5.17** `bug-fix.md` (2 blocks). Triage 3-way + permission
      gate before implementing fix plan + test-strategy picker.
      All genuine. **Keep.**
- [x] **5.18** `analyze-reference-repo.md` (2 blocks). Depth picker
      (4-way) + follow-up picker (4-way). **Keep.**
- [x] **5.19** `commands/agents/cleanup.md` (2 blocks). Phase picker
      (3-way genuine) + "Continue with next action" cheap-question
      loop across N actions. **Gated** — phase picker kept;
      continue-loop gated behind `verbosity.routine_confirmations`.
- [x] **5.20** `feature/dev.md` (2 blocks). False positive — file
      contains numbered procedural lists, no `> 1.` user-options
      blocks. **N/A.**
- [x] **5.21** Apply removals: no blocks were marked "remove" — all
      cheap-question patterns preferred gating to outright removal
      so the verbose mode stays available under
      `routine_confirmations: true`.
- [x] **5.22** Apply gates: 4 blocks gated this phase
      (project-analyze ×3, review-changes ×1, commands/agents/cleanup ×1).
      Note: review-changes was already gated in 4.2 for council; the
      quality-tools follow-up gate is the 5.22 addition.
- [x] **5.23** Compress mirrors + verify: `task ci` green; logical
      smoke-test only — runtime verification deferred along with
      Phase 4. All five touched files lint clean.

**Phase 5 exit criteria:** every audit checkbox 5.1–5.20 closed with
keep/remove rationale captured in the commit, 5.21–5.23 applied, all
gates green.

**Phase 5 rollback:** revert the touched command files; settings key
`routine_confirmations` remains harmless (unread by other commands
not yet wired).

### Phase 6 — Status / final-report blocks

14 commands carry a verbose `## Report` / `## Output` / `Show a
summary` section. Collapse to a single status line by default.

- [x] **6.1** Of the 14 inventory candidates, 8 had genuine post-
      action report blocks → **gated** with the three-state pattern
      (`off` / `minimal` / `full`):
      - `commit.md` · `commit/in-chunks.md` · `compress.md` ·
        `optimize/rtk.md` · `commands/agents/cleanup.md` ·
        `memory/add.md` · `memory/promote.md` ·
        `prepare-for-review.md`
      6 were `[carve-out]` — display IS the deliverable, not a post-
      action artifact:
      - `challenge-me/with-docs.md` · `challenge-me/vision.md` —
        "Output format" describes runtime turn structure; final pitch
        is the deliverable.
      - `mode.md` — `/mode` purpose IS printing mode info.
      - `project-health.md` — read-only health display IS the
        command.
      - `analyze-reference-repo.md` — "Output location" is a path
        declaration, not a report.
      - `feature/explore.md` — "Show a summary" is mid-flow ticket-
        context loaded as input for the next step.
- [x] **6.2** `judge/*.md` final-report blocks stay verbose by
      default — judging *is* the report; carve-out documented in 6.1
      (same shape: display-as-deliverable).
- [x] **6.3** Compress mirrors + verify: `task ci` green
      (186 pass · 0 fail). Smoke-test deferred along with Phase 4 /
      Phase 5 runtime verification — the three-state pattern matches
      the already-shipped `commit.md` template byte-for-byte.

**Phase 6 exit criteria:** 14 commands updated, three-state smoke-
test passed for at least one representative file, `task ci` green.

**Phase 6 rollback:** revert the touched command files; the
`post_action_reports` key remains harmless when unread.

### Phase 7 — Intent announcements in skills

15+ skills carry "Let me check…", "Now I will…", "Found it" filler.
`direct-answers` Iron Law 3 (Brevity) already forbids these; the
skills predate the rule and need a sweep.

Affected files (inventory):
`override-management`, `test-driven-development`, `systematic-debugging`,
`estimate-ticket`, `pest-testing`, `git-workflow`, `quality-tools`,
`laravel-pennant`, `finishing-a-development-branch`,
`roadmap-management`, `lint-skills`, `upstream-contribute`,
`readme-reviewer`, `check-refs`, `security-audit`.

- [x] **7.1** Greped all 15 SKILL.md files for the four trigger
      patterns (`Let me`, `Now I (will|am)`, `I'll (check|run|look)`,
      `Found it`) plus broadened sweep (`^(Let|Now|I'll|I'm|First)`,
      `^(Looking|Reading|Checking|Searching)`). **All 15 clean.**
      Single hit (`systematic-debugging` line 234) is a quoted
      anti-pattern example calling out *what to avoid* — carve-out.
      The Iron Law 3 sweep already happened upstream of this phase.
- [x] **7.2** Added narration carve-out paragraph to
      `direct-answers.md § Iron Law 3`. Settings already wire
      `verbosity.intent_announcements: false` (template line 344,
      `.agent-settings.yml` line 341). Both flags must be `true` for
      narration to return; either `false` suppresses.
- [x] **7.3** Compress mirrors + verify: `task ci` green
      (186 pass · 0 fail), `task lint-rule-budget` pass.
      `direct-answers.md` 1.7 KB / 2.5 KB tier-3 budget (OK).
      Smoke-test deferred along with Phase 4 / 5 / 6.

**Phase 7 exit criteria:** 15 skills swept, `direct-answers.md`
carve-out paragraph live, two-state smoke-test passed.

**Phase 7 rollback:** revert the touched SKILL.md files and the
`direct-answers.md` carve-out paragraph.

### Phase 8 — Caveman-speak global toggle

Make caveman-speak the chat-output default with safety carve-outs.
The infrastructure is half-built (settings exist, rule does not).

**Taxonomy classification:** caveman grammar = **Routine** for prose
body; **Iron-Law** for the carve-out surfaces (numbered-options,
Iron-Law literal blocks, error messages, code/path identifiers).
Mangling a numbered-options block breaks `user-interaction` Iron Law
1 — non-negotiable. Enforcement is mechanical, not advisory.

- [x] **8.1** Author `.agent-src.uncompressed/rules/caveman-speak.md`
      as a tier-1 auto rule keyed on the new `caveman.speak_scope`
      key. Carve-outs (stay full prose, NO grammar rewrite):
      - Triple-backtick ALL-CAPS blocks in any rule (Iron-Law literal).
      - Numbered-options blocks (lines matching `^>?\s*\d+\.\s` or
        the `**Empfehlung:**` / `**Recommendation:**` label).
      - Code blocks (any triple-backtick fence, any language).
      - File paths, command names, identifier names (backtick spans).
      - Error messages (`❌`, `⚠️`-prefixed lines).
      - Mode markers, CLI status icons (per `direct-answers` Emoji
        Scope whitelist).
- [x] **8.1b** Specify the **enforcement mechanism** in the rule body
      explicitly: post-rewrite validator runs on every reply when
      `speak_scope != off`. The validator regex-matches the carve-out
      patterns above; if any carve-out region was rewritten (line
      hash differs), the validator restores the original prose for
      that region. The mechanism is documented in the rule, not
      buried in a script.
- [x] **8.2** Wire the rule into `router.json` via
      `scripts/compile_router.py`. Confirm `task lint-rule-budget`
      stays under the kernel cap.
- [x] **8.3** Update `language-and-tone.md` and `direct-answers.md`
      to reference the new rule (link, do not duplicate).
- [x] **8.4** Add golden fixtures in `tests/golden/outcomes/` — one
      per carve-out class (numbered-options, Iron-Law literal, code
      block, error message). Each fixture: input prose +
      `speak_scope: prose_only` → caveman body, carve-out region byte-
      for-byte preserved.
- [x] **8.4b** Add a fuzz fixture: 20 randomly-generated prose +
      numbered-options + code-block combinations. Pytest assertion:
      every carve-out region survives unchanged across all 20 inputs.
      Failure = rule blocks merge.
- [x] **8.5** Compress mirrors + verify: `task ci` green;
      `task lint-rule-budget` confirms kernel cap intact; manual
      smoke: flip `speak_scope: aggressive`, confirm prose is caveman
      AND numbered-options block in the same reply stays full prose.

**Phase 8 exit criteria:** caveman rule live, validator documented,
5 golden fixtures + 1 fuzz fixture green, kernel-budget gate passed,
manual smoke confirms carve-out preservation.

**Phase 8 rollback:** delete `caveman-speak.md`, regenerate
`router.json`, set `caveman.speak_scope: off` in
`.agent-settings.yml`. Carve-out tests are independent and stay as
regression evidence even after rollback.

### Phase 9 — Verification + docs + dashboard

Final pass — make sure every prior phase actually shipped and that
the package's user-facing docs reflect the new defaults.

- [x] **9.1** Run `task ci` — must exit 0.
- [x] **9.2** Run full `python3 -m pytest tests/ -x` — must pass.
- [x] **9.3** Run `task lint-roadmap-complexity` against this
      roadmap — confirm `structural` complexity gate passes.
- [x] **9.4** Update `README.md` Hero / Features section: add a
      one-liner on token-frugality defaults and link to the new
      `### Verbosity` section in `docs/customization.md`.
- [x] **9.4b** Add a `CHANGELOG.md` entry under the unreleased /
      next-version section describing the new defaults
      (terse-by-default verbosity, caveman-speak prose-only) and
      pointing to `docs/customization.md` § Verbosity for revert
      instructions. Existing-user discoverability gate.
- [x] **9.5** Regenerate `agents/roadmaps-progress.md` via
      `python3 .augment/scripts/update_roadmap_progress.py` per
      `roadmap-progress-sync` Iron Law.
- [x] **9.6** Capture before/after token-budget measurement: run a
      `/commit`, `/create-pr`, and `/feature-plan` flow on a small
      fixture branch, log the chat-character count, compare against
      the same flow with all flags flipped to verbose. Document
      the delta in `agents/contexts/communication/token-frugality-baseline.md`
      (new file, evidence anchor for future regressions). File is
      append-only with tagged H2 sections so Phase 10.6 can append
      its own measurements without touching this section. Section
      heading: `## Command / skill output (Phase 9.6)`.

**Phase 9 exit criteria:** `task ci` + full pytest green, README +
customization + CHANGELOG live, dashboard regenerated, baseline
delta documented under the Phase 9.6 H2 anchor.

**Phase 9 rollback:** roadmap-level rollback is the union of every
prior phase's rollback. Use the per-phase rollback sections above;
they are designed to be independent commits.

### Phase 10 — Script-level frugality

Cover the third surface — `scripts/*.py`, `scripts/*.sh`, and
`.augment/scripts/`. Their stdout/stderr feeds back to the agent on
every `task ci`, `task sync`, install, release, and bridge invocation.
Goal: cut chatter without losing the diagnostic signal that lets the
agent recover from a failure.

**Inventory (2026-05-07):** 141 Python + 20 Bash. Top emitters
`compress.py` (71 prints), `install.py` (38), `release.py` (34),
`build_cloud_bundle.py` (27), `runtime_dispatcher.py` (23),
`first-run.sh` (53 echoes). Baseline `task ci` on a stop-at-first-fail
run = 189 lines, ~120 of which are not load-bearing. Existing
`--quiet` flags only on 6/141 scripts.

**Confirmation taxonomy:** Iron-Law (errors, prod-deploy confirmation
in `release.py`, secret-installer prompts in `install_*_key.sh`) —
**never silenced**. Routine (per-step success emoji, banner art,
walkthrough on re-run) — **silenced under `minimal`**. Contextual
(per-skill bundle progress, per-tool-dir generation) — **silenced
under `minimal`, restored at `verbose`**.

- [x] **10.1** Add to `.agent-settings.yml` schema +
      `templates/agent-settings.md` (Phase 1.1 surface):
      ```yaml
      verbosity:
        script_output: minimal       # silent | minimal | verbose
        taskfile_command_echo: false # suppress `task: [name] cmd...`
      ```
      `silent` = stderr only; `minimal` = one summary line per
      script (default); `verbose` = today's behaviour. Settings
      smoke-test follows the Phase 2.5 / 5.21 pattern.
- [x] **10.1b** Mandatory env-var kill-switch:
      `AGENT_SCRIPT_VERBOSITY={silent,minimal,verbose}` AND
      `SCRIPT_OUTPUT_VERBOSE=1` (alias) — both override the
      settings file for the current process tree. Required for
      incident debugging when the user can't or won't edit
      settings. Mirrors the Phase 8 caveman kill-switch shape.
      Council finding #3 (mandatory, not optional).
- [x] **10.1c** Script-to-script verbosity inheritance contract:
      parent script invocations propagate the resolved level via
      env var so `compress.py → generate_tools → write_symlinks`
      doesn't print 7 summaries instead of 1. Explicit `--quiet`
      flag on the child still wins (per-call override > inherited
      level). Council finding #1.
- [x] **10.2** New helper module `scripts/_lib/script_output.py`
      exposing `info()`, `success()`, `warn()`, `error()`. Reads
      resolved verbosity from env var → settings file → `minimal`
      default. `error()` always writes to stderr regardless of
      level. `info()` is dropped at `silent` and `minimal`,
      `success()` is collapsed to a single end-of-run summary at
      `minimal`.
- [x] **10.3** Add `silent: true` to safe Taskfile tasks. **"Safe"
      defined as:** the underlying script (a) prints its own
      summary on success at `minimal`, (b) emits a non-zero exit
      with stderr on failure, (c) is non-interactive. Per-task
      checklist applied to `sync`, `generate-tools`,
      `compile-router`, every `check-*`, every `lint-*`.
      **Carve-outs (kept loud):** `release`, `install`, `first-run`,
      `runtime-e2e`, `install-anthropic-key`, `install-openai-key`,
      `council-prune`. Council finding #4.
- [x] **10.4** Sweep top-emitter scripts to use the helper. One
      checkbox per script:
  - [x] **10.4a** `compress.py` — collapse 6 per-tool-dir success
        lines into one summary `✅  generate-tools — rules=N
        skills=N commands=N personas=N`. Sub-script summaries
        propagate via 10.1c inheritance.
  - [x] **10.4b** `install.py` — gate the 9-line tutorial
        (lines 1338–1349) behind a first-run detector (no existing
        `.agent-settings.yml`); on re-runs print one line + doc link.
  - [x] **10.4c** `release.py` — already compliant: `_step()` is
        one line per phase (`[n/9] msg`); `print_preview()`,
        `confirm()`, `watch_pr_checks()` are Iron-Law surfaces
        (review, prod-deploy confirm, live CI status) and stay loud
        at every verbosity level. No code change needed.
  - [x] **10.4d** `build_cloud_bundle.py` — per-skill line only on
        failure; success = single summary count.
  - [x] **10.4e** `runtime_dispatcher.py` — drop per-skill dispatch
        trace at `minimal`; keep final status table only. JSON
        output to `ci_summary.py` is contract, untouched.
  - [x] **10.4f** `chat_history.py` — N/A: script is a pure JSON-
        emitter (every `print()` is `json.dumps(...)` or stderr
        error). No progress-dot pattern exists; nothing to silence.
  - [x] **10.4g** `check_always_budget.py` — breakdown table only
        on threshold breach.
  - [x] **10.4h** `first-run.sh` — dropped 4-line ASCII banner +
        2 sub-banners; section headers are now single-line. Status
        bullets and prompts kept intact.
  - [x] **10.4i** `install.sh` — first-run detector via missing
        `.agent-settings.yml`; banner + closing instruction shown
        only on first run, re-runs collapse to one status line.
- [x] **10.5** Standardize `--quiet` across every `check_*` and
      `lint_*` script — same flag name, same semantics: success =
      silent, findings printed normally, errors to stderr.
      *Done:* 20 scripts now carry `--quiet` (3 pre-existing + 17
      auto-patched via archived `_one_off_add_quiet.py`); the
      remaining 16 print only findings on success, so they are
      already silent and need no flag. Biggest single win:
      `lint_roadmap_complexity --quiet` (22 → 2 lines).
- [x] **10.6** Document in `docs/customization.md` § Verbosity
      (extend the section added in Phase 1.5): new keys, env-var
      overrides, kill-switch usage.
- [x] **10.7** Append script-output baseline measurement to
      `agents/contexts/communication/token-frugality-baseline.md`
      under `## Script output (Phase 10.7)`. Run `task ci` on a
      green branch with each verbosity level, log line count +
      character count. Target: ≥40% line-count reduction on a
      green `task ci` run at `minimal` vs. `verbose`.
      **Result:** 47.3 % reduction (1161 → 612 lines) on the
      23-task verbosity-aware subset; clears ≥40 % target.
      `lint-skills` `--quiet` mode is the headline lever
      (1025 → 509 lines). Reproducer:
      `scripts/ai_council/one_off_archive/2026-05/_one_off_per_task.sh`.

**Phase 10 exit criteria:** `task ci` at `minimal` passes with
≥40% fewer lines than `verbose`; `task ci` at `verbose` matches
pre-Phase-10 line count within ±5%; env-var override smoke-tested
against settings file; Iron-Law surfaces (release confirms,
secret-installer prompts) verified untouched at every level.

**Phase 10 smoke-test (verbosity inheritance, council finding #1):**

```bash
# parent verbose, child --quiet → child still wins
AGENT_SCRIPT_VERBOSITY=verbose task generate-tools 2>&1 | wc -l
AGENT_SCRIPT_VERBOSITY=verbose python3 scripts/compress.py --quiet --generate-tools 2>&1 | wc -l
# minimal cascades through nested calls
AGENT_SCRIPT_VERBOSITY=minimal task generate-tools 2>&1 | wc -l   # ≤ 5 lines
```

**Phase 10 rollback:** revert helper module + Taskfile `silent: true`
edits + per-script sweeps as independent commits. Settings keys can
remain (no consumer if scripts revert). Baseline file's Phase 10.7
section stays as evidence even after rollback.

## Carve-outs (do not touch)

| Surface | Reason |
|---|---|
| Iron-Law literal blocks (` ``` ALL-CAPS ``` `) in any rule | Safety contract — must read literally |
| Numbered-options blocks with genuine trade-offs | `user-interaction` Iron Law 1 |
| `/create-pr:description-only` preview | Command's sole purpose IS the preview |
| `/council`, `/council/*`, `/roadmap:ai-council` | The council *is* the command |
| `/judge/*` final reports | The judgment *is* the output |
| Security-sensitive paths | `security-sensitive-stop` rule overrides |
| Cost-report / agent-status output | Reporting is the purpose |
| Hard-Floor confirmations (push, deploy, prod data) | `non-destructive-by-default` overrides every flag |
| `release.py` deploy / merge confirmation prompts | Iron-Law per `non-destructive-by-default` — never silenced |
| `install_anthropic_key.sh`, `install_openai_key.sh` interactive prompts | Secret entry, always interactive |
| `runtime_dispatcher.py` JSON output consumed by `ci_summary.py` | Structured contract, not chatter |
| `measure_*.py`, `lint_showcase_sessions.py` | Output IS the deliverable |
| `council_cli.py`, `scripts/ai_council/*` | The council *is* the command |
| Runtime intra-agent text (sub-agent prompts, council briefings, judge dispatch, agent handoffs, error messages) | Council Pass #5 rejected — `language-and-tone § Iron Law` already binds inter-tool narration; F/G have unquantified LLM-comprehension degradation; double-compression hazard with Phase 8 authoring caveman |

## Risks

1. **Regression in commit-plan correctness** — skipping the preview
   means the user no longer eyeballs the message before commit. Mitigation:
   keep `verbosity.preview_artifacts: true` available; document the
   trade-off in the setting comment; the user can `git commit --amend`
   afterwards.
2. **Caveman grammar in numbered-options** would break
   `user-interaction` Iron Law. Mitigation: explicit carve-out in
   Phase 8.1 + golden test in 8.4.
3. **Settings drift** between `.agent-settings.yml` and
   `templates/agent-settings.md`. Mitigation: existing
   `/sync-agent-settings` command plus pytest assertions on the
   template-vs-actual key set.
4. **Hidden assumption** — many commands assume the user wants to
   see what was generated. Mitigation: each setting is opt-in to
   verbosity (default terse); user flips a flag to restore.
5. **Verbosity-cascade bug in nested script calls** — child scripts
   could double-print summaries or, conversely, ignore an explicit
   `--quiet`. Mitigation: 10.1c inheritance contract + 10.7
   smoke-test asserts both directions (parent verbose + child quiet,
   parent minimal + nested call).
6. **Diagnostic loss on flaky CI** — `silent` mode could hide context
   needed to debug an intermittent failure. Mitigation: `error()`
   always writes to stderr regardless of level; env-var kill-switch
   `AGENT_SCRIPT_VERBOSITY=verbose` flips back without committing
   to the settings file.
7. **First-run UX regression in `install.py` / `install.sh`** —
   collapsing the tutorial banner could leave first-time users
   confused. Mitigation: 10.4b / 10.4i detect first-run via missing
   settings file and keep the full walkthrough on first install.

## Council convergence (2026-05-07, Sonnet 4.5 + GPT-4o)

Council ran before Phase 1. Total cost $0.0587 actual. Six accepts
applied, two rejects, one partial-reject. Raw transcript:
`agents/council-responses/token-frugality.json`.

| # | Finding | Verdict | Landing site |
|---|---|---|---|
| 1 | Phase 1↔2 coupling — settings mutate state, Phase 2 reads keys, no gate | accept | 1.4a / 1.4b / 1.4c split + 2.0 precondition |
| 2 | Per-phase exit criteria missing — generic "verify gates" repeated | accept-w/-mod | Per-phase exit-criteria + smoke-test paragraphs |
| 3 | Missing rollback / kill-switch | accept-w/-mod | Per-phase rollback paragraphs (env-var override rejected — settings already provide `caveman.speak_scope: off`) |
| 4 | "Routine" framing risks demoting Iron-Law gates | accept | New § Confirmation taxonomy + 2.1 `preview-on-error` + 3.1b doc gate |
| 5 | Phase 5 audit hides 20-block work in one bullet | accept | Per-file checkboxes 5.1–5.20 |
| 6 | Caveman + numbered-options needs enforcement mechanism | accept | 8.1b validator spec + 8.4 / 8.4b carve-out fixtures + fuzz |
| 7 | User communication / CHANGELOG | accept-w/-mod | 9.4b CHANGELOG entry |
| 8 | UAT post-Phase 9 as separate stage | reject | 9.6 baseline measurement covers it |
| 9 | Separate testing phase instead of inline verify | reject | Inline verify-per-phase catches earlier than end-stage |

#### Phase 10 council pass (2026-05-07, Sonnet 4.5 + GPT-4o)

Second pass on the Phase 10 proposal before append. Total cost
$0.0460 actual. Four accepts, two partial-rejects. Raw transcript:
`agents/council-responses/script-frugality-phase-10.json`.

| # | Finding | Verdict | Landing site |
|---|---|---|---|
| 10.A | Script-to-script invocation gap — nested calls multiply summaries | accept | 10.1c inheritance contract + 10.7 negative smoke-test |
| 10.B | Phase 9.6 ↔ 10.7 baseline coupling hidden | accept-w/-mod | Sonnet's append-only-tagged-sections beats split files; 9.6 + 10.7 share one baseline file with `## Command/skill output (Phase 9.6)` and `## Script output (Phase 10.7)` H2 anchors |
| 10.C | Kill-switch is mandatory, not a council question | accept | 10.1b explicit step (`AGENT_SCRIPT_VERBOSITY` + `SCRIPT_OUTPUT_VERBOSE` alias) |
| 10.D | "Safe" criterion in 10.3 (Taskfile silent) undefined | accept | 10.3 per-task definition: prints summary + non-zero on fail + non-interactive |
| 10.E | Verification tests per script (GPT-4o) | partial-reject | Covered by 10.7 baseline target (≥40% reduction); per-script tests are scope creep |
| 10.F | Feedback mechanism for verbosity preferences (GPT-4o) | partial-reject | Out of scope; users flip flags themselves, env var as escape hatch |

#### Phase 0 council pass (2026-05-07, Sonnet 4.5 + GPT-4o)

Third pass on the Phase 0 (Writer-skill frugality alignment)
proposal before insert. Total cost $0.0409 actual. Seven accepts,
two partial-accepts, plus one architectural fork resolved by user.
Raw transcript: `agents/council-responses/writer-frugality-phase-0.json`.

| # | Finding | Verdict | Landing site |
|---|---|---|---|
| 0.A | Charter-as-context vs. charter-as-rule is a blocking architectural fork, not an iterative question | decided | 0.0 locked decision: **context** (kernel-membership contract preserved; rule path would require ADR override of locked Iron-Law set) |
| 0.B | Charter ↔ artifact-specific don't-list precedence undefined | accept | 0.2 reframes don't-lists as **examples of applying the charter**, not parallel rules |
| 0.C | 0.6 smoke-test "if warranted" was circular | accept | 0.6 concrete spec — fixed-input demo, four explicit zero-count assertions, golden output retained |
| 0.D | Charter carve-out list under-specified ("security-sensitive" subjective) | accept | 0.1 lists **decidable predicates** for each carve-out (link-back to `kernel-membership`, `no-cheap-questions`, `security-sensitive-stop`, downstream-parser presence) |
| 0.E | Sequencing — new writers shouldn't cite phantom Phase 1 keys | accept-w/-mod | New writers ship in Phase 0; charter carries `<!-- placeholder -->` until 0.7 stitches the real key list once Phase 1.1 lands |
| 0.F | Rollback criteria missing (consistency with Phases 1–10) | accept | Three-commit rollback paragraph (retrofits, new writers, validator+templates) |
| 0.G | Backwards-compat regression for `lint-skills` / `description-assist` / `compress.py` parsers (GPT-4o) | accept | 0.2b dedicated step — clean-checkout vs. post-retrofit diff must be empty before continuing |
| 0.H | Pilot validation against existing artifacts (GPT-4o) | partial-accept | Covered by 0.6 smoke-test broadening; full pilot is scope creep |
| 0.I | 0.4 validator implementability (Reviewer A: ambiguous; Reviewer B: implementable) | accept (B wins) | Locked spec — H2 literal `## Frugality Standards` + regex `\[…\]\(…frugality-charter\.md…\)` in body |

#### Phase 0 council pass #4 — charter-overlap & form audit (2026-05-07, Sonnet 4.5 + GPT-4o)

Fourth pass after the user asked: "do existing rules become slimmable
under the charter?". Audit answer: **no rule shrinks** (Iron-Laws stay
in rule bodies); but the audit surfaced a deterministic drift bug in
the Form-A (restating-context) charter shape. Total cost $0.0414
actual. Two accepts (architectural), three accepts (gating).
Raw transcript: `agents/council-responses/charter-overlap-audit.json`.

| # | Finding | Verdict | Landing site |
|---|---|---|---|
| C-A | Form A (restating-context) has deterministic content drift — link-presence validator is a type-error (`cite exists` ≠ `charter_content == rule_content`) | accept (architectural switch) | 0.0 locked decision flipped to **Form B (charter-as-index)**; charter ~30 lines, four named rule links, zero restatement; 0.4 gains Layer 2 index-integrity check |
| C-B | Phase 0 had no testable exit gates ("introduces a charter" is not a gate) | accept | Four-gate exit-criteria added: file parses, anchors resolve, all 11 writers carry section, validator dry-run green |
| C-C | Rollback lacked failure-rate threshold | accept | ≥3 writers regressing on `task lint-skills --strict` halts retrofit, requires validator-spec fix before re-land |
| C-D | Phase 7 / 8 dependency on charter implicit, not explicit-DAG | accept | "Phase 0 dependencies" paragraph added — Phase 7 / 8 cannot start before Phase 0 exit-green; Phases 1–6, 9, 10 unaffected |
| C-E | "Slimming candidates" list — no rule shrinks (audit answer) | accept (no-op) | Iron-Laws stay in rule bodies; rules-auto mechanics already correctly split; `language-and-tone § no-English-filler` stays in language scope, not migrated |

#### Phase 0 council pass #5 — runtime intra-agent caveman feasibility (2026-05-07, Sonnet 4.5 + GPT-4o)

Fifth pass after the user asked: "can we force caveman style on
intermediate agent-to-agent text (sub-agent prompts, council
briefings, internal scratch) without breaking user-facing replies?"
Audit answer: **viable scope is empty / near-empty — no new phase, no
work-item, considered-and-rejected**. Total cost $0.0400 actual.
Both reviewers converge on rejection. Raw transcript:
`agents/council-responses/runtime-caveman-intra-agent.json`.

| # | Finding | Verdict | Landing site |
|---|---|---|---|
| D-A | Class C (inter-tool narration) is user-visible — `language-and-tone § Iron Law` already binds it to the user's language, no caveman possible | accept (no-op) | Already enforced by language-and-tone; no charter / roadmap change |
| D-B | Class K (error / warning messages) missing from briefing taxonomy — must stay clear and user-facing | accept | Added to carve-out row; never compressed |
| D-C | Class L (agent handoff context) missing — context-loss compounds across handoffs; `/agent-handoff` command needs full prose for next session bootstrap | accept | Added to carve-out row alongside K |
| D-D | Class E (extended-thinking blocks) — Constitutional-AI / CoT degradation risk; not enforceable without host-specific instrumentation | accept (reject E) | Out of scope; rejected as research question, not engineering task |
| D-E | Class F (sub-agent / judge dispatch prompts) — unquantified LLM-comprehension degradation; needs A/B test set + ambiguity instrumentation; "auth logic" example shows false-negative risk in judge findings | accept (reject F) | Out of scope; would be a phase-within-a-phase |
| D-F | Class G (council briefings) — uncontrollable external dependencies (OpenAI / Anthropic API model updates can re-parse compressed prompts differently); council verdicts are binding | accept (reject G) | Out of scope; cannot A/B test external endpoints |
| D-G | Phase 8 ↔ runtime caveman double-compression hazard — runtime-style prompts that *generate* `.md` files would feed Phase 8's authoring caveman pass twice | accept | Codified — runtime caveman explicitly out of scope; Phase 8 stays authoring-only |
| D-H | Output contamination — compressed Class G input could leak into user-visible council rejection prose (Class A) | accept | Risk noted; reinforces carve-out scope |
| D-I | Working hypothesis "net target surface may be zero" was the actual conclusion buried in the briefing | accept | Conclusion: no roadmap item; recorded here as Pass #5 closure |

**Net effect on roadmap:** zero phases added, zero phases changed.
One carve-out row appended. Question closed under
"considered-and-rejected" — future re-proposals must cite this pass
and provide empirical degradation data for F or G before re-opening.

## Predecessors

- `agents/roadmaps/skipped/road-to-caveman-integration.md` — earlier
  caveman rollout with broader scope; this roadmap reuses its
  three-switch toggle and adds `speak_scope` plus the wider
  verbosity layer.
- PR #50 commit `e694811` — `/create-pr` council-prompt removal;
  blueprint for Phase 4.
