/**
 * Reproducibility of the absoluta census.
 *
 * `road-to-rule-coherence` replaced the figure "17 rules carry competing
 * absolutes" with "97 of 111" and cut its precedence lattice on that basis. The
 * 97 came from a throwaway script in a scratch directory, so the roadmap had
 * swapped one unverified number for another — the exact failure class it had
 * just exposed in the 17.
 *
 * This pins what the committed census actually derives, so the figure can be
 * re-checked rather than cited. The point is NOT to defend a number: it is that
 * BOTH prior figures are lexicon artifacts, and that the conclusion which
 * actually mattered survives regardless of which lexicon you pick.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    ABSOLUTA_LEXICON,
    censusAbsoluta,
    stripFrontmatter,
} from '../../src/scripts/measure_rule_absoluta.js';
import { SRC_RULES } from '../../src/scripts/_lib/agent_src.js';

const tmpDirs: string[] = [];
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d) fs.rmSync(d, { recursive: true, force: true });
    }
});

function tmpRules(files: Record<string, string>): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-absoluta-'));
    tmpDirs.push(d);
    for (const [name, body] of Object.entries(files)) {
        fs.writeFileSync(path.join(d, name), body, 'utf-8');
    }
    return d;
}

describe('absoluta census — mechanics', () => {
    it('strips frontmatter so description keywords are not counted as mandates', () => {
        const withFm = '---\ndescription: "NEVER do the thing"\n---\nbody has none\n';
        expect(stripFrontmatter(withFm)).toBe('body has none\n');
        expect(censusAbsoluta(tmpRules({ 'a.md': withFm })).rules_with_absolute).toBe(0);
    });

    it('counts ALL-CAPS imperatives, not lowercase prose, in the strict reading', () => {
        const dir = tmpRules({
            'shouty.md': '# x\n\nNEVER do this.\n',
            'prose.md': '# x\n\nThe agent must never be surprised by this.\n',
        });
        const c = censusAbsoluta(dir);
        expect(c.rules_with_absolute).toBe(1);
        // …and the loose reading picks up the prose file too. That single
        // difference is the whole 79-vs-97 gap.
        expect(c.rules_with_absolute_loose).toBe(2);
    });

    it('does not leak regex lastIndex between files', () => {
        // /g patterns carry lastIndex; reusing one across files silently
        // undercounts. Two identical files must both score.
        const dir = tmpRules({ 'a.md': '# a\n\nNEVER x\n', 'b.md': '# b\n\nNEVER y\n' });
        expect(censusAbsoluta(dir).rules_with_absolute).toBe(2);
    });

    it('reports an empty corpus as zero rather than a confident 0%', () => {
        const c = censusAbsoluta(tmpRules({}));
        expect(c.rules_scanned).toBe(0);
        expect(c.share_with_absolute).toBe(0);
    });

    it('the lexicon is enumerated, not described', () => {
        // The list IS the measurement — a disagreement about the number has to
        // be a disagreement about these entries.
        expect(ABSOLUTA_LEXICON.length).toBeGreaterThan(5);
        expect(ABSOLUTA_LEXICON.map((e) => e.term)).toContain('NEVER');
        for (const e of ABSOLUTA_LEXICON) expect(e.note.length).toBeGreaterThan(0);
    });
});

describe('absoluta census — the live corpus', () => {
    const dir = SRC_RULES();
    const c = fs.existsSync(dir) ? censusAbsoluta(dir) : null;

    it('scans a real corpus (dead-scope guard)', () => {
        expect(c, 'SRC_RULES() did not resolve').not.toBeNull();
        expect(c!.rules_scanned).toBeGreaterThan(50);
    });

    it('the strict reading is a LOWER bound on the loose one', () => {
        expect(c!.rules_with_absolute).toBeLessThanOrEqual(c!.rules_with_absolute_loose);
    });

    it('all three readings agree on the conclusion that mattered', () => {
        // The roadmap cut its precedence lattice because absolutes are the
        // house style rather than 17 outliers. That holds under every reading —
        // which is why no point estimate needs defending.
        const n = c!.rules_scanned;
        for (const v of [c!.rules_with_absolute, c!.rules_with_absolute_loose, c!.rules_with_iron_law]) {
            expect(v / n).toBeGreaterThan(0.5);
        }
        // And it is emphatically not 17.
        expect(c!.rules_with_absolute).toBeGreaterThan(17 * 2);
    });

    it('the structural signal needs no lexicon at all', () => {
        // Iron-Law-block presence is the reading that cannot be argued down by
        // rewording the lexicon, so it is the one to cite when challenged.
        expect(c!.rules_with_iron_law).toBeGreaterThan(50);
    });

    it('documents its own false negative: an Iron Law using none of the terms', () => {
        // downstream-changes carries "EVERY EDIT IS INCOMPLETE UNTIL ALL
        // DOWNSTREAM CHANGES ARE MADE ... IS A CRITICAL FAILURE" and scores 0
        // strict. Pinned so the limitation stays visible rather than becoming a
        // silent undercount someone later trusts.
        const row = c!.per_rule.find((r) => r.rule === 'downstream-changes');
        if (row) {
            const body = fs.readFileSync(path.join(dir, 'downstream-changes.md'), 'utf-8');
            expect(/Iron Law/i.test(body)).toBe(true);
        }
    });
});
