// Tests for src/install/noGoRules.ts and src/install/hostPermissionsAdapter.ts —
// road-to-a-project-contract-written-down Phase 2 (2.1).
//
// The canonical fixtures are the three bullets the consumer guide ships as its
// own `## No-gos` example, one per kind: a path, a command, and a sentence that
// names neither. The third is the load-bearing one — D4 says an unclassifiable
// bullet stays `prose`, never a guessed deny row, because a row on a vague
// sentence blocks legitimate work silently and the agent cannot say why.
//
// The two modules are tested together because 2.1 is one step, and apart
// because the council of 2026-10-13 required the split: the classifier never
// learns which host it runs for, and the adapter never re-derives semantics.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    classifyNoGo,
    classifyNoGos,
    extractNoGosSection,
    type NoGoClassification,
    type NoGoKind,
} from '../../src/install/noGoRules.js';
import {
    denyRulesFor,
    HOST_PERMISSION_SYNTAX,
    syntaxFor,
} from '../../src/install/hostPermissionsAdapter.js';

function kindOf(bullet: string): NoGoKind {
    return classifyNoGo(bullet).kind;
}

/** What the bullet becomes on the one host whose spelling is established. */
function rulesOf(bullet: string): readonly string[] {
    return denyRulesFor('claude', classifyNoGo(bullet));
}

describe('classifyNoGo — the three kinds', () => {
    it('reads a backticked path under an edit verb as `path`', () => {
        const c = classifyNoGo('Never edit `migrations/` by hand');
        expect(c.kind).toBe('path');
        expect(c.token).toBe('migrations/');
        expect(c.action).toBe('edit');
    });

    it('reads a backticked command under a run verb as `command`', () => {
        const c = classifyNoGo(
            'Never run `php artisan migrate:fresh` outside a throwaway database',
        );
        expect(c.kind).toBe('command');
        expect(c.token).toBe('php artisan migrate:fresh');
        expect(c.action).toBe('run');
    });

    it('reads a bullet with no backticked token as `prose`', () => {
        const c = classifyNoGo('Never add a runtime dependency without an ADR');
        expect(c.kind).toBe('prose');
        expect(c.token).toBeNull();
        expect(c.action).toBeNull();
    });

    it('carries no host spelling of its own', () => {
        // The classifier's whole output is `{kind, token, action, reason}`.
        // A `rules` field here would be the host coupling the split removes.
        const c = classifyNoGo('Never edit `migrations/` by hand') as NoGoClassification &
            Record<string, unknown>;
        expect(c['rules']).toBeUndefined();
        expect(Object.keys(c).sort()).toEqual(['action', 'bullet', 'kind', 'reason', 'token']);
    });
});

