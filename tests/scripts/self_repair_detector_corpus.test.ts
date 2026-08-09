// Detector corpus gate (road-to-rule-delivery-integrity P4.3).
//
// Precision and recall are separate obligations and get separate fixture
// classes, per detector:
//
//   fire           — a recorded real failure the detector must catch
//   near-miss-fire — a real failure that looks unlike the canonical one and
//                    must still be caught (recall at the boundary)
//   must-not-fire  — text that superficially matches and must stay silent
//                    (precision)
//
// The gate enumerates `DETECTOR_REGISTRY` — the same list `runDetectors`
// executes — so a detector added to the code without all three fixture
// classes is a red CI run, not a silently untested code path. The corpus
// lives in tests/fixtures/self-repair-detectors/<class>/<fixture-class>.json.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    DETECTOR_REGISTRY,
    type TurnSnapshot,
} from '../../src/scripts/_lib/self_repair.js';

const CORPUS_ROOT = path.resolve(process.cwd(), 'tests', 'fixtures', 'self-repair-detectors');
const FIXTURE_CLASSES = ['fire', 'near-miss-fire', 'must-not-fire'] as const;
type FixtureClass = (typeof FIXTURE_CLASSES)[number];

interface DetectorFixture {
    name: string;
    turn: TurnSnapshot;
}

function fixtureFile(detector: string, cls: FixtureClass): string {
    return path.join(CORPUS_ROOT, detector, `${cls}.json`);
}

function loadFixtures(detector: string, cls: FixtureClass): DetectorFixture[] {
    return JSON.parse(fs.readFileSync(fixtureFile(detector, cls), 'utf-8')) as DetectorFixture[];
}

describe('self-repair — detector corpus gate', () => {
    it('every registered detector carries all three fixture classes, non-empty', () => {
        for (const d of DETECTOR_REGISTRY) {
            for (const cls of FIXTURE_CLASSES) {
                const file = fixtureFile(d.defect_class, cls);
                expect(
                    fs.existsSync(file),
                    `detector '${d.defect_class}' is missing its '${cls}' fixture class ` +
                        `(${path.relative(process.cwd(), file)}) — precision and recall are ` +
                        'separate obligations; a detector ships with all three classes',
                ).toBe(true);
                const fixtures = loadFixtures(d.defect_class, cls);
                expect(
                    Array.isArray(fixtures) && fixtures.length > 0,
                    `detector '${d.defect_class}' has an empty '${cls}' fixture class — ` +
                        'an empty class asserts nothing',
                ).toBe(true);
            }
        }
    });

    it('the corpus mirrors the registry — no orphan fixture directory', () => {
        const dirs = fs
            .readdirSync(CORPUS_ROOT, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => e.name)
            .sort();
        const registered = DETECTOR_REGISTRY.map((d) => d.defect_class).sort();
        expect(dirs).toEqual(registered);
    });

    for (const d of DETECTOR_REGISTRY) {
        describe(`detector: ${d.defect_class}`, () => {
            it('catches every fire fixture', () => {
                for (const f of loadFixtures(d.defect_class, 'fire')) {
                    const finding = d.detect(f.turn);
                    expect(finding, `fire fixture not caught: ${f.name}`).not.toBeNull();
                    expect(finding?.defect_class).toBe(d.defect_class);
                }
            });

            it('catches every near-miss-fire fixture — recall at the boundary', () => {
                for (const f of loadFixtures(d.defect_class, 'near-miss-fire')) {
                    const finding = d.detect(f.turn);
                    expect(finding, `near-miss fixture not caught: ${f.name}`).not.toBeNull();
                    expect(finding?.defect_class).toBe(d.defect_class);
                }
            });

            it('stays silent on every must-not-fire fixture — precision', () => {
                for (const f of loadFixtures(d.defect_class, 'must-not-fire')) {
                    expect(
                        d.detect(f.turn),
                        `must-not-fire fixture produced a finding: ${f.name}`,
                    ).toBeNull();
                }
            });
        });
    }

    it('the roadmap-mandated complaint patterns are present as must-not-fire', () => {
        const prompts = loadFixtures('user-reported', 'must-not-fire').map((f) => f.turn.prompt);
        expect(prompts.some((p) => /du hast nicht zufällig/i.test(p))).toBe(true);
        expect(prompts.some((p) => /didn'?t need to.*it'?s fine/i.test(p))).toBe(true);
    });
});
