/**
 * Shared ADR frontmatter reader — coverage.
 *
 * The load-bearing test is `corpus equivalence`: the shared reader is run over
 * every real ADR alongside a verbatim copy of each parser it replaces, and the
 * scalar views must match key-for-key. A refactor of a parser three call sites
 * depend on is only safe if it is provably the same function on the input that
 * exists, and a hand-written fixture cannot establish that — the corpus can.
 *
 * The nested cases then cover what the old parsers could NOT do, and the
 * negative cases pin the discriminations that make the new behaviour a
 * decision rather than an accident.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    evidenceOf,
    hasProvisionalAuthority,
    provenanceOf,
    readAdrFrontmatter,
    readAdrFrontmatterScalars,
} from './adr_frontmatter.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const DECISIONS = path.join(REPO_ROOT, 'docs', 'decisions');

/** Verbatim copy of the parser `check_adr_frontmatter.ts` carried. */
function legacyStrictParser(text: string): Record<string, string> | null {
    if (!text.startsWith('---\n')) return null;
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) return null;
    const out: Record<string, string> = {};
    let key: string | null = null;
    for (const raw of text.slice(4, end).split('\n')) {
        const line = raw.replace(/\s+$/, '');
        if (!line || line.trimStart().startsWith('#')) continue;
        if (/^\s/.test(line) && key) {
            out[key] = `${out[key]} ${line.trim()}`.trim();
            continue;
        }
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        key = line.slice(0, idx).trim();
        out[key] = line
            .slice(idx + 1)
            .trim()
            .replace(/^["'](.*)["']$/, '$1');
    }
    return out;
}

/** Verbatim copy of the parser `adr_cite_check.ts` carried (adds the `>-` strip). */
function legacyCiteParser(text: string): Record<string, string> | null {
    if (!text.startsWith('---\n')) return null;
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) return null;
    const out: Record<string, string> = {};
    let key: string | null = null;
    for (const raw of text.slice(4, end).split('\n')) {
        const line = raw.replace(/\s+$/, '');
        if (!line || line.trimStart().startsWith('#')) continue;
        if (/^\s/.test(line) && key !== null) {
            out[key] = `${out[key]} ${line.trim()}`.trim();
            continue;
        }
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        key = line.slice(0, idx).trim();
        out[key] = line
            .slice(idx + 1)
            .trim()
            .replace(/^["'](.*)["']$/, '$1')
            .replace(/^>-?$/, '');
    }
    return out;
}

function adrFiles(): string[] {
    return readdirSync(DECISIONS)
        .filter((name) => /^ADR-.*\.md$/.test(name))
        .sort()
        .map((name) => path.join(DECISIONS, name));
}

describe('corpus equivalence with the parsers it replaces', () => {
    const files = adrFiles();

    it('finds the corpus (guards against a silently empty sweep)', () => {
        expect(files.length).toBeGreaterThan(150);
    });

    it('matches the cite parser key-for-key on every real ADR', () => {
        const divergent: string[] = [];
        for (const file of files) {
            const text = readFileSync(file, 'utf8');
            const legacy = legacyCiteParser(text);
            const shared = readAdrFrontmatterScalars(text);
            if (legacy === null || shared === null) {
                if (legacy !== shared) divergent.push(`${path.basename(file)}: null-ness differs`);
                continue;
            }
            for (const [key, value] of Object.entries(legacy)) {
                if (shared[key] !== value) {
                    divergent.push(`${path.basename(file)}#${key}: ${JSON.stringify(value)} vs ${JSON.stringify(shared[key])}`);
                }
            }
        }
        expect(divergent).toEqual([]);
    });

    it('matches the strict parser on every real ADR, modulo the documented `>-` strip', () => {
        const divergent: string[] = [];
        for (const file of files) {
            const text = readFileSync(file, 'utf8');
            const legacy = legacyStrictParser(text);
            const shared = readAdrFrontmatterScalars(text);
            if (legacy === null || shared === null) continue;
            for (const [key, value] of Object.entries(legacy)) {
                // The strict parser kept the fold marker and then folded the
                // block onto it (`>- Reopen when …`); the cite parser stripped
                // it, and the shared reader keeps the cite behaviour. That is
                // the one intended divergence, so it is normalised here and
                // named rather than smoothed away.
                const normalised = value.replace(/^\|[-+]?\s*|^>[-+]?\s*/, '');
                if (shared[key] !== normalised) {
                    divergent.push(`${path.basename(file)}#${key}`);
                }
            }
        }
        expect(divergent).toEqual([]);
    });
});

describe('scalar behaviour preserved', () => {
    it('reads plain scalars and strips quotes', () => {
        const fm = readAdrFrontmatter('---\nadr: 238\nstatus: "accepted"\n---\nbody\n');
        expect(fm?.scalars.adr).toBe('238');
        expect(fm?.scalars.status).toBe('accepted');
    });

    it('folds a >- block into one scalar', () => {
        const fm = readAdrFrontmatter(
            '---\nreview_trigger: >-\n  Reopen when the standard is withdrawn\n  or the contract is retired.\n---\n',
        );
        expect(fm?.scalars.review_trigger).toBe('Reopen when the standard is withdrawn or the contract is retired.');
    });

    it('folds an unmarked indented continuation, as the old readers did', () => {
        const fm = readAdrFrontmatter('---\ndecision: a-long\n  slug-continued\n---\n');
        expect(fm?.scalars.decision).toBe('a-long slug-continued');
    });

    it('returns null when there is no frontmatter at all', () => {
        expect(readAdrFrontmatter('# ADR 0001 — per-area\n\n> Area: `router`\n')).toBeNull();
    });

    it('skips comment lines', () => {
        const fm = readAdrFrontmatter('---\n# a comment\nadr: 1\n---\n');
        expect(fm?.scalars.adr).toBe('1');
        expect(fm?.keyOrder).toEqual(['adr']);
    });
});

describe('nested axes — what three parsers could not read', () => {
    const doc = [
        '---',
        'adr: 238',
        'status: accepted',
        'provenance:',
        '  kind: agentic',
        '  decision_makers: [claude-sonnet-4-5, gpt-4o]',
        '  human_directed: false',
        '  agentic_mode: council',
        'evidence:',
        '  strength: E1',
        '  discovery: incomplete',
        '  basis:',
        '    - docs/CLAIMS.md#code-graph-retrieval-null',
        '    - ADR-229:52',
        'authority_basis: evidence',
        '---',
        'body',
        '',
    ].join('\n');

    it('parses a nested map', () => {
        const p = provenanceOf(readAdrFrontmatter(doc)!);
        expect(p).toEqual({
            kind: 'agentic',
            decisionMakers: ['claude-sonnet-4-5', 'gpt-4o'],
            humanDirected: 'false',
            agenticMode: 'council',
        });
    });

    it('parses an inline list and a block list in the same record', () => {
        const e = evidenceOf(readAdrFrontmatter(doc)!);
        expect(e?.strength).toBe('E1');
        expect(e?.discovery).toBe('incomplete');
        expect(e?.basis).toEqual(['docs/CLAIMS.md#code-graph-retrieval-null', 'ADR-229:52']);
    });

    it('keeps nested keys out of the scalar map', () => {
        const fm = readAdrFrontmatter(doc)!;
        expect(fm.scalars.provenance).toBeUndefined();
        expect(fm.scalars.evidence).toBeUndefined();
        expect(fm.scalars.status).toBe('accepted');
        expect(fm.scalars.authority_basis).toBe('evidence');
    });

    it('round-trips a nested record through the scalar view without losing the key', () => {
        // The index reader only knows scalars; an absent key and an empty key
        // print differently there, so the folded form has to be non-empty.
        const flat = readAdrFrontmatterScalars(doc)!;
        expect(flat.provenance).toContain('kind: agentic');
        expect(flat.evidence).toContain('strength: E1');
    });

    it('reads an empty inline list as an empty list, not as absent', () => {
        const fm = readAdrFrontmatter('---\nevidence:\n  strength: E0\n  basis: []\n---\n')!;
        expect(evidenceOf(fm)?.basis).toEqual([]);
        expect(evidenceOf(fm)?.strength).toBe('E0');
    });
});

describe('negative cases — the discriminations are decisions, not accidents', () => {
    it('does not turn a folded scalar into a map even when its prose contains a colon', () => {
        const fm = readAdrFrontmatter(
            '---\nreview_trigger: >-\n  Reopen when: the standard is withdrawn.\n---\n',
        )!;
        expect(fm.nested.review_trigger).toBeUndefined();
        expect(fm.scalars.review_trigger).toBe('Reopen when: the standard is withdrawn.');
    });

    it('reports a missing axis as null rather than inventing a default', () => {
        const fm = readAdrFrontmatter('---\nadr: 1\nstatus: accepted\n---\n')!;
        expect(provenanceOf(fm)).toBeNull();
        expect(evidenceOf(fm)).toBeNull();
    });

    it('reports a malformed axis as null rather than half-reading it', () => {
        const fm = readAdrFrontmatter('---\nprovenance: agentic\n---\n')!;
        // A scalar where a map belongs: the accessor refuses it, and the raw
        // value stays visible in `scalars` so a linter can report the shape.
        expect(provenanceOf(fm)).toBeNull();
        expect(fm.scalars.provenance).toBe('agentic');
    });

    it('drops an orphan indented line instead of attaching it to nothing', () => {
        const fm = readAdrFrontmatter('---\n  orphan: value\nadr: 1\n---\n')!;
        expect(fm.scalars.orphan).toBeUndefined();
        expect(fm.scalars.adr).toBe('1');
    });
});

describe('provisional authority', () => {
    function build(status: string, kind: string, strength: string): string {
        return [
            '---',
            `status: ${status}`,
            'provenance:',
            `  kind: ${kind}`,
            'evidence:',
            `  strength: ${strength}`,
            '  discovery: incomplete',
            '---',
            '',
        ].join('\n');
    }

    it('fires on an accepted agentic E0 record', () => {
        expect(hasProvisionalAuthority(readAdrFrontmatter(build('accepted', 'agentic', 'E0'))!)).toBe(true);
    });

    it('fires on an accepted agentic E1 record', () => {
        expect(hasProvisionalAuthority(readAdrFrontmatter(build('accepted', 'agentic', 'E1'))!)).toBe(true);
    });

    it('does NOT fire on E2 — the grade boundary is the whole point', () => {
        expect(hasProvisionalAuthority(readAdrFrontmatter(build('accepted', 'agentic', 'E2'))!)).toBe(false);
    });

    it('does NOT fire on a human E0 record — provenance is a separate axis', () => {
        expect(hasProvisionalAuthority(readAdrFrontmatter(build('accepted', 'human', 'E0'))!)).toBe(false);
    });

    it('does NOT fire on a superseded record', () => {
        expect(hasProvisionalAuthority(readAdrFrontmatter(build('superseded', 'agentic', 'E0'))!)).toBe(false);
    });

    it('does NOT fire when the axes are absent — silence is not a weak grade', () => {
        expect(hasProvisionalAuthority(readAdrFrontmatter('---\nstatus: accepted\n---\n')!)).toBe(false);
    });
});
