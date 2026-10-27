#!/usr/bin/env node
/**
 * `agent-config user-data` — the user's own data for this repository, under
 * their home (`<user-global>/user/projects/<repo-id>/`), never in the project.
 *
 *   user-data list [--kind K] [--json]              counts and ids per kind (never content)
 *   user-data export [--kind K …]                   the stored rows of each kind, as JSON
 *   user-data delete --kind K [--id ID …] [--yes]   dry run unless --yes; tombstones what it removes,
 *                                                   and removes the ids from the derived index
 *   user-data tombstones [--json]
 *   user-data migrate [--apply]                     move today's chat history and this project's
 *                                                   observations into the user store — dry run first
 *
 * The migration keeps pointers only: a chat-history line becomes its session,
 * type and time; message text is dropped and the dry run names every dropped
 * field. A migrated row's id is a hash of its source line, so a re-run skips
 * what the store already holds. `--apply` keeps a `*.migrated-<date>` copy of
 * each source and removes from it only the rows the store now holds; a row
 * refused or revoked stays in its source and is reported.
 *
 * Exit codes: 0 ok · 1 nothing to do or refused · 2 usage.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { userProjectDir } from '../_lib/ownership_model.js';
import { USER_KINDS, type UserKind, type UserRow, appendUserRow, deleteUserData, exportUserData, tombstones, viewUserData } from '../_lib/user_data_control.js';
import { resolveGlobalObservationsPath } from '../_lib/user_global_observations.js';
import { repoIdentity } from '../code_graph/repo_identity.js';

const USAGE = 'usage: agent-config user-data list [--kind K] [--json] | export [--kind K] | delete --kind K [--id ID …] [--yes] | tombstones [--json] | migrate [--apply] [--root P]\n';
/** The derived index a user store may have beside it; deletes reach it too. */
export const DERIVED_INDEX = 'index.sqlite3';
const CHAT_POINTER_FIELDS = new Set(['s', 't', 'type', 'ts', 'phase', 'kind', 'n']);

function flagValues(argv: readonly string[], name: string): string[] {
    const out: string[] = [];
    argv.forEach((a, i) => {
        if (a === name && argv[i + 1] !== undefined) out.push(argv[i + 1] as string);
    });
    return out;
}

export interface MigrationPlan {
    /** `lines[i]` is the 0-based source line `rows[i]` came from */
    chat: { source: string; rows: UserRow[]; lines: number[]; dropped_fields: string[] } | null;
    observations: { source: string; rows: UserRow[]; lines: number[]; kept_global: number } | null;
}

const recordId = (prefix: string, line: string): string => `${prefix}:${createHash('sha256').update(line).digest('hex').slice(0, 16)}`;

/** What `migrate` would move, computed without writing anything. */
export function planMigration(root: string, opts: { chatFile?: string; observationsFile?: string } = {}): MigrationPlan {
    const chatFile = opts.chatFile ?? path.join(root, 'agents', 'runtime', '.agent-chat-history');
    let chat: MigrationPlan['chat'] = null;
    if (fs.existsSync(chatFile)) {
        const dropped = new Set<string>();
        const rows: UserRow[] = [];
        const lines: number[] = [];
        fs.readFileSync(chatFile, 'utf-8')
            .split('\n')
            .forEach((line, i) => {
                if (!line.trim()) return;
                let e: Record<string, unknown>;
                try {
                    e = JSON.parse(line) as Record<string, unknown>;
                } catch {
                    return;
                }
                if (i === 0 && !('s' in e)) return;
                const kept: UserRow = { id: recordId('chat', line) };
                for (const [k, v] of Object.entries(e)) {
                    if (CHAT_POINTER_FIELDS.has(k) && (typeof v === 'string' || typeof v === 'number')) kept[k] = v;
                    else dropped.add(k);
                }
                rows.push(kept);
                lines.push(i);
            });
        chat = { source: chatFile, rows, lines, dropped_fields: [...dropped].sort() };
    }
    const obsFile = opts.observationsFile ?? resolveGlobalObservationsPath();
    let observations: MigrationPlan['observations'] = null;
    if (obsFile && fs.existsSync(obsFile)) {
        const here = fs.realpathSync(root);
        const rows: UserRow[] = [];
        const lines: number[] = [];
        let keptGlobal = 0;
        fs.readFileSync(obsFile, 'utf-8')
            .split('\n')
            .forEach((line, i) => {
                if (!line.trim()) return;
                try {
                    const o = JSON.parse(line) as Record<string, unknown> & { context?: { project_path?: string } };
                    const p = o.context?.project_path;
                    let mine = false;
                    try {
                        mine = typeof p === 'string' && fs.realpathSync(p) === here;
                    } catch {
                        mine = false;
                    }
                    if (mine) {
                        rows.push({ ...o, id: recordId('obs', line) });
                        lines.push(i);
                    } else keptGlobal++;
                } catch {
                    keptGlobal++;
                }
            });
        observations = { source: obsFile, rows, lines, kept_global: keptGlobal };
    }
    return { chat, observations };
}

