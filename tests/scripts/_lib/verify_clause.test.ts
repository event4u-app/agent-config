/**
 * Fixture G4 — the parity fixture the grammar is defined by.
 *
 * One step each of `-> 0`, `-> /regex/` and prose, parsed by ONE parser, must
 * yield three distinct shapes. The roadmap's whole defect is that a `verify:`
 * clause names a command and never names what the command must produce, so a
 * step can be flipped on a command that cannot fail; the shape distinction IS
 * the fix, and a test that cannot tell the three apart would let the arrow
 * land as decoration.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    parseExpectation,
    parseVerifyClause,
    renderVerifyLine,
    VERIFY_ARROW_SOURCE,
} from '../../../src/scripts/_lib/verify_clause.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Fixture G4 — the three legal shapes, written the way the tree writes them. */
const G4 = {
    exit: '- [ ] **1.0** do it\n      verify: `./scripts-run src/scripts/lint_thing` -> 0',
    regex: '- [ ] **1.1** do it\n      verify: `grep -c thing file.md` -> /[1-9]/',
    prose: '- [ ] **1.2** do it\n      verify: the evidence page carries both figures',
} as const;

describe('fixture G4 — three shapes, one parser', () => {
    it('`-> 0` yields an exit expectation', () => {
        const clause = parseVerifyClause(G4.exit);
        expect(clause).not.toBeNull();
        expect(clause?.command).toBe('./scripts-run src/scripts/lint_thing');
        expect(clause?.expect).toEqual({ kind: 'exit', code: 0 });
    });

    it('`-> /regex/` yields a regex expectation carrying the bare source', () => {
        const clause = parseVerifyClause(G4.regex);
        expect(clause?.command).toBe('grep -c thing file.md');
        expect(clause?.expect).toEqual({ kind: 'regex', source: '[1-9]' });
    });

    it('prose yields a clause with no command and no expectation — the MANUAL shape', () => {
        const clause = parseVerifyClause(G4.prose);
        expect(clause).not.toBeNull();
        expect(clause?.command).toBeNull();
        expect(clause?.expect).toBeNull();
    });

    it('the three shapes are mutually distinct, which is the point of the fixture', () => {
        const shapes = [G4.exit, G4.regex, G4.prose]
            .map((s) => parseVerifyClause(s))
            .map((c) => JSON.stringify({ hasCommand: c?.command !== null, expect: c?.expect ?? null }));
        expect(new Set(shapes).size).toBe(3);
    });

    it('a command with no arrow keeps the command and nulls the expectation', () => {
        const clause = parseVerifyClause('- [ ] x\n      verify: `task test -- --filter=T`');
        expect(clause?.command).toBe('task test -- --filter=T');
        expect(clause?.expect).toBeNull();
    });

    it('no `verify:` token at all is null, not an empty clause', () => {
        expect(parseVerifyClause('- [ ] **1.0** bare step')).toBeNull();
    });

    it('keeps the expectation when the step continues after the clause', () => {
        // Readers hand this parser a whole step BLOCK, joined and
        // whitespace-normalised. A step that carries prose after its verify
        // clause used to push the arrow away from the end anchor, and the
        // expectation vanished without anything failing.
        const joined = '- [ ] **1.0** do it verify: `grep -c x f.md` -> /[1-9]/ and then note the result';
        const clause = parseVerifyClause(joined);
        expect(clause?.command).toBe('grep -c x f.md');
        expect(clause?.expect).toEqual({ kind: 'regex', source: '[1-9]' });
    });
});

describe('the arrow half — only the two declared forms', () => {
    it('reads a non-zero exit code', () => {
        expect(parseExpectation('-> 2')).toEqual({ kind: 'exit', code: 2 });
    });

    it('refuses a bare word as an expectation rather than inventing one', () => {
        expect(parseExpectation('-> green')).toBeNull();
    });

    it('refuses an unterminated regex', () => {
        expect(parseExpectation('-> /oops')).toBeNull();
    });

    it('is absent, not null-shaped, when there is no arrow', () => {
        expect(parseExpectation('')).toBeNull();
    });

    it('accepts the rendered arrow, because `exec:` evidence already does', () => {
        // Rule 23 reuses `exec:`'s symbol rather than minting one. `exec:`
        // accepts `→` because the docs render it that way, and a grammar that
        // accepted the symbol only in its ASCII spelling would drop an
        // expectation an author believed they had written.
        expect(parseExpectation('→ 0')).toEqual({ kind: 'exit', code: 0 });
        expect(parseVerifyClause('- [ ] x\n      verify: `cmd` → /ok/')?.expect).toEqual({
            kind: 'regex',
            source: 'ok',
        });
    });

    it('a regex expectation compiles — an expectation that throws is not an oracle', () => {
        const clause = parseVerifyClause('- [ ] x\n      verify: `cmd` -> /unfalsifiable-verify/');
        const exp = clause?.expect;
        expect(exp?.kind).toBe('regex');
        expect(() => new RegExp(exp?.kind === 'regex' ? exp.source : '')).not.toThrow();
    });
});

