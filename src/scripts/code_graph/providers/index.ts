/**
 * The convention-provider registry (ADR-298). The only module the graph core
 * imports provider code through; adding a framework is an entry here, never a
 * branch in the build.
 */
import type { FileRole } from '../map_model.js';
import type { ActiveProviderRecord } from '../types.js';
import { expressProvider } from './express.js';
import { laravelProvider } from './laravel.js';
import { springProvider } from './spring.js';
import type { ConventionProvider, ProjectProbe } from './types.js';

export type { ConventionProvider, ProjectProbe, ProviderInput, ProviderResult } from './types.js';
export { EMPTY_PROBE } from './types.js';

/** Registration order is execution order; ids are unique. */
export const PROVIDERS: readonly ConventionProvider[] = [laravelProvider, expressProvider, springProvider];

/** Every marker basename a registered provider asks the probe to record. */
export const PROBE_MARKERS: ReadonlySet<string> = new Set(PROVIDERS.flatMap((p) => p.markers ?? []));

export interface ActiveProvider {
    provider: ConventionProvider;
    roots: string[];
}

/** The providers whose markers the probe carries, each with the package roots it applies to. */
export function activeProviders(probe: ProjectProbe, registry: readonly ConventionProvider[] = PROVIDERS): ActiveProvider[] {
    const out: ActiveProvider[] = [];
    for (const provider of registry) {
        const roots = provider.detect(probe);
        if (roots.length > 0) out.push({ provider, roots });
    }
    return out;
}

/**
 * The first role a provider gives this path. With `active` (the graph's record),
 * only those providers are asked, each about the path relative to its package
 * roots; without it, every registered provider is asked about the path as is.
 */
export function providerRole(
    p: string,
    active?: readonly ActiveProviderRecord[],
    registry: readonly ConventionProvider[] = PROVIDERS,
): FileRole | undefined {
    if (!active) {
        for (const provider of registry) {
            const role = provider.roleOf?.(p);
            if (role) return role;
        }
        return undefined;
    }
    for (const rec of active) {
        const provider = registry.find((x) => x.id === rec.id);
        if (!provider?.roleOf) continue;
        for (const root of rec.roots) {
            if (root !== '' && !p.startsWith(`${root}/`)) continue;
            const role = provider.roleOf(root === '' ? p : p.slice(root.length + 1));
            if (role) return role;
        }
    }
    return undefined;
}
