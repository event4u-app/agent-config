/**
 * The default (scoped) projection keeps every skill a surviving artefact
 * declares — road-to-skills-that-arrive-when-called 6.3, ADR-289 § Decision 2.
 *
 * Offline: the predicate is the installer's own, applied to the projected
 * tree, so no install runs.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    compute_active_pack_ids,
    declared_skill_closure,
    declared_skills,
    is_pruned_under_scoped,
    load_packs_registry,
    projected_command_files,
} from '../../src/scripts/_lib/scoped_projection.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SKILLS = path.join(REPO_ROOT, 'dist', 'agent-src', 'skills');

function skillFiles(): string[] {
    return fs
        .readdirSync(SKILLS)
        .sort()
        .map((d) => path.join(SKILLS, d, 'SKILL.md'))
        .filter((p) => fs.existsSync(p));
}

/** `declarer → declared` edges whose target exists and is pruned. */
function prunedEdges(kept: ReadonlySet<string>): string[] {
    const active = compute_active_pack_ids(load_packs_registry(REPO_ROOT), []);
    const skills = skillFiles();
    const byName = new Map(skills.map((p) => [path.basename(path.dirname(p)), p]));
    const edges: string[] = [];
    for (const p of [...skills, ...projected_command_files(REPO_ROOT)]) {
        if (is_pruned_under_scoped(p, active, kept)) continue;
        for (const name of declared_skills(p)) {
            const target = byName.get(name);
            if (target !== undefined && is_pruned_under_scoped(target, active, kept)) {
                edges.push(`${path.relative(REPO_ROOT, p)} -> ${name}`);
            }
        }
    }
    return edges;
}

describe('default projection — declared-dependency closure', () => {
    const active = compute_active_pack_ids(load_packs_registry(REPO_ROOT), []);
    const kept = declared_skill_closure([...skillFiles(), ...projected_command_files(REPO_ROOT)], active);

    it('without the closure the pack prune drops declared skills (the hole is real)', () => {
        const edges = prunedEdges(new Set());
        expect(edges.length).toBeGreaterThan(0);
        expect(edges.some((e) => e.endsWith('implement-ticket.md -> refine-ticket'))).toBe(true);
        expect(edges.some((e) => e.endsWith('implement-ticket.md -> feature-planning'))).toBe(true);
    });

    it('with the closure no surviving artefact declares a pruned skill', () => {
        expect(prunedEdges(kept)).toEqual([]);
    });

    it('keeps the two header cases by name', () => {
        expect(kept.has('refine-ticket')).toBe(true);
        expect(kept.has('feature-planning')).toBe(true);
        expect(is_pruned_under_scoped(path.join(SKILLS, 'refine-ticket', 'SKILL.md'), active, kept)).toBe(false);
        expect(is_pruned_under_scoped(path.join(SKILLS, 'feature-planning', 'SKILL.md'), active, kept)).toBe(false);
    });
});
