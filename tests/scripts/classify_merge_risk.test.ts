import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    classifyChanges,
    combinePolicy,
    consequenceMembersOf,
    DELETION_THRESHOLD,
    main,
    parseNameStatus,
    readSide,
    reopenPolicyOf,
    resolvePr,
    unionMembers,
    type ChangeEntry,
    type ClassifyOptions,
    type ResolveDeps,
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

/**
 * A real repository with one base commit, so a range can be diffed for real.
 *
 * The non-ASCII case cannot be made from a hand-written fixture string: the
 * defect is in what GIT prints, and only git prints it.
 */
function tmpRepo(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmr-repo-'));
    const g = (...args: string[]): void => {
        const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
        if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr ?? ''}`);
    };
    g('init', '-q', '-b', 'main');
    g('config', 'user.email', 't@example.com');
    g('config', 'user.name', 'T');
    // The default, stated rather than inherited: it is the setting that makes
    // git quote a non-ASCII path, which is the defect under test.
    g('config', 'core.quotePath', 'true');
    fs.writeFileSync(path.join(dir, 'README.md'), 'base\n');
    g('add', '-A');
    g('commit', '-q', '-m', 'base');
    return dir;
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

    it('a non-kernel rule outside the consequence class is not a governance surface', () => {
        expect(ids([mod('src/rules/markdown-safe-codeblocks.md')])).toEqual([]);
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

describe('the gate sees what governs — one case per trigger, each with its near-miss', () => {
    const governs = (entries: ChangeEntry[], opts: Partial<ClassifyOptions> = {}): string[] =>
        classifyChanges(entries, {
            dirExistsInHead: everyDirExists,
            decisionPolicy: () => 'other',
            consequenceMembers: new Set(['tool-safety']),
            ...opts,
        }).triggers.map((t) => t.id);

    it('an ADR declaring reopen_policy: owner is an owner-reserved decision', () => {
        expect(governs([mod('docs/decisions/ADR-281-x.md')], { decisionPolicy: () => 'owner' })).toEqual([
            'owner-reserved-decision',
        ]);
        expect(governs([mod('docs/decisions/ADR-100-x.md')])).toEqual([]);
    });

    it('a decision record whose frontmatter cannot be read fires the trigger', () => {
        expect(governs([mod('docs/decisions/ADR-100-x.md')], { decisionPolicy: () => 'unreadable' })).toEqual([
            'owner-reserved-decision',
        ]);
        expect(governs([mod('docs/decisions/INDEX.md')], { decisionPolicy: () => 'unreadable' })).toEqual([]);
    });

    it('a rule in the consequence class fires, as source and as projection; one outside does not', () => {
        // Also `governance-surface`: the ratification gate gates the class.
        expect(governs([mod('src/rules/tool-safety.md')])).toEqual(['governance-surface', 'consequence-class-rule']);
        expect(governs([mod('dist/agent-src/rules/tool-safety.md')])).toEqual([
            'governance-surface',
            'consequence-class-rule',
        ]);
        expect(governs([mod('src/rules/markdown-safe-codeblocks.md')])).toEqual([]);
    });

    it('an unreadable consequence-class list counts every rule file, for owner routing too', () => {
        expect(governs([mod('src/rules/markdown-safe-codeblocks.md')], { consequenceMembers: null })).toEqual([
            'governance-surface',
            'consequence-class-rule',
        ]);
    });

    it('owner routing reads the base-and-head union, so a member dropped while edited stays governance', () => {
        // The base names the rule, the head's list no longer does: the union
        // keeps it, and `governance-surface` is decided from that union rather
        // than from whatever list the checkout running the classifier carries.
        const base = JSON.stringify({ members: { 'markdown-safe-codeblocks': { clause: 'authority-bypass' } } });
        const head = JSON.stringify({ members: {} });
        const union = unionMembers([base, head]);
        expect(governs([mod('src/rules/markdown-safe-codeblocks.md')], { consequenceMembers: union })).toEqual([
            'governance-surface',
            'consequence-class-rule',
        ]);
        // Polarity: a rule in neither side's list is not governance.
        expect(governs([mod('src/rules/markdown-safe-codeblocks.md')], { consequenceMembers: unionMembers([head]) })).toEqual(
            [],
        );
    });

    it('the ratification contract fires; a neighbouring contract does not', () => {
        expect(governs([mod('docs/contracts/ratification-artifact.md')])).toEqual(['ratification-contract']);
        expect(governs([mod('docs/contracts/evidence-artifact-types.md')])).toEqual([]);
    });

    it('the council fires, through each of its five forms', () => {
        for (const p of [
            'src/scripts/ai_council/orchestrator.ts',
            'src/scripts/council_cli.ts',
            'src/scripts/_lib/council_transport.ts',
            'dist/agent-src/skills/ai-council/SKILL.md',
            'src/rules/council-availability.md',
        ]) {
            expect(governs([mod(p)])).toContain('council-surface');
        }
        expect(governs([mod('src/scripts/check_councillor_names.ts')])).toEqual([]);
    });

    it('the carriers of the merge rule fire', () => {
        for (const p of [
            'src/agent-src/contexts/execution/roadmap-execution-contract.md',
            'dist/agent-src/contexts/execution/roadmap-process-loop.md',
            'src/scripts/refusal_envelope.ts',
        ]) {
            expect(governs([mod(p)])).toEqual(['merge-rule-carrier']);
        }
        expect(governs([mod('agents/evidence/council/authority-routing-20261007.md')])).toContain('merge-rule-carrier');
        expect(governs([mod('src/agent-src/contexts/execution/roadmap-blockers.md')])).toEqual([]);
    });

    it('the consumer AGENTS.md template fires; the root AGENTS.md does not', () => {
        expect(governs([mod('src/agent-src/templates/AGENTS.md')])).toEqual(['consumer-template']);
        expect(governs([mod('AGENTS.md')])).toEqual([]);
    });

    it('every trigger names the rule it comes from', () => {
        const r = classifyChanges(
            [mod('docs/contracts/ratification-artifact.md'), mod('src/agent-src/templates/AGENTS.md')],
            { dirExistsInHead: everyDirExists, decisionPolicy: () => 'other', consequenceMembers: new Set() },
        );
        for (const t of r.triggers) {
            expect(t.rule).not.toBe('');
        }
    });
});

describe('frontmatter reading — both sides, failing closed', () => {
    it('reads the policy, quoted or not, and refuses a file without frontmatter', () => {
        expect(reopenPolicyOf('---\nid: ADR-1\nreopen_policy: owner\n---\n# x\n')).toBe('owner');
        expect(reopenPolicyOf('---\nreopen_policy: "directional"\n---\n')).toBe('directional');
        expect(reopenPolicyOf('---\nid: ADR-1\n---\n')).toBe('absent');
        expect(reopenPolicyOf('# no frontmatter\n')).toBeNull();
    });

    it('reads every YAML spelling of owner as owner, and any unrecognised value as owner', () => {
        for (const line of [
            'reopen_policy: owner # governance reservation',
            "reopen_policy: 'owner'",
            'Reopen_Policy: OWNER',
            'reopen_policy:',
            'reopen_policy: |',
            'reopen_policy: !!str owner',
            'reopen_policy: typo-owner',
        ]) {
            expect(reopenPolicyOf(`---\nid: ADR-1\n${line}\n---\n`), line).toBe('owner');
        }
        expect(reopenPolicyOf('---\nreopen_policy: directional\nreopen_policy: owner\n---\n')).toBe('owner');
        expect(reopenPolicyOf('---\nreopen_policy: *policy\n---\n')).toBe('owner');
    });

    it('reads owner for YAML outside the subset it parses, wherever owner could hide there', () => {
        for (const fm of [
            '{reopen_policy: owner}',
            '? reopen_policy\n: owner',
            '"reopen_policy": directional',
            '"reopen\\u005fpolicy": owner',
            'base: &b\n  reopen_policy: owner\n<<: *b',
            'id: ADR-1\nnotes: {reopen_policy: owner}',
            'metadata:\n  reopen_policy: directional',
            'notes: |\n  reopen_policy: directional',
            'reopen_policy: directional\nnotes:\n  - reopen_policy: unclassified',
        ]) {
            expect(reopenPolicyOf(`---\n${fm}\n---\n`), fm).toBe('owner');
        }
    });

    it('reads every committed ADR as the policy it declares — the subset does not over-fire', () => {
        const dir = path.resolve(__dirname, '..', '..', 'docs', 'decisions');
        const adrs = fs.readdirSync(dir).filter((f) => /^ADR-.*\.md$/u.test(f));
        expect(adrs.length).toBeGreaterThan(40);
        for (const f of adrs) {
            const text = fs.readFileSync(path.join(dir, f), 'utf8');
            const declared = /^reopen_policy:\s*(\S+)/mu.exec(text)?.[1] ?? 'absent';
            expect(reopenPolicyOf(text), f).toBe(declared);
        }
        expect(reopenPolicyOf('---\nreopen_policy: unclassified # not yet\n---\n')).toBe('unclassified');
    });

    it('owner at base OR at head fires; a side that exists and cannot be read fires', () => {
        const owner = '---\nreopen_policy: owner\n---\n';
        const other = '---\nreopen_policy: directional\n---\n';
        expect(combinePolicy([owner, other])).toBe('owner');
        expect(combinePolicy([other, owner])).toBe('owner');
        expect(combinePolicy([undefined, other])).toBe('other');
        expect(combinePolicy([other, null])).toBe('unreadable');
        expect(combinePolicy([undefined, undefined])).toBe('unreadable');
    });

    it('the consequence class is the union of both sides, and an unreadable side is null', () => {
        const a = JSON.stringify({ members: { 'tool-safety': {} } });
        const b = JSON.stringify({ members: { 'session-canary': {} } });
        expect([...(unionMembers([a, b]) ?? [])].sort()).toEqual(['session-canary', 'tool-safety']);
        expect(unionMembers([a, 'not json'])).toBeNull();
        expect(unionMembers([undefined, undefined])).toBeNull();
        expect(consequenceMembersOf('{"members": {}}')).toEqual(new Set());
        expect(consequenceMembersOf('{"members": []}')).toBeNull();
        expect(consequenceMembersOf('{"members": null}')).toBeNull();
    });

    it('a failed read is null, never absence; an empty listing is absence', () => {
        const run = (listOk: boolean, listOut: string, showOk: boolean) => (args: string[]) =>
            args[0] === 'ls-tree' ? { ok: listOk, out: listOut } : { ok: showOk, out: 'text' };
        expect(readSide(run(false, '', true), 'r', 'p')).toBeNull();
        expect(readSide(run(true, '', true), 'r', 'p')).toBeUndefined();
        expect(readSide(run(true, '100644 blob abc\tp\n', false), 'r', 'p')).toBeNull();
        expect(readSide(run(true, '100644 blob abc\tp\n', true), 'r', 'p')).toBe('text');
    });

    it('a real range reads the head frontmatter of an added owner-reserved ADR', () => {
        const dir = tmpRepo();
        const g = (...args: string[]): void => {
            spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
        };
        fs.mkdirSync(path.join(dir, 'docs', 'decisions'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'docs', 'decisions', 'ADR-001-a.md'), '---\nreopen_policy: owner\n---\n');
        fs.writeFileSync(path.join(dir, 'docs', 'decisions', 'ADR-002-b.md'), '---\nreopen_policy: directional\n---\n');
        g('add', '-A');
        g('commit', '-q', '-m', 'adrs');
        const out: string[] = [];
        main(['--range', 'HEAD~1...HEAD', '--root', dir], (l) => out.push(l));
        expect(out).toContain('  docs/decisions/ADR-001-a.md');
        expect(out).not.toContain('  docs/decisions/ADR-002-b.md');
        expect(out[out.length - 1]).toMatch(/^verdict: needs-owner \(1 trigger\(s\): owner-reserved-decision\)$/u);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});

/**
 * The trunk's own misses, replayed from the repository's history. Skipped only
 * where the history is not present (a shallow clone), and the skip names why —
 * the cases above carry the same paths as hand-written fixtures.
 */
/** Touches docs/installation.md, one analysis note and three roadmaps — nothing that governs. */
const DOCS_ONLY_COMMIT = '7b236a00f';

describe('replay — the commits the pin classed routine', () => {
    const REPO = path.resolve(__dirname, '..', '..');
    const has = (sha: string): boolean =>
        spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: REPO }).status === 0 &&
        spawnSync('git', ['cat-file', '-e', `${sha}^1^{commit}`], { cwd: REPO }).status === 0;
    const replay = (sha: string): string => {
        const out: string[] = [];
        main(['--range', `${sha}^1..${sha}`, '--root', REPO], (l) => out.push(l));
        return out[out.length - 1] ?? '';
    };

    for (const [sha, what] of [
        ['82a131feb', 'landed ADR-281 and rewrote the ratification contract'],
        ['bbe5b73be', "the council's modification-review modules"],
        ['edd18fea6', 'introduced the gate (#2256)'],
    ] as const) {
        it.skipIf(!has(sha))(`${sha} (${what}) is needs-owner — skipped when the history is shallow`, () => {
            expect(replay(sha)).toMatch(/^verdict: needs-owner/u);
        });
    }

    it.skipIf(!has('f76e83e47'))('f76e83e47 (the amendment of an owner-reserved ADR) is needs-owner', () => {
        expect(replay('f76e83e47')).toMatch(/^verdict: needs-owner/u);
    });

    it.skipIf(!has(DOCS_ONLY_COMMIT))(`${DOCS_ONLY_COMMIT} (a documentation-only commit) stays routine`, () => {
        expect(replay(DOCS_ONLY_COMMIT)).toBe('verdict: routine');
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

describe('non-ascii-workflow-is-not-routine — the classifier reads the path git prints', () => {
    function repoAdding(name: string): string {
        const dir = tmpRepo();
        const g = (...args: string[]): void => {
            spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
        };
        fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
        fs.writeFileSync(path.join(dir, '.github', 'workflows', name), 'on: push\n');
        g('add', '-A');
        g('commit', '-q', '-m', 'add workflow');
        return dir;
    }

    it('non-ascii-workflow-is-not-routine — a workflow git quotes still reaches the council', () => {
        const dir = repoAdding('ci-ö.yml');
        const out: string[] = [];
        const code = main(['--range', 'HEAD~1...HEAD', '--root', dir], (l) => out.push(l));
        expect(out.join('\n')).toContain('ci-workflow');
        expect(out[out.length - 1]).toMatch(/^verdict: needs-council/u);
        expect(code).toBe(1);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('the ASCII sibling was already needs-council, so the quoting is the whole difference', () => {
        const dir = repoAdding('plain.yml');
        const out: string[] = [];
        main(['--range', 'HEAD~1...HEAD', '--root', dir], (l) => out.push(l));
        expect(out.join('\n')).toContain('ci-workflow');
        expect(out[out.length - 1]).toMatch(/^verdict: needs-council/u);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('a rename of an ordinary file stays routine, so the NUL parse did not widen the verdict', () => {
        const dir = tmpRepo();
        const g = (...args: string[]): void => {
            spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
        };
        fs.writeFileSync(path.join(dir, 'a.ts'), 'x'.repeat(400));
        g('add', '-A');
        g('commit', '-q', '-m', 'a');
        fs.renameSync(path.join(dir, 'a.ts'), path.join(dir, 'b.ts'));
        g('add', '-A');
        g('commit', '-q', '-m', 'rename');
        const out: string[] = [];
        const code = main(['--range', 'HEAD~1...HEAD', '--root', dir], (l) => out.push(l));
        expect(out[out.length - 1]).toMatch(/^verdict: routine/u);
        expect(code).toBe(0);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});

describe('parseNameStatus on NUL-separated output', () => {
    it('reads modify, delete and scored rename records', () => {
        expect(parseNameStatus('M\0a.ts\0D\0b.ts\0R087\0old.ts\0new.ts\0')).toEqual([
            { status: 'M', path: 'a.ts' },
            { status: 'D', path: 'b.ts' },
            { status: 'R', oldPath: 'old.ts', path: 'new.ts' },
        ]);
    });

    it('reads a copy record, which carries two paths like a rename', () => {
        expect(parseNameStatus('C100\0src.ts\0copy.ts\0')).toEqual([
            { status: 'C', oldPath: 'src.ts', path: 'copy.ts' },
        ]);
    });

    it('refuses a record it cannot read rather than skipping it', () => {
        expect(() => parseNameStatus('garbage\0')).toThrow();
    });

    it('refuses a rename whose second path is missing rather than reading one path', () => {
        expect(() => parseNameStatus('R087\0old.ts\0')).toThrow();
    });
});

describe('fetch-failure-fails-closed — a base that could not be refreshed is not diffed', () => {
    const META = JSON.stringify({ baseRefName: 'main', headRefOid: 'deadbeef' });

    function deps(fetchOk: boolean): ResolveDeps & { calls: string[][] } {
        const calls: string[][] = [];
        return {
            calls,
            gh: (_root, args) => {
                calls.push(['gh', ...args]);
                return { ok: true, out: META };
            },
            git: (_root, args) => {
                calls.push(['git', ...args]);
                return { ok: fetchOk, out: '' };
            },
        };
    }

    it('fetch-failure-fails-closed — resolvePr returns null when the fetch exits non-zero', () => {
        expect(resolvePr('/tmp', '42', deps(false))).toBeNull();
    });

    it('fetch-failure-fails-closed — a successful fetch still resolves, so the guard is not blanket', () => {
        expect(resolvePr('/tmp', '42', deps(true))).toEqual({ base: 'origin/main', head: 'deadbeef' });
    });

    it('fetch-failure-fails-closed — the fetch is actually attempted, not assumed', () => {
        const d = deps(true);
        resolvePr('/tmp', '42', d);
        expect(d.calls.some((c) => c[0] === 'git' && c[1] === 'fetch')).toBe(true);
    });

    it('fetch-failure-fails-closed — an unresolvable target is needs-council with diff-unreadable', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmr-fc-'));
        const out: string[] = [];
        const code = main(['--range', 'no-such-base...no-such-head', '--root', dir], (l) => out.push(l));
        expect(out.join('\n')).toContain('diff-unreadable');
        expect(out[out.length - 1]).toMatch(/^verdict: needs-council/u);
        expect(code).toBe(1);
        fs.rmSync(dir, { recursive: true, force: true });
    });
});
