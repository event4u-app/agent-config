import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { observeAssetRender as observeRaw, type AssetRenderRecord } from '../../src/scripts/_lib/asset_render_record.js';
import { readTurnRunState, run, statePathFor } from '../../src/scripts/before_complete_hook.js';
import { TRANSCRIPT_FALLBACK_REASON, openSvgObligation } from '../../src/scripts/hooks/svg_obligation.js';
import type { ToolCall } from '../../src/scripts/_lib/turn_end_transcript.js';

/**
 * `road-to-svg-witness-provenance` Phase 1 — the render is observed, not
 * inferred. The forged-manifest routes below are the ones the transcript gate
 * needed a pattern list for; on the record path every one of them stays open
 * with no pattern list at all, because none of them is a render the hook saw.
 */
let root: string;

/** The record shape, for cases whose exit is readable — the gap case calls `observeRaw`. */
const observeAssetRender = (...a: Parameters<typeof observeRaw>): AssetRenderRecord | null =>
    observeRaw(...a) as AssetRenderRecord | null;

const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">\n' +
    '  <title>A square</title>\n' +
    '  <rect x="4" y="4" width="16" height="16" fill="#2563eb"/>\n' +
    '</svg>\n';
const digestOf = (text: string): string => crypto.createHash('sha256').update(text).digest('hex');
const FILE = 'assets/logo.svg';
const MANIFEST = 'agents/runtime/state/render/assets-logo-svg/manifest.json';
const RENDER = `agent-config ui:render ${FILE} --profile asset`;
const edit = (p: string): ToolCall => ({ name: 'Write', path: p });
const bash = (command: string): ToolCall => ({ name: 'Bash', command });

function write(rel: string, content: string): void {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
}

/** The manifest `ui:render` leaves for a verified render of the file. */
function renderManifest(rel = MANIFEST, target = FILE, slug = 'assets-logo-svg'): void {
    const body = { target, slug, profile: 'asset', verification: 'verified', asset: { digest: digestOf(SVG) } };
    write(rel, `${JSON.stringify(body, null, 2)}\n`);
}

