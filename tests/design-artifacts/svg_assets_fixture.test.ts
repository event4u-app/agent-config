/**
 * The svg-assets fixture holds itself to its own contract (step 0.1 of
 * `road-to-svg-with-a-witness`).
 *
 * The fixture's whole value rests on one property: a planted file and its twin
 * differ by exactly ONE contiguous changed line region. A rule that fires on
 * the planted file and not on the twin has then been shown to read the defect
 * rather than the file, and a rule that fires on both has been shown not to.
 * A twin that drifted into a second edit silently removes that guarantee while
 * every downstream test still passes, so the guarantee is asserted here rather
 * than assumed.
 *
 * The diff below is a plain LCS over lines with no dependency: a fixture that
 * needed a diff library to prove its own shape would be a worse fixture.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const FIXTURE = path.resolve(__dirname, 'fixtures', 'svg-assets');

type Row = {
    id: string;
    asset_class: string;
    delivery: string;
    layer: string;
    rule: string;
    file: string;
    twin: string;
    twin_kind: string;
    note: string;
};

type Manifest = {
    enums: Record<string, string[]>;
    rows: Row[];
    controls: { id: string; file: string; must_not_report: string[]; note: string }[];
    surgical: {
        id: string;
        before: string;
        allowed_ids: string[];
        good: string;
        bad: string;
        moved_neighbour: string;
        note: string;
    }[];
    conversion: { reference: string; note: string; region_ids: string[] };
    fill_ratio_thresholds: Record<string, number>;
    geometry_tolerances: Record<string, { silhouette_iou_min: number; max_boundary_distance_units: number }>;
    raster_conversion_tolerance: Record<string, unknown>;
};

const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'manifest.json'), 'utf8')) as Manifest;
const readme = fs.readFileSync(path.join(FIXTURE, 'README.md'), 'utf8');

function lines(rel: string): string[] {
    return fs.readFileSync(path.join(FIXTURE, rel), 'utf8').split('\n');
}

/**
 * Line-level edit script. 'eq' consumes one line from each side; a replaced
 * line is emitted as 'del' immediately followed by 'ins', so a replacement
 * stays ONE run rather than becoming two.
 */
function diffOps(a: string[], b: string[]): ('eq' | 'del' | 'ins')[] {
    const n = a.length;
    const m = b.length;
    const dp: Int32Array[] = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i -= 1) {
        for (let j = m - 1; j >= 0; j -= 1) {
            dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    const ops: ('eq' | 'del' | 'ins')[] = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) {
            ops.push('eq');
            i += 1;
            j += 1;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            ops.push('del');
            i += 1;
        } else {
            ops.push('ins');
            j += 1;
        }
    }
    while (i < n) {
        ops.push('del');
        i += 1;
    }
    while (j < m) {
        ops.push('ins');
        j += 1;
    }
    return ops;
}

/** Number of maximal runs of non-'eq' operations. */
function changedHunks(a: string[], b: string[]): number {
    let hunks = 0;
    let inHunk = false;
    for (const op of diffOps(a, b)) {
        if (op === 'eq') {
            inHunk = false;
        } else if (!inHunk) {
            hunks += 1;
            inHunk = true;
        }
    }
    return hunks;
}

function exists(rel: string): boolean {
    return fs.existsSync(path.join(FIXTURE, rel));
}

