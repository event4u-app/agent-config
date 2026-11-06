export const LEVELS = ['debug', 'info', 'warn', 'error'];

export function levelRank(level) {
  return LEVELS.indexOf(level);
}
