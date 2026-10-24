/**
 * Detection by manifest, per package root. Every helper returns the sorted
 * roots (`''` for the repository root) whose manifest declares one of the
 * named packages — never a guess from file suffixes.
 */
import * as path from 'node:path';

import type { ProjectProbe } from '../types.js';

function rootOf(p: string): string {
    const d = path.posix.dirname(p);
    return d === '.' ? '' : d;
}

function rootsWhere(probe: ProjectProbe, basename: RegExp, declares: (text: string) => boolean): string[] {
    const roots = new Set<string>();
    for (const [p, text] of probe.manifests) if (basename.test(path.posix.basename(p)) && declares(text)) roots.add(rootOf(p));
    return [...roots].sort();
}

function jsonDeps(text: string, keys: readonly string[]): string[] {
    try {
        const j = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
        return keys.flatMap((k) => Object.keys(j[k] ?? {}));
    } catch {
        return [];
    }
}

const matches = (names: readonly (string | RegExp)[], dep: string): boolean =>
    names.some((n) => (typeof n === 'string' ? n === dep : n.test(dep)));

/** `package.json` dependencies, devDependencies or peerDependencies. */
export function npmRoots(probe: ProjectProbe, names: readonly (string | RegExp)[]): string[] {
    return rootsWhere(probe, /^package\.json$/, (t) =>
        jsonDeps(t, ['dependencies', 'devDependencies', 'peerDependencies']).some((d) => matches(names, d)),
    );
}

/** `composer.json` require or require-dev. */
export function composerRoots(probe: ProjectProbe, names: readonly (string | RegExp)[]): string[] {
    return rootsWhere(probe, /^composer\.json$/, (t) => jsonDeps(t, ['require', 'require-dev']).some((d) => matches(names, d)));
}

/** `pyproject.toml` or a `requirements*.txt` naming the distribution. */
export function pythonRoots(probe: ProjectProbe, names: readonly string[]): string[] {
    const re = new RegExp(`(^|["'\\s\\[,])(${names.map((n) => n.replace(/[-_.]/g, '[-_.]')).join('|')})(?=[\\s"'<>=~!;\\[,]|$)`, 'im');
    return rootsWhere(probe, /^(pyproject\.toml|requirements[\w.-]*\.txt)$/, (t) => re.test(t));
}

/** A Maven `pom.xml` or Gradle build file naming the artifact. */
export function jvmRoots(probe: ProjectProbe, artifact: RegExp): string[] {
    return rootsWhere(probe, /^(pom\.xml|build\.gradle(\.kts)?)$/, (t) => artifact.test(t));
}

/** A `go.mod` requiring the module. */
export function goRoots(probe: ProjectProbe, modules: readonly string[]): string[] {
    return rootsWhere(probe, /^go\.mod$/, (t) => modules.some((m) => t.includes(m)));
}

/** A `*.csproj` referencing the SDK or package. */
export function dotnetRoots(probe: ProjectProbe, marker: RegExp): string[] {
    return rootsWhere(probe, /\.csproj$/, (t) => marker.test(t));
}

/** A `Gemfile` declaring the gem. */
export function gemRoots(probe: ProjectProbe, gem: string): string[] {
    return rootsWhere(probe, /^Gemfile$/, (t) => new RegExp(`^\\s*gem\\s+['"]${gem}['"]`, 'm').test(t));
}

/** Marker files present in the probe, by basename, as roots. */
export function markerRoots(probe: ProjectProbe, basename: string): string[] {
    return [...new Set([...probe.markers].filter((p) => path.posix.basename(p) === basename).map(rootOf))].sort();
}

export function union(...lists: string[][]): string[] {
    return [...new Set(lists.flat())].sort();
}
