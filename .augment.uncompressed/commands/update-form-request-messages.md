---
name: update-form-request-messages
skills: [laravel-validation]
description: Sync the messages() method of a FormRequest class — add missing entries, link them to language keys, and clean up stale ones
disable-model-invocation: true
---

# update-form-request-messages

## Trigger

`/update-form-request-messages [ClassName or file path]`

---

## Step 1: Resolve the FormRequest class

**If the user attached a file or mentioned a class name explicitly** → use it.

**Otherwise, ask:**

> Which FormRequest class should I update?
> Please provide the class name (e.g. `UpdateSuperUserRequest`), its namespace, or the file path.

Once provided, locate the file:
- Try `codebase-retrieval` or a `find` command to resolve the file path.
- If multiple matches exist, list them and ask the user to pick one (numbered options).
- If no match is found, tell the user and stop.

Read the full file content.

---

## Step 2: Check for rules()

Scan the file for a `rules()` method.

- **If no `rules()` method exists** → inform the user:

  > ⚠️  No `rules()` method found in `{ClassName}`. Nothing was changed.

  Stop here.

---

## Step 3: Parse rules()

Extract every `field → rules` pair from the `rules()` array.

For each field, collect all rules and resolve their **rule names**:

| Rule type | Example | Extracted name |
|---|---|---|
| String rule | `'required'` | `required` |
| String rule with arg | `'max:250'` | `max` |
| `Rule::` static call | `Rule::unique(...)` | `unique` |
| `Rule::` static call | `Rule::exists(...)` | `exists` |
| New object instance | `new Enum(...)` | `enum` (class basename, lowercased) |
| Closure / `fn()` | `function(...) {}` | **skip** — closures call `$fail()` themselves |

**Also skip these modifier rules** that never produce validation errors:
`nullable`, `sometimes`, `bail`

Build a flat list of `(field, rule_name)` pairs:
e.g. `[('username', 'required'), ('username', 'string'), ('username', 'unique'), ...]`

---

## Step 4: Determine the language key domain prefix

Derive the domain prefix from the class name:
1. Strip common verb prefixes: `Create`, `Update`, `Delete`, `List`, `Get`, `Send`, `Show`, `Store`, `Filter`, `Index`
2. Strip the `Request` suffix
3. Convert to `snake_case`

Example: `UpdateSuperUserRequest` → `SuperUser` → `super_user`

Present the result and ask to confirm:

> The language key prefix will be `{derived_prefix}` (e.g. `validation.{derived_prefix}.field.rule`).
> 1. Use `{derived_prefix}` ✓
> 2. Enter a different prefix

Wait for confirmation before continuing.

---

## Step 5: Build the required message entries

For each `(field, rule_name)` pair:

- **messages() key:** `{field}.{rule_name}` (e.g. `'username.required'`)
- **Lang key:** `validation.{domain}.{field}.{rule_name}`
  - Wildcard fields keep their notation: `recipients.*.user_id.required`
  - Example: `validation.super_user.username.required`

---

## Step 6: Read existing messages() method (if any)

- If a `messages()` method exists, parse all its `key => __('...')` entries.
- Keep track of which `(field.rule_name)` keys are already covered.
- Note the lang key referenced in each existing `__('...')` call.

---

## Step 7: Add missing message entries

For each required `(field, rule_name)` pair **not yet covered** by an existing messages() entry:

1. **Check if the lang key already exists** in both `lang/de/validation.php` and `lang/en/validation.php`.
2. If missing in either → generate a meaningful message:
   - **English:** e.g. `'The email address is required.'` or `'The email address has already been taken.'`
   - **German:** e.g. `'Die E-Mail-Adresse ist erforderlich.'` oder `'Diese E-Mail-Adresse ist bereits vergeben.'`
   - Do **not** write `{field_label}` or `{rule_name}` literally into the lang file — replace them with the actual derived values.
   - You may use Laravel's standard placeholders (`:attribute`, `:max`, `:min`, etc.) instead of embedding the label directly.
   - Adapt the message text to fit the specific rule (e.g. `required` → "is required", `unique` → "has already been taken", `max` → "may not exceed :max characters")
   - Use sensible human-readable field labels (derive from the field name: `snake_case` → "Title Case")
3. Add the new lang key to `lang/de/validation.php` and `lang/en/validation.php` following the flat dot-notation format from `laravel-translations` rule.
   - If a domain section comment exists for `{domain}`, insert near it. Otherwise append at the end.
4. Add the entry to the `messages()` method: `'{field}.{rule_name}' => __('validation.{domain}.{field}.{rule_name}'),`

---

## Step 8: Clean up stale messages() entries

Find all keys in `messages()` where `{field}.{rule_name}` is **no longer valid**:
- The field no longer exists in `rules()`, OR
- The rule no longer applies to that field

For each stale entry:
1. Extract the lang key from the `__('...')` call.
2. **Search the relevant source directories** for that exact lang key string, excluding `vendor/` and `node_modules/` (e.g. `grep -r "validation.super_user.username.old_rule" app lang resources routes config`).
3. If the lang key is **used nowhere else** → remove it from both `lang/de/validation.php` and `lang/en/validation.php`.
4. Remove the stale key from `messages()`.

---

## Step 9: Write the messages() method

If `messages()` did not exist → add it after `rules()`:

```php
/** @return array<string, string> */
public function messages(): array
{
    return [
        '{field}.{rule}' => __('validation.{domain}.{field}.{rule}'),
        // ...
    ];
}
```

If it existed → update it in-place (keep existing entries that are still valid, add new ones, remove stale ones).

Keep any spread array entries (e.g. `...parent::messages()`) at the top of the array in their original order. Below them, sort only the keyed entries by field name, then rule name within the same field.

---

## Step 10: Summary

Print a summary table of what changed:

```
FormRequest: UpdateSuperUserRequest

ADDED TO messages():
  username.required  →  validation.super_user.username.required

REMOVED FROM messages():
  email.old_rule  (lang key removed from both lang files)

UNCHANGED:
  username.string, username.unique, ...

LANG FILES UPDATED:
  lang/en/validation.php  — +1 added, -1 removed
  lang/de/validation.php  — +1 added, -1 removed
```

---

## Rules

- **Never hardcode message strings** in the FormRequest — always use `__('validation.key')`.
- **Always update both** `lang/de/validation.php` AND `lang/en/validation.php`. One without the other is a bug.
- **Lang keys use flat dot-notation** — never nested arrays in lang files.
- **Do NOT commit or push.** Only apply local changes.
- **Do NOT remove lang keys** that are still referenced anywhere else in the codebase.

