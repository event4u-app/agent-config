# Cloud Bundle — Manual Smoke Report

**Status:** ⏳ pending real upload
**Phase:** 1, Step 7 of [`road-to-universal-distribution.md`](../roadmaps/road-to-universal-distribution.md)
**Bundles tested:** `pest-testing.zip` (T1), `agent-docs-writing.zip` (T2)
**Tester:** _<fill in>_  ·  **Date:** _<fill in>_

## What the smoke verifies

| # | Check | Why it matters |
|---|---|---|
| 1 | Claude.ai Web accepts the ZIP without error | Validates Anthropic Skills format compliance |
| 2 | Skill description renders in the picker | Confirms ≤ 200-char budget is correct in the wild |
| 3 | T1 bundle has **no** sandbox note | Cosmetic — clean output for pure-guidance skills |
| 4 | T2 bundle prepends sandbox note | Confirms agents understand cloud constraints |
| 5 | `<package-source>/` markers don't trigger filesystem attempts | Path-swap actually neutralizes local refs |
| 6 | Skill activates on a relevant prompt | Description triggers Claude's skill router |

## Pre-flight (already done by build)

```bash
task build-cloud-bundles-all     # 121 built, 4 T3-H skipped
ls dist/cloud/pest-testing.zip dist/cloud/agent-docs-writing.zip
```

Bundles are at:

- `dist/cloud/pest-testing.zip` (T1 — pure guidance)
- `dist/cloud/agent-docs-writing.zip` (T2 — sandbox note + path-swap)

## Upload protocol

1. Open Claude.ai → **Settings → Customize → Skills**.
2. Click **Add Skill** and select `dist/cloud/pest-testing.zip`.
3. Confirm:
   - [ ] Upload succeeds without validation error
   - [ ] Skill name shows as `pest-testing`
   - [ ] Description renders in full (no truncation banner)
4. Repeat with `dist/cloud/agent-docs-writing.zip`.
5. Confirm:
   - [ ] Upload succeeds
   - [ ] Description fits (note: it mentions `.augment/`, `agents/`, ~190 chars)
   - [ ] Sandbox note appears in skill preview if Claude shows the body

## Activation test — T1 (`pest-testing`)

Prompt:

> "Help me write a Pest test for a Laravel controller that lists users."

- [ ] Claude lists `pest-testing` among the active skills (or applies it silently)
- [ ] Output mentions Pest idioms (`it()`, `expect()`, `actingAs()`)
- [ ] Output does **not** reference `.agent-src/`, `agents/`, or `<package-source>/`

## Activation test — T2 (`agent-docs-writing`)

Prompt:

> "I just added a new module called `billing`. What documentation should I create?"

- [ ] Claude activates `agent-docs-writing`
- [ ] Output references `agents/` paths **descriptively** (as suggestions for the user to create)
- [ ] Output does **not** try to read or write any path
- [ ] No "I cannot access the filesystem" error — the sandbox note steered behavior

## Findings

_Fill in after the upload._

| # | Finding | Severity | Action |
|---|---|---|---|
| | | | |

## Screenshots

Place captures in `agents/reports/runs/cloud-bundle-smoke-<date>/`:

- `01-upload-pest.png` — successful upload of T1 bundle
- `02-upload-docs.png` — successful upload of T2 bundle
- `03-activation-pest.png` — skill triggered on Pest prompt
- `04-activation-docs.png` — skill triggered on docs prompt
- `05-sandbox-note.png` — sandbox note visible in T2 output (if applicable)

## Acceptance gate (Step 7 done when)

- [ ] All 6 checks above marked ✅
- [ ] Screenshots in `agents/reports/runs/cloud-bundle-smoke-<date>/`
- [ ] No critical findings (severity = blocker) — or if there are, a follow-up
      ticket / roadmap step is opened
- [ ] This file's `Status:` line flipped from ⏳ pending to ✅ verified

## Known limitations to verify in real upload

| Known | Risk | Mitigation if true |
|---|---|---|
| Description budget assumed at 200 chars | Claude.ai may truncate earlier (e.g. 180) | Re-tune `DESC_LIMIT_WEB` in `scripts/build_cloud_bundle.py` |
| `<package-source>/` placeholder is novel | Claude may parse it as a literal command | Switch to plain prose or a Markdown footnote |
| Sandbox note prepended before `# heading` | May break skill auto-routing if it parses h1 | Move note into frontmatter `description` instead |

---

← [Phase 1 roadmap](../roadmaps/road-to-universal-distribution.md)
