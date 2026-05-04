---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Laravel language files, translations, i18n, lang/de, lang/en, __() helper, localization, multilingual text"
source: package
---

# Laravel Language Files

## Key format — always inline (dot notation)

Language lines **must always use flat dot-notation keys**. Never use nested arrays.

**Correct** (`lang/en/report.php`):
```php
return [
    'type.daily_report' => 'Daily Report',
    'type.care_report'  => 'Care Report',
];
```

**Wrong** — nested arrays are forbidden:
```php
return [
    'type' => [
        'daily_report' => 'Daily Report',
        'care_report'  => 'Care Report',
    ],
];
```

## Both languages are mandatory

Every language line **must exist in both** `lang/de/` and `lang/en/`.
When you add a key to one file, immediately add the translated key to the other.

Missing translations are a bug — the app ships to both German and English users.

## Referencing language lines

Use the `__()` helper with the dot-notation key:

```php
__('report.type.daily_report')
__('email.report.created.subject', ['number' => $number])
```

Never hardcode user-visible strings in PHP — always use language files.
