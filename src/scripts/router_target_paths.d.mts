/** Type declarations for router_target_paths.mjs (the shared kind→path table). */
export declare const ROUTE_TARGET_TEMPLATES: Readonly<Record<string, readonly string[]>>;
export declare function parseRouteTarget(target: string): { kind: string; id: string } | null;
export declare function routeTargetPathsPosix(target: string): string[];
