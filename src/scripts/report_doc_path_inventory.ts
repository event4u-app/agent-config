#!/usr/bin/env node
/**
 * Inventory of every documentation path the tooling hard-codes
 * (road-to-docs-that-sell 1.5).
 *
 * Moving or renaming a user doc breaks whatever names it by path — a count
 * rewriter, a public-surface scan, a role-doc link check, a contract test, a
 * workflow filter. Those references live in code, so no doc link checker sees
 * them. This report lists them, so a change that moves a page updates every
 * entry for that page in the same change.
 *
 * Sources scanned: `src/scripts/**`, `tests/**`, `.github/**` and
 * `src/config/gate-coverage.yml`. A "doc path" is a repo-root markdown file
 * (`README.md`, `CHANGELOG.md`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`)
 * or a `.md` / `.mdx` / `.yml` / `.yaml` / `.json` file under `docs/` or the
 * site content tree.
 *
 * Output is deterministic (sorted, no timestamps), so `--check` regenerates in
 * memory and fails on any byte difference from the committed report.
 *
 * Usage:
 *   ./scripts-run src/scripts/report_doc_path_inventory            # write the report
 *   ./scripts-run src/scripts/report_doc_path_inventory --check    # exit 1 on drift
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _FILE = fileURLToPath(import.meta.url);
export const REPO = path.resolve(path.dirname(_FILE), '..', '..');
export const REPORT_REL = 'docs/maintainers/doc-path-inventory.md';

const SCAN_ROOTS = ['src/scripts', 'tests', '.github', 'src/config/gate-coverage.yml'];
const SCAN_EXT = /\.(?:ts|mts|mjs|js|sh|ya?ml|json|md)$/;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro']);

const DOC_PATH =
    /(?<![A-Za-z0-9_./-])((?:docs|site\/src\/content\/docs)\/[A-Za-z0-9_./-]*[A-Za-z0-9_-]\.(?:mdx?|ya?ml|json)|(?:README|CHANGELOG|AGENTS|CONTRIBUTING|SECURITY)\.md)(?![A-Za-z0-9_/-])/g;

/** Doc paths named in one file's text, deduplicated. */
export function extractDocPaths(text: string): string[] {
    const out = new Set<string>();
    for (const m of text.matchAll(DOC_PATH)) out.add(m[1] as string);
    return [...out];
}

function toPosix(p: string): string {
    return p.split(path.sep).join('/');
}

function walk(repo: string, rel: string, out: string[]): void {
    const abs = path.join(repo, rel);
    if (!fs.existsSync(abs)) return;
    const st = fs.statSync(abs);
    if (st.isFile()) {
        if (SCAN_EXT.test(rel)) out.push(toPosix(rel));
        return;
    }
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
        if (e.isDirectory() && SKIP_DIRS.has(e.name)) continue;
        walk(repo, path.join(rel, e.name), out);
    }
}

/** doc path → sorted list of files naming it. */
export function collectReferences(repo: string = REPO, roots: readonly string[] = SCAN_ROOTS): Map<string, string[]> {
    const files: string[] = [];
    for (const r of roots) walk(repo, r, files);
    const refs = new Map<string, Set<string>>();
    for (const f of files.sort()) {
        for (const p of extractDocPaths(fs.readFileSync(path.join(repo, f), 'utf8'))) {
            if (!refs.has(p)) refs.set(p, new Set());
            refs.get(p)!.add(f);
        }
    }
    return new Map([...refs.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, [...v].sort()]));
}

export interface NamedLists {
    updateCountsTargets: string[];
    supervisionPublicSurfaces: string[];
    roleDocs: string[];
}

/** The path lists the roadmap names explicitly, read from the modules that own them. */
export async function loadNamedLists(repo: string = REPO): Promise<NamedLists> {
    const imp = (rel: string): Promise<Record<string, unknown>> =>
        import(pathToFileURL(path.join(repo, rel)).href) as Promise<Record<string, unknown>>;
    const uc = await imp('src/scripts/update_counts.ts');
    const sup = await imp('src/scripts/check_supervision_claim_atomicity.ts');
    const role = await imp('src/scripts/check_role_doc_links.ts');
    const targets = (uc['TARGETS'] as ReadonlyArray<readonly [string, unknown]>).map(([p]) => p);
    const roleRoot = role['ROOT'] as string;
    return {
        updateCountsTargets: [...new Set(targets)].sort(),
        supervisionPublicSurfaces: [...(sup['PUBLIC_SURFACES'] as readonly string[])].sort(),
        roleDocs: (role['ROLE_DOCS'] as string[]).map((p) => toPosix(path.relative(roleRoot, p))).sort(),
    };
}

