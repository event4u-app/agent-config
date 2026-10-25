# Checklist — frontend / UI change

Loaded on demand by [`code-review`](../SKILL.md) when the diff touches
client-side components, templates, or styles.

| Check | What to look for |
|---|---|
| **Render security** | No `dangerouslySetInnerHTML` / `v-html` / `innerHTML` / Blade `{!! !!}` / Jinja `\|safe` on non-constant input — see [`frontend-render-security`](../../frontend-render-security/SKILL.md). |
| **Client trust** | No secrets/tokens in client code; no client-only authorization (the server re-checks); no token in `localStorage` where a stricter store fits. |
| **Component shape** | Follows the project's component idiom; no prop-drilling where the project has a store; no duplicated component when one exists (audit first). |
| **State** | No unguarded loading/empty/error states; the spec's states are all handled. |
| **Contract compatibility** | Consumed API types match the server's current response; a field the server dropped or renamed is not still read, and a new required field is not assumed on old responses. |
| **Docs follow code** | A changed public component prop, route or user-facing setting updates its README / Storybook / CHANGELOG entry in the same diff. |
| **Accessibility** | Keyboard nav, focus, labels, contrast — see [`accessibility-auditor`](../../accessibility-auditor/SKILL.md) for a full pass. |
| **Icon/brand consistency** | One icon system; emitted colour/type/spacing traces to a brand token (no ad-hoc hex/px). |

## Metadata gate

A UI diff **without a screenshot or a recorded visual check** → verdict `❓`
(not-sure): the reviewer cannot confirm the rendered result from source alone.
Ask for the screenshot or a Playwright/browser check before approving.
