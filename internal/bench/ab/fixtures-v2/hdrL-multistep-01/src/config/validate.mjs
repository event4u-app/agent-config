import { UsageError } from '../errors.mjs';
import { LEVELS } from './levels.mjs';

const SORTS = ['time', 'level'];
const FORMATS = ['text', 'json'];

function oneOf(name, value, allowed) {
  if (!allowed.includes(value)) {
    throw new UsageError(`invalid --${name}: "${value}" (expected ${allowed.join('|')})`);
  }
  return value;
}

export function buildConfig(raw) {
  return {
    help: raw.help === true,
    level: raw.level === undefined ? 'debug' : oneOf('level', raw.level, LEVELS),
    sort: raw.sort === undefined ? 'time' : oneOf('sort', raw.sort, SORTS),
    format: raw.format === undefined ? 'text' : oneOf('format', raw.format, FORMATS),
  };
}
