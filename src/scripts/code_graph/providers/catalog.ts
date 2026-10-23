/**
 * The coverage catalog (ADR-298 § 6): for every provider, what it resolves and
 * how far that is proven — so nothing reads as supported because it is
 * detected. Stacks not covered yet stand here as `planned`, never silently
 * absent.
 *
 *   detected  markers recognised, no relation resolved
 *   partial   relations resolved and proven by synthetic positive and negative oracles
 *   verified  partial, plus a reading on a real repository
 *   deep      verified across every relation the framework has (none yet)
 *   planned   on the coverage list, not built; the generic default still runs
 */
import type { Relation } from '../types.js';

export type CoverageStatus = 'detected' | 'partial' | 'verified' | 'deep' | 'planned';

export interface CatalogRow {
    /** The registered provider id, or a planned id. */
    id: string;
    /** What a person calls it. */
    name: string;
    language: string;
    /** How it is detected (manifest entries or marker files). */
    markers: string;
    relations: readonly Relation[];
    status: CoverageStatus;
    /** The synthetic fixture its oracles run on. */
    fixture: string | null;
    /** The usage reading that put it on the coverage list. */
    usage: string;
    /** What it does not follow, said plainly. */
    limits?: string;
}

const SO = 'Stack Overflow Developer Survey, web frameworks (year as recorded in the supplied plans; not re-read in this run)';

export const CATALOG: readonly CatalogRow[] = [
    {
        id: 'laravel',
        name: 'Laravel',
        language: 'PHP',
        markers: 'composer.json requires laravel/framework or an illuminate/* package; an artisan file',
        relations: ['routes-to', 'renders', 'includes', 'reads', 'migrates', 'persists', 'relates', 'uses'],
        status: 'verified',
        fixture: 'tests/scripts/code_graph_provider_laravel.test.ts (inline tree)',
        usage: SO,
        limits: 'Routes only under the package root routes/ directory; closures and string handlers get no target.',
    },
    {
        id: 'express',
        name: 'Express',
        language: 'JavaScript / TypeScript',
        markers: 'package.json depends on express',
        relations: ['routes-to'],
        status: 'partial',
        fixture: 'tests/fixtures/code-graph/express',
        usage: SO,
        limits: 'A router mounted under a prefix in another file (app.use) is not followed.',
    },
    {
        id: 'spring',
        name: 'Spring Boot',
        language: 'Java',
        markers: 'pom.xml / build.gradle names spring-boot',
        relations: ['routes-to', 'persists', 'relates', 'injects'],
        status: 'partial',
        fixture: 'tests/fixtures/code-graph/spring',
        usage: SO,
        limits: '@Entity(name) is not read; a method @RequestMapping without method= is skipped; Kotlin is not covered.',
    },
    {
        id: 'go-http',
        name: 'Go routers (net/http, Gin, Echo, chi)',
        language: 'Go',
        markers: 'a go.mod',
        relations: ['routes-to'],
        status: 'partial',
        fixture: 'tests/fixtures/code-graph/go-http',
        usage: 'Go is in the top ten languages of GitHub Octoverse; its routers are not in the web-framework survey',
        limits: 'chi r.Route nesting, http.HandlerFunc(f) and handler variables are not followed.',
    },
    ...(
        [
            ['kotlin', 'Kotlin', 'Kotlin'],
            ['rust', 'Rust', 'Rust'],
            ['c-cpp', 'C / C++', 'C / C++'],
            ['swift', 'Swift', 'Swift'],
            ['dart', 'Dart', 'Dart'],
            ['sql', 'SQL schema files', 'SQL'],
            ['react-native', 'React Native / Expo', 'JavaScript / TypeScript'],
            ['flutter', 'Flutter', 'Dart'],
            ['swiftui', 'SwiftUI', 'Swift'],
            ['jetpack-compose', 'Jetpack Compose', 'Kotlin'],
            ['blazor', 'Blazor', 'C#'],
            ['astro', 'Astro', 'JavaScript / TypeScript'],
            ['fastify', 'Fastify', 'JavaScript / TypeScript'],
            ['hono', 'Hono', 'JavaScript / TypeScript'],
            ['remix', 'Remix', 'JavaScript / TypeScript'],
            ['drupal', 'Drupal', 'PHP'],
            ['quarkus', 'Quarkus', 'Java'],
            ['micronaut', 'Micronaut', 'Java'],
            ['prisma', 'Prisma', 'Prisma schema'],
            ['drizzle', 'Drizzle', 'TypeScript'],
            ['infrastructure', 'Docker, Kubernetes, Terraform, CI', 'YAML / HCL'],
        ] as const
    ).map(
        ([id, name, language]): CatalogRow => ({
            id,
            name,
            language,
            markers: '—',
            relations: [],
            status: 'planned',
            fixture: null,
            usage: 'coverage list in road-to-graph-providers-for-every-stack (kill register K7)',
        }),
    ),
];

/** The catalog row for a provider id, if any. */
export function catalogRow(id: string): CatalogRow | undefined {
    return CATALOG.find((r) => r.id === id);
}
