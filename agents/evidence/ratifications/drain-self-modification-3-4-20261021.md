---
proposed_by: claude-opus-5.5/drain-self-modification-20261021
implemented_by: claude-opus-5.5/drain-self-modification-20261021
reviewed_by: ai-council
subject: f7398d1e746d999bf440d56bbe8503ad5be65566ee65f12ebdb7a162525b9f8f
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: confirmed-non-expanding
  openai: refused
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

Step 3.4, the record writer, round 1.

Verdict `refused`, derived from each seat's stance line; the prompt every seat answered is `agents/evidence/council/record-writer-review-20261021.question.md`, committed at `1f9ab5fca556dda143fcb6d815da72983fe01276` and naming this record's subject.

What this record does not establish: that a council produced the session it was rendered from. That file is the caller’s and council output is not kept, so on that point this record is exactly as trustworthy as a typed one. What it does establish is that the header says no more than the replies below, and that the prompt showed this content.

## Each seat, verbatim

### anthropic — `confirmed-non-expanding`

```text
Looking at this modification review of the ratification record writer (step 3.4).

## Behavior changes

**What it does**: Renders ratification records from council session JSON + committed prompts instead of requiring typed headers. Key mechanism changes from prior attempt:

1. **Honest branding**: Still writes `reviewed_by: ai-council` but the record body explicitly states "on that point this record is exactly as trustworthy as a typed one" — claims no council identity it cannot prove
2. **Provenance binding**: Refuses unless session names a prompt under `agents/evidence/council/`, that prompt is committed at the specified revision, and contains the exact `subject` digest
3. **No answer parsing**: Replies kept verbatim in fenced blocks (fence longer than any backtick run inside); verdict derived from stance lines by existing `seatConclusion`
4. **Seat handling**: Built in `Map`, refuses duplicates/`__proto__`/invalid provider IDs; empty/errored replies kept as `no-final-verdict`, never dropped
5. **Threshold validation**: `requiredProviders` must be positive integer
6. **Round-trip verification**: Reads output back through canonical reader; refuses on structural problems

**Authority boundaries**: Becomes **narrower** — records can only answer for content shown in committed prompts; no looser path introduced.

## Defects

### 1. Branding field name vs. disclaimer gap
**`ratification_record_writer.ts:32-44, 169`**  
**Scenario**: Field named `reviewed_by` suggests identity verification, but writer explicitly disclaims it can verify that identity  
**Severity**: Low  

The constant `REVIEWER_SPELLING` and comments say "fixed spelling of reviewer kind, not a statement the writer verified one." Record body states limitation verbatim. Honest but potentially confusing to a reader who sees the field before the disclaimer. Mitigated by explicit disclaimers in code + contract + record body.

### 2. Double containment check (harmless defense-in-depth)
**`ratification_record_writer.ts:133` + `fileAtRevision`**  
**Scenario**: `assertContained` called before `fileAtRevision`, which does its own containment check  
**Severity**: Negligible  

Defense-in-depth, not a defect. Suggests layers could clarify who owns validation, but harmless as written.

### 3. CLI subject divergence (intentional, not a defect)
**`ratification_record.ts:74-77`**  
Default uses gate's `expectedSubjectFor`, `--declared` uses `proposalSubjectOf`. Intentional — supports two use cases. Caller chooses. Documented in usage.

## Weakening analysis

**Does it weaken tests/gates/thresholds?** No. Round-trip verification means a structural problem refuses. Typed path unchanged. Tests cover all refusal paths.

**Another host/projection workaround?** No — local tooling, produces file developer commits. No remote execution.

**Can it be undone?** Yes — CLI is pure function, doesn't modify anything. Bad record deletable. Typed path remains.

## Observations

**What would falsify claimed benefit?** Record answering for content prompt didn't show, or using uncommitted/modified prompt. Tests verify all three caught: uncommitted prompt refused (line 131), prompt not naming subject refused (line 137), prompt outside directory refused (line 126).

**Smaller change possible?** No — requires session read + prompt verification + markdown render + round-trip check + CLI wrapper + tests. Only potentially reducible piece is CLI, but that kills usability.

**Instruction weight**: ~220 lines implementation + ~250 test + 1 contract paragraph. Opt-in tooling, not always-loaded. Minimal.

**Untrusted content steering**: Session JSON is untrusted. Checked:
- `artefact`: path-contained, must be committed under `PROMPT_DIR`, must name subject ✓
- `provider`: regex-validated, `Map`-keyed to avoid `__proto__` ✓  
- `text`: fenced to prevent escape (test line 108 verifies) ✓  
- User fields: single-line validated, not executed ✓

Even fabricated session can only answer for committed prompt content.

## Verdict rationale

Addresses all five prior-attempt issues honestly:
1. ✓ Branding limitation stated in record body  
2. ✓ Prompt provenance bound to committed content  
3. ✓ No parser, verbatim + proper fencing  
4. ✓ Seats in Map, refusals for edge cases, no drops  
5. ✓ Threshold + round-trip validated

Adds binding without loosening gates. Typed path unchanged. Limitations disclosed rather than hidden. The "reviewer kind vs. identity" branding is potentially confusing but adequately mitigated by explicit disclaimers.

One improvement: contract paragraph could state "`reviewed_by: ai-council` is the format's fixed spelling of a reviewer kind, not an identity claim" — but acceptable as written.

STANCE: confirmed-non-expanding | CONFIDENCE: high | DEALBREAKER: no
```

