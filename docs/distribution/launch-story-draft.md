# Launch-story — DRAFT (not published)

> Market-readiness roadmap B5. A short narrative draft for a launch post
> (Show HN / dev.to / discussions), centered on the wedge + reproducible honesty.
> **Draft only** — not published; the final headline is gated on the B0
> positioning decision. Every claim must stay ledger-bound; no unbacked number,
> no third-party performance comparison.

## Angle

Not "another agent framework." The hook is **reproducible honesty**: an AI-agent
config layer where every public claim is machine-checked, and you can verify it
yourself in one command. Open with the wedge (something the reader installs in 30
seconds), then reveal the discipline behind it.

## Draft body

> Most AI-agent tooling asks you to trust a headline number. This one lets you
> **check it.**
>
> Start small — one file, 30 seconds:
>
> ```bash
> curl -fsSL https://raw.githubusercontent.com/event4u-app/agent-config/main/docs/wedge/production-validator/production-validator.md \
>   -o .claude/agents/production-validator.md
> ```
>
> `@production-validator` is a read-only Claude Code subagent that runs the last
> gate before "done": it finds the mock/stub/placeholder still sitting on your
> shipped path and the "done" that was only ever validated against fakes.
>
> That one subagent is a slice of a larger governed layer — skills, review
> personas, rules, commands across 7+ hosts, no runtime. What makes it different
> isn't the size; it's that **the marketing is under CI too.** Every claim in the
> README binds to evidence in a ledger, a generated proof page renders those
> bindings plus the benchmark runs where the tool changed *nothing*, and a
> "verify it yourself" block reproduces all of it on a fresh checkout. If a claim
> ever loses its binding, the build goes red.
>
> Try the one file. If it earns its place, the rest is `npx @event4u/agent-config init`.

## Placeholders to resolve before publishing

- `{{HEADLINE}}` — final H1 from the B0 positioning decision (do not publish with
  a provisional headline).
- Confirm the raw `curl` URL resolves on `main` at publish time.
- Link the live proof page once a docs site (Starlight) hosts it, if built.

## Guardrails

- No performance claim or third-party comparison in the post.
- The "benchmark runs where the tool changed nothing" line points at real
  published nulls (`docs/benchmark.md`) — keep it truthful, do not dramatize.