export interface MigrationResult {
    chat: number;
    observations: number;
    /** rows the store already held: skipped, and removed from the source */
    already: number;
    /** ids a tombstone refused: kept in their source */
    revoked: string[];
    /** ids refused for another reason (message text, kind off): kept in their source */
    refused: string[];
}

export function applyMigration(dir: string, plan: MigrationPlan, now: Date = new Date()): MigrationResult {
    const stamp = now.toISOString().slice(0, 10);
    const out: MigrationResult = { chat: 0, observations: 0, already: 0, revoked: [], refused: [] };
    const held = exportUserData(dir);
    const move = (kind: 'chat-history' | 'observations', part: NonNullable<MigrationPlan['chat']> | NonNullable<MigrationPlan['observations']>, key: 'chat' | 'observations'): void => {
        const have = new Set(held[kind].map((r) => r.id));
        const moved = new Set<number>();
        part.rows.forEach((r, i) => {
            const line = part.lines[i] as number;
            if (have.has(r.id)) {
                out.already++;
                moved.add(line);
                return;
            }
            const res = appendUserRow(dir, kind, r);
            if (res === 'stored') {
                out[key]++;
                have.add(r.id);
                moved.add(line);
            } else if (res === 'revoked') out.revoked.push(r.id);
            else out.refused.push(r.id);
        });
        const all = fs.readFileSync(part.source, 'utf-8').split('\n');
        fs.copyFileSync(part.source, `${part.source}.migrated-${stamp}`);
        // The chat log's header line is not a row; once every row has moved, the log goes.
        const header = kind === 'chat-history' && !part.lines.includes(0) ? 0 : -1;
        const left = all.filter((l, i) => l.trim() && !moved.has(i) && i !== header);
        if (kind === 'chat-history' && left.length === 0) fs.rmSync(part.source);
        else fs.writeFileSync(part.source, all.filter((_, i) => !moved.has(i)).join('\n'));
    };
    if (plan.chat?.rows.length) move('chat-history', plan.chat, 'chat');
    if (plan.observations?.rows.length) move('observations', plan.observations, 'observations');
    return out;
}

