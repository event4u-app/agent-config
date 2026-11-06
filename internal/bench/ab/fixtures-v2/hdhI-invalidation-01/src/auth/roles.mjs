const assignments = new Map([
  ['u1', new Set(['admin', 'editor'])],
  ['u2', new Set(['viewer'])],
]);

// Role lookups happen on every request, so they are cached per user.
const roleCache = new Map();

export function getRoles(userId) {
  if (roleCache.has(userId)) return roleCache.get(userId);
  const roles = [...(assignments.get(userId) ?? [])].sort();
  roleCache.set(userId, roles);
  return roles;
}

export function grantRole(userId, role) {
  if (!assignments.has(userId)) assignments.set(userId, new Set());
  assignments.get(userId).add(role);
}

export function revokeRole(userId, role) {
  assignments.get(userId)?.delete(role);
}
