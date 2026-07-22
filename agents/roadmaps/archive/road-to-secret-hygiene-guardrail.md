---
complexity: structural
status: ready
execution:
  mode: autonomous
---

# Road to secret-hygiene guardrail — the agent never lets a secret land in VCS

> The suite has strong design-time secrets guidance (`secrets-management`
> skill + `security-sensitive-stop` / `tool-safety` / `domain-safety-pii` /
> `lethal-trifecta-guard` rules) but **no enforcement at the moment a secret
> is about to be written into a tracked file or committed**. This roadmap adds
> that missing layer: the agent **detects** a secret before it lands, **warns**
> the user with what/where/why, **asks** whether they really want it, and
> **suggests better alternatives** — across git, SVN, and Mercurial, and more
> generally any tracked/shipped file. It ships to consumer projects, so it
> protects the consumer's repo, not just this package.
>
> **Council-converged 2026-07-22 (claude-sonnet-4-5 + gpt-4o, 2 rounds):**
> enforcement is **rule-first at agent write-time** (block *before* the secret
> hits the working tree — earlier and non-bypassable by the agent, unlike a
> client-side commit hook which fires only on agent-initiated bash and is
> `--no-verify`/GUI/fresh-clone bypassable); the **enforcing second layer is
> CI** (non-bypassable — a PR cannot merge red), not a client hook; the
> **detector is an own VCS-agnostic TS module** (reuse the existing `_SECRET`
> regex + add entropy + keyword), with gitleaks/trufflehog reserved for the CI
> template; **inline `# secret-allow` + a lightweight audited allowlist**, not a
> `.secrets.baseline` (baseline checksums need committed state — a chicken-and-egg
> for working-tree content); `.gitignore` `.env`/`*.pem` management is **out of
> scope**. See § Council-cut scope for what was CUT + revisit conditions.

## Goal

After this ships, when the agent is about to write a credential into a tracked
(or to-be-tracked) file, or stage/commit content containing one in any VCS, it
STOPS, shows the match (file:line, kind, why risky), asks via numbered options,
and offers tiered alternatives — it never silently commits and never silently
strips. A deterministic CI check backs the behavioral rule as the non-bypassable
net, and the `secrets-management` skill carries the remediation (rotate-first)
and alternatives depth. Every claim is verified against a real fixture corpus and
the project test runner; no lever ships on an estimate.

## Context — verified on the live checkout, 2026-07-22

- **Gap (repo inventory):** no runtime/commit-time secret guard exists;
  `/commit`, `/commit:in-chunks`, `/pr:create` do not scan; `sync:gitignore`
  (`src/config/gitignore-block.txt`) manages only the package's own artifacts.
- **Reusable — detector seed:** `src/scripts/lint_mcp_config_security.ts` (via
  `src/scripts/_lib/security_lint.ts`) already carries a `_SECRET` regex
  (`sk-ant-`, `sk-proj-`, `AKIA…`, `AIza…`, `ghp_…`, JWT) but only scans the
  package's own `*.mcp.json`/config files in CI.
- **Reusable — hook model (deferred):** `src/scripts/hooks/block_no_verify.ts`
  is a `fail_closed` PreToolUse Bash-interceptor registered in
  `src/scripts/hook_manifest.yaml`; it is the precedent for the deferred
  agent-side commit backstop (§ Council-cut scope).
- **Structure conventions:** skills `src/skills/<name>/SKILL.md`; rules
  `src/rules/<name>.md` (tiering per `docs/contracts/kernel-membership.md` +
  `docs/contracts/rule-router.md`, compiled by `src/scripts/compile_router.ts`,
  linted by `lint_rule_tiers.ts` / `check_kernel_rule_bundle.ts`); CI gates are
  `src/scripts/check_*` / `lint_*` (required checks via `print_required_checks.ts`);
  consumer CI templates in `src/agent-src/templates/github-workflows/`.
- **Standards to cite in artifacts:** OWASP Secrets Management Cheat Sheet,
  CWE-798 (Hard-coded Credentials, 2024 CWE Top 25), 12-factor config.
- **Verification policy:** per `roadmap-ci-steps-policy`, no full-pipeline
  (`task ci`) steps are scheduled; new tests/gates this roadmap adds are run once
  locally with targeted commands (that is the verified evidence).

## Phase 0 — Secret detector library (load-bearing unknown first)

- [x] Create `src/scripts/_lib/secret_detector.ts` — a VCS-agnostic detector
      exposing `scanText(text, opts) → Finding[]` where `Finding = { rule, kind,
      line, column, masked, confidence, verified? }`. Pure, no I/O, no network.
- [x] Rule pack (regex): reuse/extend the `_SECRET` shape from
      `_lib/security_lint.ts` — AWS `AKIA…`, GitHub `ghp_…`/`github_pat_…`,
      Stripe `sk_live_`/`sk_test_`, Google `AIza…`, Slack `xox[baprs]-…`, private
      keys (`-----BEGIN … PRIVATE KEY-----`), JWT `eyJ…`, DB connection URLs that
      embed credentials, and `password=`/`api_key=`
      style assignments with a non-placeholder value.
