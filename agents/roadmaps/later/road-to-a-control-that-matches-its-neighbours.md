---
complexity: structural
status: later
review_by: 2027-01-26
entry_condition:
  what: "agents/runtime/state/design-consistency-shadow.jsonl holds the shadow window the 3.3 activation policy names — all four conditions readable off the curve that `task bench:design-consistency-shadow` records; then 3.8 flips the default and AC-2 reads the box tolerance from the same curve"
  when: "after enough UI edits have run with the consistency rules in shadow; no date is promised"
  who: "maintainer (runs the bench over real edits); the council confirms the threshold read off the curve, per D2"
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-tells-a-near-miss-can-refute
    relation: disjoint
    note: "Sibling from the same round. Owns the slop detector's evaluation validity, the render engine reading styles.json and the page geometry capture. Phase 3 here adds two registry rules and must pass that roadmap's near-miss gate (its Phase 1) before either rule leaves shadow; the page visual diff (3.7) is owned here and that roadmap consumes it."
---
# Road to a control that matches its neighbours

> **Source:** `agents/tmp.old/inbox-2026-10-az/A/` — one owner transcript
> (three owner turns, 2026-10-25), two externally drafted plans (v4 and its
> revision v5) and one plan drafted against `main@c47b9af6b`. Re-verified
> against `main@f9af88efe0` on 2026-10-26; the corrections are under *What
> verification changed*.
>
> **The owner's demand, turn 2:** an added select box comes out as a plain
> native HTML control — at least its popup — and its padding does not match.
> "AC does it well, but then does not make sure it fits everything else and the
> design. That must not happen at all." **Turn 3:** "ok, do that" — approving
> the v5 proposal: a consistency guard that applies to every UI change without a
> command, interactive-state verification (open the dropdown), a per-project
> design-system fingerprint, visual regression with bounded self-repair, and the
> same for date pickers, dialogs, tooltips, tables, form fields and menus.

## Context — how "add a select box" bypasses the design chain

| # | Finding | Evidence at `f9af88efe0` |
|---|---|---|
| C1 | The trivial allow-list skips the audit for "≤ 1 file, ≤ 5 changed lines, no new component, no new state". A native `<select>` is an element, not a component, so the addition is trivial by rule. | `src/rules/ui-audit-gate.md:78-82` |
| C2 | `new_component` is the agent's self-report; nothing computes a new control role from the diff. | `src/agent-src/templates/scripts/work_engine/directives/ui_trivial/apply.ts:147`; reclassify target `ui-improve` at `:178-179` |
| C3 | The intent classifier has no `select`, `selectbox`, `combobox`, `website` and no German noun. **Executed:** "füge noch eine Selectbox hinzu", "add a select box for the status filter", "Prüf meine Website …" and "füg einen Status-Filter als Select hinzu" all classify `backend-coding`; "add a dropdown …" classifies `ui-build`. | `src/agent-src/templates/scripts/work_engine/intent/classify.ts:67-74` (`_UI_NOUNS`), `:212` (fallback) | <!-- md-language-check: ignore -->
| C4 | The triviality corpus has 40 prompts, all English, none inserting a control into an existing surface; its runner only knows `trivial`/`non-trivial` and measures trivial-lane recall/precision (today 1.000 / 0.938, PASS). | `internal/bench/corpora/ui-triviality-golden.yaml:75-271`; `src/scripts/eval_ui_triviality.ts:29` |
| C5 | The `ui:audit` artefact has `components_found`, `tokens`, `primitives`, `design_system_markers` — no role map, no prevalence, no box metrics of neighbouring controls. | `src/cli/commands/uiAudit.ts:84-119` |
| C6 | "No raw select" exists as prose in two stack skills only; `ui-apply-generic` checks `components_found` for reuse but has no raw-control ban; `blade-ui` and `livewire` have neither. | `src/skills/react-shadcn-ui/SKILL.md:290`, `src/skills/flux/SKILL.md:122`, `src/skills/ui-apply-generic/SKILL.md:79` |
| C7 | The checkers are default-off: `design_pass`, `ui_route_nudge`, `design_slop`. `lint_design_quality` excludes spacing multiples and magic numbers by design. | `src/scripts/hooks/design_pass_hook.ts:82`, `src/scripts/hooks/ui_route_nudge_hook.ts:41`, `src/config/agent-settings.template.yml:1320-1321,1347-1348`; `src/scripts/lint_design_quality.ts:21-24` |
| C8 | `ui:render` takes static viewport screenshots; it never clicks, focuses or opens anything, so an open popup is never seen. Its manifest carries `verification: verified|degraded|unverified`. | `src/cli/commands/uiRender.ts:5,48-52,86,355` |
| C9 | No knowledge of the styleable native picker: 0 hits for `base-select`, `::picker(select)`, `prefers-reduced-transparency`, `prefers-contrast` in `src/`. | `grep -rn` over `src/` |
| C10 | Motion authority forbids bounce absolutely; the drift linter enforces it in five carriers. Its `playful` override reaches only `styles.csv` rows, not the prose carriers. | `src/skills/fe-design/references/design-patterns.md:169,191`; `src/scripts/lint_motion_authority_drift.ts:98,281-309` |
| C11 | No gesture mechanics (0 hits for damping, rubber-band, pointer capture, hysteresis) and no tracking ladder in `typography-system` / `design-tokens`; only the extreme-value detectors T6/T10 exist. | `src/scripts/design_slop_rules.ts:336,659` |
| C12 | `design-review` recommends a remedial hierarchy and says "Do NOT prescribe solutions"; it ends in a report with no select-then-apply flow, and its interruptibility hint ("switch to transition/spring") is wrong for gestures. | `src/skills/design-review/SKILL.md:196-209,203,218-222,397` |

