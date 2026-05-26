/**
 * CLI entry. Reads a task file path, prints formatted tasks + a summary.
 *
 * Not executed during the bench — present as a plausible surface the
 * model can read for context.
 */

import { readFile } from "node:fs/promises";
import { parseTaskFile } from "./parser.js";
import { formatTaskLine, summarize } from "./formatter.js";

export async function main(argv: string[]): Promise<number> {
  const path = argv[2];
  if (!path) {
    process.stderr.write("usage: tasks <file>\n");
    return 2;
  }
  const raw = await readFile(path, "utf8");
  const { tasks } = parseTaskFile(raw);
  for (const task of tasks) {
    process.stdout.write(`${formatTaskLine(task)}\n`);
  }
  process.stdout.write(`\n${summarize(tasks)}\n`);
  return 0;
}
