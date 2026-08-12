## Acceptance Criteria

Each is decidable by a command or by reading a named file — none is satisfied by
an assertion that the work happened.

**Phase 1 (shipped):**

1. `src/scripts/schemas/skill.schema.json` declares a `runtime_requires` object
   with `bins`, `env`, `primary_env`, `network` and `additionalProperties: false`,
   and does **not** redefine `requires` — which is ADR-015 pack edges.
2. `./scripts-run src/scripts/build_discovery_manifest --write --quiet` exits 0.
   This is the criterion the original key choice failed, and it is listed because
   the schema having no `requires` property was mistaken for the name being free.
3. `./scripts-run src/scripts/validate_frontmatter` reports 0 failing.
4. Every skill declaring an external `execution.handler` **and** a `command:`
   carries a `runtime_requires` block; no skill with `handler: internal` or
   without a `command:` is required to.
5. `missing_runtime_requires` fires on a fixture with an external handler + a
   command + no block, and stays silent on all four near-misses — `internal` +
   command, external without command, external + command + block, and a pack-edge
   `requires:` **list**.
6. `./scripts-run src/scripts/skill_linter --all` reports 0 fail.

**Phase 3 (shipped):**

7. `src/scripts/_lib/untrusted_content.ts` exports a wrapper whose delimiter
   carries a per-call nonce, and a credential-file permission probe.
8. A payload containing a guessed-nonce closing tag does not terminate the
   wrapper: the authoritative closing tag stays unique and last.
9. The wrapper leaves the payload byte-identical — no sanitising, escaping, or
   truncation of untrusted input.
10. A `0o644` and a `0o604` credential file both report `too-open` with a
    `chmod 600` hint; `0o600` reports `ok`; an absent file reports `missing`.
11. The call-site sweep records a verified count rather than an assumption, and
    the companion lint is deferred **because** that count is zero.

**Roadmap-level:**

12. `lint_roadmap_family_cap` passes with this roadmap inside the
    `road-to-skill-ecosystem-` family — not outside it.
13. `lint_plan_risk_register` passes, and every `Anchored under` reference
    resolves to a real heading.
14. No source repo, org, or author name appears anywhere in the tracked tree —
    `check_no_external_sources` exits 0.
15. Every claim carried over from the source artifact is either re-derived
    against the tree or marked as corrected; no count is reproduced on the
    source's authority alone.

**Explicitly NOT claimed:** that any host invokes a skill-local script (S0.1
gates it, unrun), that a token saving exists (S0.2, unrun), that `doctor`
detects a missing dependency earlier (S0.3, unrun), or that injection is
prevented rather than merely bounded.
