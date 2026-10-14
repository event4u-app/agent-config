import * as fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { run_scenario, SCENARIOS } from '../../src/scripts/release_drill.js';
import {
    AUGMENT_MARKETPLACE_JSON,
    AUGMENT_PLUGIN_JSON,
    CHANGELOG,
    MARKETPLACE_JSON,
    PACKAGE_JSON,
    PACKAGE_LOCK_JSON,
    PROJECT_TEMPLATE,
} from '../../src/scripts/release_env.js';

// The release step machinery (execute()) ran nowhere except live until
// 2026-08-03, when three orchestration bugs fired mid-release in one week.
// This suite runs the REAL execute() against the drill's simulated git/gh
// world — one test per scenario, so a regression names the exact failure
// mode it reintroduced.
describe('release drill — execute() against the simulated world', () => {
    for (const [name, scenario] of Object.entries(SCENARIOS)) {
        it(`${name} — ${scenario.summary}`, () => {
            const outcome = run_scenario(name);
            expect(outcome.failures, outcome.error ?? '').toEqual([]);
        });
    }

    // Snapshot-and-restore left the real files correct AFTER a run, but every
    // write in between was visible to the other vitest workers. `writeFileSync`
    // truncates before it writes, and a suite collected in that window read the
    // repository's package.json as empty (CI run 38555715168, job 115824218308:
    // `JSONError { path: ".../package.json", message: "File is empty" }`). A
    // restore cannot fix a window; only never writing the real file can.
    it('a step-2 run never writes the real tree, so no concurrent reader sees it mid-bump', () => {
        const writing = Object.entries(SCENARIOS).filter(([, s]) => s.config.resume === false);
        expect(writing.length).toBeGreaterThan(0);
        const files = [
            CHANGELOG,
            PACKAGE_JSON,
            PACKAGE_LOCK_JSON,
            MARKETPLACE_JSON,
            AUGMENT_PLUGIN_JSON,
            AUGMENT_MARKETPLACE_JSON,
            PROJECT_TEMPLATE,
        ].filter((f) => fs.existsSync(f));
        const stamp = (): string[] => files.map((f) => `${f}:${fs.statSync(f).mtimeMs}`);
        const before = stamp();
        for (const [name] of writing) {
            expect(run_scenario(name).failures, name).toEqual([]);
        }
        expect(stamp()).toEqual(before);
    });

    it('covers both measured 2026-08-03 incidents by name', () => {
        expect(Object.keys(SCENARIOS)).toContain('push-rejected-then-recover');
        expect(Object.keys(SCENARIOS)).toContain('behind-then-merge');
    });
});
