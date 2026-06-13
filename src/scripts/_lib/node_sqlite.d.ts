// Ambient declaration for the slice of `node:sqlite` used by the
// mcp_telemetry_store / mcp_telemetry_query twins.
//
// `@types/node@20` (the version pinned in package.json) does not ship
// `sqlite.d.ts` — the typings arrived with `node:sqlite`'s stabilization
// in a later Node line. The twins import `node:sqlite` lazily and guard
// for its absence at runtime (Node < 22.5 has no module), but `tsc` still
// needs a type for the import or `npm run typecheck` fails on the pinned
// types. This declares only the surface the twins touch — `DatabaseSync`,
// `prepare`/`exec`/`close`, and the `StatementSync` methods used. It is
// intentionally minimal and does not attempt to mirror the full module.
declare module 'node:sqlite' {
    export interface StatementSync {
        run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
        get(...params: unknown[]): Record<string, unknown> | undefined;
        all(...params: unknown[]): Record<string, unknown>[];
    }

    export interface DatabaseSyncOptions {
        readOnly?: boolean;
        open?: boolean;
        enableForeignKeyConstraints?: boolean;
        enableDoubleQuotedStringLiterals?: boolean;
    }

    export class DatabaseSync {
        constructor(location: string, options?: DatabaseSyncOptions);
        exec(sql: string): void;
        prepare(sql: string): StatementSync;
        close(): void;
    }
}
