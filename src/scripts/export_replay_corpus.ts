#!/usr/bin/env tsx
/**
 * Field-corpus exporter for router-telemetry replays
 * (road-to-token-proof-and-story Phase 2).
 *
 * Reads one or more `.agent-chat-history` JSONL logs (schema: one JSON object
 * per line; user turns are `{"t": "user", "text": "..."}`), extracts real
 * prompts, applies a built-in redaction pass, and emits a
 * `router_telemetry`-compatible corpus (`prompts:` entries with
 * `{id, text, command}`), so the three/four replay arms run on
 * consumer-shaped traffic instead of synthetic tasks.
 *
 * PRIVACY GATE (operator, non-optional): the built-in redaction is a
 * mechanical first pass — emails, home paths, key-shaped tokens, long hex,
 * URLs with credentials. The exported file MUST be human-reviewed under the
 * low-impact-corpus privacy floor BEFORE it is stored, committed, or fed to
 * any report that leaves the machine. The tool prints this reminder and
 * defaults to a `.local.yaml` output name so an unreviewed export cannot be
 * committed silently (gitignored pattern).
 *
 * Usage:
 *   ./scripts-run src/scripts/export_replay_corpus \
 *     --history agents/runtime/.agent-chat-history \
 *     [--history <other-repo>/agents/runtime/.agent-chat-history ...] \
 *     [--out internal/bench/corpora/field-prompts.local.yaml] \
 *     [--limit 200] [--min-chars 20]
 *
 * Exit codes: 0 written · 1 usage/file error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_OUT = path.join(REPO_ROOT, 'internal/bench/corpora/field-prompts.local.yaml');

export interface FieldPrompt {
  id: string;
  text: string;
  command: string | null;
}

const REDACTIONS: Array<[RegExp, string]> = [
  // emails
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<EMAIL>'],
  // API-key-shaped tokens (sk-…, ghp_…, xox…, AKIA…, long base64-ish runs)
  [/\b(?:sk-[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|xox[a-z]-[A-Za-z0-9-]{10,}|AKIA[A-Z0-9]{12,})\b/g, '<KEY>'],
  // credentials embedded in URLs
  [/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, '$1<CREDENTIALS>@'],
  // absolute home paths (macOS/Linux)
  [/(?:\/Users|\/home)\/[A-Za-z0-9._-]+/g, '<HOME>'],
  // long hex blobs (hashes, tokens)
  [/\b[a-f0-9]{32,}\b/gi, '<HEX>'],
  // IPv4
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '<IP>'],
];

/** Mechanical first-pass redaction — NOT a substitute for the operator review. */
export function redact(text: string): string {
  let out = text;
  for (const [re, sub] of REDACTIONS) {
    out = out.replace(re, sub);
  }
  return out;
}

/** Extract user prompts from one .agent-chat-history JSONL file. */
export function extract_prompts(jsonlText: string, minChars: number): string[] {
  const out: string[] = [];
  for (const line of jsonlText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      continue; // tolerate partial/corrupt lines — logs are append-only
    }
    if (obj['t'] !== 'user' || typeof obj['text'] !== 'string') continue;
    const text = (obj['text'] as string).trim();
    if (text.length < minChars) continue;
    out.push(text);
  }
  return out;
}

/** First `/token` of a prompt that looks like a slash command. */
export function detect_command(text: string): string | null {
  const m = /^\/([a-z0-9:_-]+)/i.exec(text.trim());
  return m ? `/${(m[1] as string).toLowerCase()}` : null;
}

/** Build the corpus entries: redacted, de-duplicated, capped. */
export function build_corpus(rawPrompts: string[], limit: number): FieldPrompt[] {
  const seen = new Set<string>();
  const out: FieldPrompt[] = [];
  for (const raw of rawPrompts) {
    const text = redact(raw);
    const key = text.slice(0, 200);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: `field-${String(out.length + 1).padStart(3, '0')}`,
      text,
      command: detect_command(text),
    });
    if (out.length >= limit) break;
  }
  return out;
}

function _yamlQuote(s: string): string {
  return JSON.stringify(s); // JSON string is valid YAML double-quoted scalar
}

export function to_yaml(prompts: FieldPrompt[]): string {
  const lines: string[] = [
    '# Field replay corpus — exported by export_replay_corpus.',
    '# PRIVACY: operator review REQUIRED before this file is stored/committed',
    '# (low-impact-corpus privacy floor). Redaction here is a mechanical first',
    '# pass only. Replay caveat: intent triggers are informational-only in',
    '# router_telemetry — replay UNDERCOUNTS intent-triggered rule loads.',
    'prompts:',
  ];
  for (const p of prompts) {
    lines.push(`  - id: ${p.id}`);
    lines.push(`    text: ${_yamlQuote(p.text)}`);
    if (p.command) lines.push(`    command: ${_yamlQuote(p.command)}`);
  }
  return lines.join('\n') + '\n';
}

export function main(argv: string[]): number {
  const histories: string[] = [];
  let out = DEFAULT_OUT;
  let limit = 200;
  let minChars = 20;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] as string;
    if (a === '--history') histories.push(String(argv[(i += 1)] ?? ''));
    else if (a === '--out') out = path.resolve(String(argv[(i += 1)] ?? ''));
    else if (a === '--limit') limit = Number(argv[(i += 1)]);
    else if (a === '--min-chars') minChars = Number(argv[(i += 1)]);
    else if (a === '-h' || a === '--help') {
      process.stdout.write(
        'usage: export_replay_corpus --history <jsonl> [--history ...] [--out FILE] [--limit N] [--min-chars N]\n',
      );
      return 0;
    } else {
      process.stderr.write(`error: unknown argument: ${a}\n`);
      return 1;
    }
  }
  if (histories.length === 0 || !Number.isFinite(limit) || limit <= 0) {
    process.stderr.write('error: at least one --history <path> is required\n');
    return 1;
  }
  const raw: string[] = [];
  for (const h of histories) {
    let text: string;
    try {
      text = fs.readFileSync(h, 'utf-8');
    } catch (e) {
      process.stderr.write(`error: cannot read ${h}: ${(e as Error).message}\n`);
      return 1;
    }
    raw.push(...extract_prompts(text, minChars));
  }
  const corpus = build_corpus(raw, limit);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, to_yaml(corpus), 'utf-8');
  process.stdout.write(
    `wrote ${corpus.length} prompt(s) → ${path.relative(REPO_ROOT, out)}\n` +
      '⚠️  PRIVACY GATE: operator review required before this corpus is stored,\n' +
      '   committed, or used in any report (low-impact-corpus privacy floor).\n',
  );
  return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const _IS_MAIN =
  _isCliEntry();
if (_IS_MAIN) {
  process.exit(main(process.argv.slice(2)));
}
