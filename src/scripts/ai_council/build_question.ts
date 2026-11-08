/**
 * Build the council question from an input file — moved out of `council_cli.ts`
 * unchanged (source-size ratchet). `max_bundle_bytes` raises the bundle ceiling
 * for one run (`--max-bundle-bytes`); the bundler still fails loud above it.
 */
import * as fs from 'node:fs';

import { _pyReprStr } from '../_lib/council_py_repr.js';
import { MAX_BUNDLE_BYTES, bundle_prompt, bundle_roadmap } from './bundler.js';
import { CouncilQuestion } from './orchestrator.js';

export function build_question(opts: {
    input_path: string;
    input_mode: string;
    max_tokens: number;
    prompt_mode_override?: string | null;
    max_bundle_bytes?: number | null;
}): [CouncilQuestion, string] {
    const { input_path, input_mode, max_tokens } = opts;
    const cap = opts.max_bundle_bytes ?? MAX_BUNDLE_BYTES;
    const prompt_mode_override = opts.prompt_mode_override ?? null;
    let ctx: { mode: string; text: string };
    let artefact: string;
    if (input_mode === 'prompt') {
        const text = fs.readFileSync(input_path, 'utf-8');
        ctx = bundle_prompt(text, cap);
        artefact = String(input_path);
    } else if (input_mode === 'roadmap') {
        ctx = bundle_roadmap(input_path, cap);
        artefact = String(input_path);
    } else {
        throw new ValueError(
            `unsupported input mode: ${_pyReprStr(input_mode)} (use prompt | roadmap)`,
        );
    }
    const mode = prompt_mode_override || ctx.mode;
    return [new CouncilQuestion({ mode, user_prompt: ctx.text, max_tokens }), artefact];
}

export class ValueError extends Error {}
