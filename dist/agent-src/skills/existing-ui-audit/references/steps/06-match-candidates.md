# 6. Match candidates for the current input

For each item in `state.ui_audit.components`, score similarity to `state.input.data` (fuzzy on filename + props/slots + co-occurring terms). Keep top 5 with `score >= 0.3`. Write into `state.ui_audit.candidates`:

```
[{path, name, score, reason: "matches 'settings' + 'toggle' in props"}, ...]
```

If `candidates` is empty, the user is building net-new. That is normal — record the empty list, do not halt.

## 6b. Conformance gate — when a provided artifact is the spec

Similarity above is scored against `state.input.data`. That answers *"is this
component like the thing being asked for"* and it does **not** answer *"does
this component satisfy the artifact"* — which is a different question with a
different answer, because a candidate can be an excellent name-and-props match
and still use the wrong type scale, the wrong control, or a colour the artifact
never states. Until this step existed nothing anywhere asked the second
question, while `ui-audit-gate` carried *"reuse
beats duplication"* as unqualified prose. Reused on an artifact port, an
unconforming candidate is a fidelity deviation dressed as good hygiene.

So when a provided design artifact is the spec
([`design-fidelity`](../../../../rules/design-fidelity.md)), each candidate carries a
**conformance verdict** alongside its score, and reuse is conditional on it:

```
[{path, name, score, reason,
  conformance: {verdict: "conforms|deviates|unknown",
                dimensions: {structure, values, behaviour, responsive},
                refused_by: "values"}}, ...]
```

- **`conforms`** → reuse it. This is the ordinary case and nothing changed.
- **`deviates`** → do **not** reuse silently. Name the dimension that refused
  it — *"`Card` deviates on `values`: type scale 14/20 against the artifact's
  16/24"* — and surface reuse-with-adaptation versus build-new as a choice.
  A bare "candidate rejected" is not a discharge; the caller cannot act on it.
- **`unknown`** → the candidate was not scored against the artifact (no
  extraction yet, or a subtree the audit could not read). Treat as `deviates`
  for the purpose of not reusing silently, and say which of the two it is —
  "did not conform" and "was not checked" are different facts.

**And the decision moves after extraction, not before it.** A conformance
verdict needs the artifact's own values, so a reuse decision taken before
extraction is taken without the evidence that decides it. Where the run has an
artifact, order is: extract → audit → score → conform → decide. The unqualified
reuse-first ordering stands only where there is no artifact to conform to.

**Scope:** this is a gate on REUSE, not a license to rewrite the incumbent. A
candidate that deviates is left alone; the choice is whether *this* work builds
on it.
