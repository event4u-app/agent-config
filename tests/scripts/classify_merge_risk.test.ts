import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    classifyChanges,
    DELETION_THRESHOLD,
    main,
    parseNameStatus,
    type ChangeEntry,
} from '../../src/scripts/classify_merge_risk.js';

/**
 * Both directions are pinned. A classifier that only proves it can say
 * `needs-council` would certify one that says it for everything, and every
 * routine PR would then wait on a council it did not need — the cost ADR-282
 * exists to remove. So each trigger has a near-miss that must stay routine.
 */

const everyDirExists = (): boolean => true;
const noDirExists = (): boolean => false;

function ids(entries: ChangeEntry[], dirExists: (d: string) => boolean = everyDirExists): string[] {
    return classifyChanges(entries, { dirExistsInHead: dirExists }).triggers.map((t) => t.id);
}

const mod = (p: string): ChangeEntry => ({ status: 'M', path: p });
const del = (p: string): ChangeEntry => ({ status: 'D', path: p });

describe('routine — the near-misses that must not reach the council', () => {
    it('a docs and skill edit is routine', () => {
        const r = classifyChanges([mod('docs/guide.md'), mod('src/skills/token-optimizer/SKILL.md')], {
            dirExistsInHead: everyDirExists,
        });
        expect(r.verdict).toBe('routine');
        expect(r.triggers).toEqual([]);
    });

    it('prose ABOUT a sensitive topic is not the sensitive surface', () => {
        expect(ids([mod('src/skills/secrets-management/SKILL.md'), mod('src/skills/terraform/SKILL.md')])).toEqual([]);
    });

    it('a token that merely starts with a sensitive word does not match', () => {
        expect(ids([mod('src/scripts/authoring_helpers.ts'), mod('src/skills/laravel-migration/helper.ts')])).toEqual([]);
    });

    it('a non-kernel rule is not a governance surface', () => {
        expect(ids([mod('src/rules/tool-safety.md')])).toEqual([]);
    });

    it(`${DELETION_THRESHOLD - 1} deleted files under a surviving directory stay routine`, () => {
        const files = Array.from({ length: DELETION_THRESHOLD - 1 }, (_, i) => del(`docs/old/f${i}.md`));
        expect(ids(files, everyDirExists)).toEqual([]);
    });
});

describe('needs-council — one trigger per Hard-Floor and security surface', () => {
    it(`${DELETION_THRESHOLD} deleted files is a bulk deletion`, () => {
        const files = Array.from({ length: DELETION_THRESHOLD }, (_, i) => del(`docs/old/f${i}.md`));
        expect(ids(files)).toContain('bulk-deletion');
    });

    it('a deleted file whose directory no longer exists in the head is a removed directory', () => {
        expect(ids([del('legacy/thing/a.ts')], noDirExists)).toContain('removed-directory');
    });

    it('infrastructure as code is flagged', () => {
        expect(ids([mod('infra/main.tf')])).toContain('infra-config');
        expect(ids([mod('deploy/k8s/service.yaml')])).toContain('infra-config');
        expect(ids([mod('Pulumi.prod.yaml')])).toContain('infra-config');
    });

    it('migrations and production data are flagged', () => {
        expect(ids([mod('database/migrations/2026_10_07_000000_drop_users.php')])).toContain('prod-data-or-migration');
        expect(ids([mod('config/production/db.yml')])).toContain('prod-data-or-migration');
    });

    it('deploy and release paths are flagged', () => {
        expect(ids([mod('src/scripts/release_notes.ts')])).toContain('deploy-or-release');
    });

    it('any CI workflow edit is flagged — a weakened required check makes green meaningless', () => {
        expect(ids([mod('.github/workflows/tests.yml')])).toContain('ci-workflow');
    });

    it('security-sensitive-stop surfaces are flagged', () => {
        expect(ids([mod('app/Http/Middleware/Authenticate.php')])).toContain('security-surface');
        expect(ids([mod('src/billing/invoice.ts')])).toContain('security-surface');
        expect(ids([mod('app/Webhooks/StripeHandler.php')])).toContain('security-surface');
        expect(ids([mod('src/tenancy/scope.ts')])).toContain('security-surface');
        expect(ids([mod('.env.production')])).toContain('security-surface');
        expect(ids([mod('routes/api.php')])).toContain('security-surface');
    });

    it('a kernel rule is a governance surface, via the ratification detector', () => {
        expect(ids([mod('src/rules/non-destructive-by-default.md')])).toContain('governance-surface');
    });

    it('the merge-authority surface itself cannot be loosened as a routine PR', () => {
        expect(ids([mod('src/scripts/classify_merge_risk.ts')])).toContain('merge-authority-surface');
        expect(ids([mod('src/domains/git/pr/merge/command.md')])).toContain('merge-authority-surface');
        expect(ids([mod('docs/decisions/ADR-282-auto-merge-authority-with-a-council-danger-gate.md')])).toContain(
            'merge-authority-surface',
        );
    });

    it('a rename is judged by BOTH sides', () => {
        expect(ids([{ status: 'R', oldPath: 'src/auth/login.ts', path: 'src/misc/thing.ts' }])).toContain(
            'security-surface',
        );
    });

    it('every trigger names the paths that fired it', () => {
        const r = classifyChanges([mod('infra/main.tf'), mod('docs/x.md')], { dirExistsInHead: everyDirExists });
        expect(r.verdict).toBe('needs-council');
        expect(r.triggers[0]?.paths).toEqual(['infra/main.tf']);
        expect(r.triggers[0]?.rule).not.toBe('');
    });
});

describe('parseNameStatus', () => {
    it('reads modify, delete and scored rename lines', () => {
        expect(parseNameStatus('M\ta.ts\nD\tb.ts\nR087\told.ts\tnew.ts\n')).toEqual([
            { status: 'M', path: 'a.ts' },
            { status: 'D', path: 'b.ts' },
            { status: 'R', oldPath: 'old.ts', path: 'new.ts' },
        ]);
    });

    it('refuses a line it cannot read rather than skipping it', () => {
        expect(() => parseNameStatus('garbage-without-a-tab\n')).toThrow();
    });
});

describe('fail closed', () => {
    it('an unreadable diff is needs-council, never routine', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmr-'));
        const out: string[] = [];
        const code = main(['--range', 'nope..also-nope', '--root', dir], (l) => out.push(l));
        expect(code).toBe(1);
        expect(out.join('\n')).toContain('diff-unreadable');
        expect(out[out.length - 1]).toMatch(/^verdict: needs-council/);
    });
});
