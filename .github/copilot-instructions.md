# Copilot Repository Instructions

This repository contains a Laravel backend application (Laravel 11, PHP 8.2, Pest).

> **For Copilot Chat users:** This project has extensive agent documentation in `.augment/`
> (skills, rules, guidelines, commands) and `agents/` (project docs). Ask Copilot Chat to
> read those files for deeper context. The instructions below are self-contained for
> Copilot Code Review, which cannot read other files.

## ✅ Scope Control

- Do not introduce architectural changes unless explicitly requested.
- Do not replace existing patterns with alternative patterns.
- Do not suggest new libraries unless explicitly requested.
- Stay within the established project structure and conventions.

## ✅ Architecture

- Controllers must be thin and contain no business logic
- Business logic belongs in service classes
- Models must not contain domain workflow or business process logic.
  Simple accessors, mutators, scopes, and state-check methods are allowed.
- Validation must be done via FormRequest classes
- Authorization must be handled via Policies

## ✅ General Coding Standards

- **PSR-4 autoloading:** Exactly **one class/interface/trait/enum per file**. The filename must match the
  class name. Test helper classes (fakes, stubs) go in `Tests/Utils/` with the correct namespace.
- New PHP files must declare `declare(strict_types=1);` (**exception:** migration files).
- Use typed properties, parameters, and return types. Constructor property promotion preferred.
- Only add PHPDoc when type hints are insufficient (e.g., `@param array<int, MyObject> $items`).
- Avoid magic numbers or hard-coded strings; use constants or config files.
- Code style (PSR-12, formatting, trailing commas) is auto-enforced by **ECS** — don't nitpick style.

## ✅ PHP 8.2 Best Practices

All code must be compatible with PHP ^8.2. Use modern features:

- **readonly** properties/classes for immutability (DTOs, Events, Value Objects)
- **Enums** instead of string/integer constants
- **Constructor Property Promotion**, **Union/Intersection Types**, **Nullsafe (?->)**
- **final** classes where extension is not intended (Services, Controllers, Jobs, Events)
- **Named Arguments** for multi-parameter calls

### `readonly` and `final` exceptions

- Do NOT use `readonly` or `final` on **Pest test classes**
- Do NOT use `final` on classes that need **Mockery mocking** (e.g. Repositories) —
  Mockery cannot mock `final` without `dg/bypass-finals`

```php
// ✅ Event — readonly + final
final readonly class ReportCreated
{
    public function __construct(private Report $report) {}
}

// ✅ Service — readonly
readonly class ReportService
{
    public function __construct(
        private ReportRepository $repository,
        private EventDispatcher $dispatcher,
    ) {}
}
```

## ✅ Laravel Conventions

- New features go into `app/Modules/` (modular structure). Legacy code lives in `app/`.
- **Controllers:** Thin, single-action (`__invoke()`), use FormRequests + Resource responses.
- **Business logic:** Service classes, Action classes, or Jobs — never in controllers or models.
- **Models:** Relationships, scopes, accessors/mutators only — no business logic.
- **Authorization:** Policies (not Gates). Every FormRequest has `authorize()`.
- **Eloquent:** Use `$casts`, eager loading, transactions for multi-step writes. Avoid raw SQL.
- **API:** Resource classes for JSON, route model binding, proper HTTP status codes, versioned routes.
- **Testing:** Pest framework, seeders for test data, `Http::fake()` for external services.
- **Performance:** Eager load to avoid N+1, paginate large datasets, queue long-running tasks.

## ✅ Calculations

- **CRITICAL:** Always use the `Math` helper class (`app/Services/Helper/Math.php`) for **all** financial and business calculations
- This ensures high precision using BCMath and prevents floating-point rounding errors
- Never use native PHP arithmetic operators (`+`, `-`, `*`, `/`) for business-critical calculations
- The Math helper provides:
    - `Math::add()` - Addition with precision
    - `Math::subtract()` - Subtraction with precision
    - `Math::multiply()` - Multiplication with precision
    - `Math::divide()` - Division with precision and division-by-zero handling
    - `Math::round()` - Proper rounding
    - `Math::sum()` - Sum of arrays with precision
- **Example:**
  ```php
  // ❌ Wrong - floating point errors
  $total = $price * $quantity;

  // ✅ Correct - precise calculation
  $total = Math::multiply($price, $quantity);
  ```

## ✅ Environment Checks

- Always use the `AppEnvironment` enum (`App\Enums\AppEnvironment`) or `EnvHelper` (`App\Helpers\EnvHelper`)
  to check the current environment
- Never use raw `app()->environment('...')` calls or hardcoded `env('APP_ENV') === '...'` comparisons
- **Application code** (Services, Middleware, Controllers, Jobs): use the `AppEnvironment` enum
- **Config files** (`config/*.php`): use `EnvHelper` (app container is not yet available)
- **Example:**
  ```php
  // ❌ Wrong
  if (app()->environment('testing')) { ... }

  // ✅ Correct — application code
  if (AppEnvironment::TESTING->isActive()) { ... }

  // ✅ Correct — config files
  $isTesting = EnvHelper::isEnvironment(AppEnvironment::TESTING);
  ```
