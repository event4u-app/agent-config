#!/usr/bin/env node
/**
 * Make a change to what ships a diff a reviewer reads.
 *
 * THE DEFECT. Two surfaces decide the published payload — `package.json`
 * `files[]` and `.npmignore` — and nothing compared them or noticed when one
 * changed. Editing what ships is legitimate; editing it invisibly is not, and a
 * 26-root allowlist plus a 27-line ignore file is exactly the shape nobody
 * re-reads.
 *
 * THE ARTEFACT IS NOT A COPY OF THE TWO FILES. Copying them would move the
 * problem: a reviewer would still have to know which of the two wins. It
 * records the resolved surface plus the one fact that is genuinely surprising —
 * **`files[]` is an allowlist and it overrides `.npmignore` for anything under
 * an included root.** That was measured, not assumed: an attempt to strip
 * compiled test artefacts via `.npmignore` had NO effect, because `dist/` is an
 * included root; the strip only worked as `!` negations inside `files[]`. So
 * every `.npmignore` pattern is classified against the live payload, and a
 * pattern the payload contradicts is reported SHADOWED rather than listed as
 * though it were doing something.
 *
 * `--write` regenerates. Default checks. The check compares the artefact to the
 * live config, so a stale artefact is the failure rather than the resting state.
 *
 * Exit: 0 in sync, 1 on drift, 2 on a usage error or a dead scope.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelfTest } from './_lib/gate_self_test.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const ARTEFACT = path.join(REPO_ROOT, 'src/config/publish-surface.json');

export interface PublishSurface {
    _comment: string;
    /** Positive `files[]` entries — the allowlist roots. */
    roots: string[];
    /** `!`-prefixed `files[]` entries — the only way to remove from a root. */
    negations: string[];
    /** `.npmignore` patterns, comments and blanks dropped. */
    npmignore: string[];
    /**
     * `.npmignore` patterns the live payload contradicts — the rule is present
     * and not doing what its author expected.
     *
     * INFORMATIONAL, and excluded from the drift verdict. It is derived from the
     * live payload, so it is tree-dependent in principle: a built tree ships
     * `dist/cli/**` and an unbuilt one does not. Comparing it would make the
     * gate red for anyone whose build state differs from whoever last
     * regenerated the artefact — the exact false-drift shape the content-class
     * check had to close with `measured_in`.
     *
     * Measured in both states on 2026-08-22 and identical (`['agents/']`), so
     * the tolerance is not covering a known difference; it is refusing to assert
     * one it cannot control.
     */
    npmignore_shadowed: string[];
    /** Which tree the shadowed set above was measured in. */
    shadowed_measured_in: string;
}

/** Strip comments and blanks; keep author order, because order is reviewable. */
export function parseNpmignore(text: string): string[] {
    return text
        .split('\n')
        .map((l) => l.replace(/\r$/, '').trim())
        .filter((l) => l !== '' && !l.startsWith('#'));
}

/**
 * Does an `.npmignore` pattern match a payload path?
 *
 * Deliberately a narrow subset of gitignore semantics — a leading double-star segment, a
 * trailing `/` for a directory, and `*` inside a segment. A full matcher would
 * be a dependency, and the classification only has to be right about the
 * patterns this file actually uses; a pattern it cannot model is reported as
 * not-shadowed, which is the conservative direction (it never claims a rule is
 * inert without a payload path to prove it).
 */
export function npmignoreMatches(pattern: string, payloadPath: string): boolean {
    let p = pattern;
    const anchored = p.startsWith('/');
    if (anchored) p = p.slice(1);
    const dirOnly = p.endsWith('/');
    if (dirOnly) p = p.slice(0, -1);
    const anySegment = p.startsWith('**/');
    if (anySegment) p = p.slice(3);
    const rx = new RegExp(
        `${anchored ? '^' : anySegment ? '(^|/)' : '(^|/)'}${p
            .split('*')
            .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
            .join('[^/]*')}${dirOnly ? '/' : '($|/)'}`,
    );
    return rx.test(payloadPath);
}

