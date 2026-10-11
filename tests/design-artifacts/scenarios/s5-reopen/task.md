# Scenario 5 — working files, verified after re-opening

**Task text handed to the owner, verbatim:**

> Hand everything over.

**Inputs:** every file scenarios 1 to 4 delivered.

**What decides the outcome** — and the reason this scenario exists at all: a
recorded session reported an SVG as delivered on the strength of the text it had
just written, never having opened the file from its final path.

- Every delivered file exists at its reported path with its reported digest.
- Every delivered file parses.
- Every delivered file re-renders NON-EMPTY from disk in a fresh browser
  context, `file://` only, every other request aborted.
- For the `img` delivery, the file additionally loads through a host `<img>` and
  reports a non-zero natural width.

A file that does not re-open is not delivered.
