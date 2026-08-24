# `storybook-current` — what `storybook init` actually scaffolds

Not authored. **Emitted** by

```bash
npm create vite@latest sb-app -- --template react-ts
npx storybook@latest init --yes                       # Storybook 10.5.10, 2026-08-24
```

and copied here unedited (`package.json` only; the generated `.storybook/main.ts`
is quoted below rather than committed, so no fixture `.ts` enters the
type-checker's or the test runner's globs).

```ts
// .storybook/main.ts, as generated
const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-mcp',
  ],
  framework: '@storybook/react-vite',
};
```

What the 2026-08-24 scaffold establishes:

| Fact | Value | Why it matters |
|---|---|---|
| Storybook major | `storybook@^10.5.10` | the only major `storybook-workshop` may state |
| a11y addon | `@storybook/addon-a11y` is **installed by default** | the a11y story path needs no extra install step |
| MCP addon | `@storybook/addon-mcp` is **installed by default** | the MCP channel is opt-*out* in a fresh scaffold, not opt-in — the skill's opt-in framing is about the agent connecting, not about installing |
| Test runner | `@storybook/addon-vitest` + `playwright` + `@vitest/browser-playwright` | stories are runnable, which is what makes them agent-verifiable |
| Framework adapter | `@storybook/react-vite` | React-only; the renderer limit is real, see `storybook-workshop` |
| Post-init state | the CLI prints *"installed but is not entirely set up yet"* and asks for `npx storybook ai setup` | a scaffold alone is not a working workshop — recorded so no skill claims init is sufficient |

- **Pre-state:** no fixture; Storybook versions and addon defaults were asserted
  from documentation.
- **Post-state:** `storybook-workshop` and `react-shadcn-ui` quote these majors
  and this addon set.

This directory is a **fixture, never installed** (see the parent `README.md`).
