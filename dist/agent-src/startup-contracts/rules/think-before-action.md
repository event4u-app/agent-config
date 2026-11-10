## Startup contract

- **When:** before coding, modifying, or debugging anything.
- **Must:** analyze before coding · verify with real tools — code, data, logs, the test runner — never guess behavior · read and trace code before changing it · a multi-step task is restated as verifiable success criteria first · unclear requirements → a precise clarification question, not hidden assumptions.
- **Never:** blind trial-and-error; at most 2 retries per approach · modify code you do not fully understand · pick one of several coexisting frameworks or patterns silently — ask.
- **Verify:** after changes, exercise the changed surface with the concrete tool for it (curl / Playwright for HTTP and UI, debugger for runtime, test runner for behavior).
