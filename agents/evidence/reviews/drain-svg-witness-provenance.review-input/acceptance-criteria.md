## Acceptance Criteria

- [ ] AC-1 — A manifest written by any route other than an observed successful
      render discharges no SVG obligation, and the gate contains no command
      pattern list for write detection.
      Note (2026-10-14): met on every host whose `post_tool_use` recorder is
      live. As written it contradicts step 1.3, which keeps the transcript rule
      — pattern list included — as the named fallback where no recorder runs;
      the restatement "on a host whose recorder is live" is the reading this
      roadmap's own steps support, and is left for the closing review to
      confirm rather than ticked here.
- [ ] AC-2 — `svg-safety-active-content` is graded `inert` only for a file the
      project demonstrably delivers through `<img>` or a CSS background.
- [ ] AC-3 — A namespace prefix is resolved by its in-scope binding in both the
      safety and the structure rules.