- See `agents/docs/env-helper.md` and `agents/docs/environments.md` for full documentation

## ✅ Copilot Behavior

- Generate **strictly typed** PHP 8.2 / Laravel 11 code only — avoid features from newer versions.
- Prioritize **readable, clean, maintainable** code over cleverness.
- Default to **immutability**, **dependency injection**, and **encapsulation**.
- Be direct and concise — no "Sure!", "You're right!" or similar phrases.

## ✅ Legacy / Existing Code Handling

- Do NOT refactor existing code solely to comply with these rules.
- Only modify existing code if directly related to the current change, bug fix, security, or explicitly requested.
- New or newly modified code MUST follow all rules in this document.

## ✅ Session Files

`agents/sessions/current.md` is an **agent work session file** that tracks progress,
decisions, and next steps for the current branch. It is committed intentionally so
that other developers or agents can pick up the work.

- **Draft PRs:** Do NOT comment on session files. The session is still active.
- **Ready-for-review PRs:** If `agents/sessions/current.md` exists in the diff,
  add a **single** general PR comment (not on a specific line):
  > ⚠️ `agents/sessions/current.md` should be deleted before merging.
  Only post this **once per PR** — do not duplicate it.
- Do NOT review the content of session files — they are not application code.

## ✅ Code Review Scope

- When reviewing code changes, **only review the actually modified lines** and their **direct dependencies**
- Do NOT review or suggest changes to unmodified code in the same file
- **Direct dependencies** include:
    - Functions or methods that are called by the modified code
    - Functions or methods that call the modified code
    - Classes or interfaces that are directly used or implemented by the modified code
    - Properties or constants that are directly accessed by the modified code
- **Do NOT review:**
    - Unmodified code in the same file that is not directly related to the change
    - Code style issues in unmodified lines
    - Architectural patterns in unmodified code
    - Other methods or functions in the same class that are not called by or calling the modified code
- **Example:**
    - If a single line in a 500-line file is changed, only review that line and its direct dependencies
    - Do NOT suggest improvements to the other 499 lines unless they are directly affected by the change

## ✅ Code Review Comment Behavior

### Before Creating a Comment

Before posting a new review comment, **always check the existing PR conversation first**:

1. **Check if you already commented on the same line or issue** — if a comment from you (Copilot) already
   exists for the same code location or the same concern, do NOT create a duplicate comment.
2. **Check if the issue was already discussed** — if another reviewer (human or bot) already raised the
   same point, do not repeat it.

### Handling Replies to Your Comments

When a developer has replied to one of your review comments:

- **If the developer accepted your suggestion:** Acknowledge briefly (e.g., "Looks good, thanks!") or
  resolve the conversation. Do NOT re-raise the same point.
- **If the developer rejected your suggestion with a reason:** Accept the decision. Do NOT re-post the
  same suggestion. If you believe the rejection is based on a misunderstanding, you may provide
  **one** follow-up with additional analysis — but respect the final decision.
- **If the developer asked a question:** Provide a helpful, concise answer with code examples if needed.
  Engage in a constructive discussion.
- **If the developer dismissed without explanation:** Do NOT re-raise the comment. Move on.

### Rules

- **Never create duplicate comments** — one comment per concern per location is enough.
- **Never re-raise rejected suggestions** — if the developer said no, accept it.
- **Engage constructively with replies** — answer questions, provide analysis, but don't argue.
- **Resolve conversations** when the issue is addressed or the discussion is concluded.
- **Prioritize actionable feedback** — avoid nitpicking on style issues that ECS/Rector will auto-fix.

## ✅ Language Rules

- All **code comments** must be written in **English**
- All **parameter names**, **variable names**, **method names**, and **class names** must be in **English**
- User-facing texts (labels, messages, validation messages) must be managed via **Laravel language files**
  (`lang/de/`, `lang/en/`) — never hardcode user-visible strings in PHP code
- For GitHub comments (PR reviews, issue discussions), provide bilingual comments:
    - Write the main comment in **English** first
    - Add a German translation below, prefixed with "🇩🇪 " or separated by a horizontal line

**Example for GitHub comments:**

> This change improves performance by reducing database queries.
>
> ---
>
> 🇩🇪 Diese Änderung verbessert die Performance durch Reduzierung der Datenbankabfragen.

## ✅ Package Management

- **Always use `composer require`/`composer remove`** — never manually edit `composer.json`
- Package managers resolve versions, handle conflicts, and update lock files automatically

## ✅ PHPStan Baseline

- **Do NOT add entries to `phpstan-baseline.neon`** — always fix the actual error. Last resort: inline `@phpstan-ignore` with reason.


## ✅ Known Issues

- When `is_string($var)` is used, Copilot often suggests adding `null !== $var`.
  This is incorrect. The `is_string()` function already ensures that the variable is of type string.
  Adding an additional null check is redundant and should not be done.
- Since Laravel 11, events and subscribers do not need to be manually registered
  in `AppServiceProvider` or `EventServiceProvider`.
  They are typically registered via event discovery configured in `bootstrap/app.php`.

