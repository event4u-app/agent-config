/**
 * Which `pre_tool_use` guards are driven by a test, and which are not.
 *
 * road-to-defect-population-sweeps 2.2. The audit this replaces covered ONE
 * guard (`block-unauthorized-git`) and said nothing about the other fourteen,
 * which reads as completeness because absence and coverage look identical in a
 * list that only names what it covers.
 *
 * The posture is `check_enforcement_coverage`'s, applied to guards: an
 * UNCOVERED guard appears in the output AS uncovered. Omitting it would be the
 * defect. So this file has no green-only path — it always prints the roster.
 *
 * DERIVED, not frozen: the guard set comes from `hook_manifest.yaml`'s own
 * `pre_tool_use` role lists, unioned. A guard added there with no test reds the
 * roster assertion below rather than joining silently.
 *
 * WHAT "COVERED" MEANS HERE, precisely: some test imports the concern's own
 * entry-point module. It is a reachability measure, not a quality one — it says
 * a test drives this guard, never that the test is good. `design-slop` is the
 * worked example of the distinction it CAN see: three tests exercise its
 * detector library (`lint_design_slop.ts`) and none drives the hook wrapper, so
 * the decision path that actually runs in a session is untested. That is a real
 * gap, and it is why the measure is entry-point imports rather than "is the
 * word mentioned anywhere in tests/".
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src/scripts/hook_manifest.yaml');
const ROSTER = path.join(
    REPO_ROOT,
    'agents/evidence/analysis/pre-tool-use-guard-coverage-2026-09-04.md',
);

/** Union of every role's `pre_tool_use` list — the manifest is the truth source. */
export function preToolUseGuards(manifestText: string): string[] {
    const lists = [...manifestText.matchAll(/pre_tool_use:\s*\[([^\]]*)\]/g)].map((m) =>
        (m[1] as string)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
    );
    return [...new Set(lists.flat())].sort();
}

/** concern id → its `script:` path, read from the manifest's `concerns:` block. */
export function concernScripts(manifestText: string): Record<string, string> {
    const out: Record<string, string> = {};
    const block = manifestText.slice(manifestText.indexOf('\nconcerns:'));
    for (const m of block.matchAll(/^ {2}([a-z0-9-]+):\n(?:.*\n)*?\s*script:\s*(\S+)/gm)) {
        out[m[1] as string] = m[2] as string;
    }
    return out;
}

function testFiles(): string[] {
    const out: string[] = [];
    (function walk(d: string): void {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (p.endsWith('.ts')) out.push(p);
        }
    })(path.join(REPO_ROOT, 'tests'));
    return out;
}

describe('pre_tool_use guard coverage — the roster names every guard, covered or not', () => {
    const manifest = fs.readFileSync(MANIFEST, 'utf8');
    const guards = preToolUseGuards(manifest);
    const scripts = concernScripts(manifest);
    const corpus = testFiles().map((f) => [f, fs.readFileSync(f, 'utf8')] as const);

    it('the manifest still yields a non-empty guard set — a parse drift must not empty this check', () => {
        // Every assertion below is vacuously true over an empty set. This is the
        // floor that stops a regex drift from turning the whole file green.
        expect(guards.length, 'no pre_tool_use guards parsed out of the manifest').toBeGreaterThan(10);
        for (const g of guards) {
            expect(scripts[g], `concern \`${g}\` has no script: path in the manifest`).toBeDefined();
        }
    });

    it('the committed roster names every guard in the manifest', () => {
        const roster = fs.readFileSync(ROSTER, 'utf8');
        const missing = guards.filter((g) => !roster.includes(`\`${g}\``));
        expect(
            missing,
            'a guard joined the manifest without a roster row — an absent guard reads as a covered one',
        ).toEqual([]);
    });

    it('the roster records the right verdict for each guard', () => {
        const roster = fs.readFileSync(ROSTER, 'utf8');
        const wrong: string[] = [];
        for (const g of guards) {
            const base = path.basename(scripts[g] as string, '.ts');
            const driven = corpus.some(([, text]) => text.includes(`${base}.js`));
            const row = roster.split('\n').find((l) => l.includes(`\`${g}\``)) ?? '';
            const claimsCovered = /\|\s*covered\s*\|/.test(row);
            if (driven !== claimsCovered) {
                wrong.push(`${g}: measured ${driven ? 'covered' : 'UNCOVERED'}, roster says the opposite`);
            }
        }
        expect(wrong, 'the roster drifted from what the test corpus actually imports').toEqual([]);
    });

    it('is sensitive — a guard absent from the roster is reported', () => {
        const roster = fs.readFileSync(ROSTER, 'utf8');
        const sentinel = ['guard', 'nobody', 'listed'].join('-');
        expect([sentinel].filter((g) => !roster.includes(`\`${g}\``))).toEqual([sentinel]);
    });
});
