// Tests for src/scripts/check_permission_deny_syntax.ts —
// road-to-a-project-contract-written-down Phase 2 (2.1).
//
// This gate's corpus is a typed constant, not a file tree, so there is no
// `--root` fixture seam a `_lib/gate_self_test.ts` `--self-test` could point
// at. These cases are the discrimination proof in its place: every rejecting
// shape the gate can report, beside the accepting one, so a green here means
// the reading changes the verdict rather than that the gate ran.
//
// The last four neutralise the RENDERER rather than the pin, because a review
// measured the first version of this gate staying green while `Read(...)` rows
// stopped being produced — the one thing its own comment claimed it covered.
//
// The AI council of 2026-10-13 (anthropic + openai, 2/2) required a provenance
// gate as the substitute for the plumbing ratification the hook-lowering table
// would have carried. A gate nothing proves discriminating would not have been
// that substitute.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkRow, main } from '../../src/scripts/check_permission_deny_syntax.js';
import type { HostPermissionSyntax } from '../../src/install/hostPermissionsAdapter.js';

const TODAY = '2026-10-13';

const GOOD: HostPermissionSyntax = {
    host: 'claude',
    docs_url: 'https://code.claude.com/docs/en/permissions.md',
    docs_at: '2026-10-13',
    expires: '2027-10-13',
    deny_key: 'permissions.deny',
    examples: ['Edit(docs/**)', 'Read(./secrets/**)', 'Bash(npm run build)', 'Bash(ls *)'],
};

function row(patch: Partial<HostPermissionSyntax>): HostPermissionSyntax {
    return { ...GOOD, ...patch };
}

describe('the accepting case', () => {
    it('passes a pin that is complete and current', () => {
        expect(checkRow(GOOD, TODAY)).toEqual([]);
    });

    it('passes the live pin through the real argv path', () => {
        expect(main(['--today', TODAY])).toBe(0);
    });
});

describe('the rejecting cases', () => {
    it('refuses a pin whose review date has passed', () => {
        expect(checkRow(GOOD, '2028-01-01').join(' ')).toContain('review date');
    });

    it('refuses a read date in the future by more than a day', () => {
        expect(checkRow(row({ docs_at: '2027-01-01' }), TODAY).join(' ')).toContain('future');
    });

    it('accepts a read date one day ahead, because docs_at is local and today is UTC', () => {
        expect(checkRow(row({ docs_at: '2026-10-14' }), TODAY)).toEqual([]);
    });

    it('refuses a docs_url that is not https', () => {
        expect(checkRow(row({ docs_url: 'http://example.test' }), TODAY).join(' ')).toContain(
            'https',
        );
    });

    it('refuses a review date that is not after the read date', () => {
        expect(checkRow(row({ expires: '2026-10-13' }), TODAY).join(' ')).toContain('not after');
    });

    it('refuses a pin with no recorded example', () => {
        expect(checkRow(row({ examples: [] }), TODAY).join(' ')).toContain('no example');
    });

    it('refuses an example that is not Tool(specifier)', () => {
        expect(checkRow(row({ examples: ['deny migrations/'] }), TODAY).join(' ')).toContain(
            'not Tool(specifier)',
        );
    });

    it('refuses a pin whose examples cannot account for a tool the renderer emits', () => {
        // The case the gate exists for: a renderer that started emitting a rule
        // shape no recorded reading of the documentation shows. Dropping `Bash`
        // from the examples while the fixtures still render commands is that
        // state, reached from the other side.
        const findings = checkRow(row({ examples: ['Edit(docs/**)', 'Read(./secrets/**)'] }), TODAY);
        expect(findings.join(' ')).toContain('which no recorded example shows');
    });

    it('refuses a host whose fixtures render nothing at all', () => {
        // A pin for a host the adapter does not know renders zero rules, which
        // would otherwise pass every assertion above by having nothing to check.
        expect(checkRow(row({ host: 'not-a-host' }), TODAY).join(' ')).toContain(
            'rendered no rule at all',
        );
    });

    it('exits non-zero through the real argv path when the pin has expired', () => {
        expect(main(['--today', '2028-01-01'])).toBe(1);
    });

    it('refuses a malformed --today rather than guessing one', () => {
        expect(main(['--today', 'yesterday'])).toBe(1);
    });
});

describe('a renderer that stops producing a shape is a finding', () => {
    afterEach(() => {
        vi.resetModules();
        vi.doUnmock('../../src/install/hostPermissionsAdapter.js');
    });

    /** The gate, re-imported with `denyRulesFor` filtered by `keep`. */
    async function gateWithout(drop: (rule: string) => boolean): Promise<number> {
        vi.resetModules();
        const real = await vi.importActual<
            typeof import('../../src/install/hostPermissionsAdapter.js')
        >('../../src/install/hostPermissionsAdapter.js');
        vi.doMock('../../src/install/hostPermissionsAdapter.js', () => ({
            ...real,
            denyRulesFor: (host: string, c: Parameters<typeof real.denyRulesFor>[1]) =>
                real.denyRulesFor(host, c).filter((r) => !drop(r)),
        }));
        const mod = await import('../../src/scripts/check_permission_deny_syntax.js');
        return mod.checkRow(GOOD, TODAY).length;
    }

    it('reds when no Read rule is produced', async () => {
        // Measured by a reviewer against the first version of this gate: the
        // same neutralisation left it green, because it only checked that SOME
        // rule was produced and that each produced rule's tool was recorded.
        expect(await gateWithout((r) => r.startsWith('Read('))).toBeGreaterThan(0);
    });

    it('reds when no Edit rule is produced', async () => {
        expect(await gateWithout((r) => r.startsWith('Edit('))).toBeGreaterThan(0);
    });

    it('reds when the with-arguments Bash row is dropped', async () => {
        expect(await gateWithout((r) => r.endsWith(' *)'))).toBeGreaterThan(0);
    });

    it('reds when the exact Bash row is dropped', async () => {
        expect(
            await gateWithout((r) => r.startsWith('Bash(') && !r.endsWith(' *)')),
        ).toBeGreaterThan(0);
    });
});
