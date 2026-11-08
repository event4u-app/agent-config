<!-- evidence-type: analysis -->

# Step 1.3a: the host is not the cause, 2026-11-08

**Roadmap:** `road-to-routing-assurance-live-floors-carried` 1.3a.
**Protocol:** `agents/evidence/preregistration/routing-host-cause-13a-protocol-20261108.md`, committed before any run (`05f9a33f3e`).
**Rows:** `routing-host-cause-13a-{A,B}-{rsu,pac}-20261108.json` and their `-classified-` files. Each artefact names its host version.

**Conditions:** both hosts ran the five v2 cases from the same compiled plugin roots (catalogue `828f2e07…`, fixtures `d90aec2a` / `059d2030`), with `claude-opus-5-5` and three runs per case. Host A was 2.1.311, invoked through `npx` and not installed. Host B was 2.1.316. No run errored. The CLI estimated 3.26 + 1.68 USD for A and 3.52 + 1.72 USD for B.

## Result

| Unit | Host A 2.1.311 | Host B 2.1.316 | Pre-registered reading |
|---|---|---|---|
| `react-shadcn-ui` | 0/9 | 0/9 | **host is not the cause** (A ≤ one third) |
| `project-analysis-core` | 0/6 | 0/6 | **host is not the cause** (A ≤ one third) |

All four arms classify as REGRESSION. The traces have the same shape on both hosts. The `react-shadcn-ui` runs read the app and edit or write the components themselves. The `project-analysis-core` runs read the 20 files and answer directly. No run calls `Skill` or uses a subagent.

## What changes in the reading of 1.2

Step 1.2 concluded "the host" from one rerun. That rerun used the frozen baseline catalogue on today's host, with the original corpus prompts and an empty sandbox, where every miss asked for material. This comparison holds the catalogue and cases constant and changes only the host, and on these cases the host makes no difference. Together, the two runs no longer support one cause. On the v2 cases even the baseline host handles the requests directly. What fired on 2026-10-27 were the original corpus prompts, against the catalogue of that date.

## What this cannot show

This comparison used one model, three runs per case, and the v2 cases only. It does not separate the remaining candidates: the catalogue as it is today, and the difference between the original corpus prompts and realistic requests. Telling those apart would need the baseline catalogue on the baseline host with the v2 cases. That run was not registered here and was not done.
