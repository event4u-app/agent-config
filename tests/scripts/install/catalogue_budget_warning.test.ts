/**
 * The deploy-time catalogue-budget warning.
 *
 * The two properties worth pinning are opposites, and only having both makes
 * the warning trustworthy: it fires for a host whose truncation was MEASURED,
 * and it is silent for every host that was not. A warning that fired on an
 * unmeasured host would be inventing a limit, which is the exact failure the
 * roadmap behind this feature named as its own Non-goal.
 */
import { describe, expect, it } from 'vitest';

import { catalogue_budget_warning } from '../../../src/scripts/install.js';

/** `n` distinct skill entries, in the path shape a real deploy writes. */
function skillPaths(n: number): string[] {
    const out: string[] = [];
    for (let i = 0; i < n; i += 1) {
        out.push(`/home/u/.codex/skills/skill-${i}/SKILL.md`);
        // A second file under the same skill must NOT count twice — a skill is
        // one catalogue entry however many references it ships.
        out.push(`/home/u/.codex/skills/skill-${i}/references/notes.md`);
    }
    return out;
}

describe('catalogue_budget_warning', () => {
    it('is silent for a host nobody has measured — no invented number', () => {
        expect(catalogue_budget_warning('claude-code', skillPaths(5000))).toBeNull();
        expect(catalogue_budget_warning('gemini-cli', skillPaths(5000))).toBeNull();
        expect(catalogue_budget_warning('trae', skillPaths(5000))).toBeNull();
    });

    it('is silent for a measured host under the observed survivor count', () => {
        expect(catalogue_budget_warning('codex', skillPaths(10))).toBeNull();
    });

    it('fires for a measured host over it, naming the count and the measurement date', () => {
        const msg = catalogue_budget_warning('codex', skillPaths(400));
        expect(msg).not.toBeNull();
        expect(msg).toContain('400 catalogue entries');
        expect(msg).toContain('2026-08-15');
        // It must read as an observation, never as a published cap.
        expect(msg).toContain('survived');
    });

    it('counts entries, not files — a multi-file skill is one entry', () => {
        // 400 skills × 2 files each. A file count would read 800 and overstate
        // the estate against a survivor count measured in entries.
        const msg = catalogue_budget_warning('codex', skillPaths(400));
        expect(msg).toContain('400 catalogue entries');
        expect(msg).not.toContain('800');
    });

    it('counts command bodies as entries too — the host budget spans both', () => {
        const paths = [
            ...skillPaths(60),
            ...Array.from({ length: 60 }, (_, i) => `/home/u/.codex/commands/group/cmd-${i}.md`),
        ];
        // 60 + 60 = 120 > 104, so the pair crossing the line is what fires it;
        // neither half would on its own.
        expect(catalogue_budget_warning('codex', skillPaths(60))).toBeNull();
        expect(catalogue_budget_warning('codex', paths)).toContain('120 catalogue entries');
    });
});
