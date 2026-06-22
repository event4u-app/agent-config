# Transcript — slot 12: ss-review-email-regex

- **Band:** standard · **Mechanism:** stateless
- **Captured:** 2026-06-22 (controlled system-prompt differential; rater 2 = model scorer)

## Prompt

Is this email regex safe to use for validation: ^[^@]+@[^@]+\.[^@]+$ ?

## Transcript — distributed (claude-haiku-4-5-20251001)

~~~text
## Working notes

**What "safe" means here** — The task likely asks whether this regex is safe for *production email validation* (won't crash, won't expose the system to ReDoS, won't silently reject valid emails). It could also mean "safe from security injection," but regex itself isn't a vector; misuse of the result is.

**Constraints & facts:**
- The regex: `^[^@]+@[^@]+\.[^@]+$`
- Must handle: common valid emails, edge cases per RFC 5321/5322
- Must avoid: ReDoS (catastrophic backtracking), false negatives on real addresses

**Analysis:**

1. **ReDoS risk:** LOW. The regex uses only `[^@]+` (negated char class) and literal chars. Negated classes don't backtrack catastrophically; they consume greedily until a match boundary. No nested quantifiers or alternations that create exponential paths. Safe from ReDoS.

2. **Correctness (false negatives/positives):**
   - ✓ Enforces `user@domain.tld` shape
   - ✗ **Rejects valid addresses:** `user+tag@domain.co.uk` (works—`+` is in `[^@]`), `user.name@domain` (works—`[^@]+` after second `@`), but `user@localhost` (fails—no dot required after domain). This breaks intranet emails and misses RFC allowances.
   - ✗ **Accepts invalid addresses:** `a@b.c` passes; `a@@b.c` fails ✓; but `user@domain.` passes (trailing dot is invalid per RFC).
   - ✗ **No escape handling:** `user\"@domain.com` is technically valid in quoted strings per RFC 5321; regex will reject it.

**Real-world verdict:** This regex is **not safe for production**—it's a *shape check*, not validation. It will reject real emails and accept some invalid ones.

---

## Answer

**No, this regex is not safe for production email validation.**

**Why:**

1. **It rejects valid emails.** Examples:
   - `user@localhost` (intranet)
   - `user+tag@example.com` (subaddressing; the `+` is allowed)
   - `user@example.co.uk` actually works, but...

2. **It accepts invalid emails.** Examples:
   - `user@domain.` (trailing dot violates RFC 5321)
   - `a@b.c` (too permissive on label length and structure)

3. **It's incomplete.** Doesn't handle:
   - Quoted strings or escapes (RFC 5321 allows `"user name"@domain.com`)
   - IP literals (`user@[192.0.2.1]`)

**What to do instead:**

- **For most applications:** Use a battle-tested library (e.g., `email-validator` npm, Python `email-validator`, or language stdlib). They handle RFCs and real-world quirks.
- **If you must regex:** Use a more permissive check like `^[^\s@]+@[^\s@]+\.[^\s@]+$` (allows more valid cases) *and follow it with a confirmation email step*—that's the only true validation.
- **Best practice:** Accept any plausible-looking address and validate by sending a confirmation link. Regex alone cannot validate email correctness.

The regex is **safe from ReDoS** (no backtracking risk) but **unsafe from a correctness standpoint**.
~~~

**Tokens:** in 675 / out 848 / est $0.014745 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Exemplary: grounded safety in context, tested edge cases, avoided premature solution, delivered actionable verdict first."}

## Transcript — orchestrated (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Ground the constraints:**
- Task is to assess a specific regex for email validation
- "Safe" is ambiguous: safe from what? (ReDoS, false negatives, false positives, security)
- Email validation is notoriously complex; RFC 5321/5322 specs are permissive but real-world use rarely needs full compliance

**Infer the real goal:**
The question is likely "Is this regex sufficient for my validation use case?" The answer depends on context, but I should flag the actual risks and tradeoffs.

**Load-bearing unknowns:**
1. What is the regex *used for*? (signup form, internal tool, message filtering?)
2. What is the cost of false positives vs. false negatives in the context?
3. Do you need RFC compliance or just "probably a real email"?

**Assess the regex itself:**
- Pattern: `^[^@]+@[^@]+\.[^@]+$`
- What it does: matches one or more non-@ chars, @, one or more non-@ chars, a dot, one or more non-@ chars
- ReDoS risk: **None.** No backtracking, no nested quantifiers, no alternation. Linear time.
- False negatives (rejects valid): **Many.** (1) No support for + in local part. (2) Subdomains like `user@co.uk` fail (only matches 1 dot). (3) International domains fail. (4) Quoted strings fail. (5) IP addresses in brackets fail.
- False positives (accepts invalid): **Several.** (1) `a@b.c` passes but `.` at start/end of labels is invalid. (2) `@@@` passes the regex as written—wait, no: needs at least one char before first @. Actually `a@b.c` is the minimal valid match here. But `a@b..c` passes (double dot). (3) Labels can't be 64+ chars in spec, but this allows it.

</answer>

## Answer

**Safe from ReDoS?** Yes—no pathological backtracking.

**Safe for actual email validation?** No—too permissive and too restrictive simultaneously:

| Issue | Impact |
|-------|--------|
| Rejects `user+tag@example.com` | False negative (common in real inboxes) |
| Rejects `user@example.co.uk` | False negative (only matches one dot) |
| Accepts `user@example..com` | False positive (invalid double dot) |
| No length limits on labels | False positive (violates RFC 1035) |

**Recommendation:**

- **For a quick, low-stakes signup form:** use this regex *and* send a confirmation email. The confirmation is your real validator; the regex just prevents obvious typos.
- **For anything more rigorous:** use a dedicated email validation library (e.g., `email-validator` in Python, `Apache Commons Validator` in Java) or at minimum adopt `^[^\s@]+@[^\s@]+\.[^\s@]+$` and document that it's a heuristic, not a spec check.
- **Never** rely on regex alone for email validation. The only true test is whether the recipient can receive mail at that address.
~~~

**Tokens:** in 829 / out 766 / est $0.013977 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Exemplary: grounded ambiguity, resolved unknowns, concrete risks tabulated, actionable recs; answer clean & standalone."}

**Output-token overhead (orchestrated vs distributed):** -9.7%
