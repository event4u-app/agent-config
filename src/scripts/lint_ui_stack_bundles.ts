#!/usr/bin/env tsx
/**
 * Lint the UI-track verb → skill-bundle map.
 *
 * The stack-dispatched UI steps halt with a directive verb
 * (`ui-apply-<stack>` and friends). Those verbs are agent-interpreted, not
 * skill paths — only 2 of the engine's 11 literal verbs name a real skill — so
 * the mapping from verb to the skills that implement it is a separate fact.
 * It used to live only in a prose table in `docs/contracts/ui-track-flow.md`,
 * unverified, and two of its four rows were wrong: `vue` named the verb itself
 * (no skill at all) and `plain` — the fallback for every unrecognised project —
 * named `blade-ui`, a `packs: [laravel]` skill that a non-Laravel consumer does
 * not have installed.
 *
 * Two assertions, both decidable in this repo:
 *
 *   1. RESOLUTION — every bundle member is a real skill (`src/skills/<n>/SKILL.md`).
 *   2. PACK REACH — a lane declared `pack_agnostic` names only skills that ship
 *      in a stack-neutral pack. This is the assertion that actually matters: CI
 *      here cannot see a consumer's installed pack combination, so "the skill
 *      exists in our tree" would have passed the `plain → blade-ui` defect
 *      unchanged.
 *
 * Exit codes: 0 clean, 1 one or more findings.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    STACK_BUNDLES,
    type StackBundle,
    compose_bundle,
} from '../agent-src/templates/scripts/work_engine/directives/ui/stack_bundles.js';

const QUIET = process.argv.includes('--quiet');

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const SKILLS_DIR = path.join(REPO, 'src', 'skills');

/**
 * Packs that ship regardless of the project's framework. A `pack_agnostic`
 * lane may only draw on these — anything else is unavailable to some consumer.
 */
const STACK_NEUTRAL_PACKS: ReadonlySet<string> = new Set(['engineering-base', 'core', 'meta']);

const findings: string[] = [];

/**
 * Axis combinations the composition must satisfy.
 *
 * Not exhaustive over the cross-product — that would be thousands of
 * meaningless tuples. These are the shapes a real project produces, including
 * the ones no hand-written lane ever covered (Nuxt over Vue, Astro, Angular,
 * Livewire without Flux).
 */
const _AXIS_COMBOS: ReadonlyArray<Record<string, string>> = [
    { view: 'blade', reactivity: 'livewire', component_lib: 'flux', css: 'tailwind', meta: 'none' },
    { view: 'blade', reactivity: 'livewire', component_lib: 'none', css: 'tailwind', meta: 'none' },
    { view: 'blade', reactivity: 'alpine', component_lib: 'none', css: 'tailwind', meta: 'none' },
    { view: 'blade', reactivity: 'unknown', component_lib: 'none', css: 'none', meta: 'filament' },
    { view: 'jsx', reactivity: 'react', component_lib: 'radix', css: 'tailwind', meta: 'none' },
    { view: 'jsx', reactivity: 'react', component_lib: 'none', css: 'tailwind', meta: 'nextjs' },
    { view: 'vue-sfc', reactivity: 'vue', component_lib: 'none', css: 'none', meta: 'nuxt' },
    { view: 'svelte-sfc', reactivity: 'svelte', component_lib: 'none', css: 'none', meta: 'none' },
    { view: 'astro', reactivity: 'unknown', component_lib: 'none', css: 'none', meta: 'astro' },
    { view: 'angular-html', reactivity: 'angular', component_lib: 'none', css: 'none', meta: 'none' },
    { view: 'unknown', reactivity: 'htmx', component_lib: 'none', css: 'none', meta: 'none' },
    { view: 'none', reactivity: 'none', component_lib: 'none', css: 'tailwind', meta: 'none' },
];

function skill_path(name: string): string {
    return path.join(SKILLS_DIR, name, 'SKILL.md');
}

