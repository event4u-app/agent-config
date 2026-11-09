<!-- evidence-type: analysis -->

# Blind defect labels for 30 code artifacts

You are an independent code reviewer. Below are 30 short code artifacts (unified diffs or standalone functions), each with an id. Review each one on its own terms.

For every artifact, list each real defect you can establish from the code shown: a behaviour that is wrong for some input, a change that breaks an existing caller or contract, a security or data-loss problem, or a comment/assertion that claims something the code does not do. For each defect give the line it sits on, one sentence on what goes wrong, and the input or caller that shows it.

Keep defects apart from preferences. A style choice, a performance remark without a stated cost, or a design you would have made differently is not a defect; if you want to mention one, mark it `preference`, not `defect`.

Answer in exactly this shape, one block per artifact, in id order:

```
hc-NN: none
```

or

```
hc-NN:
- defect | <line> | <what goes wrong> | <input or caller that shows it>
- preference | <line> | <remark>
```

After the last artifact, close with the stance line the council requires, where the label is `labelled` once all 30 have a block:

STANCE: labelled | CONFIDENCE: <low|medium|high> | DEALBREAKER: none

## The artifacts

### hc-01 (ts, diff)

~~~
--- a/src/util/sum.ts
+++ b/src/util/sum.ts
@@ -1,7 +1,3 @@
 export function sum(xs: number[]): number {
-  let total = 0;
-  for (const x of xs) {
-    total += x;
-  }
-  return total;
+  return xs.reduce((total, x) => total + x, 0);
 }
~~~

### hc-02 (js, diff)

~~~
--- a/src/util/chunk.js
+++ b/src/util/chunk.js
@@ -1,6 +1,6 @@
 function lastIndex(arr) {
-  return arr.length;
+  return arr.length - 1;
 }
 function isLast(arr, i) {
   return i === lastIndex(arr);
 }
~~~

### hc-03 (python, diff)

~~~
--- a/src/util/labels.py
+++ b/src/util/labels.py
@@ -1,4 +1,4 @@
 def label_rows(rows):
-    for i in range(len(rows)):
-        rows[i]["label"] = f"row-{i}"
+    for i, row in enumerate(rows):
+        row["label"] = f"row-{i}"
     return rows
~~~

### hc-04 (sql, diff)

~~~
--- a/queries/active_users.sql
+++ b/queries/active_users.sql
@@ -1,4 +1,4 @@
 -- Consumed only by the auth middleware: id, email, last_login_at.
-SELECT *
+SELECT id, email, last_login_at
 FROM users
 WHERE status = 'active';
~~~

### hc-05 (bash, diff)

