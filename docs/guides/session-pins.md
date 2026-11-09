# Session pins

A session pin is a constraint you set once in a conversation and want kept
after the host compacts it — "do not touch the migrations", "answer in German",
"never push to main". Without a pin, such a sentence lives only in the
conversation, and a compaction may fold it into a summary that drops it.

## Setting and removing pins

Type the marker at the start of a line in your own prompt:

```text
pin: do not edit anything under src/legacy
pin: keep replies short
```

- `unpin: <exact text>` removes one pin, `unpin: all` removes every pin — so
  a pin whose text is exactly `all` can only be removed together with the rest.
- The marker is not case-sensitive: `Pin:` and `PIN:` count too.
- The turn that sets or removes a pin is told the current count, and any pin
  that was refused, with the reason.

A pin is stored as typed, except that control characters become spaces and
leading or trailing whitespace is dropped; that stored text is what comes back.

Only a line you typed counts. A `pin:` inside a code fence, an indented line,
pasted content, a pasted document, tool output, a file, a subagent's message
or any other text the host injects is ignored, so nothing the agent reads can
add or remove a pin — as far as the host frames such text recognisably, which
is what the capture relies on. Type your `pin:` lines before any code block with markup,
pasted document, host notice or line containing a tag (`<…`, anywhere in the line):
nothing after such a line
is read as a pin, because injected text cannot be told apart from it there.
A `pin:` or `unpin:` line that itself carries a closing tag, a tag with
attributes, or a tag (`<name>`) closed on a later line is not applied either.
The turn says how many `pin:`/`unpin:` lines it did not apply for that reason,
so none disappears without a word.

## Limits

At most 12 pins, each at most 300 characters, and at most 4,096 bytes
together. A pin over a limit is refused whole and you are told; it is never
shortened.

## What happens to them

- **After a compaction** the pins are restored verbatim on the first tool
  call (or the first prompt, whichever comes first) after the compaction — the
  same moment the language pin is restored — and restated once more on the
  prompt after that. They are not repeated on every turn.
- **Subagents** started in the session receive the pins with their first
  context, because a subagent never sees the conversation they were typed in.
- Pins belong to one session. Another session, even in the same checkout,
  never reads them. Pins of a session inactive for 30 days are removed.
- If the pin file cannot be read whole as this session's — corrupt, edited
  past a limit, or not this session's — it is left exactly as it is, the
  setting turn says so, and after a compaction the turn says the pins could
  not be restored. Nothing rewrites it into a shorter list.
- Your first prompt after a compaction restates the pins — once per
  compaction. If that prompt comes before any tool call, it carries the pins,
  the tool-call restore that follows carries only the language pin, and your
  next prompt restates them once more. If a tool call came first, the prompt
  restates them once. The extra restatement is deliberate: the delivery is
  recorded before the line reaches the conversation, so a restore that is
  dropped (a turn that has already used its whole injection budget) or cut
  off (a hook process that dies mid-way) is covered by it. A duplicate costs
  one line; a lost restore costs the constraint.
- Delivery is best-effort, not exactly-once, and bounded: one compaction
  costs at most three restore lines, whatever fails. A restore that cannot be
  recorded on a prompt is not shown at all (it would repeat on every prompt);
  the tool-call restore after the compaction tells you instead. Each
  restatement states the pins as they stand after that prompt, so a pin you
  remove in it is not restated.
- A subagent started while the pin file cannot be read is told that the
  session has pins it could not read, and to ask before a change they might
  constrain.

## Turning it off

`AGENT_CONFIG_NO_SESSION_PINS=1` turns pins off: nothing is captured,
restored or handed to a subagent. The language pin is unaffected.

## Where it is carried

Claude Code: capture on `UserPromptSubmit`, arming on `PreCompact`, restore on
`PostToolUse`, subagent delivery on `SubagentStart`. On a host without a
`pre_compact` slot there is no compaction signal, so pins are captured but not
restored; `agent-config hooks:status` shows which slots your host binds.