const CONTRACT_TEST_ROOTS = ['tests/contracts/', 'tests/surface-contracts/'];
const NON_TEST_ROOTS = ['src/scripts/', '.github/', 'src/config/'];

export function render(refs: Map<string, string[]>, named: NamedLists, repo: string = REPO): string {
    const exists = (p: string): boolean => fs.existsSync(path.join(repo, p));
    const code = (s: string): string => `\`${s}\``;
    const present = [...refs.entries()].filter(([p]) => exists(p));
    const absent = [...refs.entries()].filter(([p]) => !exists(p));
    const absentLive = absent.filter(([, fs_]) => fs_.some((f) => NON_TEST_ROOTS.some((r) => f.startsWith(r))));
    const contract = present
        .map(([p, fs_]) => [p, fs_.filter((f) => CONTRACT_TEST_ROOTS.some((r) => f.startsWith(r)))] as const)
        .filter(([, fs_]) => fs_.length > 0);

    const L: string[] = [];
    L.push('# Doc path inventory');
    L.push('');
    L.push('<!-- GENERATED by src/scripts/report_doc_path_inventory.ts — do not edit; regenerate with `./scripts-run src/scripts/report_doc_path_inventory`. -->');
    L.push('');
    L.push('Every documentation path that code, tests, workflows and the gate-coverage');
    L.push('registry name by string. A change that moves or renames a page updates every');
    L.push('entry for that page in the same change, then regenerates this file;');
    L.push('`--check` fails when it is stale.');
    L.push('');
    L.push('Scanned: `src/scripts/`, `tests/`, `.github/`, `src/config/gate-coverage.yml`.');
    L.push('');
    L.push(`- ${present.length} existing doc path(s) named`);
    L.push(`- ${absentLive.length} absent path(s) named outside tests (listed below; absent paths named only by tests are fixtures and are omitted)`);
    L.push('');
    L.push('## Hard-coded lists');
    L.push('');
    const list = (title: string, owner: string, items: string[]): void => {
        L.push(`### ${title}`);
        L.push('');
        L.push(`Owner: ${code(owner)}.`);
        L.push('');
        for (const i of items) L.push(`- ${code(i)}${exists(i) ? '' : ' — absent'}`);
        L.push('');
    };
    list('`update_counts` TARGETS', 'src/scripts/update_counts.ts', named.updateCountsTargets);
    list('`check_supervision_claim_atomicity` PUBLIC_SURFACES', 'src/scripts/check_supervision_claim_atomicity.ts', named.supervisionPublicSurfaces);
    list('Role-doc links', 'src/scripts/check_role_doc_links.ts', named.roleDocs);
    L.push('## Contract tests');
    L.push('');
    for (const [p, fs_] of contract) L.push(`- ${code(p)} — ${fs_.map(code).join(', ')}`);
    L.push('');
    L.push('## Absent paths named outside tests');
    L.push('');
    if (absentLive.length === 0) L.push('None.');
    for (const [p, fs_] of absentLive) L.push(`- ${code(p)} — ${fs_.map(code).join(', ')}`);
    L.push('');
    L.push('## Every existing doc path');
    L.push('');
    for (const [p, fs_] of present) L.push(`- ${code(p)} (${fs_.length}) — ${fs_.map(code).join(', ')}`);
    L.push('');
    return L.join('\n');
}

export async function build(repo: string = REPO): Promise<string> {
    return render(collectReferences(repo), await loadNamedLists(repo), repo);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
    const out = path.join(REPO, REPORT_REL);
    const fresh = await build();
    if (argv.includes('--check')) {
        const committed = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
        if (committed !== fresh) {
            process.stderr.write(
                `❌  ${REPORT_REL} is ${committed === null ? 'missing' : 'stale'} — run ./scripts-run src/scripts/report_doc_path_inventory and commit it.\n`,
            );
            return 1;
        }
        process.stdout.write(`✅  ${REPORT_REL} is current.\n`);
        return 0;
    }
    fs.writeFileSync(out, fresh);
    process.stdout.write(`wrote ${REPORT_REL}\n`);
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    try {
        return fs.realpathSync(_FILE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    main().then(
        (code) => process.exit(code),
        (err: unknown) => {
            process.stderr.write(`${String(err)}\n`);
            process.exit(2);
        },
    );
}
