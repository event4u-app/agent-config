// Ownership on a GLOBAL-ONLY install — step 1.2 of
// `road-to-a-thinned-layer-measured-in-one-unit`.
//
// Both readers of the installed layer — the report and the install receipt —
// resolved ownership through the PROJECT manifest only. A global install
// writes nothing into a project, so on exactly the install shape the
// thinned-layer roadmap's AC-1 is about, both printed
// `0 package-owned / N foreign` and AC-1's figure could not be produced at all.
//
// The two unit blocks below pin `resolveLayerOwnership` — the one function
// both readers now share — against staged inventories. The last block runs the
// REAL installer into an empty `HOME` and asserts the end-to-end property the
// step states: package-owned equals the number of rule files the installer
// wrote, and the receipt says so too.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
    buildInstalledLayerReport,
    ownershipLine,
    resolveLayerOwnership,
} from '../../src/scripts/_lib/installed_layer.js';
import { installReceiptBudgetLines } from '../../src/install/installThinLayer.js';
import { GLOBAL_RULE_DIRS } from '../../src/install/globalRuleLayers.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ORCHESTRATOR = path.join(REPO_ROOT, 'src', 'scripts', 'install');

const made: string[] = [];

function mkTmp(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    made.push(dir);
    return dir;
}

afterEach(() => {
    while (made.length > 0) {
        const dir = made.pop() as string;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

const CLAUDE_RULES_REL = GLOBAL_RULE_DIRS['claude-code'] as string;

function rule(chars: number): string {
    return `---\ntype: auto\n---\n${'x'.repeat(chars)}`;
}

function stageGlobal(home: string, files: Record<string, string>): string {
    const dir = path.join(home, CLAUDE_RULES_REL);
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, text] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, name), text, 'utf-8');
    }
    return dir;
}

/** An installed-tools manifest that really records the given files. */
function writeManifest(
    projectRoot: string,
    files: ReadonlyArray<{ path: string; sha256: string }>,
): string {
    const p = path.join(projectRoot, 'agents', 'installed-tools.lock');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const rows = files
        .map((f) => `      - path: "${f.path}"\n        sha256: "${f.sha256}"`)
        .join('\n');
    fs.writeFileSync(
        p,
        `schema_version: 2\ntools:\n  - id: claude-code\n    files:\n${rows}\n`,
        'utf-8',
    );
    return p;
}

/** A `deployed-files.json` naming `anchor` and the anchor-relative `files`. */
function stageInventory(anchor: string, files: readonly string[]): string {
    const p = path.join(mkTmp('ilo-inv-'), 'deployed-files.json');
    fs.writeFileSync(
        p,
        JSON.stringify({ schema_version: 1, tools: { 'claude-code': { anchor, files } } }, null, 2),
        'utf-8',
    );
    return p;
}