The defect is structural, not a model slip: by the size heuristic the addition is
trivial, by content it introduces a new control role, and for that role the agent
has nothing to look up.

## Goal

Every UI change — including a one-line follow-up with no command — that adds an
interactive control uses the project's own implementation of that control role
and the box metrics of its neighbours, is checked in its open/interactive state,
and is never reported as visually verified without render evidence.

## Phase 0 — Measure before changing anything

- [x] **0.1 Corpus and runner, pre-registered.** Done 2026-10-26: 18 cases (uit-041..058) with `category`/`lang`, three bars in `eval_ui_triviality`; baseline add_control 8/10 (uit-049, uit-050 fail), de_ui_recall 1/6, backend 4/4, trivial recall 0.882. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/eval_ui_triviality.ts --> Add ≥ 16 cases to
      `internal/bench/corpora/ui-triviality-golden.yaml`: 8 "insert a control
      into an existing surface" (select, date, checkbox, toggle, textarea,
      radio, dialog, combobox) and 8 German prompts (trivial, add-control and
      backend counter-probes such as "füge eine Spalte zur Tabelle hinzu").
      Extend the label schema with a `category` (`trivial` · `add-control` ·
      `backend` · `ui-other`) and `lang`, and teach `eval_ui_triviality` three
      bars, frozen in the corpus header before any classifier change:
      add-control never `ui-trivial` and never `backend-coding`; German UI
      recall ≥ 0.80; backend precision unchanged.
      verify: `./scripts-run src/scripts/eval_ui_triviality` prints the three bars
      and FAILS on the add-control and German rows at this step (C3 as a number).
- [x] **0.2 Frontend corpus "follow-up" cases.** Done 2026-10-26: `follow-up-select-shadcn`, `follow-up-popover-in-scroll-dialog`, `follow-up-native-no-primitive`, `follow-up-select-blade`, each with a `bars:` block; population 20 → 24, digest rewritten. <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change --> Under
      `tests/eval/frontend-corpus/cases/`: (a) an existing form with a project
      select component and two styled inputs, prompt "add a status filter as a
      select"; (b) a popover inside a scrollable dialog (clipping); (c) a
      native-HTML project with no primitive (negative control: native is
      correct); (d) one Blade/Livewire variant of (a). Metrics are
      deterministic only: raw `<select>` used although a primitive exists (0/1),
      box deviation from siblings (px height/padding, radius equal), open-state
      captured (0/1).
      verify: the case headers carry the bars before Phase 1; the corpus runner
      lists the four cases.

## Phase 1 — Close the bypass (deterministic, no hook dependency)

