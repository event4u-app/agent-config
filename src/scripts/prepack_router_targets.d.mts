/** Type declarations for prepack_router_targets.mjs (prepack gate 4). */
export declare function checkRouterTargetsShipped(opts: {
    routerPath: string;
    isShipped: (relPath: string) => boolean;
    exists: (relPath: string) => boolean;
    readFile: (absPath: string) => string;
}): { errors: string[]; scanned: number };
