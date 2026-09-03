---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates: []
# relates: `agent-config roadmap:context --relates` on 2026-09-03 scanned 842
# roadmap file(s) and reported 0 sibling hits. A manual grep over
# agents/roadmaps/**/*.md for `security-sensitive-stop`, `accessibility-auditor`
# and `iconography` returns no roadmap owning any of the three surfaces.
estate_offset_exempt: "Adds one active roadmap against a floor of 1. It cannot fold into road-to-binding-findings, which is an authority-surface roadmap with its own acceptance criteria and would be diluted by three unrelated artefact-drift fixes; it cannot be parked, because each item is a claim the tree makes today and every day it stays is a day an agent is routed by it."
---
# Road to declared coverage truth

> **Source:** `agents/tmp.old/inbox-2026-09-c/set-3/`, `set-4/` and `set-5/` —
> three large architecture proposals. Their architectures are not adopted here
> and are dispositioned in `agents/evidence/analysis/`; what survived
> verification is the small half none of them led with: three artefacts that
> declare a coverage they do not have. Each was re-checked against
> `main@022c0d240`.

## Goal

Three artefacts stop claiming a surface they do not cover. A prompt about a file
upload loads the rule whose own table calls file uploads security-sensitive; the
accessibility skill either audits the WCAG version it names or names the one it
audits; and the icon skill stops handing an agent the exact default its sibling
rule calls the anti-pattern. Nothing here builds a new artefact — all three are
edits to files that already exist.

## Phase 1 — The rule that names uploads and cannot be reached by them

- [ ] **1.1 Close the gap between the trigger set and the rule's own table.**
      `src/rules/security-sensitive-stop.md` is `type: auto`, so it loads on its
      `triggers:` block alone. That block carries `auth`, `billing`, `tenant`,
      `webhook`, `oauth`, `signing key` (`:11-17`). The rule's own
      § What counts as security-sensitive additionally names **file uploads**
      ("any endpoint that accepts user files or URLs for files"), **external
      integrations**, **public endpoints** and **data exposure** — and its
      `description:` (`:5`) advertises uploads to every catalogue that renders
      it. A prompt reading "add a file upload endpoint" therefore never loads
      the rule that exists to stop it. Add the missing keywords.
      verify: `./scripts-run src/scripts/rule_trigger_eval` over the four
      prompts "add a file upload endpoint", "wire up the SSRF allow-list",
      "expose a public status endpoint", "add a field to the API resource"
      reports `security-sensitive-stop` as matched for each.
- [ ] **1.2 Declare the collisions the new keywords create, or narrow them.**
      `upload` and `endpoint`-shaped keywords overlap `broken-access-control`
      (`endpoint`, `route`) and `senior-engineering-discipline` (`endpoint`).
      An overlap that is intended is declared in `collision_ok:`, which this
      rule already uses for `tenant`; an overlap that is not intended is a
      narrower keyword.
      verify: `./scripts-run src/scripts/lint_trigger_collisions` and
      `./scripts-run src/scripts/lint_trigger_precision` are green, and every
      accepted overlap carries a one-line reason.
- [ ] **1.3 Re-read the always-budget before the description changes.** The
      description is rendered into catalogues; a longer one costs tokens in
      every session. Keep the edit inside the trigger block unless the
      description is factually wrong.
      verify: `./scripts-run src/scripts/check_always_budget` is green.

## Phase 2 — The accessibility skill and the version it names

- [ ] **2.1 Establish which WCAG 2.2 criteria the skill actually carries.**
      `src/skills/accessibility-auditor/SKILL.md` states "WCAG 2.2 AA" in four
      places (`:4`, `:17`, `:62`, `:192`). Of the nine success criteria WCAG 2.2
      added over 2.1, a grep across the skill directory finds exactly two —
      2.5.7 and 2.5.8, each once, inside a row of `data/aria-patterns.csv`.
      2.4.11 Focus Not Obscured (Minimum, **AA**), 2.4.12, 2.4.13, 3.2.6
      Consistent Help (A), 3.3.7 Redundant Entry (A) and 3.3.8 Accessible
      Authentication (**AA**) return zero hits.
      verify: the census is written into the roadmap's evidence note with the
      per-criterion counts, reproducible by the same grep.
