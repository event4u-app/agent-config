<!-- evidence-type: analysis -->

# Does a hook's `systemMessage` reach the model? Measured on Claude Code 2.1.310

**Date:** 2026-10-24 · **Host:** Claude Code 2.1.310, macOS · **For:** D16 of
`road-to-an-update-that-installs-itself-only-when-it-is-safe` (the user channel
`hooks/user_notice.ts`)

## Why

The user channel rests on one claim: `systemMessage` is shown to the user and
not added to model context. The 2.1.310 binary documents the field as
"`systemMessage` - Display a message to the user (all hooks)" and "Warning shown
to user in UI". A council seat reviewing the channel asked for that claim to be
reproduced rather than read off a string, so it was.

## Method

A throwaway project outside this repository (so no rule of this package is
loaded), with one `SessionStart` command hook that prints, as one JSON object:

```json
{"systemMessage":"MARKER-SYS-7Q2","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"MARKER-CTX-4K9"}}
```

`MARKER-CTX-4K9` is the positive control: `additionalContext` is documented to
reach the model. Run:

```bash
claude -p --setting-sources project --output-format stream-json --verbose \
  "List every token in your context that starts with MARKER-. Answer with the tokens only, or NONE."
```

## Result

| Marker | Field | In the `hook_response` diagnostic event | Named by the model |
|---|---|---|---|
| `MARKER-CTX-4K9` | `additionalContext` | yes | **yes** |
| `MARKER-SYS-7Q2` | `systemMessage` | yes (`output` and `stdout` echo the raw hook stdout) | **no** |

The model's whole answer was `MARKER-CTX-4K9`. The control shows the probe can
see a field that does reach the model; the system marker is absent from every
other line of the stream.

## What this does not show

- That the user sees the message. `-p` has no UI; that half rests on the host's
  own documentation. An interactive session is the place to observe it.
- Anything about a later host version, or about any host but Claude Code. The
  user channel is bound to `claude` alone for that reason, and its revisit
  condition (D16) is this host ceasing to honour the field.
- A single run of a model is one sample of what it chose to list; the absence is
  corroborated by the stream, where the marker appears only in the hook
  diagnostic event.
