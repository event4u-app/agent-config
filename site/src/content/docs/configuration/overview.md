---
title: The settings file
description: Agent Config reads one settings file in your home folder and an optional one per project — open them in the browser, read one value with its source or change it from the terminal.
---

Open your settings in the browser:

```bash
npx -y @event4u/agent-config config
```

## Where settings live

- **Your settings** — `~/.event4u/agent-config/settings/.agent-settings.yml`, written by the setup wizard. They apply in every project.
- **A project's settings** — an optional `.agent-settings.yml` in the repository, for values the whole team should share. Where a project sets a key, it wins for that project.

Some keys are only read from one of the two files. Ask which value is in effect and which file it came from:

```bash
agent-config settings:get personal.autonomy
```

The [template](https://github.com/event4u-app/agent-config/blob/main/src/config/agent-settings.template.yml) lists every key with a comment explaining it.

```yaml
# .agent-settings.yml (excerpt)
profile:
  id: developer
personal:
  autonomy: auto
cost:
  enforcement: advisory
```

## Three ways to change a setting

- **The browser** — `agent-config config` opens the settings page for your user; `agent-config config --project` for the project file. It validates every value before saving and keeps your comments.
- **The terminal** — `agent-config settings:set <key> <value>` changes one key in your user file. Settings that raise a spend ceiling or switch off a safety check refuse this route on purpose; change those in the browser or by hand.
- **By hand** — edit the YAML. Nothing checks it until you run `agent-config settings:check`.

## After an upgrade

```bash
agent-config settings:sync                   # add keys a new release introduced
agent-config settings:sync --prune-removed   # also drop keys a release retired
agent-config settings:check                  # validate the file; changes nothing
```

`agent-config upgrade` runs the first one for you.

## Next

- [Settings reference](/agent-config/configuration/settings-reference/) — the keys you are most likely to change.
- [The four profiles](/agent-config/configuration/profiles/) — four settings share the word "profile".
