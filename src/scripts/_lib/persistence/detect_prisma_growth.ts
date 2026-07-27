/**
 * R-A7 growth-budget for Prisma schemas (F7) —
 * road-to-scale-and-history-discipline Phase 5.
 *
 * An append-only-shaped model (name or `@@map` target matching the shared
 * append-only vocabulary: *_logs, *_events, *_history, audits, jobs, queue,
 * sessions, notifications, …) must declare a retention policy as a doc
 * comment on the model (`/// retention: <policy>`) or carry a
 * `/// no-retention: <reason>` waiver. Same semantics as the raw-SQL
 * adapter's R-A7 check, applied to schema.prisma.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Finding } from './types.js';
import { is_ignored_dir } from './types.js';
import { is_append_only_name } from './adapter_raw_sql.js';

const RETENTION_RE = /\/\/\/?\s*retention\s*:\s*\S/;
const NO_RETENTION_RE = /\/\/\/?\s*no-retention\s*:\s*(\S.*)$/m;

export function detect_prisma_growth(files: Array<{ path: string; content: string }>): Finding[] {
    const findings: Finding[] = [];
    for (const f of files) {
        const lines = f.content.split('\n');
        for (let i = 0; i < lines.length; i += 1) {
            const m = lines[i]!.match(/^\s*model\s+(\w+)\s*\{/);
            if (!m) continue;
            // Model body: find the closing brace (prisma blocks are flat).
            let end = i;
            for (let j = i + 1; j < lines.length; j += 1) {
                if (/^\s*\}/.test(lines[j]!)) {
                    end = j;
                    break;
                }
            }
            const body = lines.slice(i, end + 1).join('\n');
            const mapped = body.match(/@@map\(\s*["'](\w+)["']\s*\)/);
            const table_name = mapped ? mapped[1]! : m[1]!;
            if (!is_append_only_name(table_name)) continue;

            // Retention/waiver: doc comments directly above the model or inside it.
            const head = lines.slice(Math.max(0, i - 3), i).join('\n');
            if (RETENTION_RE.test(head) || RETENTION_RE.test(body)) continue;
            const waiver = (head + '\n' + body).match(NO_RETENTION_RE);
            findings.push({
                failure_class: 'F7',
                rule: 'R-A7',
                file: f.path,
                line: i + 1,
                message: `model ${m[1]} (table ${table_name}) looks append-only but declares no retention policy (add "/// retention: <policy>" or a no-retention waiver)`,
                tier: 'gate',
                ...(waiver ? { waived: true, waiver_reason: waiver[1]!.trim() } : {}),
            });
        }
    }
    return findings;
}

export function scan_dir(dir: string): Finding[] {
    const files: Array<{ path: string; content: string }> = [];
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) {
                if (!is_ignored_dir(e.name)) walk(p);
            } else if (e.name.endsWith('.prisma')) {
                files.push({ path: p, content: fs.readFileSync(p, 'utf8') });
            }
        }
    };
    walk(dir);
    return detect_prisma_growth(files);
}
