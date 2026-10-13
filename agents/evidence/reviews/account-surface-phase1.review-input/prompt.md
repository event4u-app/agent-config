# R2 completion review — account-surface-phase1

You are a FRESH reviewer subagent. You have no implementation context and
you must not acquire any (blind-review pattern, plan-review-gates.md §5).

## Review mode

Senior-engineer review of the branch diff. Search grid — hunt for:

- errors
- inconsistent logic
- inefficiencies
- bug-producing patterns

## Rules

- Review only — write no code, fix nothing.
- Tool allowlist (contract §5): branch-scoped `git diff` + reads of
  branch-touched files only; no `git log` beyond the branch, no repo-wide
  grep, no reads of `agents/runtime/` or session artifacts.

## Inputs

- diff: `diff.patch` — the review scope (branch head 2e01546b6ac547a0e681337c7256cc446d7b420f, review
  artefacts excluded), scope hash `7d064336693f09f6fc498a342f33639e84a41b8d5a76aa73f09927a226db1eb0`
- roadmap under review: `roadmap.md` (Acceptance Criteria extracted to `acceptance-criteria.md`)

Changed files:

- agents/roadmaps/road-to-account-surface-detector.md
- docs/CLAIMS.md
- docs/proof.md
- tests/fixtures/account-surface/README.md
- tests/fixtures/account-surface/decoys/docs/password-policy.md
- tests/fixtures/account-surface/decoys/resources/views/auth/login.css
- tests/fixtures/account-surface/decoys/src/analytics/bucket-salt.ts
- tests/fixtures/account-surface/decoys/src/config/crypto-pepper.ts
- tests/fixtures/account-surface/decoys/src/search/page-token.ts
- tests/fixtures/account-surface/decoys/src/storage/checksum.ts
- tests/fixtures/account-surface/ground-truth.json
- tests/fixtures/account-surface/node/safe/src/auth/oauth-callback.ts
- tests/fixtures/account-surface/node/safe/src/auth/register.ts
- tests/fixtures/account-surface/node/safe/src/auth/session.ts
- tests/fixtures/account-surface/node/safe/src/auth/signin-config.ts
- tests/fixtures/account-surface/node/safe/src/auth/verify-otp.ts
- tests/fixtures/account-surface/node/safe/src/routes/login.ts
- tests/fixtures/account-surface/node/unsafe/src/auth/oauth-callback.ts
- tests/fixtures/account-surface/node/unsafe/src/auth/register.ts
- tests/fixtures/account-surface/node/unsafe/src/auth/session.ts
- tests/fixtures/account-surface/node/unsafe/src/auth/signin-config.ts
- tests/fixtures/account-surface/node/unsafe/src/auth/verify-otp.ts
- tests/fixtures/account-surface/node/unsafe/src/routes/login.ts
- tests/fixtures/account-surface/php/safe/app/Http/Controllers/Auth/ForgotPasswordController.php
- tests/fixtures/account-surface/php/safe/app/Http/Controllers/Auth/LoginController.php
- tests/fixtures/account-surface/php/safe/app/Http/Controllers/Auth/RegisterController.php
- tests/fixtures/account-surface/php/safe/app/Http/Controllers/Auth/VerifyOtpController.php
- tests/fixtures/account-surface/php/safe/app/Services/Auth/PasswordPepper.php
- tests/fixtures/account-surface/php/safe/config/session_token.php
- tests/fixtures/account-surface/php/unsafe/app/Http/Controllers/Auth/ForgotPasswordController.php
- tests/fixtures/account-surface/php/unsafe/app/Http/Controllers/Auth/LoginController.php
- tests/fixtures/account-surface/php/unsafe/app/Http/Controllers/Auth/RegisterController.php
- tests/fixtures/account-surface/php/unsafe/app/Http/Controllers/Auth/VerifyOtpController.php
- tests/fixtures/account-surface/php/unsafe/app/Services/Auth/PasswordPepper.php
- tests/fixtures/account-surface/php/unsafe/config/session_token.php
- tests/scripts/account_surface_ground_truth.test.ts

## Output format (contract §2.2)

Fill the findings table in `account-surface-phase1.findings.md`:

```markdown
| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | critical | src/x.ts:42 | ... | open | |
```

- Severity ∈ {`critical`, `high`, `medium`, `low`}, rows sorted descending
  by severity (ties keep authoring order).
- Initial status of every finding: `open`.
- A row is LIVE wherever it appears — a code fence around it changes
  nothing. If you quote the template as an illustration, its Status cell
  must be exactly `example`, or the gate reads it as a real finding.
- 0 findings → replace the table with exactly this honest-null line
  (contract §2.3):

```markdown
**Honest-null:** 0 findings, scope 7d064336693f09f6fc498a342f33639e84a41b8d5a76aa73f09927a226db1eb0, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
