// The format column of `docs/enforcement-by-host.md`, and the four properties
// that make a checked cell different from a hand-maintained one.
//
// First, the historical defect must be caught. `.cursorrules` was in the Cursor
// cell from the day the table was written until 2026-09-29, and nothing in this
// tree has ever written that file. A gate that does not reject it on sight is
// not the gate this file is about.
//
// Second, the oracle must be MEASURED where it can be. `measuredEmitterSurfaces`
// runs the two install-time emitters and reads what they left on disk, so a
// target built by interpolation still lands in the set. Scraping the emitter's
// source is the failure this replaces: it cannot see an interpolated path, so
// it reports a correct cell as drift, and a gate that reds on a true row gets
// disabled.
//
// Third, the anchor set must NOT be refineable, and this is the one the gate's
// own self-test found. `USER_SCOPE_PATHS` carries `~/.cursor/` — a whole tool's
// home. Treated as a root anything may refine, it accepts every path beneath it,
// including `.cursor/rules.mdc`, which no emitter writes. Exact match only.
//
// Fourth, an empty corpus must fail. A document whose table header moved yields
// zero cells, and a gate that read nothing has not passed.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    DOC_REL,
    TABLE_HEADER,
    anchorDirs,
    declaredRoots,
    looksLikePath,
    matchesSurface,
    measuredEmitterSurfaces,
    normalizeSurface,
    parseFormatColumn,
    unemittedTokens,
} from '../../src/scripts/check_host_format_column.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

function realDoc(): string {
    return fs.readFileSync(path.join(REPO_ROOT, DOC_REL), 'utf-8');
}

/** The oracle the gate itself builds, assembled once for the assertions below. */
function oracle(): { roots: string[]; anchors: string[] } {
    return {
        roots: [...new Set([...measuredEmitterSurfaces(), ...declaredRoots()])],
        anchors: anchorDirs(),
    };
}

describe('rejects the defect it was built for', () => {
    it('flags `.cursorrules`, which no emitter in this tree writes', () => {
        const { roots, anchors } = oracle();
        const cells = [{ host: 'Cursor', cell: '✅ `.cursorrules`', tokens: ['.cursorrules'] }];
        expect(unemittedTokens(cells, roots, anchors)).toEqual([
            { host: 'Cursor', token: '.cursorrules' },
        ]);
    });

    it('accepts the path that replaced it', () => {
        const { roots, anchors } = oracle();
        const cells = [
            { host: 'Cursor', cell: 'x', tokens: ['.cursor/rules/*.mdc'] },
        ];
        expect(unemittedTokens(cells, roots, anchors)).toEqual([]);
    });

    it('leaves the neighbouring rows the roadmap warned about alone', () => {
        // `emitWindsurf` really does write a concatenated `.windsurfrules`, and
        // `.clinerules` really is a projection target. A gate that swept the
        // whole column would replace two true cells with two false ones.
        const { roots, anchors } = oracle();
        const cells = [
            { host: 'Windsurf', cell: 'x', tokens: ['.windsurfrules'] },
            { host: 'Cline', cell: 'x', tokens: ['.clinerules'] },
        ];
        expect(unemittedTokens(cells, roots, anchors)).toEqual([]);
    });
});

describe('the oracle is measured, not scraped', () => {
    it('runs the emitters and reports what they actually wrote', () => {
        const measured = measuredEmitterSurfaces();
        // Both install-time emitters, by their real output shape rather than by
        // a literal copied out of their source.
        expect(measured.some((p) => /^\.cursor\/rules\/.+\.mdc$/.test(p))).toBe(true);
        expect(measured.some((p) => /^\.windsurf\/rules\/.+\.md$/.test(p))).toBe(true);
        expect(measured).toContain('.windsurfrules');
    });

    it('writes nothing named `.cursorrules` — the claim the correction rests on', () => {
        expect(measuredEmitterSurfaces()).not.toContain('.cursorrules');
    });
});

describe('user-scope anchors are exact-match only', () => {
    it('accepts a cell naming an anchor itself', () => {
        expect(matchesSurface('~/.codex/', '~/.codex/', false)).toBe(true);
    });

    it('refuses a path merely sitting under an anchor', () => {
        // The defect the gate's own self-test caught: with anchors refineable,
        // `~/.cursor/` vouched for anything beneath `.cursor/`.
        expect(matchesSurface('.cursor/rules.mdc', '~/.cursor/', false)).toBe(false);
        expect(matchesSurface('.cursor/anything-at-all', '~/.cursor/', false)).toBe(false);
    });

    it('still lets an emitted ROOT be refined, which is a different relation', () => {
        expect(matchesSurface('.cursor/rules/*.mdc', '.cursor/rules')).toBe(true);
    });

    it('does not let a root vouch for a sibling that merely shares a prefix', () => {
        expect(matchesSurface('.cursor/rules.mdc', '.cursor/rules')).toBe(false);
    });
});

describe('token selection and normalization', () => {
    it('treats paths as paths and prose as prose', () => {
        expect(looksLikePath('.clinerules')).toBe(true);
        expect(looksLikePath('GEMINI.md')).toBe(true);
        expect(looksLikePath('.cursor/rules/*.mdc')).toBe(true);
        expect(looksLikePath('✅')).toBe(false);
        expect(looksLikePath('native rules')).toBe(false);
    });

    it('normalizes a home anchor and a trailing slash to the same segments', () => {
        expect(normalizeSurface('~/.codex/')).toEqual(['.codex']);
        expect(normalizeSurface('/.codex')).toEqual(['.codex']);
    });

    it('matches a surface named by its filename alone', () => {
        // The Copilot cell says `copilot-instructions.md`; the registry root is
        // `.github/copilot-instructions.md`.
        expect(matchesSurface('copilot-instructions.md', '.github/copilot-instructions.md')).toBe(
            true,
        );
    });
});

describe('parsing the committed table', () => {
    it('reads one cell per host row and no separator row', () => {
        const cells = parseFormatColumn(realDoc());
        expect(cells.length).toBe(9);
        expect(cells.map((c) => c.host)).toContain('Cursor');
        expect(cells.some((c) => /^:?-+:?$/.test(c.host))).toBe(false);
    });

    it('returns an empty corpus when the header is gone, so the scope assertion can fire', () => {
        expect(parseFormatColumn(realDoc().replace(TABLE_HEADER, '| Host | Other |'))).toEqual([]);
    });

    it('the committed document has no unemitted token', () => {
        const { roots, anchors } = oracle();
        expect(unemittedTokens(parseFormatColumn(realDoc()), roots, anchors)).toEqual([]);
    });
});
