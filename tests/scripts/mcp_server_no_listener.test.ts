/**
 * The MCP server speaks stdio only and binds no network socket. That was true
 * because nobody had written a listener; this pins it, so a listener landing
 * under `src/scripts/mcp_server/` fails here instead of shipping as an
 * unauthenticated network surface.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SERVER_DIR = path.join(REPO_ROOT, 'src', 'scripts', 'mcp_server');

const NETWORK_BIND = /\.listen\s*\(|\bcreateServer\s*\(|0\.0\.0\.0/;

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return sourceFiles(p);
        return /\.(?:ts|js|mjs|cjs)$/.test(e.name) ? [p] : [];
    });
}

function bindingLines(text: string): string[] {
    return text.split('\n').filter((l) => NETWORK_BIND.test(l));
}

describe('mcp server binds no network socket', () => {
    it('scans a non-empty source set', () => {
        expect(sourceFiles(SERVER_DIR).length).toBeGreaterThan(5);
    });

    it('no server source file binds a socket', () => {
        const hits = sourceFiles(SERVER_DIR).flatMap((f) =>
            bindingLines(fs.readFileSync(f, 'utf8')).map((l) => `${path.relative(REPO_ROOT, f)}: ${l.trim()}`),
        );
        expect(hits).toEqual([]);
    });

    it('the detector fires on each listener shape it guards', () => {
        for (const planted of [
            "const srv = http.createServer(handler);",
            "srv.listen(3000);",
            "net.createServer().listen(0, '127.0.0.1');",
            "server.listen({ host: '0.0.0.0', port });",
        ]) {
            expect(bindingLines(planted), planted).toHaveLength(1);
        }
    });
});
