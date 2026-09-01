/**
 * The BLOCKED QUICK-WIN bucket — `road-to-blocked-quickwin-visibility` 1.1/1.2.
 *
 * Two properties carry this suite, and they are separate on purpose.
 *
 * **Both directions of membership.** A stub with all three fields lands in the
 * bucket; a stub missing ANY ONE does not, and falls through unchanged. Asserting
 * only the positive would pass for a predicate that returns `true` always, which
 * is the tautology this repository has shipped before.
 *
 * **The existing JSON contract is untouched.** The bucket is additive. Every key
 * `counts` carried before keeps its name, its type and its meaning, and no
 * existing stub's classification moves. That is a condition of the change, not a
 * nicety: `headerFragment()` is imported by the dashboard
 * (`update_roadmap_progress.ts:74`), so a shifted classification is a dashboard
 * regression wearing a CLI diff.
 *
 * Tested against `src/agent-src/scripts/stubs_due.ts` — the implementation the
 * dispatcher actually runs. The sibling `src/scripts/stubs_due.ts` is a second,
 * older design reachable only through `./scripts-run`; which of the two is
 * canonical is an owner-reserved question this change does NOT settle.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    BLOCKED_QUICKWIN_FIELDS,
    counts,
    is_blocked_quickwin,
    scan_dir,
} from '../../src/agent-src/scripts/stubs_due.js';

let base: string;

const ALL_THREE: Record<string, string> = {
    design_validated: 'AI council 2026-08-24, 2/2 convergent',
    capability_gap: 'none',
    blocker_class: 'estate',
};

const write = (name: string, fields: Record<string, string>): void => {
    const front = Object.entries(fields)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    fs.writeFileSync(
        path.join(base, name),
        `---\ncomplexity: structural\nstatus: stub\nreview_by: 2099-01-01\n${front}\n---\n\n# Stub\n\nBody prose.\n`,
        'utf-8',
    );
};

beforeEach(() => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), 'stubs-quickwin-'));
});
afterEach(() => {
    fs.rmSync(base, { recursive: true, force: true });
});

describe('membership is pinned in BOTH directions', () => {
    it('a stub with all three fields lands in the bucket', () => {
        write('ready.md', ALL_THREE);
        const recs = scan_dir(base, '2026-09-01');
        expect(recs).toHaveLength(1);
        expect(recs[0]?.blocked_quickwin).toBe(true);
        expect(counts(recs).blocked_quickwin).toBe(1);
    });

    for (const missing of BLOCKED_QUICKWIN_FIELDS) {
        it(`a stub missing \`${missing}\` does NOT land in the bucket`, () => {
            const fields = { ...ALL_THREE };
            delete fields[missing];
            write('partial.md', fields);
            const recs = scan_dir(base, '2026-09-01');
            expect(recs).toHaveLength(1);
            expect(recs[0]?.blocked_quickwin).toBe(false);
            expect(counts(recs).blocked_quickwin).toBe(0);
        });
    }

    it('a `product` blocker is a different wait and is excluded', () => {
        write('product.md', { ...ALL_THREE, blocker_class: 'product' });
        expect(scan_dir(base, '2026-09-01')[0]?.blocked_quickwin).toBe(false);
    });

    it('a declared capability gap is excluded — the bucket is for work we can already do', () => {
        write('gap.md', { ...ALL_THREE, capability_gap: 'needs a live harness' });
        expect(scan_dir(base, '2026-09-01')[0]?.blocked_quickwin).toBe(false);
    });

    it('an empty `design_validated:` is absence, not validation', () => {
        expect(is_blocked_quickwin('', 'none', 'estate')).toBe(false);
    });

    it('`budget` qualifies alongside `estate` — both are authorization, not product', () => {
        expect(is_blocked_quickwin('measured', 'none', 'budget')).toBe(true);
    });

    /**
     * Each field is pinned INDIVIDUALLY, and the reason is a sabotage that came
     * back green. A single fixture with all three fields in the body proves only
     * that ONE of the three reads is scoped: `is_blocked_quickwin` short-circuits
     * on `design_validated`, so neutralising the `blocker_class` read alone could
     * not be detected. Two of the three assertions below would have passed for an
     * implementation that reads two fields from prose.
     */
    for (const inBody of BLOCKED_QUICKWIN_FIELDS) {
        it(`\`${inBody}\` in BODY PROSE does not count — it is read from frontmatter`, () => {
            const front = { ...ALL_THREE };
            delete front[inBody];
            const frontYaml = Object.entries(front)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n');
            fs.writeFileSync(
                path.join(base, 'prose.md'),
                `---\ncomplexity: structural\nreview_by: 2099-01-01\n${frontYaml}\n---\n\n` +
                    `${inBody}: ${ALL_THREE[inBody]}\n`,
                'utf-8',
            );
            expect(scan_dir(base, '2026-09-01')[0]?.blocked_quickwin).toBe(false);
        });
    }
});

describe('the existing JSON contract is additive-only', () => {
    it('every pre-existing `counts` key survives with its name and type', () => {
        write('ready.md', ALL_THREE);
        write('plain.md', {});
        const c = counts(scan_dir(base, '2026-09-01'));
        for (const key of ['overdue', 'owner_decisions', 'missing_review_by', 'total'] as const) {
            expect(c[key], `pre-existing key \`${key}\` must survive`).toBeTypeOf('number');
        }
        expect(c.total).toBe(2);
    });

    it('adding the bucket moves no existing classification', () => {
        write('ready.md', ALL_THREE);
        write('plain.md', {});
        const recs = scan_dir(base, '2026-09-01');
        // The quick-win stub is still counted in `total`, still not overdue, and
        // its owner-decision count is untouched by the new field.
        const ready = recs.find((r) => r.file.endsWith('ready.md'));
        expect(ready?.overdue).toBe(false);
        expect(ready?.owner_decisions).toBe(0);
        expect(counts(recs).total).toBe(2);
    });
});