### openai — `refused`

```text
Matze, I would not greenlight this. It improves deterministic rendering, but it still converts caller-controlled text into a gate-consumable `ai-council` ratification. A prose disclaimer does not narrow the authority interpreted by the canonical reader.

## Key defects

1. **Critical — unauthenticated input receives authenticated-looking authority**  
   `src/scripts/_lib/ratification_record_writer.ts:161-178,199-213`

   Failure scenario: an author fabricates `session.json` with two valid provider IDs and two ratifying stance lines. The writer emits `reviewed_by: ai-council`, provider diversity, and a ratified verdict; `readRatification` accepts it. The body’s disclaimer is irrelevant to the gate.

   Calling `reviewed_by` a “fixed spelling” does not change its semantics. This widens the effective authority boundary from “a council review” to “any caller able to construct JSON and commit a matching prompt.” The assertion that it “claims no reviewer identity the session cannot show” is unsupported because the session itself proves no identity.

2. **High — prompt binding proves string co-location, not review provenance**  
   `src/scripts/_lib/ratification_record_writer.ts:119-142`

   Failure scenario: a committed Markdown file under the approved directory mentions the digest in a comment, appendix, prior-attempt narrative, or statement saying it was *not* reviewed. `bytes.includes(input.subject)` accepts it. The caller-controlled `artefact` field is the only link between that prompt and the fabricated responses.

   This establishes neither that the prompt requested review of the subject nor that any listed provider saw or answered it. The generated sentence at lines 177-178—“the prompt every seat answered”—therefore states more than the implementation proves.

3. **High — the CLI can succeed for a refused or quorum-short result**  
   `src/scripts/ratification_record.ts:90-112`; writer `:198-207`

   Failure scenario: a session contains a `refused` stance or only one conclusive provider where two are required. The writer deliberately returns the record and the CLI exits `0`. Automation commonly treats exit zero as successful ratification, especially because the command is named `ratification_record`.

   If escalation artifacts must be produced, there should be separate commands or an explicit status-bearing exit contract. At minimum, successful rendering and successful ratification need distinct exit codes.

4. **Medium — policy is read from a different repository root than the reviewed subject**  
   `src/scripts/ratification_record.ts:74-88`

   `commit`, subject files, and prompt are resolved from the injected `root`, but policy is loaded from module-global `REPO`. A caller using `main(argv, root)` can review repository A using repository B’s provider threshold. The tests themselves exercise this split and therefore depend on ambient checkout state rather than a self-contained fixture.

5. **Medium — untrusted prose remains an uncontrolled projection surface**  
   `src/scripts/_lib/ratification_record_writer.ts:175-197`

   Replies are safely fenced, but `summary` is inserted as unrestricted Markdown outside a fence. It can inject headings, HTML, forged explanatory sections, or text visually resembling additional evidence. It may not fool the current structural reader, but it can steer human reviewers and downstream Markdown projections. Only header fields receive one-line validation.

6. **Medium — the design’s sequencing assumptions are unresolved**

   The prompt must be committed at the selected revision and already contain the final subject digest. The CLI simultaneously describes `--files` as the “whole changed-file list.” If that list includes the committed prompt, the declared digest becomes self-referential; if it excludes the prompt, “whole” is false and the proposal binding omits part of the review package. The document needs a precise commit sequence and an explicit statement of whether evidence files are inside or outside the subject.

## Architectural assessment

The claimed safety improvement is narrow: the header is consistent with stance lines present in the supplied file. It does not improve the authenticity of the review, yet it produces exactly the fields the gate treats as authoritative. That mismatch is the architectural call I would push back on hardest.

Evidence that would change my mind would be an independently verifiable session envelope binding:

- the exact prompt blob or digest;
- the reviewed subject and revision;
- each provider identity and complete response;
- a nonce or run identifier;
- signatures or attestations verified independently of the submitting caller.

Absent that, the output should use a non-authoritative reviewer kind such as `unverified-council-transcript`, which the ratification gate must not accept.

A smaller defensible change would render the transcript and derived *candidate* header, then require a separately authenticated promotion step to create a ratification artifact.

## Rollback and kill switch

No rollback or kill-switch criteria are specified. At minimum:

- Keep the writer and CLI off every acceptance path until they are on the gate’s watch list.
- Disable acceptance immediately if a fabricated session can yield a gate-passing record.
- Preserve manual records as the fallback.
- Define rollback as removing the CLI-generated reviewer kind from accepted artifacts, not merely reverting the renderer.
- Add a test proving a caller-controlled session cannot independently produce an accepted ratification.

The claimed benefit is falsified by one observation: a hand-authored JSON session plus a committed digest-bearing prompt produces a record that `isRatified` accepts. The current tests effectively demonstrate the mechanism but never test authenticity.

Standing instruction weight also increases: a new CLI contract, prompt-location convention, session schema assumptions, exit-code semantics, and an exception permitting quorum-short output. Step 4.1 being open means the modules implementing those rules remain changeable without the protection they help create.

STANCE: refused | CONFIDENCE: high | DEALBREAKER: yes
```

