# 1b. Detect the component-granularity taxonomy the project already chose

```bash
npx tsx scripts/work_engine/taxonomy/detect.ts   # or import detect_component_taxonomy(root)
```

Returns the project's **own** tier names joined with `/` — `atoms/molecules/organisms`, `primitives/patterns/features`, whatever it actually uses — or `none`. Record it as `state.ui_audit.component_taxonomy`, with `state.ui_audit.component_root` for where the components live. `none` is a real answer, and leaves every downstream step behaving exactly as it did before this detection existed. Never write a taxonomy the project does not evidence, and never "tidy" a layout into one — this step *finds* the project's structure, it never supplies one. Detection rules, the declared-beats-inferred precedence and the two collision floors: [`references/component-taxonomy-detection.md`](../component-taxonomy-detection.md).