- [x] **1.1 Tighten the allow-list** (`src/rules/ui-audit-gate.md:78-84`). Done 2026-10-26: fifth condition in `ui-audit-gate` and `design-review-after-ui-write`, and in `docs/ui-track-mental-model.md`. <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> A fifth
      condition: no new interactive control role — no element or component of a
      role the file did not contain before (select, input other than hidden,
      textarea, checkbox, radio, switch, date/time, dialog, details, popover,
      combobox, menu, menu-button, tooltip, tabs, table). Tweaking an existing
      control stays trivial.
      verify: `grep -n 'control role' src/rules/ui-audit-gate.md` shows the fifth condition; the 1.2 fixtures pass against it.
- [x] **1.2 Replace the self-report** (`ui_trivial/apply.ts:147`). Done 2026-10-26: `work_engine/_lib/control_roles.ts` (`newControlRolesForFiles` against `git show HEAD:`), wired into `ui_trivial/apply.ts`; `tests/scripts/work_engine/control_roles.test.ts` (20 cases; neutralising the wiring reds the reclassify case). <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/agent-src/templates/scripts/work_engine/_lib/control_roles.ts --> Compute
      `new_control_roles` from the diff (added lines against 1.1's role table
      and against component tags the file did not contain). Non-empty → reclassify
      to `ui-improve`; the envelope field cannot override the computed value.
      verify: unit cases "insert a select" (reclassify), "change a select label"
      (stays trivial), "duplicate an existing `<x-select>`" (stays trivial).
- [x] **1.3 Compute it on every UI diff path.** Done 2026-10-26: `annotateControlRoles` refreshes `new_control_roles` on `state.changes` in `ui/apply` and at every `ui/polish` round; mixed tasks reach it through the UI track. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/agent-src/templates/scripts/work_engine/_lib/control_roles.ts --> The same function runs in the
      `ui`, `mixed` and polish paths of the work engine, not only in
      `ui_trivial`, so a control added during polish or a mixed task is caught
      by file change rather than by intent.
      verify: a polish-path fixture adding a raw select reports the role.
- [x] **1.4 Classifier vocabulary** (`classify.ts:67-118`). Done 2026-10-26: control phrases plus `UI_I18N.de`; bare `select` and `site` stay out (counter-probes uit-059/060 added before the change). Bars: add_control 10/10, de_ui_recall 6/6, backend 6/6, trivial recall 1.000, precision 0.944. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/agent-src/templates/scripts/work_engine/intent/classify.ts --> Control nouns
      (`select`, `selectbox`, `combobox`, `listbox`, `picker`, `datepicker`,
      `popover`, `tooltip`, `website`, `site`, `landing page`) and a separate,
      testable i18n table with German as its first column: Seite, Webseite,
      Website, Formular, Schaltfläche, Knopf, Auswahlfeld, Auswahlliste,
      Eingabefeld, Dialog, Menü; verbs `hinzufügen|füge … hinzu` → build,
      `ändere|passe … an|tausche` → trivial verb, `prüf|überprüf` → improve.
      verify: 0.1's bars hold including backend precision; if it drops, the
      vocabulary is cut back to unambiguous UI nouns (`input`/`field`/`table`
      stay out, as the comment at `:57-66` argues).

## Phase 2 — An object for "fits the rest"

- [x] **2.1 Role map in the `ui:audit` artefact** (`uiAudit.ts:99`). Done 2026-10-26: `control_roles` via `src/scripts/_lib/control_roles.ts` (`buildControlRoles`: prevalence, defined primitives, native-vs-component and system-marker tie breaks, else `tie`). <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/agent-src/templates/scripts/work_engine/_lib/control_roles.ts --> Additive
      field `control_roles`: per 1.1 role, `{canonical, uses, outliers:
      [path:line]}`; canonical by prevalence, ties broken by
      `design_system_markers`, otherwise ask. `schema: 1` stays (additive).
      verify: a `ui:audit` fixture with two project selects and one raw select reports `control_roles.select.canonical` = the component and one outlier.
