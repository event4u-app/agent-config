# Tippspiel adapter contract — declarative selector maps

An adapter is **data, not code**: a YAML file mapping a prediction-pool
platform's tip-form fields to CSS selectors. A generic, trusted Playwright
driver reads it and fills the inputs. Because adapters carry no executable
code, contributing one via PR is safe — there is no supply-chain surface to
audit beyond the selectors themselves.

One file per platform: `scripts/prediction-pool/adapters/<platform>.yml`.

## Required keys

| Key | Type | Meaning |
|---|---|---|
| `platform` | string | Stable id, matches the filename (`kicktipp`). |
| `match` | string | URL host (or substring) this adapter applies to. |
| `login_required` | bool | Always `true` — the user logs in; the driver never handles credentials. |
| `selectors.row` | string | CSS selector for one repeated **match row** on the tip page. |
| `selectors.home_input` | string | Within a row: the home-score input. |
| `selectors.away_input` | string | Within a row: the away-score input. |

## Optional keys

| Key | Type | Meaning |
|---|---|---|
| `tip_page_hint` | string | URL path pattern of the tip page (e.g. `/<pool>/tippabgabe`). |
| `selectors.home_team` / `selectors.away_team` | string | Within a row: team-name nodes, to align the right tip to the right match. |
| `selectors.bonus_*` | string | Selectors for bonus-question inputs. |
| `selectors.submit` | string | The submit control. **The driver NEVER clicks this** unless the user authorized submit this turn. |
| `notes` | string | Drift warnings, quirks, last-verified date. |

## Rules for adapters

- **No code.** YAML data only — no scripts, no JS, no URLs the driver
  fetches. Selectors and hints, nothing else.
- **`submit` is never auto-clicked.** It exists so the driver can *locate*
  (and, only on explicit authorization, click) the control — never by default.
- **Selectors drift.** If a row/input selector no longer matches at run
  time, the driver falls back to the **vision-assisted synthesis** path
  (screenshot → identify fields → user confirms) rather than guessing.
- **PR contributions** add exactly one `<platform>.yml` plus, ideally, a
  `notes:` line with the date the selectors were verified.
