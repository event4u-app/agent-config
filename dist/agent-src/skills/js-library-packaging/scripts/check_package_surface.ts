/**
 * check_package_surface — read a JavaScript library's PACKAGE SURFACE and report what its
 * own `package.json` says, without compiling anything.
 *
 * Scope, stated because the boundary is what keeps this useful: the subject is
 * `package.json` **semantics** — the exports map, peer-dependency placement, the files
 * allow-list, publish intent. It is NOT a build, not a type-check, and not proof that any
 * bundler can produce the declared layout. A checker that grew a parser would start
 * reporting compile errors as packaging errors, and the two have different fixes.
 *
 * The classification (`source-consumed` vs `built-surface`) is read from the DECLARED
 * EXPORT TARGETS, never from the directory name. A fixture called `ui-lib-vite` is not
 * evidence about Vite, and a directory called `buildable` is not evidence that anything
 * builds — both council reviewers named that inference as the thing to avoid.
 *
 * Output is JSON on stdout. No network, no subprocess.
 *
 * Usage:
 *   check_package_surface <library-root> [<library-root> …]
 *   check_package_surface --self-test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export type Severity = 'error' | 'warn';

export interface Finding {
    readonly code: string;
    readonly severity: Severity;
    readonly message: string;
}

export type Classification = 'source-consumed' | 'built-surface' | 'undeclared';

export interface SurfaceReport {
    readonly root: string;
    readonly name: string | null;
    readonly classification: Classification;
    readonly findings: readonly Finding[];
}

/** Peer-only packages: a library that bundles these ships a second copy of them. */
const PEER_ONLY = ['react', 'react-dom'] as const;

const asRecord = (v: unknown): Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Every string target reachable in an exports map, at any nesting depth. */
export const exportTargets = (exportsField: unknown): string[] => {
    const out: string[] = [];
    const walk = (node: unknown): void => {
        if (typeof node === 'string') {
            out.push(node);
            return;
        }
        if (Array.isArray(node)) {
            for (const n of node) walk(n);
            return;
        }
        for (const v of Object.values(asRecord(node))) walk(v);
    };
    walk(exportsField);
    return out;
};

/**
 * Classify from the declared targets.
 *
 * A package whose targets all point into a source directory is source-consumed; one whose
 * targets point at build output is a built surface. **Mixed is `undeclared`, not a guess** —
 * a package that declares both is making a statement this check cannot resolve, and picking
 * one silently would hide exactly the ambiguity worth reporting.
 */