/** Drive the real recorder with one host event. */
function hook(event: string, payload: Record<string, unknown> = {}): void {
    run(JSON.stringify({ event, session_id: 's1', payload }), { consumer_root: root });
}
const ok = (command: string) => ({ tool_name: 'Bash', tool_input: { command }, tool_response: { stdout: '', stderr: '', interrupted: false } });
const failed = (command: string, code: number) => ({ tool_name: 'Bash', tool_input: { command }, tool_response: `Error: Exit code ${String(code)}\n` });

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-record-'));
    write(FILE, SVG);
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('1.1 — the recorder writes a successful asset render, and only that', () => {
    it('a successful render records exactly one entry; a failed one records none', () => {
        renderManifest();
        hook('user_prompt_submit');
        hook('post_tool_use', { tool_name: 'Write', tool_input: { file_path: FILE } });
        hook('post_tool_use', failed(RENDER, 1));
        hook('post_tool_use', ok(RENDER));
        const state = JSON.parse(fs.readFileSync(path.join(root, statePathFor('s1')), 'utf8')) as Record<string, unknown>;
        expect(state['asset_renders']).toEqual([
            {
                file: FILE,
                file_digest: digestOf(SVG),
                manifest: MANIFEST,
                manifest_digest: digestOf(fs.readFileSync(path.join(root, MANIFEST), 'utf8')),
                exit_code: 0,
            },
        ]);
        expect(readTurnRunState(root, 's1')?.asset_renders).toHaveLength(1);
    });

    it('records the renderer-absent exit, which still leaves a static witness', () => {
        renderManifest();
        expect(observeAssetRender(root, RENDER, 3)?.exit_code).toBe(3);
        expect(observeAssetRender(root, RENDER, 1)).toBeNull();
        // No readable exit is an instrument gap, recorded as such — and the
        // manifest bytes the render left are still bound, so the gap is never a
        // reason to read the forgeable transcript instead (finding 37af6b94b10a).
        expect(observeRaw(root, RENDER, null)).toEqual({
            file: FILE,
            file_digest: digestOf(SVG),
            manifest: MANIFEST,
            manifest_digest: digestOf(fs.readFileSync(path.join(root, MANIFEST), 'utf8')),
            exit_code: null,
            instrument_gap: true,
        });
        // With no manifest to bind, the gap is evidence of nothing.
        fs.rmSync(path.join(root, MANIFEST));
        expect(observeRaw(root, RENDER, null)).toEqual({ instrument_gap: true, command: RENDER });
    });

    it('the real recorder records exit 3 from a failure envelope', () => {
        renderManifest();
        hook('user_prompt_submit');
        hook('post_tool_use', { tool_name: 'Write', tool_input: { file_path: FILE } });
        run(
            JSON.stringify({
                event: 'post_tool_use',
                session_id: 's1',
                native_event: 'PostToolUseFailure',
                payload: { hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', tool_input: { command: RENDER }, error: 'Exit code 3\nno renderer' },
            }),
            { consumer_root: root },
        );
        const renders = readTurnRunState(root, 's1')?.asset_renders as AssetRenderRecord[] | undefined;
        expect(renders?.map((r) => r.exit_code)).toEqual([3]);
    });

    it('a render chained to a write records nothing', () => {
        renderManifest();
        expect(observeAssetRender(root, `${RENDER} && echo '{}' > ${MANIFEST}`, 0)).toBeNull();
        expect(observeAssetRender(root, `${RENDER}; cp forged.json ${MANIFEST}`, 0)).toBeNull();
    });

    it('follows the CLI: --slug, --project-root, a leading cd, no manifest', () => {
        renderManifest('agents/runtime/state/render/custom/manifest.json', FILE, 'custom');
        expect(observeAssetRender(root, `${RENDER} --slug custom`, 0)?.manifest).toBe(
            'agents/runtime/state/render/custom/manifest.json',
        );
        renderManifest('assets/agents/runtime/state/render/logo-svg/manifest.json', 'logo.svg', 'logo-svg');
        expect(observeAssetRender(root, 'cd assets && agent-config ui:render logo.svg --profile asset', 0)?.manifest).toBe(
            'assets/agents/runtime/state/render/logo-svg/manifest.json',
        );
        expect(observeAssetRender(root, 'agent-config ui:render logo.svg --project-root=assets --profile asset', 0)?.file).toBe(FILE);
        // The render left no manifest at the slug it writes: nothing to bind.
        expect(observeAssetRender(root, `${RENDER} --slug elsewhere`, 0)).toBeNull();
        // The host's own working directory, where it reports one.
        expect(observeAssetRender(root, 'agent-config ui:render logo.svg --profile asset', 0, path.join(root, 'assets'))?.file).toBe(FILE);
    });

    it('an argument the shell could rewrite records nothing (review finding 1)', () => {
        // `--slug $S` renders wherever S points, while the literal path holds a
        // manifest the agent wrote beforehand. Binding that path would let the
        // pre-written manifest discharge the obligation.
        renderManifest('agents/runtime/state/render/$S/manifest.json', FILE, '$S');
        expect(observeAssetRender(root, `${RENDER} --slug $S`, 0)).toBeNull();
        for (const w of ['~/x.svg', 'assets/*.svg', 'assets/lo\\go.svg', '"assets/my logo.svg"']) {
            expect(observeAssetRender(root, `agent-config ui:render ${w} --profile asset`, 0), w).toBeNull();
        }
        // Folding stderr into stdout is still a plain render.
        renderManifest();
        expect(observeAssetRender(root, `${RENDER} 2>&1 | tail -5`, 0)?.manifest).toBe(MANIFEST);
    });

    it('a manifest describing another target or slug is not this render\'s (review finding 2)', () => {
        renderManifest(MANIFEST, 'assets/other.svg');
        expect(observeAssetRender(root, RENDER, 0)).toBeNull();
        renderManifest(MANIFEST, FILE, 'other-slug');
        expect(observeAssetRender(root, RENDER, 0)).toBeNull();
    });
});

describe('1.2 — only a recorded render discharges', () => {
    const recorded = (): unknown[] => [observeAssetRender(root, RENDER, 0)];

    it('a real recorded render discharges', () => {
        renderManifest();
        expect(openSvgObligation(root, [edit(FILE), bash(RENDER)], recorded())).toBeNull();
    });

    it('a transcript render with no record discharges nothing, whatever wrote the manifest', () => {
        // Pins the record path's indifference to the write route: with no
        // recorded render, no forgery shape needs recognising. The forgery a
        // recorded render could be fooled by is pinned in 1.1 above.
        renderManifest();
        for (const forge of [
            edit(MANIFEST),
            bash(`echo '{}' > ${MANIFEST}`),
            bash(`cd agents/runtime/state && printf '{}' > render/assets-logo-svg/manifest.json`),
            bash(`python3 -c "open('${MANIFEST}','w').write('{}')"`),
            bash(`lua -e "io.open('${MANIFEST}','w')"`),
            bash('./scripts/write_it.sh'),
            bash('W=$M; $W'),
        ]) {
            // The forgery is followed by a render the transcript shows — the
            // shape that used to need the write to be recognised. No render was
            // recorded, so nothing discharges, whatever the route.
            const finding = openSvgObligation(root, [edit(FILE), forge, bash(RENDER)], []);
            expect(finding, JSON.stringify(forge)).not.toBeNull();
            expect(finding?.reason).toContain('was observed by the hook');
        }
    });

    it('a manifest rewritten after the recorded render discharges nothing', () => {
        renderManifest();
        const records = recorded();
        write(MANIFEST, `${JSON.stringify({ profile: 'asset', verification: 'verified', asset: { digest: digestOf(SVG) }, x: 1 })}\n`);
        const finding = openSvgObligation(root, [edit(FILE), bash(RENDER)], records);
        expect(finding?.reason).toContain('has changed since');
    });

    it('a recorded render of earlier bytes discharges nothing', () => {
        renderManifest();
        const records = recorded();
        write(FILE, SVG.replace('#2563eb', '#dc2626'));
        expect(openSvgObligation(root, [edit(FILE), bash(RENDER)], records)).not.toBeNull();
    });
});

describe('1.3 — no record is a named fallback', () => {
    it('reports the transcript fallback verbatim', () => {
        renderManifest();
        // No recorded entry, a matching manifest, and no render after the edit.
        const finding = openSvgObligation(root, [edit(FILE)], null);
        expect(finding?.reason).toContain(TRANSCRIPT_FALLBACK_REASON);
        // And the record path never carries it.
        expect(openSvgObligation(root, [edit(FILE), bash(RENDER)], [])?.reason).not.toContain(TRANSCRIPT_FALLBACK_REASON);
    });

    it('a render with no readable exit is read on the record path, never the transcript', () => {
        // Review round 2, finding 1 wanted a host that reports no exit status not
        // to refuse every edited .svg forever; the gap now binds the manifest the
        // render left, so honest work still discharges on the record.
        renderManifest();
        const gap = [observeRaw(root, RENDER, null)];
        expect(openSvgObligation(root, [edit(FILE), bash(RENDER)], gap)).toBeNull();
        // A manifest forged after the gap render no longer hashes to what the
        // hook bound, so it discharges nothing — the transcript rule would have
        // accepted it, because the forging write is not in the tool calls.
        write(MANIFEST, `${JSON.stringify({ target: FILE, slug: 'assets-logo-svg', profile: 'asset', verification: 'verified', asset: { digest: digestOf(SVG) }, forged: true })}\n`);
        const forged = openSvgObligation(root, [edit(FILE), bash(RENDER)], gap);
        expect(forged).not.toBeNull();
        expect(forged?.reason).not.toContain(TRANSCRIPT_FALLBACK_REASON);
        // A gap with nothing bound is evidence of nothing either.
        const unbound = [{ instrument_gap: true, command: RENDER }];
        expect(openSvgObligation(root, [edit(FILE), bash(RENDER)], unbound)).not.toBeNull();
    });

    it('a recorder that predates the field reads as no record', () => {
        hook('user_prompt_submit');
        hook('post_tool_use', { tool_name: 'Write', tool_input: { file_path: FILE } });
        const p = path.join(root, statePathFor('s1'));
        const state = JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
        delete state['asset_renders'];
        fs.writeFileSync(p, JSON.stringify(state));
        expect(readTurnRunState(root, 's1')?.asset_renders).toBeUndefined();
    });
});
