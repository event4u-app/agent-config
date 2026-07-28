# Tier-1 audit-package comparison — history-discipline Phase 3

> Source-level comparison (fresh clones, 2026-07-27) per
> `road-to-scale-and-history-discipline` Phase 3: pick ONE Laravel Tier-1
> reference implementation; document the loser and why. Both packages are
> integration recommendations (consumer-installed), so naming them is fine
> per `source-confidentiality`.

| Axis | spatie/laravel-activitylog | owen-it/laravel-auditing |
|---|---|---|
| Maintenance (last commit at sweep) | 2026-06-26; Laravel `^12 \|\| ^13` | 2026-07-17 (slightly fresher) |
| Shipped schema | `id`, indexed `log_name`, `nullableMorphs(subject)`, `nullableMorphs(causer)`, `json attribute_changes` + `json properties`, timestamps | `bigIncrements`, `morphs(auditable)`, user morph + composite `(user_id, user_type)` index, `text old_values/new_values`, `url`, `ip_address`, `user_agent`, `tags` |
| R-B3 hygiene fit (diff, not full row) | JSON diff columns by design | TEXT old/new value dumps (fuller rows) |
| R-A7 growth-budget fit | **First-class age-based retention**: `activitylog:clean` command + `delete_records_older_than_days` config — schedule it and the retention declaration is real | Per-model record-count `prune()` via `audit_threshold` — workable but count-based, not age-based |
| Forensic depth | subject + causer + properties | richer: URL, IP, user agent, tags |

## Decision

**Default Tier-1 reference: spatie/laravel-activitylog.** The two
interlocks that make history *safe* (R-A7 growth budget, R-B3 diff-based
hygiene) are first-class there: an age-based clean command the scheduler can
own, and JSON diff columns instead of full-row text dumps.

**Documented alternative (the "loser" and why it still exists):**
owen-it/laravel-auditing — pick it when the audit requirement is forensic
(who, from which IP, via which URL/user agent) or when per-model
record-count pruning matches the domain better. It loses the default slot
because its growth control is count-based (age-based retention is what
R-A7 declarations and jurisdictional retention floors speak) and its
old/new TEXT dumps duplicate rows harder than diffs.

TS reference stays the thin custom audit-table pattern (no dependency),
per the roadmap architecture.