export const classify = (targets: readonly string[]): Classification => {
    if (targets.length === 0) return 'undeclared';
    const built = targets.filter((t) => /(^|\/)(dist|build|lib|out)\//.test(t));
    if (built.length === targets.length) return 'built-surface';
    if (built.length === 0) return 'source-consumed';
    return 'undeclared';
};

export const checkPackage = (root: string): SurfaceReport => {
    const manifestPath = path.join(root, 'package.json');
    let manifest: Record<string, unknown> = {};
    try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    } catch {
        return {
            root,
            name: null,
            classification: 'undeclared',
            findings: [{ code: 'no-manifest', severity: 'error', message: `no readable package.json at ${manifestPath}` }],
        };
    }

    const findings: Finding[] = [];
    const deps = asRecord(manifest['dependencies']);
    const peers = asRecord(manifest['peerDependencies']);
    const exportsField = manifest['exports'];
    const targets = exportTargets(exportsField);

    // (a) — the "invalid hook call" failure. Two copies of React in one tree break hooks at
    // runtime with an error that names neither package, which is why this is an error and
    // not a warning.
    for (const p of PEER_ONLY) {
        if (Object.prototype.hasOwnProperty.call(deps, p)) {
            findings.push({
                code: 'peer-as-dependency',
                severity: 'error',
                message: `\`${p}\` is in dependencies; a library must declare it as a peerDependency or the consumer gets two copies (the "invalid hook call" failure)`,
            });
        }
    }

    // (b) — legacy entry fields with no exports map: the resolution the consumer gets then
    // depends on their bundler rather than on this manifest.
    const hasLegacy = ['main', 'module', 'browser'].some((k) => typeof manifest[k] === 'string');
    if (exportsField === undefined && hasLegacy) {
        findings.push({
            code: 'no-exports-map',
            severity: 'warn',
            message: 'main/module present without an exports map — the entry point resolves by bundler convention, not by declaration',
        });
    }

    // (c) — `types` must be the FIRST key of a conditions object. Conditional exports are
    // matched in declaration order, so a `types` key placed after `import` is skipped by
    // resolvers that match `import` first, and the package silently ships untyped.
    const walkConditions = (node: unknown, at: string): void => {
        const rec = asRecord(node);
        const keys = Object.keys(rec);
        if (keys.includes('types') && keys[0] !== 'types') {
            findings.push({
                code: 'types-not-first',
                severity: 'warn',
                message: `\`types\` is not the first condition at \`${at}\` (order matters: a resolver matching \`${keys[0] ?? ''}\` first never sees it)`,
            });
        }
        for (const [k, v] of Object.entries(rec)) {
            if (typeof v === 'object' && v !== null) walkConditions(v, `${at}${k}/`);
        }
    };
    if (exportsField !== undefined) walkConditions(exportsField, 'exports.');

    // (d) — a `workspace:` range only resolves inside the workspace. Published with no
    // `private: true` and no publishConfig, the consumer's install fails on a protocol
    // their registry has never heard of.
    const allDeps = { ...deps, ...asRecord(manifest['devDependencies']), ...peers };
    const workspaceRanges = Object.entries(allDeps).filter(([, v]) => typeof v === 'string' && v.startsWith('workspace:'));
    if (
        workspaceRanges.length > 0 &&
        manifest['private'] !== true &&
        manifest['publishConfig'] === undefined
    ) {
        findings.push({
            code: 'workspace-range-publishable',
            severity: 'warn',
            message: `${String(workspaceRanges.length)} \`workspace:\` range(s) in a package that is neither private nor carrying publishConfig — the protocol does not resolve outside the workspace`,
        });
    }

    // A declared target that is not in the tree is the drift the whole surface rests on.
    for (const t of targets) {
        if (!t.startsWith('.')) continue;
        if (!fs.existsSync(path.join(root, t))) {
            findings.push({
                code: 'export-target-missing',
                severity: 'error',
                message: `exports target \`${t}\` does not exist in the package`,
            });
        }
    }

    const name = typeof manifest['name'] === 'string' ? manifest['name'] : null;
    return { root, name, classification: classify(targets), findings };
};

const selfTest = (): number => {
    let failed = 0;
    const check = (label: string, cond: boolean): void => {
        if (!cond) {
            process.stderr.write(`❌  ${label}\n`);
            failed += 1;
        }
    };

    check('a source target classifies as source-consumed', classify(['./src/index.ts']) === 'source-consumed');
    check('a dist target classifies as built-surface', classify(['./dist/index.js']) === 'built-surface');
    check('a MIXED declaration is undeclared, never guessed', classify(['./src/index.ts', './dist/index.js']) === 'undeclared');
    check('no targets is undeclared', classify([]) === 'undeclared');
    check(
        'nested conditions are all collected',
        exportTargets({ '.': { types: './a.d.ts', import: './b.js' } }).length === 2,
    );

    process.stdout.write(
        failed === 0 ? '✅  check_package_surface: self-test passed\n' : `❌  ${String(failed)} failure(s)\n`,
    );
    return failed === 0 ? 0 : 1;
};

const main = (): number => {
    const argv = process.argv.slice(2);
    if (argv.includes('--self-test')) return selfTest();
    const roots = argv.filter((a) => !a.startsWith('--'));
    if (roots.length === 0) {
        process.stderr.write('usage: check_package_surface <library-root> [...]\n');
        return 2;
    }
    const reports = roots.map((r) => checkPackage(r));
    process.stdout.write(`${JSON.stringify({ reports }, null, 2)}\n`);
    return reports.some((r) => r.findings.some((f) => f.severity === 'error')) ? 1 : 0;
};

if (process.argv[1] !== undefined && process.argv[1].includes('check_package_surface')) {
    process.exit(main());
}
