#!/usr/bin/env tsx
/**
 * Assert dist/discovery/discovery-manifest.json ships with the package.
 *
 * TypeScript twin of `src/scripts/check_release_includes_discovery.py`
 * (ADR-200, Phase 4 / Wave 4c). Mirrors the Python CLI contract EXACTLY —
 * no flags, exit codes (0 OK, 1 die), stdout/stderr split, byte-identical
 * finding messages (paths relative to ROOT), same checks in the same order.
 * No behaviour changes.
 *
 * Phase 5.3 of R3 — wired as a `prepublishOnly` hook in package.json and
 * re-used by the publish workflow. Fails loudly when:
 *   - dist/discovery/discovery-manifest.json is missing
 *   - the file is empty or not valid JSON
 *   - the artefacts array is empty
 *   - the summary sibling is missing (release tarball ships both)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/check_release_includes_discovery.ts → two dirs up is repo root.
// Mirrors Python `Path(__file__).resolve().parents[2]`.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const MANIFEST = path.join(ROOT, 'dist', 'discovery', 'discovery-manifest.json');
const SUMMARY = path.join(ROOT, 'dist', 'discovery', 'discovery-manifest.summary.md');

/** POSIX relative path under ROOT (mirrors `Path.relative_to(ROOT)`). */
function _rel(target: string): string {
    return path.relative(ROOT, target).split(path.sep).join('/');
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _die(msg: string): number {
    process.stderr.write(`check-release-discovery: ${msg}\n`);
    process.stderr.write(
        '  hint: run `./scripts-run src/scripts/build_discovery_manifest --write --strict`' +
            ' before `npm pack` / `npm publish`.\n',
    );
    return 1;
}

function main(): number {
    if (!_isFile(MANIFEST)) {
        return _die(`${_rel(MANIFEST)} is missing.`);
    }
    const raw = fs.readFileSync(MANIFEST, 'utf-8').trim();
    if (raw === '') {
        return _die(`${_rel(MANIFEST)} is empty.`);
    }
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        return _die(`${_rel(MANIFEST)} is not valid JSON: ${msg}.`);
    }
    const artefacts =
        data !== null && typeof data === 'object'
            ? (data as Record<string, unknown>)['artefacts']
            : undefined;
    if (!Array.isArray(artefacts) || artefacts.length === 0) {
        return _die(
            `${_rel(MANIFEST)} carries no artefacts — discovery` +
                ' scanner produced an empty manifest.',
        );
    }
    if (!_isFile(SUMMARY)) {
        return _die(`${_rel(SUMMARY)} is missing.`);
    }
    process.stdout.write(
        `check-release-discovery: OK (${artefacts.length} artefacts in` +
            ` ${_rel(MANIFEST)})\n`,
    );
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { ROOT, MANIFEST, SUMMARY, main };
