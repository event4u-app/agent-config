# Project notes

A short markdown file with no PII and no secrets. Used to verify
the passthrough adapter and chunking on small inputs.

## Section one

This is the first paragraph. It mentions a project name like
`agent-config` and a technical term like Redis. Both must survive
the redaction pass — they are not pattern-matched as PII.

## Section two

A second paragraph with more prose. The chunker should keep this
together with section one if both fit under 2 KB, and split into
two chunks otherwise.
