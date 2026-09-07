/**
 * A `dist/cli-delegate/` bundle must not outrank the source it was built from.
 *
 * `exec_ts` prefers the precompiled bundle over the `.ts` entry (ADR-204, ~5.7x
 * faster). That is right in a consumer install. In a DEV tree it is a trap: the
 * compiled copy keeps running while the source next to it changes, so an edit is
 * silently ignored and the developer tests a file nobody executes.
 *
 * The discriminator is package-local **tsx**, not the presence of `src/`. This
 * file used to assert the latter, on the premise that a consumer install "ships
 * no `src/`" — it does: files[] carries `src/scripts/` and
 * `src/agent-src/scripts/`. Measured 2026-09-07 on a global 14.21.0 install,
 * 1348 shipped `src/**\/*.ts` were newer than `dist/cli-delegate/cmd_versions.js`,
 * so the guard fired on every consumer command and ADR-204's fast path reached
 * nobody. Where no local tsx exists the fallback is `npx tsx` against the
 * consumer's own npm config — strictly worse than a compile that may lag a
 * source edit no consumer can make.
 *
 * Measured failure, 2026-08-14: a dev-tree bundle built before a
 * `projectStoreSlug` fix carried the old character class (`/[/.]/g`, which
 * leaves `+` intact) while the fixed source carried `/[^A-Za-z0-9-]/g`. In a
 * worktree whose path contained a `+`, `agent-config handoff --list` reported
 * "no recent sessions found for this repo" — the computed transcript-store slug
 * named a directory that does not exist. The same enumeration, invoked through
 * `tsx` against the very same sources, listed ten sessions. Nothing warned; the
 * command simply answered as if the user had no history.
 *
 * `_dispatch.bash` ends by calling `main "$@"`, so it cannot be sourced. The
 * two functions are therefore extracted from the real file and evaluated — the
 * shipped definitions, not a paraphrase — and a separate assertion pins the
 * call site, since an extracted function that nothing calls would pass happily.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DISPATCH = path.join(REPO, 'src', 'scripts', '_dispatch.bash');

/** Pull one top-level `name() { … }` block out of the real dispatcher. */
function extractFunction(source: string, name: string): string {
    const start = source.indexOf(`${name}() {`);
    if (start < 0) throw new Error(`function ${name}() not found in _dispatch.bash`);
    const end = source.indexOf('\n}\n', start);
    if (end < 0) throw new Error(`function ${name}() has no closing brace`);
    return source.slice(start, end + 3);
}

interface Fixture {
    root: string;
    bundle: string;
    source: string;
}

/**
 * A minimal tree with the two paths the guard reads: one `src/**\/*.ts` and one
 * `dist/cli-delegate/<name>.js`. `devTree: false` omits `src/` entirely — that
 * is what a consumer install looks like.
 */