- [x] **2.2 Box metrics per role.** Done 2026-10-26: Tailwind `box_metrics` from the canonical use or its primitive (trigger / Blade class merge); `null` + `box_metrics_reason` otherwise; `source: render` waits on 3.4/3.5. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/agent-src/templates/scripts/work_engine/_lib/control_roles.ts --> `box_metrics` per role: height, padding x/y,
      radius, font size, border — `source: static` from Tailwind classes and
      token references, `source: render` when a `ui:render` artefact exists,
      `null` with a reason when neither, never 0.
      verify: the same fixture reports `box_metrics.select` with `source: static`; a non-Tailwind fixture reports `null` with a reason.
- [x] **2.3 Staleness stamp.** Done 2026-10-26: `stamp {head, inputs_digest, files}`, `isUiAuditStale`, `lookupControlRoles` recomputes; `tests/cli/uiAudit_control_roles.test.ts`. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/agent-src/templates/scripts/work_engine/_lib/control_roles.ts --> The artefact records the git HEAD and the input
      file hashes it was computed from; a consumer seeing a different HEAD on a
      touched UI file recomputes before use.
      verify: a fixture edits a component after the audit and the lookup
      recomputes.
- [x] **2.4 One lookup line in every apply path.** Done 2026-10-26: one identical **Control roles** sentence in the six skills (`grep -c control_roles` = 1 each); fe-design's skip clause names the new control role. <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> `fe-design`,
      `ui-apply-generic`, `blade-ui`, `livewire`, `react-shadcn-ui` and `flux`
      get the same canonical sentence: for every control you add, look up its
      role in `control_roles`, use the canonical implementation and the
      siblings' `box_metrics`; role missing → ask before inventing a control
      kind. Choosing a native control although a primitive exists records a
      `native_control_reason` in the step output.
      verify: `grep -c control_roles` over the six SKILL.md files returns 1 each, with identical wording.
- [x] **2.5 Native-select canon** Done 2026-10-26: § Native select in `design-patterns.md`. <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> in `fe-design/references/design-patterns.md`
      § Component Architecture: a project primitive is always used; without one,
      a native `<select>` with `appearance: base-select` and `::picker(select)`
      as progressive enhancement (Chromium 135+; Safari announced; Firefox open),
      styled with project tokens, closed state styled for every browser; a custom
      listbox only with the full ARIA combobox pattern (cross-reference
      `accessibility-auditor`).
      verify: `grep -n 'base-select' src/skills/fe-design/references/design-patterns.md` returns at least one line.

## Phase 3 — The check that would have caught it (shadow first)

- [x] **3.1 Two registry rules** in `design_slop_rules.ts`, Done 2026-10-26 as `src/scripts/lint_design_consistency.ts`, not in the registry (D11). <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/continuity-surface.json --> reached by
      `lint_design_slop`, `design_slop_hook` and (through the linter)
      `design_pass_hook`: `consistency-raw-control` (raw element of a role that
      has a component canonical in `control_roles`) and
      `consistency-sibling-metrics` (padding, height or radius deviating from the
      role or sibling canonical, Tailwind static). Severity P1, suppressible with
      a reason.
      verify: 0.2(a) with a raw select fires `consistency-raw-control`; 0.2(c) does not.
- [x] **3.2 Near-miss corpus per rule.** Done 2026-10-26: native select without a primitive and a dense `operate` table, both clean in `tests/scripts/lint_design_consistency.test.ts`; neutralising the local-sibling rule reds the table case. <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/continuity-surface.json --> A deliberately native select in a
      project without a primitive; siblings with intentionally different density
      in an `operate` table. Both rules must pass the sibling roadmap's
      near-miss gate before leaving shadow.
      verify: both near-miss fixtures stay clean under the two rules.
- [x] **3.3 Shadow window** Done 2026-10-26: `--shadow` records `would_fire` at 0/2/4 px to `design-consistency-shadow.jsonl`; `task bench:design-consistency-shadow` runs it over `src/ui` (first reading: 2 raw-control rows, `WorkspacePage.tsx:407,521` beside `src/ui/forms/Textarea.tsx`). Per <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/continuity-surface.json --> `docs/contracts/concern-activation-policy.md:31`:
      emit nothing, record `would_fire` at ±0/2/4 px tolerance, threshold from
      P99+1 of the legitimate distribution. The CI linter variant runs
      report-only from day one.
      verify: the shadow record carries `would_fire` per tolerance and emits nothing to the user.