describe('classifyNoGo — what it refuses to guess', () => {
    it('stays prose when two backticked tokens leave the subject ambiguous', () => {
        expect(kindOf('Never edit `migrations/` or `seeders/`')).toBe('prose');
    });

    it('stays prose when a path carries no action verb', () => {
        // The shape says path; the sentence does not say what must not happen
        // to it. Picking `Edit` over `Read` here would be the guess D4 forbids.
        expect(kindOf('`vendor/` is generated')).toBe('prose');
    });

    it('stays prose when an edit verb names something with no path shape', () => {
        expect(kindOf('Never change `the deploy process`')).toBe('prose');
    });

    it('stays prose on an empty bullet', () => {
        expect(kindOf('')).toBe('prose');
        expect(kindOf('   ')).toBe('prose');
    });

    it('stays prose when the bullet PRESCRIBES the backticked command', () => {
        // Found by review. A verb scan alone rendered a deny row over the thing
        // the bullet recommends — the sharpest possible wrong answer.
        expect(kindOf('`npm run build` is the only sanctioned build command')).toBe('prose');
        expect(kindOf('Use `bin/console` to run console commands')).toBe('prose');
    });

    it('stays prose when the token is the escape hatch the bullet names', () => {
        // A correct, idiomatic no-go whose alternative is in the same sentence.
        // Negated, carries a run verb, carries one backticked command — and the
        // command is what the consumer is being told TO use.
        expect(
            kindOf(
                'Never run migrations in production - use `php artisan migrate --pretend` instead',
            ),
        ).toBe('prose');
        expect(kindOf('Never edit the schema directly; use `migrations/` instead')).toBe('prose');
    });

    it('stays prose when a verb sits only inside the backticks', () => {
        // The verb scan masks the token, so `run/` does not supply the verb.
        expect(kindOf('`run/` holds generated output')).toBe('prose');
    });

    it('stays prose on a dotted identifier that is not a path', () => {
        for (const t of ['users.id', 'app.debug', 'v2.1']) {
            expect(kindOf(`Never change \`${t}\``)).toBe('prose');
        }
        // …while a real dotted filename still reads as one.
        expect(kindOf('Never modify `app.config.json`')).toBe('path');
    });

    it('stays prose on a token carrying a gitignore metacharacter', () => {
        // `!` is a NEGATION on the host: the row would carve paths OUT of the
        // consumer's existing deny list while being shown to them as a deny.
        expect(kindOf('Never edit `!important/`')).toBe('prose');
        // A character class the host does not escape: `reports/[2024]/**`
        // matches `reports/2/`, never the directory the consumer named.
        expect(kindOf('Never edit `reports/[2024]/`')).toBe('prose');
        expect(kindOf('Never edit `logs/?/`')).toBe('prose');
    });

    it('builds no rule for any prose verdict', () => {
        for (const bullet of [
            'Never add a runtime dependency without an ADR',
            'Never edit `migrations/` or `seeders/`',
            '`vendor/` is generated',
            'Never change `the deploy process`',
        ]) {
            expect(rulesOf(bullet)).toEqual([]);
            expect(classifyNoGo(bullet).reason.length).toBeGreaterThan(0);
        }
    });
});

describe('deny rows are rendered in the pinned host syntax', () => {
    it('a directory bullet becomes an Edit rule over its contents', () => {
        expect(rulesOf('Never edit `migrations/` by hand')).toEqual(['Edit(migrations/**)']);
    });

    it('an already-globbed path is passed through as written', () => {
        expect(rulesOf('Never modify `src/generated/**`')).toEqual(['Edit(src/generated/**)']);
    });

    it('a file bullet becomes an Edit rule on that exact path', () => {
        expect(rulesOf('Never overwrite `.env`')).toEqual(['Edit(.env)']);
    });

    it('a read verb becomes a Read rule AND an Edit rule', () => {
        // The Read deny covers the Edit and Write tools, but the page names the
        // exception: "NotebookEdit isn't covered, so add an `Edit` deny rule for
        // paths no tool may change."
        expect(rulesOf('Never read `secrets/`')).toEqual([
            'Read(secrets/**)',
            'Edit(secrets/**)',
        ]);
    });

    it('a command becomes BOTH the exact rule and the with-arguments rule', () => {
        // NOT because `Bash(x *)` misses the bare command — the page says it
        // matches it. Because that holds "only when the trailing `*` is the
        // rule's only wildcard", which a consumer token carrying its own `*`
        // breaks; the exact row is what still guards the plain command then.
        expect(
            rulesOf('Never run `php artisan migrate:fresh` outside a throwaway database'),
        ).toEqual(['Bash(php artisan migrate:fresh)', 'Bash(php artisan migrate:fresh *)']);
    });

    it('a bare executable under a run verb is still a command', () => {
        expect(rulesOf('Never run `terraform`')).toEqual(['Bash(terraform)', 'Bash(terraform *)']);
    });

    it('never emits a Write or NotebookEdit path rule', () => {
        // The host accepts a path rule for `Write`, never consults it, and warns
        // at startup. `Edit(...)` is the only path rule it checks on changes.
        const all = classifyNoGos(
            '- Never edit `migrations/` by hand\n- Never overwrite `.env`\n- Never read `secrets/`',
        ).flatMap((c) => denyRulesFor('claude', c));
        expect(all.some((r) => r.startsWith('Write(') || r.startsWith('NotebookEdit('))).toBe(
            false,
        );
    });

    it('builds nothing at all for a host with no established spelling', () => {
        expect(denyRulesFor('cowork', classifyNoGo('Never edit `migrations/` by hand'))).toEqual(
            [],
        );
        expect(syntaxFor('cowork')).toBeNull();
    });
});

