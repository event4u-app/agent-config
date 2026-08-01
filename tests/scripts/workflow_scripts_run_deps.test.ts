import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `./scripts-run` execs `node_modules/.bin/tsx`. A workflow that invokes it
 * without installing dependencies first cannot pass — it dies at exit 127
 * before the gate it wraps ever runs.
 *
 * `release-drift.yml` did exactly that on every scheduled run from at least
 * 2026-07-26 to 2026-07-31: six consecutive daily failures, all
 * "node_modules/.bin/tsx: No such file or directory". The workflow is the only
 * backstop for "release merged but never tagged/published", so its own missing
 * dependency made a real release drift indistinguishable from the daily noise.
 *
 * This is the same class as a gate that scans nothing and exits 0 — here it is
 * a gate that scans nothing and exits 127. Both report a state they never
 * measured.
 */
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const WORKFLOW_DIR = path.join(REPO_ROOT, '.github', 'workflows');

function workflowFiles(): string[] {
    if (!fs.existsSync(WORKFLOW_DIR)) return [];
    return fs
        .readdirSync(WORKFLOW_DIR)
        .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
        .sort();
}

/** A workflow "runs scripts-run" only when it appears in a `run:` context. */
function invokesScriptsRun(text: string): boolean {
    return /(^|\s)\.\/scripts-run\s/m.test(text);
}

function installsDeps(text: string): boolean {
    // `npm ci` is the house pattern; accept `npm install` for completeness.
    return /npm\s+(ci|install)\b/.test(text);
}

describe('workflows that call ./scripts-run install their dependencies', () => {
    it('every scripts-run workflow runs npm ci — otherwise it exits 127', () => {
        const offenders: string[] = [];
        for (const f of workflowFiles()) {
            const text = fs.readFileSync(path.join(WORKFLOW_DIR, f), 'utf-8');
            if (invokesScriptsRun(text) && !installsDeps(text)) offenders.push(f);
        }
        expect(offenders).toEqual([]);
    });

    it('release-drift.yml specifically — the workflow this regression came from', () => {
        const p = path.join(WORKFLOW_DIR, 'release-drift.yml');
        expect(fs.existsSync(p)).toBe(true);
        const text = fs.readFileSync(p, 'utf-8');
        expect(invokesScriptsRun(text)).toBe(true);
        expect(installsDeps(text)).toBe(true);
        // The install must come BEFORE the invocation, or it is decoration.
        expect(text.indexOf('npm ci')).toBeLessThan(text.search(/(^|\s)\.\/scripts-run\s/m));
    });

    it('the detector actually fires — a scripts-run workflow without npm ci is caught', () => {
        // Pins the negative direction: without this, a broken matcher would
        // report an empty offender list forever and the test would pass blind.
        const broken = [
            'name: Probe',
            'jobs:',
            '  x:',
            '    steps:',
            '      - run: ./scripts-run src/scripts/whatever',
        ].join('\n');
        expect(invokesScriptsRun(broken)).toBe(true);
        expect(installsDeps(broken)).toBe(false);
    });
});
