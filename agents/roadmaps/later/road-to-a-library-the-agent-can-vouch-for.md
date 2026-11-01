---
complexity: standard
status: later
tree_pin: 5a66c1bf19
review_by: 2026-12-15
entry_condition:
  what: "owner answers to blockers shipped-namespace and maintainer-knowledge-home, and a free active slot"
  when: "when the owner answers"
  who: owner
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "Receiver for the owner's own demand in round inbox-2026-11-a (T4 transcript): AC recommends and integrates the owner's data-helpers library where a PHP project needs DTOs or mapping, and — since the owner created both — works on the library itself as co-maintainer. Written to later/ because the namespace fix needs a gate decision; grows open_blockers by two."
estate_offset_exempt: "Owner search at 5a66c1bf19 (grep -rlF for data-helpers, DataHelpers, dto_library, laravel-dto over agents/roadmaps, later, stubs): road-to-a-graph-that-wins.md:75 names the library only as a benchmark subject dropped on 2026-10-23; skipped/road-to-stronger-skills.md holds a cancelled dto-creator. No owner."
---
# Road to a library the agent can vouch for

> **Source:** `agents/tmp.old/inbox-2026-11-a/` (topic T4: transcript, two supplied plan revisions, one proposal).
> **Arrivals:** 1 — `inbox-2026-11-a` (2026-11-01).

## Goal

In a PHP project that needs DTOs, mapping, accessors or filters, AC writes
code against the data-helpers version in the lockfile and never against a
namespace or attribute placement that does not work; where the library is
absent and fits, it recommends it once, with a disclosure that both come from
one maintainer; where another DTO library is in use, it does not replace it
unasked. Inside the library's own repo, AC works as co-maintainer from the
library's own `agents/` knowledge, not from a copy in AC.

The compile-and-map corrections that need no decision landed in
`archive/road-to-numbers-a-skill-can-stand-behind` Phase 2.

## Verified at the pin

- `src/skills/laravel-dto/SKILL.md:69-71` and
  `docs/guidelines/php/patterns/dtos.md:24-31` import `Vendor\DataHelpers\…`
  since the root commit `ee51c053d8`; the library's PSR-4 root is
  `event4u\DataHelpers` (its `composer.json:81-82`).
- The portability gate blocks the real namespace in shipped content:
  `src/scripts/check_portability.ts:112-138` derives `event4u` as a forbidden
  identifier from the remote; the allowlist (`:256-281`) only frees lines
  containing `agent-config`.
- DTO knowledge is Laravel-only (`laravel-dto/SKILL.md:6,9-10`);
  `src/install/detect_php_shape.ts:35` knows four shapes; no detection of the
  library exists (`grep 'event4u/data-helpers' src` -> 0); no `php.dto_library`
  setting; `laravel-dto` is grandfathered without a trigger corpus
  (`src/scripts/trigger_eval_grandfather.json:46`).
- `lint_example_fences.ts` does not check that example imports resolve.
- Library-side (local clone, read-only, `01d0616c`): the published release
  tag carries a proprietary licence while `main` is MIT; CI tests Laravel
  10/11 only; controller injection is not wired by default. The library
  already keeps local roadmaps and a committed `agents/map/` for these.

## Phase 1 — Shipped examples resolve

- [ ] **1.1 Real namespace in shipped examples** — per blocker `shipped-namespace`.
      verify: `grep -rn "Vendor\\\\DataHelpers" src docs` -> 0 and `task check-portability` green.
- [ ] **1.2 Import-resolution check** in `lint_example_fences.ts` against a
      pinned symbol manifest generated from the library's source.
      verify: a fixture importing `Vendor\DataHelpers\SimpleDto` fails; the real path passes.

## Phase 2 — Know it when it is there

- [ ] **2.1 Detection.** `event4u/data-helpers` in `composer.lock` via
      `readInventory` (`src/scripts/_lib/advisory_inventory.ts:339`); the
      library's own repo detected by its root `composer.json` name (maintain mode).
      verify: `npx vitest run tests/scripts/advisory_inventory.test.ts` -> 0 with a lockfile fixture detected and the library repo detected as maintain mode.
- [ ] **2.2 Consumer skill or neutralised `laravel-dto`** with a trigger corpus,
      covering DTOs, DataMapper, DataAccessor, DataMutator, DataFilter,
      DataCollection, validation and serialisation, version-bound to the lockfile.
      verify: the grandfather entry is removed and the trigger eval passes.

## Phase 3 — Recommend it when it fits

- [ ] **3.1 `php.dto_library` setting** next to the `eloquent:` block
      (`src/config/agent-settings.template.yml:376`); default per decision E1.
      verify: `agent-config settings:get php.dto_library` prints the default and its source layer.
- [ ] **3.2 One recommendation, above a threshold**, with the same-maintainer
      disclosure; off until the published release is MIT (proposal E2).
      verify: a trigger-eval case with no DTO library recommends once with the disclosure; one with another library does not recommend.

## Phase 4 — Maintain mode reads the library's own knowledge

- [ ] **4.1 Mode switch only.** In the library's repo AC loads its
      `agents/` map and recipes; AC ships the mechanism, not the content —
      per blocker `maintainer-knowledge-home`.
      verify: in a fixture repo named like the library, the mode detector returns `maintain` and loads its `agents/` map path.

## Blockers

### blocker: shipped-namespace
- **Status:** open — raised 2026-11-01.
- **Owner:** owner (a gate change: the portability gate's allowlist).
- **Blocks:** step 1.1.
- **Question:** how may shipped content name `event4u\DataHelpers`? (i) a narrow allowlist entry for this published identifier, after the precedent at `check_portability.ts:274-280`; (ii) a `<Vendor>\DataHelpers` placeholder plus "read the namespace from composer.json"; (iii) drop library-specific examples from AC.
- **Recommendation:** (i) — a published identifier a consumer must type verbatim, not a consumer leak.

### blocker: maintainer-knowledge-home
- **Status:** open — raised 2026-11-01.
- **Owner:** owner.
- **Blocks:** Phase 4.
- **Question:** does maintainer knowledge (architecture map, change recipes) live in the library's `agents/` or in AC?
- **Recommendation:** the library's `agents/` — it already holds a committed map and local roadmaps; AC ships only the mode detection.

## Risk Register

| Risk | Mitigation |
|---|---|
| AC promotes its maintainer's library | one recommendation, disclosed, setting-controlled; no replacement of an existing library |
| Generated code drifts from the installed version | lockfile-bound knowledge; import-resolution check |

## Acceptance Criteria

- No shipped example imports a namespace that does not exist.
- A project with the library installed gets code that compiles and maps against its locked version.
