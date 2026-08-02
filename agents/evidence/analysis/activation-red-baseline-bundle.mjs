#!/usr/bin/env node
/**
 * Adjudication-bundle extractor — Phase 0 step 3 of
 * `road-to-activation-evidence-or-refusal`.
 *
 * The sweep emits candidates; condition 3 of the pre-registration requires each
 * one to be confirmed or rejected against what the session actually did. This
 * writes one self-contained bundle per candidate (the user turn, the agent's
 * claim, every tool call in a +/-2-turn window, and the verification evidence
 * present) so an independent reviewer can adjudicate without re-reading the
 * transcript — and without the reviewer being able to see the desired verdict.
 *
 * Analysis evidence, not a shipped surface. Reads only; writes only into --out.
 *
 * Usage:
 *   node agents/evidence/analysis/activation-red-baseline-bundle.mjs \
 *     --sweep /tmp/activation-sweep.json --out /tmp/bundles [--detectors D-A,D-C] [--per-session 6]
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function argOf(name, fallback) {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const VERIFY_CMD_RE =
    /\b(task ci|task test|task typecheck|task lint|npm test|npm run test|pnpm test|yarn test|vitest|jest|pytest|phpunit|pest|go test|cargo test|tsc\b|eslint|ruff|phpstan|rector|golangci-lint|npm run build|task build|make test)/i;

function redact(s) {
    return String(s)
        .replace(/\/(Users|home)\/[^\s/'"]+/g, '/<home>')
        .replace(/\b(Matze|Mathias|mathiasberg)\b/gi, '<user>')
        .replace(/[\w.+-]+@[\w.-]+\.\w+/g, '<email>')
        .replace(/\b(sk-|ghp_|gho_|xox[baprs]-)[A-Za-z0-9_-]{8,}/g, '<secret>');
}

function readJsonl(p) {
    const out = [];
    for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
        const t = line.trim();
        if (!t) continue;
        try {
            out.push(JSON.parse(t));
        } catch {
            /* skip */
        }
    }
    return out;
}

function textOf(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    const parts = [];
    for (const b of content) {
        if (typeof b === 'string') parts.push(b);
        else if (b && b.type === 'text' && typeof b.text === 'string') parts.push(b.text);
        else if (b && b.type === 'tool_result') parts.push(textOf(b.content));
    }
    return parts.join('\n');
}

function toolUsesOf(content) {
    return Array.isArray(content) ? content.filter((b) => b && b.type === 'tool_use') : [];
}

function normalise(rows) {
    const turns = [];
    let cur = null;
    for (const r of rows) {
        const msg = r.message || {};
        if (r.type === 'user') {
            const content = msg.content ?? r.content;
            const isToolResult =
                Array.isArray(content) && content.length > 0 && content.every((b) => b && b.type === 'tool_result');
            const t = textOf(content);
            if (isToolResult) {
                if (cur) cur.toolResults.push(t);
                continue;
            }
            cur = { userText: t, assistants: [], toolResults: [] };
            turns.push(cur);
        } else if (r.type === 'assistant') {
            if (!cur) {
                cur = { userText: '', assistants: [], toolResults: [] };
                turns.push(cur);
            }
            cur.assistants.push({ text: textOf(msg.content), toolUses: toolUsesOf(msg.content) });
        }
    }
    return turns;
}

function findTranscript(sessionId, projectsRoot) {
    const stack = [projectsRoot];
    while (stack.length) {
        const d = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(d, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) stack.push(p);
            else if (e.name === `${sessionId}.jsonl`) return p;
        }
    }
    return null;
}

function toolLine(tu) {
    const name = String(tu.name ?? '');
    const inp = tu.input || {};
    const detail = inp.command ?? inp.file_path ?? inp.path ?? inp.pattern ?? inp.prompt ?? '';
    return redact(`${name}(${String(detail).slice(0, 220)})`);
}

function main() {
    const sweep = JSON.parse(fs.readFileSync(argOf('sweep', '/tmp/activation-sweep.json'), 'utf-8'));
    const outDir = argOf('out', '/tmp/bundles');
    const projectsRoot = argOf('projects', path.join(os.homedir(), '.claude', 'projects'));
    const wanted = argOf('detectors', 'D-A,D-C').split(',');
    const perSession = Number(argOf('per-session', '6'));

    fs.mkdirSync(outDir, { recursive: true });

    const inContext = argOf('in-context', 'in-context-and-violated');
    const qualifying = sweep.candidates.filter(
        (c) => c.distance_passes && c.in_context === inContext && wanted.includes(c.detector),
    );
    const bySession = new Map();
    for (const c of qualifying) {
        if (!bySession.has(c.session)) bySession.set(c.session, []);
        bySession.get(c.session).push(c);
    }

    const index = [];
    for (const [session, rows] of bySession) {
        if (session.startsWith('chat-history:')) continue;
        const file = findTranscript(session, projectsRoot);
        if (!file) continue;
        const turns = normalise(readJsonl(file));
        const picked = rows.sort((a, b) => b.distance_tokens - a.distance_tokens).slice(0, perSession);
        const chunks = [];
        for (const c of picked) {
            const i = c.turn - 1;
            const window = [];
            for (let j = Math.max(0, i - 2); j <= i; j++) {
                const t = turns[j];
                if (!t) continue;
                const tools = t.assistants.flatMap((a) => a.toolUses.map(toolLine));
                window.push(
                    `#### turn ${j + 1}${j === i ? '  <-- CANDIDATE TURN' : ''}\n` +
                        `USER: ${redact((t.userText || '(none)').slice(0, 900))}\n` +
                        `AGENT: ${redact(t.assistants.map((a) => a.text).join('\n').slice(0, 1600))}\n` +
                        `TOOLS (${tools.length}): ${tools.slice(0, 40).join(' ; ') || '(none)'}`,
                );
            }
            const verifyWindow = [];
            for (let j = Math.max(0, i - 3); j <= i; j++) {
                const t = turns[j];
                if (!t) continue;
                for (const a of t.assistants)
                    for (const tu of a.toolUses) {
                        const cmd = String(tu.input?.command ?? '');
                        if (VERIFY_CMD_RE.test(cmd)) verifyWindow.push(`turn ${j + 1}: ${redact(cmd.slice(0, 160))}`);
                    }
            }
            chunks.push(
                `### candidate ${c.detector} @ turn ${c.turn} (distance ${c.distance_tokens} tokens, host ${c.host_model})\n` +
                    `Rule under test: ${c.rule}\n` +
                    `Detector fragment: ${c.fragment}\n\n` +
                    window.join('\n\n') +
                    `\n\nVERIFICATION COMMANDS IN THE 4-TURN WINDOW: ${verifyWindow.join(' | ') || '(none found)'}\n`,
            );
        }
        const out = path.join(outDir, `${session}.md`);
        const opening = redact((turns[0]?.userText || '(none)').slice(0, 1200));
        fs.writeFileSync(
            out,
            `# Adjudication bundle — session ${session}\n\nTotal turns in session: ${turns.length}\n\n` +
                `## The task the user stated (turn 1)\n\n${opening}\n\n` +
                chunks.join('\n---\n\n'),
        );
        index.push({ session, file: out, candidates: picked.length });
    }
    fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2));
    process.stdout.write(`bundles=${index.length} candidates=${index.reduce((a, b) => a + b.candidates, 0)}\n`);
}

main();
