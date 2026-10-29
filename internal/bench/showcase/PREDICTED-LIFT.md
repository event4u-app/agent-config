# Predicted lift — showcase artifact tasks

> Written 2026-10-28 for `road-to-a-baseline-that-has-to-catch-up` step 0.2,
> BEFORE any artifact task file, grader or run is committed. Each row names a rule or
> skill that, if it reaches the with-agent-config arm, should change what that
> arm produces on the task. A prediction is a hypothesis to be measured, never
> evidence of a lift: a null against these rows is a result, and is published.
> Every `file:line` was grepped against the tree on 2026-10-28.

A task with no row here is not a showcase task — there would be nothing the
package could be expected to contribute, so a measurement would only describe
the model.

## How to read a row

- **Asset** — the rule (`src/rules/`) or skill (`src/skills/`) and the line that
  carries the obligation.
- **Expected effect** — what should differ in the with-arm's artifact, stated in
  terms the task's primary grader can see.
- **Reach** — `rule` assets are delivered without invocation; `skill` assets
  only act when the skill is invoked, so a skill-only prediction can fail on
  activation alone. A null on a skill-only row says nothing about the skill's
  content until the run records whether it was invoked.

## art-svg-prompt-01 — SVG from a prompt (grader `svg-render-gate`, claim `showcase-svg-render-gate`)

| Asset | Line | Expected effect | Reach |
|---|---|---|---|
| `src/skills/svg-authoring/SKILL.md` | 73 | no `<script>`, `on*`, `javascript:` or `foreignObject` in the output | skill |
| `src/skills/svg-authoring/SKILL.md` | 83 | the agent renders its own SVG before stopping, so a blank or off-canvas drawing is caught in-run | skill |
| `src/skills/svg-authoring/SKILL.md` | 59 | viewBox sized to the content, not under-filled | skill |

## art-svg-raster-01 — SVG from an in-repo raster mascot (grader `svg-render-gate`, claim `showcase-svg-render-gate`)

| Asset | Line | Expected effect | Reach |
|---|---|---|---|
| `src/skills/svg-authoring/SKILL.md` | 40 | the raster is traced into vector paths, not embedded as an `<image>` | skill |
| `src/skills/svg-authoring/SKILL.md` | 73 | no embedded raster, script or `foreignObject` | skill |
| `src/rules/design-fidelity.md` | 71 | an image handover is the spec; shape and palette follow the mascot rather than a reinterpretation | rule |

## art-landing-01 — landing page from brief and tokens (grader `acceptance+axe`, claim `showcase-page-form-acceptance`)

| Asset | Line | Expected effect | Reach |
|---|---|---|---|
| `src/rules/brand-source-of-truth.md` | 53 | colours, type and spacing trace to the supplied tokens | rule |
| `src/skills/fe-design/SKILL.md` | 47 | supplied tokens and conventions outrank invented values | skill |
| `src/skills/accessibility-auditor/SKILL.md` | 56 | text alternatives on non-text content (axe `image-alt`, `svg-img-alt`) | skill |
| `src/skills/accessibility-auditor/SKILL.md` | 78 | `lang` on `<html>` and predictable navigation | skill |

## art-form-01 — multi-step form (grader `acceptance+axe`, claim `showcase-page-form-acceptance`)

| Asset | Line | Expected effect | Reach |
|---|---|---|---|
| `src/skills/form-handler/SKILL.md` | 30 | state carried across steps; a back step does not lose input | skill |
| `src/skills/form-handler/SKILL.md` | 16 | a chosen validation timing and error placement instead of none | skill |
| `src/skills/accessibility-auditor/SKILL.md` | 77 | every control has an associated label (axe `label`) | skill |

## art-login-framework-01 — login in a PHP framework skeleton (grader `functional+exploits`, claim `showcase-login-security`)

| Asset | Line | Expected effect | Reach |
|---|---|---|---|
| `src/rules/security-sensitive-stop.md` | 76 | login is named a security-sensitive surface, so a threat pass precedes the edit | rule |
| `src/skills/laravel/SKILL.md` | 272 | rate limiting on login (the `no throttle` exploit fails) | skill |
| `src/skills/security/SKILL.md` | 89 | no fast general-purpose hash for a password (the `fast hash` exploit fails) | skill |
| `src/skills/ai-code-blindspots/SKILL.md` | 56 | password columns use bcrypt or argon2 | skill |
| `src/skills/laravel-validation/SKILL.md` | 27 | input validated in a FormRequest at the boundary | skill |

## art-login-plain-01 — plain-PHP login (grader `functional+exploits`, claim `showcase-login-security`)

| Asset | Line | Expected effect | Reach |
|---|---|---|---|
| `src/rules/security-sensitive-stop.md` | 76 | as above — the only rule-reach asset for a login | rule |
| `src/skills/security/SKILL.md` | 89 | no fast hash for a password | skill |
| `src/skills/security/SKILL.md` | 132 | no plaintext password stored | skill |
| `src/skills/ai-code-blindspots/SKILL.md` | 56 | bcrypt or argon2 password storage | skill |

**Stated gap, recorded so the result is not over-read.** No rule and none of the
skills above carries session regeneration on login: `grep -n "regenerat\|fixation"`
over `src/skills/security/SKILL.md`, `src/skills/laravel/SKILL.md` and
`src/skills/ai-code-blindspots/SKILL.md` returns nothing. A with-arm pass on the
session-fixation exploit is therefore not predicted by any asset here, and the
enumeration and CSRF exploits have only the general
`src/skills/security/SKILL.md:4` description behind them.

## art-php-endpoint-01 — PHP CRUD endpoint (grader `hidden-tests`, claim `showcase-php-endpoint-hidden-tests`)

| Asset | Line | Expected effect | Reach |
|---|---|---|---|
| `src/rules/broken-access-control.md` | 55 | unauthenticated, not-owner and cross-tenant requests are refused | rule |
| `src/rules/architecture.md` | 23 | validation at the request boundary, not inline | rule |
| `src/rules/senior-engineering-discipline.md` | 55 | authorization, validation and rate limit on the route | rule |
| `src/skills/laravel-api-endpoint/SKILL.md` | 35 | FormRequest validation and Policy authorization | skill |
| `src/skills/authz-review/SKILL.md` | 41 | ownership rules checked end to end | skill |

## art-page-copy-01 — reproduce a frozen in-repo page (grader `bench-ui`, claim `showcase-copy-fidelity`)

| Asset | Line | Expected effect | Reach |
|---|---|---|---|
| `src/rules/design-fidelity.md` | 69 | the provided source is built from, the screenshot only validates | rule |
| `src/skills/design-review/SKILL.md` | 264 | a per-chapter fidelity matrix before claiming 1:1 | skill |
| `src/skills/existing-ui-audit/SKILL.md` | 4 | tokens and components inventoried before writing | skill |

## art-app-copy-01 — reproduce a fictional in-repo mini todo app (grader `acceptance+axe`, claim `showcase-copy-fidelity`)

| Asset | Line | Expected effect | Reach |
|---|---|---|---|
| `src/rules/design-fidelity.md` | 69 | the provided app source is the data basis | rule |
| `src/rules/senior-engineering-discipline.md` | 41 | behaviour beyond the happy path (empty list, delete, edit) | rule |
| `src/skills/accessibility-auditor/SKILL.md` | 77 | labelled inputs and buttons | skill |