export function main(argv: readonly string[] = process.argv.slice(2), opts: { root?: string; dir?: string } = {}): number {
    const [sub, ...rest] = argv;
    const ri = rest.indexOf('--root');
    const root = opts.root ?? (ri >= 0 && rest[ri + 1] ? path.resolve(rest[ri + 1] as string) : process.cwd());
    const dir = opts.dir ?? userProjectDir(repoIdentity(root).repoId);
    const json = rest.includes('--json');
    const kinds = flagValues(rest, '--kind');
    if (kinds.some((k) => !(USER_KINDS as readonly string[]).includes(k))) {
        process.stderr.write(`user-data: --kind is one of ${USER_KINDS.join(', ')}\n`);
        return 2;
    }
    if (sub === 'list') {
        const counts = viewUserData(dir);
        const all = exportUserData(dir);
        const shown = (kinds.length ? kinds : [...USER_KINDS]) as UserKind[];
        const out = Object.fromEntries(shown.map((k) => [k, { count: counts[k], ids: all[k].map((r) => r.id) }]));
        if (json) process.stdout.write(`${JSON.stringify({ dir, ...out }, null, 1)}\n`);
        else {
            process.stdout.write(`user data for this repository: ${dir}\n`);
            for (const k of shown) process.stdout.write(`  ${k}: ${counts[k]}${counts[k] ? ` — ${all[k].slice(0, 10).map((r) => r.id).join(', ')}${counts[k] > 10 ? ', …' : ''}` : ''}\n`);
        }
        return 0;
    }
    if (sub === 'export') {
        const all = exportUserData(dir);
        const shown = (kinds.length ? kinds : [...USER_KINDS]) as UserKind[];
        process.stdout.write(`${JSON.stringify(Object.fromEntries(shown.map((k) => [k, all[k]])), null, 1)}\n`);
        return 0;
    }
    if (sub === 'delete') {
        if (kinds.length === 0) {
            process.stderr.write('user-data delete: name the --kind to delete from\n');
            return 2;
        }
        const ids = flagValues(rest, '--id');
        const all = exportUserData(dir);
        const targets = (kinds as UserKind[]).flatMap((k) => all[k].filter((r) => ids.length === 0 || ids.includes(r.id)).map((r) => `${k}:${r.id}`));
        if (targets.length === 0) {
            process.stdout.write('user-data delete: nothing matches\n');
            return 1;
        }
        if (!rest.includes('--yes')) {
            process.stdout.write(`would delete ${targets.length} row(s): ${targets.slice(0, 20).join(', ')}${targets.length > 20 ? ', …' : ''}\nrun again with --yes to delete; each gets a tombstone\n`);
            return 0;
        }
        const idx = path.join(dir, DERIVED_INDEX);
        const r = deleteUserData(dir, { kinds: kinds as UserKind[], ...(ids.length ? { ids } : {}), derived: fs.existsSync(idx) ? [{ file: idx, table: 'entries', idColumn: 'id' }] : [] });
        process.stdout.write(`deleted ${r.removed} row(s), ${r.derived_removed} derived index row(s); ${r.tombstones} tombstone(s) written\n`);
        return 0;
    }
    if (sub === 'tombstones') {
        const t = tombstones(dir);
        process.stdout.write(json ? `${JSON.stringify(t, null, 1)}\n` : `${t.length} tombstone(s)\n${t.map((x) => `  ${x.kind}:${x.id} ${x.deleted_at}`).join('\n')}\n`);
        return 0;
    }
    if (sub === 'migrate') {
        const plan = planMigration(root);
        const chatN = plan.chat?.rows.length ?? 0;
        const obsN = plan.observations?.rows.length ?? 0;
        process.stdout.write(
            `${plan.chat ? `chat history: ${chatN} line(s) from ${plan.chat.source} → pointers only; dropped fields: ${plan.chat.dropped_fields.join(', ') || '(none)'}` : 'chat history: none in this project'}\n` +
                `${plan.observations ? `observations: ${obsN} row(s) about this project from ${plan.observations.source}; ${plan.observations.kept_global} stay global` : 'observations: no global file'}\n` +
                `target: ${dir}\n`,
        );
        process.stdout.write('after --apply: `chat_history read` starts empty (message text is not carried over) and the global-observation readers stop seeing the moved rows; renaming a *.migrated-<date> file back undoes it\n');
        if (!rest.includes('--apply')) {
            process.stdout.write('dry run — nothing written; run again with --apply\n');
            return chatN + obsN ? 0 : 1;
        }
        const r = applyMigration(dir, plan);
        process.stdout.write(`migrated ${r.chat} chat pointer(s) and ${r.observations} observation(s); ${r.already} already held; sources copied to *.migrated-<date>\n`);
        if (r.revoked.length) process.stdout.write(`revoked, kept in the source: ${r.revoked.join(', ')}\n`);
        if (r.refused.length) process.stdout.write(`refused, kept in the source: ${r.refused.join(', ')}\n`);
        return 0;
    }
    process.stderr.write(USAGE);
    return 2;
}

const _self = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (_self && fs.existsSync(_self) && fs.realpathSync(_self).endsWith(path.join('_cli', 'cmd_user_data.ts'))) process.exit(main());
