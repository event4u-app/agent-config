# Golden transcript — slot 02: oauth-migration-token-map

- **Task family:** ambiguous-discovery
- **Host strength:** standard
- **Discipline focus:** grounding+intent
- **Captured:** 2026-06-17 (controlled two-system-prompt API harness; single rater)

## Prompt

We need to migrate auth to OAuth and we're not sure the legacy token format maps cleanly. How should we approach this?

## Transcript — baseline (claude-haiku-4-5-20251001)

~~~text
Before diving in, I need one clarifying question:

**Do you have existing users with legacy tokens that need to continue working during the migration, or can you do a hard cutover where all users re-authenticate?**

This fundamentally changes the approach:

**If you need backward compatibility:**
- Run both systems in parallel during transition
- Create a token translation layer that accepts legacy tokens, validates them against the old system, then issues OAuth tokens
- Track which users have migrated; gradually deprecate legacy token support
- Set a hard cutoff date for legacy tokens

**If you can do a hard cutover:**
- Simpler: disable legacy tokens, force re-auth to OAuth
- Faster migration, less code complexity
- Only viable if your user base can tolerate downtime or re-login

**General approach either way:**
1. Document the legacy token format (structure, claims, validation logic)
2. Map legacy user identifiers/permissions to OAuth claims/scopes
3. Stand up OAuth provider (build, or use third-party like Auth0/Okta)
4. Build adapter layer if needed
5. Deploy OAuth alongside legacy; test both paths work
6. Migrate users in batches with monitoring
7. Set and hit the deprecation deadline

What's your constraint here—user continuity or can you hard-reset?
~~~

**Tokens:** in 124 / out 296 / est $0.001604

## Transcript — treatment (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Load-bearing unknowns:**
1. What does "legacy token format" look like? (JWT, opaque string, session ID, custom payload?)
2. What OAuth flow are we targeting? (authcode, implicit, client credentials, something else?)
3. What's the scope of "migrate"? (parallel run both? hard cutover? gradual token refresh?)
4. Do we have external consumers of the old tokens, or is it internal-only?
5. What claims/permissions does the legacy format carry, and do they map to OAuth scopes?

**Constraints I'm inferring:**
- Existing tokens are live in the wild (or in sessions).
- We need to avoid breaking existing clients if possible.
- OAuth and legacy tokens have different semantics (OAuth tokens are bearer + scopes; legacy may be opaque or role-based).

**Real goal:** Safely transition from legacy auth to OAuth without losing user sessions or breaking integrations.

---

## Answer

**Before designing the migration, you must answer these three questions:**

1. **What is the legacy token? (Format + semantics)**  
   - Is it a JWT, opaque string, or session cookie? 
   - Does it encode roles, permissions, user ID, expiry?  
   - What validates it on the backend?

2. **Can you accept a parallel-run period?**  
   - Support both legacy + OAuth tokens temporarily, or must you hard-cut?  
   - This changes risk profile entirely.

3. **Who consumes the tokens?**  
   - Internal services only, or external API clients?  
   - If external, can you deprecation-window, or must you maintain backward compat?

**Recommended approach (assuming internal-only, no immediate hard cutover required):**

1. **Add OAuth token issuance** alongside legacy path; don't remove legacy yet.
2. **Map legacy claims → OAuth scopes** explicitly (document the table).
3. **Dual-acceptance on token validation:** Accept either legacy OR OAuth tokens; track which path each request takes.
4. **Reissue strategy:** On legacy token refresh/login, issue OAuth token; gradually shift the population.
5. **Cutover gate:** Once >90% of active sessions run on OAuth, remove legacy validation, set expiry on old tokens.

**If external clients exist:** Add a token migration endpoint (`POST /auth/migrate?legacy_token=X`) that exchanges old for new; publish deprecation timeline.

**What I'd tackle first:** Audit the codebase for token validation points (middleware, interceptors, validators). That tells you the blast radius and what "dual acceptance" actually costs.

What's the legacy token format, and are there external consumers?
~~~

**Tokens:** in 674 / out 619 / est $0.003769

**Output-token overhead (treatment vs baseline):** +109.1%

## Rubric score (0–3 each) — fill during scoring

| dim | baseline | treatment | evidence (quote the transcript line) |
|---|---|---|---|
| 1 notes-first adherence |  |  |  |
| 2 grounding |  |  |  |
| 3 premature-solution avoidance |  |  |  |
| 4 coherence / re-grounded summary |  |  |  |

- **baseline mean:** _ / 3 · **treatment mean:** _ / 3 · **delta:** _
- **reasoning_extraction refusal seen?** no
- **notes:** 
