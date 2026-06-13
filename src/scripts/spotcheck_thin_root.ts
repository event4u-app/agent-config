#!/usr/bin/env tsx
/** Phase 6.6 platform spot-check via AI council.
 *
 * TypeScript twin of `src/scripts/spotcheck_thin_root.py` (ADR-090, Phase 8 /
 * Wave 8h). Mirrors the Python contract — no flags, exit 0, the two
 * `Running … / ✅  Wrote …` stderr lines, and byte-identical written
 * `thin-root-platform-spotcheck.md` / `.json`. No behaviour changes.
 *
 * Sends the refactored package-root AGENTS.md and the consumer template
 * to Sonnet 4.5 + gpt-4o, asks each member to answer five questions
 * that simulate a fresh agent landing on the file. Records qualitative
 * verdicts in agents/runtime/reports/thin-root-platform-spotcheck.md.
 *
 * Cross-batch dependency (DIVERGENCE — see
 * `docs/migration/divergences/src-scripts-spotcheck_thin_root.md`): the live
 * council step needs the still-Python `ai_council.clients`
 * (AnthropicClient / OpenAIClient / load_anthropic_key / load_openai_key) and
 * `ai_council.orchestrator` (CostBudget / CouncilQuestion / consult) modules —
 * ~2,800 lines of network-calling code with no TS twin in this wave, and a
 * `.ts` cannot import a `.py`. Per the "PORT + import, never inline the
 * un-ported logic" rule, this twin does NOT re-implement those clients; it
 * delegates the live consult to a `python3` shim that imports the real Python
 * modules (the same strategy `check_discovery_determinism.ts` and
 * `smoke_quickstart.ts` use for their un-ported Python deps). The artefact
 * assembly and report writing are deterministic and live in TS. The script is
 * non-deterministic by construction (live LLM latency / token counts), so it
 * has no golden-parity path.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);

// Python: ROOT = Path(__file__).resolve().parent.parent.parent
const ROOT = path.resolve(_HERE, '..', '..', '..');

const QUESTIONS = `
You are evaluating whether the AGENTS.md file below is a sufficient
entry point for an AI coding agent landing on this repository for
the first time. You see only the AGENTS.md content; you do NOT have
file-system access. Answer the following five questions in JSON
shape \`{"q1": {...}, ..., "q5": {...}}\` where each value is
\`{"answer": <string>, "confidence": "high"|"medium"|"low",
"pointer_used": <one of the linked paths from AGENTS.md, or null>}\`.

Q1. Where do I edit content in this repo / project? (a path)
Q2. What command do I run to verify everything is green before opening a PR?
Q3. Where would I find the always-active behavioural rules?
Q4. If only this file is reachable, what five things must I assume to be true to act safely? (cite the emergency-triage block)
Q5. What outboard target document would I open to learn the package-self-orientation / the consumer-fill-out guide? (a path)

After the JSON, add a short prose verdict (≤ 5 sentences) on:
- Whether the pointer-following worked (could you cite a path for Q1, Q3, Q5?)
- Whether the emergency-triage block answered Q4 unambiguously.
- One concrete improvement you'd make to the AGENTS.md.

Do not invent file paths. If a question cannot be answered from the
file alone, set \`"pointer_used": null\` and lower confidence.
`.trim();

interface ResponseRow {
    provider: string;
    model: string;
    input_tokens: number | null;
    output_tokens: number | null;
    latency_ms: number | null;
    error: string | null;
    text: string | null;
}

/**
 * Run the live council via a `python3` shim importing the still-Python
 * `ai_council` modules. Returns the council responses as plain rows. Mirrors
 * the Python original's `consult(members, question, budget, table, rounds=1)`
 * call exactly (same members, prompt, max_tokens, budget).
 */
function _consultViaPython(artefact: string): ResponseRow[] {
    const shim = `
import json, sys
from pathlib import Path
ROOT = Path(${JSON.stringify(ROOT)})
sys.path.insert(0, str(ROOT / "src"))
from scripts.ai_council.clients import (
    AnthropicClient, OpenAIClient, load_anthropic_key, load_openai_key,
)
from scripts.ai_council.orchestrator import CostBudget, CouncilQuestion, consult
from scripts.ai_council.pricing import load_prices

artefact = json.loads(sys.stdin.read())
members = [
    AnthropicClient(model="claude-sonnet-4-5", api_key=load_anthropic_key()),
    OpenAIClient(model="gpt-4o", api_key=load_openai_key()),
]
question = CouncilQuestion(mode="files", user_prompt=artefact, max_tokens=1500)
budget = CostBudget(max_total_usd=2.00, max_calls=4)
table = load_prices()
print("Running spot-check council …", file=sys.stderr)
responses = consult(members, question, budget, table=table, rounds=1)
rows = [{
    "provider": r.provider, "model": r.model,
    "input_tokens": r.input_tokens, "output_tokens": r.output_tokens,
    "latency_ms": r.latency_ms, "error": r.error, "text": r.text,
} for r in responses]
sys.stdout.write(json.dumps(rows))
`;
    const result = spawnSync('python3', ['-c', shim], {
        input: JSON.stringify(artefact),
        encoding: 'utf-8',
        cwd: ROOT,
        stdio: ['pipe', 'pipe', 'inherit'],
        maxBuffer: 256 * 1024 * 1024,
    });
    if (result.status !== 0) {
        throw new Error(`council shim failed: exit ${result.status}`);
    }
    return JSON.parse(result.stdout ?? '[]') as ResponseRow[];
}

