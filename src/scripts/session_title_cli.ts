#!/usr/bin/env node
/**
 * `agent-config session:title` — set or show the refined title of a session.
 *
 *   session:title --session <id> "<title>"   publish a refined title
 *   session:title --session <id> --show      print the title a reader would show
 *
 * A title the user set with `/rename` is final: setting is refused, with exit 0,
 * because an agent that follows the `session-title` nudge did nothing wrong.
 * `sessions.auto_title: false` refuses the same way.
 */
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { load_agent_settings } from './_lib/agent_settings.js';
import { clean_title } from './_lib/session_catalog.js';
import {
    SETTING_KEY,
    autoTitleEnabled,
    effectiveTitle,
    readHostTitles,
    readState,
    sanitizeTitle,
    writeRefinedTitle,
} from './_lib/session_title.js';

function usage(): number {
    process.stderr.write('usage: agent-config session:title --session <id> ("<title>" | --show) [--transcript <path>]\n');
    return 2;
}

export interface TitleCliOptions {
    cwd?: string;
    root?: string;
    out?: (line: string) => void;
    err?: (line: string) => void;
}

export function cmd_session_title(argv: string[] = process.argv.slice(2), opts: TitleCliOptions = {}): number {
    const out = opts.out ?? ((l: string) => process.stdout.write(`${l}\n`));
    const err = opts.err ?? ((l: string) => process.stderr.write(`${l}\n`));
    let sessionId: string | null = null;
    let transcript: string | null = null;
    let show = false;
    const words: string[] = [];
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--session') sessionId = argv[++i] ?? null;
        else if (a === '--transcript') transcript = argv[++i] ?? null;
        else if (a === '--show') show = true;
        else if (a === '-h' || a === '--help') return usage();
        else words.push(a);
    }
    if (sessionId === null || sessionId.trim() === '') return usage();
    const transcriptPath = transcript ?? readState(sessionId, opts.root)?.transcript_path ?? null;
    if (transcriptPath === null) {
        err(`session:title: no transcript known for session ${sessionId} — pass --transcript <path>`);
        return 1;
    }
    if (show) {
        const t = effectiveTitle(transcriptPath);
        out(t.title === null ? '(untitled)' : `${t.title} [${t.source}]`);
        return 0;
    }
    if (words.length === 0) return usage();
    const settings = load_agent_settings({ cwd: opts.cwd ?? process.cwd() }) as Record<string, unknown>;
    if (!autoTitleEnabled(settings)) {
        out(`session:title: skipped — ${SETTING_KEY} is false`);
        return 0;
    }
    const custom = readHostTitles(transcriptPath).custom;
    if (custom !== null) {
        out(`session:title: skipped — the user named this session «${custom}»; that title is final`);
        return 0;
    }
    const title = sanitizeTitle(clean_title(words.join(' ')));
    if (title === null) return usage();
    const written = writeRefinedTitle(transcriptPath, sessionId, title);
    out(`session:title: «${written.title}» (revision ${written.revision})`);
    return 0;
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
if (!_bundled && fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(cmd_session_title());
}
