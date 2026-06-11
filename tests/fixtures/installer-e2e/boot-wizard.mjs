// Boot the real Fastify wizard server (the same `createApp` the `init` GUI
// uses) headless, so the container e2e can drive POST /api/v1/wizard/apply
// over HTTP — the exact path that spawns `install.py --apply-payload`.
//
// Args: <port> <writeRoot> <uiDir> <packageRoot> <token>
// On listen it prints `WIZARD_READY <port>` so the caller can proceed.
import { createApp } from '../../../dist/server/app.js';

const [, , portArg, writeRoot, uiDir, packageRoot, token] = process.argv;
const port = Number(portArg);

const app = await createApp({
    writeRoot,
    projectRoot: writeRoot,
    uiDistDir: uiDir,
    token,
    expectedPort: port,
    logLevel: 'fatal',
    skipReplay: true,
    extendedSteps: true,
    packageRoot,
});

await app.listen({ host: '127.0.0.1', port });
process.stdout.write(`WIZARD_READY ${port}\n`);

const shutdown = () => {
    app.close().finally(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