describe('ownership resolution — one function, read by both readers', () => {
    it('a global-only install resolves ownership from the deploy inventory', () => {
        const home = mkTmp('ilo-inv-home-');
        const dir = stageGlobal(home, { 'a.md': rule(10), 'b.md': rule(20) });
        const anchor = path.dirname(dir);
        const inventoryPath = stageInventory(anchor, ['rules/a.md', 'rules/b.md']);
        const r = resolveLayerOwnership({
            manifestPath: path.join(mkTmp('ilo-noproj-'), 'agents', 'installed-tools.lock'),
            projectRoot: mkTmp('ilo-noproj2-'),
            inventoryPath,
        });
        expect(r.source).toBe('global-inventory');
        expect(r.recorded.has(path.join(dir, 'a.md'))).toBe(true);
        expect(r.recorded.has(path.join(dir, 'b.md'))).toBe(true);
    });

    it('the report then counts those files package-owned rather than foreign', () => {
        const home = mkTmp('ilo-rep-home-');
        const dir = stageGlobal(home, { 'a.md': rule(10), 'b.md': rule(20) });
        const inventoryPath = stageInventory(path.dirname(dir), ['rules/a.md', 'rules/b.md']);
        const report = buildInstalledLayerReport({
            home,
            projectRoot: mkTmp('ilo-rep-proj-'),
            manifestPath: null,
            inventoryPath,
        });
        expect(report.ownership_source).toBe('global-inventory');
        expect(report.totals.package_owned).toBe(2);
        expect(report.totals.foreign).toBe(0);
        expect(report.totals.package_owned_chars).toBe(30);
        // The field that USED to carry this question keeps its narrower meaning.
        expect(report.manifest_present).toBe(false);
    });

    it('a first install has no inventory yet, so this run own file set answers', () => {
        const home = mkTmp('ilo-first-home-');
        const dir = stageGlobal(home, { 'a.md': rule(10) });
        const r = resolveLayerOwnership({
            manifestPath: null,
            projectRoot: mkTmp('ilo-first-proj-'),
            inventoryPath: null,
            thisDeploy: new Map([[path.dirname(dir), ['rules/a.md']]]),
        });
        expect(r.source).toBe('this-deploy');
        expect(r.recorded.has(path.join(dir, 'a.md'))).toBe(true);
    });

    it('no manifest and no inventory is NO EVIDENCE, and says so', () => {
        const r = resolveLayerOwnership({
            manifestPath: null,
            projectRoot: mkTmp('ilo-none-'),
            inventoryPath: null,
        });
        expect(r.source).toBe('none');
        expect(r.recorded.size).toBe(0);
        expect(ownershipLine('none')).toContain('no evidence');
    });

    it('a manifest ADDS to the inventory — it does not replace it', () => {
        // THE REGRESSION THIS PINS. An earlier shape let any existing manifest
        // file win outright and discard the inventory. The two sources describe
        // DISJOINT path spaces — a manifest speaks for a project tree, an
        // inventory for the user's home — so exclusivity bought nothing and
        // restored, for the global layer, the exact `0 package-owned` reading
        // step 1.2 exists to remove. One gitignored `installed-tools.lock`,
        // which a single project-scoped install creates, was enough.
        const home = mkTmp('ilo-union-home-');
        const dir = stageGlobal(home, { 'a.md': rule(10) });
        const project = mkTmp('ilo-union-proj-');
        const projectFile = path.join(project, '.claude', 'rules', 'p.md');
        fs.mkdirSync(path.dirname(projectFile), { recursive: true });
        fs.writeFileSync(projectFile, rule(5), 'utf-8');
        const manifestPath = writeManifest(project, [
            { path: projectFile, sha256: 'deadbeef' },
        ]);

        const r = resolveLayerOwnership({
            manifestPath,
            projectRoot: project,
            inventoryPath: stageInventory(path.dirname(dir), ['rules/a.md']),
        });

        // Counts, not just a label — the assertion the earlier test was missing
        // and the reason it codified the hole instead of catching it.
        expect(r.recorded.has(path.join(dir, 'a.md'))).toBe(true);
        expect(r.recorded.has(projectFile)).toBe(true);
        expect([...r.sources].sort()).toEqual(['global-inventory', 'manifest']);
        // And the line a reader sees names BOTH, because naming one would be
        // a true sentence about half the files and a false one about the rest.
        expect(ownershipLine(r.sources)).toContain('manifest');
        expect(ownershipLine(r.sources)).toContain('deploy inventory');
    });

    it('the manifest still supplies the HASH on a path both sources name', () => {
        // What the old precedence was defending, preserved by merging the
        // manifest LAST rather than by discarding the other sources.
        const home = mkTmp('ilo-hash-home-');
        const dir = stageGlobal(home, { 'a.md': rule(10) });
        const shared = path.join(dir, 'a.md');
        const project = mkTmp('ilo-hash-proj-');
        const manifestPath = writeManifest(project, [{ path: shared, sha256: 'cafef00d' }]);
        const r = resolveLayerOwnership({
            manifestPath,
            projectRoot: project,
            inventoryPath: stageInventory(path.dirname(dir), ['rules/a.md']),
        });
        expect(r.recorded.get(shared)).toBe('cafef00d');
    });

    it('a manifest that records NOTHING contributes nothing and claims nothing', () => {
        // The shape the earlier test used as its fixture: a manifest file that
        // exists and names no file. It must not be able to label the reading.
        const home = mkTmp('ilo-empty-home-');
        const dir = stageGlobal(home, { 'a.md': rule(10) });
        const project = mkTmp('ilo-empty-proj-');
        const manifestPath = path.join(project, 'agents', 'installed-tools.lock');
        fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
        fs.writeFileSync(manifestPath, 'schema_version: 2\n', 'utf-8');
        const r = resolveLayerOwnership({
            manifestPath,
            projectRoot: project,
            inventoryPath: stageInventory(path.dirname(dir), ['rules/a.md']),
        });
        expect(r.sources).toEqual(['global-inventory']);
        expect(r.recorded.has(path.join(dir, 'a.md'))).toBe(true);
    });

    it('a corrupt inventory is no evidence rather than a failure', () => {
        const p = path.join(mkTmp('ilo-corrupt-'), 'deployed-files.json');
        fs.writeFileSync(p, '{ not json', 'utf-8');
        const r = resolveLayerOwnership({
            manifestPath: null,
            projectRoot: mkTmp('ilo-corrupt-proj-'),
            inventoryPath: p,
        });
        expect(r.source).toBe('none');
    });

    it('an inventory recorded under a DIFFERENT anchor claims nothing here', () => {
        // The reaper's own "not provably ours anymore" discipline: a moved
        // anchor means the old tree is unknown territory.
        const home = mkTmp('ilo-moved-home-');
        const dir = stageGlobal(home, { 'a.md': rule(10) });
        const inventoryPath = stageInventory(path.join(mkTmp('ilo-elsewhere-'), '.claude'), [
            'rules/a.md',
        ]);
        const r = resolveLayerOwnership({
            manifestPath: null,
            projectRoot: mkTmp('ilo-moved-proj-'),
            inventoryPath,
        });
        expect(r.recorded.has(path.join(dir, 'a.md'))).toBe(false);
    });

    it('the receipt prints the same ownership sentence as the report', () => {
        const home = mkTmp('ilo-receipt-home-');
        const dir = stageGlobal(home, { 'a.md': rule(10) });
        const lines = installReceiptBudgetLines(mkTmp('ilo-receipt-pkg-'), home, {
            inventoryPath: stageInventory(path.dirname(dir), ['rules/a.md']),
        });
        expect(lines.join('\n')).toContain(ownershipLine('global-inventory'));
        // And the budget row now attributes those characters to the package
        // instead of reading them foreign.
        expect(lines.join('\n')).toContain('10 package-owned + 0 foreign');
    });
});

