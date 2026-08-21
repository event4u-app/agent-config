#!/usr/bin/env tsx
/**
 * Emit a roadmap skeleton that passes every roadmap gate unedited.
 *
 * WHY THIS EXISTS. Four authoring conventions are enforced by four different
 * gates and documented in prose an author has to already know to look for:
 *
 *   1. `complexity:` is a two-value enum — `lightweight` | `structural`.
 *      Measured 2026-08-20 across 88 roadmaps: six DIFFERENT invented values
 *      were in the tree (`bounded`, `medium`, `moderate`, `small`, `standard`),
 *      one of them on the active side and reddening the trunk, seven more in
 *      `later/` where the gate does not scan and which would red on the day
 *      they are reactivated.
 *   2. The acceptance heading is matched CASE-INSENSITIVELY and without an end
 *      anchor — one predicate, `_lib/ac_heading.ts`, shared by the R1 gate and
 *      the R2 dispatcher. It was not always: an end-anchored, case-sensitive
 *      copy made 10 of 22 roadmaps writing `Acceptance criteria` invisible to
 *      the extractor, and a third copy in `lint_plan_risk_register` kept both
 *      faults until 2026-08-20, hashing the empty string for 8 of the 32 ready
 *      roadmaps while the gate exited 0. The skeleton still emits the
 *      capitalised form: it is the shape every reader already recognises, and
 *      nothing now depends on the case.
 *   3. The Risk Register needs its `<!-- risk-review: … -->` marker as the
 *      first non-blank line of the section.
 *   4. `Risk type` is a two-value enum — `product` | `implementation`. The
 *      natural third word (`process`) hard-fails at pre-push.
 *
 * Every one of those is cheap to satisfy up front and costs a full gate round
 * to discover. This command satisfies them by construction.
 *
 * The skeleton is deliberately MINIMAL: one phase, one step, one risk row. It
 * is a starting point that is green, not a template to fill in blindly — the
 * content is the author's, the shape is not worth rediscovering.
 *
 * Usage:  ./scripts-run src/scripts/new_roadmap <slug> [--structural] [--stdout]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Today, as the risk-review marker wants it. */
function today(): string {
    return new Date().toISOString().slice(0, 10);
}

/** `road to X` from a kebab slug, for the H1. */
function titleOf(slug: string): string {
    return slug.replace(/-/g, ' ');
}

export function skeleton(slug: string, complexity: 'lightweight' | 'structural', date: string): string {
    return `---
complexity: ${complexity}
status: draft
execution:
  mode: phase-checkpoints
---
# Road to ${titleOf(slug)}

> **Source:** replace this with where the finding came from — a measurement, a
> review, an incident. A roadmap whose origin is not stated cannot be checked
> against it later.

## Goal

One paragraph: what is true when this is finished, phrased so someone else
could tell whether it happened.

## Phase 1 — <name the first coherent slice>

- [ ] **1.1 <the step, as an imperative>.** What changes, and why it is not
      already the case.
      verify: the check that proves it — a command, a test, an observable
      state. Never "looks right".

## Risk Register
<!-- risk-review: v1 | reviewed: ${date} | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | <the way this roadmap most plausibly fails> | implementation | What goes wrong, concretely | What makes it not happen, or what catches it | Phase 1 — <name the first coherent slice> |

## Acceptance Criteria

- [ ] AC-1 — <the residual state, not the activity>. Phrase it on what is true
      afterwards, so a step that ran but achieved nothing cannot satisfy it.
`;
}

function main(argv: readonly string[]): number {
    const args = argv.filter((a) => !a.startsWith('--'));
    const structural = argv.includes('--structural');
    const toStdout = argv.includes('--stdout');
    const slug = args[0];

    if (slug === undefined || slug.length === 0) {
        process.stderr.write(
            'usage: new_roadmap <slug> [--structural] [--stdout]\n' +
                '  <slug>        kebab-case, without the road-to- prefix\n' +
                '  --structural  tag structural instead of lightweight (no line/phase cap)\n' +
                '  --stdout      print instead of writing the file\n',
        );
        return 2;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
        process.stderr.write(`new_roadmap: slug must be kebab-case, got '${slug}'\n`);
        return 2;
    }

    const body = skeleton(slug, structural ? 'structural' : 'lightweight', today());
    if (toStdout) {
        process.stdout.write(body);
        return 0;
    }

    const rel = path.join('agents', 'roadmaps', `road-to-${slug}.md`);
    if (fs.existsSync(rel)) {
        process.stderr.write(`new_roadmap: ${rel} already exists — refusing to overwrite\n`);
        return 1;
    }
    fs.mkdirSync(path.dirname(rel), { recursive: true });
    fs.writeFileSync(rel, body, 'utf-8');
    process.stdout.write(
        `✅  wrote ${rel}\n` +
            '    It passes the roadmap gates as emitted. Adding a `### blocker:` entry or\n' +
            '    flipping status to `ready` grows the estate — check_estate_count wants the\n' +
            '    baseline raised with a reason in the same commit.\n',
    );
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(path.basename(process.argv[1]))) {
    process.exitCode = main(process.argv.slice(2));
}

export { main, titleOf, today };
