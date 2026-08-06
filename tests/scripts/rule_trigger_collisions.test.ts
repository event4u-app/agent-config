/**
 * Routing-collision gate for rule trigger sets.
 *
 * The disjointness question — "do two rules fire on the same words?" — was
 * asserted in prose and checked by nothing. Measured 2026-08-02: four overlap
 * tools exist and **none** compares `triggers:` frontmatter across
 * `src/rules/*.md`. `audit_overlap.ts` compares descriptions + path prefixes
 * (report-only); `audit_skill_overlap.ts` compares skill *bodies*;
 * `skill_overlap.ts` is trigger-aware but roots at a container ADR-051 retired,
 * so it scans nothing; `lint_rule_interactions.ts` validates precedence
 * relations, not overlap.
 *
 * One failure, deterministic:
 *
 *   SATURATION — a pair's trigger-set Jaccard similarity is at or above
 *                THRESHOLD. Two rules competing for the same prompts with no
 *                recorded reason is the "principle soup" failure: the agent
 *                gets both and no resolution order.
 *
 * Waivable through ALLOWLIST, which needs a real reason per entry. The cap is
 * deliberate: crossing it means the threshold is wrong, not that the corpus
 * needs one more exception (same stance as the skill-overlap allowlist).
 *
 * A SUBSET CHECK WAS BUILT AND REMOVED, on purpose. "Rule A's whole trigger set
 * is inside rule B's" sounds like the shape a redundant rule takes, and the
 * first run flagged one real pair: `improve-before-implement`'s
 * {implement, migration, refactor} is a strict subset of
 * `senior-engineering-discipline`'s. That pair is not a defect — both rules
 * SHOULD fire on those prompts, because their obligations are disjoint (a
 * pre-implementation demand gate vs. the invisible-cross-cutting-controls
 * checklist). Co-firing is the router working. The defect the roadmap actually
 * named is a *duplicate obligation*, and the obligation half is not
 * machine-checkable — so a subset gate can only see the harmless half and
 * fires on it. It was dropped rather than waived: an allowlist entry would have
 * been the gate tuned around its own false positive, which is how a linter
 * starts training people to ignore it.
 *
 * Baseline when this gate landed: 94 rules carry triggers, 50 pairs share at
 * least one trigger, and the worst pair scores 0.375
 * (improve-before-implement × senior-engineering-discipline, sharing
 * refactor|implement|migration). The threshold sits above that measured worst
 * case, so the gate is green on the corpus it was written against and fires on
 * anything worse — a ratchet, not a retro-fit.
 */

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const RULES_DIR = path.join(REPO_ROOT, 'src', 'rules');

/** Pairs at or above this trigger-set Jaccard similarity fail without a waiver. */
const THRESHOLD = 0.4;

/** Crossing this many waivers means the threshold is wrong. */
const ALLOWLIST_CAP = 10;

/**
 * Reviewed collisions. Key is `a::b` with the two rule slugs sorted.
 * A entry needs a real reason — a pair is here because a human read both rules
 * and decided the overlap is structural.
 */
const ALLOWLIST: Record<string, string> = {};

interface RuleTriggers {
    slug: string;
    triggers: Set<string>;
    /**
     * Trigger VALUES this rule has dispositioned in frontmatter, via
     * `collision_ok:` or `precedence:`.
     *
     * Read here so this gate and `lint_trigger_collisions` stop disagreeing. That
     * linter already requires a per-value disposition on EVERY sharer, so a pair
     * whose shared values are dispositioned on both sides has by construction had
     * "a human read both rules and decided the overlap is structural" — which is
     * verbatim what the ALLOWLIST below asks for. Recording the same decision in
     * a test constant as well would be a second source of truth for one
     * judgement, i.e. a new drift source.
     */
    dispositioned: Set<string>;
}