describe('svg-assets fixture', () => {
    it('every-planted-file-has-a-one-edit-twin', () => {
        expect(manifest.rows.length).toBeGreaterThan(0);

        const missing: string[] = [];
        for (const row of manifest.rows) {
            if (!exists(row.file)) missing.push(`${row.id}: ${row.file}`);
            if (!exists(row.twin)) missing.push(`${row.id}: ${row.twin}`);
        }
        expect(missing).toEqual([]);

        const notOneEdit: string[] = [];
        for (const row of manifest.rows.filter((r) => r.twin_kind === 'one-edit')) {
            const hunks = changedHunks(lines(row.file), lines(row.twin));
            if (hunks !== 1) notOneEdit.push(`${row.id}: ${hunks} changed hunk(s), expected 1`);
        }
        expect(notOneEdit).toEqual([]);

        const structural = manifest.rows.filter((r) => r.twin_kind === 'structural');
        for (const row of structural) {
            expect(row.note.length, `${row.id} must say why it is not one edit`).toBeGreaterThan(60);
            expect(
                /structural|not one edit|file shape/i.test(row.note),
                `${row.id}'s note must name the reason it is structural`,
            ).toBe(true);
        }
    });

    it('declares a known asset class, delivery mode and layer on every row', () => {
        const bad: string[] = [];
        for (const row of manifest.rows) {
            if (!manifest.enums.asset_class.includes(row.asset_class)) bad.push(`${row.id}.asset_class=${row.asset_class}`);
            if (!manifest.enums.delivery.includes(row.delivery)) bad.push(`${row.id}.delivery=${row.delivery}`);
            if (!manifest.enums.layer.includes(row.layer)) bad.push(`${row.id}.layer=${row.layer}`);
            if (!manifest.enums.twin_kind.includes(row.twin_kind)) bad.push(`${row.id}.twin_kind=${row.twin_kind}`);
        }
        expect(bad).toEqual([]);

        const ids = manifest.rows.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('carries one control per named false positive, each naming a rule it must not report', () => {
        expect(manifest.controls.length).toBeGreaterThanOrEqual(3);
        for (const control of manifest.controls) {
            expect(exists(control.file), `${control.id}: ${control.file}`).toBe(true);
            expect(control.must_not_report.length, `${control.id} names no rule`).toBeGreaterThan(0);
        }
    });

    it('carries three surgical triples with a declared allowed set and a named moved neighbour', () => {
        expect(manifest.surgical.length).toBe(3);
        for (const triple of manifest.surgical) {
            for (const rel of [triple.before, triple.good, triple.bad]) {
                expect(exists(rel), `${triple.id}: ${rel}`).toBe(true);
            }
            expect(triple.allowed_ids.length, `${triple.id} declares no allowed id`).toBeGreaterThan(0);
            expect(triple.moved_neighbour.length, `${triple.id} names no moved neighbour`).toBeGreaterThan(0);

            const before = fs.readFileSync(path.join(FIXTURE, triple.before), 'utf8');
            expect(before, `${triple.id}: the moved neighbour must exist in before.svg`).toContain(
                `id="${triple.moved_neighbour}"`,
            );
            for (const allowed of triple.allowed_ids) {
                expect(before, `${triple.id}: the allowed id must exist in before.svg`).toContain(`id="${allowed}"`);
            }
        }
    });

    it('holds a conversion reference that is the ground truth, not a raster', () => {
        const rel = manifest.conversion.reference;
        expect(exists(rel)).toBe(true);
        const body = fs.readFileSync(path.join(FIXTURE, rel), 'utf8');
        expect((body.match(/<image\b/g) ?? []).length).toBe(0);
        for (const region of manifest.conversion.region_ids) {
            expect(body, `the reference must name the ${region} region`).toContain(`id="${region}"`);
        }
        expect(manifest.conversion.region_ids).toEqual(['mark', 'mark-hole', 'wordmark', 'slogan']);
    });

    it('declares a fill-ratio threshold and a geometry tolerance for every asset class', () => {
        for (const cls of manifest.enums.asset_class) {
            expect(typeof manifest.fill_ratio_thresholds[cls], `fill ratio for ${cls}`).toBe('number');
            const tol = manifest.geometry_tolerances[cls];
            expect(typeof tol?.silhouette_iou_min, `IoU tolerance for ${cls}`).toBe('number');
            expect(typeof tol?.max_boundary_distance_units, `boundary tolerance for ${cls}`).toBe('number');
        }
        expect(manifest.raster_conversion_tolerance.silhouette_iou_min).toBe(0.984);
    });

    it('carries the 0.2 baseline table, the 0.3 target table and the 5.2 promotion-bar header', () => {
        expect(readme).toContain("## § Baseline — what today's instruments read (step 0.2)");
        expect(readme).toContain('## § Targets — pre-registered before any checker exists (step 0.3)');

        const bodyLines = readme.split('\n');

        const missingBaselineRow: string[] = [];
        for (const row of manifest.rows) {
            const line = bodyLines.find((l) => l.startsWith('|') && l.includes(`\`${row.file}\``));
            if (!line) {
                missingBaselineRow.push(row.file);
                continue;
            }
            const cells = line
                .split('|')
                .slice(1, -1)
                .map((c) => c.trim());
            if (cells.length < 5 || cells.some((c) => c.length === 0)) {
                missingBaselineRow.push(`${row.file} (empty instrument cell)`);
            }
        }
        expect(missingBaselineRow).toEqual([]);

        const targetHeader = bodyLines.find((l) => l.startsWith('| rule id | layer |'));
        expect(targetHeader, 'the 0.3 target table header is missing').toBeTruthy();
        for (const row of manifest.rows) {
            expect(readme, `the target table must name the ${row.rule} rule`).toContain(`\`${row.rule}\``);
        }

        // Step 5.2's own verify is `grep -cE '^\|\s*rule\s*\|.*twin' … -> /^1$/`, so
        // THAT is what this pins — the shape the clause greps for, and exactly
        // one of it. Freezing the placeholder's literal column list instead
        // would red the moment the real table replaced it, which is the one
        // event the placeholder existed to anticipate. The real table carries a
        // `file` column the placeholder did not, because a rule can be planted
        // in more than one file and the bar is per planted row.
        const promotionMatches = bodyLines.filter((l) => /^\|\s*rule\s*\|.*twin/.test(l));
        expect(promotionMatches.length, '5.2 greps for exactly one such header').toBe(1);
        const promotionHeader = promotionMatches[0] as string;
        for (const column of ['rule', 'true findings on planted', 'twin findings run 1', 'twin findings run 2', 'meets bar']) {
            expect(promotionHeader, `the 5.2 header must carry a "${column}" column`).toContain(column);
        }
    });
});