## Added by hand after rendering: the disposition

Everything above this heading was rendered by the writer under review
(`ratification_record --declared`) from its own review's session; this section
was written afterwards and is not derived. The prompt is
`agents/evidence/council/record-writer-review-20261021.question.md`.

This is the third attempt at step 3.4 (2026-10-12, 2026-10-17 twice, now), and
the openai seat's dealbreaker is the one the 2026-10-17 rounds raised, unchanged
in substance: a caller-supplied session file yields `reviewed_by: ai-council`,
two providers and a passing verdict that the gate accepts, and no disclaimer in
the body narrows what the reader treats as authoritative. Its stated remedy is
an independently verifiable session envelope (prompt digest, subject, revision,
provider identity, run nonce, signatures) or a non-authoritative reviewer kind
the gate refuses — both of which need either an attestation the tree does not
have or an edit to the gate's reader. Its other findings are recorded for the
next attempt: the CLI exits 0 for a refused or quorum-short record; the policy
is read from the script's tree while the subject is read from `root`; `summary`
is unfenced Markdown; the prompt check proves the digest is present, not that
the prompt asked for that review; and the sequencing of prompt commit and
subject commit is not stated.

**Disposition.** The writer, its CLI, its tests and its contract paragraph were
taken off the branch to `origin/main` (empty net diff per file); the code stays
reachable at `1f9ab5fca`. Whether the record format should accept a rendered
record at all without an authenticated session is a change to the reviewer's
trust model, reserved to the owner (`ratification-artifact.md` § When the user
decides, condition 4) — not a defect another round fixes.