/** Return the `packs:` list from a skill's frontmatter, or `null` if absent. */
function packs_of(name: string): string[] | null {
    let text: string;
    try {
        text = fs.readFileSync(skill_path(name), { encoding: 'utf-8' });
    } catch {
        return null;
    }
    // Frontmatter only — a `packs:` mention in the body is not a declaration.
    const end = text.indexOf('\n---', 4);
    const front = end === -1 ? text : text.slice(0, end);
    // `[ \t]*`, not `\s*`: `\s` matches a newline, so the greedy form swallowed
    // the line break and captured the first block-list item as if it were an
    // inline value — which made every block-list skill parse as "no packs".
    const match = /^packs:[ \t]*(.*)$/m.exec(front);
    if (match === null) return null;
    const inline = (match[1] ?? '').trim();
    if (inline.startsWith('[')) {
        return inline
            .replace(/^\[|\]$/g, '')
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter((s) => s !== '');
    }
    // Block list: consume the `  - name` lines that follow. `match[0]` stops
    // before the newline, so the first split element is the empty tail of the
    // matched line itself — dropping it is required, not cosmetic: treating it
    // as a non-item ended the loop immediately and made every block-list skill
    // parse as "no packs", which is how this linter first shipped green against
    // the very defect it exists to catch.
    const rest = front.slice(match.index + match[0].length).split('\n').slice(1);
    const out: string[] = [];
    for (const line of rest) {
        const item = /^\s*-\s*(.+?)\s*$/.exec(line);
        if (item === null) break;
        out.push((item[1] ?? '').replace(/^['"]|['"]$/g, ''));
    }
    return out;
}

function check_lane(lane: string, bundle: StackBundle): void {
    const members = [...bundle.build, ...bundle.review];
    if (members.length === 0) {
        findings.push(`${lane}: bundle is empty — a lane must name at least one skill.`);
        return;
    }
    for (const name of new Set(members)) {
        // 1. RESOLUTION
        if (!fs.existsSync(skill_path(name))) {
            findings.push(
                `${lane}: bundle member \`${name}\` has no ` +
                    `\`src/skills/${name}/SKILL.md\` — the verb would resolve to nothing.`,
            );
            continue;
        }
        // 2. PACK REACH
        if (!bundle.pack_agnostic) continue;
        const packs = packs_of(name);
        if (packs === null) {
            findings.push(
                `${lane}: bundle member \`${name}\` declares no \`packs:\` — ` +
                    'a pack-agnostic lane cannot verify it ships everywhere.',
            );
            continue;
        }
        const offenders = packs.filter((p) => !STACK_NEUTRAL_PACKS.has(p));
        if (offenders.length > 0) {
            findings.push(
                `${lane}: lane is \`pack_agnostic\` but member \`${name}\` ships only in ` +
                    `[${offenders.join(', ')}] — a consumer without that pack gets nothing. ` +
                    'This is the `plain → blade-ui` defect class.',
            );
        }
    }
}

function main(): number {
    const lanes = Object.keys(STACK_BUNDLES).sort();
    if (lanes.length === 0) {
        process.stderr.write('lint-ui-stack-bundles: STACK_BUNDLES is empty — nothing to check.\n');
        return 1;
    }
    for (const lane of lanes) {
        check_lane(lane, STACK_BUNDLES[lane] as StackBundle);
    }

    // The composed shape, not just the hand-written lanes. Dispatch derives a
    // bundle from axes now, so a combination nobody wrote down by hand can
    // still be produced — and it has to satisfy the same two properties.
    for (const combo of _AXIS_COMBOS) {
        check_lane(`composed(${JSON.stringify(combo)})`, compose_bundle(combo));
    }

    // A lane usable as a fallback must be pack-agnostic, else the fallback
    // itself is the thing that fails for an unpredictable consumer.
    const plain = STACK_BUNDLES['plain'];
    if (plain === undefined) {
        findings.push('plain: missing — it is the documented DEFAULT_DIRECTIVE lane.');
    } else if (!plain.pack_agnostic) {
        findings.push(
            'plain: the fallback lane must be `pack_agnostic` — every unrecognised ' +
                'project lands here and its packs are unknown.',
        );
    }

    if (findings.length > 0) {
        for (const f of findings) {
            process.stdout.write(`lint-ui-stack-bundles: ${f}\n`);
        }
        process.stderr.write(
            `lint-ui-stack-bundles: ${findings.length} finding(s) across ${lanes.length} lane(s).\n`,
        );
        return 1;
    }
    if (!QUIET) {
        process.stdout.write(
            `lint-ui-stack-bundles: ${lanes.length} lane(s) clean — every bundle member ` +
                'resolves, and every pack-agnostic lane stays stack-neutral.\n',
        );
    }
    return 0;
}

process.exit(main());