/** Python `json.dumps(raw, indent=2)` parity (ensure_ascii=True, no sort_keys). */
function _pyJsonStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') {
            out += '\\"';
        } else if (ch === '\\') {
            out += '\\\\';
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else if (ch === '\b') {
            out += '\\b';
        } else if (ch === '\f') {
            out += '\\f';
        } else if (code < 0x20) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else if (code < 0x7f) {
            out += ch;
        } else if (code <= 0xffff) {
            out += `\\u${code.toString(16).padStart(4, '0')}`;
        } else {
            const c = code - 0x10000;
            const hi = 0xd800 + (c >> 10);
            const lo = 0xdc00 + (c & 0x3ff);
            out += `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
        }
    }
    return out + '"';
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function pyJsonDumpsIndent2(obj: Json, level = 0): string {
    if (obj === null || obj === undefined) {
        return 'null';
    }
    if (typeof obj === 'number') {
        return String(obj);
    }
    if (typeof obj === 'string') {
        return _pyJsonStr(obj);
    }
    if (obj === true) {
        return 'true';
    }
    if (obj === false) {
        return 'false';
    }
    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]';
        }
        const pad = ' '.repeat(2 * (level + 1));
        const closePad = ' '.repeat(2 * level);
        return `[\n${obj.map((v) => pad + pyJsonDumpsIndent2(v, level + 1)).join(',\n')}\n${closePad}]`;
    }
    const keys = Object.keys(obj as Record<string, Json>);
    if (keys.length === 0) {
        return '{}';
    }
    const pad = ' '.repeat(2 * (level + 1));
    const closePad = ' '.repeat(2 * level);
    const parts = keys.map(
        (k) => `${pad}${_pyJsonStr(k)}: ${pyJsonDumpsIndent2((obj as Record<string, Json>)[k] as Json, level + 1)}`,
    );
    return `{\n${parts.join(',\n')}\n${closePad}}`;
}

export function main(): number {
    const packageRoot = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf-8');
    const consumerTemplate = fs.readFileSync(
        path.join(ROOT, '.agent-src.uncondensed', 'templates', 'AGENTS.md'),
        'utf-8',
    );

    const artefact =
        '## Artefact A — package-root AGENTS.md\n\n' +
        `\`\`\`markdown\n${packageRoot}\n\`\`\`\n\n` +
        '## Artefact B — consumer-template AGENTS.md\n\n' +
        `\`\`\`markdown\n${consumerTemplate}\n\`\`\`\n\n` +
        `${QUESTIONS}\n`;

    const responses = _consultViaPython(artefact);

    const outDir = path.join(ROOT, 'agents', 'reports');
    fs.mkdirSync(outDir, { recursive: true });
    const mdPath = path.join(outDir, 'thin-root-platform-spotcheck.md');
    const jsonPath = path.join(outDir, 'thin-root-platform-spotcheck.json');

    const mdLines: string[] = [
        '# Thin-Root platform spot-check (Phase 6.6)',
        '',
        '> AI-council proxy for the manual platform spot-check. Two',
        '> external reviewers (Sonnet 4.5, gpt-4o) simulate a fresh',
        '> agent landing on the refactored AGENTS.md and answer five',
        '> orientation questions from the file alone.',
        '',
        '## Verdicts',
        '',
    ];

    const raw: Json[] = [];
    for (const r of responses) {
        const body = r.text || `<error: ${r.error}>`;
        raw.push({
            provider: r.provider,
            model: r.model,
            tokens_in: r.input_tokens,
            tokens_out: r.output_tokens,
            latency_ms: r.latency_ms,
            error: r.error,
            text: body,
        });
        mdLines.push(`### ${r.provider} (${r.model})`);
        mdLines.push('');
        mdLines.push(
            `- tokens in: ${r.input_tokens} · out: ${r.output_tokens} · latency: ${r.latency_ms}ms`,
        );
        if (r.error) {
            mdLines.push(`- error: \`${r.error}\``);
        }
        mdLines.push('');
        mdLines.push('```');
        mdLines.push(body.slice(0, 8000));
        mdLines.push('```');
        mdLines.push('');
    }

    fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf-8');
    fs.writeFileSync(jsonPath, pyJsonDumpsIndent2(raw), 'utf-8');
    process.stderr.write(`✅  Wrote ${mdPath}\n`);
    process.stderr.write(`✅  Wrote ${jsonPath}\n`);
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exitCode = main();
}
