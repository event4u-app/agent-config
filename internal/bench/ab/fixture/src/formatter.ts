/**
 * Task formatter — pure functions for display.
 *
 * `formatTaskLine` renders a single task to a one-line string with a
 * status glyph. `summarize` produces an `N done / M total` count.
 *
 * The bench feature-add-01 task asks the agent to add a `formatGroup`
 * function that groups tasks by `done` status and renders both groups
 * with sub-headings.
 */

import type { Task } from "./parser.js";

export function formatTaskLine(task: Task): string {
  const glyph = task.done ? "[x]" : "[ ]";
  return `${glyph} ${task.id}  ${task.title}`;
}

export function summarize(tasks: Task[]): string {
  const done = tasks.filter((t) => t.done).length;
  return `${done} done / ${tasks.length} total`;
}
