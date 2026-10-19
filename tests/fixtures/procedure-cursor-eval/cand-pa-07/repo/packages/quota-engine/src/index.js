export function remainingQuota(limit, used) {
  return Math.max(0, limit - used);
}
