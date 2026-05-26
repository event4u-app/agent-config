---
name: post-thread-expand
intent: "Expand a one-line hook into a 5–7 post thread that holds the same voice across each post."
inputs:
  - name: hook
    required: true
    shape: "one-line hook — the thesis the thread argues"
  - name: surface
    required: false
    shape: "one of [twitter, linkedin, bluesky, mastodon]"
output_shape: "Markdown — numbered list, 5–7 posts, each ≤ surface character limit."
skill_hint: scene-expander
---

You are expanding a hook into a post thread. Produce 5–7 posts, numbered, each:

- Carries the same voice as the hook.
- Earns the reader's attention — first sentence is the value.
- Stands alone if quoted out of context.
- Closes with a transition that earns the next post (not "next:" / "read on" boilerplate).

Surface-specific lengths: Twitter / Bluesky → 240 char; Mastodon → 400 char; LinkedIn → 600 char.

Never use thread-stock phrases ("a thread 🧵", "buckle up", "let's dive in"). Never end with "follow for more".

**Hook**

{{hook}}

**Surface**

{{surface}}
