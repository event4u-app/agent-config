/**
 * The one scope classifier: what a repository path is to the project.
 *
 * Every test is on the path RELATIVE to the scanned root, never on the root's
 * own location: a fixture repository scanned as its own root (`tests/fixtures/
 * p1-blog` → `database/migrations/…`) is a project like any other, while the
 * same files reached from the enclosing repository are its fixtures.
 *
 * First matching rule wins. Overrides from the `scope:` section of `layers.yaml`
 * run before the defaults, so a project can claim a path the defaults misread.
 */
import fs from 'node:fs';
import { parse as parseYaml } from 'yaml';

import { globToRegExp } from './map_answers.js';

export const SCOPES = ['product', 'test', 'fixture', 'bench', 'doc', 'vendored', 'generated'] as const;
export type Scope = (typeof SCOPES)[number];

export interface ScopeRule {
    scope: Scope;
    /** how the rule is named in an explanation: `bench/`, `*.test.*`, or the override glob */
    rule: string;
    test: (rel: string) => boolean;
    override?: boolean;
}

export interface ScopeVerdict {
    scope: Scope;
    /** the rule that decided; `null` when no rule matched and the path is product by default */
    rule: string | null;
    override: boolean;
}

const dir = (names: string): RegExp => new RegExp(`(?:^|/)(?:${names})/`, 'i');

/** Directories a walk never descends into: installed dependencies and build output, no project fact lives there. */
export const WALK_SKIP_DIRS: readonly string[] = ['.git', 'node_modules', 'vendor', 'dist', '.tscache'];

const DEFAULT_RULES: readonly ScopeRule[] = [
    { scope: 'vendored', rule: 'vendor/', test: (p) => dir('node_modules|vendor|third_party|bower_components').test(p) },
    { scope: 'generated', rule: 'dist/', test: (p) => dir('dist|\\.build|\\.tscache|coverage').test(p) || /\.min\.(?:js|css)$/i.test(p) },
    { scope: 'fixture', rule: 'fixtures/', test: (p) => dir('fixtures?|__fixtures__|testdata').test(p) },
    { scope: 'bench', rule: 'bench/', test: (p) => dir('bench|benches|benchmarks?').test(p) },
    { scope: 'test', rule: 'tests/', test: (p) => dir('tests?|__tests__|specs?').test(p) },
    { scope: 'doc', rule: 'docs/', test: (p) => dir('docs?|examples?|samples?').test(p) },
    {
        scope: 'test',
        rule: '*.test.*',
        test: (p) => {
            const base = p.slice(p.lastIndexOf('/') + 1);
            return /\.(?:test|spec)\./i.test(base) || /_test\.go$/.test(base) || /(?:^|[._-])test\.php$/i.test(base) || /Tests?\.(?:java|cs|php)$/.test(base);
        },
    },
    { scope: 'doc', rule: '*.md', test: (p) => /\.(?:md|mdx|markdown|rst|adoc)$/i.test(p) },
];

/** The `scope:` section of `layers.yaml`: `[{scope, paths: [glob]}]`. Absent or unreadable → no overrides. */
export function readScopeRules(file: string): ScopeRule[] {
    let doc: unknown;
    try {
        doc = parseYaml(fs.readFileSync(file, 'utf-8'));
    } catch {
        return [];
    }
    const list = (doc as { scope?: unknown } | null)?.scope;
    if (!Array.isArray(list)) return [];
    const out: ScopeRule[] = [];
    for (const x of list as Array<Record<string, unknown>>) {
        const s = x?.['scope'];
        if (typeof s !== 'string' || !(SCOPES as readonly string[]).includes(s) || !Array.isArray(x['paths'])) continue;
        for (const g of x['paths'] as unknown[]) {
            if (typeof g !== 'string') continue;
            const re = globToRegExp(g);
            out.push({ scope: s as Scope, rule: g, test: (p) => re.test(p), override: true });
        }
    }
    return out;
}

const posix = (rel: string): string => rel.split('\\').join('/').replace(/^\.\//, '');

export function classifyScope(rel: string, overrides: readonly ScopeRule[] = []): ScopeVerdict {
    const p = posix(rel);
    for (const r of overrides) if (r.test(p)) return { scope: r.scope, rule: r.rule, override: true };
    for (const r of DEFAULT_RULES) if (r.test(p)) return { scope: r.scope, rule: r.rule, override: false };
    return { scope: 'product', rule: null, override: false };
}

export function scopeOf(rel: string, overrides: readonly ScopeRule[] = []): Scope {
    return classifyScope(rel, overrides).scope;
}

/** The line `code-graph scope <path>` prints. */
export function explainScope(rel: string, overrides: readonly ScopeRule[] = []): string {
    const v = classifyScope(rel, overrides);
    const why = v.rule === null ? 'no rule matched' : `${v.override ? 'override' : 'default rule'} ${v.rule}`;
    return `${posix(rel)}: ${v.scope} (${why})`;
}

/** A file in a test, fixture or benchmark tree, or a test file by its name. */
export function isTestFile(rel: string): boolean {
    const s = scopeOf(rel);
    return s === 'test' || s === 'fixture' || s === 'bench';
}

/** Same set as `isTestFile`; kept under the name the lanes read it by. */
export const isFixturePath = isTestFile;

/** Documentation or an example: a doc/example tree, or a prose file anywhere outside the other scopes. */
export function isDocOrExamplePath(rel: string): boolean {
    return scopeOf(rel) === 'doc';
}
