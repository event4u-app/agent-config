---
proposed_by: claude/drain-self-modification-20261012
implemented_by: claude/drain-self-modification-20261012
reviewed_by: ai-council
subject: 92176f61fef3e38f9db5c7001a5a6af36384084f0bd0f5b8b587ec63df1564ee
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: refused
  openai: refused
effective_after: merge
---

<!-- evidence-type: ratification -->

# Modification review

> **Read this first, 2026-10-13.** The change this record refused is **no
> longer on the branch**. Its round-3 `smaller-change` answer — quoted in full
> below — said the change bundled at least four independently reversible
> concerns and that landing the binding first would close replay risk with a
> smaller blast radius. That was done: governed-surface expansion, proposal
> validation, the new standing Iron Law, the record writer and the escalation
> message were reverted to `origin/main`, each verified as an empty net diff
> per file, and reopened as `[ ]` steps on
> `road-to-self-modification-that-a-council-must-pass` § Staged, not abandoned.
> What remains on the branch is the content binding alone, and it has its own
> record: `drain-self-modification-narrowed-20261013.md`.
>
> This record stays `refused` and stays here, because the review happened and a
> refusal that is deleted once it is honoured teaches nothing. Its `subject`
> is the digest of content the branch no longer carries, so the gate reports it
> as a non-matching artifact beside the record that does match — which is the
> binding working, not a defect in this file.

Steps 2.1, 2.2, 3.4, 4.1, 4.2, 4.3, 5.2, 6.1 and 6.2 of road-to-self-modification-that-a-council-must-pass: a ratification record is bound by digest to the gated content it reviewed, the review's own modules and the 28 high-consequence rules beyond the kernel join the gated surface, the record is written from the run rather than typed, the stop has a shape, and one learning walks the improvement pipeline. Reviewed over three rounds; both seats concluded `refused`, and this record says so.

At least one seat refused the change. This record does not let it land.

Derived, not typed: `providers`, `verdict` and `seats:` come from `deriveRatificationHeader`, and `subject` from the gate's own `expectedSubjectFor`. What this does not establish is that the review happened — the seats below are the caller’s, and council responses are gitignored and pruned, so no runner can check them.

## What each seat answered

### anthropic — `refused`

**behaviour-change** — What behaviour changes, including what follows from it that the diff does not state?

Round 1 could not answer: the seat's workspace was not a checkout, so neither the branch nor the named files were reachable, and it refused on that ground rather than guessing. Round 2, with the gated code supplied in the prompt: the reader validates an optional `subject` and the gate supplies an expected digest, which makes `subject` mandatory for every newly evaluated record; the gate additionally covers five reviewer/contract paths, the consequence-class registry and rule schema, and the non-kernel rules that registry lists. Consequences the change did not state: an unreadable consequence registry now blocks every invocation including changes to ungoverned files; reviewer-surface changes always enter the owner-decision path even when every seat ratifies; and subjects can vary for one commit because they describe a live checkout rather than an immutable Git tree.

**boundary-direction** — Which authority or safety boundary becomes wider or narrower, and in which direction?

The agent/author boundary becomes narrower -- more changes require ratification, a stale record cannot be replayed once the gated bytes move, and registry failure stops the gate. The owner boundary becomes broader operationally: reviewer-surface edits and diversity-short reviews are explicitly routed to the owner. The FAILURE boundary also widens: one missing or malformed policy file now disables the whole gate, so an operator must repair governance infrastructure before unrelated work can pass.

**weakens-its-own-judge** — Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?

Round 1: YES, and this was the dealbreaker -- `consequenceRuleSlugs` returned an empty set on a read failure, so a gate advertising 28 high-consequence rules enforced none of them the moment one file failed to parse, reported success, and said nothing. Round 2 accepted the correction: the gate now refuses when consequence membership is unavailable. One correctness defect remained: `diversityShort` was declared outside the artifact loop, so a later record whose real defect was a malformed structure or a stale subject was presented to the owner as a diversity case. That does not make the gate pass; it weakens the accuracy of what the mechanism tells the owner they are judging. Whether fixtures or assertions were weakened could not be determined in either round, because the test files were in parts the seat was not shown.

**route-around** — Is another host or projection left as a way around the control this change touches?

> _(no answer recorded for this question)_

**undo** — Can it be undone, and how — by whom, with what authority, and against which revision?

The code can be reverted, but the revert itself edits `SELF_SURFACE` and must traverse the mechanism being removed, so `revert the commit` is circular during a failure of the gate itself. A safe rollback needs the last known-good gate revision, the exact target revision whose tree is restored, the owner able to authorise recovery, the procedure used when the current gate cannot execute, and regeneration of the omitted projections. None of those is stated by the change.