describe('a step that DISCUSSES the clause, which is where the old regex broke', () => {
    /**
     * Both cases below come from the real tree — the roadmap that introduced
     * the arrow discusses `verify:` in its own prose, so its steps carry the
     * token two and three times before the clause that counts.
     */
    it('does not borrow the label\'s own closing backtick as the command\'s opening one', () => {
        // The inherited regex was ``?verify:`?\s*`([^`]+)`` — both backticks
        // optional and independent. On `…`verify:` stays legal … verify: `cmd``
        // it skipped the trailing `?`, let the LABEL's closing backtick open
        // the command, and captured the whole sentence between the two
        // backticks as the command. It failed nothing: a garbage command is
        // still a string.
        const step = '- [ ] **1.1** Prose after `verify:` stays legal and reads as MANUAL. verify: `grep -c x f.md` -> /[1-9]/';
        const clause = parseVerifyClause(step);
        expect(clause?.command).toBe('grep -c x f.md');
        expect(clause?.expect).toEqual({ kind: 'regex', source: '[1-9]' });
    });

    it('takes the step\'s LAST clause, so an illustration does not win over the real one', () => {
        // A step whose prose shows the grammar carries an example clause
        // before its own. The clause is written last by convention, so last
        // wins; first-match-wins parsed the illustration instead.
        const step = [
            '- [ ] **1.1 Rule 23 accepts an expectation half.** `verify: `<cmd>` -> 0` and',
            '      `-> /regex/`, in the template.',
            '      verify: `grep -c thing f.md` -> /[1-9]/',
        ].join('\n');
        const clause = parseVerifyClause(step);
        expect(clause?.command).toBe('grep -c thing f.md');
        expect(clause?.expect).toEqual({ kind: 'regex', source: '[1-9]' });
    });
});

describe('the HTML-comment form carries the arrow too', () => {
    it('parses an expectation out of the annotation form', () => {
        const clause = parseVerifyClause('- [ ] do it <!-- verify: task test -- --filter=T -> 0 -->');
        expect(clause?.command).toBe('task test -- --filter=T');
        expect(clause?.expect).toEqual({ kind: 'exit', code: 0 });
    });

    it('the annotation form wins over a human-facing backticked line', () => {
        const step = '- [ ] do it <!-- verify: machine-readable -->\n      verify: `human-facing`';
        expect(parseVerifyClause(step)?.command).toBe('machine-readable');
    });
});

describe('one parser — nothing may parse the arrow a second time', () => {
    /**
     * The roadmap's step 1.2 is "one parser, two importers". A second copy of
     * the arrow grammar is how the two importers drift, and drift in a grammar
     * is invisible until an expectation silently stops being read. So the
     * source literal is exported and the tree is swept for any other file
     * carrying an arrow-shaped `verify:` matcher.
     */
    it('exports its grammar source so a duplicate is detectable at all', () => {
        expect(VERIFY_ARROW_SOURCE.length).toBeGreaterThan(0);
        expect(() => new RegExp(VERIFY_ARROW_SOURCE)).not.toThrow();
    });

    it('is the only file under src/scripts that parses a verify arrow', () => {
        // The sweep's first form matched any regex literal pairing an arrow
        // with `\d+`, and fired on `_lib/exec_evidence.ts`. That was a false
        // positive with a real lesson in it: `exec:<cmd> -> <code>` is a
        // DIFFERENT clause that happens to reuse the same symbol — exit-code
        // only, no regex alternative, and nothing to do with a step's oracle.
        // Reusing the symbol is the point (rule 23 says so); what must not
        // recur is a second reader of the VERIFY clause. So the sweep requires
        // both halves in one file: the `verify:` token and an arrow matcher.
        const owner = path.join('src', 'scripts', '_lib', 'verify_clause.ts');
        const offenders: string[] = [];
        const walk = (dir: string): void => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) {
                    walk(full);
                    continue;
                }
                if (!e.name.endsWith('.ts') || e.name.endsWith('.test.ts')) continue;
                const rel = path.relative(REPO_ROOT, full);
                if (rel === owner) continue;
                const body = fs.readFileSync(full, 'utf8');
                const arrowMatcher = /\/\^?[^\n/]*(?:->|→)[^\n/]*\\d\+[^\n/]*\//.test(body);
                if (arrowMatcher && /verify:/.test(body)) offenders.push(rel);
            }
        };
        walk(path.join(REPO_ROOT, 'src', 'scripts'));
        expect(offenders, `a second verify-arrow parser exists: ${offenders.join(', ')}`).toEqual([]);
    });
});

describe('renderVerifyLine — the oracle reaches the re-engagement, not just the command', () => {
    /**
     * The failure this guards is silent and was the original defect in its
     * message form: a continuation that names the command and drops the
     * expectation lets the next agent run it, see exit 0, and flip the box.
     * Asserting `toContain(command)` alone would pass on exactly that bug, so
     * every case below pins the FULL rendered line.
     */
    it('renders an exit expectation after the command', () => {
        const clause = parseVerifyClause('- [ ] x\n      verify: `task test` -> 0');
        expect(renderVerifyLine(clause)).toBe('\n  verify: task test -> 0');
    });

    it('renders a regex expectation in its written form', () => {
        const clause = parseVerifyClause('- [ ] x\n      verify: `grep -c thing f.md` -> /[1-9]/');
        expect(renderVerifyLine(clause)).toBe('\n  verify: grep -c thing f.md -> /[1-9]/');
    });

    it('renders a command with no expectation, and appends no arrow', () => {
        const clause = parseVerifyClause('- [ ] x\n      verify: `task test`');
        expect(renderVerifyLine(clause)).toBe('\n  verify: task test');
        expect(renderVerifyLine(clause)).not.toContain('->');
    });

    it('renders nothing for an absent clause, so the message gains no empty line', () => {
        expect(renderVerifyLine(null)).toBe('');
    });
});
