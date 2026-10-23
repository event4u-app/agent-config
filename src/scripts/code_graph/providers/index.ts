/**
 * The convention-provider registry (ADR-298). The only module the graph core
 * imports provider code through; adding a framework is an entry here, never a
 * branch in the build.
 */
import type { FileRole } from '../map_model.js';
import { laravelProvider } from './laravel.js';
import type { ConventionProvider, ProjectProbe } from './types.js';

export type { ConventionProvider, ProjectProbe, ProviderInput, ProviderResult } from './types.js';
export { EMPTY_PROBE } from './types.js';

/** Registration order is execution order; ids are unique. */
export const PROVIDERS: readonly ConventionProvider[] = [laravelProvider];

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

/** The first role a registered provider gives this path, in registration order. */
export function providerRole(p: string, registry: readonly ConventionProvider[] = PROVIDERS): FileRole | undefined {
    for (const provider of registry) {
        const role = provider.roleOf?.(p);
        if (role) return role;
    }
    return undefined;
}