**falsifier** — What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?

The content-binding benefit is false if a gated committed blob changes while an existing subject stays valid; if one revision produces different subjects in supported clean environments; if a committed symlink is hashed as environmental target bytes rather than its Git blob; if classification and file reading observe different working-tree states; or if a reviewer-surface or consequence-rule edit passes without entering the subject. The change supplies no explicit kill-switch criteria.

**smaller-change** — Would a smaller change do, and what does the larger one buy that the smaller one does not?

The smallest high-value change is content-binding the existing artifact and refusing a non-matching record. This change bundles at least four independently reversible concerns -- digest binding, governed-surface expansion, proposal validation, and a new standing Iron Law -- and enlarges recovery complexity. Landing the binding first would close replay risk while letting the broader self-governance design be evaluated with a smaller blast radius.

**instruction-weight** — What does it add to standing instruction weight that every later session pays?

The eighth Iron Law adds permanent cognitive and token cost to every session that loads the skill, across generated projections. A repository gate or a narrowly scoped contributor rule might enforce the same invariant without charging every unrelated session.

**untrusted-steering** — Could untrusted content steer the path this change opens, and what bounds it if so?

Branch-controlled paths, record fields, seat text and escalation messages are all plausible untrusted inputs. Required bounds include canonical path resolution, unambiguous digest framing, strict schema validation, trusted-base selection, output escaping and limits on rendered seat content. A specific case: if dissent or paths are printed verbatim, control characters could forge or conceal gate output.

### openai — `refused`

**behaviour-change** — What behaviour changes, including what follows from it that the diff does not state?

Records must carry a sha-256 `subject` matching the current gated content; the gated surface expands from roughly 15 paths to roughly 49; three new validation failure codes arrive; a deleted gated file is represented by a marker; and an escalation message is generated for a non-passing review. The critical unstated consequence in the first revision: when the rule-consequence list could not be read or parsed, ALL high-consequence rules silently dropped from enforcement and the gate reported success as if only kernel rules existed.

**boundary-direction** — Which authority or safety boundary becomes wider or narrower, and in which direction?

Intended narrower -- more files require ratification and approval becomes content-bound. Actual, in the first revision: conditionally fail-open, because the boundary could spontaneously widen from 49 paths to 15 whenever the policy file failed to load. The code called that a graceful fallback and a floor; it removed the advertised protection.

**weakens-its-own-judge** — Does the change weaken anything that judges it — a test, a gate, a threshold, this review? The standard is quoted rather than paraphrased: the implementer never silently weakens an assertion, deletes, skips or xfails a failing test, lowers a threshold, or changes fixture semantics to fit the code. Does this change do any of those?

YES. `catch { slugs = new Set<string>(); }` is a textbook case of lowering a threshold from the quoted standard: the judge promises to protect high-consequence rules and silently exempts all of them when its authority-defining input cannot be loaded. A corrupted or deleted policy file bypassed the entire consequence-class protection. Whether the test files were weakened could not be verified from the part shown.

**route-around** — Is another host or projection left as a way around the control this change touches?

> _(no answer recorded for this question)_

**undo** — Can it be undone, and how — by whom, with what authority, and against which revision?

Mechanically reversible by revert, but the revert passes through the mechanism it removes, and the authorised actor and recovery path are defined outside the reviewed part.

**falsifier** — What observation would show the claimed benefit to be false, and what rollback / kill-switch criteria does the change omit?

A gated change passing with a record for different content; two distinct gated subjects producing the same canonical digest input; a deletion or rename escaping the subject; any supported landing path bypassing the gate; a legitimate emergency repair becoming impossible to ratify. Rollback should trigger on a demonstrated false acceptance, an unratifiable legitimate revert, or divergence between supported hosts.

**smaller-change** — Would a smaller change do, and what does the larger one buy that the smaller one does not?

The change mixes subject binding and consequence-class expansion, which are independent and could be staged.

**instruction-weight** — What does it add to standing instruction weight that every later session pays?

Not separately raised beyond the shared finding on the new Iron Law's standing cost.

**untrusted-steering** — Could untrusted content steer the path this change opens, and what bounds it if so?

Paths are not validated as repository-relative, and unescaped filenames and seat identifiers can inject newlines or terminal control sequences into operator-facing output.

## How the review ran, and why it refused

Three rounds, all through the CLI seats, all at $0.00 on subscription
authentication. Both seats concluded `refused`, so the derived verdict is
`refused` and this record does not let the change land. That is the mechanism
working, not a failure of it: an agent modified the governing surface, two
independent providers reviewed the change, and it does not land on the agent's
say-so.

