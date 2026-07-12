# Checklist — frontend / UI change

Loaded on demand by [`code-review`](../SKILL.md) when the diff touches
client-side components, templates, or styles.

| Check | What to look for |
|---|---|
| **Render security** | No `dangerouslySetInnerHTML` / `v-html` / `innerHTML` / Blade `{!! !!}` / Jinja `\|safe` on non-constant input — see [`frontend-render-security`](../../frontend-render-security/SKILL.md). |
| **Client trust** | No secrets/tokens in client code; no client-only authorization (the server re-checks); no token in `localStorage` where a stricter store fits. |
| **Component shape** | Follows the project's component idiom; no prop-drilling where the project has a store; no duplicated component when one exists (audit first). |
| **State** | No unguarded loading/empty/error states; the spec's states are all handled. |
| **Accessibility** | Keyboard nav, focus, labels, contrast — see [`accessibility-auditor`](../../accessibility-auditor/SKILL.md) for a full pass. |
| **Icon/brand consistency** | One icon system; emitted colour/type/spacing traces to a brand token (no ad-hoc hex/px). |

## Metadata gate

A UI diff **without a screenshot or a recorded visual check** → verdict `❓`
(not-sure): the reviewer cannot confirm the rendered result from source alone.
Ask for the screenshot or a Playwright/browser check before approving.
