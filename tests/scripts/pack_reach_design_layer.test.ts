/**
 * Install-shape reach for the design layer.
 *
 * The defect this pins: a consumer who installs only `laravel` or only
 * `react` received the UI executors from that pack and `fe-design` from
 * `engineering-base`, but neither `design-intelligence` (the corpus
 * `fe-design` told them to query first) nor the `design-fidelity` rule —
 * both live in `frontend-design`, and nothing linked the packs. The only
 * edge pointed the wrong way (`frontend-design suggests react`), and
 * `suggests` is advisory and never auto-installed.
 *
 * These assertions are about the install SHAPE, not about content: what a
 * given pack selection can actually reach.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PACKS_YML = path.join(REPO_ROOT, 'src', 'config', 'discovery', 'packs.yml');

interface Pack {
    readonly id: string;
    readonly requires?: string[];
    readonly suggests?: string[];
}

const PACKS: Pack[] = parseYaml(fs.readFileSync(PACKS_YML, { encoding: 'utf-8' })) as Pack[];
const BY_ID = new Map(PACKS.map((p) => [p.id, p]));

/** Transitive `requires` closure — what installing `id` actually pulls in. */
function closure(id: string): Set<string> {
    const seen = new Set<string>();
    const stack = [id];
    while (stack.length > 0) {
        const current = stack.pop() as string;
        if (seen.has(current)) continue;
        seen.add(current);
        for (const dep of BY_ID.get(current)?.requires ?? []) {
            stack.push(dep);
        }
    }
    return seen;
}

/** `packs:` list from an artifact's frontmatter. */
function packsOf(relPath: string): string[] {
    const text = fs.readFileSync(path.join(REPO_ROOT, relPath), { encoding: 'utf-8' });
    const end = text.indexOf('\n---', 4);
    const front = end === -1 ? text : text.slice(0, end);
    const match = /^packs:[ \t]*\[(.*)\]$/m.exec(front);
    if (match !== null) {
        return (match[1] ?? '')
            .split(',')
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter((s) => s !== '');
    }
    const block = /^packs:[ \t]*$/m.exec(front);
    if (block === null) return [];
    const rest = front.slice(block.index + block[0].length).split('\n').slice(1);
    const out: string[] = [];
    for (const line of rest) {
        const item = /^\s*-\s*(.+?)\s*$/.exec(line);
        if (item === null) break;
        out.push((item[1] ?? '').replace(/^['"]|['"]$/g, ''));
    }
    return out;
}

const FRAMEWORK_ONLY_INSTALLS = ['laravel', 'react'] as const;

describe('design-layer reach per install shape', () => {
    for (const pack of FRAMEWORK_ONLY_INSTALLS) {
        it(`\`${pack}\` alone reaches the design-fidelity rule`, () => {
            const reach = closure(pack);
            const rulePacks = packsOf('src/rules/design-fidelity.md');
            expect(rulePacks.length).toBeGreaterThan(0);
            // The rule is framework-neutral discipline — honour a provided
            // design — with no corpus dependency, so it belongs in the base
            // pack rather than behind the design pack alone.
            expect(
                rulePacks.some((p) => reach.has(p)),
                `design-fidelity packs=[${rulePacks.join(', ')}] unreachable from ${pack}`,
            ).toBe(true);
        });

        it(`\`${pack}\` alone reaches fe-design`, () => {
            const reach = closure(pack);
            const skillPacks = packsOf('src/skills/fe-design/SKILL.md');
            expect(skillPacks.some((p) => reach.has(p))).toBe(true);
        });

        it(`\`${pack}\` alone does NOT silently reach the corpus`, () => {
            // Asserting the gap on purpose. `design-intelligence` is a
            // deliberately optional weight; what must not happen is a skill
            // presenting an ungrounded pick as grounded, which is why the
            // next assertion exists.
            const reach = closure(pack);
            const corpusPacks = packsOf('src/skills/design-intelligence/SKILL.md');
            expect(corpusPacks.some((p) => reach.has(p))).toBe(false);
        });

        it(`\`${pack}\` is offered the design pack as a companion`, () => {
            expect(BY_ID.get(pack)?.suggests ?? []).toContain('frontend-design');
        });
    }

    it('fe-design documents the corpus as conditional, not assumed', () => {
        // The broken dependency was `fe-design` instructing "run the corpus
        // query first" with no branch for the corpus being absent. A missing
        // pack must not be recorded as an evidence gap.
        const body = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'skills', 'fe-design', 'SKILL.md'),
            { encoding: 'utf-8' },
        );
        expect(body).toContain('When the corpus is not installed');
        expect(body).toContain('not installed, so no');
    });
});