| Round | Scope | Outcome |
|---|---|---|
| 1 | The whole delta, by reference | `refused` — the seat's workspace was not a checkout, so the diff was unreachable. It named the remedy: supply the complete diff and rerun. |
| 2 | The gated core, diff supplied in the prompt | `refused`, 2/2 — the consequence class failed OPEN. |
| 3 | The same, after the correction | `refused`, 2/2 — the correction accepted; three further defects named. |

**Why the diff had to be supplied in parts.** The complete
`origin/main...HEAD` diff is 177 KB and the council's bundle ceiling is 51 KB.
The reviewed cut was the gated core — the gate, the artifact reader and the
digest module. **The seats said in both rounds that this prevented them from
answering question 3**, because the test files sat outside the part they were
shown, and that limitation is recorded here rather than left for a reader to
infer from the answers.

## What the refusals changed

Every concrete, in-scope finding was acted on, each with a test that was seen
red by neutralising the fix:

1. **Fail-open consequence class** (round 2, both seats, dealbreaker).
   `consequenceRuleSlugs` returned an empty set on a read failure, so a gate
   advertising 28 high-consequence rules enforced none the moment one file
   failed to parse. It now returns `null` and the gate refuses **before** its
   own "nothing to ratify" exit — a diff that looks ungated may only look that
   way because the list that would have gated it could not be read. A failed
   read is no longer cached. The test that asserted the old behaviour was
   corrected in place and says in its own body that it had encoded the defect.
2. **`diversityShort` shared across the artifact loop** (round 3). One record's
   diversity shortfall made every later record's defect read as a diversity
   case in the owner's escalation. Now per record.
3. **The digest dereferenced symlinks** (round 3). A gated path committed as a
   symlink was hashed as its target's bytes — content outside the reviewed
   revision. It now hashes the link target string, and `lstat` replaces
   `existsSync` so a broken link is a link rather than a deletion.
4. **Unescaped operator output** (both seats). Paths, seat ids and verdicts
   reach the escalation message from the diff and from frontmatter; a crafted
   filename could forge or conceal part of the stop the owner reads. Control
   characters are replaced with U+FFFD.
5. **The import cycle** (round 2). Called fragile with only a comment holding
   the mitigation in place; it now has a regression case that makes the digest
   module the entry point of the cycle.

## What was NOT changed, and is therefore still outstanding

Named rather than buried, because a record that lists only what was fixed
reads as a clearance:

- **The digest reads the working tree, not Git objects.** Against a dirty tree
  it describes the dirty bytes. Both seats asked for revision-based hashing;
  that remains the stronger shape and is not what ships. The module header now
  says so above what it does claim.
- **The change bundles independently reversible concerns** — digest binding,
  governed-surface expansion, proposal validation, a new standing Iron Law.
  Both seats said it could be staged. It was not.
- **Rollback is circular during a failure of the gate itself**, since a revert
  edits `SELF_SURFACE` and must pass through the mechanism it removes. No
  recovery procedure is written for that case.
- **Question 3 was never fully answerable** by either seat, for the bundle
  reason above.

## The digest moved after the review, and by what

One gated file changed after the seats answered: an unused
`eslint-disable-next-line no-control-regex` directive was removed from
`check_kernel_edit_ratified.ts`. The project lints with `--max-warnings 0`, so
an unused directive is a CI failure; the removal carries no behaviour.

That is still a post-review edit to gated content, which is exactly what the
`subject` binding this change adds exists to catch, and it caught it. The field
now carries the digest of the content as it stands:

| | |
|---|---|
| reviewed by the seats | `ed00bcb7c4f41ee215573a93a108413ef55a32bb9f58e1b4055a2265fb051821` |
| in the tree now | `92176f61fef3e38f9db5c7001a5a6af36384084f0bd0f5b8b587ec63df1564ee` |

**Why rebound rather than left stale, stated because the choice could go the
other way.** This record is `refused`; nothing lands on it under either digest,
so rebinding launders no approval into existence. What it does change is the
REASON the gate gives: with the stale digest the gate would report
`subject-mismatch`, which would tell the owner that content moved under a
record that otherwise passed. It did not otherwise pass. The owner needs to
read `refused`, and both digests are above so the rebinding is checkable rather
than asserted.

Had the verdict been a passing one, the honest action would have been the
opposite — leave it stale and let the gate refuse, because a passing record
rebound to content its reviewers never saw is precisely the defect.

## What this record does, and what happens next

It does not let the change land, and `check_kernel_edit_ratified` is red on
this diff because of it. Under § When the user decides this is conditions 1
and 4 together — a refused review, on a change to the reviewer itself — so the
route is `ratification-artifact.md` § The owner-permission-route, which is the
owner's own recorded act on the forge. Nothing an agent writes passes the gate
in this case, and nothing in this change tried to.