- [x] **3.4 Sibling reference mode for `ui_conformance_probe`.** Done 2026-10-26: `--subject` + `--reference-sibling` (+ `--tolerance`), `captureSiblingPair` / `compareSiblingBoxes`; live test in `tests/scripts/ui_conformance_probe_sibling.test.ts`. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/ui_conformance_probe.ts -->
      `--reference-sibling <selector>` compares a node against a sibling on the
      same page (today only `--target`/`--reference` whole files and
      `data-probe-id` matching, `src/scripts/ui_conformance_probe.ts:1140-1147`).
      Stays shadow.
      verify: `ui_conformance_probe --reference-sibling` reports the padding deviation of 0.2(a).
- [x] **3.5 Open-state probe.** Done 2026-10-26: `src/cli/commands/uiRenderInteract.ts`, `ui:render --interact`; manifest `interactions`; `ui:audit` takes render boxes first (`renderedBoxMetrics`); live tests in `tests/cli/uiRenderInteract.test.ts` (clipping by `#dialog-body` reported, native select → `native-os`). <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/cli/commands/uiAudit.ts --> `ui:render --interact <selector>` opens, focuses
      and keyboard-operates each newly added interactive control (click, Enter,
      Arrow, Escape, outside click), captures the open state and records overlay
      and portal bounds, clipping against scroll ancestors and z-index, and
      writes measured box metrics back as `box_metrics.source: render` (2.2). No
      browser → `unverified`, never `verified`.
      verify: fixture 0.2(b) reports the clipped popover; a closed-state-only
      run of 0.2(a) reports `open_state: not-captured`.
- [x] **3.6 No false done.** Done 2026-10-26: `consistency_status` in `ui/review.ts` (stamped on `verdict_scope`), `## UI consistency` in the delivery report; `tests/scripts/work_engine/consistency_status.test.ts`. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/agent-src/templates/scripts/work_engine/directives/backend/report.ts --> The UI completion report carries
      `consistency_status: pass | fail | static-pass | unverified`, derived from
      the 3.1 rules, the 3.5 capture and `ui:render`'s `verification`. "Visually
      verified" is never written without render evidence.
      verify: a run with no browser reports `static-pass` or `unverified`, never
      `pass`.
- [x] **3.7 Visual regression with bounded repair.** Done 2026-10-26 as a computed-style signature, not a pixel diff (D12): `src/cli/commands/uiRenderRegion.ts`, `ui:render --region/--baseline/--approve`; deltas enter the polish loop via the review instruction; `tests/cli/uiRenderRegion.test.ts` (live: approve, then a 12→4 px padding change fails). <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/continuity-surface.json --> Extend
      `uiRenderAssetCompare` to the page profile (same font-delta tolerance,
      animations off): compare the changed region against an approved baseline
      when one exists under the project's render store, otherwise against the
      3.4 sibling reference. A deviation enters the existing polish loop (2
      rounds, `directives/ui/polish.ts:8,25`); what remains is reported, never
      silently accepted.
      verify: fixture 0.2(a) with a wrong padding is repaired or reported within
      two rounds.
- [ ] **3.8 Default on, once the data says so.** When 3.3's shadow meets all
      four conditions of the activation policy, flip `hooks.design_pass`
      (post_tool_use) to default-on for consumers with the consistency rules
      enabled, per the owner's turn-2/turn-3 words (D2). The consistency check
      reaches the hook as a conditional chunk (as `svg_rules`), because the
      dispatch bundle has no headroom for it inline (D11).
      verify: the settings template default and a CLAIMS line change in one
      commit that cites the shadow reading.

## Phase 4 — Review before rebuild

- [x] **4.1 Review-only entry.** Done 2026-10-26: `is_review_only` marks `input.data.review_only` at routing; `ui/apply` halts with `review-before-rebuild` (no write). <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/agent-src/templates/scripts/work_engine/directives/ui/apply.ts --> "Prüf meine Seite/Website …" (1.4) routes to <!-- md-language-check: ignore -->
      `design-review` with `change_intent: preserve` and no write access in this
      phase. Output: a numbered finding list — severity, before/after/why,
      `file:line`, and the `control_roles` deviation where present.
      verify: a review-only fixture run makes no write before the selection.
