/** Image reference parsing and the database engine an image runs. */

export interface ImageRef {
    /** repository without tag or digest */
    repo: string;
    /** explicit or implicit tag; null when the reference is a variable */
    tag: string | null;
    tagImplicit: boolean;
    digest: string | null;
    /** the reference contains an unresolved variable */
    variable: boolean;
}

export function parseImageRef(ref: string): ImageRef {
    const variable = /\$\{?[\w]/.test(ref);
    const at = ref.indexOf('@');
    const digest = at >= 0 ? ref.slice(at + 1) : null;
    const noDigest = at >= 0 ? ref.slice(0, at) : ref;
    const lastSlash = noDigest.lastIndexOf('/');
    const colon = noDigest.indexOf(':', lastSlash + 1);
    const repo = colon >= 0 ? noDigest.slice(0, colon) : noDigest;
    const explicit = colon >= 0 ? noDigest.slice(colon + 1) : null;
    if (variable && (explicit === null || explicit.includes('$'))) return { repo, tag: null, tagImplicit: false, digest, variable };
    return { repo, tag: explicit ?? (digest ? null : 'latest'), tagImplicit: explicit === null && digest === null, digest, variable };
}

const ENGINES: [RegExp, string][] = [
    [/(^|\/)(postgres|postgresql|postgis|timescaledb(-ha)?|pgvector)$/, 'postgres'],
    [/(^|\/)(mysql|mysql-server|percona(-server)?)$/, 'mysql'],
    [/(^|\/)mariadb$/, 'mariadb'],
    [/(^|\/)(mssql\/server|mssql|azure-sql-edge)$/, 'sqlserver'],
    [/(^|\/)sqlite3?$/, 'sqlite'],
];

/** The relational engine an image runs, from its repository name; null for anything else. */
export function dbEngineOf(repo: string): string | null {
    const r = repo.toLowerCase().replace(/^(docker\.io\/)?(library\/)?/, '');
    for (const [re, engine] of ENGINES) if (re.test(r)) return engine;
    return null;
}
