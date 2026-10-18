/**
 * The egress engine as a conditional chunk (road-to-one-detector-and-the-
 * senders-we-own 2.2b; council 2026-10-18, options C and B).
 *
 * Two halves, each from one of the council's conditions:
 *
 * 1. **The loader refuses every unusable chunk** — missing, altered against its
 *    sidecar, without a sidecar, of another schema, or syntactically invalid —
 *    and loads a good one. Each case builds a real chunk with esbuild into a
 *    temporary directory, so the bundled branch is exercised without the
 *    repository's own `dist/`.
 * 2. **No mode dispatches unscanned content in a protective mode.** With the
 *    engine unavailable, `off` never loads it, `observe` records the miss and
 *    changes no view, and `protect` and `strict` withhold every body.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    ENGINE_CHUNK_BASENAME,
    loadEgressEngineUncached,
    type EngineLoad,
} from '../../../src/scripts/hooks/egress_engine_loader.js';
import { ENGINE_UNAVAILABLE, runEgressStage, WITHHELD_MARKER, type EgressMode } from '../../../src/scripts/hooks/egress_stage.js';
import type { JsonObject } from '../../../src/scripts/hooks/payload_stub.js';
import { buildMetafile } from '../../../src/scripts/check_hook_bundle_composition.js';
import { sidecarPathFor } from '../../../src/scripts/hooks/bundle_integrity.js';
import { buildChunk } from '../../../src/scripts/hook_chunks.mjs';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

let tmp: string;
let goodChunk: Buffer;

function writeChunk(dir: string, body: Buffer | string, sidecar: 'match' | 'mismatch' | 'none'): string {
    fs.mkdirSync(dir, { recursive: true });
    const chunk = path.join(dir, ENGINE_CHUNK_BASENAME);
    fs.writeFileSync(chunk, body);
    const sha = createHash('sha256').update(body).digest('hex');
    if (sidecar !== 'none') {
        const recorded = sidecar === 'match' ? sha : sha.replace(/^./, sha[0] === '0' ? '1' : '0');
        // The loader's own sidecar path, so a test can never write a file it does not read.
        fs.writeFileSync(sidecarPathFor(chunk), `${recorded}  ${ENGINE_CHUNK_BASENAME}\n`);
    }
    // The loader resolves the chunk as a sibling of the bundle it runs from.
    return pathToFileURL(path.join(dir, 'dispatch.js')).href;
}

beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-chunk-'));
    const out = path.join(tmp, 'built.cjs');
    // The chunk build the shipped package uses (hook_chunks.mjs), to a temp path.
    buildChunk(REPO_ROOT, 'src/scripts/_lib/egress_engine.ts', out);
    goodChunk = fs.readFileSync(out);
});

afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

const reason = (l: EngineLoad): string => (l.ok ? 'ok' : l.reason);

describe('the loader refuses every unusable chunk', () => {
    it('loads a good chunk with a matching sidecar', () => {
        const load = loadEgressEngineUncached(writeChunk(path.join(tmp, 'good'), goodChunk, 'match'), true);
        expect(reason(load)).toBe('ok');
        if (load.ok) expect(load.engine.detect(`x ghp_${'a1'.repeat(18)} y`).length).toBe(1);
    });

    it('refuses a missing chunk', () => {
        const dir = path.join(tmp, 'missing');
        fs.mkdirSync(dir, { recursive: true });
        expect(reason(loadEgressEngineUncached(pathToFileURL(path.join(dir, 'dispatch.js')).href, true))).toBe('missing');
    });

    it('refuses a chunk altered against its sidecar', () => {
        const altered = Buffer.concat([goodChunk, Buffer.from('\n// altered\n')]);
        const url = writeChunk(path.join(tmp, 'altered'), altered, 'none');
        const sidecar = sidecarPathFor(path.join(tmp, 'altered', ENGINE_CHUNK_BASENAME));
        fs.writeFileSync(sidecar, `${createHash('sha256').update(goodChunk).digest('hex')}  ${ENGINE_CHUNK_BASENAME}\n`);
        // The sidecar the loader reads is present: this is the mismatch branch, not the missing one.
        expect(fs.existsSync(sidecar)).toBe(true);
        expect(reason(loadEgressEngineUncached(url, true))).toBe('digest');
        // And the same chunk with a matching sidecar loads, so the refusal is the digest's.
        fs.writeFileSync(sidecar, `${createHash('sha256').update(altered).digest('hex')}  ${ENGINE_CHUNK_BASENAME}\n`);
        expect(reason(loadEgressEngineUncached(url, true))).toBe('ok');
    });

    it('refuses a chunk with no sidecar to match', () => {
        expect(reason(loadEgressEngineUncached(writeChunk(path.join(tmp, 'nosidecar'), goodChunk, 'none'), true))).toBe('digest');
    });

    it('refuses a correctly digested chunk of another schema', () => {
        const stale = Buffer.from(goodChunk.toString('utf-8').replace(/ENGINE_SCHEMA = 1\b/, 'ENGINE_SCHEMA = 0'));
        expect(stale.equals(goodChunk)).toBe(false);
        expect(reason(loadEgressEngineUncached(writeChunk(path.join(tmp, 'stale'), stale, 'match'), true))).toBe('schema');
    });

    it('refuses a chunk that does not parse', () => {
        expect(reason(loadEgressEngineUncached(writeChunk(path.join(tmp, 'invalid'), 'module.exports = {', 'match'), true))).toBe('invalid');
    });

    it('refuses a present chunk whose own dependency cannot be resolved as invalid, not missing', () => {
        const body = "require('./no-such-dependency.cjs'); module.exports = {};";
        expect(reason(loadEgressEngineUncached(writeChunk(path.join(tmp, 'transitive'), body, 'match'), true))).toBe('invalid');
    });

    it('returns a value, never a throw, when the bundle url itself cannot be resolved', () => {
        let load: EngineLoad | undefined;
        expect(() => {
            load = loadEgressEngineUncached('not a url', true);
        }).not.toThrow();
        expect(reason(load as EngineLoad)).toBe('invalid');
    });

    it('refuses a chunk missing an export it must carry', () => {
        const body = 'module.exports = { ENGINE_SCHEMA: 1, EGRESS_RULES: [] };';
        expect(reason(loadEgressEngineUncached(writeChunk(path.join(tmp, 'partial'), body, 'match'), true))).toBe('invalid');
    });
});

describe('an unavailable engine never lets a protective mode pass content unscanned', () => {
    const PLANTED = ['ghp', 'Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr8St1Uv3Wx5Yz7'.slice(0, 36)].join('_');
    const env = (): JsonObject => ({
        schema_version: 1,
        platform: 'claude',
        event: 'pre_tool_use',
        workspace_root: tmp,
        payload: { tool_name: 'Bash', tool_input: { command: `echo ${PLANTED}` } },
        settings: {},
    });
    const unavailable = (): EngineLoad => ({ ok: false, reason: 'missing' });

    it('off never loads the engine', () => {
        let called = 0;
        const r = runEgressStage(env(), () => 'off', () => {
            called += 1;
            return unavailable();
        });
        expect(called).toBe(0);
        expect(r.placeholder).toBeUndefined();
    });

    it('observe records the miss and changes no view', () => {
        const r = runEgressStage(env(), () => 'observe', unavailable);
        expect(r.placeholder).toBeUndefined();
        expect(r.refused).toEqual([{ field: 'input', rule: ENGINE_UNAVAILABLE }]);
    });

    for (const mode of ['protect', 'strict'] as EgressMode[]) {
        it(`${mode} withholds every body`, () => {
            const r = runEgressStage(env(), () => mode, unavailable);
            const view = JSON.stringify(r.placeholder);
            expect(view.includes(PLANTED)).toBe(false);
            expect(view.includes(WITHHELD_MARKER)).toBe(true);
            expect(r.refused).toEqual([{ field: 'input', rule: ENGINE_UNAVAILABLE }]);
        });
    }
});

describe('nothing in the dispatch bundle pulls the engine statically', () => {
    it('the built bundle carries none of the engine modules', () => {
        const meta = JSON.parse(buildMetafile(REPO_ROOT)) as { inputs: Record<string, unknown> };
        const engine = [
            'src/scripts/_lib/egress_rules.ts',
            'src/scripts/_lib/egress_token.ts',
            'src/scripts/_lib/secret_detector.ts',
            'src/scripts/_lib/egress_engine.ts',
        ];
        // The path form the check reads: the stage that uses the engine is in the bundle.
        expect('src/scripts/hooks/egress_stage.ts' in meta.inputs).toBe(true);
        expect(engine.filter((m) => m in meta.inputs)).toEqual([]);
    }, 120_000);
});
