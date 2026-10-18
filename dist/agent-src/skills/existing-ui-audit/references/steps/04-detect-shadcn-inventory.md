# 4. Detect shadcn inventory (only when `state.stack.frontend == "react-shadcn"`)

Read `components.json` for the registered style + base color, then read the `package.json` **of the scope root** — `state.stack.scope_root`, relative to the project root, empty when the project root *is* the scope — for `@radix-ui/*` or the unified `radix-ui` package, plus any locally vendored `components/ui/*.tsx` files. In a monorepo the repository root carries neither the marker nor the dependency, so reading it finds nothing. Write into `state.ui_audit.shadcn_inventory`:

```
{
  version: <from package.json shadcn registry CLI version, or null>,
  style: "default" | "new-york" | <other>,
  base_color: "slate" | "zinc" | ...,
  primitives: ["Button", "Dialog", "Form", "Table", ...],   // names of files in components/ui/
  installed_radix: ["@radix-ui/react-dialog", ...]          // raw radix list
}
```
