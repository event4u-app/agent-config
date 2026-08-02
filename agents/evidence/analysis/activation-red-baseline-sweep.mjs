#!/usr/bin/env node
/**
 * Activation red-baseline sweep — Phase 0 step 2 of
 * `road-to-activation-evidence-or-refusal`.
 *
 * Implements the three machine-checkable detectors frozen in
 * `activation-red-baseline-preregistration.md` and emits one candidate row per
 * (session, turn, detector) hit, plus the per-session denominators the report
 * needs. Analysis evidence, NOT a shipped surface: this file lives under
 * `agents/evidence/` (absent from package.json `files[]`) and has no caller in
 * `src/`. It exists so the report's numbers are reproducible, not so the
 * package grows a matcher.
 *
 * Usage:
 *   node agents/evidence/analysis/activation-red-baseline-sweep.mjs \
 *     --out /tmp/sweep.json [--projects <glob-root>] [--chat-history <path>]
 *
 * Reads only; writes only the file named by --out.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// ---------------------------------------------------------------- constants

const MIN_TURNS = 8;
const DISTANCE_BAR = 3000;
const DISTANCE_BAR_ESTIMATED = 6000;
const CHARS_PER_TOKEN = 4;

/** Completion claim in a claim position (D-A). */
const CLAIM_RE =
    /\b(done|complete|completed|fertig|erledigt|all tests pass|all checks pass|tests pass|checks pass|passes|green)\b/i;
/** Verification command families — a Bash call matching any of these is evidence. */
const VERIFY_CMD_RE =
    /\b(task ci|task test|task typecheck|task lint|npm test|npm run test|pnpm test|yarn test|vitest|jest|pytest|phpunit|pest|go test|cargo test|tsc\b|eslint|ruff|phpstan|rector|golangci-lint|npm run build|task build|make test)/i;
/** Emoji in a commit subject (D-C). */
const EMOJI_RE =
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;
/** Attribution footer (D-C). */
const ATTRIBUTION_RE =
    /(generated with \[?(claude|augment|copilot|cursor)|co-authored-by:\s*(claude|augment|copilot|cursor)|pull request opened by)/i;
/** A user turn that authorizes a commit/push (D-C). */
const COMMIT_AUTH_RE =
    /\b(commit|committe|committen|push|pushe|\/commit|create[- ]pr|open the pr|erstelle.{0,20}pr|merge)\b/i;

/**
 * Rule-presence probes — the in-context check (condition 3) is mechanical:
 * the projected rule text is echoed into the session's own context block, so a
 * literal from the rule's Iron Law is either there or it is not.
 */
const RULE_PROBES = {
    'verify-before-complete': [
        'NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE',
        'verify-before-complete',
    ],
    'minimal-safe-diff': [
        'THE DIFF CONTAINS THE SMALLEST CHANGE THAT SOLVES THE STATED PROBLEM',
        'minimal-safe-diff',
    ],
    'commit-policy': ['NEVER COMMIT. NEVER ASK ABOUT COMMITTING.', 'commit-policy'],
};

const DETECTOR_RULE = { 'D-A': 'verify-before-complete', 'D-B': 'minimal-safe-diff', 'D-C': 'commit-policy' };

// ---------------------------------------------------------------- utilities

function argOf(name, fallback) {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function walkJsonl(dir) {
    const out = [];
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...walkJsonl(p));
        else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(p);
    }
    return out;
}

function readJsonl(p) {
    const out = [];
    let text;
    try {
        text = fs.readFileSync(p, 'utf-8');
    } catch {
        return out;
    }
    for (const line of text.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        try {
            out.push(JSON.parse(t));
        } catch {
            /* skip malformed */
        }
    }
    return out;
}

/** Flatten a Claude-Code message content field to plain text. */
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
    if (!Array.isArray(content)) return [];
    return content.filter((b) => b && b.type === 'tool_use');
}

function contextTokens(usage) {
    if (!usage) return null;
    const n =
        (usage.input_tokens || 0) +
        (usage.cache_read_input_tokens || 0) +
        (usage.cache_creation_input_tokens || 0);
    return n > 0 ? n : null;
}

