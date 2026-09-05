// Canonical-channel regression — docs/contracts/skill-distribution-channels.md.
//
// The contract's Rule says exactly one channel per AI tool is canonical in the
// consumer install (filesystem), and that the Claude plugin manifest is NOT
// projected there unless the user opts in with `--legacy-both`. Until 2026-09-05
// that invariant was held only by a default branch inside `install.sh`: the
// regression the carrier roadmap promised as `tests/test_canonical_distribution.py`
// was never ported and existed under no extension, while `docs/architecture.md`
// still linked it as the proof. The beta review of that contract closed the gap.
//
// BOTH POLARITIES are asserted deliberately. A test that only checks the
// opt-in path would stay green if the default flipped to always-project, which
// is the exact regression this file exists to catch.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const INSTALL_SH = path.join(ROOT, 'src', 'scripts', 'install.sh');
const FN = 'project_legacy_plugin_manifest';

/**
 * Lift the function under test out of `install.sh`.
 *
 * `install.sh` ends in `main "$@"` and carries no source guard, so it cannot be
 * sourced. Extracting the single function keeps the assertion on the real
 * shipped code rather than on a copy that could drift.
 */
function extractFunction(source: string, name: string): string {
    const lines = source.split('\n');
    const start = lines.findIndex((l) => l.startsWith(`${name}() {`));
    if (start === -1) {
        throw new Error(
            `${name}() not found in install.sh — it was renamed or removed. ` +
                'Repoint this test at the new carrier of the canonical-channel invariant; ' +
                'do not delete the test.',
        );
    }
    const end = lines.findIndex((l, i) => i > start && l === '}');
    if (end === -1) {
        throw new Error(`${name}() has no closing brace at column 0`);
    }
    return lines.slice(start, end + 1).join('\n');
}

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'canon-dist-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

/** Run the extracted function against a staged source + consumer tree. */
function runProjection(legacyBoth: boolean): { projected: boolean; stdout: string } {
    const sourceDir = path.join(tmp, 'source');
    const projectRoot = path.join(tmp, 'consumer');
    fs.mkdirSync(path.join(sourceDir, '.claude-plugin'), { recursive: true });
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.writeFileSync(
        path.join(sourceDir, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({ plugins: [] }),
        'utf-8',
    );

    const fn = extractFunction(fs.readFileSync(INSTALL_SH, 'utf-8'), FN);
    const harness = [
        'set -euo pipefail',
        `SOURCE_DIR=${JSON.stringify(sourceDir)}`,
        `LEGACY_BOTH=${legacyBoth}`,
        'DRY_RUN=false',
        // Stubs for the collaborators the function reaches for. `is_tool_enabled`
        // returns true so the test exercises the LEGACY_BOTH branch itself rather
        // than the tool-selection short-circuit.
        'log_verbose() { echo "verbose: $*"; }',
        'log_info() { echo "info: $*"; }',
        'is_tool_enabled() { return 0; }',
        fn,
        `${FN} ${JSON.stringify(projectRoot)}`,
    ].join('\n');

    const script = path.join(tmp, 'harness.sh');
    fs.writeFileSync(script, harness, 'utf-8');
    const stdout = execFileSync('bash', [script], { encoding: 'utf-8' });
    return {
        projected: fs.existsSync(path.join(projectRoot, '.claude-plugin', 'marketplace.json')),
        stdout,
    };
}

describe('canonical distribution channel — filesystem is the only default', () => {
    it('the function under test is still present in install.sh', () => {
        // Guards the silent-green failure: if the extraction ever matched
        // nothing, both assertions below would pass over an empty script.
        const fn = extractFunction(fs.readFileSync(INSTALL_SH, 'utf-8'), FN);
        expect(fn).toContain('LEGACY_BOTH');
        expect(fn).toContain('marketplace.json');
    });

    it('default install does NOT project the Claude plugin manifest', () => {
        const { projected, stdout } = runProjection(false);
        expect(projected).toBe(false);
        expect(stdout).toContain('filesystem is canonical');
    });

    it('--legacy-both opts the manifest back in', () => {
        const { projected } = runProjection(true);
        expect(projected).toBe(true);
    });
});
