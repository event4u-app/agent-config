/**
 * The SVG active-content backstop grep, run rather than restated.
 *
 * `frontend-render-security` § Backstop greps documents a pattern that locates
 * SVG markup which executes once the file is inlined — a `<foreignObject>`, an
 * `on*` attribute on the root `<svg>`, a `javascript:` href. A grep that lives
 * only in prose is a grep nobody has ever run: it can be wrong on the day it is
 * written and stay wrong, because the skill is read by an agent and checked by
 * nothing.
 *
 * So this test does not carry its own copy of the pattern. It EXTRACTS the
 * pattern from the skill's own code fence and applies it to a committed fixture
 * of three planted files and one clean twin. A drift in either direction — the
 * documented pattern stops matching an attack shape, or widens until it matches
 * a clean asset — fails here, and the skill stays the single source.
 *
 * The twin is the half that carries the sensitivity. Three hits alone are also
 * what `.` would produce; the pair "three planted AND not the twin" is the claim
 * worth pinning, which is why one case asserts both and is named for both.
 *
 * It applies the pattern with `RegExp`, not by spawning `rg`. The syntax used
 * is the intersection both engines read the same way — alternation, `\b`, `\s`,
 * a negated class, a non-capturing group — so running it in-process costs no
 * fidelity and removes a dependency on a binary CI is not guaranteed to carry.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKILL = path.join(REPO, 'src', 'skills', 'frontend-render-security', 'SKILL.md');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'svg-active-content');

/**
 * Read one shell single-quoted word starting at `from`.
 *
 * The skill writes its patterns as shell words, so a pattern containing a
 * single quote appears as the four characters `'\''` — close, escape, reopen.
 * Reading the word back means undoing exactly that, and nothing else: anything
 * fancier would be a second grammar, which is the duplication this file exists
 * to avoid.
 */
function shellSingleQuoted(line: string, from: number): string {
    if (line[from] !== "'") throw new Error(`no single-quoted word at offset ${String(from)}: ${line}`);
    let out = '';
    let i = from + 1;
    for (;;) {
        const ch = line[i];
        if (ch === undefined) throw new Error(`unterminated single-quoted word: ${line}`);
        if (ch === "'") {
            if (line.slice(i, i + 4) === "'\\''") {
                out += "'";
                i += 4;
                continue;
            }
            return out;
        }
        out += ch;
        i += 1;
    }
}

/** The documented pattern, taken from the skill and from nowhere else. */
function documentedPattern(): string {
    const lines = fs.readFileSync(SKILL, 'utf-8').split('\n');
    const matches = lines.filter((l) => l.startsWith('rg -n ') && l.includes('foreignObject'));
    // Exactly one, so a second copy added to the skill later is a failure here
    // rather than a silent choice of whichever came first.
    expect(matches, 'the skill must document the SVG grep exactly once').toHaveLength(1);
    return shellSingleQuoted(matches[0] as string, 'rg -n '.length);
}

describe('frontend-render-security — the SVG active-content backstop grep', () => {
    it('grep-hits-three-planted-and-not-the-twin', () => {
        const re = new RegExp(documentedPattern());
        const files = fs.readdirSync(FIXTURE).filter((n) => n.endsWith('.svg')).sort();
        // The fixture is part of the claim: four files, or the counts below say
        // nothing about what the pattern can tell apart.
        expect(files).toEqual(['clean-twin.svg', 'foreign-object.svg', 'javascript-href.svg', 'onload-attribute.svg']);

        const hit = files.filter((name) => re.test(fs.readFileSync(path.join(FIXTURE, name), 'utf-8')));
        expect(hit).toEqual(['foreign-object.svg', 'javascript-href.svg', 'onload-attribute.svg']);
        expect(hit).not.toContain('clean-twin.svg');
    });

    it('the pattern is one the shell quoting survives, so the skill line is runnable as written', () => {
        // `["'\'']` in the fence must read back as `["']` — if the unescaping
        // were wrong the regex would still compile, match nothing useful, and
        // the case above would fail for a reason that looks like a pattern bug.
        expect(documentedPattern()).toContain(`["']`);
        expect(() => new RegExp(documentedPattern())).not.toThrow();
    });
});
