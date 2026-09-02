/**
 * Polarity fixtures for `lint_code_comments`.
 *
 * Both directions, in one file, because a pattern gate is only as good as the
 * near-miss it stays silent on: the MUST-FIRE half is what the rule asks for,
 * and the MUST-NOT-FIRE half is the whole reason this gate can be turned on
 * in a repository whose own module docstrings are long, cite evidence and
 * quote German user speech as data.
 */
import { describe, expect, it } from 'vitest';

import { fileIsExempt, isScannable, scanText } from '../../src/scripts/lint_code_comments.js';

const classes = (src: string): string[] => scanText('f.ts', src).map((f) => f.cls);

describe('de-comment — must fire', () => {
    it('flags a German comment line carrying two function words', () => {
        expect(classes('// Hier stehen nur die Werte, die Bedeutung tragen\nconst a = 1;\n'))
            .toContain('de-comment');
    });

    it('flags transliterated German with no umlaut at all', () => {
        expect(classes('/* uebersetzt aus dem Prototyp, jeder Wert ist hier belegt */\n'))
            .toContain('de-comment');
    });

<<<<<<< HEAD
    it('flags a block-comment continuation carrying no leading star', () => {
        // The case this gate MISSED on its first day, in a consumer repository:
        // a `/* … */` block whose continuation lines are indented prose with no
        // comment punctuation of their own. The opening line alone fell under
        // the two-word threshold, and lines 2 and 3 were never classified at
        // all, so a three-line German comment survived a clean run.
        const src = [
            '  /* Hausform mit Objekt-`message`: derselbe Aufbau, anderer Schluessel.',
            '     `BaseException::render()` dekodiert eine JSON-Zeichenkette und legt das',
            '     Ergebnis unter `message` ab — bei Feldfehlern ist das ein Objekt. */',
            '  if (isRecord(payload.message)) {',
        ].join('\n');
        expect(scanText('f.ts', src).filter((f) => f.cls === 'de-comment').length).toBeGreaterThanOrEqual(2);
    });

    it('flags a JSX comment, which opens with a brace rather than a slash', () => {
        // Second blind spot found the same way as the first: `{/* … */}` does
        // not start with a comment token, so the whole JSX comment family was
        // invisible — in a frontend where most comments are JSX comments.
        expect(classes('        {/* Der Titel traegt die Aktion, nicht die Zeile. */}\n'))
            .toContain('de-comment');
    });

=======
>>>>>>> origin/main
    it('flags a German line whose only umlaut sits in ordinary prose', () => {
        expect(classes('// Die Schriftstufen der kompakten Datenoberfläche\n'))
            .toContain('de-comment');
    });
});

describe('de-comment — must NOT fire', () => {
    it('stays silent on an English comment quoting a non-ASCII sample value', () => {
        expect(classes('/** so a `café@exämple.com` email or a `/Users/möchte/f` path masks */\n'))
            .not.toContain('de-comment');
    });

    it('stays silent on an English comment carrying an umlauted proper name', () => {
        expect(classes('/** Robertson–Spärck-Jones IDF, floored at 0 so terms never subtract. */\n'))
            .not.toContain('de-comment');
    });

    it('stays silent on an umlauted step label in English prose', () => {
        expect(classes('// ── Ü2 — orthogonal stance assignment per seat ──\n').filter((c) => c === 'de-comment'))
            .toEqual([]);
    });

    it('stays silent on a German user quotation used as data, single line', () => {
        expect(classes('// the phrase "nicht releasen. Warum nicht?" names no fault\n'))
            .not.toContain('de-comment');
    });

    it('stays silent on a German user quotation spanning two comment lines', () => {
        const src = [
            '/**',
            ' *   "Kein Council konfiguriert (keine `.agent-settings.yml`) — ich nutze',
            ' *    Subagenten-Fächer mit gegnerischen Linsen als Ersatz"',
            ' */',
        ].join('\n');
        expect(classes(src)).not.toContain('de-comment');
    });

<<<<<<< HEAD
    it('stays silent on English code AFTER a block comment closes', () => {
        // The other half of the block-state fix: the state must be released on
        // the closing delimiter, or every line of the file after the first
        // block comment is scanned as comment prose.
        const src = [
            '/* An English header.',
             '   Its continuation, also English. */',
            'const der = 1; const und = 2; const nicht = 3;',
        ].join('\n');
        expect(scanText('f.ts', src)).toEqual([]);
    });

    it('stays silent on English prose introducing a German quotation', () => {
        // The direction case the quote trim exists for: the German is inside
        // the quotation, the sentence around it is English.
        expect(classes('// cannot tell "Fertig." from "Fertig ist der Fix noch nicht"\n'))
            .not.toContain('de-comment');
    });

=======
>>>>>>> origin/main
    it('stays silent on plain English prose', () => {
        expect(classes('// The cap is a stated default, not a measured optimum.\n')).toEqual([]);
    });
});

describe('report-comment', () => {
    it('fires on a markdown table inside a comment', () => {
        expect(classes(' * | Prototype | Role | here |\n')).toContain('report-comment');
    });

    it('fires on a box-drawing rule', () => {
        expect(classes(' * ─────────────────────────────\n')).toContain('report-comment');
    });

    it('fires on a revisit-if clause', () => {
        expect(classes(' * Revisit-if: someone holds the new surface next to the sidebar.\n'))
            .toContain('report-comment');
    });

    it('does not fire on a short dash rule that is not a report', () => {
        expect(classes('// --- setup ---\n')).not.toContain('report-comment');
    });
});

describe('provenance-comment', () => {
    it('fires on a roadmap citation', () => {
        expect(classes('// see agents/roadmaps/todos-task-module-frontend.md\n'))
            .toContain('provenance-comment');
    });

    it('fires on a phase-and-step citation', () => {
        expect(classes('// Roadmap todos-task-module, Phase 1, Schritt 1.\n'))
            .toContain('provenance-comment');
    });

    it('does not fire on a plain code reference', () => {
        expect(classes('// see src/lib/token.ts for the parser\n'))
            .not.toContain('provenance-comment');
    });
});

describe('escapes', () => {
    it('honours a per-line escape carrying a reason', () => {
        expect(classes('// Hier stehen die Werte  code-comment-allow de-comment -- quoted spec text\n'))
            .not.toContain('de-comment');
    });

    it('refuses a bare escape with no reason', () => {
        expect(classes('// Hier stehen die Werte  code-comment-allow de-comment\n'))
            .toContain('de-comment');
    });

    it('treats a generated-file header as exempt', () => {
        expect(fileIsExempt('// Generated by wrangler. DO NOT EDIT.\n')).toBe(true);
    });

    it('does not treat an ordinary header as exempt', () => {
        expect(fileIsExempt('// Token definitions for the todo surface.\n')).toBe(false);
    });
});

describe('scope', () => {
    it('scans source extensions', () => {
        for (const f of ['a.ts', 'a.tsx', 'a.css', 'a.php', 'a.py', 'a.go'])
            expect(isScannable(f)).toBe(true);
    });

    it('skips declarations, vendored and generated trees', () => {
        for (const f of ['a.d.ts', 'node_modules/x/a.ts', 'dist/a.ts', 'vendor/a.php', 'a.md'])
            expect(isScannable(f)).toBe(false);
    });
});