- [x] Entropy layer: Shannon entropy over base64/hex charsets with a tunable
      threshold to catch formatless high-entropy secrets; entropy hits are
      `confidence: medium` (regex hits `high`).
- [x] Keyword/context layer: proximity of `password|secret|token|api[_-]?key|
      credential` to a value raises confidence.
- [x] FP suppression in the detector: inline `# secret-allow` / `// secret-allow`
      / `<!-- secret-allow -->` marker on a line suppresses it; obvious
      placeholders (`xxxx`, `example`, `<...>`, `changeme`, `your-…-here`,
      `.env.example`/`*.example`/`*.sample` file context) drop to `confidence: low`.
- [x] Fixture corpus: `src/scripts/_lib/fixtures/secret-detector/positives.txt`
      (one real-shaped secret per known kind) and `negatives.txt` (placeholders,
      hashes, UUIDs, lockfile hashes, base64 images, allow-marked lines).
- [x] Test `src/scripts/_lib/secret_detector.test.ts` (or the project's test
      convention): assert every positive fixture yields ≥1 `high`/`medium`
      finding of the expected kind, and every negative yields none. Expected
      values derive from the fixtures, never from detector output.
- [x] **verify:** run the new test file with the project runner (targeted, e.g.
      `npx vitest run src/scripts/_lib/secret_detector.test.ts` or the repo's
      equivalent) — green, no FPs on negatives.

## Phase 1 — Behavioral rule `secret-vcs-guard` (primary enforcement)

- [x] Create `src/rules/secret-vcs-guard.md`, `type: auto`, tier-2 (NOT kernel —
      respects the always-rule concentration cap), triggers: `secret`, `password`,
      `credential`, `api key`, `token`, `.env`, `commit`, `git add`, `svn commit`,
      `hg commit`, `push`.
- [x] Iron Law: before the agent writes/edits a credential into a tracked (or
      to-be-tracked) file, or stages/commits content containing one in ANY VCS
      (git/svn/hg), it STOPS → shows the match (file:line, kind, why risky) →
      asks via numbered options (per `non-destructive-by-default` +
      `user-interaction`) → offers tiered alternatives → NEVER silently commits,
      NEVER silently strips.
- [x] Already-committed branch: lead with **rotate/revoke the credential now**
      (immediate); state `git rm` alone does not un-leak; point to history purge
      (`git filter-repo` / BFG) + force-push/re-clone — cross-link
      `secrets-management`.
- [x] Honesty clause: the agent-side gate is ONE layer; recommend enabling the
      CI scan (Phase 3) / host push-protection as the enforcing net.
- [x] `When it fires` / `When NOT to fire` (e.g. `.env.example`, test fixtures
      with allow-markers, obvious placeholders) + `See also` cross-links
      (`security-sensitive-stop`, `tool-safety`, `secrets-management`,
      `non-destructive-by-default`, `lethal-trifecta-guard`).
- [x] Keep within `size-enforcement` (well under 200 lines; constraint-only).
- [x] **verify:** `npx tsx src/scripts/compile_router.ts` succeeds and lists the
      new rule; `npx tsx src/scripts/lint_rule_tiers.ts` (+ `check_kernel_rule_bundle.ts`)
      pass; `frontmatter` validation passes for the new rule.

## Phase 2 — `secrets-management` skill extension (depth, no duplication)

- [x] Add `## Runtime write/commit-time guard` to
      `src/skills/secrets-management/SKILL.md`: the detect → warn → ask →
      alternatives → rotate-first procedure, pointing at `secret_detector.ts` and
      the `secret-vcs-guard` rule (reference, do not restate the rule).
- [x] Add the tiered-alternatives decision table: solo/local → gitignored `.env`
      + committed `.env.example`; team/prod → cloud secret manager
      (AWS/GCP/Azure) or Vault/Doppler; k8s/GitOps → SOPS / Sealed Secrets; CI →
      OIDC federation over stored creds. Cite OWASP + CWE-798 + 12-factor.
- [x] Add the already-committed remediation ordering (rotate FIRST → `git rm`
      insufficient → `git filter-repo`/BFG → force-push + coordinate).
- [x] Add a VCS-agnostic note (SVN/Mercurial native hooks are server-side;
      detector runs against the diff/working-tree regardless of VCS).
- [x] **verify:** `npx tsx src/scripts/check_refs.ts` (or repo ref-checker) — no
      broken links from the new sections; skill linter passes on the skill.

## Phase 3 — CI scan gate + consumer template (the enforcing layer)

- [x] Create `src/scripts/check_secret_leak.ts`: runs `secret_detector` over the
      tracked working tree (or `git diff` range when given), exits non-zero on any
      `high`-confidence finding, respects `# secret-allow` + the Phase-4 allowlist,
      `--json` output. Reuses the Phase-0 library (single detector, no drift).
