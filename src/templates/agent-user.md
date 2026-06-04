---
version: 1
identity:
    name: ""
language: "en"
role:
    - ""
style:
    formality: "informal"
    pace: "pragmatic"
voice_sample: |
    Replace this block with one to three sentences in your own
    writing style. The agent uses it as a tone anchor — paste the
    way you would actually message a colleague, not a polished pitch.
last_updated: "1970-01-01"
---

# Notes

This file captures who you are and how you want the agent to address
you. It is created by `/agents user init` (chat) or the setup wizard
(`agent-config settings`). The file is gitignored by default — your
voice never lands in the repository unless you opt in with
`--shared`.

Hard cap: 100 lines total, frontmatter + body, enforced by
`/agents user accept` and `/agents user update`.

Replace this paragraph with anything you want the agent to remember
about you across sessions — preferred terminology, recurring
projects, conventions you want enforced. Keep it short; everything
here loads into every reply.

> Schema reference: [`docs/contracts/agent-user-schema.md`](docs/contracts/agent-user-schema.md).
