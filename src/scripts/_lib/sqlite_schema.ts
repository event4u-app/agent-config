/**
 * Schema helpers for the `node:sqlite` stores in this tree.
 */
import type { DatabaseSync } from 'node:sqlite';

/**
 * Add a column to an existing table when it is absent.
 *
 * `CREATE TABLE IF NOT EXISTS` is a no-op on a database that predates a
 * column, so a store created by an earlier build needs the explicit add or the
 * field is silently missing from every read.
 *
 * `PRAGMA table_info` rather than a catch around `ALTER TABLE`: swallowing the
 * error would also swallow a genuine schema failure, and a store that silently
 * fails to migrate reads exactly like one that never needed to.
 */
export function addColumnIfMissing(db: DatabaseSync, table: string, column: string, decl: string): void {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (cols.length === 0) return;
    if (cols.some((c) => c.name === column)) return;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
}
