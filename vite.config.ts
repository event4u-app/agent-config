/**
 * Vite config for the local-UI bundle.
 *
 * Phase 4 of the typescript-cli-and-local-gui-foundation roadmap:
 * this scaffolds the bundler with a placeholder index.html + main.ts.
 * Roadmap "unified-setup-and-settings-gui" picks the framework and
 * populates the UI.
 *
 * The dev server is intentionally disabled — production-only build,
 * the bundled output is served by the embedded Fastify app.
 */

import { defineConfig } from 'vite';

export default defineConfig({
    root: 'src/ui',
    publicDir: false,
    build: {
        outDir: '../../dist/ui',
        emptyOutDir: true,
        target: 'es2022',
        sourcemap: true,
    },
    server: {
        host: '127.0.0.1',
        port: 41999,
        strictPort: true,
    },
});
