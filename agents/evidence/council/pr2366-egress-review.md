<!-- evidence-type: analysis -->

# Council review of PR #2366 — egress rule table, placeholder tokens, secret detector refactor

Two rounds, 2026-10-15, both with two seats present (`anthropic/claude-sonnet-4-5`,
`openai/codex-default`, CLI transport, `--prompt-mode pr --rounds 2`). Prompts,
committed verbatim before each run:
`agents/evidence/council/pr2366-egress-review-20261015.question.md` (round 1) and
`agents/evidence/council/pr2366-egress-review-r2-20261015.question.md` (round 2).
The full responses are local run output and are summarised here, with the seats'
stances in their own words.

## Round 1 — verdicts

| Seat | Stance |
|---|---|
| anthropic/claude-sonnet-4-5 | "REQUEST_CHANGES" — blocking: forged token bypass, detection regression. "Highest-leverage change: Fix the forged-token bypass — it's attacker-controllable and undermines the entire replacement layer." |
| openai/codex-default | "REQUEST_CHANGES — forged token substrings can bypass replacement and the scanner migration loses established coverage; the highest-leverage pre-merge change is to remove unauthenticated overlap suppression and add an executable old-versus-new adversarial parity suite covering embedded tokens and every changed boundary." |

## Round 1 — findings and dispositions

| # | Severity (seats) | Finding | Disposition | Red-proof |
|---|---|---|---|---|
| 1 | high / high | `replaceValues` dropped every span overlapping any syntactically valid token, so a token-shaped substring inside a credential left the credential in plaintext | fixed — a span is left alone only inside a token this scope minted (`TokenScope.owns`) | six embedded-forgery tests (one per credential type whose class admits `_`) red before the fix |
| 2 | high / high | bounding quantifiers narrowed the commit-time scanner (1,024-char keys lost a suffix, 8,192-char JWT segments and 256-char userinfo missed, more than 16 spaces evaded `generic-assignment`) | fixed — quantifiers unbounded wherever linear, with a required per-rule `linearity` argument; two bounds kept where the unbounded form was quadratic, published as `DETECTION_CEILINGS` and in the contract | frozen pre-move rule pack vs table on every changed boundary: 16 cases red before |
| 3 | medium (both) | the contract claimed foreign or invented tokens are always unresolved; with a 24-bit fingerprint that holds only with probability 1 − 2^-24 per guess | fixed in the contract — probability stated; what a successful guess returns (an identifier, locally) stated | contract text |
| 4 | medium / medium | token identity ignored the class, so identifier-then-credential minting kept a credential restorable | fixed — minting one (type, value) under a second class throws | test red before, both orders |
| 5 | medium / medium | the non-retention test serialised the sanitised `snapshot()` | fixed — the test walks every string reachable from the scope, first proving it reaches the stored identifier | red with the credential branch neutralised to store its value |
| 6 | low / low | global or sticky exclusion regexes kept `lastIndex` between calls | fixed — reset before each test | red before, both flags |
| 7 | medium (one seat) | the contract's logging rule contradicts the scanner's masked preview | documented — named exception in the contract, owned by step 2.2; scanner behaviour unchanged because `secret-vcs-guard` asks for the preview | contract text |
| 8 | medium (one seat) | "no rule matches a token" was untested and false for `generic-assignment` after a keyword | fixed — explicit test that it can match (fingerprint-dependent entropy); idempotence rests on the scope check | test |

Seat disagreement noted: one seat rated finding 3 not blocking and fail-closed;
the other showed an exact collision aliases the existing entry. The contract
change follows the second reading.

## Round 2 — verdicts

Prompt built from the post-fix diff at `a652ab9e2` (49.9 KB, omissions named in
the prompt). Both seats judged all eight round-1 findings resolved or resolved by
disclosure (one seat rated finding 4 "partially resolved" because of the key
issue below), and both asked for changes on new defects:

| Seat | Stance |
|---|---|
| anthropic/claude-sonnet-4-5 | "REQUEST_CHANGES — offset ambiguity and mutable key bypass are correctness/security defects that can leave credential bytes in plaintext or breach class isolation." |
| openai/codex-default | "REQUEST_CHANGES — ambiguous capture offsets can leave credential bytes plaintext and caller-controlled keys can defeat class/scope isolation; the highest-leverage change is to introduce one authoritative, index-based span extraction path and exercise replacement end to end with adversarial repeated-substring tests." |

## Round 2 — findings and dispositions

| # | Severity (seats) | Finding | Disposition | Red-proof |
|---|---|---|---|---|
| R2-1 | high / high | a captured value was placed with `m[0].indexOf(value)`; when the value repeats the keyword its first copy is at offset 0, so the wrong bytes were replaced | fixed — `generic-assignment` carries the `d` flag; the table and the commit-time scanner read `m.indices`; a value-group rule without the flag is refused | replacement test (`AuthToken=AuthToken=AuthToken=`) and scanner column test red before. The seat's own example does not pass the value gate, so a self-overlapping value that does was used |
| R2-2 | high / high | `TokenScope` kept a caller-owned mutable key; mutation bypassed the class check and two scopes sharing a key resolved each other's tokens | fixed — the constructor takes no key and draws 32 random bytes | shared-key test red before |
| R2-3 | medium / medium | `mint()` accepted types and numbers the recogniser rejects, breaking second-pass stability | fixed — type and number range refused at mint | two tests red before |
| R2-4 | medium (one seat) | the parity suite bypassed validators, context and exclusions | fixed — every case also runs through `findSpans` against the pre-move pattern plus a frozen pre-move value gate | red (6 cases) with the validator neutralised |
| R2-5 | note (one seat) | `resolve()` does not check the fingerprint against the number | not a defect — the lookup key is the whole token string, fingerprint included, so a mismatched fingerprint finds nothing | existing forged-fingerprint test |

The review was presented twice, as instructed. The round-2 fixes have **not**
been re-reviewed by the council.

Not changed and not raised as defects: the JWT linearity wording and the
`findUnboundedQuantifier` name (one seat raised them as minor; the other judged
them not to be defects).