function parseTriggers(): RuleTriggers[] {
    const out: RuleTriggers[] = [];
    for (const file of fs.readdirSync(RULES_DIR).sort()) {
        if (!file.endsWith('.md')) continue;
        const raw = fs.readFileSync(path.join(RULES_DIR, file), 'utf-8');
        const fm = raw.match(/^---\n([\s\S]*?)\n---/);
        if (!fm?.[1]) continue;
        const triggers = new Set<string>();
        const dispositioned = new Set<string>();
        let inTriggers = false;
        let inDisposition = false;
        for (const line of fm[1].split('\n')) {
            if (/^triggers:\s*$/.test(line)) {
                inTriggers = true;
                inDisposition = false;
                continue;
            }
            if (/^(collision_ok|precedence):\s*$/.test(line)) {
                inDisposition = true;
                inTriggers = false;
                continue;
            }
            // A non-indented, non-list line ends either block.
            if (/^\S/.test(line)) {
                inTriggers = false;
                inDisposition = false;
            }
            if (inDisposition) {
                const d = line.match(/^\s*"?([^":]+?)"?\s*:\s*\S/);
                if (d?.[1]) dispositioned.add(d[1].trim().toLowerCase());
                continue;
            }
            if (!inTriggers) continue;
            const m = line.match(/^\s*-\s*(keyword|phrase):\s*"?([^"]+?)"?\s*$/);
            if (m?.[2]) triggers.add(m[2].trim().toLowerCase());
        }
        if (triggers.size > 0) {
            out.push({ slug: file.replace(/\.md$/, ''), triggers, dispositioned });
        }
    }
    return out;
}

function pairKey(a: string, b: string): string {
    return [a, b].sort().join('::');
}

function jaccard(a: Set<string>, b: Set<string>): number {
    const shared = [...a].filter((x) => b.has(x)).length;
    if (shared === 0) return 0;
    return shared / new Set([...a, ...b]).size;
}

/** Every unreviewed pair at or above THRESHOLD, formatted for the failure message. */
function findCollisions(rules: RuleTriggers[]): string[] {
    const offenders: string[] = [];
    for (let i = 0; i < rules.length; i += 1) {
        const a = rules[i]!;
        for (let j = i + 1; j < rules.length; j += 1) {
            const b = rules[j]!;
            const score = jaccard(a.triggers, b.triggers);
            if (score < THRESHOLD) continue;
            if (ALLOWLIST[pairKey(a.slug, b.slug)]) continue;
            const sharedValues = [...a.triggers].filter((t) => b.triggers.has(t)).sort();
            // Dispositioned on BOTH sides = the decision `lint_trigger_collisions`
            // already demands. One-sided is NOT enough: that linter fails a pair
            // where only one sharer wrote the reason, and so does this.
            if (
                sharedValues.every((v) => a.dispositioned.has(v) && b.dispositioned.has(v))
            ) {
                continue;
            }
            const shared = sharedValues.join('|');
            offenders.push(`${a.slug} × ${b.slug} = ${score.toFixed(3)} (shared: ${shared})`);
        }
    }
    return offenders;
}

describe('rule trigger collisions', () => {
    const rules = parseTriggers();

    it('parses a non-trivial corpus (guards against a dead scan scope)', () => {
        // A gate that scans nothing exits green. This is the floor that makes
        // the two checks below meaningful at all.
        expect(rules.length).toBeGreaterThan(50);
        expect(rules.some((r) => r.slug === 'minimal-safe-diff')).toBe(true);
    });

    it(`has no unreviewed trigger-set overlap at or above ${THRESHOLD}`, () => {
        const offenders = findCollisions(rules);
        expect(offenders, offenders.join('\n')).toEqual([]);
    });

    it('would fail if a colliding rule were added (mutation self-test)', () => {
        // A gate nobody has seen fail is a gate nobody knows works. Inject a
        // rule that clones an existing trigger set and assert the same
        // function that returns [] above returns a finding here.
        const victim = rules.find((r) => r.slug === 'minimal-safe-diff');
        expect(victim).toBeDefined();
        const mutated = [
            ...rules,
            // No dispositions on the clone — an UNreviewed overlap is exactly
            // what this gate must catch, and it is what makes the mutation
            // meaningful now that a dispositioned pair is skipped.
            {
                slug: 'zz-synthetic-clone',
                triggers: new Set(victim!.triggers),
                dispositioned: new Set<string>(),
            },
        ];
        const offenders = findCollisions(mutated);
        expect(offenders.some((o) => o.includes('zz-synthetic-clone'))).toBe(true);
    });

    it('keeps the waiver list under its cap', () => {
        // Past the cap the threshold is wrong, not the corpus.
        expect(Object.keys(ALLOWLIST).length).toBeLessThanOrEqual(ALLOWLIST_CAP);
        for (const [key, reason] of Object.entries(ALLOWLIST)) {
            expect(reason.trim().length, `${key} needs a real reason`).toBeGreaterThan(20);
        }
    });
});
