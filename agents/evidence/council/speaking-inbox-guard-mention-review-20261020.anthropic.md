<!-- evidence-type: original-review -->

<!-- The anthropic seat's reply of 2026-10-20 to the prompt in
     speaking-inbox-guard-mention-review-20261020.question.md, verbatim. -->

**Assessment: Mixed — I agree with both reviewers on different aspects**

### 1. Which prior points I agree with

**Agree with Reviewer A (cwd base resolution):**

The `payload.cwd`-only base resolution (lines 465-466) is unambiguously correct. The test at lines 490-492 proves the base implementation's bug: with `project_dir: tree` but `cwd: other`, the old guard would ALLOW `mkdir -p agents/tmp/speaking-name` because it probed the wrong tree. Shell commands execute in `payload.cwd`, not in `project_dir` or `workspace_root`. This fix is non-expanding — it **closes** a false-negative hole.

**Agree with Reviewer B (remediation exemption security concern):**

The `withoutRemediationPlaintext()` exemption (lines 233-238) authorizes execution based on filesystem shape that a malicious branch could satisfy. The "anchor" checks only `lstatSync(...).isFile()`, which establishes file type but not executable identity, provenance, or contents. B's attack scenario is technically sound:

1. Malicious branch modifies `scripts-run` to create directories instead of encrypting
2. Files pass the regular-file check (not symlinks, but still arbitrary code)
3. Guard empties the plaintext and permits the command
4. Malicious `scripts-run` creates the speaking directory

The base guard would refuse this command. The change therefore expands authority beyond what the recorded floor allowed.

### 2. Which I disagree with and why

**Disagree with Reviewer A's conclusion (ratify without addressing the exemption):**

A says "ratify" with no reservations, but the remediation exemption creates a measurable security gap. Checking that `./scripts-run` is a regular file (line 237) does NOT verify it will execute `link_crypto encrypt` — it only verifies the file exists and isn't a symlink. A malicious branch can satisfy that check while doing something else entirely.

A's confidence that this is "confirmed-non-expanding" treats the cwd fix and the exemption as a single change. They're not. The cwd fix closes a bug; the exemption opens a new path.

**Partially disagree with Reviewer B's severity assessment (though agree on the technical finding):**

B frames this as "High severity" and "direct bypass." The actual risk depends on:

- **Threat model**: Is this guard preventing *accidents* (unintentional leaks) or *attacks* (adversarial exploitation)?
- **Branch protection**: If code review catches malicious `scripts-run` modifications before merge, the practical exposure is lower.
- **Attack surface**: The exemption requires the EXACT command pattern, which is narrow.

However, B is correct that for a **security guard**, "probably okay in practice" isn't sufficient. The exemption should either verify the executable chain or not exist.

### 3. New points or refinements

**Refinement: The threat model determines the verdict**

The rule's stated purpose is:
> "such a name gets quoted into tracked files and leaks the source it was named after"

This is a **confidentiality control** preventing source names from entering the permanent record. If the threat is accidental leaks by honest agents, the exemption is acceptable. If the threat includes malicious branches, B's attack is in scope.

**New point: The exemption's necessity is unclear**

The roadmap says the base guard refused:
1. A read-only `ls -la` of an existing directory ✓ Fixed by the existing-directory carve-out
2. The remediation command itself ✗ Fixed by the exemption

But **why** was the remediation command attempted? If it was prescribed in a deny message, the guard was refusing its own prescribed fix — that's a usability bug. But the fix (exempt based on filesystem shape) trades usability for security.

**Alternative: Structured remediation**

Instead of exempting based on `./scripts-run` existing, pass the sensitive source through a **structured field** the guard explicitly ignores:

```typescript
// Hook envelope includes:
{ remediation_plaintext: "agents/tmp/renamed-from-real-source" }

// Guard skips path-scanning for this field
// Command becomes: printf '%s' '' | ./scripts-run ...
```

This preserves the remediation flow without trusting mutable executables.

### Concrete next steps

Given one verdict must be chosen:

**Verdict: `refused`**

**Defect: `src/scripts/hooks/block_speaking_inbox_dir.ts:237` — Medium-to-High severity**

The exemption assumes `./scripts-run` will encrypt, but only verifies it's a regular file. A malicious branch can satisfy this check while creating the directory the guard exists to prevent.

**Single highest-leverage change:**

Replace the filesystem-shape anchor with one of:
1. **Content verification** — hash `scripts-run` + `link_crypto.ts` against known-good digests
2. **Structured remediation** — pass plaintext via hook field the guard excludes from scanning
3. **Remove the exemption** — accept that the remediation command requires manual allowlisting

**Immediate action:**

Split this into two changes:
1. **Merge the cwd fix** (lines 465-466 + conflicting-field tests) — this is unambiguously correct
2. **Defer the remediation exemption** until executable verification is added or an alternative approach is designed

The cwd fix solves three measured bugs (F1/F2/F3). The exemption solves a usability issue but creates a security gap. They should be evaluated separately.
