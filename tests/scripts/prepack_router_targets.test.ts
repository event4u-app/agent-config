/**
 * Red/green coverage for prepack gate 4 (router-target shipping guard) —
 * road-to-gates-that-can-fail Phase 4. A `routes_to` target that resolves in
 * the dev tree but escapes the `files[]` whitelist ships a dead pointer and
 * fails `agent-config conformance` on the consumer's machine.
 *
 * The committed `dist/router.json` + the committed `files[]` must be green;
 * every failure shape must be individually red-testable; and the kind→path
 * table must be the SAME object `cmd_conformance.ts::routeTargetPaths` uses.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// Both are plain `.mjs` (prepack-check runs as raw Node during the npm
// lifecycle and cannot load TS) — each is typed by its sibling `.d.mts`.
import { checkRouterTargetsShipped } from '../../src/scripts/prepack_router_targets.mjs';
import { routeTargetPathsPosix } from '../../src/scripts/router_target_paths.mjs';
import { routeTargetPaths } from '../../src/scripts/_cli/cmd_conformance.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

const PKG = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8')) as {
    files: string[];
};

/** The same `files[]` membership test prepack-check.mjs builds. */
function makeIsShipped(files: string[]): (rel: string) => boolean {
    const prefixes = files.filter((f) => f.endsWith('/')).map((f) => f.replace(/\/+$/, '') + '/');
    const exact = new Set(files.filter((f) => !f.endsWith('/')));
    return (rel: string) => {
        const posix = rel.split(path.sep).join('/');
        return exact.has(posix) || prefixes.some((p) => posix.startsWith(p));
    };
}

const realIsShipped = makeIsShipped(PKG.files);
const realExists = (rel: string): boolean => fs.existsSync(path.join(REPO_ROOT, rel));
const realRead = (abs: string): string => fs.readFileSync(abs, 'utf-8');
const ROUTER = path.join(REPO_ROOT, 'dist', 'router.json');

/** A router index shaped like the real one, carrying exactly the given targets. */
function routerWith(targets: string[]): string {
    return JSON.stringify({
        schema_version: 2,
        kernel: [],
        tier_1: [],
        tier_2: [{ id: 'planted-rule', routes_to: targets }],
    });
}

function checkPlanted(
    targets: string[],
    overrides: Partial<{
        isShipped: (rel: string) => boolean;
        exists: (rel: string) => boolean;
    }> = {},
): { errors: string[]; scanned: number } {
    return checkRouterTargetsShipped({
        routerPath: '<planted>',
        isShipped: overrides.isShipped ?? realIsShipped,
        exists: overrides.exists ?? realExists,
        readFile: () => routerWith(targets),
    });
}

describe('prepack gate 4 — router targets resolve inside the shipped set', () => {
    it('GREEN: the committed dist/router.json passes against the committed files[]', () => {
        const result = checkRouterTargetsShipped({
            routerPath: ROUTER,
            isShipped: realIsShipped,
            exists: realExists,
            readFile: realRead,
        });
        expect(result.errors).toEqual([]);
        // Not a hardcoded expectation of the current count — only that the
        // gate actually read something. A gate that scans zero cannot be green.
        expect(result.scanned).toBeGreaterThan(0);
    });

    it('RED: a target that exists but escapes files[] names the rule and the path', () => {
        // docs/contracts/ carries exactly two whitelisted pages; every other
        // contract page exists in the tree and is deliberately unshipped.
        const unshipped = 'docs/contracts/ci-green-floor.md';
        expect(fs.existsSync(path.join(REPO_ROOT, unshipped))).toBe(true);
        expect(realIsShipped(unshipped)).toBe(false);

        const { errors } = checkPlanted(['contract:ci-green-floor']);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('planted-rule');
        expect(errors[0]).toContain(unshipped);
        expect(errors[0]).toContain('files');
    });

    it('RED: a target that resolves nowhere names every candidate it tried', () => {
        const { errors } = checkPlanted(['contract:no-such-contract-page']);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('docs/contracts/no-such-contract-page.md');
        expect(errors[0]).toContain('dist/agent-src/contexts/contracts/no-such-contract-page.md');
    });

    it('RED: an unknown kind is a failure, not a silent skip', () => {
        const { errors } = checkPlanted(['nonsense:whatever']);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('unparseable target or unknown kind');
    });

    it('RED: a router index yielding zero targets fails (zero scope is not clean)', () => {
        const result = checkRouterTargetsShipped({
            routerPath: '<empty>',
            isShipped: realIsShipped,
            exists: realExists,
            readFile: () => JSON.stringify({ schema_version: 2, tier_1: [], tier_2: [] }),
        });
        expect(result.scanned).toBe(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('scanned 0 routes_to target(s)');
    });

    it('RED: an unreadable / non-JSON router index fails instead of passing empty', () => {
        const result = checkRouterTargetsShipped({
            routerPath: '<corrupt>',
            isShipped: realIsShipped,
            exists: realExists,
            readFile: () => '{not json',
        });
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('unreadable or not JSON');
    });

    it('SABOTAGE: narrowing files[] so a routed skill drops out turns the gate red', () => {
        // The exact regression class the gate exists for: a `files[]` edit that
        // stops shipping the projected skills while router pointers still name
        // them. Both `dist/` and `dist/agent-src/` currently cover that tree,
        // so a faithful sabotage has to drop every prefix that reaches it.
        const narrowed = makeIsShipped(
            PKG.files.filter((f) => !'dist/agent-src/'.startsWith(f)),
        );
        expect(narrowed('dist/agent-src/skills/git-workflow/SKILL.md')).toBe(false);
        const { errors } = checkPlanted(['skill:git-workflow'], { isShipped: narrowed });
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('dist/agent-src/skills/git-workflow/SKILL.md');
    });
});

describe('the kind→path table is single-sourced', () => {
    it('cmd_conformance.routeTargetPaths is the platform view of the shared templates', () => {
        for (const target of [
            'skill:x',
            'command:y',
            'guideline:a/b',
            'contract:c',
            'unknown:z',
            'no-colon',
        ]) {
            const shared = routeTargetPathsPosix(target).map((rel) => path.join(...rel.split('/')));
            expect(routeTargetPaths(target), target).toEqual(shared);
        }
    });
});
