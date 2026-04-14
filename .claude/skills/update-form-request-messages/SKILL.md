---
name: update-form-request-messages
description: "Update FormRequest validation messages"
disable-model-invocation: true
argument-hint: "[ClassName or path]"
---

# update-form-request-messages

## Trigger

`/update-form-request-messages [ClassName or file path]`

---

## Step 1: Resolve the FormRequest class

File attached or class name → use it. Otherwise ask. Locate via `codebase-retrieval` / `find`. Multiple matches → numbered options. Not found → stop. Read file.

---

## Step 2: Check for rules()

No `rules()` method →

  > ⚠️  No `rules()` method found in `{ClassName}`. Nothing was changed.

  Stop here.

---

## Step 3: Parse rules()

Extract `field → rules` pairs, resolve rule names:

| Rule type | Example | Extracted name |
|---|---|---|
| String rule | `'required'` | `required` |
| String rule with arg | `'max:250'` | `max` |
| `Rule::` static call | `Rule::unique(...)` | `unique` |
| `Rule::` static call | `Rule::exists(...)` | `exists` |
| New object instance | `new Enum(...)` | `enum` (class basename, lowercased) |
| Closure / `fn()` | `function(...) {}` | **skip** — closures call `$fail()` themselves |

Skip modifiers: `nullable`, `sometimes`, `bail`. Build flat `(field, rule_name)` pairs.

---

## Step 4: Determine the language key domain prefix

Strip verb prefix (`Create`/`Update`/`Delete`/etc.) + `Request` suffix → `snake_case`.
Example: `UpdateSuperUserRequest` → `super_user`. Confirm:

> The language key prefix will be `{derived_prefix}` (e.g. `validation.{derived_prefix}.field.rule`).
> 1. Use `{derived_prefix}` ✓
> 2. Enter a different prefix

---

## Step 5: Build required entries

Key: `{field}.{rule_name}` → Lang: `validation.{domain}.{field}.{rule_name}` (wildcards preserved).

---

## Step 6: Read existing messages()

Parse existing `key => __('...')` entries. Track covered keys.

---

## Step 7: Add missing entries

Per uncovered pair:
1. Check lang key in both `lang/de/` + `lang/en/`
2. Missing → generate meaningful messages (EN + DE), use `:attribute`/`:max`/`:min` placeholders, adapt per rule
3. Add to both lang files (flat dot-notation)
4. Add to `messages()`: `'{field}.{rule_name}' => __('validation.{domain}.{field}.{rule_name}'),`

---

## Step 8: Cleanup stale entries

Field/rule no longer in `rules()` → grep for lang key in codebase. Unused → remove from both lang files + `messages()`.

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
