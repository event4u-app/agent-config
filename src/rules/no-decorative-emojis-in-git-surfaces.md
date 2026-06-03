---
type: "auto"
tier: "3"
alwaysApply: false
description: "Generating PR/issue/commit titles or PR/issue comments — forbids decorative emojis; allowed in PR/issue descriptions + commit bodies only when matched by an in-artifact legend"
triggers:
  - intent: "PR title"
  - intent: "PR body"
  - intent: "commit message"
  - intent: "issue title"
  - intent: "post PR comment"
  - keyword: "gh pr create"
  - keyword: "git commit"
workspaces:
  - agent-config-maintainer
  - engineering
packs:
  - meta
---

# No Decorative Emojis in Git Surfaces

## Iron Law

```
NEVER ADD DECORATIVE EMOJIS TO PR / ISSUE / COMMIT TITLES OR
TO PR / ISSUE COMMENTS. NEVER ADD UNIVERSAL-BLACKLIST EMOJIS
(🤖 🚀 🎉 ✨ 🔥 💡 👍 ❤️) ANYWHERE — TITLE OR BODY.
DECORATIVE EMOJIS IN PR / ISSUE DESCRIPTIONS OR COMMIT BODIES
ARE ALLOWED ONLY WHEN A LEGEND IN THE SAME ARTIFACT DEFINES
EVERY EMOJI USED. NO LEGEND → NO EMOJI.
EXCEPTION: USER EXPLICITLY ASKED FOR IT THIS TURN.
```

Decorative = added for visual flair, ranking, mood, or "look how
fancy". Functional emojis below are not decorative and stay allowed.

## Surfaces — what this gates

Always blocked (title surfaces + free-standing comment threads):

- PR titles (`gh pr create --title`, `octokit.pulls.create`, PATCH).
- Issue titles (`gh issue create`, `octokit.issues.create`, PATCH).
- Commit subject line (first line of `git commit -m` / message file).
- Branch names.
- Standalone PR / issue comments (`gh pr comment`, `gh issue comment`,
  `octokit.issues.createComment`) — covers everything `no-pr-progress-comments`
  lets through (review-replies, user-invoked comment flows).

Conditional, body-only — emojis allowed when a legend in the same
artifact defines every emoji used (see below):

- PR / issue descriptions (body of the create / PATCH payload).
- Commit body (lines after the blank-line separator below the subject).

## Universal blacklist — forbidden even with a legend

```
🤖 🚀 🎉 ✨ 🔥 💡 👍 ❤️ 🤗 😊 (and skin-tone / variant forms)
```

These are the "look how fancy" / empathy classes from `direct-answers`.
Self-attribution (🤖) is the canonical violation pattern from the
punkpeye PR (#6865 title-emoji spam). No legend rescues them.

## Legend carve-out — when decorative emojis ARE allowed in a body

Allowed only when ALL of the following hold for the same artifact:

1. The body contains a `Legend:` (or `Legende:`) block on its own line
   that defines every decorative emoji used elsewhere in the body.
2. The emojis carry **information** (language tag, OS marker, hosting
   class) — they are not pure decoration. Compare punkpeye-#6865 body:
   `📇 TypeScript · ☁️ Cloud · 🏠 Local · 🍎 macOS · 🪟 Windows · 🐧 Linux`.
3. No universal-blacklist emoji appears (above list always wins).

Body emojis without a legend → strip before posting / committing.

## Whitelist — always allowed, no legend needed

- CLI / agent-status markers: `❌` `✅` `⚠️` (carry literal status).
- Mode markers from `role-mode-adherence`.
- Roadmap checkbox glyphs (`[x]` `[~]` `[-]`) inside fenced code or
  quoted roadmap excerpts — these are not emojis, no carve-out needed.

## Server-side re-injection

If the host AI client or tool wrapper re-injects 🤖 / 🎉 into a title
or comment after creation (analog to the `Pull Request opened by …`
injection covered in `no-attribution-footers`), the same mitigation
applies: re-fetch after create, regex-strip the offending characters,
PATCH if changed, re-fetch to verify.

## Failure modes — what counts as a violation

- `feat: 🚀 ship the unified setup wizard` — emoji in commit subject.
- PR title `🤖 Update dependencies` — title-emoji spam (punkpeye #6865).
- Comment body `🎉 All checks green now!` — decorative comment.
- PR body with `Status: 🟢 Ready` — no legend, no carve-out.
- Branch named `feat/🔥-new-thing` — emoji in ref name.
- Body legend present but body also uses 🤖 — universal blacklist wins.

## See also

- [`no-attribution-footers`](no-attribution-footers.md) — sibling rule on
  the same surfaces; covers the `🤖 Generated with …` footer class.
- [`no-pr-progress-comments`](no-pr-progress-comments.md) — gates *whether*
  to post a comment at all; this rule gates the *form* of any comment
  that does get posted.
- [`commit-conventions`](commit-conventions.md) — Conventional Commits
  format; this rule narrows the allowed character set in the subject.
- [`direct-answers`](direct-answers.md) § Emoji Scope — the chat-reply
  analog; same emoji classes, different surface.
