# Skill discovery — a 3-minute walkthrough

The package ships 220 skills. You do not need to know them. `/skills:discover`
turns the catalog into a short, **explained** shortlist for your role — every
row tells you *why* it is suggested, so you never adopt a skill on faith.

It is local-only: it reads the skill catalog, your role's shortlist, and (if
present) your local-analytics log. No network, no writes.

## 1. Run it for your role

```
/skills:discover sales
```

Or, with a role experience already active, just `/skills:discover` — it picks
up `roles.active_role` from `.agent-settings.yml`.

Under the hood the command runs:

```bash
python3 scripts/skill_discovery.py --role sales
```

## 2. Read the `why` column

The output is a table. The third column is the point — it names the **signal**
behind each suggestion, never a bare score:

```
| skill                  | class                   | why                                                       | first command            |
|------------------------|-------------------------|-----------------------------------------------------------|---------------------------|
| refine-prompt          | most-useful-for-role    | Tightens fuzzy buyer briefs before drafting               | Skill › refine-prompt     |
| voice-and-tone-design  | most-useful-for-role    | Locks the deal voice across customer + procurement        | Skill › voice-and-tone-design |
| competitive-positioning| most-useful-for-role    | Surfaces the ours-vs-theirs delta when a competitor named | Skill › competitive-positioning |
| activation-design      | related-to-current-task | same domain (product) as your sales core skills           | Skill › activation-design |
| customer-research      | recently-adopted        | from your role shortlist — no local usage signal yet      | Skill › customer-research |
| funnel-analysis        | popular-in-role         | from your role shortlist — no local usage signal yet      | Skill › funnel-analysis   |
```

The four classes:

- **most-useful-for-role** — your role's curated priority shortlist.
- **related-to-current-task** — same-domain peers you have not shortlisted yet.
- **recently-adopted** — what you actually used recently (from local analytics);
  on a fresh machine with no usage history it honestly says *"no local usage
  signal yet"* and falls back to your shortlist instead of inventing a number.
- **popular-in-role** — what your role launches most locally (same fallback).

## 3. Adopt one

Pick a row, read its `why`, and start with the `first command`. Unsure what a
skill will actually do before you commit? Preview it first:

```
/skill:preview competitive-positioning
```

That is the safe adoption loop: **discover → preview → run**.

## Notes

- **Local-only.** `/skills:discover` never touches the network and writes
  nothing. It reads the catalog, your role file, and the optional analytics log.
- **Analytics is optional.** Opt out with `AGENT_CONFIG_NO_LOCAL_ANALYTICS=1`
  or `analytics.local: off` in `.agent-settings.yml`. The two usage-driven
  classes then fall back to your role shortlist — the list is still useful, just
  without the personalised signal.
- **`--format json`** emits the same data machine-readably; **`--limit N`** sets
  how many results per class (default 5).
- Contract: [`skill-discovery`](../contracts/skill-discovery.md).
