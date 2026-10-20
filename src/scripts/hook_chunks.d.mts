/** Type declarations for hook_chunks.mjs (the one definition of the conditional hook chunks). */
export declare const HOOK_CHUNKS: ReadonlyArray<{ readonly entry: string; readonly outfile: string; readonly external?: readonly string[] }>;
export declare const CHUNK_OPTIONS: Readonly<{
    bundle: true;
    platform: 'node';
    format: 'cjs';
    target: string;
    define: Readonly<Record<string, string>>;
    banner: Readonly<{ js: string }>;
}>;
export declare function buildChunk(root: string, entry: string, outfile: string): void;
export declare function main(args?: readonly string[]): number;