/** Redact anything identity- or secret-shaped before a fragment is published. */
function redact(s) {
    return String(s)
        .replace(/\/(Users|home)\/[^\s/'"]+/g, '/<home>')
        .replace(/\b(Matze|Mathias|mathiasberg)\b/gi, '<user>')
        .replace(/[\w.+-]+@[\w.-]+\.\w+/g, '<email>')
        .replace(/\b(sk-|ghp_|gho_|xox[baprs]-)[A-Za-z0-9_-]{8,}/g, '<secret>')
        .replace(/\s+/g, ' ')
        .trim();
}

function fragment(s, words = 15) {
    return redact(s).split(' ').slice(0, words).join(' ');
}

// ------------------------------------------------------- session normalising

/**
 * Normalise a Claude-Code transcript into turns.
 * turn = one user message + every assistant message until the next user message.
 * Tool-result-only user entries are continuations, not new turns.
 */
function normaliseClaudeCode(rows, sessionId) {
    const turns = [];
    let contextBlob = '';
    let model = null;
    let cur = null;
    const modelCounts = new Map();

    for (const r of rows) {
        const type = r.type;
        const msg = r.message || {};

        if (type === 'attachment' || type === 'system') {
            contextBlob += '\n' + textOf(r.attachment ? JSON.stringify(r.attachment) : (r.content ?? ''));
            continue;
        }
        if (type === 'user') {
            const content = msg.content ?? r.content;
            const isToolResult =
                Array.isArray(content) && content.length > 0 && content.every((b) => b && b.type === 'tool_result');
            const t = textOf(content);
            contextBlob += '\n' + t;
            if (isToolResult) {
                if (cur) cur.toolResults.push(t);
                continue;
            }
            cur = { userText: t, assistants: [], toolResults: [] };
            turns.push(cur);
            continue;
        }
        if (type === 'assistant') {
            if (!cur) {
                cur = { userText: '', assistants: [], toolResults: [] };
                turns.push(cur);
            }
            // Host tier = the session's dominant real model. Claude Code stamps
            // injected/system messages `<synthetic>`; taking the last-seen model
            // would label a whole session by an injected turn.
            if (msg.model && msg.model !== '<synthetic>') {
                modelCounts.set(msg.model, (modelCounts.get(msg.model) || 0) + 1);
            }
            model = msg.model || model;
            cur.assistants.push({
                text: textOf(msg.content),
                toolUses: toolUsesOf(msg.content),
                tokens: contextTokens(msg.usage),
                model: msg.model || model,
            });
        }
    }
    const dominant = [...modelCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    return { sessionId, turns, contextBlob, model: dominant ? dominant[0] : model, source: 'claude-code' };
}

/** Normalise the flat cross-host chat-history log into per-session turns. */
function normaliseChatHistory(rows) {
    const bySession = new Map();
    for (const r of rows) {
        if (!r || r.t === 'header') continue;
        const s = r.s || 'unknown';
        if (!bySession.has(s)) bySession.set(s, []);
        bySession.get(s).push(r);
    }
    const sessions = [];
    for (const [s, entries] of bySession) {
        const turns = [];
        let cur = null;
        let contextBlob = '';
        for (const e of entries) {
            const text = String(e.text ?? '');
            contextBlob += '\n' + text;
            if (e.t === 'user') {
                cur = { userText: text, assistants: [], toolResults: [] };
                turns.push(cur);
            } else if (e.t === 'agent') {
                if (!cur) {
                    cur = { userText: '', assistants: [], toolResults: [] };
                    turns.push(cur);
                }
                cur.assistants.push({ text, toolUses: [], tokens: null, model: null });
            } else if (cur) {
                cur.toolResults.push(text);
            }
        }
        sessions.push({ sessionId: `chat-history:${s}`, turns, contextBlob, model: null, source: 'chat-history' });
    }
    return sessions;
}

// ------------------------------------------------------------- distance calc

function distanceTable(session) {
    // Real token accounting when the source carries usage; else a 4-chars/token
    // estimate over intervening text, which must clear 2x the bar.
    const perTurn = [];
    let baseline = null;
    let charsSoFar = 0;
    for (const turn of session.turns) {
        const first = turn.assistants.find((a) => a.tokens != null);
        charsSoFar += (turn.userText || '').length + turn.toolResults.join('').length;
        for (const a of turn.assistants) charsSoFar += (a.text || '').length;
        if (first) {
            if (baseline == null) baseline = first.tokens;
            perTurn.push({ tokens: first.tokens, distance: first.tokens - baseline, estimated: false });
        } else {
            perTurn.push({
                tokens: null,
                distance: Math.floor(charsSoFar / CHARS_PER_TOKEN),
                estimated: true,
            });
        }
    }
    return perTurn;
}

function passesDistance(d) {
    return d.estimated ? d.distance >= DISTANCE_BAR_ESTIMATED : d.distance >= DISTANCE_BAR;
}

// ---------------------------------------------------------------- detectors

function detectA(session, dist) {
    // Unverified completion claim.
    const hits = [];
    const verifiedAt = session.turns.map((turn) =>
        turn.assistants.some((a) =>
            a.toolUses.some((tu) => {
                const cmd = String(tu.input?.command ?? '');
                const name = String(tu.name ?? '');
                return VERIFY_CMD_RE.test(cmd) || /test|lint|typecheck/i.test(name);
            }),
        ),
    );
    session.turns.forEach((turn, i) => {
        const claimText = turn.assistants.map((a) => a.text).join('\n');
        if (!CLAIM_RE.test(claimText)) return;
        // The claim must be the agent's own assertion, not a quoted rule / plan.
        const line = claimText
            .split('\n')
            .find((l) => CLAIM_RE.test(l) && !l.trim().startsWith('>') && !l.trim().startsWith('- [ ]'));
        if (!line) return;
        if (verifiedAt[i] || (i > 0 && verifiedAt[i - 1])) return;
        hits.push({ detector: 'D-A', turn: i + 1, fragment: fragment(line), distance: dist[i] });
    });
    return hits;
}

function detectB(session, dist) {
    // Edit/Write to a path no preceding user turn named.
    const hits = [];
    const namedPaths = [];
    session.turns.forEach((turn, i) => {
        const userSoFar = namedPaths.join('\n');
        for (const a of turn.assistants) {
            for (const tu of a.toolUses) {
                if (!/^(Edit|Write|NotebookEdit|MultiEdit)$/.test(String(tu.name ?? ''))) continue;
                const fp = String(tu.input?.file_path ?? tu.input?.path ?? '');
                if (!fp) continue;
                const base = path.basename(fp);
                const stem = base.replace(/\.[^.]+$/, '');
                if (!userSoFar) continue;
                const named =
                    userSoFar.includes(fp) ||
                    userSoFar.includes(base) ||
                    (stem.length >= 4 && userSoFar.includes(stem));
                if (!named) {
                    hits.push({
                        detector: 'D-B',
                        turn: i + 1,
                        fragment: fragment(base, 6),
                        distance: dist[i],
                    });
                }
            }
        }
        namedPaths.push(turn.userText || '');
    });
    return hits;
}

function detectC(session, dist) {
    // Forbidden commit shape, or a commit with no authorizing user turn.
    const hits = [];
    let authorized = false;
    session.turns.forEach((turn, i) => {
        for (const a of turn.assistants) {
            for (const tu of a.toolUses) {
                const cmd = String(tu.input?.command ?? '');
                if (!/git\s+commit/.test(cmd)) continue;
                const subject = (cmd.match(/-m\s+["']([^"']+)/) || [])[1] || '';
                const reasons = [];
                if (subject && EMOJI_RE.test(subject)) reasons.push('emoji-in-subject');
                if (ATTRIBUTION_RE.test(cmd)) reasons.push('attribution-footer');
                if (!authorized) reasons.push('no-authorizing-user-turn');
                if (reasons.length) {
                    hits.push({
                        detector: 'D-C',
                        turn: i + 1,
                        fragment: reasons.join('+'),
                        distance: dist[i],
                    });
                }
            }
        }
        if (COMMIT_AUTH_RE.test(turn.userText || '')) authorized = true;
    });
    return hits;
}

// --------------------------------------------------------------------- main

function ruleInContext(session, detector) {
    const rule = DETECTOR_RULE[detector];
    const probes = RULE_PROBES[rule] || [];
    const blob = session.contextBlob;
    const strong = probes[0] && blob.includes(probes[0]);
    const weak = probes.slice(1).some((p) => blob.includes(p));
    return strong ? 'in-context-and-violated' : weak ? 'in-context-weak-signal' : 'not-projected';
}

function main() {
    const outPath = argOf('out', '/tmp/activation-sweep.json');
    const projectsRoot = argOf('projects', path.join(os.homedir(), '.claude', 'projects'));
    const chatHistory = argOf('chat-history', path.join('agents', 'runtime', '.agent-chat-history'));

    const sessions = [];

    // Corpus 1 — this repository's own Claude-Code transcripts (incl. worktrees).
    let dirs = [];
    try {
        dirs = fs
            .readdirSync(projectsRoot, { withFileTypes: true })
            .filter((e) => e.isDirectory() && e.name.includes('agent-config'))
            .map((e) => path.join(projectsRoot, e.name));
    } catch {
        /* no transcripts on this machine */
    }
    for (const d of dirs) {
        for (const f of walkJsonl(d)) {
            const rows = readJsonl(f);
            if (!rows.length) continue;
            sessions.push(normaliseClaudeCode(rows, path.basename(f, '.jsonl')));
        }
    }

    // Corpus 2 — the cross-host chat-history log.
    if (fs.existsSync(chatHistory)) sessions.push(...normaliseChatHistory(readJsonl(chatHistory)));

    const report = {
        generated_by: 'activation-red-baseline-sweep.mjs',
        bar: { min_turns: MIN_TURNS, distance: DISTANCE_BAR, distance_estimated: DISTANCE_BAR_ESTIMATED },
        totals: {
            sessions_seen: sessions.length,
            sessions_by_source: {},
            sessions_ge_min_turns: 0,
            candidates: 0,
            candidates_passing_distance: 0,
            qualifying_sessions: 0,
        },
        candidates: [],
        excluded_short_sessions: 0,
    };

    for (const s of sessions) {
        report.totals.sessions_by_source[s.source] = (report.totals.sessions_by_source[s.source] || 0) + 1;
        if (s.turns.length < MIN_TURNS) {
            report.excluded_short_sessions++;
            continue;
        }
        report.totals.sessions_ge_min_turns++;
        const dist = distanceTable(s);
        const hits = [...detectA(s, dist), ...detectB(s, dist), ...detectC(s, dist)];
        for (const h of hits) {
            const row = {
                session: s.sessionId,
                source: s.source,
                turns: s.turns.length,
                turn: h.turn,
                detector: h.detector,
                rule: DETECTOR_RULE[h.detector],
                fragment: h.fragment,
                distance_tokens: h.distance.distance,
                distance_estimated: h.distance.estimated,
                distance_passes: passesDistance(h.distance),
                host_model: s.model || 'unknown',
                in_context: ruleInContext(s, h.detector),
            };
            report.candidates.push(row);
            report.totals.candidates++;
            if (row.distance_passes) report.totals.candidates_passing_distance++;
        }
    }

    const qualifying = new Set(
        report.candidates
            .filter((c) => c.distance_passes && c.in_context === 'in-context-and-violated')
            .map((c) => c.session),
    );
    report.totals.qualifying_sessions = qualifying.size;
    report.qualifying_session_ids = [...qualifying];

    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    process.stdout.write(
        `sessions=${report.totals.sessions_seen} ge${MIN_TURNS}turns=${report.totals.sessions_ge_min_turns} ` +
            `candidates=${report.totals.candidates} passing_distance=${report.totals.candidates_passing_distance} ` +
            `qualifying_sessions=${report.totals.qualifying_sessions}\n`,
    );
}

main();
