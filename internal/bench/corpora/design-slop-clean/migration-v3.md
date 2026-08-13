<!-- clean: version migration guide with breaking changes, codemod, and a rollback path -->
# Migrating to the component library v3

v3 removes the runtime theme object and reads tokens from CSS custom properties
instead. Most applications need two changes: drop the provider, import the token
stylesheet.

## Before you start

- Node 20 or newer.
- All v2 deprecation warnings resolved. Run `npm run lint:deprecations` and fix
  what it lists. Warnings in v2 are errors in v3.

## Breaking changes

| v2 | v3 | Action |
|---|---|---|
| `<ThemeProvider theme={theme}>` | none | Delete the provider, import `@acme/ui/tokens.css` once at the app entry |
| `useTheme()` | none | Read `var(--accent)` in CSS, or `getComputedStyle` where a value is genuinely needed in JS |
| `<Card elevated>` | `<Card surface="raised">` | Codemod handles this |
| `<Button kind="cta">` | `<Button variant="primary">` | Codemod handles this |
| `<Stack spacing={3}>` | `<Stack gap="md">` | Numeric scale replaced by named steps, see the table below |

## Spacing scale mapping

`1` becomes `xs`, `2` becomes `sm`, `3` becomes `md`, `4` becomes `lg`,
`6` becomes `xl`. Values `5`, `7` and `8` had no consistent meaning across the
codebase and are gone. Pick the nearest named step and check the result.

## Codemod

```bash
npx @acme/ui-codemod v3 ./src
```

The codemod rewrites prop names and imports. It does not touch your own CSS. It
prints a list of call sites it could not decide, usually spread props such as
`<Button {...props} />`. Review those by hand.

## Rollback

v3 ships alongside v2 until 30 September. If you need to go back, reinstall
`@acme/ui@2` and restore the provider. There is no data or storage format change,
so a rollback is a package revert and nothing else.

## Known issue

Server side rendering with `next@14.1` emits a hydration warning for the
`Disclosure` component when the initial state is open. Fixed in `next@14.2`.
