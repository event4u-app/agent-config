#!/usr/bin/env tsx
/**
 * compile_hook_manifest — writes `src/scripts/hook_manifest.json` from
 * `src/scripts/hook_manifest.yaml`.
 *
 * WHY the compiled sibling exists: `dispatch_hook._load_yaml` runs on EVERY
 * hook dispatch, and parsing the ~61 kB YAML manifest measured 12 ms plus 8 ms
 * to load the `yaml` module — a fifth of a ~103 ms dispatch spent re-deriving a
 * table that does not change between runs. The compiled form is the same data
 * with comments stripped (~15 kB) and parses in under a millisecond. Measured
 * effect on `pre_tool_use` p50, one machine, n=50: 103 ms → 81 ms.
 *
 * The `fingerprint` field is what makes the fast path SAFE rather than merely
 * fast, and it is deliberately content-derived. The first version compared
 * mtimes and that was a measured defect: on a fresh `actions/checkout` both
 * files carry the checkout timestamp in whatever order git wrote them, so
 * whether the optimisation applied was a coin flip — it won on a PR run
 * (p95 129 ms) and lost on the trunk (p95 186 ms) for the same commit.
 *
 * The fingerprint helper is IMPORTED from the reader rather than reimplemented
 * here, so the writer and the reader cannot drift apart.
 *
 * Run after editing the manifest:
 *     ./scripts-run src/scripts/compile_hook_manifest
 *
 * `tests/hooks/hook_manifest_compiled.test.ts` fails if the committed JSON
 * stops matching the YAML, so a forgotten run is caught rather than shipped.
 *
 * Exit codes: 0 written (or already current) · 2 internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { _manifest_fingerprint } from './hooks/dispatch_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const YAML_PATH = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');
const JSON_PATH = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.json');

export function compile(yamlText: string): string {
    return JSON.stringify({
        fingerprint: _manifest_fingerprint(yamlText),
        manifest: parseYaml(yamlText, { version: '1.1' }) as unknown,
    });
}

export function main(): number {
    const text = fs.readFileSync(YAML_PATH, 'utf-8');
    const next = compile(text);
    const current = fs.existsSync(JSON_PATH) ? fs.readFileSync(JSON_PATH, 'utf-8') : null;
    if (current === next) {
        process.stdout.write('compile_hook_manifest: already current\n');
        return 0;
    }
    fs.writeFileSync(JSON_PATH, next);
    process.stdout.write(
        `compile_hook_manifest: wrote ${path.relative(REPO_ROOT, JSON_PATH)} ` +
            `(${String(next.length)} bytes, fingerprint ${_manifest_fingerprint(text)})\n`,
    );
    return 0;
}

if (process.argv[1] !== undefined && fs.realpathSync(process.argv[1]).includes('compile_hook_manifest')) {
    process.exit(main());
}
