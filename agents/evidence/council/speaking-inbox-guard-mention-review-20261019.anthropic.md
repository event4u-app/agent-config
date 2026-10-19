<!-- evidence-type: original-review -->

<!-- The anthropic seat's reply of 2026-10-19 to the prompt in
     speaking-inbox-guard-mention-review-20261019.question.md, verbatim. Historical: it
     describes the diff that was reviewed, which was reverted, not the tree. -->

I'll review this diff against both prior critiques.

## Agreement with Reviewer B

I **agree** with both high-severity findings:

### 1. PATH resolution bypass (high severity)

**`src/scripts/hooks/block_speaking_inbox_dir.ts:215`**

The regex `(?:\.\/)?scripts-run` permits bare `scripts-run`, which resolves through PATH. Reviewer B's bypass scenario is valid:

```bash
printf '%s' 'agents/tmp/speaking-dir' | scripts-run src/scripts/_lib/link_crypto encrypt
```

If PATH contains an attacker-controlled `scripts-run` that creates directories, the guard sees:
- `creatableTokens()` → `[]` (empty, allowed)
- Actual execution → directory created

The prompt states "link_crypto.ts contains no filesystem write call", but that only verifies **this repo's** implementation. The regex doesn't constrain which executable runs.

Reviewer A missed this by focusing on the happy path where `./scripts-run` is used.

### 2. Cross-base bypass (medium-high severity)

**`src/scripts/hooks/block_speaking_inbox_dir.ts:421`**

The shared cascade creates a mismatch:
- Guard resolves relative paths against `repoRoot` (first of: `project_dir`, `payload.cwd`, ...)
- Bash executes with `payload.cwd` as its working directory

When `project_dir` points to tree A (directory exists) and `payload.cwd` points to tree B (doesn't exist):
```bash
mkdir -p agents/tmp/speaking-dir
```
- Guard checks tree A → exists, allows
- Bash executes in tree B → creates it

Reviewer B correctly notes that "no producer currently sets `project_dir`" reduces **present** likelihood but doesn't make the **contract** safe. The envelope accepts `project_dir`, so the bypass is exploitable.

Reviewer A's comment "a command's relative paths resolve there" justifies `payload.cwd` before `workspace_root`, but doesn't address why `project_dir` should override the execution context.

## Disagreement with Reviewer A

Reviewer A concluded **CONFIRMED-NON-EXPANDING** with "no defects found." This is **incorrect**:

1. The PATH bypass allows creating directories the base refused
2. The cross-base logic breaks the guard's security boundary

Both are authority expansions — they permit creations the guard exists to prevent.

## New Points

### 3. Tool-specific base resolution needed

Different tools have different path-resolution contracts:
- **Bash**: resolves against its `cwd` (from `payload.cwd`)
- **Write**: likely resolves against project root (`workspace_root`)
- Sharing one cascade across both is incorrect

The fix requires either:
- Tool-specific base selection
- Always using the tool's actual execution context for existence checks

### 4. Test coverage gaps

Neither bypass is covered:
- No test with bare `scripts-run` (PATH resolution)
- No test with contradictory `project_dir`/`payload.cwd` values

The 84/84 pass validates happy-path fixes but not security boundaries.

### 5. Remediation pattern shape is correct (partial agreement with A)

When constrained to `./scripts-run` specifically, the pattern is safe:
- Single quotes block expansion
- No quotes/newlines blocks escapes  
- Verified writes only to stdout

The **intent** is sound; the **implementation** has the PATH hole.

## Verdict

**REFUSED** — Two high-severity authority-expansion bypasses.

**Single highest-leverage change**: Make `./` mandatory in the regex. Change line 215:

```typescript
const ENCRYPT_REMEDIATION_RE =
    /^\s*printf '%s' '[^'\n]*' \| \.\/scripts-run src\/scripts\/_lib\/link_crypto encrypt\s*$/;
```

Remove `(?:\.\/)?`, require `\.\/`. This closes the executable-identity bypass immediately.

The cross-base issue needs a second fix (tool-specific base selection or always match execution context), but the PATH bypass is the single most dangerous hole and the easiest to close.