- [x] Wire it into the package CI as a required check (add to
      `print_required_checks.ts` / the relevant task target); it scans this repo's
      own tree.
- [x] Add consumer CI template
      `src/agent-src/templates/github-workflows/secret-scan.yml` — a GitHub
      Actions job that runs the detector on PRs (and documents an optional
      `gitleaks`/`trufflehog` step for teams that want live-credential
      verification).
- [x] **verify:** run `npx tsx src/scripts/check_secret_leak.ts` against the
      Phase-0 positive fixtures (exits non-zero) and against a clean path (exits
      0); confirm the template YAML parses.

## Phase 4 — Allowlist / false-positive control (audited)

- [x] Formalize the allowlist: inline `# secret-allow` (Phase 0) PLUS an optional
      repo-root `.secret-allow` file (path[:line] or fingerprint entries, one per
      line, `#` comments) consumed by both `secret_detector` and
      `check_secret_leak`. NOT a `.secrets.baseline` (no committed-state
      dependency).
- [x] Document the audit workflow (add an entry only with a one-line justification
      comment; entries are reviewable in the diff) in the skill + rule see-also.
- [x] Test: an allow-listed fixture path is suppressed; a *different* secret on a
      non-listed line in the same file is still caught (allowlist is narrow, not a
      file-wide mute).
- [x] **verify:** run the allowlist test (targeted) — green.

## Phase 5 — Commit / PR command wiring

- [x] Add a secret-scan step to `src/domains/git/commit/command.md` and
      `src/domains/git/commit/in-chunks/command.md`: before staging/committing,
      run `check_secret_leak` on the staged/changed content; on a `high` hit,
      invoke the `secret-vcs-guard` ask flow (do not auto-commit).
- [x] Add the same pre-flight to `src/domains/git/pr/create/command.md` before the
      push/PR.
- [x] **verify:** `check_refs` / command linter pass on the edited commands; no
      broken cross-links.

## Phase 6 — Docs, projection sync, downstream

- [x] Update `SECURITY.md` and `docs/threat-model.md` with the new guardrail
      (surface + enforcement layers).
- [x] Add `See also` back-links from `security-sensitive-stop` / `tool-safety` to
      `secret-vcs-guard` (bidirectional cross-refs).
- [x] Run `task sync` + `task generate-tools` to regenerate `dist/agent-src/`,
      `.augment/`, `.claude/`, `.cursor/`, etc. (never hand-edit projections).
- [x] **verify:** `check_refs`, rule-tier lint, skill lint, and frontmatter
      validation all pass on the diff; regenerated projections are in sync
      (`condense.sh --changed` clean or re-condensed).

## Acceptance criteria

- [x] The `secret_detector` catches every known-format fixture and produces zero
      findings on the negative corpus (Phase 0 test green).
- [x] `secret-vcs-guard` rule exists, compiles into the router at tier-2 `auto`,
      passes tier + kernel-budget lint, and specifies block → ask → alternatives →
      rotate-first, VCS-agnostic.
- [x] `secrets-management` carries the runtime guard + tiered alternatives +
      remediation ordering, no rule duplication, no broken refs.
- [x] `check_secret_leak` is a wired CI check (exits non-zero on the positive
      fixtures) and a consumer `secret-scan.yml` template exists.
- [x] Inline `# secret-allow` + `.secret-allow` narrow allowlist works and cannot
      mute a *new* secret elsewhere in an allow-listed file.
- [x] `/commit`, `/commit:in-chunks`, `/pr:create` run the scan pre-flight.
- [x] Projections regenerated; `check_refs` + all touched linters green.

## Council-cut scope (documented, not silently dropped — decision-revisit-gate)

The following were considered and CUT by the 2026-07-22 council; each carries a
revisit condition rather than a silent drop:

- **PreToolUse agent-side commit hook** (`hooks/block_secret_commit.ts`, modeled
  on `block_no_verify`). CUT: fires only on agent-initiated bash, redundant with
  the write-time rule for the agent, and as a git hook is `--no-verify`/GUI/
  fresh-clone bypassable — near-zero marginal security for real cost (latency on
  large diffs, a second detector that drifts). **Revisit-if:** telemetry shows the
  behavioral rule is slipping on agent-written secrets (≥ a handful of real
  escapes) that a deterministic agent-scoped backstop would have caught.
- **`.gitignore` `.env`/`*.pem`/`credentials.json` pattern management** via
  `sync:gitignore`. CUT: out of scope; `gitignore-block.txt` manages only package
  artifacts and secret-file ignore patterns are a distinct consumer concern.
  **Revisit-if:** consumer demand for shipped secret-file ignore defaults.
- **gitleaks/trufflehog delegation from the runtime detector.** CUT: adds a second
  code path that bitrots for zero marginal value at write-time; the own TS
  detector is the guaranteed floor. **Revisit-if:** the CI template (Phase 3) shows
  the own detector missing kinds the tools catch, at which point CI delegation (not
  runtime) is the place for it.
