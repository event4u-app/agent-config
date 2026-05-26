/**
 * Task file parser.
 *
 * Reads JSON of the shape:
 *   { "tasks": [{ "id": string, "title": string, "done": boolean }] }
 *
 * Throws on malformed input. The bench corpus has a known bug here:
 * empty-string ids are accepted but should be rejected. See Track-B
 * bug-fix-01 in `internal/bench/corpora/ab-trackb.yaml`.
 */

export interface Task {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskFile {
  tasks: Task[];
}

export function parseTaskFile(raw: string): TaskFile {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`task file is not valid JSON: ${(err as Error).message}`);
  }
  if (typeof data !== "object" || data === null || !("tasks" in data)) {
    throw new Error("task file must have a top-level `tasks` array");
  }
  const tasks = (data as { tasks: unknown }).tasks;
  if (!Array.isArray(tasks)) {
    throw new Error("`tasks` must be an array");
  }
  return { tasks: tasks.map(coerceTask) };
}

function coerceTask(value: unknown, index: number): Task {
  if (typeof value !== "object" || value === null) {
    throw new Error(`task[${index}] is not an object`);
  }
  const t = value as Record<string, unknown>;
  if (typeof t.id !== "string") {
    throw new Error(`task[${index}].id must be a string`);
  }
  // KNOWN BUG: empty-string id silently passes. Bug-fix-01 expects a
  //            non-empty-string check here.
  if (typeof t.title !== "string") {
    throw new Error(`task[${index}].title must be a string`);
  }
  if (typeof t.done !== "boolean") {
    throw new Error(`task[${index}].done must be a boolean`);
  }
  return { id: t.id, title: t.title, done: t.done };
}
