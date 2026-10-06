// Ownership on a GLOBAL-ONLY install — step 1.2 of
// `road-to-a-thinned-layer-measured-in-one-unit`.
//
// Both readers of the installed layer — the report and the install receipt —
// resolved ownership through the PROJECT manifest only. A global install
// writes nothing into a project, so on exactly the install shape the
// thinned-layer roadmap's AC-1 is about, both printed
// `0 package-owned / N foreign` and AC-1's figure could not be produced at all.
//
// The blocks below pin `resolveLayerOwnership` — the one function both readers
// now share — against staged inventories, in milliseconds. The END-TO-END case
// that runs the real installer lives in
// `tests/install/installed_layer_ownership_real_install.test.ts`: it costs
// minutes, and leaving it here added that cost to every unit run with nothing
// marking it as different.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    buildInstalledLayerReport,
    defaultInventoryPath,
    ownershipLine,
    resolveLayerOwnership,
} from '../../src/scripts/_lib/installed_layer.js';
import { installReceiptBudgetLines } from '../../src/install/installThinLayer.js';
import { GLOBAL_RULE_DIRS } from '../../src/install/globalRuleLayers.js';


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

    it('a STATED home beats the asking process env — the report is about that home', () => {
        // The regression this pins, and it was introduced by over-correcting a
        // review finding rather than by the original code. With env-first
        // precedence, `installed_layer_report --home <fixture>` run on any
        // machine exporting EVENT4U_CONFIG_HOME resolved the ASKING process's
        // inventory: the fixture's files read foreign and some other install's
        // read owned. That is the cross-home misattribution the function's own
        // docstring exists to forbid, and it decides the figure AC-1 publishes.
        const home = mkTmp('ilo-envhome-');
        stageGlobal(home, { 'a.md': rule(10) });
        const elsewhere = mkTmp('ilo-envelse-');
        const saved = process.env['EVENT4U_CONFIG_HOME'];
        process.env['EVENT4U_CONFIG_HOME'] = path.join(elsewhere, '.event4u', 'agent-config');
        try {
            expect(defaultInventoryPath(home)).toBe(
                path.join(home, '.event4u', 'agent-config', 'deployed-files.json'),
            );
            // And with NO home stated, the env is the right answer — that is
            // the case it decides, and the control that keeps the line above
            // from passing for a function that ignores the environment outright.
            expect(defaultInventoryPath(null)).not.toBe(defaultInventoryPath(home));
        } finally {
            if (saved === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
            else process.env['EVENT4U_CONFIG_HOME'] = saved;
        }
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

    it('the receipt reads the inventory the INSTALLER wrote, under an override', () => {
        // Writer and reader must resolve the same file. The installer writes
        // through `inventory_path()`, which honours
        // AGENT_CONFIG_DEPLOY_INVENTORY — a FILE path, not a home — so a
        // receipt that resolved `<home>/.event4u/...` instead would read a file
        // nothing wrote and lose the evidence silently.
        const home = mkTmp('ilo-writerreader-');
        const dir = stageGlobal(home, { 'a.md': rule(10) });
        const inventoryPath = stageInventory(path.dirname(dir), ['rules/a.md']);
        const saved = process.env['AGENT_CONFIG_DEPLOY_INVENTORY'];
        process.env['AGENT_CONFIG_DEPLOY_INVENTORY'] = inventoryPath;
        try {
            // No inventoryPath passed — the receipt must find it through the
            // same resolver the installer used.
            const lines = installReceiptBudgetLines(mkTmp('ilo-wr-pkg-'), home, {
                manifestPath: null,
            }).join('\n');
            expect(lines).toContain(ownershipLine('global-inventory'));
            expect(lines).toContain('10 package-owned');
        } finally {
            if (saved === undefined) delete process.env['AGENT_CONFIG_DEPLOY_INVENTORY'];
            else process.env['AGENT_CONFIG_DEPLOY_INVENTORY'] = saved;
        }
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
