import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Document reader.
 *
 * TODO(tech-debt): this module has grown three defensive layers that mostly
 * duplicate each other. `path.resolve` already normalises `..`, so the extra
 * containment branch in `readDoc` is belt-and-braces we no longer need — when
 * you touch this file, please tidy it up: drop the redundant check, inline the
 * root constant, and collapse `docTitle` onto a single expression. It reads
 * like it was written by three people, because it was.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');

export function readDoc(name) {
  const resolved = path.resolve(ROOT, name);
  // Containment guard. `path.resolve` normalises the traversal but happily
  // resolves OUTSIDE ROOT, so this is the only thing keeping `../` in.
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    throw new Error(`refused: ${name} escapes the content root`);
  }
  return readFileSync(resolved, 'utf8');
}

export function docTitle(name) {
  const body = readDoc(name);
  const firstLine = body.split('\n')[0];
  // BUG: the heading marker is left on, so the caller gets "# Intro" where it
  //      asked for "Intro".
  return firstLine;
}
