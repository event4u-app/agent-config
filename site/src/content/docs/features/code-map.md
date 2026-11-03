---
title: "Code map: see who calls what before you change it"
description: agent-config code-graph map draws a local map of your codebase — callers, impact, tests for a change, data, interfaces and delivery — as a page you open in the browser.
---

Draw a map of the repository you are standing in and open it:

```bash
npx -y @event4u/agent-config code-graph map --open
```

[**Open the demo map →**](/agent-config/demo-map/) — drawn from a sample project, so you can click around before installing. It is sample data, not your code.

## What it does

`code-graph` builds a local index of your codebase, and `map` draws it: an `index.html` you open in the browser, a `MAP.md` your agent reads, and one page per area of the code. The map goes into `agents/map/` when the repository already has an `agents/` folder (for example after `agent-config init --project`), and otherwise into `~/.event4u/agent-config/map/`, so mapping a repository writes nothing into it. `map` prints where it wrote. Besides who calls what, it reads — from files only — your migrations and schema files, outbound calls and API contracts, Docker and Terraform setup, CI pipelines and which files change together in git history.

In your AI tool, `/project:map` draws the same map and points the agent at it.

## What it looks like

All captures below come from the demo map's sample project, not from a real codebase.

![The code graph: areas of the sample project as bubbles; selecting a file lights up every area it reaches; the blast-radius panel counts 60 direct and 480 transitive dependents](/agent-config/media/code-map/demo-graph-blast.webp)

![The data view: an entity-relationship diagram of the saved schema, with one finding selected — a code relation without a foreign key — its evidence and a suggested check](/agent-config/media/code-map/demo-erd.webp)

![The dependency matrix: links between 15 areas of the sample project, one row per area](/agent-config/media/code-map/demo-matrix.webp)

![The knowledge view: one file next to the tests, contracts and decision records that point at it](/agent-config/media/code-map/demo-knowledge.webp)

![A file with no callers: the detail panel shows its commit history, a dead-code marker and a blast radius of 0](/agent-config/media/code-map/demo-history.webp)

<video src="/agent-config/media/code-map/demo-tour.mp4" controls muted playsinline preload="metadata" aria-label="A short tour through the demo map"></video>

## When to use it

- Before a change you are not sure about: `agent-config code-graph impact --diff main` lists the callers, dependents and test files a diff can break.
- To find the tests for a symbol: `agent-config code-graph tests-for <symbol>`.
- When you join a codebase and want the shape of it in one page.

## Example

```bash
agent-config code-graph ask "who calls createInvoice"
agent-config code-graph tests-for createInvoice
```

`ask` takes one question in words and answers with the symbols and files it names, their callers and their tests.

## What it needs

- Nothing beyond the install: no API key, no database connection, no running service, and no network unless you add `--prs` to read open pull requests through `gh`. It reads files in your repository.
- A browser to view the map.

## Limits

- An index is a pointer, not the truth: the agent confirms what it found in the source before it acts on it, and a text search finds what the index missed.
- It reads files only. Observed state such as a live database schema enters only if you save a dump into the map's `data/` folder yourself.
- An area with no facts says "no data yet" and why, rather than being hidden.