describe('classifyNoGos — a whole section', () => {
    const SECTION = [
        '## No-gos',
        '',
        '- Never edit `migrations/` by hand',
        '- Never run `php artisan migrate:fresh` outside a throwaway database',
        '- Never add a runtime dependency without an ADR',
        '',
    ].join('\n');

    it('classifies one entry per bullet, in file order', () => {
        expect(classifyNoGos(SECTION).map((r) => r.kind)).toEqual(['path', 'command', 'prose']);
    });

    it('ignores the heading and the blank lines', () => {
        expect(classifyNoGos(SECTION)).toHaveLength(3);
    });

    it('accepts `*` and `+` list markers as well as `-`', () => {
        expect(classifyNoGos('* Never edit `migrations/` by hand')).toHaveLength(1);
        expect(classifyNoGos('+ Never edit `migrations/` by hand')).toHaveLength(1);
    });

    it('returns nothing for a section with no bullets', () => {
        expect(classifyNoGos('## No-gos\n\nNothing yet.\n')).toEqual([]);
    });
});

describe('extractNoGosSection — the fence skip is the load-bearing part', () => {
    it('returns the bullets under the heading and stops at the next one', () => {
        const md = [
            '# Project',
            '',
            '## Goal',
            '',
            'Ship the thing.',
            '',
            '## No-gos',
            '',
            '- Never edit `migrations/` by hand',
            '',
            '## Tech Stack',
            '',
            '- **Language:** PHP',
        ].join('\n');
        expect(classifyNoGos(extractNoGosSection(md))).toHaveLength(1);
    });

    it('reads nothing from a heading that lives inside a fence', () => {
        const md = ['# Guide', '', '```markdown', '## No-gos', '', '- Never edit `x/`', '```'].join(
            '\n',
        );
        expect(extractNoGosSection(md).trim()).toBe('');
    });

    it('reads nothing from the live consumer guide, whose example IS fenced', () => {
        // Run against the shipped file rather than a copy of it: the guide is
        // the one document in this tree that carries this heading as copy-in
        // material, and it is the file a reader without the skip would mistake
        // for a filled contract.
        const guide = path.resolve(
            __dirname,
            '../../src/agent-src/contexts/contracts/consumer-agents-md-guide.md',
        );
        const body = fs.readFileSync(guide, 'utf8');
        expect(body).toContain('## No-gos section (optional copy-in)');
        expect(classifyNoGos(extractNoGosSection(body))).toEqual([]);
    });

    it('returns empty for a file with no such section', () => {
        expect(extractNoGosSection('# Project\n\n## Goal\n\nShip it.\n').trim()).toBe('');
    });

    it('is closed by a heading at ANY level, not only by another `##`', () => {
        // Found by review: matching `##` alone left the section open across a
        // following `# Appendix`, so every later bullet in the file was read as
        // a no-go.
        const md = [
            '## No-gos',
            '- Never edit `a/` by hand',
            '# Appendix',
            '- Never edit `b/` by hand',
        ].join('\n');
        expect(classifyNoGos(extractNoGosSection(md)).map((c) => c.token)).toEqual(['a/']);
    });

    it('is closed by a deeper heading too', () => {
        const md = ['## No-gos', '- Never edit `a/` by hand', '### Notes', '- Never edit `b/`'].join(
            '\n',
        );
        expect(classifyNoGos(extractNoGosSection(md))).toHaveLength(1);
    });
});

describe('the syntax pin', () => {
    it('names the documentation it was read from and the day it was read', () => {
        for (const row of Object.values(HOST_PERMISSION_SYNTAX)) {
            expect(row.docs_url).toMatch(/^https:\/\//);
            expect(row.docs_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(row.expires).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
    });

    it('names the settings key the rows belong under', () => {
        expect(syntaxFor('claude')?.deny_key).toBe('permissions.deny');
    });

    it('keys every row by the host it describes', () => {
        for (const [key, row] of Object.entries(HOST_PERMISSION_SYNTAX)) {
            expect(row.host).toBe(key);
        }
    });

    it('carries at least one verbatim example per rule shape it renders', () => {
        const ex = syntaxFor('claude')?.examples ?? [];
        expect(ex.some((e) => e.startsWith('Edit('))).toBe(true);
        expect(ex.some((e) => e.startsWith('Read('))).toBe(true);
        expect(ex.some((e) => e.startsWith('Bash('))).toBe(true);
    });
});
