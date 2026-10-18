# 4b. Prefer a live Storybook read over the hand-read inventory — when one is running

When the project carries `@storybook/addon-mcp` **and** a Storybook is running, query it
instead of reading files: `docs-list` for the inventory, then `docs-show` for the components
that matter. **The live read wins; the hand-read inventory of step 4 is the fallback and is
never removed** — an agent that cannot reach a running Storybook must still be able to
inventory the library. The channel disappearing is normal, not an error.

**The names are version-bound, and these are the current ones.** Own derivation, from a
throwaway `npm install` on 2026-09-13, not from any document: at `@storybook/addon-mcp@10.6.0`
the docs tools are registered by `storybook`'s own `createDocsToolset` under the method ids
`docs.list` / `docs.show` / `docs.showStory`, and `toMcpToolName` renders those as `docs-list`,
`docs-show` and `docs-show-story`. The older `list-all-documentation` / `get-documentation` were
the literal names at `@storybook/addon-mcp@0.7.0` (via `@storybook/mcp@0.8.0`); at 10.6.0 they
survive only as the tools' human-readable **titles**. There is no 10.5.x of the addon — it goes
0.7.0 → 10.6.0 — so a project on the current scaffold gets the `docs-*` names. If a live
`tools/list` disagrees, the live read wins over this paragraph.

**React-only while the toolset is in preview.** Storybook's own MCP FAQ (docs **10.5**,
`docs/ai/mcp/overview` § FAQ) states the documentation toolset supports React only during
preview, so Vue, Angular, and Web Components take the file-read path. Stated here rather than
discovered at runtime, because the failure otherwise looks like a broken MCP server.

Discipline for what the live read returns is [`storybook-workshop`](../../../storybook-workshop/SKILL.md)'s
— in particular: never use a prop the manifest does not document, and fetch the project's
story instructions before writing a story.
