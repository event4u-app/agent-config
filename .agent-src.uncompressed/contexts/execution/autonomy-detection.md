# Autonomy Detection — Logic

Loaded by the [`autonomous-execution`](../../rules/autonomous-execution.md)
rule when deciding whether a user message in `auto` mode flips standing
autonomy on (or off). Anchor phrases and worked cases live in
[`autonomy-examples.md`](autonomy-examples.md).

## Recognize intent, not literal substring

In `auto` mode, the rule flips to `on` for the rest of the conversation
when the user expresses **"stop asking on trivial steps, just work"**.
The LLM recognizes the **intent**, not a literal substring, and
understands the semantic equivalent in either language.

## Litmus test — standing permission vs single-decision delegation

| Question | Outcome |
|---|---|
| Would a reasonable reader interpret the message as **standing permission to skip trivial workflow questions**? | Yes → flip. |
| Is it a **single-decision delegation** ("you decide for this step", "for this one let me know what you'd pick")? | Handle that step autonomously, do **not** flip standing mode. |

The flip is sticky for the rest of the conversation; single-decision
delegation is one-shot.

## Speech-act check — meta-instruction or content?

Before flipping, verify the phrase is **addressed to the agent as
guidance about how to work**, not a literal substring inside an
unrelated instruction. The same words can be content, data, quote,
copy, code, or subject matter — none of those flip.

Do **not** flip when the phrase is:

- **Content / copy** — "Put the slogan 'just do it' on the landing page."
- **Quote / reference** — "Nike's tagline is 'just do it' — write a blog post about it."
- **Subject of a request** — "Write docs about the 'work autonomously' modes."
- **Code / data** — string literals, test fixtures, translations, JSON.
- **About a third party** — "My colleague works autonomously."
- **A question or hypothetical** — "Should I set `don't ask` as the default?"

## Heuristic — strip and read

Strip quotes, code blocks, and embedded content. Read what's **left**.
If the remainder is still a directive to the agent about its own
working style → flip. Otherwise → don't.

## Opt-out is symmetric

The reverse intent ("ask me again", "stop being autonomous") flips
back to `off`. The same litmus test and speech-act check apply —
"ask me first" inside a quote, code, or third-party reference does
not flip.

In doubt → keep current mode. No speculative flips.
