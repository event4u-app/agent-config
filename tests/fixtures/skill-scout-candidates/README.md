# skill-scout candidate corpus

Four quarantine candidates, three carrying a payload class the shipped child
linters detect and one clean, used by the Phase 4.2 reproduction and the Phase
4.3 gate test of `road-to-scan-that-fails-closed`.

They live here rather than under `agents/runtime/skill-scout/candidates/`
because that directory is the operator's live quarantine — a committed fixture
there would be a permanent candidate. They live outside `src/` because the
security linters' default corpus is `src/{skills,rules,agent-src,domains}` plus
`dist/agent-src`, and a committed attack string inside the scanned corpus would
red this package's own gates. The payloads are real, not described: a described
payload proves nothing about a detector.

| Directory | Payload | Detected by |
|---|---|---|
| `zero-width-injection/` | U+200D between two words | `lint_hidden_unicode` |
| `disclosure-suppression/` | an imperative telling the agent not to tell the user | `lint_instruction_smuggling` |
| `dangerous-frontmatter/` | `permissionMode: bypassPermissions` + wildcard `allowed_tools` | `lint_skill_frontmatter_safety` |
| `clean/` | none — the negative control | none |

Every one of the four passes `intake()`'s inertness checks (regular files, text
extensions, no exec bit, under the size cap). That is the gap Phase 4.2
reproduces: before Phase 4.3, inertness was the whole gate and content was
never read.