describe('ownership resolution — a real first install into an empty HOME', () => {
    it(
        'reports package-owned equal to the rule files the installer wrote, and the receipt agrees',
        { timeout: 600_000 },
        () => {
            const home = mkTmp('ilo-real-home-');
            const r = spawnSync(
                'bash',
                [ORCHESTRATOR, '--global', '--tools=claude-code', '--yes'],
                {
                    cwd: REPO_ROOT,
                    encoding: 'utf8',
                    timeout: 540_000,
                    env: {
                        ...process.env,
                        HOME: home,
                        EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
                        AGENT_CONFIG_NO_UI: '1',
                        CI: '1',
                    },
                },
            );
            expect(r.status, `install failed:\n${r.stdout ?? ''}\n${r.stderr ?? ''}`).toBe(0);

            const rulesDir = path.join(home, CLAUDE_RULES_REL);
            const written = fs
                .readdirSync(rulesDir)
                .filter((n) => n.endsWith('.md'))
                .length;
            expect(written, 'the installer wrote no rule files').toBeGreaterThan(0);

            // THE INSTALL IS GLOBAL-ONLY, so there is no project manifest —
            // which is the whole case. The inventory the install just wrote is
            // the evidence, and it is read from the HOME the install used.
            const inventoryPath = path.join(
                home,
                '.event4u',
                'agent-config',
                'deployed-files.json',
            );
            expect(fs.existsSync(inventoryPath), 'the global install wrote no inventory').toBe(
                true,
            );

            const report = buildInstalledLayerReport({
                home,
                projectRoot: mkTmp('ilo-real-proj-'),
                manifestPath: null,
                inventoryPath,
            });
            expect(report.ownership_source).toBe('global-inventory');
            const claude = report.layers.filter(
                (l) => l.host === 'claude-code' && l.scope === 'global' && l.present,
            );
            const owned = claude.reduce((n, l) => n + l.package_owned, 0);
            expect(owned).toBe(written);

            // The receipt, run the way the installer runs it, resolves the same
            // ownership — the step's "the receipt prints the same".
            // `manifestPath: null` is what makes this case hermetic. The
            // receipt otherwise reads `manifest_path(REPO_ROOT)`, a gitignored
            // lock absent in CI and present on any checkout where a
            // project-scoped install has run — so without it this 540-second
            // case is green in CI and red on a maintainer's machine for a
            // reason that has nothing to do with the behaviour under test.
            const receipt = installReceiptBudgetLines(REPO_ROOT, home, {
                inventoryPath,
                manifestPath: null,
            }).join('\n');
            expect(receipt).toContain(ownershipLine('global-inventory'));
            const ownedChars = claude.reduce((n, l) => n + l.package_owned_chars, 0);
            expect(receipt).toContain(`${String(ownedChars)} package-owned`);

            // AND WITH NO PATH SUPPLIED AT ALL — the production shape. The
            // default follows the home being measured, not the home of the
            // process asking, so a report about a staged install must not pick
            // up the inventory of whatever install the runner itself is under.
            const byDefault = buildInstalledLayerReport({
                home,
                projectRoot: mkTmp('ilo-real-proj2-'),
                manifestPath: null,
            });
            expect(byDefault.ownership_source).toBe('global-inventory');
            expect(
                byDefault.layers
                    .filter((l) => l.host === 'claude-code' && l.scope === 'global' && l.present)
                    .reduce((n, l) => n + l.package_owned, 0),
            ).toBe(written);
        },
    );
});
