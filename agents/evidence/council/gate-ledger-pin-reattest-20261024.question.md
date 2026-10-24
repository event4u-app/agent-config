<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 for a pin re-attestation,
     committed verbatim. The asking agent holds the roadmap's claim and is the
     accountable role named in D39, which may not renew a pin on its own reading. -->

# Re-attestation: does this helper diff change any classified assertion of the 7.1 ledger?

A classification ledger pins the transitive helper closure of 16 CI check
scripts by digest. Merging the trunk changed two helpers on that closure, so the
pin now reports stale. By the recorded rule the pin is renewed only after a
council round answers 2/2 that the diff changes no classified assertion.
Otherwise the affected rows are re-reviewed.

## How the diff reaches the checks

An import trace from each of the 16 check scripts finds exactly one check
reaching the changed files:

```text
check_knowledge_cards.ts → _lib/knowledge_global.ts → _lib/agent_settings.ts → _lib/settings_removed_keys.ts
check_knowledge_cards.ts → _lib/knowledge_global.ts → _lib/agent_settings.ts → _lib/settings_renamed_keys.ts
```

The changed constant `SETTINGS_REMOVAL_RULE` is used in one place,
`_lib/release_settings_surface.ts`, which is not on the helper closure of any of
the 16 checks. `RENAMED_KEYS`, the map `agent_settings` reads, is unchanged.

## The diff, verbatim

```diff
diff --git a/src/scripts/_lib/settings_removed_keys.ts b/src/scripts/_lib/settings_removed_keys.ts
index 98f168d62b..c8f01eaa71 100644
--- a/src/scripts/_lib/settings_removed_keys.ts
+++ b/src/scripts/_lib/settings_removed_keys.ts
@@ -74,8 +74,10 @@ type SettingsDict = Record<string, unknown>;
  *
  * Release class: A settings key may be removed or renamed in a minor release
  * only when no consumer project can rely on it — default-neutral and
- * derivable, proven by a named test; any other removal or rename ships only in
- * a major, and a renamed key's alias is dropped only in a major. An entry here
+ * derivable, proven by a named test — or, for a rename, when its RENAMED_KEYS
+ * alias carries the value and the release declares Consumer-Impact: automatic;
+ * any other removal or rename ships only in a major, and a renamed key's alias
+ * is dropped only in a major. An entry here
  * is what tells a consumer the key went; it is not the licence for a minor —
  * {@link MINOR_REMOVAL_PROOFS} is, and the cut reads it.
  *
diff --git a/src/scripts/_lib/settings_renamed_keys.ts b/src/scripts/_lib/settings_renamed_keys.ts
index 76a8e98218..f9a3ed0992 100644
--- a/src/scripts/_lib/settings_renamed_keys.ts
+++ b/src/scripts/_lib/settings_renamed_keys.ts
@@ -9,8 +9,10 @@
  *
  * Release class: A settings key may be removed or renamed in a minor release
  * only when no consumer project can rely on it — default-neutral and
- * derivable, proven by a named test; any other removal or rename ships only in
- * a major, and a renamed key's alias is dropped only in a major. The new key
+ * derivable, proven by a named test — or, for a rename, when its RENAMED_KEYS
+ * alias carries the value and the release declares Consumer-Impact: automatic;
+ * any other removal or rename ships only in a major, and a renamed key's alias
+ * is dropped only in a major. The new key
  * always wins when one layer carries both: a reader who has already migrated
  * is not overridden by a stale line they forgot to delete.
  *
@@ -29,8 +31,9 @@ export type SettingsLayer = Record<string, unknown>;
  */
 export const SETTINGS_REMOVAL_RULE =
     'A settings key may be removed or renamed in a minor release only when no consumer project can ' +
-    'rely on it — default-neutral and derivable, proven by a named test; any other removal or rename ' +
-    "ships only in a major, and a renamed key's alias is dropped only in a major.";
+    'rely on it — default-neutral and derivable, proven by a named test — or, for a rename, when its ' +
+    'RENAMED_KEYS alias carries the value and the release declares Consumer-Impact: automatic; any other ' +
+    "removal or rename ships only in a major, and a renamed key's alias is dropped only in a major.";
 
 export const RENAMED_KEYS: ReadonlyMap<string, string> = new Map([
     ['planning.challenge_on_create', 'planning.closure_pass'],
```

## Question

Does this diff change any assertion that `check_knowledge_cards`, or any other
of the 16 checks, makes about the repository? Answer **no change** or
**change**. If change, name the assertion. Then say whether the stale helper
pin may be renewed on that basis. Give your confidence.
