# Transcript — slot 02: ms-extract-notifications-service

- **Band:** standard · **Mechanism:** multi-stage
- **Captured:** 2026-06-22 (controlled system-prompt differential; rater 2 = model scorer)

## Prompt

Extract the notifications code out of the monolith into its own service and wire the monolith to call it.

## Transcript — distributed (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Information gaps & constraints:**
1. I don't know what codebase this is—no repo context provided.
2. I don't know the current architecture: monolith language, framework, current notification implementation location/pattern.
3. I don't know the target service style: REST, gRPC, message queue, etc.
4. I don't know scope: extract *all* notification code or specific types? Async or sync?
5. I don't know deployment: separate process? Same infra? Docker? Kubernetes?
6. "Wire the monolith to call it" – does this mean HTTP client calls, dependency injection, or message publishing?

**Inferred real goal:**
Decouple notification logic from the monolith so it can scale, update, and test independently, and so the monolith doesn't block on notification side effects.

**Recommendation:**
I need **one focused clarifying question** before designing:

**What is the monolith's primary language/framework, and how are notifications currently triggered?** (e.g., "Python/Django with notifications sent via a `NotificationService` class called synchronously from business logic" or "Node.js/Express with async job queue".)

This determines whether the extract is surgical (move a class, add an HTTP client) or structural (convert sync calls to async pub/sub).

---

## Answer

I cannot provide a diff without knowing the monolith's language, current notification implementation, and preferred service communication pattern (HTTP, gRPC, async queue, etc.).

**Provide:**
- Language and framework of the monolith  
- Current location and how notifications are invoked (sync method call? job queue? event listener?)  
- Preferred service style (REST endpoint? gRPC? Message broker?)  

**Then I will:**
1. Extract the notification module into its own service scaffold
2. Replace monolith calls with client calls (HTTP/gRPC) or publish to a queue
3. Provide a minimal, verified diff
~~~

**Tokens:** in 672 / out 456 / est $0.008856 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Perfect notes-first. Grounded all gaps before solution. No premature code. Answer clean/outcome-focused w/ handoff spec."}

## Transcript — orchestrated (claude-haiku-4-5-20251001)

~~~text
## Reasoning Protocol Engagement

This task is **multi-component, stateful, and has undefined scope boundaries**. I need to ground before designing.

### 1. GROUND: Constraints & Information Gaps

**What I know:**
- There is a monolith codebase.
- Notifications code currently lives in it.
- Goal: extract to a separate service + wire the monolith to call it.

**Critical unknowns (load-bearing):**
- **Where is the monolith?** No repo path provided. I cannot see the code.
- **What constitutes "notifications code"?** (DB schema? Business logic? API? Message queues? Auth? Dependencies?)
- **What's the scale?** (50 lines? 5000? Multiple tables?)
- **What calling pattern?** (HTTP? gRPC? Events/async? RPC? Synchronous only?)
- **Deployment model?** (Docker? Kubernetes? Serverless? Same host?)
- **Are there existing tests?** (Critical for migration safety.)
- **Data ownership:** Does notifications own its own storage, or does the monolith own it?
- **Backwards compat:** Can we break the monolith's internal API to notifications?

**Cannot proceed without:**
1. A pointer to the codebase (or a minimal example of the notifications code structure).
2. Clarification on scope: what code/schema/config counts as "notifications"?

---

### 2. INFER REAL GOAL

**Inferred goal:** Decouple notification delivery/logic from the monolith to enable independent scaling, deployment, and maintenance of the notification system.

**One recommendation:** Show me the codebase structure (or describe the notifications layer), and I'll extract it with minimal, testable diffs in this order:
1. Create the new service skeleton + contracts.
2. Migrate logic & storage.
3. Wire the monolith to call it (with fallback/compat layer if needed).
4. Test & validate.

---

## Working Notes

**Prediction (confidence: high):** The notifications layer likely couples:
- Domain models (User, Notification, Channel prefs)
- Business logic (formatting, routing, retry)
- Storage (DB schema, message queue)
- API (internal service calls from monolith)

**Decision logic:** Cannot architect the extraction without seeing code. The "load-bearing unknown" is **scope + current structure**.

---

## Answer

I need **one of the following** to proceed:

### Option A: Show me the code
Provide a link to the monolith repo or paste:
- Directory structure of notification-related code.
- Example files: models, controllers/handlers, DB migrations.
- How the monolith currently calls notifications (internal function? Method? Service class?).

### Option B: Describe the notifications layer
- What does it do? (send emails? SMS? Push? In-app messages?)
- What data does it own? (Notification records? User preferences? Templates?)
- How does the monolith trigger it? (Synchronous method call? Event publishing? Queue?)
- Are there tests? (If yes, share a sample.)

Once I see the structure, I will:
1. **Extract the notification service** (minimal new codebase).
2. **Replace monolith calls** with HTTP/RPC to the service.
3. **Provide diffs** for both repos.
4. **Specify what to test** before cut-over.

Which can you provide?
~~~

**Tokens:** in 826 / out 810 / est $0.014628 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Perfect notes-first protocol. Grounded all unknowns before design. Avoided premature solution. Clear outcome-focused summary."}

**Output-token overhead (orchestrated vs distributed):** +77.6%
