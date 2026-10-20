<!-- evidence-type: original-review -->

<!-- The openai seat's reply of 2026-10-20 to the prompt in
     speaking-inbox-guard-mention-review-20261020.question.md, verbatim. -->

Matze, my assessment is **mixed, but the branch must be refused**. The `payload.cwd` correction is sound; the remediation exemption is authority-expanding and creates a concrete bypass.

1. Prior-round points I agree with

- **Reviewer A:** The old base selection is incorrect. At `block_speaking_inbox_dir.ts:455-466`, using the native payload’s absolute `cwd` correctly models where relative Bash and Write paths resolve. Ignoring `project_dir`, `workspace_root`, and an outer `cwd` prevents the demonstrated cross-tree false allowance.
- **Reviewer B:** The regular-file checks at `block_speaking_inbox_dir.ts:233-238` establish only filesystem shape, not executable identity. This is the decisive defect.
- **Reviewer B:** The change is authority-expanding. It permits a command containing a new speaking path that the base guard scanned and refused.

2. Prior-round points I disagree with

- **Reviewer A’s final verdict (`confirmed-non-expanding`) is incorrect.** Suppressing the plaintext before `creatableTokens()` materially reduces what the guard inspects. The two `isFile()` checks can be satisfied by arbitrary mutable files, so this is not merely a false-positive correction.
- **Reviewer A’s characterization of `changesDirectory()` as safely “erring toward refusing” is incomplete.** False positives refuse safely, but false negatives can apply the existing-directory exemption against the wrong directory. The regex cannot establish that a shell command retains its initial working directory.
- **Reviewer B’s proposed full-chain digest verification is safer, but potentially broader than necessary.** A dedicated trusted remediation entry point outside the mutable tool workspace would provide a cleaner boundary than recursively authenticating a TypeScript launcher chain.

3. Defects and new refinements

- **High — `src/scripts/hooks/block_speaking_inbox_dir.ts:233-238`: mutable files are treated as trusted identity.**

  Failure scenario:

  ```sh
  printf '%s' 'agents/tmp/a-speaking-round' |
    ./scripts-run src/scripts/_lib/link_crypto encrypt
  ```

  If the tool’s `cwd` contains two attacker-controlled regular files at the expected paths, `scripts-run` can create that directory. The guard erases the only inspected occurrence of the path and allows execution. The base guard would refuse it.

  Checking that `link_crypto.ts` is regular adds little protection: the invoked `scripts-run` is free to ignore its arguments. Executable permission is also irrelevant because a malicious executable regular file can trivially satisfy it.

- **High — `src/scripts/hooks/block_speaking_inbox_dir.ts:252-257, 488-500`: directory-change detection is not complete enough to justify an existing-directory allowance.**

  A sourced script can change directory without any recognized word or flag appearing in the submitted command:

  ```sh
  . ./move-elsewhere.sh && mkdir -p agents/tmp/a-speaking-round
  ```

  If `agents/tmp/a-speaking-round` exists under the original `payload.cwd`, the probe allows it. If `move-elsewhere.sh` changes into a tree where it does not exist, `mkdir` creates a new speaking directory.

  Similar ambiguity exists for arbitrary scripts, shell functions, and programs that change their own execution context. A command-text regex cannot prove the effective base of every relative token. This may not always be a regression from the base version, but it contradicts the new implementation’s stated safety property.

- **Medium — tests at `tests/hooks/block_speaking_inbox_dir.test.ts:516-531` encode filesystem shape as “trusted.”**

  The fixtures create arbitrary empty regular files and then expect the exemption. Add a malicious regular `scripts-run` regression demonstrating that shape alone must not authorize suppression. Also add a sourced-script directory-change case.

Authority classification: **authority-expanding and touching the recorded security/privacy floor**. The `cwd` repair is tightening, but the plaintext suppression creates a new permission to execute previously refused commands based on attacker-reproducible conditions.

The strongest counter-argument is that repository contents may already be protected by an independently enforced immutable checkout boundary. If that invariant exists, the practical exploitability drops substantially. Nothing in this change verifies or documents that boundary, however, and a branch workspace is ordinarily mutable by the same agent invoking Bash.

Concrete next steps:

1. Keep the `payload.cwd` correction and conflicting-field tests.
2. Remove `withoutRemediationPlaintext()` until executable identity is established outside the mutable tool `cwd`.
3. Route encryption through a dispatcher-owned absolute entry point, or pass the source through a structured channel excluded from directory-path scanning.
4. Avoid using `changesDirectory()` as proof that relative paths retain their initial base. When shell semantics make the base uncertain, decline the existing-directory exemption.
5. Add malicious-regular-file and sourced-`cd` regressions.

**Final verdict: `refused`**

**Single highest-leverage change:** replace the mutable regular-file “anchor” with a remediation capability whose executable identity and implementation are outside the tool-controlled workspace.

Summary: retain the `cwd` fix, but reject the branch until plaintext suppression is bound to an immutable remediation identity.
