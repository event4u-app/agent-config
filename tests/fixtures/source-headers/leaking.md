<!--
`**Source:**` headers that DO name something a reader could look up. Every line
here MUST be flagged. These are the cases the narrowing must not lose: if one of
them escapes, the matcher is reverted and the baseline goes back to 243.

The names below are invented for this fixture and correspond to nothing real —
a fixture that carried a genuine source name would itself be the leak the gate
exists to prevent.
-->

> **Source:** somevendor/some-agent-suite, read at 9f2a1c4

> **Source:** ported from acme-labs/prompt-registry

> **Source:** https://not-a-real-vendor.dev/blog/agent-patterns

> **Source:** the @notreal-scope/agent-kit package

> **Source:** an internal fork of otherorg/otherrepo

<!--
Added after a completion review measured a RECALL HOLE the original five cases
could not see: citing a FILE inside an external repository — the most natural
Source-header shape there is — escaped the class entirely, because the matcher
tried to tell a repository from a path by looking at the characters either side
of the slug rather than at the whole token.
-->

> **Source:** somevendor/some-suite/skills/foo.md

> **Source:** ported from somevendor/some-suite/README.md

> **Source:** ./somevendor/some-suite
