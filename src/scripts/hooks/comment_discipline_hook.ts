#!/usr/bin/env node
/**
 * Comment-discipline advisory — `post_tool_use` concern.
 *
 * The write-time half of `lint_code_comments`. The gate answers "may this
 * land"; this answers "was it written that way in the first place", which is
 * the question the maintainer actually asked after a run produced 509 German
 * comment lines across 41 of 45 changed source files without anything
 * objecting once.
 *
 * `code-comment-discipline` is `type: auto` with PROMPT keywords (`comment`,
 * `refactor`, `implement`, …). A run that writes forty-five files while the
 * user says "build the todo module" matches none of them, so the rule never
 * loads — the activation gap `fix-what-you-see` names for itself, in the one
 * place where the agent is producing the artefact the rule governs. A
 * post-write concern fires on the TOOL EVENT and therefore does not depend on
 * what the prompt happened to say.
 *
 * `Write` carries the new content in `tool_input.content`; `Edit` carries the
 * replacement in `tool_input.new_string`. Scanning that text rather than the
 * file on disk makes the concern forward-only by construction: a pre-existing
 * comment the edit did not touch cannot fire it, so there is no baseline to
 * maintain and no legacy tree to clean before turning it on.
 *
 * Same shape as `edit_shape_hook.ts` and `delegation_nudge_hook.ts`:
 * `host_semantics.emitFor`'s `severity === "warn"` branch returns exit 0 with
 * the text in `hookSpecificOutput.additionalContext`, unconditionally, so the
 * byte handed to the host is always 0. Advisory is the right severity here
 * and not a hedge — the classifier is a line heuristic, and a heuristic that
 * can refuse a write would turn one false positive into a blocked session.
 * The deterministic refusal lives in the gate, where a human can read the
 * whole file before answering.
 *
 * `edit-shape` fires once per session because its advice is a habit
 * correction that lands the first time. This one is per-write on purpose: the
 * measured failure is forty-one files each carrying the defect, and a nudge
 * that speaks once and then watches forty more land is the shape that
 * produced the incident. The cost is bounded by naming at most
 * `MAX_REPORTED` findings and no more than one line per write.
 *
 * ROBUSTNESS: malformed payload → exit 0 silently. This concern never blocks.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { isScannable, scanText, type CommentFinding } from '../lint_code_comments.js';
import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
import { readHookStdin } from './hook_stdin.js';

const EXIT_ALLOW = 0;
const EXIT_WARN = 2;

/** Findings named in the advisory line. The rest are counted, never listed. */
export const MAX_REPORTED = 3;

function str(v: JsonValue | undefined): string {
    return typeof v === 'string' ? v : '';
}
function isObject(v: unknown): v is JsonObject {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** The written text, per tool. Empty string when the payload carries none. */
export function writtenText(toolName: string, toolInput: JsonObject): string {
    if (toolName === 'Write') return str(toolInput['content'] as JsonValue | undefined);
    if (toolName === 'Edit') {
        return str(toolInput['new_string'] as JsonValue | undefined)
            || str(toolInput['newString'] as JsonValue | undefined);
    }
    return '';
}

/** One advisory line, naming what fired and where. */
export function buildAdvisoryLine(file: string, findings: readonly CommentFinding[]): string {
    const counts = new Map<string, number>();
    for (const f of findings) counts.set(f.cls, (counts.get(f.cls) ?? 0) + 1);
    const summary = [...counts].map(([c, n]) => `${c} ×${n}`).join(' · ');
    const named = findings.slice(0, MAX_REPORTED)
        .map((f) => `line ${f.line} (${f.signal})`)
        .join(', ');
    const more = findings.length > MAX_REPORTED ? `, +${findings.length - MAX_REPORTED} more` : '';
    return (
        `comment-discipline: the text just written to ${file} carries ${summary} — ${named}${more}. `
        + 'A comment states a WHY or a constraint the code cannot show, in English; evidence for a '
        + 'roadmap step belongs in that roadmap, not in a second copy in the source. Rewrite or '
        + 'delete those lines now, before the next write — `lint_code_comments` refuses them at the gate.'
    );
}

export function main(): number {
    try {
        const [envelope, payload] = unwrap(readHookStdin(), 'claude');

        const event = str(envelope['event'] as JsonValue | undefined);
        if (event !== '' && event !== 'post_tool_use') return EXIT_ALLOW;

        const toolName = str(
            (payload['tool_name'] ?? payload['toolName'] ?? payload['tool']) as JsonValue | undefined,
        );
        if (toolName !== 'Write' && toolName !== 'Edit') return EXIT_ALLOW;

        const ti = payload['tool_input'] ?? payload['toolInput'] ?? payload['input'];
        if (!isObject(ti)) return EXIT_ALLOW;

        const filePath = str((ti['file_path'] ?? ti['path'] ?? ti['filePath']) as JsonValue | undefined);
        if (!filePath || !isScannable(filePath)) return EXIT_ALLOW;

        const text = writtenText(toolName, ti);
        if (!text) return EXIT_ALLOW;

        const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined).trim() || process.cwd();
        const abs = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceRoot, filePath);
        const rel = path.relative(workspaceRoot, abs);
        const shown = rel.startsWith('..') ? path.basename(abs) : rel;

        const findings = scanText(shown, text);
        if (findings.length === 0) return EXIT_ALLOW;

        process.stdout.write(
            `${JSON.stringify({
                decision: 'warn',
                reason: `comment-discipline: ${findings.length} comment finding(s) in the text written to ${shown}`,
                additional_context: buildAdvisoryLine(shown, findings),
            })}\n`,
        );
        return EXIT_WARN;
    } catch {
        return EXIT_ALLOW;
    }
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) process.exit(main());
