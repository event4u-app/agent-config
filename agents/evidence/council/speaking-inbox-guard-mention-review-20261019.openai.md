<!-- evidence-type: original-review -->

<!-- The openai seat's reply of 2026-10-19 to the prompt in
     speaking-inbox-guard-mention-review-20261019.question.md, verbatim. Historical: it
     describes the diff that was reviewed, which was reverted, not the tree. -->

## Findings

1. **High — the remediation exemption trusts command spelling, not executable identity**  
   `src/scripts/hooks/block_speaking_inbox_dir.ts:215`

   I agree with Reviewer B. Because `scripts-run` may resolve through `PATH`, this newly allowed command can execute an unrelated binary:

   ```sh
   printf '%s' 'agents/tmp/a-speaking-round' | scripts-run src/scripts/_lib/link_crypto encrypt
   ```

   That executable can create the named directory while `creatableTokens()` returns no candidates. Evidence about the repository’s `link_crypto.ts` does not establish what bare `scripts-run` executes.

   Reviewer A therefore overstates the safety of the exemption. The single-quoted input prevents shell expansion, but does not constrain the behavior of the receiving executable.

2. **High — `project_dir` can override Bash’s actual resolution base**  
   `src/scripts/hooks/block_speaking_inbox_dir.ts:419-423`

   I agree with Reviewer B’s contradictory-base scenario. The comment correctly says Bash paths resolve relative to `payload.cwd`, but the implementation nevertheless prefers `project_dir`.

   If directory `agents/tmp/a-speaking-round` exists under `project_dir` but not under `payload.cwd`, then:

   ```sh
   mkdir -p agents/tmp/a-speaking-round
   ```

   can be treated as referring to an existing directory while Bash creates it in a different tree. The absence of a current `project_dir` producer lowers immediate likelihood but does not make this precedence sound.

   The base must also be selected according to tool semantics: Bash should use its effective `cwd`; Write needs its actual documented relative-path base. One shared precedence chain is insufficiently justified.

3. **Medium — tests omit the security-critical conflicting-field cases**  
   `tests/hooks/block_speaking_inbox_dir.test.ts:529-552`

   The new tests demonstrate fallback behavior when fields are absent, but never supply conflicting non-empty values. Add regressions where:

   - `project_dir` contains the directory but `payload.cwd` does not;
   - `workspace_root` and `payload.cwd` disagree;
   - relative Write and Bash inputs resolve from their respective expected bases;
   - bare `scripts-run` resolves to a different executable.

## Prior-review assessment

- **Agree with Reviewer A:** the quoted literal cannot perform shell expansion; redirects, chaining, substitutions, and additional pipelines fall through; the change is cohesive and introduces no speculative OO abstraction.
- **Disagree with Reviewer A:** 84 passing tests do not establish non-expansion because the adversarial base-precedence and executable-resolution branches are untested. `fail_closed: false` also does not mean regressions only cause false positives—these two changes can cause false negatives.
- **Agree with Reviewer B:** both claimed bypass classes are credible, and the optional `./` is precisely the sort of tiny-looking widening a tired reviewer could miss.
- **Refinement:** requiring `./scripts-run` is necessary but may not be sufficient unless the hook also establishes that Bash runs from the repository root containing the trusted script. The safer design is to avoid returning `[]` for the entire command and narrowly suppress only the known-safe plaintext occurrence while retaining ordinary candidate analysis.

This touches an owner-reserved security/privacy floor: commands previously refused can now create a speaking directory under mismatched-base or ambiguous-executable conditions.

**refused**

**REQUEST_CHANGES** — The PR introduces plausible guard bypasses through executable ambiguity and incorrect cross-tool base precedence; the highest-leverage change is to make path-base selection tool-specific and replace the whole-command token exemption with a repository-anchored, narrowly scoped remediation exception, backed by conflicting-base tests.
