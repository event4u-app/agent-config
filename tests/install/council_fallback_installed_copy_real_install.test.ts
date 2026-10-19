/**
 * `council-fallback-loses-zero-seats`, read off an installed copy instead of the
 * in-repo unit chain.
 *
 * The claim's earlier evidence, `council_cli.test.ts`, drives `consult()` with
 * faked transports inside this repository. That proves the orchestrator's logic,
 * not that the package a consumer installs carries it: a tarball missing a
 * module, a dispatcher that no longer reaches `council_cli.ts`, or a factory that
 * stopped building the api twin would leave it green.
 *
 * Both council transports cross a process boundary — the cli rung spawns the
 * vendor binary, the api rung spawns `curl` — so this case needs no seam in
 * shipped code. It packs this checkout, lays the tarball out in a throwaway
 * consumer project's `node_modules` with its declared dependencies linked, and
 * runs the installed
 * `agent-config council:run --confirm` with fake `claude`, `codex` and `curl`
 * first on PATH. `claude` fails with a login error (`auth_rejected`, eligible
 * without any opt-in), `codex` answers, and `curl` answers only the Anthropic
 * Messages URL with a canned body. Nothing reaches the network and nothing is
 * spent: the key is a placeholder and no real binary is reachable.
 *
 * Two readings of the claim's two halves:
 *   1. budget permits the retry → both seats present, the failed seat answered
 *      over the api rung, the dead binary spawned once across both rounds;
 *   2. budget refuses the retry → the original failure stands, the seat is
 *      absent, `fallback_skipped: cost_budget` says so, and `curl` never ran.
 *
 * Two deviations from a bare consumer, both about reaching the code rather than
 * what it does: dependencies are this checkout's lockfile-resolved copies rather
 * than a fresh range resolution, and `tsx` is linked beside the package because
 * it is a dev dependency and the dispatcher's own `npx tsx` fallback would
 * otherwise need the registry; and `npm pack --ignore-scripts` ships the `dist/` already built
 * here instead of rebuilding it (CI builds before Vitest).
 *
 * HOME and EVENT4U_CONFIG_HOME are injected, never inherited, per
 * `docs/contracts/consumer-harness.md`. Runtime: ~20 s (pack + layout
 * once, then one council pass per case).
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const BUILT_CLI = path.join(REPO_ROOT, 'dist', 'cli', 'agent-config.js');

const TWIN_ANSWER = 'ANTHROPIC-API-TWIN-ANSWER';
const CODEX_ANSWER = 'CODEX-SEAT-ANSWER';
const OUTPUT_REL = 'agents/runtime/council/responses/run.json';
// The necessity classifier skips questions it reads as not worth a council; this
// one is a genuine design trade-off so the pass proceeds.
const QUESTION =
    'Should our service split the billing module into its own deployable, given the ' +
    'coupling between invoicing and tenant provisioning? Weigh the trade-offs.\n';

const perCase: string[] = [];
let installRoot = '';
let project = '';

function mkTmp(prefix: string): string {
    return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

function writeExecutable(file: string, body: string): void {
    fs.writeFileSync(file, body, { mode: 0o755 });
}

beforeAll(() => {
    expect(fs.existsSync(BUILT_CLI), 'dist/cli is not built — run `npm run build`; the tarball ships it').toBe(true);
    installRoot = mkTmp('council-fallback-install-');
    const packDir = path.join(installRoot, 'pack');
    fs.mkdirSync(packDir);
    const pack = spawnSync('npm', ['pack', '--ignore-scripts', '--silent', '--pack-destination', packDir], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        timeout: 120_000,
    });
    expect(pack.status, `npm pack failed:\n${pack.stdout}\n${pack.stderr}`).toBe(0);
    const tarball = fs.readdirSync(packDir).find((f) => f.endsWith('.tgz'));
    expect(tarball, 'npm pack produced no tarball').toBeDefined();

    project = path.join(installRoot, 'consumer');
    const installed = path.join(project, 'node_modules', '@event4u', 'agent-config');
    fs.mkdirSync(installed, { recursive: true });
    fs.writeFileSync(path.join(project, 'package.json'), '{"name":"consumer","version":"1.0.0","private":true}\n');
    const untar = spawnSync('tar', ['-xzf', path.join(packDir, tarball as string), '-C', installed, '--strip-components=1'], {
        encoding: 'utf8',
    });
    expect(untar.status, `extracting the tarball failed:\n${untar.stderr}`).toBe(0);

    // The tarball's declared runtime dependencies, plus `tsx`, are linked from
    // this checkout's lockfile-resolved tree rather than resolved from the
    // registry. A range resolution at test time depends on what the npm cache or
    // the registry holds that day, which made the setup red on CI for a reason
    // that is not a property of the package. Only the DECLARED dependencies are
    // linked, so a module the shipped code imports without declaring it still
    // fails to resolve from the installed copy.
    const shipped = JSON.parse(fs.readFileSync(path.join(installed, 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>;
        bin?: Record<string, string>;
    };
    for (const dep of [...Object.keys(shipped.dependencies ?? {}), 'tsx']) {
        const target = path.join(REPO_ROOT, 'node_modules', dep);
        expect(fs.existsSync(target), `${dep} is not installed in this checkout`).toBe(true);
        const link = path.join(project, 'node_modules', dep);
        fs.mkdirSync(path.dirname(link), { recursive: true });
        fs.symlinkSync(target, link);
    }
    const binDir = path.join(project, 'node_modules', '.bin');
    fs.mkdirSync(binDir, { recursive: true });
    const binRel = shipped.bin?.['agent-config'];
    expect(binRel, 'the shipped package.json declares no agent-config bin').toBeDefined();
    fs.symlinkSync(path.join(installed, binRel as string), path.join(binDir, 'agent-config'));
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'), path.join(binDir, 'tsx'));
    expect(fs.existsSync(path.join(binDir, 'agent-config'))).toBe(true);
}, 300_000);

afterAll(() => {
    if (installRoot) fs.rmSync(installRoot, { recursive: true, force: true });
});

afterEach(() => {
    while (perCase.length > 0) fs.rmSync(perCase.pop() as string, { recursive: true, force: true });
    fs.rmSync(path.join(project, 'agents'), { recursive: true, force: true });
});

interface Pass {
    status: number | null;
    output: string;
    calls: string[];
    responses: Array<{ provider: string; error: string | null; text: string; metadata: Record<string, string> }>;
    quorum: { status: string; total: number; present: number };
}

function runInstalledCouncil(maxTotalUsd: string): Pass {
    const home = mkTmp('council-fallback-home-');
    perCase.push(home);
    const configHome = path.join(home, '.event4u', 'agent-config');
    const fakebin = path.join(home, 'fakebin');
    const callLog = path.join(home, 'calls.log');
    fs.mkdirSync(path.join(configHome, 'settings'), { recursive: true });
    fs.mkdirSync(fakebin);
    // What the environment detector reads as "this CLI is logged in", so `auto`
    // resolves both seats to the cli rung.
    fs.mkdirSync(path.join(home, '.claude'));
    fs.writeFileSync(path.join(home, '.claude', '.credentials.json'), '{"claudeAiOauth":{"accessToken":"harness"}}\n');
    fs.mkdirSync(path.join(home, '.codex'));
    fs.writeFileSync(path.join(home, '.codex', 'auth.json'), '{"tokens":{"access_token":"harness"}}\n');
    fs.writeFileSync(
        path.join(configHome, 'settings', '.ai-council.yml'),
        [
            'enabled: true',
            'cost_budget:',
            `  max_total_usd: ${maxTotalUsd}`,
            'members:',
            '  anthropic:',
            '    enabled: true',
            '    model: claude-sonnet-4-5',
            '    api_key_ref: env:HARNESS_ANTHROPIC_KEY',
            '  openai:',
            '    enabled: true',
            '    model: codex-default',
            '',
        ].join('\n'),
    );

    writeExecutable(
        path.join(fakebin, 'claude'),
        '#!/bin/sh\ncat >/dev/null\necho "claude $1" >> "$HARNESS_CALL_LOG"\n' +
            'echo "Error: not logged in · Please run /login" >&2\nexit 1\n',
    );
    writeExecutable(
        path.join(fakebin, 'codex'),
        '#!/bin/sh\ncat >/dev/null\necho "codex $1" >> "$HARNESS_CALL_LOG"\n' +
            `echo '{"type":"item.completed","item":{"id":"i1","type":"agent_message","text":"${CODEX_ANSWER}"}}'\n` +
            `echo '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}'\n`,
    );
    const messagesBody = JSON.stringify({
        id: 'msg_harness',
        type: 'message',
        role: 'assistant',
        model: 'claude-sonnet-4-5',
        content: [{ type: 'text', text: TWIN_ANSWER }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 12, output_tokens: 7 },
    });
    // `curlJsonPost` appends `-w '\n%{http_code}'`; the body, a newline and the
    // status is the shape it splits.
    writeExecutable(
        path.join(fakebin, 'curl'),
        '#!/bin/sh\ncat >/dev/null\n' +
            'for a in "$@"; do case "$a" in https://*) url="$a";; esac; done\n' +
            'echo "curl $url" >> "$HARNESS_CALL_LOG"\n' +
            '[ "$url" = "https://api.anthropic.com/v1/messages" ] || { echo "fake curl: refused $url" >&2; exit 7; }\n' +
            `printf '%s\\n%s' '${messagesBody}' 200\n`,
    );

    fs.mkdirSync(path.join(project, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(project, 'agents', 'question.md'), QUESTION);

    const run = spawnSync(
        path.join(project, 'node_modules', '.bin', 'agent-config'),
        ['council:run', 'agents/question.md', '--output', OUTPUT_REL, '--confirm'],
        {
            cwd: project,
            encoding: 'utf8',
            timeout: 120_000,
            env: {
                HOME: home,
                EVENT4U_CONFIG_HOME: configHome,
                PATH: [fakebin, path.dirname(process.execPath), '/usr/bin', '/bin'].join(path.delimiter),
                TMPDIR: os.tmpdir(),
                HARNESS_CALL_LOG: callLog,
                HARNESS_ANTHROPIC_KEY: 'sk-ant-harness-placeholder',
                npm_config_offline: 'true',
                npm_config_cache: path.join(home, 'npm-cache'),
                AGENT_CONFIG_NO_UI: '1',
                CI: '1',
            },
        },
    );
    const output = `${run.stdout}\n${run.stderr}`;
    const outFile = path.join(project, OUTPUT_REL);
    expect(fs.existsSync(outFile), `the installed council wrote no response file:\n${output}`).toBe(true);
    const payload = JSON.parse(fs.readFileSync(outFile, 'utf8')) as Pick<Pass, 'responses' | 'quorum'>;
    const calls = fs.existsSync(callLog) ? fs.readFileSync(callLog, 'utf8').trim().split('\n') : [];
    return { status: run.status, output, calls, responses: payload.responses, quorum: payload.quorum };
}

function seat(pass: Pass, provider: string): Pass['responses'][number] {
    const r = pass.responses.find((x) => x.provider === provider);
    expect(r, `no ${provider} response in the artefact`).toBeDefined();
    return r as Pass['responses'][number];
}

describe('council-fallback-loses-zero-seats — an installed copy, real transports faked at the process boundary', () => {
    it('a budget that permits the retry: the failed cli seat answers over the api rung and no seat is lost', () => {
        const pass = runInstalledCouncil('20.0');
        expect(pass.status, pass.output).toBe(0);

        expect(pass.quorum, pass.output).toMatchObject({ total: 2, present: 2 });
        const anthropic = seat(pass, 'anthropic');
        expect(anthropic.error, pass.output).toBeNull();
        expect(anthropic.text).toBe(TWIN_ANSWER);
        expect(anthropic.metadata).toMatchObject({
            fallback_from: 'cli',
            fallback_reason: 'auth_rejected',
            fallback_original_error: 'auth_expired',
            transport: 'api',
        });
        const openai = seat(pass, 'openai');
        expect(openai.error).toBeNull();
        expect(openai.text).toBe(CODEX_ANSWER);
        expect(openai.metadata['transport']).toBe('cli');

        // The cli rung really ran and failed, the api rung really went through
        // `curl`, and the established twin replaced the dead binary on the
        // second round instead of respawning it.
        expect(pass.calls.filter((c) => c === 'claude --print')).toHaveLength(1);
        expect(pass.calls).toContain('curl https://api.anthropic.com/v1/messages');
    }, 180_000);

    it('a budget that refuses the retry: the original failure stands and `fallback_skipped: cost_budget` says so', () => {
        const pass = runInstalledCouncil('0.000001');
        expect(pass.status, pass.output).toBe(0);

        expect(pass.quorum, pass.output).toMatchObject({ total: 2, present: 1 });
        const anthropic = seat(pass, 'anthropic');
        expect(anthropic.error).toBe('auth_expired');
        expect(anthropic.metadata['fallback_skipped']).toBe('cost_budget');
        expect(anthropic.metadata['fallback_from']).toBeUndefined();
        expect(anthropic.metadata['transport']).toBe('cli');
        expect(seat(pass, 'openai').text).toBe(CODEX_ANSWER);

        expect(pass.calls.some((c) => c.startsWith('curl'))).toBe(false);
        expect(pass.calls.filter((c) => c === 'claude --print').length).toBeGreaterThan(0);
    }, 180_000);
});