function makeFixture(devTree: boolean, withTsx = true): Fixture {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'delegate-freshness-'));
    if (withTsx) {
        // The dev-tree marker the guard actually reads.
        const binDir = path.join(root, 'node_modules', '.bin');
        fs.mkdirSync(binDir, { recursive: true });
        fs.writeFileSync(path.join(binDir, 'tsx'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    }
    const bundleDir = path.join(root, 'dist', 'cli-delegate');
    fs.mkdirSync(bundleDir, { recursive: true });
    const bundle = path.join(bundleDir, 'cmd_probe.js');
    fs.writeFileSync(bundle, '// bundle\n');

    const source = path.join(root, 'src', 'scripts', '_lib', 'dep.ts');
    if (devTree) {
        fs.mkdirSync(path.dirname(source), { recursive: true });
        fs.writeFileSync(source, '// source\n');
    }
    return { root, bundle, source };
}

/** Set both mtimes explicitly — `newer` decides which side wins. */
function setOrder(fixture: Fixture, newer: 'bundle' | 'source'): void {
    const older = new Date(Date.now() - 60_000);
    const recent = new Date();
    const bundleTime = newer === 'bundle' ? recent : older;
    const sourceTime = newer === 'source' ? recent : older;
    fs.utimesSync(fixture.bundle, bundleTime, bundleTime);
    if (fs.existsSync(fixture.source)) fs.utimesSync(fixture.source, sourceTime, sourceTime);
}

/**
 * Evaluate `cli_delegate_bundle` from the real file against a fixture root and
 * return what it echoed — the bundle path, or '' meaning "use the tsx path".
 */
function resolveBundle(root: string): string {
    const dispatch = fs.readFileSync(DISPATCH, 'utf-8');
    const script = [
        'set -euo pipefail',
        `PACKAGE_ROOT=${JSON.stringify(root)}`,
        extractFunction(dispatch, 'cli_delegate_bundle_is_stale'),
        extractFunction(dispatch, 'cli_delegate_bundle'),
        `cli_delegate_bundle "$PACKAGE_ROOT/src/scripts/_cli/cmd_probe.ts"`,
    ].join('\n');
    return execFileSync('bash', ['-c', script], { encoding: 'utf-8' }).trim();
}

describe('cli_delegate_bundle freshness guard', () => {
    const fixtures: Fixture[] = [];
    const track = (f: Fixture): Fixture => {
        fixtures.push(f);
        return f;
    };

    beforeAll(() => {
        expect(fs.existsSync(DISPATCH)).toBe(true);
    });

    afterAll(() => {
        for (const f of fixtures) fs.rmSync(f.root, { recursive: true, force: true });
    });

    it('uses the bundle when it is newer than the sources', () => {
        const f = track(makeFixture(true));
        setOrder(f, 'bundle');
        expect(resolveBundle(f.root)).toBe(f.bundle);
    });

    it('falls back to tsx when a source is newer than the bundle', () => {
        const f = track(makeFixture(true));
        setOrder(f, 'source');
        // The regression: this returned the stale bundle path, so the dispatcher
        // ran month-old compiled logic against freshly edited sources.
        expect(resolveBundle(f.root)).toBe('');
    });

    it('keeps the consumer fast path — no src/ means no staleness scan', () => {
        const f = track(makeFixture(false, false));
        setOrder(f, 'bundle');
        expect(fs.existsSync(path.join(f.root, 'src'))).toBe(false);
        expect(resolveBundle(f.root)).toBe(f.bundle);
    });

    it('keeps the consumer fast path when src/ IS shipped and newer than the bundle', () => {
        // The shape of a real npm install: `src/` present (files[] ships it),
        // sources newer than the prepack-built bundle, and NO package-local tsx.
        // Before the tsx discriminator this returned '' — every delegate command
        // in every published install fell through to `npx tsx`.
        const f = track(makeFixture(true, false));
        setOrder(f, 'source');
        expect(fs.existsSync(path.join(f.root, 'src'))).toBe(true);
        expect(fs.existsSync(path.join(f.root, 'node_modules', '.bin', 'tsx'))).toBe(false);
        expect(resolveBundle(f.root)).toBe(f.bundle);
    });

    it('scans src/ whole, not just the entry point directory', () => {
        // The slug defect lived in src/scripts/_lib/, two hops from the _cli
        // entry; a later narrowing of the scan would silently reopen it.
        const f = track(makeFixture(true));
        const outside = path.join(f.root, 'src', 'shared', 'far.ts');
        fs.mkdirSync(path.dirname(outside), { recursive: true });
        fs.writeFileSync(outside, '// far from _cli\n');
        // Everything the narrow scan would have covered is OLDER than the
        // bundle; only the far file is newer. `find -newer` is strict, so the
        // two sides must not share a timestamp — hence explicit times here
        // rather than setOrder's two-value scheme.
        const old = new Date(Date.now() - 60_000);
        fs.utimesSync(f.source, old, old);
        fs.utimesSync(f.bundle, old, old);
        const recent = new Date();
        fs.utimesSync(outside, recent, recent);
        expect(resolveBundle(f.root)).toBe('');
    });

    it('is actually wired into the bundle resolver', () => {
        // An extracted function nothing calls would pass every test above.
        const dispatch = fs.readFileSync(DISPATCH, 'utf-8');
        const resolver = extractFunction(dispatch, 'cli_delegate_bundle');
        expect(resolver).toContain('cli_delegate_bundle_is_stale');
    });
});