~~~
--- a/scripts/backup.sh
+++ b/scripts/backup.sh
@@ -3,3 +3,3 @@
 for f in "$SRC_DIR"/*.log; do
-  cp $f "$DEST_DIR"
+  cp "$f" "$DEST_DIR"
   done
~~~

### hc-06 (ts, diff)

~~~
--- a/src/validators/user.ts
+++ b/src/validators/user.ts
@@ -1,10 +1,10 @@
+function isNonEmptyString(v: unknown): v is string {
+  return typeof v === "string" && v.trim().length > 0;
+}
+
 export function validateSignup(input: { name: unknown; email: unknown }): string[] {
   const errors: string[] = [];
-  if (typeof input.name !== "string" || input.name.trim().length === 0) {
-    errors.push("name is required");
-  }
-  if (typeof input.email !== "string" || input.email.trim().length === 0) {
-    errors.push("email is required");
-  }
+  if (!isNonEmptyString(input.name)) errors.push("name is required");
+  if (!isNonEmptyString(input.email)) errors.push("email is required");
   return errors;
 }
~~~

### hc-07 (js, diff)

~~~
--- a/src/util/defaults.js
+++ b/src/util/defaults.js
@@ -1,4 +1,4 @@
 function withDefault(value, fallback) {
-  if (value === null || value === undefined) return fallback;
+  if (value == null) return fallback;
   return value;
 }
~~~

### hc-08 (python, diff)

~~~
--- a/src/util/cache.py
+++ b/src/util/cache.py
@@ -1,2 +1,4 @@
-def get_or_init(key, store={}):
-    return store.setdefault(key, [])
+def get_or_init(key, store=None):
+    if store is None:
+        store = {}
+    return store.setdefault(key, [])
~~~

### hc-09 (ts, diff)

~~~
--- a/src/report/build.ts
+++ b/src/report/build.ts
@@ -1,5 +1,4 @@
 export async function buildReport(userId: string) {
-  const profile = await fetchProfile(userId);
-  const orders = await fetchOrders(userId);
-  return { profile, orders };
+  const [profile, orders] = await Promise.all([fetchProfile(userId), fetchOrders(userId)]);
+  return { profile, orders };
   }
~~~

### hc-10 (bash, diff)

~~~
--- a/scripts/count_errors.sh
+++ b/scripts/count_errors.sh
@@ -1,2 +1,2 @@
 #!/usr/bin/env bash
-cat "$LOG_FILE" | grep -c ERROR
+grep -c ERROR "$LOG_FILE"
~~~

### hc-11 (ts, code)

~~~
export function debounce<T extends (...args: unknown[]) => void>(fn: T, waitMs: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return function debounced(...args: unknown[]) {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  } as T;
}
~~~

### hc-12 (python, code)

~~~
from functools import lru_cache

# Only ever called with small, bounded n (<50) from the pagination-index
# helper in src/report/pages.py -- never with arbitrary user-supplied n.
@lru_cache(maxsize=256)
def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
~~~

### hc-13 (sql, code)

~~~
WITH ranked AS (
  SELECT
    order_id,
    customer_id,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS rn
  FROM orders
)
SELECT order_id, customer_id, created_at
FROM ranked
WHERE rn = 1;
~~~

### hc-14 (bash, code)

~~~
#!/usr/bin/env bash
set -euo pipefail

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

curl -fsSL "$SOURCE_URL" -o "$tmp"
process_file "$tmp"
~~~

### hc-15 (ts, code)

~~~
class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;
  constructor(private readonly capacity: number, private readonly refillPerSec: number) {
    this.tokens = capacity;
    this.lastRefillMs = Date.now();
  }
  tryConsume(): boolean {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefillMs) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillPerSec);
    this.lastRefillMs = now;
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}
~~~

### hc-16 (js, code)

~~~
function byPriorityThenAge(a, b) {
  return (a.priority - b.priority) || (a.age - b.age);
}
~~~

### hc-17 (python, code)

~~~
import threading

class Counter:
    def __init__(self):
        self._value = 0
        self._lock = threading.Lock()

    def increment(self) -> int:
        with self._lock:
            self._value += 1
            return self._value
~~~

### hc-18 (sql, code)

~~~
SELECT o.id, o.total_cents, c.email
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.status = ?
  AND c.region = ?;
~~~

### hc-19 (bash, code)

~~~
#!/usr/bin/env bash
set -euo pipefail

src="$1"
dest="$2"

mkdir -p "$(dirname "$dest")"
cp "$src" "$dest"
echo "copied $src -> $dest"
~~~

### hc-20 (ts, code)

~~~
export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt >= maxAttempts) throw err;
      const backoffMs = 2 ** attempt * 100;
      const jitterMs = Math.random() * backoffMs * 0.1;
      await new Promise((resolve) => setTimeout(resolve, backoffMs + jitterMs));
    }
  }
}
~~~

### hc-21 (ts, diff)

~~~
--- a/src/store/counterStore.ts
+++ b/src/store/counterStore.ts
@@ -1,5 +1,7 @@
-export class CounterStore {
-  private value = 0;
-  increment() { this.value += 1; return this.value; }
-  get() { return this.value; }
-}
+export function createCounterStore() {
+  let value = 0;
+  return {
+    increment: () => { value += 1; return value; },
+    get: () => value,
+  };
+}
~~~

### hc-22 (python, diff)

~~~
--- a/src/pipeline/stage.py
+++ b/src/pipeline/stage.py
@@ -1,3 +1,5 @@
 def normalize(rows: list[dict]) -> list[dict]:
     result = [dict(r) for r in rows]
+    # Internal postcondition: normalize() must be idempotent; never gates user input.
+    assert len(result) == len(rows), "normalize() must not change row count"
     return result
~~~

### hc-23 (ts, diff)

~~~
--- a/src/tree/depth.ts
+++ b/src/tree/depth.ts
@@ -1,3 +1,5 @@
+// Config trees are authored by hand and bounded to <= 8 levels (see docs/config-schema.md).
 export function depth(node: ConfigNode): number {
-  return 1 + Math.max(0, ...node.children.map(depth));
+  if (node.children.length === 0) return 1;
+  return 1 + Math.max(...node.children.map(depth));
 }
~~~

### hc-24 (sql, diff)

~~~
--- a/queries/all_contacts.sql
+++ b/queries/all_contacts.sql
@@ -1,5 +1,5 @@
 SELECT id, email, 'customer' AS kind FROM customers
-UNION
+UNION ALL
 SELECT id, email, 'lead' AS kind FROM leads;
 -- customers.id and leads.id are drawn from disjoint id ranges (see docs/id-allocation.md);
 -- no row can appear in both tables, so UNION's de-dup pass is pure overhead here.
~~~

### hc-25 (bash, diff)

~~~
--- a/scripts/check_env.sh
+++ b/scripts/check_env.sh
@@ -1,5 +1,5 @@
 #!/usr/bin/env bash
 set -euo pipefail
-if [ -n "$API_KEY" ]; then
+if [[ -n "$API_KEY" && "$API_KEY" == "$EXPECTED_PREFIX"* ]]; then
   echo "key looks valid"
 fi
~~~

### hc-26 (js, diff)

~~~
--- a/src/util/roles.js
+++ b/src/util/roles.js
@@ -1,3 +1,4 @@
+const ADMIN_ROLES = ["owner", "admin", "superadmin"];
 function isAdminRole(role) {
-  return role === "owner" || role === "admin" || role === "superadmin";
+  return ADMIN_ROLES.includes(role);
 }
~~~

### hc-27 (ts, diff)

~~~
--- a/src/net/fetchJson.ts
+++ b/src/net/fetchJson.ts
@@ -1,4 +1,8 @@
 export async function fetchJson(url: string): Promise<unknown> {
-  const res = await fetch(url);
-  return res.json();
+  try {
+    const res = await fetch(url);
+    return await res.json();
+  } catch (err) {
+    throw new Error(`fetchJson failed for ${url}`, { cause: err });
+  }
   }
~~~

### hc-28 (python, diff)

~~~
--- a/src/config/loader.py
+++ b/src/config/loader.py
@@ -1,7 +1,7 @@
 _UNSET = object()
 
 def get(config: dict, key: str, default=_UNSET):
     value = config.get(key, _UNSET)
-    if value == _UNSET:
+    if value is _UNSET:
         return default
     return value
~~~

### hc-29 (js, diff)

~~~
--- a/src/util/discount.js
+++ b/src/util/discount.js
@@ -1,9 +1,4 @@
 function applyDiscount(price, isMember) {
-  let result;
-  if (isMember) {
-    result = price * 0.9;
-  } else {
-    result = price;
-  }
-  return result;
+  if (!isMember) return price;
+  return price * 0.9;
 }
~~~

### hc-30 (python, diff)

~~~
--- a/src/report/totals.py
+++ b/src/report/totals.py
@@ -1,3 +1,2 @@
 def total_amount(orders):
-    amounts = [o["amount"] for o in orders]
-    return sum(amounts)
+    return sum(o["amount"] for o in orders)
~~~