- [x] **4.2 Selection instead of full rebuild.** Done 2026-10-26: `ui_review.selection` releases apply; unselected → `deferred` with `accepted_risk` / "deferred by the user" (recorded in the review envelope, not via `check_finding_dispositions`). <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/agent-src/templates/scripts/work_engine/directives/ui/apply.ts --> Findings are put as a
      host-native multi-select question grouped by severity, blockers selected by
      default; unselected findings are recorded as deferred by the user. The
      disposition vocabulary is wired to design-review findings here (today
      `check_finding_dispositions.ts:63` serves PR/release reviews only).
      verify: unselected findings appear with the deferred disposition in the report.
- [x] **4.3 Apply selected, re-review selected.** Done 2026-10-26: `selection_gaps` + review gate: every selected id `fixed`+commit or `not-fixed`+reason; unrequested fixes reported. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/agent-src/templates/scripts/work_engine/directives/ui/apply.ts --> Only selected findings are
      changed; a re-review over their diff marks each `fixed` with its commit;
      unrequested changes are a review finding.
      verify: each selected finding ends `fixed` with its commit; an unrequested change is reported.
- [x] **4.4 Resolve the contradiction** Done 2026-10-26. <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> (`design-review/SKILL.md:196` vs `:397`):
      "In review: describe problem and impact, prescribe no fix. In apply: the
      remedial hierarchy applies."
      verify: `grep -n 'prescribe' src/skills/design-review/SKILL.md` returns the phase-split wording only.
- [x] **4.5 Unattended default.** Done 2026-10-26: in the `review-before-rebuild` halt text, tested. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/agent-src/templates/scripts/work_engine/directives/ui/apply.ts --> User unreachable → apply blockers, leave the
      rest as a list, say so at the top of the result; never a silent full
      rebuild.
      verify: the unattended fixture applies blockers only and says so in its first line.

## Phase 5 — Craft mechanics, only where the tree has a gap

- [x] **5.1 A class instead of a hole in the bounce ban** Done 2026-10-26: authority bullet; drift gate requires `playful register` or `momentum-carried` in an overshoot row's override (`OVERSHOOT_CLASS`); self-test 15/15 incl. both cases. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/lint_motion_authority_drift.ts -->
      (`design-patterns.md:191`). The ban stays for decorative, hover, menu and
      entrance bounce. New class `momentum-carried`: overshoot allowed if and
      only if the motion continues a gesture's release velocity (drag, flick,
      sheet); critically damped default, damping ~0.8 or `bounce` ≤ 0.2 under
      momentum. The drift linter accepts it through a new class-token check on
      the prose carriers (the `playful` mechanism reaches `styles.csv` only).
      verify: "bounce on dropdown open" stays red; "sheet release with velocity
      + momentum-carried" is green.
- [x] **5.2 Correct the interruptibility hint** Done 2026-10-26. <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> (`design-review/SKILL.md:203`):
      gesture-driven → spring or WAAPI from the current on-screen value carrying
      velocity; state change without a gesture → a CSS transition suffices
      (consistent with `design-patterns.md:233,241`).
      verify: `grep -n 'switch to transition/spring' src/skills/design-review/SKILL.md` returns nothing.
- [x] **5.3 Gesture reference** Done 2026-10-26: `fe-design/references/gesture-mechanics.md`, linked from `fe-design`. <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> as a reference file under
      `fe-design/references/`, not a skill: feedback on pointer-down, 1:1
      tracking with grab offset and pointer capture, ~10 px hysteresis, velocity
      hand-off, momentum projection, rubber-banding, start from the current
      value, symmetric enter/exit paths, origin at the trigger. Own wording.
      verify: the reference file exists and `fe-design/SKILL.md` links it.
- [x] **5.4 Tracking and leading ladder** Done 2026-10-26: ladder in `worked-scales.md`; starter emits `letterSpacing` per step in rem (DTCG dimensions allow px/rem only). <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> in
      `typography-system/references/worked-scales.md`: `letterSpacing` per step
      (display negative, body ≈ 0, small/caps slightly positive) within T6
      (−0.04 em) and T10 (0.05 em); `font-optical-sizing: auto` first for `opsz`
      fonts; `design-tokens` emits DTCG `letterSpacing` per step.
      verify: every step in `worked-scales.md` carries `letterSpacing` within T6/T10; `design-tokens` emits it.
