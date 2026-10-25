---
proposed_by: road-to-a-cut-the-upgrader-can-take step 3.1 (inbox rounds 2026-10-al/am)
implemented_by: claude-opus-5.5 session on feat/inbox-2026-10-al-am
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 6 of 2026-10-25
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: f51d59d1cb4b3f98eda950e15bb6fefcdc5008a0ff4ced977624bfffb4ee6e81
---

<!-- evidence-type: ratification -->

# Ratification — the egress mode from one read of the settings layers

`check_kernel_edit_ratified` gates two hook-plumbing files on this branch:
`src/scripts/hooks/egress_stage.ts` and `src/config/hook-latency-budget.json`. The
`subject:` digest covers both, computed with
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`
at revision `66aeb91039`. The commit after it touched only the test file, closing the
test-isolation point round 6 raised. The header is the output of
`ratification_header --seat anthropic=ratified --seat openai=ratified`.

## What was ratified

- **One read decides the mode.** `readEgressMode` no longer calls `load_agent_settings`.
  `egressFromLayers` reads each path `_resolve_cascade_paths` returns once (a path listed
  twice is read at its last position), returns `off` unparsed when no layer names
  `egress`, and otherwise parses every layer with YAML 1.1 and merges the `egress`
  subtrees in cascade order with the cascade's rule. A layer that exists and cannot be
  read, or names the word and does not parse, is `protect`, as before.
- **Why it equals the cascade's value:** the user-global layer is filtered to
  `MERGEABLE_KEYS`, which excludes `egress`; the template default below every layer is
  `off`; no rename maps onto the key. A test runs 64 two-layer combinations at two
  working directories, with a user-global `egress` present, against
  `load_agent_settings`.
- **Cost:** on the shipped template 26.0 ms cold / 9.9 ms warm before, about 10.6 /
  3.2 ms after (darwin, in-process). The latency budget row's prose is corrected; no
  number in it moves. The hook bundle stays under its ceiling.

## How it got here

Six rounds, CLI subscription transport, USD 0.00. The round-6 prompt is committed
verbatim: `agents/evidence/council/inbox-al-am-egress-ratification-r6-20261025.question.md`.
Rounds 1-5 are summarised here; each refusal changed the design rather than the prompt.

- **Round 1, split:** a reader that parsed only a layer's top-level `egress:` block missed
  an indentless sequence under the key.
- **Round 2, refused 2/2:** a leading BOM and bare CR line breaks moved the lines that
  reader anchored on.
- **Round 3, refused 2/2:** a layer broken outside the block was `protect` on main and
  would have read `off`. The block reader and the hook-bundle budget raise it needed were
  withdrawn.
- **Round 4, refused 2/2:** a per-layer skip judged a layer on one read while the cascade
  resolved on a second, so a change between them could read `off`. Both seats asked for
  one snapshot for detection and resolution.
- **Round 5, refused 2/2:** under `agents/settings` the canonical layer is listed twice,
  so the snapshot still read that file twice.
- **Round 6, ratified 2/2.** One seat asked for `try/finally` around the parity test's
  environment change; done in the following commit.
