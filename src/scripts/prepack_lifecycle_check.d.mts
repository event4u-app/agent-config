/** Type declarations for prepack_lifecycle_check.mjs (plain-JS prepack gate). */
export declare const CONSUMER_LIFECYCLE_SCRIPTS: string[];
export declare function extractScriptTargets(command: string): string[];
export declare function isShippedPath(relPath: string, files: string[]): boolean;
export declare function checkLifecycleTargets(
    pkg: { scripts?: Record<string, string>; files?: string[] },
    existsFn: (relPath: string) => boolean,
): string[];