export function packPayload(root: string): string[] {
    const out = spawnSync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
        cwd: root,
        encoding: 'utf-8',
        maxBuffer: 64 * 1024 * 1024,
    });
    if (out.status !== 0 || typeof out.stdout !== 'string') return [];
    const i = out.stdout.indexOf('[');
    if (i < 0) return [];
    try {
        const parsed = JSON.parse(out.stdout.slice(i)) as { files?: { path?: unknown }[] }[];
        const files = Array.isArray(parsed[0]?.files) ? (parsed[0]?.files ?? []) : [];
        return files.map((f) => (typeof f.path === 'string' ? f.path : '')).filter((s) => s !== '');
    } catch {
        return [];
    }
}

export function buildSurface(root: string, payload: readonly string[]): PublishSurface {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) as {
        files?: string[];
    };
    const entries = pkg.files ?? [];
    const ignPath = path.join(root, '.npmignore');
    const npmignore = fs.existsSync(ignPath) ? parseNpmignore(fs.readFileSync(ignPath, 'utf-8')) : [];
    const shadowed = npmignore.filter((pat) => payload.some((p) => npmignoreMatches(pat, p)));
    return {
        _comment:
            'GENERATED by src/scripts/check_publish_surface.ts --write. Do not hand-edit. ' +
            'It records the resolved publish surface so a change to what ships is a diff a reviewer reads. ' +
            '`files[]` is an ALLOWLIST and it overrides .npmignore for anything under an included root — ' +
            'measured, after an attempt to strip compiled test artefacts via .npmignore had no effect because ' +
            'dist/ is an included root. That is why `negations` exists and why `npmignore_shadowed` is reported: ' +
            'a pattern the live payload contradicts is present and not doing what its author expected.',
        roots: entries.filter((e) => !e.startsWith('!')),
        negations: entries.filter((e) => e.startsWith('!')),
        npmignore,
        npmignore_shadowed: shadowed,
        shadowed_measured_in:
            payload.some((p) => p.startsWith('dist/cli/'))
                ? 'built tree (payload carries dist/cli/**)'
                : 'unbuilt tree (payload carries no dist/cli/**)',
    };
}

/**
 * The fields the drift verdict compares — everything read from a FILE, nothing
 * derived from the payload. See `npmignore_shadowed`.
 */
export function driftKey(s: PublishSurface): string {
    return `${JSON.stringify({ roots: s.roots, negations: s.negations, npmignore: s.npmignore }, null, 2)}\n`;
}

function render(s: PublishSurface): string {
    return `${JSON.stringify(s, null, 2)}\n`;
}

function selfTest(): number {
    return runSelfTest({
        gate: 'check_publish_surface',
        minCases: 7,
        minRejectCases: 4,
        cases: [
            {
                name: 'a directory pattern matches a path under it',
                expect: 'reject',
                run: () => (npmignoreMatches('agents/', 'agents/roadmaps/x.md') ? 1 : 0),
            },
            {
                name: 'a double-star-prefixed pattern matches at any depth',
                expect: 'reject',
                run: () => (npmignoreMatches('**/*.pyc', 'src/a/b/c.pyc') ? 1 : 0),
            },
            {
                name: 'a bare filename matches at any depth',
                expect: 'reject',
                run: () => (npmignoreMatches('.DS_Store', 'docs/.DS_Store') ? 1 : 0),
            },
            {
                name: 'a `*` glob stays within one segment',
                expect: 'reject',
                run: () => (npmignoreMatches('*.swp', 'a.swp') ? 1 : 0),
            },
            {
                // The counter-test: a segment glob must NOT cross a slash, or
                // every pattern would match everything and the whole
                // shadowed-set would be noise.
                //
                // The first version of this case asserted that `*.swp` does not
                // match `a.swp/b.txt` — which is wrong, and the self-test caught
                // it: gitignore semantics say `*.swp` matches a DIRECTORY of
                // that name and everything under it, so the matcher was right
                // and the fixture was not. `a*b` vs `a/x/b` tests the property
                // the case was reaching for without the ambiguity.
                name: 'a `*` glob does not cross a slash',
                expect: 'accept',
                run: () => (npmignoreMatches('a*b', 'a/x/b') ? 1 : 0),
            },
            {
                name: 'a directory pattern does not match a same-named file',
                expect: 'accept',
                run: () => (npmignoreMatches('vendor/', 'vendor') ? 1 : 0),
            },
            {
                name: 'an unrelated pattern matches nothing',
                expect: 'accept',
                run: () => (npmignoreMatches('composer.lock', 'src/scripts/x.ts') ? 1 : 0),
            },
            {
                // Drift detection itself: the shadowed set must react to the
                // payload, not just to the file. A pattern with no payload
                // match is not shadowed.
                name: 'shadowed is computed against the payload, not asserted',
                expect: 'reject',
                run: () => {
                    const withHit = buildSurfaceFrom(['agents/'], ['agents/x.md']);
                    const without = buildSurfaceFrom(['agents/'], ['src/x.ts']);
                    return withHit.length === 1 && without.length === 0 ? 1 : 0;
                },
            },
        ],
    });
}

