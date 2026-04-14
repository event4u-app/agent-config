---
type: "auto"
alwaysApply: false
description: "Laravel language files, translations, i18n, lang/de, lang/en, __() helper, localization, multilingual text"
source: package
---

# Laravel Language Files

## Key format — flat dot notation only

**Correct** (`lang/en/report.php`):
```php
return [
    'type.daily_report' => 'Daily Report',
    'type.care_report'  => 'Care Report',
];
```

**Wrong** — nested arrays forbidden:
```php
return [
    'type' => [
        'daily_report' => 'Daily Report',
        'care_report'  => 'Care Report',
    ],
];
```

## Both languages mandatory

Every key **must exist in both** `lang/de/` and `lang/en/`. Add to both simultaneously.
Missing translations = bug.

## Usage

```php
__('report.type.daily_report')
__('email.report.created.subject', ['number' => $number])
```

Never hardcode user-visible strings — always use language files.
