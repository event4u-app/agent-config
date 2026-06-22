# Transcript — slot 09: ss-explain-deadlock

- **Band:** standard · **Mechanism:** stateless
- **Captured:** 2026-06-22 (controlled system-prompt differential; rater 2 = model scorer)

## Prompt

Why might a query be deadlocking under load? Give the common causes.

## Transcript — distributed (claude-haiku-4-5-20251001)

~~~text
## Working notes

This is a straightforward technical question asking for enumeration of common deadlock causes. No ambiguity, no design work needed. A reasoning protocol would be overkill. Answering directly with well-organized categories and specifics.

## Answer

**Common causes of query deadlocking under load:**

### 1. **Lock ordering mismatch**
- Two or more transactions acquire locks on the same tables/rows in different orders.
- TX1: locks TableA → waits for TableB. TX2: locks TableB → waits for TableA.
- Most common cause. Load amplifies by increasing transaction concurrency.

### 2. **Row-level lock conflicts**
- Transactions lock rows in unpredictable order (e.g., scanning with WHERE conditions that match different rows per execution).
- Under load, overlapping scans collide more frequently.
- Example: UPDATE on non-unique column or range queries without explicit ordering.

### 3. **Gap locks and phantom reads (InnoDB)**
- Next-key locking on range predicates can cause deadlocks between INSERT/UPDATE/SELECT operations.
- Gap locks on the same range held by different transactions block each other circularly.

### 4. **Implicit locks from foreign keys**
- FK constraint checks acquire locks on parent/child tables without explicit ORDER BY.
- Bulk inserts or updates can trigger them in conflicting order.

### 5. **Lock escalation or conversion**
- Shared locks (S) held by one TX trying to upgrade to exclusive (X) while another TX holds X waiting for S on the same resource.

### 6. **Cursor-level deadlocks**
- Long-running transactions hold locks while executing multiple statements.
- Load increases likelihood that a later statement in TX1 conflicts with an earlier statement in TX2.

### 7. **Hot rows under contention**
- Many transactions competing for the same small set of rows (inventory counts, account balances).
- Lock wait queues grow; eventual timeout triggers rollback, which cascades.

### 8. **Locking in application logic after DB query**
- Application acquires a lock (mutex, semaphore) after a DB read, then issues a DB write.
- Two threads doing this in opposite order = deadlock.

### 9. **Insufficient transaction isolation level**
- Running at READ_COMMITTED instead of SERIALIZABLE can mask lock conflicts until they manifest as anomalies under load.

### 10. **Inadequate indexes**
- Missing index forces full table scan, locking more rows than necessary.
- Load makes contention on locked rows more likely.

---

**Quick diagnostic approach:**
- Check database lock wait graph (`SHOW ENGINE INNODB STATUS`, `sp_who2`, equivalent for your DB).
- Inspect transaction log for lock order in deadlock report.
- Measure transaction duration and scope (rows locked).
- Verify PRIMARY KEY / UNIQUE INDEX coverage for WHERE clauses.
~~~

**Tokens:** in 664 / out 672 / est $0.012072 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Perfect direct-answer format. Notes correctly dismiss reasoning protocol as overkill. Comprehensive, grounded, no premature work."}

## Transcript — orchestrated (claude-haiku-4-5-20251001)

~~~text
## Working notes

This is a knowledge question, not a code-change task. No reasoning protocol needed—direct answer is appropriate.

The questioner is asking for common causes of query deadlocks under load. This is a diagnostic reference, not a design challenge. I'll enumerate the actual patterns that appear in production systems.

## Answer

Query deadlocks under load occur when two or more transactions hold locks that each other needs, creating a cycle. Here are the common causes:

### 1. **Lock ordering inconsistency**
Transactions acquire locks on tables/rows in different orders.
- Transaction A: locks Table1, then Table2
- Transaction B: locks Table2, then Table1
- **Under load:** Both transactions start simultaneously, each holding their first lock, waiting for the second.

### 2. **Row-level lock conflicts with overlapping row sets**
Multiple transactions modify overlapping rows in different orders.
- Transaction A: updates rows {1, 2}
- Transaction B: updates rows {2, 1}
- **Under load:** High concurrency makes collision timing probable.

### 3. **Gap locks or range locks (e.g., PostgreSQL, MySQL InnoDB)**
Transactions use `WHERE` predicates that lock ranges, not just individual rows.
- Transaction A: `WHERE id > 10` (gap locks everything > 10)
- Transaction B: `WHERE id < 50` (gap locks everything < 50)
- Under high concurrency, they block each other's subsequent inserts or range scans.

### 4. **Foreign key constraints**
Operations on parent and child tables in reverse order.
- Transaction A: inserts child row, waits for parent check
- Transaction B: deletes parent row, waits for child check
- Deadlock if timing aligns.

### 5. **Implicit locks from secondary effects**
- Index updates during inserts/deletes
- Cascade triggers or application-level locking
- Lock escalation (row → page → table)

### 6. **Load itself (not a root cause, a multiplier)**
Low concurrency hides deadlock-prone patterns. High concurrency makes rare timing windows frequent. If deadlocks are *only* under load, the query pattern itself is the issue.

---

### Diagnostic approach:
1. **Enable deadlock logging** (MySQL: `innodb_print_all_deadlocks`; PostgreSQL: `log_lock_waits`).
2. **Check lock wait graph** from the log—identify which queries hold vs. wait.
3. **Examine transaction isolation level** (SERIALIZABLE vs. READ COMMITTED changes lock behavior).
4. **Review transaction scope**—long transactions hold locks longer, increasing collision windows.

**Most common fix:** Ensure all transactions access tables/rows in the same order.
~~~

**Tokens:** in 818 / out 636 / est $0.011994 · rater2 {"dim1":3,"dim2":3,"dim3":3,"dim4":3,"reasoning_extraction_refusal":false,"note":"Correctly identified knowledge Q not needing protocol. Clean answer, grounded in constraints, enumerated causes, diagnostic path."}

**Output-token overhead (orchestrated vs distributed):** -5.4%