/** Test seam: the shadowed computation alone, with no filesystem. */
export function buildSurfaceFrom(npmignore: readonly string[], payload: readonly string[]): string[] {
    return npmignore.filter((pat) => payload.some((p) => npmignoreMatches(pat, p)));
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();
    const payload = packPayload(REPO_ROOT);
    try {
        assertScanned({
            gate: 'check_publish_surface',
            scanned: payload.length,
            units: 'packed file(s)',
            roots: ['npm pack --dry-run --ignore-scripts payload (package.json files[])'],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  publish surface: ${err.message}\n`);
            return 2;
        }
        throw err;
    }
    process.stdout.write(`scanned: ${String(payload.length)}\n`);
    const live = render(buildSurface(REPO_ROOT, payload));
    if (argv.includes('--write')) {
        fs.writeFileSync(ARTEFACT, live);
        process.stdout.write(`✅  publish surface written to ${path.relative(REPO_ROOT, ARTEFACT)}\n`);
        return 0;
    }
    if (!fs.existsSync(ARTEFACT)) {
        process.stderr.write(
            `❌  publish surface: ${path.relative(REPO_ROOT, ARTEFACT)} is missing — run with --write\n`,
        );
        return 1;
    }
    const committed = fs.readFileSync(ARTEFACT, 'utf-8');
    let committedKey: string;
    try {
        committedKey = driftKey(JSON.parse(committed) as PublishSurface);
    } catch {
        process.stderr.write(`❌  publish surface: ${path.relative(REPO_ROOT, ARTEFACT)} is not valid JSON\n`);
        return 1;
    }
    if (committedKey === driftKey(buildSurface(REPO_ROOT, payload))) {
        if (committed !== live) {
            // The tree-independent surface matches; only the payload-derived
            // shadowed set differs, which a different build state explains.
            // Said out loud rather than swallowed: a silent difference between
            // the committed artefact and the live one is the thing this gate
            // exists to make visible, even when it is not a failure.
            process.stdout.write(
                '⚠️  publish surface: files[] and .npmignore match, but the payload-derived\n' +
                    '    shadowed set differs — a different build state, not drift in what ships.\n' +
                    '    Regenerate with --write if you want the artefact to record THIS tree.\n',
            );
        }
        process.stdout.write('✅  publish surface in sync with package.json files[] + .npmignore.\n');
        return 0;
    }
    process.stderr.write(
        '❌  publish surface drifted: what ships changed and the committed artefact did not.\n' +
            '    Changing what ships is legitimate; changing it without the artefact moving is the defect,\n' +
            '    because the change is then invisible in review. Run:\n' +
            '      ./scripts-run src/scripts/check_publish_surface --write\n' +
            '    and commit the diff alongside the package.json / .npmignore edit that caused it.\n',
    );
    return 1;
}

if (process.argv[1] !== undefined && process.argv[1].includes('check_publish_surface')) {
    process.exit(main(process.argv.slice(2)));
}