- [ ] **2.2 Close the two AA gaps, which are the ones the claim is about.**
      2.4.11 and 3.3.8 are AA and therefore inside the claim the skill makes.
      Add each as a checklist row with a testable condition and a failure mode,
      in the shape the skill's existing rows already use.
      verify: the skill's checklist contains both criteria by number, and each
      row names how to test it.
- [ ] **2.3 Decide the two A-level criteria explicitly, in the file.** 3.2.6 and
      3.3.7 are level A, so they sit below the declared AA bar but inside 2.2.
      Either add them or state in one line why an AA audit omits them. Silence
      here is what produced the drift.
      verify: each of the two appears either as a checklist row or as a named
      omission with a reason.
- [ ] **2.4 Make the version claim self-checking.** A gate or test asserts that
      every criterion number the skill claims to cover appears in its own
      content, so the next version bump cannot be a description-only edit.
      verify: the check fails when "WCAG 2.2" is claimed with 2.4.11 removed,
      and passes on the completed skill.

## Phase 3 — The icon default the sibling rule forbids

- [ ] **3.1 Resolve the contradiction between the skill and the rule.**
      `src/rules/icon-consistency.md` § What this gates names "**Defaulting to
      Lucide without a deliberate choice** — Lucide as the 'AI default' is the
      anti-pattern; the project must have consciously adopted it, not inherited
      it from a scaffold." `src/skills/iconography/SKILL.md:40-44` opens its
      pick step with "Default open sets: **Lucide** (clean, Tailwind-native)"
      and lists it first, then hard-wires `react-shadcn-ui → Lucide`. An agent
      following the skill inherits exactly the default the rule calls a scaffold
      tell. Rewrite the step so the set is *chosen* — brand token first,
      existing project set second, and the four open sets as unordered
      candidates with the criterion that picks between them.
      verify: the skill no longer presents any set as the default, and
      `icon-consistency` and `iconography` cite each other.
- [ ] **3.2 Keep the stack mappings as observations, not as instructions.**
      `react-shadcn-ui → Lucide` describes what that ecosystem ships; written in
      an imperative pick step it reads as a recommendation. Move it to a note
      that says which set each stack ships with, leaving the choice at 3.1.
      verify: the mapping survives as a statement about the ecosystem, and no
      step tells the agent to adopt it.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The widened trigger set makes the rule load constantly | implementation | `upload` and `endpoint`-shaped keywords are common; a threat-model stop that fires on every prompt is read past, which is worse than not firing | 1.2 forces every new keyword through the collision check, and 1.1's probe is four specific prompts rather than a keyword wish list | Phase 1 — The rule that names uploads and cannot be reached by them |
| 2 | The accessibility fix becomes a version-number edit | product | The cheapest way to make 2.1 green is to change the claim to WCAG 2.1, which resolves the drift while removing coverage the skill's audience expects | 2.2 fixes the two AA criteria first, so the claim is made true before the claim is touched at all | Phase 2 — The accessibility skill and the version it names |
| 3 | The icon rewrite removes guidance without replacing it | implementation | Deleting the default leaves an agent with four sets and no criterion, which produces an arbitrary pick — the same outcome the rule is trying to prevent | 3.1 requires the criterion that selects between the candidates to be written in the same edit that removes the default | Phase 3 — The icon default the sibling rule forbids |
| 4 | The three items are unrelated enough to stall each other | implementation | A phase blocked on a collision-gate decision holds up two edits that have nothing to do with it | The phases share no file and no gate; each can land as its own commit and the acceptance criteria are per-phase | Phase 1 — The rule that names uploads and cannot be reached by them |

## Acceptance Criteria

- [ ] AC-1 — A prompt naming a file upload, an SSRF allow-list, a public
      endpoint or an API response field matches `security-sensitive-stop`, and
      every trigger overlap it introduces is declared or narrowed.
- [ ] AC-2 — Every WCAG 2.2 AA criterion the skill's claim covers appears in the
      skill's own content with a testable condition, and the two level-A
      criteria are either present or omitted with a stated reason.
- [ ] AC-3 — A check fails when the skill claims a WCAG version whose criteria
      it does not carry.
- [ ] AC-4 — `iconography` presents no icon set as the default, states the
      criterion that selects one, and cross-references `icon-consistency`.