- [x] **5.5 Material fallbacks.** Done 2026-10-26: `_lib/material_fallback.ts`, `lint_design_quality --shadow` (never counted); first reading over `src/ui`: 5 rows. <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/material_fallback.ts --> A DQ7 candidate in `lint_design_quality` after
      DQ4's pattern: `backdrop-filter` or translucent background without an
      opaque variant under `prefers-reduced-transparency: reduce` and a contrast
      variant under `prefers-contrast: more`; the canon recommends the additive
      pattern. Starts in shadow.
      verify: a translucent-surface fixture without fallbacks fires in shadow; one with the additive pattern does not.
- [x] **5.6 Path to the primary action.** Done 2026-10-26: `design-review` Phase 3 bullet (prose; no executable contract, so no test). <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> For `surface_mode: persuade`,
      `design-review` Phase 3 gets a check: one primary action per surface,
      reachable in the first viewport, same placement across pages, wayfinding
      questions. A finding with evidence, no score.
      verify: a `persuade` fixture with two competing primary actions produces the finding.

## Phase 6 — A result a non-designer understands

- [x] **6.1 Plain-language head.** Done 2026-10-26: `design-review` § Output format item 1. <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural --> At most four plain headlines before the
      technical ledger of a review report ("the logo is too small", "the reserve
      button gets lost"), projected from findings, no new claims.
      verify: a review report fixture opens with at most four plain headlines, each traceable to a finding.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | Land active and process now. | The owner's invoking turn of 2026-10-26: analyse this round, then work the roadmaps with `/roadmap:process-full`. | — |
| D2 | product-owned | owner | Consistency checking becomes default for consumers once the shadow meets the activation policy (3.8); it is not left in shadow indefinitely. Supersedes the drafted plan's open E2 and kill K8. | Turn 2: "Das darf so natürlich nicht sein"; turn 3 "ok, mach das" on v5, whose PR4 is default-on after the pilot and whose principle is "a binding part of the normal workflow". | The shadow reading fails a policy condition. | <!-- md-language-check: ignore -->
| D3 | reversible-technical | agent | German vocabulary as an i18n table with German as the first column. | Further languages need no classifier change. | — |
| D4 | reversible-technical | agent | Add the `momentum-carried` class rather than deleting the ban or keeping it absolute. | The ban stays enforced for every non-gesture case; the negative fixture keeps it red. | The drift linter's negative case goes green. |
| D5 | reversible-technical | agent | `base-select` is the canon fallback without a project primitive; a custom listbox only with the full ARIA pattern. | C9; the closed state stays styleable everywhere. | A target browser drops the feature. |
| D6 | reversible-technical | agent | Review selection by host-native question with chat fallback and the 4.5 unattended default. | — | — |
| D7 | reversible-technical | agent | Tighten the trivial lane (1.1-1.3); do not abolish it. | Real micro-tweaks stay fast; the defect is the missing role check. | 0.1's add-control bar fails after Phase 1. |
| D8 | reversible-technical | agent | Kept from the drafted plan's kill register: no cloned vendor-look design skill and no default "look"; no one-sentence initial response pattern; no text copied from the source; no advisory nudge as the fix (measured advisory null, `concern-activation-policy.md:41`); no new slash command (ADR-041); no 0-10 design scores. | Drafted plan § 6, K1-K7. | — |
| D9 | reversible-technical | agent | Declined from the external plans: blind A/B judge with multi-run scoring, lite/standard/deep tiers, a scored assessment JSON, a 12-20 task benchmark, variant generation, an upstream watcher, a feedback loop and a web-vitals track. | The defect is deterministic and P0 measures it; `design-variations` and the release runbook's upstream watchlist exist; tiers are covered by the 1.1-1.3 classification; scores are D8. | P0's bars cannot be met without a judged signal. |
| D11 | reversible-technical | agent | The two consistency findings live in `lint_design_consistency`, not in `design_slop_rules.ts`; their shadow carrier is `--shadow` plus a task, not `design_pass_hook`, and no workflow step is added. | A registry rule is a `backed` catalog claim (`lint_design_antipattern_parity` check C) that the sibling roadmap's near-miss gate has not measured; the dispatch bundle has 55 B of headroom (`check_hook_bundle_composition`, 1,556,615 / 1,556,670) and `design_pass` ships default-off; a workflow edit is a governance surface (`check_kernel_edit_ratified`). The hook wiring is part of 3.8, where the default flip is decided. | 3.8 flips the default; the near-miss gate promotes the rules. |
| D12 | reversible-technical | agent | Page regression (3.7) compares a computed-style signature of the changed region against an approved baseline, not pixels; a font-only difference reads `degraded`. | A pixel verdict is a per-machine verdict through anti-aliasing and font rasterisation — the reason `uiRenderAssetCompare` refuses one; the asset compare itself is SVG-geometry-specific and does not extend to a page. | A consumer needs a pixel diff that a style signature provably misses. |
| D10 | deterministic | evidence | Closure pass ran 2026-10-26: no open decision beyond D1-D9. The three `ambiguous-acceptance` hits (the C2 context row, 1.2, 1.4) are wording; each step carries a command-shaped `verify:`. | `closure_scan` over this file. | a step is executed and its oracle cannot be checked. |

## What verification changed

- C3 was read from code at the pin; it is now executed: four German/select
  prompts route to `backend-coding`.
- 0.1 as drafted assumed the runner could compute its bars; it can only score
  trivial vs non-trivial, so 0.1 now extends the runner.
- C6: `ui-apply-generic` already checks `components_found` for reuse; the gap
  is the raw-control ban, not reuse.
- 5.1: the `playful` override reaches only `styles.csv`; the prose carriers need
  a new class-token check.
- 4.2: the disposition vocabulary is not wired to design-review findings yet.
- Owner-approved v5 items the drafted plan lacked are now steps: 1.3, 2.3, the
  `native_control_reason` in 2.4, 3.5, 3.6, 3.7, 3.8, and the 1.1 roles
  tooltip, tabs, menu-button and table.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The role check reclassifies too much | product | Every tweak near a control escalates and the trivial lane loses its speed. | 1.2's "existing role stays trivial" fixtures; 0.1's trivial bar must hold. | Phase 1 — Close the bypass (deterministic, no hook dependency) |
| 2 | German vocabulary steals backend prompts | implementation | "Tabelle", "Feld" are DB words too. | 0.1 freezes backend precision; ambiguous nouns stay out. | Phase 1 — Close the bypass (deterministic, no hook dependency) |
| 3 | Static box metrics are wrong for non-Tailwind stacks | implementation | Class parsing sees nothing in CSS-module or Blade projects. | `null` with reason, never 0; render metrics when available (2.2, 3.4). | Phase 2 — An object for "fits the rest" |
| 4 | Default-on raises false alarms on clean UI | product | One false block makes an operator disable the carrier. | Shadow first, policy conditions, near-miss gate (3.2-3.3, 3.8). | Phase 3 — The check that would have caught it (shadow first) |

## Acceptance Criteria

- [x] AC-1 — 0.1's bars are committed before any classifier change; after Phase 1 add-control prompts never route `ui-trivial` or `backend-coding`, German UI recall ≥ 0.80, backend precision unchanged. Met 2026-10-26: `eval_ui_triviality` bars add_control 10/10, de_ui_recall 6/6, backend 6/6, all PASS; the bars landed in the corpus commit before the classifier change. <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/design_slop_hook.ts -->
- [ ] AC-2 — Case 0.2(a): raw select = 0 with a primitive present, box deviation within the shadow tolerance, open state captured.
- [x] AC-3 — No UI completion report says `pass` without render evidence. Met: `consistency_status` returns `pass` only for a rendered review with every added control captured open (`tests/scripts/work_engine/consistency_status.test.ts`). <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/design_slop_hook.ts -->
- [x] AC-4 — `lint_motion_authority_drift` green with the new class; its negative case red. Met: `lint_motion_authority_drift --self-test` 15/15, its negative cases rejecting. <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/design_slop_hook.ts -->
- [x] AC-5 — A review-only run writes nothing before the selection; every selected finding ends `fixed` with a commit or a reason. Met: `tests/scripts/work_engine/review_before_rebuild.test.ts` green. <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/design_slop_hook.ts -->
